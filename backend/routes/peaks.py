import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter()

# Cached permanently — peaks don't change
_peaks_cache: dict | None = None

# Primary + fallback Overpass mirrors
OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

# Query: all named peaks in the Italian Alps bounding box, elevation optional
OVERPASS_QUERY = """
[out:json][timeout:25];
node["natural"="peak"]["name"](44.0,6.5,47.2,14.0);
out body;
"""


@router.get("/api/peaks")
async def get_peaks():
    global _peaks_cache
    if _peaks_cache is not None:
        return _peaks_cache

    last_error = None
    for url in OVERPASS_URLS:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(url, data={"data": OVERPASS_QUERY})
                resp.raise_for_status()
                data = resp.json()
            last_error = None
            break
        except Exception as e:
            last_error = e
            continue

    if last_error is not None:
        raise HTTPException(status_code=502, detail=f"Overpass unavailable: {last_error}")

    features = []
    for el in data.get("elements", []):
        tags = el.get("tags", {})
        name = tags.get("name") or tags.get("name:it") or tags.get("name:de")
        if not name:
            continue
        ele = tags.get("ele")
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [el["lon"], el["lat"]]},
            "properties": {
                "name": name,
                "ele": int(float(ele)) if ele else None,
            },
        })

    _peaks_cache = {"type": "FeatureCollection", "features": features}
    return _peaks_cache
