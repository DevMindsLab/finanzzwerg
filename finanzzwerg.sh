#!/usr/bin/env bash
# =============================================================================
#  Finanzzwerg — Management script
#  Usage: ./finanzzwerg.sh [install|start|stop|update|uninstall]
#
#  Supports: Ubuntu · Debian · Linux Mint · Fedora · RHEL/CentOS/Alma/Rocky
#            Arch · Manjaro · openSUSE Leap/Tumbleweed
# =============================================================================
set -euo pipefail
# NOTE: IFS is deliberately left at the default (space/tab/newline) so that
# array literals and the DOCKER_CMD array expand correctly.

# ── Terminal colours (disabled when not a tty) ────────────────────────────────
if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; CYAN=''; BOLD=''; DIM=''; NC=''
fi

# ── Logging helpers ───────────────────────────────────────────────────────────
info()    { echo -e "  ${CYAN}→${NC}  $*"; }
ok()      { echo -e "  ${GREEN}✓${NC}  $*"; }
warn()    { echo -e "  ${YELLOW}⚠${NC}  $*" >&2; }
die()     { echo -e "\n  ${RED}✗  ERROR:${NC} $*\n" >&2; exit 1; }
section() { echo -e "\n${BOLD}${BLUE}▸ $*${NC}"; }
divider() { echo -e "${DIM}  ─────────────────────────────────────────────${NC}"; }

# ── Banner ────────────────────────────────────────────────────────────────────
banner() {
  echo ""
  echo -e "${CYAN}${BOLD}"
  cat << 'EOF'
    ███████╗██╗███╗   ██╗ █████╗ ███╗   ██╗███████╗███████╗██╗    ██╗███████╗██████╗  ██████╗
    ██╔════╝██║████╗  ██║██╔══██╗████╗  ██║╚════██║╚════██║██║    ██║██╔════╝██╔══██╗██╔════╝
    █████╗  ██║██╔██╗ ██║███████║██╔██╗ ██║    ██╔╝    ██╔╝██║ █╗ ██║█████╗  ██████╔╝██║  ███╗
    ██╔══╝  ██║██║╚██╗██║██╔══██║██║╚██╗██║   ██╔╝    ██╔╝ ██║███╗██║██╔══╝  ██╔══██╗██║   ██║
    ██║     ██║██║ ╚████║██║  ██║██║ ╚████║██████╔╝██████╔╝╚███╔███╔╝███████╗██║  ██║╚██████╔╝
    ╚═╝     ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚══════╝ ╚══╝╚══╝ ╚══════╝╚═╝  ╚═╝ ╚═════╝
EOF
  echo -e "${NC}"
  echo -e "  ${BOLD}Self-hosted personal finance management  •  v0.3.0${NC}"
  echo -e "  ${DIM}Usage: ./finanzzwerg.sh [install|start|stop|update|uninstall]${NC}"
  echo ""
  divider
}

# =============================================================================
#  VARIABLES
# =============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
REPO_URL="https://github.com/DevMindsLab/finanzzwerg"
FRONTEND_PORT=80
BACKEND_PORT=8000
DB_PORT=5432
COMMAND="${1:-install}"

SUDO=""
DOCKER_CMD=()
NEED_GROUP_RELOAD=false

# Populated by detect_os() during install / uninstall:
PKG_FAMILY=""
PKG_MANAGER=""
DOCKER_REPO_DISTRO=""
DOCKER_CODENAME=""

