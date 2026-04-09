from unittest.mock import patch, AsyncMock
import asyncio


def _mock_openmeteo_response(temp=2.5, wind=18.0, snowfall=5.0, freeze=2800.0):
    times = [f"2026-04-09T{h:02d}:00" for h in range(24)]
    return {
        "hourly": {
            "time": times,
            "temperature_2m": [temp] * 24,
            "windspeed_10m": [wind] * 24,
            "snowfall": [snowfall / 48] * 24,
            "freezinglevel_height": [freeze] * 24,
        }
    }


def test_get_mountain_weather_returns_expected_fields():
    with patch("services.openmeteo_client.httpx.AsyncClient") as MockClient:
        mock_get = AsyncMock(return_value=AsyncMock(
            status_code=200,
            json=lambda: _mock_openmeteo_response(),
            raise_for_status=lambda: None,
        ))
        MockClient.return_value.__aenter__ = AsyncMock(return_value=AsyncMock(get=mock_get))
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        async def run():
            from services.openmeteo_client import get_mountain_weather
            result = await get_mountain_weather(45.826, 7.493)
            assert "temperature_2m_c" in result
            assert "windspeed_kmh" in result
            assert "freezinglevel_m" in result
            assert "snowfall_48h_cm" in result
            assert result["source"] == "Open-Meteo"
            assert isinstance(result["temperature_2m_c"], float)
            assert isinstance(result["snowfall_48h_cm"], float)

        asyncio.run(run())
