'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, ChevronDown, Loader2, AlertCircle } from 'lucide-react'
import { useConfigDb } from '@/lib/useConfigDb'
import { supabase } from '@/lib/supabase'

interface AnoLetivoModalProps {
  onSelect: (ano: string, bimestreId?: string) => void
}

function getBimestreAno(b: any): string {
  if (b.ano_letivo) return String(b.ano_letivo).trim()
  if (b.nome) {
    const match = b.nome.match(/\b(20\d{2})\b/)
    if (match) return match[1]
  }
  if (b.data_inicio) {
    return b.data_inicio.substring(0, 4)
  }
  return ''
}

export function AnoLetivoModal({ onSelect }: AnoLetivoModalProps) {
  const { data: cfgCalendarioLetivo, loading: loadingCfg } = useConfigDb<any>('cfgCalendarioLetivo')
  const [bimestres, setBimestres] = useState<any[]>([])
  const [loadingBimestres, setLoadingBimestres] = useState(true)
  const [isOpen, setIsOpen] = useState(true)

  // Carregar bimestres cadastrados e ativos em /simulados/configuracoes
  useEffect(() => {
    async function loadBimestres() {
      try {
        const { data } = await (supabase as any)
          .from('simulados_bimestres')
          .select('*')
          .eq('status', 'ativo')
          .order('nome')
        setBimestres(data || [])
      } catch (e) {
        console.error(e)
      } finally {
        setLoadingBimestres(false)
      }
    }
    loadBimestres()
  }, [])
  
  // Extrai apenas os anos letivos configurados nos bimestres do módulo de simulados
  const anosDisponiveis = useMemo(() => {
    const yearsSet = new Set<string>()
    bimestres.forEach((b: any) => {
      const y = getBimestreAno(b)
      if (y) yearsSet.add(y)
    })
    return Array.from(yearsSet).sort((a, b) => parseInt(b) - parseInt(a))
  }, [bimestres])

  const [selectedAno, setSelectedAno] = useState('')
  const [selectedBimestre, setSelectedBimestre] = useState('todos')

  // Auto-seleciona o ano letivo padrão (prioriza o ano marcado como Aberto se configurado, senão o mais recente)
  useEffect(() => {
    if (anosDisponiveis.length > 0) {
      if (!selectedAno || !anosDisponiveis.includes(selectedAno)) {
        const anoAberto = cfgCalendarioLetivo?.find((c: any) => c.status === 'Aberto')?.ano
        if (anoAberto && anosDisponiveis.includes(String(anoAberto))) {
          setSelectedAno(String(anoAberto))
        } else {
          setSelectedAno(anosDisponiveis[0])
        }
      }
    }
  }, [anosDisponiveis, selectedAno, cfgCalendarioLetivo])

  // Obter bimestres do ano selecionado
  const bimestresDoAno = useMemo(() => {
    if (!selectedAno) return []
    return bimestres.filter((b: any) => getBimestreAno(b) === String(selectedAno))
  }, [bimestres, selectedAno])

  // Sempre que o ano letivo selecionado mudar (ou os bimestres carregarem),
  // selecionar o ÚLTIMO bimestre cadastrado do ano por padrão
  useEffect(() => {
    if (bimestresDoAno.length > 0) {
      const ultimoBim = bimestresDoAno[bimestresDoAno.length - 1]
      if (ultimoBim) {
        setSelectedBimestre(ultimoBim.id)
      }
    } else {
      setSelectedBimestre('todos')
    }
  }, [bimestresDoAno])

  const handleConfirm = () => {
    if (!selectedAno) return
    setIsOpen(false)
    setTimeout(() => onSelect(String(selectedAno), selectedBimestre), 300)
  }

  if (!isOpen) return null

  const loading = loadingCfg || loadingBimestres

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 24
        }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          style={{
            background: 'hsl(var(--bg-surface))',
            borderRadius: 24,
            width: '100%',
            maxWidth: 440,
            overflow: 'hidden',
            boxShadow: '0 32px 64px rgba(0,0,0,0.3), 0 0 0 1px hsl(var(--border-subtle))',
          }}
        >
          <div style={{ padding: '32px 32px 20px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(135deg, #3b82f6 0%, #2dd4bf 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 8px 24px rgba(59, 130, 246, 0.3)' }}>
              <Calendar size={32} color="#fff" />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'hsl(var(--text-primary))', marginBottom: 8, letterSpacing: '-0.02em' }}>
              Selecione o Ano e Bimestre
            </h2>
            <p style={{ fontSize: 14, color: 'hsl(var(--text-secondary))', lineHeight: 1.5 }}>
              Escolha para qual ano letivo e bimestre deseja visualizar as informações.
            </p>
          </div>
          
          <div style={{ padding: '0 32px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '20px 0' }}>
                <Loader2 size={24} className="animate-spin" style={{ color: '#3b82f6' }} />
                <div style={{ color: 'hsl(var(--text-secondary))', fontSize: 14 }}>Carregando dados...</div>
              </div>
            ) : anosDisponiveis.length > 0 ? (
              <>
                {/* 1. Seleção de Ano Letivo */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-secondary))', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Ano Letivo
                  </label>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={selectedAno}
                      onChange={e => setSelectedAno(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '14px 18px',
                        borderRadius: 14,
                        background: 'hsl(var(--bg-app))',
                        border: '1px solid hsl(var(--border-subtle))',
                        color: 'hsl(var(--text-primary))',
                        fontSize: 15,
                        fontWeight: 600,
                        outline: 'none',
                        cursor: 'pointer',
                        appearance: 'none',
                        transition: 'all 0.2s',
                      }}
                      onFocus={e => {
                        e.currentTarget.style.borderColor = '#3b82f6'
                        e.currentTarget.style.boxShadow = '0 0 0 4px rgba(59,130,246,0.1)'
                      }}
                      onBlur={e => {
                        e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    >
                      {anosDisponiveis.map((ano: string) => {
                        const isAberto = cfgCalendarioLetivo?.some((c: any) => String(c.ano) === String(ano) && c.status === 'Aberto')
                        return (
                          <option key={ano} value={ano}>
                            Ano de {ano} {isAberto ? '(Ativo)' : ''}
                          </option>
                        )
                      })}
                    </select>
                    <ChevronDown size={18} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-secondary))', pointerEvents: 'none' }} />
                  </div>
                </div>

                {/* 2. Seleção de Bimestre */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-secondary))', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Bimestre
                  </label>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={selectedBimestre}
                      onChange={e => setSelectedBimestre(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '14px 18px',
                        borderRadius: 14,
                        background: 'hsl(var(--bg-app))',
                        border: '1px solid hsl(var(--border-subtle))',
                        color: 'hsl(var(--text-primary))',
                        fontSize: 15,
                        fontWeight: 600,
                        outline: 'none',
                        cursor: 'pointer',
                        appearance: 'none',
                        transition: 'all 0.2s',
                      }}
                      onFocus={e => {
                        e.currentTarget.style.borderColor = '#3b82f6'
                        e.currentTarget.style.boxShadow = '0 0 0 4px rgba(59,130,246,0.1)'
                      }}
                      onBlur={e => {
                        e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    >
                      <option value="todos">Todos os bimestres</option>
                      {bimestresDoAno.map((bim: any) => (
                        <option key={bim.id} value={bim.id}>{bim.nome}</option>
                      ))}
                    </select>
                    <ChevronDown size={18} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-secondary))', pointerEvents: 'none' }} />
                  </div>
                </div>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleConfirm}
                  style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: '#fff',
                    fontSize: 16,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                    marginTop: 8
                  }}
                >
                  Continuar
                </motion.button>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'hsl(var(--text-secondary))', fontSize: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={24} color="#f59e0b" />
                <span>Nenhum ano letivo ou bimestre cadastrado em <strong>Configurações &gt; Bimestres</strong>.</span>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
