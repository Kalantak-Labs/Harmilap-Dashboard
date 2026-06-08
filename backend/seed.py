"""
Run once to create the initial admin user.
Usage: python seed.py
"""

import asyncio
import os

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://harmilap:harmilap@localhost:5432/harmilap")


async def seed():
    from app.database import Base
    from app.models.user import User
    from app.services.auth import hash_password

    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with SessionLocal() as db:
        existing = await db.execute(select(User).where(User.email == "admin@harmilap.in"))
        if existing.scalar_one_or_none():
            print("Admin already exists.")
            return

        admin = User(
            name="Admin",
            email="admin@harmilap.in",
            password_hash=hash_password("admin@123"),
            role="admin",
            permissions=["viewer", "editor", "can_ingest", "can_download"],
        )
        db.add(admin)
        await db.commit()
        print("Admin created: admin@harmilap.in / admin@123")


if __name__ == "__main__":
    asyncio.run(seed())
