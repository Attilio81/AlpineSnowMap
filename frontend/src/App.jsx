import { useEffect } from 'react'
import { AppProvider, useApp } from './context/AppContext.jsx'
import { useGeolocation } from './hooks/useGeolocation.js'

function AppInner() {
  const { state } = useApp()
  useGeolocation()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme)
  }, [state.theme])

  return <div style={{ height: '100vh' }}>AlpineSnowMap — {state.theme} — {state.selectedProvince}</div>
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}
