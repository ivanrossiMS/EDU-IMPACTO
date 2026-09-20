'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, Mail, CheckCircle2, AlertCircle, XCircle, Clock,
  Loader2, RefreshCw, Send, X, ChevronDown, ChevronRight,
  Server, KeyRound
} from 'lucide-react'
import { SmtpDiagnosticStep } from '@/lib/server/emailService'

interface SmtpDiagnosticModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: 'test_connection' | 'send_test_email'
  smtpConfig: {
    host: string
    port: number
    secure?: boolean
    user: string
    pass?: string
    fromEmail?: string
    fromName?: string
  }
}

export function SmtpDiagnosticModal({
  isOpen,
  onClose,
  initialMode = 'test_connection',
  smtpConfig,
}: SmtpDiagnosticModalProps) {
  const [mode, setMode] = useState<'test_connection' | 'send_test_email'>(initialMode)
  const [executando, setExecutando] = useState(false)
  const [destinatarioTeste, setDestinatarioTeste] = useState('')
  const [steps, setSteps] = useState<SmtpDiagnosticStep[]>([])
  const [resultadoGeral, setResultadoGeral] = useState<{
    success?: boolean
    mensagem?: string
    messageId?: string
    error?: string
  } | null>(null)
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})

  // Inicializa o modo e o destinatário padrão
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode)
      setDestinatarioTeste(smtpConfig.user || 'direcao@colegioimpacto.net')
      setSteps([])
      setResultadoGeral(null)
      setExpandidos({})
      // Inicia automaticamente o teste de conexão se aberto nesse modo
      if (initialMode === 'test_connection') {
        executarProcedimentos('test_connection')
      }
    }
  }, [isOpen, initialMode])

  const toggleDetalhes = (id: string) => {
    setExpandidos(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Executa os procedimentos com feedback visual em tempo real
  const executarProcedimentos = async (tipoAcao: 'test_connection' | 'send_test_email') => {
    if (executando) return
    setExecutando(true)
    setResultadoGeral(null)

    // Configura os passos iniciais na tela imediatamente para feedback instantâneo
    if (tipoAcao === 'test_connection') {
      setSteps([
        {
          id: 'step_params',
          titulo: 'Validação de Parâmetros Locais',
          descricao: 'Verificando host, porta e formato das credenciais...',
          status: 'running',
        },
        {
          id: 'step_dns',
          titulo: 'Resolução de Domínio DNS',
          descricao: `Consultando endereço IP de ${smtpConfig.host || 'email-ssl.com.br'}...`,
          status: 'pending',
        },
        {
          id: 'step_socket',
          titulo: 'Conexão de Socket e Handshake TLS',
          descricao: `Conectando na porta ${smtpConfig.port || 465} com criptografia SSL/TLS...`,
          status: 'pending',
        },
        {
          id: 'step_banner',
          titulo: 'Identificação e Protocolo SMTP',
          descricao: 'Aguardando banner de boas-vindas ESMTP do servidor...',
          status: 'pending',
        },
        {
          id: 'step_auth',
          titulo: 'Autenticação de Credenciais (AUTH LOGIN)',
          descricao: `Validando credenciais do usuário ${smtpConfig.user || 'direcao@colegioimpacto.net'}...`,
          status: 'pending',
        },
      ])
    } else {
      setSteps([
        {
          id: 'step_dest',
          titulo: 'Validação do Destinatário',
          descricao: `Verificando endereço de destino (${destinatarioTeste})...`,
          status: 'running',
        },
        {
          id: 'step_connect',
          titulo: 'Autenticação e Canal SMTP',
          descricao: 'Estabelecendo conexão autenticada com a Locaweb...',
          status: 'pending',
        },
        {
          id: 'step_compose',
          titulo: 'Montagem da Mensagem MIME',
          descricao: 'Gerando template visual com selo oficial do Colégio Impacto...',
          status: 'pending',
        },
        {
          id: 'step_send',
          titulo: 'Transmissão e Confirmação',
          descricao: 'Disparando envelope de e-mail e aguardando confirmação do servidor...',
          status: 'pending',
        },
      ])
    }

    try {
      const response = await fetch('/api/matriculas/digital/configuracoes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: tipoAcao === 'send_test_email' ? 'send_test_email' : 'test_connection',
          smtp: smtpConfig,
          destinatario: destinatarioTeste,
        }),
      })

      const rawText = await response.text()
      let data: any = {}
      try {
        data = JSON.parse(rawText)
      } catch {
        throw new Error(
          response.status !== 200
            ? `Servidor retornou erro ${response.status}.`
            : 'Resposta inválida do servidor.'
        )
      }

      if (data.steps && Array.isArray(data.steps) && data.steps.length > 0) {
        setSteps(data.steps)
      }

      setResultadoGeral({
        success: Boolean(data.success),
        mensagem: data.mensagemGeral || data.mensagem,
        messageId: data.messageId,
        error: data.error,
      })
    } catch (err: any) {
      setResultadoGeral({
        success: false,
        error: `Não foi possível completar o teste: ${err.message || 'Erro de comunicação.'}`,
      })
    } finally {
      setExecutando(false)
    }
  }

  if (!isOpen) return null

  const isAuth535Error =
    resultadoGeral?.error?.includes('535') ||
    resultadoGeral?.mensagem?.includes('535') ||
    steps.some(s => s.erro?.includes('535') || s.dadosTecnicos?.codigoSmtp === 535)

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: 16,
        }}
        onClick={e => {
          if (e.target === e.currentTarget && !executando) onClose()
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          style={{
            background: 'hsl(var(--bg-surface))',
            border: '1px solid hsl(var(--border-subtle))',
            borderRadius: 16,
            width: '100%',
            maxWidth: 680,
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          }}
        >
          {/* Cabeçalho */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid hsl(var(--border-subtle))',
              background: 'hsl(var(--bg-elevated))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: mode === 'test_connection' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                  color: mode === 'test_connection' ? '#34d399' : '#60a5fa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {mode === 'test_connection' ? <Activity size={20} /> : <Mail size={20} />}
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'hsl(var(--text-primary))' }}>
                  {mode === 'test_connection' ? 'Diagnóstico de Conexão SMTP em Tempo Real' : 'Envio de E-mail de Teste'}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: 'rgba(255, 255, 255, 0.06)',
                      color: 'hsl(var(--text-secondary))',
                      fontFamily: 'monospace',
                    }}
                  >
                    <Server size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />
                    {smtpConfig.host || 'email-ssl.com.br'}:{smtpConfig.port || 465}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: 'rgba(255, 255, 255, 0.06)',
                      color: 'hsl(var(--text-secondary))',
                      fontFamily: 'monospace',
                    }}
                  >
                    <KeyRound size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />
                    {smtpConfig.user || 'direcao@colegioimpacto.net'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={executando}
              style={{
                background: 'none',
                border: 'none',
                color: 'hsl(var(--text-secondary))',
                cursor: executando ? 'not-allowed' : 'pointer',
                padding: 6,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Seletor de Modo (Abas) */}
          <div
            style={{
              display: 'flex',
              padding: '8px 20px',
              gap: 8,
              borderBottom: '1px solid hsl(var(--border-subtle))',
              background: 'hsl(var(--bg-surface))',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMode('test_connection')
                executarProcedimentos('test_connection')
              }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                border: mode === 'test_connection' ? '1px solid #10b981' : '1px solid transparent',
                background: mode === 'test_connection' ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                color: mode === 'test_connection' ? '#34d399' : 'hsl(var(--text-secondary))',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.15s ease',
              }}
            >
              <Activity size={14} /> Procedimentos de Conexão
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('send_test_email')
                setSteps([])
                setResultadoGeral(null)
              }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                border: mode === 'send_test_email' ? '1px solid #3b82f6' : '1px solid transparent',
                background: mode === 'send_test_email' ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                color: mode === 'send_test_email' ? '#60a5fa' : 'hsl(var(--text-secondary))',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.15s ease',
              }}
            >
              <Send size={14} /> Enviar E-mail de Teste
            </button>
          </div>

          {/* Conteúdo Principal com Scroll */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            {/* Se estiver no modo de Enviar E-mail de Teste, exibe campo de destinatário */}
            {mode === 'send_test_email' && (
              <div
                style={{
                  background: 'hsl(var(--bg-elevated))',
                  padding: 16,
                  borderRadius: 12,
                  border: '1px solid hsl(var(--border-subtle))',
                  marginBottom: 16,
                }}
              >
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'hsl(var(--text-secondary))',
                    textTransform: 'uppercase',
                    marginBottom: 6,
                  }}
                >
                  Destinatário do E-mail de Teste:
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="email"
                    placeholder="ex: seuemail@dominio.com"
                    value={destinatarioTeste}
                    onChange={e => setDestinatarioTeste(e.target.value)}
                    disabled={executando}
                    style={{
                      flex: 1,
                      height: 38,
                      background: 'hsl(var(--bg-surface))',
                      border: '1px solid hsl(var(--border-subtle))',
                      borderRadius: 8,
                      padding: '0 12px',
                      color: 'hsl(var(--text-primary))',
                      fontSize: 13,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => executarProcedimentos('send_test_email')}
                    disabled={executando || !destinatarioTeste}
                    style={{
                      background: '#2563eb',
                      border: 'none',
                      color: '#ffffff',
                      padding: '0 16px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: executando || !destinatarioTeste ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {executando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {executando ? 'Disparando...' : 'Disparar Teste'}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-secondary))', marginTop: 6 }}>
                  Será enviado um e-mail formatado com selo do Colégio Impacto para confirmar a entrega real na caixa de entrada.
                </div>
              </div>
            )}

            {/* Linha do Tempo de Procedimentos */}
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'hsl(var(--text-secondary))',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>Procedimentos do Servidor ({steps.length} etapas)</span>
                {executando && (
                  <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                    <Loader2 size={12} className="animate-spin" /> Comunicando em tempo real...
                  </span>
                )}
              </div>

              {steps.length === 0 && !executando && (
                <div
                  style={{
                    padding: 32,
                    textAlign: 'center',
                    color: 'hsl(var(--text-secondary))',
                    fontSize: 13,
                    background: 'hsl(var(--bg-elevated))',
                    borderRadius: 12,
                    border: '1px dashed hsl(var(--border-subtle))',
                  }}
                >
                  Clique em &quot;Disparar Teste&quot; ou &quot;Testar Conexão&quot; para iniciar o diagnóstico dos procedimentos.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {steps.map((step, idx) => {
                  const isExp = expandidos[step.id]
                  const hasTechData = step.dadosTecnicos || step.erro || step.sugestao

                  let statusIcon = <Clock size={16} color="#94a3b8" />
                  let borderColor = 'hsl(var(--border-subtle))'
                  let bgBadge = 'rgba(255, 255, 255, 0.04)'

                  if (step.status === 'running') {
                    statusIcon = <Loader2 size={16} color="#38bdf8" className="animate-spin" />
                    borderColor = 'rgba(56, 189, 248, 0.4)'
                    bgBadge = 'rgba(56, 189, 248, 0.06)'
                  } else if (step.status === 'success') {
                    statusIcon = <CheckCircle2 size={16} color="#34d399" />
                    borderColor = 'rgba(16, 185, 129, 0.3)'
                    bgBadge = 'rgba(16, 185, 129, 0.04)'
                  } else if (step.status === 'warning') {
                    statusIcon = <AlertCircle size={16} color="#fbbf24" />
                    borderColor = 'rgba(251, 191, 36, 0.3)'
                    bgBadge = 'rgba(251, 191, 36, 0.04)'
                  } else if (step.status === 'error') {
                    statusIcon = <XCircle size={16} color="#f87171" />
                    borderColor = 'rgba(239, 68, 68, 0.4)'
                    bgBadge = 'rgba(239, 68, 68, 0.06)'
                  }

                  return (
                    <div
                      key={step.id || idx}
                      style={{
                        background: bgBadge,
                        border: `1px solid ${borderColor}`,
                        borderRadius: 10,
                        padding: '12px 14px',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {statusIcon}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-primary))' }}>
                              {idx + 1}. {step.titulo}
                            </div>
                            {step.descricao && (
                              <div style={{ fontSize: 11, color: 'hsl(var(--text-secondary))', marginTop: 1 }}>
                                {step.descricao}
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {step.duracaoMs !== undefined && (
                            <span
                              style={{
                                fontSize: 11,
                                fontFamily: 'monospace',
                                color: 'hsl(var(--text-secondary))',
                                background: 'rgba(255, 255, 255, 0.06)',
                                padding: '2px 6px',
                                borderRadius: 4,
                              }}
                            >
                              {step.duracaoMs}ms
                            </span>
                          )}

                          {hasTechData && (
                            <button
                              type="button"
                              onClick={() => toggleDetalhes(step.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'hsl(var(--text-secondary))',
                                cursor: 'pointer',
                                padding: 2,
                                display: 'flex',
                                alignItems: 'center',
                              }}
                            >
                              {isExp ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Dados Técnicos e Sugestões Expandidos */}
                      {(isExp || step.status === 'error' || step.status === 'warning') && hasTechData && (
                        <div
                          style={{
                            marginTop: 10,
                            paddingTop: 10,
                            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                            fontSize: 12,
                          }}
                        >
                          {step.erro && (
                            <div style={{ color: '#f87171', fontWeight: 600, marginBottom: 4 }}>
                              Erro: {step.erro}
                            </div>
                          )}

                          {step.sugestao && (
                            <div
                              style={{
                                background: 'rgba(251, 191, 36, 0.1)',
                                border: '1px solid rgba(251, 191, 36, 0.25)',
                                borderRadius: 6,
                                padding: '8px 10px',
                                color: '#fef3c7',
                                fontSize: 11,
                                marginBottom: 6,
                                lineHeight: 1.4,
                              }}
                            >
                              💡 <strong>Orientação:</strong> {step.sugestao}
                            </div>
                          )}

                          {step.dadosTecnicos && (
                            <pre
                              style={{
                                margin: 0,
                                padding: '6px 8px',
                                background: 'rgba(0, 0, 0, 0.3)',
                                borderRadius: 6,
                                fontFamily: 'monospace',
                                fontSize: 10.5,
                                color: '#a5f3fc',
                                overflowX: 'auto',
                              }}
                            >
                              {JSON.stringify(step.dadosTecnicos, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Painel de Resultado Consolidado */}
            {resultadoGeral && (
              <div style={{ marginTop: 16 }}>
                {resultadoGeral.success ? (
                  <div
                    style={{
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      borderRadius: 12,
                      padding: 16,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#34d399', fontWeight: 700, fontSize: 14 }}>
                      <CheckCircle2 size={18} />
                      {mode === 'test_connection' ? 'Conexão SMTP Homologada com Sucesso!' : 'E-mail de Teste Entregue ao Servidor!'}
                    </div>
                    <div style={{ fontSize: 12, color: '#d1fae5', marginTop: 6, lineHeight: 1.5 }}>
                      {mode === 'test_connection' ? (
                        <>
                          O servidor oficial da Locaweb (<strong>{smtpConfig.host}:{smtpConfig.port}</strong>) respondeu prontamente via SSL/TLS e autorizou o usuário <strong>{smtpConfig.user}</strong>.
                          O sistema está 100% apto para disparar códigos OTP e cópias de contratos.
                        </>
                      ) : (
                        <>
                          A mensagem foi enviada para <strong>{destinatarioTeste}</strong> com identificador oficial:
                          <br />
                          <code style={{ fontSize: 11, color: '#6ee7b7' }}>Message-ID: {resultadoGeral.messageId}</code>
                          <br />
                          Por favor, verifique a caixa de entrada ou spam do e-mail de destino.
                        </>
                      )}
                    </div>

                    {mode === 'test_connection' && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('send_test_email')
                          setSteps([])
                          setResultadoGeral(null)
                        }}
                        style={{
                          marginTop: 12,
                          background: '#059669',
                          border: 'none',
                          color: '#ffffff',
                          padding: '6px 14px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Send size={12} /> Deseja enviar um e-mail de teste agora?
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      borderRadius: 12,
                      padding: 16,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f87171', fontWeight: 700, fontSize: 14 }}>
                      <AlertCircle size={18} />
                      {isAuth535Error ? 'Credenciais Recusadas pela Locaweb (Erro 535)' : 'Falha no Procedimento SMTP'}
                    </div>
                    <div style={{ fontSize: 12, color: '#fecaca', marginTop: 6, lineHeight: 1.5 }}>
                      {isAuth535Error ? (
                        <>
                          O servidor (<code>{smtpConfig.host}:{smtpConfig.port}</code>) e a criptografia SSL/TLS estão <strong>100% corretos</strong>, mas o servidor da Locaweb rejeitou a senha informada.
                          <br /><br />
                          <strong>Como resolver:</strong>
                          <br />
                          1. Acesse o Webmail da Locaweb e confirme se a senha do e-mail <strong>{smtpConfig.user}</strong> está correta.
                          <br />
                          2. Digite a senha no campo <strong>&quot;SENHA / APP PASSWORD&quot;</strong> do formulário e clique em <strong>&quot;Salvar Configurações&quot;</strong>.
                          <br />
                          3. Execute novamente o teste de conexão.
                        </>
                      ) : (
                        resultadoGeral.mensagem || resultadoGeral.error || 'Verifique as configurações informadas e tente novamente.'
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rodapé de Ações */}
          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid hsl(var(--border-subtle))',
              background: 'hsl(var(--bg-elevated))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <button
              type="button"
              onClick={() => executarProcedimentos(mode)}
              disabled={executando || (mode === 'send_test_email' && !destinatarioTeste)}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid hsl(var(--border-subtle))',
                color: 'hsl(var(--text-primary))',
                padding: '7px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: executando ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <RefreshCw size={13} className={executando ? 'animate-spin' : ''} />
              {executando ? 'Executando...' : 'Repetir Procedimentos'}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={executando}
              style={{
                background: '#0b1f48',
                border: 'none',
                color: '#ffffff',
                padding: '7px 18px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: executando ? 'not-allowed' : 'pointer',
              }}
            >
              Fechar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
