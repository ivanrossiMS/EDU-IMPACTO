export default function AgendaDigitalLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>
      <div style={{
        height: 64,
        background: 'hsl(var(--border-subtle))',
        borderRadius: 12,
        width: '30%'
      }} />
      <div style={{
        height: 300,
        background: 'hsl(var(--bg-surface))',
        border: '1px solid hsl(var(--border-subtle))',
        borderRadius: 16,
      }} />
    </div>
  )
}
