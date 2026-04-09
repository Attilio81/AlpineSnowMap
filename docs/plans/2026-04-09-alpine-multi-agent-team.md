# Alpine Multi-Agent Team Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-agent chat with a coordinated Agno team of 4 specialist agents (Terreno, Neve/Meteo, Valanghe, Web) that returns peaks + slope + weather + avalanche bulletin + web reports in one synthesized response.

**Architecture:** Each specialist agent is an `agno.agent.Agent` with dedicated Python async functions as tools; a `Team(mode=coordinate)` leader delegates in parallel and synthesizes. New services (openmeteo, eaws, snow_service, peaks_service) are standalone async modules. The existing single-agent endpoint stays unchanged.

**Tech Stack:** Python 3.11, FastAPI, Agno, DeepSeek API, httpx, Pillow, numpy, ddgs (DuckDuckGo web search)

**Run tests from:** `cd backend && python -m pytest tests/ -v`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `services/peaks_service.py` | CREATE | `get_nearby_peaks(lat, lon, radius_km) -> list` — Overpass query |
| `services/snow_service.py` | CREATE | `get_snow_stats(lat, lon) -> dict` — MODIS + Sentinel-2 pixel analysis |
| `services/openmeteo_client.py` | CREATE | `get_mountain_weather(lat, lon) -> dict` — Open-Meteo API (free, no key) |
| `services/eaws_client.py` | CREATE | `fetch_bulletin(province) -> dict` — avalanche.report + AINEVA fallback |
| `services/agno_team.py` | CREATE | `build_team() -> Team` — 4-agent team factory |
| `mcp_server.py` | MODIFY | Add `get_peaks_with_data` + `get_snow_stats` MCP tools |
| `routes/agent.py` | MODIFY | Add `POST /api/agent/team` endpoint |
| `tests/test_peaks_service.py` | CREATE | Unit tests for peaks_service |
| `tests/test_snow_service.py` | CREATE | Unit tests for snow_service |
| `tests/test_openmeteo_client.py` | CREATE | Unit tests for openmeteo_client |
| `tests/test_eaws_client.py` | CREATE | Unit tests for eaws_client |
| `tests/test_agno_team.py` | CREATE | Unit tests for build_team |
| `tests/test_mcp_server.py` | MODIFY | Update tool count from 5 → 7 |
| `requirements.txt` | MODIFY | Add `ddgs` |

---

## Task 1: peaks_service.py — Extract Overpass logic

Extract `get_nearby_peaks` from `mcp_server.py` into its own service so both the MCP tool and team agents can import it.

**Files:**
- Create: `services/peaks_service.py`
- Create: `tests/test_peaks_service.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_peaks_service.py
from unittest.mock import patch, AsyncMock
import asyncio

def test_get_nearby_peaks_returns_sorted_list():
    mock_response = {
        "elements": [
            {"lat": 45.83, "lon": 7.50, "tags": {"name": "Monte Roisetta", "ele": "3333"}},
            {"lat": 45.84, "lon": 7.52, "tags": {"name": "Becca di Nona", "ele": "3142"}},
        ]
    }
    with patch("services.peaks_service.httpx.AsyncClient") as MockClient:
        mock_post = AsyncMock(return_value=AsyncMock(
            status_code=200,
            json=lambda: mock_response,
            raise_for_status=lambda: None,
        ))
        MockClient.return_value.__aenter__ = AsyncMock(return_value=AsyncMock(post=mock_post))
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        async def run():
            from services.peaks_service import get_nearby_peaks
            result = await get_nearby_peaks(45.826, 7.493, radius_km=10.0)
            assert isinstance(result, list)
            assert len(result) == 2
            assert result[0]["name"] == "Monte Roisetta"
            assert "distance_km" in result[0]
            assert "ele" in result[0]
            # sorted by distance
            assert result[0]["distance_km"] <= result[1]["distance_km"]

        asyncio.run(run())

def test_get_nearby_peaks_filters_by_radius():
    # Peak outside radius should be excluded
    mock_response = {
        "elements": [
            {"lat": 46.1, "lon": 8.0, "tags": {"name": "Far Peak", "ele": "3000"}},  # ~35km away
        ]
    }
    with patch("services.peaks_service.httpx.AsyncClient") as MockClient:
        mock_post = AsyncMock(return_value=AsyncMock(
            status_code=200,
            json=lambda: mock_response,
            raise_for_status=lambda: None,
        ))
        MockClient.return_value.__aenter__ = AsyncMock(return_value=AsyncMock(post=mock_post))
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        async def run():
            from services.peaks_service import get_nearby_peaks
            result = await get_nearby_peaks(45.826, 7.493, radius_km=10.0)
            assert result == []

        asyncio.run(run())
```

- [ ] **Step 2: Run to verify it fails**

```
python -m pytest tests/test_peaks_service.py -v
```
Expected: `ModuleNotFoundError: No module named 'services.peaks_service'`

- [ ] **Step 3: Create services/peaks_service.py**

