'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  BookOpen,
  Building2,
  CalendarClock,
  Check,
  Cpu,
  LayoutGrid,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  UserCheck,
  Wand2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/lib/dataContext'
import { apiFetch } from '@/lib/api/apiClient'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import {
  AulaAlocada,
  CenarioHorario,
  HorarioProjeto,
  ParametrosOtimizador,
} from '@/lib/horario/types'
import {
  analisarViabilidade,
  avaliarGradeCompleta,
  executarGeradorHorarioAsync,
  SolverProgress,
} from '@/lib/horario/solver'
import {
  buildDemoProjeto,
  buildProjetoFromSchoolData,
  hasDemoDataInProjeto,
  sanitizeProjeto,
  stripDemoDataFromProjeto,
} from '@/lib/horario/presets'
import { EstruturaSedesTab } from '@/components/horario/EstruturaSedesTab'
import { ProfessoresRestricoesTab } from '@/components/horario/ProfessoresRestricoesTab'
import { GradeCurricularTab } from '@/components/horario/GradeCurricularTab'
import { DiagnosticoGeradorTab } from '@/components/horario/DiagnosticoGeradorTab'
import { GradeInterativaTab } from '@/components/horario/GradeInterativaTab'
import '@/components/horario/horario.css'

type TabId = 'estrutura' | 'professores' | 'curriculo' | 'gerador' | 'grade'

const DRAFT_KEY_PREFIX = 'edu_gerador_horario_draft_v1_'
const TAB_STORAGE_KEY = 'edu_gerador_horario_active_tab_v1'

