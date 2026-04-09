"""EAWS avalanche bulletin client.

Uses avalanche.report API (EAWS standard GeoJSON) for supported provinces.
Province support:
  - IT-32-BZ (South Tyrol): avalanche.report
  - IT-32-TN (Trentino): avalanche.report
  - All others: falls back to AINEVA (aineva_client)
"""
import time
import httpx

AVALANCHE_REPORT_URL = "https://avalanche.report/api/public/bulletins"
CACHE_TTL = 6 * 3600
_cache: dict[str, tuple[float, dict]] = {}

AVALANCHE_REPORT_PROVINCES = {"IT-32-BZ", "IT-32-TN"}


_DANGER_MAP = {"low": 1, "moderate": 2, "considerable": 3, "high": 4, "very_high": 5}


def _extract_max_danger(bulletins: list) -> int:
    max_val = 0
    for b in bulletins:
        for dr in b.get("dangerRatings", []):
            val = dr.get("mainValue", "")
            if isinstance(val, str):
                numeric = _DANGER_MAP.get(val, 0)
            elif isinstance(val, (int, float)):
                numeric = int(val)
            else:
                numeric = 0
            max_val = max(max_val, numeric)
    return max_val


async def _fetch_avalanche_report(province: str) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            AVALANCHE_REPORT_URL,
            params={"lang": "it", "region": province},
            headers={"User-Agent": "AlpineSnowMap/1.0"},
        )
        resp.raise_for_status()
        bulletins = resp.json()
    return {
        "available": True,
        "bulletins": bulletins,
        "maxDanger": _extract_max_danger(bulletins),
        "source": "avalanche.report (EAWS)",
    }


async def fetch_bulletin(province: str) -> dict:
    """Fetch avalanche bulletin for an Italian alpine province.

    Tries avalanche.report for IT-32-BZ / IT-32-TN, AINEVA for all others.
    Returns {"available": bool, "bulletins": list, "maxDanger": int, "source": str}.
    """
    now = time.time()
    if province in _cache:
        ts, data = _cache[province]
        if now - ts < CACHE_TTL:
            return data

    try:
        if province in AVALANCHE_REPORT_PROVINCES:
            data = await _fetch_avalanche_report(province)
        else:
            from services.aineva_client import fetch_bulletin as _aineva
            aineva_data = await _aineva(province)
            data = {**aineva_data, "source": "AINEVA"}
        _cache[province] = (now, data)
        return data
    except Exception as e:
        return {
            "available": False,
            "message": str(e),
            "source": "unavailable",
        }
