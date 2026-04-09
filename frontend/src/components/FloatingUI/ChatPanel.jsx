import { useState, useRef, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

const SUGGESTIONS = [
  'Ha senso uscire oggi in scialpinismo in Valle d\'Aosta?',
  'Com\'è la qualità della neve in Alto Adige in questo periodo?',
  'Quali cime sono adatte oggi con pendenza 25-35°?',
]

function Message({ role, content }) {
  const isUser = role === 'user'
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      gap: 2,
    }}>
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
        maxWidth: '88%',
        padding: '7px 11px',
        borderRadius: isUser ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
        background: isUser
          ? 'rgba(126,207,255,0.10)'
          : 'rgba(255,255,255,0.04)',
        border: `1px solid ${isUser ? 'rgba(126,207,255,0.22)' : 'var(--border-panel)'}`,
        fontSize: 12,
        lineHeight: 1.55,
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-ui)',
        whiteSpace: 'pre-wrap',
      }}>
        {content}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 2px' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: 'var(--text-accent)',
          display: 'inline-block',
          animation: `chatPulse 1.2s ease-in-out ${i * 0.18}s infinite`,
        }} />
      ))}
    </div>
  )
}

function ChatBody({ messages, loading, error, input, setInput, send, handleKey, inputRef, messagesEndRef }) {
  const showSuggestions = messages.length === 0

  return (
    <>
      {/* Header */}
      <div style={{
        padding: '10px 14px 8px',
        borderBottom: '1px solid var(--border-panel)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
      }}>
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
          DeepSeek
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
        minHeight: 100,
        maxHeight: 300,
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

        {messages.map((m, i) => (
          <Message key={i} role={m.role} content={m.content} />
        ))}

        {loading && <TypingIndicator />}

        {error && (
          <div style={{
            fontSize: 11,
            color: '#FF7070',
            fontFamily: 'var(--font-ui)',
            padding: '5px 9px',
            background: 'rgba(255,100,100,0.07)',
            borderRadius: 7,
            border: '1px solid rgba(255,100,100,0.18)',
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
            background: input.trim() && !loading
              ? 'rgba(126,207,255,0.12)'
              : 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-panel)',
            borderRadius: 8,
            width: 32,
            height: 32,
            cursor: input.trim() && !loading ? 'pointer' : 'default',
            color: input.trim() && !loading ? 'var(--text-accent)' : 'var(--text-secondary)',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
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
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const triggerBtnStyle = {
    position: 'absolute',
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: open ? 'rgba(126,207,255,0.16)' : 'rgba(10,15,25,0.78)',
    border: `1.5px solid ${open ? 'rgba(126,207,255,0.7)' : 'rgba(126,207,255,0.3)'}`,
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    fontSize: 15,
    cursor: 'pointer',
    color: open ? '#7ECFFF' : 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s',
    boxShadow: open ? '0 0 0 3px rgba(126,207,255,0.12)' : 'none',
  }

  const chatBodyProps = { messages, loading, error, input, setInput, send, handleKey, inputRef, messagesEndRef }

  if (isMobile) {
    return (
      <>
        <style>{`@keyframes chatPulse { 0%,100%{transform:scale(1);opacity:.4} 50%{transform:scale(1.4);opacity:1} }`}</style>
        {/* FAB: above layer FAB (bottom:80) and track FAB area */}
        <button
          onClick={() => setOpen(o => !o)}
          title="Chiedi all'AI Alpine"
          style={{ ...triggerBtnStyle, bottom: 132, right: 66 }}
        >
          ✦
        </button>
        {open && (
          <div className="panel" style={{
            position: 'absolute',
            bottom: 182,
            left: 14,
            right: 14,
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '55vh',
            overflow: 'hidden',
          }}>
            <ChatBody {...chatBodyProps} />
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <style>{`@keyframes chatPulse { 0%,100%{transform:scale(1);opacity:.4} 50%{transform:scale(1.4);opacity:1} }`}</style>
      {/* Desktop: FAB below TrackFAB (top:128+36+14 = 178) on right column */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Chiedi all'AI Alpine"
        style={{ ...triggerBtnStyle, top: 178, right: 10 }}
      >
        ✦
      </button>
      {open && (
        <div className="panel" style={{
          position: 'absolute',
          top: 62,
          left: 14,
          width: 300,
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100vh - 120px)',
          overflow: 'hidden',
        }}>
          <ChatBody {...chatBodyProps} />
        </div>
      )}
    </>
  )
}
