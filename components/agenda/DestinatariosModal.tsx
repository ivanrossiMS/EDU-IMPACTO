'use client'
import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, Search, Users, Check, Building2, GraduationCap, Calendar, ArrowLeft, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useData } from '@/lib/dataContext'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'

interface DestinatariosModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (selected: {id: string, name: string, type: 'turma' | 'funcionario' | 'aluno' | 'grupo'}[]) => void
  initialSelected?: {id: string, name: string}[]
  allowedTurmasIds?: string[]
  allowedGruposIds?: string[]
}

export function DestinatariosModal({ isOpen, onClose, onAdd, initialSelected = [], allowedTurmasIds, allowedGruposIds }: DestinatariosModalProps) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const data = useData()
  const turmas = useMemo(() => {
    return allowedTurmasIds ? (data?.turmas || []).filter((t: any) => allowedTurmasIds.includes(String(t.id))) : (data?.turmas || [])
  }, [data?.turmas, allowedTurmasIds ? JSON.stringify(allowedTurmasIds) : null])
  const [gruposManuais = []] = useSupabaseArray<any>('agenda/grupos')
  const [alunos] = useSupabaseArray<any>('alunos/lightweight')
  const [colaboradores] = useSupabaseArray<any>('configuracoes/usuarios')

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [currentCatId, setCurrentCatId] = useState<string | null>(null)

  const [selectedAno, setSelectedAno] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')

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
    if (availableAnos.length === 0) return turmas
    if (selectedAno === '') return []
    return turmas.filter((t: any) => {
      const a = t?.ano !== undefined ? String(t.ano) : (t.anoLetivo || t.ano_letivo || t.dados?.anoLetivo || '')
      return a === selectedAno
    })
  }, [turmas, selectedAno, availableAnos])

  const filteredGrupos = useMemo(() => {
    if (availableAnos.length === 0) {
      return gruposManuais.filter((g: any) => {
        const isEquipe = g.isEquipeEscolar === true || g.isEquipeEscolar === 'true' || g.isEquipeEscolar === 1;
        return (allowedGruposIds ? allowedGruposIds.includes(String(g.id)) : true) || isEquipe;
      });
    }
    if (selectedAno === '') return []
    return (gruposManuais || []).filter((g: any) => {
      const isEquipe = g.isEquipeEscolar === true || g.isEquipeEscolar === 'true' || g.isEquipeEscolar === 1;
      if (allowedGruposIds && !allowedGruposIds.includes(String(g.id)) && !isEquipe) return false
      const a = g?.ano !== undefined ? String(g.ano) : (g.anoLetivo || g.ano_letivo || g.dados?.anoLetivo || '')
      return a ? a === selectedAno : true
    })
  }, [gruposManuais, selectedAno, availableAnos, allowedGruposIds ? JSON.stringify(allowedGruposIds) : null])
  
  const [selected, setSelected] = useState<Record<string, {id: string, name: string, type: 'turma' | 'funcionario' | 'aluno' | 'grupo'}>>({})
  const [hasHydrated, setHasHydrated] = useState(false)

  const { alunosByTurmaRef, alunosById, colaboradoresById } = useMemo(() => {
    const byTurmaRef = new Map<string, any[]>()
    const aById = new Map<string, any>()
    const cById = new Map<string, any>()

    ;(alunos || []).forEach((a: any) => {
      aById.set(String(a.id), a)
      const ref = String(a.turma)
      if (ref) {
        let list = byTurmaRef.get(ref)
        if (!list) {
          list = []
          byTurmaRef.set(ref, list)
        }
        list.push(a)
      }
    })

    ;(colaboradores || []).forEach((c: any) => {
      cById.set(String(c.id), c)
    })

    return { alunosByTurmaRef: byTurmaRef, alunosById: aById, colaboradoresById: cById }
  }, [alunos, colaboradores])

  const getTurmaAlunos = (t: any) => {
    const refs = new Set<string>()
    if (t.id) refs.add(String(t.id))
    if (t.codigo) refs.add(String(t.codigo))
    if (t.nome) refs.add(String(t.nome))
    
    const all: any[] = []
    refs.forEach(ref => {
      const list = alunosByTurmaRef.get(ref)
      if (list) all.push(...list)
    })
    
    const unique = new Map()
    all.forEach(a => unique.set(a.id, a))
    return Array.from(unique.values())
  }

  useEffect(() => {
    if (!isOpen) {
      setHasHydrated(false)
      setCurrentCatId(null)
      setSelected({})
      setSearchQuery('')
      setSelectedAno('')
      return
    }
    if (hasHydrated) return

    if (initialSelected.length > 0) {
       const hasTurma = initialSelected.some(s => {
         const type = s.id.startsWith('f_') || s.id === 'func' ? 'funcionario' : s.id.startsWith('a_') ? 'aluno' : s.id.startsWith('g_') ? 'grupo' : 'turma'
         return type === 'turma'
       })
       if (hasTurma && turmas.length === 0) return

       const hasGrupo = initialSelected.some(s => {
         const type = s.id.startsWith('f_') || s.id === 'func' ? 'funcionario' : s.id.startsWith('a_') ? 'aluno' : s.id.startsWith('g_') ? 'grupo' : 'turma'
         return type === 'grupo'
       })
       if (hasGrupo && gruposManuais.length === 0) return
       
       if ((hasTurma || hasGrupo) && alunos.length === 0) return
    }

    const map: typeof selected = {}
      initialSelected.forEach(s => {
        const type = s.id.startsWith('f_') || s.id === 'func' ? 'funcionario' : s.id.startsWith('a_') ? 'aluno' : s.id.startsWith('g_') ? 'grupo' : 'turma'
        
        if (type === 'turma') {
           const t = turmas.find((x:any) => String(x.id) === String(s.id) || String(x.nome) === String(s.name))
           if (t) {
             const tAlunos = getTurmaAlunos(t)
             tAlunos.forEach((a:any) => {
               map[`a_${a.id}`] = { id: `a_${a.id}`, name: a.nome, type: 'aluno' }
             })
           }
        } else if (type === 'grupo') {
           const g = gruposManuais.find((x:any) => String(x.id) === String(s.id).replace('g_',''))
           if (g) {
             const gAlunos = (g.alunosIds || []).map((id:any) => alunosById.get(String(id))).filter(Boolean)
             const gColabs = (g.colaboradoresIds || []).map((id:any) => colaboradoresById.get(String(id))).filter(Boolean)
             gAlunos.forEach((a:any) => map[`a_${a.id}`] = { id: `a_${a.id}`, name: a.nome, type: 'aluno' })
             gColabs.forEach((c:any) => map[`f_${c.id}`] = { id: `f_${c.id}`, name: c.nome, type: 'funcionario' })
           }
        } else {
          map[s.id] = { id: s.id, name: s.name, type: type as any }
        }
      })
      setSelected(map)
      setHasHydrated(true)
  }, [isOpen, hasHydrated, initialSelected, turmas, gruposManuais, alunos, colaboradores, alunosByTurmaRef, alunosById, colaboradoresById])

  const { listItems, allLeafIds } = useMemo(() => {
    const categorias = [
      { name: 'Educação Infantil', match: (t: any) => /NÍVEL|INFANTIL|BERÇÁRIO|MATERNAL|JARDIM|PRÉ-ESCOLA/i.test(`${t.nome} ${t.serie || ''}`) },
      { name: 'Ensino Fundamental I', match: (t: any) => !/MÉDIO/i.test(`${t.nome} ${t.serie || ''}`) && /(1|2|3|4|5)º?\s*ANO/i.test(`${t.nome} ${t.serie || ''}`) },
      { name: 'Ensino Fundamental II', match: (t: any) => !/MÉDIO/i.test(`${t.nome} ${t.serie || ''}`) && /(6|7|8|9)º?\s*ANO/i.test(`${t.nome} ${t.serie || ''}`) },
      { name: 'Ensino Médio', match: (t: any) => /SÉRIE|MÉDIO/i.test(`${t.nome} ${t.serie || ''}`) },
    ]

    const items: any[] = []
    const leafIds = new Set<string>()
    
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
      const catPeopleIds = new Set<string>()
      const catPayloads = new Map<string, any>()
      
      const turmasItems: any[] = []
      
      cat.turmas.forEach((t: any) => {
        const tAlunos = getTurmaAlunos(t)
        const payloads = tAlunos.map(a => ({ id: `a_${a.id}`, name: a.nome, type: 'aluno' }))
        
        payloads.forEach(p => {
          leafIds.add(p.id)
          catPeopleIds.add(p.id)
          catPayloads.set(p.id, p)
        })
        
        turmasItems.push({
          id: `t_${t.id}`,
          title: t.nome,
          subtitle: t.turno || 'Turma',
          countBadge: `${payloads.length} pessoas`,
          type: 'turma',
          icon: Users,
          leafIds: payloads.map(p => p.id),
          payloads: payloads,
          people: payloads
        })
      })

      if (catPeopleIds.size > 0 || cat.turmas.length > 0) {
        items.push({
          id: `cat_${cat.name}`,
          title: cat.name,
          subtitle: `Categoria com ${cat.turmas.length} turmas`,
          countBadge: `${catPeopleIds.size} pessoas`,
          type: 'category',
          icon: Building2,
          leafIds: Array.from(catPeopleIds),
          payloads: Array.from(catPayloads.values()),
          people: null,
          children: turmasItems
        })
      }
    })

    const visibleGrupos = (filteredGrupos || []).filter((g: any) => {
      const isSyncedTurma = g.syncId || String(g.id).startsWith('sync-')
      if (isSyncedTurma) return !!g.isGlobalAccess
      return true
    })

    const sortedGrupos = [...visibleGrupos].sort((a, b) => a.nome.localeCompare(b.nome))
    sortedGrupos.forEach((g: any) => {
      const gAlunos = (g.alunosIds || []).map((id:any) => alunosById.get(String(id))).filter(Boolean)
      const gColabs = (g.colaboradoresIds || []).map((id:any) => colaboradoresById.get(String(id))).filter(Boolean)
      
      const payloads = [
        ...gAlunos.map((a: any) => ({ id: `a_${a.id}`, name: a.nome, type: 'aluno' })),
        ...gColabs.map((c: any) => ({ id: `f_${c.id}`, name: c.nome, type: 'funcionario' }))
      ]
      
      payloads.forEach(p => leafIds.add(p.id))

      items.push({
        id: `g_${g.id}`,
        title: g.nome,
        countBadge: `${payloads.length} pessoas`,
        type: 'grupo',
        icon: GraduationCap,
        leafIds: payloads.map(p => p.id),
        payloads: payloads,
        people: payloads
      })
    })

    return { listItems: items, allLeafIds: Array.from(leafIds) }
  }, [filteredTurmas, filteredGrupos, alunosByTurmaRef, alunosById, colaboradoresById])

  const activeItems = currentCatId 
    ? (listItems.find(i => i.id === currentCatId)?.children || [])
    : listItems

  const flatPeopleList = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    const peopleMap = new Map<string, any>()

    const extractPeople = (items: any[]) => {
      items.forEach(item => {
         if (item.people) {
            item.people.forEach((p: any) => {
               if (p.name.toLowerCase().includes(q)) {
                 peopleMap.set(p.id, p)
               }
            })
         }
         if (item.children) {
            extractPeople(item.children)
         }
      })
    }
    
    extractPeople(listItems)
    return Array.from(peopleMap.values()).sort((a,b) => a.name.localeCompare(b.name))
  }, [listItems, searchQuery])

  const toggleSelect = (item: any) => {
    setSelected(prev => {
      const next = { ...prev }
      const leafIds = item.leafIds as string[]
      const allSelected = leafIds.length > 0 && leafIds.every((id: string) => !!prev[id])
      
      if (allSelected) {
        leafIds.forEach((id: string) => delete next[id])
      } else {
        item.payloads.forEach((p: any) => {
          next[p.id] = p
        })
      }
      return next
    })
  }

  const toggleAll = () => {
    if (searchQuery.trim() !== '') {
       const allSelected = flatPeopleList.length > 0 && flatPeopleList.every(p => !!selected[p.id])
       if (allSelected) {
          setSelected(prev => {
             const next = { ...prev }
             flatPeopleList.forEach(p => delete next[p.id])
             return next
          })
       } else {
          setSelected(prev => {
             const next = { ...prev }
             flatPeopleList.forEach(p => next[p.id] = p)
             return next
          })
       }
       return
    }

    const activeLeavesArray = Array.from(new Set<string>(activeItems.flatMap((i: any) => i.leafIds as string[])))
    const allActiveSelected = activeLeavesArray.length > 0 && activeLeavesArray.every((id: string) => !!selected[id])

    if (allActiveSelected) {
      setSelected(prev => {
        const next = { ...prev }
        activeLeavesArray.forEach((id: string) => delete next[id])
        return next
      })
    } else {
      setSelected(prev => {
        const next = { ...prev }
        activeItems.forEach((item: any) => {
          if (item.payloads) {
             item.payloads.forEach((p: any) => next[p.id] = p)
          }
        })
        return next
      })
    }
  }

  const handleConfirm = () => {
    const result: any[] = []
    const selectedLeaves = new Set(Object.keys(selected))
    const coveredLeaves = new Set<string>()
    
    const allGroupItems: any[] = []
    listItems.forEach(item => {
      allGroupItems.push(item)
      if (item.children) {
        allGroupItems.push(...item.children)
      }
    })

    allGroupItems.forEach(item => {
      if (item.type === 'turma' || item.type === 'grupo') {
        if (item.leafIds.length > 0 && item.leafIds.every((id: string) => selectedLeaves.has(id))) {
           result.push({ id: item.id, name: item.title, type: item.type })
           item.leafIds.forEach((id: string) => coveredLeaves.add(id))
        }
      }
    })

    selectedLeaves.forEach(id => {
      if (!coveredLeaves.has(id)) {
        result.push(selected[id])
      }
    })

    onAdd(result)
    onClose()
  }

  const isAllActiveSelected = searchQuery.trim() !== ''
    ? (flatPeopleList.length > 0 && flatPeopleList.every(p => !!selected[p.id]))
    : (activeItems.length > 0 && activeItems.flatMap((i:any) => i.leafIds).length > 0 && activeItems.flatMap((i:any) => i.leafIds).every((id:string) => !!selected[id]))

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
                style={{ width: 48, height: 48, position: 'absolute', right: 16, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', border: 'none', cursor: 'pointer' }}
              >
                <X size={24} />
              </motion.button>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.2 }}>Destinatários</h2>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>Selecione quem receberá o comunicado</span>
              </div>
            </header>

            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 120 }}>
              {availableAnos.length > 0 && !currentCatId && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ padding: '24px 24px 8px' }}>
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
                      <option value="" disabled>Selecione o ano letivo...</option>
                      {availableAnos.map(ano => (
                        <option key={ano} value={ano}>{ano}</option>
                      ))}
                    </select>
                  </div>
                </motion.div>
              )}

              <div style={{ padding: '0 24px 24px' }}>
                {availableAnos.length > 0 && selectedAno === '' ? (
                  <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748B' }}>
                    <div style={{ background: '#F1F5F9', width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                      <Calendar size={40} color="#94A3B8" />
                    </div>
                    <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Selecione o Ano Letivo</h3>
                    <p style={{ fontSize: 15, maxWidth: 320, margin: '0 auto', lineHeight: 1.5 }}>
                      Por favor, selecione o ano letivo acima para visualizar e selecionar as turmas e grupos correspondentes.
                    </p>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    <motion.div
                      key={currentCatId || 'root'}
                      initial={{ opacity: 0, x: currentCatId ? 50 : -50 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: currentCatId ? -50 : 50 }}
                      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    >
                      {currentCatId && (
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, marginTop: 16 }}>
                           <button 
                             onClick={() => setCurrentCatId(null)} 
                             style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 8, color: '#4F46E5', fontWeight: 600, cursor: 'pointer', padding: '8px 0', fontSize: 15 }}
                           >
                             <ArrowLeft size={20} />
                             Voltar para Segmentos
                           </button>
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, marginTop: currentCatId ? 0 : 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>
                            {currentCatId ? listItems.find(i => i.id === currentCatId)?.title : 'Todos'}
                          </h3>
                          <span style={{ background: '#F1F5F9', color: '#64748B', fontSize: 13, fontWeight: 600, padding: '2px 8px', borderRadius: 12 }}>{activeItems.length}</span>
                        </div>
                        
                        <div style={{ display: 'flex', flex: 1, margin: '0 16px', position: 'relative' }}>
                          <Search size={18} color="#94A3B8" style={{ position: 'absolute', left: 12, top: 11 }} />
                          <input
                            placeholder="Buscar por nome..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{
                              width: '100%', height: 40, borderRadius: 12, border: '1px solid #E2E8F0',
                              padding: '0 16px 0 38px', fontSize: 14, outline: 'none'
                            }}
                          />
                        </div>
                        <button onClick={toggleAll} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, fontWeight: 600, color: '#4F46E5', background: 'none', border: 'none', cursor: 'pointer' }}>
                          Selecionar tudo
                          <div style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', background: isAllActiveSelected ? '#6D5DF6' : 'transparent', border: isAllActiveSelected ? '2px solid #6D5DF6' : '2px solid #CBD5E1' }}>
                             {isAllActiveSelected && <Check size={16} color="#fff" strokeWidth={3} />}
                          </div>
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {searchQuery.trim() !== '' ? (
                           flatPeopleList.length === 0 ? (
                             <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748B' }}>
                                Nenhum resultado encontrado para "{searchQuery}"
                             </div>
                           ) : (
                             flatPeopleList.map((person: any) => {
                               const isPersonSelected = !!selected[person.id]
                               return (
                                 <div 
                                    key={person.id}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelected(prev => {
                                        const next = { ...prev }
                                        if (isPersonSelected) delete next[person.id]
                                        else next[person.id] = person
                                        return next
                                      })
                                    }}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                                      borderRadius: 16, cursor: 'pointer',
                                      background: isPersonSelected ? '#F5F3FF' : '#fff',
                                      border: isPersonSelected ? '2px solid #C4B5FD' : '1px solid #E2E8F0',
                                      transition: 'all 0.2s'
                                    }}
                                 >
                                    <div style={{ 
                                      width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                      background: isPersonSelected ? '#6D5DF6' : '#fff',
                                      border: isPersonSelected ? 'none' : '2px solid #CBD5E1'
                                    }}>
                                      {isPersonSelected && <Check size={16} color="#fff" strokeWidth={3} />}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <span style={{ fontSize: 15, fontWeight: 600, color: '#0F172A' }}>{person.name}</span>
                                      <span style={{ fontSize: 12, color: '#64748B', textTransform: 'capitalize' }}>{person.type}</span>
                                    </div>
                                 </div>
                               )
                             })
                           )
                        ) : (
                          activeItems.map((item: any) => {
                            const isFullySelected = item.leafIds.length > 0 && item.leafIds.every((id: string) => !!selected[id])
                            const Icon = item.icon
                            const isCategory = item.type === 'category'
                            
                            const isPartiallySelected = !isFullySelected && item.leafIds.some((id: string) => !!selected[id])
                            
                            return (
                              <motion.div
                                key={item.id}
                                style={{ 
                                  borderRadius: 20, 
                                  background: isFullySelected ? '#F5F3FF' : '#fff',
                                  border: isFullySelected ? '2px solid #C4B5FD' : '2px solid #E2E8F0',
                                  transition: 'all 0.2s',
                                  overflow: 'hidden'
                                }}
                              >
                                <div 
                                  onClick={() => {
                                    if (isCategory) {
                                      setCurrentCatId(item.id)
                                    } else if (item.people) {
                                      setExpandedId(expandedId === item.id ? null : item.id)
                                    } else {
                                      toggleSelect(item)
                                    }
                                  }}
                                  style={{
                                    cursor: 'pointer', padding: '16px',
                                    display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 16,
                                  }}
                                >
                                  <div 
                                    onClick={(e) => { e.stopPropagation(); toggleSelect(item) }}
                                    style={{ 
                                      width: 24, height: 24, flexShrink: 0, borderRadius: 6, 
                                      display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
                                      background: isFullySelected ? '#6D5DF6' : isPartiallySelected ? '#C4B5FD' : '#fff',
                                      border: isFullySelected || isPartiallySelected ? 'none' : '2px solid #CBD5E1',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {isFullySelected ? <Check size={16} color="#fff" strokeWidth={3} /> : isPartiallySelected ? <div style={{width:10, height:3, background:'#fff', borderRadius:2}} /> : null}
                                  </div>

                                  <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isCategory ? '#EEF2FF' : '#F8FAFC', color: isCategory ? '#4F46E5' : '#6D5DF6' }}>
                                    <Icon size={22} />
                                  </div>

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

                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                    <div style={{ background: '#F1F5F9', color: '#475569', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 100 }}>
                                      {item.countBadge}
                                    </div>
                                    {isCategory && (
                                      <ChevronRight size={20} color="#94A3B8" />
                                    )}
                                  </div>
                                </div>

                                <AnimatePresence>
                                  {expandedId === item.id && item.people && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      style={{ overflow: 'hidden' }}
                                    >
                                      <div style={{ padding: '0 16px 16px 16px', display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: 16 }}>
                                        {item.people.map((person: any) => {
                                          const isPersonSelected = !!selected[person.id]
                                          return (
                                            <div 
                                              key={person.id}
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                setSelected(prev => {
                                                  const next = { ...prev }
                                                  if (isPersonSelected) delete next[person.id]
                                                  else next[person.id] = person
                                                  return next
                                                })
                                              }}
                                              style={{
                                                display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
                                                borderRadius: 12, cursor: 'pointer',
                                                background: isPersonSelected ? '#F8FAFC' : 'transparent',
                                                transition: 'background 0.2s'
                                              }}
                                              onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                                              onMouseLeave={e => e.currentTarget.style.background = isPersonSelected ? '#F8FAFC' : 'transparent'}
                                            >
                                              <div style={{ 
                                                width: 20, height: 20, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: isPersonSelected ? '#4F46E5' : '#fff',
                                                border: isPersonSelected ? 'none' : '2px solid #CBD5E1'
                                              }}>
                                                {isPersonSelected && <Check size={14} color="#fff" strokeWidth={3} />}
                                              </div>
                                              <span style={{ fontSize: 14, fontWeight: 500, color: '#1E293B' }}>{person.name}</span>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </motion.div>
                            )
                          })
                        )}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>
            </div>

            <div style={{ 
              position: 'absolute', bottom: 0, left: 0, right: 0, padding: '24px', 
              background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
              borderTop: '1px solid rgba(0,0,0,0.05)',
              display: 'flex', justifyContent: 'flex-end', gap: 12, zIndex: 10
            }}>
              <button 
                onClick={onClose}
                style={{ padding: '0 24px', height: 48, borderRadius: 16, background: '#F1F5F9', color: '#475569', fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#E2E8F0'}
                onMouseLeave={e => e.currentTarget.style.background = '#F1F5F9'}
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirm}
                disabled={Object.keys(selected).length === 0}
                style={{ padding: '0 32px', height: 48, borderRadius: 16, background: Object.keys(selected).length === 0 ? '#CBD5E1' : '#4F46E5', color: '#fff', fontSize: 15, fontWeight: 700, border: 'none', cursor: Object.keys(selected).length === 0 ? 'not-allowed' : 'pointer', boxShadow: Object.keys(selected).length === 0 ? 'none' : '0 10px 25px -5px rgba(79, 70, 229, 0.4)', transition: 'all 0.2s' }}
              >
                Confirmar ({Object.keys(selected).length})
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )

  if (!mounted) return null
  return createPortal(modalContent, document.body)
}
