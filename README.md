# Finanzzwerg

> Self-hosted, privacy-first personal finance management — inspired by Paperless-ngx.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Features

| Feature | Status |
|---|---|
| CSV import (configurable per bank) | ✅ MVP |
| Transaction inbox | ✅ MVP |
| Rule-based auto-categorization | ✅ MVP |
| Rule learning (suggest on manual categorize) | ✅ MVP |
| Monthly dashboard with charts | ✅ MVP |
| Category management | ✅ MVP |
| Import deduplication (SHA-256 hash) | ✅ MVP |
| Bulk categorization | ✅ MVP |
| Filter by income / expenses | ✅ MVP |
| EN / DE language support (auto-detect) | ✅ MVP |
| Budgeting (monthly limits per category) | ✅ MVP |
| Multi-user auth (each user owns their data) | ✅ MVP |
| ML-based categorization | 🔲 Planned |
| Bank API integration | 🔲 Planned |

---

## Installation

### Requirements

- A Linux server (Ubuntu, Debian, Fedora, RHEL, Arch, openSUSE — all supported)
- Internet access (Docker is installed automatically if missing)

### One-command setup

```bash
git clone <your-repo-url> finanzzwerg
cd finanzzwerg
bash finanzzwerg.sh install
```

The script handles everything:

- installs Docker if not present
- generates a `.env` with secure random secrets
- builds and starts all containers
- waits for the app to become healthy

Open **http://your-server-ip** when done.

### Management commands

```bash
bash finanzzwerg.sh start      # start stopped containers
bash finanzzwerg.sh stop       # stop running containers
bash finanzzwerg.sh update     # git pull + rebuild
bash finanzzwerg.sh uninstall  # remove containers, volumes, images
```

### Ports

| Service | Port |
|---|---|
| Frontend | 80 |
| Backend API | 8000 |
| PostgreSQL | 5432 |

API docs: **http://your-server-ip:8000/api/docs**

---

## Development Setup

### Prerequisites

- Python 3.12+
- Node.js 20+
- PostgreSQL 16+

### Backend

```bash
cd backend

python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Copy and edit .env (set DATABASE_URL to your local Postgres)
cp ../.env.example .env

# Run migrations (also seeds default categories)
alembic upgrade head

# Start dev server with hot-reload
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/api/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5173

---

## Architecture

```
finanzzwerg/
├── finanzzwerg.sh               # Install / start / stop / update / uninstall
├── docker-compose.yml
│
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, lifespan
│   │   ├── config.py            # Pydantic-settings config
│   │   ├── database.py          # SQLAlchemy engine + Base
│   │   ├── models/              # ORM models (Category, Transaction, Rule, ImportJob)
│   │   ├── schemas/             # Pydantic schemas (request/response)
│   │   ├── services/            # Business logic (stateless service classes)
│   │   │   ├── category_service.py
│   │   │   ├── transaction_service.py
│   │   │   ├── rule_service.py
│   │   │   └── import_service.py
│   │   ├── api/v1/              # FastAPI routers
│   │   └── core/
│   │       ├── csv_parser.py    # Configurable CSV → ParsedTransaction
│   │       └── seeder.py        # Default categories on first boot
│   └── alembic/                 # Database migrations
│
└── frontend/
    └── src/
        ├── api/                 # Axios API clients
        ├── components/
        │   ├── layout/          # Layout, Sidebar, language toggle
        │   └── ui/              # Button, Badge, Input, Select, Modal
        ├── pages/               # DashboardPage, InboxPage, TransactionsPage, …
        ├── i18n.ts              # EN / DE translations (react-i18next)
        ├── types/index.ts       # All TypeScript types
        └── lib/utils.ts         # formatCurrency, formatDate, cn
```

### Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, FastAPI 0.115, SQLAlchemy 2.0 |
| Database | PostgreSQL 16, Alembic migrations |
| Background tasks | FastAPI BackgroundTasks |
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS 3 |
| Data fetching | TanStack Query v5 |
| Charts | Recharts |
| i18n | react-i18next (EN / DE, auto-detect) |
| Containerization | Docker, Docker Compose v2 |

---

## CSV Import

Finanzzwerg supports any bank CSV export via a configurable profile:

| Field | Description | Default |
|---|---|---|
| `date_column` | Column name for the date | `date` |
| `date_format` | strptime format string | `%Y-%m-%d` |
| `amount_column` | Column name for the amount | `amount` |
| `decimal_separator` | `.` or `,` | `.` |
| `description_columns` | Comma-separated list of columns to join | `description` |
| `skip_rows` | Rows to skip before the header | `0` |
| `debit_column` / `credit_column` | For split debit/credit columns | — |

Built-in presets: Deutsche Bank, ING, Generic CSV.

### Deduplication

Each transaction is fingerprinted with a SHA-256 hash of `date + amount + description`. Re-importing the same file is safe — duplicates are silently skipped.

---

## Rule Engine

Rules are applied automatically on every import and can be re-applied manually via the UI.

- **Substring** (default): case-insensitive `in` check
- **Exact**: case-insensitive equality
- **Regex**: full Python regex match

Rules fire in descending **priority** order. First match wins.

### Rule Learning

When you manually categorize a transaction in the Inbox, Finanzzwerg suggests creating a rule for future imports. You can accept, edit the pattern, or skip.

---

## Environment Variables

The `.env` file is generated automatically by `finanzzwerg.sh install` with secure random values. You can edit it afterwards:

| Variable | Description |
|---|---|
| `POSTGRES_USER` | Database user |
| `POSTGRES_PASSWORD` | Database password |
| `POSTGRES_DB` | Database name |
| `SECRET_KEY` | App secret — keep this safe |
| `CORS_ORIGINS` | Allowed frontend origins (JSON array) |
| `VITE_API_URL` | Backend URL seen by the browser |
| `GIT_REPO_URL` | Used by `finanzzwerg.sh update` for git pull |
| `ACCESS_TOKEN_EXPIRE_DAYS` | JWT lifetime in days (default: 30) |

---

## License

MIT
