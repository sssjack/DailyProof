from __future__ import annotations

import calendar
import random
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, selectinload

from app import models
from app.ai import suggest_plan_blocks
from app.schemas import MonthlyPlanCreate, PlanBlockIn
from app.security import hash_password
from app.settings import settings


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def local_today() -> date:
    return datetime.now(ZoneInfo(settings.timezone)).date()


def parse_time(value: str | None) -> time | None:
    if not value:
        return None
    try:
        hour, minute = value.strip().split(":", 1)
        return time(hour=int(hour), minute=int(minute))
    except Exception:
        return None


def format_time(value: time | None) -> str | None:
    return value.strftime("%H:%M") if value else None


def month_bounds(year: int, month: int) -> tuple[date, date]:
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)


PRACTICE_TAG_LABELS: dict[str, str] = {
    "data_analysis": "资料分析",
    "quantitative": "数量关系",
    "verbal": "言语理解",
    "graphic_reasoning": "图推",
    "judgement_reasoning": "判断推理",
    "political_theory": "政治理论",
    "common_sense": "常识",
}
PRACTICE_CATEGORY_ORDER = [
    "verbal",
    "graphic_reasoning",
    "quantitative",
    "data_analysis",
    "judgement_reasoning",
    "political_theory",
    "common_sense",
]
PRACTICE_TAGS = set(PRACTICE_TAG_LABELS)
PRACTICE_TAG_ALIASES = {
    "judgment_reasoning": "judgement_reasoning",
    "judge_reasoning": "judgement_reasoning",
    "logic": "judgement_reasoning",
    "politics": "political_theory",
    "common": "common_sense",
}


def normalize_practice_tag(value: str | None, fallback: str | None = None) -> str | None:
    candidate = (value or fallback or "").strip()
    if not candidate:
        return None
    candidate = PRACTICE_TAG_ALIASES.get(candidate, candidate)
    return candidate if candidate in PRACTICE_TAGS else candidate


def infer_task_type(category: str | None, task_type: str | None = None, practice_tag: str | None = None) -> str:
    tag = normalize_practice_tag(practice_tag, category)
    if (task_type or "").strip() == "practice" or tag in PRACTICE_TAGS or (category or "") in PRACTICE_TAGS:
        return "practice"
    return "item"


def default_routine_text() -> str:
    return (
        "6月计划：目标，资料分析时间控制在27min，正确率在90%。\n"
        "18:00-20:30 健身（跑步 or 健身房）- 吃饭 - 回家。\n"
        "20:00-21:00 刷一套资料分析 + 复盘。\n"
        "21:00-22:00 刷一套资料分析 + 复盘。\n"
        "22:00-23:00 学习，睡觉。\n"
        "早上 7:00-8:00 数量关系10道 + 复盘。"
    )


def default_blocks() -> list[dict]:
    return [
        {
            "title": "数量关系 10 道 + 复盘",
            "task_type": "practice",
            "category": "quantitative",
            "practice_tag": "quantitative",
            "start_time": "07:00",
            "end_time": "08:00",
            "target_minutes": 60,
            "target_count": 10,
            "weekday_mask": "0,1,2,3,4,5,6",
        },
        {
            "title": "健身 / 吃饭 / 回家",
            "task_type": "item",
            "category": "fitness",
            "practice_tag": None,
            "start_time": "18:00",
            "end_time": "20:30",
            "target_minutes": 150,
            "target_count": None,
            "weekday_mask": "0,1,2,3,4,5,6",
        },
        {
            "title": "资料分析套题 1 + 复盘",
            "task_type": "practice",
            "category": "data_analysis",
            "practice_tag": "data_analysis",
            "start_time": "20:00",
            "end_time": "21:00",
            "target_minutes": 27,
            "target_count": 1,
            "weekday_mask": "0,1,2,3,4,5,6",
        },
        {
            "title": "资料分析套题 2 + 复盘",
            "task_type": "practice",
            "category": "data_analysis",
            "practice_tag": "data_analysis",
            "start_time": "21:00",
            "end_time": "22:00",
            "target_minutes": 27,
            "target_count": 1,
            "weekday_mask": "0,1,2,3,4,5,6",
        },
        {
            "title": "夜间学习 + 睡前整理",
            "task_type": "item",
            "category": "study",
            "practice_tag": None,
            "start_time": "22:00",
            "end_time": "23:00",
            "target_minutes": 60,
            "target_count": None,
            "weekday_mask": "0,1,2,3,4,5,6",
        },
    ]


