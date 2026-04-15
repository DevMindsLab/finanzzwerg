# Financeless

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
| Multi-user auth | 🔲 Planned |
| ML-based categorization | 🔲 Planned |
| Budgeting | 🔲 Planned |
| Bank API integration | 🔲 Planned |

---

## Quick Start (Docker — recommended)

```bash
# 1. Clone
git clone https://github.com/your-org/financeless.git
cd financeless

# 2. Configure
cp .env.example .env
# Edit .env — at minimum change POSTGRES_PASSWORD and SECRET_KEY

# 3. Run
docker-compose up -d

# Open http://localhost
```

The backend runs on port **8000**, the frontend on port **80**.

---

## Development Setup

### Prerequisites

- Python 3.12+
- Node.js 20+
- PostgreSQL 16+

### Backend

```bash
cd backend

# Create virtualenv
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp ../.env.example .env
# Edit DATABASE_URL to point to your local Postgres

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

# Start dev server (proxies /api → localhost:8000)
npm run dev
```

Frontend: http://localhost:5173

### Full stack (Docker dev mode with hot-reload)

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

---

## Architecture

```
financeless/
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
│       └── versions/001_initial_schema.py
│
└── frontend/
    └── src/
        ├── api/                 # Axios API clients
        ├── components/
        │   ├── layout/          # Layout, Sidebar
        │   └── ui/              # Button, Badge, Input, Select, Modal
        ├── pages/               # DashboardPage, InboxPage, etc.
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
| Containerization | Docker, docker-compose |

---

## CSV Import

Financeless supports any bank CSV export via a configurable profile:

| Field | Description | Default |
|---|---|---|
| `date_column` | Column name for the date | `date` |
| `date_format` | strptime format string | `%Y-%m-%d` |
| `amount_column` | Column name for the amount | `amount` |
| `decimal_separator` | `.` or `,` | `.` |
| `description_columns` | Comma-separated list of columns to join | `description` |
| `skip_rows` | Rows to skip before the header | `0` |
| `debit_column` / `credit_column` | For split debit/credit | — |

Built-in presets: Deutsche Bank, ING, Generic CSV.

### Deduplication

Each transaction is fingerprinted with a SHA-256 hash of `date + amount + description`. Re-importing the same file is safe — duplicates are silently skipped.

---

## Rule Engine

Rules are applied automatically on every import, and can be re-applied manually via the UI.

- **Substring** (default): case-insensitive `in` check
- **Exact**: case-insensitive equality
- **Regex**: full Python regex match

Rules fire in descending **priority** order. First match wins.

### Rule Learning

When you manually categorize a transaction in the Inbox, Financeless suggests creating a rule for future imports. You can accept, edit the pattern, or skip.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://...` | Full PostgreSQL connection URL |
| `SECRET_KEY` | *(required)* | App secret — change in production |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Allowed frontend origins |
| `MAX_UPLOAD_SIZE_MB` | `25` | Maximum CSV upload size |

---

## Contributing

1. Fork the repo
2. Create a feature branch
3. Follow the existing code style (typing everywhere, service layer, no unnecessary abstraction)
4. Open a PR

---

## License

MIT
