from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import text
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, Base
from app.models import User, Session, Company, Beneficiary, BenposLockin, InvoiceConfig, EmailSettings, EmailTemplate  # ensure models are registered
from app.routes import auth, users, companies, beneficiaries, reports, emails


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
app.include_router(emails.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