```python
# services/peaks_service.py
import math
import httpx

OVERPASS_URL = "https://overpass-api.de/api/interpreter"


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def get_nearby_peaks(lat: float, lon: float, radius_km: float = 10.0) -> list:
    """Named alpine peaks within radius_km of (lat, lon).
    Returns list of {name, ele, distance_km, lat, lon} sorted by distance.
    """
    pad = radius_km / 111.0
    query = f"""
[out:json][timeout:15];
node["natural"="peak"]["name"]({lat-pad},{lon-pad},{lat+pad},{lon+pad});
out body;
"""
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(OVERPASS_URL, data={"data": query})
        resp.raise_for_status()
        data = resp.json()

    peaks = []
    for el in data.get("elements", []):
        tags = el.get("tags", {})
        name = tags.get("name") or tags.get("name:it") or tags.get("name:de")
        if not name:
            continue
        dist = _haversine_km(lat, lon, el["lat"], el["lon"])
        if dist <= radius_km:
            peaks.append({
                "name": name,
                "ele": int(float(tags["ele"])) if tags.get("ele") else None,
                "distance_km": round(dist, 2),
                "lat": el["lat"],
                "lon": el["lon"],
            })
    return sorted(peaks, key=lambda p: p["distance_km"])
```

- [ ] **Step 4: Run tests to verify they pass**

```
python -m pytest tests/test_peaks_service.py -v
```
Expected: 2 passed

- [ ] **Step 5: Update mcp_server.py to import from peaks_service**

In `mcp_server.py`, replace the inline `get_nearby_peaks` implementation:

Remove lines 88–121 (the `@mcp.tool() async def get_nearby_peaks(...)` block with its inline httpx logic) and replace with:

```python
from services.peaks_service import get_nearby_peaks as _get_nearby_peaks

@mcp.tool()
async def get_nearby_peaks(lat: float, lon: float, radius_km: float = 10.0) -> list:
    """Cime alpine vicine a una coordinata. Ritorna lista {name, ele, distance_km}."""
    try:
        return await _get_nearby_peaks(lat, lon, radius_km)
    except Exception as e:
        return [{"error": str(e)}]
```

- [ ] **Step 6: Verify all existing tests still pass**

```
python -m pytest tests/ -v
```
Expected: 8 passed

- [ ] **Step 7: Commit**

```bash
git add services/peaks_service.py tests/test_peaks_service.py mcp_server.py
git commit -m "feat: extract peaks_service from mcp_server"
```

---

## Task 2: snow_service.py — MODIS + Sentinel-2 pixel analysis

New service that reads tile PNGs and classifies snow coverage quantitatively.

**Files:**
- Create: `services/snow_service.py`
- Create: `tests/test_snow_service.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_snow_service.py
import io
from unittest.mock import patch, AsyncMock
import asyncio
from PIL import Image
import numpy as np


def _make_png(r, g, b, a=255) -> bytes:
    """Create a 256x256 solid-color PNG."""
    arr = np.full((256, 256, 4), [r, g, b, a], dtype=np.uint8)
    img = Image.fromarray(arr, "RGBA")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_classify_modis_snow():
    from services.snow_service import _classify_modis_pixel
    # Bright bluish-white = snow
    assert _classify_modis_pixel(230, 240, 255, 255) == "snow"

def test_classify_modis_cloud():
    from services.snow_service import _classify_modis_pixel
    # Medium gray = cloud
    assert _classify_modis_pixel(190, 192, 188, 255) == "cloud"

def test_classify_modis_no_snow():
    from services.snow_service import _classify_modis_pixel
    # Dark = no snow
    assert _classify_modis_pixel(40, 50, 45, 255) == "no_snow"

def test_classify_modis_transparent():
    from services.snow_service import _classify_modis_pixel
    assert _classify_modis_pixel(0, 0, 0, 0) == "no_data"


def test_sentinel_snow_coverage_dense():
    """Dense snow tile (all pixels [38,140,255]) → 100% coverage."""
    from services.snow_service import _analyze_sentinel_png
    png = _make_png(38, 140, 255, 255)
    result = _analyze_sentinel_png(png)
    assert result["snow_coverage_pct"] == 100.0
    assert result["ndsi_class"] == "densa"

def test_sentinel_snow_coverage_none():
    """Fully transparent tile → 0% coverage."""
    from services.snow_service import _analyze_sentinel_png
    png = _make_png(0, 0, 0, 0)
    result = _analyze_sentinel_png(png)
    assert result["snow_coverage_pct"] == 0.0
    assert result["ndsi_class"] == "assente"
```

- [ ] **Step 2: Run to verify they fail**

```
python -m pytest tests/test_snow_service.py -v
```
Expected: `ModuleNotFoundError: No module named 'services.snow_service'`

- [ ] **Step 3: Create services/snow_service.py**

