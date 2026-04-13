import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

interface Props {
  params: { token: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: 'Validação de Recibo | IMPACTO EDU',
    description: 'Verifique a autenticidade deste recibo emitido pelo Sistema ERP IMPACTO EDU',
    robots: 'noindex',
  }
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function generateHash(data: {
  id: string; validation_token: string; baixa_id: string
  paid_amount: number; payment_date: string | null
}): string {
  const content = `${data.id}|${data.validation_token}|${data.baixa_id}|${data.paid_amount}|${data.payment_date || ''}`
  return createHash('sha256').update(content).digest('hex')
}

function maskDoc(doc: string | null): string {
  if (!doc) return '—'
  const clean = doc.replace(/\D/g, '')
  if (clean.length === 11) return `***.***.${ clean.slice(6, 9)}-**`
  if (clean.length === 14) return `**.***.${ clean.slice(5, 8)}/${clean.slice(8, 12)}-**`
  return doc.slice(0, 3) + '***'
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  const date = new Date(d)
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

const STATUS_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string; border: string; desc: string }> = {
  valido: {
    label: 'Pagamento Confirmado',
    icon: '✅',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.3)',
    desc: 'Este recibo é autêntico e válido como comprovante de pagamento.',
  },
  cancelado: {
    label: 'Recibo Cancelado',
    icon: '❌',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.3)',
    desc: 'Este recibo foi cancelado e não é mais válido como comprovante.',
  },
  estornado: {
    label: 'Pagamento Estornado',
    icon: '↩️',
    color: '#f97316',
    bg: 'rgba(249,115,22,0.08)',
    border: 'rgba(249,115,22,0.3)',
    desc: 'Este pagamento foi estornado. O recibo permanece apenas para histórico.',
  },
  substituido: {
    label: 'Recibo Substituído',
    icon: '🔄',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.3)',
    desc: 'Este recibo foi substituído por uma nova versão. Solicite o recibo atualizado.',
  },
  invalido: {
    label: 'Recibo Inválido',
    icon: '⚠️',
    color: '#6b7280',
    bg: 'rgba(107,114,128,0.08)',
    border: 'rgba(107,114,128,0.3)',
    desc: 'Este recibo não pôde ser validado. A integridade do documento está comprometida.',
  },
  inconsistente: {
    label: 'Recibo com Inconsistência',
    icon: '⚡',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.3)',
    desc: 'O recibo foi localizado, mas os dados associados apresentam inconsistência.',
  },
  nao_encontrado: {
    label: 'Recibo Não Encontrado',
    icon: '🔍',
    color: '#6b7280',
    bg: 'rgba(107,114,128,0.08)',
    border: 'rgba(107,114,128,0.3)',
    desc: 'Nenhum recibo correspondente foi encontrado na base de dados.',
  },
}

