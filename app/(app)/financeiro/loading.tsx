export default function FinanceiroLoading() {
  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="skeleton-shimmer" style={{ width: 200, height: 22, borderRadius: 8, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ width: 280, height: 13, borderRadius: 6 }} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="skeleton-shimmer" style={{ width: 120, height: 38, borderRadius: 10 }} />
          <div className="skeleton-shimmer" style={{ width: 38, height: 38, borderRadius: 10 }} />
        </div>
      </div>

      {/* KPI cards financeiros */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 16,
      }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{
            borderRadius: 16,
            border: '1px solid hsl(var(--border-subtle))',
            overflow: 'hidden',
            position: 'relative',
          }}>
            {/* Accent bar */}
            <div className="skeleton-shimmer" style={{ height: 3 }} />
            <div style={{ padding: '18px 20px' }}>
              <div className="skeleton-shimmer" style={{ width: 80, height: 10, borderRadius: 4, marginBottom: 10 }} />
              <div className="skeleton-shimmer" style={{ width: 120, height: 22, borderRadius: 6, marginBottom: 8 }} />
              <div className="skeleton-shimmer" style={{ width: 100, height: 10, borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{
        background: 'hsl(var(--bg-elevated))',
        borderRadius: 16,
        border: '1px solid hsl(var(--border-subtle))',
        overflow: 'hidden',
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '12px 20px', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
          {[80, 90, 70, 60].map((w, i) => (
            <div key={i} className="skeleton-shimmer" style={{ width: w, height: 30, borderRadius: 8 }} />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{
            display: 'flex', gap: 16, padding: '12px 20px',
            borderBottom: '1px solid hsl(var(--border-subtle))',
            opacity: 1 - i * 0.07,
          }}>
            <div className="skeleton-shimmer" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="skeleton-shimmer" style={{ width: '60%', height: 12, borderRadius: 5 }} />
              <div className="skeleton-shimmer" style={{ width: '35%', height: 10, borderRadius: 4 }} />
            </div>
            <div className="skeleton-shimmer" style={{ width: 80, height: 14, borderRadius: 5 }} />
            <div className="skeleton-shimmer" style={{ width: 70, height: 24, borderRadius: 8 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
