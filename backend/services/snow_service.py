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
    GIBS color palette approximation — thresholds may need empirical tuning.
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
    - [153, 217, 255] → neve leggera (NDSI 0.2-0.4)
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
    for days_ago in range(1, 4):
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
    Returns: {"modis": {...}, "sentinel2": {...}}
    """
    import asyncio
    modis, sentinel = await asyncio.gather(
        _get_modis_snow(lat, lon),
        _get_sentinel_snow(lat, lon),
    )
    return {"modis": modis, "sentinel2": sentinel}
