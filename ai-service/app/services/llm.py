"""
LLM-powered assistant (used when AI_API_KEY is configured).

Flow: user question → model picks tools → we execute the tool against the
backend's curated endpoints → model summarizes. Max 4 tool rounds.

Calls any OpenAI-compatible /chat/completions endpoint via plain HTTP —
works with OpenAI, Azure-style gateways, Ollama, vLLM, llama.cpp server, etc.
"""
import json
from typing import Any

import httpx

from app.config import settings
from app.services.tools import TOOL_SPECS, execute_tool

SYSTEM_PROMPT = """You are FleetOps AI, an assistant for a fleet management platform.
You answer questions about vehicles, drivers, trips, maintenance, fuel and
documents by calling the provided tools. Rules:
- Always base answers on tool data; never invent numbers.
- Keep answers concise and formatted with short bullet lists.
- Include vehicle numbers / driver names so users can find records.
- If data is missing, say so plainly.
"""


async def _chat(messages: list[dict]) -> dict:
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{settings.ai_base_url.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {settings.ai_api_key}"},
            json={
                "model": settings.ai_model,
                "messages": messages,
                "tools": TOOL_SPECS,
                "tool_choice": "auto",
                "temperature": 0.2,
            },
        )
        resp.raise_for_status()
        return resp.json()


async def ask_with_llm(question: str, user_role: str) -> dict[str, Any]:
    messages: list[dict] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": question},
    ]
    tools_used: list[str] = []

    for _ in range(4):
        data = await _chat(messages)
        msg = data["choices"][0]["message"]

        tool_calls = msg.get("tool_calls") or []
        if not tool_calls:
            return {
                "answer": msg.get("content") or "I could not produce an answer.",
                "toolUsed": ", ".join(tools_used) or None,
            }

        # Append the assistant turn (only fields the API accepts back)
        messages.append({
            "role": "assistant",
            "content": msg.get("content"),
            "tool_calls": tool_calls,
        })
        for call in tool_calls:
            name = call["function"]["name"]
            try:
                args = json.loads(call["function"].get("arguments") or "{}")
                result = await execute_tool(name, args)
            except Exception as exc:  # surface tool failure to the model
                result = {"error": str(exc)}
            tools_used.append(name)
            messages.append({
                "role": "tool",
                "tool_call_id": call["id"],
                "content": json.dumps(result)[:15000],
            })

    return {"answer": "I needed too many lookups — please narrow the question.", "toolUsed": ", ".join(tools_used)}
