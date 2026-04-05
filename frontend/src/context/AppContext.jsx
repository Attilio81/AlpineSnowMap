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
  bulletin: null,
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
