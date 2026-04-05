# AlpineSnowMap — Design Spec
**Data:** 2026-04-05  
**Stato:** approvato

---

## Panoramica

Web app per scialpinisti ed escursionisti che visualizza **innevamento satellitare** (NASA GIBS MODIS) e **pericolo valanghe AINEVA** su mappa 3D interattiva delle Alpi italiane. Funziona tutto l'anno: in estate mostra i nevai residui sui sentieri senza il layer valanghe (fuori stagione).

---

## Decisioni chiave

| Decisione | Scelta | Motivazione |
|---|---|---|
| Terrain tiles | Terrarium tiles (AWS Open Data) | Gratuiti, senza API key, encoding `terrarium` in MapLibre |
| Basemap | OpenFreeMap (`tiles.openfreemap.org`) | OSM gratuito, no key, stile `liberty` |
| Sentieri | Sempre visibili (layer vettoriale OSM) | Utili tutto l'anno per pianificazione percorsi |
| Backend | FastAPI su Railway | CORS proxy + cache AINEVA |
| State management | Context API + useReducer | Nessuna dipendenza extra, sufficiente per la complessità |
| Strategia build | UI-first con mock data | Valida il design prima di toccare il backend |
| Device target | Responsive desktop + mobile | Layout adattivo |
| Tema | Dark default + toggle dark/light | Colori AINEVA risaltano meglio su sfondo scuro |
| Vista iniziale | Geolocalizzazione browser | Fallback su Aosta se negata |
| Layout | Pannelli flottanti (glassmorphism) | Mappa sempre al 100%, estetica alpina |

---

## Architettura

```
frontend/          React + Vite
├── Mock phase:    fixture JSON locali (USE_MOCK=true in .env.local)
└── Live phase:    fetch reali via VITE_API_BASE_URL

backend/           FastAPI
├── /api/aineva/{province}   proxy + cache AINEVA (TTL 6h)
└── /api/health              healthcheck Railway
```

**Deploy:** Vercel (frontend) + Railway (backend)

---

## Layer mappa

| Layer | Tipo | Disponibilità | Toggle |
|---|---|---|---|
| Basemap topo | OpenFreeMap vettoriale | Sempre | Sì (vs satellite) |
| Basemap satellite | ESRI raster | Sempre | Sì (vs topo) |
| Sentieri OSM | Vettoriale sovrapposto | Sempre, anche su satellite | No (fisso) |
| Neve MODIS | NASA GIBS WMTS raster | Tutto l'anno (500m, daily) | Sì |
| Valanghe AINEVA | GeoJSON + fill colore | Solo 1 dic – 5 mag | Sì (greyed fuori stagione) |
| Terrain 3D | Terrarium DEM | Sempre | No (fisso) |

---

## Componenti frontend

```
App.jsx
├── MapView.jsx              MapLibre GL, terrain 3D, gestione layer
│   ├── SnowLayer.jsx        MODIS WMTS — tile URL con data selezionata
│   └── AinevaLayer.jsx      GeoJSON zone colorate (DANGER_COLORS)
├── FloatingUI/
│   ├── TopBar.jsx           Logo + search zona + theme toggle
│   ├── LayerPanel.jsx       Toggle layer (top-right, collassa in FAB su mobile)
│   └── InfoBar.jsx          Zona + grado pericolo + date picker (bottom)
└── DetailSheet.jsx          Slide-up con bollettino AINEVA completo
```

**AppContext state:**
```js
{
  selectedDate,        // data MODIS (default: oggi)
  selectedProvince,    // es. "IT-23"
  layers: {
    snow,              // bool
    avalanche,         // bool
    satellite,         // bool
  },
  theme,               // 'dark' | 'light'
  bulletin,            // dati AINEVA (mock → live)
  sheetOpen,           // DetailSheet visibile
}
```

**Responsive breakpoint:** `<768px` → LayerPanel collassa in FAB, InfoBar diventa bottom sheet scorrevole.

