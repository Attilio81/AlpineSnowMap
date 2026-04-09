import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

const SUGGESTIONS = [
  'Ha senso uscire oggi in scialpinismo in Valle d\'Aosta?',
  'Com\'è la qualità della neve in Alto Adige in questo periodo?',
  'Quali cime sono adatte oggi con pendenza 25-35°?',
]

const MIN_W = 300
const MIN_H = 240
const DEFAULT_W = 420
const DEFAULT_H = 480

function Message({ role, content }) {
  const isUser = role === 'user'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: 2 }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 9,
        letterSpacing: '1.5px',
        textTransform: 'uppercase',
        color: isUser ? 'var(--text-accent)' : 'var(--text-secondary)',
        paddingInline: 2,
      }}>
        {isUser ? 'Tu' : 'AI Alpine'}
      </div>
      <div style={{
        maxWidth: '92%',
        padding: '7px 11px',
        borderRadius: isUser ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
        background: isUser ? 'rgba(126,207,255,0.10)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${isUser ? 'rgba(126,207,255,0.22)' : 'var(--border-panel)'}`,
        fontSize: 12,
        lineHeight: 1.6,
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-ui)',
      }}>
        {isUser
          ? <span style={{ whiteSpace: 'pre-wrap' }}>{content}</span>
          : <ReactMarkdown
              components={{
                p:      ({ children }) => <p style={{ margin: '0 0 6px' }}>{children}</p>,
                strong: ({ children }) => <strong style={{ color: 'var(--text-accent)', fontWeight: 600 }}>{children}</strong>,
                em:     ({ children }) => <em style={{ color: 'var(--text-secondary)' }}>{children}</em>,
                ul:     ({ children }) => <ul style={{ margin: '4px 0 6px', paddingLeft: 18 }}>{children}</ul>,
                ol:     ({ children }) => <ol style={{ margin: '4px 0 6px', paddingLeft: 18 }}>{children}</ol>,
                li:     ({ children }) => <li style={{ marginBottom: 3 }}>{children}</li>,
                h1:     ({ children }) => <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, letterSpacing: '1px', color: 'var(--text-accent)', margin: '6px 0 4px', textTransform: 'uppercase' }}>{children}</div>,
                h2:     ({ children }) => <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '0.8px', color: 'var(--text-accent)', margin: '6px 0 4px', textTransform: 'uppercase' }}>{children}</div>,
                h3:     ({ children }) => <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--text-accent)', margin: '4px 0 3px' }}>{children}</div>,
                code:   ({ children }) => <code style={{ background: 'rgba(126,207,255,0.08)', border: '1px solid rgba(126,207,255,0.15)', borderRadius: 4, padding: '1px 5px', fontSize: 11, fontFamily: 'monospace' }}>{children}</code>,
                hr:     () => <hr style={{ border: 'none', borderTop: '1px solid var(--border-panel)', margin: '6px 0' }} />,
              }}
            >
              {content}
            </ReactMarkdown>
        }
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 2px' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: '50%',
          background: 'var(--text-accent)', display: 'inline-block',
          animation: `chatPulse 1.2s ease-in-out ${i * 0.18}s infinite`,
        }} />
      ))}
    </div>
  )
}

