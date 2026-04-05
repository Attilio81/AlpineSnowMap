import { useEffect, useRef, useState } from 'react'
import { AppProvider, useApp } from './context/AppContext.jsx'
import { useGeolocation } from './hooks/useGeolocation.js'
import { useAineva } from './hooks/useAineva.js'
import MapView from './components/MapView.jsx'
import SnowLayer from './components/SnowLayer.jsx'
import AinevaLayer from './components/AinevaLayer.jsx'
import TopBar from './components/FloatingUI/TopBar.jsx'
import LayerPanel from './components/FloatingUI/LayerPanel.jsx'

function AppInner() {
  const { state } = useApp()
  const mapRef = useRef(null)
  const [mapReady, setMapReady] = useState(false)
  useGeolocation()
  useAineva()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme)
  }, [state.theme])

  return (
    <div style={{ position: 'relative', height: '100vh', overflow: 'hidden' }}>
      <MapView mapRef={mapRef} onMapReady={() => setMapReady(true)} />
      {mapReady && (
        <>
          <SnowLayer mapRef={mapRef} />
          <AinevaLayer mapRef={mapRef} />
          <TopBar />
          <LayerPanel />
        </>
      )}
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}
