'use client'

const shimmerStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, hsl(var(--bg-elevated)) 25%, hsl(var(--bg-overlay)) 50%, hsl(var(--bg-elevated)) 75%)',
  backgroundSize: '400% 100%',
  animation: 'skeleton-shimmer 1.4s ease infinite',
  borderRadius: 8,
}

function Bone({ w = '100%', h = 16, style = {} }: { w?: string | number; h?: number; style?: React.CSSProperties }) {
  return <div style={{ width: w, height: h, ...shimmerStyle, ...style }} />
}

interface PageSkeletonProps {
  /** Quantas linhas de tabela simular. Default: 6 */
  rows?: number
  /** Mostrar filtros de header. Default: true */
  showFilters?: boolean
  /** Número de ações no header. Default: 1 */
  headerActions?: number
}

/**
 * Skeleton genérico para páginas de listagem (tabela + header + filtros).
 * Reutilizável em qualquer módulo do ERP.
 */
export function PageSkeleton({ rows = 6, showFilters = true, headerActions = 1 }: PageSkeletonProps) {
  return (
    <>
      <style>{`
        @keyframes skeleton-shimmer {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Bone w={200} h={26} style={{ borderRadius: 6 }} />
          <Bone w={280} h={13} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {Array.from({ length: headerActions }).map((_, i) => (
            <Bone key={i} w={120} h={34} style={{ borderRadius: 8 }} />
          ))}
        </div>
      </div>

      {/* Filtros */}
      {showFilters && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          <Bone w={200} h={36} style={{ borderRadius: 8 }} />
          <Bone w={130} h={36} style={{ borderRadius: 8 }} />
          <Bone w={130} h={36} style={{ borderRadius: 8 }} />
        </div>
      )}

      {/* Tabela */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {/* Cabeçalho da tabela */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr 80px',
          gap: 16,
          padding: '12px 16px',
          borderBottom: '1px solid hsl(var(--border-muted))',
          opacity: 0.5
        }}>
          {['Nome', 'Status', 'Data', 'Valor', ''].map((_, i) => (
            <Bone key={i} w="60%" h={12} />
          ))}
        </div>

        {/* Linhas */}
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr 80px',
              gap: 16,
              padding: '14px 16px',
              borderBottom: i < rows - 1 ? '1px solid hsl(var(--border-muted))' : 'none',
              opacity: 1 - i * 0.08
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Bone w={36} h={36} style={{ borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <Bone w={140} h={13} />
                <Bone w={90} h={11} />
              </div>
            </div>
            <Bone w={70} h={22} style={{ borderRadius: 20 }} />
            <Bone w={80} h={13} />
            <Bone w={70} h={13} />
            <Bone w={32} h={32} style={{ borderRadius: 8 }} />
          </div>
        ))}
      </div>

      {/* Paginação */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
        <Bone w={150} h={12} />
        <div style={{ display: 'flex', gap: 6 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Bone key={i} w={32} h={32} style={{ borderRadius: 8 }} />
          ))}
        </div>
      </div>
    </>
  )
}
