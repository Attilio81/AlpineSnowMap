import time
import httpx

AINEVA_BASE = "https://bollettini.aineva.it/bulletin/latest"
CACHE_TTL = 6 * 3600  # 6 hours

_cache: dict[str, tuple[float, dict]] = {}  # province_id → (timestamp, data)


async def fetch_bulletin(province: str) -> dict:
    now = time.time()
    if province in _cache:
        ts, data = _cache[province]
        if now - ts < CACHE_TTL:
            return data

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(AINEVA_BASE, params={"province": province})
        resp.raise_for_status()
        data = resp.json()

    _cache[province] = (now, data)
    return data
