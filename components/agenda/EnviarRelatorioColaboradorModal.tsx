'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Send, X, User, Crown, CheckCircle2, AlertCircle, 
  FileText, Image as ImageIcon, Loader2, Sparkles, Calendar
} from 'lucide-react'
import { createPortal } from 'react-dom'

interface EnviarRelatorioColaboradorModalProps {
  isOpen: boolean
  onClose: () => void
  colaboradorNome: string
  colaboradorId?: string
  colaboradorCargo?: string
  colaboradorFoto?: string | null
  mes: number
  ano: number
  summary: {
    totalGeral: number
    totalComunicados: number
    totalRelatorios: number
    totalMomentos: number
    diasComEnvios: number
    diasNoMes: number
    mediaPorDiaAtivo: string
  }
  imageBase64: string
  onSuccess: (comunicadoId: string) => void
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const ClientPortal = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  return mounted ? createPortal(children, document.body) : null
}

function getInitialTitulo(mes: number, ano: number) {
  const mesNome = MONTH_NAMES[mes - 1]
  return `📊 Relatório Oficial de Frequência e Envios - ${mesNome}/${ano}`
}

function getInitialMensagem(
  colaboradorNome: string,
  mes: number,
  ano: number,
  summary: {
    totalGeral: number
    totalComunicados: number
    totalRelatorios: number
    totalMomentos: number
    diasComEnvios: number
    diasNoMes: number
    mediaPorDiaAtivo: string
  }
) {
  const mesNome = MONTH_NAMES[mes - 1]
  const pctAssiduidade = summary.diasNoMes > 0 
    ? Math.round((summary.diasComEnvios / summary.diasNoMes) * 100) 
    : 0

  if (summary.totalGeral === 0) {
    return `Olá, ${colaboradorNome}! 👋

A Direção Geral e Administração Master informa que, referente ao período de ${mesNome} de ${ano} na Agenda Digital do Colégio Impacto, não foram identificados registros de publicações no seu perfil.

📊 Resumo de Suas Atividades no Período:
• Total de Publicações Realizadas: 0 envios
• 📢 Comunicados Gerais: 0
• 📋 Relatórios de Rotina Diária: 0
• 📸 Momentos Fotográficos: 0
• 📅 Dias com Atividade: 0 de ${summary.diasNoMes} dias (0% de assiduidade)

Pedimos zelo e compromisso com o registro pedagógico dos nossos alunos e na comunicação transparente com as famílias!

Confira em anexo o seu relatório oficial de acompanhamento do período. Caso tenha ocorrido alguma divergência em seus lançamentos, procure a coordenação.

Atenciosamente,
Ivan Rossi
Administrador Master • Diretor Geral
Colégio Impacto`
  }

  return `Olá, ${colaboradorNome}! 👋

A Direção Geral e Administração Master preparou e disponibiliza o seu Relatório Oficial de Frequência e Envios referente ao período de ${mesNome} de ${ano} na Agenda Digital do Colégio Impacto.

📊 Resumo de Suas Atividades no Período:
• Total de Publicações Realizadas: ${summary.totalGeral} envios
• 📢 Comunicados Gerais: ${summary.totalComunicados}
• 📋 Relatórios de Rotina Diária: ${summary.totalRelatorios}
• 📸 Momentos Fotográficos: ${summary.totalMomentos}
• 📅 Dias com Atividade: ${summary.diasComEnvios} de ${summary.diasNoMes} dias (${pctAssiduidade}% de assiduidade)

Pedimos zelo e compromisso com o registro pedagógico dos nossos alunos e na comunicação transparente com as famílias!

Confira em anexo o seu infográfico com o calendário detalhado de envios.

Atenciosamente,
Ivan Rossi
Administrador Master • Diretor Geral
Colégio Impacto`
}

