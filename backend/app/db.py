from __future__ import annotations

from pathlib import Path

from sqlalchemy import create_engine, event, inspect
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.settings import settings


class Base(DeclarativeBase):
    pass


def _build_engine():
    url = settings.database_url
    if url.startswith("sqlite"):
        db_path = url.replace("sqlite:///", "", 1)
        if db_path and db_path != ":memory:":
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        engine = create_engine(
            url,
            connect_args={"check_same_thread": False},
            pool_pre_ping=True,
            future=True,
        )

        @event.listens_for(engine, "connect")
        def _set_sqlite_pragmas(dbapi_connection, _connection_record):  # type: ignore[no-untyped-def]
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA busy_timeout=5000")
            cursor.close()

        return engine

    return create_engine(
        url,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_recycle=1800,
        future=True,
    )


engine = _build_engine()
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app import models  # noqa: F401

    if engine.dialect.name == "postgresql":
        with engine.begin() as connection:
            connection.exec_driver_sql("SELECT pg_advisory_lock(86120260602)")
            try:
                Base.metadata.create_all(bind=connection)
                _run_light_migrations(connection)
            finally:
                connection.exec_driver_sql("SELECT pg_advisory_unlock(86120260602)")
        return

    Base.metadata.create_all(bind=engine)
    with engine.begin() as connection:
        _run_light_migrations(connection)


def _run_light_migrations(connection) -> None:  # type: ignore[no-untyped-def]
    inspector = inspect(connection)
    task_columns = {column["name"] for column in inspector.get_columns("daily_tasks")}
    block_columns = {column["name"] for column in inspector.get_columns("plan_template_blocks")}
    record_columns = {column["name"] for column in inspector.get_columns("practice_records")} if inspector.has_table("practice_records") else set()

    varchar = "VARCHAR(40)" if engine.dialect.name == "postgresql" else "VARCHAR(40)"
    float_type = "DOUBLE PRECISION" if engine.dialect.name == "postgresql" else "FLOAT"

    if "task_type" not in block_columns:
        connection.exec_driver_sql("ALTER TABLE plan_template_blocks ADD COLUMN task_type VARCHAR(20) DEFAULT 'item'")
    if "practice_tag" not in block_columns:
        connection.exec_driver_sql(f"ALTER TABLE plan_template_blocks ADD COLUMN practice_tag {varchar}")

    if "task_type" not in task_columns:
        connection.exec_driver_sql("ALTER TABLE daily_tasks ADD COLUMN task_type VARCHAR(20) DEFAULT 'item'")
    if "practice_tag" not in task_columns:
        connection.exec_driver_sql(f"ALTER TABLE daily_tasks ADD COLUMN practice_tag {varchar}")
    if "result_question_count" not in task_columns:
        connection.exec_driver_sql("ALTER TABLE daily_tasks ADD COLUMN result_question_count INTEGER")
    if "result_accuracy" not in task_columns:
        connection.exec_driver_sql(f"ALTER TABLE daily_tasks ADD COLUMN result_accuracy {float_type}")
    if "result_minutes" not in task_columns:
        connection.exec_driver_sql(f"ALTER TABLE daily_tasks ADD COLUMN result_minutes {float_type}")

    if record_columns:
        if "question_count" not in record_columns:
            connection.exec_driver_sql("ALTER TABLE practice_records ADD COLUMN question_count INTEGER DEFAULT 0")
        if "correct_count" not in record_columns:
            connection.exec_driver_sql("ALTER TABLE practice_records ADD COLUMN correct_count INTEGER DEFAULT 0")
        if "issue_tags" not in record_columns:
            connection.exec_driver_sql("ALTER TABLE practice_records ADD COLUMN issue_tags JSON DEFAULT '[]'")

    practice_categories = (
        "'data_analysis', 'quantitative', 'verbal', 'graphic_reasoning', "
        "'judgement_reasoning', 'political_theory', 'common_sense'"
    )
    connection.exec_driver_sql(
        f"UPDATE plan_template_blocks SET task_type = 'practice', practice_tag = category "
        f"WHERE category IN ({practice_categories}) AND (task_type IS NULL OR task_type = 'item')"
    )
    connection.exec_driver_sql(
        f"UPDATE daily_tasks SET task_type = 'practice', practice_tag = category "
        f"WHERE category IN ({practice_categories}) AND (task_type IS NULL OR task_type = 'item')"
    )
    connection.exec_driver_sql("UPDATE plan_template_blocks SET task_type = 'item' WHERE task_type IS NULL")
    connection.exec_driver_sql("UPDATE daily_tasks SET task_type = 'item' WHERE task_type IS NULL")