function ChatBody({ messages, loading, error, input, setInput, send, handleKey, inputRef, messagesEndRef, onHeaderMouseDown }) {
  const showSuggestions = messages.length === 0

  return (
    <>
      {/* Header — drag handle */}
      <div
        onMouseDown={onHeaderMouseDown}
        style={{
          padding: '10px 14px 8px',
          borderBottom: '1px solid var(--border-panel)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
          cursor: 'grab',
          userSelect: 'none',
        }}
      >
        <span style={{ color: 'var(--text-accent)', fontSize: 13, lineHeight: 1 }}>✦</span>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: 11,
          letterSpacing: '2px',
          textTransform: 'uppercase',
          color: 'var(--text-accent)',
        }}>
          AI Alpine
        </span>
        <span style={{
          fontSize: 9,
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-ui)',
          marginLeft: 'auto',
          opacity: 0.7,
        }}>
          DeepSeek · trascina per spostare
        </span>
      </div>

      {/* Messages area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '10px 12px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(126,207,255,0.15) transparent',
      }}>
        {showSuggestions && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div className="label" style={{ marginBottom: 4 }}>Prova a chiedere</div>
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => send(s)}
                style={{
                  background: 'rgba(126,207,255,0.04)',
                  border: '1px solid var(--border-panel)',
                  borderRadius: 8,
                  padding: '6px 10px',
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-ui)',
                  transition: 'all 0.15s ease',
                  lineHeight: 1.4,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(126,207,255,0.09)'
                  e.currentTarget.style.color = 'var(--text-primary)'
                  e.currentTarget.style.borderColor = 'rgba(126,207,255,0.28)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(126,207,255,0.04)'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                  e.currentTarget.style.borderColor = 'var(--border-panel)'
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => <Message key={i} role={m.role} content={m.content} />)}
        {loading && <TypingIndicator />}

        {error && (
          <div style={{
            fontSize: 11, color: '#FF7070', fontFamily: 'var(--font-ui)',
            padding: '5px 9px', background: 'rgba(255,100,100,0.07)',
            borderRadius: 7, border: '1px solid rgba(255,100,100,0.18)',
          }}>
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input row */}
      <div style={{
        padding: '8px 10px',
        borderTop: '1px solid var(--border-panel)',
        display: 'flex',
        gap: 6,
        alignItems: 'flex-end',
        flexShrink: 0,
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Chiedi le condizioni alpine…"
          rows={1}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border-panel)',
            borderRadius: 8,
            padding: '7px 10px',
            fontSize: 12,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-ui)',
            resize: 'none',
            lineHeight: 1.4,
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => { e.target.style.borderColor = 'rgba(126,207,255,0.35)' }}
          onBlur={e => { e.target.style.borderColor = 'var(--border-panel)' }}
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || loading}
          title="Invia (Enter)"
          style={{
            background: input.trim() && !loading ? 'rgba(126,207,255,0.12)' : 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-panel)',
            borderRadius: 8,
            width: 32, height: 32,
            cursor: input.trim() && !loading ? 'pointer' : 'default',
            color: input.trim() && !loading ? 'var(--text-accent)' : 'var(--text-secondary)',
            fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            opacity: input.trim() && !loading ? 1 : 0.4,
            transition: 'all 0.15s ease',
          }}
        >
          ↑
        </button>
      </div>
    </>
  )
}

