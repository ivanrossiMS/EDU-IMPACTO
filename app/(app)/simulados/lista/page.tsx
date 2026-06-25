'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, Calendar, Layers, ChevronRight, PenTool, ChevronDown, FileDown, CheckSquare, Copy, Trash2, User } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/context'
import { GabaritoModal } from '@/components/simulados/GabaritoModal'

export default function SimuladosListaPage() {
  const [simulados, setSimulados] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsedBimesters, setCollapsedBimesters] = useState<Record<string, boolean>>({})
  const [collapsedTurmas, setCollapsedTurmas] = useState<Record<string, boolean>>({})
  const [professoresMap, setProfessoresMap] = useState<Record<string, string>>({})
  const [gabaritoModalId, setGabaritoModalId] = useState<string | null>(null)
  const router = useRouter()
  const { currentUserPerfil, currentUser, hydrated } = useApp()
  const isProfessor = currentUserPerfil === 'Professor'

  const toggleBimester = (bimester: string) => {
    setCollapsedBimesters(prev => ({
      ...prev,
      [bimester]: !prev[bimester]
    }))
  }

  const toggleTurma = (bimester: string, turma: string) => {
    const key = `${bimester}-${turma}`
    setCollapsedTurmas(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const handleAprovarToggle = async (e: React.MouseEvent, id: string, currentStatus: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    const newStatus = currentStatus === 'aprovado' ? 'rascunho' : 'aprovado'
    const isApproving = newStatus === 'aprovado'
    
    if (!window.confirm(isApproving ? 'Confirmar aprovação deste simulado?' : 'Reverter simulado para rascunho?')) return

    let approverName = 'Usuário Atual'
    if (isApproving) {
      try {
        const res = await fetch('/api/auth/me')
        if (res.ok) {
          const { user } = await res.json()
          approverName = user?.nome || user?.full_name || user?.email?.split('@')[0] || 'Usuário Atual'
        }
      } catch(e) {
        // fallback if api fails
        const { data: { user } } = await supabase.auth.getUser()
        approverName = user?.user_metadata?.nome || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário Atual'
      }
    }
    
    const now = isApproving ? new Date().toISOString() : null
    
    const { error } = await supabase.from('simulados').update({ 
      status: newStatus,
      ...(isApproving ? { aprovado_por: approverName, data_aprovacao: now } : { aprovado_por: null, data_aprovacao: null })
    }).eq('id', id)
    
    if (!error) {
      setSimulados(prev => prev.map(s => s.id === id ? { ...s, status: newStatus, aprovado_por: approverName, data_aprovacao: now } : s))
    } else {
      // Fallback: try updating just the status if the first one failed (likely due to missing columns)
      const fallback = await supabase.from('simulados').update({ status: newStatus }).eq('id', id)
      
      if (!fallback.error) {
         setSimulados(prev => prev.map(s => s.id === id ? { ...s, status: newStatus, aprovado_por: approverName, data_aprovacao: now } : s))
         if (isApproving) {
           alert('Aprovado visualmente!\\n\\nAVISO: Ocorreu um erro ao salvar o nome de quem aprovou. As colunas "aprovado_por" (tipo text) e "data_aprovacao" (tipo timestamp) precisam ser criadas na tabela "simulados" no seu Supabase para salvar essa informação permanentemente no banco.')
         }
      } else {
         alert('Erro ao atualizar status: ' + fallback.error.message)
      }
    }
  }

  const handleAction = (e: React.MouseEvent, action: string, simuladoId: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (action === 'excluir') {
      if (window.confirm('Tem certeza que deseja excluir este simulado? Esta ação não pode ser desfeita.')) {
        supabase.from('simulados').delete().eq('id', simuladoId).then(({ error }) => {
          if (!error) {
            setSimulados(prev => prev.filter(s => s.id !== simuladoId))
          } else {
            alert('Erro ao excluir simulado.')
          }
        })
      }
    } else if (action === 'gerenciar') {
      router.push(`/simulados/lista/${simuladoId}`)
    } else if (action === 'gerar_pdf') {
      window.open(`/simulados/imprimir/${simuladoId}`, '_blank')
    } else if (action === 'gerar_gabarito') {
      setGabaritoModalId(simuladoId)
    } else if (action === 'adaptar') {
      router.push(`/simulados/adaptar/${simuladoId}`)
    } else {
      alert(`Ação de ${action} em desenvolvimento.`)
    }
  }

  useEffect(() => {
    if (!hydrated) return
    async function loadData() {
      const { data } = await supabase.from('simulados').select(`
        *,
        simulados_bimestres ( nome ),
        simulados_questoes ( id, id_professor, id_disciplina ),
        simulados_requisicoes ( id_professor, id_disciplina, quantidade_questoes, simulados_disciplinas ( nome ) )
      `).order('created_at', { ascending: false })

      try {
        const res = await fetch('/api/configuracoes/usuarios?type=colaboradores')
        if (res.ok) {
          const json = await res.json()
          const users = json.data || json
          const profMap: Record<string, string> = {}
          users.forEach((u: any) => { profMap[u.id] = u.nome })
          setProfessoresMap(profMap)
        }
      } catch(e) {}

      if (data) {
        let processedData = data

        if (isProfessor && currentUser) {
          processedData = processedData.filter(s => {
            const reqs = s.simulados_requisicoes || []
            return reqs.some((r: any) => r.id_professor === currentUser.id)
          })
        }

        setSimulados(processedData.map(s => ({
          ...s,
          questoesCadastradas: s.simulados_questoes?.length || 0
        })))
      }
      setLoading(false)
    }
    loadData()
  }, [hydrated, isProfessor, currentUser])

  return (
    <div style={{ padding: '40px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.02em' }}>Meus Simulados</h1>
            <p style={{ color: 'hsl(var(--text-secondary))', margin: '2px 0 0', fontSize: 14 }}>Selecione um simulado para gerenciar suas questões e gabarito</p>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div style={{ color: 'hsl(var(--text-secondary))' }}>Carregando simulados...</div>
          </div>
        ) : simulados.length === 0 ? (
          <div style={{ 
            background: 'hsl(var(--bg-surface))', 
            border: '1px solid hsl(var(--border-subtle))', 
            borderRadius: 20, 
            padding: 60,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center'
          }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <FileText size={32} />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'hsl(var(--text-primary))', margin: '0 0 8px' }}>Nenhum Simulado Encontrado</h2>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 14, margin: '0 0 24px', maxWidth: 400 }}>
              {isProfessor ? 'Você ainda não foi vinculado a nenhum simulado. Aguarde novas requisições da coordenação.' : 'Você ainda não possui nenhum simulado cadastrado. Vá até a tela de Gerenciamento para criar o seu primeiro simulado.'}
            </p>
            {!isProfessor && (
              <button onClick={() => router.push('/simulados/gerenciamento/novo')} style={{ background: '#3b82f6', color: 'white', padding: '10px 20px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                Criar Simulado
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
            {Object.keys(simulados.reduce((acc, curr) => {
              const bimester = curr.simulados_bimestres?.nome || 'Sem Bimestre'
              if (!acc[bimester]) acc[bimester] = []
              acc[bimester].push(curr)
              return acc
            }, {} as Record<string, any[]>)).sort((a, b) => a.localeCompare(b)).map(bimester => {
              const bimesterSimulados = simulados.filter(s => (s.simulados_bimestres?.nome || 'Sem Bimestre') === bimester)
              const isCollapsed = collapsedBimesters[bimester]
              
              // Group by Turma
              const turmasMap: Record<string, any[]> = {}
              bimesterSimulados.forEach(s => {
                const turmas = s.turmas && s.turmas.length > 0 ? s.turmas : ['Geral']
                turmas.forEach((t: string) => {
                  if (!turmasMap[t]) turmasMap[t] = []
                  turmasMap[t].push(s)
                })
              })
              const turmasList = Object.keys(turmasMap).sort((a, b) => a.localeCompare(b))
              
              return (
                <div key={bimester}>
                  <div 
                    onClick={() => toggleBimester(bimester)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      marginBottom: isCollapsed ? 0 : 20, 
                      padding: '16px 24px', 
                      background: 'hsl(var(--bg-surface))',
                      border: '1px solid hsl(var(--border-subtle))',
                      borderRadius: 16,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                      cursor: 'pointer', 
                      userSelect: 'none',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = '#3b82f6'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(59,130,246,0.1)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', width: 36, height: 36, background: 'rgba(59,130,246,0.1)', borderRadius: 10 }}>
                        <Layers size={20} />
                      </div>
                      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'hsl(var(--text-primary))', margin: 0 }}>
                        {bimester}
                      </h2>
                      <span style={{ marginLeft: 8, fontSize: 12, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', padding: '4px 12px', borderRadius: 100, fontWeight: 700, letterSpacing: '0.02em' }}>
                        {bimesterSimulados.length} SIMULADO{bimesterSimulados.length !== 1 ? 'S' : ''}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-secondary))', transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                      <ChevronDown size={24} />
                    </div>
                  </div>
                  
                  {!isCollapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                      {turmasList.map(turma => {
                        const turmaKey = `${bimester}-${turma}`
                        const isTurmaCollapsed = collapsedTurmas[turmaKey]
                        return (
                          <div key={turma}>
                            <div
                              onClick={() => toggleTurma(bimester, turma)}
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                marginBottom: isTurmaCollapsed ? 0 : 16, 
                                padding: '12px 20px', 
                                background: 'hsl(var(--bg-app))',
                                border: '1px solid hsl(var(--border-subtle))',
                                borderRadius: 12,
                                cursor: 'pointer', 
                                userSelect: 'none',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.borderColor = '#3b82f6'
                                e.currentTarget.style.background = 'rgba(59,130,246,0.02)'
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'
                                e.currentTarget.style.background = 'hsl(var(--bg-app))'
                              }}
                            >
                              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--text-primary))', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />
                                Turma: {turma}
                                <span style={{ marginLeft: 8, fontSize: 11, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', padding: '2px 8px', borderRadius: 100, fontWeight: 700 }}>
                                  {turmasMap[turma].length} DISCIPLINA{turmasMap[turma].length !== 1 ? 'S' : ''}
                                </span>
                              </h3>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-secondary))', transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)', transform: isTurmaCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                                <ChevronDown size={20} />
                              </div>
                            </div>
                            {!isTurmaCollapsed && (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24, marginBottom: 24 }}>
                                {turmasMap[turma].map((s, i) => {
                                  const qCadastradas = s.questoesCadastradas || 0;
                                  const qRequisitadas = s.simulados_requisicoes?.reduce((acc: number, req: any) => acc + (req.quantidade_questoes || 0), 0) || 0;
                                  const percent = qRequisitadas > 0 ? Math.min(Math.round((qCadastradas / qRequisitadas) * 100), 100) : 0;
                                  const isComplete = qRequisitadas > 0 && qCadastradas >= qRequisitadas;

                                  return (
                                    <motion.div key={`${turma}-${s.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                                      <div 
                                        style={{ 
                                        background: 'hsl(var(--bg-surface))', 
                                        border: '1px solid hsl(var(--border-subtle))', 
                                        borderRadius: 20, 
                                        padding: 24,
                                        transition: 'all 0.2s',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                                      }}
                                      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                                      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                                      >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(244,63,94,0.1)', color: '#f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <PenTool size={20} />
                                          </div>
                                          {s.status === 'aprovado' ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                          <span 
                                            onClick={(e) => handleAprovarToggle(e, s.id, s.status)}
                                            title="Clique para reverter para Rascunho"
                                            style={{ padding: '4px 10px', borderRadius: 100, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.2)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(16,185,129,0.1)'}
                                          >Aprovado</span>
                                          {s.aprovado_por && (
                                            <span style={{ fontSize: 10, color: 'hsl(var(--text-secondary))', marginTop: 4 }}>
                                              Aprovado por {s.aprovado_por} em {s.data_aprovacao ? new Date(s.data_aprovacao).toLocaleDateString('pt-BR') : ''}
                                            </span>
                                          )}
                                        </div>
                                      ) : s.status === 'publicado' ? (
                                        <span style={{ padding: '4px 10px', borderRadius: 100, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Publicado</span>
                                      ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                          <span 
                                            onClick={(e) => handleAprovarToggle(e, s.id, s.status || 'rascunho')}
                                            title="Clique para aprovar"
                                            style={{ padding: '4px 10px', borderRadius: 100, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.2)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(245,158,11,0.1)'}
                                          >
                                            Rascunho
                                          </span>
                                        </div>
                                      )}
                                        </div>
                                        
                                        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'hsl(var(--text-primary))', margin: '0 0 16px', lineHeight: 1.3 }}>{s.titulo}</h3>
                                        
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'hsl(var(--text-secondary))', fontSize: 13 }}>
                                            <Calendar size={14} />
                                            <span>Aplicação: {s.data_aplicacao?.split('-').reverse().join('/') || 'Não definida'}</span>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'hsl(var(--text-secondary))', fontSize: 13 }}>
                                            <Layers size={14} />
                                            <span>{s.simulados_bimestres?.nome || 'Bimestre não definido'}</span>
                                          </div>
                                          <div style={{ marginTop: 8, marginBottom: 8 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 13 }}>
                                              <span style={{ color: 'hsl(var(--text-secondary))', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <FileText size={14} /> Progresso
                                              </span>
                                              <span style={{ color: isComplete ? '#10b981' : '#3b82f6', fontWeight: 700 }}>
                                                {qCadastradas} / {qRequisitadas} ({percent}%)
                                              </span>
                                            </div>
                                            <div style={{ width: '100%', height: 6, background: 'hsl(var(--border-subtle))', borderRadius: 4, overflow: 'hidden' }}>
                                              <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${percent}%` }}
                                                transition={{ duration: 1, ease: 'easeOut' }}
                                                style={{ height: '100%', background: isComplete ? '#10b981' : '#3b82f6', borderRadius: 4 }}
                                              />
                                            </div>
                                          </div>
                                          {s.simulados_requisicoes && s.simulados_requisicoes.length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                                              {s.simulados_requisicoes.map((req: any, idx: number) => {
                                                const profName = professoresMap[req.id_professor] || 'Professor não encontrado'
                                                const discName = req.simulados_disciplinas?.nome || 'Sem Disciplina'
                                                const requestedQty = req.quantidade_questoes || 0
                                                const currentQty = s.simulados_questoes?.filter((q: any) => 
                                                  q.id_professor === req.id_professor && q.id_disciplina === req.id_disciplina
                                                ).length || 0

                                                return (
                                                  <div 
                                                    key={idx} 
                                                    onClick={() => router.push(`/simulados/lista/${s.id}?professor=${req.id_professor}&disciplina=${req.id_disciplina}`)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'hsl(var(--text-secondary))', fontSize: 13, background: 'hsl(var(--bg-app))', padding: '8px 12px', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))', cursor: 'pointer', transition: 'all 0.2s' }}
                                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = 'rgba(59,130,246,0.02)' }}
                                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'; e.currentTarget.style.background = 'hsl(var(--bg-app))' }}
                                                  >
                                                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                      <User size={16} />
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                                                      <span style={{ fontWeight: 600, color: 'hsl(var(--text-primary))', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profName}</span>
                                                      <span style={{ fontSize: 12, opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{discName}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: currentQty >= requestedQty ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: currentQty >= requestedQty ? '#10b981' : '#f59e0b', padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                                                      {currentQty}/{requestedQty} quest.
                                                    </div>
                                                  </div>
                                                )
                                              })}
                                            </div>
                                          ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'hsl(var(--text-secondary))', fontSize: 13 }}>
                                              <User size={14} />
                                              <span>Nenhum professor atribuído</span>
                                            </div>
                                          )}
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                                          <button onClick={(e) => handleAction(e, 'gerar_pdf', s.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, color: 'hsl(var(--text-secondary))', cursor: 'pointer', transition: 'all 0.2s' }} title="Gerar PDF" onMouseEnter={e => { e.currentTarget.style.color = '#3b82f6'; e.currentTarget.style.borderColor = '#3b82f6' }} onMouseLeave={e => { e.currentTarget.style.color = 'hsl(var(--text-secondary))'; e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))' }}>
                                            <FileDown size={14} /> <span style={{ fontSize: 12, fontWeight: 600 }}>PDF</span>
                                          </button>
                                          <button onClick={(e) => handleAction(e, 'gerar_gabarito', s.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, color: 'hsl(var(--text-secondary))', cursor: 'pointer', transition: 'all 0.2s' }} title="Gerar Gabarito" onMouseEnter={e => { e.currentTarget.style.color = '#10b981'; e.currentTarget.style.borderColor = '#10b981' }} onMouseLeave={e => { e.currentTarget.style.color = 'hsl(var(--text-secondary))'; e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))' }}>
                                            <CheckSquare size={14} /> <span style={{ fontSize: 12, fontWeight: 600 }}>Gabarito</span>
                                          </button>
                                          <button onClick={(e) => handleAction(e, 'adaptar', s.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, color: 'hsl(var(--text-secondary))', cursor: 'pointer', transition: 'all 0.2s' }} title="Adaptar Simulado" onMouseEnter={e => { e.currentTarget.style.color = '#8b5cf6'; e.currentTarget.style.borderColor = '#8b5cf6' }} onMouseLeave={e => { e.currentTarget.style.color = 'hsl(var(--text-secondary))'; e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))' }}>
                                            <Copy size={14} /> <span style={{ fontSize: 12, fontWeight: 600 }}>Adaptar</span>
                                          </button>
                                          <button onClick={(e) => handleAction(e, 'excluir', s.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, color: 'hsl(var(--text-secondary))', cursor: 'pointer', transition: 'all 0.2s' }} title="Excluir Simulado" onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.05)' }} onMouseLeave={e => { e.currentTarget.style.color = 'hsl(var(--text-secondary))'; e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'; e.currentTarget.style.background = 'hsl(var(--bg-app))' }}>
                                            <Trash2 size={14} /> <span style={{ fontSize: 12, fontWeight: 600 }}>Excluir</span>
                                          </button>
                                        </div>

                                        <div 
                                          onClick={() => router.push(`/simulados/lista/${s.id}`)}
                                          style={{ borderTop: '1px solid hsl(var(--border-subtle))', paddingTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#3b82f6', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                                          onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                                          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                                        >
                                          <span>Ver Todas as Questões</span>
                                          <ChevronRight size={16} />
                                        </div>
                                      </div>
                                  </motion.div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </motion.div>

      {gabaritoModalId && (
        <GabaritoModal
          simuladoId={gabaritoModalId}
          onClose={() => setGabaritoModalId(null)}
        />
      )}
    </div>
  )
}