QUESTION_SEED: list[dict] = [
    {
        "category": "data_analysis",
        "difficulty": "easy",
        "stem": "某地区 2025 年工业增加值为 840 亿元，同比增长 12%。若 2026 年继续增长 10%，则 2026 年工业增加值约为多少亿元？",
        "options": ["924", "932.4", "940.8", "1034.9"],
        "answer_index": 1,
        "explanation": "2026 年为 840 × (1 + 10%) = 924？注意题干已给 2025 年数值，直接乘 1.1 得 924。若按选项校验，应选 924。",
        "tags": ["增长率", "基础计算"],
    },
    {
        "category": "data_analysis",
        "difficulty": "medium",
        "stem": "A 市上半年快递业务量 3.6 亿件，同比增长 20%；B 市为 2.8 亿件，同比增长 40%。两市去年同期合计业务量约为多少亿件？",
        "options": ["4.8", "5.0", "5.2", "5.4"],
        "answer_index": 1,
        "explanation": "A 去年同期 3.6/1.2=3.0，B 去年同期 2.8/1.4=2.0，合计 5.0 亿件。",
        "tags": ["基期量", "合计"],
    },
    {
        "category": "data_analysis",
        "difficulty": "medium",
        "stem": "某产品一季度销量 18 万台，二季度比一季度多 25%，三季度比二季度少 10%。三季度销量为多少万台？",
        "options": ["19.8", "20.25", "21.6", "22.5"],
        "answer_index": 1,
        "explanation": "二季度 18×1.25=22.5，三季度 22.5×0.9=20.25 万台。",
        "tags": ["连续增长"],
    },
    {
        "category": "data_analysis",
        "difficulty": "hard",
        "stem": "某省财政收入中税收收入 720 亿元，占财政收入的 80%。若非税收入同比增长 15% 至当前水平，则去年非税收入约为多少亿元？",
        "options": ["135.7", "144.0", "156.5", "180.0"],
        "answer_index": 2,
        "explanation": "财政收入 720/0.8=900，当前非税收入 180；去年为 180/1.15≈156.5。",
        "tags": ["比重", "基期量"],
    },
    {
        "category": "data_analysis",
        "difficulty": "easy",
        "stem": "某企业营收 5000 万元，利润率为 18%。若利润增加 10%，营收不变，新利润率为多少？",
        "options": ["18.8%", "19.2%", "19.8%", "20.0%"],
        "answer_index": 2,
        "explanation": "原利润 900 万，增加 10% 为 990 万，990/5000=19.8%。",
        "tags": ["利润率"],
    },
    {
        "category": "data_analysis",
        "difficulty": "medium",
        "stem": "某市常住人口 1200 万，其中 60 岁以上人口 216 万。若 60 岁以上人口增加 24 万，总人口不变，占比提高多少个百分点？",
        "options": ["1", "2", "3", "4"],
        "answer_index": 1,
        "explanation": "原占比 216/1200=18%，新占比 240/1200=20%，提高 2 个百分点。",
        "tags": ["百分点"],
    },
    {
        "category": "data_analysis",
        "difficulty": "medium",
        "stem": "某园区 2026 年入驻企业 450 家，比 2024 年增长 50%。若 2025 年较 2024 年增长 20%，则 2026 年较 2025 年增长约多少？",
        "options": ["20%", "25%", "30%", "35%"],
        "answer_index": 1,
        "explanation": "2024 年 450/1.5=300；2025 年 300×1.2=360；2026 较 2025 增长 90/360=25%。",
        "tags": ["间隔增长"],
    },
    {
        "category": "data_analysis",
        "difficulty": "hard",
        "stem": "甲行业产值 800 亿元，乙行业产值 600 亿元。甲增长 12%，乙增长 20%，两行业合计增长率约为多少？",
        "options": ["14.4%", "15.4%", "16.0%", "17.2%"],
        "answer_index": 1,
        "explanation": "增量 800×12% + 600×20% = 216；基期合计 1400；216/1400≈15.4%。",
        "tags": ["混合增长"],
    },
    {
        "category": "quantitative",
        "difficulty": "easy",
        "stem": "一项工程甲单独做 12 天完成，乙单独做 18 天完成。两人合作 3 天后，剩余工程由甲单独完成，还需多少天？",
        "options": ["5", "6", "7", "8"],
        "answer_index": 0,
        "explanation": "合作效率 1/12+1/18=5/36，3 天完成 5/12，剩余 7/12；甲做需 7 天。",
        "tags": ["工程问题"],
    },
    {
        "category": "quantitative",
        "difficulty": "medium",
        "stem": "某班男生与女生人数比为 5:4，转入 3 名女生后男女比为 5:5。原来全班多少人？",
        "options": ["36", "45", "54", "63"],
        "answer_index": 2,
        "explanation": "设男 5x、女 4x，转入后 5x=4x+3，x=3，原人数 9x=27。题目选项不含 27，说明条件应为转入 6 名女生时答案 54；本题按原条件正确值为 27。",
        "tags": ["比例"],
    },
    {
        "category": "quantitative",
        "difficulty": "easy",
        "stem": "从 1 到 100 的整数中，既能被 3 整除又能被 5 整除的数有多少个？",
        "options": ["5", "6", "7", "8"],
        "answer_index": 1,
        "explanation": "即 15 的倍数：15、30、45、60、75、90，共 6 个。",
        "tags": ["倍数"],
    },
    {
        "category": "quantitative",
        "difficulty": "medium",
        "stem": "一列火车长 240 米，以 20 米/秒速度通过一座 360 米长的桥，需要多少秒？",
        "options": ["18", "24", "30", "36"],
        "answer_index": 2,
        "explanation": "通过桥需行驶车长+桥长=600 米，600/20=30 秒。",
        "tags": ["行程"],
    },
    {
        "category": "quantitative",
        "difficulty": "medium",
        "stem": "某商品先涨价 20%，再降价 20%，最终价格比原价如何变化？",
        "options": ["不变", "上涨 4%", "下降 4%", "下降 8%"],
        "answer_index": 2,
        "explanation": "1.2×0.8=0.96，最终为原价 96%，下降 4%。",
        "tags": ["经济利润"],
    },
    {
        "category": "quantitative",
        "difficulty": "hard",
        "stem": "甲乙两地相距 180 千米，汽车去程每小时 60 千米，返程每小时 90 千米，往返平均速度是多少？",
        "options": ["70", "72", "75", "78"],
        "answer_index": 1,
        "explanation": "总路程 360，总时间 180/60+180/90=5 小时，平均速度 72 千米/小时。",
        "tags": ["平均速度"],
    },
]


def normalize_question_seed() -> list[dict]:
    fixed = []
    for item in QUESTION_SEED:
        if item["stem"].startswith("某地区 2025 年工业增加值"):
            item = {**item, "answer_index": 0}
        if item["stem"].startswith("某班男生与女生"):
            item = {
                **item,
                "stem": "某班男生与女生人数比为 5:4，转入 6 名女生后男女比为 5:5。原来全班多少人？",
                "options": ["36", "45", "54", "63"],
                "answer_index": 2,
                "explanation": "设男 5x、女 4x，转入后 5x=4x+6，x=6，原人数 9x=54。",
            }
        fixed.append(item)
    return fixed


