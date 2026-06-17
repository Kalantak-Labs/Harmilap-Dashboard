from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import text
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, Base
from app.models import User, Session, Company, Beneficiary, BenposLockin, InvoiceConfig, Invoice, EmailSettings, EmailTemplate  # ensure models are registered
from app.routes import auth, users, companies, beneficiaries, reports, emails, invoices


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # companies: split rta_code → nsdl_rta_code + cdsl_rta_code
        await conn.execute(text(
            "ALTER TABLE companies "
            "ADD COLUMN IF NOT EXISTS nsdl_rta_code VARCHAR(50),"
            "ADD COLUMN IF NOT EXISTS cdsl_rta_code VARCHAR(50)"
        ))

        # companies: face value column
        await conn.execute(text(
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS face_value DOUBLE PRECISION"
        ))

        # companies: state column
        await conn.execute(text(
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS state VARCHAR(100)"
        ))

        # invoices: track last PDF generation time
        await conn.execute(text(
            "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS last_generated_at TIMESTAMPTZ"
        ))

        # invoices: drop the financial-year prefix from existing invoice numbers
        # (old format "2026-27/<code>/<seq>" → "<code>/<seq>")
        await conn.execute(text(
            r"UPDATE invoices SET invoice_no = regexp_replace(invoice_no, '^[0-9]{4}-[0-9]{2}/', '') "
            r"WHERE invoice_no ~ '^[0-9]{4}-[0-9]{2}/'"
        ))
        # collapse any duplicated 'RTAN' prefix from the earlier prepend bug
        await conn.execute(text(
            "UPDATE invoices SET invoice_no = regexp_replace(invoice_no, '^(RTAN)+', 'RTAN') "
            "WHERE invoice_no LIKE 'RTANRTAN%'"
        ))

        # invoice_config: configurable invoice date + bank accounts
        await conn.execute(text(
            "ALTER TABLE invoice_config ADD COLUMN IF NOT EXISTS invoice_date DATE"
        ))
        await conn.execute(text(
            "ALTER TABLE invoice_config ADD COLUMN IF NOT EXISTS bank_accounts JSON DEFAULT '[]'"
        ))

        # companies: ARN as an alternative key — ISIN is no longer mandatory
        await conn.execute(text(
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS arn_number VARCHAR(50)"
        ))
        await conn.execute(text(
            "ALTER TABLE companies ALTER COLUMN isin_code DROP NOT NULL"
        ))
        await conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_companies_arn_number "
            "ON companies (arn_number)"
        ))
        await conn.execute(text("""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='companies' AND column_name='rta_code'
                ) THEN
                    UPDATE companies SET nsdl_rta_code = rta_code WHERE nsdl_rta_code IS NULL;
                    ALTER TABLE companies DROP COLUMN rta_code;
                END IF;
            END $$
        """))

        # beneficiaries: Schema migrations for columns added / widened after initial deploy
        await conn.execute(
            text(
                "ALTER TABLE beneficiaries "
                "ADD COLUMN IF NOT EXISTS depository VARCHAR(10) NOT NULL DEFAULT 'NSDL'"
            )
        )
        await conn.execute(
            text(
                "ALTER TABLE beneficiaries "
                "ALTER COLUMN dp_id TYPE VARCHAR(16),"
                "ALTER COLUMN first_holder_name TYPE TEXT,"
                "ALTER COLUMN first_holder_father_husband_name TYPE TEXT,"
                "ALTER COLUMN first_holder_email TYPE TEXT,"
                "ALTER COLUMN second_holder_name TYPE TEXT,"
                "ALTER COLUMN second_holder_father_husband_name TYPE TEXT,"
                "ALTER COLUMN second_holder_email TYPE TEXT,"
                "ALTER COLUMN third_holder_name TYPE TEXT,"
                "ALTER COLUMN third_holder_father_husband_name TYPE TEXT,"
                "ALTER COLUMN third_holder_email TYPE TEXT,"
                "ALTER COLUMN address_line1 TYPE TEXT,"
                "ALTER COLUMN address_line2 TYPE TEXT,"
                "ALTER COLUMN address_line3 TYPE TEXT,"
                "ALTER COLUMN address_line4 TYPE TEXT,"
                "ALTER COLUMN nominee_guardian_name TYPE TEXT,"
                "ALTER COLUMN nominee_address_line1 TYPE TEXT,"
                "ALTER COLUMN nominee_address_line2 TYPE TEXT,"
                "ALTER COLUMN nominee_address_line3 TYPE TEXT,"
                "ALTER COLUMN nominee_address_line4 TYPE TEXT,"
                "ALTER COLUMN bank_name_branch TYPE TEXT,"
                "ALTER COLUMN bank_address_line1 TYPE TEXT,"
                "ALTER COLUMN bank_address_line2 TYPE TEXT,"
                "ALTER COLUMN bank_address_line3 TYPE TEXT,"
                "ALTER COLUMN bank_address_line4 TYPE TEXT,"
                "ALTER COLUMN rbi_reference_number TYPE TEXT,"
                "ALTER COLUMN sebi_registration_number TYPE TEXT,"
                "ALTER COLUMN tax_deduction_status TYPE TEXT"
            )
        )
    yield


app = FastAPI(title="Harmilap RTA API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(companies.router)
app.include_router(beneficiaries.router)
app.include_router(reports.router)
app.include_router(invoices.router)
app.include_router(emails.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
