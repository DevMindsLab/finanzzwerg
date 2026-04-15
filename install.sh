#!/usr/bin/env bash
# =============================================================================
#  Financeless — One-click installer
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
    ███████╗██╗███╗   ██╗ █████╗ ███╗   ██╗ ██████╗███████╗██╗     ███████╗███████╗███████╗
    ██╔════╝██║████╗  ██║██╔══██╗████╗  ██║██╔════╝██╔════╝██║     ██╔════╝██╔════╝██╔════╝
    █████╗  ██║██╔██╗ ██║███████║██╔██╗ ██║██║     █████╗  ██║     █████╗  ███████╗███████╗
    ██╔══╝  ██║██║╚██╗██║██╔══██║██║╚██╗██║██║     ██╔══╝  ██║     ██╔══╝  ╚════██║╚════██║
    ██║     ██║██║ ╚████║██║  ██║██║ ╚████║╚██████╗███████╗███████╗███████╗███████║███████║
    ╚═╝     ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝╚══════╝╚══════╝╚══════╝╚══════╝╚══════╝
EOF
  echo -e "${NC}"
  echo -e "  ${BOLD}Self-hosted personal finance management  •  v0.1.0${NC}"
  echo -e "  ${DIM}https://github.com/your-org/financeless${NC}"
  echo ""
  divider
}

# =============================================================================
#  VARIABLES
# =============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
FRONTEND_PORT=80
BACKEND_PORT=8000
DB_PORT=5432

SUDO=""
# FIX 1: Use an array for the compose command so "docker compose" (two words)
# expands correctly regardless of IFS. Usage: "${DOCKER_CMD[@]}" ...
DOCKER_CMD=()

NEED_GROUP_RELOAD=false

# These are populated by detect_os():
PKG_FAMILY=""
PKG_MANAGER=""
# FIX 2: Separate variables for the Docker repo name and release codename
# so derived distros (Mint, Kali, …) map to their upstream correctly.
DOCKER_REPO_DISTRO=""   # "ubuntu" or "debian"
DOCKER_CODENAME=""      # Ubuntu/Debian release codename for the apt repo

# =============================================================================
#  STEP 0 — Sanity checks
# =============================================================================
check_prerequisites() {
  section "Checking prerequisites"

  # Bash ≥ 4 (required for lowercase ${var,,} and arrays)
  if (( BASH_VERSINFO[0] < 4 )); then
    die "Bash 4+ is required (found ${BASH_VERSION}). Please upgrade bash."
  fi

  # Must be run from the project root
  [[ -f "$COMPOSE_FILE" ]] \
    || die "docker-compose.yml not found.\nRun this script from the Financeless project root:\n\n  cd /path/to/financeless && bash install.sh"

  # Privilege escalation
  if [[ $EUID -eq 0 ]]; then
    SUDO=""
    warn "Running as root — Docker will be installed system-wide."
  else
    if command -v sudo &>/dev/null; then
      SUDO="sudo"
      # Pre-validate sudo so the password prompt happens here, not mid-script
      if ! sudo -n true 2>/dev/null; then
        warn "sudo will be needed — you may be prompted for your password."
        sudo -v || die "Could not obtain sudo privileges."
      fi
      ok "sudo available"
    else
      die "This script requires sudo or root access to install packages."
    fi
  fi

  # Required utilities — auto-install any that are missing.
  # detect_os() hasn't run yet, so we do a minimal package-manager probe here.
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
    # Verify everything is now available
    for cmd in "${missing[@]}"; do
      command -v "$cmd" &>/dev/null || die "Failed to install '$cmd'. Please install it manually."
    done
  fi
  ok "Core utilities present"
}

