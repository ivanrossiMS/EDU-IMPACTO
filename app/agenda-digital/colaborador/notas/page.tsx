'use client'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { useState, useMemo, useEffect } from 'react'
import { GraduationCap, Download, ChevronRight, TrendingUp, TrendingDown, AlertCircle, FileText, BarChart2, ChevronDown, ChevronUp, User } from 'lucide-react'
import { EmptyStateCard } from '../../components/EmptyStateCard'
import { useApiQuery } from '@/hooks/useApi'
import { motion, AnimatePresence } from 'framer-motion'
import { useData } from '@/lib/dataContext'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { getInitials } from '@/lib/utils'
import { useApp } from '@/lib/context'
import { TurmaDropdown } from '../components/TurmaDropdown'


export default function ColaboradorNotasPage() {
  const { currentUser } = useApp()
  const { adConfig, chatGroups } = useAgendaDigital();

  if (adConfig?.permissoes?.visualizarNotas === false) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', padding: 24 }}>
        <EmptyStateCard 
          title="Acesso Restrito"
          description="A visualização de boletim e notas está desativada para a sua conta ou suspensa temporariamente pela coordenação pedagógica."
          icon={<AlertCircle size={48} style={{ color: '#ef4444', opacity: 0.8 }} />}
        />
      </div>
    );
  }

  const { turmas = [] } = useData()
  const [alunos = []] = useSupabaseArray<any>('alunos', [])
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>('all')

  const turmaOptions = useMemo(() => {
    if (!currentUser?.id) return [{ id: 'all', nome: 'Minhas Turmas' }];
    
    const userGroups = (chatGroups || []).filter(g => {
      let colabs = g.colaboradoresIds;
      if (typeof colabs === 'string') {
        try { colabs = JSON.parse(colabs); } catch(e) { colabs = []; }
      }
      if (!Array.isArray(colabs)) colabs = [];
      return colabs.some(id => String(id) === String(currentUser.id));
    });

    const accessibleTurmas = turmas.filter(t => {
       return userGroups.some(g => String(g.id) === `sync-${t.id}` || String(g.nome).trim().toLowerCase() === String(t.nome).trim().toLowerCase())
    });
    return [{ id: 'all', nome: 'Minhas Turmas' }, ...accessibleTurmas]
  }, [turmas, chatGroups, currentUser])

  const selectedTurmaName = useMemo(() => {
    if (selectedTurmaId === 'all') return 'Minhas Turmas'
    const t = turmas.find(x => String(x.id) === String(selectedTurmaId) || String(x.codigo) === String(selectedTurmaId))
    return t ? t.nome : 'Turma Selecionada'
  }, [selectedTurmaId, turmas])

  const alunosFiltrados = useMemo(() => {
    if (selectedTurmaId === 'all') {
      const accessibleTurmaIds = turmaOptions.filter(t => t.id !== 'all').map(t => String(t.id));
      return alunos.filter(a => accessibleTurmaIds.includes(String(a.turma)) || accessibleTurmaIds.includes(String(a.turmaId)));
    }
    return alunos.filter(a => String(a.turma) === String(selectedTurmaId) || String(a.turmaId) === String(selectedTurmaId))
  }, [alunos, selectedTurmaId, turmaOptions, currentUser])

  // Fetch real data for all or specific class
  // Se /api/boletins sem id nao trazer tudo, pode ser necessario outra forma, mas assumiremos que traz todos aos quais o colaborador tem acesso
  const { data: responseData, isLoading } = useApiQuery<any>(
    ['boletins-colaborador'],
    `/api/boletins`,
    {},
    { enabled: true }
  )

  const allBoletins = responseData?.data || []

  // Agrupar boletins por aluno para fácil acesso
  const boletinsPorAluno = useMemo(() => {
    const map = new Map<string, any[]>()
    allBoletins.forEach((b: any) => {
      const alunoId = String(b.aluno_id || b.alunoId)
      if (!map.has(alunoId)) map.set(alunoId, [])
      map.get(alunoId)?.push(b)
    })
    return map
  }, [allBoletins])

  const [expandedAlunoId, setExpandedAlunoId] = useState<string | null>(null)

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} style={{ paddingBottom: 60, padding: '0 16px' }}>
      
      <style dangerouslySetInnerHTML={{__html: `
        .turma-pill {
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
          border: 1px solid transparent;
        }
        .turma-pill.active {
          background: #0f172a;
          color: white;
          box-shadow: 0 4px 12px rgba(15,23,42,0.15);
        }
        .turma-pill.inactive {
          background: #f1f5f9;
          color: #64748b;
        }
        .turma-pill.inactive:hover {
          background: #e2e8f0;
          color: #334155;
        }
      `}} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 900, fontFamily: 'Outfit, sans-serif', margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', width: 44, height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 8px 16px rgba(59, 130, 246, 0.25)' }}>
              <GraduationCap size={22} />
            </div>
            Notas e Boletins
          </h2>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 4, fontWeight: 500 }}>
            Acompanhe o rendimento acadêmico dos alunos da turma.
          </p>
        </div>
      </div>

      {/* Seletor de Turma */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ 
          width: 44, height: 44, borderRadius: 12, background: 'hsl(var(--bg-surface))', 
          border: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'hsl(var(--text-muted))', flexShrink: 0
        }}>
           <GraduationCap size={20} />
        </div>
        <TurmaDropdown 
              turmaOptions={turmaOptions} 
              selectedTurmaId={selectedTurmaId} 
              setSelectedTurmaId={setSelectedTurmaId} 
              selectedTurmaName={selectedTurmaName} 
            />
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', gap: 16 }}>
          <div className="spinner" style={{ width: 40, height: 40, border: '4px solid rgba(37,99,235,0.1)', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <span style={{ color: '#64748b', fontSize: 15, fontWeight: 500 }}>Buscando notas da turma...</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : alunosFiltrados.length === 0 ? (
        <EmptyStateCard 
          title="Nenhum Aluno"
          description={'Nenhum aluno encontrado na turma ' + selectedTurmaName + '.'}
          icon={<User size={48} style={{ color: '#94a3b8', opacity: 0.8 }} />}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {alunosFiltrados.map((aluno: any) => {
            const isExpanded = expandedAlunoId === String(aluno.id)
            const alunoBoletins = boletinsPorAluno.get(String(aluno.id)) || []

            return (
              <div key={aluno.id} style={{ background: '#fff', borderRadius: 24, border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', overflow: 'hidden', transition: 'all 0.3s' }}>
                {/* Header do Aluno (Card clicável) */}
                <div 
                  onClick={() => setExpandedAlunoId(isExpanded ? null : String(aluno.id))}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', cursor: 'pointer', background: isExpanded ? '#f8fafc' : '#fff' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16 }}>
                      {getInitials(aluno.nome)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', fontFamily: 'Outfit, sans-serif' }}>{aluno.nome}</div>
                      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                        {alunoBoletins.length} boletim(s) disponível(is)
                      </div>
                    </div>
                  </div>
                  <div style={{ color: '#94a3b8' }}>
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>

                {/* Conteúdo Expandido (O próprio componente de Notas da Família) */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }} 
                      animate={{ height: 'auto', opacity: 1 }} 
                      exit={{ height: 0, opacity: 0 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ padding: '24px', borderTop: '1px solid #f1f5f9' }}>
                        <AlunoBoletimViewer boletins={alunoBoletins} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}
      
    </motion.div>
  )
}

// Subcomponente que encapsula a lógica exata de exibição de um boletim (cópia da página Família)
function AlunoBoletimViewer({ boletins }: { boletins: any[] }) {
  const bimestresDisponiveis = useMemo(() => {
    if (!boletins.length) return []
    const sorted = [...boletins].sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    
    const unicos = new Map()
    for (const b of sorted) {
      const dados = typeof b.dados === 'string' ? JSON.parse(b.dados) : b.dados
      if (!unicos.has(dados.bimestre)) {
        unicos.set(dados.bimestre, { id: b.id, nome: dados.bimestre, dados })
      }
    }
    return Array.from(unicos.values()).sort((a: any, b: any) => a.nome.localeCompare(b.nome))
  }, [boletins])

  const [selectedBimestreId, setSelectedBimestreId] = useState<string | null>(null)

  useEffect(() => {
    if (bimestresDisponiveis.length > 0 && !selectedBimestreId) {
      setSelectedBimestreId(bimestresDisponiveis[0].id)
    }
  }, [bimestresDisponiveis, selectedBimestreId])

  const boletimAtual = useMemo(() => {
    if (!selectedBimestreId) return null
    return bimestresDisponiveis.find((b: any) => b.id === selectedBimestreId)
  }, [selectedBimestreId, bimestresDisponiveis])

  const disciplinas = useMemo(() => {
    if (!boletimAtual || !boletimAtual.dados.disciplinas) return []
    return boletimAtual.dados.disciplinas.map((d: any) => {
      let num = 0
      const val = String(d.mediaF).trim()
      if (val.toLowerCase() === 'dez') {
        num = 10
      } else {
        num = parseFloat(val.replace(',', '.')) || 0
      }
      return {
        ...d,
        mediaFNum: num
      }
    })
  }, [boletimAtual])

  const mediaGlobal = useMemo(() => {
     if (!disciplinas.length) return 0
     const sum = disciplinas.reduce((acc: number, curr: any) => acc + curr.mediaFNum, 0)
     return parseFloat((sum / disciplinas.length).toFixed(1))
  }, [disciplinas])

  const isAcima = mediaGlobal >= 7.0

  if (boletins.length === 0) {
    return (
      <EmptyStateCard 
        title="Nenhum Boletim"
        description="Ainda não há notas ou boletins lançados para este aluno."
        icon={<FileText size={48} style={{ color: '#94a3b8', opacity: 0.8 }} />}
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {bimestresDisponiveis.length > 0 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          {bimestresDisponiveis.map((b: any) => (
            <button
              key={b.id}
              onClick={() => setSelectedBimestreId(b.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '16px',
                border: 'none',
                fontWeight: 700,
                fontSize: 13,
                whiteSpace: 'nowrap',
                transition: 'all 0.3s',
                cursor: 'pointer',
                background: selectedBimestreId === b.id ? '#0f172a' : '#f1f5f9',
                color: selectedBimestreId === b.id ? '#ffffff' : '#64748b',
                boxShadow: selectedBimestreId === b.id ? '0 4px 12px rgba(15,23,42,0.15)' : 'none'
              }}
            >
              {b.nome}
            </button>
          ))}
        </div>
      )}

      {boletimAtual && (
        <>
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            key={boletimAtual.id}
            style={{ 
              padding: 24, 
              background: isAcima ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', 
              color: 'white', 
              borderRadius: 20,
              border: 'none', 
              position: 'relative', 
              overflow: 'hidden',
              boxShadow: isAcima ? '0 15px 30px -10px rgba(37,99,235,0.4)' : '0 15px 30px -10px rgba(239,68,68,0.4)'
            }}
          >
             <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, background: 'rgba(255,255,255,0.15)', borderRadius: '50%', filter: 'blur(40px)' }} />
             
             <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, position: 'relative' }}>
               <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
                 <GraduationCap size={16} />
               </div>
               <div style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, fontSize: 12, opacity: 0.95 }}>Média Global</div>
             </div>
             
             <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, position: 'relative' }}>
               <div style={{ fontSize: 56, fontWeight: 900, fontFamily: 'Outfit, sans-serif', lineHeight: 1, textShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                 {mediaGlobal.toFixed(1)}
               </div>
             </div>
             
             <div style={{ marginTop: 20, padding: '12px 16px', background: 'rgba(0,0,0,0.25)', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 10, backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
               {isAcima ? <TrendingUp size={16} color="#34d399"/> : <TrendingDown size={16} color="#fca5a5"/>}
               <span style={{ fontSize: 13, fontWeight: 600 }}>
                 {isAcima ? 'Desempenho dentro do esperado' : 'Requer atenção'}
               </span>
             </div>
          </motion.div>

          <div style={{ background: '#fff', borderRadius: 20, padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f8fafc', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart2 size={16} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#0f172a' }}>Rendimento por Disciplina</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <AnimatePresence mode="wait">
                <motion.div 
                  key={selectedBimestreId} 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, y: -10 }} 
                  transition={{ duration: 0.3 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
                >
                  {disciplinas.map((d: any, i: number) => {
                    const isPassed = d.mediaFNum >= 7.0
                    return (
                      <div key={i} style={{ 
                        padding: '14px', 
                        background: '#f8fafc', 
                        borderRadius: 14, 
                        border: '1px solid #f1f5f9',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 14, marginBottom: 2 }}>{d.nome}</div>
                            <div style={{ fontSize: 11, color: '#64748b', display: 'flex', gap: 12 }}>
                              <span>AVM: <strong>{d.avm}</strong></span>
                              <span>AVB: <strong>{d.avb}</strong></span>
                            </div>
                          </div>
                          
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            background: isPassed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: isPassed ? '#059669' : '#dc2626',
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            fontWeight: 800,
                            fontSize: 16,
                            fontFamily: 'Outfit, sans-serif',
                            border: '1px solid ' + (isPassed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)')
                          }}>
                            {d.mediaF}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: Math.min(d.mediaFNum * 10, 100) + '%' }}
                              transition={{ duration: 1, ease: "easeOut", delay: 0.1 * i }}
                              style={{ 
                                height: '100%', 
                                background: isPassed ? '#10b981' : '#ef4444', 
                                borderRadius: 3 
                              }} 
                            />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: isPassed ? '#10b981' : '#ef4444', minWidth: 60, textAlign: 'right' }}>
                            {isPassed ? 'Aprovado' : 'Atenção'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