function readLocalDraft(ano: string): HorarioProjeto | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(`${DRAFT_KEY_PREFIX}${ano}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && parsed.anoLetivo ? sanitizeProjeto(parsed) : null
  } catch {
    return null
  }
}

function writeLocalDraft(projeto: HorarioProjeto) {
  if (typeof window === 'undefined' || !projeto?.anoLetivo) return
  try {
    window.localStorage.setItem(`${DRAFT_KEY_PREFIX}${projeto.anoLetivo}`, JSON.stringify(projeto))
  } catch {}
}

function clearLocalDraft(ano: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(`${DRAFT_KEY_PREFIX}${ano}`)
  } catch {}
}

export default function GeradorHorarioPage() {
  const { mantenedores = [], cfgCalendarioLetivo = [] } = useData() as any
  const mantenedoresRef = useRef(mantenedores)
  mantenedoresRef.current = mantenedores

  const anoVigente = useMemo(
    () => String(cfgCalendarioLetivo?.find((c: any) => c.isVigente)?.ano || new Date().getFullYear()),
    [cfgCalendarioLetivo]
  )

  const [anoLetivo, setAnoLetivo] = useState(anoVigente)
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.sessionStorage.getItem(TAB_STORAGE_KEY) as TabId | null
      if (saved && ['estrutura', 'professores', 'curriculo', 'gerador', 'grade'].includes(saved)) {
        return saved
      }
    }
    return 'estrutura'
  })
  const [projeto, setProjeto] = useState<HorarioProjeto | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [confirmDeleteDemoOpen, setConfirmDeleteDemoOpen] = useState(false)
  const [deletingDemo, setDeletingDemo] = useState(false)
  const deleteDemoDialogRef = useRef<HTMLDialogElement>(null)

  // Refs para auto-save seguro em background e flush ao sair da página
  const projetoRef = useRef<HorarioProjeto | null>(null)
  const dirtyRef = useRef(false)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    projetoRef.current = projeto
  }, [projeto])

  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(TAB_STORAGE_KEY, activeTab)
      } catch {}
    }
  }, [activeTab])

  // Undo/Redo stack para edições manuais na grade ativa
  const [undoStack, setUndoStack] = useState<AulaAlocada[][]>([])
  const [redoStack, setRedoStack] = useState<AulaAlocada[][]>([])

  // Gerador assíncrono
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState<SolverProgress | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchSchoolBootstrapData = useCallback(async () => {
    const [turmasRes, funcsRes, discRes] = await Promise.all([
      apiFetch('/api/turmas?all=true&stats=false').then(r => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
      apiFetch('/api/rh/funcionarios?activeOnly=true').then(r => (r.ok ? r.json() : [])).catch(() => []),
      apiFetch('/api/configuracoes?chave=cfgDisciplinas').then(r => (r.ok ? r.json() : { valor: [] })).catch(() => ({ valor: [] })),
    ])
    const turmasRaw = Array.isArray(turmasRes) ? turmasRes : turmasRes?.data || []
    const funcionariosRaw = Array.isArray(funcsRes) ? funcsRes : funcsRes?.data || []
    const disciplinasRaw = Array.isArray(discRes?.valor) ? discRes.valor : []
    return { turmasRaw, funcionariosRaw, disciplinasRaw }
  }, [])

  const persistProjetoCloud = useCallback(
    async (pToSave: HorarioProjeto, options?: { silent?: boolean; keepalive?: boolean }) => {
      if (!pToSave?.anoLetivo) return false
      if (!options?.silent) setSaving(true)
      try {
        const res = await apiFetch('/api/administrativo/gerador-horario', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: options?.keepalive,
          body: JSON.stringify({ action: 'save', projeto: pToSave }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || `Falha HTTP ${res.status} ao salvar`)
        }
        const data = await res.json()
        const savedProj: HorarioProjeto = data?.projeto ? sanitizeProjeto(data.projeto) : pToSave

        // Só limpa dirty se não houve edição mais recente enquanto salvava
        const currentTs = projetoRef.current?.atualizadoEm || ''
        if (!currentTs || currentTs <= (pToSave.atualizadoEm || '')) {
          setDirty(false)
          dirtyRef.current = false
          clearLocalDraft(pToSave.anoLetivo)
        }

        if (!options?.silent) {
          setProjeto(prev => {
            if (prev && prev.atualizadoEm > savedProj.atualizadoEm) return prev
            return savedProj
          })
          toast.success('Configuração de horário salva na nuvem!')
        }
        return true
      } catch (e: any) {
        if (!options?.silent) {
          toast.error(e?.message || 'Erro ao salvar projeto na nuvem')
        } else {
          console.error('[GeradorHorario] Falha no auto-save:', e?.message)
        }
        return false
      } finally {
        if (!options?.silent) setSaving(false)
      }
    },
    []
  )

  const loadProjeto = useCallback(
    async (ano: string) => {
      setLoading(true)
      try {
        const localDraft = readLocalDraft(ano)
        const res = await apiFetch(`/api/administrativo/gerador-horario?ano=${encodeURIComponent(ano)}`, {
          cache: 'no-store',
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          if (localDraft) {
            setProjeto(localDraft)
            setDirty(true)
            toast.warning('Não foi possível sincronizar com o servidor; rascunho local restaurado.')
            return
          }
          throw new Error(err.error || `Erro HTTP ${res.status} ao carregar horário`)
        }

        const json = await res.json()
        const serverProjeto: HorarioProjeto | null = json?.projeto ? sanitizeProjeto(json.projeto) : null

        if (serverProjeto && localDraft) {
          const serverTime = Date.parse(serverProjeto.atualizadoEm || '') || 0
          const draftTime = Date.parse(localDraft.atualizadoEm || '') || 0
          if (draftTime > serverTime) {
            setProjeto(localDraft)
            setDirty(true)
            // Sincroniza automaticamente o rascunho mais recente com o banco
            void persistProjetoCloud(localDraft, { silent: true })
          } else {
            clearLocalDraft(ano)
            setProjeto(serverProjeto)
            setDirty(false)
          }
        } else if (serverProjeto) {
          setProjeto(serverProjeto)
          setDirty(false)
        } else if (localDraft) {
          setProjeto(localDraft)
          setDirty(true)
          void persistProjetoCloud(localDraft, { silent: true })
        } else {
          const { turmasRaw, funcionariosRaw, disciplinasRaw } = await fetchSchoolBootstrapData()
          const bootstrapped = buildProjetoFromSchoolData({
            anoLetivo: ano,
            mantenedores: mantenedoresRef.current,
            turmasRaw,
            funcionariosRaw,
            disciplinasRaw,
          })
          setProjeto(bootstrapped)
          setDirty(false)
          // Já persiste a estrutura inicial para o próximo reload vir direto do banco
          void persistProjetoCloud(bootstrapped, { silent: true })
        }
      } catch (e: any) {
        console.error(e)
        toast.error(e?.message || 'Erro ao carregar dados do gerador de horário')
      } finally {
        setLoading(false)
      }
    },
    [fetchSchoolBootstrapData, persistProjetoCloud]
  )

  useEffect(() => {
    loadProjeto(anoLetivo)
  }, [anoLetivo, loadProjeto])

  const updateProjeto = useCallback(
    (next: HorarioProjeto) => {
      const stamped: HorarioProjeto = {
        ...next,
        atualizadoEm: new Date().toISOString(),
      }
      setProjeto(stamped)
      projetoRef.current = stamped
      setDirty(true)
      dirtyRef.current = true
      writeLocalDraft(stamped)

      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = setTimeout(() => {
        if (projetoRef.current) {
          void persistProjetoCloud(projetoRef.current, { silent: true })
        }
      }, 900)
    },
    [persistProjetoCloud]
  )

  // Garantir gravação ao fechar aba, atualizar (F5) ou navegar para outro módulo
  useEffect(() => {
    const flushPending = () => {
      if (dirtyRef.current && projetoRef.current) {
        writeLocalDraft(projetoRef.current)
        const payloadSize = JSON.stringify(projetoRef.current).length
        void persistProjetoCloud(projetoRef.current, {
          silent: true,
          keepalive: payloadSize < 55000,
        })
      }
    }
    window.addEventListener('pagehide', flushPending)
    window.addEventListener('beforeunload', flushPending)
    return () => {
      window.removeEventListener('pagehide', flushPending)
      window.removeEventListener('beforeunload', flushPending)
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
      flushPending()
    }
  }, [persistProjetoCloud])

  const saveProjeto = async (targetProjeto?: HorarioProjeto) => {
    const pToSave = targetProjeto || projetoRef.current || projeto
    if (!pToSave) return
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    await persistProjetoCloud(pToSave, { silent: false })
  }

  const sincronizarComErp = async () => {
    if (!projeto) return
    const { turmasRaw, funcionariosRaw, disciplinasRaw } = await fetchSchoolBootstrapData()
    const fresh = buildProjetoFromSchoolData({
      anoLetivo: projeto.anoLetivo,
      mantenedores: mantenedoresRef.current,
      turmasRaw,
      funcionariosRaw,
      disciplinasRaw,
    })

    const existingSedesIds = new Set(projeto.sedes.map(s => s.id))
    const existingProfIds = new Set(projeto.professores.map(p => p.id))
    const existingDiscIds = new Set(projeto.disciplinas.map(d => d.id))
    const existingTurmaIds = new Set(projeto.turmas.map(t => t.id))

    const merged: HorarioProjeto = sanitizeProjeto({
      ...projeto,
      sedes: [...projeto.sedes, ...fresh.sedes.filter(s => !existingSedesIds.has(s.id))],
      professores: [...projeto.professores, ...fresh.professores.filter(p => !existingProfIds.has(p.id))],
      disciplinas: [...projeto.disciplinas, ...fresh.disciplinas.filter(d => !existingDiscIds.has(d.id))],
      turmas: [...projeto.turmas, ...fresh.turmas.filter(t => !existingTurmaIds.has(t.id))],
    })

    updateProjeto(merged)
    toast.success('Dados de turmas, sedes, professores e disciplinas sincronizados do ERP!')
  }

  const carregarDemonstracao = () => {
    const demo = buildDemoProjeto(anoLetivo)
    updateProjeto(demo)
    setUndoStack([])
    setRedoStack([])
    toast.success('Cenário de demonstração Multi-Sede carregado! Veja o Diagnóstico ou clique em Gerar Horário.')
  }

  const temDadosDemo = useMemo(() => hasDemoDataInProjeto(projeto), [projeto])

  useEffect(() => {
    const dlg = deleteDemoDialogRef.current
    if (!dlg) return
    if (confirmDeleteDemoOpen && !dlg.open) dlg.showModal()
    else if (!confirmDeleteDemoOpen && dlg.open) dlg.close()
  }, [confirmDeleteDemoOpen])

  const excluirDadosDemo = async () => {
    if (!projeto) return
    setDeletingDemo(true)
    try {
      const stripped = stripDemoDataFromProjeto(projeto)
      const { turmasRaw, funcionariosRaw, disciplinasRaw } = await fetchSchoolBootstrapData()
      const realSchool = buildProjetoFromSchoolData({
        anoLetivo: projeto.anoLetivo,
        mantenedores: mantenedoresRef.current,
        turmasRaw,
        funcionariosRaw,
        disciplinasRaw,
      })

      // Mesclar dados reais do ERP caso o projeto tenha ficado sem sedes/turmas/professores após remover demo
      const existingSedesIds = new Set(stripped.sedes.map(s => s.id))
      const existingProfIds = new Set(stripped.professores.map(p => p.id))
      const existingDiscIds = new Set(stripped.disciplinas.map(d => d.id))
      const existingTurmaIds = new Set(stripped.turmas.map(t => t.id))

      const cleaned: HorarioProjeto = sanitizeProjeto({
        ...stripped,
        sedes: [...stripped.sedes, ...realSchool.sedes.filter(s => !existingSedesIds.has(s.id))],
        professores: [...stripped.professores, ...realSchool.professores.filter(p => !existingProfIds.has(p.id))],
        disciplinas: [...stripped.disciplinas, ...realSchool.disciplinas.filter(d => !existingDiscIds.has(d.id))],
        turmas: [...stripped.turmas, ...realSchool.turmas.filter(t => !existingTurmaIds.has(t.id))],
        atualizadoEm: new Date().toISOString(),
      })

      setUndoStack([])
      setRedoStack([])
      setProjeto(cleaned)
      projetoRef.current = cleaned
      clearLocalDraft(cleaned.anoLetivo)
      await persistProjetoCloud(cleaned, { silent: true })
      setDirty(false)
      dirtyRef.current = false
      setConfirmDeleteDemoOpen(false)
      toast.success('Dados de demonstração excluídos e estrutura real do ERP restaurada!')
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao excluir dados demo')
    } finally {
      setDeletingDemo(false)
    }
  }

  const diagnostico = useMemo(() => {
    if (!projeto) {
      return { status: 'viavel' as const, scoreViabilidade: 100, itens: [], porTurno: [] }
    }
    return analisarViabilidade(projeto)
  }, [projeto])

  const cenarioAtivo = useMemo(() => {
    if (!projeto || !projeto.cenarioAtivoId) return null
    return projeto.cenarios.find(c => c.id === projeto.cenarioAtivoId) || null
  }, [projeto])

  // Execução do Gerador Automático
  const handleGenerate = async () => {
    if (!projeto) return
    if (projeto.alocacoes.filter(a => a.aulasSemana > 0).length === 0) {
      toast.error('Cadastre ao menos uma aula na Grade Curricular antes de gerar o horário.')
      setActiveTab('curriculo')
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setIsGenerating(true)

    try {
      const aulasBase = cenarioAtivo?.aulas || []
      const res = await executarGeradorHorarioAsync(projeto, aulasBase, {
        signal: controller.signal,
        onProgress: setProgress,
      })

      const nextNum = projeto.cenarios.length + 1
      const novoCenario: CenarioHorario = {
        id: `CEN-${Date.now().toString(36).toUpperCase()}`,
        nome: `Grade Gerada #${nextNum}`,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
        aulas: res.aulas,
        naoAlocadas: res.naoAlocadas,
        metricas: res.metricas,
      }

      const nextProj: HorarioProjeto = {
        ...projeto,
        cenarios: [novoCenario, ...projeto.cenarios].slice(0, 8),
        cenarioAtivoId: novoCenario.id,
      }

      setUndoStack([])
      setRedoStack([])
      updateProjeto(nextProj)
      await saveProjeto(nextProj)
      setActiveTab('grade')

      if (res.metricas.choquesProfessor === 0 && res.naoAlocadas.length === 0) {
        toast.success(`Horário gerado com 0 choques e Score ${res.metricas.scoreGeral}%!`)
      } else {
        toast.warning(
          `Gerado com Score ${res.metricas.scoreGeral}% (${res.metricas.choquesProfessor} choques, ${res.naoAlocadas.length} pendências).`
        )
      }
    } catch (e: any) {
      toast.error(e?.message || 'Erro durante geração do horário')
    } finally {
      setIsGenerating(false)
      abortRef.current = null
    }
  }

  const handleStopGenerate = () => {
    abortRef.current?.abort()
  }

  const handleUpdateAulas = (nextAulas: AulaAlocada[]) => {
    if (!projeto || !cenarioAtivo) return
    setUndoStack(prev => [...prev.slice(-29), cenarioAtivo.aulas])
    setRedoStack([])

    const evaluated = avaliarGradeCompleta(projeto, nextAulas)
    const updatedCenario: CenarioHorario = {
      ...cenarioAtivo,
      atualizadoEm: new Date().toISOString(),
      aulas: evaluated.aulasComConflitos,
      metricas: evaluated.metricas,
    }
    updateProjeto({
      ...projeto,
      cenarios: projeto.cenarios.map(c => (c.id === cenarioAtivo.id ? updatedCenario : c)),
    })
  }

  const handleUndo = () => {
    if (!projeto || !cenarioAtivo || undoStack.length === 0) return
    const prevAulas = undoStack[undoStack.length - 1]
    setUndoStack(prev => prev.slice(0, -1))
    setRedoStack(prev => [...prev, cenarioAtivo.aulas])
    const evaluated = avaliarGradeCompleta(projeto, prevAulas)
    updateProjeto({
      ...projeto,
      cenarios: projeto.cenarios.map(c =>
        c.id === cenarioAtivo.id ? { ...c, aulas: evaluated.aulasComConflitos, metricas: evaluated.metricas } : c
      ),
    })
  }

  const handleRedo = () => {
    if (!projeto || !cenarioAtivo || redoStack.length === 0) return
    const nextAulas = redoStack[redoStack.length - 1]
    setRedoStack(prev => prev.slice(0, -1))
    setUndoStack(prev => [...prev, cenarioAtivo.aulas])
    const evaluated = avaliarGradeCompleta(projeto, nextAulas)
    updateProjeto({
      ...projeto,
      cenarios: projeto.cenarios.map(c =>
        c.id === cenarioAtivo.id ? { ...c, aulas: evaluated.aulasComConflitos, metricas: evaluated.metricas } : c
      ),
    })
  }

  const handlePublish = async (syncRotina: boolean) => {
    if (!projeto || !cenarioAtivo) return
    setIsPublishing(true)
    try {
      const res = await apiFetch('/api/administrativo/gerador-horario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'publish',
          projeto,
          cenarioId: cenarioAtivo.id,
          syncRotina,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao publicar')
      if (json.projeto) {
        const cleaned = sanitizeProjeto(json.projeto)
        setProjeto(cleaned)
        clearLocalDraft(cleaned.anoLetivo)
      }
      setDirty(false)
      toast.success(
        syncRotina
          ? `Horário publicado! ${json.rotinaSynced || 0} aulas sincronizadas e links públicos atualizados.`
          : 'Horário publicado nos links públicos!'
      )
    } catch (e: any) {
      toast.error(e.message || 'Erro ao publicar horário')
    } finally {
      setIsPublishing(false)
    }
  }

  if (loading || !projeto) return <PageSkeleton />

  const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode; badge?: string }> = [
    { id: 'estrutura', label: '1. Estrutura & Sedes', icon: <Building2 size={15} /> },
    {
      id: 'professores',
      label: '2. Professores & Restrições',
      icon: <UserCheck size={15} />,
      badge: String(projeto.professores.length),
    },
    {
      id: 'curriculo',
      label: '3. Grade Curricular & Duplas',
      icon: <BookOpen size={15} />,
      badge: `${projeto.alocacoes.reduce((a, b) => a + (b.aulasSemana || 0), 0)}h`,
    },
    {
      id: 'gerador',
      label: '4. Diagnóstico & Gerador IA',
      icon: <Cpu size={15} />,
      badge: diagnostico.status === 'viavel' ? 'OK' : diagnostico.status === 'atencao' ? '!' : '⚠',
    },
    {
      id: 'grade',
      label: '5. Grade Interativa & Publicação',
      icon: <LayoutGrid size={15} />,
      badge: cenarioAtivo ? `${cenarioAtivo.metricas.scoreGeral}%` : undefined,
    },
  ]

  return (
    <div className="animation-fade-in">
      {/* Page Header */}
      <div className="page-header no-print" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CalendarClock size={24} style={{ color: '#3b82f6' }} />
            Gerador Automático de Horário Escolar
            <span className="badge badge-purple" style={{ fontSize: 10 }}>PRO</span>
          </h1>
          <p className="page-subtitle">
            Multi-sedes, restrições docentes, aulas em dupla, ambientes compartilhados, eliminação de janelas e links ao vivo
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            className="form-input"
            style={{ width: 105, fontWeight: 700 }}
            value={anoLetivo}
            onChange={e => setAnoLetivo(e.target.value)}
            aria-label="Ano Letivo"
          >
            {[anoVigente, String(Number(anoVigente) + 1), String(Number(anoVigente) - 1)]
              .filter((v, i, arr) => arr.indexOf(v) === i)
              .map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
          </select>

          <button type="button" className="btn btn-secondary btn-sm" onClick={sincronizarComErp}>
            <RefreshCw size={13} /> Sincronizar ERP
          </button>

          <button type="button" className="btn btn-secondary btn-sm" onClick={carregarDemonstracao}>
            <Wand2 size={13} /> Carregar Demo
          </button>

          {temDadosDemo && (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => setConfirmDeleteDemoOpen(true)}
              title="Remover sedes, turmas, professores e cenários de demonstração"
            >
              <Trash2 size={13} /> Excluir Dados Demo
            </button>
          )}

          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={saving}
            onClick={() => saveProjeto()}
          >
            {saving ? <RefreshCw size={13} /> : dirty ? <Save size={13} /> : <Check size={13} />}
            {saving ? 'Salvando...' : dirty ? 'Salvar Alterações*' : 'Salvo'}
          </button>
        </div>
      </div>

      {/* Single-Row Scrollable Accessible Tablist */}
      <div role="tablist" aria-label="Etapas do Gerador de Horário" className="horario-tablist no-print" style={{ marginBottom: 18 }}>
        {tabs.map(t => {
          const selected = activeTab === t.id
          return (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              className="horario-tab-btn"
              onClick={() => setActiveTab(t.id)}
            >
              {t.icon}
              <span>{t.label}</span>
              {t.badge && (
                <span
                  style={{
                    fontSize: 10,
                    padding: '1px 7px',
                    borderRadius: 99,
                    background: selected ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.08)',
                    color: selected ? '#60a5fa' : 'hsl(var(--text-secondary))',
                    fontWeight: 800,
                  }}
                >
                  {t.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab Panels */}
      <div role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
        {activeTab === 'estrutura' && <EstruturaSedesTab projeto={projeto} onChange={updateProjeto} />}
        {activeTab === 'professores' && <ProfessoresRestricoesTab projeto={projeto} onChange={updateProjeto} />}
        {activeTab === 'curriculo' && <GradeCurricularTab projeto={projeto} onChange={updateProjeto} />}
        {activeTab === 'gerador' && (
          <DiagnosticoGeradorTab
            projeto={projeto}
            diagnostico={diagnostico}
            isGenerating={isGenerating}
            progress={progress}
            onChangeParams={(nextParams: ParametrosOtimizador) => updateProjeto({ ...projeto, parametros: nextParams })}
            onGenerate={handleGenerate}
            onStopGenerate={handleStopGenerate}
            onSelectCenario={id => {
              updateProjeto({ ...projeto, cenarioAtivoId: id })
              setUndoStack([])
              setRedoStack([])
              setActiveTab('grade')
            }}
            onDeleteCenario={id => {
              const rem = projeto.cenarios.filter(c => c.id !== id)
              updateProjeto({
                ...projeto,
                cenarios: rem,
                cenarioAtivoId: projeto.cenarioAtivoId === id ? rem[0]?.id || null : projeto.cenarioAtivoId,
              })
            }}
          />
        )}
        {activeTab === 'grade' && (
          <GradeInterativaTab
            projeto={projeto}
            cenario={cenarioAtivo}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
            isPublishing={isPublishing}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onUpdateAulas={handleUpdateAulas}
            onPublish={handlePublish}
            onIrParaGerador={() => setActiveTab('gerador')}
          />
        )}
      </div>

      {/* Confirmação acessível em <dialog> nativo para exclusão dos dados demo */}
      <dialog
        ref={deleteDemoDialogRef}
        aria-labelledby="delete-demo-title"
        onClose={() => setConfirmDeleteDemoOpen(false)}
        style={{
          margin: 'auto',
          padding: 0,
          borderRadius: 18,
          border: '1px solid hsl(var(--border-default))',
          background: 'hsl(var(--bg-surface))',
          color: 'hsl(var(--text-primary))',
          width: 'min(92vw, 440px)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
        }}
      >
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 id="delete-demo-title" style={{ fontSize: 17, fontWeight: 800, margin: 0, color: '#f87171' }}>
              Excluir Dados de Demonstração?
            </h1>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              onClick={() => setConfirmDeleteDemoOpen(false)}
              aria-label="Fechar"
            >
              <X size={16} />
            </button>
          </div>
          <p style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', margin: 0, lineHeight: 1.5 }}>
            Esta ação removerá as sedes, turmas, disciplinas, professores e cenários de demonstração e restaurará os dados reais do seu ERP.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8 }}>
            <button
              type="button"
              autoFocus
              className="btn btn-secondary btn-sm"
              disabled={deletingDemo}
              onClick={() => setConfirmDeleteDemoOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              disabled={deletingDemo}
              onClick={excluirDadosDemo}
            >
              <Trash2 size={13} /> {deletingDemo ? 'Excluindo...' : 'Confirmar Exclusão'}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  )
}
