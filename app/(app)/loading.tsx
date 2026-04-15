export default function AppLoading() {
  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page header skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="skeleton-shimmer" style={{ width: 220, height: 24, borderRadius: 8, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ width: 320, height: 14, borderRadius: 6 }} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="skeleton-shimmer" style={{ width: 100, height: 38, borderRadius: 10 }} />
          <div className="skeleton-shimmer" style={{ width: 100, height: 38, borderRadius: 10 }} />
        </div>
      </div>

      {/* KPI Cards skeleton */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 16,
      }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="skeleton-shimmer"
            style={{
              height: 120,
              borderRadius: 16,
              border: '1px solid hsl(var(--border-subtle))',
            }}
          />
        ))}
      </div>

      {/* Table skeleton */}
      <div style={{
        background: 'hsl(var(--bg-elevated))',
        borderRadius: 16,
        border: '1px solid hsl(var(--border-subtle))',
        overflow: 'hidden',
      }}>
        {/* Table header */}
        <div style={{
          display: 'flex', gap: 16, padding: '14px 20px',
          borderBottom: '1px solid hsl(var(--border-subtle))',
        }}>
          {[140, 200, 100, 100, 80].map((w, i) => (
            <div key={i} className="skeleton-shimmer" style={{ width: w, height: 14, borderRadius: 6 }} />
          ))}
        </div>
        {/* Table rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'flex', gap: 16, padding: '12px 20px',
              borderBottom: '1px solid hsl(var(--border-subtle))',
              opacity: 1 - i * 0.08,
            }}
          >
            {[140, 200, 100, 100, 80].map((w, j) => (
              <div key={j} className="skeleton-shimmer" style={{ width: w, height: 12, borderRadius: 5 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
