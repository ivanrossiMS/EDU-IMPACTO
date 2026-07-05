'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, Filter, Eye, Clock, CheckCircle, XCircle,
  Upload, BookOpen, Users, User, Info, ChevronRight, AlertCircle, Trash2,
  FileText, Calendar, Layers, Edit, CheckSquare, Printer, ChevronDown, GraduationCap, ChevronUp
} from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/context'
import { useData } from '@/lib/dataContext'
import { getDerivedStatus } from '@/lib/utils'
import { AnoLetivoModal } from '@/components/simulados/AnoLetivoModal'
import { GabaritoRedacaoModal } from '@/components/simulados/GabaritoRedacaoModal'

export default function UploadRedaçõesGerenciamentoPage() {
  const { currentUser, currentUserPerfil } = useApp()
  const { cfgCalendarioLetivo = [] } = useData()
  const [redacoes, setRedações] = useState<any[]>([])
  const [bimestres, setBimestres] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [search, setSearch] = useState('')
  const [filterBimestre, setFilterBimestre] = useState('todos')
  const [filterSerie, setFilterSerie] = useState('todas')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [gabaritoModalId, setGabaritoModalId] = useState<string | null>(null)
  
  const [selectedAnoLetivo, setSelectedAnoLetivo] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)

  const seriesOptions = ['1º Ano EF', '2º Ano EF', '3º Ano EF', '4º Ano EF', '5º Ano EF', '6º Ano EF', '7º Ano EF', '8º Ano EF', '9º Ano EF', '1ª Série EM', '2ª Série EM', '3ª Série EM']

  useEffect(() => {
    setIsClient(true)
    const saved = sessionStorage.getItem('selectedAnoLetivo')
    if (saved) setSelectedAnoLetivo(saved)
    loadData()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchTerm), 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const loadData = async () => {
    setLoading(true)
    try {
      const [bimRes, redacoesRes] = await Promise.all([
        (supabase as any).from('simulados_bimestres').select('*').eq('status', 'ativo').order('nome'),
        (supabase as any).from('redacao_upload').select('*').order('created_at', { ascending: false })
      ])
      
      let redacoesData = redacoesRes.data || []
      
      // Fetch requisitions via API to bypass RLS so professors can see all cards
      if (redacoesData.length > 0) {
        try {
          const reqsRes = await fetch(`/api/redacao-upload/requisicoes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ redacaoIds: redacoesData.map((p: any) => p.id) })
          })
          if (reqsRes.ok) {
            const reqsData = await reqsRes.json()
            redacoesData = redacoesData.map((p: any) => {
              const reqs = reqsData.filter((r: any) => r.id_redacao_upload === p.id)
              const pWithReqs = { ...p, redacao_upload_requisicoes: reqs }
              return {
                ...pWithReqs,
                status: getDerivedStatus(pWithReqs, 'redacao')
              }
            })
          }
        } catch (e) {
          console.error("Error fetching requisitions", e)
        }
      }

      setBimestres(bimRes.data || [])
      setRedações(redacoesData)
      
      if (redacoesRes.error) console.error("Error loading redacoes:", redacoesRes.error)
    } catch (e: any) {
      console.error("Error in loadData:", e?.message || e)
    } finally {
      setLoading(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteConfirmId) return
    await (supabase as any).from('redacao_upload').delete().eq('id', deleteConfirmId)
    setRedações(prev => prev.filter(p => p.id !== deleteConfirmId))
    setDeleteConfirmId(null)
  }

  const handleAdaptar = async (redacao: any) => {
    if (redacao.titulo?.includes('ADAPTADO')) {
      window.location.href = `/simulados/redacao-upload/${redacao.id}/upload?all=true`;
      return;
    }
    
    setLoading(true)
    try {
      const payload = { ...redacao }
      delete payload.id
      delete payload.created_at
      delete payload.redacao_upload_requisicoes
      payload.titulo = `${redacao.titulo || 'Redação'} ADAPTADO`
      payload.updated_at = new Date().toISOString()
      
      const { data: newRedacao, error: simError } = await (supabase as any)
        .from('redacao_upload')
        .insert([payload])
        .select()
        .single()
        
      if (simError) throw simError

      if (redacao.redacao_upload_requisicoes && redacao.redacao_upload_requisicoes.length > 0) {
        const reqsPayload = redacao.redacao_upload_requisicoes.map((r: any) => {
          const newReq = { ...r }
          delete newReq.id
          delete newReq.created_at
          newReq.id_redacao_upload = newRedacao.id
          return newReq
        })
        const { error: reqError } = await (supabase as any)
          .from('redacao_upload_requisicoes')
          .insert(reqsPayload)
          
        if (reqError) throw reqError
      }
      
      await loadData()
    } catch (e: any) {
      console.error(e)
      alert('Erro ao adaptar redação: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const isProfView = currentUserPerfil === 'Professor'

  const bimsInYear = useMemo(() => bimestres.filter(b => b.ano_letivo === selectedAnoLetivo).map(b => b.id), [bimestres, selectedAnoLetivo])
  const redacoesInYear = useMemo(() => redacoes.filter(p => bimsInYear.includes(p.id_bimestre)), [redacoes, bimsInYear])

  const filtered = useMemo(() => {
    return redacoesInYear.filter(p => {
      const matchSearch = !search || p.titulo?.toLowerCase().includes(search.toLowerCase())
      const matchBimestre = filterBimestre === 'todos' || p.id_bimestre === filterBimestre
      const matchSerie = filterSerie === 'todas' || (p.series && (Array.isArray(p.series) ? p.series.includes(filterSerie) : p.series === filterSerie))
      
      // O professor logado só pode ver as redacoes em que ele está vinculado
      const isAssigned = !isProfView || (p.redacao_upload_requisicoes || []).some((r: any) => r.id_professor === currentUser?.id)
      
      return matchSearch && matchBimestre && matchSerie && isAssigned
    })
  }, [redacoesInYear, search, filterBimestre, filterSerie, isProfView, currentUser?.id])

  const groupedRedacoes = useMemo(() => {
    const groups: Record<string, any[]> = {}
    filtered.forEach(item => {
      const sList = Array.isArray(item.series) ? item.series : (item.series ? [item.series] : ['Sem Turma'])
      if (sList.length === 0) {
         if (!groups['Sem Turma']) groups['Sem Turma'] = []
         groups['Sem Turma'].push(item)
      } else {
         sList.forEach((s: string) => {
           if (!groups[s]) groups[s] = []
           groups[s].push(item)
         })
      }
    })

    return Object.entries(groups).sort(([a], [b]) => {
      if (a === 'Sem Turma') return 1;
      if (b === 'Sem Turma') return -1;
      const idxA = seriesOptions.indexOf(a);
      const idxB = seriesOptions.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [filtered])

  const isCoord = currentUserPerfil !== 'Professor'

  const stats = useMemo(() => {
    return {
      total: redacoesInYear.length
    }
  }, [redacoesInYear])

  if (!isClient) return null

  return (
    <>
      {!selectedAnoLetivo && <AnoLetivoModal onSelect={(ano) => { setSelectedAnoLetivo(ano); sessionStorage.setItem('selectedAnoLetivo', ano) }} />}
      <div className="simulados-upload-container" style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto', display: selectedAnoLetivo ? 'block' : 'none' }}>
      <style>{`
        @media (max-width: 768px) {
          .simulados-upload-container {
            padding: 16px !important;
          }
          .responsive-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 16px !important;
            margin-bottom: 24px !important;
          }
          .responsive-header > div:first-child h1 {
            font-size: 20px !important;
          }
          .responsive-header > div:first-child p {
            font-size: 13px !important;
          }
          .responsive-stats {
            grid-template-columns: 1fr 1fr !important;
            gap: 12px !important;
            margin-bottom: 24px !important;
          }
          .responsive-stats > div {
            padding: 12px !important;
            gap: 10px !important;
          }
          .responsive-stats > div > div:first-child {
            width: 32px !important;
            height: 32px !important;
          }
          .responsive-stats > div > div:last-child > div:first-child {
            font-size: 20px !important;
          }
          .responsive-filters {
            flex-direction: column !important;
            align-items: stretch !important;
            margin-bottom: 24px !important;
            gap: 12px !important;
          }
          .responsive-search {
            width: 100% !important;
            flex: none !important;
          }
          .responsive-filters-selects {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
          }
          .responsive-filters-selects select {
            width: 100% !important;
            padding: 12px 32px 12px 36px !important;
            font-size: 13px !important;
          }
          .responsive-filters-selects select:nth-child(3) {
            grid-column: span 2 !important;
          }
        }
      `}</style>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

        {/* Header */}
        <div className="responsive-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(139,92,246,0.3)' }}>
                <Upload size={22} color="white" />
              </div>
              <div>
                <h1 style={{ fontSize: 32, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.02em' }}>
                  Redações por Upload
                </h1>
                <p style={{ color: 'hsl(var(--text-secondary))', margin: '4px 0 0 0', fontSize: 15 }}>
                  {isCoord ? 'Crie e gerencie redações que serão enviadas por professores.' : 'Visualize e envie suas redações em formato DOCX ou PDF.'}
                </p>
              </div>
            </div>
          </div>
          {isCoord && (
            <Link href="/simulados/redacao-upload/nova" style={{ textDecoration: 'none' }}>
              <motion.button
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '12px 24px', borderRadius: 14,
                  background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                  color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer',
                  fontSize: 14, boxShadow: '0 8px 20px rgba(139,92,246,0.35)',
                }}
              >
                <Plus size={18} /> Nova Redação
              </motion.button>
            </Link>
          )}
        </div>

        {/* Stats */}
        {isCoord && (
          <div className="responsive-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16, marginBottom: 32 }}>
            {[
              { label: 'Total de Redações', sub: 'Todas criadas', value: stats.total, color: '#8b5cf6', iconBg: 'rgba(139,92,246,0.06)', icon: Layers }
            ].map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                style={{ 
                  position: 'relative',
                  background: 'hsl(var(--bg-surface))', 
                  border: '1px solid hsl(var(--border-subtle))', 
                  borderRadius: 16, 
                  padding: '24px', 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: 16,
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: s.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <s.icon size={24} color={s.color} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: s.color, lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
                  <div style={{ fontSize: 13, color: 'hsl(var(--text-primary))', fontWeight: 800 }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-secondary))', fontWeight: 600, marginTop: 2 }}>{s.sub}</div>
                </div>
                
                <div style={{ 
                  position: 'absolute', 
                  bottom: 0, 
                  left: 24,
                  width: '60%',
                  height: 4, 
                  borderRadius: '4px 4px 0 0',
                  background: `linear-gradient(90deg, ${s.color} 0%, transparent 100%)`,
                  opacity: 0.8
                }} />
              </motion.div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="responsive-filters" style={{ display: 'flex', gap: 16, marginBottom: 32, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="responsive-search" style={{ flex: '1 1 280px', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-secondary))' }} />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por título da redação..."
              style={{ width: '100%', padding: '14px 16px 14px 44px', borderRadius: 12, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 14, fontWeight: 600, outline: 'none', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(139,92,246,0.15)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)' }}
            />
          </div>
          
          <div className="responsive-filters-selects" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 140px' }}>
              <Calendar size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-secondary))', pointerEvents: 'none' }} />
              <select
                value={selectedAnoLetivo || ''}
                onChange={e => {
                  setSelectedAnoLetivo(e.target.value);
                  sessionStorage.setItem('selectedAnoLetivo', e.target.value);
                  setFilterBimestre('todos');
                }}
                style={{ width: '100%', padding: '14px 36px 14px 42px', borderRadius: 12, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 14, fontWeight: 600, outline: 'none', cursor: 'pointer', appearance: 'none', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(139,92,246,0.15)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)' }}
              >
                {[...cfgCalendarioLetivo].sort((a: any, b: any) => parseInt(b.ano) - parseInt(a.ano)).map((item: any) => (
                  <option key={item.id} value={item.ano}>{item.ano}</option>
                ))}
              </select>
              <ChevronDown size={16} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-secondary))', pointerEvents: 'none' }} />
            </div>

            <div style={{ position: 'relative', flex: '1 1 180px' }}>
              <Calendar size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-secondary))', pointerEvents: 'none' }} />
              <select
                value={filterBimestre}
                onChange={e => setFilterBimestre(e.target.value)}
                style={{ width: '100%', padding: '14px 36px 14px 42px', borderRadius: 12, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 14, fontWeight: 600, outline: 'none', cursor: 'pointer', appearance: 'none', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(139,92,246,0.15)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)' }}
              >
                <option value="todos">Todos os bimestres</option>
                  {bimestres.filter(b => b.ano_letivo === selectedAnoLetivo).map(bim => (
                    <option key={bim.id} value={bim.id}>{bim.nome}</option>
                  ))}
                </select>
              <ChevronDown size={16} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-secondary))', pointerEvents: 'none' }} />
            </div>

            <div style={{ position: 'relative', flex: '1 1 180px' }}>
              <GraduationCap size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-secondary))', pointerEvents: 'none' }} />
              <select
                value={filterSerie}
                onChange={e => setFilterSerie(e.target.value)}
                style={{ width: '100%', padding: '14px 36px 14px 42px', borderRadius: 12, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 14, fontWeight: 600, outline: 'none', cursor: 'pointer', appearance: 'none', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(139,92,246,0.15)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)' }}
              >
                <option value="todas">Todas as Séries</option>
                {seriesOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown size={16} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-secondary))', pointerEvents: 'none' }} />
            </div>

          </div>
        </div>

        {/* List */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
            <div style={{ width: 36, height: 36, border: '3px solid rgba(139,92,246,0.2)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
          </div>
        ) : filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ textAlign: 'center', padding: '80px 40px', background: 'hsl(var(--bg-surface))', borderRadius: 20, border: '1px solid hsl(var(--border-subtle))' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(139,92,246,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Upload size={28} color="#8b5cf6" />
            </div>
            <h3 style={{ color: 'hsl(var(--text-primary))', fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>
              {search ? 'Nenhuma redacao encontrada' : 'Nenhuma redacao criada ainda'}
            </h3>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 14, margin: 0 }}>
              {isCoord ? 'Clique em "Nova Redação" para começar.' : 'Aguarde o coordenador criar uma redacao para você.'}
            </p>
          </motion.div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <AnimatePresence>
              {groupedRedacoes.map(([serie, items]) => (
                <div key={serie} style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, marginBottom: 24, overflow: 'hidden' }}>
                  <div 
                    onClick={() => setExpandedGroups(prev => ({ ...prev, [serie]: !prev[serie] }))}
                    style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'rgba(139,92,246,0.02)', borderBottom: expandedGroups[serie] ? '1px solid hsl(var(--border-subtle))' : 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(139,92,246,0.3)' }}>
                        <Users size={24} color="#fff" />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 20, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>{serie}</span>
                          <span style={{ padding: '4px 12px', borderRadius: 100, fontSize: 12, fontWeight: 800, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}>{items.length} redações</span>
                        </div>
                        <span style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', marginTop: 4 }}>Acompanhe as redações aplicadas e programadas para esta turma.</span>
                      </div>
                    </div>
                    <motion.button 
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', color: '#8b5cf6', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      {expandedGroups[serie] ? 'Recolher' : 'Expandir'}
                      <ChevronUp size={16} style={{ transform: expandedGroups[serie] ? 'none' : 'rotate(180deg)', transition: 'transform 0.2s' }} />
                    </motion.button>
                  </div>
                  
                  <AnimatePresence>
                    {expandedGroups[serie] && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }} 
                        animate={{ height: 'auto', opacity: 1 }} 
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {items.map((redacao, i) => {
                const allRevisoes = redacao.redacao_upload_requisicoes || []
                const isProfView = currentUserPerfil === 'Professor'
                const myAssignment = (redacao.redacao_upload_requisicoes || []).find((r: any) => r.id_professor === currentUser?.id)
                const showUploadBtn = isProfView && myAssignment && myAssignment.status === 'pendente'
                const totalRequested = (redacao.redacao_upload_requisicoes || []).reduce((acc: number, req: any) => acc + (req.qtd_questoes || 0), 0)
                const totalUploaded = Array.isArray(redacao.questoes_json) ? redacao.questoes_json.length : (redacao.questoes_count || 0)

                return (
                  <motion.div key={redacao.id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    transition={{ delay: i * 0.04 }}
                    className="responsive-card"
                    style={{ position: 'relative', background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, padding: '24px', display: 'flex', flexDirection: 'column', gap: 24, transition: 'all 0.2s', marginTop: redacao.titulo?.includes('ADAPTADO') ? 16 : 0 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#8b5cf655'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(139,92,246,0.1)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'hsl(var(--border-subtle))'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
                  >
                    {redacao.titulo?.includes('ADAPTADO') && (
                      <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', alignItems: 'center' }}>
                        <div style={{ position: 'absolute', top: 8, left: -6, width: 16, height: 16, background: '#6d28d9', borderRadius: 3, transform: 'rotate(45deg)', zIndex: -1 }} />
                        <div style={{ position: 'absolute', top: 8, right: -6, width: 16, height: 16, background: '#6d28d9', borderRadius: 3, transform: 'rotate(45deg)', zIndex: -1 }} />
                        <div style={{ background: 'linear-gradient(135deg, #a855f7, #8b5cf6)', color: 'white', fontWeight: 900, fontSize: 13, letterSpacing: '0.05em', padding: '6px 32px', borderRadius: 8, boxShadow: '0 4px 12px rgba(139,92,246,0.4)', zIndex: 2 }}>
                          ADAPTADO
                        </div>
                      </div>
                    )}
                    {/* Header Section */}
                    <div className="responsive-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                      <div style={{ display: 'flex', gap: 16, flex: 1, minWidth: 0 }}>
                        <div className="responsive-card-icon" style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(139,92,246,0.3)', flexShrink: 0 }}>
                          <FileText size={28} color="#fff" />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 2, minWidth: 0, width: '100%' }}>
                          <div className="responsive-card-title-wrap" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 20, fontWeight: 900, color: 'hsl(var(--text-primary))', textTransform: 'uppercase', letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{redacao.titulo}</span>
                            {redacao.series && redacao.series.length > 0 && (
                              <div className="responsive-card-series" style={{ display: 'flex', gap: 6 }}>
                                {(Array.isArray(redacao.series) ? redacao.series : [redacao.series]).map((s: string) => (
                                  <span key={s} style={{ padding: '4px 12px', borderRadius: 100, fontSize: 12, fontWeight: 800, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', whiteSpace: 'nowrap' }}>{s}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="responsive-card-info" style={{ display: 'flex', flexWrap: 'wrap', gap: 24, color: 'hsl(var(--text-secondary))', fontSize: 13, fontWeight: 600 }}>
                            {redacao.id_bimestre && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <BookOpen size={14} /> {bimestres.find(b => b.id === redacao.id_bimestre)?.nome || 'Bimestre'}
                              </span>
                            )}
                            {redacao.data_aplicacao && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Calendar size={14} /> Aplicação: {redacao.data_aplicacao.split('-').reverse().join('/')}
                              </span>
                            )}
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: redacao.data_limite_upload && new Date(redacao.data_limite_upload) < new Date() ? '#ef4444' : 'inherit' }}>
                              <Clock size={14} /> Prazo: {redacao.data_limite_upload ? redacao.data_limite_upload.split('-').reverse().join('/') : 'Não definido'}
                            </span>

                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Grid Section */}
                    <div className="responsive-card-bottom-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                      {/* Box 1: Professor Responsável */}
                      <div style={{ border: '1px solid rgba(59,130,246,0.15)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 16, background: 'rgba(59,130,246,0.03)' }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <User size={14} /> PROFESSOR(A) RESPONSÁVEL
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, flex: 1, alignContent: 'start' }}>
                          {redacao.redacao_upload_requisicoes && redacao.redacao_upload_requisicoes.length > 0 ? redacao.redacao_upload_requisicoes.map((req: any) => {

                            const isMyCard = req.id_professor === currentUser?.id;
                            const isAdaptado = redacao.titulo?.includes('ADAPTADO');
                            const canClick = isMyCard || isCoord || isAdaptado;
                            
                            const formatName = (name: string) => {
                              if (!name) return '';
                              const parts = name.trim().split(' ');
                              if (parts.length <= 2) return name;
                              const first = parts[0];
                              const last = parts[parts.length - 1];
                              const middle = parts.slice(1, -1).map(p => {
                                if (['de', 'da', 'do', 'dos', 'das'].includes(p.toLowerCase())) return '';
                                return p[0].toUpperCase() + '.';
                              }).filter(Boolean).join(' ');
                              return `${first} ${middle ? middle + ' ' : ''}${last}`;
                            }
                            
                            const cardContent = (
                              <div key={req.id} style={{ 
                                background: 'hsl(var(--bg-surface))', 
                                borderRadius: 12, 
                                padding: 16, 
                                boxShadow: '0 4px 12px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.02)',
                                border: '1px solid hsl(var(--border-subtle))',
                                transition: 'all 0.2s'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 16, fontWeight: 900, color: isMyCard ? '#8b5cf6' : 'hsl(var(--text-primary))', letterSpacing: '-0.01em' }}>{formatName(req.professor_nome)}</span>
                                    <span style={{ padding: '4px 10px', borderRadius: 8, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontSize: 12, fontWeight: 800 }}>{req.disciplina_nome}</span>
                                  </div>
                                </div>

                              </div>
                            );


                            return cardContent;
                          }) : (
                            <span style={{ fontSize: 13, color: 'hsl(var(--text-secondary))' }}>Nenhum professor atribuído.</span>
                          )}
                        </div>
                      </div>

                      {/* Box 2: Instruções */}
                        <div className="neon-aura-purple-card" style={{ border: '1px solid rgba(139,92,246,0.15)', borderRadius: 12, padding: 16, background: 'rgba(139,92,246,0.03)', flex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: '#8b5cf6', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                            <Info size={14} /> INSTRUÇÕES PARA OS PROFESSORES
                          </div>
                          <p style={{ margin: 0, fontSize: 13, color: 'hsl(var(--text-secondary))', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                            {redacao.descricao || 'Nenhuma instrução informada.'}
                          </p>
                        </div>

                        {/* Box 3: Ações */}
                        <div style={{ border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, padding: 16, background: 'hsl(var(--bg-app))' }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', marginBottom: 12 }}>
                            AÇÕES
                          </div>
                          <div className="responsive-card-actions" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                            <Link href={`/simulados/redacao-upload/${redacao.id}/upload?print=true`} style={{ textDecoration: 'none', display: 'block' }}>
                              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 12px', borderRadius: 10, background: 'transparent', color: 'hsl(var(--text-primary))', fontSize: 13, fontWeight: 700, border: '1px solid hsl(var(--border-subtle))', cursor: 'pointer' }}>
                                <Printer size={16} /> Imprimir
                              </motion.button>
                            </Link>

                            {isCoord && (
                              <>
                                <Link href={`/simulados/redacao-upload/${redacao.id}/editar`} style={{ textDecoration: 'none', display: 'block' }}>
                                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'rgba(139,92,246,0.05)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
                                    <Edit size={16} /> Editar
                                  </motion.button>
                                </Link>
                                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                  onClick={() => setDeleteConfirmId(redacao.id)}
                                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.05)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
                                  <Trash2 size={16} /> Excluir
                                </motion.button>
                              </>
                            )}
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
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {deleteConfirmId && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteConfirmId(null)}
              style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)' }} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              style={{ position: 'relative', background: 'hsl(var(--bg-elevated))', padding: 32, borderRadius: 24, boxShadow: '0 24px 48px rgba(0,0,0,0.2)', maxWidth: 400, width: '100%', textAlign: 'center', border: '1px solid hsl(var(--border-subtle))' }}>
              
              <div style={{ width: 64, height: 64, borderRadius: 32, background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <Trash2 size={32} color="#ef4444" />
              </div>
              
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'hsl(var(--text-primary))', marginBottom: 12, letterSpacing: '-0.02em' }}>
                Excluir Redação
              </h2>
              <p style={{ fontSize: 14, color: 'hsl(var(--text-secondary))', marginBottom: 32, lineHeight: 1.5 }}>
                Tem certeza que deseja excluir esta redacao? Esta ação não poderá ser desfeita.
              </p>
              
              <div style={{ display: 'flex', gap: 12 }}>
                <motion.button onClick={() => setDeleteConfirmId(null)}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'hsl(var(--bg-surface))', color: 'hsl(var(--text-primary))', border: '1px solid hsl(var(--border-subtle))', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  Cancelar
                </motion.button>
                <motion.button onClick={confirmDelete}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(239,68,68,0.3)' }}>
                  Sim, Excluir
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {gabaritoModalId && (
        <GabaritoRedacaoModal 
          provaUploadId={gabaritoModalId} 
          onClose={() => setGabaritoModalId(null)} 
        />
      )}
    </div>
    </>
  )
}
