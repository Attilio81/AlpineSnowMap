"""Blender scene export service.

Builds a self-contained JSON file that Claude + Blender MCP can consume to
generate a photorealistic 3D scene of an alpine zone, including:
  - terrain elevation grid (from Terrarium DEM tiles)
  - slope grid (computed in-process from same DEM data)
  - solar position (pure-math, no external dependency)
  - avalanche bulletin (AINEVA)
  - nearby peaks (Overpass)
  - workflow hints for Claude to drive Blender
"""
import asyncio
import io
import math
from datetime import datetime, timezone

import httpx
import numpy as np
from PIL import Image

from config import RISK_COLORS, RISK_LABELS, VALID_PROVINCES, SLOPE_RISK_LOW, SLOPE_RISK_MOD, SLOPE_RISK_HIGH, SLOPE_RISK_VERY_HIGH
from services.peaks_service import get_nearby_peaks
from services.aineva_client import fetch_bulletin

TERRARIUM_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
EARTH_RADIUS = 6_378_137.0


# ── Tile helpers ──────────────────────────────────────────────────────────────

def _zoom_for_radius(radius_km: float) -> int:
    """Choose DEM zoom level: more detail for smaller areas."""
    if radius_km <= 5:
        return 12
    if radius_km <= 12:
        return 11
    return 10


def _deg_to_tile(lat: float, lon: float, zoom: int) -> tuple[int, int]:
    n = 2 ** zoom
    x = int((lon + 180) / 360 * n)
    lat_r = math.radians(lat)
    y = int((1 - math.log(math.tan(lat_r) + 1 / math.cos(lat_r)) / math.pi) / 2 * n)
    return x, y


def _tile_to_nw(x: int, y: int, zoom: int) -> tuple[float, float]:
    """Return (lat, lon) of tile NW corner."""
    n = 2 ** zoom
    lon = x / n * 360 - 180
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    return lat, lon


async def _fetch_tile(z: int, x: int, y: int) -> np.ndarray | None:
    url = TERRARIUM_URL.format(z=z, x=x, y=y)
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            resp.raise_for_status()
        arr = np.array(Image.open(io.BytesIO(resp.content)).convert("RGB"), dtype=np.float32)
        return arr[:, :, 0] * 256 + arr[:, :, 1] + arr[:, :, 2] / 256 - 32768
    except Exception:
        return None


# ── DEM composite ─────────────────────────────────────────────────────────────

async def _build_dem_composite(lat: float, lon: float, radius_km: float) -> dict:
    """Download all Terrarium tiles for the bbox and stitch into one array."""
    zoom = _zoom_for_radius(radius_km)
    dlat = radius_km / 111.0
    dlon = radius_km / (111.0 * math.cos(math.radians(lat)))

    tx_min, ty_max = _deg_to_tile(lat - dlat, lon - dlon, zoom)
    tx_max, ty_min = _deg_to_tile(lat + dlat, lon + dlon, zoom)

    coords = [(tx, ty) for tx in range(tx_min, tx_max + 1) for ty in range(ty_min, ty_max + 1)]
    tiles_data = await asyncio.gather(*[_fetch_tile(zoom, tx, ty) for tx, ty in coords])
    tiles = dict(zip(coords, tiles_data))

    n_rows = ty_max - ty_min + 1
    n_cols = tx_max - tx_min + 1
    composite = np.zeros((n_rows * 256, n_cols * 256), dtype=np.float32)
    for (tx, ty), data in tiles.items():
        if data is None:
            continue
        py = (ty - ty_min) * 256
        px = (tx - tx_min) * 256
        composite[py:py + 256, px:px + 256] = data

    lat_top, lon_left = _tile_to_nw(tx_min, ty_min, zoom)
    lat_bot, lon_right = _tile_to_nw(tx_max + 1, ty_max + 1, zoom)

    return {
        "composite": composite,
        "lat_top": lat_top, "lat_bot": lat_bot,
        "lon_left": lon_left, "lon_right": lon_right,
        "zoom": zoom,
    }


# ── Grid sampling ─────────────────────────────────────────────────────────────

def _sample_grids(
    dem: dict, lat: float, lon: float, radius_km: float, grid_size: int
) -> tuple[list, list, dict]:
    """Sample elevation and slope at NxN grid points from composite DEM."""
    dlat = radius_km / 111.0
    dlon = radius_km / (111.0 * math.cos(math.radians(lat)))
    lat_max, lat_min = lat + dlat, lat - dlat
    lon_min, lon_max = lon - dlon, lon + dlon

    composite = dem["composite"]
    h, w = composite.shape

    # Slope map — same formula as slope_service.py
    lat_r = math.radians(lat)
    res = 2 * math.pi * EARTH_RADIUS * math.cos(lat_r) / (256 * 2 ** dem["zoom"])
    gy, gx = np.gradient(composite)
    slope_map = np.degrees(np.arctan(np.sqrt((gx / res) ** 2 + (gy / res) ** 2)))

    def to_px(g_lat: float, g_lon: float) -> tuple[int, int]:
        py = int((dem["lat_top"] - g_lat) / (dem["lat_top"] - dem["lat_bot"]) * h)
        px = int((g_lon - dem["lon_left"]) / (dem["lon_right"] - dem["lon_left"]) * w)
        return max(0, min(h - 1, py)), max(0, min(w - 1, px))

    lats = np.linspace(lat_max, lat_min, grid_size)
    lons = np.linspace(lon_min, lon_max, grid_size)
    elev_grid, slope_grid = [], []

    for g_lat in lats:
        e_row, s_row = [], []
        for g_lon in lons:
            py, px = to_px(g_lat, g_lon)
            e_row.append(round(float(composite[py, px]), 1))
            s_row.append(round(float(slope_map[py, px]), 1))
        elev_grid.append(e_row)
        slope_grid.append(s_row)

    elev_flat = composite[composite > -1000]
    meta = {
        "rows": grid_size, "cols": grid_size,
        "lat_min": round(lat_min, 6), "lat_max": round(lat_max, 6),
        "lon_min": round(lon_min, 6), "lon_max": round(lon_max, 6),
        "resolution_m": round((radius_km * 2000) / grid_size),
        "ele_min_m": round(float(elev_flat.min()), 1),
        "ele_max_m": round(float(elev_flat.max()), 1),
    }
    return elev_grid, slope_grid, meta