def get_or_create_user(db: Session, *, email: str, name: str, password: str, role: str) -> models.User:
    normalized = email.strip().lower()
    user = db.query(models.User).filter(models.User.email == normalized).first()
    if user:
        return user
    user = models.User(email=normalized, name=name, password_hash=hash_password(password), role=role)
    db.add(user)
    db.flush()
    return user


def seed_questions(db: Session) -> None:
    if db.query(models.Question).count() > 0:
        return
    for item in normalize_question_seed():
        db.add(models.Question(**item))
    db.flush()


def create_monthly_plan(db: Session, user: models.User, payload: MonthlyPlanCreate) -> models.MonthlyPlan:
    plan = models.MonthlyPlan(
        user_id=user.id,
        year=payload.year,
        month=payload.month,
        title=payload.title,
        objective=payload.objective,
        target_minutes=payload.target_minutes,
        target_accuracy=payload.target_accuracy,
        routine_text=payload.routine_text,
        status="active",
    )
    db.add(plan)
    db.flush()

    raw_blocks = [b.model_dump() if isinstance(b, PlanBlockIn) else dict(b) for b in payload.blocks]
    if payload.use_ai and not raw_blocks:
        raw_blocks = suggest_plan_blocks(
            objective=payload.objective,
            routine_text=payload.routine_text,
            target_minutes=payload.target_minutes,
            target_accuracy=payload.target_accuracy,
        )
    if not raw_blocks:
        raw_blocks = default_blocks()

    for index, block in enumerate(raw_blocks):
        category = str(block.get("category") or "study")
        practice_tag = normalize_practice_tag(block.get("practice_tag"), category)
        task_type = infer_task_type(category, str(block.get("task_type") or ""), practice_tag)
        if task_type != "practice":
            practice_tag = None
        db.add(
            models.PlanTemplateBlock(
                monthly_plan_id=plan.id,
                sort_order=index,
                title=str(block.get("title") or "每日任务"),
                task_type=task_type,
                category=practice_tag or category,
                practice_tag=practice_tag,
                start_time=parse_time(block.get("start_time")),
                end_time=parse_time(block.get("end_time")),
                target_minutes=block.get("target_minutes"),
                target_count=block.get("target_count"),
                weekday_mask=str(block.get("weekday_mask") or "0,1,2,3,4,5,6"),
            )
        )
    db.flush()
    generate_daily_plans(db, plan)
    return plan


def generate_daily_plans(db: Session, plan: models.MonthlyPlan) -> int:
    start, end = month_bounds(plan.year, plan.month)
    blocks = db.query(models.PlanTemplateBlock).filter_by(monthly_plan_id=plan.id).order_by(models.PlanTemplateBlock.sort_order).all()
    created = 0
    cursor = start
    while cursor <= end:
        weekday = str(cursor.weekday())
        selected = [block for block in blocks if weekday in {x.strip() for x in block.weekday_mask.split(",") if x.strip()}]
        daily = (
            db.query(models.DailyPlan)
            .options(selectinload(models.DailyPlan.tasks))
            .filter_by(user_id=plan.user_id, plan_date=cursor)
            .first()
        )
        if not daily:
            daily = models.DailyPlan(user_id=plan.user_id, monthly_plan_id=plan.id, plan_date=cursor)
            db.add(daily)
            db.flush()
            created += 1
        existing_keys = {(task.title, task.planned_start) for task in daily.tasks}
        for block in selected:
            key = (block.title, block.start_time)
            if key in existing_keys:
                continue
            db.add(
                models.DailyTask(
                    daily_plan_id=daily.id,
                    sort_order=block.sort_order,
                    title=block.title,
                    task_type=infer_task_type(block.category, block.task_type, block.practice_tag),
                    category=block.category,
                    practice_tag=normalize_practice_tag(block.practice_tag, block.category)
                    if infer_task_type(block.category, block.task_type, block.practice_tag) == "practice"
                    else None,
                    planned_start=block.start_time,
                    planned_end=block.end_time,
                    target_minutes=block.target_minutes,
                    target_count=block.target_count,
                )
            )
        cursor += timedelta(days=1)
    db.flush()
    return created


def ensure_daily_plan_for(db: Session, user: models.User, target_date: date) -> models.DailyPlan | None:
    daily = (
        db.query(models.DailyPlan)
        .options(selectinload(models.DailyPlan.tasks))
        .filter_by(user_id=user.id, plan_date=target_date)
        .first()
    )
    if daily:
        return daily
    plan = (
        db.query(models.MonthlyPlan)
        .filter_by(user_id=user.id, year=target_date.year, month=target_date.month, status="active")
        .order_by(models.MonthlyPlan.created_at.desc())
        .first()
    )
    if not plan:
        return None
    generate_daily_plans(db, plan)
    db.flush()
    return (
        db.query(models.DailyPlan)
        .options(selectinload(models.DailyPlan.tasks))
        .filter_by(user_id=user.id, plan_date=target_date)
        .first()
    )


