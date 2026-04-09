import { useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'

const SOURCE_ID  = 'maptiler-contours'
const LINE_MINOR = 'contours-minor'
const LINE_MAJOR = 'contours-major'
const LABELS     = 'contours-labels'
const API_KEY    = import.meta.env.VITE_MAPTILER_KEY

export default function TopoLayer({ mapRef }) {
  const { state } = useApp()

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    map.addSource(SOURCE_ID, {
      type: 'vector',
      url: `https://api.maptiler.com/tiles/contours/tiles.json?key=${API_KEY}`,
    })

    const v = state.layers.topo ? 'visible' : 'none'

    // Curve minori (ogni 10 m) — visibili da zoom 11
    map.addLayer({
      id: LINE_MINOR,
      type: 'line',
      source: SOURCE_ID,
      'source-layer': 'contour',
      filter: ['==', ['coalesce', ['get', 'nth_line'], 0], 0],
      minzoom: 11,
      paint: {
        'line-color': '#8B6914',
        'line-width': 0.6,
        'line-opacity': 0.45,
      },
      layout: { visibility: v },
    })

    // Curve principali (ogni 50 m) — visibili da zoom 7
    map.addLayer({
      id: LINE_MAJOR,
      type: 'line',
      source: SOURCE_ID,
      'source-layer': 'contour',
      filter: ['>', ['coalesce', ['get', 'nth_line'], 0], 0],
      minzoom: 7,
      paint: {
        'line-color': '#8B6914',
        'line-width': 1.3,
        'line-opacity': 0.75,
      },
      layout: { visibility: v },
    })

    // Quote sulle curve principali — da zoom 10
    map.addLayer({
      id: LABELS,
      type: 'symbol',
      source: SOURCE_ID,
      'source-layer': 'contour',
      filter: ['>', ['coalesce', ['get', 'nth_line'], 0], 0],
      minzoom: 10,
      layout: {
        visibility: v,
        'symbol-placement': 'line',
        'text-field': ['concat', ['to-string', ['get', 'height']], ' m'],
        'text-size': 10,
        'text-font': ['Noto Sans Regular', 'Arial Unicode MS Regular'],
        'text-max-angle': 30,
      },
      paint: {
        'text-color': '#6B4F10',
        'text-halo-color': 'rgba(255,255,255,0.85)',
        'text-halo-width': 1.5,
      },
    })

    return () => {
      try {
        if (map.getLayer(LABELS))     map.removeLayer(LABELS)
        if (map.getLayer(LINE_MAJOR)) map.removeLayer(LINE_MAJOR)
        if (map.getLayer(LINE_MINOR)) map.removeLayer(LINE_MINOR)
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
      } catch {}
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.getLayer(LINE_MINOR)) return
    const v = state.layers.topo ? 'visible' : 'none'
    map.setLayoutProperty(LINE_MINOR, 'visibility', v)
    map.setLayoutProperty(LINE_MAJOR, 'visibility', v)
    map.setLayoutProperty(LABELS,     'visibility', v)
  }, [state.layers.topo])

  return null
}
