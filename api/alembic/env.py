import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context
from dotenv import load_dotenv

load_dotenv()

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Surcharger l'URL depuis les variables d'environnement
_user = os.getenv("DB_USER", "kolongono_sd")
_pass = os.getenv("DB_PASSWORD", "")
_host = os.getenv("DB_HOST", "localhost")
_port = os.getenv("DB_PORT", "5432")
_name = os.getenv("DB_NAME", "santesd")
config.set_main_option(
    "sqlalchemy.url",
    f"postgresql+psycopg2://{_user}:{_pass}@{_host}:{_port}/{_name}"
)

# Importer Base et TOUS les modèles pour que autogenerate les détecte
from database import Base
import models  # noqa: F401 — force l'enregistrement de tous les modèles

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