def bootstrap(db: Session) -> None:
    admin = get_or_create_user(
        db,
        email=settings.default_admin_email,
        name="DailyProof 管理者",
        password=settings.default_admin_password,
        role="admin",
    )
    demo = get_or_create_user(
        db,
        email=settings.default_user_email,
        name="DailyProof 体验账号",
        password=settings.default_user_password,
        role="user",
    )
    seed_questions(db)
    for user in (admin, demo):
        exists = db.query(models.MonthlyPlan).filter_by(user_id=user.id, year=2026, month=6).first()
        if exists:
            generate_daily_plans(db, exists)
            continue
        payload = MonthlyPlanCreate(
            year=2026,
            month=6,
            title="6 月资料分析与体能计划",
            objective="资料分析每套控制在 27 分钟内，正确率达到 90%；保持晚间健身和稳定复盘。",
            target_minutes=27,
            target_accuracy=90,
            routine_text=default_routine_text(),
            blocks=[PlanBlockIn(**block) for block in default_blocks()],
        )
        create_monthly_plan(db, user, payload)
    db.commit()


def task_effective_seconds(task: models.DailyTask) -> int:
    seconds = task.accumulated_seconds or 0
    if task.timer_started_at and task.status == "running":
        started = task.timer_started_at
        if started.tzinfo is not None:
            started = started.replace(tzinfo=None)
        seconds += max(0, int((utc_now() - started).total_seconds()))
    return seconds


def serialize_task(task: models.DailyTask) -> dict:
    return {
        "id": task.id,
        "title": task.title,
        "task_type": infer_task_type(task.category, task.task_type, task.practice_tag),
        "category": task.category,
        "practice_tag": normalize_practice_tag(task.practice_tag, task.category)
        if infer_task_type(task.category, task.task_type, task.practice_tag) == "practice"
        else None,
        "planned_start": format_time(task.planned_start),
        "planned_end": format_time(task.planned_end),
        "target_minutes": task.target_minutes,
        "target_count": task.target_count,
        "status": task.status,
        "accumulated_seconds": task_effective_seconds(task),
        "timer_started_at": task.timer_started_at.isoformat() if task.timer_started_at else None,
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        "result_question_count": task.result_question_count,
        "result_accuracy": task.result_accuracy,
        "result_minutes": task.result_minutes,
        "note": task.note,
    }


def serialize_daily_plan(daily: models.DailyPlan | None) -> dict | None:
    if not daily:
        return None
    tasks = sorted(daily.tasks, key=lambda item: (item.planned_start or time(23, 59), item.sort_order, item.id))
    total = len(tasks)
    done = sum(1 for task in tasks if task.status == "done")
    return {
        "id": daily.id,
        "date": daily.plan_date.isoformat(),
        "note": daily.note,
        "completion_rate": round(done * 100 / total, 1) if total else 0,
        "tasks_done": done,
        "tasks_total": total,
        "tasks": [serialize_task(task) for task in tasks],
    }


def serialize_plan(plan: models.MonthlyPlan) -> dict:
    blocks = sorted(plan.blocks, key=lambda item: (item.sort_order, item.id))
    return {
        "id": plan.id,
        "year": plan.year,
        "month": plan.month,
        "title": plan.title,
        "objective": plan.objective,
        "target_minutes": plan.target_minutes,
        "target_accuracy": plan.target_accuracy,
        "routine_text": plan.routine_text,
        "status": plan.status,
        "created_at": plan.created_at.isoformat() if plan.created_at else None,
        "blocks": [
            {
                "id": block.id,
                "title": block.title,
                "task_type": infer_task_type(block.category, block.task_type, block.practice_tag),
                "category": block.category,
                "practice_tag": normalize_practice_tag(block.practice_tag, block.category)
                if infer_task_type(block.category, block.task_type, block.practice_tag) == "practice"
                else None,
                "start_time": format_time(block.start_time),
                "end_time": format_time(block.end_time),
                "target_minutes": block.target_minutes,
                "target_count": block.target_count,
                "weekday_mask": block.weekday_mask,
            }
            for block in blocks
        ],
    }


def serialize_question(question: models.Question, *, reveal: bool = False) -> dict:
    data = {
        "id": question.id,
        "category": question.category,
        "difficulty": question.difficulty,
        "stem": question.stem,
        "options": question.options,
        "tags": question.tags,
    }
    if reveal:
        data["answer_index"] = question.answer_index
        data["explanation"] = question.explanation
    return data


def serialize_session(db: Session, session: models.PracticeSession, *, reveal: bool = False) -> dict:
    questions = db.query(models.Question).filter(models.Question.id.in_(session.question_ids or [])).all()
    question_map = {q.id: q for q in questions}
    answers = db.query(models.PracticeAnswer).filter_by(session_id=session.id).all()
    answer_map = {a.question_id: a for a in answers}
    ordered = [question_map[qid] for qid in session.question_ids if qid in question_map]
    return {
        "id": session.id,
        "category": session.category,
        "title": session.title,
        "target_minutes": session.target_minutes,
        "target_accuracy": session.target_accuracy,
        "total_count": session.total_count,
        "correct_count": session.correct_count,
        "accuracy": session.accuracy,
        "duration_seconds": session.duration_seconds,
        "status": session.status,
        "started_at": session.started_at.isoformat() if session.started_at else None,
        "finished_at": session.finished_at.isoformat() if session.finished_at else None,
        "review_note": session.review_note,
        "questions": [
            {
                **serialize_question(question, reveal=reveal or session.status == "finished"),
                "selected_index": answer_map.get(question.id).selected_index if answer_map.get(question.id) else None,
                "is_correct": answer_map.get(question.id).is_correct if answer_map.get(question.id) else None,
            }
            for question in ordered
        ],
    }


def start_practice_session(
    db: Session,
    *,
    user: models.User,
    category: str,
    question_count: int,
    target_minutes: int,
    target_accuracy: float,
) -> models.PracticeSession:
    questions = (
        db.query(models.Question)
        .filter_by(category=category, is_active=True)
        .order_by(func.random())
        .limit(question_count)
        .all()
    )
    if not questions:
        questions = db.query(models.Question).filter_by(is_active=True).order_by(func.random()).limit(question_count).all()
    random.shuffle(questions)
    session = models.PracticeSession(
        user_id=user.id,
        category=category,
        title="资料分析套题" if category == "data_analysis" else "数量关系练习" if category == "quantitative" else "专项练习",
        target_minutes=target_minutes,
        target_accuracy=target_accuracy,
        question_ids=[q.id for q in questions],
        total_count=len(questions),
        status="active",
        started_at=utc_now(),
    )
    db.add(session)
    db.flush()
    return session


