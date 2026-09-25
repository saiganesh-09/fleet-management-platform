"""
Controlled access to the main backend.

The AI service NEVER queries the database or runs arbitrary SQL — it calls a
small set of read-only, curated endpoints exposed under /api/ai-data/* on the
Node backend, authenticated with a shared internal token.
"""
import httpx

from app.config import settings


async def _get(path: str, params: dict | None = None):
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(
            f"{settings.backend_url}/api/ai-data{path}",
            params=params,
            headers={"X-Internal-Token": settings.ai_internal_token},
        )
        resp.raise_for_status()
        body = resp.json()
        return body.get("data")


async def get_vehicles():
    return await _get("/vehicles")


async def get_drivers():
    return await _get("/drivers")


async def get_trips():
    return await _get("/trips")


async def get_maintenance(vehicle_id: str | None = None):
    params = {"vehicleId": vehicle_id} if vehicle_id else None
    return await _get("/maintenance", params)


async def get_fuel(vehicle_id: str | None = None):
    params = {"vehicleId": vehicle_id} if vehicle_id else None
    return await _get("/fuel", params)


async def get_documents():
    return await _get("/documents")
