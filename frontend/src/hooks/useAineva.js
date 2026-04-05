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
