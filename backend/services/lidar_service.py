"""LiDAR high-resolution DEM service.

Reads Cloud Optimized GeoTIFF files (WGS84 / EPSG:4326) prepared with
backend/lidar/prepare.py and exposes:
  - slope tiles (RGBA PNG, same color scheme as Terrarium slope)
  - elevation grids (for Blender export)

GeoTIFF files are expected in backend/lidar/ with names from PROVINCE_FILES.
If rasterio is not installed or files are missing, all functions return None
and the caller falls back to Terrarium/Overpass as usual.
"""
import io
import math
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image

from config import SLOPE_COLORS

try:
    import rasterio
    from rasterio.enums import Resampling
    from rasterio.windows import from_bounds
    _HAS_RASTERIO = True
except ImportError:
    _HAS_RASTERIO = False

LIDAR_DIR = Path(__file__).parent.parent / "lidar"

# Registry: codice provincia → nome file GeoTIFF in LIDAR_DIR
PROVINCE_FILES: dict[str, str] = {
    "IT-21": "piemonte.tif",
    "IT-23": "vda.tif",
}


def available_provinces() -> list[str]:
    """Province per cui esiste il file LiDAR GeoTIFF."""
    if not _HAS_RASTERIO:
        return []
    return [p for p, f in PROVINCE_FILES.items() if (LIDAR_DIR / f).exists()]


def _lidar_path(province: str) -> Path | None:
    if not _HAS_RASTERIO:
        return None
    fn = PROVINCE_FILES.get(province)
    if not fn:
        return None
    p = LIDAR_DIR / fn
    return p if p.exists() else None


# ── Tile geometry helpers ─────────────────────────────────────────────────────

def _tile_bounds(z: int, x: int, y: int) -> tuple[float, float, float, float]:
    """(lon_min, lat_min, lon_max, lat_max) in WGS84."""
    n = 2 ** z
    lon_min = x / n * 360 - 180
    lon_max = (x + 1) / n * 360 - 180
    lat_max = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    lat_min = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n))))
    return lon_min, lat_min, lon_max, lat_max


def _res_meters(lon_min: float, lon_max: float, lat_min: float, lat_max: float) -> tuple[float, float]:
    """Pixel size in meters (res_x, res_y) for a 256×256 window."""
    mid_lat = math.radians((lat_min + lat_max) / 2)
    res_x = (lon_max - lon_min) * 111_320 * math.cos(mid_lat) / 256
    res_y = (lat_max - lat_min) * 111_320 / 256
    return res_x, res_y


# ── Slope tile ────────────────────────────────────────────────────────────────

def _slope_from_elevation(elev: np.ndarray, res_x: float, res_y: float) -> np.ndarray:
    gy, gx = np.gradient(elev)
    return np.degrees(np.arctan(np.sqrt((gx / res_x) ** 2 + (gy / res_y) ** 2)))


def _slope_to_rgba(slope: np.ndarray) -> bytes:
    rgba = np.zeros((256, 256, 4), dtype=np.uint8)
    for lo, hi, rv, gv, bv, av in SLOPE_COLORS:
        mask = (slope >= lo) & (slope < hi)
        rgba[mask] = [rv, gv, bv, av]
    buf = io.BytesIO()
    Image.fromarray(rgba, "RGBA").save(buf, format="PNG")
    return buf.getvalue()


@lru_cache(maxsize=4_000)
def get_slope_tile(z: int, x: int, y: int, province: str) -> bytes | None:
    """RGBA slope PNG da LiDAR. None se dati non disponibili per questo tile."""
    path = _lidar_path(province)
    if path is None:
        return None

    lon_min, lat_min, lon_max, lat_max = _tile_bounds(z, x, y)

    with rasterio.open(path) as ds:
        b = ds.bounds
        if lon_max <= b.left or lon_min >= b.right or lat_max <= b.bottom or lat_min >= b.top:
            return None  # tile fuori dai bounds del GeoTIFF
        win = from_bounds(lon_min, lat_min, lon_max, lat_max, ds.transform)
        elev = ds.read(1, window=win, out_shape=(256, 256), resampling=Resampling.bilinear)
        nd = ds.nodata
        if nd is not None:
            elev = np.where(elev == nd, 0.0, elev)

    res_x, res_y = _res_meters(lon_min, lon_max, lat_min, lat_max)
    slope = _slope_from_elevation(elev.astype(np.float32), max(res_x, 0.1), max(res_y, 0.1))
    return _slope_to_rgba(slope)


# ── Elevation grid (per Blender export) ──────────────────────────────────────

def get_elevation_grid(
    lat: float, lon: float, radius_km: float, grid_size: int, province: str
) -> list[list[float]] | None:
    """Griglia NxN di elevazioni da LiDAR. None se dati non disponibili."""
    path = _lidar_path(province)
    if path is None:
        return None

    dlat = radius_km / 111.0
    dlon = radius_km / (111.0 * math.cos(math.radians(lat)))
    lat_min, lat_max = lat - dlat, lat + dlat
    lon_min, lon_max = lon - dlon, lon + dlon

    with rasterio.open(path) as ds:
        b = ds.bounds
        if lon_max <= b.left or lon_min >= b.right or lat_max <= b.bottom or lat_min >= b.top:
            return None
        win = from_bounds(lon_min, lat_min, lon_max, lat_max, ds.transform)
        data = ds.read(1, window=win, out_shape=(grid_size, grid_size),
                       resampling=Resampling.bilinear).astype(np.float32)
        nd = ds.nodata
        if nd is not None:
            data = np.where(data == nd, 0.0, data)

    return [[round(float(v), 1) for v in row] for row in data]
