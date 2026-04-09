from unittest.mock import patch, AsyncMock
import asyncio

def test_get_nearby_peaks_returns_sorted_list():
    mock_response = {
        "elements": [
            {"lat": 45.83, "lon": 7.50, "tags": {"name": "Monte Roisetta", "ele": "3333"}},
            {"lat": 45.84, "lon": 7.52, "tags": {"name": "Becca di Nona", "ele": "3142"}},
        ]
    }
    with patch("services.peaks_service.httpx.AsyncClient") as MockClient:
        mock_post = AsyncMock(return_value=AsyncMock(
            status_code=200,
            json=lambda: mock_response,
            raise_for_status=lambda: None,
        ))
        MockClient.return_value.__aenter__ = AsyncMock(return_value=AsyncMock(post=mock_post))
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        async def run():
            from services.peaks_service import get_nearby_peaks
            result = await get_nearby_peaks(45.826, 7.493, radius_km=10.0)
            assert isinstance(result, list)
            assert len(result) == 2
            assert result[0]["name"] == "Monte Roisetta"
            assert "distance_km" in result[0]
            assert "ele" in result[0]
            assert result[0]["distance_km"] <= result[1]["distance_km"]
        asyncio.run(run())

def test_get_nearby_peaks_filters_by_radius():
    mock_response = {
        "elements": [
            {"lat": 46.1, "lon": 8.0, "tags": {"name": "Far Peak", "ele": "3000"}},
        ]
    }
    with patch("services.peaks_service.httpx.AsyncClient") as MockClient:
        mock_post = AsyncMock(return_value=AsyncMock(
            status_code=200,
            json=lambda: mock_response,
            raise_for_status=lambda: None,
        ))
        MockClient.return_value.__aenter__ = AsyncMock(return_value=AsyncMock(post=mock_post))
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        async def run():
            from services.peaks_service import get_nearby_peaks
            result = await get_nearby_peaks(45.826, 7.493, radius_km=10.0)
            assert result == []
        asyncio.run(run())
