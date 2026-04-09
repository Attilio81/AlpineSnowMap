"""Agno multi-agent team factory.

Usage:
    team = build_team()
    response = await team.arun("Quali cime sono adatte a Torgnon oggi?")
    return response.content
"""
import os

from agno.agent import Agent
from agno.models.deepseek import DeepSeek
from agno.team.team import Team
from agno.team.mode import TeamMode
from agno.tools.websearch import WebSearchTools

from services.peaks_service import get_nearby_peaks
from services.slope_service import get_slope_stats
from services.snow_service import get_snow_stats
from services.openmeteo_client import get_mountain_weather
from services.eaws_client import fetch_bulletin as fetch_eaws_bulletin
from services.aineva_client import fetch_bulletin as fetch_aineva_bulletin


def _model() -> DeepSeek:
    model_id = os.getenv("AGENT_MODEL_ID", "deepseek-chat")
    return DeepSeek(id=model_id)


def build_team() -> Team:
    """Build the 4-agent Alpine Team. Returns a ready-to-run Agno Team."""

    agente_terreno = Agent(
        name="Agente Terreno",
        role="Analizza cime vicine e pendenza per scialpinismo",
        model=_model(),
        tools=[get_nearby_peaks, get_slope_stats],
        instructions="""Sei specializzato in terreno alpino.
Quando ricevi coordinate:
1. Chiama get_nearby_peaks(lat, lon, radius_km) con il raggio richiesto (default 10 km)
2. Per le prime 5 cime più vicine, chiama get_slope_stats(peak_lat, peak_lon)
3. Presenta i risultati in una tabella markdown:
   | Cima | Quota | Distanza | Pend. media | Pend. max | Sci-alp |
   Marca sci_suitable = ✓ se avg_slope_deg è tra 25° e 35°, — altrimenti.
4. Non inventare dati: se get_nearby_peaks fallisce, dilo esplicitamente.""",
        markdown=True,
    )

    agente_neve_meteo = Agent(
        name="Agente Neve/Meteo",
        role="Meteo in quota e copertura neve da satellite",
        model=_model(),
        tools=[get_mountain_weather, get_snow_stats],
        instructions="""Sei specializzato in meteo e neve alpina.
Quando ricevi coordinate:
1. Chiama get_mountain_weather(lat, lon) per temperatura, vento, zero termico, neve fresca
2. Chiama get_snow_stats(lat, lon) per copertura neve MODIS (oggi) e Sentinel-2 (recente)
3. Riporta:
   - Zero termico (m), vento (km/h), neve fresca ultimi 2 giorni (cm)
   - Copertura neve MODIS: "neve presente" / "assente" / "nuvole" con data
   - Copertura neve Sentinel-2: percentuale, qualità (densa/leggera), data acquisizione
4. Segnala condizioni pericolose: vento > 50 km/h, riscaldamento rapido (temp > 5°C e zero > 3000m)
5. Se un dato è unavailable, dillo senza inventare valori.""",
        markdown=True,
    )

    agente_valanghe = Agent(
        name="Agente Valanghe",
        role="Bollettino valanghe ufficiale",
        model=_model(),
        tools=[fetch_eaws_bulletin, fetch_aineva_bulletin],
        instructions="""Sei specializzato in valanghe e sicurezza alpina.
Quando ricevi una provincia (es. IT-23 = Valle d'Aosta):
1. Chiama fetch_eaws_bulletin(province) — usa EAWS/avalanche.report per IT-32-BZ e IT-32-TN, AINEVA per gli altri
2. Se available=false, prova fetch_aineva_bulletin(province) come fallback
3. Se entrambi falliscono, dì esplicitamente "bollettino non disponibile" e suggerisci aineva.it
4. MAI inventare pericoli o condizioni non presenti nei dati.
Riporta: livello di pericolo, problemi valanghivi, esposizioni e quote critiche.""",
        markdown=True,
    )

    agente_web = Agent(
        name="Agente Web",
        role="Notizie recenti e relazioni di gita",
        model=_model(),
        tools=[WebSearchTools(backend="auto", fixed_max_results=5)],
        instructions="""Sei specializzato nella ricerca di informazioni recenti online.
Per la zona richiesta:
1. Cerca "[nome zona] condizioni neve scialpinismo" (ultimi 7 giorni)
2. Cerca "[nome zona] valanghe aggiornamento"
3. Restituisci 2-3 risultati rilevanti con: titolo, URL, sommario di una riga
4. Preferisci fonti alpinistiche italiane: cai.it, planetmountain.com, neveitalia.it, gognablog.com
5. Se non trovi nulla di recente, dilo chiaramente.""",
        markdown=True,
    )

    coordinator = Team(
        name="Alpine Expert Team",
        mode=TeamMode.coordinate,
        model=_model(),
        members=[agente_terreno, agente_neve_meteo, agente_valanghe, agente_web],
        instructions="""Sei il coordinatore dell'Alpine Expert Team.
Ricevi domande su condizioni per scialpinismo e le deleghi ai tuoi 4 specialisti.

Processo:
1. Delega in parallelo a tutti e 4 gli agenti
2. Sintetizza le risposte in questo formato markdown:

## Cime vicine [raggio] km da [coordinate o zona]
[tabella da Agente Terreno]

## Neve e Meteo
[dati da Agente Neve/Meteo]

## Bollettino Valanghe — [provincia]
[dati da Agente Valanghe]

## Notizie Recenti
[links da Agente Web]

## Verdetto
[1-3 frasi: è sicuro uscire oggi? quali cime consigliare? a che ora partire?]

Regola fondamentale: se un agente dice "dati non disponibili", riportalo fedelmente — non completare con dati inventati.""",
        markdown=True,
    )

    return coordinator
