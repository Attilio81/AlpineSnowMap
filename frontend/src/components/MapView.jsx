import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { useApp } from '../context/AppContext.jsx'
import { ZONES } from '../data/zones.js'

const TERRARIUM_SOURCE = {
  type: 'raster-dem',
  tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  tileSize: 256,
  encoding: 'terrarium',
  maxzoom: 14,
}

const SATELLITE_SOURCE = {
  type: 'raster',
  tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
  tileSize: 256,
  attribution: '© Esri',
}

export default function MapView({ mapRef, onMapReady }) {
  const containerRef = useRef(null)
  const { state } = useApp()

  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [7.32, 45.74],
      zoom: 9,
      pitch: 50,
      bearing: 0,
      antialias: true,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    map.on('load', () => {
      map.addSource('terrain-dem', TERRARIUM_SOURCE)
      map.setTerrain({ source: 'terrain-dem', exaggeration: 1.4 })
      map.setFog({})

      map.addSource('satellite', SATELLITE_SOURCE)
      const firstSymbolId = map.getStyle().layers.find(l => l.type === 'symbol')?.id
      map.addLayer(
        {
          id: 'satellite-raster',
          type: 'raster',
          source: 'satellite',
          paint: { 'raster-opacity': 0.9 },
          layout: { visibility: 'none' },
        },
        firstSymbolId
      )

      mapRef.current = map
      onMapReady?.()
    })

    return () => map.remove()
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.getLayer('satellite-raster')) return
    map.setLayoutProperty('satellite-raster', 'visibility', state.layers.satellite ? 'visible' : 'none')
  }, [state.layers.satellite])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const zone = ZONES.find(z => z.id === state.selectedProvince)
    if (zone) map.flyTo({ center: zone.centroid, zoom: 9, duration: 1200 })
  }, [state.selectedProvince])

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0 }}
    />
  )
}
