'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeft, Save, Plus, Trash2, BookOpen, Calendar, Users, 
  Upload, Sparkles, CheckCircle, AlertTriangle, ChevronUp, ChevronDown, Check, Layers, Info, X 
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/context'
import { DEFAULT_PROVA_INSTRUCOES } from '@/lib/utils'
import { 
  SIMULADOS_PRESETS, AREA_CONFIG, detectSeriePattern, 
  buildAssignmentsFromPreset, getPresetGroupsByArea, getPresetAllFallbackNomes, SeriePreset 
} from '@/lib/simuladosPresets'

export default function EditarSimuladoUploadPage() {
  const router = useRouter()
  const params = useParams() as { id: string }
  const { currentUser } = useApp()
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [successModal, setSuccessModal] = useState(false)
  const [assignmentToDelete, setAssignmentToDelete] = useState<any | null>(null)

  // Form state
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [dataAplicacao, setDataAplicacao] = useState('')
  const [bimestreId, setBimestreId] = useState('')
  const [series, setSeries] = useState<string[]>([])
  const [instrucoes, setInstrucoes] = useState('')
  const [dataLimiteUpload, setDataLimiteUpload] = useState('')
  const [valor, setValor] = useState('')

  // Assignments per teacher/discipline
  const [assignments, setAssignments] = useState<any[]>([])

  // Preset modal state
  const [showPresetModal, setShowPresetModal] = useState(false)
  const [selectedPresetKey, setSelectedPresetKey] = useState<'fund2_8_9' | 'em_1_2' | 'em_3'>('em_1_2')
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([])
  const [presetMode, setPresetMode] = useState<'replace' | 'append'>('replace')

  // Loaded data
  const [bimestres, setBimestres] = useState<any[]>([])
  const [disciplinas, setDisciplinas] = useState<any[]>([])
  const [professores, setProfessores] = useState<any[]>([])

  const seriesOptions = ['1º Ano EF', '2º Ano EF', '3º Ano EF', '4º Ano EF', '5º Ano EF', '6º Ano EF', '7º Ano EF', '8º Ano EF', '9º Ano EF', '1ª Série EM', '2ª Série EM', '3ª Série EM']

  useEffect(() => {
    async function load() {
      setInitialLoading(true)
      try {
        const [bimRes, discRes, provaRes] = await Promise.all([
          (supabase as any).from('simulados_bimestres').select('*').eq('status', 'ativo').order('nome'),
          (supabase as any).from('simulados_disciplinas').select('*').order('nome'),
          (supabase as any).from('simulados_upload').select('*, simulados_upload_requisicoes(*)').eq('id', params.id).single()
        ])
        
        setBimestres(bimRes.data || [])
        setDisciplinas(discRes.data || [])
        
        const provaData = provaRes.data
        if (provaData) {
          setTitulo(provaData.titulo || '')
          setDescricao(provaData.descricao || '')
          setDataAplicacao(provaData.data_aplicacao || '')
          setBimestreId(provaData.id_bimestre || '')
          setSeries(provaData.series || [])
          setInstrucoes(provaData.instrucoes || DEFAULT_PROVA_INSTRUCOES)
          setDataLimiteUpload(provaData.data_limite_upload || '')
          if (provaData.valor) setValor(provaData.valor.toString())
          
          if (provaData.simulados_upload_requisicoes) {
            let reqs = [...provaData.simulados_upload_requisicoes]
            const savedOrder = provaData.config_estudio?.ordem_requisicoes || []
            if (savedOrder.length > 0) {
              reqs.sort((a: any, b: any) => {
                const idxA = savedOrder.indexOf(a.id)
                const idxB = savedOrder.indexOf(b.id)
                if (idxA !== -1 && idxB !== -1) return idxA - idxB
                if (idxA !== -1) return -1
                if (idxB !== -1) return 1
                return 0
              })
            } else if (provaData.config_estudio?.ordem_disciplinas?.length > 0) {
              const savedDiscOrder = provaData.config_estudio.ordem_disciplinas
              reqs.sort((a: any, b: any) => {
                const idxA = savedDiscOrder.indexOf(a.id_disciplina)
                const idxB = savedDiscOrder.indexOf(b.id_disciplina)
                if (idxA !== -1 && idxB !== -1) return idxA - idxB
                if (idxA !== -1) return -1
                if (idxB !== -1) return 1
                return 0
              })
            }

            setAssignments(reqs.map((r: any) => ({
              id: r.id || (Date.now().toString() + Math.random()),
              reqId: r.id,
              disciplinaId: r.id_disciplina || '',
              disciplinaNome: r.disciplina_nome || '',
              professorId: r.id_professor || '',
              professorNome: r.professor_nome || '',
              qtdQuestoes: r.qtd_questoes || 10,
              status: r.status
            })))
          }
        }

        const res = await fetch('/api/configuracoes/usuarios?type=colaboradores&limit=1000')
        if (res.ok) {
          const json = await res.json()
          const data = json.data || json
          setProfessores(data.filter((u: any) => u.perfil === 'Professor' && u.status === 'ativo'))
        }
      } catch (e) {
        console.error(e)
        alert('Erro ao carregar dados do simulado.')
      } finally {
        setInitialLoading(false)
      }
    }
    load()
  }, [params.id])

  const toggleSerie = (s: string) => setSeries(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])

  const moveAssignment = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= assignments.length) return
    setAssignments(prev => {
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item)
      return next
    })
  }

  const handleOpenPresetModal = () => {
    const detected = detectSeriePattern(series)
    const activeKey = detected || selectedPresetKey || 'em_1_2'
    setSelectedPresetKey(activeKey)
    setSelectedDisciplines(getPresetAllFallbackNomes(activeKey))
    setShowPresetModal(true)
  }

  const handleSelectPresetTab = (key: 'fund2_8_9' | 'em_1_2' | 'em_3') => {
    setSelectedPresetKey(key)
    setSelectedDisciplines(getPresetAllFallbackNomes(key))
  }

  const toggleDiscipline = (fallbackNome: string) => {
    setSelectedDisciplines(prev => 
      prev.includes(fallbackNome) 
        ? prev.filter(x => x !== fallbackNome) 
        : [...prev, fallbackNome]
    )
  }

  const toggleArea = (areaDisciplinas: any[]) => {
    const areaNomes = areaDisciplinas.map((d: any) => d.fallbackNome)
    const allSelected = areaNomes.every(n => selectedDisciplines.includes(n))
    if (allSelected) {
      setSelectedDisciplines(prev => prev.filter(n => !areaNomes.includes(n)))
    } else {
      setSelectedDisciplines(prev => Array.from(new Set([...prev, ...areaNomes])))
    }
  }

  const selectAllDisciplines = () => {
    setSelectedDisciplines(getPresetAllFallbackNomes(selectedPresetKey))
  }

  const deselectAllDisciplines = () => {
    setSelectedDisciplines([])
  }

  const handleApplyPreset = () => {
    if (selectedDisciplines.length === 0) {
      alert('Selecione pelo menos uma disciplina para carregar.')
      return
    }

    const newItems = buildAssignmentsFromPreset(selectedPresetKey, disciplinas, professores, selectedDisciplines)
    if (newItems.length === 0) {
      alert('Nenhuma disciplina correspondente foi encontrada no cadastro.')
      return
    }

    if (presetMode === 'replace') {
      // In replace mode in edit, existing items lose their reqId so DB sync must handle deletion cleanly
      setAssignments(newItems.map(item => ({ ...item, reqId: null, status: 'pendente' })))
    } else {
      setAssignments(prev => {
        const existingDiscIds = new Set(prev.map(a => a.disciplinaId).filter(Boolean))
        const existingDiscNames = new Set(prev.map(a => (a.disciplinaNome || '').toLowerCase()).filter(Boolean))
        const toAdd = newItems
          .filter(item => 
            (!item.disciplinaId || !existingDiscIds.has(item.disciplinaId)) &&
            (!item.disciplinaNome || !existingDiscNames.has(item.disciplinaNome.toLowerCase()))
          )
          .map(item => ({ ...item, reqId: null, status: 'pendente' }))
        return [...prev, ...toAdd]
      })
    }
    setShowPresetModal(false)
  }

  const addAssignment = () => setAssignments(prev => [...prev, {
    id: Date.now().toString() + Math.random(), reqId: null, disciplinaId: '', disciplinaNome: '', professorId: '', professorNome: '', qtdQuestoes: 10, status: 'pendente'
  }])

  const removeAssignment = (id: string) => {
    setAssignments(prev => prev.filter(a => a.id !== id))
  }

  const updateAssignment = (id: string, field: string, value: any) => {
    setAssignments(prev => prev.map(a => {
      if (a.id !== id) return a
      
      const updated: any = { ...a, [field]: value }
      if (field === 'disciplinaId') {
        const disc = disciplinas.find(d => d.id === value)
        if (disc) {
          updated.disciplinaNome = disc.nome
          if (disc.quantidade_questoes) updated.qtdQuestoes = disc.quantidade_questoes
          // Auto-populate professor
          let ids: string[] = []
          if (Array.isArray(disc.professores_ids)) ids = disc.professores_ids
          else if (typeof disc.professores_ids === 'string') {
            try { ids = JSON.parse(disc.professores_ids) } catch {}
          } else if (disc.id_professor) ids = [disc.id_professor]
          if (ids.length > 0) {
            const prof = professores.find(p => ids.includes(p.id))
            if (prof) { updated.professorId = prof.id; updated.professorNome = prof.nome }
          }
        }
      }
      if (field === 'professorId') {
        const prof = professores.find(p => p.id === value)
        if (prof) updated.professorNome = prof.nome
      }
      return updated
    }))
  }

  const handleSave = async () => {
    if (!titulo.trim()) { alert('Informe o título do simulado.'); return }
    if (!bimestreId) { alert('Selecione o bimestre do simulado.'); return }
    if (series.length === 0) { alert('Selecione ao menos uma série.'); return }
    if (assignments.some(a => !a.disciplinaId || !a.professorId)) {
      alert('Preencha disciplina e professor em todas as atribuições.'); return
    }

    setLoading(true)
    try {
      // Get current requisitions from DB to know what to delete
      const { data: existingReqs } = await (supabase as any)
        .from('simulados_upload_requisicoes')
        .select('id, id_disciplina, disciplina_nome, id_professor, status')
        .eq('id_simulado_upload', params.id)
      
      const idsToKeep = assignments.filter(a => a.reqId).map(a => a.reqId)
      const reqsToDelete = (existingReqs || []).filter((r: any) => !idsToKeep.includes(r.id))
      
      if (reqsToDelete.length > 0) {
        await (supabase as any).from('simulados_upload_requisicoes').delete().in('id', reqsToDelete.map((r: any) => r.id))
      }

      // Fetch current questoes_json and filter out questions belonging to deleted requisitions/disciplines
      const { data: currentSimulado } = await (supabase as any)
        .from('simulados_upload')
        .select('questoes_json')
        .eq('id', params.id)
        .single()

      let currentQuestions = Array.isArray(currentSimulado?.questoes_json) ? currentSimulado.questoes_json : []

      if (reqsToDelete.length > 0 && currentQuestions.length > 0) {
        const deletedReqIds = new Set(reqsToDelete.map((r: any) => r.id))
        const deletedDiscIds = new Set(reqsToDelete.map((r: any) => r.id_disciplina).filter(Boolean))
        const deletedDiscNames = new Set(reqsToDelete.map((r: any) => (r.disciplina_nome || '').trim().toLowerCase()).filter(Boolean))

        currentQuestions = currentQuestions.filter((q: any) => {
          if (q.id_requisicao && deletedReqIds.has(q.id_requisicao)) return false
          if (q.id_disciplina && deletedDiscIds.has(q.id_disciplina)) return false
          if (q.disciplina_id && deletedDiscIds.has(q.disciplina_id)) return false
          const qDiscName = (q.disciplina_nome || q.disciplina || '').trim().toLowerCase()
          if (qDiscName && deletedDiscNames.has(qDiscName)) return false
          return true
        })
      }

      // 1. Update or Insert requisitions and track their ordered IDs
      const orderedReqIds: string[] = []
      for (const a of assignments) {
        const reqPayload = {
          id_simulado_upload: params.id,
          id_disciplina: a.disciplinaId,
          disciplina_nome: a.disciplinaNome,
          id_professor: a.professorId,
          professor_nome: a.professorNome,
          qtd_questoes: Number.isNaN(a.qtdQuestoes) ? 10 : a.qtdQuestoes,
        }
        
        if (a.reqId) {
          await (supabase as any).from('simulados_upload_requisicoes').update(reqPayload).eq('id', a.reqId)
          orderedReqIds.push(a.reqId)
        } else {
          const { data: newReq, error: insertError } = await (supabase as any)
            .from('simulados_upload_requisicoes')
            .insert([{ ...reqPayload, status: 'pendente' }])
            .select('id')
            .single()
          if (insertError) throw insertError
          if (newReq?.id) {
            orderedReqIds.push(newReq.id)
            a.reqId = newReq.id
          }
        }
      }

      // 2. Re-order currentQuestions based on the new discipline/requisition positions
      const reqOrderMap = new Map<string, number>()
      assignments.forEach((a, index) => {
        if (a.reqId) reqOrderMap.set(a.reqId, index)
        if (a.disciplinaId) reqOrderMap.set(a.disciplinaId, index)
      })

      if (currentQuestions.length > 0) {
        currentQuestions.sort((qa: any, qb: any) => {
          const orderA = (qa.id_requisicao && reqOrderMap.has(qa.id_requisicao))
            ? reqOrderMap.get(qa.id_requisicao)!
            : (qa.id_disciplina && reqOrderMap.has(qa.id_disciplina))
              ? reqOrderMap.get(qa.id_disciplina)!
              : (qa.disciplina_id && reqOrderMap.has(qa.disciplina_id))
                ? reqOrderMap.get(qa.disciplina_id)!
                : 999
          const orderB = (qb.id_requisicao && reqOrderMap.has(qb.id_requisicao))
            ? reqOrderMap.get(qb.id_requisicao)!
            : (qb.id_disciplina && reqOrderMap.has(qb.id_disciplina))
              ? reqOrderMap.get(qb.id_disciplina)!
              : (qb.disciplina_id && reqOrderMap.has(qb.disciplina_id))
                ? reqOrderMap.get(qb.disciplina_id)!
                : 999
          return orderA - orderB
        })

        let numCounter = 1
        currentQuestions = currentQuestions.map((q: any) => {
          const isApoio = q.tipo_questao === 'texto_apoio' || q.is_texto_apoio || q.isTextoApoio
          return {
            ...q,
            numero: isApoio ? 0 : numCounter++
          }
        })
      }

      const newQuestoesCount = currentQuestions.filter((q: any) => q.tipo_questao !== 'texto_apoio' && !q.is_texto_apoio && !q.isTextoApoio).length

      // 3. Update config_estudio with ordered lists
      const { data: suConfig } = await (supabase as any)
        .from('simulados_upload')
        .select('config_estudio')
        .eq('id', params.id)
        .single()

      const updatedConfigEstudio = {
        ...(suConfig?.config_estudio || {}),
        ordem_requisicoes: orderedReqIds,
        ordem_disciplinas: assignments.map(a => a.disciplinaId).filter(Boolean)
      }

      const payload = {
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        data_aplicacao: dataAplicacao || null,
        data_limite_upload: dataLimiteUpload || null,
        id_bimestre: bimestreId || null,
        series,
        valor: valor ? parseFloat(valor.replace(',', '.')) : null,
        instrucoes: instrucoes.trim() || null,
        questoes_json: currentQuestions,
        questoes_count: newQuestoesCount,
        config_estudio: updatedConfigEstudio,
        updated_at: new Date().toISOString(),
      }

      const { error: provaError } = await (supabase as any)
        .from('simulados_upload')
        .update(payload)
        .eq('id', params.id)

      if (provaError) throw provaError

      setSuccessModal(true)
    } catch (e: any) {
      console.error(e)
      alert('Erro ao atualizar simulado: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Carregando dados do simulado...</div>
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px', borderRadius: 12,
    background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))',
    color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', color: 'hsl(var(--text-secondary))',
    fontSize: 12, fontWeight: 700, marginBottom: 8,
    textTransform: 'uppercase', letterSpacing: '0.06em'
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1000, margin: '0 auto' }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link href="/simulados/simulados-upload"
              style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(100,116,139,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-primary))', textDecoration: 'none' }}>
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0 }}>Editar Simulado</h1>
              <p style={{ color: 'hsl(var(--text-secondary))', margin: 0, fontSize: 14 }}>Atualize as configurações e atribuições</p>
            </div>
          </div>
          <motion.button
            onClick={handleSave} disabled={loading}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 14, background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: '#fff', fontWeight: 700, border: 'none', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1, fontSize: 14, boxShadow: '0 8px 20px rgba(139,92,246,0.35)' }}
          >
            <Save size={18} /> {loading ? 'Salvando...' : 'Salvar Alterações'}
          </motion.button>
        </div>

        {/* ── Section 1: Basic Info ── */}
        <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 32, marginBottom: 24 }}>
          <h3 style={{ color: 'hsl(var(--text-primary))', fontSize: 16, fontWeight: 700, margin: '0 0 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={18} color="#8b5cf6" /> Informações do Simulado
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Título do Simulado *</label>
              <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Simulado Geral — 2º Bimestre 2025" style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Bimestre *</label>
              <select value={bimestreId} onChange={e => setBimestreId(e.target.value)} style={inputStyle}>
                <option value="">Selecione o Bimestre...</option>
                {bimestres.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Data de Aplicação</label>
              <input type="date" value={dataAplicacao} onChange={e => setDataAplicacao(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Prazo para Upload dos Professores</label>
              <input type="date" value={dataLimiteUpload} onChange={e => setDataLimiteUpload(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Instruções / Orientações para os Alunos</label>
              <textarea
                value={instrucoes}
                onChange={e => setInstrucoes(e.target.value)}
                placeholder="Ex: Preencha o cabeçalho completo, use caneta esferográfica azul ou preta, tempo limite: 4h..."
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
          </div>
        </div>

        {/* ── Section 2: Series ── */}
        <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 32, marginBottom: 24 }}>
          <h3 style={{ color: 'hsl(var(--text-primary))', fontSize: 16, fontWeight: 700, margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} color="#8b5cf6" /> Séries Aplicáveis *
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {seriesOptions.map(s => (
              <motion.button key={s} onClick={() => toggleSerie(s)} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                style={{ padding: '8px 18px', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                  background: series.includes(s) ? 'rgba(139,92,246,0.15)' : 'rgba(100,116,139,0.1)',
                  border: `1.5px solid ${series.includes(s) ? '#8b5cf6' : 'transparent'}`,
                  color: series.includes(s) ? '#8b5cf6' : 'hsl(var(--text-secondary))' }}>
                {s}
              </motion.button>
            ))}
          </div>
        </div>

        {/* ── Section 4: Assignments ── */}
        <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h3 style={{ color: 'hsl(var(--text-primary))', fontSize: 16, fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Upload size={18} color="#8b5cf6" /> Atribuições por Professor
              </h3>
              <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 13, margin: 0 }}>
                Defina quais professores enviarão questões de quais disciplinas e ordene a sequência das matérias.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <motion.button 
                type="button"
                onClick={handleOpenPresetModal} 
                whileHover={{ scale: 1.04 }} 
                whileTap={{ scale: 0.96 }}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 12, 
                  background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: '#fff', fontSize: 13, 
                  fontWeight: 800, border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(139,92,246,0.35)' 
                }}
              >
                <Sparkles size={16} /> Carregar Padrão
              </motion.button>
              <motion.button 
                type="button"
                onClick={addAssignment} 
                whileHover={{ scale: 1.04 }} 
                whileTap={{ scale: 0.96 }}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 12, 
                  background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', fontSize: 13, 
                  fontWeight: 700, border: '1px solid rgba(139,92,246,0.25)', cursor: 'pointer' 
                }}
              >
                <Plus size={16} /> Adicionar
              </motion.button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {assignments.map((a, i) => {
              const disc = disciplinas.find(d => d.id === a.disciplinaId)
              let allowedProfIds: string[] = []
              if (disc) {
                if (Array.isArray(disc.professores_ids)) allowedProfIds = disc.professores_ids
                else if (typeof disc.professores_ids === 'string') {
                  try { allowedProfIds = JSON.parse(disc.professores_ids) } catch {}
                } else if (disc.id_professor) allowedProfIds = [disc.id_professor]
              }
              const filteredProfs = allowedProfIds.length > 0
                ? professores.filter(p => allowedProfIds.includes(p.id))
                : professores

              return (
                <motion.div 
                  key={a.id} 
                  layout 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }}
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'auto 1fr 1fr 90px auto', 
                    gap: 14, 
                    alignItems: 'flex-end', 
                    background: 'hsl(var(--bg-app))', 
                    padding: '16px 20px', 
                    borderRadius: 14, 
                    border: '1px solid hsl(var(--border-subtle))',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                  }}
                >
                  {/* Position number & Move Up/Down buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 42 }}>
                    <div 
                      title={`Posição ${i + 1}`}
                      style={{
                        width: 32, height: 32, borderRadius: 8, background: 'rgba(139,92,246,0.12)',
                        color: '#8b5cf6', fontSize: 13, fontWeight: 900, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}
                    >
                      #{i + 1}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <button
                        type="button"
                        onClick={() => moveAssignment(i, -1)}
                        disabled={i === 0}
                        title="Mover disciplina para cima"
                        style={{
                          width: 22, height: 18, border: 'none', borderRadius: 4,
                          background: i === 0 ? 'transparent' : 'rgba(100,116,139,0.15)',
                          color: i === 0 ? 'hsl(var(--text-secondary))' : 'hsl(var(--text-primary))',
                          opacity: i === 0 ? 0.3 : 1, cursor: i === 0 ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                          transition: 'all 0.15s'
                        }}
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveAssignment(i, 1)}
                        disabled={i === assignments.length - 1}
                        title="Mover disciplina para baixo"
                        style={{
                          width: 22, height: 18, border: 'none', borderRadius: 4,
                          background: i === assignments.length - 1 ? 'transparent' : 'rgba(100,116,139,0.15)',
                          color: i === assignments.length - 1 ? 'hsl(var(--text-secondary))' : 'hsl(var(--text-primary))',
                          opacity: i === assignments.length - 1 ? 0.3 : 1, cursor: i === assignments.length - 1 ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                          transition: 'all 0.15s'
                        }}
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <label style={{ ...labelStyle, marginBottom: 0 }}>Disciplina *</label>
                      {a.area && AREA_CONFIG[a.area as keyof typeof AREA_CONFIG] && (
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          color: AREA_CONFIG[a.area as keyof typeof AREA_CONFIG].cor,
                          background: AREA_CONFIG[a.area as keyof typeof AREA_CONFIG].bg,
                          padding: '2px 8px', borderRadius: 6,
                          border: `1px solid ${AREA_CONFIG[a.area as keyof typeof AREA_CONFIG].borda}`
                        }}>
                          {AREA_CONFIG[a.area as keyof typeof AREA_CONFIG].label}
                        </span>
                      )}
                    </div>
                    <select value={a.disciplinaId} onChange={e => updateAssignment(a.id, 'disciplinaId', e.target.value)}
                      style={{ ...inputStyle, padding: '10px 12px', fontSize: 14 }}>
                      <option value="" disabled>Selecionar...</option>
                      {disciplinas.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.nome} {(d.segmento && d.segmento !== 'Sem Segmento') ? `— ${d.segmento}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ ...labelStyle, marginBottom: 6 }}>Professor *</label>
                    <select value={a.professorId} onChange={e => updateAssignment(a.id, 'professorId', e.target.value)}
                      style={{ ...inputStyle, padding: '10px 12px', fontSize: 14 }}>
                      <option value="" disabled>Selecionar...</option>
                      {filteredProfs.length === 0 && !a.professorId
                        ? <option disabled>Nenhum professor vinculado</option>
                        : (!filteredProfs.find(p => p.id === a.professorId) && a.professorId) 
                          ? <option value={a.professorId}>{a.professorNome} (Não vinculado)</option>
                          : null}
                      {filteredProfs.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ ...labelStyle, marginBottom: 6 }}>Qtd. Quest.</label>
                    <input type="number" min={1} max={100}
                      value={Number.isNaN(a.qtdQuestoes) ? '' : a.qtdQuestoes}
                      onChange={e => updateAssignment(a.id, 'qtdQuestoes', parseInt(e.target.value))}
                      style={{ ...inputStyle, padding: '10px 12px', fontSize: 14, textAlign: 'center' }} />
                  </div>

                  <div>
                    <motion.button onClick={() => setAssignmentToDelete(a)} whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} disabled={assignments.length === 1}
                      style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: assignments.length === 1 ? 'not-allowed' : 'pointer', opacity: assignments.length === 1 ? 0.3 : 1 }}
                      title="Excluir disciplina e questões associadas">
                      <Trash2 size={16} />
                    </motion.button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>

      </motion.div>

      <AnimatePresence>
        {/* Modal de Carregamento Padrão por Série com Sub-seleção */}
        {showPresetModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowPresetModal(false)}
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />

            <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }}
              style={{ 
                background: 'hsl(var(--bg-surface))', 
                borderRadius: 24, 
                padding: '28px 24px', 
                width: '100%', 
                maxWidth: 720, 
                position: 'relative', 
                boxShadow: '0 24px 60px rgba(0,0,0,0.35)', 
                maxHeight: '92vh', 
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column'
              }}>
              
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 8px 18px rgba(139,92,246,0.35)', flexShrink: 0 }}>
                    <Sparkles size={22} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 19, fontWeight: 900, color: 'hsl(var(--text-primary))', margin: 0 }}>
                      Carregar Grade Padrão por Série
                    </h2>
                    <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 13, margin: '3px 0 0' }}>
                      Selecione o segmento e escolha as áreas ou matérias que deseja importar para este simulado.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPresetModal(false)}
                  style={{ background: 'transparent', border: 'none', color: 'hsl(var(--text-secondary))', cursor: 'pointer', padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Presets Segmented Selector (3 Cards) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
                {(Object.keys(SIMULADOS_PRESETS) as Array<'fund2_8_9' | 'em_1_2' | 'em_3'>).map(key => {
                  const preset = SIMULADOS_PRESETS[key]
                  const isSelected = selectedPresetKey === key
                  const isDetected = detectSeriePattern(series) === key

                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => handleSelectPresetTab(key)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 14,
                        border: `2px solid ${isSelected ? preset.cor : 'hsl(var(--border-subtle))'}`,
                        background: isSelected ? `${preset.cor}12` : 'hsl(var(--bg-app))',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: isSelected ? preset.cor : 'hsl(var(--text-primary))' }}>
                          {preset.titulo}
                        </span>
                        {isSelected && (
                          <div style={{ width: 18, height: 18, borderRadius: '50%', background: preset.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                            <Check size={11} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: 11, color: 'hsl(var(--text-secondary))', lineHeight: 1.2 }}>
                        {preset.disciplinas.length} matérias disponíveis
                      </span>
                      {isDetected && (
                        <span style={{ marginTop: 2, fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 6, background: '#10b98120', color: '#10b981', alignSelf: 'flex-start' }}>
                          Série selecionada
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Sub-Selection Panel */}
              <div style={{ 
                background: 'hsl(var(--bg-app))', 
                borderRadius: 16, 
                padding: '16px', 
                border: '1px solid hsl(var(--border-subtle))', 
                marginBottom: 18 
              }}>
                {/* Panel Header with Select All / Deselect All */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Layers size={16} color="#8b5cf6" />
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>
                      Sub-seleção de Disciplinas
                    </span>
                    <span style={{ 
                      fontSize: 11, 
                      fontWeight: 700, 
                      padding: '2px 8px', 
                      borderRadius: 100, 
                      background: selectedDisciplines.length > 0 ? '#8b5cf620' : 'hsl(var(--border-subtle))', 
                      color: selectedDisciplines.length > 0 ? '#8b5cf6' : 'hsl(var(--text-secondary))' 
                    }}>
                      {selectedDisciplines.length} de {SIMULADOS_PRESETS[selectedPresetKey].disciplinas.length} selecionadas
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={selectAllDisciplines}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#8b5cf6',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: '4px 6px'
                      }}
                    >
                      Selecionar todas
                    </button>
                    <span style={{ color: 'hsl(var(--text-tertiary, #9ca3af))', fontSize: 12 }}>•</span>
                    <button
                      type="button"
                      onClick={deselectAllDisciplines}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'hsl(var(--text-secondary))',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '4px 6px'
                      }}
                    >
                      Desmarcar todas
                    </button>
                  </div>
                </div>

                {/* Area Groups with Discipline Pills */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {getPresetGroupsByArea(selectedPresetKey).map(group => {
                    const groupNomes = group.disciplinas.map(d => d.fallbackNome)
                    const selectedInGroup = groupNomes.filter(n => selectedDisciplines.includes(n))
                    const allInGroupSelected = selectedInGroup.length === groupNomes.length
                    const someInGroupSelected = selectedInGroup.length > 0 && !allInGroupSelected

                    return (
                      <div 
                        key={group.area}
                        style={{
                          background: 'hsl(var(--bg-surface))',
                          borderRadius: 12,
                          border: `1px solid ${selectedInGroup.length > 0 ? group.borda : 'hsl(var(--border-subtle))'}`,
                          overflow: 'hidden'
                        }}
                      >
                        {/* Area Header Bar */}
                        <div 
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            background: selectedInGroup.length > 0 ? group.bg : 'hsl(var(--bg-app))',
                            borderBottom: `1px solid ${selectedInGroup.length > 0 ? group.borda : 'hsl(var(--border-subtle))'}`,
                            cursor: 'pointer',
                            userSelect: 'none'
                          }}
                          onClick={() => toggleArea(group.disciplinas)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                              type="checkbox"
                              checked={allInGroupSelected}
                              ref={el => {
                                if (el) el.indeterminate = someInGroupSelected
                              }}
                              onChange={() => {}} // handled by parent onClick
                              style={{ accentColor: group.cor, cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: 13, fontWeight: 800, color: group.cor }}>
                              {group.label}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.8, color: 'hsl(var(--text-secondary))' }}>
                              ({selectedInGroup.length}/{group.disciplinas.length})
                            </span>
                          </div>

                          <span style={{ fontSize: 11, fontWeight: 600, color: group.cor }}>
                            {allInGroupSelected ? 'Desmarcar área' : 'Marcar área'}
                          </span>
                        </div>

                        {/* Disciplines Pills */}
                        <div style={{ padding: '10px 12px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {group.disciplinas.map((d, didx) => {
                            const isChecked = selectedDisciplines.includes(d.fallbackNome)
                            const displayLabel = d.rotulo && d.rotulo !== d.fallbackNome ? `${d.rotulo} (${d.fallbackNome})` : (d.rotulo || d.fallbackNome)

                            return (
                              <button
                                type="button"
                                key={didx}
                                onClick={() => toggleDiscipline(d.fallbackNome)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '5px 10px',
                                  borderRadius: 8,
                                  border: isChecked ? `1.5px solid ${group.cor}` : '1px dashed hsl(var(--border-subtle))',
                                  background: isChecked ? `${group.cor}18` : 'hsl(var(--bg-app))',
                                  color: isChecked ? 'hsl(var(--text-primary))' : 'hsl(var(--text-secondary))',
                                  cursor: 'pointer',
                                  fontSize: 12,
                                  fontWeight: isChecked ? 700 : 500,
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <div style={{
                                  width: 14,
                                  height: 14,
                                  borderRadius: 3,
                                  border: isChecked ? `1.5px solid ${group.cor}` : '1px solid hsl(var(--text-secondary))',
                                  background: isChecked ? group.cor : 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#fff',
                                  flexShrink: 0
                                }}>
                                  {isChecked && <Check size={10} strokeWidth={3} />}
                                </div>
                                <span>{displayLabel}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Substitution Mode */}
              <div style={{ background: 'hsl(var(--bg-app))', padding: '12px 16px', borderRadius: 14, marginBottom: 18, border: '1px solid hsl(var(--border-subtle))' }}>
                <label style={{ ...labelStyle, marginBottom: 6, fontSize: 11 }}>Modo de carregamento</label>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: presetMode === 'replace' && assignments.length > 0 ? 10 : 0 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'hsl(var(--text-primary))', cursor: 'pointer', fontWeight: 600 }}>
                    <input 
                      type="radio" 
                      name="presetModeEdit" 
                      checked={presetMode === 'replace'} 
                      onChange={() => setPresetMode('replace')}
                    />
                    Substituir todas as atribuições atuais
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'hsl(var(--text-primary))', cursor: 'pointer', fontWeight: 600 }}>
                    <input 
                      type="radio" 
                      name="presetModeEdit" 
                      checked={presetMode === 'append'} 
                      onChange={() => setPresetMode('append')}
                    />
                    Acrescentar às atribuições existentes
                  </label>
                </div>

                {presetMode === 'replace' && assignments.length > 0 && (
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                    <AlertTriangle size={14} /> As disciplinas atuais serão substituídas. Questões vinculadas às disciplinas removidas poderão ser excluídas ao salvar.
                  </p>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <motion.button 
                  type="button"
                  onClick={() => setShowPresetModal(false)} 
                  whileHover={{ scale: 1.01 }} 
                  whileTap={{ scale: 0.99 }}
                  style={{ padding: '12px 0', borderRadius: 12, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancelar
                </motion.button>
                <motion.button 
                  type="button"
                  onClick={handleApplyPreset} 
                  disabled={selectedDisciplines.length === 0}
                  whileHover={selectedDisciplines.length > 0 ? { scale: 1.01 } : {}} 
                  whileTap={selectedDisciplines.length > 0 ? { scale: 0.99 } : {}}
                  style={{ 
                    padding: '12px 0', borderRadius: 12, 
                    background: selectedDisciplines.length > 0 ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : 'hsl(var(--border-subtle))', 
                    color: selectedDisciplines.length > 0 ? '#fff' : 'hsl(var(--text-secondary))', 
                    fontSize: 14, fontWeight: 700, border: 'none', 
                    cursor: selectedDisciplines.length > 0 ? 'pointer' : 'not-allowed', 
                    boxShadow: selectedDisciplines.length > 0 ? '0 6px 16px rgba(139,92,246,0.35)' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                  }}
                >
                  <Sparkles size={16} /> 
                  {selectedDisciplines.length === 0 
                    ? 'Nenhuma matéria selecionada' 
                    : `Carregar Grade (${selectedDisciplines.length} ${selectedDisciplines.length === 1 ? 'matéria' : 'matérias'})`
                  }
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal de confirmação de exclusão de disciplina */}
        {assignmentToDelete && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setAssignmentToDelete(null)}
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
            
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              style={{ background: 'hsl(var(--bg-surface))', borderRadius: 24, padding: '32px 28px', width: '100%', maxWidth: 440, position: 'relative', boxShadow: '0 24px 48px rgba(0,0,0,0.3)', textAlign: 'center' }}>
              
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Trash2 size={28} color="#ef4444" />
              </div>
              
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: '0 0 10px' }}>
                Excluir Disciplina?
              </h2>
              
              <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 14, lineHeight: 1.5, margin: '0 0 24px' }}>
                Você está prestes a remover <strong style={{ color: 'hsl(var(--text-primary))' }}>{assignmentToDelete.disciplinaNome || 'esta disciplina'}</strong>.
                <br /><br />
                <span style={{ color: '#ef4444', fontWeight: 700 }}>Atenção:</span> A atribuição e <strong>todas as questões já enviadas ou cadastradas para ela serão excluídas definitivamente</strong> deste simulado ao salvar.
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <motion.button onClick={() => setAssignmentToDelete(null)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  style={{ padding: '12px 0', borderRadius: 12, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  Cancelar
                </motion.button>
                <motion.button 
                  onClick={() => {
                    removeAssignment(assignmentToDelete.id)
                    setAssignmentToDelete(null)
                  }} 
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  style={{ padding: '12px 0', borderRadius: 12, background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 6px 16px rgba(239,68,68,0.3)' }}>
                  Sim, Excluir
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}

        {successModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
            
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              style={{ background: 'hsl(var(--bg-surface))', borderRadius: 24, padding: '40px 32px', width: '100%', maxWidth: 420, position: 'relative', boxShadow: '0 24px 48px rgba(0,0,0,0.2)', textAlign: 'center' }}>
              
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <CheckCircle size={32} color="#10b981" />
              </div>
              
              <h2 style={{ fontSize: 24, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: '0 0 12px' }}>Simulado Atualizado!</h2>
              <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 15, lineHeight: 1.5, margin: '0 0 32px' }}>
                As informações e atribuições do simulado foram salvas com sucesso.
              </p>
              
              <motion.button onClick={() => router.push('/simulados/simulados-upload')} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                style={{ width: '100%', padding: '14px 0', borderRadius: 14, background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 6px 16px rgba(16,185,129,0.3)' }}>
                Continuar
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
