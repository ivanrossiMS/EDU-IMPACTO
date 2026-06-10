'use client'

import { useState, useEffect } from 'react'
import { useData } from '@/lib/dataContext'
import { useApiQuery } from '@/hooks/useApi'
import { useQueryClient } from '@tanstack/react-query'
import { 
  BookMarked, Plus, Search, Calendar, Edit, Trash2, Filter, 
  Sparkles, CheckCircle, AlertTriangle, Clock, ArrowRight, ChevronDown,
  ArrowLeft, BookOpen, ClipboardList, ListChecks, School
} from 'lucide-react'
import { TableSkeleton } from '@/components/skeletons/TableSkeleton'
import { ListSkeleton } from '@/components/skeletons/ListSkeleton'



interface Registro {
  id: string
  turma_id: string
  ano: string
  data: string
  disciplina: string
  conteudo: string
  observacoes?: string
  aulas?: number
  tipo: 'conteudo' | 'tarefa'
  data_entrega?: string
  created_at?: string
}

const BLANK: Omit<Registro, 'id' | 'created_at'> = {
  turma_id: '',
  ano: '',
  data: new Date().toISOString().split('T')[0],
  disciplina: '',
  conteudo: '',
  observacoes: '',
  aulas: 1,
  tipo: 'conteudo',
  data_entrega: ''
}

const SEG_COLORS: Record<string,string> = { EI:'#10b981', EF1:'#3b82f6', EF2:'#8b5cf6', EM:'#f59e0b', EJA:'#ec4899' }
const SEG_NAMES: Record<string,string> = { 
  'EI': 'Educação Infantil', 
  'EF1': 'Ensino Fundamental I', 
  'EF2': 'Ensino Fundamental II', 
  'EM': 'Ensino Médio', 
  'EJA': 'EJA',
  'Infantil': 'Educação Infantil',
  'Fundamental 1': 'Ensino Fundamental I',
  'Fundamental 2': 'Ensino Fundamental II',
  'Medio': 'Ensino Médio'
}

