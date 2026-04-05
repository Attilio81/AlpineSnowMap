import { useEffect } from 'react'
import { findZoneByCoords, DEFAULT_ZONE } from '../data/zones.js'
import { useApp } from '../context/AppContext.jsx'

export function useGeolocation() {
  const { dispatch } = useApp()

  useEffect(() => {
    if (!navigator.geolocation) {
      dispatch({ type: 'SET_PROVINCE', payload: DEFAULT_ZONE.id })
      return
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const zone = findZoneByCoords(coords.longitude, coords.latitude)
        dispatch({ type: 'SET_PROVINCE', payload: zone.id })
      },
      () => {
        dispatch({ type: 'SET_PROVINCE', payload: DEFAULT_ZONE.id })
      },
      { timeout: 5000 }
    )
  }, [])
}
