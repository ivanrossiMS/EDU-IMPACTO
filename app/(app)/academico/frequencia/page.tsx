'use client'

import { useData, newId } from '@/lib/dataContext'
import { useState, useMemo, useCallback, useEffect } from 'react'
import { getInitials } from '@/lib/utils'
import { useApiQuery } from '@/hooks/useApi'
import { useEnsalamento } from '@/lib/useEnsalamento'
import {
  ArrowLeft, Save, Download, CheckCircle, BookOpen, ChevronRight, ChevronDown,
  AlertTriangle, Search, Calendar, BarChart2, Users, Printer, FileText, Check, X, Info,
  Filter, School, TrendingUp, AlertCircle, Shield, Tag, XCircle, MoreHorizontal, Sparkles, RefreshCw
} from 'lucide-react'
import { TableSkeleton } from '@/components/skeletons/TableSkeleton'
import { PresStatus, getTurmaSchedule, calcularFrequenciaDia, getFirstPresentTempoIndex } from '@/lib/frequenciaEngine'
import { SyncAcessosModal } from '@/components/portaria/SyncAcessosModal'

const S_CONFIG: Record<PresStatus, { bg: string; color: string; label: string; border: string; glow: string }> = {
  P: { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0', label: 'P', glow: 'rgba(34, 197, 94, 0.2)' },
  F: { bg: '#fee2e2', color: '#b91c1c', border: '#fecaca', label: 'F', glow: 'rgba(239, 68, 68, 0.2)' },
  J: { bg: '#fef3c7', color: '#b45309', border: '#fde68a', label: 'J', glow: 'rgba(245, 158, 11, 0.2)' },
  A: { bg: '#e5e7eb', color: '#374151', border: '#d1d5db', label: 'A', glow: 'rgba(107, 114, 128, 0.2)' },
  '-': { bg: 'transparent', color: '#94a3b8', border: '1px dashed #cbd5e1', label: '-', glow: 'none' },
}

function renderRegrasModal(isOpen: boolean, onClose: () => void) {
  if (!isOpen) return null;
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.55)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '24px',
        maxWidth: '650px',
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 40px rgba(37, 99, 235, 0.05)',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Header do Modal */}
        <div style={{
          padding: '24px 32px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#2563eb', color: '#fff', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={18} style={{ color: '#fff' }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '18px', color: '#0f172a' }}>
                Regras e Métricas de Frequência
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                Diretrizes oficiais para contabilização de faltas e presença
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo do Modal */}
        <div style={{ padding: '32px', maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Regra Educação Infantil & Fund I */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '20px', borderRadius: '16px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#16a34a', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: '#10b981', color: '#fff', width: '22px', height: '22px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 900 }}>EI</span>
              Educação Infantil e Ensino Fundamental I
            </h4>
            <ul style={{ margin: '0 0 16px 0', paddingLeft: '20px', fontSize: '13px', color: '#14532d', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>
                <strong>Métrica Diária:</strong> As faltas são calculadas por <strong>dia letivo completo</strong> (não por períodos individuais).
              </li>
              <li>
                <strong>Tolerância de Atraso:</strong> Até <strong>07:20 (Matutino)</strong> ou <strong>13:20 (Vespertino)</strong> = Presente no 1º tempo. Até <strong>07:50 / 13:50</strong> = Falta no 1º tempo, Presente no restante.
              </li>
              <li>
                <strong>Falta no 1º e 2º tempos:</strong> Atrasos após 07:50 ou 13:50 (ou falta consecutiva nos dois primeiros tempos) configuram <strong>Falta no dia completo</strong>.
              </li>
            </ul>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px', background: '#fff', padding: '12px', borderRadius: '12px', border: '1px solid #d1fae5' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Educação Infantil</span>
                <div style={{ marginTop: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', marginBottom: '4px' }}>Matutino</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px', color: '#047857', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>1º tempo:</span> <strong>7h - 8h</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>2º tempo:</span> <strong>8h - 9h</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>3º tempo:</span> <strong>9h - 10h</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>4º tempo:</span> <strong>10h - 11h</strong></div>
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', marginBottom: '4px' }}>Vespertino</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px', color: '#047857' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>1º tempo:</span> <strong>13h - 14h</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>2º tempo:</span> <strong>14h - 15h</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>3º tempo:</span> <strong>15h - 16h</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>4º tempo:</span> <strong>16h - 17h</strong></div>
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: '200px', background: '#fff', padding: '12px', borderRadius: '12px', border: '1px solid #d1fae5' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ensino Fundamental I</span>
                <div style={{ marginTop: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', marginBottom: '4px' }}>Matutino</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px', color: '#047857', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>1º tempo:</span> <strong>7h - 8h</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>2º tempo:</span> <strong>8h - 9h</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>3º tempo:</span> <strong>9h20 - 10h20</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>4º tempo:</span> <strong>10h20 - 11h20</strong></div>
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', marginBottom: '4px' }}>Vespertino</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px', color: '#047857' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>1º tempo:</span> <strong>13h - 14h</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>2º tempo:</span> <strong>14h - 15h</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>3º tempo:</span> <strong>15h20 - 16h20</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>4º tempo:</span> <strong>16h20 - 17h20</strong></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Regra Fund II & Ensino Médio */}
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '20px', borderRadius: '16px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#2563eb', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: '#3b82f6', color: '#fff', width: '22px', height: '22px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 900 }}>EM</span>
              Ensino Fundamental II e Ensino Médio
            </h4>
            <ul style={{ margin: '0 0 16px 0', paddingLeft: '20px', fontSize: '13px', color: '#1e3a8a', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>
                <strong>Métrica por Período:</strong> Cada tempo de aula ausente soma exatamente <strong>uma falta individual</strong> e reduz proporcionalmente a frequência (%).
              </li>
              <li>
                <strong>Tolerância de Atraso:</strong> Mesma tolerância de 20min (Presente no 1º) e 50min (Falta no 1º, Presente nos demais).
              </li>
              <li>
                <strong>Regra de Bloqueio Consecutivo:</strong> Se o aluno tiver falta tanto no <strong>1º quanto no 2º tempo</strong> (atraso &gt; 50min), todos os tempos subsequentes daquele dia são automaticamente marcados como falta.
              </li>
            </ul>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px', background: '#fff', padding: '12px', borderRadius: '12px', border: '1px solid #dbeafe' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ensino Fundamental II</span>
                <div style={{ marginTop: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', marginBottom: '4px' }}>Matutino</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px', color: '#1e40af', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>1º tempo:</span> <strong>7h - 7h50</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>2º tempo:</span> <strong>7h50 - 8h40</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>3º tempo:</span> <strong>8h40 - 9h30</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>4º tempo:</span> <strong>9h50 - 10h40</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>5º tempo:</span> <strong>10h40 - 11h30</strong></div>
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', marginBottom: '4px' }}>Vespertino</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px', color: '#1e40af' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>1º tempo:</span> <strong>13h - 13h50</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>2º tempo:</span> <strong>13h50 - 14h40</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>3º tempo:</span> <strong>14h40 - 15h30</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>4º tempo:</span> <strong>15h50 - 16h40</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>5º tempo:</span> <strong>16h40 - 17h30</strong></div>
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: '200px', background: '#fff', padding: '12px', borderRadius: '12px', border: '1px solid #dbeafe' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ensino Médio</span>
                <div style={{ marginTop: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', marginBottom: '4px' }}>Matutino (Integral)</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px', color: '#1e40af' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>1º tempo:</span> <strong>7h - 7h50</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>2º tempo:</span> <strong>7h50 - 8h40</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>3º tempo:</span> <strong>8h55 - 9h45</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>4º tempo:</span> <strong>9h45 - 10h35</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>5º tempo:</span> <strong>10h50 - 11h40</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>6º tempo:</span> <strong>11h40 - 12h30</strong></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Regra Geral / Justificativa */}
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '20px', borderRadius: '16px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#d97706', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={16} />
              Ausências Justificadas (J)
            </h4>
            <p style={{ margin: 0, fontSize: '13px', color: '#78350f', lineHeight: '1.6' }}>
              Qualquer tempo marcado como <strong>Justificada (J)</strong> é desconsiderado na contagem de faltas daquele dia, ou seja, o aluno é dispensado do tempo e a falta <strong>não prejudica a porcentagem (%)</strong> de presença geral.
            </p>
          </div>

        </div>

        {/* Footer do Modal */}
        <div style={{
          padding: '20px 32px',
          borderTop: '1px solid #f1f5f9',
          textAlign: 'right',
          background: '#f8fafc'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              background: '#0f172a',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#1e293b'}
            onMouseLeave={e => e.currentTarget.style.background = '#0f172a'}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

function getTempoEntrada(horaRegistro: string | null, segment: string, turno: string = 'Matutino'): string | null {
  if (!horaRegistro) return null;
  const parts = horaRegistro.split(':');
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  const arrivalMinutes = hours * 60 + minutes;
  const firstPresentIndex = getFirstPresentTempoIndex(arrivalMinutes, segment, turno);
  return `${firstPresentIndex + 1}º Tempo`;
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function FrequenciaPage() {
  const { turmas = [], setFrequencias, cfgCalendarioLetivo = [], cfgNiveisEnsino = [] } = useData()
  
  const { data: apiResponse, isLoading: loadingAlunos, isFetching: fetchingAlunos } = useApiQuery<{data: any[], meta: any}>(
    ['alunos-core-frequencia'], 
    '/api/alunos', 
    { lightweight: true, all: true, limit: 2000 }
  )
  const alunos = apiResponse?.data || []

  const { data: allFreqs, isLoading: loadingAllFreqs, isFetching: fetchingAllFreqs, refetch: refetchAllFreqs } = useApiQuery<any[]>(
    ['all-frequencias'],
    '/api/academico/frequencias'
  )

  const [turmaSel, setTurmaSel] = useState<string|null>(null)
  const [showRegrasModal, setShowRegrasModal] = useState(false)
  const [showRelatorioModal, setShowRelatorioModal] = useState(false)
  const [showAcessosModal, setShowAcessosModal] = useState(false)
  const [buscaRelatorio, setBuscaRelatorio] = useState('')
  const [turmasExpandidas, setTurmasExpandidas] = useState<Record<string, boolean>>({})

  // Filtros do modal de relatório
  const [relatorioAno, setRelatorioAno] = useState('')
  const [relatorioData, setRelatorioData] = useState(todayStr())
  const [relatorioTurno, setRelatorioTurno] = useState('')

  // Modal Registro Manual
  const [showRegistroManualModal, setShowRegistroManualModal] = useState(false)
  const [registroManualAno, setRegistroManualAno] = useState('')
  const [registroManualData, setRegistroManualData] = useState(todayStr())
  const [registroManualTurno, setRegistroManualTurno] = useState('')
  const [buscaRegistroManual, setBuscaRegistroManual] = useState('')
  const [absencesManual, setAbsencesManual] = useState<Record<string, Record<string, PresStatus>>>({})
  const [salvandoManual, setSalvandoManual] = useState(false)

  // Auto-open sync modal on page load
  useEffect(() => {
    setShowAcessosModal(true)
  }, [])
  
  // Filtros home
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString())
  const [filtroSegmento, setFiltroSegmento] = useState('')
  const [filtroBusca, setFiltroBusca] = useState('')
  
  const anosDisponiveis = useMemo(() => {
    const fromConfig = (cfgCalendarioLetivo || []).map((c: any) => c.ano.toString())
    const fromTurmas = (turmas || []).map(t => t.ano.toString())
    return [...new Set([...fromConfig, ...fromTurmas])].sort().reverse()
  }, [cfgCalendarioLetivo, turmas])

  // Sincronizar ano vigente inicial
  useEffect(() => {
    const vigente = (cfgCalendarioLetivo || []).find((c: any) => c.isVigente)?.ano?.toString()
    if (vigente) setFiltroAno(vigente)
  }, [cfgCalendarioLetivo])

  // Estado chamada
  const [dataSel, setDataSel] = useState(todayStr())
  const [buscaAluno, setBuscaAluno] = useState('')
  const [salvo, setSalvo] = useState(false)
  const diasPeriodo = useMemo(() => [dataSel], [dataSel])

  const today = todayStr()
  const freqMinima = 75 // Padrão

  const turmaObj = turmaSel ? turmas.find(t => String(t.id) === String(turmaSel)) : null
  const turmaId = turmaObj?.id ? String(turmaObj.id) : ''
  
  const { getNumeroChamada, ordenarPorChamada, formatarNumero } = useEnsalamento(turmaObj)

  // Registros da turma via API
  const { data: freqTurma, refetch: refetchFreq, isLoading: loadingFreqTurma, isFetching: fetchingFreqTurma } = useApiQuery<any[]>(
    ['frequencias-turma', turmaId],
    `/api/academico/frequencias`,
    { turma_id: turmaId },
    { enabled: !!turmaId, noCache: true }
  )

  const alunosDaTurma = useMemo(() => {
    const lista = turmaSel ? alunos.filter((a: any) => String(a.turma) === String(turmaSel)) : []
    const ordenados = ordenarPorChamada(lista)
    return ordenados.map((aluno: any) => {
      const aId = String(aluno.id);
      const freqRecord = freqTurma?.find(f => String(f.aluno_id) === aId && String(f.data).startsWith(dataSel));
      return {
        ...aluno,
        horaRegistro: freqRecord?.dados?.horaRegistro || freqRecord?.horaRegistro || null
      }
    })
  }, [alunos, turmaSel, ordenarPorChamada, freqTurma, dataSel])
  
  const alunosFiltrados = useMemo(() => !buscaAluno ? alunosDaTurma : alunosDaTurma.filter((a: any) => a.nome.toLowerCase().includes(buscaAluno.toLowerCase())), [alunosDaTurma, buscaAluno])

  const [absences, setAbsences] = useState<Record<string, Record<string, Record<string, PresStatus>>>>({})

  useEffect(() => {
    if (freqTurma) {
      console.log('Frequências carregadas:', freqTurma.length)
      const newAbsences: Record<string, Record<string, Record<string, PresStatus>>> = {}
      freqTurma.forEach(f => {
        const aId = String(f.aluno_id)
        if (!newAbsences[aId]) newAbsences[aId] = {}
        const dia = String(f.data).split('T')[0]
        
        if (f.tempos) {
          newAbsences[aId][dia] = { ...f.tempos }
        } else {
          // Mapeia registros antigos/binários para todos os tempos da turma
          const overallStatus: PresStatus = f.justificativa === 'Justificada' ? 'J' : (f.presente ? 'P' : 'F')
          const schedule = getTurmaSchedule(turmaObj)
          const temposMap: Record<string, PresStatus> = {}
          schedule.tempos.forEach(t => {
            temposMap[t.id] = overallStatus
          })
          newAbsences[aId][dia] = temposMap
        }
      })
      setAbsences(newAbsences)
    }
  }, [freqTurma, turmaObj])

  const getStatus = useCallback((alunoId: string, dia: string, tempoId: string): PresStatus => {
    const studentDay = absences[String(alunoId)]?.[dia]
    if (studentDay && studentDay[tempoId]) {
      return studentDay[tempoId]
    }
    
    // O padrão absoluto para qualquer aluno sem registro é '-'
    return '-'
  }, [absences])

  const setStatus = (alunoId: string, dia: string, tempoId: string, statusNext: PresStatus) => {
    const aId = String(alunoId)
    setAbsences(prev => {
      const studentData = prev[aId] || {}
      const dayData = studentData[dia] || {}
      return {
        ...prev,
        [aId]: {
          ...studentData,
          [dia]: {
            ...dayData,
            [tempoId]: statusNext
          }
        }
      }
    })
  }

  const handleSave = async () => {
    const recordsToSave: any[] = []
    const schedule = getTurmaSchedule(turmaObj)
    
    alunosDaTurma.forEach(a => {
      diasPeriodo.forEach(dia => {
        const studentDay = absences[String(a.id)]?.[dia] || {}
        const tempos: Record<string, PresStatus> = {}
        schedule.tempos.forEach(t => {
          tempos[t.id] = studentDay[t.id] || '-'
        })
        
        // Aplicar as regras específicas do segmento
        const calc = calcularFrequenciaDia(tempos, schedule.segmento)
        
        const existing = freqTurma?.find(f => String(f.aluno_id) === String(a.id) && String(f.data).startsWith(dia))
        
        recordsToSave.push({
          id: existing?.id,
          alunoId: a.id,
          turmaId: turmaId,
          data: dia,
          anoLetivo: filtroAno,
          presente: calc.presente,
          justificativa: calc.justificativa,
          tempos: calc.temposEfetivos // Salvamos os tempos efetivos com as regras auto-aplicadas
        })
      })
    })

    try {
      const response = await fetch('/api/academico/frequencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordsToSave)
      })

      if (response.ok) {
        setSalvo(true)
        refetchFreq()
        if (refetchAllFreqs) refetchAllFreqs()
        setTimeout(() => {
          setSalvo(false)
          setTurmaSel(null)
        }, 1200)
      } else {
        const err = await response.json()
        alert('Erro ao salvar: ' + (err.error || response.statusText))
      }
    } catch (error: any) {
      alert('Erro na requisição: ' + error.message)
    }
  }

  // Ação de salvar registros manuais do modal global
  const handleSaveManualRegistro = async () => {
    setSalvandoManual(true)
    const recordsToSave: any[] = []
    
    for (const alunoId of Object.keys(absencesManual)) {
      const aluno = alunos.find(a => String(a.id) === String(alunoId))
      if (!aluno) continue
      
      const turmaObj = turmas.find(t => String(t.id) === String(aluno.turma))
      if (!turmaObj) continue

      const schedule = getTurmaSchedule(turmaObj)
      const studentDay = absencesManual[alunoId] || {}
      
      const tempos: Record<string, PresStatus> = {}
      const existingFreq = allFreqs?.find(f => String(f.aluno_id) === String(aluno.id) && String(f.data).startsWith(registroManualData))

      schedule.tempos.forEach(t => {
        if (studentDay[t.id]) {
           tempos[t.id] = studentDay[t.id]
        } else if (existingFreq && existingFreq.tempos) {
           tempos[t.id] = existingFreq.tempos[t.id] || 'F'
        } else {
           tempos[t.id] = 'F'
        }
      })
      
      const calc = calcularFrequenciaDia(tempos, schedule.segmento)
      
      recordsToSave.push({
        id: existingFreq?.id,
        alunoId: aluno.id,
        turmaId: turmaObj.id,
        data: registroManualData,
        anoLetivo: turmaObj.ano || filtroAno,
        presente: calc.presente,
        justificativa: calc.justificativa,
        tempos: calc.temposEfetivos
      })
    }

    if (recordsToSave.length === 0) {
      setSalvandoManual(false)
      setShowRegistroManualModal(false)
      return
    }

    try {
      const response = await fetch('/api/academico/frequencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordsToSave)
      })

      if (response.ok) {
        if (refetchAllFreqs) refetchAllFreqs()
        setAbsencesManual({})
        setTimeout(() => {
          setSalvandoManual(false)
          setShowRegistroManualModal(false)
        }, 500)
      } else {
        const err = await response.json()
        alert('Erro ao salvar: ' + (err.error || response.statusText))
        setSalvandoManual(false)
      }
    } catch (error: any) {
      alert('Erro na requisição: ' + error.message)
      setSalvandoManual(false)
    }
  }

  // Calc freq geral do aluno na turma (baseado em tempos)
  const calcFreqGeral = useCallback((alunoId: string) => {
    const datasAtivas = new Set<string>()
    Object.values(absences).forEach(studentDays => {
      Object.keys(studentDays).forEach(dia => datasAtivas.add(dia))
    })

    if (datasAtivas.size === 0) return null

    let totalContabilizado = 0
    let faltasContabilizadas = 0
    const schedule = getTurmaSchedule(turmaObj)
    
    datasAtivas.forEach(dia => {
      let tempos: Record<string, PresStatus> = {}
      schedule.tempos.forEach(t => {
        tempos[t.id] = getStatus(alunoId, dia, t.id)
      })
      
      const calc = calcularFrequenciaDia(tempos, schedule.segmento)
      totalContabilizado += calc.totalTemposContabilizados
      faltasContabilizadas += calc.faltasContabilizadas
    })
    
    const presencas = totalContabilizado - faltasContabilizadas
    return totalContabilizado > 0 ? Math.round((presencas / totalContabilizado) * 100) : 100
  }, [absences, turmaObj, getStatus])

  // Obter lista de alunos ausentes no dia (respeitando escopo global ou de turma)
  const getAbsenteesList = useCallback((overrideData?: string) => {
    const targetData = overrideData || dataSel
    const list: any[] = []
    
    // Obter todas as frequências correspondentes à data selecionada
    const freqsNoDia = (allFreqs || []).filter(f => String(f.data).startsWith(targetData))
    
    // Criar um mapeamento rápido de frequência por aluno
    const freqMap = new Map<string, any>()
    freqsNoDia.forEach(f => {
      freqMap.set(String(f.aluno_id), f)
    })

    // Identificar turmas que tiveram chamada lançada no dia (pelo menos um registro na tabela frequencias)
    const turmasComChamada = new Set(freqsNoDia.map(f => String(f.turma_id)))

    // Filtrar alunos baseados na seleção da turma e filtros globais
    const targetAlunos = turmaSel 
      ? alunosDaTurma 
      : alunos.filter((aluno: any) => {
          const tObj = turmas.find(t => String(t.id) === String(aluno.turma))
          if (!tObj) return false
          const matchesSegmento = !filtroSegmento || (tObj as any).dados?.segmento === filtroSegmento
          const matchesBusca = !filtroBusca || tObj.nome.toLowerCase().includes(filtroBusca.toLowerCase())
          return matchesSegmento && matchesBusca
        })

    targetAlunos.forEach((aluno: any) => {
      const tObj = turmas.find(t => String(t.id) === String(aluno.turma))
      if (!tObj) return
      
      const schedule = getTurmaSchedule(tObj)
      const freqRecord = freqMap.get(String(aluno.id))
      
      let tempos: Record<string, PresStatus> = {}
      
      if (freqRecord) {
        // Tem registro no banco para esse dia
        if (freqRecord.tempos) {
          tempos = { ...freqRecord.tempos }
        } else {
          const overallStatus: PresStatus = freqRecord.justificativa === 'Justificada' ? 'J' : (freqRecord.presente ? 'P' : 'F')
          schedule.tempos.forEach(t => {
            tempos[t.id] = overallStatus
          })
        }
      } else {
        // Não tem registro no banco para esse dia.
        const defaultStatus: PresStatus = '-'
        schedule.tempos.forEach(t => {
          tempos[t.id] = defaultStatus
        })
      }

      // Agora calcular se há faltas nos tempos efetivos
      const calc = calcularFrequenciaDia(tempos, schedule.segmento)
      
      const temposFaltosos: string[] = []
      const temposSemRegistro: string[] = []
      schedule.tempos.forEach(t => {
        if (calc.temposEfetivos[t.id] === 'F') {
          temposFaltosos.push(t.id)
        }
        if (calc.temposEfetivos[t.id] === '-') {
          temposSemRegistro.push(t.id)
        }
      })

      // Adicionamos à lista se o aluno tiver alguma Falta Efetiva OU se estiver totalmente Sem Registro
      if (temposFaltosos.length > 0 || temposSemRegistro.length > 0) {
        const totalTempos = schedule.tempos.length
        const isInfantilOuFundI = schedule.segmento === 'Educação Infantil' || schedule.segmento === 'Ensino Fundamental I'
        
        let faltasStr = ''
        const onlySemRegistro = temposSemRegistro.length > 0 && temposFaltosos.length === 0
        
        if (onlySemRegistro) {
          faltasStr = 'Sem Registro'
        } else {
          const isFaltaTotal = isInfantilOuFundI 
            ? !calc.presente 
            : temposFaltosos.length === totalTempos
          faltasStr = isFaltaTotal ? 'Falta Total' : `Parcial (${temposFaltosos.map(i => `${i}ºT`).join(', ')})`
        }

        list.push({
          id: aluno.id,
          nome: aluno.nome,
          turmaId: aluno.turma,
          turmaNome: tObj.nome,
          anoLetivo: String(tObj.ano || ''),
          turno: aluno.turno || tObj.turno || 'N/A',
          segmento: schedule.segmento,
          responsavel_telefone: aluno.responsavel_telefone || aluno.telefone || '',
          faltasStr: faltasStr,
          faltasCount: temposFaltosos.length,
          totalTempos: totalTempos,
          temposFalta: temposFaltosos,
          temposSemRegistro: temposSemRegistro,
          horaRegistro: freqRecord?.dados?.horaRegistro || freqRecord?.horaRegistro || null
        })
      }
    })

    return list
  }, [alunos, turmas, turmaSel, dataSel, filtroSegmento, filtroBusca, allFreqs, alunosDaTurma])

  // Ação de Impressão do Relatório de Faltas
  const handlePrintRelatorio = (overrideList?: any[], overrideData?: string) => {
    const list = overrideList || getAbsenteesList()
    const targetData = overrideData || dataSel
    const scopeName = turmaObj ? `Turma ${turmaObj.nome}` : 'Geral (Toda Escola)'
    
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const formattedDate = new Date(targetData + 'T00:00:00').toLocaleDateString('pt-BR')
    const rowsHtml = list.map(a => {
      const entryTime = a.horaRegistro 
        ? `Entrada: ${a.horaRegistro} (${getTempoEntrada(a.horaRegistro, a.segmento, a.turno) || ''})` 
        : 'Sem Registro'
      return `
        <tr>
          <td style="font-weight: 600;">${a.nome}</td>
          <td>${a.id}</td>
          <td>${a.turmaNome}</td>
          <td>${a.turno}</td>
          <td style="color: #dc2626; font-weight: 700;">${a.faltasStr}</td>
          <td>${entryTime}</td>
        </tr>
      `
    }).join('')

    printWindow.document.write(`
      <html>
        <head>
          <title>Relatório de Ausências - ${formattedDate}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #0f172a; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
            .logo-placeholder { font-weight: 800; font-size: 20px; color: #2563eb; }
            .title { font-size: 24px; font-weight: 800; margin: 0; }
            .meta { font-size: 14px; color: #64748b; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #e2e8f0; padding: 12px 16px; text-align: left; font-size: 13px; }
            th { background-color: #f8fafc; font-weight: 700; color: #475569; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
            .signature-row { display: flex; justify-content: space-between; margin-top: 60px; }
            .signature-box { border-top: 1px solid #cbd5e1; width: 200px; text-align: center; padding-top: 8px; font-size: 12px; color: #475569; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">Relatório de Ausências Diárias</h1>
              <div class="meta">Filtro: ${scopeName} | Data: ${formattedDate}</div>
            </div>
            <div class="logo-placeholder">EDU-IMPACTO App</div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Nome do Aluno</th>
                <th>ID</th>
                <th>Turma</th>
                <th>Turno</th>
                <th>Tempos de Falta</th>
                <th>Registro de Acesso</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 24px;">Nenhuma ausência registrada para este dia.</td></tr>'}
            </tbody>
          </table>

          <div class="signature-row">
            <div class="signature-box">Assinatura do Inspetor</div>
            <div class="signature-box">Assinatura da Direção</div>
          </div>

          <div class="footer">
            Gerado automaticamente em ${new Date().toLocaleString('pt-BR')} pelo ERP EDU-IMPACTO.
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  // Ação de Impressão da Lista de Registro Manual
  const handlePrintRegistroManual = (list: any[], data: string) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const formattedDate = new Date(data + 'T00:00:00').toLocaleDateString('pt-BR')
    
    // Agrupar por turma
    const groupedByTurma = list.reduce((acc: Record<string, any[]>, student) => {
      if (!acc[student.turmaNome]) acc[student.turmaNome] = []
      acc[student.turmaNome].push(student)
      return acc
    }, {})

    let contentHtml = ''

    Object.keys(groupedByTurma).sort().forEach(turmaNome => {
      const turmaStudents = groupedByTurma[turmaNome]
      const tObj = turmas.find(t => t.nome === turmaNome)
      const schedule = tObj ? getTurmaSchedule(tObj) : null
      
      if (!schedule) return

      contentHtml += `
        <div class="turma-section">
          <div class="turma-header">
            <h3>${turmaNome} <span class="badge">${schedule.segmento}</span></h3>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 50%;">Aluno</th>
                <th style="width: 15%;">Matrícula</th>
                ${schedule.tempos.map((t:any) => `<th style="text-align: center;">${t.id}º T</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${turmaStudents.map(a => `
                <tr>
                  <td style="font-weight: 600; font-size: 11px;">${a.nome}</td>
                  <td style="color: #64748b; font-size: 9px;">#${a.id}</td>
                  ${schedule.tempos.map(() => `<td style="text-align: center;"><div class="check-box"></div></td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `
    })

    printWindow.document.write(`
      <html>
        <head>
          <title>Lista de Verificação em Sala - ${formattedDate}</title>
          <style>
            body { font-family: 'Outfit', 'Inter', sans-serif; padding: 20px; color: #0f172a; margin: 0; background: #fff; }
            .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
            .logo-placeholder { font-weight: 900; font-size: 16px; color: #2563eb; letter-spacing: -1px; }
            .title { font-size: 18px; font-weight: 900; margin: 0; letter-spacing: -0.5px; }
            .meta { font-size: 11px; color: #64748b; margin-top: 4px; font-weight: 500; }
            
            .turma-section { margin-bottom: 12px; page-break-inside: avoid; }
            .turma-header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; background: #f8fafc; padding: 6px 10px; border-left: 4px solid #3b82f6; border-radius: 4px; }
            .turma-header h3 { margin: 0; font-size: 13px; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 8px; }
            .badge { font-size: 8px; padding: 2px 6px; background: #e2e8f0; color: #475569; border-radius: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
            
            table { width: 100%; border-collapse: collapse; }
            th, td { border-bottom: 1px solid #f1f5f9; padding: 4px 8px; text-align: left; }
            th { font-weight: 700; color: #64748b; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; background: #fafaf9; }
            tr:nth-child(even) { background-color: #f8fafc; }
            tr:last-child td { border-bottom: none; }
            .check-box { width: 12px; height: 12px; border: 1.5px solid #cbd5e1; border-radius: 2px; display: inline-block; }
            
            .instructions { background: #fef8c4; border: 1px solid #fde047; padding: 10px; border-radius: 6px; margin-bottom: 16px; font-size: 11px; color: #854d0e; display: flex; gap: 10px; align-items: center; }
            .instructions-icon { font-size: 18px; }
            
            .footer { margin-top: 20px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
            .signature-row { display: flex; justify-content: space-around; margin-top: 30px; }
            .signature-box { border-top: 1px solid #cbd5e1; width: 180px; text-align: center; padding-top: 6px; font-size: 10px; color: #475569; font-weight: 600; }
            
            @media print {
              body { padding: 0; }
              @page { margin: 0.8cm; }
              .instructions { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">Lista de Verificação em Sala</h1>
              <div class="meta">Alunos sem identificação na catraca | Data: <strong>${formattedDate}</strong></div>
            </div>
            <div class="logo-placeholder">EDU-IMPACTO</div>
          </div>
          
          <div class="instructions no-print">
            <div class="instructions-icon">📋</div>
            <div>
              <strong>Instruções de Preenchimento:</strong><br>
              Utilize esta folha para verificar a presença física dos alunos listados em sala de aula.<br>
              Assinale <strong>P</strong> (Presença), <strong>F</strong> (Falta) ou <strong>J</strong> (Justificada) nos quadrados correspondentes a cada tempo de aula.
            </div>
          </div>
          
          ${contentHtml}

          <div class="signature-row">
            <div class="signature-box">Assinatura do Inspetor / Monitor</div>
            <div class="signature-box">Assinatura da Coordenação</div>
          </div>
          
          <div class="footer">
            Gerado pelo sistema EDU-IMPACTO em ${new Date().toLocaleString('pt-BR')}
          </div>
          
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  // Ação de Exportar CSV
  const handleExportar = (overrideList?: any[], overrideData?: string) => {
    const list = overrideList || getAbsenteesList()
    const targetData = overrideData || dataSel
    const scopeName = turmaObj ? `Turma ${turmaObj.nome}` : 'Geral (Toda Escola)'
    
    const formattedDate = targetData.replace(/-/g, '')
    const headers = ['Nome', 'ID', 'Turma', 'Turno', 'Tempos com Falta', 'Horário de Entrada', 'Período de Entrada']
    const rows = list.map(a => [
      a.nome,
      a.id,
      a.turmaNome,
      a.turno,
      a.faltasStr,
      a.horaRegistro || 'Sem Registro',
      a.horaRegistro ? (getTempoEntrada(a.horaRegistro, a.segmento, a.turno) || '') : ''
    ])

    let csvContent = '\ufeff' // UTF-8 BOM para Excel em PT-BR
    csvContent += headers.join(';') + '\n'
    rows.forEach(r => {
      csvContent += r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';') + '\n'
    })

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `ausencias_${scopeName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${formattedDate}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Ação de Enviar WhatsApp Notificação
  const handleSendWhatsApp = (aluno: any) => {
    const formattedDate = new Date(dataSel + 'T00:00:00').toLocaleDateString('pt-BR')
    const msg = `Olá! Informamos que o(a) aluno(a) ${aluno.nome} não compareceu à aula no dia ${formattedDate} (${aluno.faltasStr}). Por favor, justifique a ausência. Equipe de Direção EDU-IMPACTO.`
    const phone = aluno.responsavel_telefone || aluno.telefone || ''
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '')
      window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank')
    } else {
      const confirmCopy = window.confirm(`Nenhum telefone cadastrado para o aluno ${aluno.nome}.\n\nDeseja copiar a mensagem de notificação para a área de transferência?\n\n"${msg}"`)
      if (confirmCopy) {
        navigator.clipboard.writeText(msg)
        alert('Mensagem copiada com sucesso!')
      }
    }
  }

  // Abertura do Modal de Relatório com expansão padrão das turmas
  const handleOpenRelatorio = () => {
    setTurmasExpandidas({})
    setRelatorioAno(filtroAno)
    setRelatorioData(dataSel)
    setRelatorioTurno('')
    setShowRelatorioModal(true)
  }

  const toggleTurmaExpandida = (key: string) => {
    setTurmasExpandidas(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  // Render do modal de relatório de ausências
  const renderRelatorioModal = () => {
    if (!showRelatorioModal) return null

    const allAbsentees = getAbsenteesList(relatorioData)
    
    // Filtrar a lista de ausências com base na busca dentro do modal e novos filtros
    const filteredAbsentees = allAbsentees.filter(a => {
      const matchBusca = a.nome.toLowerCase().includes(buscaRelatorio.toLowerCase()) ||
                         a.id.toLowerCase().includes(buscaRelatorio.toLowerCase()) ||
                         a.turmaNome.toLowerCase().includes(buscaRelatorio.toLowerCase())
      
      const matchAno = !relatorioAno || a.anoLetivo === relatorioAno
      const matchTurno = !relatorioTurno || a.turno === relatorioTurno
      
      return matchBusca && matchAno && matchTurno
    })

    const totalFaltasTotal = filteredAbsentees.filter(a => a.faltasStr === 'Falta Total').length
    const totalFaltasParcial = filteredAbsentees.length - totalFaltasTotal
    const scopeName = turmaObj ? `Turma ${turmaObj.nome}` : 'Geral (Toda Escola)'
    const formattedDate = new Date(relatorioData + 'T00:00:00').toLocaleDateString('pt-BR')

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        <div style={{
          background: '#fff',
          borderRadius: '24px',
          maxWidth: '850px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 40px rgba(37, 99, 235, 0.05)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh'
        }}>
          {/* Header do Modal */}
          <div style={{
            padding: '24px 32px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: '#ef4444', color: '#fff', width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '18px', color: '#0f172a' }}>
                  Relatório de Alunos Faltantes
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                  Visualização de faltas em tempo real • {scopeName} • {formattedDate}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowRelatorioModal(false)
                setBuscaRelatorio('')
              }}
              style={{
                border: 'none',
                background: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <X size={20} />
            </button>
          </div>

          {/* Cards de Métricas Rápidas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', padding: '24px 32px 0 32px' }}>
            <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '16px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#991b1b', fontWeight: 700, textTransform: 'uppercase' }}>Faltas Registradas</span>
                <h4 style={{ margin: '2px 0 0 0', fontSize: '20px', fontWeight: 900, color: '#991b1b', fontFamily: 'Outfit, sans-serif' }}>{filteredAbsentees.length}</h4>
              </div>
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertCircle size={18} />
              </div>
            </div>
            <div style={{ background: '#fff1f2', border: '1px solid #ffe4e6', borderRadius: '16px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#be123c', fontWeight: 700, textTransform: 'uppercase' }}>Falta Total (Dia Todo)</span>
                <h4 style={{ margin: '2px 0 0 0', fontSize: '20px', fontWeight: 900, color: '#be123c', fontFamily: 'Outfit, sans-serif' }}>{totalFaltasTotal}</h4>
              </div>
              <div style={{ background: 'rgba(225, 29, 72, 0.1)', color: '#e11d48', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <XCircle size={18} />
              </div>
            </div>
            <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '16px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#92400e', fontWeight: 700, textTransform: 'uppercase' }}>Falta Parcial (Tempos)</span>
                <h4 style={{ margin: '2px 0 0 0', fontSize: '20px', fontWeight: 900, color: '#92400e', fontFamily: 'Outfit, sans-serif' }}>{totalFaltasParcial}</h4>
              </div>
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Info size={18} />
              </div>
            </div>
          </div>

          {/* Barra de Filtros Interna */}
          <div style={{ padding: '12px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* Top Row: All Filters */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
              
              <select
                className="form-input"
                style={{ width: '100px', height: '34px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '12px', padding: '0 8px', margin: 0 }}
                value={relatorioAno}
                onChange={e => setRelatorioAno(e.target.value)}
              >
                <option value="">Anos</option>
                {anosDisponiveis.map(ano => (
                  <option key={ano} value={ano}>{ano}</option>
                ))}
              </select>

              <input
                type="date"
                className="form-input"
                style={{ width: '120px', height: '34px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '12px', padding: '0 8px', margin: 0 }}
                value={relatorioData}
                onChange={e => setRelatorioData(e.target.value)}
              />

              <select
                className="form-input"
                style={{ width: '110px', height: '34px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '12px', padding: '0 8px', margin: 0 }}
                value={relatorioTurno}
                onChange={e => setRelatorioTurno(e.target.value)}
              >
                <option value="">Turnos</option>
                <option value="Matutino">Matutino</option>
                <option value="Vespertino">Vespertino</option>
                <option value="Noturno">Noturno</option>
                <option value="Integral">Integral</option>
              </select>

              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  className="form-input"
                  style={{ paddingLeft: '30px', height: '34px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '12px', width: '100%', margin: 0 }}
                  placeholder="Buscar aluno, ID ou turma..."
                  value={buscaRelatorio}
                  onChange={e => setBuscaRelatorio(e.target.value)}
                />
              </div>

            </div>

            {/* Bottom Row: Actions & Info */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  onClick={() => {
                    const groupedKeys = Object.keys(filteredAbsentees.reduce((acc: Record<string, any>, student) => {
                      acc[student.turmaNome] = true
                      return acc
                    }, {}))
                    const next: Record<string, boolean> = {}
                    groupedKeys.forEach(k => {
                      next[k] = true
                    })
                    setTurmasExpandidas(next)
                  }}
                  style={{ fontSize: '11px', fontWeight: 700, padding: '6px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', color: '#475569', transition: 'all 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                  onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
                >
                  Expandir Todas
                </button>
                <button
                  onClick={() => setTurmasExpandidas({})}
                  style={{ fontSize: '11px', fontWeight: 700, padding: '6px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', color: '#475569', transition: 'all 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                  onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
                >
                  Recolher Todas
                </button>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                Exibindo {filteredAbsentees.length} de {allAbsentees.length} registros
              </div>
            </div>

          </div>

          {/* Tabela / Lista de Faltantes Agrupada por Turma */}
          <div style={{ padding: '20px 32px', overflowY: 'auto', flex: 1 }}>
            {filteredAbsentees.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748b' }}>
                <Users size={48} style={{ color: '#cbd5e1', marginBottom: '12px' }} />
                <p style={{ margin: 0, fontWeight: 600, fontSize: '15px' }}>Nenhum aluno faltoso encontrado.</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>Todos os alunos estão presentes ou não há registros na data selecionada.</p>
              </div>
            ) : (
              Object.entries(
                filteredAbsentees.reduce((acc: Record<string, typeof filteredAbsentees>, student) => {
                  const key = student.turmaNome
                  if (!acc[key]) acc[key] = []
                  acc[key].push(student)
                  return acc
                }, {})
              ).map(([turmaKey, students]) => {
                const firstStudent = students[0]
                const turmaNome = firstStudent.turmaNome
                const turno = firstStudent.turno
                const segmento = firstStudent.segmento
                const isExpanded = !!turmasExpandidas[turmaKey]
                
                return (
                  <div key={turmaKey} style={{ marginBottom: '12px', border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    {/* Header da Turma */}
                    <div 
                      onClick={() => toggleTurmaExpandida(turmaKey)}
                      style={{ 
                        padding: '12px 16px', 
                        background: isExpanded ? '#f8fafc' : '#fff', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        cursor: 'pointer', 
                        borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
                        transition: 'background 0.2s',
                        userSelect: 'none',
                        gap: '12px',
                        flexWrap: 'wrap'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc' }}
                      onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = '#fff' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        {isExpanded ? <ChevronDown size={18} style={{ color: '#475569' }} /> : <ChevronRight size={18} style={{ color: '#475569' }} />}
                        <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{turmaNome}</span>
                        <span style={{ padding: '3px 8px', background: '#e0f2fe', color: '#0369a1', borderRadius: '6px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                          {turno}
                        </span>
                        <span style={{ padding: '3px 8px', background: '#f1f5f9', color: '#475569', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                          {segmento}
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', background: '#f8fafc', padding: '4px 10px', borderRadius: '20px', border: '1px solid #cbd5e1' }}>
                          {students.length} {students.length === 1 ? 'pendência' : 'pendências'}
                        </span>
                      </div>
                    </div>

                    {/* Alunos Faltantes da Turma (Accordion Content) */}
                    {isExpanded && (
                      <div style={{ background: '#fff' }}>
                        {/* Table Header Fictício no topo do Accordion para alinhamento */}
                        <div style={{ display: 'flex', width: '100%', padding: '8px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', gap: '16px' }}>
                          <div style={{ width: '40%', fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Aluno</div>
                          <div style={{ width: '25%', fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Tipo de Falta</div>
                          <div style={{ width: '20%', fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Acesso</div>
                          <div style={{ width: '15%', fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', textAlign: 'right' }}>Ações</div>
                        </div>

                        {students.map((student, idx) => {
                          const isTotal = student.faltasStr === 'Falta Total'
                          const isSemRegistro = student.faltasStr === 'Sem Registro'
                          
                          let bgAvatar = isSemRegistro ? '#f1f5f9' : (isTotal ? '#fee2e2' : '#fef3c7')
                          let textAvatar = isSemRegistro ? '#475569' : (isTotal ? '#ef4444' : '#d97706')
                          
                          let bgBadge = isSemRegistro ? '#f1f5f9' : (isTotal ? '#fee2e2' : '#fef3c7')
                          let textBadge = isSemRegistro ? '#475569' : (isTotal ? '#991b1b' : '#92400e')
                          let borderBadge = isSemRegistro ? '#cbd5e1' : (isTotal ? '#fecaca' : '#fde68a')

                          return (
                            <div 
                              key={student.id} 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                width: '100%', 
                                padding: '12px 16px', 
                                borderBottom: idx === students.length - 1 ? 'none' : '1px solid #f1f5f9',
                                gap: '16px'
                              }}
                            >
                              {/* Aluno Avatar e Informações */}
                              <div style={{ width: '40%', display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                <div style={{ 
                                  width: '32px', 
                                  height: '32px', 
                                  borderRadius: '50%', 
                                  background: bgAvatar, 
                                  color: textAvatar, 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  flexShrink: 0
                                }}>
                                  {getInitials(student.nome)}
                                </div>
                                <div style={{ minWidth: 0, textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={student.nome}>
                                    {student.nome}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#64748b' }}>Matrícula: #{student.id}</div>
                                </div>
                              </div>

                              {/* Tipo de Falta */}
                              <div style={{ width: '25%', display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                                <span style={{
                                  alignSelf: 'flex-start',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  background: bgBadge,
                                  color: textBadge,
                                  border: `1px solid ${borderBadge}`,
                                  whiteSpace: 'nowrap'
                                }}>
                                  {student.faltasStr}
                                </span>
                                {student.temposFalta && student.temposFalta.length > 0 && !isTotal && (
                                  <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 500 }}>
                                    Tempos: {student.temposFalta.join(', ')}º
                                  </span>
                                )}
                              </div>

                              {/* Registro de Catraca / Entrada */}
                              <div style={{ width: '20%', display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                                {student.horaRegistro ? (
                                  <>
                                    <span style={{ fontSize: '12px', color: '#0f172a', fontWeight: 700 }}>
                                      Entrada: {student.horaRegistro}
                                    </span>
                                    {(() => {
                                      const tempoEntrada = getTempoEntrada(student.horaRegistro, student.segmento, student.turno)
                                      return tempoEntrada ? (
                                        <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 800, textTransform: 'uppercase' }}>
                                          Entrou no {tempoEntrada}
                                        </span>
                                      ) : null
                                    })()}
                                  </>
                                ) : (
                                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>
                                    Sem Registro (Catraca)
                                  </span>
                                )}
                              </div>

                              {/* Ações */}
                              <div style={{ width: '15%', display: 'flex', justifyContent: 'flex-end', minWidth: 0 }}>
                                <button
                                  onClick={() => handleSendWhatsApp(student)}
                                  title="Notificar Responsável via WhatsApp"
                                  style={{
                                    border: 'none',
                                    background: '#22c55e',
                                    color: '#fff',
                                    borderRadius: '8px',
                                    padding: '6px 12px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    boxShadow: '0 2px 4px rgba(34, 197, 94, 0.2)',
                                    transition: 'transform 0.15s',
                                    whiteSpace: 'nowrap'
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                  <span>WhatsApp</span>
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          <div style={{
            padding: '20px 32px',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f8fafc'
          }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handlePrintRelatorio(filteredAbsentees, relatorioData)}
                style={{
                  padding: '10px 18px',
                  background: '#fff',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                <Printer size={15} />
                <span>Imprimir PDF</span>
              </button>
              <button
                onClick={() => handleExportar(filteredAbsentees, relatorioData)}
                style={{
                  padding: '10px 18px',
                  background: '#fff',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                <Download size={15} />
                <span>Exportar CSV</span>
              </button>
            </div>
            
            <button
              onClick={() => {
                setShowRelatorioModal(false)
                setBuscaRelatorio('')
              }}
              style={{
                padding: '10px 24px',
                background: '#0f172a',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#1e293b'}
              onMouseLeave={e => e.currentTarget.style.background = '#0f172a'}
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Render do Modal de Registro Manual de Não Identificados
  const renderRegistroManualModal = () => {
    if (!showRegistroManualModal) return null

    const allAbsentees = getAbsenteesList(registroManualData)
    
    // Filtro do próprio modal
    const filteredAbsentees = allAbsentees.filter(a => {
      const matchBusca = a.nome.toLowerCase().includes(buscaRegistroManual.toLowerCase()) ||
                         a.id.toLowerCase().includes(buscaRegistroManual.toLowerCase()) ||
                         a.turmaNome.toLowerCase().includes(buscaRegistroManual.toLowerCase())
      
      const matchAno = !registroManualAno || a.anoLetivo === registroManualAno
      const matchTurno = !registroManualTurno || a.turno === registroManualTurno
      
      return matchBusca && matchAno && matchTurno
    })

    // Agrupar por turma
    const groupedByTurma = filteredAbsentees.reduce((acc: Record<string, any[]>, student) => {
      if (!acc[student.turmaNome]) acc[student.turmaNome] = []
      acc[student.turmaNome].push(student)
      return acc
    }, {})

    // Ordenar turmas alfabeticamente
    const sortedTurmas = Object.keys(groupedByTurma).sort()

    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)',
        zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
      }}>
        <div style={{
          background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '900px', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden'
        }}>
          {/* Header do Modal */}
          <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ background: '#fef3c7', color: '#d97706', width: '48px', height: '48px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={24} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontFamily: 'Outfit, sans-serif', fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>Registrar Não Identificados</h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>Registre faltas ou presenças manualmente para os alunos sem biometria</p>
              </div>
            </div>
            <button onClick={() => setShowRegistroManualModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', color: '#94a3b8' }}>
              <X size={24} />
            </button>
          </div>

          {/* Barra de Filtros Interna */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', width: '100%', background: '#fafaf9' }}>
            <select
              className="form-input"
              style={{ width: '100px', height: '34px', borderRadius: '6px', background: '#fff', border: '1px solid #e2e8f0', fontSize: '12px', padding: '0 8px', margin: 0 }}
              value={registroManualAno}
              onChange={e => setRegistroManualAno(e.target.value)}
            >
              <option value="">Anos</option>
              {anosDisponiveis.map(ano => <option key={ano} value={ano}>{ano}</option>)}
            </select>

            <input
              type="date"
              className="form-input"
              style={{ width: '120px', height: '34px', borderRadius: '6px', background: '#fff', border: '1px solid #e2e8f0', fontSize: '12px', padding: '0 8px', margin: 0 }}
              value={registroManualData}
              onChange={e => setRegistroManualData(e.target.value)}
            />

            <select
              className="form-input"
              style={{ width: '110px', height: '34px', borderRadius: '6px', background: '#fff', border: '1px solid #e2e8f0', fontSize: '12px', padding: '0 8px', margin: 0 }}
              value={registroManualTurno}
              onChange={e => setRegistroManualTurno(e.target.value)}
            >
              <option value="">Turnos</option>
              <option value="Matutino">Matutino</option>
              <option value="Vespertino">Vespertino</option>
              <option value="Noturno">Noturno</option>
              <option value="Integral">Integral</option>
            </select>

            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                className="form-input"
                style={{ paddingLeft: '30px', height: '34px', borderRadius: '6px', background: '#fff', border: '1px solid #e2e8f0', fontSize: '12px', width: '100%', margin: 0 }}
                placeholder="Buscar aluno, ID ou turma..."
                value={buscaRegistroManual}
                onChange={e => setBuscaRegistroManual(e.target.value)}
              />
            </div>
            
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, paddingLeft: '12px' }}>
              Exibindo {filteredAbsentees.length} alunos
            </div>
          </div>

          {/* Lista de Alunos e Tempos */}
          <div style={{ padding: '20px 16px', overflowY: 'auto', flex: 1 }}>
            {filteredAbsentees.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748b' }}>
                <Users size={48} style={{ color: '#cbd5e1', marginBottom: '12px' }} />
                <p style={{ margin: 0, fontWeight: 600, fontSize: '15px' }}>Nenhum aluno faltando registro nesta data.</p>
              </div>
            ) : (
              sortedTurmas.map(turmaNome => {
                const turmaStudents = groupedByTurma[turmaNome]
                const tObj = turmas.find(t => t.nome === turmaNome)
                const schedule = tObj ? getTurmaSchedule(tObj) : null

                if (!schedule) return null

                return (
                  <div key={turmaNome} style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#334155' }}>{turmaNome}</span>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', background: '#e2e8f0', color: '#475569', borderRadius: '12px' }}>
                        {schedule.segmento}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {turmaStudents.map(aluno => {
                        const existingFreq = allFreqs?.find(f => String(f.aluno_id) === String(aluno.id) && String(f.data).startsWith(registroManualData))
                        
                        return (
                          <div key={aluno.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', padding: '12px', border: '1px solid #f1f5f9', borderRadius: '12px', gap: '12px' }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>{aluno.nome}</div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>Matrícula: #{aluno.id}</div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', marginRight: '8px', paddingRight: '12px', borderRight: '1px dashed #cbd5e1' }}>
                                <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8' }}>TODOS</span>
                                <div style={{ display: 'flex', background: '#f8fafc', borderRadius: '6px', padding: '2px', border: '1px solid #e2e8f0' }}>
                                  <button
                                    onClick={() => setAbsencesManual(prev => {
                                      const newData = { ...(prev[aluno.id] || {}) }
                                      schedule.tempos.forEach((t: any) => newData[t.id] = 'P')
                                      return { ...prev, [aluno.id]: newData }
                                    })}
                                    style={{ width: '24px', height: '24px', border: 'none', borderRadius: '4px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', background: 'transparent', color: '#64748b' }}
                                    title="Marcar todos como Presença"
                                  >P</button>
                                  <button
                                    onClick={() => setAbsencesManual(prev => {
                                      const newData = { ...(prev[aluno.id] || {}) }
                                      schedule.tempos.forEach((t: any) => newData[t.id] = 'F')
                                      return { ...prev, [aluno.id]: newData }
                                    })}
                                    style={{ width: '24px', height: '24px', border: 'none', borderRadius: '4px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', background: 'transparent', color: '#64748b' }}
                                    title="Marcar todos como Falta"
                                  >F</button>
                                  <button
                                    onClick={() => setAbsencesManual(prev => {
                                      const newData = { ...(prev[aluno.id] || {}) }
                                      schedule.tempos.forEach((t: any) => newData[t.id] = 'J')
                                      return { ...prev, [aluno.id]: newData }
                                    })}
                                    style={{ width: '24px', height: '24px', border: 'none', borderRadius: '4px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', background: 'transparent', color: '#64748b' }}
                                    title="Marcar todos como Justificado"
                                  >J</button>
                                </div>
                              </div>
                              {schedule.tempos.map((t: any) => {
                                let defaultStatus: PresStatus = '-'
                                if (existingFreq && existingFreq.tempos) {
                                  defaultStatus = existingFreq.tempos[t.id] || '-'
                                } else if (existingFreq && !existingFreq.tempos) {
                                  defaultStatus = existingFreq.justificativa === 'Justificada' ? 'J' : (existingFreq.presente ? 'P' : 'F')
                                }

                                const currentStatus = absencesManual[aluno.id]?.[t.id] || defaultStatus

                                return (
                                  <div key={t.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8' }}>{t.id}º T</span>
                                    <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '6px', padding: '2px' }}>
                                      <button
                                        onClick={() => setAbsencesManual(prev => ({ ...prev, [aluno.id]: { ...(prev[aluno.id] || {}), [t.id]: 'P' } }))}
                                        style={{ width: '28px', height: '24px', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', background: currentStatus === 'P' ? '#22c55e' : 'transparent', color: currentStatus === 'P' ? '#fff' : '#64748b' }}
                                      >
                                        P
                                      </button>
                                      <button
                                        onClick={() => setAbsencesManual(prev => ({ ...prev, [aluno.id]: { ...(prev[aluno.id] || {}), [t.id]: 'F' } }))}
                                        style={{ width: '28px', height: '24px', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', background: currentStatus === 'F' ? '#ef4444' : 'transparent', color: currentStatus === 'F' ? '#fff' : '#64748b' }}
                                      >
                                        F
                                      </button>
                                      <button
                                        onClick={() => setAbsencesManual(prev => ({ ...prev, [aluno.id]: { ...(prev[aluno.id] || {}), [t.id]: 'J' } }))}
                                        style={{ width: '28px', height: '24px', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', background: currentStatus === 'J' ? '#f59e0b' : 'transparent', color: currentStatus === 'J' ? '#fff' : '#64748b' }}
                                      >
                                        J
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer do Modal */}
          <div style={{
            padding: '20px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', flexWrap: 'wrap', gap: '12px'
          }}>
            <button
              onClick={() => handlePrintRegistroManual(filteredAbsentees, registroManualData)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#f8fafc'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff'; }}
            >
              <Printer size={16} />
              Imprimir Ficha
            </button>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowRegistroManualModal(false)}
                style={{ padding: '10px 24px', background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveManualRegistro}
                disabled={salvandoManual}
                style={{
                  padding: '10px 24px', background: salvandoManual ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: salvandoManual ? 'not-allowed' : 'pointer', transition: 'background 0.2s'
                }}
              >
                {salvandoManual ? 'Salvando...' : 'Salvar Registros'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Estatísticas para a visão de Diretor
  const statsGlobal = useMemo(() => {
    const totalTurmas = turmas.length
    const freqs = allFreqs || []
    
    const turmasComChamadaHoje = turmas.filter(t => freqs.some(f => String(f.turma_id) === String(t.id) && String(f.data).startsWith(dataSel))).length
    
    let somaPresenca = 0
    let totalAulas = 0
    
    const grouped = freqs.reduce((acc: any, f) => {
      const key = `${f.data}-${f.turma_id}`
      if (!acc[key]) acc[key] = []
      acc[key].push(f)
      return acc
    }, {})
    
    Object.entries(grouped).forEach(([key, regs]: [string, any]) => {
      const turmaIdStr = key.split('-')[1]
      const tObj = turmas.find(t => String(t.id) === turmaIdStr)
      if (!tObj) return
      
      const schedule = getTurmaSchedule(tObj)
      const totalContabilizadoTurma = 0
      let totalContabilizadoTurmaVal = 0
      let faltasContabilizadasTurma = 0
      
      regs.forEach((r: any) => {
        let tempos: Record<string, PresStatus> = {}
        if (r.tempos) {
          tempos = { ...r.tempos }
        } else {
          const overallStatus: PresStatus = r.justificativa === 'Justificada' ? 'J' : (r.presente ? 'P' : 'F')
          schedule.tempos.forEach(t => {
            tempos[t.id] = overallStatus
          })
        }
        
        const calc = calcularFrequenciaDia(tempos, schedule.segmento)
        totalContabilizadoTurmaVal += calc.totalTemposContabilizados
        faltasContabilizadasTurma += calc.faltasContabilizadas
      })
      
      if (totalContabilizadoTurmaVal > 0) {
        const presencasTurma = totalContabilizadoTurmaVal - faltasContabilizadasTurma
        somaPresenca += (presencasTurma / totalContabilizadoTurmaVal)
        totalAulas++
      }
    })
    
    const mediaPresenca = totalAulas > 0 ? Math.round((somaPresenca / totalAulas) * 100) : 100

    const alunosEmRisco = alunos.filter(a => {
      const tObj = turmas.find(t => t.nome === a.turma || String(t.id) === String(a.turma))
      if (!tObj) return false
      const regs = freqs.filter(f => String(f.turma_id) === String(tObj.id) && String(f.aluno_id) === String(a.id))
      if (!regs.length) return false
      
      const schedule = getTurmaSchedule(tObj)
      let totalContabilizadoT = 0
      let faltasContabilizadasT = 0
      
      regs.forEach((r: any) => {
        let tempos: Record<string, PresStatus> = {}
        if (r.tempos) {
          tempos = { ...r.tempos }
        } else {
          const overallStatus: PresStatus = r.justificativa === 'Justificada' ? 'J' : (r.presente ? 'P' : 'F')
          schedule.tempos.forEach(t => {
            tempos[t.id] = overallStatus
          })
        }
        
        const calc = calcularFrequenciaDia(tempos, schedule.segmento)
        totalContabilizadoT += calc.totalTemposContabilizados
        faltasContabilizadasT += calc.faltasContabilizadas
      })
      
      const presT = totalContabilizadoT - faltasContabilizadasT
      return totalContabilizadoT > 0 ? (Math.round((presT / totalContabilizadoT) * 100) < freqMinima) : false
    }).length

    return { totalTurmas, turmasComChamadaHoje, mediaPresenca, alunosEmRisco }
  }, [turmas, allFreqs, alunos, dataSel])

  // ── HOME (VISÃO DE DIRETOR) ───────────────────────────────────────────────
  if (!turmaSel) {
    const turmasFiltradas = turmas.filter(t =>
      (filtroAno === 'todos' || t.ano.toString() === filtroAno) &&
      (!filtroSegmento || (t as any).dados?.segmento === filtroSegmento) &&
      (!filtroBusca || t.nome.toLowerCase().includes(filtroBusca.toLowerCase()))
    )

    return (
      <div style={{ padding: '32px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>

        {/* Header Ultra Moderno */}
        <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Sparkles size={20} style={{ color: '#2563eb' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '1px' }}>Dashboard de Gestão</span>
            </div>
            <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 32, color: '#0f172a', margin: 0, letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Frequência Escolar
              {(fetchingAllFreqs || fetchingAlunos) && (
                <span style={{ fontSize: '14px', color: '#3b82f6', fontWeight: 600 }}>• Atualizando...</span>
              )}
            </h1>
            <p style={{ fontSize: 14, color: '#64748b', margin: '4px 0 0 0' }}>Monitore a assiduidade e identifique riscos de evasão em tempo real.</p>
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setShowAcessosModal(true)}
              style={{
                height: '42px',
                padding: '0 16px',
                background: 'rgba(6, 182, 212, 0.08)',
                color: '#0891b2',
                border: '1px dashed #06b6d4',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(6, 182, 212, 0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(6, 182, 212, 0.08)'}
            >
              <RefreshCw size={16} />
              <span>Sincronizar Frequência</span>
            </button>
            <button
              onClick={() => setShowRegrasModal(true)}
              style={{
                height: '42px',
                padding: '0 16px',
                background: 'rgba(37, 99, 235, 0.08)',
                color: '#2563eb',
                border: '1px dashed #2563eb',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(37, 99, 235, 0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(37, 99, 235, 0.08)'}
            >
              <Info size={16} />
              <span>Regras de Cálculo</span>
            </button>

            <button 
              onClick={() => {
                setRegistroManualAno(filtroAno)
                setRegistroManualData(dataSel)
                setRegistroManualTurno('')
                setBuscaRegistroManual('')
                setAbsencesManual({})
                setShowRegistroManualModal(true)
              }}
              style={{ height: '42px', padding: '0 20px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(245, 158, 11, 0.2)' }}
            >
              <Users size={16} />
              <span>Registrar Não Identificados</span>
            </button>
          </div>
        </div>

        {/* Cards de Métricas Premium */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
          {/* Card 1 */}
          <div style={{ 
            background: 'linear-gradient(135deg, #fff, rgba(37, 99, 235, 0.02))', 
            padding: '16px 20px', 
            borderRadius: '20px', 
            border: '1px solid #e2e8f0', 
            boxShadow: '0 4px 20px -2px rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            position: 'relative',
            overflow: 'hidden',
            transition: 'transform 0.2s, box-shadow 0.2s',
            cursor: 'pointer'
          }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(37, 99, 235, 0.06)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'none'
              e.currentTarget.style.boxShadow = '0 4px 20px -2px rgba(0,0,0,0.02)'
            }}
          >
            <div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: 0, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total de Turmas</p>
              <h3 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: '4px 0 0 0', fontFamily: 'Outfit,sans-serif', letterSpacing: '-0.02em', lineHeight: 1 }}>{statsGlobal.totalTurmas}</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
              <div style={{ background: 'rgba(37, 99, 235, 0.08)', color: '#2563eb', width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <School size={20} />
              </div>
              <span style={{ fontSize: '9px', fontWeight: 800, color: '#10b981', background: 'rgba(16, 185, 129, 0.08)', padding: '2px 6px', borderRadius: '100px', textTransform: 'uppercase' }}>Ativo</span>
            </div>
          </div>

          {/* Card 2 */}
          <div style={{ 
            background: 'linear-gradient(135deg, #fff, rgba(16, 185, 129, 0.02))', 
            padding: '16px 20px', 
            borderRadius: '20px', 
            border: '1px solid #e2e8f0', 
            boxShadow: '0 4px 20px -2px rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            position: 'relative',
            overflow: 'hidden',
            transition: 'transform 0.2s, box-shadow 0.2s',
            cursor: 'pointer'
          }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(16, 185, 129, 0.06)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'none'
              e.currentTarget.style.boxShadow = '0 4px 20px -2px rgba(0,0,0,0.02)'
            }}
          >
            <div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: 0, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Presença Média</p>
              <h3 style={{ fontSize: '24px', fontWeight: 900, color: '#10b981', margin: '4px 0 0 0', fontFamily: 'Outfit,sans-serif', letterSpacing: '-0.02em', lineHeight: 1 }}>{statsGlobal.mediaPresenca}%</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={20} />
              </div>
              <span style={{ fontSize: '9px', fontWeight: 800, color: '#10b981', background: 'rgba(16, 185, 129, 0.08)', padding: '2px 6px', borderRadius: '100px', textTransform: 'uppercase' }}>Excelente</span>
            </div>
          </div>

          {/* Card 3 */}
          <div style={{ 
            background: 'linear-gradient(135deg, #fff, rgba(245, 158, 11, 0.02))', 
            padding: '16px 20px', 
            borderRadius: '20px', 
            border: '1px solid #e2e8f0', 
            boxShadow: '0 4px 20px -2px rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            position: 'relative',
            overflow: 'hidden',
            transition: 'transform 0.2s, box-shadow 0.2s',
            cursor: 'pointer'
          }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(245, 158, 11, 0.06)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'none'
              e.currentTarget.style.boxShadow = '0 4px 20px -2px rgba(0,0,0,0.02)'
            }}
          >
            <div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: 0, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Chamadas Feitas</p>
              <h3 style={{ fontSize: '24px', fontWeight: 900, color: '#f59e0b', margin: '4px 0 0 0', fontFamily: 'Outfit,sans-serif', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {statsGlobal.turmasComChamadaHoje}
                <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 700 }}>/{statsGlobal.totalTurmas}</span>
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
              <div style={{ background: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b', width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={20} />
              </div>
              <span style={{ fontSize: '9px', fontWeight: 800, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.08)', padding: '2px 6px', borderRadius: '100px', textTransform: 'uppercase' }}>Hoje</span>
            </div>
          </div>

          {/* Card 4 */}
          <div style={{ 
            background: 'linear-gradient(135deg, #fff, rgba(239, 68, 68, 0.02))', 
            padding: '16px 20px', 
            borderRadius: '20px', 
            border: '1px solid #e2e8f0', 
            boxShadow: '0 4px 20px -2px rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            position: 'relative',
            overflow: 'hidden',
            transition: 'transform 0.2s, box-shadow 0.2s',
            cursor: 'pointer'
          }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(239, 68, 68, 0.06)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'none'
              e.currentTarget.style.boxShadow = '0 4px 20px -2px rgba(0,0,0,0.02)'
            }}
          >
            <div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: 0, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Alunos Críticos</p>
              <h3 style={{ fontSize: '24px', fontWeight: 900, color: '#ef4444', margin: '4px 0 0 0', fontFamily: 'Outfit,sans-serif', letterSpacing: '-0.02em', lineHeight: 1 }}>{statsGlobal.alunosEmRisco}</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={20} />
              </div>
              <span style={{ fontSize: '9px', fontWeight: 800, color: '#ef4444', background: 'rgba(239, 68, 68, 0.08)', padding: '2px 6px', borderRadius: '100px', textTransform: 'uppercase' }}>Atenção</span>
            </div>
          </div>
        </div>

        {/* Barra de Ações e Filtros */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '12px', flex: 1 }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
              <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input 
                className="form-input" 
                style={{ paddingLeft: '42px', height: '44px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }} 
                placeholder="Pesquisar turma por nome..." 
                value={filtroBusca} 
                onChange={e => setFiltroBusca(e.target.value)} 
              />
            </div>
            
            <div style={{ width: '160px' }}>
              <select className="form-input" style={{ height: '44px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }} value={filtroAno} onChange={e => setFiltroAno(e.target.value)}>
                <option value="todos">Anos Letivos</option>
                {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

             <div style={{ width: '200px' }}>
               <select className="form-input" style={{ height: '44px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }} value={filtroSegmento} onChange={e => setFiltroSegmento(e.target.value)}>
                 <option value="">Todos Segmentos</option>
                 {cfgNiveisEnsino?.map((n: any) => (
                   <option key={n.id} value={n.nome}>{n.nome}</option>
                 ))}
               </select>
             </div>

             <div style={{ width: '160px' }}>
               <input 
                 type="date"
                 className="form-input" 
                 style={{ height: '44px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', fontWeight: 600, fontSize: '13px' }} 
                 value={dataSel} 
                 onChange={e => setDataSel(e.target.value)} 
               />
             </div>
           </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Filtrando: </span>
            <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 700 }}>{turmasFiltradas.length} turmas</span>
          </div>
        </div>

        {/* Grid de Turmas Ultra Moderno */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 4px 6px -2px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Turma</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Segmento</th>
                  <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Alunos</th>
                  <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Frequência</th>
                  <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status na Data</th>
                  <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {loadingAllFreqs || loadingAlunos ? (
                  <TableSkeleton rows={5} cols={6} />
                ) : (
                   turmasFiltradas.map(turma => {
                    const freqs = allFreqs || []
                    const regs = freqs.filter(f => String(f.turma_id) === String(turma.id))
                    const temHoje = regs.some(f => String(f.data).startsWith(dataSel))
                    
                    const schedule = getTurmaSchedule(turma)
                    let totalContabilizadoTurma = 0
                    let faltasContabilizadasTurma = 0
                    
                    regs.forEach((r: any) => {
                      let tempos: Record<string, any> = {}
                      if (r.tempos) {
                        tempos = { ...r.tempos }
                      } else {
                        const overallStatus = r.justificativa === 'Justificada' ? 'J' : (r.presente ? 'P' : 'F')
                        schedule.tempos.forEach((t: any) => {
                          tempos[t.id] = overallStatus
                        })
                      }
                      
                      const calc = calcularFrequenciaDia(tempos, schedule.segmento)
                      totalContabilizadoTurma += calc.totalTemposContabilizados
                      faltasContabilizadasTurma += calc.faltasContabilizadas
                    })
                    
                    const presencasTurma = totalContabilizadoTurma - faltasContabilizadasTurma
                    const pctPresenca = totalContabilizadoTurma > 0 ? Math.round((presencasTurma / totalContabilizadoTurma) * 100) : 100
                    const isLow = pctPresenca < freqMinima

                  const totalAlunosTurma = alunos.filter((a: any) => String(a.turma) === String(turma.id)).length

                  return (
                    <tr key={turma.id} style={{ background: '#fff', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                      <td style={{ padding: '16px', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', borderLeft: '1px solid #f1f5f9', borderTopLeftRadius: '10px', borderBottomLeftRadius: '10px' }}>
                        <div>
                          <p style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', margin: 0 }}>{turma.nome}</p>
                          <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>{turma.serie} • {turma.turno}</p>
                        </div>
                      </td>
                      <td style={{ padding: '12px', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: '13px', color: '#0f172a' }}>{(turma as any).dados?.segmento || '--'}</span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 600 }}>{totalAlunosTurma}</span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                          <span style={{ 
                            fontSize: '13px', 
                            fontWeight: 700, 
                            color: isLow ? '#ef4444' : '#10b981',
                            background: isLow ? '#fee2e2' : '#dcfce7',
                            padding: '4px 8px',
                            borderRadius: '6px'
                          }}>
                            {pctPresenca}%
                          </span>
                          <div style={{ width: '60px', height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${pctPresenca}%`, height: '100%', background: isLow ? '#ef4444' : '#10b981', borderRadius: '3px' }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                        {temHoje ? (
                          <span style={{ padding: '4px 10px', background: '#dcfce7', color: '#15803d', borderRadius: '20px', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={12} strokeWidth={3} /> Realizada
                          </span>
                        ) : (
                          <span style={{ padding: '4px 10px', background: '#fef3c7', color: '#b45309', borderRadius: '20px', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <AlertCircle size={12} strokeWidth={3} /> Pendente
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9', borderTopRightRadius: '10px', borderBottomRightRadius: '10px' }}>
                        <button 
                          onClick={() => setTurmaSel(turma.id)}
                          style={{ background: 'transparent', border: 'none', color: '#2563eb', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          Abrir <ChevronRight size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        {renderRegrasModal(showRegrasModal, () => setShowRegrasModal(false))}
        {renderRelatorioModal()}
        {renderRegistroManualModal()}
        <SyncAcessosModal 
          isOpen={showAcessosModal} 
          onClose={() => setShowAcessosModal(false)}
          initialStartDate={today}
          initialEndDate={today}
        />
      </div>
    )
  }

  // ── VISTA INTERNA (LANÇAMENTO DE FALTAS) ──────────────────────────────────
  const schedule = getTurmaSchedule(turmaObj)
  
  const datasAtivasDaTurma = new Set<string>()
  Object.values(absences).forEach(studentDays => {
    Object.keys(studentDays).forEach(dia => datasAtivasDaTurma.add(dia))
  })

  // Calcular número de faltas individuais no dia selecionado e alunos com pelo menos uma falta
  let totalFaltasDia = 0
  let alunosComFalta = 0
  alunosDaTurma.forEach(a => {
    let studentHasFalta = false
    schedule.tempos.forEach(t => {
      const status = getStatus(a.id, dataSel, t.id)
      if (status === 'F') {
        totalFaltasDia++
        studentHasFalta = true
      }
    })
    if (studentHasFalta) alunosComFalta++
  })

  return (
    <div style={{ padding: '32px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>

      {/* Header Ultra Moderno */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button 
            onClick={() => setTurmaSel(null)} 
            style={{ border: '1px solid #e2e8f0', background: '#fff', width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0f172a', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ padding: '4px 8px', background: '#e0f2fe', color: '#0369a1', borderRadius: '6px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Gestão de Classe</span>
              <span style={{ padding: '4px 8px', background: '#2563eb', color: '#fff', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>{turmaSel}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 28, color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>Diário de Frequência</h1>
              <button
                onClick={() => setShowRegrasModal(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(37, 99, 235, 0.08)',
                  color: '#2563eb',
                  border: '1px dashed #2563eb',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  alignSelf: 'center'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(37, 99, 235, 0.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(37, 99, 235, 0.08)'}
              >
                <Info size={14} />
                Regras de Cálculo
              </button>
            </div>
            <p style={{ fontSize: 13, color: '#64748b', margin: '2px 0 0 0', fontWeight: 500 }}>
              Segmento: <strong style={{ color: '#2563eb' }}>{schedule.segmento}</strong> ({schedule.tempos.length} Tempos). Clique nas caixas para alternar (P / F / J).
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Faltas no Dia</span>
            <p style={{ fontSize: '24px', fontWeight: 900, color: '#ef4444', margin: 0, fontFamily: 'Outfit,sans-serif' }}>
              {totalFaltasDia} <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 700 }}>({alunosComFalta} {alunosComFalta === 1 ? 'aluno' : 'alunos'})</span>
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={handleSave}
              style={{ height: '44px', padding: '0 24px', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)', transition: 'transform 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
            >
              {salvo ? <CheckCircle size={18} /> : <Save size={18} />}
              {salvo ? 'Salvo com Sucesso!' : 'Salvar Registros'}
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar Premium */}
      <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Calendário */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <Calendar size={18} style={{ color: '#64748b' }} />
            <input 
              className="form-input" 
              style={{ background: 'transparent', border: 'none', padding: 0, height: 'auto', fontWeight: 700, fontSize: '14px', color: '#0f172a', outline: 'none' }} 
              type="date" 
              value={dataSel} 
              onChange={e => setDataSel(e.target.value)} 
            />
          </div>

          {/* Busca Aluno */}
          <div style={{ position: 'relative', width: '250px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              className="form-input" 
              style={{ paddingLeft: '40px', height: '42px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }} 
              placeholder="Buscar aluno..." 
              value={buscaAluno} 
              onChange={e => setBuscaAluno(e.target.value)} 
            />
          </div>
        </div>

        {/* Ações da Turma */}
        <div style={{ display: 'flex', gap: '8px' }}>

          <button 
            onClick={() => handleExportar()}
            style={{ height: '42px', padding: '0 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' }}
          >
            <Download size={14} />
            <span>Exportar</span>
          </button>
        </div>

        {/* Legenda Premium */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', background: '#f8fafc', padding: '10px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Legenda:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '3px' }}></span>
            <span style={{ fontSize: '12px', color: '#0f172a', fontWeight: 600 }}>Presença (P)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '3px' }}></span>
            <span style={{ fontSize: '12px', color: '#0f172a', fontWeight: 600 }}>Falta (F)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', background: '#f59e0b', borderRadius: '3px' }}></span>
            <span style={{ fontSize: '12px', color: '#0f172a', fontWeight: 600 }}>Justificada (J)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px', borderLeft: '1px solid #cbd5e1', paddingLeft: '12px' }}>
            <span style={{ width: '12px', height: '12px', background: 'transparent', border: '1px dashed #cbd5e1', borderRadius: '3px' }}></span>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Sem registro (-)</span>
          </div>
        </div>
      </div>

      {/* Tabela de Grade Ultra Moderna */}
      <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 4px 6px -2px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Aluno</th>
                <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', width: '150px' }}>Freq. Total</th>
                <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Faltas</th>
                <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Justificadas</th>
                {diasPeriodo.map(dia => {
                  const dateObj = new Date(dia + 'T00:00:00')
                  const diaSemana = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
                  return (
                    <th key={dia} style={{ textAlign: 'center', padding: '12px', fontSize: '12px', color: '#64748b', fontWeight: 600, minWidth: '320px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ textTransform: 'uppercase', fontSize: '11px', color: '#94a3b8' }}>{diaSemana}</span>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{dia.split('-')[2]}/{dia.split('-')[1]}</span>
                        </div>
                        {/* Ações em lote para a turma */}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => {
                              alunosFiltrados.forEach(a => {
                                schedule.tempos.forEach(t => setStatus(a.id, dia, t.id, 'P'))
                              })
                            }}
                            style={{ padding: '4px 8px', fontSize: '10px', fontWeight: 700, background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#059669'}
                            onMouseLeave={e => e.currentTarget.style.background = '#10b981'}
                          >
                            Presença Geral (Turma)
                          </button>
                          <button
                            onClick={() => {
                              alunosFiltrados.forEach(a => {
                                schedule.tempos.forEach(t => setStatus(a.id, dia, t.id, 'F'))
                              })
                            }}
                            style={{ padding: '4px 8px', fontSize: '10px', fontWeight: 700, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#dc2626'}
                            onMouseLeave={e => e.currentTarget.style.background = '#ef4444'}
                          >
                            Falta Geral (Turma)
                          </button>
                        </div>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {loadingFreqTurma ? (
                <TableSkeleton rows={5} cols={4 + diasPeriodo.length} />
              ) : alunosFiltrados.map((aluno: any) => {
                const freqGeral = calcFreqGeral(aluno.id)
                const isLow = freqGeral !== null && freqGeral < freqMinima
                
                // Calcular faltas e justificativas a nível de tempos usando os dias ativos
                let totalFaltas = 0
                let totalJustificadas = 0
                datasAtivasDaTurma.forEach(dia => {
                  let tempos: Record<string, PresStatus> = {}
                  schedule.tempos.forEach(t => {
                    tempos[t.id] = getStatus(aluno.id, dia, t.id)
                  })
                  
                  const calc = calcularFrequenciaDia(tempos, schedule.segmento)
                  totalFaltas += calc.faltasContabilizadas
                  totalJustificadas += calc.justificadasContabilizadas
                })

                return (
                  <tr key={aluno.id} style={{ background: '#fff', transition: 'all 0.2s' }}>
                    {/* Nome do Aluno */}
                    <td style={{ padding: '16px', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', borderLeft: '1px solid #f1f5f9', borderTopLeftRadius: '10px', borderBottomLeftRadius: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', color: '#0369a1', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px' }}>
                          {getInitials(aluno.nome)}
                        </div>
                        <div>
                          <p style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', margin: 0 }}>{aluno.nome}</p>
                          <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>ID: {aluno.id} • {turmaObj?.nome} ({turmaObj?.turno})</p>
                        </div>
                      </div>
                    </td>

                    {/* Freq. Total */}
                    <td style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                      {freqGeral !== null ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                          <span style={{ 
                            fontSize: '13px', 
                            fontWeight: 700, 
                            color: isLow ? '#ef4444' : '#10b981',
                            background: isLow ? '#fee2e2' : '#dcfce7',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}>
                            {freqGeral}%
                          </span>
                          <div style={{ width: '60px', height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${freqGeral}%`, height: '100%', background: isLow ? '#ef4444' : '#10b981', borderRadius: '3px' }} />
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>--</span>
                      )}
                    </td>

                    {/* Faltas */}
                    <td style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: '13px', color: totalFaltas > 5 ? '#ef4444' : '#0f172a', fontWeight: 600 }}>{totalFaltas}</span>
                    </td>

                    {/* Justificadas */}
                    <td style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: '13px', color: '#64748b' }}>{totalJustificadas}</span>
                    </td>

                    {/* Dias de Frequência (com controle de tempos) */}
                    {diasPeriodo.map(dia => {
                      return (
                        <td 
                          key={dia} 
                          style={{ padding: '6px', textAlign: 'center', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9', borderTopRightRadius: '10px', borderBottomRightRadius: '10px' }}
                        >
                          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', alignItems: 'center' }}>
                            {/* Tempos individuais */}
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                              {schedule.tempos.map(tempo => {
                                const status = getStatus(aluno.id, dia, tempo.id)
                                const cfg = S_CONFIG[status]
                                
                                return (
                                  <div key={tempo.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                    <button
                                      onClick={() => {
                                        const nextStatus = status === '-' ? 'P' : (status === 'P' ? 'F' : (status === 'F' ? 'J' : '-'))
                                        setStatus(aluno.id, dia, tempo.id, nextStatus)
                                      }}
                                      title={`${tempo.label}: ${tempo.horario}`}
                                      style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '8px',
                                        border: `1px solid ${cfg.border}`,
                                        background: cfg.bg,
                                        color: cfg.color,
                                        fontWeight: 800,
                                        fontSize: '11px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                                        boxShadow: `0 2px 4px ${cfg.glow}`,
                                        position: 'relative'
                                      }}
                                      onMouseEnter={e => {
                                        e.currentTarget.style.transform = 'scale(1.1)';
                                        e.currentTarget.style.boxShadow = `0 4px 6px ${cfg.glow}`;
                                      }}
                                      onMouseLeave={e => {
                                        e.currentTarget.style.transform = 'scale(1)';
                                        e.currentTarget.style.boxShadow = `0 2px 4px ${cfg.glow}`;
                                      }}
                                    >
                                      {cfg.label}
                                    </button>
                                    <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 700 }}>{tempo.id}º</span>
                                  </div>
                                )
                              })}
                            </div>

                            {/* Ações rápidas */}
                            <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <button
                                title="Marcar presença em todos os tempos"
                                onClick={() => {
                                  schedule.tempos.forEach(t => setStatus(aluno.id, dia, t.id, 'P'))
                                }}
                                style={{ fontSize: '9px', fontWeight: 800, padding: '3px 6px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.15s' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#dcfce7'}
                                onMouseLeave={e => e.currentTarget.style.background = '#f0fdf4'}
                              >
                                P. Geral
                              </button>
                              <button
                                title="Marcar falta em todos os tempos"
                                onClick={() => {
                                  schedule.tempos.forEach(t => setStatus(aluno.id, dia, t.id, 'F'))
                                }}
                                style={{ fontSize: '9px', fontWeight: 800, padding: '3px 6px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.15s' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
                                onMouseLeave={e => e.currentTarget.style.background = '#fef2f2'}
                              >
                                F. Geral
                              </button>
                            </div>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      {renderRegrasModal(showRegrasModal, () => setShowRegrasModal(false))}
      {renderRelatorioModal()}
      {renderRegistroManualModal()}
      <SyncAcessosModal 
        isOpen={showAcessosModal} 
        onClose={() => setShowAcessosModal(false)}
        initialStartDate={today}
        initialEndDate={today}
        onSuccess={() => {
          if (refetchAllFreqs) refetchAllFreqs()
          if (turmaSel && refetchFreq) refetchFreq()
        }}
      />
    </div>
  )
}
