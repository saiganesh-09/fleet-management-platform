"""
Heuristic analytics for the fleet:

- maintenance_risk: rule-based score from vehicle age, mileage, service
  cadence and distance-to-next-service. Transparent reasons, honest disclaimer.
- fuel_anomalies: compares each vehicle's most recent km/L segment against its
  historical average and flags >25% drops.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def _parse_date(v: Any) -> datetime | None:
    if not v:
        return None
    try:
        return datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except ValueError:
        return None


def compute_efficiency(records: list[dict]) -> tuple[float | None, float | None]:
    """km/L per consecutive odometer segment; returns (avg, most-recent)."""
    with_odo = sorted(
        (r for r in records if r.get("odometer") is not None),
        key=lambda r: r["odometer"],
    )
    segments: list[float] = []
    for prev, cur in zip(with_odo, with_odo[1:]):
        dist = cur["odometer"] - prev["odometer"]
        if dist > 0 and cur["liters"] > 0:
            segments.append(dist / cur["liters"])
    if not segments:
        return None, None
    return sum(segments) / len(segments), segments[-1]


def maintenance_risk(vehicle: dict, maintenance: list[dict]) -> dict:
    """Score 0-100 and bucket into LOW/MEDIUM/HIGH with human-readable reasons."""
    reasons: list[str] = []
    score = 0
    now = datetime.now(timezone.utc)

    odometer = vehicle.get("odometer") or 0
    year = vehicle.get("year")
    age = now.year - year if year else None

    # Age
    if age is not None and age >= 6:
        score += 20
        reasons.append(f"Vehicle age is {age} years")
    elif age is not None and age >= 3:
        score += 10
        reasons.append(f"Vehicle age is {age} years")

    # Mileage
    if odometer >= 100_000:
        score += 25
        reasons.append(f"High mileage: {odometer:,.0f} km")
    elif odometer >= 50_000:
        score += 15
        reasons.append(f"Moderate mileage: {odometer:,.0f} km")

    # Recent repair frequency (last 6 months)
    six_months_ago = now.timestamp() - 180 * 86400
    recent = [
        r for r in maintenance
        if (_parse_date(r.get("serviceDate")) or now).timestamp() > six_months_ago
    ]
    if len(recent) >= 4:
        score += 30
        reasons.append(f"{len(recent)} maintenance records in the last 6 months")
    elif len(recent) >= 2:
        score += 15
        reasons.append(f"{len(recent)} maintenance records in the last 6 months")

    # Distance to next service
    completed = [r for r in maintenance if r.get("status") == "COMPLETED" and r.get("nextServiceOdometer")]
    latest = max(completed, key=lambda r: _parse_date(r.get("serviceDate")) or now, default=None)
    if latest:
        remaining = latest["nextServiceOdometer"] - odometer
        if remaining <= 0:
            score += 25
            reasons.append(f"Service overdue by {-remaining:,.0f} km")
        elif remaining <= 2000:
            score += 15
            reasons.append(f"Service due in {remaining:,.0f} km")
        else:
            reasons.append(f"Service due in {remaining:,.0f} km")

    # Open maintenance right now
    open_items = [r for r in maintenance if r.get("status") in ("SCHEDULED", "IN_PROGRESS")]
    if open_items:
        score += 10
        reasons.append(f"{len(open_items)} open maintenance item(s)")

    if not reasons:
        reasons.append("No risk signals detected in recorded data")

    score = min(score, 100)
    risk = "LOW" if score < 35 else "MEDIUM" if score < 65 else "HIGH"

    summary = [
        f"Vehicle has {odometer:,.0f} km",
        f"{len(recent)} maintenance record(s) in the last 6 months",
    ]
    if latest and latest.get("nextServiceOdometer"):
        summary.append(f"Service due in {latest['nextServiceOdometer'] - odometer:,.0f} km")

    return {
        "vehicleId": vehicle.get("id"),
        "vehicleNumber": vehicle.get("vehicleNumber"),
        "risk": risk,
        "score": score,
        "reasons": reasons,
        "summary": summary,
    }


def fuel_anomalies(fuel_payload: dict, threshold: float = 0.75) -> list[dict]:
    """Flag vehicles whose latest efficiency segment is < threshold * their avg."""
    anomalies = []
    for e in fuel_payload.get("efficiency", []):
        avg, recent, records = e.get("avgEfficiency"), e.get("recentEfficiency"), e.get("records", 0)
        if avg is None or recent is None or records < 3:
            continue
        if recent < avg * threshold:
            deviation = round((recent - avg) / avg * 100, 1)
            anomalies.append({
                "vehicleId": e["vehicleId"],
                "vehicleNumber": e["vehicleNumber"],
                "avgEfficiency": round(avg, 2),
                "recentEfficiency": round(recent, 2),
                "deviationPct": deviation,
                "message": (
                    f"{e['vehicleNumber']}: recent efficiency {recent:.1f} km/L "
                    f"is {abs(deviation):.0f}% below its {avg:.1f} km/L average"
                ),
            })
    return anomalies
