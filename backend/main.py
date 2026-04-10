import os
import logging

from dotenv import load_dotenv
load_dotenv(override=True)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.aineva import router
from routes.sentinel_snow import router as snow_router
from routes.peaks import router as peaks_router
from routes.slope import router as slope_router
from routes.agent import router as agent_router
from routes.blender_export import router as blender_router
from mcp_server import mcp

logger = logging.getLogger(__name__)

if not os.getenv("DEEPSEEK_API_KEY"):
    logger.warning("DEEPSEEK_API_KEY not set — /api/agent/* endpoints will return 503")

app = FastAPI(title="AlpineSnowMap API")

allowed_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(snow_router)
app.include_router(peaks_router)
app.include_router(slope_router)
app.include_router(agent_router)
app.include_router(blender_router)

# Mount MCP server — available at /mcp/sse for Claude Desktop and Agno
app.mount("/mcp", mcp.sse_app())


@app.get("/api/health")
def health():
    return {"status": "ok"}
