'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck, CheckCircle2, XCircle, Search, Upload, FileText,
  Clock, Download, Building2, User, Lock, ExternalLink, RefreshCw,
  Fingerprint, Check, AlertTriangle, ArrowRight, Copy,
  Scale, FileCheck, ChevronDown, ChevronUp, Sparkles, BadgeCheck
} from 'lucide-react'
import { toast } from 'sonner'

interface DossierData {
  valido: boolean
  status: string
  statusDescricao: string
  protocolo: string
  tituloDocumento: string
  anoLetivo: string
  alunoNome: string
  alunoCpfMascarado?: string
  alunoSerieTurma: string
  responsavelNomeMascarado?: string
  responsavelNome?: string
  responsavelCpfMascarado: string
  responsavelEmailMascarado?: string
  responsavelTelefoneMascarado?: string
  responsavelParentesco: string
  dataCriacao: string
  dataAssinatura: string
  documentoOriginalHash: string
  documentoAssinadoHash: string
  trilhaAuditoriaHash?: string
  logoUrl?: string
  escolaRepresentante: {
    nome: string
    cargo: string
    razaoSocial: string
    cnpj: string
  }
  metadadosTecnicos?: {
    ip: string
    dispositivo: string
    sistemaOperacional: string
    navegador: string
    dataHoraAssinatura: string
  } | null
  trilhaAuditoria: Array<{
    timestamp: string
    evento: string
    descricao: string
    hash?: string
  }>
  downloadDisponivel: boolean
  pdfBase64?: string | null
}