# =============================================================================
#  SHARED — Prerequisites
# =============================================================================
check_prerequisites() {
  section "Checking prerequisites"

  if (( BASH_VERSINFO[0] < 4 )); then
    die "Bash 4+ is required (found ${BASH_VERSION}). Please upgrade bash."
  fi

  [[ -f "$COMPOSE_FILE" ]] \
    || die "docker-compose.yml not found.\nRun this script from the Finanzzwerg project root:\n\n  cd /path/to/finanzzwerg && bash finanzzwerg.sh"

  if [[ $EUID -eq 0 ]]; then
    SUDO=""
    warn "Running as root — Docker will be installed system-wide."
  else
    if command -v sudo &>/dev/null; then
      SUDO="sudo"
      if ! sudo -n true 2>/dev/null; then
        warn "sudo will be needed — you may be prompted for your password."
        sudo -v || die "Could not obtain sudo privileges."
      fi
      ok "sudo available"
    else
      die "This script requires sudo or root access to install packages."
    fi
  fi

  # For install only: auto-install missing core utilities
  if [[ "$COMMAND" == "install" ]]; then
    local missing=()
    for cmd in curl grep sed awk; do
      command -v "$cmd" &>/dev/null || missing+=("$cmd")
    done
    if [[ ${#missing[@]} -gt 0 ]]; then
      info "Installing missing utilities: ${missing[*]}"
      if command -v apt-get &>/dev/null; then
        $SUDO apt-get update -qq
        $SUDO apt-get install -y -qq "${missing[@]}"
      elif command -v dnf &>/dev/null; then
        $SUDO dnf install -y -q "${missing[@]}"
      elif command -v yum &>/dev/null; then
        $SUDO yum install -y -q "${missing[@]}"
      elif command -v pacman &>/dev/null; then
        $SUDO pacman -Sy --noconfirm --needed "${missing[@]}"
      elif command -v zypper &>/dev/null; then
        $SUDO zypper --non-interactive install "${missing[@]}"
      else
        die "Cannot auto-install ${missing[*]}: no supported package manager found.\nPlease install them manually and re-run."
      fi
      for cmd in "${missing[@]}"; do
        command -v "$cmd" &>/dev/null || die "Failed to install '$cmd'. Please install it manually."
      done
    fi
  fi

  ok "Core utilities present"
}

# =============================================================================
#  BOOTSTRAP — Clone repo when script is run standalone (outside project dir)
# =============================================================================
bootstrap_if_needed() {
  # Already inside the project — nothing to do
  [[ -f "$COMPOSE_FILE" ]] && return

  section "Bootstrap"
  info "Script is not running from the Finanzzwerg project root."
  info "Cloning the repository automatically..."

  # Minimal sudo setup for package installs
  if [[ $EUID -ne 0 ]] && command -v sudo &>/dev/null; then
    SUDO="sudo"
    sudo -v 2>/dev/null || true
  fi

  # Install git if missing
  if ! command -v git &>/dev/null; then
    info "git not found — installing..."
    if   command -v apt-get &>/dev/null; then $SUDO apt-get update -qq && $SUDO apt-get install -y -qq git
    elif command -v dnf     &>/dev/null; then $SUDO dnf install -y -q git
    elif command -v yum     &>/dev/null; then $SUDO yum install -y -q git
    elif command -v pacman  &>/dev/null; then $SUDO pacman -Sy --noconfirm --needed git
    elif command -v zypper  &>/dev/null; then $SUDO zypper --non-interactive install git
    else die "git is not installed and no supported package manager was found.\nPlease install git manually and re-run."
    fi
    command -v git &>/dev/null || die "git installation failed. Please install it manually."
    ok "git installed"
  else
    ok "git is available"
  fi

  # Ask for install directory
  local default_dir="$HOME/finanzzwerg"
  echo ""
  printf "  Install directory [%s]: " "$default_dir"
  read -r install_dir </dev/tty
  install_dir="${install_dir:-$default_dir}"

  if [[ -f "$install_dir/docker-compose.yml" ]]; then
    ok "Project already present at ${install_dir}"
  elif [[ -d "$install_dir" ]]; then
    die "Directory '${install_dir}' exists but is not a Finanzzwerg project.\nChoose a different path or remove it first."
  else
    info "Cloning ${REPO_URL} into ${install_dir} ..."
    git clone "$REPO_URL" "$install_dir" \
      || die "Clone failed. Check your internet connection."
    ok "Repository cloned"
  fi

  info "Handing off to the project script..."
  exec bash "$install_dir/finanzzwerg.sh" install
}

# =============================================================================
#  INSTALL/UNINSTALL — Detect OS
# =============================================================================
detect_os() {
  section "Detecting operating system"

  local os_id="" os_like="" pretty_name=""

  if [[ -f /etc/os-release ]]; then
    os_id="$(     . /etc/os-release && echo "${ID:-}"          )"
    os_like="$(   . /etc/os-release && echo "${ID_LIKE:-}"     )"
    pretty_name="$( . /etc/os-release && echo "${PRETTY_NAME:-}" )"
  elif command -v lsb_release &>/dev/null; then
    os_id="$(lsb_release -si | tr '[:upper:]' '[:lower:]')"
  else
    die "Cannot detect OS: /etc/os-release not found and lsb_release unavailable."
  fi

  os_id="${os_id,,}"
  os_like="${os_like,,}"

  case "$os_id" in
    ubuntu|pop|neon)
      PKG_FAMILY="debian"; PKG_MANAGER="apt-get"
      DOCKER_REPO_DISTRO="ubuntu"
      DOCKER_CODENAME="$(. /etc/os-release && echo "${VERSION_CODENAME:-}")"
      ;;
    linuxmint|elementary|zorin)
      PKG_FAMILY="debian"; PKG_MANAGER="apt-get"
      DOCKER_REPO_DISTRO="ubuntu"
      DOCKER_CODENAME="$(. /etc/os-release && echo "${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}")"
      ;;
    debian|raspbian|kali|parrot)
      PKG_FAMILY="debian"; PKG_MANAGER="apt-get"
      DOCKER_REPO_DISTRO="debian"
      DOCKER_CODENAME="$(. /etc/os-release && echo "${VERSION_CODENAME:-}")"
      ;;
    fedora)
      PKG_FAMILY="fedora"; PKG_MANAGER="dnf"
      ;;
    rhel|centos|almalinux|rocky|ol)
      PKG_FAMILY="rhel"
      PKG_MANAGER="$(command -v dnf &>/dev/null && echo dnf || echo yum)"
      ;;
    arch|manjaro|endeavouros|garuda|artix)
      PKG_FAMILY="arch"; PKG_MANAGER="pacman"
      ;;
    opensuse*|sles)
      PKG_FAMILY="suse"; PKG_MANAGER="zypper"
      ;;
    *)
      if   echo "$os_like" | grep -qw "ubuntu";  then
        PKG_FAMILY="debian"; PKG_MANAGER="apt-get"
        DOCKER_REPO_DISTRO="ubuntu"
        DOCKER_CODENAME="$(. /etc/os-release && echo "${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}")"
      elif echo "$os_like" | grep -qw "debian";  then
        PKG_FAMILY="debian"; PKG_MANAGER="apt-get"
        DOCKER_REPO_DISTRO="debian"
        DOCKER_CODENAME="$(. /etc/os-release && echo "${VERSION_CODENAME:-}")"
      elif echo "$os_like" | grep -qw "fedora";  then
        PKG_FAMILY="fedora"; PKG_MANAGER="dnf"
      elif echo "$os_like" | grep -qw "rhel";    then
        PKG_FAMILY="rhel";   PKG_MANAGER="dnf"
      elif echo "$os_like" | grep -qw "arch";    then
        PKG_FAMILY="arch";   PKG_MANAGER="pacman"
      elif echo "$os_like" | grep -qw "suse";    then
        PKG_FAMILY="suse";   PKG_MANAGER="zypper"
      else
        die "Unsupported distribution: '${os_id}'.\nInstall Docker manually (https://docs.docker.com/engine/install/) then re-run this script."
      fi
      ;;
  esac

  ok "Detected: ${BOLD}${pretty_name:-$os_id}${NC} (family: ${PKG_FAMILY}, pkg: ${PKG_MANAGER})"
}

