export default function TrackFAB({ active, onToggle }) {
  return (
    <button
      onClick={onToggle}
      title={active ? 'Termina traccia (riclicca per aggiungere punti)' : 'Disegna traccia'}
      style={{
        position: 'absolute',
        top: 128,
        right: 10,
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: `1.5px solid ${active ? 'rgba(126,207,255,0.8)' : 'rgba(126,207,255,0.3)'}`,
        background: active ? 'rgba(126,207,255,0.18)' : 'rgba(10,15,25,0.78)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        color: active ? '#7ECFFF' : 'var(--text-secondary)',
        fontSize: 15,
        cursor: 'pointer',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s',
        boxShadow: active ? '0 0 0 3px rgba(126,207,255,0.15)' : 'none',
      }}
    >
      ✏
    </button>
  )
}
