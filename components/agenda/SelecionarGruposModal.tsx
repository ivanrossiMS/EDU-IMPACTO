'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, Search, Check, Users, GraduationCap, 
  Shield, Building2, UserCheck, DollarSign, 
  Phone, CheckSquare, Square
} from 'lucide-react'

export interface SelecionarGruposModalProps {
  isOpen: boolean
  onClose: () => void
  selectedGrupos: string[]
  onToggleGrupo: (nome: string) => void
  onChangeSelected?: (selected: string[]) => void
  turmas: any[]
  grupos: any[]
  anosLetivos?: string[]
  initialAno?: string
}

function getIconForEquipe(nome: string) {
  const n = (nome || '').toLowerCase()
  if (n.includes('direção') || n.includes('diretoria')) return Shield
  if (n.includes('coordenação') || n.includes('pedag')) return GraduationCap
  if (n.includes('financeiro') || n.includes('cobr')) return DollarSign
  if (n.includes('inspetor')) return UserCheck
  if (n.includes('recepção') || n.includes('secretaria')) return Phone
  return Users
}

export function SelecionarGruposModal({
  isOpen,
  onClose,
  selectedGrupos = [],
  onToggleGrupo,
  onChangeSelected,
  turmas = [],
  grupos = [],
  anosLetivos = [],
  initialAno,
}: SelecionarGruposModalProps) {
  const [mounted, setMounted] = useState(false)
  const [tab, setTab] = useState<'todos' | 'equipe' | 'turmas'>('todos')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAno, setSelectedAno] = useState<string>('')

  useEffect(() => {
    setMounted(true)
  }, [])

  // Inicializar o ano letivo padrão
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('')
      if (initialAno) {
        setSelectedAno(initialAno)
      } else if (anosLetivos.length > 0 && !selectedAno) {
        const currentYear = new Date().getFullYear().toString()
        if (anosLetivos.includes(currentYear)) {
          setSelectedAno(currentYear)
        } else {
          setSelectedAno(anosLetivos[0])
        }
      }
    }
  }, [isOpen, initialAno, anosLetivos])

  // Grupos da Equipe Escolar
  const equipeEscolarGrupos = useMemo(() => {
    return (grupos || [])
      .filter((g: any) => {
        const isEquipe = g?.isEquipeEscolar === true || g?.isEquipeEscolar === 'true' || g?.isEquipeEscolar === 1
        return isEquipe && g?.nome
      })
      .map((g: any) => ({
        id: g.id || g.nome,
        nome: String(g.nome).trim(),
        cor: g.cor || '#6366f1',
        isEquipeEscolar: true,
        colaboradoresCount: Array.isArray(g.colaboradoresIds) ? g.colaboradoresIds.length : 0,
      }))
      .filter((v, i, a) => a.findIndex(item => item.nome.toLowerCase() === v.nome.toLowerCase()) === i)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [grupos])

  // Turmas acadêmicas
  const turmasList = useMemo(() => {
    return (turmas || [])
      .filter((t: any) => {
        if (!t?.nome) return false
        if (!selectedAno || selectedAno === 'todos') return true
        const anoTurma = t.ano !== undefined ? String(t.ano) : (t.anoLetivo || t.ano_letivo || t.dados?.anoLetivo || '')
        return String(anoTurma) === String(selectedAno)
      })
      .map((t: any) => ({
        id: t.id || t.nome,
        nome: String(t.nome).trim(),
        ano: t.ano !== undefined ? String(t.ano) : (t.anoLetivo || t.ano_letivo || t.dados?.anoLetivo || ''),
        isEquipeEscolar: false
      }))
      .filter((v, i, a) => a.findIndex(item => item.nome.toLowerCase() === v.nome.toLowerCase()) === i)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [turmas, selectedAno])

  // Filtros aplicados pela pesquisa
  const termLower = searchTerm.toLowerCase().trim()

  const equipeFiltrada = useMemo(() => {
    if (!termLower) return equipeEscolarGrupos
    return equipeEscolarGrupos.filter(g => g.nome.toLowerCase().includes(termLower))
  }, [equipeEscolarGrupos, termLower])

  const turmasFiltradas = useMemo(() => {
    if (!termLower) return turmasList
    return turmasList.filter(t => t.nome.toLowerCase().includes(termLower))
  }, [turmasList, termLower])

  // Total de itens visíveis na tela atual
  const visibleItems = useMemo(() => {
    if (tab === 'equipe') return equipeFiltrada.map(g => g.nome)
    if (tab === 'turmas') return turmasFiltradas.map(t => t.nome)
    return [...equipeFiltrada.map(g => g.nome), ...turmasFiltradas.map(t => t.nome)]
  }, [tab, equipeFiltrada, turmasFiltradas])

  const allVisibleSelected = visibleItems.length > 0 && visibleItems.every(name => selectedGrupos.includes(name))

  const handleToggleAllVisible = () => {
    if (!onChangeSelected) {
      visibleItems.forEach(name => {
        if (allVisibleSelected) {
          if (selectedGrupos.includes(name)) onToggleGrupo(name)
        } else {
          if (!selectedGrupos.includes(name)) onToggleGrupo(name)
        }
      })
      return
    }

    if (allVisibleSelected) {
      // Remove todos os visíveis
      onChangeSelected(selectedGrupos.filter(name => !visibleItems.includes(name)))
    } else {
      // Adiciona todos os visíveis sem duplicatas
      const newSet = new Set([...selectedGrupos, ...visibleItems])
      onChangeSelected(Array.from(newSet))
    }
  }

  const handleToggle = (nome: string) => {
    if (onChangeSelected) {
      if (selectedGrupos.includes(nome)) {
        onChangeSelected(selectedGrupos.filter(item => item !== nome))
      } else {
        onChangeSelected([...selectedGrupos, nome])
      }
    } else {
      onToggleGrupo(nome)
    }
  }

  if (!mounted || !isOpen) return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(15,23,42,0.82)', 
            zIndex: 100005, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '20px', 
            backdropFilter: 'blur(8px)' 
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <motion.div 
            initial={{ scale: 0.95, y: 20 }} 
            animate={{ scale: 1, y: 0 }} 
            exit={{ scale: 0.95, y: 20 }} 
            style={{ 
              background: '#fff', 
              borderRadius: 32, 
              width: '100%', 
              maxWidth: 520, 
              padding: '28px 24px', 
              boxShadow: '0 40px 80px rgba(0,0,0,0.35)', 
              border: '1px solid rgba(255,255,255,0.2)',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* ─── Header ──────────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 900, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🎯</span> Selecionar Grupos
                </h3>
                <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0 0', fontWeight: 500 }}>
                  Defina quais equipes ou turmas participarão deste evento.
                </p>
              </div>
              <button 
                onClick={onClose} 
                style={{ 
                  border: 'none', 
                  background: '#f1f5f9', 
                  padding: 8, 
                  borderRadius: '50%', 
                  cursor: 'pointer', 
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
              >
                <X size={18} />
              </button>
            </div>

            {/* ─── Category Filter Tabs ────────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: 6, background: '#f8fafc', padding: 4, borderRadius: 16, border: '1px solid #e2e8f0', marginBottom: 14 }}>
              {[
                { id: 'todos', label: 'Todos', count: equipeEscolarGrupos.length + turmasList.length },
                { id: 'equipe', label: '👥 Equipe Escolar', count: equipeEscolarGrupos.length },
                { id: 'turmas', label: '🎓 Turmas', count: turmasList.length },
              ].map(t => {
                const isActive = tab === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id as any)}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 800,
                      border: 'none',
                      cursor: 'pointer',
                      background: isActive ? '#1e293b' : 'transparent',
                      color: isActive ? '#fff' : '#64748b',
                      boxShadow: isActive ? '0 4px 12px rgba(30,41,59,0.2)' : 'none',
                      transition: 'all 0.18s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    <span>{t.label}</span>
                    <span style={{ 
                      fontSize: 10, 
                      padding: '1px 6px', 
                      borderRadius: 10, 
                      background: isActive ? 'rgba(255,255,255,0.2)' : '#e2e8f0', 
                      color: isActive ? '#fff' : '#475569' 
                    }}>
                      {t.count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* ─── Filter & Search Bar ─────────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {tab !== 'equipe' && anosLetivos.length > 0 && (
                <select 
                  className="form-select" 
                  style={{ 
                    height: 46, 
                    borderRadius: 14, 
                    fontSize: 13, 
                    fontWeight: 700, 
                    background: '#f8fafc', 
                    border: '1.5px solid #e2e8f0', 
                    minWidth: 120,
                    maxWidth: 150,
                    cursor: 'pointer',
                    color: '#1e293b'
                  }} 
                  value={selectedAno} 
                  onChange={(e) => setSelectedAno(e.target.value)}
                >
                  <option value="todos">Todos Anos</option>
                  {anosLetivos.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              )}

              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input 
                  autoFocus 
                  className="form-input" 
                  style={{ 
                    width: '100%', 
                    paddingLeft: 40, 
                    paddingRight: searchTerm ? 36 : 14, 
                    height: 46, 
                    borderRadius: 14, 
                    fontSize: 13, 
                    fontWeight: 600, 
                    background: '#f8fafc', 
                    border: '1.5px solid #e2e8f0',
                    outline: 'none'
                  }} 
                  placeholder={tab === 'equipe' ? 'Buscar equipe escolar...' : 'O que você procura?...'} 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', padding: 4 }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* ─── Quick Actions (Select all visible) ──────────────────────────── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '0 4px' }}>
              <button
                type="button"
                onClick={handleToggleAllVisible}
                disabled={visibleItems.length === 0}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  fontSize: 12,
                  fontWeight: 700,
                  color: visibleItems.length === 0 ? '#cbd5e1' : '#4f46e5',
                  cursor: visibleItems.length === 0 ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {allVisibleSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                <span>{allVisibleSelected ? 'Desmarcar visíveis' : 'Selecionar todos visíveis'}</span>
              </button>

              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>
                <span style={{ color: selectedGrupos.length > 0 ? '#4f46e5' : '#94a3b8' }}>
                  {selectedGrupos.length} selecionado{selectedGrupos.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* ─── Scrollable List Content ────────────────────────────────────── */}
            <div style={{ 
              flex: 1, 
              maxHeight: 330, 
              overflowY: 'auto', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 8, 
              paddingRight: 4,
              borderTop: '1px solid #f1f5f9',
              paddingTop: 10
            }}>
              {/* Vazio total */}
              {visibleItems.length === 0 && (
                <div style={{ textAlign: 'center', padding: '36px 20px', color: '#94a3b8' }}>
                  <Users size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                  <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Nenhum grupo encontrado.</p>
                  {searchTerm && (
                    <p style={{ fontSize: 12, margin: '4px 0 0 0' }}>Tente buscar por outro termo.</p>
                  )}
                </div>
              )}

              {/* 👥 SEÇÃO EQUIPE ESCOLAR */}
              {(tab === 'todos' || tab === 'equipe') && equipeFiltrada.length > 0 && (
                <div>
                  {tab === 'todos' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Users size={12} /> Equipe Escolar ({equipeFiltrada.length})
                      </span>
                      <div style={{ flex: 1, height: 1, background: 'rgba(79, 70, 229, 0.15)' }} />
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {equipeFiltrada.map(g => {
                      const isSelected = selectedGrupos.includes(g.nome)
                      const IconComp = getIconForEquipe(g.nome)

                      return (
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          key={`equipe-${g.id}-${g.nome}`}
                          type="button"
                          onClick={() => handleToggle(g.nome)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            textAlign: 'left',
                            background: isSelected ? 'rgba(79, 70, 229, 0.08)' : '#f8fafc',
                            border: `1.5px solid ${isSelected ? '#6366f1' : '#f1f5f9'}`,
                            borderRadius: 14,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {/* Checkbox */}
                          <div style={{
                            width: 20,
                            height: 20,
                            borderRadius: 6,
                            border: `2px solid ${isSelected ? '#4f46e5' : '#cbd5e1'}`,
                            background: isSelected ? '#4f46e5' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {isSelected && <Check size={13} color="#fff" strokeWidth={4} />}
                          </div>

                          {/* Icon Circle */}
                          <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: 10,
                            background: `${g.cor || '#6366f1'}15`,
                            color: g.cor || '#6366f1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <IconComp size={16} />
                          </div>

                          {/* Group Name */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 13,
                              fontWeight: isSelected ? 800 : 600,
                              color: isSelected ? '#1e293b' : '#334155',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {g.nome}
                            </div>
                            {g.colaboradoresCount > 0 && (
                              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>
                                {g.colaboradoresCount} membro{g.colaboradoresCount !== 1 ? 's' : ''}
                              </div>
                            )}
                          </div>

                          {/* Equipe Escolar Badge */}
                          <span style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: '3px 8px',
                            background: 'rgba(79, 70, 229, 0.12)',
                            color: '#4f46e5',
                            borderRadius: 20,
                            flexShrink: 0,
                            letterSpacing: '0.02em'
                          }}>
                            Equipe Escolar
                          </span>
                        </motion.button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 🎓 SEÇÃO TURMAS */}
              {(tab === 'todos' || tab === 'turmas') && turmasFiltradas.length > 0 && (
                <div style={{ marginTop: tab === 'todos' && equipeFiltrada.length > 0 ? 12 : 0 }}>
                  {tab === 'todos' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <GraduationCap size={13} /> Turmas {selectedAno && selectedAno !== 'todos' ? `• ${selectedAno}` : ''} ({turmasFiltradas.length})
                      </span>
                      <div style={{ flex: 1, height: 1, background: 'rgba(37, 99, 235, 0.15)' }} />
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {turmasFiltradas.map(t => {
                      const isSelected = selectedGrupos.includes(t.nome)

                      return (
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          key={`turma-${t.id}-${t.nome}`}
                          type="button"
                          onClick={() => handleToggle(t.nome)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            textAlign: 'left',
                            background: isSelected ? 'rgba(37, 99, 235, 0.08)' : '#f8fafc',
                            border: `1.5px solid ${isSelected ? '#3b82f6' : '#f1f5f9'}`,
                            borderRadius: 14,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {/* Checkbox */}
                          <div style={{
                            width: 20,
                            height: 20,
                            borderRadius: 6,
                            border: `2px solid ${isSelected ? '#2563eb' : '#cbd5e1'}`,
                            background: isSelected ? '#2563eb' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {isSelected && <Check size={13} color="#fff" strokeWidth={4} />}
                          </div>

                          {/* Icon Circle */}
                          <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: 10,
                            background: 'rgba(37, 99, 235, 0.1)',
                            color: '#2563eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <GraduationCap size={16} />
                          </div>

                          {/* Turma Name */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 13,
                              fontWeight: isSelected ? 800 : 600,
                              color: isSelected ? '#1e293b' : '#334155',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {t.nome}
                            </div>
                            {t.ano && (
                              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>
                                Ano Letivo: {t.ano}
                              </div>
                            )}
                          </div>

                          {/* Badge */}
                          <span style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '3px 8px',
                            background: 'rgba(37, 99, 235, 0.08)',
                            color: '#2563eb',
                            borderRadius: 20,
                            flexShrink: 0
                          }}>
                            Turma
                          </span>
                        </motion.button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ─── Selected Chips Preview ─────────────────────────────────────── */}
            {selectedGrupos.length > 0 && (
              <div style={{ 
                marginTop: 12, 
                padding: '8px 10px', 
                background: '#f8fafc', 
                borderRadius: 14, 
                border: '1px solid #f1f5f9',
                maxHeight: 64,
                overflowY: 'auto',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 4
              }}>
                {selectedGrupos.map(nome => {
                  const isEquipe = equipeEscolarGrupos.some(e => e.nome === nome)
                  return (
                    <span 
                      key={`chip-${nome}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: isEquipe ? 'rgba(79, 70, 229, 0.12)' : 'rgba(37, 99, 235, 0.12)',
                        color: isEquipe ? '#4f46e5' : '#1d4ed8'
                      }}
                    >
                      {nome}
                      <button 
                        type="button" 
                        onClick={() => handleToggle(nome)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'inherit', display: 'flex' }}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  )
                })}
              </div>
            )}

            {/* ─── Footer Action ──────────────────────────────────────────────── */}
            <motion.button 
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="btn btn-primary" 
              style={{ 
                width: '100%', 
                marginTop: 16, 
                height: 48, 
                borderRadius: 16, 
                fontWeight: 900, 
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', 
                border: 'none', 
                color: '#fff',
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 8px 20px rgba(15, 23, 42, 0.25)'
              }} 
              onClick={onClose}
            >
              <Check size={16} strokeWidth={3} />
              <span>Finalizar Seleção {selectedGrupos.length > 0 ? `(${selectedGrupos.length})` : ''}</span>
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
