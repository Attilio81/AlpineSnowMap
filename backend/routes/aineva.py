from fastapi import APIRouter, HTTPException
import httpx
from services.aineva_client import fetch_bulletin

router = APIRouter()


@router.get("/api/aineva/{province}")
async def get_bulletin(province: str):
    if not province.startswith("IT-"):
        raise HTTPException(status_code=400, detail="Province must start with IT-")
    try:
        data = await fetch_bulletin(province)
        return {"available": True, **data}
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return {"available": False, "message": "Bollettino non disponibile fuori stagione"}
        raise HTTPException(status_code=502, detail="AINEVA upstream error")
    except Exception:
        raise HTTPException(status_code=503, detail="Service temporarily unavailable")
