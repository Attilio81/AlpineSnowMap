"""LiDAR endpoints.

GET /api/lidar/available
    → {"provinces": ["IT-21", "IT-23"]}
    Province per cui esiste il file GeoTIFF preparato.

GET /api/lidar/slope/{province}/{z}/{x}/{y}.png
    → RGBA PNG con layer pendenza ad alta risoluzione (LiDAR 1m).
    Restituisce 204 se il tile non è coperto dal GeoTIFF o se rasterio
    non è installato — il frontend mostra silenziosamente il layer Terrarium.
"""
from fastapi import APIRouter
from fastapi.responses import JSONResponse, Response

from services.lidar_service import available_provinces, get_slope_tile
from config import SLOPE_TILE_Z_MIN, SLOPE_TILE_Z_MAX

router = APIRouter(prefix="/api/lidar")


@router.get("/available")
def lidar_available():
    """Province con dati LiDAR disponibili."""
    return JSONResponse({"provinces": available_provinces()})


@router.get("/slope/{province}/{z}/{x}/{y}.png")
def lidar_slope_tile(province: str, z: int, x: int, y: int):
    """Tile pendenza LiDAR ad alta risoluzione (colori EAWS: verde/giallo/arancio/rosso).
    Zoom supportato: 10–15 (oltre zoom 14 il LiDAR 1m è più utile di Terrarium).
    """
    if z < SLOPE_TILE_Z_MIN or z > 15:
        return Response(status_code=204)
    data = get_slope_tile(z, x, y, province)
    if data is None:
        return Response(status_code=204)
    return Response(
        content=data,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=2592000"},  # 30 giorni — LiDAR non cambia
    )
