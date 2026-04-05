import { useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { DANGER_COLORS } from '../utils/aineva.js'
import regionsGeoJson from '../data/regions.geojson'

const SOURCE_ID = 'aineva-regions'
const FILL_ID   = 'aineva-fill'
const LINE_ID   = 'aineva-line'

function getDangerColor(bulletin) {
  if (!bulletin?.maxDanger) return '#CCFF66'
  return DANGER_COLORS[bulletin.maxDanger] ?? '#CCFF66'
}

export default function AinevaLayer({ mapRef }) {
  const { state, dispatch } = useApp()

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    map.addSource(SOURCE_ID, { type: 'geojson', data: regionsGeoJson })

    map.addLayer({
      id: FILL_ID,
      type: 'fill',
      source: SOURCE_ID,
      paint: {
        'fill-color': getDangerColor(state.bulletin),
        'fill-opacity': 0.38,
      },
      layout: { visibility: state.layers.avalanche ? 'visible' : 'none' },
    })

    map.addLayer({
      id: LINE_ID,
      type: 'line',
      source: SOURCE_ID,
      paint: { 'line-color': '#FFFFFF', 'line-width': 0.6, 'line-opacity': 0.4 },
      layout: { visibility: state.layers.avalanche ? 'visible' : 'none' },
    })

    const handleClick = () => dispatch({ type: 'SET_SHEET_OPEN', payload: true })
    const handleMouseEnter = () => { map.getCanvas().style.cursor = 'pointer' }
    const handleMouseLeave = () => { map.getCanvas().style.cursor = '' }
    map.on('click', FILL_ID, handleClick)
    map.on('mouseenter', FILL_ID, handleMouseEnter)
    map.on('mouseleave', FILL_ID, handleMouseLeave)

    return () => {
      map.off('click', FILL_ID, handleClick)
      map.off('mouseenter', FILL_ID, handleMouseEnter)
      map.off('mouseleave', FILL_ID, handleMouseLeave)
      map.getCanvas().style.cursor = ''
      if (map.getLayer(LINE_ID)) map.removeLayer(LINE_ID)
      if (map.getLayer(FILL_ID)) map.removeLayer(FILL_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.getLayer(FILL_ID)) return
    map.setPaintProperty(FILL_ID, 'fill-color', getDangerColor(state.bulletin))
  }, [state.bulletin])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.getLayer(FILL_ID)) return
    const v = state.layers.avalanche ? 'visible' : 'none'
    map.setLayoutProperty(FILL_ID, 'visibility', v)
    map.setLayoutProperty(LINE_ID, 'visibility', v)
  }, [state.layers.avalanche])

  return null
}