# =============================================================================
#  INSTALL — Install Docker per distro
# =============================================================================
install_docker_debian() {
  info "Installing Docker for ${DOCKER_REPO_DISTRO} (${DOCKER_CODENAME})..."

  if [[ -z "$DOCKER_CODENAME" ]]; then
    die "Could not determine the release codename needed for the Docker apt repo.\nSet DOCKER_CODENAME manually and re-run."
  fi

  local known_codenames="buster bullseye bookworm trixie focal jammy noble oracular plucky"
  if ! echo "$known_codenames" | grep -qw "$DOCKER_CODENAME"; then
    warn "Release codename '${DOCKER_CODENAME}' is not in the known-supported list."
    warn "Docker's apt repo may not have packages for it yet."
    warn "See https://docs.docker.com/engine/install/ for manual installation."
    warn "Continuing anyway — press Ctrl+C within 10 s to abort."
    sleep 10
  fi

  $SUDO apt-get update -qq
  $SUDO apt-get install -y -qq ca-certificates curl gnupg

  $SUDO install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/${DOCKER_REPO_DISTRO}/gpg" \
    | $SUDO gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
  $SUDO chmod a+r /etc/apt/keyrings/docker.gpg

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/${DOCKER_REPO_DISTRO} ${DOCKER_CODENAME} stable" \
    | $SUDO tee /etc/apt/sources.list.d/docker.list > /dev/null

  $SUDO apt-get update
  $SUDO apt-get install -y -qq \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}

install_docker_fedora() {
  info "Installing Docker (Fedora)..."
  $SUDO dnf -y -q install dnf-plugins-core
  $SUDO dnf config-manager --add-repo \
    https://download.docker.com/linux/fedora/docker-ce.repo
  $SUDO dnf install -y -q \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}

install_docker_rhel() {
  info "Installing Docker (RHEL/CentOS)..."
  $SUDO "$PKG_MANAGER" install -y -q yum-utils
  $SUDO yum-config-manager --add-repo \
    https://download.docker.com/linux/centos/docker-ce.repo
  $SUDO "$PKG_MANAGER" install -y -q \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}

install_docker_arch() {
  info "Installing Docker (Arch)..."
  $SUDO pacman -Syu --noconfirm --needed docker docker-compose
}

