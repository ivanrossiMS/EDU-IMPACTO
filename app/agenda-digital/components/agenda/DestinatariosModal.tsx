
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
  const [alunos] = useSupabaseArray<any>('alunos')
  const [gruposManuais = []] = useSupabaseArray<any>('agenda/grupos')
  
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
      const tList = turmas.filter(cat.match)
      return { ...cat, turmas: tList }
    }).filter(c => c.turmas.length > 0)

    const catTurmasIds = new Set(mappedCats.flatMap(c => c.turmas.map((t: any) => String(t.id))))
    const restantes = turmas.filter((t: any) => !catTurmasIds.has(String(t.id)))
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
    ;(gruposManuais || []).forEach((g: any) => {
      const gId = `g_${g.id}`
      leafIds.push(gId)
      items.push({
        id: gId,
        title: g.nome,
        subtitle: 'Grupo personalizado',
        countBadge: `${(g.alunosIds?.length || 0) + (g.colaboradoresIds?.length || 0)} pessoas`,
        type: 'grupo',
        icon: GraduationCap,
        leafIds: [gId],
        payloads: [{ id: gId, name: g.nome, type: 'grupo' }]
      })
    })

    return { listItems: items, allLeafIds: leafIds }
  }, [turmas, gruposManuais, classCounts])

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
          {/* Backdrop Desktop */}
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)' }}
            className="hidden lg:block"
          />

          <motion.div 
            initial={{ y: '100%', opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: '100%', opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full h-[100dvh] lg:h-[90vh] lg:max-w-[700px] lg:rounded-[28px] lg:shadow-2xl overflow-hidden flex flex-col bg-[#F8FAFC] relative"
            style={{ boxShadow: '0 40px 100px rgba(0,0,0,0.2)', zIndex: 2147483647 }}
          >
            {/* Header (Fixed) */}
            <header className="h-[72px] shrink-0 bg-[#F8FAFC]/80 backdrop-blur-md border-b border-[#E2E8F0] flex items-center justify-between px-4 lg:px-6 z-20 sticky top-0">
              <motion.button 
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
              >
                <X size={24} />
              </motion.button>

              <div className="flex flex-col items-center">
                <h2 className="text-[17px] font-semibold text-[#0F172A] leading-tight">Destinatários</h2>
                <span className="text-[13px] font-medium text-[#64748B]">Selecione quem receberá o comunicado</span>
              </div>

              <motion.button 
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={handleConfirm}
                className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#6D5DF6] to-[#8B5CF6] flex items-center justify-center text-white shadow-lg shadow-indigo-500/30"
              >
                <Check size={28} strokeWidth={2.5} />
              </motion.button>
            </header>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto pb-[120px]">
              
              {/* Selected Chips Area */}
              <div className="px-4 lg:px-6 pt-6 pb-2">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[15px] font-semibold text-[#0F172A]">
                    Selecionados ({Object.keys(selected).length})
                  </h3>
                  {Object.keys(selected).length > 0 && (
                    <button onClick={() => setSelected({})} className="text-[14px] font-semibold text-[#6D5DF6] hover:text-[#4F46E5]">
                      Limpar tudo
                    </button>
                  )}
                </div>

                <div className="flex overflow-x-auto pb-4 gap-2 no-scrollbar" style={{ scrollbarWidth: 'none' }}>
                  <AnimatePresence mode="popLayout">
                    {smartChips.map(chip => (
                      <motion.div
                        layout
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8, filter: 'blur(4px)' }}
                        key={chip.id}
                        className="shrink-0 h10 px-4 py-2 bg-white border border-[#E2E8F0] rounded-full flex items-center gap-3 shadow-sm"
                      >
                        <Building2 size={16} className="text-[#6D5DF6]" />
                        <span className="text-[14px] font-medium text-[#0F172A]">{chip.name}</span>
                        <button onClick={chip.onRemove} className="text-[#94A3B8] hover:text-red-500 transition-colors ml-1">
                          <X size={16} />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {smartChips.length === 0 && (
                    <span className="text-[14px] text-[#94A3B8] italic py-2">Nenhum destinatário selecionado</span>
                  )}
                </div>
              </div>

              {/* Main List */}
              <div className="px-4 lg:px-6 pb-6">
                
                {/* Selecionar Tudo Linha */}
                <div className="flex items-center justify-between mb-4 mt-2">
                  <h3 className="text-[15px] font-semibold text-[#0F172A]">Todos</h3>
                  <button onClick={toggleAll} className="flex items-center gap-2 text-[14px] font-semibold text-[#64748B] hover:text-[#0F172A] transition-colors">
                    Selecionar tudo
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${allLeafIds.length > 0 && allLeafIds.every(id => !!selected[id]) ? 'bg-[#6D5DF6] border-[#6D5DF6]' : 'border-2 border-[#CBD5E1] bg-transparent'}`}>
                       {allLeafIds.length > 0 && allLeafIds.every(id => !!selected[id]) && <Check size={14} color="#fff" strokeWidth={3} />}
                    </div>
                  </button>
                </div>

                {/* Cards List */}
                <div className="flex flex-col gap-3">
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
                        className={`cursor-pointer relative overflow-hidden rounded-[18px] p-4 flex items-center gap-4 transition-all duration-200 border ${
                          isFullySelected 
                            ? 'bg-[#F5F3FF] border-[#C4B5FD]' 
                            : 'bg-white border-[#E2E8F0] hover:border-[#CBD5E1]'
                        }`}
                      >
                        {/* Checkbox */}
                        <div className={`w-6 h-6 shrink-0 rounded-[6px] flex items-center justify-center transition-all ${
                          isFullySelected ? 'bg-[#6D5DF6] border-[#6D5DF6]' : 'border-2 border-[#CBD5E1] bg-white'
                        }`}>
                          <AnimatePresence>
                            {isFullySelected && (
                              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                                <Check size={14} color="#fff" strokeWidth={3} />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Icon */}
                        <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${isCategory ? 'bg-[#EEF2FF] text-[#4F46E5]' : 'bg-[#F8FAFC] text-[#64748B]'}`}>
                          <Icon size={20} />
                        </div>

                        {/* Text */}
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className={`text-[16px] font-semibold truncate ${isFullySelected ? 'text-[#4F46E5]' : 'text-[#0F172A]'}`}>
                            {item.title}
                          </span>
                          <span className="text-[13px] font-medium text-[#64748B] truncate">
                            {item.subtitle}
                          </span>
                        </div>

                        {/* Badge */}
                        <div className="shrink-0 bg-[#F1F5F9] text-[#475569] text-[12px] font-semibold px-3 py-1 rounded-full">
                          {item.countBadge}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Footer Fixed */}
            <div className="absolute bottom-0 left-0 right-0 h-[88px] bg-white/70 backdrop-blur-xl border-t border-[#E2E8F0] px-4 lg:px-6 flex items-center gap-4 z-20">
               <motion.button 
                 whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                 onClick={onClose}
                 className="flex-1 h-14 rounded-[18px] bg-white border border-[#E2E8F0] text-[#0F172A] font-semibold text-[16px] shadow-sm"
               >
                 Cancelar
               </motion.button>
               <motion.button 
                 whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                 onClick={handleConfirm}
                 className="flex-[2] h-14 rounded-[18px] bg-gradient-to-r from-[#6D5DF6] to-[#4F46E5] text-white font-semibold text-[16px] shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
               >
                 <Check size={20} />
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
