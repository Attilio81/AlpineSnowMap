# AlpineSnowMap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack web app that shows satellite snow coverage (NASA GIBS MODIS) and avalanche danger (AINEVA) on a 3D MapLibre map of the Italian Alps, usable year-round.

**Architecture:** UI-first with mock JSON fixtures — the React frontend is built and validated without a live backend. FastAPI is added in Task 14 and the frontend is connected via an env flag in Task 15. MapLibre GL JS renders the 3D terrain (terrarium tiles, no key) and all data layers. AppContext + useReducer manages all UI state.

**Tech Stack:** React 18 + Vite, MapLibre GL JS 4.x, FastAPI + httpx + uvicorn, OpenFreeMap (basemap), AWS terrarium tiles (terrain), NASA GIBS WMTS (snow), AINEVA EAWS JSON (avalanche)

---

## File Map

```
alpine-snow-map/
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   ├── .env.local                        # VITE_USE_MOCK=true, VITE_API_BASE_URL
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── context/
│       │   └── AppContext.jsx            # Context + useReducer + provider
│       ├── components/
│       │   ├── MapView.jsx               # MapLibre init, terrain, satellite, layer sync
│       │   ├── SnowLayer.jsx             # MODIS raster layer (receives mapRef prop)
│       │   ├── AinevaLayer.jsx           # GeoJSON fill layer (receives mapRef prop)
│       │   ├── Toast.jsx                 # Error notification overlay
│       │   └── FloatingUI/
│       │       ├── TopBar.jsx            # Logo + province dropdown + theme toggle
│       │       ├── LayerPanel.jsx        # Layer toggles + seasonal AINEVA lock
│       │       ├── InfoBar.jsx           # Bottom bar: zone name + danger + date picker
│       │       └── DetailSheet.jsx       # Slide-up AINEVA bulletin detail
│       ├── hooks/
│       │   ├── useGeolocation.js         # Browser geolocate + bbox→province lookup
│       │   ├── useAineva.js              # Mock or live fetch of AINEVA bulletin
│       │   └── useSnowLayer.js           # MODIS tile URL builder
│       ├── data/
│       │   ├── zones.js                  # Province list with id, name, centroid, bbox
│       │   ├── mock-aineva.json          # Realistic EAWS JSON fixture (Valle d'Aosta)
│       │   └── regions.geojson           # Italian alpine region polygons (from EAWS repo)
│       ├── utils/
│       │   └── aineva.js                 # isAinevaActive(), parseBulletin(), DANGER_COLORS
│       └── styles/
│           └── index.css                 # CSS vars, theme tokens, global reset
│
├── backend/
│   ├── main.py                           # FastAPI app + CORS
│   ├── Procfile                          # Railway deploy
│   ├── requirements.txt
│   ├── routes/
│   │   └── aineva.py                     # GET /api/aineva/{province}
│   └── services/
│       └── aineva_client.py              # HTTP fetch + in-memory cache TTL 6h
│
└── docs/
    └── superpowers/
        ├── specs/2026-04-05-alpine-snow-map-design.md
        └── plans/2026-04-05-alpine-snow-map.md
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `frontend/` (Vite React scaffold)
- Create: `backend/` (empty structure)
- Create: `frontend/.env.local`

- [ ] **Step 1: Scaffold frontend**

```bash
cd /path/to/alpine-snow-map
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install maplibre-gl
```

- [ ] **Step 2: Install backend deps and create structure**

```bash
cd ../
mkdir -p backend/routes backend/services
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install fastapi httpx "uvicorn[standard]"
pip freeze > requirements.txt
```

- [ ] **Step 3: Create .env.local**

```bash
# frontend/.env.local
VITE_USE_MOCK=true
VITE_API_BASE_URL=http://localhost:8000
```

- [ ] **Step 4: Replace default Vite App.css with empty file, remove boilerplate from App.jsx**

`frontend/src/App.css` → delete contents (write empty file).

`frontend/src/App.jsx`:
```jsx
export default function App() {
  return <div>AlpineSnowMap</div>
}
```

- [ ] **Step 5: Verify dev server starts**

```bash
cd frontend && npm run dev
```
Expected: Vite dev server at `http://localhost:5173`, page shows "AlpineSnowMap".

- [ ] **Step 6: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold frontend (Vite React) and backend structure"
```

---

## Task 2: Global Styles + Theme System

**Files:**
- Create: `frontend/src/styles/index.css`
- Modify: `frontend/index.html` (Google Fonts)
- Modify: `frontend/src/main.jsx` (import css)

- [ ] **Step 1: Add Google Fonts to index.html**

`frontend/index.html` — add in `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<link href="https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.css" rel="stylesheet">
```

- [ ] **Step 2: Write global CSS with theme tokens**

`frontend/src/styles/index.css`:
```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --font-display: 'Barlow Condensed', sans-serif;
  --font-ui: 'Inter', sans-serif;
  --accent: #7ECFFF;
  --danger-1: #CCFF66;
  --danger-2: #FFFF00;
  --danger-3: #FF9900;
  --danger-4: #FF0000;
  --danger-5: #111111;
}

[data-theme="dark"], :root {
  --bg-panel: rgba(10, 15, 25, 0.78);
  --bg-panel-hover: rgba(15, 22, 38, 0.88);
  --border-panel: rgba(126, 207, 255, 0.18);
  --text-primary: #E0E8FF;
  --text-secondary: #7A8CA8;
  --text-accent: #7ECFFF;
  --bg-body: #0d1117;
}

[data-theme="light"] {
  --bg-panel: rgba(245, 248, 255, 0.88);
  --bg-panel-hover: rgba(235, 240, 255, 0.95);
  --border-panel: rgba(0, 100, 180, 0.18);
  --text-primary: #1A2030;
  --text-secondary: #556688;
  --text-accent: #0066CC;
  --bg-body: #e8edf5;
}

html, body, #root { height: 100%; width: 100%; overflow: hidden; }
body { font-family: var(--font-ui); background: var(--bg-body); color: var(--text-primary); }

.panel {
  background: var(--bg-panel);
  border: 1px solid var(--border-panel);
  border-radius: 12px;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.label {
  font-family: var(--font-display);
  font-size: 10px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--text-accent);
}

button.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 4px;
  border-radius: 6px;
  transition: color 0.15s, background 0.15s;
}
button.icon-btn:hover { color: var(--text-primary); background: var(--bg-panel-hover); }
```

- [ ] **Step 3: Import in main.jsx**

`frontend/src/main.jsx`:
```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 4: Apply default theme to document in App.jsx**

