'use client'
import { motion, AnimatePresence } from 'framer-motion';

import { useState, useMemo } from 'react'
import { Wrench, Plus, AlertTriangle, CheckCircle, Clock, Calendar, User, Trash2, X, Save, RotateCcw, Search, Briefcase, Building, Check } from 'lucide-react'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import { useData, newId, Tarefa } from '@/lib/dataContext'
import { useApp } from '@/lib/context'

type Status = 'aberto' | 'em_andamento' | 'concluido'
type Prioridade = 'urgente' | 'alta' | 'media' | 'baixa'

interface Chamado {
  id: string; codigo?: string; titulo: string; local: string; descricao: string
  tipo?: string; prioridade: Prioridade; status: Status; responsavel: string; abertura: string
  // Auditoria
  usuarioAberto?: string; dataAberto?: string
  usuarioAndamento?: string; dataAndamento?: string
  usuarioConcluido?: string; dataConcluido?: string
}
const BLANK: Omit<Chamado, 'id' | 'abertura'> = {
  titulo: '', local: '', descricao: '', tipo: 'geral', prioridade: 'media', status: 'aberto', responsavel: '',
  usuarioAberto: '', dataAberto: '', usuarioAndamento: '', dataAndamento: '', usuarioConcluido: '', dataConcluido: ''
}

const P_CONFIG: Record<Prioridade, { color: string; label: string }> = {
  urgente: { color: '#ef4444', label: '🚨 Urgente' },
  alta: { color: '#f59e0b', label: '🔴 Alta' },
  media: { color: '#3b82f6', label: '🔵 Média' },
  baixa: { color: '#10b981', label: '🟢 Baixa' },
}
const S_CONFIG: Record<Status, { badge: string; label: string; icon: React.ReactNode }> = {
  aberto: { badge: 'badge-warning', label: 'Aberto', icon: <AlertTriangle size={11} /> },
  em_andamento: { badge: 'badge-primary', label: 'Em andamento', icon: <Clock size={11} /> },
  concluido: { badge: 'badge-success', label: 'Concluído', icon: <CheckCircle size={11} /> },
}

