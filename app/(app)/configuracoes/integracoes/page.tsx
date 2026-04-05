'use client'

import { CheckCircle, AlertCircle, Zap, Plus, RefreshCw, ExternalLink } from 'lucide-react'

const INTEGRACOES = [
  { id: 'I01', nome: 'Google Workspace', desc: 'Gmail, Drive, Classroom e Meet para toda a escola', icon: '🔵', status: 'conectado', categoria: 'Produtividade', ultima_sync: 'Há 5 min' },
  { id: 'I02', nome: 'PIX & Boleto Bancário', desc: 'Banco XYZ — Cobrança automática de mensalidades', icon: '🏦', status: 'conectado', categoria: 'Financeiro', ultima_sync: 'Há 2 min' },
  { id: 'I03', nome: 'WhatsApp Business API', desc: 'Comunicação via WhatsApp com famílias', icon: '💬', status: 'conectado', categoria: 'Comunicação', ultima_sync: 'Há 1 min' },
  { id: 'I04', nome: 'Gemini / Google AI', desc: 'Modelo de IA para Copilotos, Insights e análises', icon: '🤖', status: 'conectado', categoria: 'Inteligência', ultima_sync: 'Ao vivo' },
  { id: 'I05', nome: 'EDUCACENSO / MEC', desc: 'Integração com o Censo Escolar do INEP', icon: '📊', status: 'configurando', categoria: 'Governo', ultima_sync: 'Aguardando' },
  { id: 'I06', nome: 'Zoom / Google Meet', desc: 'Videoconferências e aulas online', icon: '📹', status: 'conectado', categoria: 'Comunicação', ultima_sync: 'Há 30 min' },
  { id: 'I07', nome: 'Stripe / Mercado Pago', desc: 'Pagamentos com cartão de crédito/débito', icon: '💳', status: 'desconectado', categoria: 'Financeiro', ultima_sync: 'Nunca' },
  { id: 'I08', nome: 'Zapier / Make', desc: 'Automações entre sistemas externos', icon: '⚡', status: 'disponivel', categoria: 'Automação', ultima_sync: 'N/A' },
]

const STATUS_CFG: Record<string, { color: string; badge: string; label: string }> = {
  conectado: { color: '#10b981', badge: 'badge-success', label: '✓ Conectado' },
  configurando: { color: '#f59e0b', badge: 'badge-warning', label: '⚙ Configurando' },
  desconectado: { color: '#ef4444', badge: 'badge-danger', label: '✗ Desconectado' },
  disponivel: { color: '#6b7280', badge: 'badge-neutral', label: 'Disponível' },
}

export default function IntegracoesPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Integrações & API</h1>
          <p className="page-subtitle">Conecte ferramentas externas e gerencie webhooks</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm"><ExternalLink size={13} />Documentação API</button>
          <button className="btn btn-primary btn-sm"><Plus size={13} />Nova integração</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Ativas', value: INTEGRACOES.filter(i => i.status === 'conectado').length, color: '#10b981', icon: '🔗' },
          { label: 'Configurando', value: INTEGRACOES.filter(i => i.status === 'configurando').length, color: '#f59e0b', icon: '⚙' },
          { label: 'Disponíveis', value: INTEGRACOES.filter(i => i.status === 'desconectado' || i.status === 'disponivel').length, color: '#6b7280', icon: '🔌' },
        ].map(c => (
          <div key={c.label} className="kpi-card">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>{c.icon}</span>
              <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{c.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color, fontFamily: 'Outfit, sans-serif' }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {INTEGRACOES.map(integ => {
          const cfg = STATUS_CFG[integ.status]
          return (
            <div key={integ.id} className="card" style={{ padding: '18px', display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ fontSize: 28, flexShrink: 0, width: 48, height: 48, borderRadius: 12, background: 'hsl(var(--bg-elevated))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{integ.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{integ.nome}</span>
                  <span className="badge badge-neutral" style={{ fontSize: 10 }}>{integ.categoria}</span>
                </div>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 4 }}>{integ.desc}</div>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Sync: {integ.ultima_sync}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                <span className={`badge ${cfg.badge}`}>{cfg.label}</span>
                {integ.status === 'conectado' && <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }}><RefreshCw size={10} /></button>}
                {integ.status !== 'conectado' && <button className="btn btn-primary btn-sm" style={{ fontSize: 10 }}><Zap size={10} />Conectar</button>}
              </div>
            </div>
          )
        })}
      </div>

      {/* API Key section */}
      <div className="card" style={{ padding: '20px', marginTop: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>🔑 Chaves de API — IMPACTO EDU (REST API v2)</div>
        <div style={{ padding: '10px 14px', background: 'hsl(var(--bg-elevated))', borderRadius: 8, fontFamily: 'monospace', fontSize: 12, color: '#60a5fa', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ opacity: 0.5 }}>sk_live_●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●</span>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>Revelar</button>
        </div>
        <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Documentação: <span style={{ color: '#60a5fa' }}>https://api.impactoedu.com.br/v2/docs</span></div>
      </div>
    </div>
  )
}