```python
# services/snow_service.py
import io
import math
from datetime import date, timedelta

import httpx
import numpy as np
from PIL import Image

from services.slope_service import lat_lon_to_tile

GIBS_BASE = (
    "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/"
    "MODIS_Terra_NDSI_Snow_Cover/default"
)
GIBS_MATRIX = "GoogleMapsCompatible_Level8"
MODIS_ZOOM = 8
SENTINEL_ZOOM = 12


def _classify_modis_pixel(r: int, g: int, b: int, a: int) -> str:
    """Classify a MODIS NDSI Snow Cover tile pixel.
    
    GIBS color palette approximation:
    - Snow: bright pixels with blue component (cyan-white range)
    - Cloud: medium gray (channels roughly equal, 150-230)
    - No snow: dark pixels
    - Note: thresholds may need empirical tuning if classification is inaccurate.
    """
    if a == 0:
        return "no_data"
    luminosity = (int(r) + int(g) + int(b)) / 3
    is_gray = abs(int(r) - int(g)) < 25 and abs(int(g) - int(b)) < 25
    if 140 <= luminosity <= 225 and is_gray:
        return "cloud"
    if luminosity > 170 and int(b) >= int(r) * 0.75:
        return "snow"
    return "no_snow"


def _coord_to_pixel(lat: float, lon: float, z: int, tile_x: int, tile_y: int) -> tuple[int, int]:
    """Convert (lat, lon) to pixel (px, py) within a 256x256 tile."""
    n = 2 ** z
    fx = (lon + 180) / 360 * n - tile_x
    lat_rad = math.radians(lat)
    fy = (1 - math.log(math.tan(lat_rad) + 1 / math.cos(lat_rad)) / math.pi) / 2 * n - tile_y
    px = max(0, min(255, int(fx * 256)))
    py = max(0, min(255, int(fy * 256)))
    return px, py


def _analyze_sentinel_png(png_bytes: bytes) -> dict:
    """Count snow pixels in a Sentinel-2 NDSI tile PNG.
    
    Colors from copernicus_client.py evalscript:
    - [38, 140, 255] → neve densa (NDSI > 0.4)
    - [153, 217, 255] → neve leggera (NDSI 0.2–0.4)
    - transparent (A=0) → no data (not counted)
    """
    arr = np.array(Image.open(io.BytesIO(png_bytes)).convert("RGBA"), dtype=np.uint8)
    no_data = arr[:, :, 3] == 0
    total_valid = int(arr.shape[0] * arr.shape[1]) - int(np.sum(no_data))
    if total_valid == 0:
        return {"snow_coverage_pct": 0.0, "dense_snow_pct": 0.0,
                "light_snow_pct": 0.0, "ndsi_class": "assente"}

    dense = (arr[:, :, 0] == 38) & (arr[:, :, 1] == 140) & (arr[:, :, 2] == 255)
    light = (arr[:, :, 0] == 153) & (arr[:, :, 1] == 217) & (arr[:, :, 2] == 255)
    dense_pct = round(float(np.sum(dense)) / total_valid * 100, 1)
    light_pct = round(float(np.sum(light)) / total_valid * 100, 1)
    snow_pct = round(dense_pct + light_pct, 1)

    if dense_pct >= light_pct and dense_pct > 0:
        ndsi_class = "densa"
    elif light_pct > 0:
        ndsi_class = "leggera"
    else:
        ndsi_class = "assente"

    return {
        "snow_coverage_pct": snow_pct,
        "dense_snow_pct": dense_pct,
        "light_snow_pct": light_pct,
        "ndsi_class": ndsi_class,
    }


async def _get_modis_snow(lat: float, lon: float) -> dict:
    """Fetch today's MODIS tile (tries last 3 days) and classify the pixel at (lat, lon)."""
    z = MODIS_ZOOM
    x, y = lat_lon_to_tile(lat, lon, z)
    for days_ago in range(1, 4):  # MODIS typically 1 day delayed
        d = date.today() - timedelta(days=days_ago)
        date_str = d.isoformat()
        url = f"{GIBS_BASE}/{date_str}/{GIBS_MATRIX}/{z}/{y}/{x}.png"
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(url)
            if resp.status_code != 200:
                continue
            px, py = _coord_to_pixel(lat, lon, z, x, y)
            img = Image.open(io.BytesIO(resp.content)).convert("RGBA")
            r, g, b, a = img.getpixel((px, py))
            classification = _classify_modis_pixel(r, g, b, a)
            if classification == "no_data":
                continue
            return {
                "classification": classification,
                "date": date_str,
                "resolution_m": 500,
                "source": "NASA GIBS MODIS Terra",
            }
        except Exception:
            continue
    return {"classification": "unavailable", "date": None, "resolution_m": 500,
            "source": "NASA GIBS MODIS Terra"}


async def _get_sentinel_snow(lat: float, lon: float) -> dict:
    """Fetch Sentinel-2 tile (tries last 7 days) and compute snow coverage %."""
    from services.copernicus_client import fetch_snow_tile
    z = SENTINEL_ZOOM
    x, y = lat_lon_to_tile(lat, lon, z)
    for days_ago in range(7):
        d = date.today() - timedelta(days=days_ago)
        try:
            png_bytes = await fetch_snow_tile(z, x, y, d.isoformat())
            result = _analyze_sentinel_png(png_bytes)
            result["date"] = d.isoformat()
            result["resolution_m"] = 10
            result["source"] = "Sentinel-2 L2A Copernicus"
            return result
        except Exception:
            continue
    return {"snow_coverage_pct": None, "ndsi_class": "unavailable",
            "date": None, "resolution_m": 10, "source": "Sentinel-2 L2A Copernicus"}


async def get_snow_stats(lat: float, lon: float) -> dict:
    """Snow coverage from MODIS (daily 500m) and Sentinel-2 (10m, ~5-day revisit).
    
    Returns:
        {
          "modis": {"classification": "snow"|"cloud"|"no_snow"|"unavailable", "date": str},
          "sentinel2": {"snow_coverage_pct": float, "ndsi_class": str, "date": str}
        }
    """
    import asyncio
    modis, sentinel = await asyncio.gather(
        _get_modis_snow(lat, lon),
        _get_sentinel_snow(lat, lon),
    )
    return {"modis": modis, "sentinel2": sentinel}
```

- [ ] **Step 4: Run tests to verify they pass**

