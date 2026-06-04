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


def suggest_plan_blocks(
    *,
    objective: str,
    routine_text: str,
    target_minutes: int,
    target_accuracy: float,
) -> list[dict[str, Any]]:
    api_key = (settings.deepseek_api_key or "").strip()
    if not api_key:
        return []

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
    payload = {
        "model": (settings.deepseek_model or "deepseek-v4-pro").strip(),
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
        "max_tokens": 1200,
    }
    try:
        with httpx.Client(timeout=settings.ai_http_timeout_sec) as client:
            response = client.post(
                settings.deepseek_api_url,
                json=payload,
                headers={"Authorization": f"Bearer {api_key}"},
            )
            response.raise_for_status()
            data = response.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
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
    except Exception:
        return []
