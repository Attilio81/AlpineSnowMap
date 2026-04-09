import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock, MagicMock


@patch("routes.agent.build_agent")
def test_query_returns_response(mock_build):
    from main import app
    client = TestClient(app)

    mock_response = MagicMock()
    mock_response.content = "Il rischio valanghe è Marcato (3)."
    mock_agent = MagicMock()
    mock_agent.arun = AsyncMock(return_value=mock_response)
    mock_mcp = AsyncMock()
    mock_mcp.close = AsyncMock()
    mock_build.return_value = (mock_agent, mock_mcp)

    res = client.post("/api/agent/query", json={"message": "Rischio valanghe in Aosta?"})
    assert res.status_code == 200
    assert res.json()["response"] == "Il rischio valanghe è Marcato (3)."


@patch("routes.agent.build_agent")
def test_route_returns_response(mock_build):
    from main import app
    client = TestClient(app)

    mock_response = MagicMock()
    mock_response.content = "Rischio complessivo: Limitato."
    mock_agent = MagicMock()
    mock_agent.arun = AsyncMock(return_value=mock_response)
    mock_mcp = AsyncMock()
    mock_mcp.close = AsyncMock()
    mock_build.return_value = (mock_agent, mock_mcp)

    geojson = {"type": "LineString", "coordinates": [[7.0, 45.0], [7.1, 45.1]]}
    res = client.post("/api/agent/route", json={"geojson": geojson, "province": "IT-23"})
    assert res.status_code == 200
    assert "response" in res.json()


def test_query_missing_message_returns_422():
    from main import app
    client = TestClient(app)
    res = client.post("/api/agent/query", json={})
    assert res.status_code == 422