```
python -m pytest tests/test_snow_service.py -v
```
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add services/snow_service.py tests/test_snow_service.py
git commit -m "feat: add snow_service with MODIS + Sentinel-2 pixel analysis"
```

---

## Task 3: openmeteo_client.py — Free mountain weather

**Files:**
- Create: `services/openmeteo_client.py`
- Create: `tests/test_openmeteo_client.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_openmeteo_client.py
from unittest.mock import patch, AsyncMock
import asyncio


def _mock_openmeteo_response(temp=2.5, wind=18.0, snowfall=5.0, freeze=2800.0):
    """Build a minimal Open-Meteo API response."""
    times = [f"2026-04-09T{h:02d}:00" for h in range(24)]
    return {
        "hourly": {
            "time": times,
            "temperature_2m": [temp] * 24,
            "windspeed_10m": [wind] * 24,
            "snowfall": [snowfall / 48] * 24,  # spread over 48 hours
            "freezinglevel_height": [freeze] * 24,
        }
    }


def test_get_mountain_weather_returns_expected_fields():
    with patch("services.openmeteo_client.httpx.AsyncClient") as MockClient:
        mock_get = AsyncMock(return_value=AsyncMock(
            status_code=200,
            json=lambda: _mock_openmeteo_response(),
            raise_for_status=lambda: None,
        ))
        MockClient.return_value.__aenter__ = AsyncMock(return_value=AsyncMock(get=mock_get))
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        async def run():
            from services.openmeteo_client import get_mountain_weather
            result = await get_mountain_weather(45.826, 7.493)
            assert "temperature_2m_c" in result
            assert "windspeed_kmh" in result
            assert "freezinglevel_m" in result
            assert "snowfall_48h_cm" in result
            assert result["source"] == "Open-Meteo"
            assert isinstance(result["temperature_2m_c"], float)
            assert isinstance(result["snowfall_48h_cm"], float)

        asyncio.run(run())
```

- [ ] **Step 2: Run to verify it fails**

```
python -m pytest tests/test_openmeteo_client.py -v
```
Expected: `ModuleNotFoundError: No module named 'services.openmeteo_client'`

- [ ] **Step 3: Create services/openmeteo_client.py**

```python
# services/openmeteo_client.py
from datetime import datetime, timezone, timedelta

import httpx

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


async def get_mountain_weather(lat: float, lon: float) -> dict:
    """Current mountain weather from Open-Meteo (free, no API key required).

    Returns temperature (°C), wind speed (km/h), freezing level (m asl),
    and total snowfall over the last 48 hours (cm).
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "temperature_2m,snowfall,windspeed_10m,freezinglevel_height",
        "past_days": 2,
        "forecast_days": 1,
        "models": "best_match",
        "timezone": "Europe/Rome",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(OPEN_METEO_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

    hourly = data["hourly"]
    times = hourly["time"]

    # Find the index closest to current hour (CET = UTC+1 in winter, UTC+2 in summer)
    now_str = datetime.now(tz=timezone(timedelta(hours=2))).strftime("%Y-%m-%dT%H:00")
    idx = times.index(now_str) if now_str in times else max(0, len(times) // 2)

    snowfall_48h = sum(hourly["snowfall"][max(0, idx - 48): idx + 1])

    return {
        "temperature_2m_c": float(hourly["temperature_2m"][idx]),
        "windspeed_kmh": float(hourly["windspeed_10m"][idx]),
        "freezinglevel_m": float(hourly["freezinglevel_height"][idx]),
        "snowfall_48h_cm": round(float(snowfall_48h), 1),
        "source": "Open-Meteo",
        "timestamp": now_str,
    }
```

- [ ] **Step 4: Run tests**

```
python -m pytest tests/test_openmeteo_client.py -v
```
Expected: 1 passed

- [ ] **Step 5: Commit**

```bash
git add services/openmeteo_client.py tests/test_openmeteo_client.py
git commit -m "feat: add openmeteo_client for free mountain weather"
```

---

## Task 4: eaws_client.py — Avalanche bulletin with AINEVA fix

Fix the AINEVA HTML-acceptance bug and add avalanche.report (EAWS) as primary source for supported regions.

**Files:**
- Create: `services/eaws_client.py`
- Create: `tests/test_eaws_client.py`
- Modify: `services/aineva_client.py` (fix content-type check)

- [ ] **Step 1: Fix AINEVA content-type bug first**

In `services/aineva_client.py`, line 109, the current check accepts `text/html`:
```python
# WRONG: "text" matches "text/html"
if "xml" not in content_type and "text" not in content_type:
```

Replace with:
```python
# CORRECT: only accept actual XML
if "xml" not in content_type:
    raise RuntimeError(
        f"AINEVA ha restituito content-type imprevisto: {content_type!r}. "
        f"Probabilmente sta servendo una pagina HTML — controlla bollettini.aineva.it"
    )
```

- [ ] **Step 2: Write the failing tests**

```python
# tests/test_eaws_client.py
from unittest.mock import patch, AsyncMock
import asyncio


def test_fetch_bulletin_returns_available_structure():
    mock_data = [
        {
            "dangerRatings": [{"mainValue": {"numeric": 2}}],
            "avalancheProblems": [{"problemType": "wind_slab"}],
            "highlights": "Pericolo limitato",
            "validTime": {"startTime": "2026-04-09T00:00:00+00:00"},
        }
    ]
    with patch("services.eaws_client.httpx.AsyncClient") as MockClient:
        mock_get = AsyncMock(return_value=AsyncMock(
            status_code=200,
            json=lambda: mock_data,
            raise_for_status=lambda: None,
        ))
        MockClient.return_value.__aenter__ = AsyncMock(return_value=AsyncMock(get=mock_get))
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        async def run():
            from services.eaws_client import fetch_bulletin
            result = await fetch_bulletin("IT-32-BZ")
            assert result["available"] is True
            assert "bulletins" in result
            assert "maxDanger" in result

        asyncio.run(run())


def test_fetch_bulletin_returns_unavailable_on_error():
    with patch("services.eaws_client.httpx.AsyncClient") as MockClient:
        mock_get = AsyncMock(side_effect=Exception("connection refused"))
        MockClient.return_value.__aenter__ = AsyncMock(return_value=AsyncMock(get=mock_get))
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        async def run():
            from services.eaws_client import fetch_bulletin
            result = await fetch_bulletin("IT-32-BZ")
            assert result["available"] is False
            assert "message" in result

        asyncio.run(run())
```

- [ ] **Step 3: Run to verify they fail**

```
python -m pytest tests/test_eaws_client.py -v
```
Expected: `ModuleNotFoundError: No module named 'services.eaws_client'`

- [ ] **Step 4: Create services/eaws_client.py**

```python
# services/eaws_client.py
"""EAWS avalanche bulletin client.

