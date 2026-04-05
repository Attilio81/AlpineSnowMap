import { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { isAinevaActive } from '../../utils/aineva.js'

const active = isAinevaActive()

function LayerToggle({ label, checked, onChange, disabled, disabledTitle }) {
  return (
    <label
      title={disabled ? disabledTitle : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        fontSize: 12,
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-ui)',
        userSelect: 'none',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        style={{ accentColor: 'var(--accent)', cursor: disabled ? 'default' : 'pointer' }}
      />
      {label}
    </label>
  )
}

export default function LayerPanel() {
  const { state, dispatch } = useApp()
  const [open, setOpen] = useState(false)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  function toggle(layer) {
    dispatch({ type: 'TOGGLE_LAYER', payload: layer })
  }

  const panelContent = (
    <>
      <span className="label">Layer</span>
      <LayerToggle
        label="❄️ Neve MODIS"
        checked={state.layers.snow}
        onChange={() => toggle('snow')}
      />
      <LayerToggle
        label="⚠️ Valanghe AINEVA"
        checked={state.layers.avalanche}
        onChange={() => toggle('avalanche')}
        disabled={!active}
        disabledTitle="Bollettino non disponibile (stagione estiva)"
      />
      <LayerToggle
        label="🛰 Satellite"
        checked={state.layers.satellite}
        onChange={() => toggle('satellite')}
      />
      {!active && (
        <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>
          AINEVA attivo: 1 dic – 5 mag
        </p>
      )}
    </>
  )

  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setOpen(o => !o)}
          title="Gestisci layer"
          style={{
            position: 'absolute',
            bottom: 80,
            right: 14,
            zIndex: 10,
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-panel)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            fontSize: 18,
            cursor: 'pointer',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          🗺
        </button>
        {open && (
          <div className="panel" style={{
            position: 'absolute',
            bottom: 132,
            right: 14,
            zIndex: 20,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            minWidth: 160,
          }}>
            {panelContent}
          </div>
        )}
      </>
    )
  }

  return (
    <div className="panel" style={{
      position: 'absolute',
      top: 14,
      right: 54,
      padding: '12px 14px',
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      minWidth: 160,
    }}>
      {panelContent}
    </div>
  )
}
