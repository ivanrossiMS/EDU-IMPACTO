import { Metadata } from 'next'
import { supabaseServer as supabase } from '@/lib/supabaseServer'
import { resolveUserRole, getAuthorizedAlunoIdsForUser } from '@/lib/server/authGuard'
import { verifyCobrancaReceiptToken } from '@/lib/server/receiptToken'
import { fetchMercadoPagoPaymentInfo } from '@/lib/server/mercadopagoSync'
import { isCobrancaPaidStatus, normalizeIsoTimestamp } from '@/lib/cobrancasUtils'
import { PrintReceiptButton } from './PrintReceiptButton'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Comprovante de Pagamento | IMPACTO EDU',
  description: 'Comprovante oficial de quitação de cobrança escolar — Agenda Digital IMPACTO EDU',
  robots: 'noindex'
}

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sig?: string }>
}

function normalizeId(raw: unknown): string {
  return String(raw || '')
    .replace(/^(a_|_ALU|ALU)/i, '')
    .trim()
}

function formatBRL(val: number): string {
  return Number(val || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

function formatDateTimeSchool(raw: unknown): string {
  const iso = normalizeIsoTimestamp(raw)
  if (!iso) return 'Não informada'
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Campo_Grande',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function formatDateOnlyUtc(raw: unknown): string {
  if (!raw) return '--'
  const str = String(raw).trim()
  const d = new Date(str.includes('T') ? str : `${str}T12:00:00Z`)
  if (isNaN(d.getTime())) return '--'
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

function formatPaymentMethodLabel(details: {
  paymentMethodId: string | null
  paymentTypeId: string | null
  cardLastFour: string | null
  installments: number | null
} | null, hasMpId: boolean): string {
  if (!details && !hasMpId) return 'Baixa Manual (Secretaria)'
  if (!details) return 'Mercado Pago (Online)'

  const method = String(details.paymentMethodId || '').toLowerCase()
  const type = String(details.paymentTypeId || '').toLowerCase()
  const brandMap: Record<string, string> = {
    pix: 'Pix (Transferência Instantânea)',
    master: 'Mastercard',
    visa: 'Visa',
    elo: 'Elo',
    amex: 'American Express',
    hipercard: 'Hipercard',
    bolbradesco: 'Boleto Bancário',
    pec: 'Pagamento em Lotérica'
  }
  const brand = brandMap[method] || (method ? method.toUpperCase() : 'Mercado Pago')

  if (method === 'pix' || type === 'bank_transfer') {
    return 'Pix (Mercado Pago)'
  }
  if (type === 'credit_card' || type === 'debit_card') {
    const kind = type === 'debit_card' ? 'Cartão de Débito' : 'Cartão de Crédito'
    const last4 = details.cardLastFour ? ` •••• ${details.cardLastFour}` : ''
    const parc = details.installments && details.installments > 1 ? ` (${details.installments}x)` : ''
    return `${kind} ${brand}${last4}${parc}`
  }
  return `${brand} (Mercado Pago)`
}

export default async function CobrancaReceiptPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { sig } = await searchParams
  const cleanRowId = String(id || '').trim()

  const { data: dest, error: destErr } = await supabase
    .from('agenda_cobrancas_destinatarios')
    .select('*')
    .eq('id', cleanRowId)
    .maybeSingle()

  if (destErr || !dest) {
    return (
      <main style={styles.pageBg}>
        <section style={styles.card}>
          <div style={{ ...styles.badge, background: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' }}>
            COMPROVANTE NÃO ENCONTRADO
          </div>
          <h1 style={styles.title}>Registro não localizado</h1>
          <p style={styles.subtitle}>
            Não foi possível localizar o registro de cobrança informado. Verifique o link ou solicite um novo comprovante à secretaria escolar.
          </p>
        </section>
      </main>
    )
  }

  let authorized = verifyCobrancaReceiptToken(cleanRowId, sig)

  if (!authorized) {
    try {
      const role = await resolveUserRole()
      if (role.user && !role.errorResponse) {
        if (role.isStaff) {
          authorized = true
        } else if (role.isFamilyOrStudent) {
          const authIds = await getAuthorizedAlunoIdsForUser(role.user)
          const cleanTarget = normalizeId(dest.destinatario_id)
          const normalizedSet = new Set(Array.from(authIds).map(x => normalizeId(x)))
          if (
            normalizedSet.has(cleanTarget) ||
            (dest.pagador_usuario_id && String(dest.pagador_usuario_id) === String(role.user.id))
          ) {
            authorized = true
          }
        }
      }
    } catch {
      authorized = false
    }
  }

  if (!authorized) {
    return (
      <main style={styles.pageBg}>
        <section style={styles.card}>
          <div style={{ ...styles.badge, background: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' }}>
            ACESSO RESTRITO
          </div>
          <h1 style={styles.title}>Link de comprovante inválido ou sem autorização</h1>
          <p style={styles.subtitle}>
            Para visualizar este comprovante, acesse usando o link completo gerado pelo sistema ou faça login com sua conta vinculada ao aluno.
          </p>
        </section>
      </main>
    )
  }

  const isPaid = isCobrancaPaidStatus(dest.status)
  const [{ data: cobranca }, { data: alunoRow }, { data: arLinks }] = await Promise.all([
    supabase.from('agenda_cobrancas').select('*').eq('id', dest.cobranca_id).maybeSingle(),
    supabase
      .from('alunos')
      .select('id, nome, turma, matricula')
      .in('id', [normalizeId(dest.destinatario_id), String(dest.destinatario_id)])
      .limit(1)
      .maybeSingle(),
    supabase
      .from('aluno_responsavel')
      .select('responsavel_id, parentesco, resp_financeiro, prioridade')
      .in('aluno_id', [normalizeId(dest.destinatario_id), String(dest.destinatario_id)])
  ])

  let responsavelNome = ''
  if (arLinks && arLinks.length > 0) {
    const sorted = [...arLinks].sort((a, b) => {
      if (Boolean(a.resp_financeiro) !== Boolean(b.resp_financeiro)) return a.resp_financeiro ? -1 : 1
      return (Number(a.prioridade) || 0) - (Number(b.prioridade) || 0)
    })
    const respIds = sorted.map(l => l.responsavel_id).filter(Boolean)
    if (respIds.length > 0) {
      const { data: respRows } = await supabase
        .from('responsaveis')
        .select('id, nome')
        .in('id', respIds)
      const primary = respRows?.find(r => String(r.id) === String(sorted[0].responsavel_id)) || respRows?.[0]
      if (primary?.nome) responsavelNome = String(primary.nome).trim()
    }
  }

  let turmaNome = String(alunoRow?.turma || '').trim()
  if (turmaNome && (/^\d+$/.test(turmaNome) || turmaNome.startsWith('sync-'))) {
    const { data: turmaRow } = await supabase
      .from('turmas')
      .select('nome')
      .or(`id.eq."${turmaNome}",codigo.eq."${turmaNome}"`)
      .limit(1)
      .maybeSingle()
    if (turmaRow?.nome) turmaNome = String(turmaRow.nome).trim()
  }

  const asaasIdStr = String(dest.asaas_payment_id || '').trim()
  const isNumericMpId = /^\d+$/.test(asaasIdStr)
  const mpInfo = isPaid && isNumericMpId ? await fetchMercadoPagoPaymentInfo(asaasIdStr) : null
  const mpDetails = mpInfo?.details || null

  const paidAtIso = dest.paid_at || mpInfo?.paidAt || null
  const valorUnitario = Number(cobranca?.valor || mpDetails?.totalPaidAmount || 0)
  const paymentMethodLabel = formatPaymentMethodLabel(mpDetails, isNumericMpId)

  if (!isPaid) {
    return (
      <main style={styles.pageBg}>
        <section style={styles.card}>
          <div style={{ ...styles.badge, background: '#fffbeb', color: '#b45309', borderColor: '#fde68a' }}>
            COBRANÇA EM ABERTO / NÃO QUITADA
          </div>
          <h1 style={styles.title}>{cobranca?.titulo || 'Cobrança Escolar'}</h1>
          <p style={styles.subtitle}>
            Esta cobrança referente ao(à) aluno(a) <strong>{dest.destinatario_nome || alunoRow?.nome || 'Aluno'}</strong> encontra-se com status{' '}
            <strong>{String(dest.status || 'PENDING')}</strong> e não possui comprovante de quitação válido no momento.
          </p>
        </section>
      </main>
    )
  }

  return (
    <main style={styles.pageBg}>
      <style>{`
        @media print {
          body { background: #ffffff !important; }
          .no-print { display: none !important; }
          .receipt-card { box-shadow: none !important; border: 1px solid #cbd5e1 !important; margin: 0 !important; max-width: 100% !important; }
        }
      `}</style>

      <section className="receipt-card" style={styles.card}>
        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', borderBottom: '1.5px solid #e2e8f0', paddingBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: '#059669', textTransform: 'uppercase' }}>
              IMPACTO EDU • AGENDA DIGITAL
            </div>
            <h1 style={{ ...styles.title, marginTop: 4 }}>Comprovante de Pagamento</h1>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
              {cobranca?.titulo || 'Cobrança Escolar'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <span style={{ ...styles.badge, background: '#dcfce7', color: '#15803d', borderColor: '#86efac' }}>
              ✓ PAGAMENTO CONFIRMADO
            </span>
            <span style={{ fontSize: 24, fontWeight: 900, color: '#065f46', fontFamily: 'Outfit, sans-serif' }}>
              {formatBRL(valorUnitario)}
            </span>
          </div>
        </div>

        {/* Grade Principal de Dados */}
        <div style={styles.grid}>
          <div style={styles.field}>
            <div style={styles.label}>Aluno(a)</div>
            <div style={styles.value}>{dest.destinatario_nome || alunoRow?.nome || '--'}</div>
          </div>
          <div style={styles.field}>
            <div style={styles.label}>Turma / Matrícula</div>
            <div style={styles.value}>
              {turmaNome || '--'}
              {alunoRow?.matricula ? ` • Mat: ${alunoRow.matricula}` : ''}
            </div>
          </div>
          <div style={styles.field}>
            <div style={styles.label}>Responsável Financeiro</div>
            <div style={styles.value}>{responsavelNome || dest.pagador_usuario_nome || 'Não informado'}</div>
          </div>
          <div style={styles.field}>
            <div style={styles.label}>Pagador (Usuário Confirmado)</div>
            <div style={styles.value}>{dest.pagador_usuario_nome || responsavelNome || 'Confirmado'}</div>
          </div>
          <div style={styles.field}>
            <div style={styles.label}>Data e Hora da Aprovação</div>
            <div style={{ ...styles.value, color: '#047857', fontWeight: 800 }}>
              {formatDateTimeSchool(paidAtIso)}
            </div>
          </div>
          <div style={styles.field}>
            <div style={styles.label}>Vencimento da Cobrança</div>
            <div style={styles.value}>{formatDateOnlyUtc(cobranca?.vencimento)}</div>
          </div>
          <div style={styles.field}>
            <div style={styles.label}>Meio de Pagamento</div>
            <div style={styles.value}>{paymentMethodLabel}</div>
          </div>
          <div style={styles.field}>
            <div style={styles.label}>Data de Envio da Cobrança</div>
            <div style={styles.value}>{formatDateTimeSchool(dest.created_at)}</div>
          </div>
        </div>

        {/* Detalhes Oficiais Mercado Pago (quando pago via MP) */}
        {isNumericMpId && (
          <div style={{ marginTop: 20, padding: 16, borderRadius: 14, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              Dados da Transação • Mercado Pago
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10, fontSize: 12.5 }}>
              <div>
                <span style={{ color: '#64748b' }}>ID Pagamento MP: </span>
                <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>#{asaasIdStr}</strong>
              </div>
              {mpDetails?.orderId && (
                <div>
                  <span style={{ color: '#64748b' }}>Order ID: </span>
                  <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{mpDetails.orderId}</strong>
                </div>
              )}
              {mpDetails?.authorizationCode && (
                <div>
                  <span style={{ color: '#64748b' }}>Cód. Autorização: </span>
                  <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{mpDetails.authorizationCode}</strong>
                </div>
              )}
              {mpDetails?.transactionId && (
                <div style={{ gridColumn: '1 / -1', wordBreak: 'break-all' }}>
                  <span style={{ color: '#64748b' }}>ID Transação / E2E Pix: </span>
                  <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{mpDetails.transactionId}</strong>
                </div>
              )}
              {mpDetails?.payerBankName && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: '#64748b' }}>Instituição Pagadora: </span>
                  <strong style={{ color: '#0f172a' }}>{mpDetails.payerBankName}</strong>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rodapé e Ações */}
        <div className="no-print" style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11.5, color: '#64748b' }}>
            Código do registro: <span style={{ fontFamily: 'monospace' }}>{dest.id}</span>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {mpDetails?.receiptUrl && (
              <a
                href={mpDetails.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '10px 16px',
                  borderRadius: 12,
                  border: '1px solid #bfdbfe',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  fontSize: 13,
                  fontWeight: 800,
                  textDecoration: 'none'
                }}
              >
                Abrir Ticket Mercado Pago ↗
              </a>
            )}
            <PrintReceiptButton />
          </div>
        </div>
      </section>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  pageBg: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f8fafc 0%, #ecfdf5 100%)',
    padding: '28px 16px',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    color: '#0f172a'
  },
  card: {
    width: '100%',
    maxWidth: 740,
    background: '#ffffff',
    borderRadius: 22,
    border: '1px solid #e2e8f0',
    boxShadow: '0 20px 45px -12px rgba(15, 23, 42, 0.12)',
    padding: '28px 30px'
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '5px 12px',
    borderRadius: 999,
    border: '1px solid',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.04em'
  },
  title: {
    margin: '10px 0 4px 0',
    fontSize: 22,
    fontWeight: 900,
    color: '#0f172a',
    fontFamily: 'Outfit, Inter, sans-serif'
  },
  subtitle: {
    margin: '6px 0 0 0',
    fontSize: 14,
    lineHeight: 1.55,
    color: '#475569'
  },
  grid: {
    marginTop: 20,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 16
  },
  field: {
    padding: '10px 12px',
    borderRadius: 12,
    background: '#f8fafc',
    border: '1px solid #f1f5f9'
  },
  label: {
    fontSize: 11,
    fontWeight: 800,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 4
  },
  value: {
    fontSize: 14,
    fontWeight: 700,
    color: '#0f172a'
  }
}