export default function ConteudosTarefasPage() {
  const { turmas: rawTurmas, cfgCalendarioLetivo = [], cfgNiveisEnsino = [], logSystemAction } = useData()
  const turmas = rawTurmas || []

  const { data: userData } = useApiQuery<any>(['current-user'], '/api/auth/me', {})
  const currentUser = userData?.user || {}

  const queryClient = useQueryClient()

  const { data: registrosData, isLoading: loading, isFetching } = useApiQuery<Registro[]>(
    ['conteudos'],
    '/api/conteudos'
  )
  const registros = registrosData || []
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Estados de Paginação e Visualização
  const [pagina, setPagina] = useState(1)
  const [itensPorPagina, setItensPorPagina] = useState(10)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [registroSelecionado, setRegistroSelecionado] = useState<Registro | null>(null)
  const [metaCriacao, setMetaCriacao] = useState('')

  // Estados de Navegação
  const [turmaSel, setTurmaSel] = useState<string | null>(null)

  // Filtros Home
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString())
  const [filtroSeg, setFiltroSeg] = useState('todos')
  const [busca, setBusca] = useState('')

  // Sincronizar ano vigente inicial
  useEffect(() => {
    const vigente = (cfgCalendarioLetivo || []).find((c: any) => c.isVigente)?.ano?.toString()
    if (vigente) setFiltroAno(vigente)
  }, [cfgCalendarioLetivo])

  // Registros são carregados via useApiQuery acima

  const handleSave = async () => {
    if (!form.turma_id || !form.conteudo) {
      alert('Preencha todos os campos obrigatórios (*)')
      return
    }

    const turmaObj = turmas.find(t => t.id === form.turma_id || t.nome === form.turma_id)
    
    const now = new Date()
    const dataHora = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    
    let userInfo = ''
    if (editingId) {
      const editInfo = `[Editado por: ${currentUser.nome || 'Usuário'} em ${dataHora}]`
      userInfo = metaCriacao ? `${metaCriacao}\n${editInfo}` : editInfo
    } else {
      userInfo = `[Lançado por: ${currentUser.nome || 'Usuário'} em ${dataHora}]`
    }

    const payload = {
      ...form,
      id: editingId,
      ano: turmaObj?.ano || form.ano || filtroAno,
      tipo: 'conteudo',
      observacoes: form.observacoes ? `${userInfo}\n${form.observacoes}` : userInfo
    }

    try {
      const res = await fetch('/api/conteudos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        const savedData = await res.json()
        const realId = savedData.id || editingId || payload.id
        logSystemAction(
          'Acadêmico (Conteúdos)',
          editingId ? 'Edição' : 'Cadastro',
          `${editingId ? 'Atualização' : 'Cadastro'} de conteúdo: ${payload.conteudo}`,
          { registroId: realId, detalhesDepois: payload }
        )
        
        setModalOpen(false)
        setForm(BLANK)
        setEditingId(null)
        queryClient.invalidateQueries({ queryKey: ['conteudos'] })
      } else {
        const err = await res.json()
        alert('Erro ao salvar: ' + err.error)
      }
    } catch (error) {
      console.error('Erro ao salvar registro:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este registro?')) return
    try {
      const res = await fetch(`/api/conteudos?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        const conteudoExcluido = registrosData?.find((c: any) => c.id === id)
        const tituloConteudo = conteudoExcluido?.conteudo || id
        logSystemAction(
          'Acadêmico (Conteúdos)',
          'Exclusão',
          `Exclusão do conteúdo ${tituloConteudo}`,
          { registroId: id, detalhesAntes: conteudoExcluido }
        )
        queryClient.invalidateQueries({ queryKey: ['conteudos'] })
      }
    } catch (error) {
      console.error('Erro ao excluir:', error)
    }
  }

  const openNew = (turmaId?: string) => {
    setEditingId(null)
    setMetaCriacao('')
    setForm({ 
      ...BLANK, 
      tipo: 'conteudo', 
      turma_id: turmaId || turmaSel || '',
      ano: filtroAno
    })
    setModalOpen(true)
  }

  const openEdit = (r: Registro) => {
    setEditingId(r.id)
    const obs = r.observacoes || ''
    
    const lines = obs.split('\n')
    let lancadoLine = ''
    let resto = []
    
    for (const line of lines) {
      if (line.startsWith('[Lançado por:')) {
        lancadoLine = line
      } else if (line.startsWith('[Editado por:')) {
        // Ignora a linha de edição antiga ao carregar para o form
      } else {
        resto.push(line)
      }
    }
    
    setMetaCriacao(lancadoLine)
    setForm({
      turma_id: r.turma_id,
      ano: r.ano,
      data: r.data,
      disciplina: r.disciplina,
      conteudo: r.conteudo,
      observacoes: resto.join('\n').trim(),
      aulas: r.aulas || 1,
      tipo: r.tipo,
      data_entrega: r.data_entrega || ''
    })
    setModalOpen(true)
  }

  // Filtragem de Turmas para a Home
  const turmasFiltradas = turmas.filter(t =>
    (filtroAno === 'todos' || String(t.ano) === filtroAno) &&
    (filtroSeg === 'todos' || (t as any).dados?.segmento === filtroSeg) &&
    (!busca || t.nome.toLowerCase().includes(busca.toLowerCase()))
  )

  const registrosDaTurma = registros.filter(r => r.turma_id === turmaSel)
  
  // Ordenar por data decrescente
  const registrosOrdenados = [...registrosDaTurma].sort((a, b) => b.data.localeCompare(a.data))
  
  // Paginação
  const totalPages = Math.ceil(registrosOrdenados.length / itensPorPagina)
  const paginatedItems = registrosOrdenados.slice((pagina - 1) * itensPorPagina, pagina * itensPorPagina)

  const renderConteudo = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => (
      <span key={i}>
        {line.split(/(\*\*.*?\*\*)/g).map((part, j) => 
          part.startsWith('**') && part.endsWith('**') 
            ? <strong key={j}>{part.slice(2, -2)}</strong> 
            : part
        )}
        <br />
      </span>
    ));
  }

  return (
    <div style={{ padding: '32px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>

      
      {!turmaSel ? (
        /* ================= VISTA HOME (LISTA DE TURMAS) ================= */
        <div>
          {/* Header */}
          <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <Sparkles size={20} style={{ color: '#2563eb' }} />
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '1px' }}>Diário Digital</span>
              </div>
              <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 32, color: '#0f172a', margin: 0, letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Conteúdos e Tarefas
                {isFetching && (
                  <span style={{ fontSize: '14px', color: '#3b82f6', fontWeight: 600 }}>• Atualizando...</span>
                )}
              </h1>
              <p style={{ fontSize: 14, color: '#64748b', margin: '4px 0 0 0' }}>Gerencie os conteúdos lecionados e as tarefas agendadas por turma.</p>
            </div>
          </div>

          {/* Barra de Filtros */}
          <div style={{ background: '#fff', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ width: '120px' }}>
              <select 
                className="form-input" 
                style={{ height: '40px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '13px' }}
                value={filtroAno}
                onChange={e => setFiltroAno(e.target.value)}
              >
                <option value="todos">Todos os Anos</option>
                {(cfgCalendarioLetivo && cfgCalendarioLetivo.length > 0) ? (
                  [...cfgCalendarioLetivo].sort((a,b) => Number(b.ano) - Number(a.ano)).map((c: any) => (
                    <option key={c.id} value={c.ano}>{c.ano}</option>
                  ))
                ) : (
                  <>
                    <option value="2026">2026</option>
                    <option value="2025">2025</option>
                  </>
                )}
              </select>
            </div>

            <div style={{ width: '150px' }}>
              <select 
                className="form-input" 
                style={{ height: '40px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '13px' }}
                value={filtroSeg}
                onChange={e => setFiltroSeg(e.target.value)}
              >
                <option value="todos">Todos Segmentos</option>
                {cfgNiveisEnsino.map((n: any) => (
                  <option key={n.id} value={n.nome}>{n.nome}</option>
                ))}
              </select>
            </div>

            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input 
                className="form-input" 
                style={{ paddingLeft: 36, height: '40px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '13px' }} 
                placeholder="Buscar turma..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
            </div>
          </div>

          {/* Tabela de Turmas */}
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Turma</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Série</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Segmento</th>
                  <th style={{ padding: '16px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Lançamentos</th>
                  <th style={{ padding: '16px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton rows={5} cols={5} />
                ) : turmasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>Nenhuma turma encontrada.</td>
                  </tr>
                ) : (
                  turmasFiltradas.map(turma => {
                    const conts = registros.filter(r => r.turma_id === turma.nome).length
                    const color = SEG_COLORS[turma.serie] || '#3b82f6'
                    const segValue = (turma as any).dados?.segmento || (turma as any).segmento
                    const segmentoNome = SEG_NAMES[segValue] || SEG_NAMES[turma.serie] || segValue || turma.serie || 'Não Definido'

                    return (
                      <tr key={turma.id || turma.nome} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '16px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{turma.nome}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{turma.ano} • {turma.turno}</div>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <span style={{ padding: '4px 8px', borderRadius: '4px', background: `${color}15`, color, fontSize: '11px', fontWeight: 700 }}>
                            {turma.serie}
                          </span>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <span style={{ fontSize: '13px', color: '#475569' }}>
                            {segmentoNome}
                          </span>
                        </td>
                        <td style={{ padding: '16px', textAlign: 'center' }}>
                          <span style={{ fontWeight: 700, color: conts > 0 ? '#2563eb' : '#94a3b8' }}>{conts}</span>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button 
                              onClick={() => openNew(turma.nome)}
                              style={{ height: '32px', padding: '0 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Plus size={14} /> Lançar
                            </button>
                            <button 
                              onClick={() => setTurmaSel(turma.nome)}
                              style={{ height: '32px', padding: '0 12px', background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              Gerenciar <ArrowRight size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ================= VISTA INTERNA (GERENCIAR TURMA) ================= */
        <div>
          {/* Header Interno */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button 
                style={{ border: '1px solid #e2e8f0', background: '#fff', width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0f172a' }} 
                onClick={() => setTurmaSel(null)}
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 24, color: '#0f172a', margin: 0 }}>{turmaSel}</h1>
                <p style={{ fontSize: 13, color: '#64748b', margin: '2px 0 0 0' }}>Visualizando lançamentos da turma.</p>
              </div>
            </div>
            
            <button 
              onClick={() => openNew()}
              style={{ height: '44px', padding: '0 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Plus size={16} />
              <span>Novo Lançamento</span>
            </button>
          </div>

          {/* Listagem Paginada */}
          {loading ? (
            <ListSkeleton count={3} />
          ) : registrosOrdenados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', color: '#64748b' }}>
              Nenhum registro encontrado para esta turma.
            </div>
          ) : (
            <div>
              {/* Controles de Paginação (Topo) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', color: '#64748b' }}>
                  Mostrando <strong>{paginatedItems.length}</strong> de <strong>{registrosOrdenados.length}</strong> lançamentos.
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>Itens por página:</span>
                  <select 
                    value={itensPorPagina} 
                    onChange={e => { setItensPorPagina(Number(e.target.value)); setPagina(1); }}
                    style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff' }}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              {/* Lista de Lançamentos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {paginatedItems.map(r => {
                  const obs = r.observacoes || ''
                  const match = obs.match(/^\[Lançado por: ([^\]]+)\]\s*([\s\S]*)$/)
                  const usuario = match ? match[1] : 'Usuário'
                  
                  return (
                    <div 
                      key={r.id}
                      onClick={() => { setRegistroSelecionado(r); setViewModalOpen(true); }}
                      style={{ background: '#fff', padding: '16px 24px', borderRadius: '12px', border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.background = '#f8fafc'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '120px' }}>
                          <Calendar size={16} style={{ color: '#2563eb' }} />
                          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>{r.data.split('T')[0].split('-').reverse().join('/')}</span>
                        </div>
                        
                        <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={14} />
                          <span>Registrado por: <strong>{usuario}</strong></span>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{ fontSize: '13px', color: '#2563eb', fontWeight: 600 }}>Ver Detalhes →</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button 
                            onClick={(e) => { e.stopPropagation(); openEdit(r); }}
                            style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          >
                            <Edit size={14} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
                            style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Controles de Paginação (Rodapé) */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
                  <button 
                    disabled={pagina === 1}
                    onClick={() => setPagina(p => Math.max(1, p - 1))}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: pagina === 1 ? 'not-allowed' : 'pointer', color: pagina === 1 ? '#cbd5e1' : '#0f172a' }}
                  >
                    Anterior
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button
                        key={p}
                        onClick={() => setPagina(p)}
                        style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1px solid', borderColor: p === pagina ? '#2563eb' : '#e2e8f0', background: p === pagina ? '#2563eb' : '#fff', color: p === pagina ? '#fff' : '#0f172a', cursor: 'pointer', fontWeight: 600 }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <button 
                    disabled={pagina === totalPages}
                    onClick={() => setPagina(p => Math.min(totalPages, p + 1))}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: pagina === totalPages ? 'not-allowed' : 'pointer', color: pagina === totalPages ? '#cbd5e1' : '#0f172a' }}
                  >
                    Próximo
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal de Lançamento */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '600px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', overflow: 'hidden' }}>
            
            <div style={{ padding: '24px 32px', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: '20px', color: '#fff', margin: 0 }}>
                  {editingId ? 'Editar' : 'Novo'} Lançamento
                </h2>
                <p style={{ fontSize: '13px', color: '#e0e7ff', margin: '4px 0 0 0' }}>Preencha os dados abaixo.</p>
              </div>
              <button onClick={() => setModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '24px' }}>&times;</button>
            </div>
            
            <div style={{ padding: '32px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>Turma *</label>
                  <select 
                    className="form-input" 
                    style={{ height: '48px', borderRadius: '12px', background: '#f1f5f9', border: '1px solid #e2e8f0', fontSize: '14px', color: '#475569' }}
                    value={form.turma_id}
                    onChange={e => setForm(p => ({ ...p, turma_id: e.target.value }))}
                    disabled={!!form.turma_id}
                  >
                    <option value="">Selecione a Turma</option>
                    {turmas.map(t => <option key={t.id || t.nome} value={t.nome}>{t.nome}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>Data *</label>
                  <input 
                    type="date"
                    className="form-input" 
                    style={{ height: '48px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '14px' }}
                    value={form.data}
                    onChange={e => setForm(p => ({ ...p, data: e.target.value }))}
                  />
                </div>

                <div style={{ gridColumn: '1/-1', background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={16} style={{ color: '#2563eb' }} />
                  <span style={{ fontSize: '13px', color: '#64748b' }}>
                    Registrado por <strong>{currentUser.nome || 'Usuário'}</strong> em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>Conteúdo e Tarefa do Dia *</label>
                  <textarea 
                    className="form-input" 
                    style={{ height: '150px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '14px', padding: '12px', resize: 'none' }}
                    placeholder="Digite aqui o conteúdo lecionado e as tarefas agendadas..."
                    value={form.conteudo}
                    onChange={e => setForm(p => ({ ...p, conteudo: e.target.value }))}
                  />
                </div>

                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>Observações</label>
                  <textarea 
                    className="form-input" 
                    style={{ height: '60px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '14px', padding: '12px', resize: 'none' }}
                    placeholder="Observações adicionais..."
                    value={form.observacoes}
                    onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))}
                  />
                </div>
                
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
                <button 
                  onClick={() => setModalOpen(false)}
                  style={{ height: '44px', padding: '0 20px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSave}
                  style={{ height: '44px', padding: '0 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <CheckCircle size={16} />
                  <span>Salvar</span>
                </button>
              </div>
            </div>
            
          </div>
        </div>
      )}

      {/* Modal de Detalhes */}
      {viewModalOpen && registroSelecionado && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '600px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', overflow: 'hidden' }}>
            
            <div style={{ padding: '24px 32px', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: '20px', color: '#fff', margin: 0 }}>
                  Detalhes do Lançamento
                </h2>
                <p style={{ fontSize: '13px', color: '#e0e7ff', margin: '4px 0 0 0' }}>Visualizando informações completas.</p>
              </div>
              <button onClick={() => setViewModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '24px' }}>&times;</button>
            </div>
            
            <div style={{ padding: '32px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                <div style={{ display: 'flex', gap: '24px' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Turma</span>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{registroSelecionado.turma_id}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Data</span>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{registroSelecionado.data.split('T')[0].split('-').reverse().join('/')}</div>
                  </div>
                </div>

                {/* Bloco de Usuário */}
                {(() => {
                  const obs = registroSelecionado.observacoes || ''
                  
                  const lines = obs.split('\n')
                  let lancado = ''
                  let editado = ''
                  let resto = []
                  
                  for (const line of lines) {
                    if (line.startsWith('[Lançado por:')) {
                      lancado = line.replace('[Lançado por: ', '').replace(']', '')
                    } else if (line.startsWith('[Editado por:')) {
                      editado = line.replace('[Editado por: ', '').replace(']', '')
                    } else {
                      resto.push(line)
                    }
                  }
                  
                  const infoReal = resto.join('\n').trim()
                  
                  return (
                    <>
                      <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {lancado && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Clock size={14} style={{ color: '#2563eb' }} />
                            <span style={{ fontSize: '13px', color: '#64748b' }}>
                              Registrado por <strong>{lancado}</strong>
                            </span>
                          </div>
                        )}
                        {editado && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Edit size={14} style={{ color: '#10b981' }} />
                            <span style={{ fontSize: '13px', color: '#64748b' }}>
                              Editado por <strong>{editado}</strong>
                            </span>
                          </div>
                        )}
                        {!lancado && !editado && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Clock size={14} style={{ color: '#2563eb' }} />
                            <span style={{ fontSize: '13px', color: '#64748b' }}>
                              Registrado por <strong>Usuário</strong>
                            </span>
                          </div>
                        )}
                      </div>

                      <div>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Conteúdo e Tarefa</span>
                        <div style={{ fontSize: '14px', color: '#334155', background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap', marginTop: '4px', lineHeight: 1.5 }}>
                          {renderConteudo(registroSelecionado.conteudo)}
                        </div>
                      </div>

                      {infoReal && (
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Observações</span>
                          <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>
                            {infoReal}
                          </div>
                        </div>
                      )}
                    </>
                  )
                })()}
                
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
                <button 
                  onClick={() => setViewModalOpen(false)}
                  style={{ height: '44px', padding: '0 20px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Fechar
                </button>
                <button 
                  onClick={() => { setViewModalOpen(false); openEdit(registroSelecionado); }}
                  style={{ height: '44px', padding: '0 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Edit size={16} />
                  <span>Editar</span>
                </button>
              </div>
            </div>
            
          </div>
        </div>
      )}
    </div>
  )
}
