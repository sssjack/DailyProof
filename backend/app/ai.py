from __future__ import annotations

import json
import re
from typing import Any

import httpx

from app.settings import settings


def _extract_json(text: str) -> Any:
    if not text:
        return None
    fenced = re.search(r"```json\s*([\s\S]*?)\s*```", text, flags=re.IGNORECASE)
    candidate = fenced.group(1) if fenced else text
    if not fenced:
        match = re.search(r"(\[[\s\S]*\]|\{[\s\S]*\})", text)
        candidate = match.group(1) if match else text
    try:
        return json.loads(candidate)
    except Exception:
        return None


def is_ai_available() -> bool:
    return bool(_ai_api_key())


def _ai_api_key() -> str:
    return (settings.ai_api_key or settings.deepseek_api_key or "").strip()


def _ai_api_url() -> str:
    if settings.ai_api_key:
        return (settings.ai_api_url or "https://api.openai.com/v1/chat/completions").strip()
    return (settings.deepseek_api_url or "").strip()


def _normalize_ai_model(model: str | None) -> str:
    value = (model or "gpt-5.4-thinking-all").strip()
    aliases = {
        "deepseekv4pro": "deepseek-v4-pro",
        "deepseek v4 pro": "deepseek-v4-pro",
    }
    return aliases.get(value.lower(), value)


def _ai_model() -> str:
    configured = settings.ai_model or ("gpt-5.4-thinking-all" if settings.ai_api_key else settings.deepseek_model)
    return _normalize_ai_model(configured)


def _chat_completion_text(data: dict[str, Any]) -> str:
    choices = data.get("choices") or []
    if not choices or not isinstance(choices[0], dict):
        return ""
    message = choices[0].get("message") or {}
    content = message.get("content", "")
    if isinstance(content, list):
        return "".join(str(part.get("text", "")) if isinstance(part, dict) else str(part) for part in content)
    return str(content or "")


def _call_ai_provider(
    *,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.3,
    max_tokens: int = 1500,
) -> str | None:
    api_key = _ai_api_key()
    api_url = _ai_api_url()
    if not api_key:
        return None
    payload = {
        "model": _ai_model(),
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    try:
        with httpx.Client(timeout=settings.ai_http_timeout_sec) as client:
            response = client.post(
                api_url,
                json=payload,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            )
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError:
                if response.status_code != 400:
                    raise
                retry_payload = dict(payload)
                retry_payload["max_completion_tokens"] = retry_payload.pop("max_tokens")
                retry_payload.pop("temperature", None)
                response = client.post(
                    api_url,
                    json=retry_payload,
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                )
                response.raise_for_status()
            data = response.json()
        return _chat_completion_text(data)
    except Exception:
        return None


def suggest_plan_blocks(
    *,
    objective: str,
    routine_text: str,
    target_minutes: int,
    target_accuracy: float,
) -> list[dict[str, Any]]:
    system_prompt = """你是 DailyProof 的计划拆分引擎。
把用户的月度目标和作息文字拆成每日模板任务。只输出 JSON 数组，不要 Markdown。
每个对象字段：
title: 简短任务名
category: data_analysis | quantitative | fitness | review | study | life
start_time: HH:MM 或 null
end_time: HH:MM 或 null
target_minutes: 数字或 null
target_count: 数字或 null
weekday_mask: "0,1,2,3,4,5,6" 代表周一到周日
要求任务可打卡、可计时，保留复盘环节，避免过度拆碎。"""
    user_prompt = (
        f"月目标：{objective}\n"
        f"资料分析目标用时：{target_minutes} 分钟\n"
        f"正确率目标：{target_accuracy}%\n"
        f"作息与计划：\n{routine_text}"
    )
    content = _call_ai_provider(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=0.2,
        max_tokens=1200,
    )
    if not content:
        return []
    parsed = _extract_json(content)
    if not isinstance(parsed, list):
        return []
    blocks: list[dict[str, Any]] = []
    for item in parsed[:12]:
        if not isinstance(item, dict) or not str(item.get("title") or "").strip():
            continue
        blocks.append(
            {
                "title": str(item.get("title") or "").strip()[:160],
                "category": str(item.get("category") or "study").strip()[:40],
                "start_time": item.get("start_time") or None,
                "end_time": item.get("end_time") or None,
                "target_minutes": item.get("target_minutes"),
                "target_count": item.get("target_count"),
                "weekday_mask": str(item.get("weekday_mask") or "0,1,2,3,4,5,6"),
            }
        )
    return blocks


def generate_coaching(stats_summary: str) -> str | None:
    system_prompt = """你是 DailyProof 的 AI 教练。根据用户的练习统计数据，给出 3 条具体、可执行的建议。
要求：
1. 每条建议针对一个具体问题
2. 给出明确的改进方案和预期效果
3. 语言简洁有力，使用中文
直接输出建议内容，不要输出 JSON。"""
    return _call_ai_provider(
        system_prompt=system_prompt,
        user_prompt=f"以下是我最近的练习统计：\n{stats_summary}",
        temperature=0.4,
        max_tokens=800,
    )


def generate_weekly_report(stats_summary: str, records_summary: str) -> str | None:
    system_prompt = """你是 DailyProof 的周报生成引擎。根据用户本周的练习数据和记录，生成一份结构清晰的周报。
周报包含：
1. 本周概况（总做题量、平均正确率、练习时长）
2. 亮点与进步
3. 需要注意的问题
4. 下周建议
使用中文，语言简洁专业。"""
    return _call_ai_provider(
        system_prompt=system_prompt,
        user_prompt=f"统计概况：\n{stats_summary}\n\n做题记录概况：\n{records_summary}",
        temperature=0.3,
        max_tokens=1200,
    )


def generate_error_analysis(issue_summary: str, category_summary: str) -> str | None:
    system_prompt = """你是 DailyProof 的错因分析引擎。根据用户的错因标签分布和分类成绩，进行深度分析。
分析包含：
1. 主要失分原因分析
2. 各科目薄弱环节
3. 针对性练习策略（具体到每个弱项怎么练）
4. 优先改进顺序
使用中文，直接输出分析内容。"""
    return _call_ai_provider(
        system_prompt=system_prompt,
        user_prompt=f"错因标签分布：\n{issue_summary}\n\n分类成绩概况：\n{category_summary}",
        temperature=0.3,
        max_tokens=1000,
    )


def generate_sticky_advice(note_date: str, items_summary: str) -> str | None:
    system_prompt = """你是 DailyProof 的便签清单教练。
根据用户某一天的事项清单，输出一段简短、具体、温和的中文建议。
建议必须来自清单状态，包含完成顺序、注意事项或节奏提醒。不要输出 Markdown 标题，不要超过 120 字。"""
    return _call_ai_provider(
        system_prompt=system_prompt,
        user_prompt=f"日期：{note_date}\n清单：\n{items_summary}",
        temperature=0.35,
        max_tokens=900,
    )
