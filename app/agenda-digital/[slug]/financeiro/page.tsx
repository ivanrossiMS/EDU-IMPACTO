'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  RefreshCw, Filter, CreditCard, Check, AlertCircle, Info, 
  ChevronDown, ChevronUp, Search, Download, Copy, QrCode, 
  ArrowRight, X, TrendingDown, DollarSign, Calendar
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

const MOCK_DATA = [
  { id: '1', vencimento: '05/02/2026', fatura: 'Mensalidade', parcela: '1/11', competencia: 'Fev. 2026', aluno: 'Pedro B. Mello Henn', produto: 'Mensalidade - Ensino Médio', valor: 1290.50, situacao: 'Pago' },
  { id: '2', vencimento: '05/03/2026', fatura: 'Mensalidade', parcela: '2/11', competencia: 'Mar. 2026', aluno: 'Pedro B. Mello Henn', produto: 'Mensalidade - Ensino Médio', valor: 1290.50, situacao: 'Pago' },
  { id: '3', vencimento: '06/04/2026', fatura: 'Mensalidade', parcela: '3/11', competencia: 'Abr. 2026', aluno: 'Pedro B. Mello Henn', produto: 'Mensalidade - Ensino Médio', valor: 1290.50, situacao: 'Pago' },
  { id: '4', vencimento: '05/05/2026', fatura: 'Mensalidade', parcela: '4/11', competencia: 'Mai. 2026', aluno: 'Pedro B. Mello Henn', produto: 'Mensalidade - Ensino Médio', valor: 1290.50, situacao: 'Atrasado' },
  { id: '5', vencimento: '05/06/2026', fatura: 'Mensalidade', parcela: '5/11', competencia: 'Jun. 2026', aluno: 'Pedro B. Mello Henn', produto: 'Mensalidade - Ensino Médio', valor: 1290.50, situacao: 'A vencer' },
  { id: '6', vencimento: '06/07/2026', fatura: 'Mensalidade', parcela: '6/11', competencia: 'Jul. 2026', aluno: 'Pedro B. Mello Henn', produto: 'Mensalidade - Ensino Médio', valor: 1290.50, situacao: 'A vencer' },
  { id: '7', vencimento: '05/08/2026', fatura: 'Mensalidade', parcela: '7/11', competencia: 'Ago. 2026', aluno: 'Pedro B. Mello Henn', produto: 'Mensalidade - Ensino Médio', valor: 1290.50, situacao: 'A vencer' },
  { id: '8', vencimento: '08/09/2026', fatura: 'Mensalidade', parcela: '8/11', competencia: 'Set. 2026', aluno: 'Pedro B. Mello Henn', produto: 'Mensalidade - Ensino Médio', valor: 1290.50, situacao: 'A vencer' },
]

