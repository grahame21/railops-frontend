import os
import time
from typing import Any, Dict, List, Optional

import requests
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="RailOps Flight API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# CONFIG
# -----------------------------------------------------------------------------
USE_SAMPLE_DATA = os.getenv("USE_SAMPLE_DATA", "true").lower() == "true"

# Optional real upstream settings for later
UPSTREAM_URL = os.getenv("UPSTREAM_URL", "").strip()
UPSTREAM_TOKEN = os.getenv("UPSTREAM_TOKEN", "").strip()
UPSTREAM_TIMEOUT = int(os.getenv("UPSTREAM_TIMEOUT", "20"))

# Simple memory cache
CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL_SECONDS", "15"))
_cache_data: List[Dict[str, Any]] = []
_cache_expiry: float = 0.0


# -----------------------------------------------------------------------------
# SAMPLE DATA
# -----------------------------------------------------------------------------
def get_sample_aircraft() -> List[Dict[str, Any]]:
    return [
        {
            "callsign": "QFA781",
            "hex": "7C6A11",
            "lat": -34.9285,
            "lon": 138.6007,
            "altitude": 35000,
            "speed": 438,
            "heading": 105,
            "registration": "VH-ZND",
            "aircraft_type": "B738",
            "operator": "Qantas",
            "origin": "Adelaide",
            "destination": "Melbourne",
            "category": "airliner",
            "squawk": "1201",
            "source": "sample",
            "last_seen": "now"
        },
        {
            "callsign": "VOZ241",
            "hex": "7C6A12",
            "lat": -37.8136,
            "lon": 144.9631,
            "altitude": 32000,
            "speed": 425,
            "heading": 290,
            "registration": "VH-YIF",
            "aircraft_type": "B738",
            "operator": "Virgin Australia",
            "origin": "Melbourne",
            "destination": "Perth",
            "category": "airliner",
            "squawk": "1337",
            "source": "sample",
            "last_seen": "now"
        },
        {
            "callsign": "JST607",
            "hex": "7C6A13",
            "lat": -33.8688,
            "lon": 151.2093,
            "altitude": 28000,
            "speed": 401,
            "heading": 210,
            "registration": "VH-VGF",
            "aircraft_type": "A320",
            "operator": "Jetstar",
            "origin": "Sydney",
            "destination": "Gold Coast",
            "category": "airliner",
            "squawk": "2107",
            "source": "sample",
            "last_seen": "now"
        },
        {
            "callsign": "RAAF001",
            "hex": "7CF001",
            "lat": -35.3069,
            "lon": 149.195,
            "altitude": 18000,
            "speed": 290,
            "heading": 45,
            "registration": "A41-001",
            "aircraft_type": "C17",
            "operator": "Royal Australian Air Force",
            "origin": "Canberra",
            "destination": "Amberley",
            "category": "military",
            "squawk": "4001",
            "source": "sample",
            "last_seen": "now"
        },
        {
            "callsign": "ASY321",
            "hex": "7CF002",
            "lat": -31.9505,
            "lon": 115.8605,
            "altitude": 9500,
            "speed": 180,
            "heading": 120,
            "registration": "A36-045",
            "aircraft_type": "P8",
            "operator": "Royal Australian Air Force",
            "origin": "Perth",
            "destination": "Unknown",
            "category": "military",
            "squawk": "4002",
            "source": "sample",
            "last_seen": "now"
        }
    ]


# -----------------------------------------------------------------------------
# HELPERS
# -----------------------------------------------------------------------------
def is_military_aircraft(ac: Dict[str, Any]) -> bool:
    category = str(ac.get("category", "")).lower()
    operator = str(ac.get("operator", "")).lower()
    callsign = str(ac.get("callsign", "")).lower()
    aircraft_type = str(ac.get("aircraft_type", "")).lower()

    return (
        "military" in category
        or "air force" in operator
        or "defence" in operator
        or "defense" in operator
        or callsign.startswith("raaf")
        or callsign.startswith("asy")
        or aircraft_type.startswith("c17")
        or aircraft_type.startswith("p8")
        or aircraft_type.startswith("f35")
    )


