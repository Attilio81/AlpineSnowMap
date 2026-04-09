import { useApp } from '../../context/AppContext.jsx'
import { ZONES } from '../../data/zones.js'
import { DANGER_LABELS, DANGER_COLORS } from '../../utils/aineva.js'

export default function InfoBar() {
  const { state, dispatch } = useApp()

  const zone = ZONES.find(z => z.id === state.selectedProvince)
  const b = state.bulletin
  const maxDanger = b?.maxDanger
  const maxDate = new Date().toISOString().split('T')[0]

  return (
    <div className="panel" style={{
      position: 'absolute',
      bottom: 14,
      left: 14,
      right: 14,
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      zIndex: 10,
      flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 120 }}>
        <div className="label">Zona</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, marginTop: 2 }}>
          {zone?.name ?? '—'}
        </div>
      </div>

      {maxDanger ? (
        <div style={{ textAlign: 'center', padding: '0 12px', borderLeft: '1px solid var(--border-panel)', borderRight: '1px solid var(--border-panel)', flexShrink: 0 }}>
          <div className="label">Pericolo</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: DANGER_COLORS[maxDanger], lineHeight: 1, marginTop: 2 }}>
            {maxDanger}
          </div>
          <div style={{ fontSize: 10, color: DANGER_COLORS[maxDanger], fontFamily: 'var(--font-display)', fontWeight: 600 }}>
            {DANGER_LABELS[maxDanger]}
          </div>
        </div>
      ) : (
        <div style={{ padding: '0 12px', borderLeft: '1px solid var(--border-panel)', borderRight: '1px solid var(--border-panel)', color: 'var(--text-secondary)', fontSize: 12, flexShrink: 0 }}>
          AINEVA n/d
        </div>
      )}

      <div style={{ flexShrink: 0 }}>
        <div className="label">Data neve</div>
        <input
          type="date"
          value={state.selectedDate}
          max={maxDate}
          min="2000-01-01"
          onChange={e => dispatch({ type: 'SET_DATE', payload: e.target.value })}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-accent)',
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            outline: 'none',
            marginTop: 2,
          }}
        />
      </div>

      {b && (
        <button
          className="icon-btn"
          onClick={() => dispatch({ type: 'SET_SHEET_OPEN', payload: true })}
          style={{
            border: '1px solid var(--border-panel)',
            padding: '6px 12px',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--text-accent)',
            flexShrink: 0,
          }}
        >
          Dettaglio →
        </button>
      )}
    </div>
  )
}