Uses avalanche.report API (EAWS standard GeoJSON) for supported provinces.
Province support:
  - IT-32-BZ (South Tyrol): avalanche.report
  - IT-32-TN (Trentino): avalanche.report
  - All others: falls back to AINEVA (aineva_client)
"""
import time
import httpx

AVALANCHE_REPORT_URL = "https://avalanche.report/api/public/bulletins"
CACHE_TTL = 6 * 3600
_cache: dict[str, tuple[float, dict]] = {}

# Provinces served by avalanche.report (EAWS standard)
AVALANCHE_REPORT_PROVINCES = {"IT-32-BZ", "IT-32-TN"}


def _extract_max_danger(bulletins: list) -> int:
    max_val = 0
    for b in bulletins:
        for dr in b.get("dangerRatings", []):
            val = dr.get("mainValue", {})
            numeric = val.get("numeric", 0) if isinstance(val, dict) else 0
            max_val = max(max_val, int(numeric))
    return max_val


async def _fetch_avalanche_report(province: str) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            AVALANCHE_REPORT_URL,
            params={"lang": "it", "region": province},
            headers={"User-Agent": "AlpineSnowMap/1.0"},
        )
        resp.raise_for_status()
        bulletins = resp.json()
    return {
        "available": True,
        "bulletins": bulletins,
        "maxDanger": _extract_max_danger(bulletins),
        "source": "avalanche.report (EAWS)",
    }


async def fetch_bulletin(province: str) -> dict:
    """Fetch avalanche bulletin for an Italian alpine province.

    Tries avalanche.report for IT-32-BZ / IT-32-TN, AINEVA for all others.
    Returns {"available": bool, "bulletins": list, "maxDanger": int, "source": str}.
    """
    now = time.time()
    if province in _cache:
        ts, data = _cache[province]
        if now - ts < CACHE_TTL:
            return data

    try:
        if province in AVALANCHE_REPORT_PROVINCES:
            data = await _fetch_avalanche_report(province)
        else:
            from services.aineva_client import fetch_bulletin as _aineva
            aineva_data = await _aineva(province)
            data = {**aineva_data, "source": "AINEVA"}
        _cache[province] = (now, data)
        return data
    except Exception as e:
        return {
            "available": False,
            "message": str(e),
            "source": "unavailable",
        }
```

- [ ] **Step 5: Run tests**

```
python -m pytest tests/test_eaws_client.py -v
```
Expected: 2 passed

- [ ] **Step 6: Run full test suite**

```
python -m pytest tests/ -v
```
Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add services/eaws_client.py tests/test_eaws_client.py services/aineva_client.py
git commit -m "feat: add eaws_client; fix AINEVA HTML content-type bug"
```

---

## Task 5: mcp_server.py — Add get_peaks_with_data and get_snow_stats tools

Two new MCP tools that combine service calls into single agent-callable actions.

**Files:**
- Modify: `mcp_server.py`
- Modify: `tests/test_mcp_server.py`

- [ ] **Step 1: Update test_mcp_server.py first (TDD)**

Replace the content of `tests/test_mcp_server.py`:

```python
from mcp_server import mcp

def test_mcp_has_seven_tools():
    tool_names = [t.name for t in mcp._tool_manager.list_tools()]
    assert "get_avalanche_bulletin" in tool_names
    assert "get_snow_coverage" in tool_names
    assert "get_slope_data" in tool_names
    assert "get_nearby_peaks" in tool_names
    assert "analyze_route_risk" in tool_names
    assert "get_peaks_with_data" in tool_names
    assert "get_snow_stats" in tool_names
    assert len(tool_names) == 7
```

- [ ] **Step 2: Run to verify it fails**

```
python -m pytest tests/test_mcp_server.py -v
```
Expected: `AssertionError` — tool count is 5, not 7

- [ ] **Step 3: Add the two new tools to mcp_server.py**

Add these two tool definitions after the existing `get_nearby_peaks` tool (around line 122):

```python
@mcp.tool()
async def get_peaks_with_data(lat: float, lon: float, radius_km: float = 10.0) -> list:
    """Cime alpine vicine con pendenza DEM per ognuna. radius_km configurabile (default 10).
    
    Ritorna lista di {name, ele, distance_km, avg_slope_deg, max_slope_deg, ski_suitable}.
    ski_suitable = True se avg_slope_deg è tra 25 e 35° (ottimale per scialpinismo).
    Deduplicazione tile: più cime nello stesso tile Terrarium condividono la stessa chiamata DEM.
    """
    from services.peaks_service import get_nearby_peaks as _get_peaks
    try:
        peaks = await _get_peaks(lat, lon, radius_km)
    except Exception as e:
        return [{"error": str(e)}]

    # Deduplicate tile fetches: cache slope per (tile_x, tile_y)
    from services.slope_service import lat_lon_to_tile, get_slope_stats
    tile_cache: dict[tuple, dict] = {}
    result = []
    for peak in peaks:
        tx, ty = lat_lon_to_tile(peak["lat"], peak["lon"], 12)
        if (tx, ty) not in tile_cache:
            try:
                tile_cache[(tx, ty)] = await get_slope_stats(peak["lat"], peak["lon"])
            except Exception:
                tile_cache[(tx, ty)] = {"avg_slope_deg": None, "max_slope_deg": None}
        slope = tile_cache[(tx, ty)]
        avg = slope.get("avg_slope_deg")
        result.append({
            **peak,
            "avg_slope_deg": avg,
            "max_slope_deg": slope.get("max_slope_deg"),
            "ski_suitable": (25.0 <= avg <= 35.0) if avg is not None else None,
        })
    return result


@mcp.tool()
async def get_snow_stats(lat: float, lon: float) -> dict:
    """Copertura neve da MODIS (giornaliero 500m) e Sentinel-2 (10m, revisita ~5 giorni).
    
    MODIS: classificazione snow/cloud/no_snow per oggi.
    Sentinel-2: percentuale area coperta da neve (densa + leggera) con data acquisizione.
    """
    from services.snow_service import get_snow_stats as _get_snow
    try:
        return await _get_snow(lat, lon)
    except Exception as e:
        return {"error": str(e)}
```

Also add the import at the top of `mcp_server.py` (after existing imports):
```python
from services.peaks_service import get_nearby_peaks as _get_nearby_peaks
```
And update the existing `get_nearby_peaks` MCP tool to use it (already done in Task 1 Step 5).

- [ ] **Step 4: Run tests**

```
python -m pytest tests/test_mcp_server.py tests/test_peaks_service.py -v
```
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add mcp_server.py tests/test_mcp_server.py
git commit -m "feat: add get_peaks_with_data and get_snow_stats MCP tools"
```

---

## Task 6: agno_team.py — 4-agent team factory

**Files:**
- Create: `services/agno_team.py`
- Create: `tests/test_agno_team.py`

- [ ] **Step 1: Add ddgs to requirements.txt**

```
ddgs
```
(Add as last line of `requirements.txt`)

Install it:
```bash
pip install ddgs
```

- [ ] **Step 2: Write the failing test**

```python
# tests/test_agno_team.py
import asyncio
from unittest.mock import patch, MagicMock


def test_build_team_returns_team_with_four_members():
    from agno.team.team import Team
    from services.agno_team import build_team
    team = build_team()
    assert isinstance(team, Team)
    assert len(team.members) == 4


def test_team_member_names():
    from services.agno_team import build_team
    team = build_team()
    names = [m.name for m in team.members]
    assert "Agente Terreno" in names
    assert "Agente Neve/Meteo" in names
    assert "Agente Valanghe" in names
    assert "Agente Web" in names
```

- [ ] **Step 3: Run to verify they fail**

```
python -m pytest tests/test_agno_team.py -v
```
Expected: `ModuleNotFoundError: No module named 'services.agno_team'`

- [ ] **Step 4: Create services/agno_team.py**

```python
# services/agno_team.py
"""Agno multi-agent team factory.