def normalize_aircraft(raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    lat = raw.get("lat")
    lon = raw.get("lon")

    if lat is None or lon is None:
        return None

    try:
        lat = float(lat)
        lon = float(lon)
    except (ValueError, TypeError):
        return None

    return {
        "callsign": raw.get("callsign") or raw.get("flight") or raw.get("ident") or "",
        "hex": raw.get("hex") or raw.get("icao24") or "",
        "lat": lat,
        "lon": lon,
        "altitude": raw.get("altitude") or raw.get("alt_baro") or raw.get("baro_altitude") or "",
        "speed": raw.get("speed") or raw.get("gs") or raw.get("velocity") or "",
        "heading": raw.get("heading") or raw.get("track") or raw.get("true_track") or 0,
        "registration": raw.get("registration") or raw.get("reg") or "",
        "aircraft_type": raw.get("aircraft_type") or raw.get("type") or raw.get("t") or "",
        "operator": raw.get("operator") or raw.get("airline") or "",
        "origin": raw.get("origin") or "",
        "destination": raw.get("destination") or "",
        "category": raw.get("category") or "",
        "squawk": raw.get("squawk") or "",
        "source": raw.get("source") or "upstream",
        "last_seen": raw.get("last_seen") or raw.get("seen") or ""
    }


def extract_aircraft_from_upstream(payload: Any) -> List[Dict[str, Any]]:
    """
    Accepts a few common JSON shapes and normalizes them.
    """
    items: List[Dict[str, Any]] = []

    if isinstance(payload, list):
        items = payload
    elif isinstance(payload, dict):
        if isinstance(payload.get("aircraft"), list):
            items = payload["aircraft"]
        elif isinstance(payload.get("states"), list):
            # OpenSky-like state vectors: [icao24, callsign, origin_country, time_position, last_contact, lon, lat, ...]
            normalized = []
            for state in payload["states"]:
                if not isinstance(state, list) or len(state) < 11:
                    continue
                normalized.append(
                    {
                        "hex": state[0],
                        "callsign": (state[1] or "").strip(),
                        "lon": state[5],
                        "lat": state[6],
                        "heading": state[10],
                        "speed": state[9],
                        "altitude": state[7],
                        "operator": state[2] if len(state) > 2 else "",
                        "source": "upstream"
                    }
                )
            items = normalized
        else:
            items = []
    else:
        items = []

    result: List[Dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        normalized = normalize_aircraft(item)
        if normalized:
            result.append(normalized)

    return result


def fetch_upstream_aircraft() -> List[Dict[str, Any]]:
    global _cache_data, _cache_expiry

    now = time.time()
    if now < _cache_expiry and _cache_data:
        return _cache_data

    if not UPSTREAM_URL:
        return get_sample_aircraft()

    headers = {}
    if UPSTREAM_TOKEN:
        headers["Authorization"] = f"Bearer {UPSTREAM_TOKEN}"

    resp = requests.get(UPSTREAM_URL, headers=headers, timeout=UPSTREAM_TIMEOUT)
    resp.raise_for_status()

    payload = resp.json()
    aircraft = extract_aircraft_from_upstream(payload)

    _cache_data = aircraft
    _cache_expiry = now + CACHE_TTL_SECONDS
    return aircraft


# -----------------------------------------------------------------------------
# ROUTES
# -----------------------------------------------------------------------------
@app.get("/")
def root() -> Dict[str, Any]:
    return {
        "ok": True,
        "service": "RailOps Flight API",
        "sample_mode": USE_SAMPLE_DATA,
        "endpoints": [
            "/health",
            "/api/aircraft",
            "/api/aircraft?military=1"
        ]
    }


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"ok": True}


@app.get("/api/aircraft")
def api_aircraft(
    military: int = Query(0, description="Set to 1 to return military-only aircraft")
) -> Dict[str, Any]:
    try:
        if USE_SAMPLE_DATA:
            aircraft = get_sample_aircraft()
        else:
            aircraft = fetch_upstream_aircraft()

        if military == 1:
            aircraft = [ac for ac in aircraft if is_military_aircraft(ac)]

        return {
            "ok": True,
            "count": len(aircraft),
            "aircraft": aircraft
        }
    except Exception as e:
        return {
            "ok": False,
            "count": 0,
            "aircraft": [],
            "error": str(e)
        }
