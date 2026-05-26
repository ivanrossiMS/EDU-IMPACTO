import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, Check, ChevronDown } from 'lucide-react'

interface TurmaDropdownProps {
  turmaOptions: { id: string; nome: string }[]
  selectedTurmaId: string
  setSelectedTurmaId: (id: string) => void
  selectedTurmaName: string
}

export function TurmaDropdown({ turmaOptions, selectedTurmaId, setSelectedTurmaId, selectedTurmaName }: TurmaDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'hsl(var(--bg-surface))',
          border: '1px solid hsl(var(--border-subtle))',
          padding: '8px 16px',
          borderRadius: '12px',
          color: 'hsl(var(--text-main))',
          fontWeight: 600,
          fontSize: '14px',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}
      >
        <Menu size={16} color="#4f46e5" />
        <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedTurmaName}
        </span>
        <ChevronDown size={14} style={{ opacity: 0.5 }} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 8,
              background: 'hsl(var(--bg-surface))',
              border: '1px solid hsl(var(--border-subtle))',
              borderRadius: '16px',
              padding: '8px',
              minWidth: '220px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
              zIndex: 1000,
              maxHeight: '300px',
              overflowY: 'auto'
            }}
          >
            {turmaOptions.map(t => (
              <button
                key={t.id}
                onClick={() => { setSelectedTurmaId(t.id); setIsOpen(false) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '10px 12px',
                  border: 'none',
                  background: selectedTurmaId === t.id ? '#e0e7ff' : 'transparent',
                  color: selectedTurmaId === t.id ? '#4f46e5' : 'hsl(var(--text-main))',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '14px',
                  fontWeight: selectedTurmaId === t.id ? 700 : 500,
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => { if (selectedTurmaId !== t.id) e.currentTarget.style.background = 'hsl(var(--bg-main))' }}
                onMouseLeave={e => { if (selectedTurmaId !== t.id) e.currentTarget.style.background = 'transparent' }}
              >
                <span>{t.nome}</span>
                {selectedTurmaId === t.id && <Check size={14} />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