install_docker_suse() {
  info "Installing Docker (openSUSE)..."
  $SUDO zypper --non-interactive install docker docker-compose
}

# Full Docker install + daemon start (used by install command)
ensure_docker() {
  section "Checking Docker"

  if command -v docker &>/dev/null; then
    local ver
    ver=$(docker --version 2>/dev/null | grep -oP '\d+\.\d+\.\d+' | head -1)
    ok "Docker already installed (${ver})"
  else
    info "Docker not found — installing..."
    case "$PKG_FAMILY" in
      debian) install_docker_debian ;;
      fedora) install_docker_fedora ;;
      rhel)   install_docker_rhel   ;;
      arch)   install_docker_arch   ;;
      suse)   install_docker_suse   ;;
    esac
    ok "Docker installed"
  fi

  if docker compose version &>/dev/null 2>&1; then
    DOCKER_CMD=("docker" "compose")
    ok "Docker Compose v2 plugin detected"
  elif command -v docker-compose &>/dev/null; then
    DOCKER_CMD=("docker-compose")
    ok "docker-compose v1 detected"
  else
    die "Docker Compose not found.\nhttps://docs.docker.com/compose/install/"
  fi

  if ! $SUDO systemctl is-active --quiet docker 2>/dev/null; then
    info "Starting Docker daemon..."
    $SUDO systemctl enable --now docker 2>/dev/null || true
    if ! $SUDO systemctl is-active --quiet docker 2>/dev/null; then
      $SUDO service docker start 2>/dev/null || true
    fi
    sleep 2
    docker info &>/dev/null || die "Docker daemon did not start.\nTry manually: service docker start\nThen re-run this script."
    ok "Docker daemon started"
  else
    ok "Docker daemon is running"
  fi

  if [[ $EUID -ne 0 ]] && ! groups "$USER" | grep -qw docker; then
    info "Adding ${USER} to the 'docker' group..."
    $SUDO usermod -aG docker "$USER"
    NEED_GROUP_RELOAD=true
    warn "Group change takes effect after re-login. Using sudo for Docker in this session."
    DOCKER_CMD=("sudo" "${DOCKER_CMD[@]}")
  fi
}

# Lightweight Docker check (used by start/stop/update/uninstall)
load_docker_cmd() {
  section "Checking Docker"

  if ! command -v docker &>/dev/null; then
    die "Docker is not installed. Run first:\n  ./finanzzwerg.sh install"
  fi

  if ! docker info &>/dev/null 2>&1; then
    info "Docker daemon not running — starting..."
    $SUDO systemctl enable --now docker 2>/dev/null || true
    if ! $SUDO systemctl is-active --quiet docker 2>/dev/null; then
      $SUDO service docker start 2>/dev/null || true
    fi
    sleep 2
    docker info &>/dev/null \
      || die "Docker daemon could not be started.\nTry: service docker start"
    ok "Docker daemon started"
  else
    ok "Docker daemon is running"
  fi

  if docker compose version &>/dev/null 2>&1; then
    DOCKER_CMD=("docker" "compose")
  elif command -v docker-compose &>/dev/null; then
    DOCKER_CMD=("docker-compose")
  else
    die "Docker Compose not found."
  fi

  if [[ $EUID -ne 0 ]] && ! groups "$USER" | grep -qw docker; then
    DOCKER_CMD=("sudo" "${DOCKER_CMD[@]}")
  fi
}

# =============================================================================
#  INSTALL — Ensure frontend package-lock.json exists
# =============================================================================
prepare_lockfile() {
  section "Checking frontend lockfile"

  local pkg="$SCRIPT_DIR/frontend/package.json"
  local lock="$SCRIPT_DIR/frontend/package-lock.json"

  local need_regen=false
  if [[ ! -f "$lock" ]]; then
    warn "frontend/package-lock.json missing — generating via Docker (no Node.js required on host)..."
    need_regen=true
  elif [[ "$pkg" -nt "$lock" ]]; then
    warn "package.json was updated — regenerating package-lock.json via Docker..."
    need_regen=true
  fi

  if [[ "$need_regen" == "true" ]]; then
    docker run --rm \
      -v "$SCRIPT_DIR/frontend:/app" \
      -w /app \
      node:20-alpine \
      npm install --package-lock-only \
      || die "Failed to generate frontend/package-lock.json. Check your internet connection and try again."
    ok "frontend/package-lock.json generated/updated"
  else
    ok "frontend/package-lock.json is up to date"
  fi
}