export function EnviarRelatorioColaboradorModal({
  isOpen,
  onClose,
  colaboradorNome,
  colaboradorId,
  colaboradorCargo = 'Colaborador(a)',
  colaboradorFoto,
  mes,
  ano,
  summary,
  imageBase64,
  onSuccess
}: EnviarRelatorioColaboradorModalProps) {
  const mesNome = MONTH_NAMES[mes - 1]
  const [titulo, setTitulo] = useState(() => getInitialTitulo(mes, ano))
  const [mensagem, setMensagem] = useState(() => getInitialMensagem(colaboradorNome, mes, ano, summary))

  // Sincronizar título e mensagem sempre que o modal for aberto ou parâmetros mudarem
  React.useEffect(() => {
    if (isOpen) {
      setTitulo(getInitialTitulo(mes, ano))
      setMensagem(getInitialMensagem(colaboradorNome, mes, ano, summary))
      setErrorMsg(null)
    }
  }, [isOpen, mes, ano, colaboradorNome, summary.totalGeral, summary.totalComunicados, summary.totalRelatorios, summary.totalMomentos, summary.diasComEnvios, summary.diasNoMes])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showImageZoom, setShowImageZoom] = useState(false)

  const handleSend = async () => {
    if (!titulo.trim()) {
      setErrorMsg('Por favor, informe o título do comunicado.')
      return
    }
    if (!mensagem.trim()) {
      setErrorMsg('Por favor, informe o conteúdo da mensagem.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg(null)

    try {
      const res = await fetch('/api/agenda/relatorio-frequencia/enviar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          colaboradorNome,
          colaboradorId,
          mes,
          ano,
          summary,
          customTitulo: titulo.trim(),
          customMensagem: mensagem.trim().replace(/\n/g, '<br />'),
          imageBase64
        })
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Erro ao enviar comunicado para o colaborador.')
      }

      // Notificar lista de comunicados
      window.dispatchEvent(new CustomEvent('ad:comunicados-insert', {
        detail: {
          id: data.comunicadoId,
          titulo: titulo.trim()
        }
      }))

      onSuccess(data.comunicadoId)
      onClose()
    } catch (err: any) {
      console.error('Erro ao enviar comunicado:', err)
      setErrorMsg(err.message || 'Falha ao processar o envio. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <ClientPortal>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 10010,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '16px'
        }}
        onClick={(e) => {
          e.stopPropagation()
          if (!isSubmitting) onClose()
        }}
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 16 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
          style={{
            width: 740,
            maxWidth: '100%',
            maxHeight: '94vh',
            background: '#ffffff',
            borderRadius: 24,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header Superior */}
          <div
            style={{
              padding: '20px 28px',
              background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Send size={20} color="#ffffff" />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                  Enviar Relatório de Frequência por Comunicado
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(255, 255, 255, 0.8)' }}>
                  Disparo oficial via Agenda Digital com infográfico em anexo
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.15)',
                border: 'none',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={17} />
            </button>
          </div>

          {/* Conteúdo com Scroll */}
          <div style={{ padding: '22px 28px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Banner de Remetente (Administrador Master) e Destinatário */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              {/* Remetente: Administrador Master */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08), rgba(99, 102, 241, 0.12))',
                  border: '1.5px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: 16,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: '#4f46e5',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(79, 70, 229, 0.3)'
                  }}
                >
                  <Crown size={20} />
                </div>
                <div>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Remetente Oficial
                  </span>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0f172a' }}>
                    Ivan Rossi
                  </div>
                  <div style={{ fontSize: 11.5, color: '#6366f1', fontWeight: 700 }}>
                    Administrador Master • Direção Geral
                  </div>
                </div>
              </div>

              {/* Destinatário: Colaborador */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: 16,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: '#10b981',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 16,
                    overflow: 'hidden'
                  }}
                >
                  {colaboradorFoto ? (
                    <img src={colaboradorFoto} alt={colaboradorNome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    colaboradorNome.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Destinatário (Colaborador)
                  </span>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0f172a' }}>
                    {colaboradorNome}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>
                    {colaboradorCargo} • {mesNome}/{ano}
                  </div>
                </div>
              </div>
            </div>

            {/* Campo: Título do Comunicado */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#334155', marginBottom: 6 }}>
                Título do Comunicado
              </label>
              <input
                type="text"
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                placeholder="Título do comunicado..."
                style={{
                  width: '100%',
                  height: 42,
                  padding: '0 14px',
                  borderRadius: 12,
                  border: '1.5px solid #cbd5e1',
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: '#0f172a',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={e => e.currentTarget.style.borderColor = '#6366f1'}
                onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'}
              />
            </div>

            {/* Campo: Mensagem */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: '#334155' }}>
                  Mensagem do Comunicado
                </label>
                <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>
                  Você pode personalizar o texto antes de enviar
                </span>
              </div>
              <textarea
                value={mensagem}
                onChange={e => setMensagem(e.target.value)}
                rows={7}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 14,
                  border: '1.5px solid #cbd5e1',
                  fontSize: 12.5,
                  lineHeight: '1.6',
                  fontWeight: 500,
                  color: '#334155',
                  fontFamily: 'inherit',
                  outline: 'none',
                  resize: 'vertical'
                }}
                onFocus={e => e.currentTarget.style.borderColor = '#6366f1'}
                onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'}
              />
            </div>

            {/* Pré-visualização do Infográfico Anexado */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ImageIcon size={14} color="#6366f1" />
                  <span>Infográfico do Relatório Gerado (Anexo Oficial)</span>
                </label>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: '#ecfdf5', padding: '2px 8px', borderRadius: 6 }}>
                  ✓ Pronto para Envio
                </span>
              </div>

              {imageBase64 && (
                <div
                  style={{
                    position: 'relative',
                    borderRadius: 16,
                    border: '1.5px solid #e2e8f0',
                    overflow: 'hidden',
                    background: '#f8fafc',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
                    maxHeight: 220,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}
                  onClick={() => setShowImageZoom(true)}
                  title="Clique para ampliar o infográfico"
                >
                  <img
                    src={imageBase64}
                    alt="Infográfico do Relatório"
                    style={{
                      maxWidth: '100%',
                      maxHeight: 220,
                      objectFit: 'contain',
                      display: 'block'
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 8,
                      right: 8,
                      background: 'rgba(15, 23, 42, 0.75)',
                      color: '#ffffff',
                      padding: '4px 10px',
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 700,
                      backdropFilter: 'blur(4px)'
                    }}
                  >
                    Clique para ampliar
                  </div>
                </div>
              )}
            </div>

            {/* Mensagem de Erro se houver */}
            {errorMsg && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 12,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: '#b91c1c',
                  fontSize: 12.5,
                  fontWeight: 600
                }}
              >
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Rodapé com Botões de Ação */}
          <div
            style={{
              padding: '16px 28px',
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '9px 18px',
                borderRadius: 12,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontSize: 13,
                fontWeight: 700,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s'
              }}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSend}
              disabled={isSubmitting}
              style={{
                padding: '10px 22px',
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)',
                color: '#ffffff',
                fontSize: 13.5,
                fontWeight: 800,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                if (!isSubmitting) e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="ad-spin-icon" />
                  <span>Enviando Comunicado...</span>
                </>
              ) : (
                <>
                  <Send size={15} />
                  <span>Confirmar e Enviar Comunicado</span>
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* Modal de Zoom da Imagem */}
        {showImageZoom && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.85)',
              zIndex: 10020,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 24
            }}
            onClick={() => setShowImageZoom(false)}
          >
            <img
              src={imageBase64}
              alt="Zoom Infográfico"
              style={{ maxWidth: '95vw', maxHeight: '90vh', borderRadius: 16, boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}
            />
          </div>
        )}
      </div>
    </ClientPortal>
  )
}
