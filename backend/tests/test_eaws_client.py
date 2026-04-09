from unittest.mock import patch, AsyncMock
import asyncio


def test_fetch_bulletin_returns_available_structure():
    mock_data = [
        {
            "dangerRatings": [{"mainValue": {"numeric": 2}}],
            "avalancheProblems": [{"problemType": "wind_slab"}],
            "highlights": "Pericolo limitato",
            "validTime": {"startTime": "2026-04-09T00:00:00+00:00"},
        }
    ]
    with patch("services.eaws_client.httpx.AsyncClient") as MockClient:
        mock_get = AsyncMock(return_value=AsyncMock(
            status_code=200,
            json=lambda: mock_data,
            raise_for_status=lambda: None,
        ))
        MockClient.return_value.__aenter__ = AsyncMock(return_value=AsyncMock(get=mock_get))
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        async def run():
            from services.eaws_client import fetch_bulletin
            result = await fetch_bulletin("IT-32-BZ")
            assert result["available"] is True
            assert "bulletins" in result
            assert "maxDanger" in result

        asyncio.run(run())


def test_fetch_bulletin_returns_unavailable_on_error():
    with patch("services.eaws_client.httpx.AsyncClient") as MockClient:
        mock_get = AsyncMock(side_effect=Exception("connection refused"))
        MockClient.return_value.__aenter__ = AsyncMock(return_value=AsyncMock(get=mock_get))
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        async def run():
            import services.eaws_client as eaws
            eaws._cache.clear()
            result = await eaws.fetch_bulletin("IT-32-BZ")
            assert result["available"] is False
            assert "message" in result

        asyncio.run(run())
