'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Search,
  FileSpreadsheet,
  Printer,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Edit3,
  MessageCircle,
  RotateCcw,
  UserCheck,
  Calendar,
  Users
} from 'lucide-react'

function formatBRL(val: number): string {
  return Number(val || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

interface CobrancaDetailsModalProps {
  selectedGroup: any | null
  onClose: () => void
  onEditGroup: (group: any) => void
  onSyncRecipients: (cobrancaId: string) => Promise<void>
  onToggleManualPaid: (dest: any) => Promise<void>
  onOpenPaymentLink: (dest: any) => Promise<void>
  onCopyPaymentLink: (dest: any) => Promise<void>
  onWhatsAppReminder: (dest: any, cobranca: any) => Promise<void>
  onExportModalXlsx: (groupId: string, respectFilter: boolean, filteredList?: any[]) => void
  generatingLinkIds: Record<string, boolean>
  togglingStatusIds: Record<string, boolean>
  copiedLinkId: string | null
  syncingGroupId: string | null
  resolveStudentInfo: (dest: any) => {
    nome: string
    turma: string
    matricula: string
    responsavel: string
    telefone: string
  }
}

export function CobrancaDetailsModal({
  selectedGroup,
  onClose,
  onEditGroup,
  onSyncRecipients,
  onToggleManualPaid,
  onOpenPaymentLink,
  onCopyPaymentLink,
  onWhatsAppReminder,
  onExportModalXlsx,
  generatingLinkIds,
  togglingStatusIds,
  copiedLinkId,
  syncingGroupId,
  resolveStudentInfo
}: CobrancaDetailsModalProps) {
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL')
  const [filterTurma, setFilterTurma] = useState<string>('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    if (selectedGroup?.id) {
      setFilterStatus('ALL')
      setFilterTurma('ALL')
      setSearchTerm('')
      setPage(1)
    }
  }, [selectedGroup?.id])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedGroup) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedGroup, onClose])

  const allDestinatarios = selectedGroup?.destinatarios || []

  const availableTurmas = useMemo(() => {
    const set = new Set<string>()
    allDestinatarios.forEach((d: any) => {
      const info = resolveStudentInfo(d)
      if (info.turma && info.turma !== '--') set.add(info.turma)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [allDestinatarios, resolveStudentInfo])

  const filteredList = useMemo(() => {
    return allDestinatarios.filter((d: any) => {
      const isPaid = d.status === 'CONFIRMED' || d.status === 'RECEIVED'
      if (filterStatus === 'PAID' && !isPaid) return false
      if (filterStatus === 'PENDING' && isPaid) return false

      const info = resolveStudentInfo(d)
      if (filterTurma !== 'ALL' && info.turma !== filterTurma) return false

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim()
        const hay = `${info.nome} ${info.turma} ${info.matricula} ${info.responsavel} ${d.pagador_usuario_nome || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [allDestinatarios, filterStatus, filterTurma, searchTerm, resolveStudentInfo])

  if (typeof window === 'undefined' || !selectedGroup) return null

  const m = selectedGroup.metrics
  const vencStr = selectedGroup.cobranca?.vencimento
    ? new Date(selectedGroup.cobranca.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
    : '--'

  const totalPages = Math.max(1, Math.ceil(filteredList.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const startIdx = (safePage - 1) * pageSize
  const paginatedList = filteredList.slice(startIdx, startIdx + pageSize)
  const isSyncing = syncingGroupId === selectedGroup.id

  return createPortal(
    <AnimatePresence>
      <motion.div
        id="print-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.68)',
          backdropFilter: 'blur(8px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}
      >
        <style>{`
          @media print {
            body, html { height: auto !important; overflow: visible !important; }
            body * { visibility: hidden !important; }
            #print-overlay, #print-overlay * { visibility: visible !important; }
            #print-overlay {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              display: block !important;
              padding: 0 !important;
              background: none !important;
              backdrop-filter: none !important;
            }
            #print-modal {
              position: static !important;
              width: 100% !important;
              max-width: none !important;
              max-height: none !important;
              height: auto !important;
              overflow: visible !important;
              box-shadow: none !important;
              transform: none !important;
              padding: 0 !important;
              margin: 0 !important;
              background: white !important;
              display: block !important;
            }
            #print-modal-scroll {
              overflow: visible !important;
              max-height: none !important;
              height: auto !important;
              display: block !important;
            }
            .no-print, .no-print * { display: none !important; }
            table { page-break-inside: auto !important; width: 100% !important; }
            tr { page-break-inside: avoid !important; page-break-after: auto !important; }
            td, th { page-break-inside: avoid !important; }
          }
        `}</style>

        <motion.div
          id="print-modal"
          onClick={e => e.stopPropagation()}
          initial={{ y: 28, scale: 0.96, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 18, scale: 0.96, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          style={{
            width: '100%',
            maxWidth: 1140,
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            backgroundColor: '#ffffff',
            borderRadius: 24,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            color: '#0f172a'
          }}
        >
          {/* Header */}
          <div className="ad-modal-header" style={{ padding: '22px 28px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: 21, fontWeight: 800, color: '#0f172a', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
                    {selectedGroup.cobranca?.titulo || 'Detalhes da Cobrança'}
                  </h3>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 800,
                      padding: '3px 10px',
                      borderRadius: 12,
                      background: '#eef2ff',
                      color: '#4338ca'
                    }}
                  >
                    Unitário: R$ {formatBRL(m.valorUnitario)}
                  </span>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: 12,
                      background: m.isOverdue ? '#fef2f2' : '#f1f5f9',
                      color: m.isOverdue ? '#dc2626' : '#475569'
                    }}
                  >
                    Vencimento: {vencStr}
                  </span>
                </div>
                {selectedGroup.comunicadoInfo && (
                  <p style={{ color: '#64748b', fontSize: 12.5, fontWeight: 600, margin: '6px 0 0 0' }}>
                    Comunicado: <strong>{selectedGroup.comunicadoInfo.titulo}</strong> • Enviado por {selectedGroup.comunicadoInfo.autor}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }} className="no-print">
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={() => onSyncRecipients(selectedGroup.id)}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    height: 36,
                    padding: '0 12px',
                    borderRadius: 10,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: isSyncing ? 'wait' : 'pointer',
                    color: '#334155',
                    fontSize: 12,
                    fontWeight: 800
                  }}
                  title="Sincronizar alunos destinatários do comunicado"
                >
                  <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                  Sincronizar Alunos
                </button>

                <button
                  type="button"
                  onClick={() => onEditGroup(selectedGroup)}
                  style={{
                    background: '#eef2ff',
                    border: '1px solid #c7d2fe',
                    height: 36,
                    padding: '0 12px',
                    borderRadius: 10,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    color: '#4338ca',
                    fontSize: 12,
                    fontWeight: 800
                  }}
                  title="Editar título, valor ou vencimento"
                >
                  <Edit3 size={14} /> Editar
                </button>

                <button
                  type="button"
                  onClick={() => onExportModalXlsx(selectedGroup.id, true, filteredList)}
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none',
                    height: 36,
                    padding: '0 14px',
                    borderRadius: 10,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    color: '#ffffff',
                    fontSize: 12.5,
                    fontWeight: 800,
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
                  }}
                  title="Exportar planilha Excel (.xlsx)"
                >
                  <FileSpreadsheet size={15} /> Exportar XLSX
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#2563eb'
                  }}
                  title="Imprimir relatório"
                >
                  <Printer size={16} />
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: '#f1f5f9',
                    border: 'none',
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#475569'
                  }}
                  title="Fechar"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            <div
              className="ad-modal-kpi-grid"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 16 }}
            >
              <div
                style={{
                  padding: '14px 16px',
                  background: 'rgba(59, 130, 246, 0.06)',
                  borderRadius: 14,
                  border: '1px solid rgba(59, 130, 246, 0.16)'
                }}
              >
                <div style={{ fontSize: 11.5, color: '#2563eb', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>
                  Valor Total ({m.totalEnviados} destinatários)
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#1e3a8a', fontFamily: 'Outfit, sans-serif' }}>
                  R$ {formatBRL(m.valorTotal)}
                </div>
              </div>

              <div
                style={{
                  padding: '14px 16px',
                  background: 'rgba(16, 185, 129, 0.06)',
                  borderRadius: 14,
                  border: '1px solid rgba(16, 185, 129, 0.18)'
                }}
              >
                <div style={{ fontSize: 11.5, color: '#059669', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>
                  Recebido ({m.totalPagos} pagos • {m.percentualPagoFormatted})
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#065f46', fontFamily: 'Outfit, sans-serif' }}>
                  R$ {formatBRL(m.valorPago)}
                </div>
              </div>

              <div
                style={{
                  padding: '14px 16px',
                  background: 'rgba(239, 68, 68, 0.06)',
                  borderRadius: 14,
                  border: '1px solid rgba(239, 68, 68, 0.16)'
                }}
              >
                <div style={{ fontSize: 11.5, color: '#dc2626', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>
                  Em Aberto ({m.totalAguardando} pendentes)
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#7f1d1d', fontFamily: 'Outfit, sans-serif' }}>
                  R$ {formatBRL(m.valorAberto)}
                </div>
              </div>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div
            className="no-print ad-modal-toolbar"
            style={{
              padding: '12px 28px',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 4, background: '#e2e8f0', padding: 3, borderRadius: 18 }}>
                {[
                  { id: 'ALL', label: `Todos (${m.totalEnviados})`, activeBg: '#ffffff', activeColor: '#0f172a' },
                  { id: 'PAID', label: `Pagos (${m.totalPagos})`, activeBg: '#10b981', activeColor: '#ffffff' },
                  { id: 'PENDING', label: `Aguardando (${m.totalAguardando})`, activeBg: '#ef4444', activeColor: '#ffffff' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    style={{
                      padding: '5px 12px',
                      borderRadius: 14,
                      fontSize: 12,
                      fontWeight: 800,
                      border: 'none',
                      cursor: 'pointer',
                      background: filterStatus === tab.id ? tab.activeBg : 'transparent',
                      color: filterStatus === tab.id ? tab.activeColor : '#475569'
                    }}
                    onClick={() => {
                      setFilterStatus(tab.id as any)
                      setPage(1)
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {availableTurmas.length > 0 && (
                <select
                  aria-label="Filtrar por turma"
                  value={filterTurma}
                  onChange={e => {
                    setFilterTurma(e.target.value)
                    setPage(1)
                  }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#334155',
                    cursor: 'pointer'
                  }}
                >
                  <option value="ALL">Todas as Turmas ({availableTurmas.length})</option>
                  {availableTurmas.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 280px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 320 }}>
                <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Buscar aluno, turma ou responsável..."
                  value={searchTerm}
                  onChange={e => {
                    setSearchTerm(e.target.value)
                    setPage(1)
                  }}
                  style={{
                    width: '100%',
                    padding: '7px 12px 7px 32px',
                    borderRadius: 16,
                    border: '1px solid #cbd5e1',
                    outline: 'none',
                    fontSize: 12.5,
                    color: '#0f172a',
                    background: '#ffffff',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <select
                aria-label="Itens por página"
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#334155',
                  cursor: 'pointer'
                }}
              >
                <option value={10}>10 / pág</option>
                <option value={30}>30 / pág</option>
                <option value={50}>50 / pág</option>
                <option value={100}>100 / pág</option>
              </select>
            </div>
          </div>

          {/* Table Body */}
          <div id="print-modal-scroll" className="ad-modal-body" style={{ flex: 1, overflowY: 'auto', padding: '0 28px 20px' }}>
            {allDestinatarios.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
                <Users size={36} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
                  Nenhum destinatário vinculado a esta cobrança ainda
                </div>
                <p style={{ fontSize: 13, margin: '0 auto 14px', maxWidth: 420 }}>
                  Clique em &quot;Sincronizar Alunos&quot; para vincular automaticamente todos os alunos destinatários do comunicado.
                </p>
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={() => onSyncRecipients(selectedGroup.id)}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 10,
                    border: 'none',
                    background: '#4f46e5',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                  Sincronizar Alunos Agora
                </button>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                    <th style={{ padding: '11px 8px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#64748b' }}>
                      ALUNO / TURMA
                    </th>
                    <th style={{ padding: '11px 8px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#64748b' }}>
                      PAGADOR / CONFIRMAÇÃO
                    </th>
                    <th style={{ padding: '11px 8px', textAlign: 'right', fontSize: 11, fontWeight: 800, color: '#64748b' }}>
                      VALOR
                    </th>
                    <th style={{ padding: '11px 8px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#64748b' }}>
                      DATAS
                    </th>
                    <th style={{ padding: '11px 8px', textAlign: 'center', fontSize: 11, fontWeight: 800, color: '#64748b' }}>
                      STATUS DO PAGAMENTO
                    </th>
                    <th
                      className="no-print"
                      style={{ padding: '11px 8px', textAlign: 'right', fontSize: 11, fontWeight: 800, color: '#64748b' }}
                    >
                      AÇÕES & LINKS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedList.map((d: any) => {
                    const isPaid = d.status === 'CONFIRMED' || d.status === 'RECEIVED'
                    const info = resolveStudentInfo(d)
                    const enviadoDate = d.created_at ? new Date(d.created_at).toLocaleDateString('pt-BR') : '--'
                    const payDate = isPaid && (d.updated_at || d.created_at)
                      ? new Date(d.updated_at || d.created_at).toLocaleDateString('pt-BR')
                      : null
                    const isGenerating = Boolean(generatingLinkIds[d.id])
                    const isToggling = Boolean(togglingStatusIds[d.id])
                    const isCopied = copiedLinkId === d.id

                    return (
                      <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 8px' }}>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 13.5 }}>{info.nome}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                            {info.turma && info.turma !== '--' && (
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 800,
                                  color: '#2563eb',
                                  background: '#eff6ff',
                                  padding: '1px 7px',
                                  borderRadius: 6
                                }}
                              >
                                {info.turma}
                              </span>
                            )}
                            {info.responsavel && (
                              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                                Resp: {info.responsavel}
                              </span>
                            )}
                          </div>
                        </td>

                        <td style={{ padding: '12px 8px', fontSize: 13, color: '#475569', fontWeight: 600 }}>
                          {d.pagador_usuario_nome ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <CheckCircle2 size={13} color="#10b981" />
                              <span>{d.pagador_usuario_nome}</span>
                            </div>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>--</span>
                          )}
                        </td>

                        <td style={{ padding: '12px 8px', fontSize: 13.5, fontWeight: 800, color: '#0f172a', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          R$ {formatBRL(m.valorUnitario)}
                        </td>

                        <td style={{ padding: '12px 8px', fontSize: 12, color: '#64748b' }}>
                          <div>Envio: {enviadoDate}</div>
                          {payDate && (
                            <div style={{ color: '#059669', fontWeight: 700 }}>Pgto: {payDate}</div>
                          )}
                        </td>

                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <span
                            style={{
                              padding: '4px 11px',
                              background: isPaid ? '#dcfce7' : m.isOverdue ? '#fee2e2' : '#fef3c7',
                              color: isPaid ? '#15803d' : m.isOverdue ? '#b91c1c' : '#b45309',
                              borderRadius: 20,
                              fontSize: 11.5,
                              fontWeight: 800,
                              display: 'inline-block'
                            }}
                          >
                            {isPaid ? 'Pago' : m.isOverdue ? 'Vencido' : 'Aguardando'}
                          </span>
                        </td>

                        <td className="no-print" style={{ padding: '12px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                            {/* Baixa Manual / Reabrir */}
                            <button
                              type="button"
                              disabled={isToggling}
                              onClick={() => onToggleManualPaid(d)}
                              style={{
                                padding: '5px 10px',
                                borderRadius: 8,
                                border: isPaid ? '1px solid #cbd5e1' : '1px solid #86efac',
                                background: isPaid ? '#f8fafc' : '#f0fdf4',
                                color: isPaid ? '#475569' : '#15803d',
                                fontSize: 11.5,
                                fontWeight: 800,
                                cursor: isToggling ? 'wait' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                              title={isPaid ? 'Reverter pagamento para Pendente' : 'Confirmar recebimento manual (Secretaria/PIX)'}
                            >
                              {isPaid ? <RotateCcw size={12} /> : <UserCheck size={12} />}
                              {isPaid ? 'Reabrir' : 'Dar Baixa'}
                            </button>

                            {!isPaid && (
                              <>
                                {/* WhatsApp Reminder */}
                                <button
                                  type="button"
                                  disabled={isGenerating}
                                  onClick={() => onWhatsAppReminder(d, selectedGroup.cobranca)}
                                  style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 8,
                                    border: '1px solid #86efac',
                                    background: '#dcfce7',
                                    color: '#15803d',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                  }}
                                  title="Enviar cobrança com link via WhatsApp"
                                >
                                  <MessageCircle size={14} />
                                </button>

                                {/* Abrir Link Mercado Pago */}
                                <button
                                  type="button"
                                  disabled={isGenerating}
                                  onClick={() => onOpenPaymentLink(d)}
                                  style={{
                                    padding: '5px 10px',
                                    borderRadius: 8,
                                    border: '1px solid #bfdbfe',
                                    background: '#eff6ff',
                                    color: '#1d4ed8',
                                    fontSize: 11.5,
                                    fontWeight: 800,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    cursor: isGenerating ? 'wait' : 'pointer'
                                  }}
                                  title="Abrir link de pagamento Mercado Pago"
                                >
                                  <ExternalLink size={12} />
                                  {isGenerating ? 'Gerando...' : 'Fatura'}
                                </button>

                                {/* Copiar Link */}
                                <button
                                  type="button"
                                  disabled={isGenerating}
                                  onClick={() => onCopyPaymentLink(d)}
                                  style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 8,
                                    border: isCopied ? '1px solid #86efac' : '1px solid #cbd5e1',
                                    background: isCopied ? '#dcfce7' : '#ffffff',
                                    color: isCopied ? '#15803d' : '#475569',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                  }}
                                  title="Copiar link de pagamento"
                                >
                                  {isCopied ? <Check size={13} /> : <Copy size={13} />}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Modal Pagination */}
          {filteredList.length > pageSize && (
            <div
              className="no-print"
              style={{
                padding: '12px 28px',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap'
              }}
            >
              <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 600 }}>
                Exibindo {startIdx + 1} a {Math.min(startIdx + pageSize, filteredList.length)} de {filteredList.length} destinatários
              </span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
                    opacity: safePage <= 1 ? 0.4 : 1
                  }}
                >
                  Anterior
                </button>
                <span style={{ padding: '5px 10px', fontSize: 12.5, fontWeight: 800, color: '#0f172a' }}>
                  Página {safePage} de {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
                    opacity: safePage >= totalPages ? 0.4 : 1
                  }}
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