# =============================================================================
#  INSTALL — Generate .env
# =============================================================================
generate_env() {
  section "Configuring environment"

  if [[ -f "$ENV_FILE" ]]; then
    warn ".env already exists — skipping (delete it to regenerate)."
    return
  fi

  local secret_key db_password git_url
  if command -v openssl &>/dev/null; then
    secret_key=$(openssl rand -hex 32)
    db_password=$(openssl rand -base64 18 | tr -d '/+=')
  elif command -v python3 &>/dev/null; then
    secret_key=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    db_password=$(python3 -c "import secrets; print(secrets.token_urlsafe(18))")
  else
    die "openssl or python3 is required to generate secrets."
  fi

  # Auto-detect git remote URL
  git_url="https://github.com/your-org/finanzzwerg"
  if command -v git &>/dev/null && [[ -d "$SCRIPT_DIR/.git" ]]; then
    local detected_url
    detected_url="$(git -C "$SCRIPT_DIR" remote get-url origin 2>/dev/null || true)"
    [[ -n "$detected_url" ]] && git_url="$detected_url"
  fi

  cat > "$ENV_FILE" << EOF
# ─── Generated by finanzzwerg.sh ──────────────────────────────────────────────
# Edit this file to customise your installation.

# ─── Database ─────────────────────────────────────────────────────────────────
POSTGRES_USER=finanzzwerg
POSTGRES_PASSWORD=${db_password}
POSTGRES_DB=finanzzwerg

# ─── Backend ──────────────────────────────────────────────────────────────────
SECRET_KEY=${secret_key}
CORS_ORIGINS=["http://localhost","http://localhost:${FRONTEND_PORT}","http://localhost:${BACKEND_PORT}"]

# ─── Frontend ─────────────────────────────────────────────────────────────────
VITE_API_URL=http://localhost:${BACKEND_PORT}

# ─── Ports ────────────────────────────────────────────────────────────────────
FRONTEND_PORT=${FRONTEND_PORT}
BACKEND_PORT=${BACKEND_PORT}
DB_PORT=${DB_PORT}

# ─── Updates (used by ./finanzzwerg.sh update) ────────────────────────────────
GIT_REPO_URL=${git_url}
EOF

  ok ".env generated with strong random secrets"
}

# =============================================================================
#  INSTALL — Port helpers & availability check
# =============================================================================
port_in_use() {
  local p="$1"
  ss -tln 2>/dev/null | grep -q ":${p}\b" \
    || netstat -tln 2>/dev/null | grep -q ":${p} "
}

# Upsert KEY=VALUE in $ENV_FILE (updates existing line, appends if absent)
set_env_var() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

check_ports() {
  section "Checking port availability"

  # 1. Load any previously stored ports from .env (overrides script defaults)
  if [[ -f "$ENV_FILE" ]]; then
    local v
    v="$(grep -E '^FRONTEND_PORT=' "$ENV_FILE" 2>/dev/null | cut -d= -f2 | xargs 2>/dev/null || true)"
    [[ -n "$v" ]] && FRONTEND_PORT="$v"
    v="$(grep -E '^BACKEND_PORT=' "$ENV_FILE" 2>/dev/null | cut -d= -f2 | xargs 2>/dev/null || true)"
    [[ -n "$v" ]] && BACKEND_PORT="$v"
    v="$(grep -E '^DB_PORT=' "$ENV_FILE" 2>/dev/null | cut -d= -f2 | xargs 2>/dev/null || true)"
    [[ -n "$v" ]] && DB_PORT="$v"
  fi

  # 2. Check each port; prompt for a free alternative when occupied
  local -a service_vars=("FRONTEND_PORT" "BACKEND_PORT" "DB_PORT")
  local -a service_names=("Frontend (HTTP)" "Backend API" "Database (PostgreSQL)")
  local changed=false var name port new_port

  for i in "${!service_vars[@]}"; do
    var="${service_vars[$i]}"
    name="${service_names[$i]}"
    port="${!var}"

    if port_in_use "$port"; then
      warn "Port ${port} (${name}) is already in use."
      while true; do
        printf "  New port for %-30s [Enter = keep %s]: " "${name}:" "$port"
        read -r new_port || new_port=""
        [[ -z "$new_port" ]] && { new_port="$port"; break; }
        if [[ "$new_port" =~ ^[0-9]+$ ]] && (( new_port >= 1 && new_port <= 65535 )); then
          port_in_use "$new_port" \
            && warn "Port ${new_port} is also occupied — try another." \
            || break
        else
          warn "Invalid port number. Enter a value between 1 and 65535."
        fi
      done
      printf -v "$var" '%s' "$new_port"
      [[ "$new_port" != "$port" ]] && changed=true
      ok "Port for ${name}: ${new_port}"
    else
      ok "Port ${port} (${name}) is free"
    fi
  done

  # 3. If .env already exists, persist any changes (new .env is written by generate_env)
  if [[ -f "$ENV_FILE" ]] && [[ "$changed" == "true" ]]; then
    set_env_var "FRONTEND_PORT" "$FRONTEND_PORT"
    set_env_var "BACKEND_PORT"  "$BACKEND_PORT"
    set_env_var "DB_PORT"       "$DB_PORT"
    set_env_var "CORS_ORIGINS"  "[\"http://localhost\",\"http://localhost:${FRONTEND_PORT}\",\"http://localhost:${BACKEND_PORT}\"]"
    set_env_var "VITE_API_URL"  "http://localhost:${BACKEND_PORT}"
    ok ".env updated with new port assignments"
  fi
}

