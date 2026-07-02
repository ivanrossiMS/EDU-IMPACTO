'use client'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { useSelectedStudent } from '@/lib/selectedStudentContext'
import { useData } from '@/lib/dataContext'
import { useState, useMemo, useEffect } from 'react'
import { useApp } from '@/lib/context'
import { GraduationCap, Download, ChevronRight, ChevronDown, TrendingUp, TrendingDown, AlertCircle, FileText, BarChart2, Sparkles } from 'lucide-react'
import { EmptyStateCard } from '../../components/EmptyStateCard'
import { useApiQuery } from '@/hooks/useApi'
import { motion, AnimatePresence } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { useAgendaRealtime } from '@/hooks/useAgendaRealtime'

export default function ADNotasPage({ params }: { params: any }) {
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
  const { currentUser } = useApp()
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
      const nomeTurma = b.turmaNome || tObj?.nome || b.turma || 'Sem Turma';
      
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


  const turmasDisponiveis = useMemo(() => {
    if (!boletins.length) return [];
    const nomes = boletins.map((b: any) => b.nomeTurma);
    return Array.from(new Set(nomes)).sort();
  }, [boletins]);

  const [selectedTurma, setSelectedTurma] = useState<string>('');

  useEffect(() => {
    if (turmasDisponiveis.length > 0 && !selectedTurma) {
      setSelectedTurma(turmasDisponiveis[0] as string);
    } else if (turmasDisponiveis.length > 0 && !turmasDisponiveis.includes(selectedTurma)) {
      setSelectedTurma(turmasDisponiveis[0] as string);
    }
  }, [turmasDisponiveis, selectedTurma]);

  // Extract periods (bimestres) available for selected Turma
  const bimestresDisponiveis = useMemo(() => {
    if (!boletins.length || !selectedTurma) return []
    
    const boletinsTurma = boletins.filter((b: any) => b.nomeTurma === selectedTurma);
    const sorted = [...boletinsTurma].sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    
    const res = [];
    for (const b of sorted) {
      res.push({ id: b.id, nome: b.parsedDados.bimestre, dados: b.parsedDados, originalTitle: b.parsedDados.bimestre, nomeTurma: b.nomeTurma })
    }

    return res.sort((a: any, b: any) => a.originalTitle.localeCompare(b.originalTitle))
  }, [boletins, selectedTurma])

  const [selectedBimestreId, setSelectedBimestreId] = useState<string | null>(null)

  // Auto-select first available period
  useEffect(() => {
    if (bimestresDisponiveis.length > 0 && !selectedBimestreId) {
      setSelectedBimestreId(bimestresDisponiveis[0].id)
    }
  }, [bimestresDisponiveis, selectedBimestreId])

  useEffect(() => {
    if (!aluno?.id || boletins.length === 0) return;
    
    const isFamily = currentUser?.perfil === 'Família' || currentUser?.perfil === 'Responsável' || currentUser?.cargo === 'Aluno' || currentUser?.cargo === 'Responsável';
    const currentReaderId = currentUser?.id;
    if (!currentReaderId) return;

    // Check which ones are unread
    const unreadIds = boletins
      .filter((b: any) => {
        const dados = typeof b.dados === 'string' ? JSON.parse(b.dados) : b.dados || {};
        const leituras = b.leituras || dados.leituras || {};
        return !leituras[currentReaderId];
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
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ 
            background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)', 
            padding: '80px 40px', 
            borderRadius: 32, 
            textAlign: 'center', 
            border: '1px solid rgba(255,255,255,0.8)', 
            boxShadow: '0 20px 40px rgba(15, 23, 42, 0.03), inset 0 2px 10px rgba(255,255,255,1)',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            maxWidth: 500
          }}
        >
          {/* Subtle background glow */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 300, height: 300, background: 'radial-gradient(circle, rgba(59, 130, 246, 0.04) 0%, rgba(255,255,255,0) 70%)', zIndex: 0 }} />

          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 20 }}
            style={{ 
              width: 80, 
              height: 80, 
              borderRadius: '50%', 
              background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              marginBottom: 24,
              position: 'relative',
              zIndex: 1,
              boxShadow: '0 8px 24px rgba(59, 130, 246, 0.15), inset 0 2px 4px rgba(255,255,255,0.9)'
            }}
          >
            <GraduationCap size={40} color="#2563eb" strokeWidth={1.5} />
            <motion.div 
              animate={{ rotate: 360 }} 
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              style={{ position: 'absolute', inset: -10, border: '1px dashed rgba(59, 130, 246, 0.3)', borderRadius: '50%' }}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, type: 'spring' }}
              style={{ position: 'absolute', top: -4, right: -4, background: '#fff', borderRadius: '50%', padding: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
            >
              <Sparkles size={16} color="#3b82f6" />
            </motion.div>
          </motion.div>

          <motion.h3 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 12, letterSpacing: '-0.02em', position: 'relative', zIndex: 1 }}
          >
            Nenhum Boletim
          </motion.h3>
          
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            style={{ fontSize: 15, color: '#64748b', lineHeight: 1.6, margin: 0, maxWidth: 400, position: 'relative', zIndex: 1 }}
          >
            Ainda não há notas ou boletins lançados para este aluno no sistema. Novas avaliações aparecerão aqui automaticamente.
          </motion.p>
        </motion.div>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif', margin: 0, color: '#0f172a' }}>Boletim e Notas</h2>
      </div>

      {/* Filters Glassmorphism Card */}
      <div className="no-print" style={{ 
        background: 'rgba(255, 255, 255, 0.7)', 
        backdropFilter: 'blur(10px)', 
        border: '1px solid rgba(255, 255, 255, 0.5)', 
        borderRadius: 24, 
        padding: 20, 
        marginBottom: 24,
        boxShadow: '0 4px 24px -6px rgba(0, 0, 0, 0.05)'
      }}>
        {/* Ano & Turma */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: 1, marginRight: 16 }}>
            <select 
              value={`${selectedYear}|${selectedTurma}`}
              onChange={(e) => {
                const [ano, turma] = e.target.value.split('|');
                setSelectedYear(ano);
                setSelectedTurma(turma);
              }}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 2 }}
            >
              {anosDisponiveis.map((ano: string) => (
                 <optgroup key={ano} label={`Ano: ${ano}`}>
                   {Array.from(new Set(todosBoletins.filter((b:any)=>b.anoStr === ano).map((b:any)=>b.nomeTurma))).sort().map((turma: any) => (
                      <option key={`${ano}|${turma}`} value={`${ano}|${turma}`}>
                        {turma} - {ano}
                      </option>
                   ))}
                 </optgroup>
              ))}
            </select>
            <div style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, 
              padding: '12px 16px', fontSize: 15, fontWeight: 700, color: '#0f172a',
              boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                 <GraduationCap size={18} color="#3b82f6" />
                 <span>{selectedTurma} - {selectedYear}</span>
              </div>
              <ChevronDown size={18} color="#94a3b8" />
            </div>
          </div>
          
          <button onClick={() => window.print()} className="btn btn-secondary" style={{ 
            display: 'flex', alignItems: 'center', gap: 8, 
            background: '#fff', border: '1px solid #e2e8f0', color: '#0f172a', 
            fontWeight: 600, padding: '12px', borderRadius: 16,
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
          }} title="Baixar PDF">
            <Download size={18} color="#3b82f6" /> 
            <span className="hide-on-mobile">Baixar PDF</span>
          </button>
        </div>

        {/* Bimestres Segmented Control */}
        {bimestresDisponiveis.length > 0 && (
          <div style={{ 
            display: 'flex', gap: 6, background: '#f1f5f9', padding: 6, borderRadius: 18,
            overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' 
          }}>
            {bimestresDisponiveis.map((b: any) => (
              <button
                key={b.id}
                onClick={() => setSelectedBimestreId(b.id)}
                style={{
                  flex: 1,
                  minWidth: 80,
                  padding: '10px 4px',
                  borderRadius: 14,
                  border: 'none',
                  fontWeight: 700,
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  background: selectedBimestreId === b.id ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : 'transparent',
                  color: selectedBimestreId === b.id ? '#ffffff' : '#64748b',
                  boxShadow: selectedBimestreId === b.id ? '0 4px 12px rgba(37,99,235,0.25)' : 'none'
                }}
              >
                {b.nome.replace('Bimestre', 'Bim')}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        {boletimAtual && (
        <div className="print-main-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 32 }}>
          {/* Card Resumo Global */}
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            key={boletimAtual.id}
            className="print-global-card"
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
                   <div className="print-media-value" style={{ fontSize: 56, fontWeight: 900, fontFamily: 'Outfit, sans-serif', lineHeight: 1, color: isAcima ? '#1e3a8a' : '#991b1b', letterSpacing: '-1px' }}>
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

               <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.7)', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, backdropFilter: 'none', border: '1px solid rgba(255,255,255,0.9)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                 {isAcima ? <TrendingUp size={24} color="#10b981"/> : <TrendingDown size={24} color="#ef4444"/>}
                 <span style={{ fontSize: 12, fontWeight: 700, color: isAcima ? '#059669' : '#b91c1c', textAlign: 'center', maxWidth: 120, lineHeight: 1.2 }}>
                   {isAcima ? 'Desempenho esperado' : 'Requer atenção'}
                 </span>
               </div>
             </div>
          </motion.div>

          {/* Tabela de Disciplinas Modernizada */}
          <div className="print-disciplinas-wrapper" style={{ background: '#fff', borderRadius: 24, padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
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
                  className="print-disciplinas-grid"
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
                        className="print-disciplina-item"
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
      </div>
      
      <style dangerouslySetInnerHTML={{__html:`
        @media (max-width: 480px) {
          .hide-on-mobile { display: none; }
        }
        @media print {
          @page {
            margin: 15mm;
            size: A4 portrait;
          }
          
          /* Esconde a barra lateral, banners, botões e elementos interativos */
          .ad-sidebar-container,
          .ad-banner-global,
          .ad-right-section, /* Esconde os botões Chamar Aluno, Trocar e Sair */
          .no-print,
          button,
          select,
          ::-webkit-scrollbar {
            display: none !important;
          }

          /* Remove limitações de altura e rolagem do layout do app */
          body, html, #root,
          .agenda-digital-wrapper,
          .ad-main-scroll,
          .ad-content-inner {
            height: auto !important;
            width: 100% !important;
            overflow: visible !important;
            position: static !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
            background: white !important;
          }
          
          /* Remove totalmente os espaços extras entre o card do aluno e o boletim */
          .ad-main-grid {
            margin-top: -12px !important;
          }
          .ad-premium-card-wrapper {
            margin-bottom: 0 !important;
            padding-bottom: 0 !important;
          }

          /* Força a impressão das cores de fundo (como os cards do boletim) */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Desativa animações do framer-motion que quebram a impressão */
          * {
            transform: none !important;
            animation: none !important;
            transition: none !important;
          }
          
          /* Ajustes de tipografia e espaçamento para papel */
          body {
            font-size: 11pt !important;
          }

          /* Compressão dos cards para caber em uma única página */
          .print-main-wrapper {
            gap: 8px !important;
            margin-bottom: 8px !important;
          }
          
          .print-global-card {
            padding: 12px !important;
          }
          
          .print-media-value {
            font-size: 32px !important; /* Reduz muito a altura do card principal */
          }
          
          .print-disciplinas-wrapper {
            padding: 12px !important;
          }
          
          .print-disciplinas-grid {
            grid-template-columns: repeat(3, 1fr) !important; /* 3 colunas espremem muito a altura total */
            gap: 6px !important;
          }
          
          .print-disciplina-item {
            padding: 8px !important;
            border-width: 1px !important;
          }
          
          /* Ajustes de fontes internas para caber melhor */
          .print-disciplina-item > div:first-child > div:first-child {
            font-size: 11px !important;
            margin-bottom: 2px !important;
          }
        }
      `}} />
    </motion.div>
  )
}