Usage:
    team = build_team()
    response = await team.arun("Quali cime sono adatte a Torgnon oggi?")
    return response.content
"""
import os

from agno.agent import Agent
from agno.models.deepseek import DeepSeek
from agno.team.team import Team
from agno.team.mode import TeamMode
from agno.tools.websearch import WebSearchTools

from services.peaks_service import get_nearby_peaks
from services.slope_service import get_slope_stats
from services.snow_service import get_snow_stats
from services.openmeteo_client import get_mountain_weather
from services.eaws_client import fetch_bulletin as fetch_eaws_bulletin
from services.aineva_client import fetch_bulletin as fetch_aineva_bulletin


def _model() -> DeepSeek:
    model_id = os.getenv("AGENT_MODEL_ID", "deepseek-chat")
    return DeepSeek(id=model_id)


def build_team() -> Team:
    """Build the 4-agent Alpine Team. Returns a ready-to-run Agno Team."""

    agente_terreno = Agent(
        name="Agente Terreno",
        role="Analizza cime vicine e pendenza per scialpinismo",
        model=_model(),
        tools=[get_nearby_peaks, get_slope_stats],
        instructions="""Sei specializzato in terreno alpino.
Quando ricevi coordinate:
1. Chiama get_nearby_peaks(lat, lon, radius_km) con il raggio richiesto (default 10 km)
2. Per le prime 5 cime più vicine, chiama get_slope_stats(peak_lat, peak_lon)
3. Presenta i risultati in una tabella markdown:
   | Cima | Quota | Distanza | Pend. media | Pend. max | Sci-alp |
   Marca sci_suitable = ✓ se avg_slope_deg è tra 25° e 35°, — altrimenti.