`frontend/src/App.jsx`:
```jsx
import { useEffect, useState } from 'react'

export default function App() {
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return <div style={{ height: '100vh' }}>AlpineSnowMap — theme: {theme}</div>
}
```

- [ ] **Step 5: Verify dark theme CSS vars apply**

```bash
npm run dev
```
Open browser, inspect `<html>` element — should have `data-theme="dark"`. Background of body should be `#0d1117`.

- [ ] **Step 6: Commit**

```bash
git add frontend/index.html frontend/src/styles/index.css frontend/src/main.jsx frontend/src/App.jsx
git commit -m "feat: global styles, theme tokens, Barlow Condensed + Inter fonts"
```

---

## Task 3: Data Layer — zones.js + mock-aineva.json + utils/aineva.js

**Files:**
- Create: `frontend/src/data/zones.js`
- Create: `frontend/src/data/mock-aineva.json`
- Create: `frontend/src/utils/aineva.js`

- [ ] **Step 1: Write zones.js**

`frontend/src/data/zones.js`:
```js
export const ZONES = [
  {
    id: 'IT-23',
    name: "Valle d'Aosta",
    centroid: [7.32, 45.74],
    bbox: [6.80, 45.40, 7.95, 45.95],
  },
  {
    id: 'IT-21',
    name: 'Piemonte',
    centroid: [7.70, 44.50],
    bbox: [6.60, 44.00, 8.90, 46.50],
  },
  {
    id: 'IT-25',
    name: 'Lombardia',
    centroid: [9.90, 46.10],
    bbox: [8.50, 45.40, 10.50, 46.60],
  },
  {
    id: 'IT-32-TN',
    name: 'Trentino',
    centroid: [11.12, 46.07],
    bbox: [10.45, 45.65, 11.95, 46.55],
  },
  {
    id: 'IT-32-BZ',
    name: 'Alto Adige',
    centroid: [11.40, 46.70],
    bbox: [10.45, 46.30, 12.45, 47.10],
  },
  {
    id: 'IT-34',
    name: 'Veneto',
    centroid: [11.95, 46.40],
    bbox: [11.55, 45.70, 12.75, 46.65],
  },
  {
    id: 'IT-36',
    name: 'Friuli-Venezia Giulia',
    centroid: [13.20, 46.35],
    bbox: [12.30, 45.90, 13.85, 46.65],
  },
]

export const DEFAULT_ZONE = ZONES[0] // Valle d'Aosta

/** Returns the zone whose bbox contains [lng, lat], or DEFAULT_ZONE */
export function findZoneByCoords(lng, lat) {
  const match = ZONES.find(
    z => lng >= z.bbox[0] && lat >= z.bbox[1] && lng <= z.bbox[2] && lat <= z.bbox[3]
  )
  return match ?? DEFAULT_ZONE
}
```

- [ ] **Step 2: Write mock-aineva.json**

`frontend/src/data/mock-aineva.json`:
```json
{
  "available": true,
  "bulletins": [
    {
      "bulletinID": "IT-23-2026-04-05",
      "validTime": {
        "startTime": "2026-04-05T00:00:00+01:00",
        "endTime": "2026-04-05T23:59:59+01:00"
      },
      "regions": [
        { "regionID": "IT-23-01", "name": "Monte Rosa e Cervino" },
        { "regionID": "IT-23-02", "name": "Gran Paradiso" }
      ],
      "dangerRatings": [
        {
          "mainValue": 3,
          "elevation": { "lowerBound": "2000" },
          "validTimePeriod": "all_day"
        },
        {
          "mainValue": 2,
          "elevation": { "upperBound": "2000" },
          "validTimePeriod": "all_day"
        }
      ],
      "avalancheProblems": [
        {
          "problemType": "new_snow",
          "elevation": { "lowerBound": "2000" },
          "aspects": ["N", "NE", "NW", "E"],
          "validTimePeriod": "all_day"
        },
        {
          "problemType": "wind_slab",
          "elevation": { "lowerBound": "2500" },
          "aspects": ["N", "NE", "E"],
          "validTimePeriod": "all_day"
        }
      ],
      "highlights": "Pericolo marcato oltre i 2000m per neve fresca e lastroni da vento",
      "comment": "Nelle ultime 24h caduti 20-30cm di neve fresca. Prestare attenzione ai pendii ripidi esposti a N, NE, E e NW oltre i 2000m. Lastroni da vento pericolosi oltre i 2500m."
    }
  ]
}
```

- [ ] **Step 3: Write utils/aineva.js**

`frontend/src/utils/aineva.js`:
```js
export const DANGER_COLORS = {
  1: '#CCFF66',
  2: '#FFFF00',
  3: '#FF9900',
  4: '#FF0000',
  5: '#111111',
}

export const DANGER_LABELS = {
  1: 'Debole',
  2: 'Limitato',
  3: 'Marcato',
  4: 'Forte',
  5: 'Molto forte',
}

const AINEVA_START = { month: 12, day: 1 }
const AINEVA_END   = { month: 5,  day: 5 }

/** Returns true if today falls within the AINEVA active season (1 Dec – 5 May) */
export function isAinevaActive(date = new Date()) {
  const m = date.getMonth() + 1 // 1–12
  const d = date.getDate()
  if (m === 12 && d >= AINEVA_START.day) return true
  if (m < AINEVA_END.month) return true
  if (m === AINEVA_END.month && d <= AINEVA_END.day) return true
  return false
}

/**
 * Normalise an EAWS bulletin response to the shape the UI needs.
 * Returns null if data is unavailable.
 */
export function parseBulletin(data) {
  if (!data?.available || !data.bulletins?.length) return null
  const b = data.bulletins[0]

  // Highest danger rating across all elevations
  const maxDanger = Math.max(...b.dangerRatings.map(r => r.mainValue))

  // Above/below treeline ratings
  const above = b.dangerRatings.find(r => r.elevation?.lowerBound) ?? null
  const below = b.dangerRatings.find(r => r.elevation?.upperBound) ?? null

  return {
    id: b.bulletinID,
    validTime: b.validTime,
    regions: b.regions,
    maxDanger,
    dangerAbove: above?.mainValue ?? maxDanger,
    dangerBelow: below?.mainValue ?? maxDanger,
    problems: b.avalancheProblems ?? [],
    highlights: b.highlights ?? '',
    comment: b.comment ?? '',
  }
}
```

