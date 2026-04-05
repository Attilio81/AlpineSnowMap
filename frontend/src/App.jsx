import { useEffect, useRef, useState } from 'react'
import { AppProvider, useApp } from './context/AppContext.jsx'
import { useGeolocation } from './hooks/useGeolocation.js'
import MapView from './components/MapView.jsx'

function AppInner() {
  const { state } = useApp()
  const mapRef = useRef(null)
  const [mapReady, setMapReady] = useState(false)
  useGeolocation()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme)
  }, [state.theme])

  return (
    <div style={{ position: 'relative', height: '100vh', overflow: 'hidden' }}>
      <MapView mapRef={mapRef} onMapReady={() => setMapReady(true)} />
      {mapReady && (
        <div style={{ position: 'absolute', top: 10, left: 10, color: 'white', zIndex: 10 }}>
          Map ready ✓ — {state.selectedProvince}
        </div>
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