4. Non inventare dati: se get_nearby_peaks fallisce, dilo esplicitamente.""",
        markdown=True,
    )

    agente_neve_meteo = Agent(
        name="Agente Neve/Meteo",
        role="Meteo in quota e copertura neve da satellite",
        model=_model(),
        tools=[get_mountain_weather, get_snow_stats],
        instructions="""Sei specializzato in meteo e neve alpina.
Quando ricevi coordinate:
1. Chiama get_mountain_weather(lat, lon) per temperatura, vento, zero termico, neve fresca
2. Chiama get_snow_stats(lat, lon) per copertura neve MODIS (oggi) e Sentinel-2 (recente)
3. Riporta:
   - Zero termico (m), vento (km/h), neve fresca ultimi 2 giorni (cm)
   - Copertura neve MODIS: "neve presente" / "assente" / "nuvole" con data
   - Copertura neve Sentinel-2: percentuale, qualità (densa/leggera), data acquisizione
4. Segnala condizioni pericolose: vento > 50 km/h, riscaldamento rapido (temp > 5°C e zero > 3000m)
5. Se un dato è unavailable, dillo senza inventare valori.""",
        markdown=True,
    )

    agente_valanghe = Agent(
        name="Agente Valanghe",
        role="Bollettino valanghe ufficiale",
        model=_model(),
        tools=[fetch_eaws_bulletin, fetch_aineva_bulletin],
        instructions="""Sei specializzato in valanghe e sicurezza alpina.