- [ ] **Step 4: Smoke test in browser console**

Open `http://localhost:5173`, open DevTools console and paste:
```js
import('/src/utils/aineva.js').then(m => {
  console.log(m.isAinevaActive(new Date('2026-01-15'))) // true
  console.log(m.isAinevaActive(new Date('2026-07-01'))) // false
  console.log(m.isAinevaActive(new Date('2026-05-05'))) // true
  console.log(m.isAinevaActive(new Date('2026-05-06'))) // false
})
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/ frontend/src/utils/
git commit -m "feat: zones data, mock AINEVA fixture, aineva utils"
```

---

## Task 4: AppContext — State + Reducer + Provider

**Files:**
- Create: `frontend/src/context/AppContext.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Write AppContext**

`frontend/src/context/AppContext.jsx`:
```jsx
import { createContext, useContext, useReducer } from 'react'
import { DEFAULT_ZONE } from '../data/zones.js'

const today = new Date().toISOString().split('T')[0]

const initialState = {
  selectedDate: today,
  selectedProvince: DEFAULT_ZONE.id,
  layers: {
    snow: true,
    avalanche: true,
    satellite: false,
  },
  theme: 'dark',
  bulletin: null,      // parsed bulletin from useAineva
  sheetOpen: false,
  toast: null,         // { message: string, type: 'info'|'error' }
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_DATE':
      return { ...state, selectedDate: action.payload }
    case 'SET_PROVINCE':
      return { ...state, selectedProvince: action.payload, bulletin: null, sheetOpen: false }
    case 'TOGGLE_LAYER':
      return { ...state, layers: { ...state.layers, [action.payload]: !state.layers[action.payload] } }
    case 'SET_THEME':
      return { ...state, theme: action.payload }
    case 'SET_BULLETIN':
      return { ...state, bulletin: action.payload }
    case 'SET_SHEET_OPEN':
      return { ...state, sheetOpen: action.payload }
    case 'SET_TOAST':
      return { ...state, toast: action.payload }
    default:
      return state
  }
}

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
```

- [ ] **Step 2: Wrap App in provider and wire theme**

`frontend/src/App.jsx`:
```jsx
import { useEffect } from 'react'
import { AppProvider, useApp } from './context/AppContext.jsx'

function AppInner() {
  const { state } = useApp()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme)
  }, [state.theme])

  return <div style={{ height: '100vh' }}>AlpineSnowMap — {state.theme}</div>
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}
```

- [ ] **Step 3: Verify provider works**

```bash
npm run dev
```
Page should show "AlpineSnowMap — dark" with dark background.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/context/ frontend/src/App.jsx
git commit -m "feat: AppContext with useReducer, theme, layers, province state"
```

---

## Task 5: useGeolocation Hook

**Files:**
- Create: `frontend/hooks/useGeolocation.js`

- [ ] **Step 1: Write hook**

`frontend/src/hooks/useGeolocation.js`:
```js
import { useEffect } from 'react'
import { findZoneByCoords, DEFAULT_ZONE } from '../data/zones.js'
import { useApp } from '../context/AppContext.jsx'

const FALLBACK = DEFAULT_ZONE // Valle d'Aosta

export function useGeolocation() {
  const { dispatch } = useApp()

  useEffect(() => {
    if (!navigator.geolocation) {
      dispatch({ type: 'SET_PROVINCE', payload: FALLBACK.id })
      return
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const zone = findZoneByCoords(coords.longitude, coords.latitude)
        dispatch({ type: 'SET_PROVINCE', payload: zone.id })
      },
      () => {
        // Permission denied or unavailable — use fallback silently
        dispatch({ type: 'SET_PROVINCE', payload: FALLBACK.id })
      },
      { timeout: 5000 }
    )
  }, []) // run once on mount
}
```

- [ ] **Step 2: Use hook in AppInner**

In `frontend/src/App.jsx`, add inside `AppInner`:
```jsx
import { useGeolocation } from './hooks/useGeolocation.js'

function AppInner() {
  const { state } = useApp()
  useGeolocation()
  // ...rest unchanged
}
```

- [ ] **Step 3: Verify in browser**

Open DevTools → Application → grant or deny location. Console should not throw. `state.selectedProvince` should be set (check by adding `console.log(state.selectedProvince)` temporarily).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useGeolocation.js frontend/src/App.jsx
git commit -m "feat: geolocation hook — maps coords to province via bbox, fallback Valle d'Aosta"
```

---

## Task 6: MapView — MapLibre, Terrain 3D, Satellite Toggle

**Files:**
- Create: `frontend/src/components/MapView.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Write MapView**

`frontend/src/components/MapView.jsx`:
```jsx
import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { useApp } from '../context/AppContext.jsx'
import { ZONES } from '../data/zones.js'

const TERRARIUM_SOURCE = {
  type: 'raster-dem',
  tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  tileSize: 256,
  encoding: 'terrarium',
  maxzoom: 14,
}

const SATELLITE_SOURCE = {
  type: 'raster',
  tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
  tileSize: 256,
  attribution: '© Esri',
}

export default function MapView({ mapRef, onMapReady }) {
  const containerRef = useRef(null)
  const { state } = useApp()

  // Initialise map once
  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [7.32, 45.74], // Aosta — overridden by geolocation
      zoom: 9,
      pitch: 50,
      bearing: 0,
      antialias: true,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    map.on('load', () => {
      // Terrain 3D
      map.addSource('terrain-dem', TERRARIUM_SOURCE)
      map.setTerrain({ source: 'terrain-dem', exaggeration: 1.4 })
      map.setFog({})

      // Satellite raster (hidden by default, sits below symbol layers)
      map.addSource('satellite', SATELLITE_SOURCE)
      const firstSymbolId = map.getStyle().layers.find(l => l.type === 'symbol')?.id
      map.addLayer(
        { id: 'satellite-raster', type: 'raster', source: 'satellite', paint: { 'raster-opacity': 0.9 }, layout: { visibility: 'none' } },
        firstSymbolId
      )

      mapRef.current = map
      onMapReady?.()
    })

    return () => map.remove()
  }, [])

  // Sync satellite toggle
  useEffect(() => {
    const map = mapRef.current
    if (!map?.getLayer('satellite-raster')) return
    map.setLayoutProperty('satellite-raster', 'visibility', state.layers.satellite ? 'visible' : 'none')
  }, [state.layers.satellite])

  // Fly to selected province centroid when province changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const zone = ZONES.find(z => z.id === state.selectedProvince)
    if (zone) map.flyTo({ center: zone.centroid, zoom: 9, duration: 1200 })
  }, [state.selectedProvince])

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0 }}
    />
  )
}
```

