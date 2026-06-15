import { Loader2 } from 'lucide-react'

export function LoadingGlass() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16
      }}>
        <Loader2 size={48} color="#00D2FF" className="animate-spin" style={{ filter: 'drop-shadow(0 0 10px rgba(0,210,255,0.5))' }} />
      </div>
    </div>
  )
}
