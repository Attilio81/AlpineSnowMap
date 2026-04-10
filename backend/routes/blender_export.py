"""Blender scene export endpoint.

GET /api/export/blender-scene?lat=45.8&lon=7.5&province=IT-23&date=2026-04-10&hour=9&radius_km=10&grid_size=64

Returns a JSON file ready to be passed to Claude + Blender MCP for 3D scene generation.
"""
import json
from datetime import date as date_type

from fastapi import APIRouter, Query
from fastapi.responses import Response

from validators import validate_alpine_coords, validate_province, validate_date
from services.blender_export import build_blender_scene

router = APIRouter()


@router.get("/api/export/blender-scene")
async def export_blender_scene(
    lat: float = Query(..., description="Latitudine centro zona (WGS84)"),
    lon: float = Query(..., description="Longitudine centro zona (WGS84)"),
    province: str = Query("IT-23", description="Codice provincia AINEVA (es. IT-23)"),
    date: str = Query("", description="Data YYYY-MM-DD (default: oggi)"),
    hour: int = Query(9, ge=0, le=23, description="Ora UTC di partenza (default 9)"),
    radius_km: float = Query(10.0, ge=1.0, le=30.0, description="Raggio area in km (default 10)"),
    grid_size: int = Query(64, ge=16, le=128, description="Risoluzione griglia NxN (default 64)"),
):
    """Genera un file JSON con tutti i dati necessari a Claude + Blender MCP
    per creare una scena 3D fotorealistica della zona alpina richiesta.

    Il file include:
    - Griglia elevazione NxN (da DEM Terrarium)
    - Griglia pendenza NxN (calcolata in-process dallo stesso DEM)
    - Posizione solare (azimuth + elevation per data/ora)
    - Bollettino valanghe AINEVA (livello, problemi, commento)
    - Cime vicine con quota e distanza
    - Istruzioni workflow per Blender
    """
    validate_alpine_coords(lat, lon)
    validate_province(province)
    date_str = date or date_type.today().isoformat()
    if date:
        validate_date(date)

    scene = await build_blender_scene(
        lat, lon, province, date_str, hour, radius_km, grid_size
    )

    filename = f"alpinesnowmap_{province}_{date_str}_{lat:.3f}N_{lon:.3f}E.json"
    return Response(
        content=json.dumps(scene, ensure_ascii=False, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
