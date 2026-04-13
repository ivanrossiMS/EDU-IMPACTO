'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';

import { useState } from 'react'
import {
  Users, Camera, BookOpen, UserCheck, DollarSign,
  ClipboardList, History, ArrowRight, Clock,
  CheckCircle, XCircle, Download, Trash2
} from 'lucide-react'
import { useImportLog, downloadText, type ImportLog } from './importacao/useImportacao'
import { ImportacaoAlunos } from './importacao/ImportacaoAlunos'
import { ImportacaoFotos } from './importacao/ImportacaoFotos'
import { ImportacaoGenerica } from './importacao/ImportacaoGenerica'
import { useData } from '@/lib/dataContext'

/* ─── Sub-tab definitions ─────────────────────────────────────── */
const TABS = [
  { id: 'dashboard',     icon: <BookOpen size={15}/>,     label: 'Dashboard',       color: '#6366f1' },
  { id: 'alunos',        icon: <Users size={15}/>,        label: 'Alunos',          color: '#3b82f6' },
  { id: 'fotos',         icon: <Camera size={15}/>,       label: 'Fotos',           color: '#8b5cf6' },
  { id: 'turmas',        icon: <BookOpen size={15}/>,     label: 'Turmas',          color: '#10b981' },
  { id: 'responsaveis',  icon: <UserCheck size={15}/>,    label: 'Responsáveis',    color: '#f59e0b' },
  { id: 'financeiro',    icon: <DollarSign size={15}/>,   label: 'Financeiro',      color: '#ef4444' },
  { id: 'historico',     icon: <History size={15}/>,      label: 'Histórico',       color: '#64748b' },
]

const ORDER_STEPS = [
  { n: 1, label: 'Turmas',        icon: '📚', desc: 'Crie as turmas antes de vincular alunos' },
  { n: 2, label: 'Alunos',        icon: '👤', desc: 'Importe cadastros com código do sistema' },
  { n: 3, label: 'Responsáveis',  icon: '👨', desc: 'Vincule via código do aluno' },
  { n: 4, label: 'Matrículas',    icon: '📋', desc: 'Vincule aluno ↔ turma ↔ ano' },
  { n: 5, label: 'Fotos',         icon: '📷', desc: 'Nomeie como {código}.jpg' },
  { n: 6, label: 'Financeiro',    icon: '💰', desc: 'Títulos e parcelas por aluno' },
]

