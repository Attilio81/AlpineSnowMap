import { useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'

const SOURCE_ID = 'copernicus-snow'
const LAYER_ID  = 'copernicus-snow-layer'
const API_BASE  = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

function buildUrl(date) {
  return `${API_BASE}/api/snow/{z}/{x}/{y}.png?date=${date}`
}

export default function CopernicusSnowLayer({ mapRef }) {
  const { state, dispatch } = useApp()

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    map.addSource(SOURCE_ID, {
      type: 'raster',
      tiles: [buildUrl(state.selectedDate)],
      tileSize: 256,
      maxzoom: 13,
      attribution: '© Copernicus / Sentinel-2',
    })

    const layers = map.getStyle().layers
    const anchor = layers.find(l => l.type === 'line')?.id
                ?? layers.find(l => l.type === 'symbol')?.id

    map.addLayer(
      {
        id: LAYER_ID,
        type: 'raster',
        source: SOURCE_ID,
        paint: { 'raster-opacity': 0.85 },
        layout: { visibility: state.layers.sentinelSnow ? 'visible' : 'none' },
      },
      anchor
    )

    let toastFired = false
    const handleError = e => {
      if (e.sourceId === SOURCE_ID && !toastFired) {
        toastFired = true
        dispatch({ type: 'SET_TOAST', payload: { message: 'Neve Sentinel: nessun dato per questa data', type: 'info' } })
      }
    }
    map.on('error', handleError)

    return () => {
      try {
        map.off('error', handleError)
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
      } catch {}
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.getSource(SOURCE_ID)) return
    map.getSource(SOURCE_ID).setTiles([buildUrl(state.selectedDate)])
  }, [state.selectedDate])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.getLayer(LAYER_ID)) return
    map.setLayoutProperty(LAYER_ID, 'visibility', state.layers.sentinelSnow ? 'visible' : 'none')
  }, [state.layers.sentinelSnow])

  return null
}
