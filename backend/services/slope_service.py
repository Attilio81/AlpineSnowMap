import io
import math

import httpx
import numpy as np
from PIL import Image

TERRARIUM_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
EARTH_RADIUS = 6_378_137.0
_ZOOM = 12


def lat_lon_to_tile(lat: float, lon: float, zoom: int) -> tuple[int, int]:
    """Convert WGS84 lat/lon to slippy map tile XY at given zoom."""
    x = int((lon + 180) / 360 * 2**zoom)
    lat_rad = math.radians(lat)
    y = int(
        (1 - math.log(math.tan(lat_rad) + 1 / math.cos(lat_rad)) / math.pi)
        / 2
        * 2**zoom
    )
    return x, y


def _tile_center_lat_rad(zoom: int, y: int) -> float:
    n = math.pi - 2 * math.pi * (y + 0.5) / (2**zoom)
    return math.atan(math.sinh(n))


def _meters_per_pixel(zoom: int, lat_rad: float) -> float:
    return 2 * math.pi * EARTH_RADIUS * math.cos(lat_rad) / (256 * 2**zoom)


async def get_slope_stats(lat: float, lon: float) -> dict:
    """Return avg and max slope (degrees) for the tile containing (lat, lon)."""
    x, y = lat_lon_to_tile(lat, lon, _ZOOM)
    url = TERRARIUM_URL.format(z=_ZOOM, x=x, y=y)

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url)
        resp.raise_for_status()

    arr = np.array(
        Image.open(io.BytesIO(resp.content)).convert("RGB"), dtype=np.float32
    )
    elevation = arr[:, :, 0] * 256 + arr[:, :, 1] + arr[:, :, 2] / 256 - 32768

    lat_rad = _tile_center_lat_rad(_ZOOM, y)
    res = _meters_per_pixel(_ZOOM, lat_rad)
    gy, gx = np.gradient(elevation)
    slope = np.degrees(np.arctan(np.sqrt((gx / res) ** 2 + (gy / res) ** 2)))

    return {
        "avg_slope_deg": round(float(np.mean(slope)), 1),
        "max_slope_deg": round(float(np.max(slope)), 1),
        "tile_z": _ZOOM,
        "tile_x": x,
        "tile_y": y,
    }
