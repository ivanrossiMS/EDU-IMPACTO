'use client'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { useSelectedStudent } from '@/lib/selectedStudentContext'
import { useData } from '@/lib/dataContext'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useApp } from '@/lib/context'
import { useParams, useSearchParams } from 'next/navigation'
import { 
  GraduationCap, Download, ChevronRight, ChevronDown, TrendingUp, TrendingDown, 
  AlertCircle, FileText, BarChart2, Sparkles, AlertTriangle, CheckCircle2, AlertOctagon,
  Calculator
} from 'lucide-react'
import { EmptyStateCard } from '../../components/EmptyStateCard'
import { useApiQuery } from '@/hooks/useApi'
import { motion, AnimatePresence } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { useAgendaRealtime } from '@/hooks/useAgendaRealtime'
import { parseNotaValor, calcularDiagnosticoPedagogico, arredondarMediaImpacto } from '@/lib/notasEngine'

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
  const searchParams = useSearchParams()
  const queryItemId = searchParams?.get('id') || searchParams?.get('boletim_id') || searchParams?.get('item_id')
  const hasAutoSelectedRef = useRef(false)

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

  // Auto-selecionar ano, turma e bimestre a partir da notificação push (?id=...)
  useEffect(() => {
    if (!queryItemId || hasAutoSelectedRef.current || todosBoletins.length === 0) return;

    const rawTarget = String(queryItemId).trim();
    const target = todosBoletins.find((b: any) => String(b.id) === rawTarget);

    if (target) {
      hasAutoSelectedRef.current = true;
      if (target.anoStr && target.anoStr !== selectedYear) {
        setSelectedYear(target.anoStr);
      }
      if (target.nomeTurma && target.nomeTurma !== selectedTurma) {
        setSelectedTurma(target.nomeTurma);
      }
      setSelectedBimestreId(target.id);
    }
  }, [queryItemId, todosBoletins, selectedYear, selectedTurma]);

  // Extract periods (bimestres) available for selected Turma
  const bimestresDisponiveis = useMemo(() => {
    if (!boletins.length || !selectedTurma) return []
    
    const boletinsTurma = boletins.filter((b: any) => b.nomeTurma === selectedTurma);
    const sorted = [...boletinsTurma].sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    
    const res = [];
    for (const b of sorted) {
      const match = (b.parsedDados?.bimestre || '').match(/(\d+)/)
      const bimNum = match ? parseInt(match[1], 10) : 0
      res.push({ id: b.id, nome: b.parsedDados.bimestre, dados: b.parsedDados, originalTitle: b.parsedDados.bimestre, nomeTurma: b.nomeTurma, bimNum })
    }

    return res.sort((a: any, b: any) => (a.bimNum && b.bimNum) ? a.bimNum - b.bimNum : a.originalTitle.localeCompare(b.originalTitle))
  }, [boletins, selectedTurma])

  const [selectedBimestreId, setSelectedBimestreId] = useState<string | null>(null)

  // Auto-select the LAST available period (último bimestre) ao carregar
  useEffect(() => {
    if (bimestresDisponiveis.length > 0) {
      if (queryItemId) {
        const target = bimestresDisponiveis.find((b: any) => String(b.id) === String(queryItemId))
        if (target) {
          if (selectedBimestreId !== target.id) setSelectedBimestreId(target.id)
          return
        }
      }
      const exists = selectedBimestreId === 'media_anual' || bimestresDisponiveis.some(b => b.id === selectedBimestreId)
      if (!selectedBimestreId || !exists) {
        const lastBim = bimestresDisponiveis[bimestresDisponiveis.length - 1]
        setSelectedBimestreId(lastBim.id)
      }
    }
  }, [bimestresDisponiveis, selectedBimestreId, queryItemId])

  const isMediaAnual = selectedBimestreId === 'media_anual'

  const totalBimestresLancados = useMemo(() => {
    const seen = new Set<number>()
    bimestresDisponiveis.forEach((b: any) => {
      if (b.bimNum > 0) seen.add(b.bimNum)
    })
    return seen.size
  }, [bimestresDisponiveis])

  // Cálculo da Média Anual de todas as disciplinas com base nos bimestres lançados
  const disciplinasAnuais = useMemo(() => {
    if (!boletins.length || bimestresDisponiveis.length === 0) return []

    const discMap = new Map<string, {
      nome: string
      bimesters: {
        bimNum: number
        bimNome: string
        valorStr: string
        valorNum: number
        lancado: boolean
        avm?: any
        avb?: any
        simulado?: any
        bonus?: any
        rec?: any
      }[]
    }>()

    const seenBims = new Set<number>()
    const uniqueBims = bimestresDisponiveis.filter((b: any) => {
      if (seenBims.has(b.bimNum)) return false
      seenBims.add(b.bimNum)
      return true
    })

    for (const b of uniqueBims) {
      const discList = b.dados?.disciplinas || []
      for (const d of discList) {
        if (!d.nome) continue
        const normKey = d.nome.trim().toUpperCase()
        if (!discMap.has(normKey)) {
          discMap.set(normKey, {
            nome: d.nome.trim(),
            bimesters: []
          })
        }

        const entry = discMap.get(normKey)!
        const rawVal = d.mediaG && d.mediaG !== '---' ? d.mediaG : (d.mediaF || '')
        const strVal = String(rawVal).trim()
        const isLancado = strVal !== '' && strVal !== '---' && strVal !== '-'
        const num = parseNotaValor(strVal)

        entry.bimesters.push({
          bimNum: b.bimNum,
          bimNome: b.nome,
          valorStr: isLancado ? strVal : '—',
          valorNum: num,
          lancado: isLancado,
          avm: d.avm,
          avb: d.avb,
          simulado: d.simulado,
          bonus: d.pntBonu || d.bonus,
          rec: d.rec
        })
      }
    }

    const list: any[] = []
    discMap.forEach((entry) => {
      const sortedBims = [...entry.bimesters].sort((a, b) => a.bimNum - b.bimNum)
      const lancados = sortedBims.filter(b => b.lancado)

      let mediaAnualNum = 0
      if (lancados.length > 0) {
        const sum = lancados.reduce((acc, b) => acc + b.valorNum, 0)
        mediaAnualNum = sum / lancados.length
      }

      // Arredondamento acadêmico oficial (Imagem 2 / Colégio IMPACTO):
      // >= 0.00 e <= 0.25 -> 0.00 | > 0.25 e <= 0.75 -> 0.50 | > 0.75 e <= 1.00 -> 1.00
      const mediaFNum = arredondarMediaImpacto(mediaAnualNum)

      list.push({
        nome: entry.nome,
        bimesters: sortedBims,
        lancadosCount: lancados.length,
        totalBims: uniqueBims.length,
        mediaFNum,
        mediaAnualFormatada: mediaFNum.toFixed(1).replace('.', ','),
        isPassed: mediaFNum >= 7.0
      })
    })

    return list.sort((a, b) => a.nome.localeCompare(b.nome))
  }, [boletins, bimestresDisponiveis])

  const disciplinasAnuaisAbaixo = useMemo(() => {
    return disciplinasAnuais.filter(d => d.mediaFNum < 7.0)
  }, [disciplinasAnuais])

  const mediaGlobalAnual = useMemo(() => {
    if (!disciplinasAnuais.length) return 0
    const sum = disciplinasAnuais.reduce((acc, curr) => acc + curr.mediaFNum, 0)
    const avg = sum / disciplinasAnuais.length
    return isNaN(avg) ? 0 : arredondarMediaImpacto(avg)
  }, [disciplinasAnuais])

  const diagnosticoAnual = useMemo(() => {
    if (!disciplinasAnuais.length) return null
    return calcularDiagnosticoPedagogico(mediaGlobalAnual, disciplinasAnuaisAbaixo.length, disciplinasAnuais.length)
  }, [disciplinasAnuais, mediaGlobalAnual, disciplinasAnuaisAbaixo])

  useEffect(() => {
    if (!aluno?.id || boletins.length === 0) return;
    
    const isFamily = currentUser?.perfil === 'Família' || currentUser?.perfil === 'Responsável' || currentUser?.cargo === 'Aluno' || currentUser?.cargo === 'Responsável';
    const currentReaderId = currentUser?.id;
    if (!currentReaderId) return;

    const searchParams = new URLSearchParams(window.location.search);
    const espelharRespId = searchParams.get('espelhar_responsavel');
    const espelharAluno = searchParams.get('espelhar_aluno') === 'true';
    if (espelharRespId || espelharAluno) return; // Do not mark as read in mirror mode

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
    if (!boletimAtual || !boletimAtual.dados || !boletimAtual.dados.disciplinas) return []
    return boletimAtual.dados.disciplinas.map((d: any) => {
      const val = String(d.mediaG && d.mediaG !== '---' ? d.mediaG : (d.mediaF || '')).trim()
      const num = parseNotaValor(val)
      return {
        ...d,
        mediaFNum: num
      }
    })
  }, [boletimAtual])

  const disciplinasAbaixo = useMemo(() => {
    return disciplinas.filter((d: any) => d.mediaFNum < 7.0)
  }, [disciplinas])

  const disciplinasAprovadas = useMemo(() => {
    return disciplinas.filter((d: any) => d.mediaFNum >= 7.0)
  }, [disciplinas])

  const mediaGlobal = useMemo(() => {
     if (!disciplinas.length) return 0
     const sum = disciplinas.reduce((acc: number, curr: any) => acc + curr.mediaFNum, 0)
     return parseFloat((sum / disciplinas.length).toFixed(1))
  }, [disciplinas])

  const diagnostico = useMemo(() => {
    if (!disciplinas.length) return null
    return calcularDiagnosticoPedagogico(mediaGlobal, disciplinasAbaixo.length, disciplinas.length)
  }, [mediaGlobal, disciplinasAbaixo, disciplinas])

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
            overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
            alignItems: 'center'
          }}>
            {/* Botão Média Anual - Antes dos bimestres */}
            <button
              onClick={() => setSelectedBimestreId('media_anual')}
              style={{
                flex: 1,
                minWidth: 100,
                padding: '10px 8px',
                borderRadius: 14,
                border: 'none',
                fontWeight: 700,
                fontSize: 13,
                whiteSpace: 'nowrap',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                background: isMediaAnual ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : 'transparent',
                color: isMediaAnual ? '#ffffff' : '#64748b',
                boxShadow: isMediaAnual ? '0 4px 12px rgba(37,99,235,0.25)' : 'none'
              }}
              title="Calcular e visualizar a média anual das disciplinas com base nos bimestres lançados"
            >
              <Calculator size={14} />
              <span>Média Anual</span>
            </button>

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
        {isMediaAnual ? (
          disciplinasAnuais.length === 0 ? (
            <div style={{
              background: '#fff',
              borderRadius: 24,
              padding: '60px 20px',
              border: '1px solid #e2e8f0',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12
            }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calculator size={28} color="#2563eb" />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#0f172a' }}>
                Nenhum bimestre lançado para cálculo
              </h3>
              <p style={{ fontSize: 14, color: '#64748b', margin: 0, maxWidth: 360 }}>
                Ainda não há notas bimestrais lançadas para computar a média anual.
              </p>
            </div>
          ) : (
            <div className="print-main-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 32 }}>
              {/* Card Resumo Global Anual */}
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="print-global-card"
                style={{
                  padding: '16px 20px',
                  background: diagnosticoAnual?.cardBg || 'linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)',
                  color: '#0f172a',
                  borderRadius: 20,
                  border: `1px solid ${diagnosticoAnual?.cardBorder || '#e0e7ff'}`,
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}
              >
                <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, background: diagnosticoAnual?.badgeBg || 'rgba(59,130,246,0.1)', borderRadius: '50%', filter: 'blur(40px)', pointerEvents: 'none' }} />

                {/* Top Row: Média Global à esquerda + Card de Rendimento à direita (sempre lado a lado) */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, position: 'relative' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                      <div style={{ width: 26, height: 26, borderRadius: 8, background: diagnosticoAnual?.iconBg || '#dbeafe', color: diagnosticoAnual?.iconColor || '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Calculator size={14} />
                      </div>
                      <div style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 11, color: '#64748b' }}>
                        Média Global Anual
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <div className="print-media-value" style={{ fontSize: 44, fontWeight: 900, fontFamily: 'Outfit, sans-serif', lineHeight: 1, color: diagnosticoAnual?.valueColor || '#1e3a8a', letterSpacing: '-1px' }}>
                        {mediaGlobalAnual.toFixed(1)}
                      </div>
                      <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
                        / 10.0
                      </div>
                    </div>
                  </div>

                  {/* Card de Rendimento (ao lado da Média Global) */}
                  <div style={{
                    padding: '8px 14px',
                    background: '#ffffff',
                    borderRadius: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    border: `1px solid ${diagnosticoAnual?.badgeBorder || 'rgba(0,0,0,0.06)'}`,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
                    flexShrink: 0,
                    textAlign: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {diagnosticoAnual?.tipo === 'adequado' ? (
                        <TrendingUp size={16} color={diagnosticoAnual.badgeColor} />
                      ) : diagnosticoAnual?.tipo === 'insuficiente' ? (
                        <TrendingDown size={16} color={diagnosticoAnual.badgeColor} />
                      ) : diagnosticoAnual?.tipo === 'critico' ? (
                        <AlertOctagon size={16} color={diagnosticoAnual.badgeColor} />
                      ) : (
                        <AlertTriangle size={16} color={diagnosticoAnual?.badgeColor || '#d97706'} />
                      )}
                      <span style={{ fontSize: 12, fontWeight: 800, color: diagnosticoAnual?.badgeColor || '#059669', whiteSpace: 'nowrap' }}>
                        {diagnosticoAnual?.badgeText}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>
                      {disciplinasAnuaisAbaixo.length === 0
                        ? '100% na média'
                        : `${disciplinasAnuaisAbaixo.length} disc. < 7.0`}
                    </span>
                  </div>
                </div>

                {/* Linha Inferior: Metadados do período e turma */}
                <div style={{
                  fontSize: 11.5,
                  color: '#64748b',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 4,
                  paddingTop: 8,
                  borderTop: '1px solid rgba(0,0,0,0.05)',
                  position: 'relative'
                }}>
                  <span>
                    Média acumulada dos {totalBimestresLancados} {totalBimestresLancados === 1 ? 'bimestre lançado' : 'bimestres lançados'}
                  </span>
                  {selectedTurma && (
                    <span style={{ fontWeight: 600, color: '#475569' }}>
                      Turma: {selectedTurma}
                    </span>
                  )}
                </div>
              </motion.div>


              {/* Tabela de Disciplinas Anuais */}
              <div className="print-disciplinas-wrapper" style={{ background: '#fff', borderRadius: 24, padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <BarChart2 size={16} />
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#0f172a' }}>
                      Rendimento por Disciplina ({disciplinasAnuais.length})
                    </h3>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>
                    Base: {totalBimestresLancados} {totalBimestresLancados === 1 ? 'bimestre lançado' : 'bimestres lançados'}
                  </span>
                </div>

                <div className="print-disciplinas-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                  {disciplinasAnuais.map((d: any, i: number) => {
                    const isPassed = d.isPassed
                    return (
                      <motion.div
                        key={d.nome}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.02 }}
                        whileHover={{ y: -2, boxShadow: '0 8px 20px rgba(0,0,0,0.04)' }}
                        className="print-disciplina-item"
                        style={{
                          padding: '16px',
                          background: isPassed ? '#f8fafc' : '#fff8f8',
                          borderRadius: 16,
                          border: isPassed ? '1px solid #f1f5f9' : '1px solid #fecaca',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          boxShadow: isPassed ? '0 2px 10px rgba(0,0,0,0.02)' : '0 2px 10px rgba(239,68,68,0.06)',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0, paddingRight: 12 }}>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span>{d.nome}</span>
                            {!isPassed ? (
                              <span style={{ fontSize: 10, fontWeight: 800, color: '#dc2626', background: '#fee2e2', padding: '1px 5px', borderRadius: 4 }}>
                                Abaixo
                              </span>
                            ) : (
                              <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '1px 5px', borderRadius: 4 }}>
                                Na Média
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500, flexWrap: 'wrap' }}>
                            {d.bimesters.map((b: any, bIdx: number) => (
                              <span key={b.bimNum} style={{ color: b.lancado ? '#334155' : '#94a3b8' }}>
                                {bIdx > 0 && <span style={{ marginRight: 6, color: '#cbd5e1' }}>•</span>}
                                {b.bimNum}º Bim: <strong style={{ color: b.lancado ? (b.valorNum >= 7.0 ? '#1e293b' : '#dc2626') : '#94a3b8' }}>{b.valorStr}</strong>
                              </span>
                            ))}
                          </div>

                          <div style={{ marginTop: 4, height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden', width: '85%' }}>
                            <div
                              style={{
                                width: `${Math.min(d.mediaFNum * 10, 100)}%`,
                                height: '100%',
                                background: isPassed ? '#10b981' : '#ef4444',
                                borderRadius: 2
                              }}
                            />
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                          <div style={{
                            fontSize: 22,
                            fontWeight: 900,
                            fontFamily: 'Outfit, sans-serif',
                            color: isPassed ? '#059669' : '#dc2626',
                            lineHeight: 1
                          }}>
                            {d.mediaAnualFormatada}
                          </div>
                          <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>
                            Média Anual
                          </div>
                          <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 500 }}>
                            ({d.lancadosCount} {d.lancadosCount === 1 ? 'bimestre' : 'bimestres'})
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        ) : (
          boletimAtual && (
            <div className="print-main-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 32 }}>
              {/* Card Resumo Global com Diagnóstico Pedagógico */}
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }} 
                key={boletimAtual.id}
                className="print-global-card"
                style={{ 
                  padding: '16px 20px', 
                  background: diagnostico?.cardBg || 'linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)', 
                  color: '#0f172a', 
                  borderRadius: 20, 
                  border: `1px solid ${diagnostico?.cardBorder || '#e0e7ff'}`, 
                  position: 'relative', 
                  overflow: 'hidden', 
                  boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}
              >
                <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, background: diagnostico?.badgeBg || 'rgba(59,130,246,0.1)', borderRadius: '50%', filter: 'blur(40px)', pointerEvents: 'none' }} />
                
                {/* Top Row: Média Global à esquerda + Card de Rendimento à direita (sempre lado a lado) */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, position: 'relative' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                      <div style={{ width: 26, height: 26, borderRadius: 8, background: diagnostico?.iconBg || '#dbeafe', color: diagnostico?.iconColor || '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <GraduationCap size={14} />
                      </div>
                      <div style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 11, color: '#64748b' }}>
                        Média Global
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <div className="print-media-value" style={{ fontSize: 44, fontWeight: 900, fontFamily: 'Outfit, sans-serif', lineHeight: 1, color: diagnostico?.valueColor || '#1e3a8a', letterSpacing: '-1px' }}>
                        {mediaGlobal.toFixed(1)}
                      </div>
                      <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
                        / 10.0
                      </div>
                    </div>
                  </div>

                  {/* Card de Rendimento (ao lado da Média Global) */}
                  <div style={{
                    padding: '8px 14px',
                    background: '#ffffff',
                    borderRadius: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    border: `1px solid ${diagnostico?.badgeBorder || 'rgba(0,0,0,0.06)'}`,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
                    flexShrink: 0,
                    textAlign: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {diagnostico?.tipo === 'adequado' ? (
                        <TrendingUp size={16} color={diagnostico.badgeColor} />
                      ) : diagnostico?.tipo === 'insuficiente' ? (
                        <TrendingDown size={16} color={diagnostico.badgeColor} />
                      ) : diagnostico?.tipo === 'critico' ? (
                        <AlertOctagon size={16} color={diagnostico.badgeColor} />
                      ) : (
                        <AlertTriangle size={16} color={diagnostico?.badgeColor || '#d97706'} />
                      )}
                      <span style={{ fontSize: 12, fontWeight: 800, color: diagnostico?.badgeColor || '#059669', whiteSpace: 'nowrap' }}>
                        {diagnostico?.badgeText}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>
                      {disciplinasAbaixo.length === 0
                        ? '100% na média'
                        : `${disciplinasAbaixo.length} disc. < 7.0`}
                    </span>
                  </div>
                </div>

                {/* Linha Inferior: Metadados */}
                <div style={{
                  fontSize: 11.5,
                  color: '#64748b',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 4,
                  paddingTop: 8,
                  borderTop: '1px solid rgba(0,0,0,0.05)',
                  position: 'relative'
                }}>
                  <span>
                    Referente ao {boletimAtual.originalTitle} {boletimAtual.dados.ano ? `de ${boletimAtual.dados.ano}` : ''}
                  </span>
                  {boletimAtual.nomeTurma && (
                    <span style={{ fontWeight: 600, color: '#475569' }}>
                      Turma: {boletimAtual.nomeTurma}
                    </span>
                  )}
                </div>
              </motion.div>

          {/* Tabela de Disciplinas Modernizada */}
          <div className="print-disciplinas-wrapper" style={{ background: '#fff', borderRadius: 24, padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f8fafc', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BarChart2 size={16} />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  Rendimento por Disciplina ({disciplinas.length})
                </h3>
              </div>
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
                          background: isPassed ? '#f8fafc' : '#fff8f8', 
                          borderRadius: 16, 
                          border: isPassed ? '1px solid #f1f5f9' : '1px solid #fecaca',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          boxShadow: isPassed ? '0 2px 10px rgba(0,0,0,0.02)' : '0 2px 10px rgba(239,68,68,0.06)',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>{d.nome}</span>
                            {!isPassed && (
                              <span style={{ fontSize: 10, fontWeight: 800, color: '#dc2626', background: '#fee2e2', padding: '1px 5px', borderRadius: 4 }}>
                                Abaixo
                              </span>
                            )}
                          </div>
                          
                          <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500, flexWrap: 'wrap' }}>
                            <span>AVM: <strong style={{ color: '#475569' }}>{d.avm || '---'}</strong></span>
                            <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#cbd5e1' }} />
                            <span>AVB: <strong style={{ color: '#475569' }}>{d.avb || '---'}</strong></span>
                            {d.simulado && d.simulado !== '---' && (
                              <>
                                <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#cbd5e1' }} />
                                <span>Simulado: <strong style={{ color: '#475569' }}>{d.simulado}</strong></span>
                              </>
                            )}
                            {(d.pntBonu || d.bonus) && d.pntBonu !== '---' && d.bonus !== '---' && (
                              <>
                                <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#cbd5e1' }} />
                                <span>Bônus: <strong style={{ color: '#475569' }}>{d.pntBonu || d.bonus}</strong></span>
                              </>
                            )}
                            {d.rec && d.rec !== '---' && (
                              <>
                                <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#cbd5e1' }} />
                                <span>Rec: <strong style={{ color: '#d97706' }}>{d.rec}</strong></span>
                              </>
                            )}
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
                        
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                          <div style={{ 
                            fontSize: 22, 
                            fontWeight: 900, 
                            fontFamily: 'Outfit, sans-serif',
                            color: isPassed ? '#059669' : '#dc2626',
                            lineHeight: 1
                          }}>
                            {d.mediaG && d.mediaG !== '---' ? d.mediaG : (d.mediaF || '---')}
                          </div>
                          {d.mediaG && d.mediaG !== '---' && d.mediaF && d.mediaF !== d.mediaG && (
                            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>
                              Final: {d.mediaF}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      ))}
      </div>
      
      <style dangerouslySetInnerHTML={{__html:`
        @media (max-width: 480px) {
          .hide-on-mobile { display: none; }
        }
        @media print {
          @page {
            margin: 8mm 12mm;
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
            box-sizing: border-box !important;
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

          /* Compressão dos cards para caber de forma organizada e compacta */
          .print-main-wrapper {
            gap: 6px !important;
            margin-bottom: 6px !important;
          }
          
          .print-global-card {
            padding: 8px 14px !important;
            border-radius: 12px !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          
          .print-media-value {
            font-size: 26px !important;
            line-height: 1 !important;
          }
          
          .print-disciplinas-wrapper {
            padding: 8px 12px !important;
            border-radius: 12px !important;
          }

          .print-disciplinas-wrapper h3 {
            font-size: 13px !important;
            margin: 0 !important;
          }
          
          .print-disciplinas-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 5px 8px !important;
          }
          
          .print-disciplina-item {
            padding: 6px 10px !important;
            border-width: 1px !important;
            border-radius: 8px !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          
          /* Ajustes de fontes internas para caber melhor */
          .print-disciplina-item > div:first-child > div:first-child {
            font-size: 11px !important;
            line-height: 1.2 !important;
            margin-bottom: 2px !important;
          }

          .print-disciplina-item > div:first-child > div:nth-child(2) {
            font-size: 8.5px !important;
            gap: 4px !important;
            line-height: 1.2 !important;
          }

          /* Esconde barra de progresso na impressão */
          .print-disciplina-item > div:first-child > div:last-child {
            display: none !important;
          }

          .print-disciplina-item > div:last-child > div:first-child {
            font-size: 15px !important;
            line-height: 1 !important;
          }
        }
      `}} />
    </motion.div>
  )
}
