# Harmilap RTA — Office Management System

An internal web application for **Harmilap Share Transfer Agents** (SEBI Category-I Registrar & Share Transfer Agent). It brings together company records, depository beneficiary data, statutory PDF reports, GST tax invoices, and client email delivery in one place.

Built for RTA office staff — not for public investors or issuers to self-serve.

---

## What the system is for

As an RTA, Harmilap maintains records for listed and unlisted companies, processes beneficiary position files from NSDL and CDSL, prepares compliance reports for issuers, and raises annual/service tax invoices grouped by RTA client code.

This system replaces scattered spreadsheets and manual PDF work with a single dashboard where you can:

- Maintain a master register of **client companies** (ISINs, RTA codes, addresses, share capital breakdown)
- **Import beneficiary data** from NSDL BENPOS files and CDSL RT95/RT02 file pairs
- **Generate PDF reports** — Beneficiary Position (BENPOS), Share Capital Reconciliation, and Tax Invoices
- **Raise and track tax invoices** per RTA party (NSDL/CDSL client code), with GST, payment status, and bulk export
- **Email reports and invoices** to company contacts using configurable SMTP and templates
- Control **who can view, edit, import, or download** through role-based access

---

## Features

### Dashboard

Overview landing page with quick links to Companies and (for admins) User Management.

### Companies

The company register is the foundation of the system. Each record stores:

| Area | Fields |
|------|--------|
| **Identifiers** | ISIN code (12-character, when applicable), ARN number (for mutual-fund distributors without an ISIN), NSDL RTA code, CDSL RTA code |
| **Contact** | Multiple email IDs and phone numbers, authorized person name and designation |
| **Tax & legal** | GST, TAN, PAN |
| **Address** | Structured registered address (4 lines, city, state, pin), billing address |
| **Share capital** | Security type, face value, total / NSDL / CDSL / physical shares |

**Key behaviours:**

- A company must have **either an ISIN or an ARN** — ISIN is the primary key when present; ARN is used when no ISIN exists (e.g. mutual fund ARN-only clients).
- Security type can be **auto-detected from the ISIN** (positions 8–9 encode the security class).
- **Search and filter** by name, ISIN, ARN, RTA code, PAN, security type, NSDL/CDSL flags.
- **Add manually** or **bulk import/export via Excel** (`.xlsx`).
- **Edit** all fields from the detail page; **delete** cascades linked beneficiary and invoice data for ISIN-backed companies.

### Beneficiaries

Stores demat beneficiary records parsed from depository files, linked to a company by ISIN.

Each beneficiary record includes holder names (up to three), PAN, address, bank details, nominee information, and position breakdowns (free, lock-in, pledged, block, remat, etc.).

**Import:**

| Source | Format | What it does |
|--------|--------|--------------|
| **NSDL BENPOS** | ZIP of `.txt` files | Parses header (01), detail (02), and lock-in (03) records; upserts beneficiaries; syncs NSDL share totals on the company |
| **CDSL** | ZIP with RT95 + RT02 files | RT95 updates CDSL share totals; RT02 imports beneficiary detail |

Import requires the company's ISIN to already exist in the register. Unknown ISINs are reported and skipped.

**Other actions:** search by name, PAN, DP ID, client ID, or IFSC; filter by ISIN; export to Excel; view full beneficiary detail.

### Reports

Generate PDF reports per company from the Reports page.

| Report | Description |
|--------|-------------|
| **Beneficiary Position (BENPOS)** | Formatted BENPOS with DP/Client IDs, shareholder names, position data, and attached beneficiary listing. NSDL or CDSL depository can be selected. |
| **Share Capital Reconciliation** | NSDL / CDSL / Physical share breakdown with percentages. Report date and reference prefix are configurable. |

Both reports support **single-company download** and **bulk ZIP** for all companies.

Reports use Harmilap letterhead assets and are suitable for sending to issuer companies.

### Tax Invoices

