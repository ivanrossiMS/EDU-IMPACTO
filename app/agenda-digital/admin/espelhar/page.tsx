'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useData } from '@/lib/dataContext'
import { useRouter } from 'next/navigation'
import { Search, Filter, MonitorSmartphone, ChevronRight, UserCog, AlertCircle, Building, Users, X } from 'lucide-react'
import { UserAvatar } from '@/components/UserAvatar'
import { supabase } from '@/lib/supabase'


export default function EspelharAgendaPage() {
  const router = useRouter()
  const [turmasData, , { loading: loadingT }] = useSupabaseArray<any>('turmas')
  const [alunosData, , { loading: loadingA }] = useSupabaseArray<any>('alunos/lightweight?limit=2000')
  const [colaboradoresData, , { loading: loadingC }] = useSupabaseArray<any>('configuracoes/usuarios?type=colaboradores&limit=1000')

  const loading = loadingA || loadingC || loadingT
  const alunos = alunosData || []
  const colaboradores = colaboradoresData || []
  const turmas = turmasData || []

  useEffect(() => {
    console.log("DEBUG ESPELHAR", { alunosData, colaboradoresData, turmasData })
  }, [alunosData, colaboradoresData, turmasData])

  const [activeTab, setActiveTab] = useState<'alunos' | 'colaboradores'>('alunos')
  const [search, setSearch] = useState('')
  const [filterTurma, setFilterTurma] = useState('')

  const [selectedAlunoForMirror, setSelectedAlunoForMirror] = useState<any>(null)
  const [modalResponsaveis, setModalResponsaveis] = useState<any[]>([])
  const [loadingResps, setLoadingResps] = useState(false)

  const uniqueTurmas = Array.from(new Set((alunos || []).map(a => a.turma).filter(Boolean)))

  const filteredAlunos = (alunos || []).filter(aluno => {
    if (search) {
      const q = search.toLowerCase()
      if (!String(aluno.nome || '').toLowerCase().includes(q) &&
          !String(aluno.matricula || '').toLowerCase().includes(q)) {
        return false
      }
    }
    if (filterTurma && aluno.turma !== filterTurma) return false
    return true
  })

  const filteredColaboradores = (colaboradores || []).filter(colab => {
    if (search) {
      const q = search.toLowerCase()
      return String(colab.nome || '').toLowerCase().includes(q)
    }
    return true
  })

  const handleSelectAluno = async (aluno: any) => {
    setSelectedAlunoForMirror(aluno)
    setLoadingResps(true)
    setModalResponsaveis(aluno.responsaveis || aluno.dados?.responsaveis || [])
    
    try {
      const res = await fetch(`/api/alunos/${aluno.id}`)
      const json = await res.json()
      if (json.data && json.data.responsaveis) {
        setModalResponsaveis(json.data.responsaveis)
      }
    } catch (e) {
      console.error('Failed to load responsaveis:', e)
    } finally {
      setLoadingResps(false)
    }
  }

  const confirmMirror = (alunoId: string, responsavelId?: string) => {
    let url = `/agenda-digital/${alunoId}/comunicados?espelhar_aluno=true`
    if (responsavelId) {
      url = `/agenda-digital/${alunoId}/comunicados?espelhar_responsavel=${responsavelId}`
    }
    router.push(url)
  }

  const handleSelectColaborador = (colabId: string, colabNome: string, colabCargo: string, colabFoto?: string, colabPerfil?: string) => {
    let url = `/agenda-digital/colaborador/comunicados?espelhar_colaborador=${colabId}&espelhar_nome=${encodeURIComponent(colabNome)}&espelhar_cargo=${encodeURIComponent(colabCargo || 'Colaborador')}`;
    if (colabFoto) url += `&espelhar_foto=${encodeURIComponent(colabFoto)}`;
    if (colabPerfil) url += `&espelhar_perfil=${encodeURIComponent(colabPerfil)}`;
    router.push(url)
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}
        >
          <div style={{ 
            width: 48, height: 48, borderRadius: 16, 
            background: 'linear-gradient(135deg, #FF0080, #7928CA)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(255, 0, 128, 0.3)'
          }}>
            <MonitorSmartphone size={24} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
              Espelhar Agenda
            </h1>
            <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: 14 }}>
              Selecione um usuário para visualizar a Agenda Digital exatamente como ele vê.
            </p>
          </div>
        </motion.div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <button
          onClick={() => { setActiveTab('alunos'); setSearch(''); setFilterTurma(''); }}
          style={{
            padding: '12px 24px', fontSize: 15, fontWeight: 600,
            color: activeTab === 'alunos' ? '#7928CA' : '#64748b',
            background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: activeTab === 'alunos' ? '2px solid #7928CA' : '2px solid transparent',
            display: 'flex', alignItems: 'center', gap: 8
          }}
        >
          <Users size={18} /> Alunos & Famílias
        </button>
        <button
          onClick={() => { setActiveTab('colaboradores'); setSearch(''); setFilterTurma(''); }}
          style={{
            padding: '12px 24px', fontSize: 15, fontWeight: 600,
            color: activeTab === 'colaboradores' ? '#FF0080' : '#64748b',
            background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: activeTab === 'colaboradores' ? '2px solid #FF0080' : '2px solid transparent',
            display: 'flex', alignItems: 'center', gap: 8
          }}
        >
          <Building size={18} /> Equipe / Professores
        </button>
      </div>

      {/* Filtros */}
      <div style={{ 
        display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap',
        background: '#ffffff', padding: 16, borderRadius: 20, border: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
      }}>
        <div style={{ flex: '1 1 300px', position: 'relative' }}>
          <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text"
            placeholder={activeTab === 'alunos' ? "Buscar aluno por nome ou matrícula..." : "Buscar colaborador por nome..."}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', height: 48,
              background: '#f8fafc', border: '1px solid rgba(0,0,0,0.06)',
              borderRadius: 12, padding: '0 16px 0 44px',
              color: '#0f172a', fontSize: 14, outline: 'none', transition: 'border-color 0.2s'
            }}
            onFocus={e => e.currentTarget.style.borderColor = activeTab === 'alunos' ? '#c084fc' : '#FF0080'}
            onBlur={e => e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)'}
          />
        </div>

        {activeTab === 'alunos' && (
          <div style={{ flex: '0 0 200px', position: 'relative' }}>
            <Filter size={18} color="#94a3b8" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} />
            <select
              value={filterTurma}
              onChange={e => setFilterTurma(e.target.value)}
              style={{
                width: '100%', height: 48,
                background: '#f8fafc', border: '1px solid rgba(0,0,0,0.06)',
                borderRadius: 12, padding: '0 16px 0 44px',
                color: '#0f172a', fontSize: 14, outline: 'none', appearance: 'none', transition: 'border-color 0.2s'
              }}
              onFocus={e => e.currentTarget.style.borderColor = '#c084fc'}
              onBlur={e => e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)'}
            >
              <option value="">Todas as Turmas</option>
              {uniqueTurmas.map((t: any) => {
                const turmaObj = turmas.find((tx: any) => tx.id === t || tx.codigo === t || tx.nome === t)
                const nomeTurma = turmaObj ? turmaObj.nome : t
                return (
                  <option key={t} value={t}>{nomeTurma}</option>
                )
              })}
            </select>
          </div>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
          Carregando usuários...
        </div>
      ) : activeTab === 'alunos' ? (
        filteredAlunos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, background: '#ffffff', borderRadius: 20, border: '1px dashed rgba(0,0,0,0.1)' }}>
            <AlertCircle size={32} color="#cbd5e1" style={{ margin: '0 auto 12px' }} />
            <div style={{ color: '#0f172a', fontWeight: 600 }}>Nenhum aluno encontrado</div>
            <div style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
              Tente alterar os filtros ou termo de busca.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {filteredAlunos.slice(0, 50).map(aluno => {
              const turmaObj = turmas.find((tx: any) => tx.id === aluno.turma || tx.codigo === aluno.turma || tx.nome === aluno.turma)
              const nomeTurma = turmaObj ? turmaObj.nome : (aluno.turma || 'Sem Turma')
              
              return (
              <motion.div
                key={aluno.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -4 }}
                onClick={() => handleSelectAluno(aluno)}
                style={{
                  background: '#ffffff',
                  border: '1px solid rgba(0,0,0,0.06)',
                  borderRadius: 20,
                  padding: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(121, 40, 202, 0.08)'
                  e.currentTarget.style.borderColor = 'rgba(121, 40, 202, 0.3)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.02)'
                  e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)'
                }}
              >
                <div style={{ flexShrink: 0 }}>
                  <UserAvatar 
                    userId={aluno.id}
                    name={aluno.nome}
                    fotoUrl={aluno.dados?.foto}
                    size={48}
                    style={{ borderRadius: '50%', border: '2px solid rgba(0,0,0,0.03)' }}
                  />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ 
                    fontSize: 15, fontWeight: 700, color: '#0f172a',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                  }}>
                    {aluno.nome}
                  </div>
                  <div style={{ 
                    fontSize: 12, color: '#64748b', marginTop: 4,
                    display: 'flex', alignItems: 'center', gap: 6
                  }}>
                    <span style={{ 
                      background: 'rgba(0,0,0,0.04)', padding: '2px 6px', borderRadius: 6, fontWeight: 600, color: '#475569'
                    }}>
                      {nomeTurma}
                    </span>
                    {aluno.matricula && (
                      <span style={{ color: '#94a3b8' }}>Mat: {aluno.matricula}</span>
                    )}
                  </div>
                </div>
              </motion.div>
            )})}
          </div>
        )
      ) : (
        filteredColaboradores.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, background: '#ffffff', borderRadius: 20, border: '1px dashed rgba(0,0,0,0.1)' }}>
            <AlertCircle size={32} color="#cbd5e1" style={{ margin: '0 auto 12px' }} />
            <div style={{ color: '#0f172a', fontWeight: 600 }}>Nenhum colaborador encontrado</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {filteredColaboradores.slice(0, 50).map(colab => (
              <motion.div
                key={colab.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -4 }}
                onClick={() => handleSelectColaborador(colab.id, colab.nome, colab.cargo, colab.foto, colab.perfil)}
                style={{
                  background: '#ffffff',
                  border: '1px solid rgba(0,0,0,0.06)',
                  borderRadius: 20,
                  padding: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(255, 0, 128, 0.08)'
                  e.currentTarget.style.borderColor = 'rgba(255, 0, 128, 0.3)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.02)'
                  e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)'
                }}
              >
                <div style={{ flexShrink: 0 }}>
                  <UserAvatar 
                    userId={colab.id}
                    name={colab.nome}
                    fotoUrl={colab.foto}
                    size={48}
                    style={{ borderRadius: '50%', border: '2px solid rgba(0,0,0,0.03)' }}
                  />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ 
                    fontSize: 15, fontWeight: 700, color: '#0f172a',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                  }}>
                    {colab.nome}
                  </div>
                  <div style={{ 
                    fontSize: 12, color: '#64748b', marginTop: 4,
                    display: 'flex', alignItems: 'center', gap: 6
                  }}>
                    <span style={{ 
                      background: 'rgba(255,0,128,0.05)', padding: '2px 6px', borderRadius: 6, fontWeight: 600, color: '#FF0080'
                    }}>
                      {colab.cargo || 'Colaborador'}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )
      )}
      
      {activeTab === 'alunos' && filteredAlunos.length > 50 && (
         <div style={{ textAlign: 'center', marginTop: 24, color: '#94a3b8', fontSize: 13 }}>
           Mostrando os 50 primeiros resultados. Refine sua busca para ver outros.
         </div>
      )}
      {activeTab === 'colaboradores' && filteredColaboradores.length > 50 && (
         <div style={{ textAlign: 'center', marginTop: 24, color: '#94a3b8', fontSize: 13 }}>
           Mostrando os 50 primeiros resultados. Refine sua busca para ver outros.
         </div>
      )}

      {selectedAlunoForMirror && (
        <>
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ background: '#fff', borderRadius: 24, padding: 24, width: 400, maxWidth: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
            >
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                 <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a', fontWeight: 700 }}>Modo de Visualização</h3>
                 <button onClick={() => setSelectedAlunoForMirror(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                   <X size={20} />
                 </button>
               </div>
               
               <div style={{ color: '#475569', fontSize: 14, marginBottom: 20 }}>
                 Escolha como deseja visualizar a Agenda Digital do aluno <strong>{selectedAlunoForMirror.nome}</strong>:
               </div>

               <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                 <button 
                   onClick={() => confirmMirror(selectedAlunoForMirror.id)}
                   style={{
                     background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, textAlign: 'left',
                     display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'all 0.2s'
                   }}
                   onMouseEnter={e => e.currentTarget.style.borderColor = '#c084fc'}
                   onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                 >
                   <UserAvatar userId={selectedAlunoForMirror.id} name={selectedAlunoForMirror.nome} fotoUrl={selectedAlunoForMirror.dados?.foto} size={40} />
                   <div>
                     <div style={{ fontWeight: 600, color: '#0f172a' }}>Ver como Aluno</div>
                     <div style={{ fontSize: 12, color: '#64748b' }}>Agenda visão aluno</div>
                   </div>
                 </button>

                 {loadingResps ? (
                   <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 13 }}>
                     Buscando responsáveis...
                   </div>
                 ) : (
                   modalResponsaveis.map((resp: any, i: number) => (
                     <button 
                       key={resp.id || i}
                       onClick={() => confirmMirror(selectedAlunoForMirror.id, resp.id)}
                       style={{
                         background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, textAlign: 'left',
                         display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'all 0.2s'
                       }}
                       onMouseEnter={e => e.currentTarget.style.borderColor = '#c084fc'}
                       onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                     >
                       <UserAvatar userId={resp.id || 'r'} name={resp.nome} size={40} />
                       <div>
                          <div style={{ fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280 }}>Ver como {resp.nome}</div>
                          <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <span>{resp.parentesco || 'Responsável'}</span>
                            {(resp.isFinanceiro || resp.respFinanceiro) && (
                              <span style={{ background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7', padding: '2px 6px', borderRadius: 6, fontWeight: 600, fontSize: 10 }}>Financeiro</span>
                            )}
                            {(resp.isPedagogico || resp.respPedagogico) && (
                              <span style={{ background: 'rgba(219, 39, 119, 0.1)', color: '#db2777', padding: '2px 6px', borderRadius: 6, fontWeight: 600, fontSize: 10 }}>Pedagógico</span>
                            )}
                          </div>
                       </div>
                     </button>
                   ))
                 )}
               </div>
            </motion.div>
          </div>
        </>
      )}
    </div>
  )
}
