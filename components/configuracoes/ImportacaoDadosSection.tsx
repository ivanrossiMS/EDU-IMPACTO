'use client'

import { useState } from 'react'
import {
  Users, Camera, BookOpen, UserCheck, DollarSign,
  ClipboardList, ArrowRight,
  CheckCircle, XCircle, Download, Briefcase, CreditCard
} from 'lucide-react'
import { useImportLog, downloadText, type ImportLog } from './importacao/useImportacao'
import { ImportacaoAlunos } from './importacao/ImportacaoAlunos'
import { ImportacaoFotos } from './importacao/ImportacaoFotos'
import { ImportacaoGenerica, type ImportMod } from './importacao/ImportacaoGenerica'

/* ─── Sub-tabs ───────────────────────────────────────────────────────────── */
const TABS = [
  { id: 'dashboard',    icon: <BookOpen size={14}/>,    label: 'Dashboard',           color: '#6366f1' },
  { id: 'alunos',       icon: <Users size={14}/>,       label: 'Alunos',              color: '#3b82f6' },
  { id: 'fotos',        icon: <Camera size={14}/>,      label: 'Fotos',               color: '#8b5cf6' },
  { id: 'turmas',       icon: <BookOpen size={14}/>,    label: 'Turmas',              color: '#10b981' },
  { id: 'responsaveis', icon: <UserCheck size={14}/>,   label: 'Responsáveis',        color: '#f59e0b' },
  { id: 'financeiro',   icon: <DollarSign size={14}/>,  label: 'Fin. Títulos',        color: '#ef4444' },
  { id: 'funcionarios', icon: <Briefcase size={14}/>,   label: 'Funcionários',        color: '#8b5cf6' },
  { id: 'contas_pagar', icon: <CreditCard size={14}/>,  label: 'Contas a Pagar',      color: '#dc2626' },
  { id: 'historico',    icon: '📋',                    label: 'Histórico',           color: '#64748b' },
]

const ORDER_STEPS = [
  { n: 1, label: 'Turmas',        icon: '📚', desc: 'Crie as turmas antes de vincular alunos', tab: 'turmas' },
  { n: 2, label: 'Alunos',        icon: '👤', desc: 'Importe cadastros com código do sistema', tab: 'alunos' },
  { n: 3, label: 'Responsáveis',  icon: '👨‍👩‍👧', desc: 'Vincule via código do aluno', tab: 'responsaveis' },
  { n: 4, label: 'Fotos',         icon: '📷', desc: 'Nomeie como {código}.jpg', tab: 'fotos' },
  { n: 5, label: 'Financeiro',    icon: '💰', desc: 'Títulos e parcelas por aluno', tab: 'financeiro' },
  { n: 6, label: 'Funcionários',  icon: '👔', desc: 'Professores e colaboradores', tab: 'funcionarios' },
]

/* ─── Helpers ────────────────────────────────────────────────────────────── */
type AlunoState = any[]
type AlunoSetter = (fn: (prev: AlunoState) => AlunoState) => void

