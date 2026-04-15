export default function AlunosLoading() {
  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="skeleton-shimmer" style={{ width: 180, height: 22, borderRadius: 8, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ width: 260, height: 13, borderRadius: 6 }} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="skeleton-shimmer" style={{ width: 200, height: 38, borderRadius: 10 }} />
          <div className="skeleton-shimmer" style={{ width: 130, height: 38, borderRadius: 10 }} />
        </div>
      </div>

      {/* Stats bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 12,
      }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton-shimmer" style={{
            height: 72,
            borderRadius: 14,
            border: '1px solid hsl(var(--border-subtle))',
          }} />
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10 }}>
        {[120, 100, 100, 130].map((w, i) => (
          <div key={i} className="skeleton-shimmer" style={{ width: w, height: 34, borderRadius: 8 }} />
        ))}
      </div>

      {/* Student list */}
      <div style={{
        background: 'hsl(var(--bg-elevated))',
        borderRadius: 16,
        border: '1px solid hsl(var(--border-subtle))',
        overflow: 'hidden',
      }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
            borderBottom: '1px solid hsl(var(--border-subtle))',
            opacity: 1 - i * 0.07,
          }}>
            {/* Avatar */}
            <div className="skeleton-shimmer" style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }} />
            {/* Name + turma */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="skeleton-shimmer" style={{ width: '45%', height: 13, borderRadius: 5 }} />
              <div className="skeleton-shimmer" style={{ width: '25%', height: 10, borderRadius: 4 }} />
            </div>
            {/* Status badge */}
            <div className="skeleton-shimmer" style={{ width: 70, height: 24, borderRadius: 20 }} />
            {/* Action */}
            <div className="skeleton-shimmer" style={{ width: 28, height: 28, borderRadius: 6 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
