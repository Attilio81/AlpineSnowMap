import { useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { buildSnowTileUrl } from '../hooks/useSnowLayer.js'

const SOURCE_ID = 'snow-modis'
const LAYER_ID  = 'snow-layer'

export default function SnowLayer({ mapRef }) {
  const { state, dispatch } = useApp()

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    map.addSource(SOURCE_ID, {
      type: 'raster',
      tiles: [buildSnowTileUrl(state.selectedDate)],
      tileSize: 256,
      attribution: 'NASA GIBS',
    })

    map.addLayer({
      id: LAYER_ID,
      type: 'raster',
      source: SOURCE_ID,
      paint: { 'raster-opacity': 0.72 },
      layout: { visibility: state.layers.snow ? 'visible' : 'none' },
    })

    const handleError = e => {
      if (e.sourceId === SOURCE_ID) {
        dispatch({ type: 'SET_TOAST', payload: { message: 'Copertura nuvolosa — prova una data precedente', type: 'info' } })
      }
    }
    map.on('error', handleError)

    return () => {
      map.off('error', handleError)
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.getSource(SOURCE_ID)) return
    map.getSource(SOURCE_ID).setTiles([buildSnowTileUrl(state.selectedDate)])
  }, [state.selectedDate])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.getLayer(LAYER_ID)) return
    map.setLayoutProperty(LAYER_ID, 'visibility', state.layers.snow ? 'visible' : 'none')
  }, [state.layers.snow])

  return null
}
