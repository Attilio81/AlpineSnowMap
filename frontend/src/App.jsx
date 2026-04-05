import { useEffect } from 'react'
import { AppProvider, useApp } from './context/AppContext.jsx'

function AppInner() {
  const { state } = useApp()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme)
  }, [state.theme])

  return <div style={{ height: '100vh' }}>AlpineSnowMap — {state.theme}</div>
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}