# =============================================================================
#  SHARED — Build & start containers
# =============================================================================
start_services() {
  section "Building and starting Finanzzwerg"
  cd "$SCRIPT_DIR"
  info "Building images and starting containers (this may take a few minutes on first run)..."
  "${DOCKER_CMD[@]}" -f "$COMPOSE_FILE" up --build -d
  ok "Containers started"
}

# =============================================================================
#  SHARED — Wait for healthy services
# =============================================================================
wait_for_services() {
  section "Waiting for services to become healthy"

  local max_wait=120
  local elapsed=0
  local interval=3

  info "Waiting for the API (migrations run on first boot, allow ~30 s)..."
  while true; do
    if curl -sf "http://localhost:${BACKEND_PORT}/health" > /dev/null 2>&1; then
      ok "Backend API is healthy"
      break
    fi

    if (( elapsed >= max_wait )); then
      echo ""
      warn "Health check timed out after ${max_wait}s."
      warn "Services may still be starting. Check with:"
      echo -e "    ${BOLD}${DOCKER_CMD[*]} -f $COMPOSE_FILE logs -f${NC}"
      return
    fi

    printf "  \033[2m  waiting... (%ds / %ds)\033[0m\r" "$elapsed" "$max_wait"
    sleep "$interval"
    (( elapsed += interval )) || true
  done

  if curl -sf "http://localhost:${FRONTEND_PORT}/" > /dev/null 2>&1; then
    ok "Frontend is reachable"
  else
    warn "Frontend not yet reachable on :${FRONTEND_PORT} — may still be starting."
  fi
}

# =============================================================================
#  SHARED — Print success summary
# =============================================================================
print_summary() {
  local cmd_display="${DOCKER_CMD[*]}"

  divider
  echo ""
  echo -e "  ${GREEN}${BOLD}Finanzzwerg is running!${NC}"
  echo ""
  echo -e "  ${BOLD}URLs${NC}"
  echo -e "    ${CYAN}Frontend${NC}   →  http://localhost"
  echo -e "    ${CYAN}API docs${NC}   →  http://localhost:${BACKEND_PORT}/api/docs"
  echo ""
  echo -e "  ${BOLD}Management${NC}"
  echo -e "    ${DIM}# Start containers${NC}"
  echo -e "    ${BOLD}./finanzzwerg.sh start${NC}"
  echo ""
  echo -e "    ${DIM}# Stop containers${NC}"
  echo -e "    ${BOLD}./finanzzwerg.sh stop${NC}"
  echo ""
  echo -e "    ${DIM}# Pull latest code and rebuild${NC}"
  echo -e "    ${BOLD}./finanzzwerg.sh update${NC}"
  echo ""
  echo -e "    ${DIM}# Remove everything${NC}"
  echo -e "    ${BOLD}./finanzzwerg.sh uninstall${NC}"
  echo ""
  echo -e "  ${BOLD}Logs & advanced${NC}"
  echo -e "    ${DIM}# Follow logs${NC}"
  echo -e "    ${BOLD}${cmd_display} -f ${COMPOSE_FILE} logs -f${NC}"
  echo ""
  echo -e "    ${DIM}# Stop and wipe all data${NC}"
  echo -e "    ${BOLD}${cmd_display} -f ${COMPOSE_FILE} down -v${NC}"
  echo ""

  if [[ "$NEED_GROUP_RELOAD" == "true" ]]; then
    divider
    echo ""
    echo -e "  ${YELLOW}${BOLD}Note:${NC} You were added to the 'docker' group."
    echo -e "  Log out and back in (or run ${BOLD}newgrp docker${NC}) so future docker"
    echo -e "  commands work without sudo."
    echo ""
  fi

  divider
  echo ""
}