def answer_question(db: Session, session: models.PracticeSession, question_id: int, selected_index: int) -> dict:
    if question_id not in set(session.question_ids or []):
        raise ValueError("question_not_in_session")
    question = db.get(models.Question, question_id)
    if not question:
        raise ValueError("question_not_found")
    answer = db.query(models.PracticeAnswer).filter_by(session_id=session.id, question_id=question_id).first()
    is_correct = selected_index == question.answer_index
    if not answer:
        answer = models.PracticeAnswer(session_id=session.id, question_id=question_id)
        db.add(answer)
    answer.selected_index = selected_index
    answer.is_correct = is_correct
    db.flush()
    return {
        "question_id": question_id,
        "selected_index": selected_index,
        "is_correct": is_correct,
        "answer_index": question.answer_index,
        "explanation": question.explanation,
    }


def finish_practice_session(db: Session, session: models.PracticeSession, review_note: str = "") -> models.PracticeSession:
    answers = db.query(models.PracticeAnswer).filter_by(session_id=session.id).all()
    correct = sum(1 for answer in answers if answer.is_correct)
    total = session.total_count or len(session.question_ids or [])
    started = session.started_at
    if started and started.tzinfo is not None:
        started = started.replace(tzinfo=None)
    duration = max(0, int((utc_now() - started).total_seconds())) if started else session.duration_seconds
    session.correct_count = correct
    session.total_count = total
    session.accuracy = round(correct * 100 / total, 1) if total else 0
    session.duration_seconds = duration
    session.status = "finished"
    session.finished_at = utc_now()
    session.review_note = review_note
    mark_matching_daily_task_done(db, session)
    db.flush()
    return session


def mark_matching_daily_task_done(db: Session, session: models.PracticeSession) -> None:
    today = local_today()
    daily = db.query(models.DailyPlan).filter_by(user_id=session.user_id, plan_date=today).first()
    if not daily:
        return
    task = (
        db.query(models.DailyTask)
        .filter(
            models.DailyTask.daily_plan_id == daily.id,
            models.DailyTask.category == session.category,
            models.DailyTask.status != "done",
        )
        .order_by(models.DailyTask.sort_order.asc(), models.DailyTask.id.asc())
        .first()
    )
    if not task:
        return
    task.status = "done"
    task.completed_at = utc_now()
    task.accumulated_seconds = max(task.accumulated_seconds or 0, session.duration_seconds)
    task.timer_started_at = None
    task.task_type = "practice"
    task.practice_tag = normalize_practice_tag(session.category, session.category)
    task.result_question_count = session.total_count
    task.result_accuracy = session.accuracy
    task.result_minutes = round((session.duration_seconds or 0) / 60, 1)
    task.note = f"刷题完成：{session.correct_count}/{session.total_count}，正确率 {session.accuracy}%"


def update_task_status(
    db: Session,
    task: models.DailyTask,
    status: str | None,
    note: str | None = None,
    result_question_count: int | None = None,
    result_accuracy: float | None = None,
    result_minutes: float | None = None,
) -> models.DailyTask:
    now = utc_now()
    if note is not None:
        task.note = note
    if result_question_count is not None:
        task.result_question_count = max(0, int(result_question_count))
    if result_accuracy is not None:
        task.result_accuracy = max(0.0, min(100.0, float(result_accuracy)))
    if result_minutes is not None:
        task.result_minutes = max(0.0, float(result_minutes))
    if status is None:
        return task
    if status == "running":
        if task.status != "done" and task.timer_started_at is None:
            task.timer_started_at = now
        task.status = "running"
    elif status == "pending":
        if task.timer_started_at is not None:
            task.accumulated_seconds = task_effective_seconds(task)
            task.timer_started_at = None
        task.status = "pending"
    elif status == "skipped":
        if task.timer_started_at is not None:
            task.accumulated_seconds = task_effective_seconds(task)
            task.timer_started_at = None
        task.status = "skipped"
    elif status == "done":
        if task.timer_started_at is not None:
            task.accumulated_seconds = task_effective_seconds(task)
            task.timer_started_at = None
        if infer_task_type(task.category, task.task_type, task.practice_tag) == "practice":
            if task.result_question_count is None or task.result_accuracy is None or task.result_minutes is None:
                raise ValueError("practice_result_required")
        task.status = "done"
        task.completed_at = now
    db.flush()
    return task


def is_practice_task(task: models.DailyTask) -> bool:
    return infer_task_type(task.category, task.task_type, task.practice_tag) == "practice"


def task_tag(task: models.DailyTask) -> str:
    return normalize_practice_tag(task.practice_tag, task.category) or "other"


def task_result_minutes(task: models.DailyTask) -> float:
    if task.result_minutes is not None:
        return max(0.0, float(task.result_minutes))
    seconds = task_effective_seconds(task)
    return round(seconds / 60, 1) if seconds else 0.0


def weighted_accuracy(tasks: list[models.DailyTask]) -> float | None:
    values = [task for task in tasks if task.result_accuracy is not None]
    if not values:
        return None
    weighted_total = sum(float(task.result_accuracy or 0) * max(0, int(task.result_question_count or 0)) for task in values)
    weight = sum(max(0, int(task.result_question_count or 0)) for task in values)
    if weight > 0:
        return round(weighted_total / weight, 1)
    return round(sum(float(task.result_accuracy or 0) for task in values) / len(values), 1)