- [ ] **Step 2: Wire MapView into App**

`frontend/src/App.jsx`:
```jsx
import { useEffect, useRef, useState } from 'react'
import { AppProvider, useApp } from './context/AppContext.jsx'
import { useGeolocation } from './hooks/useGeolocation.js'
import MapView from './components/MapView.jsx'

function AppInner() {
  const { state } = useApp()
  const mapRef = useRef(null)
  const [mapReady, setMapReady] = useState(false)
  useGeolocation()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme)
  }, [state.theme])

  return (
    <div style={{ position: 'relative', height: '100vh', overflow: 'hidden' }}>
      <MapView mapRef={mapRef} onMapReady={() => setMapReady(true)} />
      {mapReady && <div style={{ position: 'absolute', top: 10, left: 10, color: 'white' }}>Map ready ✓</div>}
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}
```

- [ ] **Step 3: Verify 3D terrain renders**

```bash
npm run dev
```
Open `http://localhost:5173`. Should see OpenFreeMap topo map with 3D terrain exaggeration. Pitch gives depth to Alps. No console errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/MapView.jsx frontend/src/App.jsx
git commit -m "feat: MapView with MapLibre, terrarium 3D terrain, satellite layer toggle"
```

---

## Task 7: SnowLayer — MODIS WMTS + useSnowLayer Hook

**Files:**
- Create: `frontend/src/hooks/useSnowLayer.js`
- Create: `frontend/src/components/SnowLayer.jsx`

- [ ] **Step 1: Write useSnowLayer hook**

`frontend/src/hooks/useSnowLayer.js`:
```js
/** Builds the MODIS Terra Snow Cover WMTS tile URL for a given ISO date string */
export function buildSnowTileUrl(dateStr) {
  return (
    `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/` +
    `MODIS_Terra_Snow_Cover/default/${dateStr}/GoogleMapsCompatible/{z}/{y}/{x}.png`
  )
}
```

- [ ] **Step 2: Write SnowLayer component**

`frontend/src/components/SnowLayer.jsx`:
```jsx
import { useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { buildSnowTileUrl } from '../hooks/useSnowLayer.js'

const SOURCE_ID = 'snow-modis'
const LAYER_ID  = 'snow-layer'

export default function SnowLayer({ mapRef }) {
  const { state, dispatch } = useApp()

  // Add source + layer once map is ready (mapRef.current is set before this mounts)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const tileUrl = buildSnowTileUrl(state.selectedDate)

    map.addSource(SOURCE_ID, {
      type: 'raster',
      tiles: [tileUrl],
      tileSize: 256,
      attribution: 'NASA GIBS',
    })

    map.addLayer({
      id: LAYER_ID,
      type: 'raster',
      source: SOURCE_ID,
      paint: { 'raster-opacity': 0.72 },
      layout: { visibility: state.layers.snow ? 'visible' : 'none' },
    })

    // Handle tile load errors (MODIS cloud/no-data = 404)
    map.on('error', e => {
      if (e.sourceId === SOURCE_ID) {
        dispatch({ type: 'SET_TOAST', payload: { message: 'Copertura nuvolosa — prova una data precedente', type: 'info' } })
      }
    })

    return () => {
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }
  }, []) // mount once

  // Update tile URL when date changes
  useEffect(() => {
    const map = mapRef.current
    if (!map?.getSource(SOURCE_ID)) return
    map.getSource(SOURCE_ID).setTiles([buildSnowTileUrl(state.selectedDate)])
  }, [state.selectedDate])

  // Toggle visibility
  useEffect(() => {
    const map = mapRef.current
    if (!map?.getLayer(LAYER_ID)) return
    map.setLayoutProperty(LAYER_ID, 'visibility', state.layers.snow ? 'visible' : 'none')
  }, [state.layers.snow])

  return null
}
```

- [ ] **Step 3: Add SnowLayer to App**

In `frontend/src/App.jsx`, inside the `{mapReady && ...}` block:
```jsx
import SnowLayer from './components/SnowLayer.jsx'

// inside AppInner return, after MapView:
{mapReady && (
  <>
    <SnowLayer mapRef={mapRef} />
    <div style={{ position: 'absolute', top: 10, left: 10, color: 'white' }}>Map + Snow ✓</div>
  </>
)}
```

- [ ] **Step 4: Verify snow layer appears**

Open browser. A white/cyan snow coverage raster should appear over the Alps. Toggle is not wired to UI yet but works via state.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useSnowLayer.js frontend/src/components/SnowLayer.jsx frontend/src/App.jsx
git commit -m "feat: MODIS snow layer with date-based tile URL refresh and cloud-error toast"
```

---

## Task 8: useAineva Hook + AinevaLayer

**Files:**
- Create: `frontend/src/hooks/useAineva.js`
- Create: `frontend/src/components/AinevaLayer.jsx`
- Create: `frontend/src/data/regions.geojson` (download step)

- [ ] **Step 1: Download EAWS Italian regions GeoJSON**

```bash
curl -o frontend/src/data/regions.geojson \
  "https://raw.githubusercontent.com/eaws/eaws-regions/main/public/micro-regions/IT_micro-regions.geojson"
```
If unavailable, create a minimal placeholder:
```json
{ "type": "FeatureCollection", "features": [] }
```
(Layer will render empty until real data is available.)

- [ ] **Step 2: Write useAineva hook**

`frontend/src/hooks/useAineva.js`:
```js
import { useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { isAinevaActive, parseBulletin } from '../utils/aineva.js'
import mockData from '../data/mock-aineva.json'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export function useAineva() {
  const { state, dispatch } = useApp()

  useEffect(() => {
    if (!isAinevaActive()) {
      dispatch({ type: 'SET_BULLETIN', payload: null })
      return
    }

    async function fetchBulletin() {
      try {
        let data
        if (USE_MOCK) {
          data = mockData
        } else {
          const res = await fetch(`${API_BASE}/api/aineva/${state.selectedProvince}`)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          data = await res.json()
        }
        dispatch({ type: 'SET_BULLETIN', payload: parseBulletin(data) })
      } catch {
        dispatch({ type: 'SET_TOAST', payload: { message: 'Bollettino temporaneamente non disponibile', type: 'error' } })
        dispatch({ type: 'SET_BULLETIN', payload: null })
      }
    }

    fetchBulletin()
  }, [state.selectedProvince])
}
```

