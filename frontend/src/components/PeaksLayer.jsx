import { useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import peaksUrl from '../data/peaks.geojson?url'

const SOURCE_ID    = 'peaks'
const LAYER_SYMBOL = 'peaks-symbol'

export default function PeaksLayer({ mapRef }) {
  const { state } = useApp()

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    map.addSource(SOURCE_ID, { type: 'geojson', data: peaksUrl })

    map.addLayer({
      id: LAYER_SYMBOL,
      type: 'symbol',
      source: SOURCE_ID,
      minzoom: 7,
      layout: {
        visibility: state.layers.peaks ? 'visible' : 'none',

        // Priorità ai picchi più alti — a zoom basso appaiono solo i più alti
        'symbol-sort-key': ['*', -1, ['get', 'ele']],

        'icon-allow-overlap': false,
        'text-allow-overlap': false,
        'text-padding': 4,

        // Triangolino + nome + quota
        'text-field': [
          'concat',
          '▲ ',
          ['get', 'name'],
          '\n',
          ['to-string', ['get', 'ele']],
          ' m',
        ],
        'text-font': ['Noto Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': [
          'interpolate', ['linear'], ['zoom'],
          7,  10,
          10, 12,
          13, 14,
        ],
        'text-anchor': 'top',
        'text-offset': [0, 0.2],
        'text-max-width': 10,
        'text-line-height': 1.2,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#1a1a2e',
        'text-halo-width': 1.8,
      },
    })

    return () => {
      try {
        if (map.getLayer(LAYER_SYMBOL)) map.removeLayer(LAYER_SYMBOL)
        if (map.getSource(SOURCE_ID))   map.removeSource(SOURCE_ID)
      } catch {}
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.getLayer(LAYER_SYMBOL)) return
    map.setLayoutProperty(LAYER_SYMBOL, 'visibility', state.layers.peaks ? 'visible' : 'none')
  }, [state.layers.peaks])

  return null
}
