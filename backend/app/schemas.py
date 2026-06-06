from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    name: str
    role: str
    created_at: datetime


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=1, max_length=80)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class PlanBlockIn(BaseModel):
    title: str
    task_type: str = Field(default="item", pattern="^(item|practice)$")
    category: str = "study"
    practice_tag: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    target_minutes: int | None = None
    target_count: int | None = None
    weekday_mask: str = "0,1,2,3,4,5,6"


class MonthlyPlanCreate(BaseModel):
    year: int
    month: int = Field(ge=1, le=12)
    title: str = Field(min_length=1, max_length=120)
    objective: str = Field(min_length=1)
    target_minutes: int = Field(default=27, ge=1, le=240)
    target_accuracy: float = Field(default=90.0, ge=0, le=100)
    routine_text: str = ""
    blocks: list[PlanBlockIn] = []
    use_ai: bool = False


class TaskPatch(BaseModel):
    status: str | None = Field(default=None, pattern="^(pending|running|done|skipped)$")
    note: str | None = None
    result_question_count: int | None = Field(default=None, ge=0, le=10000)
    result_accuracy: float | None = Field(default=None, ge=0, le=100)
    result_minutes: float | None = Field(default=None, ge=0, le=1440)


class CheckInRequest(BaseModel):
    mood: str = "steady"
    energy: int = Field(default=3, ge=1, le=5)
    note: str = ""


class PracticeRecordCreate(BaseModel):
    record_date: date
    category: str = Field(min_length=1, max_length=40)
    minutes: float = Field(ge=0, le=1440)
    accuracy: float = Field(ge=0, le=100)
    note: str = Field(default="", max_length=1000)


class PracticeRecordPatch(BaseModel):
    record_date: date | None = None
    category: str | None = Field(default=None, min_length=1, max_length=40)
    minutes: float | None = Field(default=None, ge=0, le=1440)
    accuracy: float | None = Field(default=None, ge=0, le=100)
    note: str | None = Field(default=None, max_length=1000)


class PracticeStartRequest(BaseModel):
    category: str = Field(default="data_analysis")
    question_count: int = Field(default=10, ge=1, le=30)
    target_minutes: int = Field(default=27, ge=1, le=180)
    target_accuracy: float = Field(default=90.0, ge=0, le=100)


class PracticeAnswerRequest(BaseModel):
    question_id: int
    selected_index: int = Field(ge=0, le=9)


class PracticeFinishRequest(BaseModel):
    review_note: str = ""


class PlanSuggestionRequest(BaseModel):
    objective: str
    routine_text: str
    target_minutes: int = 27
    target_accuracy: float = 90.0


JsonDict = dict[str, Any]
