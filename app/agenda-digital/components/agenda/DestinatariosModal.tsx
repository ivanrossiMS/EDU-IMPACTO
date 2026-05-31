
'use client'
import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, Search, Users, Check, School, Building2, GraduationCap, XCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useData } from '@/lib/dataContext'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'

interface DestinatariosModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (selected: {id: string, name: string, type: 'turma' | 'funcionario' | 'aluno' | 'grupo'}[]) => void
  initialSelected?: {id: string, name: string}[]
  allowedTurmasIds?: string[]
}

export function DestinatariosModal({ isOpen, onClose, onAdd, initialSelected = [], allowedTurmasIds }: DestinatariosModalProps) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const data = useData()
  const turmas = allowedTurmasIds ? (data?.turmas || []).filter((t: any) => allowedTurmasIds.includes(String(t.id))) : (data?.turmas || [])
  const [gruposManuais = []] = useSupabaseArray<any>('agenda/grupos')
  const [alunos] = useSupabaseArray<any>('alunos')

  const [selectedAno, setSelectedAno] = useState<string>('Todos')

  const availableAnos = useMemo(() => {
    const anos = new Set<string>()
    turmas.forEach((t: any) => {
      const a = t?.ano !== undefined ? String(t.ano) : (t.anoLetivo || t.ano_letivo || t.dados?.anoLetivo || '')
      if (a) anos.add(a)
    })
    ;(gruposManuais || []).forEach((g: any) => {
      const a = g?.ano !== undefined ? String(g.ano) : (g.anoLetivo || g.ano_letivo || g.dados?.anoLetivo || '')
      if (a) anos.add(a)
    })
    return Array.from(anos).sort((a,b) => b.localeCompare(a))
  }, [turmas, gruposManuais])

  const filteredTurmas = useMemo(() => {
    if (selectedAno === 'Todos') return turmas
    return turmas.filter((t: any) => {
      const a = t?.ano !== undefined ? String(t.ano) : (t.anoLetivo || t.ano_letivo || t.dados?.anoLetivo || '')
      return a === selectedAno
    })
  }, [turmas, selectedAno])

  const filteredGrupos = useMemo(() => {
    if (selectedAno === 'Todos') return gruposManuais
    return (gruposManuais || []).filter((g: any) => {
      const a = g?.ano !== undefined ? String(g.ano) : (g.anoLetivo || g.ano_letivo || g.dados?.anoLetivo || '')
      return a ? a === selectedAno : true // Show groups without year in all filters
    })
  }, [gruposManuais, selectedAno])
  
  // selected holds ONLY leaf nodes: turmas and grupos
  const [selected, setSelected] = useState<Record<string, {id: string, name: string, type: 'turma' | 'funcionario' | 'aluno' | 'grupo'}>>({})

  useEffect(() => {
    if (isOpen) {
      const map: typeof selected = {}
      initialSelected.forEach(s => {
        const type = s.id.startsWith('f_') || s.id === 'func' ? 'funcionario' : s.id.startsWith('a_') ? 'aluno' : s.id.startsWith('g_') ? 'grupo' : 'turma'
        map[s.id] = { id: s.id, name: s.name, type: type as any }
      })
      setSelected(map)
    }
  }, [isOpen, initialSelected])

  // Process data
  const classCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    turmas.forEach((t: any) => counts[t.id] = 0)
    ;(alunos || []).forEach((a: any) => {
      const t = turmas.find((x: any) => String(x.id) === String(a.turma) || String(x.codigo) === String(a.turma) || String(x.nome) === String(a.turma))
      if (t) counts[t.id] = (counts[t.id] || 0) + 1
    })
    return counts
  }, [turmas, alunos])

  const { listItems, allLeafIds } = useMemo(() => {
    const categorias = [
      { name: 'Educação Infantil', match: (t: any) => /NÍVEL|INFANTIL|BERÇÁRIO|MATERNAL|JARDIM|PRÉ-ESCOLA/i.test(`${t.nome} ${t.serie || ''}`) },
      { name: 'Ensino Fundamental I', match: (t: any) => !/MÉDIO/i.test(`${t.nome} ${t.serie || ''}`) && /(1|2|3|4|5)º?\s*ANO/i.test(`${t.nome} ${t.serie || ''}`) },
      { name: 'Ensino Fundamental II', match: (t: any) => !/MÉDIO/i.test(`${t.nome} ${t.serie || ''}`) && /(6|7|8|9)º?\s*ANO/i.test(`${t.nome} ${t.serie || ''}`) },
      { name: 'Ensino Médio', match: (t: any) => /SÉRIE|MÉDIO/i.test(`${t.nome} ${t.serie || ''}`) },
    ]

    const items: any[] = []
    const leafIds: string[] = []
    
    // Categorias
    const mappedCats = categorias.map(cat => {
      const tList = filteredTurmas.filter(cat.match)
      return { ...cat, turmas: tList }
    }).filter(c => c.turmas.length > 0)

    const catTurmasIds = new Set(mappedCats.flatMap(c => c.turmas.map((t: any) => String(t.id))))
    const restantes = filteredTurmas.filter((t: any) => !catTurmasIds.has(String(t.id)))
    if (restantes.length > 0) {
      mappedCats.push({ name: 'Outras Turmas', turmas: restantes, match: () => false })
    }

    mappedCats.forEach(cat => {
      const tIds = cat.turmas.map((t: any) => String(t.id))
      const countAlunos = cat.turmas.reduce((acc: number, t: any) => acc + (classCounts[t.id] || 0), 0)
      items.push({
        id: `cat_${cat.name}`,
        title: cat.name,
        subtitle: `Categoria com ${cat.turmas.length} turmas`,
        countBadge: `${countAlunos} alunos`,
        type: 'category',
        icon: Building2,
        leafIds: tIds,
        payloads: cat.turmas.map((t: any) => ({ id: String(t.id), name: t.nome, type: 'turma' }))
      })
      
      // Individual turmas
      cat.turmas.forEach((t: any) => {
        leafIds.push(String(t.id))
        items.push({
          id: String(t.id),
          title: t.nome,
          subtitle: t.turno || 'Turma',
          countBadge: `${classCounts[t.id] || 0} alunos`,
          type: 'turma',
          icon: Users,
          leafIds: [String(t.id)],
          payloads: [{ id: String(t.id), name: t.nome, type: 'turma' }]
        })
      })
    })

    // Grupos
    const sortedGrupos = [...(filteredGrupos || [])].sort((a, b) => a.nome.localeCompare(b.nome))
    sortedGrupos.forEach((g: any) => {
      const gId = `g_${g.id}`
      leafIds.push(gId)
      items.push({
        id: gId,
        title: g.nome,
        countBadge: `${(g.alunosIds?.length || 0) + (g.colaboradoresIds?.length || 0)} pessoas`,
        type: 'grupo',
        icon: GraduationCap,
        leafIds: [gId],
        payloads: [{ id: gId, name: g.nome, type: 'grupo' }]
      })
    })

    return { listItems: items, allLeafIds: leafIds }
  }, [filteredTurmas, filteredGrupos, classCounts])

  // Compute smart chips
  const smartChips = useMemo(() => {
    const chips: { id: string, name: string, onRemove: () => void }[] = []
    const selectedLeaves = Object.keys(selected)
    
    if (selectedLeaves.length === 0) return chips

    let remainingLeaves = new Set(selectedLeaves)

    // Check if ALL are selected
    if (allLeafIds.length > 0 && allLeafIds.every(id => remainingLeaves.has(id))) {
      chips.push({
        id: 'all', name: 'Toda Escola',
        onRemove: () => setSelected({})
      })
      return chips
    }

    // Check categories
    listItems.filter(i => i.type === 'category').forEach(cat => {
      if (cat.leafIds.length > 0 && cat.leafIds.every((id: string) => remainingLeaves.has(id))) {
        chips.push({
          id: cat.id, name: cat.title,
          onRemove: () => {
            setSelected(prev => {
              const next = { ...prev }
              cat.leafIds.forEach((id: string) => delete next[id])
              return next
            })
          }
        })
        cat.leafIds.forEach((id: string) => remainingLeaves.delete(id))
      }
    })

    // Remaining individual leaves
    remainingLeaves.forEach(id => {
      const leaf = selected[id]
      if (leaf) {
        chips.push({
          id, name: leaf.name,
          onRemove: () => {
            setSelected(prev => {
              const next = { ...prev }
              delete next[id]
              return next
            })
          }
        })
      }
    })

    return chips
  }, [selected, listItems, allLeafIds])

  const toggleSelect = (item: any) => {
    setSelected(prev => {
      const next = { ...prev }
      const allSelected = item.leafIds.every((id: string) => !!prev[id])
      
      if (allSelected) {
        item.leafIds.forEach((id: string) => delete next[id])
      } else {
        item.payloads.forEach((p: any) => {
          next[p.id] = p
        })
      }
      return next
    })
  }

  const toggleAll = () => {
    if (allLeafIds.every(id => !!selected[id])) {
      setSelected({})
    } else {
      const next: typeof selected = {}
      listItems.forEach(item => {
        item.payloads.forEach((p: any) => {
          next[p.id] = p
        })
      })
      setSelected(next)
    }
  }

  const handleConfirm = () => {
    onAdd(Object.values(selected))
    onClose()
  }

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2147483647,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <style>{`
            .dest-modal-container {
              width: 100%;
              height: 100dvh;
              position: absolute;
              inset: 0;
              background: #F8FAFC;
              display: flex;
              flex-direction: column;
              overflow: hidden;
            }
            .dest-modal-backdrop {
              display: none;
            }
            @media (min-width: 1024px) {
              .dest-modal-backdrop {
                display: block;
                position: absolute;
                inset: 0;
                background: rgba(15, 23, 42, 0.4);
                backdrop-filter: blur(8px);
              }
              .dest-modal-container {
                position: relative;
                inset: auto;
                max-width: 700px;
                height: 90vh;
                border-radius: 28px;
                box-shadow: 0 40px 100px rgba(0,0,0,0.2);
              }
            }
          `}</style>
          
          {/* Backdrop Desktop */}
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="dest-modal-backdrop"
          />

          <motion.div 
            initial={{ y: '100%', opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: '100%', opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="dest-modal-container"
            style={{ zIndex: 2147483647 }}
          >
            {/* Header (Fixed) */}
            <header style={{ 
              height: 72, flexShrink: 0, 
              background: 'linear-gradient(120deg, #6D5DF6, #4F46E5, #8B5CF6, #3B82F6)',
              backgroundSize: '300% 300%',
              animation: 'waveAnimation 8s ease infinite',
              display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'sticky', top: 0, zIndex: 20 
            }}>
              <style>{`
                @keyframes waveAnimation {
                  0% { background-position: 0% 50%; }
                  50% { background-position: 100% 50%; }
                  100% { background-position: 0% 50%; }
                }
              `}</style>
              
              <motion.button 
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={onClose}
                style={{ width: 48, height: 48, position: 'absolute', left: 16, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', border: 'none', cursor: 'pointer' }}
              >
                <X size={24} />
              </motion.button>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.2 }}>Destinatários</h2>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>Selecione quem receberá o comunicado</span>
              </div>
            </header>

            {/* Scrollable Content */}
            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 120 }}>
              
              {/* Filtro Ano Letivo */}
              {availableAnos.length > 0 && (
                <div style={{ padding: '24px 24px 8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}>Ano Letivo</label>
                    <select
                      value={selectedAno}
                      onChange={(e) => setSelectedAno(e.target.value)}
                      style={{
                        width: '100%', height: 48, borderRadius: 16, border: '1px solid #E2E8F0', background: '#fff',
                        padding: '0 16px', fontSize: 15, fontWeight: 600, color: '#0F172A', outline: 'none',
                        cursor: 'pointer', appearance: 'none', backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3Csvg width=%2224%22 height=%2224%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2364748B%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpolyline points=%226 9 12 15 18 9%22%3E%3C/polyline%3E%3C/svg%3E")',
                        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center', backgroundSize: '20px'
                      }}
                    >
                      <option value="Todos">Todos os anos</option>
                      {availableAnos.map(ano => (
                        <option key={ano} value={ano}>{ano}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Main List */}
              <div style={{ padding: '0 24px 24px' }}>
                
                {/* Selecionar Tudo Linha */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, marginTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>Todos</h3>
                    <span style={{ background: '#F1F5F9', color: '#64748B', fontSize: 13, fontWeight: 600, padding: '2px 8px', borderRadius: 12 }}>{listItems.length}</span>
                  </div>
                  <button onClick={toggleAll} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, fontWeight: 600, color: '#4F46E5', background: 'none', border: 'none', cursor: 'pointer' }}>
                    Selecionar tudo
                    <div style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', background: allLeafIds.length > 0 && allLeafIds.every(id => !!selected[id]) ? '#6D5DF6' : 'transparent', border: allLeafIds.length > 0 && allLeafIds.every(id => !!selected[id]) ? '2px solid #6D5DF6' : '2px solid #CBD5E1' }}>
                       {allLeafIds.length > 0 && allLeafIds.every(id => !!selected[id]) && <Check size={16} color="#fff" strokeWidth={3} />}
                    </div>
                  </button>
                </div>

                {/* Cards List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {listItems.map(item => {
                    const isFullySelected = item.leafIds.length > 0 && item.leafIds.every((id: string) => !!selected[id])
                    const Icon = item.icon
                    const isCategory = item.type === 'category'
                    
                    return (
                      <motion.div
                        key={item.id}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toggleSelect(item)}
                        style={{ 
                          cursor: 'pointer', overflow: 'hidden', borderRadius: 20, padding: '16px',
                          display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 16,
                          background: isFullySelected ? '#F5F3FF' : '#fff',
                          border: isFullySelected ? '2px solid #C4B5FD' : '2px solid #E2E8F0',
                          transition: 'all 0.2s'
                        }}
                      >
                        {/* Checkbox */}
                        <div style={{ 
                          width: 24, height: 24, flexShrink: 0, borderRadius: 6, 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
                          background: isFullySelected ? '#6D5DF6' : '#fff',
                          border: isFullySelected ? '2px solid #6D5DF6' : '2px solid #CBD5E1'
                        }}>
                          <AnimatePresence>
                            {isFullySelected && (
                              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                                <Check size={16} color="#fff" strokeWidth={3} />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Icon */}
                        <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isCategory ? '#EEF2FF' : '#F8FAFC', color: isCategory ? '#4F46E5' : '#6D5DF6' }}>
                          <Icon size={22} />
                        </div>

                        {/* Text */}
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: 2 }}>
                          <span style={{ fontSize: 16, fontWeight: 700, color: isFullySelected ? '#4F46E5' : '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.title}
                          </span>
                          {item.subtitle && (
                            <span style={{ fontSize: 13, fontWeight: 500, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.subtitle}
                            </span>
                          )}
                        </div>

                        {/* Badge */}
                        <div style={{ flexShrink: 0, background: '#F1F5F9', color: '#475569', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 100 }}>
                          {item.countBadge}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Footer Fixed */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 88, background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(16px)', borderTop: '1px solid #E2E8F0', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 16, zIndex: 20 }}>
               <motion.button 
                 whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                 onClick={onClose}
                 style={{ flex: 1, height: 56, borderRadius: 16, background: '#fff', border: '1px solid #E2E8F0', color: '#0F172A', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}
               >
                 Cancelar
               </motion.button>
               <motion.button 
                 whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                 onClick={handleConfirm}
                 style={{ flex: 2, height: 56, borderRadius: 16, background: 'linear-gradient(to right, #6D5DF6, #4F46E5)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', boxShadow: '0 8px 24px rgba(109, 93, 246, 0.3)' }}
               >
                 <Check size={20} strokeWidth={2.5} />
                 Confirmar ({Object.keys(selected).length})
               </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )

  
  if (!mounted) return null;

  return createPortal(modalContent, document.body);
}
