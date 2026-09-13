"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Check, ChevronDown, Calendar, Search, X, 
  Sparkles, Users, GraduationCap, Building2, 
  SlidersHorizontal, CheckCircle2
} from 'lucide-react'
import { compareTurmasBySerie } from '@/lib/studentTurmaUtils'

export interface TurmaOption {
  id: string
  nome: string
  categoria?: string
  badge?: string
}

interface TurmaDropdownProps {
  turmaOptions: TurmaOption[]
  selectedTurmaId: string
  setSelectedTurmaId: (id: string) => void
  selectedTurmaName: string
  anosLetivos?: string[]
  selectedAno?: string
  setSelectedAno?: (ano: string) => void
  anoVigente?: string
  buttonStyle?: React.CSSProperties
  className?: string
  icon?: React.ReactNode
  allLabel?: string
}

export function TurmaDropdown({ 
  turmaOptions, 
  selectedTurmaId, 
  setSelectedTurmaId, 
  selectedTurmaName,
  anosLetivos = [], 
  selectedAno = 'todos', 
  setSelectedAno,
  anoVigente,
  buttonStyle, 
  className, 
  icon, 
  allLabel = 'Todos (Equipe e Turmas)'
}: TurmaDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Foco automático no input de busca ao abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 150)
    } else {
      setSearchTerm('')
    }
  }, [isOpen])

  const isFiltered = selectedTurmaId !== 'all'

  // Filtragem pela busca
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return turmaOptions
    const q = searchTerm.toLowerCase().trim()
    return turmaOptions.filter(o => 
      o.nome.toLowerCase().includes(q) || 
      (o.categoria && o.categoria.toLowerCase().includes(q)) ||
      (o.badge && o.badge.toLowerCase().includes(q))
    )
  }, [turmaOptions, searchTerm])

  // Agrupamento por categoria ordenado por série
  const groupsByCategory = useMemo(() => {
    const map: Record<string, TurmaOption[]> = {}
    filteredOptions.forEach(t => {
      const cat = t.categoria || 'Outros'
      if (!map[cat]) map[cat] = []
      map[cat].push(t)
    })
    // Ordenar turmas de cada categoria por série
    Object.keys(map).forEach(cat => {
      map[cat].sort(compareTurmasBySerie)
    })
    return map
  }, [filteredOptions])

  const getCategoryOrderWeight = (catName: string): number => {
    const lower = catName.toLowerCase()
    if (lower.includes('infantil') || lower.includes('bercario') || lower.includes('maternal')) return 1
    if (lower.includes('fundamental i') || lower.includes('fundamental 1') || lower.includes('fund 1')) return 2
    if (lower.includes('fundamental ii') || lower.includes('fundamental 2') || lower.includes('fund 2')) return 3
    if (lower.includes('medio') || lower.includes('médio')) return 4
    if (lower.includes('equipe')) return 5
    return 6
  }

  // Determinar ícone da categoria
  const getCategoryMeta = (catName: string) => {
    const lower = catName.toLowerCase()
    if (lower.includes('equipe')) {
      return {
        icon: Building2,
        color: '#7c3aed',
        bg: 'rgba(124, 58, 237, 0.1)',
        border: 'rgba(124, 58, 237, 0.2)',
        label: 'Equipe Escolar'
      }
    }
    return {
      icon: GraduationCap,
      color: '#0284c7',
      bg: 'rgba(2, 132, 199, 0.1)',
      border: 'rgba(2, 132, 199, 0.2)',
      label: catName
    }
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      {/* ─── BOTÃO PRINCIPAL ULTRA MODERNO ─── */}
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={className}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          background: isFiltered 
            ? 'linear-gradient(135deg, rgba(238,242,255,0.95) 0%, rgba(245,243,255,0.95) 100%)'
            : 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(12px)',
          border: isFiltered 
            ? '1.5px solid rgba(99, 102, 241, 0.45)' 
            : '1px solid rgba(226, 232, 240, 0.9)',
          padding: '8px 14px',
          borderRadius: '16px',
          color: '#1e293b',
          fontWeight: 600,
          fontSize: '13.5px',
          cursor: 'pointer',
          boxShadow: isFiltered
            ? '0 4px 20px -2px rgba(99, 102, 241, 0.18), 0 2px 6px -1px rgba(0,0,0,0.04)'
            : '0 4px 16px -2px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(0,0,0,0.03)',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          ...buttonStyle
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1, overflow: 'hidden' }}>
          {/* Badge Icon */}
          <div style={{
            width: 34,
            height: 34,
            borderRadius: '10px',
            background: isFiltered 
              ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' 
              : 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isFiltered ? '#ffffff' : '#6366f1',
            boxShadow: isFiltered ? '0 2px 8px rgba(79, 70, 229, 0.3)' : 'none',
            flexShrink: 0,
            transition: 'all 0.2s ease'
          }}>
            {icon || <SlidersHorizontal size={16} />}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, textAlign: 'left', flex: 1, overflow: 'hidden' }}>
            <span style={{ 
              fontSize: '10px', 
              fontWeight: 800, 
              letterSpacing: '0.04em',
              textTransform: 'uppercase', 
              color: isFiltered ? '#4f46e5' : '#64748b',
              lineHeight: 1.2
            }}>
              {isFiltered ? 'Filtrado por' : 'Filtro de Exibição'}
            </span>
            <span style={{ 
              fontSize: '13.5px', 
              fontWeight: 700, 
              color: isFiltered ? '#1e1b4b' : '#0f172a',
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap',
              width: '100%',
              lineHeight: 1.3
            }}>
              {selectedTurmaName}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
          {/* Badge do Ano Ativo */}
          {selectedAno && selectedAno !== 'todos' && (
            <span style={{
              fontSize: '10.5px',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: '8px',
              background: '#e0e7ff',
              color: '#3730a3',
              border: '1px solid #c7d2fe'
            }}>
              {selectedAno}
            </span>
          )}

          {/* Botão de Limpar Rápido */}
          {isFiltered && (
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTurmaId('all');
              }}
              title="Limpar filtro (Ver todos)"
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: 'rgba(99, 102, 241, 0.12)',
                color: '#4f46e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#ef4444';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.12)';
                e.currentTarget.style.color = '#4f46e5';
              }}
            >
              <X size={12} strokeWidth={2.5} />
            </div>
          )}

          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', alignItems: 'center', color: '#64748b' }}
          >
            <ChevronDown size={16} />
          </motion.div>
        </div>
      </button>

      {/* ─── POPOVER FLUTUANTE ULTRA MODERNO ─── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              width: '100%',
              minWidth: '320px',
              maxWidth: '380px',
              background: '#ffffff',
              borderRadius: '20px',
              border: '1px solid rgba(226, 232, 240, 0.9)',
              boxShadow: '0 20px 50px -10px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(0,0,0,0.03)',
              zIndex: 1000,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* ─── SELETOR DE ANO LETIVO EM PILLS / TABS ─── */}
            {anosLetivos && anosLetivos.length > 0 && setSelectedAno && (
              <div style={{ 
                padding: '14px 16px 12px 16px', 
                background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
                borderBottom: '1px solid #f1f5f9'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={13} color="#6366f1" />
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      Ano Letivo
                    </span>
                  </div>
                  {anoVigente && (
                    <span style={{ 
                      fontSize: '10px', 
                      fontWeight: 700, 
                      color: '#059669', 
                      background: '#ecfdf5', 
                      border: '1px solid #a7f3d0',
                      padding: '1px 6px', 
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                      Vigente: {anoVigente}
                    </span>
                  )}
                </div>

                {/* Abas horizontais de Anos */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 6, 
                  overflowX: 'auto', 
                  paddingBottom: 2,
                  scrollbarWidth: 'none'
                }}>
                  <button
                    type="button"
                    onClick={() => { setSelectedAno('todos'); setSelectedTurmaId('all'); }}
                    style={{
                      padding: '5px 11px',
                      borderRadius: '10px',
                      fontSize: '11.5px',
                      fontWeight: selectedAno === 'todos' ? 800 : 600,
                      border: selectedAno === 'todos' ? '1px solid #4f46e5' : '1px solid #e2e8f0',
                      background: selectedAno === 'todos' ? 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' : '#ffffff',
                      color: selectedAno === 'todos' ? '#ffffff' : '#64748b',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: selectedAno === 'todos' ? '0 2px 8px rgba(79, 70, 229, 0.25)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Todos os Anos
                  </button>

                  {anosLetivos.map(ano => {
                    const isVigente = ano === anoVigente
                    const isSelected = selectedAno === ano
                    return (
                      <button
                        key={ano}
                        type="button"
                        onClick={() => { setSelectedAno(ano); setSelectedTurmaId('all'); }}
                        style={{
                          padding: '5px 11px',
                          borderRadius: '10px',
                          fontSize: '11.5px',
                          fontWeight: isSelected ? 800 : 600,
                          border: isSelected ? '1px solid #4f46e5' : '1px solid #e2e8f0',
                          background: isSelected 
                            ? 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' 
                            : '#ffffff',
                          color: isSelected ? '#ffffff' : '#475569',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          boxShadow: isSelected ? '0 2px 8px rgba(79, 70, 229, 0.25)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {isVigente && (
                          <span style={{ 
                            width: 6, 
                            height: 6, 
                            borderRadius: '50%', 
                            background: isSelected ? '#34d399' : '#10b981' 
                          }} />
                        )}
                        <span>{ano}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ─── CAMPO DE BUSCA RÁPIDA ─── */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '6px 10px'
              }}>
                <Search size={14} color="#94a3b8" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar grupo ou turma..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: '12.5px',
                    color: '#1e293b',
                    width: '100%',
                    fontWeight: 500
                  }}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: '#94a3b8' }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* ─── LISTA COM SCROLL ─── */}
            <div style={{ 
              maxHeight: '340px', 
              overflowY: 'auto', 
              padding: '6px',
              display: 'flex', 
              flexDirection: 'column', 
              gap: 4 
            }}>
              {/* Opção Global: "Todos (Equipe e Turmas)" */}
              {!searchTerm && (
                <button
                  type="button"
                  onClick={() => { setSelectedTurmaId('all'); setIsOpen(false); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '10px 12px',
                    border: selectedTurmaId === 'all' ? '1px solid #c7d2fe' : '1px solid transparent',
                    background: selectedTurmaId === 'all' ? '#eef2ff' : 'transparent',
                    color: selectedTurmaId === 'all' ? '#4f46e5' : '#1e293b',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '13.5px',
                    fontWeight: selectedTurmaId === 'all' ? 800 : 600,
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => { if (selectedTurmaId !== 'all') e.currentTarget.style.background = '#f8fafc' }}
                  onMouseLeave={e => { if (selectedTurmaId !== 'all') e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: '8px',
                      background: selectedTurmaId === 'all' ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' : '#f1f5f9',
                      color: selectedTurmaId === 'all' ? '#ffffff' : '#6366f1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Sparkles size={14} />
                    </div>
                    <span>{allLabel}</span>
                  </div>
                  {selectedTurmaId === 'all' && <CheckCircle2 size={16} color="#4f46e5" />}
                </button>
              )}

              {/* Categorias e Itens */}
              {Object.keys(groupsByCategory).length > 0 ? (
                Object.entries(groupsByCategory)
                  .sort(([catA], [catB]) => getCategoryOrderWeight(catA) - getCategoryOrderWeight(catB))
                  .map(([catName, items]) => {
                  const meta = getCategoryMeta(catName)
                  const CatIcon = meta.icon

                  return (
                    <div key={catName} style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                      {/* Header da Categoria */}
                      <div style={{
                        padding: '8px 10px 4px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderTop: '1px solid #f1f5f9'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CatIcon size={13} color={meta.color} />
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            color: meta.color
                          }}>
                            {catName}
                          </span>
                        </div>
                        <span style={{ 
                          fontSize: '10.5px', 
                          background: meta.bg, 
                          color: meta.color, 
                          border: `1px solid ${meta.border}`,
                          padding: '1px 6px', 
                          borderRadius: '8px', 
                          fontWeight: 700 
                        }}>
                          {items.length}
                        </span>
                      </div>

                      {/* Itens da Categoria */}
                      {items.map(t => {
                        const isSelected = selectedTurmaId === t.id
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => { setSelectedTurmaId(t.id); setIsOpen(false); }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              width: '100%',
                              padding: '8px 10px',
                              border: isSelected ? '1px solid #c7d2fe' : '1px solid transparent',
                              background: isSelected ? '#eef2ff' : 'transparent',
                              color: isSelected ? '#4f46e5' : '#334155',
                              borderRadius: '10px',
                              cursor: 'pointer',
                              textAlign: 'left',
                              fontSize: '13px',
                              fontWeight: isSelected ? 700 : 500,
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f8fafc' }}
                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {t.nome}
                              </span>
                              {t.badge && (
                                <span style={{
                                  fontSize: '9.5px',
                                  padding: '1px 5px',
                                  borderRadius: '6px',
                                  background: 'rgba(124, 58, 237, 0.1)',
                                  color: '#7c3aed',
                                  fontWeight: 700,
                                  flexShrink: 0
                                }}>
                                  {t.badge}
                                </span>
                              )}
                            </span>
                            {isSelected && <Check size={14} color="#4f46e5" strokeWidth={2.5} />}
                          </button>
                        )
                      })}
                    </div>
                  )
                })
              ) : (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '12.5px' }}>
                  {searchTerm ? 'Nenhum resultado para a busca' : 'Nenhuma opção disponível para este ano'}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

