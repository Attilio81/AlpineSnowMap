import { useApp } from '../../context/AppContext.jsx'
import { ZONES } from '../../data/zones.js'

export default function TopBar() {
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
    }}>
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: '2px',
        color: 'var(--text-accent)',
        whiteSpace: 'nowrap',
      }}>
        ⛰ ALPINESNOWMAP
      </span>

      <div style={{ width: 1, height: 20, background: 'var(--border-panel)', flexShrink: 0 }} />

      <select
        value={state.selectedProvince}
        onChange={e => dispatch({ type: 'SET_PROVINCE', payload: e.target.value })}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-ui)',
          fontSize: 13,
          cursor: 'pointer',
          outline: 'none',
          flex: 1,
        }}
      >
        {ZONES.map(z => (
          <option key={z.id} value={z.id} style={{ background: '#1a2030' }}>
            {z.name}
          </option>
        ))}
      </select>

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
