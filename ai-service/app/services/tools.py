"""
Tool definitions for the LLM. Each tool maps to ONE curated backend endpoint —
the model can only read pre-approved data, never arbitrary SQL.
"""
from typing import Any

from app.services import backend_client

TOOL_SPECS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "get_vehicles",
            "description": "List all fleet vehicles with status, odometer, type, assigned driver and usage counts",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_drivers",
            "description": "List all drivers with status, license expiry, experience and trip counts",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_trips",
            "description": "List recent trips with status, vehicle, driver, route and times",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_maintenance",
            "description": "List maintenance records, optionally filtered by vehicle id",
            "parameters": {
                "type": "object",
                "properties": {
                    "vehicleId": {"type": "string", "description": "Optional vehicle UUID"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_fuel",
            "description": "Fuel records plus per-vehicle efficiency stats (avg/recent km/L)",
            "parameters": {
                "type": "object",
                "properties": {
                    "vehicleId": {"type": "string", "description": "Optional vehicle UUID"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_documents",
            "description": "Vehicle and driver documents with expiry dates and status (VALID/EXPIRING_SOON/EXPIRED)",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
]


async def execute_tool(name: str, args: dict) -> Any:
    if name == "get_vehicles":
        return await backend_client.get_vehicles()
    if name == "get_drivers":
        return await backend_client.get_drivers()
    if name == "get_trips":
        return await backend_client.get_trips()
    if name == "get_maintenance":
        return await backend_client.get_maintenance(args.get("vehicleId"))
    if name == "get_fuel":
        return await backend_client.get_fuel(args.get("vehicleId"))
    if name == "get_documents":
        return await backend_client.get_documents()
    raise ValueError(f"Unknown tool: {name}")