# ── Solar position ────────────────────────────────────────────────────────────

def solar_position(lat_deg: float, lon_deg: float, date_str: str, hour_utc: int) -> dict:
    """Approximate solar azimuth and elevation (Spencer 1971 declination model)."""
    dt = datetime(*[int(x) for x in date_str.split("-")], hour_utc, 0, 0)
    day = dt.timetuple().tm_yday
    B = math.radians((360 / 365) * (day - 81))
    decl = math.radians(23.45 * math.sin(B))
    eot = 9.87 * math.sin(2 * B) - 7.53 * math.cos(B) - 1.5 * math.sin(B)
    lstm = 15 * round(lon_deg / 15)
    lst = hour_utc + (4 * (lon_deg - lstm) + eot) / 60
    ha = math.radians(15 * (lst - 12))
    lat_r = math.radians(lat_deg)
    sin_e = math.sin(lat_r) * math.sin(decl) + math.cos(lat_r) * math.cos(decl) * math.cos(ha)
    sin_e = max(-1.0, min(1.0, sin_e))
    elev = math.degrees(math.asin(sin_e))
    denom = math.cos(lat_r) * math.cos(math.radians(max(0.1, elev))) + 1e-10
    cos_az = max(-1.0, min(1.0, (math.sin(decl) - math.sin(lat_r) * sin_e) / denom))
    az = math.degrees(math.acos(cos_az))
    if ha > 0:
        az = 360 - az
    return {
        "azimuth_deg": round(az, 1),
        "elevation_deg": round(elev, 1),
        "is_daytime": elev > 0,
    }


# ── Main export ───────────────────────────────────────────────────────────────

async def build_blender_scene(
    lat: float, lon: float, province: str, date_str: str,
    hour: int, radius_km: float, grid_size: int,
) -> dict:
    """Aggregate all data needed to build a Blender 3D scene."""
    dem_task = _build_dem_composite(lat, lon, radius_km)
    peaks_task = get_nearby_peaks(lat, lon, radius_km)
    bulletin_task = fetch_bulletin(province)

    dem, peaks_raw, bulletin = await asyncio.gather(
        dem_task, peaks_task, bulletin_task, return_exceptions=True
    )

    # Terrain grids
    terrain = {"error": "DEM non disponibile"}
    if isinstance(dem, dict):
        elev_grid, slope_grid, grid_meta = _sample_grids(dem, lat, lon, radius_km, grid_size)
        terrain = {**grid_meta, "elevation_grid": elev_grid, "slope_grid": slope_grid}

    # Avalanche bulletin
    avalanche: dict = {"available": False}
    if isinstance(bulletin, dict):
        danger = bulletin.get("maxDanger", 0)
        first = (bulletin.get("bulletins") or [{}])[0]
        avalanche = {
            "available": True,
            "danger_level": danger,
            "label": RISK_LABELS.get(danger, "N/D"),
            "color_hex": RISK_COLORS.get(danger, "#888888"),
            "problems": first.get("avalancheProblems", []),
            "highlights": first.get("highlights", ""),
            "snowpack_comment": first.get("snowpackComment", ""),
            "valid_from": first.get("validTime", {}).get("startTime", ""),
            "valid_to": first.get("validTime", {}).get("endTime", ""),
        }

    return {
        "meta": {
            "zone": VALID_PROVINCES.get(province, province),
            "province": province,
            "date": date_str,
            "hour_utc": hour,
            "center": {"lat": lat, "lon": lon},
            "radius_km": radius_km,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        },
        "terrain": terrain,
        "sun": solar_position(lat, lon, date_str, hour),
        "avalanche": avalanche,
        "peaks": peaks_raw if isinstance(peaks_raw, list) else [],
        "blender_hints": {
            "slope_colors": {
                "below_25deg":  "#FFFFFF",   # bianco — neve/ghiacciaio
                "25_30deg":     "#33CC33",   # verde — pendenza bassa
                "30_35deg":     "#FFCC00",   # giallo — attenzione
                "35_40deg":     "#FF6600",   # arancio — pericoloso
                "above_40deg":  "#CC0000",   # rosso — molto pericoloso
            },
            "slope_thresholds_deg": [
                SLOPE_RISK_LOW, SLOPE_RISK_MOD,
                SLOPE_RISK_HIGH, SLOPE_RISK_VERY_HIGH,
            ],
            "suggested_workflow": [
                "1. Crea Mesh > Grid con dimensioni terrain.rows x terrain.cols",
                "2. In Edit Mode, trasla ogni vertice in Z usando terrain.elevation_grid (normalizzato su ele_min_m..ele_max_m)",
                "3. Aggiungi Vertex Color layer 'slope_risk': colora ogni vertice in base a terrain.slope_grid e slope_colors",
                "4. Aggiungi Sun Lamp: rotazione da sun.azimuth_deg e sun.elevation_deg",
                "5. Per ogni peak in peaks[]: aggiungi un Empty Cone con label=peak.name a coordinate (lat,lon,ele)",
                "6. Imposta World Background color = avalanche.color_hex con intensità 0.1 per il mood",
                "7. Render con EEVEE: output PNG 1920x1080",
            ],
        },
    }