Quando ricevi una provincia (es. IT-23 = Valle d'Aosta):
1. Chiama fetch_eaws_bulletin(province) — usa EAWS/avalanche.report per IT-32-BZ e IT-32-TN, AINEVA per gli altri
2. Se available=false, prova fetch_aineva_bulletin(province) come fallback
3. Se entrambi falliscono, dì esplicitamente "bollettino non disponibile" e suggerisci aineva.it
4. MAI inventare pericoli o condizioni non presenti nei dati.
Riporta: livello di pericolo, problemi valanghivi, esposizioni e quote critiche.""",
        markdown=True,
    )

    agente_web = Agent(
        name="Agente Web",
        role="Notizie recenti e relazioni di gita",
        model=_model(),
        tools=[WebSearchTools(timelimit="w", backend="auto", fixed_max_results=5)],
        instructions="""Sei specializzato nella ricerca di informazioni recenti online.
Per la zona richiesta:
1. Cerca "[nome zona] condizioni neve scialpinismo" (ultimi 7 giorni)
2. Cerca "[nome zona] valanghe aggiornamento"
3. Restituisci 2-3 risultati rilevanti con: titolo, URL, sommario di una riga
4. Preferisci fonti alpinistiche italiane: cai.it, planetmountain.com, neveitalia.it, gognablog.com
5. Se non trovi nulla di recente, dilo chiaramente.""",
        markdown=True,
    )

    coordinator = Team(
        name="Alpine Expert Team",
        mode=TeamMode.coordinate,
        model=_model(),
        members=[agente_terreno, agente_neve_meteo, agente_valanghe, agente_web],
        instructions="""Sei il coordinatore dell'Alpine Expert Team.
Ricevi domande su condizioni per scialpinismo e le deleghi ai tuoi 4 specialisti.

Processo:
1. Delega in parallelo a tutti e 4 gli agenti
2. Sintetizza le risposte in questo formato markdown:

## Cime vicine [raggio] km da [coordinate o zona]
[tabella da Agente Terreno]

## Neve e Meteo
[dati da Agente Neve/Meteo]

## Bollettino Valanghe — [provincia]
[dati da Agente Valanghe]

## Notizie Recenti
[links da Agente Web]

## Verdetto
[1-3 frasi: è sicuro uscire oggi? quali cime consigliare? a che ora partire?]

Regola fondamentale: se un agente dice "dati non disponibili", riportalo fedelmente — non completare con dati inventati.""",
        markdown=True,
    )

    return coordinator
```

- [ ] **Step 5: Run tests**

```
python -m pytest tests/test_agno_team.py -v
```
Expected: 2 passed

- [ ] **Step 6: Run full test suite**

```
python -m pytest tests/ -v
```
Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add services/agno_team.py tests/test_agno_team.py requirements.txt
git commit -m "feat: add 4-agent Alpine Team with terrain, snow, avalanche, web specialists"
```

---

## Task 7: routes/agent.py — POST /api/agent/team endpoint

**Files:**
- Modify: `routes/agent.py`
- Modify: `tests/test_agent_routes.py`

- [ ] **Step 1: Write the failing test**

Add to `tests/test_agent_routes.py`:

```python
# Add this import at the top if not already present:
# from unittest.mock import patch, AsyncMock, MagicMock

def test_team_endpoint_returns_response():
    from unittest.mock import patch, AsyncMock, MagicMock
    import os
    os.environ["DEEPSEEK_API_KEY"] = "test-key"

    mock_team = MagicMock()
    mock_response = MagicMock()
    mock_response.content = "## Cime vicine\n| Monte Roisetta | 3333 m | ✓ |"
    mock_team.arun = AsyncMock(return_value=mock_response)

    with patch("routes.agent.build_team", return_value=mock_team):
        from fastapi.testclient import TestClient
        from main import app
        client = TestClient(app)
        resp = client.post(
            "/api/agent/team",
            json={"message": "Cime adatte a Torgnon?", "province": "IT-23"},
        )
        assert resp.status_code == 200
        assert "response" in resp.json()
        assert len(resp.json()["response"]) > 0


def test_team_endpoint_returns_503_without_api_key():
    import os
    os.environ.pop("DEEPSEEK_API_KEY", None)
    from fastapi.testclient import TestClient
    from main import app
    client = TestClient(app)
    resp = client.post(
        "/api/agent/team",
        json={"message": "test", "province": "IT-23"},
    )
    assert resp.status_code == 503
```

- [ ] **Step 2: Run to verify they fail**

```
python -m pytest tests/test_agent_routes.py::test_team_endpoint_returns_response tests/test_agent_routes.py::test_team_endpoint_returns_503_without_api_key -v
```
Expected: FAIL — endpoint doesn't exist yet

- [ ] **Step 3: Add the team endpoint to routes/agent.py**

Add after the existing imports at the top of `routes/agent.py`:
```python
from services.agno_team import build_team
```

Add this new model and endpoint after the existing `analyze_route` endpoint:

```python
class TeamQueryRequest(BaseModel):
    message: str
    province: str = "IT-23"


@router.post("/team")
async def query_team(req: TeamQueryRequest):
    """Multi-agent team query: terrain + snow/weather + avalanche + web search.
    Returns: {"response": str}
    """
    if not os.getenv("DEEPSEEK_API_KEY"):
        raise HTTPException(status_code=503, detail="DEEPSEEK_API_KEY not configured")

    team = build_team()
    full_message = f"{req.message}\nProvincia valanghe: {req.province}"
    try:
        response = await team.arun(full_message)
        return {"response": response.content}
    except Exception as e:
        logger.error("Team query failed: %s", e)
        raise HTTPException(status_code=503, detail="Team temporaneamente non disponibile")
```

- [ ] **Step 4: Run tests**

```
python -m pytest tests/test_agent_routes.py -v
```
Expected: all pass (including the 2 new tests)

- [ ] **Step 5: Run full test suite**

```
python -m pytest tests/ -v
```
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add routes/agent.py tests/test_agent_routes.py
git commit -m "feat: add POST /api/agent/team endpoint"
```

---

## Task 8: Update single-agent system prompt

The existing single-agent at `/api/agent/query` should know about the new `get_peaks_with_data` and `get_snow_stats` MCP tools.

**Files:**
- Modify: `services/agno_agent.py`

- [ ] **Step 1: Update SYSTEM_PROMPT in agno_agent.py**

Replace the `Focus principale` section of `SYSTEM_PROMPT`:

```python
SYSTEM_PROMPT = """Sei un assistente esperto di condizioni alpine italiane.
Rispondi sempre in italiano. Usa i tool disponibili per recuperare dati aggiornati
su neve, valanghe e pendenza prima di rispondere.

REGOLA FONDAMENTALE — Non inventare mai dati:
- Se un tool restituisce {"available": false} o un errore, dì chiaramente
  "dati non disponibili" e non inventare valori alternativi.
- Se il bollettino valanghe non è disponibile, suggerisci aineva.it direttamente.
- Non citare mai date, pericoli, o condizioni che non provengono dai tool.

Workflow quando l'utente fornisce coordinate o una zona:
1. Chiama get_peaks_with_data(lat, lon, radius_km) — restituisce cime con pendenza già calcolata.
   ELENCA ogni cima trovata con nome, quota, distanza e indica se ski_suitable=True.
2. Chiama get_snow_stats(lat, lon) — copertura neve MODIS (oggi) + Sentinel-2 (recente).
3. Chiama get_avalanche_bulletin(province) — bollettino valanghe.
4. Chiama get_snow_coverage(lat, lon) per note aggiuntive su revisita Sentinel-2.
5. Concludi con valutazione: "ha senso uscire oggi?"

Formato:
- Cime: tabella con colonne Cima | Quota | Dist | Pend.media | Sci-alp
- Usa bullet point per meteo, valanghe, verdetto finale."""
```

- [ ] **Step 2: Run tests to verify nothing is broken**

```
python -m pytest tests/ -v
```
Expected: all pass

- [ ] **Step 3: Commit**

```bash
git add services/agno_agent.py
git commit -m "feat: update single-agent prompt to use new MCP tools"
```

---

## Self-Review

**Spec coverage:**
- ✓ 4 specialist agents (Terreno, Neve/Meteo, Valanghe, Web) — Task 6
- ✓ Coordinator Team in coordinate mode — Task 6
- ✓ peaks_service extracted — Task 1
- ✓ get_peaks_with_data MCP tool with tile deduplication — Task 5
- ✓ get_snow_stats MCP tool — Task 5
- ✓ MODIS pixel analysis — Task 2
- ✓ Sentinel-2 pixel analysis — Task 2
- ✓ Open-Meteo weather — Task 3
- ✓ EAWS/avalanche.report bulletin — Task 4
- ✓ AINEVA HTML bug fix — Task 4
- ✓ POST /api/agent/team endpoint — Task 7
- ✓ ddgs dependency — Task 6 Step 1
- ✓ Single-agent prompt updated — Task 8

**Placeholder scan:** No TBDs. All code shown in full.

**Type consistency:**
- `get_snow_stats` returns `dict` → consistent between snow_service.py, MCP tool, and agent tools
- `get_nearby_peaks` returns `list` → consistent in peaks_service, MCP wrapper, and agno_team imports
- `fetch_bulletin` returns `dict` with `available: bool` → consistent in eaws_client and aineva_client
- `build_team()` returns `Team` → consistent in agno_team.py and route import