def aggregate_practice(tasks: list[models.DailyTask]) -> dict:
    practice_tasks = [task for task in tasks if task.status == "done" and is_practice_task(task)]
    question_total = sum(max(0, int(task.result_question_count or 0)) for task in practice_tasks)
    minutes_total = round(sum(task_result_minutes(task) for task in practice_tasks), 1)
    by_tag: dict[str, list[models.DailyTask]] = {}
    for task in practice_tasks:
        by_tag.setdefault(task_tag(task), []).append(task)
    tag_summary = [
        {
            "tag": tag,
            "label": PRACTICE_TAG_LABELS.get(tag, tag),
            "task_count": len(items),
            "question_count": sum(max(0, int(item.result_question_count or 0)) for item in items),
            "accuracy": weighted_accuracy(items),
            "minutes": round(sum(task_result_minutes(item) for item in items), 1),
        }
        for tag, items in sorted(by_tag.items(), key=lambda entry: entry[0])
    ]
    return {
        "practice_task_count": len(practice_tasks),
        "question_total": question_total,
        "accuracy": weighted_accuracy(practice_tasks),
        "practice_minutes": minutes_total,
        "avg_practice_minutes": round(minutes_total / len(practice_tasks), 1) if practice_tasks else 0,
        "tag_summary": tag_summary,
    }


def practice_filter():
    return or_(models.DailyTask.task_type == "practice", models.DailyTask.category.in_(tuple(PRACTICE_TAGS)))


def serialize_practice_trend_point(task: models.DailyTask, plan_date: date, sequence: int) -> dict:
    tag = task_tag(task)
    return {
        "id": task.id,
        "date": plan_date.isoformat(),
        "title": task.title,
        "tag": tag,
        "label": PRACTICE_TAG_LABELS.get(tag, tag),
        "sequence": sequence,
        "question_count": max(0, int(task.result_question_count or 0)),
        "accuracy": round(float(task.result_accuracy), 1) if task.result_accuracy is not None else None,
        "minutes": task_result_minutes(task),
        "target_minutes": task.target_minutes,
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        "planned_start": format_time(task.planned_start),
    }


def normalize_record_category(value: str) -> str:
    tag = normalize_practice_tag(value, value)
    if tag not in PRACTICE_TAGS:
        raise ValueError("invalid_practice_category")
    return tag


def serialize_practice_record(record: models.PracticeRecord) -> dict:
    category = normalize_record_category(record.category)
    return {
        "id": record.id,
        "date": record.record_date.isoformat(),
        "category": category,
        "label": PRACTICE_TAG_LABELS.get(category, category),
        "minutes": round(float(record.minutes or 0), 1),
        "accuracy": round(float(record.accuracy or 0), 1),
        "note": record.note or "",
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "updated_at": record.updated_at.isoformat() if record.updated_at else None,
    }


def practice_record_queryset(db: Session, user_id: int, start: date, end: date) -> list[models.PracticeRecord]:
    return (
        db.query(models.PracticeRecord)
        .filter(
            models.PracticeRecord.user_id == user_id,
            models.PracticeRecord.record_date >= start,
            models.PracticeRecord.record_date <= end,
        )
        .order_by(models.PracticeRecord.record_date.desc(), models.PracticeRecord.created_at.desc(), models.PracticeRecord.id.desc())
        .all()
    )


def create_practice_record(
    db: Session,
    *,
    user_id: int,
    record_date: date,
    category: str,
    minutes: float,
    accuracy: float,
    note: str,
) -> models.PracticeRecord:
    record = models.PracticeRecord(
        user_id=user_id,
        record_date=record_date,
        category=normalize_record_category(category),
        minutes=round(max(0.0, float(minutes)), 1),
        accuracy=round(max(0.0, min(100.0, float(accuracy))), 1),
        note=(note or "").strip(),
    )
    db.add(record)
    db.flush()
    return record


def update_practice_record(
    db: Session,
    record: models.PracticeRecord,
    *,
    record_date: date | None = None,
    category: str | None = None,
    minutes: float | None = None,
    accuracy: float | None = None,
    note: str | None = None,
) -> models.PracticeRecord:
    if record_date is not None:
        record.record_date = record_date
    if category is not None:
        record.category = normalize_record_category(category)
    if minutes is not None:
        record.minutes = round(max(0.0, float(minutes)), 1)
    if accuracy is not None:
        record.accuracy = round(max(0.0, min(100.0, float(accuracy))), 1)
    if note is not None:
        record.note = note.strip()
    db.flush()
    return record


def summarize_practice_records(records: list[models.PracticeRecord]) -> dict:
    minutes = round(sum(float(record.minutes or 0) for record in records), 1)
    accuracy = round(sum(float(record.accuracy or 0) for record in records) / len(records), 1) if records else None
    return {
        "record_count": len(records),
        "minutes": minutes,
        "accuracy": accuracy,
    }


def weekly_record_periods(year: int, month: int) -> list[dict]:
    start, end = month_bounds(year, month)
    periods = []
    cursor = start
    seen: set[tuple[int, int]] = set()
    while cursor <= end:
        iso_year, iso_week, _ = cursor.isocalendar()
        key = (iso_year, iso_week)
        if key not in seen:
            seen.add(key)
            week_start = cursor - timedelta(days=cursor.weekday())
            week_end = week_start + timedelta(days=6)
            periods.append(
                {
                    "key": f"{iso_year}-W{iso_week:02d}",
                    "label": f"W{iso_week:02d}",
                    "start": max(week_start, start),
                    "end": min(week_end, end),
                }
            )
        cursor += timedelta(days=1)
    return periods


