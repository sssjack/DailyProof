from __future__ import annotations

from datetime import date
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session, selectinload

from app import models
from app.db import get_db, init_db
from app.schemas import (
    CheckInRequest,
    LoginRequest,
    MonthlyPlanCreate,
    PracticeRecordCreate,
    PracticeRecordPatch,
    RegisterRequest,
    TaskPatch,
    TokenResponse,
    UserOut,
)
from app.security import create_access_token, verify_password, hash_password
from app.services import (
    admin_overview,
    bootstrap,
    ensure_daily_plan_for,
    generate_daily_plans,
    local_today,
    serialize_daily_plan,
    serialize_plan,
    serialize_task,
    task_result_rows,
    update_task_status,
    user_admin_rows,
    user_month_stats,
    create_monthly_plan,
    create_practice_record,
    practice_record_queryset,
    serialize_practice_record,
    update_practice_record,
    user_practice_record_stats,
)
from app.settings import settings
from app.security import decode_access_token


app = FastAPI(title=settings.app_name, version="1.0.0", docs_url=f"{settings.api_path}/docs", openapi_url=f"{settings.api_path}/openapi.json")
security = HTTPBearer(auto_error=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    from app.db import SessionLocal

    with SessionLocal() as db:
        bootstrap(db)


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> models.User:
    if not credentials:
        raise HTTPException(status_code=401, detail="请先登录")
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="登录状态已过期")
    user = db.get(models.User, int(payload.get("sub") or 0))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="账号不可用")
    return user


def current_admin(user: models.User = Depends(current_user)) -> models.User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return user


def token_for(user: models.User) -> TokenResponse:
    return TokenResponse(access_token=create_access_token(str(user.id), user.role), user=UserOut.model_validate(user))


@app.get(f"{settings.api_path}/health")
def health() -> dict:
    return {"status": "ok", "app": settings.app_name}