export default function ImportacaoDadosSection() {
  const [tab, setTab] = useState('dashboard')
  const { logs, addLog } = useImportLog()
  const { turmas, setTurmas } = useData();
  const [alunos, setAlunos] = useSupabaseArray<any>('alunos');
  const [titulos, setTitulos] = useSupabaseArray<any>('titulos');

  // Coerce setters to the expected signature
  const wrapSetter = <T,>(fn: any): ((upd: (p: T[]) => T[]) => void) => fn

  const totalImportados = logs.reduce((s, l) => s + l.inseridos, 0)
  const totalErros      = logs.reduce((s, l) => s + l.erros, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* HEADER */}
      <div style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(59,130,246,0.08))', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              📥 Importação de Dados
            </div>
            <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginTop: 4, maxWidth: 520 }}>
              Importe dados em massa com validação, mapeamento de colunas e processamento seguro.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { label: 'Importados', val: totalImportados, color: '#10b981' },
              { label: 'Com erro', val: totalErros, color: '#ef4444' },
              { label: 'Operações', val: logs.length, color: '#6366f1' },
            ].map(s => (
              <div key={s.label} style={{ background: 'hsl(var(--bg-surface))', border: `1px solid ${s.color}30`, borderRadius: 10, padding: '10px 16px', textAlign: 'center', minWidth: 72 }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: s.color, fontFamily: 'Outfit' }}>{s.val}</div>
                <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderBottom: '2px solid hsl(var(--border-subtle))', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: '10px 10px 0 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, transition: 'all .15s', marginBottom: -2,
              background: tab === t.id ? 'hsl(var(--bg-surface))' : 'transparent',
              color: tab === t.id ? t.color : 'hsl(var(--text-muted))',
              borderBottom: tab === t.id ? `2px solid ${t.color}` : '2px solid transparent',
            }}>
            <span style={{ color: t.color }}>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {tab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Alerts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {[
              { icon: '📄', title: 'Formatos aceitos', desc: 'CSV, XLSX, XLS, imagens JPG/PNG/WEBP', color: '#6366f1' },
              { icon: '⚠️', title: 'Atenção', desc: 'Mantenha backup antes de importar grandes volumes', color: '#f59e0b' },
              { icon: '🔒', title: 'Segurança', desc: 'Toda operação é registrada com data, hora e usuário', color: '#10b981' },
            ].map(a => (
              <div key={a.title} style={{ background: `${a.color}0d`, border: `1px solid ${a.color}30`, borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 18, marginBottom: 6 }}>{a.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{a.desc}</div>
              </div>
            ))}
          </div>

          {/* Order flow */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 18 }}>🗺️ Ordem Recomendada de Importação</div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0 }}>
              {ORDER_STEPS.map((s, i) => (
                <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 12px', cursor: 'pointer' }}
                    onClick={() => setTab(s.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(' ')[0])}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, boxShadow: '0 4px 14px rgba(99,102,241,0.3)', marginBottom: 8 }}>{s.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: 12 }}>{s.n}. {s.label}</div>
                    <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', maxWidth: 90, marginTop: 2 }}>{s.desc}</div>
                  </div>
                  {i < ORDER_STEPS.length - 1 && <ArrowRight size={16} color="hsl(var(--text-muted))" style={{ flexShrink: 0 }} />}
                </div>
              ))}
            </div>
          </div>

          {/* Recent logs */}
          {logs.length > 0 && (
            <div className="card" style={{ padding: '20px 24px' }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>📋 Importações Recentes</div>
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
                      {l.erros > 0 && <span style={{ color: '#ef4444', marginLeft: 8 }}>✗ {l.erros}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ALUNOS ── */}
      {tab === 'alunos' && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>👤 Importação de Alunos</div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 20 }}>Importe cadastros completos com validação de CPF, deduplicação e mapeamento inteligente.</div>
          <ImportacaoAlunos alunos={alunos} setAlunos={wrapSetter<any>(setAlunos)} onLog={addLog} />
        </div>
      )}

      {/* ── FOTOS ── */}
      {tab === 'fotos' && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>📷 Importação de Fotos</div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 20 }}>Vincule fotos automaticamente pelo código do sistema (nome do arquivo = código do aluno).</div>
          <ImportacaoFotos alunos={alunos as any} setAlunos={wrapSetter<any>(setAlunos)} onLog={addLog} />
        </div>
      )}

      {/* ── TURMAS ── */}
      {tab === 'turmas' && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>📚 Importação de Turmas</div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 20 }}>Crie turmas em massa, detectando duplicatas por código e ano letivo.</div>
          <ImportacaoGenerica modulo="turmas" setTurmas={wrapSetter<any>(setTurmas)} onLog={addLog} />
        </div>
      )}

      {/* ── RESPONSÁVEIS ── */}
      {tab === 'responsaveis' && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>👨‍👩‍👧 Importação de Responsáveis</div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 20 }}>Importe e vincule responsáveis financeiros e pedagógicos aos alunos pelo código do aluno.</div>
          <ImportacaoGenerica modulo="responsaveis" alunos={alunos} onLog={addLog} />
        </div>
      )}

      {/* ── FINANCEIRO ── */}
      {tab === 'financeiro' && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>💰 Importação Financeira</div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 20 }}>Importe títulos, parcelas e baixas. Vínculos automáticos com aluno pelo código do sistema.</div>
          <ImportacaoGenerica modulo="financeiro" alunos={alunos} setTitulos={wrapSetter<any>(setTitulos)} onLog={addLog} />
        </div>
      )}

      {/* ── HISTÓRICO ── */}
      {tab === 'historico' && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>📋 Histórico de Importações</div>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 2 }}>{logs.length} operações registradas</div>
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
              <History size={40} style={{ opacity: 0.15, display: 'block', margin: '0 auto 12px' }} />
              <div style={{ fontWeight: 600 }}>Nenhuma importação realizada ainda</div>
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
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: '#6366f1', textAlign: 'center' }}>{l.atualizados}</td>
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
