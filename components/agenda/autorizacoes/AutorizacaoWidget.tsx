'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FileCheck2, Check, Lock, Unlock, Clock, Users, RefreshCw, 
  AlertCircle, CheckCircle2, XCircle, X, Shield, Sparkles, 
  MapPin, Calendar, DollarSign, HeartPulse, ShieldCheck, 
  Printer, Search, ChevronRight, Loader2, Filter
} from 'lucide-react'
import { AutorizacaoData, AutorizacaoResposta } from '@/lib/autorizacoes/types'
import { 
  calculateAutorizacaoStats, 
  getUserAutorizacaoResposta, 
  getAutorizacaoVoterKey, 
  isAutorizacaoClosed, 
  formatTimeRemaining,
  formatDateTimeBR,
  validarCPF,
  formatarCPF
} from '@/lib/autorizacoes/autorizacaoUtils'
import { supabase } from '@/lib/supabase'

interface AutorizacaoWidgetProps {
  autorizacao: AutorizacaoData
  comunicadoId: string
  currentUser?: any
  currentAluno?: any
  isAdminMode?: boolean
  onUpdateSuccess?: (updatedAutorizacao: AutorizacaoData) => void
}

export function AutorizacaoWidget({
  autorizacao: initialAutorizacao,
  comunicadoId,
  currentUser,
  currentAluno,
  isAdminMode = false,
  onUpdateSuccess
}: AutorizacaoWidgetProps) {
  const [autorizacao, setAutorizacao] = useState<AutorizacaoData>(initialAutorizacao)
  const [selectedOpcaoId, setSelectedOpcaoId] = useState<string>('')
  const [observacoes, setObservacoes] = useState<string>('')
  const [cpfResponsavel, setCpfResponsavel] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isChangingResposta, setIsChangingResposta] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'aprova' | 'recusa' | 'obs'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  // Sync prop changes
  useEffect(() => {
    if (initialAutorizacao) {
      setAutorizacao(initialAutorizacao)
    }
  }, [initialAutorizacao])

  const stats = useMemo(() => calculateAutorizacaoStats(autorizacao), [autorizacao])
  const isClosed = useMemo(() => isAutorizacaoClosed(autorizacao), [autorizacao])
  const timeRemaining = useMemo(() => formatTimeRemaining(autorizacao.dataLimite), [autorizacao.dataLimite])

  const currentUserId = currentUser?.id || currentUser?.uid || ''
  const currentAlunoId = currentAluno?.id || null
  const currentAlunoNome = currentAluno?.nome || null
  const currentAlunoTurma = currentAluno?.turma || currentAluno?.turma_nome || null

  const userResposta: AutorizacaoResposta | null = useMemo(() => {
    return getUserAutorizacaoResposta(autorizacao, currentUserId, currentAlunoId)
  }, [autorizacao, currentUserId, currentAlunoId])

  const hasResponded = !!userResposta

  const isCpfRequired = !!(autorizacao.exigirCpfResponsavel ?? autorizacao.exigirDocumentoResponsavel)
  const isCpfValid = useMemo(() => validarCPF(cpfResponsavel), [cpfResponsavel])
  const canSubmit = !isClosed && !!selectedOpcaoId && (!isCpfRequired || isCpfValid)

  // Sync user's previous answer into input fields
  useEffect(() => {
    if (userResposta) {
      setSelectedOpcaoId(userResposta.opcaoId)
      setObservacoes(userResposta.observacoes || '')
      const prevCpf = userResposta.cpfResponsavel || userResposta.documentoResponsavel || ''
      setCpfResponsavel(formatarCPF(prevCpf))
    } else {
      setSelectedOpcaoId('')
      setObservacoes('')
      setCpfResponsavel('')
    }
  }, [userResposta])

  // ==========================================
  // REALTIME SYNCHRONIZATION VIA SUPABASE
  // ==========================================
  useEffect(() => {
    if (!autorizacao?.id) return

    const channelName = `autorizacao_live_${autorizacao.id}`
    const channel = supabase.channel(channelName)

    channel
      .on('broadcast', { event: 'resposta_update' }, (payload: any) => {
        if (payload?.payload?.autorizacao) {
          setAutorizacao(payload.payload.autorizacao)
          if (onUpdateSuccess) onUpdateSuccess(payload.payload.autorizacao)
        }
      })
      .on('broadcast', { event: 'status_update' }, (payload: any) => {
        if (payload?.payload?.autorizacao) {
          setAutorizacao(payload.payload.autorizacao)
          if (onUpdateSuccess) onUpdateSuccess(payload.payload.autorizacao)
        }
      })
      .subscribe()

    const handleComunicadosUpdate = (event: any) => {
      const item = event?.detail?.item
      if (item && String(item.id) === String(comunicadoId)) {
        const remoteAut = item.autorizacao || item.dados?.autorizacao
        if (remoteAut) {
          setAutorizacao(remoteAut)
        }
      }
    }
    window.addEventListener('ad:comunicados-update', handleComunicadosUpdate)

    // Polling heartbeat every 12 seconds
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('comunicados')
          .select('dados')
          .eq('id', comunicadoId)
          .maybeSingle()

        const remoteAut = (data as any)?.dados?.autorizacao
        if (remoteAut) {
          setAutorizacao(remoteAut)
        }
      } catch (_) {}
    }, 12000)

    return () => {
      try { supabase.removeChannel(channel) } catch (_) {}
      window.removeEventListener('ad:comunicados-update', handleComunicadosUpdate)
      clearInterval(interval)
    }
  }, [autorizacao.id, comunicadoId, onUpdateSuccess])

  const broadcastUpdate = useCallback(async (updated: AutorizacaoData, eventName = 'resposta_update') => {
    try {
      const channel = supabase.channel(`autorizacao_live_${updated.id}`)
      await channel.send({
        type: 'broadcast',
        event: eventName,
        payload: { autorizacao: updated, comunicadoId }
      })
    } catch (_) {}
  }, [comunicadoId])

  // Handle Response Submission (Sign)
  const handleSubmitResposta = async () => {
    if (!selectedOpcaoId) {
      setFeedbackMessage({ type: 'error', text: 'Por favor, selecione uma opção de autorização.' })
      return
    }

    if (isCpfRequired) {
      if (!cpfResponsavel.trim()) {
        setFeedbackMessage({ type: 'error', text: 'Por favor, informe seu CPF para confirmação da assinatura digital.' })
        return
      }
      if (!validarCPF(cpfResponsavel)) {
        setFeedbackMessage({ type: 'error', text: 'O CPF informado é inválido. Verifique os 11 dígitos e o cálculo verificador.' })
        return
      }
    }

    setIsSubmitting(true)
    setFeedbackMessage(null)

    try {
      const payload = {
        comunicadoId,
        autorizacaoId: autorizacao.id,
        opcaoId: selectedOpcaoId,
        usuarioId: currentUserId,
        usuarioNome: currentUser?.nome || 'Responsável',
        usuarioFoto: currentUser?.foto || null,
        usuarioTipo: currentUser?.perfil === 'Família' || currentUser?.perfil === 'Responsável' ? 'responsavel' : 'responsavel',
        alunoId: currentAlunoId,
        alunoNome: currentAlunoNome,
        alunoTurma: currentAlunoTurma,
        observacoes: observacoes.trim() || undefined,
        cpfResponsavel: cpfResponsavel.trim() ? formatarCPF(cpfResponsavel) : undefined,
        documentoResponsavel: cpfResponsavel.trim() ? formatarCPF(cpfResponsavel) : undefined
      }

      const res = await fetch('/api/agenda/autorizacoes/responder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao registrar autorização')
      }

      if (data.autorizacao) {
        setAutorizacao(data.autorizacao)
        setIsChangingResposta(false)
        setFeedbackMessage({ type: 'success', text: 'Autorização assinada e registrada com sucesso!' })
        if (onUpdateSuccess) onUpdateSuccess(data.autorizacao)
        broadcastUpdate(data.autorizacao, 'resposta_update')

        setTimeout(() => setFeedbackMessage(null), 4000)
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Erro ao registrar autorização. Tente novamente.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Toggle Status (Close / Reopen)
  const handleToggleStatus = async () => {
    if (!isAdminMode) return
    setIsUpdatingStatus(true)
    const newStatus = !autorizacao.encerrada

    try {
      const res = await fetch('/api/agenda/autorizacoes/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comunicadoId,
          encerrada: newStatus
        })
      })

      const data = await res.json()
      if (data.ok && data.autorizacao) {
        setAutorizacao(data.autorizacao)
        if (onUpdateSuccess) onUpdateSuccess(data.autorizacao)
        broadcastUpdate(data.autorizacao, 'status_update')
      }
    } catch (err) {
      console.error('Erro ao atualizar status da autorização:', err)
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  // Filtered responses list for Admin Detailed Modal
  const filteredRespostas = useMemo(() => {
    let list = stats.respostasList

    if (selectedFilter === 'aprova') {
      list = list.filter(r => r.tipoDecisao === 'aprova')
    } else if (selectedFilter === 'recusa') {
      list = list.filter(r => r.tipoDecisao === 'recusa')
    } else if (selectedFilter === 'obs') {
      list = list.filter(r => r.observacoes && r.observacoes.trim().length > 0)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(r => 
        (r.alunoNome && r.alunoNome.toLowerCase().includes(q)) ||
        (r.usuarioNome && r.usuarioNome.toLowerCase().includes(q)) ||
        (r.alunoTurma && r.alunoTurma.toLowerCase().includes(q)) ||
        (r.observacoes && r.observacoes.toLowerCase().includes(q))
      )
    }

    return list
  }, [stats.respostasList, selectedFilter, searchQuery])

  // Print summary sheet for excursion bus
  const handlePrintSummary = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Lista de Autorizações - ${autorizacao.titulo}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #1e293b; }
          h1 { font-size: 18px; margin-bottom: 4px; }
          p { margin: 2px 0 12px 0; font-size: 12px; color: #64748b; }
          .metrics { display: flex; gap: 16px; margin-bottom: 20px; }
          .metric-card { border: 1px solid #e2e8f0; padding: 8px 14px; border-radius: 8px; font-size: 12px; }
          .metric-value { font-size: 18px; font-weight: bold; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
          th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
          th { background: #f8fafc; font-weight: bold; }
          .badge-aprova { color: #166534; background: #dcfce7; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
          .badge-recusa { color: #991b1b; background: #fee2e2; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
          .obs-box { background: #fef3c7; border-left: 3px solid #f59e0b; padding: 4px 8px; margin-top: 4px; font-size: 11px; color: #92400e; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Colégio Impacto — Lista de Autorizações</h1>
        <p><strong>Atividade:</strong> ${autorizacao.titulo} ${autorizacao.localEvento ? `| <strong>Local:</strong> ${autorizacao.localEvento}` : ''} ${autorizacao.dataEvento ? `| <strong>Data:</strong> ${autorizacao.dataEvento}` : ''}</p>
        <p>Documento gerado em ${new Date().toLocaleString('pt-BR')} para conferência pedagógica.</p>
        
        <div class="metrics">
          <div class="metric-card">Total Respondidos: <div class="metric-value">${stats.totalRespostas}</div></div>
          <div class="metric-card" style="color: #166534;">Autorizados (Sim): <div class="metric-value">${stats.totalAprovados} (${stats.percentAprovados}%)</div></div>
          <div class="metric-card" style="color: #991b1b;">Não Autorizados: <div class="metric-value">${stats.totalRecusados} (${stats.percentRecusados}%)</div></div>
          <div class="metric-card" style="color: #d97706;">Com Alergias/Obs: <div class="metric-value">${stats.respostasComObservacoes.length}</div></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Aluno</th>
              <th>Turma</th>
              <th>Decisão</th>
              <th>Responsável Assinante</th>
              <th>Data/Hora</th>
              <th>Observações Médicas / Restrições</th>
            </tr>
          </thead>
          <tbody>
            ${stats.respostasList.map((r, i) => `
              <tr>
                <td>${i + 1}</td>
                <td><strong>${r.alunoNome || 'Não informado'}</strong></td>
                <td>${r.alunoTurma || '-'}</td>
                <td>
                  <span class="${r.tipoDecisao === 'aprova' ? 'badge-aprova' : r.tipoDecisao === 'recusa' ? 'badge-recusa' : ''}">
                    ${r.opcaoTexto}
                  </span>
                </td>
                <td>${r.usuarioNome} ${(r.cpfResponsavel || r.documentoResponsavel) ? `<br/><small>CPF: ${r.cpfResponsavel || r.documentoResponsavel}</small>` : ''}</td>
                <td>${formatDateTimeBR(r.respondidoEm)}</td>
                <td>
                  ${r.observacoes ? `<div class="obs-box">⚠️ ${r.observacoes}</div>` : '<span style="color:#94a3b8;">Nenhuma</span>'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `
    printWindow.document.write(htmlContent)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 400)
  }

  const selectedOpcaoObj = (autorizacao.opcoes || []).find(o => o.id === (userResposta?.opcaoId || selectedOpcaoId))

  return (
    <div style={{
      width: '100%',
      background: '#FFFFFF',
      borderRadius: '20px',
      border: '1.5px solid rgba(16, 185, 129, 0.3)',
      boxShadow: '0 8px 30px -4px rgba(16, 185, 129, 0.08), 0 2px 6px rgba(0, 0, 0, 0.02)',
      overflow: 'hidden',
      transition: 'all 0.2s',
      position: 'relative'
    }}>
      {/* GLOW DECORATIVO TOPO */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 4,
        background: 'linear-gradient(90deg, #10B981 0%, #059669 50%, #06B6D4 100%)'
      }} />

      {/* HEADER DO WIDGET */}
      <div style={{
        padding: '18px 20px 14px',
        borderBottom: '1px solid #F1F5F9',
        background: 'linear-gradient(180deg, rgba(240, 253, 244, 0.6) 0%, rgba(255, 255, 255, 0.95) 100%)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            }}>
              <FileCheck2 size={20} strokeWidth={2.4} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  background: hasResponded 
                    ? userResposta?.tipoDecisao === 'aprova' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'
                    : 'rgba(16, 185, 129, 0.12)',
                  color: hasResponded 
                    ? userResposta?.tipoDecisao === 'aprova' ? '#047857' : '#B91C1C'
                    : '#047857',
                  padding: '2px 8px',
                  borderRadius: 999,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  <ShieldCheck size={11} />
                  {hasResponded 
                    ? userResposta?.tipoDecisao === 'aprova' ? 'Autorizado' : 'Não Autorizado'
                    : 'Autorização Requerida'}
                </span>

                {isClosed && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    background: '#F1F5F9',
                    color: '#64748B',
                    padding: '2px 8px',
                    borderRadius: 999,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3
                  }}>
                    <Lock size={10} /> Encerrada
                  </span>
                )}
              </div>

              <h4 style={{
                fontSize: 16,
                fontWeight: 800,
                color: '#0F172A',
                margin: '3px 0 0 0',
                letterSpacing: '-0.02em'
              }}>
                {autorizacao.titulo}
              </h4>
            </div>
          </div>

          {/* PRAZO RESTANTE / ACTIONS */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {timeRemaining && !isClosed && (
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#D97706',
                background: 'rgba(245, 158, 11, 0.1)',
                padding: '4px 10px',
                borderRadius: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5
              }}>
                <Clock size={12} />
                <span>{timeRemaining}</span>
              </div>
            )}

            {isAdminMode && (
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={isUpdatingStatus}
                style={{
                  background: autorizacao.encerrada ? '#F0FDF4' : '#FEF2F2',
                  border: `1px solid ${autorizacao.encerrada ? '#86EFAC' : '#FCA5A5'}`,
                  color: autorizacao.encerrada ? '#15803D' : '#DC2626',
                  borderRadius: 10,
                  padding: '5px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5
                }}
              >
                {autorizacao.encerrada ? <Unlock size={12} /> : <Lock size={12} />}
                <span>{autorizacao.encerrada ? 'Reabrir Autorização' : 'Encerrar Prazo'}</span>
              </button>
            )}
          </div>
        </div>

        {/* PILLS DE EVENTO (LOCAL, DATA, VALOR) */}
        {(autorizacao.localEvento || autorizacao.dataEvento || autorizacao.valor) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {autorizacao.localEvento && (
              <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '3px 10px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <MapPin size={12} color="#059669" /> {autorizacao.localEvento}
              </span>
            )}
            {autorizacao.dataEvento && (
              <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '3px 10px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Calendar size={12} color="#059669" /> {autorizacao.dataEvento}
              </span>
            )}
            {autorizacao.valor && (
              <span style={{ fontSize: 12, fontWeight: 700, color: '#065F46', background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '3px 10px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <DollarSign size={12} color="#059669" /> {autorizacao.valor}
              </span>
            )}
          </div>
        )}
      </div>

      {/* BODY DO WIDGET */}
      <div style={{ padding: '18px 20px' }}>
        {/* TERMO JURÍDICO FORMATADO */}
        <div style={{
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: 14,
          padding: '14px 16px',
          fontSize: 13,
          lineHeight: 1.6,
          color: '#334155',
          marginBottom: 16,
          position: 'relative'
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748B', marginBottom: 4 }}>
            Termo de Consentimento
          </div>
          &ldquo;{autorizacao.termoTexto}&rdquo;
        </div>

        {/* FEEDBACK MSG */}
        {feedbackMessage && (
          <div style={{
            background: feedbackMessage.type === 'success' ? '#F0FDF4' : '#FEF2F2',
            border: `1px solid ${feedbackMessage.type === 'success' ? '#86EFAC' : '#FCA5A5'}`,
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 13,
            fontWeight: 600,
            color: feedbackMessage.type === 'success' ? '#15803D' : '#B91C1C',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            {feedbackMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* VISÃO DO RESPONSÁVEL / ALUNO */}
        {(!isAdminMode || isChangingResposta) ? (
          <div>
            {/* SE JÁ RESPONDEU E NÃO ESTÁ EM MODO DE EDIÇÃO */}
            {hasResponded && !isChangingResposta ? (
              <div style={{
                background: userResposta?.tipoDecisao === 'aprova' ? '#F0FDF4' : '#FEF2F2',
                border: `1.5px solid ${userResposta?.tipoDecisao === 'aprova' ? '#86EFAC' : '#FCA5A5'}`,
                borderRadius: 16,
                padding: '16px',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: userResposta?.tipoDecisao === 'aprova' ? '#10B981' : '#EF4444',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFFFFF'
                    }}>
                      {userResposta?.tipoDecisao === 'aprova' ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
                    </div>

                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: userResposta?.tipoDecisao === 'aprova' ? '#166534' : '#991B1B', textTransform: 'uppercase' }}>
                        {userResposta?.tipoDecisao === 'aprova' ? 'Participação Autorizada' : 'Participação Não Autorizada'}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: userResposta?.tipoDecisao === 'aprova' ? '#065F46' : '#991B1B' }}>
                        {userResposta?.opcaoTexto}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                        Assinado por <strong>{userResposta?.usuarioNome}</strong> em {formatDateTimeBR(userResposta?.respondidoEm)}
                      </div>
                    </div>
                  </div>

                  {autorizacao.permitirAlterarResposta && !isClosed && (
                    <button
                      type="button"
                      onClick={() => setIsChangingResposta(true)}
                      style={{
                        padding: '6px 12px',
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      Alterar Resposta
                    </button>
                  )}
                </div>

                {/* CERTIFICADO DIGITAL */}
                <div style={{
                  marginTop: 14,
                  padding: '10px 14px',
                  background: 'rgba(255, 255, 255, 0.85)',
                  borderRadius: 12,
                  border: '1px solid rgba(226, 232, 240, 0.8)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#64748B' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, color: '#0F172A' }}>
                      <ShieldCheck size={13} color="#059669" /> Assinatura Digital Verificada
                    </span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#059669' }}>
                      {userResposta?.assinaturaDigital?.token || 'IMP-AUT-OK'}
                    </span>
                  </div>

                  {(userResposta?.cpfResponsavel || userResposta?.documentoResponsavel) && (
                    <div style={{ fontSize: 11, color: '#475569' }}>
                      CPF do Responsável: <strong>{userResposta.cpfResponsavel || userResposta.documentoResponsavel}</strong>
                    </div>
                  )}

                  {userResposta?.observacoes && (
                    <div style={{
                      marginTop: 4,
                      padding: '8px 10px',
                      background: '#FFFBEB',
                      borderLeft: '3px solid #F59E0B',
                      borderRadius: 6,
                      fontSize: 12,
                      color: '#92400E',
                      fontWeight: 600
                    }}>
                      🩺 <strong>Observações / Alergias:</strong> {userResposta.observacoes}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* FORMULÁRIO DE SELEÇÃO E ASSINATURA */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>
                  Selecione sua resposta:
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(autorizacao.opcoes || []).map(op => {
                    const isSelected = selectedOpcaoId === op.id
                    const isAprova = op.tipo === 'aprova'
                    const isRecusa = op.tipo === 'recusa'

                    return (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => setSelectedOpcaoId(op.id)}
                        disabled={isClosed}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '14px 16px',
                          borderRadius: 14,
                          border: isSelected
                            ? `2px solid ${isAprova ? '#10B981' : isRecusa ? '#EF4444' : '#6366F1'}`
                            : '1.5px solid #E2E8F0',
                          background: isSelected
                            ? isAprova ? '#F0FDF4' : isRecusa ? '#FEF2F2' : '#F5F3FF'
                            : '#FFFFFF',
                          cursor: isClosed ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s',
                          boxShadow: isSelected ? '0 4px 14px rgba(0,0,0,0.06)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 18 }}>{op.emoji || (isAprova ? '✅' : '❌')}</span>
                          <span style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: isSelected
                              ? isAprova ? '#15803D' : isRecusa ? '#B91C1C' : '#4F46E5'
                              : '#1E293B'
                          }}>
                            {op.texto}
                          </span>
                        </div>

                        <div style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          border: `2px solid ${isSelected ? (isAprova ? '#10B981' : isRecusa ? '#EF4444' : '#6366F1') : '#CBD5E1'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {isSelected && (
                            <div style={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              background: isAprova ? '#10B981' : isRecusa ? '#EF4444' : '#6366F1'
                            }} />
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* OBSERVAÇÕES MÉDICAS SE REQUERIDO */}
                {autorizacao.exigirObservacoes && (
                  <div style={{ marginTop: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <HeartPulse size={15} color="#EF4444" />
                      <span>{autorizacao.observacoesLabel || 'Alergias, restrições alimentares ou recomendações médicas'}</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Alérgico a corantes; necessita de medicação caso ocorra..."
                      value={observacoes}
                      onChange={e => setObservacoes(e.target.value)}
                      disabled={isClosed}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 12,
                        border: '1.5px solid #E2E8F0',
                        fontSize: 13,
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                )}

                {/* CPF SE REQUERIDO */}
                {isCpfRequired && (
                  <div style={{ marginTop: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ShieldCheck size={15} color="#059669" />
                        <span>CPF do Responsável (Assinatura Digital) <span style={{ color: '#EF4444' }}>*</span></span>
                      </label>
                      {cpfResponsavel.length > 0 && (
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: isCpfValid ? '#15803D' : '#DC2626',
                          background: isCpfValid ? '#DCFCE7' : '#FEE2E2',
                          padding: '2px 8px',
                          borderRadius: 6,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          {isCpfValid ? '✓ CPF Válido' : '✕ CPF Inválido'}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="000.000.000-00"
                      maxLength={14}
                      value={cpfResponsavel}
                      onChange={e => setCpfResponsavel(formatarCPF(e.target.value))}
                      disabled={isClosed}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 12,
                        border: `1.5px solid ${cpfResponsavel.length > 0 ? (isCpfValid ? '#10B981' : '#FCA5A5') : '#E2E8F0'}`,
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#0F172A',
                        boxSizing: 'border-box',
                        outline: 'none',
                        letterSpacing: '0.04em'
                      }}
                    />
                    {cpfResponsavel.length > 0 && !isCpfValid && (
                      <p style={{ margin: '4px 0 0 0', fontSize: 11, color: '#DC2626', fontWeight: 600 }}>
                        Insira os 11 dígitos e o cálculo verificador correto do CPF para conseguir assinar.
                      </p>
                    )}
                  </div>
                )}

                {/* BOTÕES DE ENVIO */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {isChangingResposta && (
                      <button
                        type="button"
                        onClick={() => setIsChangingResposta(false)}
                        style={{
                          padding: '12px 18px',
                          background: '#FFFFFF',
                          border: '1px solid #CBD5E1',
                          borderRadius: 14,
                          fontSize: 13,
                          fontWeight: 700,
                          color: '#475569',
                          cursor: 'pointer'
                        }}
                      >
                        Cancelar
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleSubmitResposta}
                      disabled={isSubmitting || !canSubmit}
                      style={{
                        flex: 1,
                        padding: '14px',
                        borderRadius: 14,
                        background: !canSubmit
                          ? '#E2E8F0'
                          : selectedOpcaoObj?.tipo === 'recusa'
                            ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
                            : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                        color: !canSubmit ? '#94A3B8' : '#FFFFFF',
                        border: 'none',
                        fontSize: 14,
                        fontWeight: 800,
                        cursor: !canSubmit ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        boxShadow: !canSubmit ? 'none' : '0 4px 14px rgba(16, 185, 129, 0.25)',
                        transition: 'all 0.2s'
                      }}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          <span>Registrando assinatura...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={18} />
                          <span>Confirmar e Assinar Digitalmente</span>
                        </>
                      )}
                    </button>
                  </div>

                  {isCpfRequired && !isCpfValid && selectedOpcaoId && (
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: 11, color: '#DC2626', fontWeight: 600 }}>
                        ⚠️ Preencha um CPF válido com os 11 dígitos para conseguir assinar
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* VISÃO GESTÃO / PROFESSOR / ADMIN */}
        {isAdminMode && (
          <div style={{ marginTop: hasResponded ? 20 : 0 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Painel de Apuração e Controle de Saída</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#059669' }}>
                {stats.totalRespostas} confirmações recebidas
              </span>
            </div>

            {/* METRICS CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 14 }}>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B' }}>TOTAL RESPOSTAS</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginTop: 2 }}>{stats.totalRespostas}</div>
              </div>

              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#166534' }}>AUTORIZADOS ✅</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#15803D', marginTop: 2 }}>
                  {stats.totalAprovados} <span style={{ fontSize: 12, fontWeight: 600 }}>({stats.percentAprovados}%)</span>
                </div>
              </div>

              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#991B1B' }}>NÃO AUTORIZADOS ❌</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#B91C1C', marginTop: 2 }}>
                  {stats.totalRecusados} <span style={{ fontSize: 12, fontWeight: 600 }}>({stats.percentRecusados}%)</span>
                </div>
              </div>

              {autorizacao.exigirObservacoes && (
                <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#92400E' }}>COM ALERGIAS / OBS ⚠️</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#B45309', marginTop: 2 }}>
                    {stats.respostasComObservacoes.length}
                  </div>
                </div>
              )}
            </div>

            {/* PROGRESS BAR DIVIDIDA */}
            {stats.totalRespostas > 0 && (
              <div style={{ width: '100%', height: 10, background: '#E2E8F0', borderRadius: 999, overflow: 'hidden', display: 'flex', marginBottom: 16 }}>
                <div style={{ width: `${stats.percentAprovados}%`, background: '#10B981', transition: 'width 0.5s ease' }} title={`Autorizados: ${stats.percentAprovados}%`} />
                <div style={{ width: `${stats.percentRecusados}%`, background: '#EF4444', transition: 'width 0.5s ease' }} title={`Não autorizados: ${stats.percentRecusados}%`} />
              </div>
            )}

            {/* BOTÕES DE AÇÃO DO ADMIN */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setShowDetailsModal(true)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)'
                }}
              >
                <Users size={16} />
                <span>Ver Lista Completa ({stats.totalRespostas})</span>
              </button>

              <button
                type="button"
                onClick={handlePrintSummary}
                style={{
                  padding: '10px 16px',
                  borderRadius: 12,
                  background: '#FFFFFF',
                  border: '1.5px solid #E2E8F0',
                  color: '#334155',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
                title="Imprimir lista para o ônibus / passeio"
              >
                <Printer size={16} />
                <span>Imprimir Lista</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DETALHADA COM LISTA DE ALUNOS E OBSERVAÇÕES MÉDICAS */}
      <AnimatePresence>
        {showDetailsModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(8px)',
              zIndex: 99999999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
            onClick={() => setShowDetailsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '780px',
                maxHeight: '90vh',
                background: '#FFFFFF',
                borderRadius: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              {/* MODAL HEADER */}
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(6, 182, 212, 0.05) 100%)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF'
                  }}>
                    <Users size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', margin: 0 }}>
                      Lista de Alunos e Autorizações
                    </h3>
                    <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0 0' }}>
                      {autorizacao.titulo}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={handlePrintSummary}
                    style={{
                      padding: '8px 12px',
                      background: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#334155',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <Printer size={14} />
                    <span>Imprimir</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowDetailsModal(false)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      background: '#F1F5F9',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#64748B'
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* FILTROS E BUSCA */}
              <div style={{ padding: '14px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    { key: 'all', label: `Todos (${stats.totalRespostas})` },
                    { key: 'aprova', label: `Autorizados (${stats.totalAprovados})` },
                    { key: 'recusa', label: `Não Autorizados (${stats.totalRecusados})` },
                    { key: 'obs', label: `Com Alergias/Obs (${stats.respostasComObservacoes.length})` }
                  ].map(tab => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setSelectedFilter(tab.key as any)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 10,
                        border: selectedFilter === tab.key ? '1.5px solid #10B981' : '1px solid #E2E8F0',
                        background: selectedFilter === tab.key ? 'rgba(16, 185, 129, 0.1)' : '#FFFFFF',
                        color: selectedFilter === tab.key ? '#065F46' : '#64748B',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div style={{ position: 'relative', width: 220 }}>
                  <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: 10, top: 10 }} />
                  <input
                    type="text"
                    placeholder="Buscar aluno ou responsável..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 10px 7px 32px',
                      borderRadius: 10,
                      border: '1px solid #CBD5E1',
                      fontSize: 12,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* LISTA */}
              <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredRespostas.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94A3B8' }}>
                    <Users size={36} strokeWidth={1.5} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                    <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Nenhuma resposta encontrada para este filtro.</p>
                  </div>
                ) : (
                  filteredRespostas.map(r => {
                    const isAprova = r.tipoDecisao === 'aprova'
                    const isRecusa = r.tipoDecisao === 'recusa'

                    return (
                      <div
                        key={r.usuarioId + (r.alunoId || '')}
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          borderRadius: 14,
                          padding: '12px 16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                                {r.alunoNome || 'Aluno(a)'}
                              </span>
                              {r.alunoTurma && (
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#6366F1', background: '#EEF2FF', padding: '2px 8px', borderRadius: 6 }}>
                                  {r.alunoTurma}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                              Responsável: <strong>{r.usuarioNome}</strong> {(r.cpfResponsavel || r.documentoResponsavel) ? `(CPF: ${r.cpfResponsavel || r.documentoResponsavel})` : ''} • {formatDateTimeBR(r.respondidoEm)}
                            </div>
                          </div>

                          <div style={{
                            padding: '4px 10px',
                            borderRadius: 8,
                            background: isAprova ? '#DCFCE7' : isRecusa ? '#FEE2E2' : '#F1F5F9',
                            color: isAprova ? '#15803D' : isRecusa ? '#B91C1C' : '#475569',
                            fontSize: 12,
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5
                          }}>
                            {isAprova ? <CheckCircle2 size={14} /> : isRecusa ? <XCircle size={14} /> : null}
                            <span>{r.opcaoTexto}</span>
                          </div>
                        </div>

                        {/* ALERTA DE OBSERVAÇÕES MÉDICAS / ALERGIAS */}
                        {r.observacoes && (
                          <div style={{
                            background: '#FEF3C7',
                            borderLeft: '4px solid #F59E0B',
                            borderRadius: 6,
                            padding: '8px 12px',
                            fontSize: 12,
                            color: '#92400E',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                          }}>
                            <HeartPulse size={15} color="#D97706" style={{ flexShrink: 0 }} />
                            <span><strong>Observação / Alergia:</strong> {r.observacoes}</span>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