export default function ChatPanel() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Panel geometry (desktop)
  const [pos, setPos] = useState({ top: 62, left: 14 })
  const [size, setSize] = useState({ w: DEFAULT_W, h: DEFAULT_H })

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const dragRef = useRef(null)  // tracks active drag/resize state

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // ── Global mouse handlers for drag & resize ──────────────────────────────
  const onMouseMove = useCallback((e) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY

    if (d.type === 'drag') {
      setPos({
        top:  Math.max(0, d.startTop  + dy),
        left: Math.max(0, d.startLeft + dx),
      })
    } else {
      // All values computed from start snapshot — no stale-closure risk
      let w = d.startW, h = d.startH, top = d.startTop, left = d.startLeft
      if (d.edge.includes('e')) w    = Math.max(MIN_W, d.startW + dx)
      if (d.edge.includes('s')) h    = Math.max(MIN_H, d.startH + dy)
      if (d.edge.includes('w')) { w  = Math.max(MIN_W, d.startW - dx); left = d.startLeft + (d.startW - w) }
      if (d.edge.includes('n')) { h  = Math.max(MIN_H, d.startH - dy); top  = d.startTop  + (d.startH - h) }
      setSize({ w, h })
      setPos({ top, left })
    }
  }, [])

  const onMouseUp = useCallback(() => { dragRef.current = null }, [])

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onMouseMove, onMouseUp])

  // ── Drag start (header) ──────────────────────────────────────────────────
  function onHeaderMouseDown(e) {
    e.preventDefault()
    dragRef.current = { type: 'drag', startX: e.clientX, startY: e.clientY, startTop: pos.top, startLeft: pos.left }
  }

  // ── Resize start ─────────────────────────────────────────────────────────
  function onResizeMouseDown(edge) {
    return (e) => {
      e.preventDefault()
      e.stopPropagation()
      dragRef.current = { type: 'resize', edge, startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h, startTop: pos.top, startLeft: pos.left }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  async function send(text) {
    const query = (text ?? input).trim()
    if (!query || loading) return
    setInput('')
    setError(null)
    setMessages(prev => [...prev, { role: 'user', content: query }])
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/agent/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query }),
      })
      if (!res.ok) throw new Error(`Errore ${res.status}`)
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
    } catch {
      setError('Agente non disponibile. Riprova più tardi.')
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const triggerBtnStyle = {
    position: 'absolute',
    zIndex: 10,
    width: 36, height: 36,
    borderRadius: '50%',
    background: open ? 'rgba(126,207,255,0.16)' : 'rgba(10,15,25,0.78)',
    border: `1.5px solid ${open ? 'rgba(126,207,255,0.7)' : 'rgba(126,207,255,0.3)'}`,
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    fontSize: 15,
    cursor: 'pointer',
    color: open ? '#7ECFFF' : 'var(--text-secondary)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s',
    boxShadow: open ? '0 0 0 3px rgba(126,207,255,0.12)' : 'none',
  }

  const chatBodyProps = { messages, loading, error, input, setInput, send, handleKey, inputRef, messagesEndRef }

  // ── Mobile ────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <style>{`@keyframes chatPulse { 0%,100%{transform:scale(1);opacity:.4} 50%{transform:scale(1.4);opacity:1} }`}</style>
        <button onClick={() => setOpen(o => !o)} title="Chiedi all'AI Alpine"
          style={{ ...triggerBtnStyle, bottom: 132, right: 66 }}>✦</button>
        {open && (
          <div className="panel" style={{
            position: 'absolute', bottom: 182, left: 14, right: 14, zIndex: 20,
            display: 'flex', flexDirection: 'column', maxHeight: '55vh', overflow: 'hidden',
          }}>
            <ChatBody {...chatBodyProps} onHeaderMouseDown={() => {}} />
          </div>
        )}
      </>
    )
  }

  // ── Desktop ───────────────────────────────────────────────────────────────
  const EDGE = 6  // resize handle thickness in px

  return (
    <>
      <style>{`@keyframes chatPulse { 0%,100%{transform:scale(1);opacity:.4} 50%{transform:scale(1.4);opacity:1} }`}</style>
      <button onClick={() => setOpen(o => !o)} title="Chiedi all'AI Alpine"
        style={{ ...triggerBtnStyle, top: 178, right: 10 }}>✦</button>

      {open && (
        <div
          className="panel"
          style={{
            position: 'absolute',
            top: pos.top,
            left: pos.left,
            width: size.w,
            height: size.h,
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <ChatBody {...chatBodyProps} onHeaderMouseDown={onHeaderMouseDown} />

          {/* ── Resize handles ── */}
          {/* right edge */}
          <div onMouseDown={onResizeMouseDown('e')} style={{ position:'absolute', top: EDGE, right: 0, width: EDGE, bottom: EDGE, cursor:'ew-resize' }} />
          {/* bottom edge */}
          <div onMouseDown={onResizeMouseDown('s')} style={{ position:'absolute', left: EDGE, bottom: 0, right: EDGE, height: EDGE, cursor:'ns-resize' }} />
          {/* left edge */}
          <div onMouseDown={onResizeMouseDown('w')} style={{ position:'absolute', top: EDGE, left: 0, width: EDGE, bottom: EDGE, cursor:'ew-resize' }} />
          {/* top edge */}
          <div onMouseDown={onResizeMouseDown('n')} style={{ position:'absolute', top: 0, left: EDGE, right: EDGE, height: EDGE, cursor:'ns-resize' }} />
          {/* corners */}
          <div onMouseDown={onResizeMouseDown('se')} style={{ position:'absolute', bottom: 0, right: 0, width: EDGE*2, height: EDGE*2, cursor:'nwse-resize' }} />
          <div onMouseDown={onResizeMouseDown('sw')} style={{ position:'absolute', bottom: 0, left: 0, width: EDGE*2, height: EDGE*2, cursor:'nesw-resize' }} />
          <div onMouseDown={onResizeMouseDown('ne')} style={{ position:'absolute', top: 0, right: 0, width: EDGE*2, height: EDGE*2, cursor:'nesw-resize' }} />
          <div onMouseDown={onResizeMouseDown('nw')} style={{ position:'absolute', top: 0, left: 0, width: EDGE*2, height: EDGE*2, cursor:'nwse-resize' }} />
        </div>
      )}
    </>
  )
}
