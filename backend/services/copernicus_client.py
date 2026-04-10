import math
import os
import time
from datetime import date as date_type, timedelta
from typing import Optional

import httpx

from config import (
    NDSI_LIGHT_SNOW, NDSI_DENSE_SNOW,
    NDSI_COLOR_LIGHT, NDSI_COLOR_DENSE,
    COPERNICUS_MAX_CACHE_TILES,
)

TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
PROCESS_URL = "https://sh.dataspace.copernicus.eu/api/v1/process"

# NDSI evalscript: blue-tinted overlay where snow is detected
# B03 (Green) and B11 (SWIR) → NDSI = (B03-B11)/(B03+B11)
# Soglie e colori definiti in config.py (NDSI_LIGHT_SNOW, NDSI_DENSE_SNOW, NDSI_COLOR_*)
_lr, _lg, _lb, _la = NDSI_COLOR_LIGHT
_dr, _dg, _db, _da = NDSI_COLOR_DENSE
EVALSCRIPT = f"""
//VERSION=3
function setup() {{
  return {{ input: [{{ bands: ["B03", "B11", "dataMask"] }}], output: {{ bands: 4, sampleType: "UINT8" }} }}
}}
function evaluatePixel(s) {{
  if (!s.dataMask) return [0, 0, 0, 0]
  const ndsi = (s.B03 - s.B11) / (s.B03 + s.B11 + 1e-10)
  if (ndsi < {NDSI_LIGHT_SNOW}) return [0, 0, 0, 0]
  if (ndsi < {NDSI_DENSE_SNOW}) return [{_lr}, {_lg}, {_lb}, {_la}]   // neve leggera
  return [{_dr}, {_dg}, {_db}, {_da}]                                  // neve densa
}}
"""

_token: Optional[str] = None
_token_expiry: float = 0
_tile_cache: dict[tuple, bytes] = {}


async def _get_token() -> str:
    global _token, _token_expiry
    if _token and time.time() < _token_expiry - 30:
        return _token

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(TOKEN_URL, data={
            "grant_type": "client_credentials",
            "client_id": os.getenv("COPERNICUS_CLIENT_ID", ""),
            "client_secret": os.getenv("COPERNICUS_CLIENT_SECRET", ""),
        })
        resp.raise_for_status()
        data = resp.json()

    _token = data["access_token"]
    _token_expiry = time.time() + data.get("expires_in", 600)
    return _token


def _tile_to_bbox_3857(z: int, x: int, y: int) -> list[float]:
    R = 6_378_137.0
    n = 2 ** z
    lon_min = x / n * 360 - 180
    lon_max = (x + 1) / n * 360 - 180
    lat_max = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    lat_min = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n))))
    return [
        math.radians(lon_min) * R,
        math.log(math.tan(math.radians(lat_min) / 2 + math.pi / 4)) * R,
        math.radians(lon_max) * R,
        math.log(math.tan(math.radians(lat_max) / 2 + math.pi / 4)) * R,
    ]


async def fetch_snow_tile(z: int, x: int, y: int, date: str) -> bytes:
    cache_key = (z, x, y, date)
    if cache_key in _tile_cache:
        return _tile_cache[cache_key]

    token = await _get_token()
    bbox = _tile_to_bbox_3857(z, x, y)

    # Look back 5 days to find the most recent cloud-free acquisition
    d = date_type.fromisoformat(date)
    from_date = (d - timedelta(days=5)).isoformat() + "T00:00:00Z"
    to_date = date + "T23:59:59Z"

    payload = {
        "input": {
            "bounds": {
                "bbox": bbox,
                "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/3857"},
            },
            "data": [{
                "type": "sentinel-2-l2a",
                "dataFilter": {
                    "timeRange": {"from": from_date, "to": to_date},
                    "maxCloudCoverage": 30,
                    "mosaickingOrder": "mostRecent",
                },
            }],
        },
        "output": {
            "width": 256,
            "height": 256,
            "responses": [{"identifier": "default", "format": {"type": "image/png"}}],
        },
        "evalscript": EVALSCRIPT,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            PROCESS_URL,
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
        png = resp.content

    if len(_tile_cache) >= COPERNICUS_MAX_CACHE_TILES:
        del _tile_cache[next(iter(_tile_cache))]
    _tile_cache[cache_key] = png
    return png