# =============================================================================
#  STEP 1 — Detect OS
# =============================================================================
detect_os() {
  section "Detecting operating system"

  local os_id="" os_like="" pretty_name=""

  if [[ -f /etc/os-release ]]; then
    # Source into local variables to avoid polluting the global namespace
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
    # ── Debian / Ubuntu family ──────────────────────────────────────────────
    ubuntu|pop|neon)
      PKG_FAMILY="debian"; PKG_MANAGER="apt-get"
      DOCKER_REPO_DISTRO="ubuntu"
      DOCKER_CODENAME="$(. /etc/os-release && echo "${VERSION_CODENAME:-}")"
      ;;
    # FIX 2a: Mint ships UBUNTU_CODENAME; its own VERSION_CODENAME is wrong
    linuxmint|elementary|zorin)
      PKG_FAMILY="debian"; PKG_MANAGER="apt-get"
      DOCKER_REPO_DISTRO="ubuntu"
      DOCKER_CODENAME="$(. /etc/os-release && echo "${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}")"
      ;;
    # FIX 2b: Kali/Parrot use the Debian repo, not Ubuntu
    debian|raspbian|kali|parrot)
      PKG_FAMILY="debian"; PKG_MANAGER="apt-get"
      DOCKER_REPO_DISTRO="debian"
      DOCKER_CODENAME="$(. /etc/os-release && echo "${VERSION_CODENAME:-}")"
      ;;
    # ── RPM family ──────────────────────────────────────────────────────────
    fedora)
      PKG_FAMILY="fedora"; PKG_MANAGER="dnf"
      ;;
    rhel|centos|almalinux|rocky|ol)
      PKG_FAMILY="rhel"
      PKG_MANAGER="$(command -v dnf &>/dev/null && echo dnf || echo yum)"
      ;;
    # ── Arch family ─────────────────────────────────────────────────────────
    arch|manjaro|endeavouros|garuda|artix)
      PKG_FAMILY="arch"; PKG_MANAGER="pacman"
      ;;
    # ── SUSE family ─────────────────────────────────────────────────────────
    opensuse*|sles)
      PKG_FAMILY="suse"; PKG_MANAGER="zypper"
      ;;
    # ── Fallback: check ID_LIKE ──────────────────────────────────────────────
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

  [[ -n "$DOCKER_CODENAME" ]] || true  # codename only needed for Debian family

  ok "Detected: ${BOLD}${pretty_name:-$os_id}${NC} (family: ${PKG_FAMILY}, pkg: ${PKG_MANAGER})"
}

# =============================================================================
#  STEP 2 — Install Docker
# =============================================================================
install_docker_debian() {
  # FIX 2c: Use $DOCKER_REPO_DISTRO and $DOCKER_CODENAME set by detect_os()
  info "Installing Docker for ${DOCKER_REPO_DISTRO} (${DOCKER_CODENAME})..."

  if [[ -z "$DOCKER_CODENAME" ]]; then
    die "Could not determine the release codename needed for the Docker apt repo.\nSet DOCKER_CODENAME manually and re-run."
  fi

  # Warn if the codename is not in Docker's known-supported list.
  # New distro releases (e.g. Debian Trixie, Ubuntu Plucky) may lag
  # a few weeks before Docker publishes packages for them.
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

  # Run without -qq here so a 404 (unknown codename) prints a readable error
  # rather than silently failing inside the set -e trap.
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
  # On Arch (rolling release), -Sy alone (sync DB without upgrade) risks
  # partial upgrades when the installed packages are stale.  -Syu ensures
  # the whole system is consistent before new packages are added.
  $SUDO pacman -Syu --noconfirm --needed docker docker-compose
}

install_docker_suse() {
  info "Installing Docker (openSUSE)..."
  $SUDO zypper --non-interactive install docker docker-compose
}

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

  # FIX 1: Populate DOCKER_CMD as an array, not a plain string.
  # This ensures "docker compose" (two words) is always word-split correctly
  # even if the caller has a non-default IFS.
  if docker compose version &>/dev/null 2>&1; then
    DOCKER_CMD=("docker" "compose")
    ok "Docker Compose v2 plugin detected"
  elif command -v docker-compose &>/dev/null; then
    DOCKER_CMD=("docker-compose")
    ok "docker-compose v1 detected"
  else
    die "Docker Compose not found.\nhttps://docs.docker.com/compose/install/"
  fi

  # Start & enable the daemon
  if ! $SUDO systemctl is-active --quiet docker 2>/dev/null; then
    info "Starting Docker daemon..."
    $SUDO systemctl enable --now docker 2>/dev/null || true
    # systemctl --now may not start SysV-init-backed services; fall back to
    # the legacy `service` command in that case.
    if ! $SUDO systemctl is-active --quiet docker 2>/dev/null; then
      $SUDO service docker start 2>/dev/null || true
    fi
    sleep 2
    # Verify the daemon is actually reachable via the socket
    if ! docker info &>/dev/null; then
      die "Docker daemon did not start.\nTry manually: service docker start\nThen re-run this script."
    fi
    ok "Docker daemon started"
  else
    ok "Docker daemon is running"
  fi

  # Add current user to the docker group so they can run docker without sudo
  if [[ $EUID -ne 0 ]] && ! groups "$USER" | grep -qw docker; then
    info "Adding ${USER} to the 'docker' group..."
    $SUDO usermod -aG docker "$USER"
    NEED_GROUP_RELOAD=true
    warn "Group change takes effect after re-login. Using sudo for Docker in this session."
    # Prepend sudo to the array
    DOCKER_CMD=("sudo" "${DOCKER_CMD[@]}")
  fi
}

