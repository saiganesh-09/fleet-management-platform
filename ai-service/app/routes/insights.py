from fastapi import APIRouter, HTTPException

from app.models.schemas import FuelAnomaly, MaintenanceRisk
from app.services import backend_client
from app.services.risk import fuel_anomalies, maintenance_risk

router = APIRouter()


@router.get("/predictive-maintenance/{vehicle_id}", response_model=MaintenanceRisk)
async def predictive_maintenance(vehicle_id: str):
    vehicles = await backend_client.get_vehicles()
    vehicle = next((v for v in vehicles if v["id"] == vehicle_id), None)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    records = await backend_client.get_maintenance(vehicle_id)
    return maintenance_risk(vehicle, records)


@router.get("/fuel-anomalies", response_model=dict)
async def anomalies():
    data = await backend_client.get_fuel()
    return {"anomalies": fuel_anomalies(data)}
