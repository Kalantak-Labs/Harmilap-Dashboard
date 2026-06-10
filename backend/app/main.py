from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, Base
from app.models import User, Session, Company, Beneficiary, BenposLockin, InvoiceConfig, EmailSettings, EmailTemplate  # ensure models are registered
from app.routes import auth, users, companies, beneficiaries, reports, emails


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
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
