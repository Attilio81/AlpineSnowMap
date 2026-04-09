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
  const baseFillsRef = useRef([])   // OSM fill/background layer IDs collected at load
  const { state } = useApp()

  useEffect(() => {
    const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY ?? ''
    let map

    async function initMap() {
      // Fetch Liberty style and override glyphs to use MapTiler font server
      // (OpenFreeMap's font CDN returns 404 for the font stack in this style)
      const styleJson = await fetch('https://tiles.openfreemap.org/styles/liberty').then(r => r.json())
      if (MAPTILER_KEY) {
        styleJson.glyphs = `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${MAPTILER_KEY}`
      }
      // Fix: Liberty style uses bare ["get","height"] for building extrusion.
      // OSM buildings with null height cause "Expected number, found null" in MapLibre.
      // Wrap every fill-extrusion-height / fill-extrusion-base with coalesce(..., 0).
      styleJson.layers = styleJson.layers.map(layer => {
        if (layer.type !== 'fill-extrusion') return layer
        const paint = { ...layer.paint }
        for (const key of ['fill-extrusion-height', 'fill-extrusion-base']) {
          if (paint[key] != null) {
            paint[key] = ['coalesce', paint[key], 0]
          }
        }
        return { ...layer, paint }
      })

      map = new maplibregl.Map({
        container: containerRef.current,
        style: styleJson,
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

        map.addSource('satellite', SATELLITE_SOURCE)
        const layers = map.getStyle().layers

        // Collect OSM fill/background IDs before we add any custom layer
        baseFillsRef.current = layers
          .filter(l => l.type === 'fill' || l.type === 'background')
          .map(l => l.id)

        // Anchor: first line layer — rasters go below OSM trails/roads, hillshade too
        const firstLineId = layers.find(l => l.type === 'line')?.id
                         ?? layers.find(l => l.type === 'symbol')?.id

        map.addLayer(
          {
            id: 'satellite-raster',
            type: 'raster',
            source: 'satellite',
            paint: { 'raster-opacity': 0.9 },
            layout: { visibility: 'none' },
          },
          firstLineId
        )

        // Hillshade sits above rasters but still below OSM trail lines
        map.addLayer(
          {
            id: 'terrain-hillshade',
            type: 'hillshade',
            source: 'terrain-dem',
            paint: {
              'hillshade-exaggeration': 0.45,
              'hillshade-shadow-color': '#18283a',
              'hillshade-highlight-color': '#ffffff',
              'hillshade-accent-color': '#18283a',
              'hillshade-illumination-anchor': 'viewport',
            },
          },
          firstLineId
        )

        mapRef.current = map
        onMapReady?.()
      })
    }

    initMap()
    return () => { if (map) map.remove() }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.getLayer('satellite-raster')) return
    map.setLayoutProperty('satellite-raster', 'visibility', state.layers.satellite ? 'visible' : 'none')
  }, [state.layers.satellite])

  // satView: hide OSM fills to expose the MODIS photo as clean base map
  useEffect(() => {
    const map = mapRef.current
    if (!map || !baseFillsRef.current.length) return
    const v = state.layers.satView ? 'none' : 'visible'
    baseFillsRef.current.forEach(id => {
      try { map.setLayoutProperty(id, 'visibility', v) } catch {}
    })
  }, [state.layers.satView])

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