def monthly_record_periods(year: int) -> list[dict]:
    periods = []
    for month in range(1, 13):
        start, end = month_bounds(year, month)
        periods.append(
            {
                "key": f"{year}-{month:02d}",
                "label": f"{month}月",
                "start": start,
                "end": end,
            }
        )
    return periods


def user_practice_record_stats(db: Session, user_id: int, *, scope: str, year: int, month: int | None = None) -> dict:
    normalized_scope = "month" if scope == "month" else "week"
    periods = monthly_record_periods(year) if normalized_scope == "month" else weekly_record_periods(year, month or local_today().month)
    start = periods[0]["start"]
    end = periods[-1]["end"]
    records = practice_record_queryset(db, user_id, start, end)
    categories = [
        {"category": category, "label": PRACTICE_TAG_LABELS[category]}
        for category in PRACTICE_CATEGORY_ORDER
    ]

    def in_period(record: models.PracticeRecord, period: dict) -> bool:
        return period["start"] <= record.record_date <= period["end"]

    period_rows = []
    for period in periods:
        period_records = [record for record in records if in_period(record, period)]
        category_map = {}
        for category in PRACTICE_CATEGORY_ORDER:
            items = [record for record in period_records if normalize_practice_tag(record.category, record.category) == category]
            category_map[category] = summarize_practice_records(items)
        period_rows.append(
            {
                "period": period["key"],
                "label": period["label"],
                "start": period["start"].isoformat(),
                "end": period["end"].isoformat(),
                **summarize_practice_records(period_records),
                "categories": category_map,
            }
        )

    category_summary = []
    for category in PRACTICE_CATEGORY_ORDER:
        category_records = [record for record in records if normalize_practice_tag(record.category, record.category) == category]
        summary = summarize_practice_records(category_records)
        category_summary.append(
            {
                "category": category,
                "label": PRACTICE_TAG_LABELS[category],
                **summary,
                "trend": [
                    {
                        "period": row["period"],
                        "label": row["label"],
                        "start": row["start"],
                        "end": row["end"],
                        **row["categories"][category],
                    }
                    for row in period_rows
                ],
            }
        )

    return {
        "scope": normalized_scope,
        "year": year,
        "month": month if normalized_scope == "week" else None,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "categories": categories,
        "summary": summarize_practice_records(records),
        "category_summary": category_summary,
        "periods": period_rows,
        "records": [serialize_practice_record(record) for record in records],
    }


def user_month_stats(db: Session, user_id: int, year: int, month: int) -> dict:
    start, end = month_bounds(year, month)
    plans = (
        db.query(models.DailyPlan)
        .options(selectinload(models.DailyPlan.tasks))
        .filter(models.DailyPlan.user_id == user_id, models.DailyPlan.plan_date >= start, models.DailyPlan.plan_date <= end)
        .order_by(models.DailyPlan.plan_date.asc())
        .all()
    )
    daily = []
    tasks_total = 0
    tasks_done = 0
    study_seconds = 0
    month_practice_tasks: list[models.DailyTask] = []
    practice_trends: dict[str, list[dict]] = {"data_analysis": [], "quantitative": []}
    cursor = start
    plan_map = {plan.plan_date: plan for plan in plans}
    while cursor <= end:
        plan = plan_map.get(cursor)
        tasks = plan.tasks if plan else []
        total = len(tasks)
        done = sum(1 for task in tasks if task.status == "done")
        tasks_total += total
        tasks_done += done
        seconds = sum(task_effective_seconds(task) for task in tasks)
        study_seconds += seconds
        day_practice = [task for task in tasks if task.status == "done" and is_practice_task(task)]
        month_practice_tasks.extend(day_practice)
        for task in sorted(day_practice, key=lambda item: (item.planned_start or time.min, item.sort_order, item.id)):
            tag = task_tag(task)
            if tag in practice_trends:
                practice_trends[tag].append(serialize_practice_trend_point(task, cursor, len(practice_trends[tag]) + 1))
        day_stats = aggregate_practice(day_practice)
        daily.append(
            {
                "date": cursor.isoformat(),
                "completion_rate": round(done * 100 / total, 1) if total else 0,
                "tasks_done": done,
                "tasks_total": total,
                "result_count": day_stats["practice_task_count"],
                "practice_count": day_stats["practice_task_count"],
                "practice_task_count": day_stats["practice_task_count"],
                "question_count": day_stats["question_total"],
                "accuracy": day_stats["accuracy"],
                "result_minutes": day_stats["practice_minutes"],
                "practice_minutes": day_stats["practice_minutes"],
                "tag_summary": day_stats["tag_summary"],
            }
        )
        cursor += timedelta(days=1)

    month_stats = aggregate_practice(month_practice_tasks)
    weekly_groups: dict[tuple[int, int], list[dict]] = {}
    for item in daily:
        day = date.fromisoformat(item["date"])
        iso = day.isocalendar()
        weekly_groups.setdefault((iso.year, iso.week), []).append(item)
    weekly = []
    for (week_year, week_number), items in sorted(weekly_groups.items(), key=lambda entry: entry[0]):
        question_total = sum(int(item["question_count"] or 0) for item in items)
        minutes_total = round(sum(float(item["practice_minutes"] or 0) for item in items), 1)
        accuracy_values = [
            (float(item["accuracy"]), int(item["question_count"] or 0))
            for item in items
            if item["accuracy"] is not None
        ]
        weight = sum(weight for _, weight in accuracy_values)
        if weight:
            accuracy = round(sum(value * weight for value, weight in accuracy_values) / weight, 1)
        elif accuracy_values:
            accuracy = round(sum(value for value, _ in accuracy_values) / len(accuracy_values), 1)
        else:
            accuracy = None
        weekly.append(
            {
                "week": f"{week_year}-W{week_number:02d}",
                "start": items[0]["date"],
                "end": items[-1]["date"],
                "question_count": question_total,
                "practice_minutes": minutes_total,
                "accuracy": accuracy,
                "practice_task_count": sum(int(item["practice_task_count"] or 0) for item in items),
            }
        )

    total_practice_tasks = (
        db.query(models.DailyTask)
        .join(models.DailyPlan, models.DailyTask.daily_plan_id == models.DailyPlan.id)
        .filter(models.DailyPlan.user_id == user_id, models.DailyTask.status == "done", practice_filter())
        .all()
    )
    total_stats = aggregate_practice(total_practice_tasks)
    avg_accuracy_all = month_stats["accuracy"] or 0
    avg_result_minutes = month_stats["avg_practice_minutes"]
    return {
        "year": year,
        "month": month,
        "tasks_total": tasks_total,
        "tasks_done": tasks_done,
        "completion_rate": round(tasks_done * 100 / tasks_total, 1) if tasks_total else 0,
        "study_hours": round(study_seconds / 3600, 1),
        "result_count": month_stats["practice_task_count"],
        "practice_sessions": month_stats["practice_task_count"],
        "practice_task_count": month_stats["practice_task_count"],
        "question_total": month_stats["question_total"],
        "practice_minutes": month_stats["practice_minutes"],
        "avg_accuracy": avg_accuracy_all,
        "avg_result_minutes": avg_result_minutes,
        "avg_practice_minutes": avg_result_minutes,
        "tag_summary": month_stats["tag_summary"],
        "weekly": weekly,
        "practice_trends": practice_trends,
        "total": {
            "practice_task_count": total_stats["practice_task_count"],
            "question_total": total_stats["question_total"],
            "practice_minutes": total_stats["practice_minutes"],
            "avg_accuracy": total_stats["accuracy"] or 0,
            "tag_summary": total_stats["tag_summary"],
        },
        "daily": daily,
    }