export default async function PublicValidationPage({ params }: Props) {
  const { token } = params
  const supabase = getSupabase()

  let status = 'nao_encontrado'
  let receipt: any = null
  let errorMessage = ''

  try {
    const { data: r } = await supabase
      .from('financial_receipts')
      .select('*')
      .eq('validation_token', token)
      .single()

    if (!r) {
      status = 'nao_encontrado'
    } else {
      const expectedHash = generateHash({
        id: r.id,
        validation_token: r.validation_token,
        baixa_id: r.baixa_id,
        paid_amount: r.paid_amount,
        payment_date: r.payment_date,
      })

      if (r.validation_hash !== expectedHash) {
        status = 'invalido'
        receipt = r
      } else if (['cancelado', 'estornado', 'substituido'].includes(r.receipt_status)) {
        status = r.receipt_status
        receipt = r
      } else {
        // Verificar a baixa
        const { data: titulo } = await supabase
          .from('titulos')
          .select('status')
          .eq('id', r.baixa_id)
          .single()

        if (!titulo || titulo.status !== 'pago') {
          status = 'inconsistente'
        } else {
          status = 'valido'
        }
        receipt = r
      }
    }
  } catch (_) {
    status = 'nao_encontrado'
  }

  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['nao_encontrado']

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #060d1a 0%, #080f1e 50%, #090d1c 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      color: '#e2e8f0',
    }}>
      {/* Header institucional */}
      <header style={{
        width: '100%',
        padding: '0 24px',
        borderBottom: '1px solid rgba(59,130,246,0.1)',
        background: 'rgba(6,13,26,0.95)',
        backdropFilter: 'blur(20px)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{
          maxWidth: 800,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          height: 64,
        }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(59,130,246,0.3)',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 20 }}>🎓</span>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.01em', color: '#f1f5f9' }}>
              IMPACTO EDU
            </div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
              Sistema de Validação Digital de Recibos
            </div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 11, color: '#475569' }}>
            🔒 Validação Segura
          </div>
        </div>
      </header>

      {/* Conteúdo principal */}
      <main style={{ flex: 1, width: '100%', maxWidth: 800, padding: '48px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Título da página */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px', color: '#f1f5f9' }}>
            Confirmação de Autenticidade
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
            Este comprovante foi verificado pela infraestrutura segura do ERP IMPACTO EDU
          </p>
        </div>

        {/* Card de status principal */}
        <div style={{
          border: `2px solid ${cfg.border}`,
          borderRadius: 20,
          background: cfg.bg,
          padding: '40px 32px',
          textAlign: 'center',
          backdropFilter: 'blur(10px)',
          boxShadow: `0 0 60px ${cfg.color}15`,
        }}>
          <div style={{ fontSize: 64, marginBottom: 16, lineHeight: 1 }}>{cfg.icon}</div>
          <h2 style={{
            fontSize: 28,
            fontWeight: 900,
            color: cfg.color,
            margin: '0 0 12px',
            letterSpacing: '-0.02em',
          }}>
            {cfg.label}
          </h2>
          <p style={{ fontSize: 15, color: '#94a3b8', margin: 0, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
            {cfg.desc}
          </p>
        </div>

        {/* Dados do recibo (quando encontrado) */}
        {receipt && (
          <div style={{
            background: 'rgba(15,23,42,0.8)',
            border: '1px solid rgba(51,65,85,0.5)',
            borderRadius: 16,
            overflow: 'hidden',
            backdropFilter: 'blur(10px)',
          }}>
            {/* Header do card */}
            <div style={{
              padding: '16px 24px',
              background: 'rgba(59,130,246,0.06)',
              borderBottom: '1px solid rgba(51,65,85,0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <span style={{ fontSize: 16 }}>📄</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#e2e8f0' }}>
                Detalhes do Recibo
              </span>
              <span style={{
                marginLeft: 'auto',
                fontFamily: 'monospace',
                fontSize: 13,
                fontWeight: 700,
                color: '#60a5fa',
                background: 'rgba(59,130,246,0.1)',
                padding: '3px 10px',
                borderRadius: 6,
              }}>
                {receipt.receipt_number}
              </span>
            </div>

            {/* Grid de dados */}
            <div style={{ padding: 24 }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 20,
              }}>
                {[
                  { label: '👤 Aluno', value: receipt.aluno_nome || '—' },
                  { label: '👨‍👩‍👧 Responsável', value: receipt.responsavel_nome || receipt.payer_name || '—' },
                  { label: '🏫 Unidade', value: receipt.unidade_nome || '—' },
                  { label: '📚 Turma', value: receipt.aluno_turma || '—' },
                  { label: '📅 Data do Pagamento', value: fmtDate(receipt.payment_date) },
                  { label: '📝 Data de Emissão', value: fmtDate(receipt.issue_date) },
                  { label: '💳 Forma de Pagamento', value: receipt.payment_method || '—' },
                  { label: '📋 Evento Financeiro', value: receipt.event_description || '—' },
                  { label: '🔑 ID da Baixa', value: receipt.baixa_id || '—' },
                  { label: '🪪 CPF/CNPJ', value: receipt.payer_document || '—' },
                ].map(item => (
                  <div key={item.label} style={{
                    background: 'rgba(30,41,59,0.5)',
                    borderRadius: 10,
                    padding: '14px 16px',
                    border: '1px solid rgba(51,65,85,0.3)',
                  }}>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', wordBreak: 'break-all' }}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Valor pago em destaque */}
              <div style={{
                marginTop: 20,
                background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(5,150,105,0.05))',
                border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: 12,
                padding: '20px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: 12, color: '#6ee7b7', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Valor Pago
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 900, color: '#10b981', letterSpacing: '-0.02em', fontFamily: 'Outfit, sans-serif' }}>
                    {fmtCurrency(receipt.paid_amount)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Versão do Recibo</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#60a5fa' }}>v{receipt.receipt_version}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Informações de segurança */}
        <div style={{
          background: 'rgba(15,23,42,0.6)',
          border: '1px solid rgba(51,65,85,0.4)',
          borderRadius: 12,
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 16,
        }}>
          <span style={{ fontSize: 24, flexShrink: 0 }}>🔒</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#e2e8f0', marginBottom: 6 }}>
              Garantia Digital — IMPACTO EDU
            </div>
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
              Este recibo foi validado pela infraestrutura de segurança do ERP IMPACTO EDU.
              A autenticidade é verificada através de token único e hash criptográfico SHA-256.
              Em caso de dúvidas, entre em contato com a secretaria da instituição.
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div style={{ textAlign: 'center', fontSize: 12, color: '#334155', padding: '8px 0' }}>
          Validação realizada em {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      </main>
    </div>
  )
}
