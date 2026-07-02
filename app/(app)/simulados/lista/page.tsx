'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Calendar, Layers, ChevronRight, PenTool, ChevronDown, FileDown, CheckSquare, Copy, Trash2, User, RefreshCw, BookOpen } from 'lucide-react'
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
  const [shakeId, setShakeId] = useState<string | null>(null)
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
        const { data: { user } } = await supabase.auth.getUser()
        approverName = user?.user_metadata?.nome || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário Atual'
      }
    }
    
    const now = isApproving ? new Date().toISOString() : null
    
    const { error } = await (supabase as any).from('simulados').update({ 
      status: newStatus,
      ...(isApproving ? { aprovado_por: approverName, data_aprovacao: now } : { aprovado_por: null, data_aprovacao: null })
    }).eq('id', id)
    
    if (!error) {
      setSimulados(prev => prev.map(s => s.id === id ? { ...s, status: newStatus, aprovado_por: approverName, data_aprovacao: now } : s))
    } else {
      const fallback = await (supabase as any).from('simulados').update({ status: newStatus }).eq('id', id)
      
      if (!fallback.error) {
         setSimulados(prev => prev.map(s => s.id === id ? { ...s, status: newStatus, aprovado_por: approverName, data_aprovacao: now } : s))
         if (isApproving) {
           alert('Aprovado visualmente!\n\nAVISO: Ocorreu um erro ao salvar o nome de quem aprovou. As colunas "aprovado_por" (tipo text) e "data_aprovacao" (tipo timestamp) precisam ser criadas na tabela "simulados" no seu Supabase para salvar essa informação permanentemente no banco.')
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
      router.push(`/simulados/imprimir/${simuladoId}`)
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
        const res = await fetch('/api/configuracoes/usuarios?type=colaboradores&limit=1000')
        if (res.ok) {
          const json = await res.json()
          const users = json.data || json
          const profMap: Record<string, string> = {}
          users.forEach((u: any) => { profMap[u.id] = u.nome })
          setProfessoresMap(profMap)
        }
      } catch(e) {}

      if (data) {
        let processedData = data as any[];

        if (isProfessor && currentUser) {
          processedData = processedData.filter((s: any) => {
            const reqs = s.simulados_requisicoes || []
            return reqs.some((r: any) => r.id_professor === currentUser.id)
          })
        }

        setSimulados(processedData.map((s: any) => ({
          ...s,
          questoesCadastradas: s.simulados_questoes?.length || 0
        })))
      }
      setLoading(false)
    }
    loadData()
  }, [hydrated, isProfessor, currentUser])

  return (
    <div className="page-container" style={{ padding: '40px', maxWidth: 1400, margin: '0 auto' }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        
        {/* HEADER */}
        <div className="header-box" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          marginBottom: 40,
          background: 'linear-gradient(135deg, hsl(var(--bg-surface)) 0%, hsl(var(--bg-elevated)) 100%)',
          padding: '24px 32px',
          borderRadius: 24,
          border: '1px solid hsl(var(--border-subtle))',
          boxShadow: '0 10px 30px -15px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(139,92,246,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(59,130,246,0.2)' }}>
              <BookOpen size={28} color="#3b82f6" />
            </div>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 900, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.03em' }}>Meus Simulados</h1>
              <p style={{ color: 'hsl(var(--text-secondary))', margin: '4px 0 0', fontSize: 14 }}>Selecione um simulado para gerenciar suas questões e estrutura</p>
            </div>
          </div>
          {!isProfessor && (
            <button className="action-btn"
              onClick={() => router.push('/simulados/gerenciamento/novo')} 
              style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', padding: '12px 24px', borderRadius: 12, textDecoration: 'none', fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 8px 20px -8px rgba(59,130,246,0.6)', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <PenTool size={18} /> Novo Simulado
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 100, background: 'hsl(var(--bg-surface))', borderRadius: 24, border: '1px solid hsl(var(--border-subtle))' }}>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} style={{ marginBottom: 16 }}>
              <RefreshCw size={32} color="#6366f1" />
            </motion.div>
            <div style={{ color: 'hsl(var(--text-secondary))', fontWeight: 600, fontSize: 16 }}>Sincronizando banco de dados...</div>
          </div>
        ) : simulados.length === 0 ? (
          <div style={{ 
            background: 'hsl(var(--bg-surface))', 
            border: '1px dashed hsl(var(--border-subtle))', 
            borderRadius: 24, 
            padding: 80,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center'
          }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(59,130,246,0.05)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <FileText size={40} />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: '0 0 12px', letterSpacing: '-0.02em' }}>Nenhum Simulado Encontrado</h2>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 15, margin: '0 0 32px', maxWidth: 450, lineHeight: 1.5 }}>
              {isProfessor ? 'Você ainda não foi vinculado a nenhum simulado. Aguarde novas requisições da coordenação.' : 'Você ainda não possui nenhum simulado cadastrado. Crie seu primeiro simulado agora mesmo.'}
            </p>
            {!isProfessor && (
              <button onClick={() => router.push('/simulados/gerenciamento/novo')} style={{ background: '#3b82f6', color: 'white', padding: '14px 28px', borderRadius: 12, fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 8px 20px -8px rgba(59,130,246,0.6)' }}>
                Criar Simulado Agora
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
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
                <motion.div key={bimester} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ background: 'transparent' }}>
                  {/* Bimestre Header */}
                  <div className="bimester-header"
                    onClick={() => toggleBimester(bimester)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      marginBottom: isCollapsed ? 0 : 24, 
                      padding: '20px 28px', 
                      background: 'linear-gradient(90deg, hsl(var(--bg-surface)) 0%, hsl(var(--bg-app)) 100%)',
                      border: '1px solid hsl(var(--border-subtle))',
                      borderLeft: '4px solid #6366f1',
                      borderRadius: 16,
                      boxShadow: '0 4px 20px -10px rgba(0,0,0,0.05)',
                      cursor: 'pointer', 
                      userSelect: 'none',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 8px 25px -10px rgba(99,102,241,0.15)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 4px 20px -10px rgba(0,0,0,0.05)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', width: 40, height: 40, background: 'rgba(99,102,241,0.1)', borderRadius: 12 }}>
                        <Layers size={22} />
                      </div>
                      <h2 style={{ fontSize: 20, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.02em' }}>
                        {bimester}
                      </h2>
                      <span style={{ marginLeft: 8, fontSize: 12, background: 'rgba(99,102,241,0.1)', color: '#6366f1', padding: '6px 14px', borderRadius: 100, fontWeight: 800, letterSpacing: '0.05em' }}>
                        {bimesterSimulados.length} SIMULADO{bimesterSimulados.length !== 1 ? 'S' : ''}
                      </span>
                    </div>

                    <motion.div animate={{ rotate: isCollapsed ? -90 : 0 }} transition={{ duration: 0.3 }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-secondary))', background: 'hsl(var(--bg-elevated))', width: 36, height: 36, borderRadius: '50%' }}>
                      <ChevronDown size={20} />
                    </motion.div>
                  </div>
                  
                  <AnimatePresence>
                    {!isCollapsed && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                        <div className="turma-container" style={{ display: 'flex', flexDirection: 'column', gap: 32, paddingLeft: 12 }}>
                          {turmasList.map(turma => {
                            const turmaKey = `${bimester}-${turma}`
                            const isTurmaCollapsed = collapsedTurmas[turmaKey]
                            return (
                              <div key={turma} style={{ position: 'relative' }}>
                                {/* Turma Line Connector */}
                                <div style={{ position: 'absolute', left: 24, top: 24, bottom: 0, width: 2, background: 'hsl(var(--border-subtle))', zIndex: 0 }} />

                                <div className="turma-header"
                                  onClick={() => toggleTurma(bimester, turma)}
                                  style={{ 
                                    position: 'relative',
                                    zIndex: 1,
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between',
                                    marginBottom: isTurmaCollapsed ? 0 : 20, 
                                    padding: '14px 24px', 
                                    background: 'hsl(var(--bg-surface))',
                                    border: '1px solid hsl(var(--border-subtle))',
                                    borderRadius: 14,
                                    cursor: 'pointer', 
                                    userSelect: 'none',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 4px 10px rgba(0,0,0,0.02)'
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.borderColor = '#8b5cf6'
                                    e.currentTarget.style.background = 'rgba(139,92,246,0.02)'
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'
                                    e.currentTarget.style.background = 'hsl(var(--bg-surface))'
                                  }}
                                >
                                  <h3 style={{ fontSize: 16, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#8b5cf6', boxShadow: '0 0 0 4px rgba(139,92,246,0.2)' }} />
                                    Turma: {turma}
                                    <span style={{ marginLeft: 8, fontSize: 11, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', padding: '4px 10px', borderRadius: 100, fontWeight: 700, letterSpacing: '0.05em' }}>
                                      {turmasMap[turma].length} ITEM{turmasMap[turma].length !== 1 ? 'S' : ''}
                                    </span>
                                  </h3>
                                  <motion.div animate={{ rotate: isTurmaCollapsed ? -90 : 0 }} style={{ color: 'hsl(var(--text-secondary))' }}>
                                    <ChevronDown size={20} />
                                  </motion.div>
                                </div>
                                
                                <AnimatePresence>
                                    {!isTurmaCollapsed && (
                                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                                        <div className="cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 24, paddingLeft: 48, paddingBottom: 24, paddingTop: 8 }}>
                                        {turmasMap[turma].map((s, i) => {
                                          const qCadastradas = s.questoesCadastradas || 0;
                                          const qRequisitadas = s.simulados_requisicoes?.reduce((acc: number, req: any) => acc + (req.quantidade_questoes || 0), 0) || 0;
                                          const percent = qRequisitadas > 0 ? Math.min(Math.round((qCadastradas / qRequisitadas) * 100), 100) : 0;
                                          const isComplete = qRequisitadas > 0 && qCadastradas >= qRequisitadas;

                                          return (
                                            <motion.div key={`${turma}-${s.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                                              <div className="simulado-card"
                                                style={{ 
                                                background: 'hsl(var(--bg-surface))', 
                                                backdropFilter: 'blur(10px)',
                                                border: '1px solid hsl(var(--border-subtle))', 
                                                borderRadius: 16, 
                                                padding: '20px',
                                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                boxShadow: '0 4px 15px -5px rgba(0,0,0,0.05)',
                                                position: 'relative',
                                                overflow: 'hidden'
                                              }}
                                              onMouseEnter={e => {
                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                                e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.08)';
                                                e.currentTarget.style.borderColor = 'hsl(var(--border-muted))';
                                              }}
                                              onMouseLeave={e => {
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.boxShadow = '0 4px 15px -5px rgba(0,0,0,0.05)';
                                                e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))';
                                              }}
                                              >
                                                {/* Gradient Top Bar */}
                                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: s.status === 'aprovado' ? 'linear-gradient(90deg, #10b981, #34d399)' : s.status === 'publicado' ? 'linear-gradient(90deg, #3b82f6, #60a5fa)' : 'linear-gradient(90deg, #f59e0b, #fbbf24)' }} />

                                                <div className="card-left-section" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <h3 style={{ fontSize: 16, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, display: 'flex', alignItems: 'center', gap: 8, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
                                                      <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(236,72,153,0.1)', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        <PenTool size={14} />
                                                      </div>
                                                      {s.titulo}
                                                    </h3>
                                                    {s.status === 'aprovado' ? (
                                                      <span 
                                                        onClick={(e) => handleAprovarToggle(e, s.id, s.status)}
                                                        title={`Aprovado por ${s.aprovado_por?.split(' ')[0] || ''}`}
                                                        style={{ padding: '4px 10px', borderRadius: 100, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}
                                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.2)'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(16,185,129,0.1)'}
                                                      >Aprovado</span>
                                                    ) : s.status === 'publicado' ? (
                                                      <span style={{ padding: '4px 10px', borderRadius: 100, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', flexShrink: 0 }}>Publicado</span>
                                                    ) : (
                                                      <span 
                                                        onClick={(e) => handleAprovarToggle(e, s.id, s.status || 'rascunho')}
                                                        title="Clique para aprovar"
                                                        style={{ padding: '4px 10px', borderRadius: 100, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}
                                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.2)'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(245,158,11,0.1)'}
                                                      >
                                                        Rascunho
                                                      </span>
                                                    )}
                                                  </div>
                                                  
                                                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'hsl(var(--text-secondary))', fontSize: 12, fontWeight: 500 }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12} color="hsl(var(--text-muted))" /> {s.data_aplicacao?.split('-').reverse().join('/') || 'Não definida'}</span>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Layers size={12} color="hsl(var(--text-muted))" /> {s.simulados_bimestres?.nome || 'Bimestre não definido'}</span>
                                                  </div>
                                                  
                                                  <div style={{ marginTop: 'auto', background: 'hsl(var(--bg-app))', borderRadius: 12, padding: '12px', border: '1px solid hsl(var(--border-subtle))' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 11 }}>
                                                      <span style={{ color: 'hsl(var(--text-secondary))', fontWeight: 700, letterSpacing: '0.05em' }}>PROGRESSO</span>
                                                      <span style={{ color: isComplete ? '#10b981' : '#3b82f6', fontWeight: 800 }}>
                                                        {qCadastradas} / {qRequisitadas} <span style={{ opacity: 0.7, fontWeight: 600 }}>({percent}%)</span>
                                                      </span>
                                                    </div>
                                                    <div style={{ width: '100%', height: 4, background: 'hsl(var(--bg-surface))', borderRadius: 100, overflow: 'hidden' }}>
                                                      <motion.div 
                                                        initial={{ width: 0 }} animate={{ width: `${percent}%` }} transition={{ duration: 1, ease: 'easeOut' }}
                                                        style={{ height: '100%', background: isComplete ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #3b82f6, #60a5fa)' }}
                                                      />
                                                    </div>
                                                  </div>
                                                </div>

                                                <div className="card-middle-section" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                  {s.simulados_requisicoes && s.simulados_requisicoes.length > 0 ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                      {s.simulados_requisicoes.map((req: any, idx: number) => {
                                                        const profName = professoresMap[req.id_professor] || 'Professor não encontrado'
                                                        const discName = req.simulados_disciplinas?.nome || 'Sem Disciplina'
                                                        const requestedQty = req.quantidade_questoes || 0
                                                        const currentQty = s.simulados_questoes?.filter((q: any) => 
                                                          q.id_professor === req.id_professor && q.id_disciplina === req.id_disciplina
                                                        ).length || 0

                                                        const reqKey = `${s.id}-${req.id_professor}-${req.id_disciplina}`
                                                        const isBlocked = isProfessor && currentUser && currentUser.id !== req.id_professor

                                                        return (
                                                          <motion.div 
                                                            key={idx} 
                                                            animate={shakeId === reqKey ? { x: [-5, 5, -5, 5, 0], transition: { duration: 0.3 } } : {}}
                                                            onClick={() => {
                                                              if (isBlocked) {
                                                                setShakeId(reqKey)
                                                                setTimeout(() => setShakeId(null), 300)
                                                                return
                                                              }
                                                              router.push(`/simulados/lista/${s.id}?professor=${req.id_professor}&disciplina=${req.id_disciplina}`)
                                                            }}
                                                            style={{ display: 'flex', alignItems: 'center', gap: 8, color: isBlocked ? 'hsl(var(--text-tertiary))' : 'hsl(var(--text-secondary))', background: 'hsl(var(--bg-app))', padding: '6px 10px', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))', cursor: isBlocked ? 'not-allowed' : 'pointer', transition: 'all 0.2s', opacity: isBlocked ? 0.6 : 1 }}
                                                            onMouseEnter={e => { if (!isBlocked) { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = 'rgba(59,130,246,0.03)' } }}
                                                            onMouseLeave={e => { if (!isBlocked) { e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'; e.currentTarget.style.background = 'hsl(var(--bg-app))' } }}
                                                          >
                                                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                              <User size={12} />
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: 0 }}>
                                                              <span style={{ fontWeight: 600, color: 'hsl(var(--text-primary))', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profName}</span>
                                                              <span style={{ fontSize: 10, opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{discName}</span>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: currentQty >= requestedQty ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: currentQty >= requestedQty ? '#10b981' : '#f59e0b', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                                                              {currentQty}/{requestedQty}
                                                            </div>
                                                          </motion.div>
                                                        )
                                                      })}
                                                    </div>
                                                  ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'hsl(var(--text-secondary))', fontSize: 12, padding: '10px 12px', background: 'hsl(var(--bg-app))', borderRadius: 8, border: '1px dashed hsl(var(--border-subtle))' }}>
                                                      <User size={14} />
                                                      <span>Nenhum professor</span>
                                                    </div>
                                                  )}
                                                </div>

                                                <div className="card-right-section" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                  <div className="actions-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                                    <button onClick={(e) => handleAction(e, 'gerar_pdf', s.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, color: 'hsl(var(--text-secondary))', cursor: 'pointer', transition: 'all 0.2s' }} title="Gerar PDF" onMouseEnter={e => { e.currentTarget.style.color = '#3b82f6'; e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = 'rgba(59,130,246,0.05)' }} onMouseLeave={e => { e.currentTarget.style.color = 'hsl(var(--text-secondary))'; e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'; e.currentTarget.style.background = 'hsl(var(--bg-app))' }}>
                                                      <FileDown size={14} /> <span style={{ fontSize: 11, fontWeight: 700 }}>Exportar</span>
                                                    </button>
                                                    <button onClick={(e) => handleAction(e, 'gerar_gabarito', s.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, color: 'hsl(var(--text-secondary))', cursor: 'pointer', transition: 'all 0.2s' }} title="Gabarito" onMouseEnter={e => { e.currentTarget.style.color = '#10b981'; e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.background = 'rgba(16,185,129,0.05)' }} onMouseLeave={e => { e.currentTarget.style.color = 'hsl(var(--text-secondary))'; e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'; e.currentTarget.style.background = 'hsl(var(--bg-app))' }}>
                                                      <CheckSquare size={14} /> <span style={{ fontSize: 11, fontWeight: 700 }}>Gabarito</span>
                                                    </button>
                                                    <button onClick={(e) => handleAction(e, 'adaptar', s.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, color: 'hsl(var(--text-secondary))', cursor: 'pointer', transition: 'all 0.2s' }} title="Adaptar" onMouseEnter={e => { e.currentTarget.style.color = '#8b5cf6'; e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.background = 'rgba(139,92,246,0.05)' }} onMouseLeave={e => { e.currentTarget.style.color = 'hsl(var(--text-secondary))'; e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'; e.currentTarget.style.background = 'hsl(var(--bg-app))' }}>
                                                      <Copy size={14} /> <span style={{ fontSize: 11, fontWeight: 700 }}>Adaptar</span>
                                                    </button>
                                                    <button onClick={(e) => handleAction(e, 'excluir', s.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, color: 'hsl(var(--text-secondary))', cursor: 'pointer', transition: 'all 0.2s' }} title="Excluir" onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)' }} onMouseLeave={e => { e.currentTarget.style.color = 'hsl(var(--text-secondary))'; e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'; e.currentTarget.style.background = 'hsl(var(--bg-app))' }}>
                                                      <Trash2 size={14} /> <span style={{ fontSize: 11, fontWeight: 700 }}>Excluir</span>
                                                    </button>
                                                  </div>

                                                  <div 
                                                    onClick={() => router.push(`/simulados/lista/${s.id}`)}
                                                    style={{ 
                                                      marginTop: 'auto',
                                                      display: 'flex', 
                                                      alignItems: 'center', 
                                                      justifyContent: 'center', 
                                                      gap: 6,
                                                      background: 'rgba(59,130,246,0.05)',
                                                      color: '#3b82f6', 
                                                      padding: '10px',
                                                      borderRadius: 8,
                                                      fontSize: 11, 
                                                      fontWeight: 800, 
                                                      cursor: 'pointer', 
                                                      transition: 'all 0.2s',
                                                      textTransform: 'uppercase',
                                                      letterSpacing: '0.05em'
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.05)'; e.currentTarget.style.transform = 'translateY(0)' }}
                                                  >
                                                    VER TODAS AS QUESTÕES
                                                    <ChevronRight size={14} />
                                                  </div>
                                                </div>
                                              </div>
                                          </motion.div>
                                          )
                                        })}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
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
      
      <style>{`
        @media (min-width: 1024px) {
          .cards-grid { grid-template-columns: 1fr !important; }
          .simulado-card {
            display: grid !important;
            grid-template-columns: minmax(300px, 1.2fr) minmax(300px, 1.5fr) 280px;
            gap: 32px;
            align-items: stretch;
          }
          .card-left-section {
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
          }
          .card-middle-section {
            border-left: 1px solid hsl(var(--border-subtle));
            border-right: 1px solid hsl(var(--border-subtle));
            padding: 0 32px;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .card-right-section {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .card-right-section .actions-grid {
            margin-bottom: auto !important;
          }
          .card-right-section > div[onClick] {
            border-top: none !important;
            margin-top: 16px;
          }
        }
        @media (max-width: 1023px) {
          .card-middle-section { margin: 20px 0; }
        }
        @media (max-width: 768px) {
          .page-container { padding: 16px !important; }
          .header-box { flex-direction: column !important; align-items: flex-start !important; padding: 20px !important; gap: 16px; }
          .header-box h1 { font-size: 24px !important; }
          .action-btn { width: 100%; justify-content: center; margin-top: 10px; }
          .bimester-header { padding: 16px !important; flex-wrap: wrap; }
          .bimester-header h2 { font-size: 16px !important; }
          .turma-container { padding-left: 0 !important; gap: 16px !important; }
          .turma-header { padding: 12px 16px !important; }
          .cards-grid { grid-template-columns: 1fr !important; padding-left: 0 !important; gap: 16px !important; }
          .simulado-card { padding: 16px !important; }
          .actions-grid { grid-template-columns: 1fr !important; gap: 8px !important; }
        }
      `}</style>
    </div>
  )
}
