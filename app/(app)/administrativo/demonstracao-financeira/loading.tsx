export default function DRELoading() {
  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header with year selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="skeleton-shimmer" style={{ width: 280, height: 24, borderRadius: 8, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ width: 200, height: 13, borderRadius: 6 }} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="skeleton-shimmer" style={{ width: 100, height: 38, borderRadius: 10 }} />
          <div className="skeleton-shimmer" style={{ width: 38, height: 38, borderRadius: 10 }} />
          <div className="skeleton-shimmer" style={{ width: 38, height: 38, borderRadius: 10 }} />
          <div className="skeleton-shimmer" style={{ width: 38, height: 38, borderRadius: 10 }} />
        </div>
      </div>

      {/* KPIs — 4 cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 16,
      }}>
        {['#10b981', '#f43f5e', '#6366f1', '#f59e0b'].map((color, i) => (
          <div key={i} style={{
            borderRadius: 16,
            border: '1px solid hsl(var(--border-subtle))',
            overflow: 'hidden',
            position: 'relative',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, opacity: 0.3 }} />
            <div style={{ padding: '20px 24px' }}>
              <div className="skeleton-shimmer" style={{ width: 90, height: 10, borderRadius: 4, marginBottom: 12 }} />
              <div className="skeleton-shimmer" style={{ width: 140, height: 26, borderRadius: 6, marginBottom: 8 }} />
              <div className="skeleton-shimmer" style={{ width: 110, height: 10, borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{
        background: 'hsl(var(--bg-elevated))',
        borderRadius: 16,
        border: '1px solid hsl(var(--border-subtle))',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', gap: 4, padding: '10px 16px', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
          {['DRE', 'Gráficos', 'Fluxo', 'Lançamentos'].map((label, i) => (
            <div key={i} className="skeleton-shimmer" style={{
              width: label.length * 9 + 24,
              height: 32, borderRadius: 8,
            }} />
          ))}
        </div>

        {/* DRE tree rows */}
        {Array.from({ length: 12 }).map((_, i) => {
          const isGroup = i % 4 === 0
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: `${isGroup ? 10 : 6}px 20px`,
              paddingLeft: isGroup ? 20 : 36,
              borderBottom: '1px solid hsl(var(--border-subtle))',
              opacity: 1 - i * 0.05,
            }}>
              <div className="skeleton-shimmer" style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0 }} />
              <div className="skeleton-shimmer" style={{
                width: isGroup ? '40%' : '30%',
                height: isGroup ? 14 : 11,
                borderRadius: 5,
              }} />
              <div style={{ flex: 1 }} />
              {['Jan', 'Fev', 'Mar'].map((_, j) => (
                <div key={j} className="skeleton-shimmer" style={{ width: 60, height: 11, borderRadius: 4 }} />
              ))}
              <div className="skeleton-shimmer" style={{ width: 80, height: 13, borderRadius: 5 }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
