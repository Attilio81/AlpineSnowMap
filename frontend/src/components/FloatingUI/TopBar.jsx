import { useApp } from '../../context/AppContext.jsx'
import SearchBar from './SearchBar.jsx'

export default function TopBar({ mapRef }) {
  const { state, dispatch } = useApp()

  function toggleTheme() {
    dispatch({ type: 'SET_THEME', payload: state.theme === 'dark' ? 'light' : 'dark' })
  }

  return (
    <div className="panel" style={{
      position: 'absolute',
      top: 14,
      left: 14,
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      zIndex: 10,
      minWidth: 240,
      maxWidth: 380,
    }}>
      <span className="topbar-logo" style={{
        fontFamily: 'var(--font-display)',
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: '2px',
        color: 'var(--text-accent)',
        whiteSpace: 'nowrap',
      }}>
        ⛰ ALPINESNOWMAP
      </span>

      <div className="topbar-logo" style={{ width: 1, height: 20, background: 'var(--border-panel)', flexShrink: 0 }} />

      <SearchBar mapRef={mapRef} />

      <button
        className="icon-btn"
        onClick={toggleTheme}
        title={state.theme === 'dark' ? 'Tema chiaro' : 'Tema scuro'}
        style={{ fontSize: 16, flexShrink: 0 }}
      >
        {state.theme === 'dark' ? '☀️' : '🌙'}
      </button>
    </div>
  )
}
