import math
import io
from functools import lru_cache

import httpx
import numpy as np
from PIL import Image
from fastapi import APIRouter
from fastapi.responses import Response

from config import SLOPE_COLORS, SLOPE_TILE_Z_MIN, SLOPE_TILE_Z_MAX

router = APIRouter()

TERRARIUM_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
EARTH_RADIUS  = 6_378_137.0


def _tile_center_lat(z: int, y: int) -> float:
    n = math.pi - 2 * math.pi * (y + 0.5) / (2 ** z)
    return math.atan(math.sinh(n))


def _meters_per_pixel(z: int, lat_rad: float) -> float:
    return 2 * math.pi * EARTH_RADIUS * math.cos(lat_rad) / (256 * 2 ** z)


@lru_cache(maxsize=8_000)
def _compute(z: int, x: int, y: int) -> bytes | None:
    url = TERRARIUM_URL.format(z=z, x=x, y=y)
    try:
        resp = httpx.get(url, timeout=10)
        resp.raise_for_status()
    except Exception:
        return None

    arr = np.array(Image.open(io.BytesIO(resp.content)).convert("RGB"), dtype=np.float32)
    elevation = arr[:, :, 0] * 256 + arr[:, :, 1] + arr[:, :, 2] / 256 - 32768

    res   = _meters_per_pixel(z, _tile_center_lat(z, y))
    gy, gx = np.gradient(elevation)
    slope  = np.degrees(np.arctan(np.sqrt((gx / res) ** 2 + (gy / res) ** 2)))

    rgba = np.zeros((256, 256, 4), dtype=np.uint8)
    for lo, hi, rv, gv, bv, av in SLOPE_COLORS:
        mask = (slope >= lo) & (slope < hi)
        rgba[mask] = [rv, gv, bv, av]

    buf = io.BytesIO()
    Image.fromarray(rgba, "RGBA").save(buf, format="PNG")
    return buf.getvalue()


@router.get("/api/slope/{z}/{x}/{y}.png")
def slope_tile(z: int, x: int, y: int):
    if z < SLOPE_TILE_Z_MIN or z > SLOPE_TILE_Z_MAX:
        return Response(status_code=204)
    data = _compute(z, x, y)
    if data is None:
        return Response(status_code=204)
    return Response(
        content=data,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=604800"},
    )
