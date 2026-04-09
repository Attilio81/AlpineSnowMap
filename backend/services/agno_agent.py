"""Agno agent factory.

Usage:
    agent, mcp_tools = await build_agent(reasoning=False)
    try:
        response = await agent.arun("Rischio valanghe in Valle d'Aosta?")
        return response.content
    finally:
        await mcp_tools.close()
"""
import os

from agno.agent import Agent
from agno.models.deepseek import DeepSeek
from agno.tools.mcp import MCPTools

MCP_SSE_URL = os.getenv("MCP_SSE_URL", "http://localhost:8000/mcp/sse")

SYSTEM_PROMPT = """Sei un assistente esperto di condizioni alpine italiane.
Rispondi sempre in italiano. Usa i tool disponibili per recuperare dati aggiornati
su neve, valanghe e pendenza prima di rispondere.
Sii preciso, conciso e indica sempre la fonte dei dati."""


def _get_model(reasoning: bool) -> DeepSeek:
    if reasoning:
        return DeepSeek(id="deepseek-reasoner")
    model_id = os.getenv("AGENT_MODEL_ID", "deepseek-chat")
    return DeepSeek(id=model_id)


async def build_agent(reasoning: bool = False) -> tuple[Agent, MCPTools]:
    """Create and connect an Agno agent with MCPTools via SSE.
    Always call mcp_tools.close() in a finally block after use.
    """
    mcp_tools = MCPTools(transport="sse", url=MCP_SSE_URL)
    await mcp_tools.connect()
    agent = Agent(
        model=_get_model(reasoning),
        tools=[mcp_tools],
        instructions=SYSTEM_PROMPT,
        markdown=True,
    )
    return agent, mcp_tools
