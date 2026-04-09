# Alpine Multi-Agent Team — Design Spec
**Date:** 2026-04-09  
**Status:** Approved

## Goal

Replace the single DeepSeek agent with a coordinated team of 4 specialist agents. Given coordinates and a query (e.g. "cime adatte con pendenza 25-35° a Torgnon"), the team returns: nearby peaks with slope data, current weather, avalanche bulletin, and recent web reports — synthesized into a clear "ha senso uscire oggi?" verdict.

---

## Architecture

```
routes/agent.py
    POST /api/agent/query   → existing single agent (unchanged)
    POST /api/agent/team    → NEW: multi-agent team endpoint

services/
    agno_team.py            ← NEW: Agno Team factory (4 agents + coordinator)
    peaks_service.py        ← NEW: extract get_nearby_peaks logic from mcp_server.py
    openmeteo_client.py     ← NEW: Open-Meteo weather (free, no API key)
    eaws_client.py          ← NEW: EAWS avalanche bulletin (free, standard GeoJSON)
    agno_agent.py           ← existing, unchanged
    aineva_client.py        ← existing, unchanged
    slope_service.py        ← existing, unchanged
    copernicus_client.py    ← existing, unchanged

mcp_server.py
    + get_peaks_with_data() ← NEW MCP tool: peaks + slope in one call
```

---

## The 4 Specialist Agents

### 1. Agente Terreno
- **Role:** Identify nearby named peaks and evaluate each for ski touring suitability
- **Tools:**
  - `peaks_service.get_nearby_peaks(lat, lon, radius_km)` → name, ele, distance, coordinates
  - `slope_service.get_slope_stats(lat, lon)` → avg_slope_deg, max_slope_deg (called per peak)
- **Output:** Table of peaks with slope classification (optimal: avg 25-35°)
- **Instructions:** List every peak found; for the 5 closest call get_slope_stats at peak coordinates; mark ski_suitable if avg_slope_deg is 25-35°

### 2. Agente Meteo
- **Role:** Current mountain weather and recent snowfall
- **Tools:**
  - `openmeteo_client.get_mountain_weather(lat, lon)` → temperature, windspeed, snowfall last 48h, freezing level
- **Output:** Structured weather summary relevant to ski touring
- **Instructions:** Focus on freezing level (zero termico), fresh snow (ultimi 2 giorni), wind speed; flag dangerous conditions (wind > 50 km/h, rapid warming)

### 3. Agente Valanghe
- **Role:** Official avalanche bulletin
- **Tools:**
  - `eaws_client.fetch_bulletin(province)` → EAWS GeoJSON bulletin (primary)
  - `aineva_client.fetch_bulletin(province)` → AINEVA XML (fallback)
- **Output:** Danger level, problem types, critical aspects/elevations
- **Instructions:** Try EAWS first; if unavailable, try AINEVA; if both fail, say so explicitly — never invent danger ratings

### 4. Agente Web
- **Role:** Recent conditions reports and news
- **Tools:**
  - `WebSearchTools(timelimit="w", backend="auto")` — DuckDuckGo (free, no API key)
- **Output:** 2-3 recent links about snow conditions in the area
- **Instructions:** Search for "[zona] condizioni neve scialpinismo" and "[zona] valanghe aggiornamento"; return title + URL + one-line summary; prefer sources < 7 days old

### 5. Coordinatore (Team Leader)
- **Type:** `agno.team.team.Team` with `mode=TeamMode.coordinate`
- **Members:** [terreno, meteo, valanghe, web]
- **Model:** DeepSeek-chat (same as existing agent)
- **Instructions:** Delegate to all 4 members; synthesize into sections: Cime vicine, Meteo, Valanghe, Notizie, Verdetto finale
- **Output format:** Markdown with table for peaks, bullet lists for other sections

---

## New Data Sources

### Open-Meteo (free, no API key)
```
GET https://api.open-meteo.com/v1/forecast
    ?latitude={lat}&longitude={lon}
    &hourly=temperature_2m,snowfall,windspeed_10m,freezinglevel_height
    &past_days=2&forecast_days=1&models=best_match&timezone=Europe/Rome
```
Returns hourly data for past 2 days + today. Extract: freezing level now, snowfall sum last 48h, current wind speed, temperature at 2m.