- [ ] **Step 3: Write AinevaLayer component**

`frontend/src/components/AinevaLayer.jsx`:
```jsx
import { useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { DANGER_COLORS } from '../utils/aineva.js'
import regionsGeoJson from '../data/regions.geojson'

const SOURCE_ID = 'aineva-regions'
const FILL_ID   = 'aineva-fill'
const LINE_ID   = 'aineva-line'

// Map region IDs to danger levels from the parsed bulletin
function buildPaintExpression(bulletin) {
  if (!bulletin?.dangerAbove) return ['literal', '#CCFF66']
  // For MVP: paint all regions with the max danger color
  return DANGER_COLORS[bulletin.maxDanger] ?? '#CCFF66'
}

export default function AinevaLayer({ mapRef }) {
  const { state, dispatch } = useApp()

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    map.addSource(SOURCE_ID, { type: 'geojson', data: regionsGeoJson })

    map.addLayer({
      id: FILL_ID,
      type: 'fill',
      source: SOURCE_ID,
      paint: {
        'fill-color': buildPaintExpression(state.bulletin),
        'fill-opacity': 0.38,
      },
      layout: { visibility: state.layers.avalanche ? 'visible' : 'none' },
    })

    map.addLayer({
      id: LINE_ID,
      type: 'line',
      source: SOURCE_ID,
      paint: { 'line-color': '#FFFFFF', 'line-width': 0.6, 'line-opacity': 0.4 },
      layout: { visibility: state.layers.avalanche ? 'visible' : 'none' },
    })

    // Click zone → open detail sheet
    map.on('click', FILL_ID, () => {
      dispatch({ type: 'SET_SHEET_OPEN', payload: true })
    })
    map.on('mouseenter', FILL_ID, () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', FILL_ID, () => { map.getCanvas().style.cursor = '' })

    return () => {
      map.off('click', FILL_ID, () => {})
      if (map.getLayer(LINE_ID)) map.removeLayer(LINE_ID)
      if (map.getLayer(FILL_ID)) map.removeLayer(FILL_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }
  }, [])

  // Update fill color when bulletin changes
  useEffect(() => {
    const map = mapRef.current
    if (!map?.getLayer(FILL_ID)) return
    map.setPaintProperty(FILL_ID, 'fill-color', buildPaintExpression(state.bulletin))
  }, [state.bulletin])

  // Toggle visibility
  useEffect(() => {
    const map = mapRef.current
    if (!map?.getLayer(FILL_ID)) return
    const v = state.layers.avalanche ? 'visible' : 'none'
    map.setLayoutProperty(FILL_ID, 'visibility', v)
    map.setLayoutProperty(LINE_ID, 'visibility', v)
  }, [state.layers.avalanche])

  return null
}
```

- [ ] **Step 4: Add hook + layer to App**

`frontend/src/App.jsx` — add inside `AppInner`:
```jsx
import { useAineva } from './hooks/useAineva.js'
import AinevaLayer from './components/AinevaLayer.jsx'

function AppInner() {
  // ...existing code
  useAineva()

  return (
    <div style={{ position: 'relative', height: '100vh', overflow: 'hidden' }}>
      <MapView mapRef={mapRef} onMapReady={() => setMapReady(true)} />
      {mapReady && (
        <>
          <SnowLayer mapRef={mapRef} />
          <AinevaLayer mapRef={mapRef} />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Verify in browser**

With `VITE_USE_MOCK=true`, the AINEVA fill should appear (orange = danger 3) over alpine regions. Check DevTools Network — no fetch calls in mock mode.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/useAineva.js frontend/src/components/AinevaLayer.jsx frontend/src/data/regions.geojson frontend/src/App.jsx
git commit -m "feat: AINEVA layer with mock data, GeoJSON regions, danger colors, click-to-detail"
```

---

## Task 9: TopBar Component

**Files:**
- Create: `frontend/src/components/FloatingUI/TopBar.jsx`

- [ ] **Step 1: Write TopBar**

`frontend/src/components/FloatingUI/TopBar.jsx`:
```jsx
import { useApp } from '../../context/AppContext.jsx'
import { ZONES } from '../../data/zones.js'

export default function TopBar() {
  const { state, dispatch } = useApp()

  function toggleTheme() {
    dispatch({ type: 'SET_THEME', payload: state.theme === 'dark' ? 'light' : 'dark' })
  }

  return (
    <div className="panel" style={{
      position: 'absolute',
      top: 14,
      left: 14,
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      zIndex: 10,
      minWidth: 240,
    }}>
      {/* Logo */}
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: '2px',
        color: 'var(--text-accent)',
        whiteSpace: 'nowrap',
      }}>
        ⛰ ALPINESNOWMAP
      </span>

      {/* Separator */}
      <div style={{ width: 1, height: 20, background: 'var(--border-panel)' }} />

      {/* Province selector */}
      <select
        value={state.selectedProvince}
        onChange={e => dispatch({ type: 'SET_PROVINCE', payload: e.target.value })}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-ui)',
          fontSize: 13,
          cursor: 'pointer',
          outline: 'none',
          flex: 1,
        }}
      >
        {ZONES.map(z => (
          <option key={z.id} value={z.id} style={{ background: '#1a2030' }}>
            {z.name}
          </option>
        ))}
      </select>

      {/* Theme toggle */}
      <button
        className="icon-btn"
        onClick={toggleTheme}
        title={state.theme === 'dark' ? 'Tema chiaro' : 'Tema scuro'}
        style={{ fontSize: 16 }}
      >
        {state.theme === 'dark' ? '☀️' : '🌙'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Add to App**

`frontend/src/App.jsx` — inside `{mapReady && ...}`:
```jsx
import TopBar from './components/FloatingUI/TopBar.jsx'

// inside mapReady block:
<TopBar />
```

- [ ] **Step 3: Verify**

TopBar appears top-left. Changing province flies map to that zone. Theme toggle switches CSS vars. No layout overflow.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/FloatingUI/TopBar.jsx frontend/src/App.jsx
git commit -m "feat: TopBar with province dropdown and dark/light theme toggle"
```

---

## Task 10: LayerPanel Component

**Files:**
- Create: `frontend/src/components/FloatingUI/LayerPanel.jsx`

