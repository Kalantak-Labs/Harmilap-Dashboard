from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import text
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, Base
from app.models import User, Session, Company, Beneficiary, BenposLockin, InvoiceConfig, Invoice, InvoicePdfArchive, EmailSettings, EmailTemplate, GstStateCode, PanHolderType, IsinSecurityType, ActionLog, BillingPartySettings, BillingInvoice, BillingPayment  # ensure models are registered
from app.reference_data import GST_STATE_CODES, PAN_HOLDER_TYPES, ISIN_SECURITY_TYPES
from app.schemas.company import INDIAN_STATES_UTS
from app.routes import auth, users, companies, beneficiaries, reports, emails, invoices, action_logs, billings


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

        # companies: state + derived PAN holder type columns
        await conn.execute(text(
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS state VARCHAR(100)"
        ))
        await conn.execute(text(
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS pan_holder_type VARCHAR(50)"
        ))

        # Seed reference mapping tables (idempotent)
        gst_vals = ",".join(
            f"('{k}','{v.replace(chr(39), chr(39) * 2)}')" for k, v in GST_STATE_CODES.items()
        )
        await conn.execute(text(
            f"INSERT INTO gst_state_codes (code, state) VALUES {gst_vals} "
            "ON CONFLICT (code) DO UPDATE SET state = EXCLUDED.state"
        ))
        pan_vals = ",".join(
            f"('{k}','{v.replace(chr(39), chr(39) * 2)}')" for k, v in PAN_HOLDER_TYPES.items()
        )
        await conn.execute(text(
            f"INSERT INTO pan_holder_types (code, meaning) VALUES {pan_vals} "
            "ON CONFLICT (code) DO UPDATE SET meaning = EXCLUDED.meaning"
        ))
        # isin_security_types is now keyed by (issuer_prefix, code) — rebuild + reseed
        await conn.execute(text("DROP TABLE IF EXISTS isin_security_types"))
        await conn.execute(text(
            "CREATE TABLE isin_security_types ("
            "issuer_prefix VARCHAR(3) NOT NULL, code VARCHAR(2) NOT NULL, "
            "security_type VARCHAR(200) NOT NULL, PRIMARY KEY (issuer_prefix, code))"
        ))
        isin_sec_vals = ",".join(
            f"('{pfx}','{code}','{v.replace(chr(39), chr(39) * 2)}')"
            for (pfx, code), v in ISIN_SECURITY_TYPES.items()
        )
        await conn.execute(text(
            f"INSERT INTO isin_security_types (issuer_prefix, code, security_type) VALUES {isin_sec_vals} "
            "ON CONFLICT (issuer_prefix, code) DO UPDATE SET security_type = EXCLUDED.security_type"
        ))

        # Clear bad values so the read-side validators never reject stored data
        await conn.execute(text("UPDATE companies SET gst_number = upper(trim(gst_number)) WHERE gst_number IS NOT NULL"))
        await conn.execute(text(
            "UPDATE companies SET gst_number = NULL WHERE gst_number IS NOT NULL "
            "AND gst_number !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$'"
        ))
        await conn.execute(text("UPDATE companies SET pan_number = upper(trim(pan_number)) WHERE pan_number IS NOT NULL"))
        await conn.execute(text(
            "UPDATE companies SET pan_number = NULL WHERE pan_number IS NOT NULL "
            "AND pan_number !~ '^[A-Z]{5}[0-9]{4}[A-Z]$'"
        ))
        await conn.execute(text("UPDATE companies SET reg_pin_code = trim(reg_pin_code) WHERE reg_pin_code IS NOT NULL"))
        await conn.execute(text(
            "UPDATE companies SET reg_pin_code = NULL WHERE reg_pin_code IS NOT NULL AND reg_pin_code !~ '^[0-9]{6}$'"
        ))
        _states_in = ",".join("'" + s.replace("'", "''") + "'" for s in INDIAN_STATES_UTS)
        await conn.execute(text(
            f"UPDATE companies SET state = NULL WHERE state IS NOT NULL AND state <> '' AND state NOT IN ({_states_in})"
        ))

        # Backfill derived info: PAN from GST, PAN holder type, state from GST
        await conn.execute(text(
            "UPDATE companies SET pan_number = substr(gst_number, 3, 10) "
            "WHERE (pan_number IS NULL OR pan_number = '') AND gst_number IS NOT NULL AND char_length(gst_number) = 15"
        ))
        await conn.execute(text(
            "UPDATE companies SET pan_holder_type = "
            "(SELECT meaning FROM pan_holder_types p WHERE p.code = substr(pan_number, 4, 1)) "
            "WHERE pan_number IS NOT NULL AND char_length(pan_number) = 10"
        ))
        await conn.execute(text(
            "UPDATE companies SET state = "
            "(SELECT state FROM gst_state_codes g WHERE g.code = substr(gst_number, 1, 2)) "
            "WHERE (state IS NULL OR state = '') AND gst_number IS NOT NULL AND char_length(gst_number) = 15"
        ))
        await conn.execute(text(
            "UPDATE companies SET security_type = NULL "
            "WHERE isin_code IS NULL OR trim(isin_code) = ''"
        ))
        await conn.execute(text(
            "UPDATE companies SET security_type = ("
            "SELECT security_type FROM isin_security_types i "
            "WHERE i.issuer_prefix = substr(upper(trim(isin_code)), 1, 3) "
            "  AND i.code = substr(upper(trim(isin_code)), 8, 2)"
            ") WHERE isin_code IS NOT NULL AND char_length(trim(isin_code)) >= 9"
        ))

        # billing_invoices: manual upload flag
        await conn.execute(text(
            "ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT FALSE"
        ))

        # companies: a filled NSDL/CDSL RTA code marks presence in that depository
        await conn.execute(text(
            "UPDATE companies SET has_nsdl_shares = TRUE "
            "WHERE nsdl_rta_code IS NOT NULL AND nsdl_rta_code <> '' AND has_nsdl_shares = FALSE"
        ))
        await conn.execute(text(
            "UPDATE companies SET has_cdsl_shares = TRUE "
            "WHERE cdsl_rta_code IS NOT NULL AND cdsl_rta_code <> '' AND has_cdsl_shares = FALSE"
        ))

        # invoices: track last PDF generation time
        await conn.execute(text(
            "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS last_generated_at TIMESTAMPTZ"
        ))

        # invoices: per-party invoice date override
        await conn.execute(text(
            "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_date DATE"
        ))

        # invoices: manual billed-ISIN override
        await conn.execute(text(
            "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billed_isin_count INTEGER"
        ))

        # billing invoices: total/billed ISIN counts
        await conn.execute(text(
            "ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS isin_total INTEGER"
        ))
        await conn.execute(text(
            "ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS billed_isin_count INTEGER"
        ))
        await conn.execute(text(
            "ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS year_breakdown JSON"
        ))

        # ── Referential integrity: beneficiaries / benpos_lockin → companies ──
        for _tbl in ("beneficiaries", "benpos_lockin"):
            await conn.execute(text(f"ALTER TABLE {_tbl} ADD COLUMN IF NOT EXISTS company_id UUID"))
            await conn.execute(text(
                f"UPDATE {_tbl} t SET company_id = c.id FROM companies c "
                f"WHERE c.isin_code = t.isin_code AND t.company_id IS NULL"
            ))
            # drop rows that reference a non-existent company (cannot satisfy the FK)
            await conn.execute(text(f"DELETE FROM {_tbl} WHERE company_id IS NULL"))
            await conn.execute(text(
                f"DO $$ BEGIN "
                f"IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_{_tbl}_company') THEN "
                f"ALTER TABLE {_tbl} ADD CONSTRAINT fk_{_tbl}_company "
                f"FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE; "
                f"END IF; END $$"
            ))
            await conn.execute(text(f"ALTER TABLE {_tbl} ALTER COLUMN company_id SET NOT NULL"))
            await conn.execute(text(f"CREATE INDEX IF NOT EXISTS ix_{_tbl}_company_id ON {_tbl}(company_id)"))

        # invoices: remove any invoice whose RTA code maps to no company
        await conn.execute(text(
            "DELETE FROM invoices i WHERE NOT EXISTS ("
            "  SELECT 1 FROM companies c WHERE"
            "    (i.nsdl_rta_code IS NOT NULL AND c.nsdl_rta_code = i.nsdl_rta_code) OR"
            "    (i.cdsl_rta_code IS NOT NULL AND c.cdsl_rta_code = i.cdsl_rta_code))"
        ))

        # invoices: unique invoice numbers (when set)
        await conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_invoices_invoice_no "
            "ON invoices (invoice_no) WHERE invoice_no IS NOT NULL"
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
app.include_router(billings.router)
app.include_router(emails.router)
app.include_router(action_logs.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
