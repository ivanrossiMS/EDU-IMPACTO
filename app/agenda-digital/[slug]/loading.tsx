/**
 * loading.tsx — Skeleton premium para a Agenda Digital
 *
 * Mostrado pelo Next.js enquanto o layout da Agenda Digital carrega os dados do aluno.
 * Simula o header do aluno + tabs de navegação + área de conteúdo.
 * Zero tela branca.
 */
export default function AgendaDigitalLoading() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      padding: '0',
      fontFamily: 'Inter, sans-serif',
    }}>
      <style>{`
        @keyframes shimmer-ag {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
        .ag-sk {
          background: linear-gradient(
            90deg,
            hsl(220 22% 14%) 25%,
            hsl(220 20% 18%) 50%,
            hsl(220 22% 14%) 75%
          );
          background-size: 400% 100%;
          animation: shimmer-ag 1.6s ease infinite;
          border-radius: 8px;
        }
      `}</style>

      {/* ── Header do Aluno (Card Premium) ──────────────────────────────── */}
      <div style={{
        background: '#ffffff',
        borderRadius: 24,
        padding: '24px 32px',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 24,
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 12px 40px rgba(15, 12, 36, 0.04)',
        border: '1px solid rgba(0,0,0,0.04)',
      }}>
        {/* Barra neon superior */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 6,
          background: 'linear-gradient(90deg, #6366f1, #a855f7, #ec4899, #3b82f6)',
          backgroundSize: '200% 100%',
          animation: 'shimmer-ag 2s linear infinite',
        }} />

        {/* Left: Avatar + Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Avatar skeleton */}
          <div className="ag-sk" style={{ width: 72, height: 72, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Nome */}
            <div className="ag-sk" style={{ width: 280, height: 18 }} />
            {/* Mini cards row */}
            <div style={{ display: 'flex', gap: 8 }}>
              {[90, 100, 120].map((w, i) => (
                <div key={i} className="ag-sk" style={{ width: w, height: 34, borderRadius: 12 }} />
              ))}
            </div>
          </div>
        </div>

        {/* Right: Botão CTA */}
        <div className="ag-sk" style={{ width: 220, height: 56, borderRadius: 24 }} />
      </div>

      {/* ── Barra de Navegação (Tabs) ────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        gap: 4,
        background: 'hsl(220 22% 14%)',
        borderRadius: 12,
        padding: 4,
        border: '1px solid hsl(220 15% 22%)',
        overflowX: 'auto',
      }}>
        {[80, 100, 90, 100, 100, 90, 70, 100, 90].map((w, i) => (
          <div
            key={i}
            className="ag-sk"
            style={{
              width: w,
              height: 36,
              borderRadius: 8,
              flexShrink: 0,
              opacity: i === 0 ? 1 : 0.5,
            }}
          />
        ))}
      </div>

      {/* ── Área de Conteúdo ─────────────────────────────────────────────── */}
      <div style={{
        background: 'hsl(220 24% 11%)',
        borderRadius: 16,
        border: '1px solid hsl(220 15% 22%)',
        overflow: 'hidden',
      }}>
        {/* Header da página interna */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid hsl(220 15% 22%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div className="ag-sk" style={{ width: 200, height: 20, marginBottom: 8 }} />
            <div className="ag-sk" style={{ width: 300, height: 13 }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="ag-sk" style={{ width: 100, height: 38, borderRadius: 10 }} />
          </div>
        </div>

        {/* Linhas de conteúdo */}
        <div style={{ padding: '0 24px 24px' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 16,
                padding: '14px 0',
                borderBottom: '1px solid hsl(220 15% 22%)',
                alignItems: 'center',
                opacity: 1 - i * 0.12,
              }}
            >
              <div className="ag-sk" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="ag-sk" style={{ width: '70%', height: 14, marginBottom: 6 }} />
                <div className="ag-sk" style={{ width: '40%', height: 11 }} />
              </div>
              <div className="ag-sk" style={{ width: 80, height: 24, borderRadius: 999 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
