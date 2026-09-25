"""Unit tests for the heuristic analytics — no backend required."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.risk import compute_efficiency, fuel_anomalies, maintenance_risk


def rec(liters, odometer, date="2024-01-01T00:00:00Z"):
    return {"liters": liters, "odometer": odometer, "fuelDate": date}


def test_efficiency_basic():
    avg, recent = compute_efficiency([rec(40, 1000), rec(40, 1400), rec(50, 2000)])
    assert recent == 12
    assert round(avg, 1) == 11


def test_efficiency_empty():
    assert compute_efficiency([]) == (None, None)


def test_maintenance_risk_low():
    vehicle = {"id": "v1", "vehicleNumber": "TS01A1000", "odometer": 10000, "year": 2024}
    result = maintenance_risk(vehicle, [])
    assert result["risk"] == "LOW"
    assert result["score"] < 35


def test_maintenance_risk_high():
    vehicle = {"id": "v1", "vehicleNumber": "TS01A1000", "odometer": 150000, "year": 2015}
    maintenance = [
        {"status": "COMPLETED", "serviceDate": "2025-06-01T00:00:00Z", "nextServiceOdometer": 140000},
        {"status": "COMPLETED", "serviceDate": "2025-07-01T00:00:00Z"},
        {"status": "COMPLETED", "serviceDate": "2025-08-01T00:00:00Z"},
        {"status": "COMPLETED", "serviceDate": "2025-09-01T00:00:00Z"},
        {"status": "SCHEDULED", "serviceDate": "2025-10-01T00:00:00Z"},
    ]
    result = maintenance_risk(vehicle, maintenance)
    assert result["risk"] == "HIGH"
    assert result["score"] >= 65
    assert result["reasons"]


def test_fuel_anomaly_detected():
    payload = {
        "efficiency": [
            {"vehicleId": "v1", "vehicleNumber": "TS01", "avgEfficiency": 12.0, "recentEfficiency": 7.0, "records": 6},
            {"vehicleId": "v2", "vehicleNumber": "TS02", "avgEfficiency": 10.0, "recentEfficiency": 9.8, "records": 5},
        ]
    }
    anomalies = fuel_anomalies(payload)
    assert len(anomalies) == 1
    assert anomalies[0]["vehicleNumber"] == "TS01"
    assert anomalies[0]["deviationPct"] < 0


def test_fuel_anomaly_needs_data():
    payload = {"efficiency": [{"vehicleId": "v1", "vehicleNumber": "TS01", "avgEfficiency": 12.0, "recentEfficiency": 3.0, "records": 1}]}
    assert fuel_anomalies(payload) == []
