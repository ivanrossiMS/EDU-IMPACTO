'use client'

import React from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Play,
  Sliders,
  Sparkles,
  Square,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react'
import { CenarioHorario, DiagnosticoGeral, HorarioProjeto, ParametrosOtimizador } from '@/lib/horario/types'
import { SolverProgress } from '@/lib/horario/solver'

interface Props {
  projeto: HorarioProjeto
  diagnostico: DiagnosticoGeral
  isGenerating: boolean
  progress: SolverProgress | null
  onChangeParams: (next: ParametrosOtimizador) => void
  onGenerate: () => void
  onStopGenerate: () => void
  onSelectCenario: (id: string) => void
  onDeleteCenario: (id: string) => void
}

export function DiagnosticoGeradorTab({
  projeto,
  diagnostico,
  isGenerating,
  progress,
  onChangeParams,
  onGenerate,
  onStopGenerate,
  onSelectCenario,
  onDeleteCenario,
}: Props) {
  const p = projeto.parametros

  const toggleParam = (k: keyof ParametrosOtimizador) => {
    onChangeParams({ ...p, [k]: !p[k] })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* ROW 1: Diagnóstico Pré-Geração (Lira Pro Style) */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={17} style={{ color: '#10b981' }} />
              Diagnóstico de Viabilidade Pré-Geração
            </h3>
            <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', margin: '4px 0 0' }}>
              Análise matemática em tempo real antes de executar o gerador — detecta gargalos e sugere ajustes
            </p>
          </div>
          <div
            className={`badge ${
              diagnostico.status === 'viavel'
                ? 'badge-success'
                : diagnostico.status === 'atencao'
                ? 'badge-warning'
                : 'badge-danger'
            }`}
            style={{ fontSize: 12, padding: '6px 14px', fontWeight: 800 }}
          >
            {diagnostico.status === 'viavel' && '✅ Configuração Viável'}
            {diagnostico.status === 'atencao' && '⚠️ Atenção — Ajustes Recomendados'}
            {diagnostico.status === 'inviavel' && '🚨 Inviável — Conflitos Detectados'}
            {' • '}
            {diagnostico.scoreViabilidade}%
          </div>
        </div>

        {/* Barras por Turno */}
        {diagnostico.porTurno.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
            {diagnostico.porTurno.map(t => {
              const pct = t.capacidade > 0 ? Math.min(100, Math.round((t.demanda / t.capacidade) * 100)) : 0
              const color = t.nivel === 'viavel' ? '#10b981' : t.nivel === 'atencao' ? '#f59e0b' : '#ef4444'
              return (
                <div
                  key={t.turno}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    background: 'hsl(var(--bg-elevated))',
                    border: `1px solid ${color}40`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 13 }}>Turno {t.turno}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color }}>
                      {t.nivel === 'viavel' ? '● Viável' : t.nivel === 'atencao' ? '▲ Atenção' : '✖ Inviável'}
                    </span>
                  </div>
                  <div style={{ height: 7, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{t.mensagem}</div>
                </div>
              )
            })}
          </div>
        )}

        {/* Itens de Diagnóstico */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
          {diagnostico.itens.map(item => {
            const color = item.nivel === 'viavel' ? '#10b981' : item.nivel === 'atencao' ? '#f59e0b' : '#ef4444'
            const Icon = item.nivel === 'viavel' ? CheckCircle2 : item.nivel === 'atencao' ? AlertTriangle : XCircle
            return (
              <div
                key={item.id}
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: `${color}10`,
                  border: `1px solid ${color}33`,
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
              >
                <Icon size={16} style={{ color, flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{item.titulo}</div>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', marginTop: 2 }}>{item.detalhe}</div>
                  {item.sugestao && (
                    <div style={{ fontSize: 11, color, fontWeight: 700, marginTop: 4 }}>💡 Sugestão: {item.sugestao}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ROW 2: Parâmetros do Otimizador + Painel de Geração */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sliders size={17} style={{ color: '#8b5cf6' }} />
            Parâmetros Inteligentes do Otimizador
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              {
                key: 'eliminarJanelas' as const,
                title: 'Eliminação Máxima de Janelas',
                desc: 'Agrupa as aulas de cada professor no mesmo turno sem horários vagos intermediários',
              },
              {
                key: 'eliminarAulasTriplas' as const,
                title: 'Eliminar Aulas Triplas (3+ seguidas)',
                desc: 'Limita automaticamente a no máximo 2 aulas da mesma disciplina por dia na turma',
              },
              {
                key: 'priorizarGeminadas' as const,
                title: 'Priorizar Aulas Geminadas',
                desc: 'Mantém pares consecutivos para disciplinas configuradas com aulas duplas',
              },
              {
                key: 'permitirGeminadaAposIntervalo' as const,
                title: 'Permitir Geminadas Cruzando o Recreio',
                desc: 'Ex: 3ª aula antes do intervalo + 4ª aula logo após o intervalo',
              },
              {
                key: 'respeitarPreferenciasProfessor' as const,
                title: 'Otimizar Preferências dos Professores (⭐)',
                desc: 'Prioriza alocar nos horários marcados como preferenciais pelos docentes',
              },
              {
                key: 'minimizarTrocaSede' as const,
                title: 'Minimizar Deslocamento Entre Sedes',
                desc: 'Concentra cada docente em uma única sede por turno sempre que possível',
              },
              {
                key: 'preferirPesadasPrimeirosHorarios' as const,
                title: 'Disciplinas Cognitivas nos Primeiros Horários',
                desc: 'Prioriza Matemática/Português nos primeiros tempos do turno',
              },
              {
                key: 'modoFlexivelComMarcacao' as const,
                title: 'Modo Flexível com Marcação Colorida (WebHorário)',
                desc: 'Se alguma restrição impedir 100% de encaixe, aloca marcando em vermelho/âmbar para ajuste manual',
              },
            ].map(item => (
              <label
                key={item.key}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'hsl(var(--bg-elevated))',
                  border: '1px solid hsl(var(--border-subtle))',
                  cursor: 'pointer',
                }}
              >
                <input type="checkbox" checked={Boolean(p[item.key])} onChange={() => toggleParam(item.key)} style={{ marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{item.desc}</div>
                </div>
              </label>
            ))}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
              <div>
                <label className="form-label">Esforço de Otimização</label>
                <select
                  className="form-input"
                  value={p.esforcoOtimizacao}
                  onChange={e => onChangeParams({ ...p, esforcoOtimizacao: e.target.value as any })}
                >
                  <option value="rapido">Rápido (~1–2s)</option>
                  <option value="equilibrado">Equilibrado (~3–5s)</option>
                  <option value="profundo">Profundo (~8–12s, máx. qualidade)</option>
                </select>
              </div>
              <div>
                <label className="form-label">Deslocamento Padrão (min)</label>
                <input
                  type="number"
                  min={0}
                  max={180}
                  className="form-input"
                  value={p.tempoDeslocamentoPadraoMin}
                  onChange={e =>
                    onChangeParams({ ...p, tempoDeslocamentoPadraoMin: Math.max(0, parseInt(e.target.value || '0', 10)) })
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* Motor de Execução & Cenários */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            className="card"
            style={{
              padding: 24,
              background: 'linear-gradient(145deg, rgba(59,130,246,0.12), rgba(139,92,246,0.10))',
              border: '1px solid rgba(59,130,246,0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Cpu size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Motor Combinatório + Otimizador</h3>
                <p style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', margin: '3px 0 0' }}>
                  Backtracking MRV/LCV + Simulated Annealing preservando aulas travadas (🔒)
                </p>
              </div>
            </div>

            {isGenerating && progress ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
                  <span>{progress.mensagem}</span>
                  <span>{progress.progressoPct}%</span>
                </div>
                <div style={{ height: 10, borderRadius: 99, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${progress.progressoPct}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #3b82f6, #10b981)',
                      transition: 'width 0.2s',
                    }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, fontSize: 11 }}>
                  <div className="badge badge-primary">Score: {progress.melhorScore}%</div>
                  <div className="badge badge-success">Alocadas: {progress.aulasAlocadas}/{progress.totalAulas}</div>
                  <div className="badge badge-warning">Janelas: {progress.janelas}</div>
                  <div className="badge badge-danger">Choques: {progress.choques}</div>
                </div>
                <button type="button" className="btn btn-danger" onClick={onStopGenerate}>
                  <Square size={14} /> Parar e Aplicar Melhor Solução Encontrada
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-lg"
                style={{ width: '100%', justifyContent: 'center', fontWeight: 800 }}
                onClick={onGenerate}
              >
                <Zap size={18} /> Gerar Novo Horário Automático
              </button>
            )}
          </div>

          {/* Cenários Gerados */}
          <div className="card" style={{ padding: 20 }}>
            <h4 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={15} style={{ color: '#f59e0b' }} />
              Cenários & Versões Salvas ({projeto.cenarios.length})
            </h4>

            {projeto.cenarios.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                Nenhum cenário gerado ainda. Clique em <strong>Gerar Novo Horário Automático</strong> acima!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {projeto.cenarios.map((cen: CenarioHorario) => {
                  const active = cen.id === projeto.cenarioAtivoId
                  return (
                    <div
                      key={cen.id}
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        background: active ? 'rgba(59,130,246,0.12)' : 'hsl(var(--bg-elevated))',
                        border: active ? '1px solid rgba(59,130,246,0.5)' : '1px solid hsl(var(--border-subtle))',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 800 }}>{cen.nome}</span>
                          {active && <span className="badge badge-primary" style={{ fontSize: 10 }}>Em Edição</span>}
                          {cen.publicado && <span className="badge badge-success" style={{ fontSize: 10 }}>Publicado</span>}
                        </div>
                        <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <span>Score: <strong>{cen.metricas.scoreGeral}%</strong></span>
                          <span>• {cen.metricas.totalAulasAlocadas}/{cen.metricas.totalAulasPrevistas} aulas</span>
                          <span>• {cen.metricas.choquesProfessor} choques</span>
                          <span>• {cen.metricas.totalJanelasProfessores} janelas</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {!active && (
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onSelectCenario(cen.id)}>
                            Abrir
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon btn-sm"
                          style={{ color: '#ef4444' }}
                          onClick={() => onDeleteCenario(cen.id)}
                          title="Excluir cenário"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
