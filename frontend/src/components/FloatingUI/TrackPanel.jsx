import { useMemo, useState } from 'react'
import { haversine } from '../../utils/geo.js'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

const RISK_COLORS = {
  1: '#CCFF66',
  2: '#FFFF00',
  3: '#FF9900',
  4: '#FF0000',
  5: '#8B0000',
}

function buildChartPoints(waypoints, w = 300, h = 56) {
  if (waypoints.length < 2) return null
  const dists = [0]
  for (let i = 1; i < waypoints.length; i++) {
    dists.push(dists[i - 1] + haversine(waypoints[i - 1], waypoints[i]))
  }
  const totalDist = dists[dists.length - 1]
  if (totalDist === 0) return null
  const eles = waypoints.map(p => p.ele)
  const minEle = Math.min(...eles)
  const maxEle = Math.max(...eles)
  const range = maxEle - minEle || 1
  const pad = 3
  return waypoints.map((p, i) => {
    const x = (dists[i] / totalDist) * w
    const y = h - pad - ((p.ele - minEle) / range) * (h - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

function waypointsToGeoJSON(waypoints) {
  return {
    type: 'LineString',
    coordinates: waypoints.map(p => [p.lng, p.lat, p.ele ?? 0]),
  }
}

export default function TrackPanel({ waypoints, stats, onUndo, onClear, onExport }) {
  const [riskResult, setRiskResult] = useState(null)
  const [riskLoading, setRiskLoading] = useState(false)
  const [riskError, setRiskError] = useState(null)

  if (waypoints.length === 0) return null

  const chartPoints = useMemo(() => buildChartPoints(waypoints), [waypoints])

  async function analyzeRisk() {
    setRiskLoading(true)
    setRiskError(null)
    setRiskResult(null)
    try {
      const res = await fetch(`${API_BASE}/api/agent/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geojson: waypointsToGeoJSON(waypoints),
          province: 'IT-23',
        }),
      })
      if (!res.ok) throw new Error(`Errore ${res.status}`)
      const data = await res.json()
      setRiskResult(data.response)
    } catch (e) {
      setRiskError('Analisi non disponibile. Riprova più tardi.')
    } finally {
      setRiskLoading(false)
    }
  }

  return (
    <div
      className="panel"
      style={{
        position: 'absolute',
        bottom: 14,
        left: 14,
        right: 14,
        padding: '10px 14px',
        zIndex: 10,
      }}
    >
      {/* Stats row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        fontSize: 13,
        marginBottom: chartPoints ? 8 : 0,
      }}>
        <span style={{ color: 'var(--text-primary)' }}>
          ↔ {stats.distanceKm.toFixed(1)} km
        </span>
        <span style={{ color: '#66ff99' }}>↑ {stats.gainM} m</span>
        <span style={{ color: '#ff7777' }}>↓ {stats.lossM} m</span>

        <div style={{ flex: 1 }} />

        <button
          className="icon-btn"
          onClick={onUndo}
          title="Annulla ultimo punto"
          style={{ fontSize: 13 }}
        >
          ↩
        </button>
        <button
          className="icon-btn"
          onClick={onClear}
          title="Cancella traccia"
          style={{ fontSize: 13 }}
        >
          ✕
        </button>
        {waypoints.length >= 2 && (
          <button
            className="icon-btn"
            onClick={onExport}
            title="Scarica GPX"
            style={{ fontSize: 12, color: 'var(--text-accent)', border: '1px solid var(--border-panel)', borderRadius: 6, padding: '3px 8px' }}
          >
            ⬇ GPX
          </button>
        )}
      </div>

      {/* Elevation profile */}
      {chartPoints && (
        <svg
          viewBox="0 0 300 56"
          style={{ width: '100%', height: 56, display: 'block' }}
          preserveAspectRatio="none"
        >
          <polyline
            points={`0,56 ${chartPoints} 300,56`}
            fill="rgba(126,207,255,0.10)"
            stroke="none"
          />
          <polyline
            points={chartPoints}
            fill="none"
            stroke="#7ECFFF"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      )}

      {/* Risk analysis section */}
      {waypoints.length >= 2 && (
        <div style={{ marginTop: 8, borderTop: '1px solid var(--border-panel)', paddingTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={analyzeRisk}
              disabled={riskLoading}
              style={{
                background: riskLoading ? 'rgba(126,207,255,0.05)' : 'rgba(126,207,255,0.10)',
                border: '1px solid var(--border-panel)',
                borderRadius: 7,
                padding: '4px 10px',
                fontSize: 11,
                color: riskLoading ? 'var(--text-secondary)' : 'var(--text-accent)',
                cursor: riskLoading ? 'default' : 'pointer',
                fontFamily: 'var(--font-display)',
                letterSpacing: '0.5px',
              }}
            >
              {riskLoading ? 'Analisi in corso…' : '✦ Analizza rischio AI'}
            </button>

            {riskResult && (() => {
              const match = riskResult.match(/"overall_risk"\s*:\s*(\d)/)
              const risk = match ? parseInt(match[1]) : null
              return risk ? (
                <span style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: RISK_COLORS[risk],
                  display: 'inline-block',
                  boxShadow: `0 0 6px ${RISK_COLORS[risk]}88`,
                }} />
              ) : null
            })()}
          </div>

          {riskError && (
            <div style={{ fontSize: 11, color: '#FF7070', marginTop: 6, fontFamily: 'var(--font-ui)' }}>
              {riskError}
            </div>
          )}

          {riskResult && (
            <div style={{
              marginTop: 8,
              fontSize: 11,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-ui)',
              lineHeight: 1.5,
              maxHeight: 120,
              overflowY: 'auto',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(126,207,255,0.15) transparent',
            }}>
              {riskResult}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
