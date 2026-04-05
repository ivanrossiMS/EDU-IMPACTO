'use client'

import React, { useState, useEffect } from 'react'
import { X, Search, Users, ChevronRight, ChevronLeft, Check, User } from 'lucide-react'
import { useData } from '@/lib/dataContext'

interface DestinatariosModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (selected: {id: string, name: string, type: 'turma' | 'funcionario' | 'aluno' | 'grupo'}[]) => void
  initialSelected?: {id: string, name: string}[]
}

export function DestinatariosModal({ isOpen, onClose, onAdd, initialSelected = [] }: DestinatariosModalProps) {
  const { turmas, alunos } = useData()
  const [search, setSearch] = useState('')
  const [activeFolder, setActiveFolder] = useState<{ id: string, name: string, type?: string } | null>(null)
  const [selected, setSelected] = useState<Record<string, {id: string, name: string, type: 'turma' | 'funcionario' | 'aluno' | 'grupo'}>>({})
  const [grupos, setGrupos] = useState<any[]>([])
  const [sysUsers, setSysUsers] = useState<any[]>([])

  useEffect(() => {
    if (isOpen) {
      const map: typeof selected = {}
      initialSelected.forEach(s => {
        const type = s.id === 'func' ? 'funcionario' : s.id.startsWith('a_') ? 'aluno' : 'turma'
        map[s.id] = { id: s.id, name: s.name, type: type as any }
      })
      setSelected(map)
      setSearch('')
      setActiveFolder(null)
      const stored = localStorage.getItem('ad_grupos_manuais')
      if (stored) {
        try { setGrupos(JSON.parse(stored)) } catch {}
      }
      const sysU = localStorage.getItem('edu-sys-users')
      if (sysU) {
        try { setSysUsers(JSON.parse(sysU)) } catch {}
      }
    }
  }, [isOpen, initialSelected])

  if (!isOpen) return null

  // class counts
  const classCounts: Record<string, number> = {}
  turmas.forEach(t => classCounts[t.id] = 0)
  alunos.forEach(a => {
    const t = turmas.find(x => x.nome === a.turma)
    if (t) classCounts[t.id] = (classCounts[t.id] || 0) + 1
  })

  // List arrays
  const rootGrupos = grupos.map(g => ({
    id: `g_${g.id}`,
    name: g.nome,
    type: 'grupo' as const,
    count: (g.alunosIds?.length || 0) + (g.colaboradoresIds?.length || 0),
    isGrupo: true
  }))
  
  const combinedFolders = rootGrupos

  const allFilteredFolders = combinedFolders.filter(item => item.name.toLowerCase().includes(search.toLowerCase()))
  const allFilteredAlunos = alunos.filter(a => a.nome.toLowerCase().includes(search.toLowerCase())).map(a => ({
    id: `a_${a.id}`,
    name: a.nome,
    type: 'aluno' as const,
    turmaNome: a.turma,
    badge: 'Aluno'
  }))

  let activeFolderMembers: any[] = []
  if (activeFolder && activeFolder.type === 'grupo') {
    const gObj = grupos.find(g => g.id === activeFolder.id.replace('g_', ''))
    if (gObj) {
      const als = alunos.filter(a => gObj.alunosIds?.includes(a.id)).map(a => ({
         id: `a_${a.id}`, name: a.nome, type: 'aluno' as const, turmaNome: a.turma, badge: 'Aluno'
      }))
      const cols = sysUsers.filter(s => gObj.colaboradoresIds?.includes(s.id)).map(s => ({
         id: `f_${s.id}`, name: s.nome, type: 'funcionario' as const, turmaNome: s.perfil || 'Gestor', badge: 'Gestor'
      }))
      activeFolderMembers = [...als, ...cols]
    }
  }

  const toggleSelect = (item: {id: string, name: string, type: "turma" | "funcionario" | "aluno"}) => {
    setSelected(prev => {
      const next = { ...prev }
      if (next[item.id]) delete next[item.id]
      else next[item.id] = item
      return next
    })
  }

  const handleSelectAll = (itemsToToggle: any[]) => {
    const allSelected = itemsToToggle.every(i => !!selected[i.id])
    if (allSelected) {
      setSelected(prev => {
        const next = { ...prev }
        itemsToToggle.forEach(i => delete next[i.id])
        return next
      })
    } else {
      setSelected(prev => {
        const next = { ...prev }
        itemsToToggle.forEach(i => next[i.id] = { id: i.id, name: i.name, type: i.type })
        return next
      })
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, 
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: '#fff', 
        width: 480, 
        height: '90vh', 
        maxHeight: 800,
        borderRadius: 16,
        display: 'flex', 
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ padding: '24px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {activeFolder && !search && (
               <button onClick={() => setActiveFolder(null)} style={{ background: '#f3f4f6', border: 0, borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                 <ChevronLeft size={20} color="#374151" />
               </button>
            )}
            <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: '#111827' }}>
              {search ? 'Buscar Alvos' : activeFolder ? activeFolder.name : 'Destinatários'}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: 4, color: '#6b7280' }}>
            <X size={24} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '0 24px 16px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={20} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar..."
              style={{
                width: '100%', padding: '12px 16px 12px 48px',
                borderRadius: 24, border: '1px solid #e5e7eb',
                fontSize: 16, outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>
        </div>

        {/* List Areas */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
           
           {/* DEFAULT ROOT VIEW (TURMAS) */}
           {!search && !activeFolder && (
             <>
                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', cursor: 'pointer' }} onClick={() => handleSelectAll(combinedFolders)}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', 
                    border: combinedFolders.length > 0 && combinedFolders.every(i => !!selected[i.id]) ? 'none' : '2px solid #d1d5db',
                    background: combinedFolders.length > 0 && combinedFolders.every(i => !!selected[i.id]) ? '#3b82f6' : 'transparent',
                    marginRight: 16, display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {(combinedFolders.length > 0 && combinedFolders.every(i => !!selected[i.id])) && <Check size={16} color="#fff" strokeWidth={3} />}
                  </div>
                  <span style={{ fontSize: 16, color: '#374151' }}>Selecionar todas as turmas</span>
                </div>
                


                {combinedFolders.map(item => {
                  const isSelected = !!selected[item.id]
                  return (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid #f3f4f6' }}>
                       <div style={{
                         width: 24, height: 24, borderRadius: '50%', 
                         border: isSelected ? 'none' : '2px solid #d1d5db',
                         background: isSelected ? '#3b82f6' : 'transparent',
                         marginRight: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                       }} onClick={() => toggleSelect(item as any)}>
                         {isSelected && <Check size={16} color="#fff" strokeWidth={3} />}
                       </div>
                       
                       <div style={{ display: 'flex', alignItems: 'center', flex: 1, padding: '16px 0', cursor: 'pointer' }} onClick={() => setActiveFolder(item as any)}>
                         <span style={{ fontSize: 16, color: '#374151', flex: 1 }}>
                           {item.name}
                         </span>
                         <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6b7280', fontSize: 13, marginRight: 12 }}>
                           <Users size={14} /> {item.count}
                         </div>
                         <ChevronRight size={20} color="#9ca3af" />
                       </div>
                    </div>
                  )
                })}
             </>
           )}

           {/* ACTIVE FOLDER VIEW (MEMBERS) */}
           {!search && activeFolder && (
             <>
                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #e5e7eb', marginBottom: 8 }} onClick={() => handleSelectAll(activeFolderMembers)}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', 
                    border: activeFolderMembers.length > 0 && activeFolderMembers.every(i => !!selected[i.id]) ? 'none' : '2px solid #d1d5db',
                    background: activeFolderMembers.length > 0 && activeFolderMembers.every(i => !!selected[i.id]) ? '#3b82f6' : 'transparent',
                    marginRight: 16, display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {(activeFolderMembers.length > 0 && activeFolderMembers.every(i => !!selected[i.id])) && <Check size={16} color="#fff" strokeWidth={3} />}
                  </div>
                  <span style={{ fontSize: 16, color: '#374151', fontWeight: 600 }}>Selecionar todos de {activeFolder.name}</span>
                </div>

                {activeFolderMembers.map(item => {
                  const isSelected = !!selected[item.id]
                  return (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', borderRadius: 8, margin: '0 8px 4px', background: isSelected ? '#eff6ff' : 'transparent' }} onClick={() => toggleSelect(item as any)}>
                       <div style={{
                         width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                         border: isSelected ? 'none' : '2px solid #d1d5db',
                         background: isSelected ? '#3b82f6' : 'transparent',
                         marginRight: 16, display: 'flex', alignItems: 'center', justifyContent: 'center'
                       }}>
                         {isSelected && <Check size={16} color="#fff" strokeWidth={3} />}
                       </div>
                       
                       <div style={{ width: 36, height: 36, borderRadius: '50%', background: item.type === 'funcionario' ? '#f3e8ff' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                         <User size={18} style={{ color: item.type === 'funcionario' ? '#9333ea' : '#9ca3af' }}/>
                       </div>
                       
                       <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                           <span style={{ fontSize: 15, color: '#111827', fontWeight: 500 }}>{item.name}</span>
                           <span style={{ fontSize: 10, background: item.type === 'funcionario' ? '#f3e8ff' : '#dcfce7', color: item.type === 'funcionario' ? '#7e22ce' : '#15803d', padding: '2px 6px', borderRadius: 10 }}>{item.badge}</span>
                         </div>
                         <span style={{ fontSize: 12, color: '#9ca3af' }}>{item.turmaNome}</span>
                       </div>
                    </div>
                  )
                })}
             </>
           )}

           {/* ANY SEARCH ACTIVE */}
           {search && (
              <>
                 {allFilteredFolders.length > 0 && (
                   <div style={{ padding: '12px 16px 4px', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Grupos Digitais</div>
                 )}
                 {allFilteredFolders.map(item => {
                   const isSelected = !!selected[item.id]
                   return (
                     <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', cursor: 'pointer' }} onClick={() => toggleSelect(item as any)}>
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%', 
                          border: isSelected ? 'none' : '2px solid #d1d5db',
                          background: isSelected ? '#3b82f6' : 'transparent',
                          marginRight: 16, display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {isSelected && <Check size={16} color="#fff" strokeWidth={3} />}
                        </div>
                        <span style={{ fontSize: 15, color: '#374151', flex: 1 }}>{item.name} <span style={{ color: '#9ca3af', fontSize: 13 }}>({item.count} membros)</span></span>
                        <span style={{ fontSize: 11, background: '#f3e8ff', color: '#7e22ce', padding: '2px 8px', borderRadius: 12 }}>Grupo Digital</span>
                     </div>
                   )
                 })}

                 {allFilteredAlunos.length > 0 && (
                   <div style={{ padding: '12px 16px 4px', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', borderTop:allFilteredFolders.length>0?'1px solid #f3f4f6':'' }}>Alunos Soltos</div>
                 )}
                 {allFilteredAlunos.slice(0, 20).map(item => {
                   const isSelected = !!selected[item.id]
                   return (
                     <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', cursor: 'pointer' }} onClick={() => toggleSelect(item)}>
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%', 
                          border: isSelected ? 'none' : '2px solid #d1d5db',
                          background: isSelected ? '#3b82f6' : 'transparent',
                          marginRight: 16, display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {isSelected && <Check size={16} color="#fff" strokeWidth={3} />}
                        </div>
                        <span style={{ fontSize: 15, color: '#374151', flex: 1 }}>{item.name} <span style={{ color: '#9ca3af', fontSize: 13 }}>• {item.turmaNome}</span></span>
                        <span style={{ fontSize: 11, background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 12 }}>Aluno</span>
                     </div>
                   )
                 })}
                 
                 {(allFilteredFolders.length === 0 && allFilteredAlunos.length === 0) && (
                   <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Nenhum cadastro atende a sua busca.</div>
                 )}
              </>
           )}

        </div>

        {/* Footer */}
        <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f3f4f6', background: '#fff', zIndex: 10 }}>
           <button 
             onClick={onClose}
             style={{ 
               padding: '12px 24px', borderRadius: 24, background: '#fff', border: '1px solid #d1d5db', 
               fontWeight: 600, color: '#374151', cursor: 'pointer', fontSize: 15
             }}
           >
             Cancelar
           </button>
           <button 
             onClick={() => {
               onAdd(Object.values(selected))
               onClose()
             }}
             style={{ 
               padding: '12px 32px', borderRadius: 24, background: '#4f46e5', border: 0, 
               fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 8,
               cursor: 'pointer', fontSize: 15
             }}
           >
             <Check size={18} /> Adicionar ({Object.values(selected).length})
           </button>
        </div>
      </div>
    </div>
  )
}
