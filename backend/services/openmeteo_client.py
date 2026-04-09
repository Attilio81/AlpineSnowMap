from datetime import datetime, timezone, timedelta

import httpx

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


async def get_mountain_weather(lat: float, lon: float) -> dict:
    """Current mountain weather from Open-Meteo (free, no API key required).
    Returns temperature (°C), wind speed (km/h), freezing level (m asl),
    and total snowfall over the last 48 hours (cm).
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "temperature_2m,snowfall,windspeed_10m,freezinglevel_height",
        "past_days": 2,
        "forecast_days": 1,
        "models": "best_match",
        "timezone": "Europe/Rome",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(OPEN_METEO_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

    hourly = data["hourly"]
    times = hourly["time"]

    now_str = datetime.now(tz=timezone(timedelta(hours=2))).strftime("%Y-%m-%dT%H:00")
    idx = times.index(now_str) if now_str in times else max(0, len(times) // 2)

    snowfall_48h = sum(hourly["snowfall"][max(0, idx - 48): idx + 1])

    return {
        "temperature_2m_c": float(hourly["temperature_2m"][idx]),
        "windspeed_kmh": float(hourly["windspeed_10m"][idx]),
        "freezinglevel_m": float(hourly["freezinglevel_height"][idx]),
        "snowfall_48h_cm": round(float(snowfall_48h), 1),
        "source": "Open-Meteo",
        "timestamp": now_str,
    }
