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
- Se il bollettino valanghe non è disponibile, suggerisci aineva.it direttamente.
- Non citare mai date, pericoli, o condizioni che non provengono dai tool.
- Per le condizioni del manto nevoso, riporta il testo ESATTO del campo
  "snowpackComment" restituito dal bollettino, senza parafrasare né aggiungere
  informazioni. Se il campo è vuoto o assente, scrivi "Dati manto non disponibili
  nel bollettino."

Workflow quando l'utente fornisce coordinate o una zona:
1. Chiama get_peaks_with_data(lat, lon, radius_km) — restituisce cime con pendenza già calcolata.
   ELENCA ogni cima trovata con nome, quota, distanza e indica se ski_suitable=True.
2. Chiama get_snow_stats(lat, lon) — copertura neve MODIS (oggi) + Sentinel-2 (recente).
3. Chiama get_avalanche_bulletin(province) — bollettino valanghe.
4. Chiama get_snow_coverage(lat, lon) per note aggiuntive su revisita Sentinel-2.
5. Concludi con valutazione: "ha senso uscire oggi?"

Formato:
- Cime: tabella con colonne Cima | Quota | Dist | Pend.media | Sci-alp
- Usa bullet point per meteo, valanghe, verdetto finale."""


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