# =============================================================================
#  COMMAND — update
# =============================================================================
cmd_update() {
  # Ensure git is available
  if ! command -v git &>/dev/null; then
    info "Installing git..."
    if command -v apt-get &>/dev/null; then
      $SUDO apt-get install -y -qq git
    elif command -v dnf &>/dev/null; then
      $SUDO dnf install -y -q git
    elif command -v yum &>/dev/null; then
      $SUDO yum install -y -q git
    elif command -v pacman &>/dev/null; then
      $SUDO pacman -S --noconfirm --needed git
    elif command -v zypper &>/dev/null; then
      $SUDO zypper --non-interactive install git
    else
      die "git is not installed and cannot be auto-installed."
    fi
    ok "git installed"
  fi

  # Read GIT_REPO_URL from .env
  local git_url=""
  if [[ -f "$ENV_FILE" ]]; then
    git_url="$(grep -E '^GIT_REPO_URL=' "$ENV_FILE" 2>/dev/null \
               | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs 2>/dev/null || true)"
  fi

  section "Pulling latest code"

  if [[ -d "$SCRIPT_DIR/.git" ]]; then
    local before_hash after_hash
    before_hash="$(git -C "$SCRIPT_DIR" rev-parse HEAD 2>/dev/null || true)"
    info "Running git pull..."
    git -C "$SCRIPT_DIR" pull --ff-only 2>&1 \
      || warn "git pull failed — check for local modifications or network issues. Rebuilding with current code."
    after_hash="$(git -C "$SCRIPT_DIR" rev-parse HEAD 2>/dev/null || true)"
    if [[ "$before_hash" == "$after_hash" ]]; then
      ok "Already up to date"
    else
      ok "Updated to $(git -C "$SCRIPT_DIR" rev-parse --short HEAD)"
    fi
  elif [[ -n "$git_url" ]]; then
    warn "This directory is not a git repository."
    warn "To enable git-based updates, clone first:"
    echo -e "    git clone ${git_url} ."
    warn "Rebuilding with current files."
  else
    warn "Not a git repository and GIT_REPO_URL is not set in .env."
    warn "Rebuilding with current files only."
  fi

  prepare_lockfile

  section "Rebuilding containers"
  cd "$SCRIPT_DIR"
  info "Rebuilding images and restarting containers..."
  "${DOCKER_CMD[@]}" -f "$COMPOSE_FILE" up --build -d
  ok "Containers rebuilt and restarted"

  wait_for_services
  print_summary
}

# =============================================================================
#  COMMAND — uninstall
# =============================================================================
cmd_uninstall() {
  section "Uninstalling Finanzzwerg"

  echo ""
  echo -e "  ${RED}${BOLD}WARNING — The following will be permanently deleted:${NC}"
  echo ""
  echo -e "    • All Finanzzwerg containers"
  echo -e "    • All data volumes (database, uploads) — ${BOLD}your data will be lost${NC}"
  echo -e "    • Docker images for this project"
  echo -e "    • The .env configuration file"
  echo ""
  echo -ne "  Type ${BOLD}yes${NC} to confirm: "
  read -r confirmation
  if [[ "$confirmation" != "yes" ]]; then
    echo ""
    info "Aborted — nothing was changed."
    echo ""
    exit 0
  fi

  # ── 1. Stop containers & remove volumes ────────────────────────────────────
  section "Removing containers and volumes"

  if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
    cd "$SCRIPT_DIR"

    # Populate DOCKER_CMD without the section header
    if docker compose version &>/dev/null 2>&1; then
      DOCKER_CMD=("docker" "compose")
    else
      DOCKER_CMD=("docker-compose")
    fi
    if [[ $EUID -ne 0 ]] && ! groups "$USER" | grep -qw docker 2>/dev/null; then
      DOCKER_CMD=("sudo" "${DOCKER_CMD[@]}")
    fi

    info "Stopping containers and removing volumes..."
    "${DOCKER_CMD[@]}" -f "$COMPOSE_FILE" down -v --remove-orphans 2>/dev/null || true
    ok "Containers and volumes removed"

    # ── 2. Remove project Docker images ──────────────────────────────────────
    section "Removing Docker images"
    local images=("finanzzwerg-backend" "finanzzwerg-frontend")
    local removed=0
    for img in "${images[@]}"; do
      if docker image inspect "$img" &>/dev/null 2>&1; then
        docker image rm "$img" 2>/dev/null && (( removed++ )) || true
      fi
    done
    if (( removed > 0 )); then
      ok "Removed ${removed} project image(s)"
    else
      ok "No project images found"
    fi
  else
    warn "Docker is not running — skipping container/image cleanup."
  fi

  # ── 3. Remove .env ──────────────────────────────────────────────────────────
  section "Removing configuration"

  if [[ -f "$ENV_FILE" ]]; then
    rm "$ENV_FILE"
    ok ".env removed"
  else
    ok "No .env found"
  fi

  # ── 4. Optionally remove Docker itself ─────────────────────────────────────
  echo ""
  echo -e "  ${YELLOW}${BOLD}Optional:${NC} Remove Docker from this system?"
  echo -e "  ${DIM}(Skip this if Docker is used by other projects)${NC}"
  echo -ne "  Remove Docker? [y/N] "
  read -r remove_docker
  if [[ "${remove_docker,,}" == "y" ]]; then
    section "Removing Docker"

    if command -v apt-get &>/dev/null; then
      $SUDO apt-get remove -y --purge \
        docker-ce docker-ce-cli containerd.io \
        docker-buildx-plugin docker-compose-plugin 2>/dev/null || true
      $SUDO apt-get autoremove -y 2>/dev/null || true
      $SUDO rm -f /etc/apt/sources.list.d/docker.list
      $SUDO rm -f /etc/apt/keyrings/docker.gpg
      ok "Docker removed (apt)"
    elif command -v dnf &>/dev/null; then
      $SUDO dnf remove -y \
        docker-ce docker-ce-cli containerd.io \
        docker-buildx-plugin docker-compose-plugin 2>/dev/null || true
      ok "Docker removed (dnf)"
    elif command -v yum &>/dev/null; then
      $SUDO yum remove -y \
        docker-ce docker-ce-cli containerd.io \
        docker-buildx-plugin docker-compose-plugin 2>/dev/null || true
      ok "Docker removed (yum)"
    elif command -v pacman &>/dev/null; then
      $SUDO pacman -Rs --noconfirm docker docker-compose 2>/dev/null || true
      ok "Docker removed (pacman)"
    elif command -v zypper &>/dev/null; then
      $SUDO zypper remove -y docker docker-compose 2>/dev/null || true
      ok "Docker removed (zypper)"
    else
      warn "Could not detect package manager — please remove Docker manually."
    fi

    # Remove Docker data directory
    if [[ -d /var/lib/docker ]]; then
      $SUDO rm -rf /var/lib/docker
      ok "Docker data directory removed"
    fi
  fi

  # ── 5. Summary ───────────────────────────────────────────────────────────────
  divider
  echo ""
  echo -e "  ${GREEN}${BOLD}Finanzzwerg has been uninstalled.${NC}"
  echo ""
  echo -e "  The project files in ${BOLD}${SCRIPT_DIR}${NC} were left intact."
  echo -e "  To remove them as well:"
  echo ""
  echo -e "    ${BOLD}rm -rf ${SCRIPT_DIR}${NC}"
  echo ""
  divider
  echo ""
}

