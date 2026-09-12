'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import {
  Bell, Send, Users, Smartphone, ShieldCheck, CheckCircle2,
  AlertTriangle, RefreshCw, Sparkles, ExternalLink, ArrowRight,
  Info, Check, Calendar, Camera, Clock, DollarSign, Award,
  Car, FileText, ChevronRight, Search, X, Copy, Terminal,
  Radio, CheckCheck, Eye
} from 'lucide-react'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { UserAvatar } from '@/components/UserAvatar'
import { LoadingGlass } from '@/components/LoadingGlass'
import { formatFriendlyStudentName } from '@/lib/studentNameHelper'

// ── Tipos e Presets de Notificação ──────────────────────────────────────────
type PushCategory =
  | 'frequencia'
  | 'momentos'
  | 'calendario'
  | 'comunicados'
  | 'notas'
  | 'ocorrencias'
  | 'cobrancas'
  | 'saida'
  | 'test'

interface PushPreset {
  id: string
  label: string
  title: string
  message: string
  routeSuffix: string
}

const CATEGORY_DEFINITIONS: Record<
  PushCategory,
  {
    label: string
    color: string
    bgLight: string
    icon: any
    presets: PushPreset[]
  }
> = {
  frequencia: {
    label: 'Frequência Escolar',
    color: '#10b981',
    bgLight: 'rgba(16, 185, 129, 0.12)',
    icon: CheckCheck,
    presets: [
      {
        id: 'freq_presenca',
        label: 'Presença Confirmada',
        title: '✅ Presença Confirmada',
        message: 'A presença de {aluno} foi confirmada na escola.',
        routeSuffix: '/frequencia',
      },
      {
        id: 'freq_portaria',
        label: 'Entrada na Portaria (com horário)',
        title: '✅ Presença Confirmada',
        message: 'A presença de {aluno} foi confirmada na escola (Entrada às {hora}).',
        routeSuffix: '/frequencia',
      },
      {
        id: 'freq_falta',
        label: 'Falta Registrada',
        title: '❌ Falta Registrada',
        message: 'Foi registrada uma falta para {aluno}.',
        routeSuffix: '/frequencia',
      },
      {
        id: 'freq_falta_justificada',
        label: 'Falta Justificada',
        title: '📋 Falta Justificada',
        message: 'Foi registrada uma falta justificada para {aluno}.',
        routeSuffix: '/frequencia',
      },
    ],
  },
  momentos: {
    label: 'Momentos & Mídia',
    color: '#ec4899',
    bgLight: 'rgba(236, 72, 153, 0.12)',
    icon: Camera,
    presets: [
      {
        id: 'mom_turma',
        label: 'Momento da Turma',
        title: '📸 Novo Momento Publicado!',
        message: 'Novas fotos e atividades da turma de {aluno} foram compartilhadas. Confira!',
        routeSuffix: '/{alunoId}/momentos',
      },
      {
        id: 'mom_individual',
        label: 'Momento Individual',
        title: '📸 Novo Momento Publicado!',
        message: 'Um novo conteúdo para {aluno} foi compartilhado. Confira!',
        routeSuffix: '/{alunoId}/momentos',
      },
      {
        id: 'mom_curtida',
        label: 'Nova Curtida',
        title: '❤️ Nova Curtida',
        message: 'A coordenação curtiu sua publicação.',
        routeSuffix: '/momentos',
      },
      {
        id: 'mom_comentario',
        label: 'Novo Comentário',
        title: '💬 Novo Comentário',
        message: 'A coordenação comentou na sua publicação: "Excelente participação!"',
        routeSuffix: '/momentos',
      },
    ],
  },
  calendario: {
    label: 'Eventos & Calendário',
    color: '#3b82f6',
    bgLight: 'rgba(59, 130, 246, 0.12)',
    icon: Calendar,
    presets: [
      {
        id: 'cal_evento',
        label: 'Novo Evento no Calendário',
        title: '📅 Novo Evento!',
        message: 'Novo evento no calendário para a turma de {aluno}: Feira Cultural e Científica. Confira os detalhes!',
        routeSuffix: '/{alunoId}/calendario',
      },
      {
        id: 'cal_lembrete',
        label: 'Lembrete (Véspera)',
        title: '⏰ Lembrete: Amanhã!',
        message: 'Lembrete para {aluno}: amanhã temos o evento Reunião Pedagógica. Não se esqueça!',
        routeSuffix: '/{alunoId}/calendario',
      },
      {
        id: 'cal_colab',
        label: 'Evento para a Equipe',
        title: '📅 Novo Evento!',
        message: 'O evento "Conselho de Classe" foi adicionado à sua agenda.',
        routeSuffix: '/colaborador/calendario',
      },
    ],
  },
  comunicados: {
    label: 'Comunicados Oficiais',
    color: '#8b5cf6',
    bgLight: 'rgba(139, 92, 246, 0.12)',
    icon: Bell,
    presets: [
      {
        id: 'com_turma',
        label: 'Comunicado para a Turma',
        title: '📢 Comunicado da Direção',
        message: 'A coordenação enviou um novo comunicado para a turma de {aluno}. Confira!',
        routeSuffix: '/{alunoId}/comunicados',
      },
      {
        id: 'com_individual',
        label: 'Recado Pedagógico Individual',
        title: '📢 Recado Pedagógico',
        message: 'A coordenação enviou uma mensagem para {aluno}',
        routeSuffix: '/{alunoId}/comunicados',
      },
      {
        id: 'com_resposta',
        label: 'Resposta no Comunicado',
        title: '🏫 Nova mensagem de Coordenação Pedagógica',
        message: 'Sobre "Passeio Escolar": Mensagem recebida com sucesso.',
        routeSuffix: '/comunicados',
      },
    ],
  },
  notas: {
    label: 'Boletim & Notas',
    color: '#6366f1',
    bgLight: 'rgba(99, 102, 241, 0.12)',
    icon: FileText,
    presets: [
      {
        id: 'not_boletim',
        label: 'Novas Notas Lançadas',
        title: '🏆 Novas Notas Lançadas!',
        message: 'O boletim de {aluno} acabou de ser atualizado.',
        routeSuffix: '/notas',
      },
    ],
  },
  ocorrencias: {
    label: 'Ocorrências Disciplinares',
    color: '#f59e0b',
    bgLight: 'rgba(245, 158, 11, 0.12)',
    icon: AlertTriangle,
    presets: [
      {
        id: 'oco_registro',
        label: 'Aviso de Ocorrência',
        title: '⚠️ Aviso de Ocorrência',
        message: 'Uma nova ocorrência foi registrada para {aluno}. Acesse para ver os detalhes.',
        routeSuffix: '/ocorrencias',
      },
    ],
  },
  cobrancas: {
    label: 'Cobranças & Financeiro',
    color: '#f43f5e',
    bgLight: 'rgba(244, 63, 94, 0.12)',
    icon: DollarSign,
    presets: [
      {
        id: 'fin_mensalidade',
        label: 'Mensalidade Disponível',
        title: '💳 Mensalidade Disponível',
        message: 'A mensalidade escolar de {aluno} já está disponível para pagamento no app.',
        routeSuffix: '/{alunoId}/financeiro',
      },
      {
        id: 'fin_lembrete',
        label: 'Lembrete de Vencimento',
        title: '⏰ Lembrete de Vencimento',
        message: 'A fatura escolar de {aluno} vence em breve. Pague com facilidade via Pix ou código de barras.',
        routeSuffix: '/{alunoId}/financeiro',
      },
    ],
  },
  saida: {
    label: 'Portaria & Saída',
    color: '#0ea5e9',
    bgLight: 'rgba(14, 165, 233, 0.12)',
    icon: Car,
    presets: [
      {
        id: 'sai_saida_confirmada',
        label: 'Saída Confirmada na Portaria',
        title: '🎓 Saída Confirmada',
        message: 'A saída de {aluno} foi confirmada na portaria às {hora}.',
        routeSuffix: '/frequencia',
      },
      {
        id: 'sai_chamada_portao',
        label: 'Chamada de Saída no Portão',
        title: '🚗 Chamada de Portaria',
        message: '{aluno} foi chamado na portaria para saída e está se dirigindo ao portão principal.',
        routeSuffix: '',
      },
    ],
  },
  test: {
    label: 'Diagnóstico Livre / Teste',
    color: '#64748b',
    bgLight: 'rgba(100, 116, 139, 0.12)',
    icon: Radio,
    presets: [
      {
        id: 'tst_padrao',
        label: 'Push de Teste Padrão',
        title: '🔔 Teste de Notificação Push',
        message: 'Sistema de notificações da Agenda Digital funcionando com sucesso para {aluno}!',
        routeSuffix: '',
      },
    ],
  },
}

