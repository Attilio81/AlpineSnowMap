import { useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'

const SOURCE_ID = 'sentinel-2024'
const LAYER_ID  = 'sentinel-2024-layer'
// EOX Sentinel-2 cloudless 2024 — 10m resolution, CC-BY-NC-SA
// Tile URL: z/x/y (standard XYZ)
const TILES = ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{x}/{y}.jpg']

export default function SentinelLayer({ mapRef }) {
  const { state } = useApp()

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    map.addSource(SOURCE_ID, {
      type: 'raster',
      tiles: TILES,
      tileSize: 256,
      maxzoom: 14,
      attribution: '© EOX IT Services GmbH / Sentinel-2 cloudless 2024',
    })

    const layers = map.getStyle().layers
    const anchor = layers.find(l => l.type === 'line')?.id
                ?? layers.find(l => l.type === 'symbol')?.id
    const visible = state.layers.sentinel || state.layers.satView

    map.addLayer(
      {
        id: LAYER_ID,
        type: 'raster',
        source: SOURCE_ID,
        paint: { 'raster-opacity': 1.0 },
        layout: { visibility: visible ? 'visible' : 'none' },
      },
      anchor
    )

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
    const visible = state.layers.sentinel || state.layers.satView
    map.setLayoutProperty(LAYER_ID, 'visibility', visible ? 'visible' : 'none')
  }, [state.layers.sentinel, state.layers.satView])

  return null
}