export default function ImportacaoDadosSection() {
  const [tab, setTab] = useState('dashboard')
  const { logs, addLog } = useImportLog()

  // Dummy state for components that still use local state as fallback
  const [alunos, setAlunos] = useState<AlunoState>([])
  const wrapSetter = <T,>(fn: any): ((upd: (p: T[]) => T[]) => void) => fn

  const totalImportados = logs.reduce((s, l) => s + l.inseridos, 0)
  const totalAtualizados = logs.reduce((s, l) => s + l.atualizados, 0)
  const totalErros      = logs.reduce((s, l) => s + l.erros, 0)

  /* Tab content for generic modules */
  const genericMod = (
    id: ImportMod,
    emoji: string,
    title: string,
    desc: string,
    color: string
  ) => (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>{emoji} {title}</div>
      <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 20 }}>{desc}</div>
      <ImportacaoGenerica modulo={id} onLog={addLog} />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── HEADER ── */}
      <div style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(59,130,246,0.08))', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              📥 Importação de Dados
            </div>
            <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginTop: 4, maxWidth: 540 }}>
              Importe dados em massa via CSV ou XLSX com validação automática, mapeamento de colunas e salvamento direto no Supabase.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { label: 'Inseridos',   val: totalImportados, color: '#10b981' },
              { label: 'Atualizados', val: totalAtualizados, color: '#3b82f6' },
              { label: 'Com erro',    val: totalErros,      color: '#ef4444' },
              { label: 'Operações',   val: logs.length,     color: '#6366f1' },
            ].map(s => (
              <div key={s.label} style={{ background: 'hsl(var(--bg-surface))', border: `1px solid ${s.color}30`, borderRadius: 10, padding: '10px 14px', textAlign: 'center', minWidth: 68 }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: s.color, fontFamily: 'Outfit' }}>{s.val}</div>
                <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', borderBottom: '2px solid hsl(var(--border-subtle))', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: '10px 10px 0 0', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
              transition: 'all .15s', marginBottom: -2,
              background: tab === t.id ? 'hsl(var(--bg-surface))' : 'transparent',
              color: tab === t.id ? t.color : 'hsl(var(--text-muted))',
              borderBottom: tab === t.id ? `2px solid ${t.color}` : '2px solid transparent',
            }}>
            <span style={{ color: t.color }}>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* ══ DASHBOARD ══ */}
      {tab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {[
              { icon: '📄', title: 'Formatos aceitos', desc: 'CSV (;), XLSX, XLS. Imagens: JPG, PNG, WEBP para fotos', color: '#6366f1' },
              { icon: '🔗', title: 'Conectado ao Supabase', desc: 'Todos os dados são salvos diretamente no banco de dados com deduplicação', color: '#10b981' },
              { icon: '🔒', title: 'Seguro e auditável', desc: 'Toda operação fica registrada no histórico com data, hora e usuário', color: '#f59e0b' },
            ].map(a => (
              <div key={a.title} style={{ background: `${a.color}0d`, border: `1px solid ${a.color}30`, borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>{a.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{a.desc}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: '20px 24px' }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 18 }}>🗺️ Ordem Recomendada de Importação</div>
            <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 0 }}>
              {ORDER_STEPS.map((s, i) => (
                <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                  <div
                    onClick={() => setTab(s.tab)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 10px', cursor: 'pointer' }}>
                    <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 4px 14px rgba(99,102,241,0.3)', marginBottom: 8 }}>{s.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: 12 }}>{s.n}. {s.label}</div>
                    <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', maxWidth: 80, marginTop: 2 }}>{s.desc}</div>
                  </div>
                  {i < ORDER_STEPS.length - 1 && <ArrowRight size={14} color="hsl(var(--text-muted))" style={{ flexShrink: 0 }} />}
                </div>
              ))}
            </div>
          </div>

          {/* Módulos disponíveis */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>📦 Módulos de Importação Disponíveis</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {[
                { tab: 'alunos',       icon: '👤', label: 'Alunos',           desc: 'Cadastro completo com validação CPF', color: '#3b82f6' },
                { tab: 'fotos',        icon: '📷', label: 'Fotos',            desc: 'Vinculação automática por código', color: '#8b5cf6' },
                { tab: 'turmas',       icon: '📚', label: 'Turmas',           desc: '12 campos incluindo ano letivo', color: '#10b981' },
                { tab: 'responsaveis', icon: '👨‍👩‍👧', label: 'Responsáveis',   desc: '25+ campos com vínculo automático', color: '#f59e0b' },
                { tab: 'funcionarios', icon: '👔', label: 'Funcionários',     desc: 'RH completo com dados bancários', color: '#8b5cf6' },
                { tab: 'financeiro',   icon: '💰', label: 'Títulos',          desc: 'Parcelas com status de pagamento', color: '#ef4444' },
                { tab: 'contas_pagar', icon: '💳', label: 'Contas a Pagar',  desc: 'AP com fornecedor e N° documento', color: '#dc2626' },
              ].map(m => (
                <div key={m.tab} onClick={() => setTab(m.tab)} style={{ padding: '12px 14px', borderRadius: 10, border: `1px solid ${m.color}20`, background: `${m.color}0a`, cursor: 'pointer', transition: 'all .15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = `${m.color}18`)}
                  onMouseLeave={e => (e.currentTarget.style.background = `${m.color}0a`)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 18 }}>{m.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: m.color }}>{m.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{m.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent logs */}
          {logs.length > 0 && (
            <div className="card" style={{ padding: '20px 24px' }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>📋 Últimas Importações</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {logs.slice(0, 5).map(l => (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'hsl(var(--bg-elevated))', borderRadius: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.status === 'sucesso' ? '#10b981' : l.status === 'parcial' ? '#f59e0b' : '#ef4444', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{l.modulo}</div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{l.arquivo} · {new Date(l.dataHora).toLocaleString('pt-BR')}</div>
                    </div>
                    <div style={{ fontSize: 12, textAlign: 'right' }}>
                      <span style={{ color: '#10b981' }}>✓ {l.inseridos}</span>
                      {l.atualizados > 0 && <span style={{ color: '#3b82f6', marginLeft: 6 }}>↻ {l.atualizados}</span>}
                      {l.erros > 0 && <span style={{ color: '#ef4444', marginLeft: 6 }}>✗ {l.erros}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ ALUNOS ══ */}
      {tab === 'alunos' && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>👤 Importação de Alunos</div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 20 }}>
            Importe cadastros completos com validação de CPF, deduplicação por matrícula e todos os dados cadastrais.
          </div>
          <ImportacaoAlunos alunos={alunos} setAlunos={wrapSetter<any>(setAlunos)} onLog={addLog} />
        </div>
      )}

      {/* ══ FOTOS ══ */}
      {tab === 'fotos' && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>📷 Importação de Fotos</div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 20 }}>
            Vincule fotos automaticamente pelo <strong>código do system</strong> (nome do arquivo = código/matrícula do aluno). Formatos: JPG, PNG, WEBP.
          </div>
          <ImportacaoFotos alunos={alunos as any} setAlunos={wrapSetter<any>(setAlunos)} onLog={addLog} />
        </div>
      )}

      {/* ══ TURMAS ══ */}
      {tab === 'turmas' && genericMod('turmas', '📚', 'Importação de Turmas',
        'Crie turmas em massa com código, série, turno, professor e capacidade. Deduplicação automática por código.',
        '#10b981')}

      {/* ══ RESPONSÁVEIS ══ */}
      {tab === 'responsaveis' && genericMod('responsaveis', '👨‍👩‍👧', 'Importação de Responsáveis',
        'Importe e vincule responsáveis financeiros e pedagógicos. Informe o código do aluno para vínculo automático. 25+ campos incluindo endereço completo, RFID e estado civil.',
        '#f59e0b')}

      {/* ══ FUNCIONÁRIOS ══ */}
      {tab === 'funcionarios' && genericMod('funcionarios', '👔', 'Importação de Funcionários',
        'Importe professores e funcionários com dados de RH: cargo, departamento, salário, contrato CLT, dados bancários e mais.',
        '#8b5cf6')}

      {/* ══ FINANCEIRO ══ */}
      {tab === 'financeiro' && genericMod('titulos', '💰', 'Importação Financeira (Títulos)',
        'Importe títulos e parcelas com vínculo automático por código do aluno. Suporta desconto, juros, multa e forma de pagamento.',
        '#ef4444')}

      {/* ══ CONTAS A PAGAR ══ */}
      {tab === 'contas_pagar' && genericMod('contas_pagar', '💳', 'Importação de Contas a Pagar',
        'Importe lançamentos de contas a pagar com categoria, fornecedor, número de documento e centro de custo.',
        '#dc2626')}

      {/* ══ HISTÓRICO ══ */}
      {tab === 'historico' && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>📋 Histórico de Importações</div>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 2 }}>{logs.length} operações registradas nesta sessão</div>
            </div>
            {logs.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => {
                const csv = 'dataHora;modulo;arquivo;total;inseridos;atualizados;erros;ignorados;status;usuario\n' +
                  logs.map(l => `${l.dataHora};${l.modulo};${l.arquivo};${l.total};${l.inseridos};${l.atualizados};${l.erros};${l.ignorados};${l.status};${l.usuario}`).join('\n')
                downloadText(csv, 'historico-importacoes.csv')
              }}>
                <Download size={13} /> Exportar log completo
              </button>
            )}
          </div>

          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: 'hsl(var(--text-muted))' }}>
              <History style={{ opacity: 0.15, display: 'block', margin: '0 auto 12px' }} />
              <div style={{ fontWeight: 600 }}>Nenhuma importação realizada ainda</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Realize uma importação para ver o histórico aqui</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'hsl(var(--bg-overlay))' }}>
                    {['Data/Hora','Módulo','Arquivo','Total','✓ Inseridos','↻ Atualizados','✗ Erros','Status','Usuário'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id} style={{ borderTop: '1px solid hsl(var(--border-subtle))' }}>
                      <td style={{ padding: '10px 12px', fontSize: 12, whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Clock size={12} color="hsl(var(--text-muted))" />
                          {new Date(l.dataHora).toLocaleString('pt-BR')}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'hsl(var(--bg-overlay))' }}>{l.modulo}</span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.arquivo}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>{l.total}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: '#10b981', textAlign: 'center' }}>{l.inseridos}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: '#3b82f6', textAlign: 'center' }}>{l.atualizados}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: l.erros > 0 ? '#ef4444' : '#94a3b8', textAlign: 'center' }}>{l.erros}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                          background: l.status === 'sucesso' ? 'rgba(16,185,129,0.12)' : l.status === 'parcial' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                          color: l.status === 'sucesso' ? '#10b981' : l.status === 'parcial' ? '#f59e0b' : '#ef4444',
                        }}>
                          {l.status === 'sucesso' ? '✓ Sucesso' : l.status === 'parcial' ? '⚠ Parcial' : '✗ Erro'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12 }}>{l.usuario}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// local re-export so the icon renders correctly in history
function History({ style, className }: { style?: React.CSSProperties; className?: string }) {
  return (
    <svg style={style} className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><polyline points="12 7 12 12 15 15"/></svg>
  )
}

function Clock({ size = 24, color = 'currentColor', style }: { size?: number; color?: string; style?: React.CSSProperties }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  )
}
