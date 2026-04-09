import { useEffect } from 'react'
import { haversine, lerpLngLat } from '../utils/geo.js'

const SOURCE_ID  = 'track'
const LINE_LAYER = 'track-line'
const DOT_LAYER  = 'track-dots'

/** Interpolate intermediate points every ~stepM metres and sample terrain elevation */
function densifySegment(map, p1, p2, stepM = 50) {
  const dist  = haversine(p1, p2)
  const steps = Math.max(1, Math.ceil(dist / stepM))
  const pts   = []
  for (let i = 0; i <= steps; i++) {
    const t         = i / steps
    const { lng, lat } = lerpLngLat(p1, p2, t)
    const ele       = map.queryTerrainElevation([lng, lat], { exaggerated: false }) ?? 0
    pts.push([lng, lat, ele])
  }
  return pts
}

function buildGeoJSON(map, waypoints) {
  const features = []

  if (waypoints.length >= 2) {
    const coords = []
    for (let i = 1; i < waypoints.length; i++) {
      const seg = densifySegment(map, waypoints[i - 1], waypoints[i])
      if (i === 1) coords.push(...seg)
      else coords.push(...seg.slice(1)) // avoid duplicate junction point
    }
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: {},
    })
  }

  // One Point feature per waypoint (for dot markers)
  for (const p of waypoints) {
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat, p.ele] },
      properties: {},
    })
  }

  return { type: 'FeatureCollection', features }
}

export default function TrackLayer({ mapRef, active, waypoints, addWaypoint }) {
  // Add source + layers once
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })

    map.addLayer({
      id: LINE_LAYER,
      type: 'line',
      source: SOURCE_ID,
      filter: ['==', '$type', 'LineString'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#7ECFFF',
        'line-width': 2.5,
        'line-opacity': 0.92,
      },
    })

    map.addLayer({
      id: DOT_LAYER,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['==', '$type', 'Point'],
      paint: {
        'circle-radius': 5,
        'circle-color': '#ffffff',
        'circle-stroke-color': '#7ECFFF',
        'circle-stroke-width': 2,
      },
    })

    return () => {
      try {
        if (map.getLayer(DOT_LAYER))  map.removeLayer(DOT_LAYER)
        if (map.getLayer(LINE_LAYER)) map.removeLayer(LINE_LAYER)
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
      } catch {}
    }
  }, [])

  // Redraw whenever waypoints change
  useEffect(() => {
    const map = mapRef.current
    if (!map?.getSource(SOURCE_ID)) return
    map.getSource(SOURCE_ID).setData(buildGeoJSON(map, waypoints))
  }, [waypoints])

  // Toggle cursor and click handler
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    map.getCanvas().style.cursor = active ? 'crosshair' : ''

    if (!active) return

    function onClick(e) {
      const { lng, lat } = e.lngLat
      const ele = map.queryTerrainElevation([lng, lat], { exaggerated: false }) ?? 0
      addWaypoint({ lng, lat, ele })
    }

    map.on('click', onClick)
    return () => {
      map.off('click', onClick)
      map.getCanvas().style.cursor = ''
    }
  }, [active, addWaypoint])

  return null
}
