"""Agent endpoints wrapping the Agno + DeepSeek agent."""
import asyncio
import os
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.agno_agent import build_agent
from services.agno_team import build_team

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/agent")


class QueryRequest(BaseModel):
    message: str


class RouteRequest(BaseModel):
    geojson: dict
    province: str = "IT-23"


@router.post("/query")
async def query_conditions(req: QueryRequest):
    """Natural language query about alpine snow/avalanche conditions.
    Returns: {"response": str}
    """
    if not os.getenv("DEEPSEEK_API_KEY"):
        raise HTTPException(status_code=503, detail="DEEPSEEK_API_KEY not configured")

    agent, mcp_tools = await build_agent(reasoning=False)
    try:
        response = await agent.arun(req.message)
        return {"response": response.content}
    except Exception as e:
        logger.error("Agent query failed: %s", e)
        raise HTTPException(status_code=503, detail="Agente temporaneamente non disponibile")
    finally:
        await mcp_tools.close()


@router.post("/route")
async def analyze_route(req: RouteRequest):
    """Avalanche risk analysis for a GPX/GeoJSON track.
    Returns: {"response": str}
    """
    if not os.getenv("DEEPSEEK_API_KEY"):
        raise HTTPException(status_code=503, detail="DEEPSEEK_API_KEY not configured")

    agent, mcp_tools = await build_agent(reasoning=True)
    try:
        prompt = (
            f"Analizza il rischio valanghe per questa traccia nella provincia {req.province}. "
            f"Usa il tool analyze_route_risk con questi dati GeoJSON: {req.geojson}. "
            f"Fornisci un riassunto del rischio complessivo e per ogni segmento."
        )
        response = await agent.arun(prompt)
        return {"response": response.content}
    except Exception as e:
        logger.error("Route analysis failed: %s", e)
        raise HTTPException(status_code=503, detail="Analisi traccia temporaneamente non disponibile")
    finally:
        await mcp_tools.close()


class TeamQueryRequest(BaseModel):
    message: str
    province: str = "IT-23"


@router.post("/team")
async def query_team(req: TeamQueryRequest):
    """Multi-agent team query: terrain + snow/weather + avalanche + web search.
    Returns: {"response": str}
    """
    if not os.getenv("DEEPSEEK_API_KEY"):
        raise HTTPException(status_code=503, detail="DEEPSEEK_API_KEY not configured")

    team = build_team()
    full_message = f"{req.message}\nProvincia valanghe: {req.province}"
    try:
        response = await asyncio.wait_for(team.arun(full_message), timeout=60.0)
        return {"response": response.content}
    except asyncio.TimeoutError:
        logger.error("Team query timed out after 60s")
        raise HTTPException(status_code=503, detail="Team timeout — riprova più tardi")
    except Exception as e:
        logger.error("Team query failed: %s", e)
        raise HTTPException(status_code=503, detail="Team temporaneamente non disponibile")
