import { useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { buildTrueColorUrl } from '../hooks/useSnowLayer.js'

const SOURCE_ID = 'modis-truecolor'
const LAYER_ID  = 'modis-truecolor-layer'

export default function TrueColorLayer({ mapRef }) {
  const { state } = useApp()

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    map.addSource(SOURCE_ID, {
      type: 'raster',
      tiles: [buildTrueColorUrl(state.selectedDate)],
      tileSize: 256,
      maxzoom: 9,
      attribution: 'NASA GIBS / MODIS Terra',
    })

    // Insert below OSM line layers so trails/roads stay visible above the photo
    const layers = map.getStyle().layers
    const anchor = layers.find(l => l.type === 'line')?.id
                ?? layers.find(l => l.type === 'symbol')?.id
    map.addLayer(
      {
        id: LAYER_ID,
        type: 'raster',
        source: SOURCE_ID,
        paint: { 'raster-opacity': 0.9 },
        layout: { visibility: state.layers.trueColor ? 'visible' : 'none' },
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
    if (!map?.getSource(SOURCE_ID)) return
    map.getSource(SOURCE_ID).setTiles([buildTrueColorUrl(state.selectedDate)])
  }, [state.selectedDate])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.getLayer(LAYER_ID)) return
    map.setLayoutProperty(LAYER_ID, 'visibility', state.layers.trueColor ? 'visible' : 'none')
  }, [state.layers.trueColor])

  return null
}
