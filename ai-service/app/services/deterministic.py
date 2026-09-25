"""
Deterministic fallback assistant — used when no LLM API key is configured.
Matches the question against intent patterns, calls the same controlled
backend data endpoints, and formats a template answer. This keeps the AI
feature fully demonstrable offline.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

from app.services import backend_client
from app.services.risk import fuel_anomalies, maintenance_risk


def _bullets(lines: list[str]) -> str:
    return "\n".join(f"• {line}" for line in lines)


async def _available_vehicles() -> str:
    vs = await backend_client.get_vehicles()
    avail = [v for v in vs if v["status"] == "AVAILABLE"]
    if not avail:
        return "No vehicles are currently marked AVAILABLE."
    return f"{len(avail)} vehicle(s) are available:\n" + _bullets(
        f"{v['vehicleNumber']} — {v['manufacturer']} {v['model']} ({v['type']})" for v in avail
    )


async def _top_maintenance_cost() -> str:
    ms = await backend_client.get_maintenance()
    totals: dict[str, dict] = {}
    for m in ms:
        entry = totals.setdefault(m["vehicleNumber"], {"cost": 0.0, "count": 0})
        entry["cost"] += m.get("cost") or 0
        entry["count"] += 1
    if not totals:
        return "No maintenance records found."
    top = sorted(totals.items(), key=lambda kv: kv[1]["cost"], reverse=True)[:5]
    return "Vehicles with the highest maintenance cost:\n" + _bullets(
        f"{num} — ₹{v['cost']:,.0f} across {v['count']} service(s)" for num, v in top
    )


async def _idle_vehicles() -> str:
    vs = await backend_client.get_vehicles()
    trips = await backend_client.get_trips()
    recent = {}
    for t in trips:
        t_date = t.get("actualEndTime") or t.get("startTime")
        try:
            d = datetime.fromisoformat(str(t_date).replace("Z", "+00:00"))
        except (TypeError, ValueError):
            continue
        if t["vehicle"] not in recent or d > recent[t["vehicle"]]:
            recent[t["vehicle"]] = d
    now = datetime.now(timezone.utc)
    idle = []
    for v in vs:
        last = recent.get(v["vehicleNumber"])
        days = (now - last).days if last else 999
        if days >= 30 and v["status"] != "MAINTENANCE":
            idle.append((v, days))
    if not idle:
        return "No vehicles have been idle for 30+ days."
    return "Vehicles not used in the last 30 days:\n" + _bullets(
        f"{v['vehicleNumber']} — idle ~{d} days (status: {v['status']})" for v, d in idle
    )


async def _poor_efficiency() -> str:
    data = await backend_client.get_fuel()
    anomalies = fuel_anomalies(data)
    worst = sorted(
        (e for e in data.get("efficiency", []) if e.get("avgEfficiency")),
        key=lambda e: e["avgEfficiency"],
    )[:5]
    out = []
    if anomalies:
        out.append("⚠ Anomalies detected:\n" + _bullets(a["message"] for a in anomalies))
    if worst:
        out.append("Lowest average efficiency:\n" + _bullets(
            f"{e['vehicleNumber']} — {e['avgEfficiency']:.1f} km/L avg" for e in worst
        ))
    return "\n\n".join(out) if out else "Not enough fuel data to compute efficiency yet."


async def _expiring_documents() -> str:
    docs = await backend_client.get_documents()
    upcoming = [d for d in docs if d.get("expiresInDays") is not None and d["expiresInDays"] <= 60]
    upcoming.sort(key=lambda d: d["expiresInDays"])
    if not upcoming:
        return "No documents expire within the next 60 days."
    return "Documents expiring soon:\n" + _bullets(
        f"{d['documentType'].replace('_',' ').title()} ({d.get('documentNumber') or 'n/a'}) — "
        f"{d['entityType'].lower()} — "
        + (f"expired {abs(d['expiresInDays'])} days ago" if d["expiresInDays"] < 0 else f"in {d['expiresInDays']} days")
        for d in upcoming[:10]
    )


async def _top_drivers() -> str:
    ds = await backend_client.get_drivers()
    top = sorted(ds, key=lambda d: d.get("tripCount", 0), reverse=True)[:5]
    if not top or top[0].get("tripCount", 0) == 0:
        return "No completed trips recorded for drivers yet."
    return "Drivers with the most trips:\n" + _bullets(
        f"{d['name']} — {d['tripCount']} trips ({d['status']})" for d in top
    )


async def _on_trip() -> str:
    vs = await backend_client.get_vehicles()
    on_trip = [v for v in vs if v["status"] == "ON_TRIP"]
    if not on_trip:
        return "No vehicles are currently on a trip."
    return f"{len(on_trip)} vehicle(s) on trip:\n" + _bullets(
        f"{v['vehicleNumber']} — driver: {v.get('assignedDriver') or 'unassigned'}" for v in on_trip
    )


async def _maintenance_due() -> str:
    ms = await backend_client.get_maintenance()
    open_items = [m for m in ms if m["status"] in ("SCHEDULED", "IN_PROGRESS")]
    if not open_items:
        return "No scheduled or in-progress maintenance."
    return "Open maintenance work:\n" + _bullets(
        f"{m['vehicleNumber']} — {m['serviceType']} ({m['status']}, {str(m['serviceDate'])[:10]})"
        for m in open_items[:10]
    )


async def _fleet_summary() -> str:
    vs, ds, ts = await backend_client.get_vehicles(), await backend_client.get_drivers(), await backend_client.get_trips()
    from collections import Counter
    vc, tc = Counter(v["status"] for v in vs), Counter(t["status"] for t in ts)
    return (
        "Fleet summary:\n" + _bullets([
            f"{len(vs)} vehicles — {vc.get('AVAILABLE',0)} available, {vc.get('ON_TRIP',0)} on trip, "
            f"{vc.get('MAINTENANCE',0)} in maintenance, {vc.get('ASSIGNED',0)} assigned",
            f"{len(ds)} drivers",
            f"{len(ts)} trips — {tc.get('COMPLETED',0)} completed, {tc.get('IN_TRANSIT',0)+tc.get('STARTED',0)} in progress, "
            f"{tc.get('DELAYED',0)} delayed, {tc.get('CANCELLED',0)} cancelled",
        ])
    )


async def _risk_overview() -> str:
    vs = await backend_client.get_vehicles()
    ms = await backend_client.get_maintenance()
    rows = []
    for v in vs:
        vm = [m for m in ms if m["vehicleId"] == v["id"]]
        rows.append(maintenance_risk(v, vm))
    rows.sort(key=lambda r: r["score"], reverse=True)
    top = rows[:5]
    return "Highest maintenance-risk vehicles (heuristic estimate, not a guarantee):\n" + _bullets(
        f"{r['vehicleNumber']} — {r['risk']} (score {r['score']}/100)" for r in top
    )


# Ordered (pattern, handler) pairs — first match wins
INTENTS: list[tuple[str, Callable[[], Awaitable[str]]]] = [
    (r"available.*(vehicle|car|truck|van)|vehicle.*available", _available_vehicles),
    (r"highest maintenance|maintenance cost|most.*(repair|service).*cost", _top_maintenance_cost),
    (r"(idle|unused|not used|haven'?t been used|underutili)", _idle_vehicles),
    (r"(poor|bad|low|worst).*(fuel|efficiency|mileage)|fuel efficiency", _poor_efficiency),
    (r"(document|license|insurance|puc|permit).*(expir|renew)|expir", _expiring_documents),
    (r"(most|top|best).*(driver|trips)|driver.*completed.*(most|trips)", _top_drivers),
    (r"on.?trip|currently.*(out|travel|driving)|active.*trip", _on_trip),
    (r"(maintenance|service).*(due|scheduled|pending|soon|overdue)|upcoming.*service", _maintenance_due),
    (r"(risk|predict|breakdown|failure)", _risk_overview),
    (r"(summary|overview|status|how is|report)", _fleet_summary),
]


async def ask_offline(question: str) -> dict[str, Any]:
    q = question.lower()
    for pattern, handler in INTENTS:
        if re.search(pattern, q):
            try:
                answer = await handler()
            except Exception as exc:
                answer = f"I couldn't fetch the data for that: {exc}"
            return {"answer": answer, "toolUsed": "deterministic-router"}

    return {
        "answer": (
            "I can answer questions like:\n"
            "• Which vehicles are currently available?\n"
            "• Which vehicles have the highest maintenance cost?\n"
            "• Show vehicles that haven't been used for 30 days\n"
            "• Which vehicles have poor fuel efficiency?\n"
            "• Which documents will expire next month?\n"
            "• Which drivers completed the most trips?\n"
            "• Which vehicles are at maintenance risk?\n\n"
            "(Set AI_API_KEY to enable full natural-language answers.)"
        ),
        "toolUsed": None,
    }