### EAWS GeoJSON (free, European standard)
```
GET https://aws.eaws.app/api/public/bulletins?region={province}&lang=it
```
Returns standardized avalanche bulletin. More reliable than AINEVA XML. Province codes: IT-23 (Valle d'Aosta), IT-21 (Piemonte), IT-32-TN (Trentino), etc.

---

## New MCP Tool: `get_peaks_with_data`

Added to `mcp_server.py` for use by the single agent (existing `/api/agent/query` endpoint) and Claude Desktop.

```python
@mcp.tool()
async def get_peaks_with_data(lat: float, lon: float, radius_km: float = 10.0) -> list:
    """Cime alpine vicine con pendenza DEM inclusa. radius_km configurabile (default 10).
    Ritorna lista {name, ele, distance_km, avg_slope_deg, max_slope_deg, ski_suitable}."""
```

**Tile deduplication:** Multiple peaks often fall in the same Terrarium tile (zoom 12, ~10 km²). Cache tile results within a single call to avoid redundant HTTP requests. Expected: 1-3 unique tile fetches for 10-15 peaks in a 10 km radius.

**ski_suitable:** `True` when `25 <= avg_slope_deg <= 35`.

---

## New API Endpoint

```
POST /api/agent/team
Body: {"message": "Quali cime sono adatte oggi vicino a Torgnon?", "province": "IT-23"}
Returns: {"response": "<markdown string>"}
```

- Requires `DEEPSEEK_API_KEY` (same as existing endpoint)
- Timeout: 60s (team calls take longer than single agent)
- Error handling: if team fails, log and return 503

---

## Files to Create/Modify

| File | Action | What changes |
|---|---|---|
| `services/peaks_service.py` | CREATE | Extract Overpass query logic from mcp_server.py |
| `services/openmeteo_client.py` | CREATE | `get_mountain_weather(lat, lon) -> dict` |
| `services/eaws_client.py` | CREATE | `fetch_bulletin(province) -> dict` with 6h cache |
| `services/agno_team.py` | CREATE | `build_team() -> Team` factory |
| `mcp_server.py` | MODIFY | Add `get_peaks_with_data` tool; import from peaks_service |
| `routes/agent.py` | MODIFY | Add `POST /api/agent/team` endpoint |
| `requirements.txt` | MODIFY | Add `ddgs` (for WebSearchTools) |

---

## Expected Response Format

```markdown
## Cime vicine (raggio 10 km da 45.826°N 7.493°E)
| Cima | Quota | Distanza | Pend. media | Sci-alp |
|---|---|---|---|---|
| Monte Roisetta | 3333 m | 2.1 km | 29° | ✓ |
| Becca di Nona | 3142 m | 3.8 km | 22° | — |
| Punta Tersiva | 3515 m | 5.2 km | 31° | ✓ |

## Meteo oggi (Open-Meteo)
- Zero termico: 2800 m
- Neve fresca ultimi 2 giorni: 8 cm
- Vento: 15 km/h NW

## Bollettino valanghe — Valle d'Aosta (EAWS)
- **Pericolo:** 2 (Limitato) sotto 2200 m · 3 (Marcato) sopra 2200 m
- Problemi: neve ventata (NE-E-SE sopra 2000 m)

## Notizie recenti
- "Buone condizioni sui versanti nord di Torgnon..." — vallealpinenews.it (3 giorni fa)

## Verdetto
⚠️ **Uscita possibile con attenzione:** zero termico favorevole, ma pericolo marcato sopra 2200 m.
Consigliato: Monte Roisetta (versante N, partenza all'alba, rientro entro le 10:00).
```

---

## Out of Scope

- Streaming della risposta (mantenere risposta sincrona come oggi)
- Autenticazione / rate limiting
- Persistenza sessioni / memoria tra conversazioni
- Supporto multilingue (solo italiano)
