import { useEffect, useRef, useState } from 'react'
import { AppProvider, useApp } from './context/AppContext.jsx'
import { useGeolocation } from './hooks/useGeolocation.js'
import { useAineva } from './hooks/useAineva.js'
import { useTrack } from './hooks/useTrack.js'
import { findLatestGibsDate } from './hooks/useSnowLayer.js'
import MapView from './components/MapView.jsx'
import SnowLayer from './components/SnowLayer.jsx'
import AinevaLayer from './components/AinevaLayer.jsx'
import TrueColorLayer from './components/TrueColorLayer.jsx'
import SentinelLayer from './components/SentinelLayer.jsx'
import CopernicusSnowLayer from './components/CopernicusSnowLayer.jsx'
import PeaksLayer from './components/PeaksLayer.jsx'
import TopoLayer from './components/TopoLayer.jsx'
import SlopeLayer from './components/SlopeLayer.jsx'
import TrackLayer from './components/TrackLayer.jsx'
import TopBar from './components/FloatingUI/TopBar.jsx'
import LayerPanel from './components/FloatingUI/LayerPanel.jsx'
import InfoBar from './components/FloatingUI/InfoBar.jsx'
import TrackPanel from './components/FloatingUI/TrackPanel.jsx'
import TrackFAB from './components/FloatingUI/TrackFAB.jsx'
import DetailSheet from './components/FloatingUI/DetailSheet.jsx'
import ChatPanel from './components/FloatingUI/ChatPanel.jsx'
import Toast from './components/Toast.jsx'

function AppInner() {
  const { state, dispatch } = useApp()
  const mapRef = useRef(null)
  const [mapReady, setMapReady] = useState(false)
  const track = useTrack()
  useGeolocation()
  useAineva()

  useEffect(() => {
    findLatestGibsDate().then(date => dispatch({ type: 'SET_DATE', payload: date }))
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme)
  }, [state.theme])

  return (
    <div style={{ position: 'relative', height: '100vh', overflow: 'hidden' }}>
      <MapView mapRef={mapRef} onMapReady={() => setMapReady(true)} onMapDestroy={() => setMapReady(false)} />
      <Toast />
      {mapReady && (
        <>
          <TopoLayer mapRef={mapRef} />
          <SlopeLayer mapRef={mapRef} />
          <SentinelLayer mapRef={mapRef} />
          <CopernicusSnowLayer mapRef={mapRef} />
          <TrueColorLayer mapRef={mapRef} />
          <SnowLayer mapRef={mapRef} />
          <AinevaLayer mapRef={mapRef} />
          <PeaksLayer mapRef={mapRef} />
          <TrackLayer mapRef={mapRef} active={track.active} waypoints={track.waypoints} addWaypoint={track.addWaypoint} />
          <TopBar mapRef={mapRef} />
          <LayerPanel />
          <TrackFAB active={track.active} onToggle={track.toggleActive} />
          {track.waypoints.length === 0 && <InfoBar />}
          <TrackPanel waypoints={track.waypoints} stats={track.stats} onUndo={track.undo} onClear={track.clear} onExport={track.exportGpx} />
          <ChatPanel />
          <DetailSheet />
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