Invoices are managed **per RTA party** — companies sharing the same NSDL or CDSL RTA code are grouped into one billing party.

**Invoice workflow:**

1. Configure a **global particulars template** (line items, SAC codes, taxable vs non-taxable, GST type and rates, invoice date, bank account details for the PDF).
2. The **Tax Invoices** page lists all parties derived from company RTA codes, with ISIN count (an ISIN active on both NSDL and CDSL counts as 2 units for taxable line items).
3. Open a party to **edit particulars**, GST settings, and **payment tracking** (paid/unpaid, date, amount).
4. **Generate PDF** — branded tax invoice with services table, GST summary, amount in words, important notes, bank details, and QR/stamp assets.
5. **Bulk ZIP** all invoice PDFs; **export/import Excel** for particulars and payment status across parties.

Invoice numbers follow the format `<RTA code>/<serial>` per financial year (e.g. `RTAN1553/5`).

Non-taxable line items (actual expenses / out-of-pocket) are charged flat; taxable items are multiplied by the party's ISIN unit count.

### Email

Send BENPOS reports, reconciliation reports, or tax invoices to company email addresses.

**Setup (admin):**

- Configure SMTP (presets for Outlook/Microsoft 365, Gmail, Yahoo)
- Test connection before saving

**Templates:**

- Separate templates for each document type (invoice, BENPOS, reconciliation)
- Placeholder variables (company name, ISIN, dates, etc.)
- Preview rendered subject and body before sending

**Sending:**

- Select one or many companies
- Attach the generated PDF automatically
- View per-company send status (sent / failed / no email on record)

### Users & permissions

| Role | Capabilities |
|------|--------------|
| **Admin** | Full access including user management; all permissions implicitly |
| **User** | Access controlled by assigned permissions |

| Permission | Allows |
|------------|--------|
| **Viewer** | Read-only access to companies, beneficiaries, reports, invoices, email templates |
| **Editor** | Create and update records (companies, invoice particulars, email settings) |
| **Can Ingest** | Upload Excel company files and NSDL/CDSL beneficiary ZIPs |
| **Can Download** | Export Excel and download/generate PDF reports |

Admins can create users, assign roles and permissions, activate/deactivate accounts, and reset passwords.

---

## Architecture

```
┌─────────────────┐       REST / JWT        ┌──────────────────────────────┐
│  Next.js 16     │ ◄──────────────────────►│  FastAPI backend             │
│  React 19       │                         │  SQLAlchemy + asyncpg        │
│  Dashboard UI   │                         │  ReportLab PDF generation    │
└─────────────────┘                         └──────────────┬───────────────┘
                                                           │
                                                           ▼
                                              ┌──────────────────────────────┐
                                              │  PostgreSQL                  │
                                              └──────────────────────────────┘
```

| Layer | Stack |
|-------|-------|
| Frontend | Next.js 16, React 19, TypeScript, Lucide icons |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2 (async), Pydantic |
| Database | PostgreSQL 16 |
| PDF | ReportLab + Pillow (letterhead, footer strip, stamp, QR assets) |
| Excel | openpyxl, pandas |
| Email | SMTP via configurable settings |
| Auth | JWT access + refresh tokens, bcrypt passwords |

**Project layout:**

```
Harmilap/
├── src/                    # Next.js frontend (App Router)
│   ├── app/dashboard/      # Main application pages
│   ├── components/         # UI components
│   └── lib/                # API client, types, ISIN helpers
├── backend/
│   ├── app/
│   │   ├── models/         # SQLAlchemy models
│   │   ├── routes/         # API endpoints
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   ├── services/       # PDF, Excel, email, parsers
│   │   └── assets/         # Letterhead, footer, logo, stamp, QR images
│   └── seed.py             # Create initial admin user
├── docker-compose.yml      # Local full-stack setup
└── railway.toml            # Railway deployment config
```

Database schema is created and migrated automatically on backend startup (`main.py` lifespan).

---

## Getting started

### Prerequisites

