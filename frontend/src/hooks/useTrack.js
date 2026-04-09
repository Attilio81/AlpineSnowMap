import { useState, useCallback, useMemo } from 'react'
import { haversine } from '../utils/geo.js'

function calcStats(waypoints) {
  if (waypoints.length < 2) return { distanceKm: 0, gainM: 0, lossM: 0 }
  let dist = 0, gain = 0, loss = 0
  for (let i = 1; i < waypoints.length; i++) {
    const a = waypoints[i - 1]
    const b = waypoints[i]
    dist += haversine(a, b)
    const dEle = b.ele - a.ele
    if (dEle > 0) gain += dEle
    else loss += -dEle
  }
  return {
    distanceKm: dist / 1000,
    gainM: Math.round(gain),
    lossM: Math.round(loss),
  }
}

function buildGpx(waypoints) {
  const trkpts = waypoints.map(p =>
    `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}"><ele>${p.ele.toFixed(1)}</ele></trkpt>`
  ).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="AlpineSnowMap" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Traccia AlpineSnowMap</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`
}

export function useTrack() {
  const [active, setActive] = useState(false)
  const [waypoints, setWaypoints] = useState([]) // [{lng, lat, ele}, ...]

  const stats = useMemo(() => calcStats(waypoints), [waypoints])

  const addWaypoint = useCallback((point) => {
    setWaypoints(prev => [...prev, point])
  }, [])

  const undo = useCallback(() => {
    setWaypoints(prev => prev.slice(0, -1))
  }, [])

  const clear = useCallback(() => {
    setWaypoints([])
    setActive(false)
  }, [])

  const toggleActive = useCallback(() => {
    setActive(v => !v)
  }, [])

  const exportGpx = useCallback(() => {
    if (waypoints.length < 2) return
    const blob = new Blob([buildGpx(waypoints)], { type: 'application/gpx+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'traccia-alpinesnowmap.gpx'
    a.click()
    URL.revokeObjectURL(url)
  }, [waypoints])

  return { active, waypoints, stats, toggleActive, addWaypoint, undo, clear, exportGpx }
}