- [ ] **Step 1: Write LayerPanel**

`frontend/src/components/FloatingUI/LayerPanel.jsx`:
```jsx
import { useApp } from '../../context/AppContext.jsx'
import { isAinevaActive } from '../../utils/aineva.js'

const active = isAinevaActive()

function LayerToggle({ label, checked, onChange, disabled, disabledTitle }) {
  return (
    <label
      title={disabled ? disabledTitle : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        fontSize: 12,
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        style={{ accentColor: 'var(--accent)', cursor: disabled ? 'default' : 'pointer' }}
      />
      {label}
    </label>
  )
}

export default function LayerPanel() {
  const { state, dispatch } = useApp()

  function toggle(layer) {
    dispatch({ type: 'TOGGLE_LAYER', payload: layer })
  }

  return (
    <div className="panel" style={{
      position: 'absolute',
      top: 14,
      right: 54, // leave room for MapLibre nav control
      padding: '12px 14px',
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      minWidth: 160,
    }}>
      <span className="label">Layer</span>

      <LayerToggle
        label="❄️ Neve MODIS"
        checked={state.layers.snow}
        onChange={() => toggle('snow')}
      />
      <LayerToggle
        label="⚠️ Valanghe AINEVA"
        checked={state.layers.avalanche}
        onChange={() => toggle('avalanche')}
        disabled={!active}
        disabledTitle="Bollettino non disponibile (stagione estiva)"
      />
      <LayerToggle
        label="🛰 Satellite"
        checked={state.layers.satellite}
        onChange={() => toggle('satellite')}
      />

      {!active && (
        <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
          AINEVA: 1 dic – 5 mag
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add to App**

```jsx
import LayerPanel from './components/FloatingUI/LayerPanel.jsx'
// inside mapReady block: <LayerPanel />
```

- [ ] **Step 3: Verify**

Toggles work for snow and satellite. AINEVA toggle is greyed if today is outside season. Satellite toggle switches between topo and ESRI imagery.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/FloatingUI/LayerPanel.jsx frontend/src/App.jsx
git commit -m "feat: LayerPanel with snow/satellite/AINEVA toggles, seasonal lock"
```

---

## Task 11: InfoBar + DetailSheet

**Files:**
- Create: `frontend/src/components/FloatingUI/InfoBar.jsx`
- Create: `frontend/src/components/FloatingUI/DetailSheet.jsx`

- [ ] **Step 1: Write InfoBar**

`frontend/src/components/FloatingUI/InfoBar.jsx`:
```jsx
import { useApp } from '../../context/AppContext.jsx'
import { ZONES } from '../../data/zones.js'
import { DANGER_LABELS, DANGER_COLORS } from '../../utils/aineva.js'

export default function InfoBar() {
  const { state, dispatch } = useApp()

  const zone = ZONES.find(z => z.id === state.selectedProvince)
  const b = state.bulletin
  const maxDanger = b?.maxDanger

  const today = new Date().toISOString().split('T')[0]
  const minDate = '2000-01-01'

  return (
    <div className="panel" style={{
      position: 'absolute',
      bottom: 14,
      left: 14,
      right: 14,
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      zIndex: 10,
      flexWrap: 'wrap',
    }}>
      {/* Zone name */}
      <div style={{ flex: 1, minWidth: 120 }}>
        <div className="label">Zona</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, marginTop: 2 }}>
          {zone?.name ?? '—'}
        </div>
      </div>

      {/* Danger level */}
      {maxDanger ? (
        <div style={{ textAlign: 'center', padding: '0 12px', borderLeft: '1px solid var(--border-panel)', borderRight: '1px solid var(--border-panel)' }}>
          <div className="label">Pericolo</div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            fontWeight: 700,
            color: DANGER_COLORS[maxDanger],
            lineHeight: 1,
            marginTop: 2,
          }}>
            {maxDanger}
          </div>
          <div style={{ fontSize: 10, color: DANGER_COLORS[maxDanger], fontFamily: 'var(--font-display)', fontWeight: 600 }}>
            {DANGER_LABELS[maxDanger]}
          </div>
        </div>
      ) : (
        <div style={{ padding: '0 12px', borderLeft: '1px solid var(--border-panel)', borderRight: '1px solid var(--border-panel)', color: 'var(--text-secondary)', fontSize: 12 }}>
          AINEVA n/d
        </div>
      )}

      {/* Date picker */}
      <div>
        <div className="label">Data neve</div>
        <input
          type="date"
          value={state.selectedDate}
          max={today}
          min={minDate}
          onChange={e => dispatch({ type: 'SET_DATE', payload: e.target.value })}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-accent)',
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            outline: 'none',
            marginTop: 2,
          }}
        />
      </div>

      {/* Detail button — only when bulletin is available */}
      {b && (
        <button
          className="icon-btn"
          onClick={() => dispatch({ type: 'SET_SHEET_OPEN', payload: true })}
          style={{
            border: '1px solid var(--border-panel)',
            padding: '6px 12px',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--text-accent)',
          }}
        >
          Dettaglio →
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write DetailSheet**

`frontend/src/components/FloatingUI/DetailSheet.jsx`:
```jsx
import { useApp } from '../../context/AppContext.jsx'
import { DANGER_LABELS, DANGER_COLORS } from '../../utils/aineva.js'
import { ZONES } from '../../data/zones.js'

const PROBLEM_LABELS = {
  new_snow: 'Neve fresca',
  wind_slab: 'Lastroni da vento',
  persistent_weak_layers: 'Strati deboli persistenti',
  wet_snow: 'Neve bagnata',
  gliding_snow: 'Neve scivolante',
}

