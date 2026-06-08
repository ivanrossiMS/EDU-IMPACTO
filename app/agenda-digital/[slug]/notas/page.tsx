'use client'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { useSelectedStudent } from '@/lib/selectedStudentContext'
import { useData } from '@/lib/dataContext'
import { useState, useMemo, useEffect } from 'react'
import { GraduationCap, Download, ChevronRight, TrendingUp, TrendingDown, AlertCircle, FileText, BarChart2 } from 'lucide-react'
import { EmptyStateCard } from '../../components/EmptyStateCard'
import { useApiQuery } from '@/hooks/useApi'
import { motion, AnimatePresence } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { useAgendaRealtime } from '@/hooks/useAgendaRealtime'

export default function ADNotasPage({ params }: { params: Promise<{ slug: string }>}) {
  const { adConfig } = useAgendaDigital();

  if (adConfig?.permissoes?.visualizarNotas === false) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', padding: 24 }}>
        <EmptyStateCard 
          title="Acesso Restrito"
          description="A visualização de boletim e notas está desativada para a sua conta ou suspensa temporariamente pela coordenação pedagógica. Para mais informações, entre em contato com a secretaria."
          icon={<AlertCircle size={48} style={{ color: '#ef4444', opacity: 0.8 }} />}
        />
      </div>
    );
  }

  const { aluno } = useSelectedStudent()
  const { turmas = [] } = useData()

  // Fetch real data
  const { data: responseData, isLoading } = useApiQuery<any>(
    ['boletins', aluno?.id || ''],
    `/api/boletins?aluno_id=${aluno?.id}`,
    undefined,
    { enabled: !!aluno?.id }
  )

  const queryClient = useQueryClient()

  useAgendaRealtime({
    table: 'boletins',
    toastConfig: {
      enabled: true,
      insertMessage: (doc) => `Nova nota lançada no boletim!`,
      updateMessage: (doc) => `Nota atualizada!`,
      icon: <FileText size={18} color="#3b82f6" />
    },
    onInsert: () => {
      queryClient.invalidateQueries({ queryKey: ['boletins', aluno?.id || ''] })
    },
    onUpdate: () => {
      queryClient.invalidateQueries({ queryKey: ['boletins', aluno?.id || ''] })
    },
    onDelete: () => {
      queryClient.invalidateQueries({ queryKey: ['boletins', aluno?.id || ''] })
    }
  });

  
  // Extrair anos disponíveis de todos os boletins
  const todosBoletins = useMemo(() => {
    return (responseData?.data || []).map((b: any) => {
      const dados = typeof b.dados === 'string' ? JSON.parse(b.dados) : (b.dados || {});
      const ano = dados.ano || new Date(b.created_at).getFullYear().toString();
      
      const turmaRef = b.turma_id || b.turma;
      const tObj = turmas.find((t: any) => String(t.id) === String(turmaRef) || String(t.codigo) === String(turmaRef) || String(t.nome) === String(turmaRef));
      const nomeTurma = tObj?.nome || b.turma || 'Sem Turma';
      
      return { ...b, parsedDados: dados, anoStr: String(ano), nomeTurma };
    });
  }, [responseData, turmas]);

  const anosDisponiveis = useMemo(() => {
    const anos = todosBoletins.map((b: any) => b.anoStr);
    const unicos = Array.from(new Set(anos)).sort((a: any, b: any) => b.localeCompare(a));
    if (unicos.length === 0) {
       unicos.push(new Date().getFullYear().toString());
    }
    return unicos as string[];
  }, [todosBoletins]);

  const [selectedYear, setSelectedYear] = useState<string>('');

  useEffect(() => {
    if (anosDisponiveis.length > 0 && !selectedYear) {
      setSelectedYear(anosDisponiveis[0] as string);
    }
  }, [anosDisponiveis, selectedYear]);

  // Boletins do ano selecionado
  const boletins = useMemo(() => {
    if (!selectedYear) return [];
    return todosBoletins.filter((b: any) => b.anoStr === selectedYear);
  }, [todosBoletins, selectedYear]);


  // Extract periods (bimestres) available
  const bimestresDisponiveis = useMemo(() => {
    if (!boletins.length) return []
    
    // Contar quantas turmas distintas existem no ano
    const turmasNoAno = new Set(boletins.map((b: any) => b.nomeTurma));
    const isMultiClass = turmasNoAno.size > 1;

    const sorted = [...boletins].sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    
    const res = [];
    for (const b of sorted) {
      const label = isMultiClass ? `${b.parsedDados.bimestre} - ${b.nomeTurma}` : b.parsedDados.bimestre;
      res.push({ id: b.id, nome: label, dados: b.parsedDados, originalTitle: b.parsedDados.bimestre, nomeTurma: b.nomeTurma })
    }

    return res.sort((a: any, b: any) => a.originalTitle.localeCompare(b.originalTitle))
  }, [boletins])

  const [selectedBimestreId, setSelectedBimestreId] = useState<string | null>(null)

  // Auto-select first available period
  useEffect(() => {
    if (bimestresDisponiveis.length > 0 && !selectedBimestreId) {
      setSelectedBimestreId(bimestresDisponiveis[0].id)
    }
  }, [bimestresDisponiveis, selectedBimestreId])

  useEffect(() => {
    if (!aluno?.id || boletins.length === 0) return;
    
    // Check which ones are unread
    const unreadIds = boletins
      .filter((b: any) => {
        const dados = typeof b.dados === 'string' ? JSON.parse(b.dados) : b.dados || {};
        const leituras = b.leituras || dados.leituras || {};
        return !leituras[aluno.id];
      })
      .map((b: any) => b.id);

    if (unreadIds.length > 0) {
      fetch('/api/agenda/notificacoes/marcar-lido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'nota',
          ids: unreadIds,
          alunoId: aluno.id
        })
      })
      .then(res => {
        if (res.ok) {
          window.dispatchEvent(new CustomEvent('agenda-digital:unread-updated'))
        }
      })
      .catch(err => console.error('Failed to mark notas as read:', err));
    }
  }, [boletins, aluno?.id]);

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

  if (!aluno) return null

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
        <div className="spinner" style={{ width: 40, height: 40, border: '4px solid rgba(37,99,235,0.1)', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <span style={{ color: '#64748b', fontSize: 15, fontWeight: 500 }}>Buscando notas do aluno...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (boletins.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', padding: 24 }}>
        <EmptyStateCard 
          title="Nenhum Boletim"
          description="Ainda não há notas ou boletins lançados para este aluno no sistema."
          icon={<FileText size={48} style={{ color: '#94a3b8', opacity: 0.8 }} />}
        />
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif', margin: 0, color: '#0f172a' }}>Boletim e Notas</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {/* Ano Letivo Selector */}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value)}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 2 }}
            >
              {anosDisponiveis.map((ano: string) => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><FileText size={14} color="#64748b" /> Ano: {selectedYear}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
          </div>
          
          <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a', fontWeight: 600, padding: '8px 16px', borderRadius: 12 }}>
            <Download size={16} /> <span className="hide-on-mobile">Baixar PDF</span>
          </button>
        </div>
      </div>

      {/* Seletor de Bimestre Ultra Moderno */}
      {bimestresDisponiveis.length > 0 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 16, marginBottom: 8, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          {bimestresDisponiveis.map((b: any) => (
            <button
              key={b.id}
              onClick={() => setSelectedBimestreId(b.id)}
              style={{
                padding: '10px 20px',
                borderRadius: '20px',
                border: 'none',
                fontWeight: 700,
                fontSize: 14,
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 32 }}>
          {/* Card Resumo Global */}
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            key={boletimAtual.id}
            style={{ 
              padding: 24, 
              background: isAcima ? 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)' : 'linear-gradient(135deg, #f8fafc 0%, #fef2f2 100%)', 
              color: '#0f172a', 
              borderRadius: 24,
              border: isAcima ? '1px solid #e0e7ff' : '1px solid #fee2e2', 
              position: 'relative', 
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
            }}
          >
             <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, background: isAcima ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.1)', borderRadius: '50%', filter: 'blur(40px)' }} />
             
             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
               <div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                   <div style={{ width: 32, height: 32, borderRadius: 10, background: isAcima ? '#dbeafe' : '#fee2e2', color: isAcima ? '#2563eb' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     <GraduationCap size={16} />
                   </div>
                   <div style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, fontSize: 12, color: '#64748b' }}>Média Global</div>
                 </div>
                 
                 <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                   <div style={{ fontSize: 56, fontWeight: 900, fontFamily: 'Outfit, sans-serif', lineHeight: 1, color: isAcima ? '#1e3a8a' : '#991b1b', letterSpacing: '-1px' }}>
                     {mediaGlobal.toFixed(1)}
                   </div>
                   <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
                     / 10.0
                   </div>
                 </div>
                 
                 <div style={{ fontSize: 13, color: '#64748b', marginTop: 8, fontWeight: 500 }}>
                   Referente ao {boletimAtual.originalTitle} {boletimAtual.dados.ano ? `de ${boletimAtual.dados.ano}` : ''} {boletimAtual.nomeTurma ? `| Turma: ${boletimAtual.nomeTurma}` : ''}
                 </div>
               </div>

               <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.7)', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.9)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                 {isAcima ? <TrendingUp size={24} color="#10b981"/> : <TrendingDown size={24} color="#ef4444"/>}
                 <span style={{ fontSize: 12, fontWeight: 700, color: isAcima ? '#059669' : '#b91c1c', textAlign: 'center', maxWidth: 120, lineHeight: 1.2 }}>
                   {isAcima ? 'Desempenho esperado' : 'Requer atenção'}
                 </span>
               </div>
             </div>
          </motion.div>

          {/* Tabela de Disciplinas Modernizada */}
          <div style={{ background: '#fff', borderRadius: 24, padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f8fafc', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart2 size={16} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#0f172a' }}>Rendimento por Disciplina</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <AnimatePresence mode="wait">
                <motion.div 
                  key={selectedBimestreId} 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }} 
                  transition={{ duration: 0.3 }}
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}
                >
                  {disciplinas.map((d: any, i: number) => {
                    const isPassed = d.mediaFNum >= 7.0
                    return (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.05 }}
                        whileHover={{ y: -2, boxShadow: '0 8px 20px rgba(0,0,0,0.04)' }}
                        style={{ 
                          padding: '16px', 
                          background: '#f8fafc', 
                          borderRadius: 16, 
                          border: '1px solid #f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 13 }}>{d.nome}</div>
                          
                          <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 500 }}>
                            <span>AVM: <strong style={{ color: '#475569' }}>{d.avm}</strong></span>
                            <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#cbd5e1' }} />
                            <span>AVB: <strong style={{ color: '#475569' }}>{d.avb}</strong></span>
                          </div>
                          
                          <div style={{ marginTop: 6, height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden', width: '85%' }}>
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(d.mediaFNum * 10, 100)}%` }}
                              transition={{ duration: 1, ease: "easeOut", delay: 0.2 + (i * 0.05) }}
                              style={{ 
                                height: '100%', 
                                background: isPassed ? '#10b981' : '#ef4444', 
                                borderRadius: 2 
                              }} 
                            />
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          <div style={{ 
                            fontSize: 22, 
                            fontWeight: 900, 
                            fontFamily: 'Outfit, sans-serif',
                            color: isPassed ? '#059669' : '#dc2626',
                            lineHeight: 1
                          }}>
                            {d.mediaF}
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html:`
        @media (max-width: 480px) {
          .hide-on-mobile { display: none; }
        }
      `}} />
    </motion.div>
  )
}
