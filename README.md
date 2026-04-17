# Finanzzwerg

> Self-hosted, privacy-first personal finance management.

---

## Why Finanzzwerg?

* No bank API required — works with simple CSV exports
* Fully self-hosted — your data stays yours
* Smart rule engine — categorize once, automate forever
* Simple setup — one command and you're done

---

## Who is this for?

Finanzzwerg is designed for people who:

* want a **simple self-hosted finance tracker**
* don’t want to deal with complex cloud tools like AWS or banking APIs
* prefer **control and simplicity over automation magic**
* just want their finances organized — without friction

> ⚠️ Finanzzwerg does not connect directly to your bank.
> You import transactions via CSV exports.

---

## Features

| Feature                                      | Status     |
| -------------------------------------------- | ---------- |
| CSV import (configurable per bank)           | ✅ MVP      |
| Transaction inbox                            | ✅ MVP      |
| Rule-based auto-categorization               | ✅ MVP      |
| Rule learning (suggest on manual categorize) | ✅ MVP      |
| Monthly dashboard with charts                | ✅ MVP      |
| Category management                          | ✅ MVP      |
| Import deduplication (SHA-256 hash)          | ✅ MVP      |
| Bulk categorization                          | ✅ MVP      |
| Filter by income / expenses                  | ✅ MVP      |
| EN / DE language support (auto-detect)       | ✅ MVP      |
| Budgeting (monthly limits per category)      | ✅ MVP      |
| Multi-user auth (each user owns their data)  | ✅ MVP      |
| ML-based categorization                      | 🔲 Planned |
| Bank API integration                         | 🔲 Planned |

---

## Screenshots

*(add screenshots here — dashboard, import, inbox)*

---

## Installation

### Requirements

* Linux server (Ubuntu, Debian, Fedora, RHEL, Arch, openSUSE)
* Internet access

### One-command setup

```bash
git clone <your-repo-url> finanzzwerg
cd finanzzwerg
bash finanzzwerg.sh install
```

The script will:

* install Docker (if missing)
* generate a secure `.env`
* build and start all services
* wait until everything is ready

Open:

```
http://your-server-ip
```

---

## Management

```bash
bash finanzzwerg.sh start
bash finanzzwerg.sh stop
bash finanzzwerg.sh update
bash finanzzwerg.sh uninstall
```

---

## Ports

| Service     | Port |
| ----------- | ---- |
| Frontend    | 80   |
| Backend API | 8000 |
| PostgreSQL  | 5432 |

API docs:
http://your-server-ip:8000/api/docs

---

## Architecture

```
finanzzwerg/
├── finanzzwerg.sh
├── docker-compose.yml
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── api/v1/
│   │   └── core/
│   │       ├── csv_parser.py
│   │       └── seeder.py
│   └── alembic/
│
└── frontend/
    └── src/
        ├── api/
        ├── components/
        ├── pages/
        ├── i18n.ts
        ├── types/
        └── lib/
```

---

## Tech Stack

| Layer            | Technology              |
| ---------------- | ----------------------- |
| Backend          | Python 3.12, FastAPI    |
| Database         | PostgreSQL 16           |
| Frontend         | React, TypeScript, Vite |
| Styling          | Tailwind CSS            |
| Data fetching    | TanStack Query          |
| Charts           | Recharts                |
| i18n             | react-i18next           |
| Containerization | Docker                  |

---

## CSV Import

Supports any bank CSV via configurable profiles.

| Field                 | Description        | Default       |
| --------------------- | ------------------ | ------------- |
| `date_column`         | Date column        | `date`        |
| `date_format`         | Format string      | `%Y-%m-%d`    |
| `amount_column`       | Amount column      | `amount`      |
| `decimal_separator`   | `.` or `,`         | `.`           |
| `description_columns` | Combined fields    | `description` |
| `skip_rows`           | Skip before header | `0`           |

Built-in presets:

* Deutsche Bank
* ING
* Generic CSV

---

## Deduplication

Each transaction is hashed (SHA-256):

```
date + amount + description
```

Re-importing the same file is safe — duplicates are skipped.

---

## Rule Engine

Rules are applied automatically on import.

* Substring (default)
* Exact match
* Regex

Priority-based — first match wins.

---

## Rule Learning

When you categorize manually:

→ Finanzzwerg suggests creating a rule
→ You can accept, modify, or ignore

---

## Environment

`.env` is auto-generated during install.

| Variable                 | Description     |
| ------------------------ | --------------- |
| POSTGRES_USER            | DB user         |
| POSTGRES_PASSWORD        | DB password     |
| POSTGRES_DB              | DB name         |
| SECRET_KEY               | App secret      |
| CORS_ORIGINS             | Allowed origins |
| VITE_API_URL             | Backend URL     |
| ACCESS_TOKEN_EXPIRE_DAYS | JWT lifetime    |

---

## Philosophy

Finanzzwerg focuses on:

* simplicity over complexity
* control over automation
* self-hosting over cloud lock-in

No unnecessary features.
No over-engineering.
Just a tool that works.

---

## License

MIT