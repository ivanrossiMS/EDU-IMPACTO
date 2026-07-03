'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, Filter, Eye, Clock, CheckCircle, XCircle,
  Upload, BookOpen, Users, ChevronRight, AlertCircle, Trash2,
  FileText, Calendar, Layers, Edit, CheckSquare, Printer
} from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/context'
import { GabaritoSimuladoModal } from '@/components/simulados/GabaritoSimuladoModal'

export default function UploadSimuladosGerenciamentoPage() {
  const { currentUser, currentUserPerfil } = useApp()
  const [simulados, setSimulados] = useState<any[]>([])
  const [bimestres, setBimestres] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('todos')
  const [filterBimestre, setFilterBimestre] = useState('todos')
  const [filterSerie, setFilterSerie] = useState('todas')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [gabaritoModalId, setGabaritoModalId] = useState<string | null>(null)

  const seriesOptions = ['1º Ano EF', '2º Ano EF', '3º Ano EF', '4º Ano EF', '5º Ano EF', '6º Ano EF', '7º Ano EF', '8º Ano EF', '9º Ano EF', '1ª Série EM', '2ª Série EM', '3ª Série EM']

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [bimRes, simuladosRes] = await Promise.all([
        (supabase as any).from('simulados_bimestres').select('*').eq('status', 'ativo').order('nome'),
        (supabase as any).from('simulados_upload').select('*').order('created_at', { ascending: false })
      ])
      
      let simuladosData = simuladosRes.data || []
      
      // Fetch requisitions via API to bypass RLS so professors can see all cards
      if (simuladosData.length > 0) {
        try {
          const reqsRes = await fetch(`/api/simulados-upload/requisicoes?simuladoIds=${simuladosData.map((p: any) => p.id).join(',')}`)
          if (reqsRes.ok) {
            const reqsData = await reqsRes.json()
            simuladosData = simuladosData.map((p: any) => ({
              ...p,
              simulados_upload_requisicoes: reqsData.filter((r: any) => r.id_simulado_upload === p.id)
            }))
          }
        } catch (e) {
          console.error("Error fetching requisitions", e)
        }
      }

      setBimestres(bimRes.data || [])
      setSimulados(simuladosData)
      
      if (simuladosRes.error) console.error("Error loading simulados:", simuladosRes.error)
    } catch (e: any) {
      console.error("Error in loadData:", e?.message || e)
    } finally {
      setLoading(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteConfirmId) return
    await (supabase as any).from('simulados_upload').delete().eq('id', deleteConfirmId)
    setSimulados(prev => prev.filter(p => p.id !== deleteConfirmId))
    setDeleteConfirmId(null)
  }

  const handleAdaptar = async (simulado: any) => {
    try {
      const newTitle = simulado.titulo + ' - Adaptado'
      const { data: newSimulado, error } = await (supabase as any).from('simulados_upload').insert({
        titulo: newTitle,
        id_bimestre: simulado.id_bimestre,
        series: simulado.series,
        data_aplicacao: simulado.data_aplicacao,
        data_limite_upload: simulado.data_limite_upload,
        questoes_json: simulado.questoes_json || [],
        questoes_count: simulado.questoes_count || 0,
        status: 'em_revisao'
      }).select().single()
  
      if (error || !newSimulado) {
        alert('Erro ao adaptar simulado')
        return
      }
  
      // Clonar requisicoes
      if (simulado.simulados_upload_requisicoes && simulado.simulados_upload_requisicoes.length > 0) {
        let reqsToClone = simulado.simulados_upload_requisicoes;
        if (currentUserPerfil === 'Professor') {
           reqsToClone = reqsToClone.filter((r: any) => r.id_professor === currentUser?.id);
        }
        
        if (reqsToClone.length > 0) {
           const insertReqs = reqsToClone.map((r: any) => ({
             id_simulado_upload: newSimulado.id,
             id_professor: r.id_professor,
             professor_nome: r.professor_nome,
             id_disciplina: r.id_disciplina,
             disciplina_nome: r.disciplina_nome,
             qtd_questoes: r.qtd_questoes,
             status: 'enviado'
           }))
           await (supabase as any).from('simulados_upload_requisicoes').insert(insertReqs)
        }
      } else if (currentUserPerfil === 'Professor') {
        // Fallback
        await (supabase as any).from('simulados_upload_requisicoes').insert({
          id_simulado_upload: newSimulado.id,
          id_professor: currentUser?.id,
          professor_nome: currentUser?.nome,
          id_disciplina: null,
          disciplina_nome: 'Geral',
          qtd_questoes: simulado.questoes_count || 0,
          status: 'enviado'
        })
      }
  
      // Redirect to edit
      window.location.href = `/simulados/simulados-upload/${newSimulado.id}/upload`
    } catch (e: any) {
      alert('Erro ao adaptar simulado: ' + e.message)
    }
  }

  const isProfView = currentUserPerfil === 'Professor'

  const filtered = simulados.filter(p => {
    const matchSearch = !search || p.titulo?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'todos' || p.status === filterStatus
    const matchBimestre = filterBimestre === 'todos' || p.id_bimestre === filterBimestre
    const matchSerie = filterSerie === 'todas' || (p.series && (Array.isArray(p.series) ? p.series.includes(filterSerie) : p.series === filterSerie))
    
    // O professor logado só pode ver as simulados em que ele está vinculado
    const isAssigned = !isProfView || (p.simulados_upload_requisicoes || []).some((r: any) => r.id_professor === currentUser?.id)
    
    return matchSearch && matchStatus && matchBimestre && matchSerie && isAssigned
  })

  const isCoord = currentUserPerfil !== 'Professor'

  const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    aguardando: { label: 'Aguardando Upload', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: Clock },
    em_revisao: { label: 'Em Revisão', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', icon: Eye },
    aprovado: { label: 'Aprovado', color: '#10b981', bg: 'rgba(16,185,129,0.1)', icon: CheckCircle },
    resimuladodo: { label: 'Resimuladodo', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: XCircle },
    publicado: { label: 'Publicado', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', icon: BookOpen },
  }

  const stats = {
    total: simulados.length,
    aguardando: simulados.filter(p => p.status === 'aguardando').length,
    em_revisao: simulados.filter(p => p.status === 'em_revisao').length,
    aprovado: simulados.filter(p => p.status === 'aprovado' || p.status === 'publicado').length,
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto' }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(139,92,246,0.3)' }}>
                <Upload size={22} color="white" />
              </div>
              <div>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.02em' }}>
                  Simulados por Upload
                </h1>
                <p style={{ color: 'hsl(var(--text-secondary))', margin: 0, fontSize: 14 }}>
                  {isCoord ? 'Crie e gerencie simulados que serão enviadas por professores' : 'Visualize e envie suas simulados em formato DOCX ou PDF'}
                </p>
              </div>
            </div>
          </div>
          {isCoord && (
            <Link href="/simulados/simulados-upload/nova" style={{ textDecoration: 'none' }}>
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
                <Plus size={18} /> Novo Simulado
              </motion.button>
            </Link>
          )}
        </div>

        {/* Stats */}
        {isCoord && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
            {[
              { label: 'Total de Simulados', value: stats.total, color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', icon: Layers },
              { label: 'Aguardando Upload', value: stats.aguardando, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icon: Clock },
              { label: 'Em Revisão', value: stats.em_revisao, color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', icon: Eye },
              { label: 'Aprovadas', value: stats.aprovado, color: '#10b981', bg: 'rgba(16,185,129,0.08)', icon: CheckCircle },
            ].map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                style={{ background: s.bg, border: `1px solid ${s.color}22`, borderRadius: 16, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: `${s.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <s.icon size={18} color={s.color} />
                </div>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', marginTop: 3, fontWeight: 600 }}>{s.label}</div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 32, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 280px', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-secondary))' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por título do simulado..."
              style={{ width: '100%', padding: '14px 20px 14px 48px', borderRadius: 16, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(139,92,246,0.15)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)' }}
            />
          </div>
          
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <select
              value={filterBimestre}
              onChange={e => setFilterBimestre(e.target.value)}
              style={{ padding: '14px 20px', borderRadius: 16, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', appearance: 'none', minWidth: 160 }}
              onFocus={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(139,92,246,0.15)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)' }}
            >
              <option value="todos">Todos os Bimestres</option>
              {bimestres.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </select>

            <select
              value={filterSerie}
              onChange={e => setFilterSerie(e.target.value)}
              style={{ padding: '14px 20px', borderRadius: 16, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', appearance: 'none', minWidth: 160 }}
              onFocus={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(139,92,246,0.15)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)' }}
            >
              <option value="todas">Todas as Séries</option>
              {seriesOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={{ padding: '14px 20px', borderRadius: 16, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', appearance: 'none', minWidth: 160 }}
              onFocus={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(139,92,246,0.15)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)' }}
            >
              <option value="todos">Todos os Status</option>
              <option value="aguardando">Aguardando Upload</option>
              <option value="em_revisao">Em Revisão</option>
              <option value="aprovado">Aprovado</option>
              <option value="resimuladodo">Resimuladodo</option>
              <option value="publicado">Publicado</option>
            </select>
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
              {search ? 'Nenhum simulado encontrada' : 'Nenhum simulado criada ainda'}
            </h3>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 14, margin: 0 }}>
              {isCoord ? 'Clique em "Novo Simulado" para começar.' : 'Aguarde o coordenador criar um simulado para você.'}
            </p>
          </motion.div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <AnimatePresence>
              {filtered.map((simulado, i) => {
                const sc = statusConfig[simulado.status] || statusConfig['aguardando']
                const Icon = sc.icon
                const isProfView = currentUserPerfil === 'Professor'
                const myAssignment = (simulado.simulados_upload_requisicoes || []).find((r: any) => r.id_professor === currentUser?.id)
                const showUploadBtn = isProfView && myAssignment && myAssignment.status === 'pendente'
                const totalRequested = (simulado.simulados_upload_requisicoes || []).reduce((acc: number, req: any) => acc + (req.qtd_questoes || 0), 0)
                const totalUploaded = Array.isArray(simulado.questoes_json) ? simulado.questoes_json.length : (simulado.questoes_count || 0)

                return (
                  <motion.div key={simulado.id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    transition={{ delay: i * 0.04 }}
                    style={{ position: 'relative', background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 20, transition: 'all 0.2s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#8b5cf655'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(139,92,246,0.1)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'hsl(var(--border-subtle))'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
                  >
                    {/* Neon Badge */}
                    <motion.div
                      animate={{ 
                        boxShadow: [
                          `0 0 0px ${sc.color}00`, 
                          `0 0 15px ${sc.color}99`, 
                          `0 0 0px ${sc.color}00`
                        ] 
                      }}
                      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                      style={{
                        position: 'absolute',
                        top: -10,
                        right: -10,
                        background: 'hsl(var(--bg-surface))',
                        border: `2px solid ${sc.color}`,
                        color: sc.color,
                        padding: '4px 12px',
                        borderRadius: 100,
                        fontSize: 10,
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        zIndex: 10,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <Icon size={12} strokeWidth={3} />
                      {sc.label}
                    </motion.div>

                    {/* Icon */}
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: sc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={22} color={sc.color} />
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 18, fontWeight: 800, color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{simulado.titulo}</span>
                        {simulado.series && simulado.series.length > 0 && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            {(Array.isArray(simulado.series) ? simulado.series : [simulado.series]).map((s: string) => (
                              <span key={s} style={{ padding: '4px 12px', borderRadius: 100, fontSize: 12, fontWeight: 800, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.2)', flexShrink: 0 }}>
                                {s}
                              </span>
                            ))}
                          </div>
                        )}

                      </div>
                      <div style={{ display: 'flex', gap: 16, color: 'hsl(var(--text-secondary))', fontSize: 12, marginBottom: 12 }}>
                        {simulado.id_bimestre && (
                           <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                             <BookOpen size={12} /> {bimestres.find(b => b.id === simulado.id_bimestre)?.nome || 'Bimestre'}
                           </span>
                        )}
                        {simulado.data_aplicacao && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Calendar size={12} /> Aplicação: {simulado.data_aplicacao.split('-').reverse().join('/')}
                          </span>
                        )}
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: simulado.data_limite_upload && new Date(simulado.data_limite_upload) < new Date() ? '#ef4444' : 'inherit' }}>
                          <Clock size={12} /> Prazo: {simulado.data_limite_upload ? simulado.data_limite_upload.split('-').reverse().join('/') : 'Não definido'}
                        </span>
                        {(totalRequested > 0 || totalUploaded > 0) && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Layers size={12} /> {totalUploaded}/{totalRequested} questões
                          </span>
                        )}
                      </div>
                      
                      {simulado.simulados_upload_requisicoes && simulado.simulados_upload_requisicoes.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                          {simulado.simulados_upload_requisicoes.map((req: any) => {
                            const uploaded = Array.isArray(simulado.questoes_json) 
                              ? simulado.questoes_json.filter((q: any) => q.id_professor === req.id_professor).length 
                              : 0;
                            const pct = Math.min(100, Math.round((uploaded / req.qtd_questoes) * 100));
                            const statusColor = uploaded >= req.qtd_questoes ? '#10b981' : '#f59e0b';
                            
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

                            const isMyCard = req.id_professor === currentUser?.id;
                            const canClick = isMyCard || isCoord;
                            const cardContent = (
                              <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'hsl(var(--text-secondary))' }}>
                                  <span><span style={{ fontWeight: 700, color: isMyCard ? '#8b5cf6' : 'hsl(var(--text-primary))' }} title={req.professor_nome}>{formatName(req.professor_nome)}</span> ({req.disciplina_nome})</span>
                                  <span style={{ color: statusColor, fontWeight: 800 }}>{uploaded}/{req.qtd_questoes} q.</span>
                                </div>
                                <div style={{ height: 6, borderRadius: 3, background: 'rgba(100,116,139,0.1)', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${pct}%`, background: statusColor, borderRadius: 3, transition: 'width 0.3s' }} />
                                </div>
                              </>
                            );

                            const cardStyle = { display: 'flex', flexDirection: 'column', gap: 6, background: isMyCard ? 'rgba(139,92,246,0.08)' : 'rgba(100,116,139,0.05)', padding: '8px 12px', borderRadius: 8, border: `1px solid ${isMyCard ? 'rgba(139,92,246,0.3)' : 'hsl(var(--border-subtle))'}`, minWidth: 160, cursor: canClick ? 'pointer' : 'default', transition: 'all 0.2s', textDecoration: 'none' };
                            const hoverProps = canClick ? {
                              onMouseEnter: (e: any) => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(139,92,246,0.15)' },
                              onMouseLeave: (e: any) => { e.currentTarget.style.borderColor = isMyCard ? 'rgba(139,92,246,0.3)' : 'hsl(var(--border-subtle))'; e.currentTarget.style.boxShadow = 'none' }
                            } : {};

                            if (canClick) {
                              return (
                                <Link key={req.id} href={`/simulados/simulados-upload/${simulado.id}/upload?prof=${req.id_professor}`} style={cardStyle as any} {...hoverProps}>
                                  {cardContent}
                                </Link>
                              )
                            }

                            return (
                              <div key={req.id} style={cardStyle as any} {...hoverProps}>
                                {cardContent}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, flexShrink: 0 }}>
                      <button onClick={() => setGabaritoModalId(simulado.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: 'hsl(var(--bg-app))', color: 'hsl(var(--text-primary))', fontSize: 13, fontWeight: 600, border: '1px solid hsl(var(--border-subtle))', cursor: 'pointer' }}>
                        <CheckSquare size={14} /> Gabarito
                      </button>
                      
                      <button onClick={() => handleAdaptar(simulado)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontSize: 13, fontWeight: 600, border: '1px solid rgba(59,130,246,0.2)', cursor: 'pointer' }}>
                        <BookOpen size={14} /> Adaptar
                      </button>
                      
                      <Link href={`/simulados/simulados-upload/${simulado.id}/upload?print=true`} style={{ textDecoration: 'none', display: 'block' }}>
                        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: 'hsl(var(--bg-app))', color: 'hsl(var(--text-primary))', fontSize: 13, fontWeight: 600, border: '1px solid hsl(var(--border-subtle))', cursor: 'pointer' }}>
                          <Printer size={14} /> Imprimir
                        </motion.button>
                      </Link>

                      <Link href={`/simulados/simulados-upload/${simulado.id}/upload?all=true`} style={{ textDecoration: 'none', display: 'block' }}>
                        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: 'hsl(var(--bg-app))', color: 'hsl(var(--text-primary))', fontSize: 13, fontWeight: 600, border: '1px solid hsl(var(--border-subtle))', cursor: 'pointer' }}>
                          <Eye size={14} /> Ver Questões
                        </motion.button>
                      </Link>
                      {isCoord && (
                        <>
                          <Link href={`/simulados/simulados-upload/${simulado.id}/editar`} style={{ textDecoration: 'none', display: 'block' }}>
                            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                              style={{ width: '100%', padding: '8px 16px', borderRadius: 10, background: 'rgba(139,92,246,0.08)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                              <Edit size={14} /> Editar
                            </motion.button>
                          </Link>
                          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                            onClick={() => setDeleteConfirmId(simulado.id)}
                            style={{ width: '100%', padding: '8px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                            <Trash2 size={14} /> Excluir
                          </motion.button>
                        </>
                      )}
                    </div>
                  </motion.div>
                )
              })}
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
                Excluir Simulado
              </h2>
              <p style={{ fontSize: 14, color: 'hsl(var(--text-secondary))', marginBottom: 32, lineHeight: 1.5 }}>
                Tem certeza que deseja excluir este simulado? Esta ação não poderá ser desfeita.
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
        <GabaritoSimuladoModal 
          simuladoUploadId={gabaritoModalId} 
          onClose={() => setGabaritoModalId(null)} 
        />
      )}
    </div>
  )
}