# =============================================================================
#  MAIN
# =============================================================================
banner

case "$COMMAND" in
  # ── First-time installation ─────────────────────────────────────────────────
  install)
    bootstrap_if_needed
    check_prerequisites
    detect_os
    ensure_docker
    prepare_lockfile
    check_ports
    generate_env
    start_services
    wait_for_services
    print_summary
    ;;

  # ── Start stopped containers ────────────────────────────────────────────────
  start)
    check_prerequisites
    load_docker_cmd
    section "Starting Finanzzwerg"
    cd "$SCRIPT_DIR"
    info "Starting containers..."
    "${DOCKER_CMD[@]}" -f "$COMPOSE_FILE" up -d
    ok "Containers started"
    wait_for_services
    print_summary
    ;;

  # ── Stop running containers ─────────────────────────────────────────────────
  stop)
    check_prerequisites
    load_docker_cmd
    section "Stopping Finanzzwerg"
    cd "$SCRIPT_DIR"
    info "Stopping containers..."
    "${DOCKER_CMD[@]}" -f "$COMPOSE_FILE" down
    divider
    echo ""
    echo -e "  ${GREEN}${BOLD}Finanzzwerg stopped.${NC}"
    echo ""
    echo -e "  Restart:        ${BOLD}./finanzzwerg.sh start${NC}"
    echo -e "  Wipe all data:  ${BOLD}${DOCKER_CMD[*]} -f ${COMPOSE_FILE} down -v${NC}"
    echo ""
    divider
    echo ""
    ;;

  # ── Pull latest code and rebuild ────────────────────────────────────────────
  update)
    check_prerequisites
    load_docker_cmd
    cmd_update
    ;;

  # ── Remove everything ───────────────────────────────────────────────────────
  uninstall)
    check_prerequisites
    cmd_uninstall
    ;;

  # ── Unknown command ─────────────────────────────────────────────────────────
  *)
    die "Unknown command '${COMMAND}'.\n\n  Usage: ./finanzzwerg.sh [install|start|stop|update|uninstall]\n\n    install    — First-time setup (default)\n    start      — Start stopped containers\n    stop       — Stop running containers\n    update     — Pull latest code and rebuild\n    uninstall  — Remove everything"
    ;;
esac