@app.post(f"{settings.api_path}/auth/register", response_model=TokenResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    email = payload.email.lower()
    if db.query(models.User).filter_by(email=email).first():
        raise HTTPException(status_code=409, detail="邮箱已注册")
    user = models.User(email=email, name=payload.name.strip(), password_hash=hash_password(payload.password), role="user")
    db.add(user)
    db.commit()
    db.refresh(user)
    return token_for(user)


@app.post(f"{settings.api_path}/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.query(models.User).filter_by(email=payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")
    return token_for(user)


@app.get(f"{settings.api_path}/me", response_model=UserOut)
def me(user: models.User = Depends(current_user)) -> models.User:
    return user


@app.get(f"{settings.api_path}/plans/monthly")
def list_monthly_plans(
    year: int | None = None,
    month: int | None = None,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    query = db.query(models.MonthlyPlan).options(selectinload(models.MonthlyPlan.blocks)).filter_by(user_id=user.id)
    if year:
        query = query.filter(models.MonthlyPlan.year == year)
    if month:
        query = query.filter(models.MonthlyPlan.month == month)
    plans = query.order_by(models.MonthlyPlan.year.desc(), models.MonthlyPlan.month.desc(), models.MonthlyPlan.created_at.desc()).all()
    return [serialize_plan(plan) for plan in plans]


@app.post(f"{settings.api_path}/plans/monthly")
def create_plan(
    payload: MonthlyPlanCreate,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    plan = create_monthly_plan(db, user, payload)
    db.commit()
    plan = db.query(models.MonthlyPlan).options(selectinload(models.MonthlyPlan.blocks)).get(plan.id)
    return serialize_plan(plan)


@app.post(f"{settings.api_path}/plans/monthly/{{plan_id}}/generate-days")
def regenerate_days(
    plan_id: int,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    plan = db.query(models.MonthlyPlan).filter_by(id=plan_id, user_id=user.id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="月计划不存在")
    count = generate_daily_plans(db, plan)
    db.commit()
    return {"created_or_verified": count}


@app.get(f"{settings.api_path}/daily")
def get_daily(
    day: date | None = None,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    target = day or local_today()
    daily = ensure_daily_plan_for(db, user, target)
    db.commit()
    if daily:
        db.refresh(daily)
        daily = db.query(models.DailyPlan).options(selectinload(models.DailyPlan.tasks)).get(daily.id)
    return {"today": local_today().isoformat(), "daily_plan": serialize_daily_plan(daily)}


@app.patch(f"{settings.api_path}/tasks/{{task_id}}")
def patch_task(
    task_id: int,
    payload: TaskPatch,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    task = (
        db.query(models.DailyTask)
        .join(models.DailyPlan, models.DailyTask.daily_plan_id == models.DailyPlan.id)
        .filter(models.DailyTask.id == task_id, models.DailyPlan.user_id == user.id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    try:
        update_task_status(
            db,
            task,
            payload.status,
            payload.note,
            payload.result_question_count,
            payload.result_accuracy,
            payload.result_minutes,
        )
    except ValueError as exc:
        if str(exc) == "practice_result_required":
            raise HTTPException(status_code=422, detail="刷题任务需要填写题量、正确率和用时") from exc
        raise
    db.commit()
    db.refresh(task)
    return serialize_task(task)


@app.post(f"{settings.api_path}/checkins")
def checkin(
    payload: CheckInRequest,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    today = local_today()
    item = db.query(models.DailyCheckIn).filter_by(user_id=user.id, checkin_date=today).first()
    if not item:
        item = models.DailyCheckIn(user_id=user.id, checkin_date=today)
        db.add(item)
    item.mood = payload.mood
    item.energy = payload.energy
    item.note = payload.note
    db.commit()
    return {"id": item.id, "date": item.checkin_date.isoformat(), "mood": item.mood, "energy": item.energy, "note": item.note}


@app.get(f"{settings.api_path}/stats/monthly")
def monthly_stats(
    year: int,
    month: int,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    return user_month_stats(db, user.id, year, month)


@app.get(f"{settings.api_path}/stats/practice")
def practice_stats(
    year: int,
    month: int,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    return user_month_stats(db, user.id, year, month)


@app.get(f"{settings.api_path}/practice-records")
def list_practice_records(
    year: int,
    month: int | None = None,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    if month is None:
        start, end = date(year, 1, 1), date(year, 12, 31)
    else:
        from app.services import month_bounds

        start, end = month_bounds(year, month)
    return [serialize_practice_record(record) for record in practice_record_queryset(db, user.id, start, end)]


post_record_exception_detail = "做题记录板块只能选择言语、图推、数量关系、资料分析、判断推理、政治理论或常识"


@app.post(f"{settings.api_path}/practice-records")
def add_practice_record(
    payload: PracticeRecordCreate,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    try:
        record = create_practice_record(
            db,
            user_id=user.id,
            record_date=payload.record_date,
            category=payload.category,
            question_count=payload.question_count,
            correct_count=payload.correct_count,
            minutes=payload.minutes,
            accuracy=payload.accuracy,
            issue_tags=payload.issue_tags,
            note=payload.note,
        )
    except ValueError as exc:
        if str(exc) == "invalid_practice_category":
            raise HTTPException(status_code=422, detail=post_record_exception_detail) from exc
        raise
    db.commit()
    db.refresh(record)
    return serialize_practice_record(record)


@app.patch(f"{settings.api_path}/practice-records/{{record_id}}")
def patch_practice_record(
    record_id: int,
    payload: PracticeRecordPatch,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    record = db.query(models.PracticeRecord).filter_by(id=record_id, user_id=user.id).first()
    if not record:
        raise HTTPException(status_code=404, detail="做题记录不存在")
    try:
        update_practice_record(
            db,
            record,
            record_date=payload.record_date,
            category=payload.category,
            question_count=payload.question_count,
            correct_count=payload.correct_count,
            minutes=payload.minutes,
            accuracy=payload.accuracy,
            issue_tags=payload.issue_tags,
            note=payload.note,
        )
    except ValueError as exc:
        if str(exc) == "invalid_practice_category":
            raise HTTPException(status_code=422, detail=post_record_exception_detail) from exc
        raise
    db.commit()
    db.refresh(record)
    return serialize_practice_record(record)


@app.delete(f"{settings.api_path}/practice-records/{{record_id}}")
def delete_practice_record(
    record_id: int,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    record = db.query(models.PracticeRecord).filter_by(id=record_id, user_id=user.id).first()
    if not record:
        raise HTTPException(status_code=404, detail="做题记录不存在")
    db.delete(record)
    db.commit()
    return {"ok": True}


@app.get(f"{settings.api_path}/practice-records/stats")
def practice_record_stats(
    scope: str = "week",
    year: int | None = None,
    month: int | None = None,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    today = local_today()
    return user_practice_record_stats(db, user.id, scope=scope, year=year or today.year, month=month or today.month)


@app.get(f"{settings.api_path}/admin/overview")
def admin_metrics(_: models.User = Depends(current_admin), db: Session = Depends(get_db)) -> dict:
    return admin_overview(db)


@app.get(f"{settings.api_path}/admin/users")
def admin_users(_: models.User = Depends(current_admin), db: Session = Depends(get_db)) -> list[dict]:
    return user_admin_rows(db)


@app.get(f"{settings.api_path}/admin/results")
def admin_results(_: models.User = Depends(current_admin), db: Session = Depends(get_db)) -> list[dict]:
    return task_result_rows(db)


DIST_DIR = Path(__file__).resolve().parents[2] / "frontend_dist"
INDEX_FILE = DIST_DIR / "index.html"
SPA_INDEX_HEADERS = {"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"}


@app.get(settings.base_path)
def spa_root() -> FileResponse:
    if not INDEX_FILE.exists():
        raise HTTPException(status_code=404, detail="frontend_dist not built")
    return FileResponse(INDEX_FILE, headers=SPA_INDEX_HEADERS)


@app.get(f"{settings.base_path}/{{full_path:path}}")
def spa_fallback(full_path: str, request: Request) -> FileResponse:
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint not found")
    candidate = (DIST_DIR / full_path).resolve()
    if DIST_DIR.exists() and candidate.is_file() and str(candidate).startswith(str(DIST_DIR.resolve())):
        return FileResponse(candidate)
    if not INDEX_FILE.exists():
        raise HTTPException(status_code=404, detail="frontend_dist not built")
    return FileResponse(INDEX_FILE, headers=SPA_INDEX_HEADERS)