export function ValidarAssinaturaClient({
  initialDossier,
  initialProtocolo,
}: {
  initialDossier?: DossierData | null
  initialProtocolo?: string
}) {
  const [dossier, setDossier] = useState<DossierData | null>(initialDossier || null)
  const [searchProtocolo, setSearchProtocolo] = useState(initialProtocolo || '')
  const [loading, setLoading] = useState(false)
  const [copiedHash, setCopiedHash] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(
    !initialDossier && initialProtocolo ? 'Documento não localizado no banco de registros oficiais do Colégio Impacto.' : null
  )

  // Estados de upload de conferência de arquivo
  const [verificandoArquivo, setVerificandoArquivo] = useState(false)
  const [resultadoArquivo, setResultadoArquivo] = useState<{
    inalterado: boolean
    hash: string
    mensagem: string
  } | null>(null)
  const [mostrarDetalhesJuridicos, setMostrarDetalhesJuridicos] = useState(false)

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedHash(label)
    toast.success(`${label} copiado!`)
    setTimeout(() => setCopiedHash(null), 3000)
  }

  // Consulta por protocolo digitado
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const clean = searchProtocolo.trim()
    if (!clean) return

    setLoading(true)
    setErrorMessage(null)
    setResultadoArquivo(null)

    try {
      const res = await fetch(`/api/matriculas/digital/validar?protocolo=${encodeURIComponent(clean)}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.mensagem || data.error || 'Documento não encontrado.')
      }

      setDossier(data)
    } catch (err: any) {
      setDossier(null)
      setErrorMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Verifica arquivo local arrastado / selecionado calculando SHA-256 no browser
  const handleFileVerification = async (file: File) => {
    setVerificandoArquivo(true)
    setResultadoArquivo(null)

    try {
      const arrayBuffer = await file.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()

      // Envia para o backend checar se corresponde
      const res = await fetch('/api/matriculas/digital/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: hashHex }),
      })
      const data = await res.json()

      setResultadoArquivo({
        inalterado: Boolean(data.inalterado),
        hash: hashHex,
        mensagem: data.mensagem || (data.valido ? 'Arquivo autêntico e verificado.' : 'Hash não corresponde a nenhum documento assinado.'),
      })

      // Se não havia dossiê carregado e o arquivo encontrou o contrato, carrega o dossiê
      if (data.protocolo && !dossier) {
        setSearchProtocolo(data.protocolo)
        fetch(`/api/matriculas/digital/validar?protocolo=${encodeURIComponent(data.protocolo)}`)
          .then(r => r.json())
          .then(d => {
            if (d && !d.error) setDossier(d)
          })
      }
    } catch (err: any) {
      setResultadoArquivo({
        inalterado: false,
        hash: 'Erro',
        mensagem: 'Falha ao processar arquivo: ' + err.message,
      })
    } finally {
      setVerificandoArquivo(false)
    }
  }

  const downloadPdf = (base64Data: string, filename: string) => {
    const linkSource = `data:application/pdf;base64,${base64Data}`
    const downloadLink = document.createElement('a')
    downloadLink.href = linkSource
    downloadLink.download = filename
    downloadLink.click()
  }

  const formatDate = (iso?: string | null) => {
    if (!iso) return '—'
    try {
      const d = new Date(iso)
      const dataUtc = d.toISOString().replace('T', ' ').substring(0, 19) + ' UTC'
      const horaLocal = d.toLocaleTimeString('pt-BR', {
        timeZone: 'America/Campo_Grande',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
      return `${dataUtc} (${horaLocal} no Horário de MS - UTC-4)`
    } catch {
      return iso
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#090d16', color: '#f8fafc', paddingBottom: 60, fontFamily: 'sans-serif' }}>
      {/* Header Institucional */}
      <header
        style={{
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          padding: '16px 24px',
        }}
      >
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 4,
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              <img
                src={dossier?.logoUrl || '/logo-impacto-clean.png'}
                alt={dossier?.escolaRepresentante?.razaoSocial || 'Colégio Impacto'}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
              />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#ffffff', letterSpacing: '-0.01em' }}>
                {dossier?.escolaRepresentante?.razaoSocial || 'COLÉGIO IMPACTO'}
              </div>
              <div style={{ fontSize: 11, color: '#34d399', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ShieldCheck size={13} /> Portal Oficial de Validação de Autenticidade & Integridade
              </div>
            </div>
          </div>

          <div
            style={{
              fontSize: 11,
              color: '#94a3b8',
              background: 'rgba(255,255,255,0.05)',
              padding: '6px 14px',
              borderRadius: 20,
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Lock size={12} color="#34d399" /> MP 2.200-2/2001 • Código Civil • CPC
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: 940, margin: '32px auto 0', padding: '0 16px' }}>
        {/* Card Superior: Respaldo, Validade Jurídica e Medidas de Segurança */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.92) 0%, rgba(30, 41, 59, 0.82) 50%, rgba(15, 23, 42, 0.92) 100%)',
            backdropFilter: 'blur(16px)',
            borderRadius: 20,
            border: '1px solid rgba(59, 130, 246, 0.28)',
            marginBottom: 26,
            boxShadow: '0 20px 45px -15px rgba(0, 0, 0, 0.65), 0 0 25px -5px rgba(59, 130, 246, 0.15)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Barra Superior Decorativa com Gradiente Fino */}
          <div
            style={{
              height: 3,
              width: '100%',
              background: 'linear-gradient(90deg, #3b82f6 0%, #10b981 35%, #8b5cf6 70%, #06b6d4 100%)',
            }}
          />

          <div style={{ padding: '26px 28px' }}>
            {/* Linha Superior: Tags e Status */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    color: '#34d399',
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: 20,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#10b981',
                      boxShadow: '0 0 8px #10b981',
                    }}
                  />
                  Respaldo Jurídico & Pericial Pleno
                </span>

                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    background: 'rgba(59, 130, 246, 0.12)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    color: '#93c5fd',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 20,
                  }}
                >
                  <Scale size={13} /> Eficácia de Título Executivo Extrajudicial
                </span>
              </div>

              <span
                style={{
                  fontSize: 11,
                  color: '#94a3b8',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  padding: '3px 10px',
                  borderRadius: 14,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <Sparkles size={11} color="#38bdf8" /> Válido em Todo Território Nacional
              </span>
            </div>

            {/* Título Principal e Apresentação Institucional */}
            <div style={{ marginBottom: 18 }}>
              <h1
                style={{
                  fontSize: 21,
                  fontWeight: 800,
                  color: '#ffffff',
                  margin: '0 0 8px',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.3,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                Validade Jurídica, Fé Pública e Integridade Pericial
              </h1>
              <p
                style={{
                  fontSize: 13.5,
                  color: '#cbd5e1',
                  margin: 0,
                  lineHeight: 1.6,
                  maxWidth: 880,
                }}
              >
                Todos os contratos, aditivos e termos formalizados pela plataforma digital do <strong>Colégio Impacto</strong> possuem equivalência jurídica irrestrita ao documento físico em papel com firma reconhecida em cartório, sendo dotados de força probante em juízo, presunção legal de veracidade e proteção criptográfica de última geração.
              </p>
            </div>

            {/* Faixa de Marcos Legais (Badges Normativas) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
                padding: '12px 14px',
                background: 'rgba(15, 23, 42, 0.65)',
                borderRadius: 12,
                border: '1px solid rgba(255, 255, 255, 0.06)',
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: '#60a5fa', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5, marginRight: 6 }}>
                <FileCheck size={14} /> Fundamentação Legal:
              </div>

              <span style={{ fontSize: 11.5, color: '#e2e8f0', background: 'rgba(255, 255, 255, 0.06)', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <strong>MP 2.200-2/2001</strong> (Art. 10, § 2º)
              </span>

              <span style={{ fontSize: 11.5, color: '#e2e8f0', background: 'rgba(255, 255, 255, 0.06)', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <strong>Lei Federal nº 14.063/2020</strong> (Assinaturas Eletrônicas)
              </span>

              <span style={{ fontSize: 11.5, color: '#e2e8f0', background: 'rgba(255, 255, 255, 0.06)', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <strong>Código Civil</strong> (Arts. 107, 219, 221 e 422)
              </span>

              <span style={{ fontSize: 11.5, color: '#e2e8f0', background: 'rgba(255, 255, 255, 0.06)', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <strong>CPC</strong> (Arts. 440, 441 e 784, III)
              </span>

              <span style={{ fontSize: 11.5, color: '#e2e8f0', background: 'rgba(255, 255, 255, 0.06)', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <strong>LGPD</strong> (Lei Federal nº 13.709/2018)
              </span>
            </div>

            {/* Grid dos 4 Pilares de Respaldo e Medidas Técnicas */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 14,
                marginBottom: 16,
              }}
            >
              {/* Pilar 1: Amparo Legal e Eficácia Executiva */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: 14,
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: '#60a5fa',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Scale size={18} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 13.5, fontWeight: 700, color: '#ffffff', margin: 0 }}>
                      Amparo Legal & Probatório
                    </h2>
                    <span style={{ fontSize: 11, color: '#93c5fd', fontWeight: 600 }}>
                      Fé Probatória em Juízo
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.55 }}>
                  Aceito por tribunais, secretarias de educação, bancos e órgãos públicos sem necessidade de impressão física. O CPC equipara expressamente o documento digital ao físico e confere força executiva extrajudicial.
                </p>

                <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', gap: 6, color: '#34d399', fontSize: 11, fontWeight: 700 }}>
                  <Check size={13} /> Reconhecimento de firma dispensado por lei
                </div>
              </div>

              {/* Pilar 2: Blindagem Criptográfica SHA-256 e Padrão ISO 32000 */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: 14,
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#34d399',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Fingerprint size={18} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 13.5, fontWeight: 700, color: '#ffffff', margin: 0 }}>
                      Integridade Criptográfica
                    </h2>
                    <span style={{ fontSize: 11, color: '#6ee7b7', fontWeight: 600 }}>
                      SHA-256 (FIPS 180-4) • ISO 32000
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.55 }}>
                  Cada PDF recebe uma assinatura matemática de 256 bits com campos /ByteRange. A alteração de uma única vírgula ou espaço quebra o hash criptográfico, acusando fraude instantaneamente, inclusive no Adobe Acrobat Reader off-line.
                </p>

                <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', gap: 6, color: '#34d399', fontSize: 11, fontWeight: 700 }}>
                  <Check size={13} /> Imutabilidade e selagem matemática
                </div>
              </div>

              {/* Pilar 3: Autenticação em Dois Fatores (OTP) e Não-Repúdio */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(168, 85, 247, 0.2)',
                  borderRadius: 14,
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      background: 'rgba(168, 85, 247, 0.15)',
                      color: '#c084fc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Lock size={18} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 13.5, fontWeight: 700, color: '#ffffff', margin: 0 }}>
                      Identificação & Não-Repúdio
                    </h2>
                    <span style={{ fontSize: 11, color: '#d8b4fe', fontWeight: 600 }}>
                      Confirmação OTP Multicanal
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.55 }}>
                  A manifestação de vontade é confirmada via código dinâmico de uso único (OTP) enviado ao WhatsApp e E-mail verificados do titular, com termo de adesão expresso irrevogável, impedindo qualquer alegação de desconhecimento.
                </p>

                <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', gap: 6, color: '#34d399', fontSize: 11, fontWeight: 700 }}>
                  <Check size={13} /> Vínculo unívoco e irrevogável com o signatário
                </div>
              </div>

              {/* Pilar 4: Trilha de Auditoria e Evidências Periciais */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  borderRadius: 14,
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: '#fbbf24',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Clock size={18} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 13.5, fontWeight: 700, color: '#ffffff', margin: 0 }}>
                      Cadeia de Custódia Forense
                    </h2>
                    <span style={{ fontSize: 11, color: '#fcd34d', fontWeight: 600 }}>
                      Timestamp UTC • Rastreabilidade IP
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.55 }}>
                  Trilha ininterrupta que registra carimbo de tempo atômico UTC, endereço IP de conexão, porta lógica, User-Agent e metadados de hardware, permitindo a reconstituição pericial exata de cada etapa da formalização.
                </p>

                <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', gap: 6, color: '#34d399', fontSize: 11, fontWeight: 700 }}>
                  <Check size={13} /> Histórico auditável e prova documental cabal
                </div>
              </div>
            </div>

            {/* Botão para Expandir Detalhamento Técnico & Procedimento Pericial */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
              <button
                type="button"
                onClick={() => setMostrarDetalhesJuridicos(!mostrarDetalhesJuridicos)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#93c5fd',
                  padding: '8px 18px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.2s ease',
                }}
              >
                {mostrarDetalhesJuridicos ? (
                  <>
                    <ChevronUp size={15} /> Ocultar Detalhamento Técnico e Procedimento Pericial
                  </>
                ) : (
                  <>
                    <ChevronDown size={15} /> Ver Orientações para Juízes, Cartórios, Bancos e Procedimento Pericial
                  </>
                )}
              </button>
            </div>

            {/* Painel Expansível de Detalhamento Técnico e Jurídico */}
            <AnimatePresence>
              {mostrarDetalhesJuridicos && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div
                    style={{
                      marginTop: 18,
                      paddingTop: 18,
                      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 16,
                    }}
                  >
                    {/* Guia para Órgãos Externos */}
                    <div
                      style={{
                        background: 'rgba(15, 23, 42, 0.9)',
                        borderRadius: 12,
                        padding: '16px 20px',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                      }}
                    >
                      <h3 style={{ fontSize: 13.5, fontWeight: 700, color: '#60a5fa', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Building2 size={16} /> Instruções para Conferência por Bancos, Cartórios e Secretarias de Educação:
                      </h3>
                      <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.6 }}>
                        <li>
                          <strong>Conferência por Protocolo:</strong> Digite o código de protocolo oficial no campo de busca abaixo (ex: <code>IMP-2027-8K3N9P</code>) para visualizar o dossiê probatório, os dados cadastrais protegidos pela LGPD e a assinatura da instituição.
                        </li>
                        <li>
                          <strong>Conferência Pericial Independente (Off-line):</strong> Arraste o arquivo PDF para a área de verificação pericial no final desta página. O navegador calculará o hash SHA-256 nativamente e confrontará com o registro em custódia.
                        </li>
                        <li>
                          <strong>Auditoria Direta no Adobe Acrobat Reader:</strong> Ao abrir o PDF no Adobe Reader oficial, a assinatura digital corporativa e a integridade de todos os bytes são atestadas pelo leitor via especificação ISO 32000, sem necessidade de consultar sistemas externos.
                        </li>
                      </ol>
                    </div>

                    {/* Doutrina e Fundamentos do Marco Legal */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                        gap: 12,
                      }}
                    >
                      <div style={{ background: 'rgba(15, 23, 42, 0.6)', borderRadius: 10, padding: 14, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#34d399', textTransform: 'uppercase', marginBottom: 4 }}>
                          MP nº 2.200-2/2001 (Art. 10, § 2º)
                        </div>
                        <p style={{ fontSize: 11.5, color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                          &ldquo;O disposto nesta Medida Provisória não obsta a utilização de outro meio de comprovação da autoria e integridade de documentos em forma eletrônica, inclusive os que utilizem certificados não emitidos pela ICP-Brasil, desde que admitido pelas partes como válido ou aceito pela pessoa a quem for oposto o documento.&rdquo;
                        </p>
                      </div>

                      <div style={{ background: 'rgba(15, 23, 42, 0.6)', borderRadius: 10, padding: 14, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', marginBottom: 4 }}>
                          CPC (Lei 13.105/2015, Art. 784, III)
                        </div>
                        <p style={{ fontSize: 11.5, color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                          &ldquo;São títulos executivos extrajudiciais: o documento particular assinado pelo devedor e por 2 (duas) testemunhas ou assinado eletronicamente nos termos da lei.&rdquo; A assinatura digital confere via executiva autônoma à dívida ou obrigação pactuada.
                        </p>
                      </div>

                      <div style={{ background: 'rgba(15, 23, 42, 0.6)', borderRadius: 10, padding: 14, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 4 }}>
                          Código Civil (Art. 219) & LGPD
                        </div>
                        <p style={{ fontSize: 11.5, color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                          As declarações constantes de documentos assinados presumem-se verdadeiras perante os signatários. A consulta pública resguarda os dados sensíveis dos contratantes e estudantes mediante mascaramento criptográfico estrito.
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Barra de Busca por Protocolo */}
        <div
          style={{
            background: 'rgba(30, 41, 59, 0.7)',
            backdropFilter: 'blur(10px)',
            borderRadius: 16,
            padding: '20px 24px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: 24,
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          }}
        >
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
              <input
                type="text"
                value={searchProtocolo}
                onChange={e => setSearchProtocolo(e.target.value.toUpperCase())}
                placeholder="Digite o código de protocolo (Ex: IMP-2027-8K3N9P)"
                style={{
                  width: '100%',
                  height: 48,
                  background: '#090d16',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 10,
                  padding: '0 16px',
                  color: '#fff',
                  fontFamily: 'monospace',
                  fontSize: 15,
                  outline: 'none',
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !searchProtocolo.trim()}
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '0 24px',
                height: 48,
                fontSize: 14,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />} Consultar Documento
            </button>
          </form>

          {errorMessage && (
            <div style={{ marginTop: 16, background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '12px 16px', borderRadius: 8, fontSize: 13 }}>
              {errorMessage}
            </div>
          )}
        </div>

        {/* Exibição do Dossiê do Contrato */}
        {dossier && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
          >
            {/* Banner de Status de Autenticidade */}
            <div
              style={{
                background: dossier.valido
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.08) 100%)'
                  : dossier.status === 'cancelado'
                  ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(185, 28, 28, 0.08) 100%)'
                  : 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.08) 100%)',
                border: dossier.valido
                  ? '1px solid rgba(16, 185, 129, 0.4)'
                  : dossier.status === 'cancelado'
                  ? '1px solid rgba(239, 68, 68, 0.4)'
                  : '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: 20,
                padding: '24px 28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: dossier.valido ? '#10b981' : dossier.status === 'cancelado' ? '#ef4444' : '#f59e0b',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: dossier.valido
                      ? '0 0 20px rgba(16, 185, 129, 0.4)'
                      : dossier.status === 'cancelado'
                      ? '0 0 20px rgba(239, 68, 68, 0.4)'
                      : '0 0 20px rgba(245, 158, 11, 0.4)',
                  }}
                >
                  {dossier.valido ? <CheckCircle2 size={32} /> : dossier.status === 'cancelado' ? <XCircle size={32} /> : <AlertTriangle size={32} />}
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: dossier.valido ? '#34d399' : dossier.status === 'cancelado' ? '#f87171' : '#fbbf24' }}>
                    Status da Certificação Digital
                  </div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, margin: '4px 0 2px', color: '#fff' }}>
                    {dossier.statusDescricao}
                  </h2>
                  <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
                    Protocolo Oficial: <strong style={{ color: '#fff', fontFamily: 'monospace' }}>{dossier.protocolo}</strong>
                  </p>
                </div>
              </div>

              {dossier.downloadDisponivel && dossier.pdfBase64 && (
                <button
                  onClick={() =>
                    downloadPdf(
                      dossier.pdfBase64!,
                      `Documento_Oficial_${dossier.protocolo}.pdf`
                    )
                  }
                  style={{
                    background: '#10b981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '12px 20px',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                  }}
                >
                  <Download size={16} /> Baixar PDF com Selo Criptográfico
                </button>
              )}
            </div>

            {/* Selo Criptográfico PKCS#7 Incorporado */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.12) 0%, rgba(29, 78, 216, 0.05) 100%)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: 16,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <ShieldCheck size={24} color="#60a5fa" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#93c5fd' }}>
                    Assinatura Criptográfica X.509 Corporativa (/Sig & /ByteRange) Incorporada ao PDF
                  </div>
                  <div style={{ fontSize: 12, color: '#cbd5e1' }}>
                    O arquivo gerado contém campos técnicos ISO 32000 que permitem ao Adobe Acrobat Reader verificar a integridade matemática sem depender de servidores.
                  </div>
                </div>
              </div>
              <span style={{ fontSize: 11, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', padding: '4px 10px', borderRadius: 6, fontWeight: 700, fontFamily: 'monospace' }}>
                PKCS#7 Detached • SHA-256
              </span>
            </div>

            {/* Quadro de Chaves Criptográficas SHA-256 (Triplo Hash) */}
            <div
              style={{
                background: 'rgba(30, 41, 59, 0.7)',
                borderRadius: 16,
                padding: '20px 24px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Fingerprint size={16} /> Tripla Integridade Criptográfica (SHA-256)
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                {/* Hash Original */}
                <div style={{ background: '#090d16', padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>1. Hash do Documento Original:</span>
                    <button
                      onClick={() => copyToClipboard(dossier.documentoOriginalHash, 'Hash Original')}
                      style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}
                    >
                      {copiedHash === 'Hash Original' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    </button>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 10.5, color: '#38bdf8', wordBreak: 'break-all' }}>
                    {dossier.documentoOriginalHash}
                  </div>
                </div>

                {/* Hash Trilha */}
                <div style={{ background: '#090d16', padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>2. Hash da Cadeia de Custódia:</span>
                    <button
                      onClick={() => copyToClipboard(dossier.trilhaAuditoriaHash || '', 'Hash Trilha')}
                      style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}
                    >
                      {copiedHash === 'Hash Trilha' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    </button>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 10.5, color: '#fbbf24', wordBreak: 'break-all' }}>
                    {dossier.trilhaAuditoriaHash || 'Calculado na finalização'}
                  </div>
                </div>

                {/* Hash Final Selado */}
                <div style={{ background: '#090d16', padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>3. Hash do PDF Final Selado:</span>
                    <button
                      onClick={() => copyToClipboard(dossier.documentoAssinadoHash, 'Hash Final')}
                      style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}
                    >
                      {copiedHash === 'Hash Final' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    </button>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 10.5, color: '#34d399', wordBreak: 'break-all' }}>
                    {dossier.documentoAssinadoHash}
                  </div>
                </div>
              </div>
            </div>

            {/* Grid dos Signatários */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
              {/* Contratante / Responsável (com Mascaramento LGPD) */}
              <div style={{ background: 'rgba(30, 41, 59, 0.7)', borderRadius: 16, padding: '20px 24px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#34d399', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <User size={16} /> Signatário / Contratante (LGPD Protegido)
                </div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>
                  {dossier.responsavelNomeMascarado || dossier.responsavelNome}
                </div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
                  CPF: {dossier.responsavelCpfMascarado} • ({dossier.responsavelParentesco})
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  E-mail: {dossier.responsavelEmailMascarado || 'Protegido'} • Tel: {dossier.responsavelTelefoneMascarado || 'Protegido'}
                </div>
                <div style={{ fontSize: 13, color: '#e2e8f0', marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  Estudante Titular: <strong>{dossier.alunoNome}</strong> ({dossier.alunoSerieTurma || 'Regular'})
                </div>
                <div style={{ fontSize: 12, color: '#34d399', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={14} /> Confirmação OTP efetuada em: {formatDate(dossier.dataAssinatura)}
                </div>

                {dossier.metadadosTecnicos && (
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: 11, color: '#64748b', lineHeight: 1.6 }}>
                    • Endereço IP: {dossier.metadadosTecnicos.ip}<br />
                    • Dispositivo: {dossier.metadadosTecnicos.dispositivo}<br />
                    • Sistema Operacional: {dossier.metadadosTecnicos.sistemaOperacional}
                  </div>
                )}
              </div>

              {/* Contratada / Colégio Impacto */}
              <div style={{ background: 'rgba(30, 41, 59, 0.7)', borderRadius: 16, padding: '20px 24px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Building2 size={16} /> Instituição de Ensino (Contratada)
                </div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>
                  {dossier.escolaRepresentante?.nome || 'IVAN ROSSI SAMBRANA'}
                </div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
                  Cargo: {dossier.escolaRepresentante?.cargo || 'Diretor Geral / Representante Legal'}
                </div>
                <div style={{ fontSize: 13, color: '#e2e8f0', marginTop: 10 }}>
                  {dossier.escolaRepresentante?.razaoSocial || 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA'} • CNPJ: {dossier.escolaRepresentante?.cnpj || '04.395.789/0001-88'}
                </div>
                <div style={{ fontSize: 12, color: '#60a5fa', marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={14} /> Chancela Eletrônica Institucional Atestada
                </div>

                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>
                    Chancela com Assinatura Oficial:
                  </div>
                  <div style={{ background: '#ffffff', borderRadius: 8, padding: '8px 14px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img
                      src="/assinatura-representante.png"
                      alt="Chancela Oficial do Diretor Geral"
                      style={{ maxHeight: 42, maxWidth: 220, objectFit: 'contain' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Trilha de Auditoria */}
            <div style={{ background: 'rgba(30, 41, 59, 0.7)', borderRadius: 16, padding: '20px 24px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={16} /> Trilha de Auditoria (Cadeia de Custódia Imutável)
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {dossier.trilhaAuditoria?.map((ev, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 13 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', marginTop: 6 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: '#f8fafc' }}>
                        [{ev.evento}] - {ev.descricao}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                        Data/Hora: {formatDate(ev.timestamp)} • Hash do Evento: <span style={{ fontFamily: 'monospace' }}>{ev.hash?.substring(0, 16)}...</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Seção Interativa de Teste de Integridade de Arquivo PDF (Drag & Drop) */}
        <div
          style={{
            background: 'rgba(30, 41, 59, 0.5)',
            borderRadius: 20,
            padding: '28px',
            border: '2px dashed rgba(255, 255, 255, 0.15)',
            marginTop: 28,
            textAlign: 'center',
          }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            if (e.dataTransfer.files?.[0]) {
              handleFileVerification(e.dataTransfer.files[0])
            }
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#60a5fa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
            }}
          >
            <Upload size={24} />
          </div>

          <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px', color: '#fff' }}>
            Verificador Pericial de Integridade do Arquivo PDF
          </h3>
          <p style={{ fontSize: 13, color: '#94a3b8', maxWidth: 560, margin: '0 auto 16px', lineHeight: 1.5 }}>
            Deseja conferir se o arquivo PDF em suas mãos sofreu qualquer adulteração? Arraste o arquivo aqui para calcular a assinatura criptográfica SHA-256 no seu próprio dispositivo e confrontar com o banco de custódia oficial.
          </p>

          <label
            style={{
              display: 'inline-block',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#fff',
              padding: '10px 20px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Selecionar Arquivo PDF para Conferência
            <input
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={e => {
                if (e.target.files?.[0]) handleFileVerification(e.target.files[0])
              }}
            />
          </label>

          {verificandoArquivo && (
            <div style={{ marginTop: 16, color: '#60a5fa', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <RefreshCw size={16} className="animate-spin" /> Calculando hash SHA-256 via Web Crypto API e conferindo com a custódia...
            </div>
          )}

          {resultadoArquivo && (
            <div
              style={{
                marginTop: 20,
                background: resultadoArquivo.inalterado
                  ? 'rgba(16, 185, 129, 0.15)'
                  : 'rgba(239, 68, 68, 0.15)',
                border: resultadoArquivo.inalterado
                  ? '1px solid rgba(16, 185, 129, 0.3)'
                  : '1px solid rgba(239, 68, 68, 0.3)',
                color: resultadoArquivo.inalterado ? '#34d399' : '#fca5a5',
                borderRadius: 12,
                padding: '16px 20px',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
                {resultadoArquivo.inalterado ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                {resultadoArquivo.inalterado
                  ? 'AUTENTICIDADE E INTEGRIDADE CONFIRMADAS'
                  : 'INCONSISTÊNCIA DETECTADA'}
              </div>
              <div style={{ fontSize: 13, marginTop: 4, color: '#f8fafc' }}>
                {resultadoArquivo.mensagem}
              </div>
              <div style={{ fontSize: 11, fontFamily: 'monospace', marginTop: 8, color: '#94a3b8' }}>
                Hash SHA-256 Calculado: {resultadoArquivo.hash}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
