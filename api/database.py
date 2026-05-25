"""
SantéDirect — Kolongono : Base de données SQLAlchemy
PostgreSQL 16 — deux sessions : async (centres, consultations) + sync (pharmacie_ean)
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session
from dotenv import load_dotenv

load_dotenv()

_user = os.getenv("DB_USER", "kolongono")
_pass = os.getenv("DB_PASSWORD", "")
_host = os.getenv("DB_HOST", "localhost")
_port = os.getenv("DB_PORT", "5432")
_name = os.getenv("DB_NAME", "kolongono")

ASYNC_DATABASE_URL = f"postgresql+asyncpg://{_user}:{_pass}@{_host}:{_port}/{_name}"
SYNC_DATABASE_URL  = f"postgresql+psycopg2://{_user}:{_pass}@{_host}:{_port}/{_name}"

# Moteur async — utilisé par centres.py, consultations.py
engine = create_async_engine(
    ASYNC_DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Moteur sync — utilisé par pharmacie_ean.py (routes sync)
sync_engine = create_engine(
    SYNC_DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

SyncSessionLocal = sessionmaker(
    bind=sync_engine,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    """Dependency async — pour les routers async (centres, consultations)."""
    async with AsyncSessionLocal() as session:
        yield session


def get_db_sync() -> Session:
    """Dependency sync — pour les routers sync (pharmacie_ean)."""
    db = SyncSessionLocal()
    try:
        yield db
    finally:
        db.close()