export default function ADFinanceiroPageMock() {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [payHover, setPayHover] = useState(false)

  // Auto-selecionar os vencidos e o próximo a vencer
  useEffect(() => {
    const toPay = MOCK_DATA.filter(i => i.situacao === 'Atrasado' || i.id === '5').map(i => i.id)
    setSelectedIds(toPay)
  }, [])

  const handleSelectAll = () => {
    const selectable = MOCK_DATA.filter(item => item.situacao !== 'Pago').map(item => item.id)
    if (selectedIds.length === selectable.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(selectable)
    }
  }

  const handleSelectRow = (id: string, isSelectable: boolean, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isSelectable) return
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id))
    } else {
      setSelectedIds([...selectedIds, id])
    }
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  const totalToPay = MOCK_DATA.filter(item => selectedIds.includes(item.id)).reduce((acc, curr) => acc + curr.valor, 0)
  const totalAtrasado = MOCK_DATA.filter(item => item.situacao === 'Atrasado').reduce((acc, curr) => acc + curr.valor, 0)

  // Animations
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.05, duration: 0.4 }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 15, scale: 0.98 },
    visible: { 
      opacity: 1, y: 0, scale: 1,
      transition: { type: 'spring' as const, stiffness: 300, damping: 24 }
    }
  } as const

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 160, fontFamily: 'Outfit, Inter, sans-serif' }}>
      {/* Smart Dashboard Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ 
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
          borderRadius: 24, padding: '28px 32px', color: 'white', marginBottom: 24,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.4)',
          position: 'relative', overflow: 'hidden'
        }}
      >
        <div style={{ position: 'absolute', right: '-10%', top: '-50%', width: 300, height: 300, background: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)', filter: 'blur(30px)' }} />
        
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.1)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <DollarSign size={20} color="#818cf8" />
            </div>
            Central Financeira
          </h2>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 6, fontWeight: 500 }}>
            Acompanhe a saúde financeira, gere boletos e copie o Pix para pagamento.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, textAlign: 'right' }}>
          {totalAtrasado > 0 && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '12px 20px', borderRadius: 16, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <div style={{ fontSize: 11, color: '#fca5a5', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 1, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                <AlertCircle size={12} /> Atrasado
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#fecaca' }}>{formatCurrency(totalAtrasado)}</div>
            </div>
          )}
          <div style={{ padding: '12px 20px', borderRadius: 16, background: 'rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 1, marginBottom: 4 }}>Próximo Vencimento</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={16} color="#818cf8" /> 05 Jun
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Table Card */}
      <div style={{ 
        background: 'hsl(var(--bg-surface))', borderRadius: 24, 
        border: '1px solid hsl(var(--border-subtle))', boxShadow: '0 8px 30px rgba(0,0,0,0.02)',
        overflow: 'hidden'
      }}>
        
        {/* Toolbar */}
        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-main))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#eef2ff', color: '#4f46e5', padding: '6px 12px', borderRadius: 12, fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #c7d2fe' }}>
              Contrato #02F7AF <X size={12} style={{ cursor: 'pointer', opacity: 0.6 }} />
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handleRefresh} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: '#64748b', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              <motion.div animate={{ rotate: isRefreshing ? 360 : 0 }} transition={{ duration: 1, ease: "linear", repeat: isRefreshing ? Infinity : 0 }}><RefreshCw size={14} /></motion.div> Atualizar
            </button>
            <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #e2e8f0', color: '#334155', padding: '6px 14px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <Filter size={14} /> Filtros
            </button>
          </div>
        </div>

        {/* Compact & Ultra Modern Table */}
        <div style={{ overflowX: 'auto' }}>
          <motion.div variants={containerVariants} initial="hidden" animate="visible" style={{ minWidth: 800 }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '40px 100px 120px 110px 1fr 120px 100px 40px', gap: 12, padding: '12px 20px', fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid hsl(var(--border-subtle))' }}>
              <div onClick={handleSelectAll} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 18, height: 18, borderRadius: 6, border: `2px solid ${selectedIds.length > 0 ? '#4f46e5' : '#cbd5e1'}`, background: selectedIds.length > 0 ? '#4f46e5' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                  {selectedIds.length > 0 && <Check size={12} color="white" strokeWidth={3} />}
                </div>
              </div>
              <div>Vencimento</div>
              <div>Fatura</div>
              <div>Competência</div>
              <div>Aluno / Produto</div>
              <div style={{ textAlign: 'right' }}>Valor</div>
              <div style={{ textAlign: 'center' }}>Status</div>
              <div></div>
            </div>

            {/* Rows */}
            {MOCK_DATA.map((item, index) => {
              const isSelected = selectedIds.includes(item.id)
              const isPago = item.situacao === 'Pago'
              const isAtrasado = item.situacao === 'Atrasado'
              const isSelectable = !isPago
              const isExpanded = expandedId === item.id

              return (
                <motion.div 
                  layout
                  key={item.id} variants={itemVariants}
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  style={{ 
                    borderBottom: '1px solid rgba(0,0,0,0.03)',
                    background: isSelected ? 'rgba(99, 102, 241, 0.04)' : (isExpanded ? '#f8fafc' : 'transparent'),
                    cursor: 'pointer', transition: 'background 0.2s'
                  }}
                  whileHover={{ background: isSelected ? 'rgba(99, 102, 241, 0.06)' : '#f8fafc' }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '40px 100px 120px 110px 1fr 120px 100px 40px', gap: 12, padding: '14px 20px', alignItems: 'center' }}>
                    
                    {/* Checkbox */}
                    <div onClick={(e) => handleSelectRow(item.id, isSelectable, e)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isSelectable ? (
                        <div style={{ width: 18, height: 18, borderRadius: 6, border: `2px solid ${isSelected ? '#4f46e5' : '#cbd5e1'}`, background: isSelected ? '#4f46e5' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', boxShadow: isSelected ? '0 2px 8px rgba(79, 70, 229, 0.3)' : 'none' }}>
                          {isSelected && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><Check size={12} color="white" strokeWidth={3} /></motion.div>}
                        </div>
                      ) : (
                        <div style={{ width: 18, height: 18, borderRadius: 6, background: '#f1f5f9', border: '2px solid #e2e8f0', opacity: 0.5 }} />
                      )}
                    </div>

                    {/* Vencimento */}
                    <div style={{ fontSize: 13, fontWeight: 700, color: isAtrasado ? '#ef4444' : 'hsl(var(--text-main))' }}>
                      {item.vencimento}
                    </div>

                    {/* Fatura */}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'hsl(var(--text-main))' }}>{item.fatura}</div>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Parc. {item.parcela}</div>
                    </div>

                    {/* Competencia */}
                    <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>{item.competencia}</div>

                    {/* Aluno/Produto */}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-main))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.aluno}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.produto}</div>
                    </div>

                    {/* Valor */}
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'hsl(var(--text-main))', textAlign: 'right' }}>
                      {formatCurrency(item.valor)}
                    </div>

                    {/* Status */}
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ 
                        padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase',
                        background: isPago ? '#dcfce7' : isAtrasado ? '#fee2e2' : '#e0f2fe',
                        color: isPago ? '#166534' : isAtrasado ? '#991b1b' : '#0369a1',
                      }}>
                        {item.situacao}
                      </span>
                    </div>

                    {/* Expand Icon */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', color: '#94a3b8' }}>
                      <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}><ChevronDown size={16} /></motion.div>
                    </div>

                  </div>

                  {/* Expanded Actions */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{ padding: '0 20px 20px 64px', display: 'flex', gap: 12 }}>
                          {!isPago && (
                            <>
                              <button onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#10b981', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 12, fontSize: 12, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}>
                                <QrCode size={14} /> Pagar com Pix
                              </button>
                              <button onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', color: '#334155', border: '1px solid #e2e8f0', padding: '8px 16px', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                <Copy size={14} /> Copiar Código
                              </button>
                            </>
                          )}
                          <button onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', color: '#334155', border: '1px solid #e2e8f0', padding: '8px 16px', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                            <Download size={14} /> {isPago ? 'Baixar Recibo' : 'Baixar Boleto'}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </motion.div>
              )
            })}
          </motion.div>
        </div>

      </div>

      {/* Floating Sticky Footer for Payment Action */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{ 
              position: 'fixed', left: 0, right: 0, margin: '0 auto', maxWidth: 800,
              background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
              borderRadius: 24, padding: '16px 24px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              boxShadow: '0 20px 40px rgba(0,0,0,0.1), 0 0 0 1px rgba(255,255,255,0.5) inset',
              border: '1px solid rgba(0,0,0,0.05)',
              zIndex: 100
            }}
            className="ad-fin-sticky-footer"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
                <Check size={24} strokeWidth={3} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Faturas Selecionadas ({selectedIds.length})</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1 }}>{formatCurrency(totalToPay)}</div>
              </div>
            </div>

            <motion.button 
              whileTap={{ scale: 0.95 }}
              onMouseEnter={() => setPayHover(true)}
              onMouseLeave={() => setPayHover(false)}
              style={{ 
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                color: 'white', border: 'none', borderRadius: 20,
                padding: '16px 40px', fontSize: 16, fontWeight: 800,
                cursor: 'pointer',
                boxShadow: payHover ? '0 12px 24px rgba(79, 70, 229, 0.4)' : '0 8px 16px rgba(79, 70, 229, 0.25)',
                transition: 'all 0.3s'
              }}
            >
              <CreditCard size={20} />
              Pagar Faturas
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Decor */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '40vh', background: 'linear-gradient(180deg, rgba(248,250,252,1) 0%, rgba(248,250,252,0) 100%)', zIndex: -2 }} />

    </div>
  )
}