def admin_overview(db: Session) -> dict:
    today = local_today()
    users = db.query(models.User).count()
    active_today = db.query(models.DailyPlan.user_id).filter(models.DailyPlan.plan_date == today).distinct().count()
    tasks_total = db.query(models.DailyTask).count()
    tasks_done = db.query(models.DailyTask).filter(models.DailyTask.status == "done").count()
    practice_tasks = db.query(models.DailyTask).filter(models.DailyTask.status == "done", practice_filter()).all()
    practice_stats = aggregate_practice(practice_tasks)
    return {
        "users": users,
        "active_today": active_today,
        "tasks_total": tasks_total,
        "tasks_done": tasks_done,
        "completion_rate": round(tasks_done * 100 / tasks_total, 1) if tasks_total else 0,
        "result_count": practice_stats["practice_task_count"],
        "practice_sessions": practice_stats["practice_task_count"],
        "practice_task_count": practice_stats["practice_task_count"],
        "question_total": practice_stats["question_total"],
        "practice_minutes": practice_stats["practice_minutes"],
        "avg_accuracy": practice_stats["accuracy"] or 0,
    }


def user_admin_rows(db: Session) -> list[dict]:
    users = db.query(models.User).order_by(models.User.created_at.desc()).all()
    rows = []
    for user in users:
        task_total = (
            db.query(models.DailyTask)
            .join(models.DailyPlan, models.DailyTask.daily_plan_id == models.DailyPlan.id)
            .filter(models.DailyPlan.user_id == user.id)
            .count()
        )
        task_done = (
            db.query(models.DailyTask)
            .join(models.DailyPlan, models.DailyTask.daily_plan_id == models.DailyPlan.id)
            .filter(models.DailyPlan.user_id == user.id, models.DailyTask.status == "done")
            .count()
        )
        practice_tasks = (
            db.query(models.DailyTask)
            .join(models.DailyPlan, models.DailyTask.daily_plan_id == models.DailyPlan.id)
            .filter(models.DailyPlan.user_id == user.id, models.DailyTask.status == "done", practice_filter())
            .all()
        )
        practice_stats = aggregate_practice(practice_tasks)
        rows.append(
            {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "role": user.role,
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "tasks_total": task_total,
                "tasks_done": task_done,
                "completion_rate": round(task_done * 100 / task_total, 1) if task_total else 0,
                "result_count": practice_stats["practice_task_count"],
                "practice_sessions": practice_stats["practice_task_count"],
                "practice_task_count": practice_stats["practice_task_count"],
                "question_total": practice_stats["question_total"],
                "practice_minutes": practice_stats["practice_minutes"],
                "avg_accuracy": practice_stats["accuracy"] or 0,
            }
        )
    return rows


def task_result_rows(db: Session, limit: int = 100) -> list[dict]:
    rows = (
        db.query(models.DailyTask, models.DailyPlan, models.User)
        .join(models.DailyPlan, models.DailyTask.daily_plan_id == models.DailyPlan.id)
        .join(models.User, models.DailyPlan.user_id == models.User.id)
        .filter(models.DailyTask.status == "done", practice_filter())
        .order_by(models.DailyPlan.plan_date.desc(), models.DailyTask.completed_at.desc().nullslast(), models.DailyTask.id.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": task.id,
            "user": user.email,
            "name": user.name,
            "date": daily.plan_date.isoformat(),
            "title": task.title,
            "task_type": infer_task_type(task.category, task.task_type, task.practice_tag),
            "category": task.category,
            "practice_tag": task_tag(task),
            "practice_label": PRACTICE_TAG_LABELS.get(task_tag(task), task_tag(task)),
            "question_count": task.result_question_count,
            "accuracy": task.result_accuracy,
            "duration_seconds": int(task_result_minutes(task) * 60),
            "result_minutes": task_result_minutes(task),
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        }
        for task, daily, user in rows
    ]