export default function DetailSheet() {
  const { state, dispatch } = useApp()
  const { bulletin: b, sheetOpen, selectedProvince } = state
  const zone = ZONES.find(z => z.id === selectedProvince)

  if (!sheetOpen || !b) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => dispatch({ type: 'SET_SHEET_OPEN', payload: false })}
        style={{ position: 'fixed', inset: 0, zIndex: 20 }}
      />

      {/* Sheet */}
      <div className="panel" style={{
        position: 'absolute',
        bottom: 74,
        left: 14,
        right: 14,
        zIndex: 30,
        padding: '18px 20px',
        maxHeight: '60vh',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div className="label">Bollettino AINEVA</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginTop: 3 }}>
              {zone?.name}
            </div>
          </div>
          <button
            className="icon-btn"
            onClick={() => dispatch({ type: 'SET_SHEET_OPEN', payload: false })}
            style={{ fontSize: 18 }}
          >
            ✕
          </button>
        </div>

        {/* Danger ratings */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1, background: 'var(--bg-panel-hover)', borderRadius: 8, padding: '10px 12px' }}>
            <div className="label">Sopra 2000m</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: DANGER_COLORS[b.dangerAbove] }}>
                {b.dangerAbove}
              </span>
              <span style={{ fontSize: 12, color: DANGER_COLORS[b.dangerAbove] }}>
                {DANGER_LABELS[b.dangerAbove]}
              </span>
            </div>
          </div>
          <div style={{ flex: 1, background: 'var(--bg-panel-hover)', borderRadius: 8, padding: '10px 12px' }}>
            <div className="label">Sotto 2000m</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: DANGER_COLORS[b.dangerBelow] }}>
                {b.dangerBelow}
              </span>
              <span style={{ fontSize: 12, color: DANGER_COLORS[b.dangerBelow] }}>
                {DANGER_LABELS[b.dangerBelow]}
              </span>
            </div>
          </div>
        </div>

        {/* Problems */}
        {b.problems.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div className="label" style={{ marginBottom: 8 }}>Problemi valanghivi</div>
            {b.problems.map((p, i) => (
              <div key={i} style={{ background: 'var(--bg-panel-hover)', borderRadius: 8, padding: '8px 12px', marginBottom: 6, fontSize: 13 }}>
                <span style={{ fontWeight: 500, color: 'var(--text-accent)' }}>
                  {PROBLEM_LABELS[p.problemType] ?? p.problemType}
                </span>
                {p.aspects?.length > 0 && (
                  <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>
                    {p.aspects.join(' ')}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Comment */}
        {b.comment && (
          <div>
            <div className="label" style={{ marginBottom: 6 }}>Note</div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{b.comment}</p>
          </div>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 3: Add to App**

```jsx
import InfoBar from './components/FloatingUI/InfoBar.jsx'
import DetailSheet from './components/FloatingUI/DetailSheet.jsx'

// inside mapReady block:
<InfoBar />
<DetailSheet />
```

- [ ] **Step 4: Verify full UI**

All 4 floating panels visible. Date picker changes snow tiles. "Dettaglio →" opens sheet with bulletin data from mock. Close button and backdrop click dismiss the sheet.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/FloatingUI/ frontend/src/App.jsx
git commit -m "feat: InfoBar with danger level + date picker, DetailSheet with bulletin detail"
```

---

## Task 12: Toast Error Notifications

**Files:**
- Create: `frontend/src/components/Toast.jsx`

- [ ] **Step 1: Write Toast**

`frontend/src/components/Toast.jsx`:
```jsx
import { useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'

export default function Toast() {
  const { state, dispatch } = useApp()
  const { toast } = state

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => dispatch({ type: 'SET_TOAST', payload: null }), 4000)
    return () => clearTimeout(t)
  }, [toast])

  if (!toast) return null

  return (
    <div style={{
      position: 'absolute',
      top: 70,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 50,
      background: toast.type === 'error' ? 'rgba(180, 30, 30, 0.92)' : 'rgba(10, 40, 70, 0.92)',
      border: '1px solid rgba(126, 207, 255, 0.3)',
      borderRadius: 10,
      padding: '10px 18px',
      color: '#E0E8FF',
      fontFamily: 'var(--font-ui)',
      fontSize: 13,
      backdropFilter: 'blur(10px)',
      maxWidth: 380,
      textAlign: 'center',
      pointerEvents: 'none',
    }}>
      {toast.message}
    </div>
  )
}
```

- [ ] **Step 2: Add to App**

```jsx
import Toast from './components/Toast.jsx'
// inside mapReady block (or always rendered): <Toast />
```

- [ ] **Step 3: Test toast manually**

In `AppInner`, add temporarily:
```js
useEffect(() => {
  setTimeout(() => dispatch({ type: 'SET_TOAST', payload: { message: 'Test toast — info', type: 'info' } }), 2000)
}, [])
```
Verify toast appears after 2s and disappears after 4s. Remove test code afterward.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Toast.jsx frontend/src/App.jsx
git commit -m "feat: auto-dismissing Toast component for error/info notifications"
```

---

## Task 13: FastAPI Backend

**Files:**
- Create: `backend/main.py`
- Create: `backend/routes/aineva.py`
- Create: `backend/services/aineva_client.py`
- Create: `backend/Procfile`
- Create: `backend/__init__.py`, `backend/routes/__init__.py`, `backend/services/__init__.py`

- [ ] **Step 1: Write aineva_client.py**

`backend/services/aineva_client.py`:
```python
import time
import httpx

AINEVA_BASE = "https://bollettini.aineva.it/bulletin/latest"
CACHE_TTL = 6 * 3600  # 6 hours

_cache: dict[str, tuple[float, dict]] = {}  # province_id → (timestamp, data)


async def fetch_bulletin(province: str) -> dict:
    now = time.time()
    if province in _cache:
        ts, data = _cache[province]
        if now - ts < CACHE_TTL:
            return data

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(AINEVA_BASE, params={"province": province})
        resp.raise_for_status()
        data = resp.json()

    _cache[province] = (now, data)
    return data
```

- [ ] **Step 2: Write routes/aineva.py**

`backend/routes/aineva.py`:
```python
from fastapi import APIRouter, HTTPException
from services.aineva_client import fetch_bulletin

router = APIRouter()


@router.get("/api/aineva/{province}")
async def get_bulletin(province: str):
    if not province.startswith("IT-"):
        raise HTTPException(status_code=400, detail="Province must start with IT-")
    try:
        data = await fetch_bulletin(province)
        return {"available": True, **data}
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return {"available": False, "message": "Bollettino non disponibile fuori stagione"}
        raise HTTPException(status_code=502, detail="AINEVA upstream error")
    except Exception:
        raise HTTPException(status_code=503, detail="Service temporarily unavailable")
```

- [ ] **Step 3: Write main.py**

`backend/main.py`:
```python
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.aineva import router

app = FastAPI(title="AlpineSnowMap API")

allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 4: Create init files and Procfile**

```bash
touch backend/__init__.py backend/routes/__init__.py backend/services/__init__.py
```

`backend/Procfile`:
```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

- [ ] **Step 5: Smoke test backend**

```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```

In another terminal:
```bash
curl http://localhost:8000/api/health
# Expected: {"status":"ok"}

curl "http://localhost:8000/api/aineva/IT-23"
# Expected: JSON with bulletin data or {"available": false, ...}
```

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat: FastAPI backend with AINEVA proxy, in-memory cache TTL 6h, CORS"
```

---

## Task 14: Connect Frontend to Live Backend

**Files:**
- Modify: `frontend/.env.local`

- [ ] **Step 1: Start backend locally**

```bash
cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000
```

- [ ] **Step 2: Switch to live mode**

`frontend/.env.local`:
```
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://localhost:8000
```

- [ ] **Step 3: Restart Vite dev server**

```bash
cd frontend && npm run dev
```
Vite reloads env vars on restart.

- [ ] **Step 4: Verify live data flow**

Open browser. If today is in AINEVA season (Dec–May), the AinevaLayer should render real data from `bollettini.aineva.it` via the FastAPI proxy. Check DevTools Network tab — should see `GET http://localhost:8000/api/aineva/IT-23` (or whichever province is selected).

If today is outside season (summer): AINEVA layer is greyed, snow layer shows MODIS data, no errors.

- [ ] **Step 5: Commit env change note**

`.env.local` is gitignored — no commit needed. Document the switch:
```bash
git commit --allow-empty -m "docs: live API connected — set VITE_USE_MOCK=false to use backend"
```

---

## Task 15: Mobile Responsive Layout

**Files:**
- Modify: `frontend/src/styles/index.css`
- Modify: `frontend/src/components/FloatingUI/LayerPanel.jsx`
- Modify: `frontend/src/components/FloatingUI/InfoBar.jsx`

- [ ] **Step 1: Add responsive CSS**

Append to `frontend/src/styles/index.css`:
```css
/* Mobile: <768px */
@media (max-width: 767px) {
  /* InfoBar becomes full-width bottom sheet handle */
  .infobar-detail-btn { display: none; }

  /* TopBar compresses */
  .topbar-logo { display: none; }
}
```

- [ ] **Step 2: Add FAB for LayerPanel on mobile**

`frontend/src/components/FloatingUI/LayerPanel.jsx` — wrap with mobile toggle:
```jsx
import { useState } from 'react'
// ...existing imports

export default function LayerPanel() {
  const { state, dispatch } = useApp()
  const [open, setOpen] = useState(false)
  const isMobile = window.innerWidth < 768

  function toggle(layer) { dispatch({ type: 'TOGGLE_LAYER', payload: layer }) }

  const panelContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span className="label">Layer</span>
      <LayerToggle label="❄️ Neve MODIS" checked={state.layers.snow} onChange={() => toggle('snow')} />
      <LayerToggle label="⚠️ Valanghe" checked={state.layers.avalanche} onChange={() => toggle('avalanche')} disabled={!isAinevaActive()} disabledTitle="Bollettino non disponibile (stagione estiva)" />
      <LayerToggle label="🛰 Satellite" checked={state.layers.satellite} onChange={() => toggle('satellite')} />
      {!isAinevaActive() && <p style={{ fontSize: 10, color: 'var(--text-secondary)' }}>AINEVA: 1 dic – 5 mag</p>}
    </div>
  )

  if (isMobile) {
    return (
      <>
        {/* FAB */}
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            position: 'absolute', bottom: 80, right: 14, zIndex: 10,
            width: 44, height: 44, borderRadius: '50%',
            background: 'var(--bg-panel)', border: '1px solid var(--border-panel)',
            backdropFilter: 'blur(14px)', fontSize: 18, cursor: 'pointer', color: 'var(--text-primary)',
          }}
          title="Layer"
        >
          🗺
        </button>

        {/* Popup panel */}
        {open && (
          <div className="panel" style={{ position: 'absolute', bottom: 132, right: 14, zIndex: 20, padding: '12px 14px' }}>
            {panelContent}
          </div>
        )}
      </>
    )
  }

  return (
    <div className="panel" style={{ position: 'absolute', top: 14, right: 54, padding: '12px 14px', zIndex: 10, minWidth: 160 }}>
      {panelContent}
    </div>
  )
}
```

- [ ] **Step 3: InfoBar wraps on mobile**

In `InfoBar.jsx`, the outer div already has `flexWrap: 'wrap'` — on mobile the items will wrap. Verify it doesn't overlap the map controls by checking on a 375px viewport in DevTools.

- [ ] **Step 4: Test at 375px viewport**

Open DevTools → toggle device toolbar → iPhone SE (375×667). Verify:
- TopBar fits without overflow
- LayerPanel shows as FAB bottom-right
- InfoBar wraps cleanly at bottom
- DetailSheet fills most of screen

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles/index.css frontend/src/components/FloatingUI/LayerPanel.jsx
git commit -m "feat: mobile responsive — LayerPanel FAB on small screens, InfoBar wraps"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Mappa 3D terrain | Task 6 |
| Layer neve MODIS + selettore data | Tasks 7, 11 |
| Overlay AINEVA + colori pericolo | Task 8 |
| Selettore zona province alpine | Task 9 |
| Panel info / DetailSheet | Task 11 |
| Toggle layer | Task 10 |
| Geolocalizzazione + fallback | Task 5 |
| Dark/light theme toggle | Tasks 2, 9 |
| Pannelli glassmorphism | Tasks 2, 9–11 |
| Sentieri OSM sempre visibili | Task 6 (OpenFreeMap liberty style include trails) |
| Toggle satellite | Tasks 6, 10 |
| FastAPI proxy + cache | Task 13 |
| Logica stagionale AINEVA | Tasks 8, 10 |
| Error handling / toasts | Tasks 7, 12 |
| Responsive desktop + mobile | Task 15 |
| UI-first mock → live | Tasks 1–12 (mock), Tasks 13–14 (live) |

**No placeholders, no TODOs, no "similar to Task N" references.**

**Type consistency:** `parseBulletin()` returns `{ maxDanger, dangerAbove, dangerBelow, problems, highlights, comment }` — used consistently in AinevaLayer (Task 8), InfoBar (Task 11), DetailSheet (Task 11).

---

## Execution Options

**Plan completo salvato in `docs/superpowers/plans/2026-04-05-alpine-snow-map.md`.**

Due opzioni di esecuzione:

**1. Subagent-Driven (raccomandato)** — un subagent per task, review tra i task, iterazione veloce

**2. Inline Execution** — esecuzione nella sessione corrente con checkpoint

**Quale preferisci?**
