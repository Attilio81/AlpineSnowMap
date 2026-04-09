# AlpineSnowMap

Mappa interattiva delle condizioni nivologiche alpine italiane. Combina dati satellite, bollettini valanghe AINEVA e un agente AI per pianificare gite scialpinistiche.

## Funzionalità

- **Mappa 3D** — MapLibre GL con terreno DEM Terrarium, hillshade e stile OpenFreeMap Liberty
- **Layer neve**
  - MODIS Terra NDSI Snow Cover (giornaliero, NASA GIBS)
  - MODIS True Color (giornaliero)
  - Sentinel-2 10m cloudless basemap (EOX)
  - Copernicus Sentinel-2 NDSI snow cover live (via backend)
- **Bollettini AINEVA** — Pericolo valanghe per provincia (IT-21/23/25/32-BZ/32-TN/34/36), dati reali da CAAML XML
- **Vette** — Cime alpine da OpenStreetMap
- **Pendenza** — Gradi di inclinazione calcolati server-side da DEM Terrarium
- **Curve di livello** — Topo vettoriali MapTiler
- **Satellite** — Esri World Imagery
- **Registrazione traccia GPX** — Waypoint manuali con esportazione GPX
- **Ricerca luoghi** — Geocoding Nominatim
- **Click coordinate** — Clic sulla mappa mostra lat/lon con copia negli appunti
- **AI Alpine Chat** — Agente DeepSeek + tool MCP per query in linguaggio naturale sulle condizioni alpine (drag & resize, rendering Markdown)

## Stack

| Componente | Tecnologia |
|---|---|
| Frontend | React 18, Vite, MapLibre GL JS |
| Backend | FastAPI, Python 3.11+ |
| AI Agent | Agno + DeepSeek (via OpenAI-compatible API) |
| MCP Server | FastMCP (SSE) |
| Dati neve | NASA GIBS, Copernicus/ESA, Terrarium DEM |
| Bollettini | AINEVA CAAML v5.0 XML |

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
cp .env.local.example .env.local   # e compila le chiavi
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Docs API: http://localhost:8000/docs
- MCP SSE: http://localhost:8000/mcp/sse

## Configurazione

### `backend/.env`
```
DEEPSEEK_API_KEY=sk-...
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
MCP_SSE_URL=http://localhost:8000/mcp/sse
```

### `frontend/.env.local`
```
VITE_API_BASE_URL=http://localhost:8000
VITE_MAPTILER_KEY=...        # gratuito su maptiler.com (per font e topo)
VITE_USE_MOCK=false
```

## Province supportate

| Codice | Zona |
|---|---|
| IT-21 | Piemonte |
| IT-23 | Valle d'Aosta |
| IT-25 | Lombardia |
| IT-32-BZ | Alto Adige / Südtirol |
| IT-32-TN | Trentino |
| IT-34 | Veneto |
| IT-36 | Friuli-Venezia Giulia |

## Note tecniche

- Il layer MODIS ha latenza di ~1-2 giorni su NASA GIBS; l'app cerca automaticamente la data più recente disponibile
- Sentinel-2 ha revisita ~5 giorni — dati non giornalieri
- I bollettini AINEVA sono aggiornati due volte al giorno e cachati 6 ore nel backend
- L'agente AI usa tool MCP per accedere a dati reali (pendenza, neve, bollettini) e non inventa mai valori
