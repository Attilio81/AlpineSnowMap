import { useApp } from '../../context/AppContext.jsx'
import { DANGER_LABELS, DANGER_COLORS } from '../../utils/aineva.js'
import { ZONES } from '../../data/zones.js'

const PROBLEM_LABELS = {
  new_snow: 'Neve fresca',
  wind_slab: 'Lastroni da vento',
  persistent_weak_layers: 'Strati deboli persistenti',
  wet_snow: 'Neve bagnata',
  gliding_snow: 'Neve scivolante',
}

export default function DetailSheet() {
  const { state, dispatch } = useApp()
  const { bulletin: b, sheetOpen, selectedProvince } = state
  const zone = ZONES.find(z => z.id === selectedProvince)

  if (!sheetOpen || !b) return null

  function close() { dispatch({ type: 'SET_SHEET_OPEN', payload: false }) }

  return (
    <>
      <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
      <div className="panel" onClick={e => e.stopPropagation()} style={{
        position: 'absolute',
        bottom: 74,
        left: 14,
        right: 14,
        zIndex: 30,
        padding: '18px 20px',
        maxHeight: '60vh',
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div className="label">Bollettino AINEVA</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginTop: 3 }}>
              {zone?.name}
            </div>
          </div>
          <button className="icon-btn" onClick={close} style={{ fontSize: 18 }} title="Chiudi bollettino">✕</button>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          {[
            { label: 'Sopra 2000m', value: b.dangerAbove },
            { label: 'Sotto 2000m', value: b.dangerBelow },
          ].map(({ label, value }) => (
            <div key={label} style={{ flex: 1, background: 'var(--bg-panel-hover)', borderRadius: 8, padding: '10px 12px' }}>
              <div className="label">{label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: DANGER_COLORS[value] }}>
                  {value}
                </span>
                <span style={{ fontSize: 12, color: DANGER_COLORS[value] }}>{DANGER_LABELS[value]}</span>
              </div>
            </div>
          ))}
        </div>

        {b.problems.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div className="label" style={{ marginBottom: 8 }}>Problemi valanghivi</div>
            {b.problems.map((p, i) => (
              <div key={`${p.problemType}-${i}`} style={{ background: 'var(--bg-panel-hover)', borderRadius: 8, padding: '8px 12px', marginBottom: 6, fontSize: 13 }}>
                <span style={{ fontWeight: 500, color: 'var(--text-accent)' }}>
                  {PROBLEM_LABELS[p.problemType] ?? p.problemType}
                </span>
                {p.aspects?.length > 0 && (
                  <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>{p.aspects.join(' ')}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {b.comment && (
          <div>
            <div className="label" style={{ marginBottom: 6 }}>Note</div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{b.comment}</p>
          </div>
        )}
      </div>
    </>
  )
}
