import { useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'

const SOURCE_ID = 'lidar-slope'
const LAYER_ID  = 'lidar-slope-layer'
const API_BASE  = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export default function LidarSlopeLayer({ mapRef }) {
  const { state } = useApp()
  const province = state.selectedProvince

  // Monta il layer solo se la provincia corrente ha dati LiDAR
  const hasLidar = state.lidarProvinces.includes(province)

  useEffect(() => {
    const map = mapRef.current
    if (!map || !hasLidar) return

    const tiles = [`${API_BASE}/api/lidar/slope/${province}/{z}/{x}/{y}.png`]

    map.addSource(SOURCE_ID, {
      type: 'raster',
      tiles,
      tileSize: 256,
      minzoom: 10,
      maxzoom: 15,
      attribution: 'LiDAR regionale 1m',
    })

    map.addLayer({
      id: LAYER_ID,
      type: 'raster',
      source: SOURCE_ID,
      paint: { 'raster-opacity': 0.80 },
      layout: { visibility: state.layers.lidarSlope ? 'visible' : 'none' },
    })

    return () => {
      try {
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
      } catch {}
    }
  }, [hasLidar, province])  // rimonta se cambia provincia o disponibilità

  useEffect(() => {
    const map = mapRef.current
    if (!map?.getLayer(LAYER_ID)) return
    map.setLayoutProperty(LAYER_ID, 'visibility', state.layers.lidarSlope ? 'visible' : 'none')
  }, [state.layers.lidarSlope])

  return null
}