# =============================================================================
#  STEP 3 — Generate .env
# =============================================================================
generate_env() {
  section "Configuring environment"

  if [[ -f "$ENV_FILE" ]]; then
    warn ".env already exists — skipping (delete it to regenerate)."
    return
  fi

  local secret_key db_password
  if command -v openssl &>/dev/null; then
    secret_key=$(openssl rand -hex 32)
    db_password=$(openssl rand -base64 18 | tr -d '/+=')
  elif command -v python3 &>/dev/null; then
    secret_key=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    db_password=$(python3 -c "import secrets; print(secrets.token_urlsafe(18))")
  else
    die "openssl or python3 is required to generate secrets."
  fi

  cat > "$ENV_FILE" << EOF
# ─── Generated by install.sh ──────────────────────────────────────────────────
# Edit this file to customise your installation.

# ─── Database ─────────────────────────────────────────────────────────────────
POSTGRES_USER=financeless
POSTGRES_PASSWORD=${db_password}
POSTGRES_DB=financeless

# ─── Backend ──────────────────────────────────────────────────────────────────
SECRET_KEY=${secret_key}
CORS_ORIGINS=http://localhost,http://localhost:80,http://localhost:${BACKEND_PORT}

# ─── Frontend ─────────────────────────────────────────────────────────────────
VITE_API_URL=http://localhost:${BACKEND_PORT}
EOF

  ok ".env generated with strong random secrets"
}

# =============================================================================
#  STEP 4 — Check ports
# =============================================================================
check_ports() {
  section "Checking port availability"

  # FIX 3: Explicit quoted array elements — safe regardless of IFS
  local ports=("$FRONTEND_PORT" "$BACKEND_PORT" "$DB_PORT")
  local blocked=()

  for port in "${ports[@]}"; do
    # FIX 5: Use plain `ss -tln` / `netstat -tln` — the -H flag is not
    # universally available and is unnecessary when grepping anyway.
    if ss -tln 2>/dev/null | grep -q ":${port}\b" \
        || netstat -tln 2>/dev/null | grep -q ":${port} "; then
      blocked+=("$port")
    fi
  done

  if [[ ${#blocked[@]} -gt 0 ]]; then
    warn "The following ports are already in use: ${blocked[*]}"
    warn "Another service may conflict. Press Enter to continue anyway, or Ctrl+C to abort."
    read -r -t 30 || true
  else
    ok "Ports ${ports[*]} are free"
  fi
}

# =============================================================================
#  STEP 5 — Build & start containers
# =============================================================================
start_services() {
  section "Building and starting Financeless"

  cd "$SCRIPT_DIR"

  # FIX 4: Removed the invalid pre-warm `docker compose build . --file ...`
  # call that mixed docker-build flags with docker-compose syntax.
  # The `up --build` below handles everything correctly.
  info "Building images and starting containers (this may take a few minutes on first run)..."
  "${DOCKER_CMD[@]}" -f "$COMPOSE_FILE" up --build -d

  ok "Containers started"
}

# =============================================================================
#  STEP 6 — Wait for healthy services
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
#  STEP 7 — Print success summary
# =============================================================================
print_summary() {
  # Human-readable form of the compose command for display
  local cmd_display="${DOCKER_CMD[*]}"

  divider
  echo ""
  echo -e "  ${GREEN}${BOLD}Financeless is running!${NC}"
  echo ""
  echo -e "  ${BOLD}URLs${NC}"
  echo -e "    ${CYAN}Frontend${NC}   →  http://localhost"
  echo -e "    ${CYAN}API docs${NC}   →  http://localhost:${BACKEND_PORT}/api/docs"
  echo ""
  echo -e "  ${BOLD}Useful commands${NC}"
  echo -e "    ${DIM}# Follow logs${NC}"
  echo -e "    ${BOLD}${cmd_display} -f ${COMPOSE_FILE} logs -f${NC}"
  echo ""
  echo -e "    ${DIM}# Stop${NC}"
  echo -e "    ${BOLD}${cmd_display} -f ${COMPOSE_FILE} down${NC}"
  echo ""
  echo -e "    ${DIM}# Stop and wipe all data${NC}"
  echo -e "    ${BOLD}${cmd_display} -f ${COMPOSE_FILE} down -v${NC}"
  echo ""
  echo -e "    ${DIM}# Rebuild after code changes${NC}"
  echo -e "    ${BOLD}${cmd_display} -f ${COMPOSE_FILE} up --build -d${NC}"
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
#  MAIN
# =============================================================================
banner
check_prerequisites
detect_os
ensure_docker
generate_env
check_ports
start_services
wait_for_services
print_summary