**TopBar zona selector:** dropdown precompilato con province alpine italiane (non ricerca testuale). In MVP: Valle d'Aosta, Piemonte, Lombardia, Trentino, Alto Adige, Veneto, Friuli.

**Geolocalizzazione → provincia:** coordinate browser confrontate con bounding box in `src/data/zones.js`. La prima provincia il cui bbox contiene il punto diventa `selectedProvince`. Se le coordinate sono fuori da tutte le zone alpine, fallback su Valle d'Aosta.

---

## Backend FastAPI

```
backend/
├── main.py                  app + CORS config
├── routes/aineva.py         GET /api/aineva/{province}
├── services/aineva_client.py  fetch + cache in-memory (TTL 6h)
└── requirements.txt         fastapi, httpx, uvicorn
```

**CORS:** `*` in dev, dominio Vercel in prod via `ALLOWED_ORIGINS`.  
**Cache:** dict Python con timestamp — invalida automaticamente dopo 6h.  
**Deploy:** `uvicorn main:app --host 0.0.0.0 --port $PORT` via Procfile.

---

## Logica stagionale AINEVA

- **1 dic – 5 mag:** AINEVA attivo → overlay valanghe + bollettino completo
- **6 mag – 30 nov:** AINEVA non disponibile:
  - Toggle valanghe greyed-out con tooltip `"Bollettino non disponibile (stagione estiva)"`
  - Backend restituisce `{"available": false, "message": "..."}`
  - Banner sottile in InfoBar: `"AINEVA attivo: 1 dic – 5 mag"`
  - Snow layer MODIS resta attivo — mostra nevai residui su sentieri

---

## Data flow

```
1. App load
   → geolocalizzazione → centra mappa (fallback: Aosta)
   → carica basemap + sentieri OSM
   → carica layer neve MODIS (data: oggi)
   → se stagione invernale → fetch /api/aineva/{province}

2. User cambia data neve
   → aggiorna URL tile MODIS → MapLibre recarga layer

3. User cambia provincia
   → fetch /api/aineva/{province} (da cache se disponibile)

4. User clicca zona AINEVA
   → apre DetailSheet con bollettino completo

5. Mock → Live
   → cambia USE_MOCK=false in .env.local
   → punta VITE_API_BASE_URL al backend locale o Railway
```

---

## Error handling

| Errore | Comportamento |
|---|---|
| Geolocalizzazione negata | Centra su Aosta (45.74°N, 7.32°E) |
| MODIS nuvoloso / no data | Toast: "Copertura nuvolosa — prova una data precedente" |
| AINEVA fuori stagione | Layer disabilitato + tooltip, nessun errore visibile |
| AINEVA timeout/errore | Toast: "Bollettino temporaneamente non disponibile" — app funziona senza overlay |
| Offline | Basemap cached dal browser, features API disabilitate con banner |

---

## Colori pericolo AINEVA

```js
const DANGER_COLORS = {
  1: '#CCFF66',  // Debole
  2: '#FFFF00',  // Limitato
  3: '#FF9900',  // Marcato
  4: '#FF0000',  // Forte
  5: '#000000',  // Molto forte
}
```

---

## Estetica UI (frontend-design)

- **Tema:** dark default, glassmorphism (`rgba(10,15,25,0.75)` + `backdrop-filter: blur(12px)`)
- **Accento:** ice blue `#7ECFFF`
- **Border pannelli:** `1px solid rgba(126,207,255,0.2)`
- **Font:** `Barlow Condensed` (display, etichette numeriche) + `Inter` (UI, testi lunghi) — Google Fonts, gratuiti
- **Layout:** pannelli flottanti, mappa sempre 100% viewport
- **Mobile:** FAB + bottom sheet espandibile

---

## Fuori scope (MVP)

- Autenticazione
- Sentinel-2 (v2)
- Slope angle overlay (v2)
- Meteo integrato (v2)
- Alert email/Telegram (v2)
- PWA offline (v2)
- Test automatici (post-MVP)
