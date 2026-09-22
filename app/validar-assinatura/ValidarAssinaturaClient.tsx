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
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(120% 80% at 50% -10%, rgba(37, 99, 235, 0.08) 0%, rgba(16, 185, 129, 0.05) 40%, #f8fafc 75%)',
        backgroundColor: '#f8fafc',
        color: '#0f172a',
        paddingBottom: 70,
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Header Institucional Light Glass */}
      <header
        style={{
          borderBottom: '1px solid rgba(226, 232, 240, 0.9)',
          background: 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          padding: '16px 24px',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03), 0 6px 20px rgba(15, 23, 42, 0.02)',
        }}
      >
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 4,
                boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)',
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
              <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', letterSpacing: '-0.02em' }}>
                {dossier?.escolaRepresentante?.razaoSocial || 'COLÉGIO IMPACTO'}
              </div>
              <div style={{ fontSize: 11.5, color: '#059669', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
                <ShieldCheck size={14} color="#059669" /> Portal Oficial de Validação de Autenticidade & Integridade
              </div>
            </div>
          </div>

          <div
            style={{
              fontSize: 11.5,
              color: '#475569',
              background: '#f1f5f9',
              padding: '6px 14px',
              borderRadius: 20,
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: 600,
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
            }}
          >
            <Lock size={12} color="#059669" /> MP 2.200-2/2001 • Código Civil • CPC
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: 940, margin: '32px auto 0', padding: '0 16px' }}>
        {/* Card Superior: Respaldo, Validade Jurídica e Medidas de Segurança (Light Theme Ultra Moderno) */}
        <div
          style={{
            background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
            borderRadius: 22,
            border: '1px solid #cbd5e1',
            marginBottom: 26,
            boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.03)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Barra Superior Decorativa com Gradiente Fino */}
          <div
            style={{
              height: 3.5,
              width: '100%',
              background: 'linear-gradient(90deg, #2563eb 0%, #059669 35%, #7c3aed 70%, #0284c7 100%)',
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
                    background: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    color: '#047857',
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '4px 12px',
                    borderRadius: 20,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
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
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#1d4ed8',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '4px 12px',
                    borderRadius: 20,
                  }}
                >
                  <Scale size={13} color="#2563eb" /> Eficácia de Título Executivo Extrajudicial
                </span>
              </div>

              <span
                style={{
                  fontSize: 11,
                  color: '#475569',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  padding: '4px 12px',
                  borderRadius: 20,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}
              >
                <Sparkles size={12} color="#0284c7" /> Válido em Todo Território Nacional
              </span>
            </div>

            {/* Título Principal e Apresentação Institucional */}
            <div style={{ marginBottom: 18 }}>
              <h1
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: '#0f172a',
                  margin: '0 0 8px',
                  letterSpacing: '-0.025em',
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
                  color: '#475569',
                  margin: 0,
                  lineHeight: 1.65,
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
                padding: '12px 16px',
                background: '#f1f5f9',
                borderRadius: 14,
                border: '1px solid #e2e8f0',
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5, marginRight: 6 }}>
                <FileCheck size={14} /> Fundamentação Legal:
              </div>

              <span style={{ fontSize: 11.5, color: '#1e293b', background: '#ffffff', padding: '4px 10px', borderRadius: 8, border: '1px solid #cbd5e1', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                <strong>MP 2.200-2/2001</strong> (Art. 10, § 2º)
              </span>

              <span style={{ fontSize: 11.5, color: '#1e293b', background: '#ffffff', padding: '4px 10px', borderRadius: 8, border: '1px solid #cbd5e1', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                <strong>Lei Federal nº 14.063/2020</strong> (Assinaturas Eletrônicas)
              </span>

              <span style={{ fontSize: 11.5, color: '#1e293b', background: '#ffffff', padding: '4px 10px', borderRadius: 8, border: '1px solid #cbd5e1', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                <strong>Código Civil</strong> (Arts. 107, 219, 221 e 422)
              </span>

              <span style={{ fontSize: 11.5, color: '#1e293b', background: '#ffffff', padding: '4px 10px', borderRadius: 8, border: '1px solid #cbd5e1', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                <strong>CPC</strong> (Arts. 440, 441 e 784, III)
              </span>

              <span style={{ fontSize: 11.5, color: '#1e293b', background: '#ffffff', padding: '4px 10px', borderRadius: 8, border: '1px solid #cbd5e1', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                <strong>LGPD</strong> (Lei Federal nº 13.709/2018)
              </span>
            </div>

            {/* Grid dos 4 Pilares de Respaldo e Medidas Técnicas com Cabeçalho Gradiente Leve */}
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
                  background: '#ffffff',
                  border: '1px solid #dbeafe',
                  borderRadius: 18,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 4px 16px rgba(37, 99, 235, 0.04)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                }}
              >
                {/* Cabeçalho com Gradiente Leve Azul */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(239, 246, 255, 0.95) 0%, rgba(219, 234, 254, 0.55) 100%)',
                    borderBottom: '1px solid #bfdbfe',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: '#ffffff',
                      color: '#2563eb',
                      border: '1px solid #dbeafe',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(37, 99, 235, 0.1)',
                      flexShrink: 0,
                    }}
                  >
                    <Scale size={18} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      Amparo Legal & Probatório
                    </h2>
                    <span style={{ fontSize: 11, color: '#1d4ed8', fontWeight: 700 }}>
                      Fé Probatória em Juízo
                    </span>
                  </div>
                </div>

                <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  <p style={{ fontSize: 12.5, color: '#475569', margin: 0, lineHeight: 1.55 }}>
                    Aceito por tribunais, secretarias de educação, bancos e órgãos públicos sem necessidade de impressão física. O CPC equipara expressamente o documento digital ao físico e confere força executiva extrajudicial.
                  </p>

                  <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 6, color: '#059669', fontSize: 11, fontWeight: 700 }}>
                    <Check size={13} /> Reconhecimento de firma dispensado por lei
                  </div>
                </div>
              </div>

              {/* Pilar 2: Blindagem Criptográfica SHA-256 e Padrão ISO 32000 */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #a7f3d0',
                  borderRadius: 18,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 4px 16px rgba(5, 150, 105, 0.04)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                }}
              >
                {/* Cabeçalho com Gradiente Leve Esmeralda */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(236, 253, 245, 0.95) 0%, rgba(209, 250, 229, 0.55) 100%)',
                    borderBottom: '1px solid #a7f3d0',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: '#ffffff',
                      color: '#059669',
                      border: '1px solid #a7f3d0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(5, 150, 105, 0.1)',
                      flexShrink: 0,
                    }}
                  >
                    <Fingerprint size={18} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      Integridade Criptográfica
                    </h2>
                    <span style={{ fontSize: 11, color: '#047857', fontWeight: 700 }}>
                      SHA-256 (FIPS 180-4) • ISO 32000
                    </span>
                  </div>
                </div>

                <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  <p style={{ fontSize: 12.5, color: '#475569', margin: 0, lineHeight: 1.55 }}>
                    Cada PDF recebe uma assinatura matemática de 256 bits com campos /ByteRange. A alteração de uma única vírgula ou espaço quebra o hash criptográfico, acusando fraude instantaneamente, inclusive no Adobe Acrobat Reader off-line.
                  </p>

                  <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 6, color: '#059669', fontSize: 11, fontWeight: 700 }}>
                    <Check size={13} /> Imutabilidade e selagem matemática
                  </div>
                </div>
              </div>

              {/* Pilar 3: Autenticação em Dois Fatores (OTP) e Não-Repúdio */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #ddd6fe',
                  borderRadius: 18,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 4px 16px rgba(124, 58, 237, 0.04)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                }}
              >
                {/* Cabeçalho com Gradiente Leve Roxo */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(245, 243, 255, 0.95) 0%, rgba(237, 233, 254, 0.55) 100%)',
                    borderBottom: '1px solid #ddd6fe',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: '#ffffff',
                      color: '#7c3aed',
                      border: '1px solid #ddd6fe',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(124, 58, 237, 0.1)',
                      flexShrink: 0,
                    }}
                  >
                    <Lock size={18} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      Identificação & Não-Repúdio
                    </h2>
                    <span style={{ fontSize: 11, color: '#6d28d9', fontWeight: 700 }}>
                      Confirmação OTP Multicanal
                    </span>
                  </div>
                </div>

                <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  <p style={{ fontSize: 12.5, color: '#475569', margin: 0, lineHeight: 1.55 }}>
                    A manifestação de vontade é confirmada via código dinâmico de uso único (OTP) enviado ao WhatsApp e E-mail verificados do titular, com termo de adesão expresso irrevogável, impedindo qualquer alegação de desconhecimento.
                  </p>

                  <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 6, color: '#059669', fontSize: 11, fontWeight: 700 }}>
                    <Check size={13} /> Vínculo unívoco e irrevogável com o signatário
                  </div>
                </div>
              </div>

              {/* Pilar 4: Trilha de Auditoria e Evidências Periciais */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #fde68a',
                  borderRadius: 18,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 4px 16px rgba(217, 119, 6, 0.04)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                }}
              >
                {/* Cabeçalho com Gradiente Leve Âmbar */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 251, 235, 0.95) 0%, rgba(254, 243, 199, 0.55) 100%)',
                    borderBottom: '1px solid #fde68a',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: '#ffffff',
                      color: '#d97706',
                      border: '1px solid #fde68a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(217, 119, 6, 0.1)',
                      flexShrink: 0,
                    }}
                  >
                    <Clock size={18} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      Cadeia de Custódia Forense
                    </h2>
                    <span style={{ fontSize: 11, color: '#b45309', fontWeight: 700 }}>
                      Timestamp UTC • Rastreabilidade IP
                    </span>
                  </div>
                </div>

                <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  <p style={{ fontSize: 12.5, color: '#475569', margin: 0, lineHeight: 1.55 }}>
                    Trilha ininterrupta que registra carimbo de tempo atômico UTC, endereço IP de conexão, porta lógica, User-Agent e metadados de hardware, permitindo a reconstituição pericial exata de cada etapa da formalização.
                  </p>

                  <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 6, color: '#059669', fontSize: 11, fontWeight: 700 }}>
                    <Check size={13} /> Histórico auditável e prova documental cabal
                  </div>
                </div>
              </div>
            </div>

            {/* Botão para Expandir Detalhamento Técnico & Procedimento Pericial */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
              <button
                type="button"
                onClick={() => setMostrarDetalhesJuridicos(!mostrarDetalhesJuridicos)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#1e40af',
                  padding: '9px 20px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
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
                      borderTop: '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 16,
                    }}
                  >
                    {/* Guia para Órgãos Externos com Cabeçalho Gradiente Leve */}
                    <div
                      style={{
                        background: '#ffffff',
                        borderRadius: 16,
                        border: '1px solid #bfdbfe',
                        overflow: 'hidden',
                        boxShadow: '0 4px 16px rgba(37, 99, 235, 0.04)',
                      }}
                    >
                      <div
                        style={{
                          background: 'linear-gradient(135deg, rgba(239, 246, 255, 0.95) 0%, rgba(224, 242, 254, 0.7) 100%)',
                          borderBottom: '1px solid #bfdbfe',
                          padding: '14px 20px',
                        }}
                      >
                        <h3 style={{ fontSize: 14, fontWeight: 800, color: '#1e40af', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Building2 size={17} color="#2563eb" /> Instruções para Conferência por Bancos, Cartórios e Secretarias de Educação:
                        </h3>
                      </div>
                      <div style={{ padding: '18px 22px' }}>
                        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#334155', lineHeight: 1.65 }}>
                          <li style={{ marginBottom: 6 }}>
                            <strong>Conferência por Protocolo:</strong> Digite o código de protocolo oficial no campo de busca abaixo (ex: <code>IMP-2027-8K3N9P</code>) para visualizar o dossiê probatório, os dados cadastrais protegidos pela LGPD e a assinatura da instituição.
                          </li>
                          <li style={{ marginBottom: 6 }}>
                            <strong>Conferência Pericial Independente (Off-line):</strong> Arraste o arquivo PDF para a área de verificação pericial no final desta página. O navegador calculará o hash SHA-256 nativamente e confrontará com o registro em custódia.
                          </li>
                          <li>
                            <strong>Auditoria Direta no Adobe Acrobat Reader:</strong> Ao abrir o PDF no Adobe Reader oficial, a assinatura digital corporativa e a integridade de todos os bytes são atestadas pelo leitor via especificação ISO 32000, sem necessidade de consultar sistemas externos.
                          </li>
                        </ol>
                      </div>
                    </div>

                    {/* Doutrina e Fundamentos do Marco Legal com Cabeçalhos Gradientes */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                        gap: 12,
                      }}
                    >
                      <div style={{ background: '#ffffff', borderRadius: 14, border: '1px solid #a7f3d0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(5, 150, 105, 0.03)' }}>
                        <div style={{ background: 'linear-gradient(135deg, rgba(236, 253, 245, 0.95) 0%, rgba(209, 250, 229, 0.6) 100%)', borderBottom: '1px solid #a7f3d0', padding: '10px 16px' }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>
                            MP nº 2.200-2/2001 (Art. 10, § 2º)
                          </div>
                        </div>
                        <div style={{ padding: 16 }}>
                          <p style={{ fontSize: 12, color: '#475569', margin: 0, lineHeight: 1.55 }}>
                            &ldquo;O disposto nesta Medida Provisória não obsta a utilização de outro meio de comprovação da autoria e integridade de documentos em forma eletrônica, inclusive os que utilizem certificados não emitidos pela ICP-Brasil, desde que admitido pelas partes como válido ou aceito pela pessoa a quem for oposto o documento.&rdquo;
                          </p>
                        </div>
                      </div>

                      <div style={{ background: '#ffffff', borderRadius: 14, border: '1px solid #bfdbfe', overflow: 'hidden', boxShadow: '0 2px 8px rgba(37, 99, 235, 0.03)' }}>
                        <div style={{ background: 'linear-gradient(135deg, rgba(239, 246, 255, 0.95) 0%, rgba(219, 234, 254, 0.6) 100%)', borderBottom: '1px solid #bfdbfe', padding: '10px 16px' }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase' }}>
                            CPC (Lei 13.105/2015, Art. 784, III)
                          </div>
                        </div>
                        <div style={{ padding: 16 }}>
                          <p style={{ fontSize: 12, color: '#475569', margin: 0, lineHeight: 1.55 }}>
                            &ldquo;São títulos executivos extrajudiciais: o documento particular assinado pelo devedor e por 2 (duas) testemunhas ou assinado eletronicamente nos termos da lei.&rdquo; A assinatura digital confere via executiva autônoma à dívida ou obrigação pactuada.
                          </p>
                        </div>
                      </div>

                      <div style={{ background: '#ffffff', borderRadius: 14, border: '1px solid #fde68a', overflow: 'hidden', boxShadow: '0 2px 8px rgba(217, 119, 6, 0.03)' }}>
                        <div style={{ background: 'linear-gradient(135deg, rgba(255, 251, 235, 0.95) 0%, rgba(254, 243, 199, 0.6) 100%)', borderBottom: '1px solid #fde68a', padding: '10px 16px' }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: '#b45309', textTransform: 'uppercase' }}>
                            Código Civil (Art. 219) & LGPD
                          </div>
                        </div>
                        <div style={{ padding: 16 }}>
                          <p style={{ fontSize: 12, color: '#475569', margin: 0, lineHeight: 1.55 }}>
                            As declarações constantes de documentos assinados presumem-se verdadeiras perante os signatários. A consulta pública resguarda os dados sensíveis dos contratantes e estudantes mediante mascaramento criptográfico estrito.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Barra de Busca por Protocolo (Light Theme Flutuante) */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 18,
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            marginBottom: 24,
            boxShadow: '0 10px 30px -5px rgba(15, 23, 42, 0.05), 0 2px 6px rgba(15, 23, 42, 0.02)',
          }}
        >
          {/* Cabeçalho com Gradiente Leve da Busca */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(248, 250, 252, 0.95) 0%, rgba(241, 245, 249, 0.8) 100%)',
              borderBottom: '1px solid #e2e8f0',
              padding: '12px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: '#334155' }}>
              <Search size={14} color="#2563eb" />
              <span>Consulta Pública e Imediata de Autenticidade Contratual</span>
            </div>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, fontFamily: 'monospace' }}>
              REDE NACIONAL DE VALIDAÇÃO
            </span>
          </div>

          <div style={{ padding: '22px 26px' }}>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
              <input
                type="text"
                value={searchProtocolo}
                onChange={e => setSearchProtocolo(e.target.value.toUpperCase())}
                placeholder="Digite o código de protocolo (Ex: IMP-2027-8K3N9P)"
                style={{
                  width: '100%',
                  height: 50,
                  background: '#f8fafc',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: 12,
                  padding: '0 18px',
                  color: '#0f172a',
                  fontFamily: 'monospace',
                  fontSize: 15,
                  fontWeight: 600,
                  outline: 'none',
                  transition: 'border-color 0.2s ease',
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
                borderRadius: 12,
                padding: '0 26px',
                height: 50,
                fontSize: 14,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />} Consultar Documento
            </button>
          </form>

          {errorMessage && (
            <div style={{ marginTop: 16, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '12px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>
              {errorMessage}
            </div>
          )}
          </div>
        </div>

        {/* Exibição do Dossiê do Contrato (Light Theme) */}
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
                  ? 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)'
                  : dossier.status === 'cancelado'
                  ? 'linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)'
                  : 'linear-gradient(135deg, #fffbeb 0%, #fefce8 100%)',
                border: dossier.valido
                  ? '1.5px solid #a7f3d0'
                  : dossier.status === 'cancelado'
                  ? '1.5px solid #fca5a5'
                  : '1.5px solid #fde68a',
                borderRadius: 20,
                padding: '24px 28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 16,
                boxShadow: dossier.valido
                  ? '0 10px 30px -5px rgba(16, 185, 129, 0.15)'
                  : '0 10px 30px -5px rgba(15, 23, 42, 0.05)',
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
                      ? '0 0 20px rgba(16, 185, 129, 0.35)'
                      : dossier.status === 'cancelado'
                      ? '0 0 20px rgba(239, 68, 68, 0.35)'
                      : '0 0 20px rgba(245, 158, 11, 0.35)',
                  }}
                >
                  {dossier.valido ? <CheckCircle2 size={32} /> : dossier.status === 'cancelado' ? <XCircle size={32} /> : <AlertTriangle size={32} />}
                </div>

                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', color: dossier.valido ? '#047857' : dossier.status === 'cancelado' ? '#b91c1c' : '#b45309', letterSpacing: '0.04em' }}>
                    Status da Certificação Digital
                  </div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, margin: '4px 0 2px', color: '#0f172a' }}>
                    {dossier.statusDescricao}
                  </h2>
                  <p style={{ fontSize: 13, color: '#475569', margin: 0, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    Protocolo Oficial:
                    <strong style={{ color: '#0f172a', fontFamily: 'monospace', fontWeight: 800, background: '#ffffff', padding: '2px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}>
                      {dossier.protocolo}
                    </strong>
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
                    background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 12,
                    padding: '12px 22px',
                    fontWeight: 700,
                    fontSize: 13.5,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 4px 14px rgba(5, 150, 105, 0.25)',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  <Download size={16} /> Baixar PDF com Selo Criptográfico
                </button>
              )}
            </div>

            {/* Selo Criptográfico PKCS#7 Incorporado */}
            <div
              style={{
                background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)',
                border: '1px solid #bfdbfe',
                borderRadius: 16,
                padding: '18px 22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <ShieldCheck size={26} color="#2563eb" />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#1e40af' }}>
                    Assinatura Criptográfica X.509 Corporativa (/Sig & /ByteRange) Incorporada ao PDF
                  </div>
                  <div style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.55 }}>
                    O arquivo gerado contém campos técnicos ISO 32000 que permitem ao Adobe Acrobat Reader verificar a integridade matemática sem depender de servidores.
                  </div>
                </div>
              </div>
              <span style={{ fontSize: 11, color: '#1e40af', background: '#ffffff', border: '1px solid #bfdbfe', padding: '4px 12px', borderRadius: 8, fontWeight: 700, fontFamily: 'monospace', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                PKCS#7 Detached • SHA-256
              </span>
            </div>

            {/* Quadro de Chaves Criptográficas SHA-256 (Triplo Hash) */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: 18,
                border: '1px solid #bfdbfe',
                boxShadow: '0 4px 16px rgba(37, 99, 235, 0.04)',
                overflow: 'hidden',
              }}
            >
              {/* Cabeçalho com Gradiente Leve Azul */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(239, 246, 255, 0.95) 0%, rgba(224, 242, 254, 0.65) 100%)',
                  borderBottom: '1px solid #bfdbfe',
                  padding: '16px 22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: '#ffffff',
                      color: '#2563eb',
                      border: '1px solid #bfdbfe',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(37, 99, 235, 0.1)',
                      flexShrink: 0,
                    }}
                  >
                    <Fingerprint size={19} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      Tripla Integridade Criptográfica (SHA-256)
                    </h3>
                    <span style={{ fontSize: 11, color: '#1d4ed8', fontWeight: 700 }}>
                      Padrão FIPS 180-4 • Hashes Encadeados Anti-Adulteração
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: 11, color: '#1e40af', background: '#ffffff', border: '1px solid #bfdbfe', padding: '4px 12px', borderRadius: 8, fontWeight: 700, fontFamily: 'monospace', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                  VERIFICAÇÃO PERICIAL ATIVA
                </span>
              </div>

              <div style={{ padding: '22px 26px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                  {/* Hash Original */}
                  <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b' }}>1. Hash do Documento Original:</span>
                      <button
                        onClick={() => copyToClipboard(dossier.documentoOriginalHash, 'Hash Original')}
                        style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 6, padding: '3px 8px', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
                      >
                        {copiedHash === 'Hash Original' ? <Check size={12} color="#059669" /> : <Copy size={12} />} Copiar
                      </button>
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#0284c7', wordBreak: 'break-all', fontWeight: 600 }}>
                      {dossier.documentoOriginalHash}
                    </div>
                  </div>

                  {/* Hash Trilha */}
                  <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b' }}>2. Hash da Cadeia de Custódia:</span>
                      <button
                        onClick={() => copyToClipboard(dossier.trilhaAuditoriaHash || '', 'Hash Trilha')}
                        style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 6, padding: '3px 8px', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
                      >
                        {copiedHash === 'Hash Trilha' ? <Check size={12} color="#059669" /> : <Copy size={12} />} Copiar
                      </button>
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#b45309', wordBreak: 'break-all', fontWeight: 600 }}>
                      {dossier.trilhaAuditoriaHash || 'Calculado na finalização'}
                    </div>
                  </div>

                  {/* Hash Final Selado */}
                  <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b' }}>3. Hash do PDF Final Selado:</span>
                      <button
                        onClick={() => copyToClipboard(dossier.documentoAssinadoHash, 'Hash Final')}
                        style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 6, padding: '3px 8px', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
                      >
                        {copiedHash === 'Hash Final' ? <Check size={12} color="#059669" /> : <Copy size={12} />} Copiar
                      </button>
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#059669', wordBreak: 'break-all', fontWeight: 600 }}>
                      {dossier.documentoAssinadoHash}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Grid dos Signatários */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
              {/* Contratante / Responsável (com Mascaramento LGPD) */}
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: 18,
                  border: '1px solid #a7f3d0',
                  boxShadow: '0 4px 16px rgba(5, 150, 105, 0.04)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Cabeçalho com Gradiente Leve Esmeralda */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(236, 253, 245, 0.95) 0%, rgba(209, 250, 229, 0.65) 100%)',
                    borderBottom: '1px solid #a7f3d0',
                    padding: '16px 22px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: '#ffffff',
                        color: '#059669',
                        border: '1px solid #a7f3d0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 6px rgba(5, 150, 105, 0.1)',
                        flexShrink: 0,
                      }}
                    >
                      <User size={19} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                        Signatário / Contratante
                      </h3>
                      <span style={{ fontSize: 11, color: '#047857', fontWeight: 700 }}>
                        Identificação OTP Multicanal • LGPD Protegido
                      </span>
                    </div>
                  </div>
                  <span style={{ fontSize: 10.5, color: '#047857', background: '#ffffff', border: '1px solid #a7f3d0', padding: '4px 10px', borderRadius: 8, fontWeight: 700, fontFamily: 'monospace' }}>
                    AUTENTICAÇÃO VÁLIDA
                  </span>
                </div>

                <div style={{ padding: '22px 26px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontWeight: 800, fontSize: 17, color: '#0f172a' }}>
                    {dossier.responsavelNomeMascarado || dossier.responsavelNome}
                  </div>
                  <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
                    CPF: {dossier.responsavelCpfMascarado} • ({dossier.responsavelParentesco})
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    E-mail: {dossier.responsavelEmailMascarado || 'Protegido'} • Tel: {dossier.responsavelTelefoneMascarado || 'Protegido'}
                  </div>
                  <div style={{ fontSize: 13, color: '#1e293b', marginTop: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                    Estudante Titular: <strong>{dossier.alunoNome}</strong> ({dossier.alunoSerieTurma || 'Regular'})
                  </div>
                  <div style={{ fontSize: 12, color: '#047857', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '6px 12px', borderRadius: 8, marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                    <CheckCircle2 size={14} color="#059669" /> Confirmação OTP efetuada em: {formatDate(dossier.dataAssinatura)}
                  </div>

                  {dossier.metadadosTecnicos && (
                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f1f5f9', background: '#f8fafc', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 11.5, color: '#64748b', lineHeight: 1.65 }}>
                      • Endereço IP: {dossier.metadadosTecnicos.ip}<br />
                      • Dispositivo: {dossier.metadadosTecnicos.dispositivo}<br />
                      • Sistema Operacional: {dossier.metadadosTecnicos.sistemaOperacional}
                    </div>
                  )}
                </div>
              </div>

              {/* Contratada / Colégio Impacto */}
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: 18,
                  border: '1px solid #bfdbfe',
                  boxShadow: '0 4px 16px rgba(37, 99, 235, 0.04)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Cabeçalho com Gradiente Leve Azul */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(239, 246, 255, 0.95) 0%, rgba(219, 234, 254, 0.65) 100%)',
                    borderBottom: '1px solid #bfdbfe',
                    padding: '16px 22px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: '#ffffff',
                        color: '#2563eb',
                        border: '1px solid #bfdbfe',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 6px rgba(37, 99, 235, 0.1)',
                        flexShrink: 0,
                      }}
                    >
                      <Building2 size={19} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                        Instituição de Ensino
                      </h3>
                      <span style={{ fontSize: 11, color: '#1d4ed8', fontWeight: 700 }}>
                        Contratada • Emissora do Contrato
                      </span>
                    </div>
                  </div>
                  <span style={{ fontSize: 10.5, color: '#1d4ed8', background: '#ffffff', border: '1px solid #bfdbfe', padding: '4px 10px', borderRadius: 8, fontWeight: 700, fontFamily: 'monospace' }}>
                    CHANCELA OFICIAL
                  </span>
                </div>

                <div style={{ padding: '22px 26px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontWeight: 800, fontSize: 17, color: '#0f172a' }}>
                    {dossier.escolaRepresentante?.nome || 'IVAN ROSSI SAMBRANA'}
                  </div>
                  <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
                    Cargo: {dossier.escolaRepresentante?.cargo || 'Diretor Geral / Representante Legal'}
                  </div>
                  <div style={{ fontSize: 13, color: '#1e293b', marginTop: 10 }}>
                    {dossier.escolaRepresentante?.razaoSocial || 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA'} • CNPJ: {dossier.escolaRepresentante?.cnpj || '04.395.789/0001-88'}
                  </div>
                  <div style={{ fontSize: 12, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '6px 12px', borderRadius: 8, marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                    <CheckCircle2 size={14} color="#2563eb" /> Chancela Eletrônica Institucional Atestada
                  </div>

                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>
                      Chancela com Assinatura Oficial:
                    </div>
                    <div style={{ background: '#ffffff', borderRadius: 10, padding: '10px 18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #cbd5e1', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
                      <img
                        src="/assinatura-representante.png"
                        alt="Chancela Oficial do Diretor Geral"
                        style={{ maxHeight: 42, maxWidth: 220, objectFit: 'contain' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Trilha de Auditoria */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: 18,
                border: '1px solid #fde68a',
                boxShadow: '0 4px 16px rgba(217, 119, 6, 0.04)',
                overflow: 'hidden',
              }}
            >
              {/* Cabeçalho com Gradiente Leve Âmbar */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 251, 235, 0.95) 0%, rgba(254, 243, 199, 0.65) 100%)',
                  borderBottom: '1px solid #fde68a',
                  padding: '16px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: '#ffffff',
                      color: '#d97706',
                      border: '1px solid #fde68a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(217, 119, 6, 0.1)',
                      flexShrink: 0,
                    }}
                  >
                    <Clock size={19} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      Trilha de Auditoria (Cadeia de Custódia Imutável)
                    </h3>
                    <span style={{ fontSize: 11, color: '#b45309', fontWeight: 700 }}>
                      Registro Cronológico UTC • Integridade Forense Inviolável
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: 11, color: '#b45309', background: '#ffffff', border: '1px solid #fde68a', padding: '4px 12px', borderRadius: 8, fontWeight: 700, fontFamily: 'monospace', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                  AUDITORIA IMUTÁVEL
                </span>
              </div>

              <div style={{ padding: '24px 28px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {dossier.trilhaAuditoria?.map((ev, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 13 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563eb', border: '2px solid #ffffff', boxShadow: '0 0 0 2px #bfdbfe', marginTop: 5, flexShrink: 0 }} />
                      <div style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>
                          <span style={{ color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800, fontFamily: 'monospace', display: 'inline-block', marginRight: 8 }}>
                            {ev.evento}
                          </span>
                          {ev.descricao}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                          Data/Hora: {formatDate(ev.timestamp)} • Hash do Evento: <span style={{ fontFamily: 'monospace', color: '#0284c7', fontWeight: 600 }}>{ev.hash?.substring(0, 16)}...</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Seção Interativa de Teste de Integridade de Arquivo PDF (Drag & Drop Light Theme) */}
        <div
          style={{
            background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
            borderRadius: 22,
            padding: '36px 28px',
            border: '2px dashed #cbd5e1',
            marginTop: 32,
            textAlign: 'center',
            boxShadow: '0 4px 20px rgba(15, 23, 42, 0.02)',
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
              width: 58,
              height: 58,
              borderRadius: '50%',
              background: '#eff6ff',
              color: '#2563eb',
              border: '1px solid #dbeafe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.1)',
            }}
          >
            <Upload size={26} />
          </div>

          <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px', color: '#0f172a' }}>
            Verificador Pericial de Integridade do Arquivo PDF
          </h3>
          <p style={{ fontSize: 13.5, color: '#475569', maxWidth: 600, margin: '0 auto 18px', lineHeight: 1.6 }}>
            Deseja conferir se o arquivo PDF em suas mãos sofreu qualquer adulteração? Arraste o arquivo aqui para calcular a assinatura criptográfica SHA-256 no seu próprio dispositivo e confrontar com o banco de custódia oficial.
          </p>

          <label
            style={{
              display: 'inline-block',
              background: '#ffffff',
              border: '1.5px solid #cbd5e1',
              color: '#0f172a',
              padding: '11px 24px',
              borderRadius: 12,
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(15, 23, 42, 0.05)',
              transition: 'all 0.15s ease',
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
            <div style={{ marginTop: 16, color: '#2563eb', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 600 }}>
              <RefreshCw size={16} className="animate-spin" /> Calculando hash SHA-256 via Web Crypto API e conferindo com a custódia...
            </div>
          )}

          {resultadoArquivo && (
            <div
              style={{
                marginTop: 20,
                background: resultadoArquivo.inalterado
                  ? '#ecfdf5'
                  : '#fef2f2',
                border: resultadoArquivo.inalterado
                  ? '1.5px solid #a7f3d0'
                  : '1.5px solid #fca5a5',
                color: resultadoArquivo.inalterado ? '#047857' : '#b91c1c',
                borderRadius: 14,
                padding: '18px 22px',
                textAlign: 'left',
                boxShadow: '0 4px 14px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 14 }}>
                {resultadoArquivo.inalterado ? <CheckCircle2 size={19} color="#059669" /> : <AlertTriangle size={19} color="#dc2626" />}
                {resultadoArquivo.inalterado
                  ? 'AUTENTICIDADE E INTEGRIDADE CONFIRMADAS'
                  : 'INCONSISTÊNCIA DETECTADA'}
              </div>
              <div style={{ fontSize: 13.5, marginTop: 5, color: resultadoArquivo.inalterado ? '#064e3b' : '#7f1d1d', fontWeight: 500 }}>
                {resultadoArquivo.mensagem}
              </div>
              <div style={{ fontSize: 11.5, fontFamily: 'monospace', marginTop: 10, color: '#64748b', fontWeight: 600 }}>
                Hash SHA-256 Calculado: <span style={{ color: '#0f172a' }}>{resultadoArquivo.hash}</span>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé Institucional */}
        <footer style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
            <ShieldCheck size={14} color="#059669" /> Colégio Impacto Centro de Ensino Ltda • CNPJ: 04.395.789/0001-88
          </div>
          <div style={{ fontSize: 11.5, color: '#94a3b8' }}>
            Portal Oficial de Validação & Custódia Criptográfica Documental • Sistema Impacto EDU
          </div>
        </footer>
      </main>
    </div>
  )
}
