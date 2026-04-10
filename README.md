# AlpineSnowMap

![AlpineSnowMap](immagine1.png)

Mappa interattiva delle condizioni nivologiche alpine italiane. Combina dati satellite, bollettini valanghe e un team di agenti AI specializzati per pianificare gite scialpinistiche in sicurezza.

## Funzionalità

- **Mappa 3D** — MapLibre GL con terreno DEM, hillshade e stile OpenFreeMap Liberty
  - Terrain: MapTiler terrain-rgb-v2 (maxzoom 15) se `VITE_MAPTILER_KEY` è configurata, altrimenti Terrarium AWS (maxzoom 14)
- **Layer neve**
  - MODIS Terra NDSI Snow Cover (giornaliero, NASA GIBS)
  - MODIS True Color (giornaliero)
  - Sentinel-2 10m cloudless basemap (EOX)
  - Copernicus Sentinel-2 NDSI snow cover live (via backend)
- **Bollettini valanghe** — EAWS/avalanche.report (IT-32-BZ, IT-32-TN) e AINEVA CAAML XML per tutte le province italiane
- **Vette** — Cime alpine da OpenStreetMap con pendenza DEM per ognuna
- **Pendenza valanghe** — Layer RGBA calcolato server-side da DEM Terrarium (zoom 7–14)
- **Pendenza LiDAR 1m** — Layer ad alta risoluzione da GeoTIFF regionale (zoom 10–15); attivo automaticamente per le province con dati preparati (Piemonte, Valle d'Aosta)
- **Curve di livello** — Topo vettoriali MapTiler
- **Satellite** — MapTiler satellite-v2 (512px, maxzoom 20) se key configurata, altrimenti Esri World Imagery
- **Registrazione traccia GPX** — Waypoint manuali con profilo altimetrico ed esportazione GPX
- **Analisi rischio traccia** — Il pannello traccia invia il percorso all'agente AI per una valutazione del rischio
- **Ricerca luoghi** — Geocoding Nominatim
- **Click coordinate** — Clic sulla mappa mostra lat/lon con copia negli appunti
- **AI Alpine Chat** — Chat con agente singolo DeepSeek + 7 tool MCP per query in linguaggio naturale (drag & resize, rendering Markdown)
- **Team AI multi-agente** — 4 agenti specializzati coordinati da un leader, per analisi complete "ha senso uscire oggi?"
- **Export scena Blender** — Genera un JSON con griglia DEM, pendenza, posizione solare, bollettino e cime; pronto per Claude + Blender MCP

## Team di Agenti AI

Il backend espone due modalità AI:

### Agente singolo — `POST /api/agent/query`
Agente DeepSeek collegato a 7 tool MCP (pendenza, cime, neve, valanghe, analisi traccia). Ottimo per domande dirette su una zona o coordinate.

### Team coordinato — `POST /api/agent/team`
Quattro agenti specializzati lavorano in parallelo e un coordinatore sintetizza i risultati in un report strutturato.

```
┌─────────────────────────────────────────────────────────────┐
│                    Coordinatore (Team Leader)                 │
│         "Ha senso uscire oggi vicino a [zona]?"              │
│                  DeepSeek · coordinate mode                  │
└────────┬──────────────┬──────────────┬─────────────────┬────┘
         │              │              │                  │
         ▼              ▼              ▼                  ▼
  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌───────────┐
  │ Agente   │  │ Agente       │  │ Agente   │  │ Agente    │
  │ Terreno  │  │ Neve/Meteo   │  │ Valanghe │  │ Web       │
  └──────────┘  └──────────────┘  └──────────┘  └───────────┘
```

#### Agente Terreno
- **Fonte:** OpenStreetMap (Overpass API) + DEM Terrarium 10m
- **Output:** Tabella cime vicine con quota, distanza, pendenza media/max, flag `ski_suitable` (25–35°)

#### Agente Neve/Meteo
- **Fonti:** Open-Meteo (gratuito) + NASA GIBS MODIS (500m daily) + Copernicus Sentinel-2 (10m, ~5 giorni)
- **Output:** Zero termico, vento, neve fresca 48h, copertura neve MODIS e Sentinel-2

#### Agente Valanghe
- **Fonti:** EAWS/avalanche.report (IT-32-BZ, IT-32-TN) → fallback AINEVA CAAML XML
- **Output:** Livello di pericolo (1–5), problemi valanghivi, esposizioni e quote critiche

#### Agente Web
- **Fonte:** DuckDuckGo (via `ddgs`, gratuito)
- **Output:** 2–3 link recenti (≤7 giorni) su condizioni neve e relazioni di gita

#### Risposta del Coordinatore (esempio)
```markdown
## Cime vicine (raggio 10 km da 45.826°N 7.493°E)
| Cima            | Quota  | Dist   | Pend. media | Sci-alp |
|-----------------|--------|--------|-------------|---------|
| Monte Roisetta  | 3333 m | 2.1 km | 29°         | ✓       |
| Becca di Nona   | 3142 m | 3.8 km | 22°         | —       |
| Punta Tersiva   | 3515 m | 5.2 km | 31°         | ✓       |

## Neve e Meteo
- Zero termico: 2800 m · Vento: 15 km/h NW · Neve fresca 48h: 8 cm
- MODIS (oggi): neve presente ✓ · Sentinel-2 (5 apr): 82% neve densa

## Bollettino Valanghe — Valle d'Aosta (EAWS)
- **Pericolo:** 2 (Limitato) <2200 m · 3 (Marcato) >2200 m
- Problemi: neve ventata (NE-E-SE sopra 2000 m)

## Verdetto
⚠️ Uscita possibile: zero termico favorevole, pericolo marcato sopra 2200 m.
Consigliato: Monte Roisetta (versante N, partenza all'alba).
```

## Export Blender MCP

`GET /api/export/blender-scene` restituisce un JSON con tutti i dati necessari a **Claude + Blender MCP** per generare una scena 3D fotorealistica della zona:

```json
{
  "meta":    { "zone": "Valle d'Aosta", "date": "2026-04-10", "center": {...} },
  "terrain": { "elevation_grid": [[...]], "slope_grid": [[...]], "source": "LiDAR 1m regionale" },
  "sun":     { "azimuth_deg": 142, "elevation_deg": 38 },
  "avalanche": { "danger_level": 3, "color_hex": "#FF9900", "problems": [...] },
  "peaks":   [{ "name": "Monte Roisetta", "ele": 3333, "distance_km": 2.1 }],
  "blender_hints": { "suggested_workflow": ["1. Crea Mesh > Grid...", "..."] }
}
```

Quando disponibile, il campo `terrain.source` vale `"LiDAR 1m regionale"` (Piemonte, Valle d'Aosta) invece di `"Terrarium DEM 30m"`.

**Workflow:** scarica il file → apri Claude Desktop con Blender MCP collegato → allega il JSON → Claude crea la scena in Blender seguendo i `blender_hints`.

## LiDAR Regionale

Layer di pendenza ad alta risoluzione da GeoTIFF DTM regionali (1–2m vs 30m di Terrarium). Visibile nella UI solo per le province con dati preparati.

### Setup (una volta sola)

**1. Installa rasterio**
```bash
# Ubuntu/Debian
sudo apt-get install libgdal-dev && pip install rasterio>=1.3

# macOS
brew install gdal && pip install rasterio>=1.3
```

**2. Scarica i DTM regionali (gratuiti)**

| Regione | Risoluzione | Fonte |
|---|---|---|
| Piemonte | 1–5 m | geoportale.piemonte.it → Dati → DTM |
| Valle d'Aosta | 2 m | geoportale.regione.vda.it → Download → DTM |

Scarica i file `.tif` in `backend/lidar/raw/piemonte/` e `backend/lidar/raw/vda/`.

**3. Prepara i GeoTIFF (merge + riproiezione WGS84)**
```bash
python backend/lidar/prepare.py piemonte backend/lidar/raw/piemonte/
python backend/lidar/prepare.py vda      backend/lidar/raw/vda/
# Output: backend/lidar/piemonte.tif, backend/lidar/vda.tif
```

**4. Riavvia il backend** — il layer "Pendenza LiDAR 1m" compare automaticamente nel pannello layer quando si naviga su Piemonte o Valle d'Aosta.

## Stack

| Componente | Tecnologia |
|---|---|
| Frontend | React 19, Vite, MapLibre GL JS |
| Backend | FastAPI, Python 3.11+ |
| AI Agent | Agno + DeepSeek (via OpenAI-compatible API) |
| AI Team | Agno Team (coordinate mode), 4 agenti specializzati |
| MCP Server | FastMCP (SSE), 7 tool |
| Terrain 3D | MapTiler terrain-rgb-v2 (maxzoom 15) · fallback Terrarium AWS |
| Satellite | MapTiler satellite-v2 (512px) · fallback Esri World Imagery |
| Dati neve | NASA GIBS MODIS (500m), Copernicus Sentinel-2 (10m) |
| Meteo | Open-Meteo (gratuito, no API key) |
| Bollettini | EAWS/avalanche.report + AINEVA CAAML v5.0 XML |
| LiDAR | rasterio + GeoTIFF regionali (1–2m, Piemonte / Valle d'Aosta) |
| Ricerca web | DuckDuckGo via ddgs (gratuito, no API key) |

## Avvio rapido

### Windows — un click
```
start.bat
```
Crea il virtualenv, installa le dipendenze, avvia backend e frontend in finestre separate.

### Manuale

**Backend**
```bash
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
cp .env.example .env   # e compila le chiavi
.venv/Scripts/python -m uvicorn main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Docs API: http://localhost:8000/docs
- MCP SSE: http://localhost:8000/mcp/sse

## Configurazione

### `backend/.env`
```
# Copernicus Data Space Ecosystem — OAuth client credentials
# Registrazione gratuita su https://dataspace.copernicus.eu
COPERNICUS_CLIENT_ID=your_client_id_here
COPERNICUS_CLIENT_SECRET=your_client_secret_here

# AI Agent — DeepSeek
# Chiave su https://platform.deepseek.com
DEEPSEEK_API_KEY=sk-...
AGENT_PROVIDER=deepseek
AGENT_MODEL_ID=deepseek-chat

# CORS — origini separate da virgola
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174

# MCP SSE URL (interno — stesso processo)
MCP_SSE_URL=http://localhost:8000/mcp/sse
```

### `frontend/.env.local`
```
VITE_API_BASE_URL=http://localhost:8000
VITE_MAPTILER_KEY=...   # gratuito su maptiler.com
                        # abilita terrain-rgb-v2, satellite-v2, curve di livello
VITE_USE_MOCK=false
```

> **Nota:** senza `VITE_MAPTILER_KEY` il 3D usa Terrarium AWS (funziona comunque), il satellite usa Esri e le curve di livello non sono disponibili.

## Province supportate

| Codice | Zona | LiDAR |
|---|---|---|
| IT-21 | Piemonte | ✓ (1m, setup manuale) |
| IT-23 | Valle d'Aosta | ✓ (2m, setup manuale) |
| IT-25 | Lombardia | — |
| IT-32-BZ | Alto Adige / Südtirol | — |
| IT-32-TN | Trentino | — |
| IT-34 | Veneto | — |
| IT-36 | Friuli Venezia Giulia | — |
| IT-57 | Toscana (Appennino) | — |

## API Endpoints

| Metodo | Path | Descrizione |
|--------|------|-------------|
| `POST` | `/api/agent/query` | Agente singolo — domanda libera in italiano |
| `POST` | `/api/agent/team` | Team 4 agenti — analisi completa con verdetto finale |
| `POST` | `/api/agent/route` | Analisi rischio traccia GPX |
| `GET` | `/api/peaks` | Cime alpine italiane (Overpass API, cache permanente) |
| `GET` | `/api/aineva/{province}` | Bollettino valanghe per provincia |
| `GET` | `/api/snow/{z}/{x}/{y}.png` | Tile neve Copernicus Sentinel-2 NDSI |
| `GET` | `/api/slope/{z}/{x}/{y}.png` | Tile pendenza Terrarium (zoom 7–14) |
| `GET` | `/api/lidar/available` | Province con dati LiDAR disponibili |
| `GET` | `/api/lidar/slope/{province}/{z}/{x}/{y}.png` | Tile pendenza LiDAR 1m (zoom 10–15) |
| `GET` | `/api/export/blender-scene` | JSON scena 3D per Claude + Blender MCP |
| `GET` | `/mcp/sse` | MCP SSE endpoint (agenti + Claude Desktop) |

### Parametri `/api/export/blender-scene`

| Param | Default | Descrizione |
|---|---|---|
| `lat` | — | Latitudine centro (obbligatorio) |
| `lon` | — | Longitudine centro (obbligatorio) |
| `province` | `IT-23` | Codice provincia AINEVA |
| `date` | oggi | Data YYYY-MM-DD |
| `hour` | `9` | Ora UTC di riferimento |
| `radius_km` | `10` | Raggio area in km (1–30) |
| `grid_size` | `64` | Risoluzione griglia NxN (16–128) |

### Formato richiesta team
```json
POST /api/agent/team
{
  "message": "Quali cime sono adatte oggi vicino a Torgnon?",
  "province": "IT-23"
}
```

## Note tecniche

- Il layer MODIS ha latenza di ~1–2 giorni su NASA GIBS; l'app cerca automaticamente la data più recente disponibile
- Sentinel-2 ha revisita ~5 giorni — dati non giornalieri
- I bollettini valanghe sono cachati 6 ore nel backend
- EAWS/avalanche.report è usato come fonte primaria per IT-32-BZ e IT-32-TN; AINEVA come fallback per le altre province
- Il team AI ha timeout di 60s — le risposte del team richiedono più tempo dell'agente singolo
- Tutti gli agenti seguono la regola "mai inventare dati": se un tool fallisce, lo dichiarano esplicitamente
- Le API validano coordinate (bounding box Alpi: lat 44–47.2°, lon 6.5–14°), province e date; input non validi → HTTP 400
- Costanti di configurazione (soglie pendenza, NDSI, colori rischio) centralizzate in `backend/config.py`
- I tile LiDAR vengono generati on-demand da Cloud Optimized GeoTIFF e cachati in memoria (LRU 4000 tile, TTL 30 giorni HTTP)
- Senza `VITE_MAPTILER_KEY`: terrain 3D usa Terrarium (maxzoom 14), satellite usa Esri, curve di livello disabilitate
- La chiave DeepSeek non è mai esposta al browser: il frontend chiama solo il backend locale, che la usa server-side via HTTPS
