import { useState, useRef, useEffect } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { findZoneByCoords } from '../../data/zones.js'
import { useLocationSearch } from '../../hooks/useLocationSearch.js'

export default function SearchBar({ mapRef }) {
  const { dispatch } = useApp()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const results = useLocationSearch(query)

  useEffect(() => {
    setOpen(results.length > 0 && query.length >= 2)
  }, [results, query])

  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function select(result) {
    mapRef.current?.flyTo({ center: [result.lng, result.lat], zoom: 12, duration: 1200 })
    const zone = findZoneByCoords(result.lng, result.lat)
    dispatch({ type: 'SET_PROVINCE', payload: zone.id })
    setQuery('')
    setOpen(false)
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      setQuery('')
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', flexShrink: 0 }}>🔍</span>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Cerca cima o luogo…"
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-ui)',
            fontSize: 13,
            outline: 'none',
            cursor: 'text',
          }}
        />
        {query && (
          <button
            className="icon-btn"
            onClick={() => { setQuery(''); setOpen(false) }}
            style={{ fontSize: 12, flexShrink: 0, padding: 2 }}
          >
            ✕
          </button>
        )}
      </div>

      {open && (
        <div
          className="panel"
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            left: -14,
            minWidth: 260,
            zIndex: 20,
            padding: '4px 0',
            maxHeight: 320,
            overflowY: 'auto',
          }}
        >
          {results.map(r => (
            <button
              key={r.id}
              onClick={() => select(r)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                width: '100%',
                padding: '8px 14px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-ui)',
                fontSize: 13,
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-panel-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            >
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>
                {r.source === 'local' ? '🏔' : '📍'}
              </span>
              <div>
                <div>{r.name}</div>
                {r.subtitle && (
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
                    {r.subtitle}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