- Node.js 20+
- Python 3.12+
- PostgreSQL 16+ (or use Docker Compose)

### Option A — Docker Compose (recommended)

```bash
# From the project root
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API health | http://localhost:8000/health |

Seed the admin user (run once inside the backend container or locally with `DATABASE_URL` set):

```bash
cd backend
DATABASE_URL=postgresql+asyncpg://harmilap:harmilap@localhost:5432/harmilap python seed.py
```

Default admin credentials: `admin@harmilap.in` / `admin@123` — change after first login.

### Option B — Local development

**1. Database**

```bash
createdb harmilap
# or start only Postgres via Docker:
docker compose up postgres -d
```

**2. Backend**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Optional: create backend/.env
# DATABASE_URL=postgresql+asyncpg://harmilap:harmilap@localhost:5432/harmilap
# SECRET_KEY=your-long-random-secret
# CORS_ORIGINS=http://localhost:3000

python seed.py
uvicorn app.main:app --reload --port 8000
```

**3. Frontend**

```bash
# From project root
npm install

# Optional: create .env.local
# NEXT_PUBLIC_API_URL=http://localhost:8000

npm run dev
```

Open http://localhost:3000 and sign in.

---

## Environment variables

### Backend (`backend/.env` or deployment env)

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string (asyncpg) | `postgresql+asyncpg://harmilap:harmilap@localhost:5432/harmilap` |
| `SECRET_KEY` | JWT signing secret | `changeme-in-production-use-long-random-string` |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins | `http://localhost:3000` |

### Frontend (`.env.local` or build arg)

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:8000` |

On Railway, `NEXT_PUBLIC_API_URL` is set at build time via `railway.toml`.

---

## Typical workflows

### Onboard a new issuer company

1. Go to **Companies → Add Company** (or import Excel).
2. Enter ISIN (or ARN if no ISIN), company name, RTA codes, address, and contact emails.
3. Save — security type auto-fills from ISIN when applicable.

### Import beneficiary data

1. Ensure the company ISIN exists in Companies.
2. Go to **Beneficiaries**.
3. Upload an **NSDL BENPOS ZIP** or **CDSL ZIP** (RT95 + RT02).
4. Review the ingest summary; fix any unknown-ISIN errors by adding missing companies first.

### Send a BENPOS report to a client

1. Generate the PDF from **Reports** (or use **Email** to send directly).
2. Go to **Email**, select companies, choose the BENPOS template, preview, and send.

### Raise annual tax invoices

1. Configure the particulars template under **Tax Invoices → Particulars Config**.
2. Review each party on the **Tax Invoices** page; edit amounts and GST if needed.
3. Generate individual PDFs or a bulk ZIP.
4. Export Excel for payment tracking; re-import after marking payments.

---

## API overview

All endpoints (except `/health` and `/auth/login`) require a Bearer token.

| Prefix | Purpose |
|--------|---------|
| `/auth` | Login, refresh, logout |
| `/users` | User CRUD (admin) |
| `/companies` | Company CRUD, Excel ingest/export |
| `/beneficiaries` | List, detail, NSDL/CDSL ZIP ingest, Excel export |
| `/reports` | BENPOS, reconciliation, invoice PDF generation |
| `/invoices` | Particulars config, party invoices, PDF, Excel import/export |
| `/emails` | SMTP settings, templates, preview, send |

Interactive API docs are available at `/docs` when the backend is running.

---

## Deployment

The project ships with Dockerfiles for frontend and backend, and a `docker-compose.yml` for local full-stack runs. Production deployment is configured for **Railway** (`railway.toml`).

Ensure production values are set for:

- `DATABASE_URL` (managed PostgreSQL)
- `SECRET_KEY` (strong random string)
- `CORS_ORIGINS` (your frontend URL)
- `NEXT_PUBLIC_API_URL` (your backend URL, set at frontend build time)

---

## License

Private — internal use by Harmilap Share Transfer Agents.
