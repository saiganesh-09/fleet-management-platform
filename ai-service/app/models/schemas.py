from pydantic import BaseModel


class UserContext(BaseModel):
    name: str = ""
    role: str = ""


class AskRequest(BaseModel):
    question: str
    user: UserContext = UserContext()


class AskResponse(BaseModel):
    answer: str
    toolUsed: str | None = None
    data: object | None = None


class MaintenanceRisk(BaseModel):
    vehicleId: str
    vehicleNumber: str | None = None
    risk: str  # LOW | MEDIUM | HIGH
    score: int  # 0-100
    reasons: list[str]
    disclaimer: str = (
        "This is a heuristic estimate based on recorded fleet data "
        "(mileage, age, service history) — not a guarantee of future failures."
    )


class FuelAnomaly(BaseModel):
    vehicleId: str
    vehicleNumber: str
    avgEfficiency: float | None
    recentEfficiency: float | None
    deviationPct: float | None
    message: str


class HealthResponse(BaseModel):
    status: str
    llmConfigured: bool
    mode: str
