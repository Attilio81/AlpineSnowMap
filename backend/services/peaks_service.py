import math
import httpx

OVERPASS_URL = "https://overpass-api.de/api/interpreter"


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def get_nearby_peaks(lat: float, lon: float, radius_km: float = 10.0) -> list:
    """Named alpine peaks within radius_km of (lat, lon).
    Returns list of {name, ele, distance_km, lat, lon} sorted by distance.
    """
    pad = radius_km / 111.0
    query = f"""
[out:json][timeout:15];
node["natural"="peak"]["name"]({lat-pad},{lon-pad},{lat+pad},{lon+pad});
out body;
"""
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(OVERPASS_URL, data={"data": query})
        resp.raise_for_status()
        data = resp.json()

    peaks = []
    for el in data.get("elements", []):
        tags = el.get("tags", {})
        name = tags.get("name") or tags.get("name:it") or tags.get("name:de")
        if not name:
            continue
        dist = _haversine_km(lat, lon, el["lat"], el["lon"])
        if dist <= radius_km:
            peaks.append({
                "name": name,
                "ele": int(float(tags["ele"])) if tags.get("ele") else None,
                "distance_km": round(dist, 2),
                "lat": el["lat"],
                "lon": el["lon"],
            })
    return sorted(peaks, key=lambda p: p["distance_km"])
