'use client'

/** Shimmer animation para skeleton loaders */
const shimmerStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, hsl(var(--bg-elevated)) 25%, hsl(var(--bg-overlay)) 50%, hsl(var(--bg-elevated)) 75%)',
  backgroundSize: '400% 100%',
  animation: 'skeleton-shimmer 1.4s ease infinite',
  borderRadius: 8,
}

function Bone({ w = '100%', h = 16, style = {} }: { w?: string | number; h?: number; style?: React.CSSProperties }) {
  return <div style={{ width: w, height: h, ...shimmerStyle, ...style }} />
}

/** Skeleton de KPI card individual */
function KpiCardSkeleton() {
  return (
    <div className="kpi-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Bone w={40} h={40} style={{ borderRadius: 10 }} />
        <Bone w={50} h={16} />
      </div>
      <Bone w="70%" h={28} style={{ borderRadius: 6 }} />
      <Bone w="50%" h={12} />
    </div>
  )
}

/** Skeleton completo do Hub Executivo (dashboard) */
export function DashboardSkeleton() {
  return (
    <>
      <style>{`
        @keyframes skeleton-shimmer {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Bone w={180} h={28} style={{ borderRadius: 6 }} />
          <Bone w={260} h={14} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Bone w={100} h={32} style={{ borderRadius: 8 }} />
          <Bone w={120} h={32} style={{ borderRadius: 8 }} />
        </div>
      </div>

      {/* AI Banner */}
      <div className="ia-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Bone w={40} h={40} style={{ borderRadius: 12, flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Bone w="60%" h={14} />
          <Bone w="80%" h={12} />
        </div>
        <Bone w={90} h={30} style={{ borderRadius: 8, flexShrink: 0 }} />
      </div>

      {/* KPI Grid — 4 colunas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {Array.from({ length: 8 }).map((_, i) => <KpiCardSkeleton key={i} />)}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="chart-container" style={{ minHeight: 220 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Bone w={160} h={16} />
              <Bone w={220} h={12} />
            </div>
            <Bone w={100} h={14} />
          </div>
          <Bone w="100%" h={160} style={{ borderRadius: 10 }} />
        </div>

        {[0, 1].map(i => (
          <div key={i} className="chart-container" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Bone w="60%" h={16} />
            <Bone w="100%" h={120} style={{ borderRadius: '50%', alignSelf: 'center' }} />
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Bone w="40%" h={12} />
                <Bone w="20%" h={12} />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Ocupação + Alertas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {[0, 1].map(i => (
          <div key={i} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Bone w="50%" h={16} />
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Bone w="40%" h={12} />
                  <Bone w="25%" h={12} />
                </div>
                <Bone w="100%" h={6} style={{ borderRadius: 4 }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
