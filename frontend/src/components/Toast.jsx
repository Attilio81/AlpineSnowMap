import { useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'

export default function Toast() {
  const { state, dispatch } = useApp()
  const { toast } = state

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => dispatch({ type: 'SET_TOAST', payload: null }), 4000)
    return () => clearTimeout(t)
  }, [toast])

  if (!toast) return null

  return (
    <div style={{
      position: 'absolute',
      top: 70,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 50,
      background: toast.type === 'error' ? 'rgba(180, 30, 30, 0.92)' : 'rgba(10, 40, 70, 0.92)',
      border: '1px solid rgba(126, 207, 255, 0.3)',
      borderRadius: 10,
      padding: '10px 18px',
      color: '#E0E8FF',
      fontFamily: 'var(--font-ui)',
      fontSize: 13,
      backdropFilter: 'blur(10px)',
      maxWidth: 380,
      textAlign: 'center',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
    }}>
      {toast.message}
    </div>
  )
}