export default function ManutencaoPage() {
  const [chamados, setChamados, { loading: l1 }] = useSupabaseArray<Chamado>('administrativo/manutencao', [])
  const [funcionarios, setFuncionarios, { loading: l2 }] = useSupabaseArray<any>('rh/funcionarios', [])
  const { setTarefas } = useData()
  const { currentUser } = useApp()

  const [filtro, setFiltro] = useState<Status | 'todos'>('todos')
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [modalFunc, setModalFunc] = useState(false)
  const [buscaFunc, setBuscaFunc] = useState('')
  const [form, setForm] = useState<Omit<Chamado, 'id' | 'abertura'>>(BLANK)
  const [del, setDel] = useState<string | null>(null)

  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  const chamadosArr = Array.isArray(chamados) ? chamados : []
  const funcionariosArr = Array.isArray(funcionarios) ? funcionarios : []

  const filtered = chamadosArr.filter(c => filtro === 'todos' || c.status === filtro)
  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const { abertos, urgentes } = useMemo(() => ({
    abertos: chamadosArr.filter(c => c.status === 'aberto').length,
    urgentes: chamadosArr.filter(c => c.prioridade === 'urgente').length
  }), [chamadosArr])

  const filteredFuncs = useMemo(() => {
    const b = buscaFunc.toLowerCase()
    return funcionariosArr.filter(f => 
      f && f.nome && (
        f.nome.toLowerCase().includes(b) || 
        f.cargo?.toLowerCase().includes(b) || 
        f.departamento?.toLowerCase().includes(b)
      )
    ).slice(0, 20)
  }, [funcionariosArr, buscaFunc])

  const gerarCodMP = () => {
    const existentes = chamadosArr.map(c => (c as any).codigo).filter(Boolean)
    let i = chamadosArr.length + 1
    let cod = `MP${String(i).padStart(3, '0')}`
    while (existentes.includes(cod)) { i++; cod = `MP${String(i).padStart(3, '0')}` }
    return cod
  }

  const save = () => {
    if (!form.titulo.trim()) return
    const agora = new Date().toISOString()
    
    if (editId) {
      setChamados(prev => (prev || []).map(c => c.id === editId ? { ...c, ...form } : c))
    } else {
      const codigo = gerarCodMP()
      const id = newId('MAN')
      const novoChamado: Chamado = { 
        ...form, 
        codigo, id, 
        abertura: new Date().toLocaleDateString('pt-BR'),
        dataAberto: agora,
        usuarioAberto: currentUser?.nome || 'Sistema'
      }
      setChamados(prev => [...prev, novoChamado])

      // Integração com Tarefas
      if (form.responsavel) {
        const novaTarefa: Tarefa = {
          id: newId('TAR'),
          titulo: `[Manutenção] ${form.titulo}`,
          descricao: `Chamado ${codigo}: ${form.descricao || 'Sem descrição'}\nLocal: ${form.local}`,
          responsavel: form.responsavel,
          prazo: new Date().toISOString().split('T')[0],
          status: 'pendente',
          prioridade: form.prioridade === 'urgente' ? 'urgente' : (form.prioridade as any)
        }
        setTarefas(prev => [...prev, novaTarefa])
      }
    }

    setModal(false); setForm(BLANK); setEditId(null)
  }

  const abrirEdicao = (c: Chamado) => {
    const { id, abertura, ...rest } = c
    setForm(rest)
    setEditId(id)
    setModal(true)
  }

  const mudarStatus = (id: string, novo: Status) => {
    setChamados(prev => (prev || []).map(c => {
      if (c.id !== id) return c
      const agora = new Date().toISOString()
      const upd: Partial<Chamado> = { status: novo }
      
      if (novo === 'em_andamento') {
        upd.dataAndamento = agora
        upd.usuarioAndamento = currentUser?.nome || 'Sistema'
      } else if (novo === 'concluido') {
        upd.dataConcluido = agora
        upd.usuarioConcluido = currentUser?.nome || 'Sistema'
      } else if (novo === 'aberto') {
        upd.dataAndamento = undefined; upd.usuarioAndamento = undefined;
        upd.dataConcluido = undefined; upd.usuarioConcluido = undefined;
      }
      
      return { ...c, ...upd }
    }))
  }

  const remove = () => { if (del) { setChamados(prev => (prev || []).filter(c => c.id !== del)); setDel(null) } }
  const fmtDT = (d?: string) => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
  const f = (k: keyof typeof BLANK, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  if (l1 || l2) return <PageSkeleton />

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🔧 Manutenção Predial</h1>
          <p className="page-subtitle">{abertos} chamado(s) aberto(s) • {urgentes} urgente(s)</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}><Plus size={13} />Novo Chamado</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Abertos', value: abertos, color: '#f59e0b', icon: '📋' },
          { label: 'Em andamento', value: chamadosArr.filter(c => c.status === 'em_andamento').length, color: '#3b82f6', icon: '🔧' },
          { label: 'Concluídos', value: chamadosArr.filter(c => c.status === 'concluido').length, color: '#10b981', icon: '✅' },
          { label: 'Urgentes', value: urgentes, color: '#ef4444', icon: '🚨' },
        ].map(c => (
          <div key={c.label} className="kpi-card">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>{c.icon}</span>
              <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{c.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color, fontFamily: 'Outfit, sans-serif' }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(['todos', 'aberto', 'em_andamento', 'concluido'] as const).map(s => (
          <button key={s} className={`btn ${filtro === s ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setFiltro(s)}>
            {s === 'todos' ? 'Todos' : S_CONFIG[s]?.label || s}
          </button>
        ))}
      </div>

      {paginated.length === 0 ? (
        <div className="card" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <Wrench size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Nenhum chamado de manutenção</div>
          <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 20 }}>Registre chamados para acompanhar reparos e manutenções.</div>
          <button className="btn btn-primary btn-sm" onClick={() => { setForm(BLANK); setEditId(null); setModal(true) }}><Plus size={13} />Abrir Primeiro Chamado</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {paginated.map(c => {
            const pc = P_CONFIG[c.prioridade]
            const sc = S_CONFIG[c.status]
            return (
              <motion.div 
                layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                key={c.id} 
                className="card"
                style={{ 
                  padding: 0, overflow: 'hidden', border: '1px solid hsl(var(--border-subtle))',
                  background: 'hsl(var(--bg-surface))', position: 'relative'
                }}
              >
                {/* Linha de Prioridade no topo */}
                <div style={{ height: 4, background: pc.color }} />
                
                <div style={{ padding: '20px 24px' }}>
                  <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                    {/* Icone e Codigo */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${pc.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: pc.color }}>
                        <Wrench size={22} />
                      </div>
                      <code style={{ fontSize: 10, padding: '2px 6px', background: 'hsl(var(--bg-elevated))', color: 'hsl(var(--text-muted))', borderRadius: 4, fontWeight: 700 }}>
                        {c.codigo || 'MP---'}
                      </code>
                    </div>

                    {/* Informações Principais */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 800 }}>{c.titulo}</h3>
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 100, background: `${pc.color}15`, color: pc.color, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {pc.label.split(' ')[1]}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'hsl(var(--text-muted))', fontSize: 13 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Building size={12} /> {c.local}</span>
                            <span>•</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{sc.icon} {sc.label}</span>
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', gap: 6 }}>
                           <button className="btn btn-ghost btn-icon btn-sm" onClick={() => abrirEdicao(c)}><Save size={15} /></button>
                           <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => setDel(c.id)}><Trash2 size={15} /></button>
                        </div>
                      </div>

                      <div style={{ background: 'hsl(var(--bg-elevated))', padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 20, color: 'hsl(var(--text-secondary))' }}>
                        {c.descricao || 'Nenhuma descrição fornecida.'}
                      </div>

                      {/* Timeline de Status (Ultra Moderno) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 0, position: 'relative', padding: '10px 0' }}>
                        {/* Linha de fundo */}
                        <div style={{ position: 'absolute', top: 22, left: '10%', right: '10%', height: 2, background: 'hsl(var(--border-subtle))', zIndex: 0 }} />
                        
                        {/* Passo 1: Aberto */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, gap: 8 }}>
                          <div style={{ width: 24, height: 24, borderRadius: 100, background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 0 0 4px hsl(var(--bg-surface))' }}>
                            <Check size={14} />
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: '#10b981' }}>ABERTO</div>
                            <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))' }}>{fmtDT(c.dataAberto) || c.abertura}</div>
                            <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>{c.usuarioAberto || 'Sistema'}</div>
                          </div>
                        </div>

                        {/* Passo 2: Em Andamento */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, gap: 8 }}>
                          <div style={{ 
                            width: 24, height: 24, borderRadius: 100, 
                            background: c.status !== 'aberto' ? '#3b82f6' : 'hsl(var(--bg-elevated))', 
                            border: c.status === 'aberto' ? '2px solid hsl(var(--border-default))' : 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                            boxShadow: '0 0 0 4px hsl(var(--bg-surface))'
                          }}>
                            {c.status !== 'aberto' ? <Check size={14} /> : <div style={{ width: 6, height: 6, borderRadius: 100, background: 'hsl(var(--text-muted))' }} />}
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: c.status !== 'aberto' ? '#3b82f6' : 'hsl(var(--text-muted))' }}>EM ANDAMENTO</div>
                            {c.dataAndamento ? (
                              <>
                                <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))' }}>{fmtDT(c.dataAndamento)}</div>
                                <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>{c.usuarioAndamento}</div>
                              </>
                            ) : c.status === 'aberto' ? (
                              <motion.button 
                                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                className="btn btn-primary" 
                                style={{ fontSize: 10, marginTop: 4, height: 28, padding: '0 12px', borderRadius: 8, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)', fontWeight: 700 }}
                                onClick={() => mudarStatus(c.id, 'em_andamento')}
                              >
                                INICIAR MANUTENÇÃO
                              </motion.button>
                            ) : null}
                          </div>
                        </div>

                        {/* Passo 3: Concluído */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, gap: 8 }}>
                          <div style={{ 
                            width: 24, height: 24, borderRadius: 100, 
                            background: c.status === 'concluido' ? '#10b981' : 'hsl(var(--bg-elevated))', 
                            border: c.status !== 'concluido' ? '2px solid hsl(var(--border-default))' : 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                            boxShadow: '0 0 0 4px hsl(var(--bg-surface))'
                          }}>
                            {c.status === 'concluido' ? <Check size={14} /> : <div style={{ width: 6, height: 6, borderRadius: 100, background: 'hsl(var(--text-muted))' }} />}
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: c.status === 'concluido' ? '#10b981' : 'hsl(var(--text-muted))' }}>CONCLUÍDO</div>
                            {c.dataConcluido ? (
                              <>
                                <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))' }}>{fmtDT(c.dataConcluido)}</div>
                                <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>{c.usuarioConcluido}</div>
                              </>
                            ) : c.status === 'em_andamento' ? (
                              <motion.button 
                                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                className="btn btn-success" 
                                style={{ fontSize: 10, marginTop: 4, height: 28, padding: '0 12px', borderRadius: 8, background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)', fontWeight: 700, color: 'white' }}
                                onClick={() => mudarStatus(c.id, 'concluido')}
                              >
                                CONCLUIR REPARO
                              </motion.button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Lado Direito: Responsável */}
                    <div style={{ width: 180, borderLeft: '1px solid hsl(var(--border-subtle))', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                       <div style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', letterSpacing: '0.05em' }}>RESPONSÁVEL</div>
                       {c.responsavel ? (
                         <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 100, background: 'hsl(var(--primary-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--primary))' }}>
                              <User size={16} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.responsavel}</div>
                              <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>Técnico Atribuído</div>
                            </div>
                         </div>
                       ) : (
                         <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>Não atribuído</div>
                       )}

                       {c.status === 'concluido' && (
                         <button 
                            className="btn btn-ghost btn-xs" 
                            style={{ color: '#f59e0b', fontSize: 10, marginTop: 'auto' }}
                            onClick={() => mudarStatus(c.id, 'aberto')}
                          >
                            <RotateCcw size={10} /> Reabrir Chamado
                          </button>
                       )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'hsl(var(--bg-surface))', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Itens por página:</span>
            <select className="form-input" style={{ width: 70, height: 32, fontSize: 12 }} value={itemsPerPage} onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1) }}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
             <button className="btn btn-secondary btn-sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Anterior</button>
             <div style={{ display: 'flex', gap: 4 }}>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button key={i} className={`btn btn-sm ${currentPage === i + 1 ? 'btn-primary' : 'btn-ghost'}`} style={{ minWidth: 32 }} onClick={() => setCurrentPage(i + 1)}>
                    {i + 1}
                  </button>
                ))}
             </div>
             <button className="btn btn-secondary btn-sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Próximo</button>
          </div>
        </div>
      )}

      <AnimatePresence>
{modal && (
<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, backdropFilter: 'blur(4px)' }}>
          <motion.div initial={{scale:0.95, opacity:0, y:20}} animate={{scale:1, opacity:1, y:0}} exit={{scale:0.95, opacity:0, y:20}} transition={{ type: "spring", stiffness: 300, damping: 25 }} style={{ background: 'hsl(var(--bg-surface))', borderRadius: 16, width: '100%', maxWidth: 520, border: '1px solid hsl(var(--border-default))', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{editId ? 'Editar Chamado' : 'Novo Chamado de Manutenção'}</div>
              <button onClick={() => { setModal(false); setEditId(null); setForm(BLANK) }} className="btn btn-ghost btn-icon"><X size={16} /></button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label className="form-label">Título *</label><input className="form-input" value={form.titulo} onChange={e => f('titulo', e.target.value)} placeholder="Ex: Ar-condicionado com defeito" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div><label className="form-label">Local</label><input className="form-input" value={form.local} onChange={e => f('local', e.target.value)} placeholder="Ex: Sala 12 — 2º andar" /></div>
                <div><label className="form-label">Tipo</label>
                  <select className="form-input" value={(form as any).tipo || 'geral'} onChange={e => f('tipo', e.target.value)}>
                    <option value="geral">🔧 Geral</option>
                    <option value="eletrico">⚡ Elétrico</option>
                    <option value="hidraulico">🚿 Hidráulico</option>
                    <option value="civil">🏗️ Civil/Estrutural</option>
                    <option value="ar-condicionado">❄️ Ar-condicionado</option>
                    <option value="ti">💻 TI/Redes</option>
                    <option value="pintura">🎨 Pintura</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Responsável</label>
                  <div 
                    onClick={() => setModalFunc(true)}
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                      background: 'hsl(var(--bg-elevated))', borderRadius: 8, cursor: 'pointer',
                      border: '1px solid hsl(var(--border-subtle))', transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'hsl(var(--primary))'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: 100, background: 'hsl(var(--primary-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--primary))' }}>
                      <User size={14} />
                    </div>
                    <div style={{ flex: 1, fontSize: 13, color: form.responsavel ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))' }}>
                      {form.responsavel || 'Selecionar colaborador...'}
                    </div>
                    {form.responsavel && (
                      <button 
                        className="btn btn-ghost btn-icon btn-xs" 
                        onClick={(e) => { e.stopPropagation(); f('responsavel', '') }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
                <div><label className="form-label">Prioridade</label>
                  <select className="form-input" value={form.prioridade} onChange={e => f('prioridade', e.target.value)}>
                    <option value="baixa">🟢 Baixa</option>
                    <option value="media">🔵 Média</option>
                    <option value="alta">🔴 Alta</option>
                    <option value="urgente">🚨 Urgente</option>
                  </select>
                </div>
                <div><label className="form-label">Status inicial</label>
                  <select className="form-input" value={form.status} onChange={e => f('status', e.target.value)}>
                    <option value="aberto">Aberto</option>
                    <option value="em_andamento">Em andamento</option>
                  </select>
                </div>
              </div>
              <div><label className="form-label">Descrição detalhada</label><textarea className="form-input" style={{ minHeight: 72 }} value={form.descricao} onChange={e => f('descricao', e.target.value)} /></div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}><Save size={13} />Abrir Chamado</button>
            </div>
          </motion.div>
        
</motion.div>
)}</AnimatePresence>

      <AnimatePresence>
{del && (
<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <motion.div initial={{scale:0.95, opacity:0, y:20}} animate={{scale:1, opacity:1, y:0}} exit={{scale:0.95, opacity:0, y:20}} transition={{ type: "spring", stiffness: 300, damping: 25 }} style={{ background: 'hsl(var(--bg-surface))', borderRadius: 16, padding: 28, maxWidth: 400, border: '1px solid hsl(var(--border-default))', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Excluir chamado?</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setDel(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={remove}><Trash2 size={13} />Excluir</button>
            </div>
          </motion.div>
        
</motion.div>
)}</AnimatePresence>
      <AnimatePresence>
        {modalFunc && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20, backdropFilter: 'blur(4px)' }}>
            <motion.div initial={{scale:0.95, opacity:0, y:20}} animate={{scale:1, opacity:1, y:0}} exit={{scale:0.95, opacity:0, y:20}} transition={{ type: "spring", stiffness: 300, damping: 25 }} style={{ background: 'hsl(var(--bg-surface))', borderRadius: 20, width: '100%', maxWidth: 460, border: '1px solid hsl(var(--border-default))', boxShadow: '0 24px 60px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
              <div style={{ padding: '18px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(to right, hsl(var(--bg-surface)), hsl(var(--bg-elevated)))' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'hsl(var(--primary-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--primary))' }}>
                    <Search size={16} />
                  </div>
                  <span style={{ fontWeight: 800, fontSize: 16 }}>Selecionar Responsável</span>
                </div>
                <button onClick={() => setModalFunc(false)} className="btn btn-ghost btn-icon btn-sm"><X size={16} /></button>
              </div>
              
              <div style={{ padding: 16 }}>
                <div style={{ position: 'relative', marginBottom: 12 }}>
                  <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
                  <input 
                    className="form-input" 
                    style={{ paddingLeft: 36, height: 42, borderRadius: 10 }}
                    placeholder="Buscar por nome, cargo ou depto..." 
                    value={buscaFunc} 
                    onChange={e => setBuscaFunc(e.target.value)}
                    autoFocus
                  />
                </div>

                <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, padding: 4 }}>
                  {filteredFuncs.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
                      <User size={32} style={{ opacity: 0.1, margin: '0 auto 12px' }} />
                      Nenhum colaborador encontrado
                    </div>
                  ) : (
                    filteredFuncs.map(f => (
                      <div 
                        key={f.id}
                        onClick={() => { setForm(p => ({...p, responsavel: f.nome})); setModalFunc(false); setBuscaFunc('') }}
                        style={{ 
                          padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.2s',
                          border: '1px solid transparent'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'hsl(var(--bg-elevated))'
                          e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.borderColor = 'transparent'
                        }}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: 100, background: 'hsl(var(--bg-overlay))', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {f.foto ? <img src={f.foto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={18} style={{ opacity: 0.5 }} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.nome}</div>
                          <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Briefcase size={10} /> {f.cargo || 'Funcionário'}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Building size={10} /> {f.departamento || 'Geral'}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div style={{ padding: '14px 20px', borderTop: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-elevated))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{filteredFuncs.length} colaboradores listados</span>
                <button className="btn btn-secondary btn-sm" onClick={() => setModalFunc(false)}>Fechar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