export default function ADAdminPushTestPage() {
  const [alunos, setAlunos, { loading: isAlunosLoading }] = useSupabaseArray<any>('alunos/lightweight?limit=2000')
  const { adAlert } = useAgendaDigital()

  // ── Estados de Seleção de Destino ──
  const [searchTerm, setSearchTerm] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const [selectedAluno, setSelectedAluno] = useState<any | null>(null)
  const [guardians, setGuardians] = useState<any[]>([])
  const [isLoadingGuardians, setIsLoadingGuardians] = useState(false)
  const [selectedRespIds, setSelectedRespIds] = useState<string[]>([])
  const [includeAlunoDirect, setIncludeAlunoDirect] = useState(false)

  // ── Estados de Conteúdo da Notificação ──
  const [activeCategory, setActiveCategory] = useState<PushCategory>('frequencia')
  const [selectedPresetId, setSelectedPresetId] = useState<string>('freq_presenca')
  const [title, setTitle] = useState(CATEGORY_DEFINITIONS.frequencia.presets[0].title)
  const [message, setMessage] = useState(CATEGORY_DEFINITIONS.frequencia.presets[0].message)
  const [targetRoute, setTargetRoute] = useState(CATEGORY_DEFINITIONS.frequencia.presets[0].routeSuffix)
  const [bypassDedup, setBypassDedup] = useState(true)

  // ── Estados de Preview e Disparo ──
  const [previewPlatform, setPreviewPlatform] = useState<'ios' | 'android'>('ios')
  const [isSending, setIsSending] = useState(false)
  const [lastResult, setLastResult] = useState<any | null>(null)
  const [configStatus, setConfigStatus] = useState<any | null>(null)

  // ── Logs de Histórico ──
  const [recentLogs, setRecentLogs] = useState<any[]>([])
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const [viewLogDetail, setViewLogDetail] = useState<any | null>(null)

  // 1. Carregar Config do OneSignal
  const loadConfig = async () => {
    try {
      const res = await fetch('/api/agenda/push/test?config=true')
      if (res.ok) {
        const data = await res.json()
        setConfigStatus(data)
      }
    } catch (e) {
      console.error('Erro ao verificar config do OneSignal:', e)
    }
  }

  // 2. Carregar Logs Recentes
  const loadRecentLogs = async () => {
    setIsLoadingLogs(true)
    try {
      const res = await fetch('/api/agenda/push/test?logs=true')
      if (res.ok) {
        const data = await res.json()
        setRecentLogs(data.logs || [])
      }
    } catch (e) {
      console.error('Erro ao carregar logs:', e)
    } finally {
      setIsLoadingLogs(false)
    }
  }

  useEffect(() => {
    loadConfig()
    loadRecentLogs()

    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 3. Autocomplete / Filtro de Alunos
  const filteredAlunos = useMemo(() => {
    if (!searchTerm || searchTerm.trim().length < 2) return []
    const term = searchTerm.toLowerCase().trim()
    return (alunos || [])
      .filter((a: any) => {
        const n = String(a.nome || '').toLowerCase()
        const m = String(a.matricula || a.id || '').toLowerCase()
        const t = String(a.turma || '').toLowerCase()
        return n.includes(term) || m.includes(term) || t.includes(term)
      })
      .slice(0, 8)
  }, [alunos, searchTerm])

  // 4. Carregar Responsáveis ao selecionar um aluno
  const handleSelectAluno = async (aluno: any) => {
    setSelectedAluno(aluno)
    setSearchTerm('')
    setIsSearchOpen(false)
    setIsLoadingGuardians(true)
    setGuardians([])
    setSelectedRespIds([])

    try {
      const res = await fetch(`/api/agenda/push/test?aluno_id=${encodeURIComponent(aluno.id)}`)
      if (res.ok) {
        const data = await res.json()
        const resps = data.responsaveis || []
        setGuardians(resps)
        // Seleciona todos os responsáveis por padrão
        setSelectedRespIds(resps.map((r: any) => String(r.responsavel_id)))
      }
    } catch (err) {
      console.error('Erro ao buscar responsáveis do aluno:', err)
    } finally {
      setIsLoadingGuardians(false)
    }
  }

  // 5. Troca de Categoria de Notificação
  const handleCategoryChange = (cat: PushCategory) => {
    setActiveCategory(cat)
    const firstPreset = CATEGORY_DEFINITIONS[cat].presets[0]
    if (firstPreset) {
      setSelectedPresetId(firstPreset.id)
      setTitle(firstPreset.title)
      setMessage(firstPreset.message)
      setTargetRoute(firstPreset.routeSuffix)
    }
  }

  // 6. Troca de Preset
  const handlePresetSelect = (preset: PushPreset) => {
    setSelectedPresetId(preset.id)
    setTitle(preset.title)
    setMessage(preset.message)
    setTargetRoute(preset.routeSuffix)
  }

  // 7. Preview da mensagem com o nome real do aluno substituído de forma amigável
  const alunoNomeExibicao = selectedAluno?.nome ? formatFriendlyStudentName(selectedAluno.nome) : 'Cecilia'
  const previewTitle = useMemo(() => {
    return title.replace(/{aluno}/gi, alunoNomeExibicao).replace(/{turma}/gi, selectedAluno?.turma || 'Turma A')
  }, [title, alunoNomeExibicao, selectedAluno])

  const previewMessage = useMemo(() => {
    const agoraHora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    return message
      .replace(/{aluno}/gi, alunoNomeExibicao)
      .replace(/{turma}/gi, selectedAluno?.turma || 'Turma A')
      .replace(/{hora}/gi, agoraHora)
  }, [message, alunoNomeExibicao, selectedAluno])

  const previewTargetUrl = useMemo(() => {
    let route = (targetRoute || '').trim()
    if (selectedAluno?.id) {
      route = route.replace(/{alunoId}/gi, String(selectedAluno.id))
    } else {
      route = route.replace(/{alunoId}/gi, 'aluno')
    }
    if (route && !route.startsWith('/')) route = `/${route}`
    return `/agenda-digital${route}`
  }, [selectedAluno, targetRoute])

  // 8. Disparo do Push de Teste
  const handleSendTestPush = async () => {
    if (!title.trim() || !message.trim()) {
      adAlert('Preencha o título e a mensagem antes de disparar.', 'Atenção')
      return
    }

    setIsSending(true)
    setLastResult(null)

    try {
      const payload = {
        alunoId: selectedAluno?.id || null,
        responsavelIds: selectedRespIds,
        includeAlunoDirect,
        type: activeCategory,
        title,
        message,
        targetUrl: previewTargetUrl,
        bypassDedup,
        metadata: {
          presetId: selectedPresetId,
          source: 'admin_push_tester',
        },
      }

      const res = await fetch('/api/agenda/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setLastResult({
          success: false,
          error: data.error || 'Falha ao disparar push',
          data,
        })
      } else {
        setLastResult({
          success: true,
          ...data,
        })
        loadRecentLogs()
      }
    } catch (err: any) {
      setLastResult({
        success: false,
        error: err.message || 'Erro inesperado na conexão',
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="ad-admin-page-container" style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      {/* ── HEADER ── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        paddingBottom: 8,
        borderBottom: '1px solid hsl(var(--border-subtle))'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 4 }}>
            <Link href="/agenda-digital/admin" style={{ color: 'inherit', textDecoration: 'none' }}>Admin</Link>
            <ChevronRight size={14} />
            <Link href="/agenda-digital/admin/ajustes" style={{ color: 'inherit', textDecoration: 'none' }}>Ajustes</Link>
            <ChevronRight size={14} />
            <span style={{ color: '#4f46e5', fontWeight: 600 }}>Simulador de Push</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, fontFamily: 'Outfit, sans-serif', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Radio size={24} color="#6366f1" /> Central de Testes de Notificações Push
          </h1>
          <p style={{ margin: '4px 0 0', color: 'hsl(var(--text-muted))', fontSize: 14 }}>
            Dispare testes reais para alunos e responsáveis, simule qualquer tipo de evento e visualize o resultado no smartphone.
          </p>
        </div>

        {/* Status OneSignal Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {configStatus ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px',
              borderRadius: 20, fontSize: 12, fontWeight: 700,
              background: configStatus.isMockMode ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)',
              color: configStatus.isMockMode ? '#d97706' : '#059669',
              border: `1px solid ${configStatus.isMockMode ? '#f59e0b40' : '#10b98140'}`
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: configStatus.isMockMode ? '#f59e0b' : '#10b981',
                boxShadow: configStatus.isMockMode ? '0 0 8px #f59e0b' : '0 0 8px #10b981'
              }} />
              {configStatus.isMockMode ? 'OneSignal: Modo Mock (Simulado)' : `OneSignal Ativo (${configStatus.appIdPreview})`}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Verificando conexão...</div>
          )}

          <button
            onClick={() => { loadConfig(); loadRecentLogs(); }}
            className="btn btn-ghost btn-sm"
            title="Atualizar status e histórico"
            style={{ borderRadius: 10, padding: 8 }}
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* ── GRID PRINCIPAL: CONTROLES & PREVIEW ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 24, alignItems: 'start' }}>
        
        {/* COLUNA ESQUERDA: CONTROLES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* PASSO 1: SELEÇÃO DO ALUNO E DESTINATÁRIOS */}
          <div className="card" style={{ padding: 22, background: 'hsl(var(--bg-surface))', borderRadius: 16, position: 'relative', zIndex: 100 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>
                  1
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Para quem enviar? (Destinatário)</h3>
              </div>
              {selectedAluno && (
                <button
                  onClick={() => { setSelectedAluno(null); setGuardians([]); setSelectedRespIds([]); }}
                  style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Trocar aluno
                </button>
              )}
            </div>

            {!selectedAluno ? (
              <div ref={searchContainerRef} style={{ position: 'relative', zIndex: 110 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-main))' }}>
                  <Search size={18} color="hsl(var(--text-muted))" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => {
                      setSearchTerm(e.target.value)
                      setIsSearchOpen(true)
                    }}
                    onFocus={() => setIsSearchOpen(true)}
                    placeholder="Buscar aluno por nome, matrícula ou turma..."
                    style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 14, color: 'inherit' }}
                  />
                  {searchTerm && (
                    <button onClick={() => { setSearchTerm(''); setIsSearchOpen(false); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}>
                      <X size={16} />
                    </button>
                  )}
                </div>

                {/* Dropdown de sugestões de alunos */}
                {isSearchOpen && filteredAlunos.length > 0 && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                    background: 'hsl(var(--bg-surface))', border: '1.5px solid hsl(var(--border-default))',
                    borderRadius: 14, boxShadow: '0 25px 60px -10px rgba(0,0,0,0.4), 0 0 0 1px rgba(99, 102, 241, 0.25)',
                    zIndex: 99999, maxHeight: 340, overflowY: 'auto', padding: 8
                  }}>
                    {filteredAlunos.map((a: any) => (
                      <div
                        key={a.id}
                        onClick={() => handleSelectAluno(a)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                          borderRadius: 10, cursor: 'pointer', transition: 'background 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <UserAvatar name={a.nome} fotoUrl={a.foto} size={36} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {a.nome}
                          </div>
                          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', display: 'flex', gap: 8, marginTop: 2 }}>
                            <span>Turma: <b>{a.turma || '—'}</b></span>
                            <span>•</span>
                            <span>Matrícula: {a.matricula || a.id}</span>
                          </div>
                        </div>
                        <span style={{ fontSize: 12, color: '#4f46e5', fontWeight: 600 }}>Selecionar →</span>
                      </div>
                    ))}
                  </div>
                )}

                {isAlunosLoading && (
                  <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 8 }}>Carregando lista de alunos...</p>
                )}
                {!isAlunosLoading && searchTerm && filteredAlunos.length === 0 && (
                  <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginTop: 8, textAlign: 'center' }}>
                    Nenhum aluno encontrado para &quot;{searchTerm}&quot;
                  </p>
                )}
              </div>
            ) : (
              /* Aluno Selecionado */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: 14,
                  borderRadius: 12, background: 'rgba(99, 102, 241, 0.06)',
                  border: '1px solid rgba(99, 102, 241, 0.2)'
                }}>
                  <UserAvatar name={selectedAluno.nome} fotoUrl={selectedAluno.foto} size={48} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: 'hsl(var(--text-main))' }}>
                      {selectedAluno.nome}
                    </div>
                    <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
                      <span style={{ background: 'hsl(var(--bg-main))', padding: '2px 8px', borderRadius: 6, border: '1px solid hsl(var(--border-subtle))' }}>
                        Turma: <b>{selectedAluno.turma || '—'}</b>
                      </span>
                      <span style={{ background: 'hsl(var(--bg-main))', padding: '2px 8px', borderRadius: 6, border: '1px solid hsl(var(--border-subtle))' }}>
                        Matrícula: <b>{selectedAluno.matricula || selectedAluno.id}</b>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lista de Responsáveis Vinculados */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-main))' }}>
                      Destinatários vinculados ({guardians.length}):
                    </span>
                    {guardians.length > 0 && (
                      <button
                        onClick={() => {
                          if (selectedRespIds.length === guardians.length) setSelectedRespIds([])
                          else setSelectedRespIds(guardians.map(g => String(g.responsavel_id)))
                        }}
                        style={{ background: 'transparent', border: 'none', color: '#4f46e5', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        {selectedRespIds.length === guardians.length ? 'Desmarcar todos' : 'Selecionar todos'}
                      </button>
                    )}
                  </div>

                  {isLoadingGuardians ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 0', fontSize: 13, color: 'hsl(var(--text-muted))' }}>
                      <RefreshCw size={14} className="animate-spin" /> Carregando responsáveis cadastrados...
                    </div>
                  ) : guardians.length === 0 ? (
                    <div style={{ padding: '14px', borderRadius: 10, background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', fontSize: 13, color: '#d97706' }}>
                      Nenhum responsável vinculado na tabela <code>aluno_responsavel</code>. O envio de teste usará o ID do aluno ou fallback administrativo.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {guardians.map((g: any) => {
                        const isChecked = selectedRespIds.includes(String(g.responsavel_id))
                        return (
                          <label
                            key={g.responsavel_id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                              borderRadius: 10, border: `1px solid ${isChecked ? 'rgba(99, 102, 241, 0.4)' : 'hsl(var(--border-subtle))'}`,
                              background: isChecked ? 'rgba(99, 102, 241, 0.04)' : 'hsl(var(--bg-main))',
                              cursor: 'pointer', transition: 'all 0.15s'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                if (e.target.checked) {
                                  setSelectedRespIds(prev => [...prev, String(g.responsavel_id)])
                                } else {
                                  setSelectedRespIds(prev => prev.filter(id => id !== String(g.responsavel_id)))
                                }
                              }}
                              style={{ width: 16, height: 16, accentColor: '#4f46e5' }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 700, fontSize: 13 }}>{g.nome}</span>
                                <span style={{
                                  fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 700,
                                  background: 'rgba(99, 102, 241, 0.12)', color: '#4f46e5'
                                }}>
                                  {g.parentesco || 'Responsável'}
                                </span>
                                {g.isFinanceiro && (
                                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 700, background: 'rgba(244, 63, 94, 0.12)', color: '#f43f5e' }}>
                                    Financeiro
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2, display: 'flex', gap: 8 }}>
                                <span>{g.email || 'Sem email'}</span>
                                {g.telefone && <span>• {g.telefone}</span>}
                              </div>
                            </div>
                            <span style={{
                              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
                              background: g.temContaAtiva ? 'rgba(16, 185, 129, 0.12)' : 'rgba(100, 116, 139, 0.1)',
                              color: g.temContaAtiva ? '#10b981' : '#64748b'
                            }}>
                              {g.temContaAtiva ? 'Conta no App' : 'Sem Login'}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )}

                  {/* Toggle para envio direto ao aluno */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, fontSize: 12, color: 'hsl(var(--text-muted))', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={includeAlunoDirect}
                      onChange={e => setIncludeAlunoDirect(e.target.checked)}
                      style={{ accentColor: '#4f46e5' }}
                    />
                    <span>Disparar também para o acesso direto do aluno (alias <code>aluno_id</code>)</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* PASSO 2: SELEÇÃO DO TIPO DE NOTIFICAÇÃO PUSH */}
          <div className="card" style={{ padding: 22, background: 'hsl(var(--bg-surface))', borderRadius: 16, position: 'relative', zIndex: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>
                2
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Qual tipo de notificação testar?</h3>
                <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', margin: '2px 0 0' }}>Selecione uma das categorias de push suportadas pela Agenda Digital.</p>
              </div>
            </div>

            {/* Categorias Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 18 }}>
              {(Object.keys(CATEGORY_DEFINITIONS) as PushCategory[]).map(catKey => {
                const def = CATEGORY_DEFINITIONS[catKey]
                const Icon = def.icon
                const isActive = activeCategory === catKey
                return (
                  <button
                    key={catKey}
                    onClick={() => handleCategoryChange(catKey)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                      padding: '12px 10px', borderRadius: 12,
                      border: `1.5px solid ${isActive ? def.color : 'hsl(var(--border-subtle))'}`,
                      background: isActive ? def.bgLight : 'hsl(var(--bg-main))',
                      cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center'
                    }}
                  >
                    <div style={{
                      width: 34, height: 34, borderRadius: 10,
                      background: isActive ? def.color : 'rgba(100, 116, 139, 0.1)',
                      color: isActive ? 'white' : 'hsl(var(--text-muted))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Icon size={18} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: isActive ? 800 : 600, color: isActive ? def.color : 'inherit', lineHeight: 1.2 }}>
                      {def.label}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Cenários / Presets da categoria ativa */}
            <div style={{ background: 'hsl(var(--bg-main))', padding: 14, borderRadius: 12, border: '1px solid hsl(var(--border-subtle))' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Cenários pré-configurados ({CATEGORY_DEFINITIONS[activeCategory].presets.length}):
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {CATEGORY_DEFINITIONS[activeCategory].presets.map(p => {
                  const isSelected = selectedPresetId === p.id
                  return (
                    <button
                      key={p.id}
                      onClick={() => handlePresetSelect(p)}
                      style={{
                        padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: isSelected ? 700 : 500,
                        border: `1px solid ${isSelected ? CATEGORY_DEFINITIONS[activeCategory].color : 'hsl(var(--border-subtle))'}`,
                        background: isSelected ? CATEGORY_DEFINITIONS[activeCategory].color : 'hsl(var(--bg-surface))',
                        color: isSelected ? 'white' : 'inherit',
                        cursor: 'pointer', transition: 'all 0.15s'
                      }}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* PASSO 3: EDITOR DO CONTEÚDO DO PUSH */}
          <div className="card" style={{ padding: 22, background: 'hsl(var(--bg-surface))', borderRadius: 16, position: 'relative', zIndex: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>
                3
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Conteúdo da Notificação</h3>
                <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', margin: '2px 0 0' }}>Personalize os textos ou use variáveis dinâmicas.</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Título */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Título do Push</label>
                  <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{title.length}/60 carac.</span>
                </div>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', borderRadius: 10 }}
                  placeholder="Ex: 📢 Comunicado Importante"
                />
              </div>

              {/* Mensagem / Corpo */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Mensagem / Corpo</label>
                  <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{message.length}/140 carac.</span>
                </div>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={3}
                  className="form-input"
                  style={{ width: '100%', borderRadius: 10, resize: 'vertical' }}
                  placeholder="Digite a mensagem da notificação..."
                />
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Inserir variável:</span>
                  <button
                    type="button"
                    onClick={() => setMessage(m => m + ' {aluno}')}
                    style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: 'rgba(99,102,241,0.1)', color: '#4f46e5', border: 'none', cursor: 'pointer' }}
                  >
                    + &#123;aluno&#125;
                  </button>
                  <button
                    type="button"
                    onClick={() => setMessage(m => m + ' {turma}')}
                    style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: 'rgba(99,102,241,0.1)', color: '#4f46e5', border: 'none', cursor: 'pointer' }}
                  >
                    + &#123;turma&#125;
                  </button>
                  <button
                    type="button"
                    onClick={() => setMessage(m => m + ' {hora}')}
                    style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: 'rgba(99,102,241,0.1)', color: '#4f46e5', border: 'none', cursor: 'pointer' }}
                  >
                    + &#123;hora&#125;
                  </button>
                </div>
              </div>

              {/* Rota Interna ao Clicar */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  Ação ao Clicar (Rota de Redirecionamento no App)
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={targetRoute}
                    onChange={e => setTargetRoute(e.target.value)}
                    className="form-input"
                    style={{ flex: 1, borderRadius: 10, fontSize: 13 }}
                    placeholder="/{alunoId}/comunicados, /frequencia, /notas..."
                  />
                </div>
                <p style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4 }}>
                  Destino final montado: <code>{previewTargetUrl}</code>
                </p>
              </div>

              {/* Opções Avançadas */}
              <div style={{ padding: 12, borderRadius: 10, background: 'hsl(var(--bg-main))', border: '1px solid hsl(var(--border-subtle))' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={bypassDedup}
                    onChange={e => setBypassDedup(e.target.checked)}
                    style={{ accentColor: '#4f46e5' }}
                  />
                  <span>
                    <b>Bypass de Deduplicação:</b> Gera um identificador único de teste para permitir disparos repetidos sem bloqueio de 5 minutos.
                  </span>
                </label>
              </div>

              {/* Botão de Disparo */}
              <button
                onClick={handleSendTestPush}
                disabled={isSending}
                className="btn btn-primary"
                style={{
                  padding: '14px 20px', borderRadius: 12, background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  color: 'white', fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  boxShadow: '0 8px 20px rgba(99, 102, 241, 0.35)', border: 'none', cursor: isSending ? 'not-allowed' : 'pointer'
                }}
              >
                {isSending ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" /> Disparando Notificação Push...
                  </>
                ) : (
                  <>
                    <Send size={18} /> Disparar Push de Teste Agora
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: PREVIEW SMARTPHONE & RESULTADOS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* SIMULADOR EM TEMPO REAL (MOCKUP SMARTPHONE) */}
          <div className="card" style={{ padding: 22, background: 'hsl(var(--bg-surface))', borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Smartphone size={18} color="#6366f1" />
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Simulador no Aparelho</h3>
              </div>
              <div style={{ display: 'flex', gap: 4, background: 'hsl(var(--bg-main))', padding: 3, borderRadius: 8, border: '1px solid hsl(var(--border-subtle))' }}>
                <button
                  onClick={() => setPreviewPlatform('ios')}
                  style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
                    background: previewPlatform === 'ios' ? '#4f46e5' : 'transparent',
                    color: previewPlatform === 'ios' ? 'white' : 'inherit'
                  }}
                >
                  iOS
                </button>
                <button
                  onClick={() => setPreviewPlatform('android')}
                  style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
                    background: previewPlatform === 'android' ? '#4f46e5' : 'transparent',
                    color: previewPlatform === 'android' ? 'white' : 'inherit'
                  }}
                >
                  Android
                </button>
              </div>
            </div>

            {/* Smartphone Frame */}
            <div style={{
              width: '100%', maxWidth: 360, margin: '0 auto',
              background: '#0f172a', borderRadius: 32, padding: '16px 14px 28px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)', border: '4px solid #334155',
              position: 'relative', overflow: 'hidden'
            }}>
              {/* Dynamic Island / Notch */}
              <div style={{
                width: previewPlatform === 'ios' ? 100 : 12, height: previewPlatform === 'ios' ? 24 : 12,
                borderRadius: previewPlatform === 'ios' ? 14 : '50%',
                background: '#000', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {previewPlatform === 'ios' && (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1e293b', marginLeft: 'auto', marginRight: 10 }} />
                )}
              </div>

              {/* Status Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#94a3b8', padding: '0 10px 14px', fontWeight: 600 }}>
                <span>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span>5G</span>
                  <div style={{ width: 18, height: 9, border: '1px solid #94a3b8', borderRadius: 3, padding: 1 }}>
                    <div style={{ width: '80%', height: '100%', background: '#10b981', borderRadius: 1 }} />
                  </div>
                </div>
              </div>

              {/* Notificação Push Banner */}
              <div style={{
                background: previewPlatform === 'ios' ? 'rgba(30, 41, 59, 0.95)' : '#1e293b',
                backdropFilter: 'blur(16px)', borderRadius: 16, padding: '12px 14px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                animation: 'pulse 2s infinite'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: 6,
                      background: CATEGORY_DEFINITIONS[activeCategory].color,
                      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900
                    }}>
                      AD
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>
                      Agenda Digital
                    </span>
                  </div>
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>agora</span>
                </div>

                <div style={{ fontWeight: 800, fontSize: 13, color: '#f8fafc', marginBottom: 3, lineHeight: 1.3 }}>
                  {previewTitle || 'Título da Notificação'}
                </div>
                <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.4 }}>
                  {previewMessage || 'Mensagem da notificação...'}
                </div>

                <div style={{
                  marginTop: 8, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, color: '#38bdf8'
                }}>
                  <span>Toque para abrir</span>
                  <span>{targetRoute || '/agenda-digital'} →</span>
                </div>
              </div>

              {/* Wallpaper Fake Elements */}
              <div style={{ marginTop: 60, textAlign: 'center', color: '#475569', fontSize: 12 }}>
                <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>Simulação de Tela de Bloqueio</p>
              </div>
            </div>
          </div>

          {/* CARD DE RESULTADO DO ÚLTIMO DISPARO */}
          {lastResult && (
            <div className="card" style={{
              padding: 20, borderRadius: 16,
              background: lastResult.success ? 'rgba(16, 185, 129, 0.06)' : 'rgba(239, 68, 68, 0.06)',
              border: `1.5px solid ${lastResult.success ? '#10b981' : '#ef4444'}`
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                {lastResult.success ? (
                  <CheckCircle2 size={24} color="#10b981" style={{ flexShrink: 0 }} />
                ) : (
                  <AlertTriangle size={24} color="#ef4444" style={{ flexShrink: 0 }} />
                )}
                <div style={{ flex: 1 }}>
                  <h4 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: lastResult.success ? '#059669' : '#dc2626' }}>
                    {lastResult.success
                      ? (lastResult.mock ? 'Push Simulado com Sucesso (Modo Mock)' : 'Push Disparado com Sucesso!')
                      : 'Falha no Envio da Notificação'}
                  </h4>
                  <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', margin: '4px 0 0' }}>
                    {lastResult.error || (lastResult.mock ? 'As credenciais do OneSignal não estão configuradas neste servidor, portanto o disparo foi registrado e auditado sem chamar a API externa.' : 'Requisição processada pelo serviço de notificações.')}
                  </p>
                </div>
              </div>

              {lastResult.warning && (
                <div style={{ padding: 10, borderRadius: 8, background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: 12, color: '#d97706', marginBottom: 12 }}>
                  💡 <b>Aviso:</b> {lastResult.warning}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 11, color: 'hsl(var(--text-muted))', marginBottom: 10 }}>
                <div>ID OneSignal: <b style={{ color: 'hsl(var(--text-main))' }}>{lastResult.notificationId || 'N/A (mock)'}</b></div>
                <div>Aparelhos Atingidos: <b style={{ color: 'hsl(var(--text-main))' }}>{lastResult.recipients ?? 0}</b></div>
                <div>Alvos Resolvidos: <b style={{ color: 'hsl(var(--text-main))' }}>{lastResult.targetCount ?? 0}</b></div>
                <div>Tipo de Evento: <b style={{ color: 'hsl(var(--text-main))' }}>{lastResult.itemId?.split('-')[1] || activeCategory}</b></div>
              </div>

              {lastResult.targetDetails && lastResult.targetDetails.length > 0 && (
                <div style={{ background: 'hsl(var(--bg-main))', padding: 10, borderRadius: 8, fontSize: 11 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Destinatários atingidos no disparo:</div>
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {lastResult.targetDetails.map((td: any, i: number) => (
                      <li key={i}>
                        <b>{td.nome}</b> ({td.tipo}) — ID: <code>{td.id}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* HISTÓRICO RECENTE DE DISPAROS DE TESTE */}
          <div className="card" style={{ padding: 22, background: 'hsl(var(--bg-surface))', borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={16} color="hsl(var(--text-muted))" />
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Histórico de Disparos</h3>
              </div>
              <button
                onClick={loadRecentLogs}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11, padding: '4px 8px' }}
              >
                Atualizar
              </button>
            </div>

            {isLoadingLogs ? (
              <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                Carregando histórico...
              </div>
            ) : recentLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                Nenhum disparo registrado até o momento.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                {recentLogs.slice(0, 10).map((log: any) => {
                  const isSuccess = log.status === 'sent'
                  const catDef = CATEGORY_DEFINITIONS[log.type as PushCategory] || CATEGORY_DEFINITIONS.test
                  return (
                    <div
                      key={log.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 12px', borderRadius: 10, background: 'hsl(var(--bg-main))',
                        border: '1px solid hsl(var(--border-subtle))', fontSize: 12
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1, paddingRight: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: isSuccess ? '#10b981' : '#ef4444'
                          }} />
                          <span style={{ fontWeight: 700, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {log.title}
                          </span>
                        </div>
                        <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 2, display: 'flex', gap: 6 }}>
                          <span style={{ color: catDef.color, fontWeight: 600 }}>{catDef.label}</span>
                          <span>•</span>
                          <span>{new Date(log.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => setViewLogDetail(log)}
                        style={{ background: 'transparent', border: 'none', color: '#4f46e5', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
                      >
                        Ver Detalhes
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MODAL DE DETALHES DO LOG ── */}
      {viewLogDetail && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20
        }} onClick={() => setViewLogDetail(null)}>
          <div style={{
            background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))',
            borderRadius: 20, padding: 24, maxWidth: 540, width: '100%', maxHeight: '80vh', overflowY: 'auto'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Detalhes do Disparo #{viewLogDetail.id}</h3>
              <button onClick={() => setViewLogDetail(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
              <div><b>Título:</b> {viewLogDetail.title}</div>
              <div><b>Mensagem:</b> {viewLogDetail.message}</div>
              <div><b>Tipo de Notificação:</b> <code>{viewLogDetail.type}</code></div>
              <div><b>Status:</b> <span style={{ fontWeight: 700, color: viewLogDetail.status === 'sent' ? '#10b981' : '#ef4444' }}>{viewLogDetail.status}</span></div>
              <div><b>Destinatários:</b> {viewLogDetail.target_count || 0} usuário(s)</div>
              <div><b>URL de Destino:</b> <code>{viewLogDetail.target_url}</code></div>
              <div><b>Horário:</b> {new Date(viewLogDetail.created_at).toLocaleString('pt-BR')}</div>

              {viewLogDetail.error_message && (
                <div style={{ padding: 10, borderRadius: 8, background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444' }}>
                  <b>Erro/Aviso:</b> {viewLogDetail.error_message}
                </div>
              )}

              {viewLogDetail.onesignal_response && (
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Resposta OneSignal (JSON):</div>
                  <pre style={{ background: 'hsl(var(--bg-main))', padding: 10, borderRadius: 8, fontSize: 11, overflowX: 'auto' }}>
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(viewLogDetail.onesignal_response), null, 2)
                      } catch {
                        return viewLogDetail.onesignal_response
                      }
                    })()}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
