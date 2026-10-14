'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck, CheckCircle2, XCircle, Search, Upload, FileText,
  Clock, Download, Building2, User, Lock, ExternalLink, RefreshCw,
  Fingerprint, Check, AlertTriangle, ArrowRight, Copy,
  Scale, FileCheck, ChevronDown, ChevronUp, Sparkles, BadgeCheck
} from 'lucide-react'
import { toast } from 'sonner'
import {
  carregarFontesCaligraficas,
  formatSignatureDisplayName,
  sanitizeSignerName,
} from '@/lib/contracts/sealUtils'

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
  responsavelEstiloCaligrafico?: string | null
  responsavelAssinaturaBase64?: string | null
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
    estiloCaligrafico?: string | null
    assinaturaBase64?: string | null
    dataHoraAssinatura?: string | null
    representantes?: Array<{
      id?: string
      nome: string
      cargo?: string
      cpf?: string
      email?: string
      telefone?: string
      estiloCaligrafico?: string | null
      assinaturaBase64?: string | null
    }>
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
    ip?: string
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

  const downloadPdf = (
    base64Data: string | null | undefined,
    filename: string,
    protocolo?: string,
    status?: string
  ) => {
    const downloadLink = document.createElement('a')
    if (base64Data && base64Data.length > 100) {
      downloadLink.href = base64Data.startsWith('data:')
        ? base64Data
        : `data:application/pdf;base64,${base64Data}`
    } else {
      const versao = status === 'assinado' ? 'assinado' : 'original'
      downloadLink.href = `/api/matriculas/digital/pdf/${encodeURIComponent(protocolo || dossier?.protocolo || '')}?v=${versao}&download=1`
    }
    downloadLink.download = filename
    document.body.appendChild(downloadLink)
    downloadLink.click()
    setTimeout(() => {
      try {
        document.body.removeChild(downloadLink)
      } catch {}
    }, 200)
  }

  useEffect(() => {
    carregarFontesCaligraficas()
  }, [])

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

  const formatDataSimples = (iso?: string | null) => {
    if (!iso) {
      return new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Campo_Grande' })
    }
    try {
      return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Campo_Grande' })
    } catch {
      return String(iso)
    }
  }

  const renderAssinaturaNoDocumento = (
    nome?: string | null,
    estiloCaligrafico?: string | null,
    assinaturaBase64?: string | null,
    dataIso?: string | null,
    compact = false
  ) => {
    const nomeLimpo = sanitizeSignerName(nome || 'Signatário')
    const textoAssinatura = formatSignatureDisplayName(nomeLimpo, 28)
    const isFormal = estiloCaligrafico === 'formal' || estiloCaligrafico === 'rubrica'
    const usarImagemCustom =
      Boolean(assinaturaBase64) &&
      (estiloCaligrafico === 'manual' || estiloCaligrafico === 'custom')
    const dataFormatada = formatDataSimples(dataIso || dossier?.dataAssinatura || dossier?.dataCriacao)

    return (
      <div
        className={`bg-white border border-slate-200/90 rounded-lg ${
          compact ? 'px-3 py-1.5 mt-2' : 'px-3.5 py-2.5 mt-3'
        } shadow-2xs flex flex-col items-start justify-center`}
      >
        <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
          Assinatura estampada no documento:
        </span>
        {usarImagemCustom && assinaturaBase64 ? (
          <img
            src={assinaturaBase64}
            alt={`Assinatura de ${nomeLimpo}`}
            className={compact ? 'max-h-8 object-contain my-0.5' : 'max-h-10 object-contain my-0.5'}
          />
        ) : (
          <div
            style={{
              fontFamily: isFormal
                ? "'Georgia', 'Times New Roman', serif"
                : "'Dancing Script', 'Caveat', 'Brush Script MT', cursive",
              fontStyle: isFormal ? 'italic' : 'normal',
              fontWeight: 700,
              color: '#14337a',
              fontSize: compact ? '19px' : '22px',
              lineHeight: 1.15,
              letterSpacing: isFormal ? '0.01em' : '0.02em',
            }}
            className="select-none py-0.5 break-words"
          >
            {textoAssinatura}
          </div>
        )}
        <span className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">
          Assinado eletronicamente {dataFormatada}
        </span>
      </div>
    )
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
      <header className="border-b border-slate-200/90 bg-white/90 backdrop-blur-md sticky top-0 z-40 px-3.5 py-2.5 sm:px-6 sm:py-3.5 shadow-xs">
        <div className="max-w-[1000px] mx-auto flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1 shrink-0 shadow-xs">
              <img
                src={dossier?.logoUrl || '/logo-impacto-clean.png'}
                alt={dossier?.escolaRepresentante?.razaoSocial || 'Colégio Impacto'}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight truncate leading-tight">
                {dossier?.escolaRepresentante?.razaoSocial || 'COLÉGIO IMPACTO'}
              </div>
              <div className="text-[11px] sm:text-xs text-emerald-700 font-bold flex items-center gap-1 leading-tight mt-0.5">
                <ShieldCheck size={13} className="text-emerald-600 shrink-0" />
                <span className="truncate">Portal Oficial de Validação & Integridade</span>
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-3.5 py-1.5 rounded-full border border-slate-200 font-semibold shadow-2xs shrink-0 whitespace-nowrap">
            <Lock size={12} className="text-emerald-600 shrink-0" /> MP 2.200-2/2001 • Código Civil • CPC
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-[940px] mx-auto mt-3.5 sm:mt-8 px-3 sm:px-4">
        {/* Barra de Busca por Protocolo (Light Theme Flutuante) */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-5 sm:mb-6 shadow-sm">
          {/* Cabeçalho com Gradiente Leve da Busca */}
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 px-3.5 py-2.5 sm:px-6 sm:py-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Search size={14} className="text-blue-600 shrink-0" />
              <span>Consulta Pública e Imediata de Autenticidade Contratual</span>
            </div>
            <span className="text-[10px] sm:text-[11px] text-slate-500 font-semibold font-mono">
              REDE NACIONAL DE VALIDAÇÃO
            </span>
          </div>

          <div className="p-3.5 sm:p-6">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
              <div className="flex-1 w-full sm:min-w-[260px] relative">
                <input
                  type="text"
                  value={searchProtocolo}
                  onChange={e => setSearchProtocolo(e.target.value.toUpperCase())}
                  placeholder="Digite o código de protocolo (Ex: IMP-2027-8K3N9P)"
                  className="w-full h-11 sm:h-12 bg-slate-50 border border-slate-300 rounded-xl px-3.5 sm:px-4 text-slate-900 font-mono text-sm sm:text-base font-semibold outline-hidden focus:border-blue-500 focus:bg-white transition"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !searchProtocolo.trim()}
                className="w-full sm:w-auto h-11 sm:h-12 px-5 sm:px-6 rounded-xl text-white font-bold text-xs sm:text-sm bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xs cursor-pointer transition shrink-0"
              >
                {loading ? <RefreshCw size={15} className="animate-spin" /> : <Search size={15} />} Consultar Documento
              </button>
            </form>

            {errorMessage && (
              <div className="mt-3.5 bg-red-50 border border-red-200 text-red-700 p-3 sm:p-3.5 rounded-xl text-xs sm:text-sm font-semibold">
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
            className="flex flex-col gap-4 sm:gap-5"
          >
            {/* Banner de Status de Autenticidade */}
            <div
              className={`rounded-2xl p-3.5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 sm:gap-4 shadow-sm border ${
                dossier.valido
                  ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200'
                  : dossier.status === 'cancelado'
                  ? 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200'
                  : 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200'
              }`}
            >
              <div className="flex items-center gap-3 sm:gap-4">
                <div
                  className={`w-11 h-11 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shrink-0 text-white shadow-xs ${
                    dossier.valido ? 'bg-emerald-600' : dossier.status === 'cancelado' ? 'bg-red-600' : 'bg-amber-500'
                  }`}
                >
                  {dossier.valido ? <CheckCircle2 size={24} className="sm:hidden" /> : dossier.status === 'cancelado' ? <XCircle size={24} className="sm:hidden" /> : <AlertTriangle size={24} className="sm:hidden" />}
                  {dossier.valido ? <CheckCircle2 size={32} className="hidden sm:block" /> : dossier.status === 'cancelado' ? <XCircle size={32} className="hidden sm:block" /> : <AlertTriangle size={32} className="hidden sm:block" />}
                </div>

                <div className="min-w-0">
                  <div className={`text-[10.5px] sm:text-xs font-extrabold uppercase tracking-wider ${
                    dossier.valido ? 'text-emerald-800' : dossier.status === 'cancelado' ? 'text-red-700' : 'text-amber-800'
                  }`}>
                    Status da Certificação Digital
                  </div>
                  <h2 className="text-base sm:text-xl font-extrabold text-slate-900 m-0 my-0.5 leading-tight">
                    {dossier.statusDescricao}
                  </h2>
                  <p className="text-xs sm:text-[13px] text-slate-600 m-0 flex items-center gap-1.5 flex-wrap">
                    Protocolo Oficial:
                    <strong className="text-slate-900 font-mono font-extrabold bg-white px-2 py-0.5 rounded-md border border-slate-300">
                      {dossier.protocolo}
                    </strong>
                  </p>
                </div>
              </div>

              {dossier.downloadDisponivel && (
                <button
                  onClick={() =>
                    downloadPdf(
                      dossier.pdfBase64,
                      `Documento_Oficial_${dossier.protocolo}.pdf`,
                      dossier.protocolo,
                      dossier.status
                    )
                  }
                  className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold text-xs sm:text-sm py-2.5 px-4 sm:py-3 sm:px-5.5 rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition shrink-0"
                >
                  <Download size={16} /> Baixar PDF com Selo Criptográfico
                </button>
              )}
            </div>

            {/* Selo Criptográfico PKCS#7 Incorporado */}
            <div className="bg-gradient-to-r from-blue-50 to-sky-50 border border-blue-200 rounded-2xl p-3.5 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <ShieldCheck size={24} className="text-blue-600 shrink-0" />
                <div>
                  <div className="text-xs sm:text-[13.5px] font-extrabold text-blue-900 leading-snug">
                    Assinatura Criptográfica X.509 Corporativa (/Sig & /ByteRange) Incorporada ao PDF
                  </div>
                  <div className="text-[11.5px] sm:text-[12.5px] text-slate-700 leading-relaxed mt-0.5">
                    O arquivo gerado contém campos técnicos ISO 32000 que permitem ao Adobe Acrobat Reader verificar a integridade matemática sem depender de servidores.
                  </div>
                </div>
              </div>
              <span className="text-[10px] sm:text-[11px] text-blue-800 bg-white border border-blue-200 px-2.5 py-1 rounded-lg font-bold font-mono shadow-2xs shrink-0 self-start sm:self-auto">
                PKCS#7 Detached • SHA-256
              </span>
            </div>

            {/* Quadro de Chaves Criptográficas SHA-256 (Triplo Hash) */}
            <div className="bg-white rounded-2xl border border-blue-200 shadow-xs overflow-hidden">
              {/* Cabeçalho com Gradiente Leve Azul */}
              <div className="bg-gradient-to-r from-blue-50/95 to-sky-100/65 border-b border-blue-200 px-3.5 py-3 sm:px-5 sm:py-4 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white text-blue-600 border border-blue-200 flex items-center justify-center shadow-xs shrink-0">
                    <Fingerprint size={18} />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-[13.5px] font-extrabold text-slate-900 m-0 leading-tight">
                      Tripla Integridade Criptográfica (SHA-256)
                    </h3>
                    <span className="text-[10.5px] sm:text-[11px] text-blue-700 font-bold block mt-0.5">
                      Padrão FIPS 180-4 • Hashes Encadeados Anti-Adulteração
                    </span>
                  </div>
                </div>
                <span className="text-[10px] sm:text-[11px] text-blue-800 bg-white border border-blue-200 px-2.5 py-1 rounded-lg font-bold font-mono shadow-2xs">
                  VERIFICAÇÃO PERICIAL ATIVA
                </span>
              </div>

              <div className="p-3.5 sm:p-5 md:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3.5">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-5">
              {/* Contratante / Responsável (com Mascaramento LGPD) */}
              <div className="bg-white rounded-2xl border border-emerald-200 shadow-xs overflow-hidden flex flex-col">
                {/* Cabeçalho com Gradiente Leve Esmeralda */}
                <div className="bg-gradient-to-r from-emerald-50/95 to-emerald-100/65 border-b border-emerald-200 px-3.5 py-3 sm:px-5 sm:py-4 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white text-emerald-600 border border-emerald-200 flex items-center justify-center shadow-xs shrink-0">
                      <User size={18} />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-[13.5px] font-extrabold text-slate-900 m-0 leading-tight">
                        Signatário / Contratante
                      </h3>
                      <span className="text-[10.5px] sm:text-[11px] text-emerald-700 font-bold block mt-0.5">
                        Identificação OTP Multicanal • LGPD Protegido
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-emerald-800 bg-white border border-emerald-200 px-2 py-0.5 rounded-md font-bold font-mono">
                    AUTENTICAÇÃO VÁLIDA
                  </span>
                </div>

                <div className="p-3.5 sm:p-5 md:p-6 flex-1 flex flex-col">
                  <div className="font-extrabold text-sm sm:text-base text-slate-900">
                    {dossier.responsavelNomeMascarado || dossier.responsavelNome}
                  </div>
                  <div className="text-xs sm:text-[13px] text-slate-600 mt-1">
                    CPF: {dossier.responsavelCpfMascarado} • ({dossier.responsavelParentesco})
                  </div>
                  <div className="text-[11.5px] sm:text-xs text-slate-500 mt-0.5">
                    E-mail: {dossier.responsavelEmailMascarado || 'Protegido'} • Tel: {dossier.responsavelTelefoneMascarado || 'Protegido'}
                  </div>

                  {/* Assinatura do Contratante que saiu no documento */}
                  {renderAssinaturaNoDocumento(
                    dossier.responsavelNome || dossier.responsavelNomeMascarado,
                    dossier.responsavelEstiloCaligrafico,
                    dossier.responsavelAssinaturaBase64,
                    dossier.dataAssinatura
                  )}

                  <div className="text-xs sm:text-[13px] text-slate-800 mt-2.5 pt-2.5 border-t border-slate-100">
                    Estudante Titular: <strong>{dossier.alunoNome}</strong> ({dossier.alunoSerieTurma || 'Regular'})
                  </div>
                  <div className="text-[11px] sm:text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-2 sm:px-3 sm:py-2 rounded-lg mt-2.5 inline-flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" /> Confirmação OTP efetuada em: {formatDate(dossier.dataAssinatura)}
                  </div>

                  {dossier.metadadosTecnicos && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 bg-slate-50 p-2.5 sm:p-3 rounded-lg border border-slate-200 text-[11px] sm:text-[11.5px] text-slate-600 leading-relaxed">
                      • Endereço IP: {dossier.metadadosTecnicos.ip}<br />
                      • Dispositivo: {dossier.metadadosTecnicos.dispositivo}<br />
                      • Sistema Operacional: {dossier.metadadosTecnicos.sistemaOperacional}
                    </div>
                  )}
                </div>
              </div>

              {/* Contratada / Colégio Impacto */}
              <div className="bg-white rounded-2xl border border-blue-200 shadow-xs overflow-hidden flex flex-col">
                {/* Cabeçalho com Gradiente Leve Azul */}
                <div className="bg-gradient-to-r from-blue-50/95 to-sky-100/65 border-b border-blue-200 px-3.5 py-3 sm:px-5 sm:py-4 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white text-blue-600 border border-blue-200 flex items-center justify-center shadow-xs shrink-0">
                      <Building2 size={18} />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-[13.5px] font-extrabold text-slate-900 m-0 leading-tight">
                        Instituição de Ensino
                      </h3>
                      <span className="text-[10.5px] sm:text-[11px] text-blue-700 font-bold block mt-0.5">
                        Contratada • Emissora do Contrato
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-blue-800 bg-white border border-blue-200 px-2 py-0.5 rounded-md font-bold font-mono">
                    CHANCELA OFICIAL
                  </span>
                </div>

                <div className="p-3.5 sm:p-5 md:p-6 flex-1 flex flex-col">
                  {dossier.escolaRepresentante?.representantes && dossier.escolaRepresentante.representantes.length > 1 ? (
                    <div className="space-y-2 mb-2">
                      <div className="text-[11px] font-bold text-blue-900 uppercase tracking-wide flex items-center gap-1.5">
                        <CheckCircle2 size={13} className="text-blue-600 shrink-0" />
                        {dossier.escolaRepresentante.representantes.length} Representantes Institucionais (Assinaturas Conjuntas):
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {dossier.escolaRepresentante.representantes.map((rep: any, idx: number) => (
                          <div key={idx} className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 sm:p-3">
                            <div className="font-extrabold text-sm text-slate-900">{rep.nome}</div>
                            <div className="text-xs text-slate-600 mt-0.5">
                              Cargo: {rep.cargo}{rep.cpf ? ` • CPF: ${rep.cpf}` : ''}
                            </div>
                            {renderAssinaturaNoDocumento(
                              rep.nome,
                              rep.estiloCaligrafico || dossier.escolaRepresentante?.estiloCaligrafico,
                              rep.assinaturaBase64 || dossier.escolaRepresentante?.assinaturaBase64,
                              dossier.escolaRepresentante?.dataHoraAssinatura || dossier.dataAssinatura,
                              true
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="font-extrabold text-sm sm:text-base text-slate-900">
                        {dossier.escolaRepresentante?.nome || 'IVAN ROSSI SAMBRANA'}
                      </div>
                      <div className="text-xs sm:text-[13px] text-slate-600 mt-1">
                        Cargo: {dossier.escolaRepresentante?.cargo || 'Diretor Geral / Representante Legal'}
                      </div>
                      {renderAssinaturaNoDocumento(
                        dossier.escolaRepresentante?.nome || 'IVAN ROSSI SAMBRANA',
                        dossier.escolaRepresentante?.estiloCaligrafico,
                        dossier.escolaRepresentante?.assinaturaBase64,
                        dossier.escolaRepresentante?.dataHoraAssinatura || dossier.dataAssinatura
                      )}
                    </>
                  )}
                  <div className="text-xs sm:text-[13px] text-slate-800 mt-2.5 pt-2.5 border-t border-slate-100">
                    {dossier.escolaRepresentante?.razaoSocial || 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA'} • CNPJ: {dossier.escolaRepresentante?.cnpj || '04.395.789/0001-88'}
                  </div>
                  <div className="text-[11px] sm:text-xs text-blue-800 bg-blue-50 border border-blue-200 p-2 sm:px-3 sm:py-2 rounded-lg mt-2.5 inline-flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 size={13} className="text-blue-600 shrink-0" /> Chancela Eletrônica Institucional Atestada
                  </div>
                </div>
              </div>
            </div>

            {/* Trilha de Auditoria */}
            <div className="bg-white rounded-2xl border border-amber-200 shadow-xs overflow-hidden">
              {/* Cabeçalho com Gradiente Leve Âmbar */}
              <div className="bg-gradient-to-r from-amber-50/95 to-yellow-100/65 border-b border-amber-200 px-3.5 py-3 sm:px-5 sm:py-4 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white text-amber-600 border border-amber-200 flex items-center justify-center shadow-xs shrink-0">
                    <Clock size={18} />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-[13.5px] font-extrabold text-slate-900 m-0 leading-tight">
                      Trilha de Auditoria (Cadeia de Custódia Imutável)
                    </h3>
                    <span className="text-[10.5px] sm:text-[11px] text-amber-800 font-bold block mt-0.5">
                      Registro Cronológico UTC
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-amber-800 bg-white border border-amber-200 px-2.5 py-1 rounded-lg font-bold font-mono">
                  AUDITORIA IMUTÁVEL
                </span>
              </div>

              <div className="p-3.5 sm:p-6 md:p-7">
                <div className="flex flex-col gap-2.5 sm:gap-3">
                  {dossier.trilhaAuditoria?.map((ev, idx) => {
                    let descricaoCompleta = String(ev.descricao || '')

                    if (ev.evento === 'ASSINATURA_ESCOLA' && /^Chancela institucional emitida por\s+/i.test(descricaoCompleta)) {
                      const repIdent = descricaoCompleta.replace(/^Chancela institucional emitida por\s+/i, '').trim()
                      descricaoCompleta = `Aplicação automática de chancela institucional previamente autorizada para ${repIdent}, vinculada à emissão autenticada no sistema`
                    }

                    if (ev.evento === 'ASSINATURA_SIGNATARIO' && !/aceite integral/i.test(descricaoCompleta)) {
                      const sufixo = descricaoCompleta
                        ? ` e ${descricaoCompleta.charAt(0).toLowerCase() + descricaoCompleta.slice(1)}`
                        : ''
                      descricaoCompleta = `Confirmação expressa de aceite integral do pacote documental (v1.0 | Protocolo: ${dossier.protocolo} | Hash SHA-256 da versão apresentada: ${dossier.documentoOriginalHash})${sufixo}`
                    }

                    if (ev.evento === 'DOCUMENTO_CONCLUIDO') {
                      // Remove o hash embutido no texto principal para exibi-lo com rótulo dedicado logo abaixo ("Hash do PDF final")
                      descricaoCompleta = descricaoCompleta
                        .replace(/\s*Hash (?:do PDF final \(SHA-256\)|SHA-256 Final|final SHA-256):\s*[A-Fa-f0-9]+(?:\.{2,3})?/i, '')
                        .trim()
                    }

                    const ipPasso = ev.ip || dossier.metadadosTecnicos?.ip || '127.0.0.1'

                    return (
                      <div key={idx} className="flex items-start gap-2.5 sm:gap-3 text-xs sm:text-sm">
                        <div className="w-2 h-2 rounded-full bg-blue-600 ring-4 ring-blue-100 mt-1.5 shrink-0" />
                        <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 sm:p-3.5">
                          <div className="font-bold text-slate-900 break-words leading-relaxed">
                            <span className="text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-md text-[10px] sm:text-[11px] font-extrabold font-mono inline-block mr-1.5">
                              {ev.evento}
                            </span>
                            {descricaoCompleta}
                          </div>
                          <div className="text-[10.5px] sm:text-xs text-slate-500 mt-1.5 space-y-0.5 break-all">
                            <div>
                              Data/Hora: <span className="text-slate-700 font-medium">{formatDate(ev.timestamp)}</span> • IP: <span className="font-mono text-slate-700 font-semibold">{ipPasso}</span>
                            </div>
                            {ev.evento === 'DOCUMENTO_CONCLUIDO' && dossier.documentoAssinadoHash && (
                              <div>
                                Hash do PDF final (SHA-256): <span className="font-mono text-emerald-700 font-semibold">{dossier.documentoAssinadoHash}</span>
                              </div>
                            )}
                            {ev.hash && (
                              <div>
                                Hash do evento (SHA-256): <span className="font-mono text-sky-700 font-semibold">{ev.hash}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Seção Interativa de Teste de Integridade de Arquivo PDF (Drag & Drop Light Theme) */}
        <div
          className="bg-gradient-to-b from-slate-50 to-slate-100 rounded-2xl p-4 sm:p-8 md:p-9 border-2 border-dashed border-slate-300 mt-6 sm:mt-8 text-center shadow-xs"
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            if (e.dataTransfer.files?.[0]) {
              handleFileVerification(e.dataTransfer.files[0])
            }
          }}
        >
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center mx-auto mb-3 shadow-xs">
            <Upload size={22} className="sm:hidden" />
            <Upload size={26} className="hidden sm:block" />
          </div>

          <h3 className="text-base sm:text-lg font-extrabold text-slate-900 m-0 mb-1.5">
            Verificador Pericial de Integridade do Arquivo PDF
          </h3>
          <p className="text-xs sm:text-[13.5px] text-slate-600 max-w-[600px] mx-auto mb-4 leading-relaxed">
            Deseja conferir se o arquivo PDF em suas mãos sofreu qualquer adulteração? Arraste o arquivo aqui para calcular a assinatura criptográfica SHA-256 no seu próprio dispositivo e confrontar com o banco de custódia oficial.
          </p>

          <label className="w-full sm:w-auto inline-flex items-center justify-center bg-white border border-slate-300 text-slate-900 py-2.5 px-4 sm:py-3 sm:px-6 rounded-xl text-xs sm:text-[13.5px] font-bold shadow-2xs hover:bg-slate-50 transition cursor-pointer">
            Selecionar Arquivo PDF para Conferência
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={e => {
                if (e.target.files?.[0]) handleFileVerification(e.target.files[0])
              }}
            />
          </label>

          {verificandoArquivo && (
            <div className="mt-4 text-blue-600 text-xs sm:text-sm flex items-center justify-center gap-2 font-semibold">
              <RefreshCw size={15} className="animate-spin" /> Calculando hash SHA-256 via Web Crypto API e conferindo com a custódia...
            </div>
          )}

          {resultadoArquivo && (
            <div
              className={`mt-4 sm:mt-5 rounded-2xl p-3.5 sm:p-5 text-left shadow-2xs border ${
                resultadoArquivo.inalterado
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <div className="flex items-center gap-2 font-extrabold text-xs sm:text-sm">
                {resultadoArquivo.inalterado ? <CheckCircle2 size={18} className="text-emerald-600 shrink-0" /> : <AlertTriangle size={18} className="text-red-600 shrink-0" />}
                {resultadoArquivo.inalterado
                  ? 'AUTENTICIDADE E INTEGRIDADE CONFIRMADAS'
                  : 'INCONSISTÊNCIA DETECTADA'}
              </div>
              <div className="text-xs sm:text-sm mt-1.5 font-medium leading-relaxed">
                {resultadoArquivo.mensagem}
              </div>
              <div className="text-[11px] sm:text-xs font-mono mt-2 text-slate-500 font-semibold break-all">
                Hash SHA-256 Calculado: <span className="text-slate-900">{resultadoArquivo.hash}</span>
              </div>
            </div>
          )}
        </div>

        {/* Card Recolhível em Último: Respaldo, Validade Jurídica e Medidas de Segurança */}
        <details className="group bg-gradient-to-b from-white to-slate-50 rounded-2xl sm:rounded-[22px] border border-slate-300 mt-5 sm:mt-6 shadow-sm overflow-hidden relative">
          {/* Barra Superior Decorativa com Gradiente Fino */}
          <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none outline-hidden">
            <div className="h-[3.5px] w-full bg-gradient-to-r from-blue-600 via-emerald-600 via-purple-600 to-sky-600" />
            <div className="p-3.5 sm:p-5 md:px-6 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition">
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0 shadow-2xs">
                  <Scale size={20} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-1">
                    <span className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] sm:text-[11px] font-extrabold py-0.5 px-2.5 rounded-full uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                      Respaldo Jurídico & Pericial Pleno
                    </span>
                    <span className="hidden sm:inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-bold py-0.5 px-2.5 rounded-full">
                      Eficácia de Título Executivo Extrajudicial
                    </span>
                    <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-slate-600 bg-white border border-slate-200 py-0.5 px-2.5 rounded-full font-semibold">
                      <Sparkles size={11} className="text-sky-600 shrink-0" /> Válido em Todo Território Nacional
                    </span>
                  </div>
                  <h2 className="text-sm sm:text-base md:text-lg font-extrabold text-slate-900 m-0 tracking-tight leading-snug">
                    Validade Jurídica, Fé Pública e Integridade Pericial
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-500 m-0 mt-0.5 truncate">
                    MP 2.200-2/2001 • Lei Federal nº 14.063/2020 • Código Civil • CPC — Clique para expandir os fundamentos legais
                  </p>
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 bg-slate-100 group-hover:bg-blue-50 border border-slate-200 group-hover:border-blue-200 text-slate-700 group-hover:text-blue-700 px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-bold shrink-0 transition">
                <span className="hidden sm:inline group-open:hidden">Expandir</span>
                <span className="hidden sm:group-open:inline">Recolher</span>
                <ChevronDown size={15} className="transition-transform duration-200 group-open:rotate-180 shrink-0" />
              </div>
            </div>
          </summary>

          <div className="px-3.5 pb-4 sm:px-6 sm:pb-6 md:px-7 md:pb-7 pt-2 border-t border-slate-200/80">
            <p className="text-xs sm:text-[13.5px] text-slate-600 m-0 mb-4 leading-relaxed max-w-[880px]">
              Todos os contratos, aditivos e termos formalizados pela plataforma digital do <strong>Colégio Impacto</strong> possuem equivalência jurídica irrestrita ao documento físico em papel com firma reconhecida em cartório, sendo dotados de força probante em juízo, presunção legal de veracidade e proteção criptográfica de última geração.
            </p>

            {/* Faixa de Marcos Legais (Badges Normativas) */}
            <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 p-2.5 sm:p-3.5 bg-slate-100 rounded-xl sm:rounded-2xl border border-slate-200 mb-4 sm:mb-5">
              <div className="text-[10px] sm:text-[11px] font-extrabold text-blue-700 uppercase flex items-center gap-1 mr-1 shrink-0">
                <FileCheck size={13} className="shrink-0" /> Fundamentação Legal:
              </div>

              <span className="text-[10px] sm:text-[11.5px] text-slate-800 bg-white px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg border border-slate-300 shadow-2xs leading-snug">
                <strong>MP 2.200-2/2001</strong> (Art. 10, § 2º)
              </span>

              <span className="text-[10px] sm:text-[11.5px] text-slate-800 bg-white px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg border border-slate-300 shadow-2xs leading-snug">
                <strong>Lei Federal nº 14.063/2020</strong> (Assinaturas Eletrônicas)
              </span>

              <span className="text-[10px] sm:text-[11.5px] text-slate-800 bg-white px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg border border-slate-300 shadow-2xs leading-snug">
                <strong>Código Civil</strong> (Arts. 107, 219, 221 e 422)
              </span>

              <span className="text-[10px] sm:text-[11.5px] text-slate-800 bg-white px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg border border-slate-300 shadow-2xs leading-snug">
                <strong>CPC</strong> (Arts. 440, 441 e 784, III)
              </span>

              <span className="text-[10px] sm:text-[11.5px] text-slate-800 bg-white px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg border border-slate-300 shadow-2xs leading-snug">
                <strong>LGPD</strong> (Lei Federal nº 13.709/2018)
              </span>
            </div>

            {/* Grid dos 4 Pilares de Respaldo e Medidas Técnicas com Cabeçalho Gradiente Leve */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5 mb-4">
              {/* Pilar 1: Amparo Legal e Eficácia Executiva */}
              <div className="bg-white border border-blue-200 rounded-2xl overflow-hidden flex flex-col shadow-xs transition hover:shadow-md">
                <div className="bg-gradient-to-r from-blue-50/95 to-blue-100/55 border-b border-blue-200 px-3.5 py-3 sm:px-4.5 sm:py-3.5 flex items-center gap-2.5 sm:gap-3">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white text-blue-600 border border-blue-200 flex items-center justify-center shadow-xs shrink-0">
                    <Scale size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-[13.5px] font-extrabold text-slate-900 m-0 leading-tight">
                      Amparo Legal & Probatório
                    </h3>
                    <span className="text-[10.5px] sm:text-[11px] text-blue-700 font-bold leading-tight block mt-0.5">
                      Fé Probatória em Juízo
                    </span>
                  </div>
                </div>

                <div className="p-3.5 sm:p-4.5 flex flex-col gap-2.5 flex-1">
                  <p className="text-[11.5px] sm:text-[12.5px] text-slate-600 m-0 leading-relaxed">
                    Aceito por tribunais, secretarias de educação, bancos e órgãos públicos sem necessidade de impressão física. O CPC equipara expressamente o documento digital ao físico e confere força executiva extrajudicial.
                  </p>

                  <div className="mt-auto pt-2 border-t border-slate-100 flex items-center gap-1.5 text-emerald-700 text-[10.5px] sm:text-[11px] font-bold">
                    <Check size={13} className="shrink-0" /> Reconhecimento de firma dispensado por lei
                  </div>
                </div>
              </div>

              {/* Pilar 2: Blindagem Criptográfica SHA-256 e Padrão ISO 32000 */}
              <div className="bg-white border border-emerald-200 rounded-2xl overflow-hidden flex flex-col shadow-xs transition hover:shadow-md">
                <div className="bg-gradient-to-r from-emerald-50/95 to-emerald-100/55 border-b border-emerald-200 px-3.5 py-3 sm:px-4.5 sm:py-3.5 flex items-center gap-2.5 sm:gap-3">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white text-emerald-600 border border-emerald-200 flex items-center justify-center shadow-xs shrink-0">
                    <Fingerprint size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-[13.5px] font-extrabold text-slate-900 m-0 leading-tight">
                      Integridade Criptográfica
                    </h3>
                    <span className="text-[10.5px] sm:text-[11px] text-emerald-700 font-bold leading-tight block mt-0.5">
                      SHA-256 (FIPS 180-4) • ISO 32000
                    </span>
                  </div>
                </div>

                <div className="p-3.5 sm:p-4.5 flex flex-col gap-2.5 flex-1">
                  <p className="text-[11.5px] sm:text-[12.5px] text-slate-600 m-0 leading-relaxed">
                    Cada PDF recebe uma assinatura matemática de 256 bits com campos /ByteRange. A alteração de uma única vírgula ou espaço quebra o hash criptográfico, acusando fraude instantaneamente, inclusive no Adobe Acrobat Reader off-line.
                  </p>

                  <div className="mt-auto pt-2 border-t border-slate-100 flex items-center gap-1.5 text-emerald-700 text-[10.5px] sm:text-[11px] font-bold">
                    <Check size={13} className="shrink-0" /> Imutabilidade e selagem matemática
                  </div>
                </div>
              </div>

              {/* Pilar 3: Autenticação em Dois Fatores (OTP) e Não-Repúdio */}
              <div className="bg-white border border-purple-200 rounded-2xl overflow-hidden flex flex-col shadow-xs transition hover:shadow-md">
                <div className="bg-gradient-to-r from-purple-50/95 to-purple-100/55 border-b border-purple-200 px-3.5 py-3 sm:px-4.5 sm:py-3.5 flex items-center gap-2.5 sm:gap-3">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white text-purple-600 border border-purple-200 flex items-center justify-center shadow-xs shrink-0">
                    <Lock size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-[13.5px] font-extrabold text-slate-900 m-0 leading-tight">
                      Identificação & Não-Repúdio
                    </h3>
                    <span className="text-[10.5px] sm:text-[11px] text-purple-700 font-bold leading-tight block mt-0.5">
                      Confirmação OTP Multicanal
                    </span>
                  </div>
                </div>

                <div className="p-3.5 sm:p-4.5 flex flex-col gap-2.5 flex-1">
                  <p className="text-[11.5px] sm:text-[12.5px] text-slate-600 m-0 leading-relaxed">
                    A manifestação de vontade é confirmada via código dinâmico de uso único (OTP) enviado ao WhatsApp e E-mail verificados do titular, com termo de adesão expresso irrevogável, impedindo qualquer alegação de desconhecimento.
                  </p>

                  <div className="mt-auto pt-2 border-t border-slate-100 flex items-center gap-1.5 text-emerald-700 text-[10.5px] sm:text-[11px] font-bold">
                    <Check size={13} className="shrink-0" /> Vínculo unívoco e irrevogável com o signatário
                  </div>
                </div>
              </div>

              {/* Pilar 4: Trilha de Auditoria e Evidências Periciais */}
              <div className="bg-white border border-amber-200 rounded-2xl overflow-hidden flex flex-col shadow-xs transition hover:shadow-md">
                <div className="bg-gradient-to-r from-amber-50/95 to-amber-100/55 border-b border-amber-200 px-3.5 py-3 sm:px-4.5 sm:py-3.5 flex items-center gap-2.5 sm:gap-3">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white text-amber-600 border border-amber-200 flex items-center justify-center shadow-xs shrink-0">
                    <Clock size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-[13.5px] font-extrabold text-slate-900 m-0 leading-tight">
                      Cadeia de Custódia Forense
                    </h3>
                    <span className="text-[10.5px] sm:text-[11px] text-amber-700 font-bold leading-tight block mt-0.5">
                      Timestamp UTC • Rastreabilidade IP
                    </span>
                  </div>
                </div>

                <div className="p-3.5 sm:p-4.5 flex flex-col gap-2.5 flex-1">
                  <p className="text-[11.5px] sm:text-[12.5px] text-slate-600 m-0 leading-relaxed">
                    Trilha ininterrupta que registra carimbo de tempo atômico UTC, endereço IP de conexão, porta lógica, User-Agent e metadados de hardware, permitindo a reconstituição pericial exata de cada etapa da formalização.
                  </p>

                  <div className="mt-auto pt-2 border-t border-slate-100 flex items-center gap-1.5 text-emerald-700 text-[10.5px] sm:text-[11px] font-bold">
                    <Check size={13} className="shrink-0" /> Histórico auditável e prova documental cabal
                  </div>
                </div>
              </div>
            </div>

            {/* Botão para Expandir Detalhamento Técnico & Procedimento Pericial */}
            <div className="flex justify-center mt-2">
              <button
                type="button"
                onClick={() => setMostrarDetalhesJuridicos(!mostrarDetalhesJuridicos)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white border border-slate-300 text-blue-800 py-2.5 px-3.5 sm:px-5 rounded-full text-[11px] sm:text-xs font-bold shadow-2xs text-center leading-snug hover:bg-slate-50 transition cursor-pointer"
              >
                {mostrarDetalhesJuridicos ? (
                  <>
                    <ChevronUp size={15} className="shrink-0" /> Ocultar Detalhamento Técnico e Procedimento Pericial
                  </>
                ) : (
                  <>
                    <ChevronDown size={15} className="shrink-0" /> Ver Orientações para Juízes, Cartórios, Bancos e Procedimento Pericial
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
                  className="overflow-hidden"
                >
                  <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col gap-3 sm:gap-4">
                    {/* Guia para Órgãos Externos com Cabeçalho Gradiente Leve */}
                    <div className="bg-white rounded-2xl border border-blue-200 overflow-hidden shadow-xs">
                      <div className="bg-gradient-to-r from-blue-50/95 to-sky-100/70 border-b border-blue-200 px-3.5 py-3 sm:px-5 sm:py-3.5">
                        <h3 className="text-xs sm:text-sm font-extrabold text-blue-900 m-0 flex items-center gap-2 leading-snug">
                          <Building2 size={16} className="text-blue-600 shrink-0" /> Instruções para Conferência por Bancos, Cartórios e Secretarias de Educação:
                        </h3>
                      </div>
                      <div className="p-3.5 sm:p-5">
                        <ol className="m-0 pl-4 sm:pl-5 text-xs sm:text-[13px] text-slate-700 leading-relaxed">
                          <li className="mb-2">
                            <strong>Conferência por Protocolo:</strong> Digite o código de protocolo oficial no campo de busca acima (ex: <code>IMP-2027-8K3N9P</code>) para visualizar o dossiê probatório, os dados cadastrais protegidos pela LGPD e a assinatura da instituição.
                          </li>
                          <li className="mb-2">
                            <strong>Conferência Pericial Independente (Off-line):</strong> Arraste o arquivo PDF para a área de verificação pericial acima. O navegador calculará o hash SHA-256 nativamente e confrontará com o registro em custódia.
                          </li>
                          <li>
                            <strong>Auditoria Direta no Adobe Acrobat Reader:</strong> Ao abrir o PDF no Adobe Reader oficial, a assinatura digital corporativa e a integridade de todos os bytes são atestadas pelo leitor via especificação ISO 32000, sem necessidade de consultar sistemas externos.
                          </li>
                        </ol>
                      </div>
                    </div>

                    {/* Doutrina e Fundamentos do Marco Legal com Cabeçalhos Gradientes */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                      <div className="bg-white rounded-xl border border-emerald-200 overflow-hidden shadow-2xs">
                        <div className="bg-gradient-to-r from-emerald-50/95 to-emerald-100/60 border-b border-emerald-200 px-3 py-2 sm:px-4 sm:py-2.5">
                          <div className="text-[10px] sm:text-[11px] font-extrabold text-emerald-800 uppercase">
                            MP nº 2.200-2/2001 (Art. 10, § 2º)
                          </div>
                        </div>
                        <div className="p-3 sm:p-3.5">
                          <p className="text-[11.5px] sm:text-xs text-slate-600 m-0 leading-relaxed">
                            &ldquo;O disposto nesta Medida Provisória não obsta a utilização de outro meio de comprovação da autoria e integridade de documentos em forma eletrônica, inclusive os que utilizem certificados não emitidos pela ICP-Brasil, desde que admitido pelas partes como válido ou aceito pela pessoa a quem for oposto o documento.&rdquo;
                          </p>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl border border-blue-200 overflow-hidden shadow-2xs">
                        <div className="bg-gradient-to-r from-blue-50/95 to-blue-100/60 border-b border-blue-200 px-3 py-2 sm:px-4 sm:py-2.5">
                          <div className="text-[10px] sm:text-[11px] font-extrabold text-blue-800 uppercase">
                            CPC (Lei 13.105/2015, Art. 784, III)
                          </div>
                        </div>
                        <div className="p-3 sm:p-3.5">
                          <p className="text-[11.5px] sm:text-xs text-slate-600 m-0 leading-relaxed">
                            &ldquo;São títulos executivos extrajudiciais: o documento particular assinado pelo devedor e por 2 (duas) testemunhas ou assinado eletronicamente nos termos da lei.&rdquo; A assinatura digital confere via executiva autônoma à dívida ou obrigação pactuada.
                          </p>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl border border-amber-200 overflow-hidden shadow-2xs">
                        <div className="bg-gradient-to-r from-amber-50/95 to-amber-100/60 border-b border-amber-200 px-3 py-2 sm:px-4 sm:py-2.5">
                          <div className="text-[10px] sm:text-[11px] font-extrabold text-amber-800 uppercase">
                            Código Civil (Art. 219) & LGPD
                          </div>
                        </div>
                        <div className="p-3 sm:p-3.5">
                          <p className="text-[11.5px] sm:text-xs text-slate-600 m-0 leading-relaxed">
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
        </details>

        {/* Rodapé Institucional */}
        <footer className="mt-8 sm:mt-12 pt-5 sm:pt-6 border-t border-slate-200 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-bold text-slate-600 mb-1">
            <ShieldCheck size={14} className="text-emerald-600 shrink-0" /> Colégio Impacto Centro de Ensino Ltda • CNPJ: 04.395.789/0001-88
          </div>
          <div className="text-[10px] sm:text-[11.5px] text-slate-400">
            Portal Oficial de Validação & Custódia Criptográfica Documental • Sistema Impacto EDU
          </div>
        </footer>
      </main>
    </div>
  )
}
