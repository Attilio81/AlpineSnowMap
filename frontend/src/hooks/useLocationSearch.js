import { useState, useEffect, useRef } from 'react'
import peaksUrl from '../data/peaks.geojson?url'

let peakCache = null

async function getLocalPeaks() {
  if (peakCache) return peakCache
  const res = await fetch(peaksUrl)
  const geojson = await res.json()
  peakCache = geojson.features.filter(f => f.properties?.name)
  return peakCache
}

function searchLocalPeaks(features, query) {
  const q = query.toLowerCase()
  return features
    .filter(f => f.properties.name.toLowerCase().includes(q))
    .slice(0, 5)
    .map(f => ({
      id: `local-${f.properties.name}-${f.geometry.coordinates[0]}`,
      name: f.properties.name,
      subtitle: f.properties.ele ? `${f.properties.ele} m` : '',
      lng: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      source: 'local',
    }))
}

async function searchPhoton(query) {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&bbox=6.6,43.8,13.9,47.1&limit=5&lang=it`
  const res = await fetch(url)
  const data = await res.json()
  return data.features
    .filter(f => f.properties?.name)
    .map(f => ({
      id: `photon-${f.properties.osm_id ?? f.geometry.coordinates.join(',')}`,
      name: f.properties.name,
      subtitle: [f.properties.city, f.properties.state].filter(Boolean).join(', '),
      lng: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      source: 'photon',
    }))
}

export function useLocationSearch(query) {
  const [results, setResults] = useState([])
  const timerRef = useRef(null)

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }

    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const peaks = await getLocalPeaks()
      const local = searchLocalPeaks(peaks, query)
      let combined = [...local]

      if (local.length < 3) {
        try {
          const remote = await searchPhoton(query)
          const localNames = new Set(local.map(r => r.name.toLowerCase()))
          combined = [...local, ...remote.filter(r => !localNames.has(r.name.toLowerCase()))]
        } catch {
          // offline o errore Photon: mostra solo risultati locali
        }
      }

      setResults(combined.slice(0, 8))
    }, 400)

    return () => clearTimeout(timerRef.current)
  }, [query])

  return results
}
