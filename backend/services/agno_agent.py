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

REGOLA FONDAMENTALE — Non inventare mai dati:
- Se un tool restituisce {"available": false} o un errore, dì chiaramente
  "dati non disponibili" e non inventare valori alternativi.
- Se il bollettino AINEVA non è disponibile, dì che il servizio è temporaneamente
  irraggiungibile e suggerisci di consultare aineva.it direttamente.
- Non citare mai date, pericoli, o condizioni che non provengono dai tool.

Focus principale — qualità della neve per la gita:
- Usa get_slope_data per valutare il terreno (pendenza ottimale scialpinismo: 25-35°)
- Usa get_nearby_peaks per il contesto geografico
- Usa get_snow_coverage per la copertura neve attuale
- Combina i dati disponibili per rispondere: "ha senso uscire oggi?"
- Sii preciso e conciso."""


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
