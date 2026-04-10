import { createContext, useContext, useReducer } from 'react'
import { DEFAULT_ZONE } from '../data/zones.js'

const initialState = {
  selectedDate: new Date().toISOString().split('T')[0], // overwritten by findLatestGibsDate on mount
  selectedProvince: DEFAULT_ZONE.id,
  layers: {
    snow: true,
    avalanche: true,
    satellite: false,
    trueColor: false,
    sentinel: false,      // EOX Sentinel-2 2024 cloudless basemap (10m)
    sentinelSnow: false,  // Copernicus Sentinel-2 NDSI snow cover live (10m, richiede backend)
    peaks: true,          // vette alpine da OpenStreetMap
    topo: false,          // curve di livello MapTiler vettoriali
    slope: false,         // pendenza valanghe (gradi) — server-side Terrarium DEM
    lidarSlope: false,    // pendenza LiDAR 1m — solo province con dati (IT-21, IT-23)
    satView: false,   // satellite base mode: hides OSM fills, activates Sentinel-2 + hillshade
  },
  theme: 'dark',
  bulletin: null,
  lidarProvinces: [],   // province con dati LiDAR disponibili (da /api/lidar/available)
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
    case 'SET_LIDAR_PROVINCES':
      return { ...state, lidarProvinces: action.payload }
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
