import os

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from services.copernicus_client import fetch_snow_tile
from validators import validate_date

router = APIRouter()


@router.get("/api/snow/{z}/{x}/{y}.png")
async def snow_tile(z: int, x: int, y: int, date: str = Query(...)):
    validate_date(date)
    if not os.getenv("COPERNICUS_CLIENT_ID"):
        raise HTTPException(status_code=503, detail="Copernicus credentials not configured")
    try:
        png = await fetch_snow_tile(z, x, y, date)
        return Response(
            content=png,
            media_type="image/png",
            headers={"Cache-Control": "public, max-age=86400"},
        )
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            raise HTTPException(status_code=502, detail="Credenziali Copernicus non valide o scadute")
        raise HTTPException(status_code=502, detail="Errore upstream Copernicus Sentinel-2")
    except Exception:
        raise HTTPException(status_code=502, detail="Tile neve temporaneamente non disponibile")
