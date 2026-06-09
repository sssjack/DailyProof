from __future__ import annotations

from datetime import date, datetime, time

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, JSON, String, Text, Time, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(190), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(80))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="user", index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    monthly_plans: Mapped[list["MonthlyPlan"]] = relationship(back_populates="user")
    daily_plans: Mapped[list["DailyPlan"]] = relationship(back_populates="user")


class MonthlyPlan(Base):
    __tablename__ = "monthly_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    year: Mapped[int] = mapped_column(Integer, index=True)
    month: Mapped[int] = mapped_column(Integer, index=True)
    title: Mapped[str] = mapped_column(String(120))
    objective: Mapped[str] = mapped_column(Text)
    target_minutes: Mapped[int] = mapped_column(Integer, default=27)
    target_accuracy: Mapped[float] = mapped_column(Float, default=90.0)
    category_goals: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=None)
    routine_text: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User] = relationship(back_populates="monthly_plans")
    blocks: Mapped[list["PlanTemplateBlock"]] = relationship(back_populates="plan", cascade="all, delete-orphan")


class PlanTemplateBlock(Base):
    __tablename__ = "plan_template_blocks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    monthly_plan_id: Mapped[int] = mapped_column(ForeignKey("monthly_plans.id", ondelete="CASCADE"), index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    title: Mapped[str] = mapped_column(String(160))
    task_type: Mapped[str] = mapped_column(String(20), default="item", index=True)
    category: Mapped[str] = mapped_column(String(40), default="study", index=True)
    practice_tag: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    target_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    weekday_mask: Mapped[str] = mapped_column(String(20), default="0,1,2,3,4,5,6")

    plan: Mapped[MonthlyPlan] = relationship(back_populates="blocks")


class DailyPlan(Base):
    __tablename__ = "daily_plans"
    __table_args__ = (UniqueConstraint("user_id", "plan_date", name="uq_daily_plan_user_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    monthly_plan_id: Mapped[int | None] = mapped_column(ForeignKey("monthly_plans.id", ondelete="SET NULL"), nullable=True)
    plan_date: Mapped[date] = mapped_column(Date, index=True)
    note: Mapped[str] = mapped_column(Text, default="")
    day_score: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User] = relationship(back_populates="daily_plans")
    tasks: Mapped[list["DailyTask"]] = relationship(back_populates="daily_plan", cascade="all, delete-orphan")


class DailyTask(Base):
    __tablename__ = "daily_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    daily_plan_id: Mapped[int] = mapped_column(ForeignKey("daily_plans.id", ondelete="CASCADE"), index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    title: Mapped[str] = mapped_column(String(180))
    task_type: Mapped[str] = mapped_column(String(20), default="item", index=True)
    category: Mapped[str] = mapped_column(String(40), default="study", index=True)
    practice_tag: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    planned_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    planned_end: Mapped[time | None] = mapped_column(Time, nullable=True)
    target_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    accumulated_seconds: Mapped[int] = mapped_column(Integer, default=0)
    timer_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    result_question_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    result_accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    result_minutes: Mapped[float | None] = mapped_column(Float, nullable=True)
    note: Mapped[str] = mapped_column(Text, default="")

    daily_plan: Mapped[DailyPlan] = relationship(back_populates="tasks")


class DailyCheckIn(Base):
    __tablename__ = "daily_checkins"
    __table_args__ = (UniqueConstraint("user_id", "checkin_date", name="uq_checkin_user_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    checkin_date: Mapped[date] = mapped_column(Date, index=True)
    mood: Mapped[str] = mapped_column(String(40), default="steady")
    energy: Mapped[int] = mapped_column(Integer, default=3)
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PracticeRecord(Base):
    __tablename__ = "practice_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    record_date: Mapped[date] = mapped_column(Date, index=True)
    category: Mapped[str] = mapped_column(String(40), index=True)
    question_count: Mapped[int] = mapped_column(Integer, default=0)
    correct_count: Mapped[int] = mapped_column(Integer, default=0)
    minutes: Mapped[float] = mapped_column(Float, default=0.0)
    accuracy: Mapped[float] = mapped_column(Float, default=0.0)
    issue_tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class StickyNote(Base):
    __tablename__ = "sticky_notes"
    __table_args__ = (UniqueConstraint("user_id", "note_date", name="uq_sticky_note_user_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    note_date: Mapped[date] = mapped_column(Date, index=True)
    ai_advice: Mapped[str] = mapped_column(Text, default="")
    ai_advice_source: Mapped[str] = mapped_column(String(20), default="fallback")
    advice_generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items: Mapped[list["StickyNoteItem"]] = relationship(back_populates="note", cascade="all, delete-orphan")


class StickyNoteItem(Base):
    __tablename__ = "sticky_note_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sticky_note_id: Mapped[int] = mapped_column(ForeignKey("sticky_notes.id", ondelete="CASCADE"), index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    title: Mapped[str] = mapped_column(String(240))
    is_done: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    note: Mapped[StickyNote] = relationship(back_populates="items")


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category: Mapped[str] = mapped_column(String(40), index=True)
    difficulty: Mapped[str] = mapped_column(String(20), default="medium")
    stem: Mapped[str] = mapped_column(Text)
    options: Mapped[list[str]] = mapped_column(JSON)
    answer_index: Mapped[int] = mapped_column(Integer)
    explanation: Mapped[str] = mapped_column(Text)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)


class PracticeSession(Base):
    __tablename__ = "practice_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    category: Mapped[str] = mapped_column(String(40), index=True)
    title: Mapped[str] = mapped_column(String(160))
    target_minutes: Mapped[int] = mapped_column(Integer, default=27)
    target_accuracy: Mapped[float] = mapped_column(Float, default=90.0)
    question_ids: Mapped[list[int]] = mapped_column(JSON)
    total_count: Mapped[int] = mapped_column(Integer, default=0)
    correct_count: Mapped[int] = mapped_column(Integer, default=0)
    accuracy: Mapped[float] = mapped_column(Float, default=0.0)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_note: Mapped[str] = mapped_column(Text, default="")


class PracticeAnswer(Base):
    __tablename__ = "practice_answers"
    __table_args__ = (UniqueConstraint("session_id", "question_id", name="uq_answer_session_question"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("practice_sessions.id", ondelete="CASCADE"), index=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), index=True)
    selected_index: Mapped[int] = mapped_column(Integer)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
