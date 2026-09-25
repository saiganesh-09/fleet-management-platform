from fastapi import Depends, FastAPI, Header, HTTPException

from app.config import settings
from app.models.schemas import HealthResponse
from app.routes import assistant, insights

app = FastAPI(
    title="FleetOps AI Service",
    version="1.0.0",
    description="LLM assistant + predictive analytics for the fleet platform",
)


async def internal_auth(x_internal_token: str = Header(default="")):
    """All AI endpoints are only reachable through the backend proxy."""
    if x_internal_token != settings.ai_internal_token:
        raise HTTPException(status_code=401, detail="Invalid internal token")


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        llmConfigured=bool(settings.ai_api_key),
        mode="llm" if settings.ai_api_key else "deterministic",
    )


app.include_router(assistant.router, dependencies=[Depends(internal_auth)])
app.include_router(insights.router, dependencies=[Depends(internal_auth)])
