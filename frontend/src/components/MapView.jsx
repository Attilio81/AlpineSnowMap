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

export default function MapView({ mapRef, onMapReady, onMapDestroy }) {
  const containerRef = useRef(null)
  const baseFillsRef = useRef([])   // OSM fill/background layer IDs collected at load
  const { state } = useApp()

  useEffect(() => {
    const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY ?? ''
    let cancelled = false  // guard against StrictMode double-invoke and HMR
    let map = null

    async function initMap() {
      const styleJson = await fetch('https://tiles.openfreemap.org/styles/liberty').then(r => r.json())
      if (cancelled) return  // cleanup ran before fetch completed — discard

      if (MAPTILER_KEY) {
        styleJson.glyphs = `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${MAPTILER_KEY}`
      }

      // Fix: Liberty style uses bare ["get","height"] for building extrusion.
      // OSM buildings with null height cause "Expected number, found null" in MapLibre.
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
        if (cancelled) return  // cleanup ran after map created but before load fired

        map.addSource('terrain-dem', TERRARIUM_SOURCE)
        map.setTerrain({ source: 'terrain-dem', exaggeration: 1.4 })

        map.addSource('satellite', SATELLITE_SOURCE)
        const layers = map.getStyle().layers

        baseFillsRef.current = layers
          .filter(l => l.type === 'fill' || l.type === 'background')
          .map(l => l.id)

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

        // Click-to-copy coordinates
        let coordPopup = null
        map.on('click', e => {
          const { lng, lat } = e.lngLat
          const text = `${lat.toFixed(6)}, ${lng.toFixed(6)}`
          if (coordPopup) coordPopup.remove()

          const div = document.createElement('div')
          div.style.cssText = 'font-family:var(--font-ui,Inter,sans-serif);font-size:12px;color:#e8f4ff;display:flex;align-items:center;gap:8px;padding:2px 0'
          const span = document.createElement('span')
          span.style.cssText = 'letter-spacing:0.03em;opacity:0.9'
          span.textContent = text
          const btn = document.createElement('button')
          btn.textContent = 'Copia'
          btn.style.cssText = 'background:rgba(126,207,255,0.15);border:1px solid rgba(126,207,255,0.35);color:#7ecfff;border-radius:4px;padding:2px 8px;font-size:11px;cursor:pointer;font-family:inherit;transition:background 0.15s'
          btn.onmouseenter = () => { btn.style.background = 'rgba(126,207,255,0.28)' }
          btn.onmouseleave = () => { btn.style.background = 'rgba(126,207,255,0.15)' }
          btn.onclick = () => {
            navigator.clipboard.writeText(text).then(() => {
              btn.textContent = '✓'
              setTimeout(() => { btn.textContent = 'Copia' }, 1500)
            })
          }
          div.appendChild(span)
          div.appendChild(btn)

          coordPopup = new maplibregl.Popup({ closeButton: true, maxWidth: 'none' })
            .setLngLat(e.lngLat)
            .setDOMContent(div)
            .addTo(map)
        })

        mapRef.current = map
        onMapReady?.()
      })
    }

    initMap()
    return () => {
      cancelled = true
      onMapDestroy?.()
      if (map) { map.remove(); map = null }
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.getLayer('satellite-raster')) return
    map.setLayoutProperty('satellite-raster', 'visibility', state.layers.satellite ? 'visible' : 'none')
  }, [state.layers.satellite])

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
