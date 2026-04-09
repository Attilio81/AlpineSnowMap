import { useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'

const SOURCE_ID = 'slope-angle'
const LAYER_ID  = 'slope-angle-layer'
const API_BASE  = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
const TILES     = [`${API_BASE}/api/slope/{z}/{x}/{y}.png`]

export default function SlopeLayer({ mapRef }) {
  const { state } = useApp()

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    map.addSource(SOURCE_ID, {
      type: 'raster',
      tiles: TILES,
      tileSize: 256,
      minzoom: 7,
      maxzoom: 14,
      attribution: '© Mapzen Terrain Tiles / AWS',
    })

    map.addLayer({
      id: LAYER_ID,
      type: 'raster',
      source: SOURCE_ID,
      paint: { 'raster-opacity': 0.75 },
      layout: { visibility: state.layers.slope ? 'visible' : 'none' },
    })

    return () => {
      try {
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
      } catch {}
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.getLayer(LAYER_ID)) return
    map.setLayoutProperty(LAYER_ID, 'visibility', state.layers.slope ? 'visible' : 'none')
  }, [state.layers.slope])

  return null
}
