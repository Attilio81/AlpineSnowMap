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


def test_team_endpoint_returns_response():
    from unittest.mock import patch, AsyncMock, MagicMock
    import os
    os.environ["DEEPSEEK_API_KEY"] = "test-key"

    mock_team = MagicMock()
    mock_response = MagicMock()
    mock_response.content = "## Cime vicine\n| Monte Roisetta | 3333 m | ✓ |"
    mock_team.arun = AsyncMock(return_value=mock_response)

    with patch("routes.agent.build_team", return_value=mock_team):
        from fastapi.testclient import TestClient
        from main import app
        client = TestClient(app)
        resp = client.post(
            "/api/agent/team",
            json={"message": "Cime adatte a Torgnon?", "province": "IT-23"},
        )
        assert resp.status_code == 200
        assert "response" in resp.json()
        assert len(resp.json()["response"]) > 0


def test_team_endpoint_returns_503_without_api_key(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    from fastapi.testclient import TestClient
    from main import app
    client = TestClient(app)
    resp = client.post(
        "/api/agent/team",
        json={"message": "test", "province": "IT-23"},
    )
    assert resp.status_code == 503
