'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  X,
  Paperclip,
  Camera,
  Upload,
  Trash2,
  Eye,
  Download,
  FileText,
  Image as ImageIcon,
  RefreshCw,
  Check,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Smartphone,
} from 'lucide-react'
import { compressImage } from '@/lib/mediaCompressor'
import { uploadFileToSupabase } from '@/lib/upload/uploadClient'
import { formatCurrency } from '@/lib/utils'
import {
  type ContaPagarRecord,
  type AnexoContaPagarItem,
  type TipoAnexoContaPagar,
  TIPO_ANEXO_CONTA_PAGAR_CONFIG,
  STATUS_CONTA_PAGAR_CONFIG,
} from '../types'

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Falha ao ler arquivo local'))
    reader.readAsDataURL(file)
  })
}

export function inferirCategoriaAnexo(
  nomeArquivo: string,
  origem: 'upload' | 'camera',
  defaultCat: TipoAnexoContaPagar = 'comprovante'
): TipoAnexoContaPagar {
  if (origem === 'camera') return defaultCat === 'comprovante' ? 'foto' : defaultCat
  const lower = nomeArquivo.toLowerCase()
  if (lower.includes('nf') || lower.includes('nota') || lower.includes('danfe')) return 'nota_fiscal'
  if (lower.includes('bol') || lower.includes('darf') || lower.includes('guia') || lower.includes('fatura'))
    return 'boleto'
  if (lower.includes('comp') || lower.includes('pix') || lower.includes('ted') || lower.includes('recibo_pgto'))
    return 'comprovante'
  if (lower.includes('recibo')) return 'recibo'
  if (lower.includes('contrat')) return 'contrato'
  return defaultCat
}

export async function processAndUploadAnexoFile(
  rawFile: File,
  options?: {
    origem?: 'upload' | 'camera'
    categoriaAnexo?: TipoAnexoContaPagar
  }
): Promise<AnexoContaPagarItem> {
  const origem = options?.origem || 'upload'
  const categoriaAnexo =
    options?.categoriaAnexo || inferirCategoriaAnexo(rawFile.name, origem, origem === 'camera' ? 'foto' : 'comprovante')

  let fileToUpload: File = rawFile
  if (rawFile.type.startsWith('image/')) {
    try {
      fileToUpload = await compressImage(rawFile, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.82,
        format: 'image/webp',
      })
    } catch {
      fileToUpload = rawFile
    }
  }

  let finalUrl = ''
  try {
    const uploadRes = await uploadFileToSupabase({
      bucket: 'comunicados-midia',
      folder: 'contas-pagar',
      file: fileToUpload,
      usageType: 'common',
    })
    if (uploadRes.ok && uploadRes.url) {
      finalUrl = uploadRes.url
    }
  } catch {
    // Fallback local abaixo caso o storage externo falhe
  }

  if (!finalUrl) {
    // Fallback resiliente para Data URL (até 4MB) garantindo funcionamento em qualquer ambiente
    if (fileToUpload.size <= 4 * 1024 * 1024) {
      finalUrl = await fileToDataUrl(fileToUpload)
    } else {
      throw new Error('Não foi possível enviar o arquivo para o servidor de armazenamento.')
    }
  }

  return {
    id: `anx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    nome: rawFile.name || `Anexo_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}`,
    url: finalUrl,
    tipoMime: fileToUpload.type || rawFile.type || 'application/octet-stream',
    tamanho: fileToUpload.size || rawFile.size,
    categoriaAnexo,
    origem,
    criadoEm: new Date().toISOString(),
  }
}

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function isImageAttachment(item: AnexoContaPagarItem): boolean {
  if (item.tipoMime?.startsWith('image/')) return true
  if (item.url?.startsWith('data:image/')) return true
  return /\.(jpg|jpeg|png|webp|gif|bmp|heic)$/i.test(item.nome || item.url || '')
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTE DE CAPTURA DE CÂMERA AO VIVO (WEBCAM + MOBILE CAMERA)
   ═══════════════════════════════════════════════════════════════════════════ */
interface CameraCaptureBoxProps {
  codigoLancamento?: string
  categoriaPadrao?: TipoAnexoContaPagar
  onPhotoCaptured: (anexo: AnexoContaPagarItem) => Promise<void> | void
  onCancel: () => void
}

export function CameraCaptureBox({
  codigoLancamento,
  categoriaPadrao = 'foto',
  onPhotoCaptured,
  onCancel,
}: CameraCaptureBoxProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string>('')
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [categoriaAnexo, setCategoriaAnexo] = useState<TipoAnexoContaPagar>(categoriaPadrao)
  const [tituloFoto, setTituloFoto] = useState<string>(
    `Foto_${codigoLancamento || 'Lancamento'}_${new Date().toTimeString().slice(0, 5).replace(':', 'h')}.webp`
  )
  const [savingPhoto, setSavingPhoto] = useState(false)

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraReady(false)
  }, [])

  const startCamera = useCallback(
    async (mode: 'environment' | 'user') => {
      stopStream()
      setCameraError('')
      setCapturedDataUrl(null)
      setCapturedBlob(null)

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          'Seu navegador não disponibiliza câmera ao vivo nesta janela. Use o botão "Câmera do Dispositivo / Escolher Foto" abaixo.'
        )
        return
      }

      try {
        let stream: MediaStream
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: mode },
              width: { ideal: 1600 },
              height: { ideal: 1200 },
            },
            audio: false,
          })
        } catch {
          // Fallback para qualquer câmera disponível no computador/notebook
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          })
        }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setCameraReady(true)
      } catch (err: any) {
        const msg =
          err?.name === 'NotAllowedError'
            ? 'Permissão da câmera negada no navegador. Autorize o acesso à câmera ou use o botão "Abrir Câmera / Foto do Dispositivo".'
            : 'Não foi possível acessar a câmera diretamente. Você pode tirar foto pelo aplicativo da câmera ou selecionar uma imagem.'
        setCameraError(msg)
      }
    },
    [stopStream]
  )

  useEffect(() => {
    startCamera(facingMode)
    return () => {
      stopStream()
    }
  }, [facingMode, startCamera, stopStream])

  const handleSnapFrame = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const width = video.videoWidth || 1280
    const height = video.videoHeight || 960
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, width, height)

    const dataUrl = canvas.toDataURL('image/webp', 0.88)
    setCapturedDataUrl(dataUrl)

    canvas.toBlob(
      (blob) => {
        if (blob) setCapturedBlob(blob)
      },
      'image/webp',
      0.88
    )
    stopStream()
  }

  const handleConfirmCapturedPhoto = async () => {
    if (!capturedBlob && !capturedDataUrl) return
    setSavingPhoto(true)
    try {
      let blobToUse = capturedBlob
      if (!blobToUse && capturedDataUrl) {
        const res = await fetch(capturedDataUrl)
        blobToUse = await res.blob()
      }
      if (!blobToUse) return

      const safeFileName = tituloFoto.trim().endsWith('.webp') || tituloFoto.trim().endsWith('.jpg')
        ? tituloFoto.trim()
        : `${tituloFoto.trim() || 'Foto_Comprovante'}.webp`

      const fileObj = new File([blobToUse], safeFileName, { type: blobToUse.type || 'image/webp' })
      const anexoItem = await processAndUploadAnexoFile(fileObj, {
        origem: 'camera',
        categoriaAnexo,
      })
      await onPhotoCaptured(anexoItem)
    } finally {
      setSavingPhoto(false)
    }
  }

  const handleNativeCameraFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSavingPhoto(true)
    try {
      const anexoItem = await processAndUploadAnexoFile(file, {
        origem: 'camera',
        categoriaAnexo,
      })
      await onPhotoCaptured(anexoItem)
    } finally {
      setSavingPhoto(false)
      if (nativeCameraInputRef.current) nativeCameraInputRef.current.value = ''
    }
  }

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 14,
        background: '#0f172a',
        border: '1px solid #334155',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: 'rgba(56, 189, 248, 0.18)',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Camera size={16} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc' }}>
              Capturar Foto do Comprovante / Documento
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              Posicione a nota fiscal, boleto ou recibo em frente à câmera
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {!capturedDataUrl && (
            <button
              type="button"
              onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 10px',
                borderRadius: 8,
                background: '#1e293b',
                border: '1px solid #475569',
                color: '#e2e8f0',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={13} />
              Alternar Câmera
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              stopStream()
              onCancel()
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 10px',
              borderRadius: 8,
              background: 'rgba(244, 63, 94, 0.18)',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              color: '#fda4af',
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <X size={13} /> Fechar Câmera
          </button>
        </div>
      </div>

      {/* Classificação rápida da foto */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 8 }}>
        <div>
          <label
            htmlFor="cam-cat-select"
            style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}
          >
            Tipo do Documento Fotografado
          </label>
          <select
            id="cam-cat-select"
            value={categoriaAnexo}
            onChange={(e) => setCategoriaAnexo(e.target.value as TipoAnexoContaPagar)}
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: 8,
              background: '#1e293b',
              border: '1px solid #475569',
              color: '#f8fafc',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <option value="foto">Foto / Captura de Câmera</option>
            <option value="comprovante">Comprovante de Pagamento</option>
            <option value="nota_fiscal">Nota Fiscal (NF-e / NFS-e)</option>
            <option value="boleto">Boleto / DARF / Fatura</option>
            <option value="recibo">Recibo Assinado</option>
            <option value="contrato">Contrato / Ordem de Serviço</option>
            <option value="outro">Outro Documento</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="cam-nome-input"
            style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}
          >
            Identificação da Foto
          </label>
          <input
            id="cam-nome-input"
            type="text"
            value={tituloFoto}
            onChange={(e) => setTituloFoto(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: 8,
              background: '#1e293b',
              border: '1px solid #475569',
              color: '#f8fafc',
              fontSize: 12,
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Área de Vídeo ao Vivo ou Preview Capturado */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 290,
          borderRadius: 12,
          overflow: 'hidden',
          background: '#020617',
          border: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {capturedDataUrl ? (
          <img
            src={capturedDataUrl}
            alt="Foto capturada"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              background: '#020617',
            }}
          />
        ) : cameraError ? (
          <div style={{ padding: 20, textAlign: 'center', maxWidth: 420 }}>
            <AlertTriangle size={28} color="#f59e0b" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontSize: 12.5, color: '#e2e8f0', fontWeight: 600, lineHeight: 1.4 }}>{cameraError}</div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
            {/* Guia visual de enquadramento do documento */}
            <div
              style={{
                position: 'absolute',
                inset: 18,
                border: '1.5px dashed rgba(56, 189, 248, 0.55)',
                borderRadius: 10,
                pointerEvents: 'none',
              }}
            />
          </>
        )}
      </div>

      {/* Botões de Ação da Câmera */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <input
          ref={nativeCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleNativeCameraFile}
          style={{ display: 'none' }}
        />

        <button
          type="button"
          onClick={() => nativeCameraInputRef.current?.click()}
          disabled={savingPhoto}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            borderRadius: 9,
            background: '#1e293b',
            border: '1px solid #475569',
            color: '#cbd5e1',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Smartphone size={14} color="#38bdf8" />
          Câmera do Dispositivo / Galeria
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          {capturedDataUrl ? (
            <>
              <button
                type="button"
                disabled={savingPhoto}
                onClick={() => startCamera(facingMode)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 14px',
                  borderRadius: 9,
                  background: '#334155',
                  border: '1px solid #475569',
                  color: '#ffffff',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={14} />
                Tirar Outra
              </button>
              <button
                type="button"
                disabled={savingPhoto}
                onClick={handleConfirmCapturedPhoto}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 16px',
                  borderRadius: 9,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: savingPhoto ? 'wait' : 'pointer',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                }}
              >
                {savingPhoto ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} />}
                {savingPhoto ? 'Salvando Foto...' : 'Usar Esta Foto'}
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={!cameraReady || savingPhoto}
              onClick={handleSnapFrame}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '9px 18px',
                borderRadius: 99,
                background: cameraReady
                  ? 'linear-gradient(135deg, #2563eb 0%, #0284c7 100%)'
                  : '#334155',
                border: '2px solid #93c5fd',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 800,
                cursor: cameraReady ? 'pointer' : 'not-allowed',
                boxShadow: cameraReady ? '0 4px 14px rgba(37, 99, 235, 0.4)' : 'none',
              }}
            >
              <Camera size={16} />
              Bater Foto Agora
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   SEÇÃO REUTILIZÁVEL DE ANEXOS & FOTOS (PARA FORMULÁRIOS, BAIXA E FICHA)
   ═══════════════════════════════════════════════════════════════════════════ */
interface AnexosInlineSectionProps {
  anexos: AnexoContaPagarItem[]
  onChange: (novosAnexos: AnexoContaPagarItem[], acao?: string, detalhes?: string) => void
  codigoLancamento?: string
  categoriaPadrao?: TipoAnexoContaPagar
  initialOpenCamera?: boolean
  compact?: boolean
  tituloSecao?: string
}

export function AnexosInlineSection({
  anexos,
  onChange,
  codigoLancamento,
  categoriaPadrao = 'comprovante',
  initialOpenCamera = false,
  compact = false,
  tituloSecao = 'Anexos, Documentos & Fotos do Lançamento',
}: AnexosInlineSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [showCamera, setShowCamera] = useState(initialOpenCamera)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<TipoAnexoContaPagar>(categoriaPadrao)
  const [previewItem, setPreviewItem] = useState<AnexoContaPagarItem | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    if (initialOpenCamera) setShowCamera(true)
  }, [initialOpenCamera])

  const handleFilesSelected = async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    if (fileArray.length === 0) return

    setUploading(true)
    setUploadError('')
    try {
      const novos: AnexoContaPagarItem[] = []
      for (const f of fileArray) {
        if (f.size > 50 * 1024 * 1024) {
          throw new Error(`O arquivo "${f.name}" excede o limite máximo de 50MB.`)
        }
        const uploaded = await processAndUploadAnexoFile(f, {
          origem: 'upload',
          categoriaAnexo: categoriaSelecionada,
        })
        novos.push(uploaded)
      }
      const atualizados = [...anexos, ...novos]
      onChange(
        atualizados,
        novos.length === 1 ? 'Documento Anexado' : `${novos.length} Documentos Anexados`,
        `Anexado: ${novos.map((n) => n.nome).join(', ')}`
      )
    } catch (err: any) {
      setUploadError(err?.message || 'Falha ao anexar arquivo.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handlePhotoCaptured = async (novoAnexo: AnexoContaPagarItem) => {
    const atualizados = [...anexos, novoAnexo]
    onChange(
      atualizados,
      'Foto Capturada e Anexada',
      `Foto registrada via câmera: ${novoAnexo.nome}`
    )
    setShowCamera(false)
  }

  const handleRemoveAnexo = (item: AnexoContaPagarItem) => {
    const atualizados = anexos.filter((a) => a.id !== item.id)
    onChange(atualizados, 'Anexo Removido', `Arquivo removido: ${item.nome}`)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragging(false)
        if (e.dataTransfer?.files?.length) {
          handleFilesSelected(e.dataTransfer.files)
        }
      }}
      style={{
        padding: compact ? 12 : 14,
        borderRadius: 12,
        background: isDragging ? '#eff6ff' : '#f8fafc',
        border: isDragging ? '2px dashed #2563eb' : '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        transition: 'all 0.15s ease',
      }}
    >
      {/* Cabeçalho e Botões de Ação ("Anexar Arquivo" e "Tirar Foto") */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Paperclip size={15} color="#2563eb" />
          <span style={{ fontSize: 12.5, fontWeight: 800, color: '#0f172a' }}>
            {tituloSecao}
          </span>
          {anexos.length > 0 && (
            <span
              style={{
                padding: '1px 7px',
                borderRadius: 99,
                background: '#dbeafe',
                color: '#1d4ed8',
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {anexos.length}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <select
            aria-label="Classificação do anexo"
            value={categoriaSelecionada}
            onChange={(e) => setCategoriaSelecionada(e.target.value as TipoAnexoContaPagar)}
            style={{
              padding: '6px 9px',
              borderRadius: 8,
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              fontSize: 11.5,
              fontWeight: 700,
            }}
          >
            <option value="comprovante">Tipo: Comprovante</option>
            <option value="nota_fiscal">Tipo: Nota Fiscal</option>
            <option value="boleto">Tipo: Boleto / Guia</option>
            <option value="recibo">Tipo: Recibo</option>
            <option value="contrato">Tipo: Contrato</option>
            <option value="foto">Tipo: Foto</option>
            <option value="outro">Tipo: Outro Doc</option>
          </select>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
            onChange={(e) => {
              if (e.target.files) handleFilesSelected(e.target.files)
            }}
            style={{ display: 'none' }}
          />

          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px',
              borderRadius: 8,
              background: '#ffffff',
              border: '1px solid #93c5fd',
              color: '#1d4ed8',
              fontSize: 12,
              fontWeight: 700,
              cursor: uploading ? 'wait' : 'pointer',
              boxShadow: '0 1px 3px rgba(37, 99, 235, 0.08)',
            }}
          >
            {uploading ? <Loader2 size={14} /> : <Upload size={14} />}
            {uploading ? 'Enviando...' : 'Anexar Arquivo'}
          </button>

          <button
            type="button"
            disabled={uploading}
            onClick={() => setShowCamera((v) => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px',
              borderRadius: 8,
              background: showCamera
                ? '#0f172a'
                : 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
              border: 'none',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(109, 40, 217, 0.22)',
            }}
          >
            <Camera size={14} />
            {showCamera ? 'Ocultar Câmera' : 'Tirar Foto'}
          </button>
        </div>
      </div>

      {uploadError && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            color: '#be123c',
            fontSize: 12,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <AlertTriangle size={14} />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Caixa de Câmera ao Vivo quando acionada */}
      {showCamera && (
        <CameraCaptureBox
          codigoLancamento={codigoLancamento}
          categoriaPadrao={categoriaSelecionada === 'comprovante' ? 'foto' : categoriaSelecionada}
          onPhotoCaptured={handlePhotoCaptured}
          onCancel={() => setShowCamera(false)}
        />
      )}

      {/* Lista / Galeria de Anexos */}
      {anexos.length === 0 ? (
        !showCamera && (
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: compact ? '10px 12px' : '14px 16px',
              borderRadius: 10,
              border: '1.5px dashed #cbd5e1',
              background: '#ffffff',
              textAlign: 'center',
              color: '#64748b',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Nenhum anexo ou foto neste lançamento. Clique em <strong>Anexar Arquivo</strong>,{' '}
            <strong>Tirar Foto</strong> ou arraste arquivos (PDF, PNG, JPG) aqui.
          </div>
        )
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
            gap: 8,
          }}
        >
          {anexos.map((item) => {
            const isImg = isImageAttachment(item)
            const catCfg =
              TIPO_ANEXO_CONTA_PAGAR_CONFIG[item.categoriaAnexo || 'outro'] ||
              TIPO_ANEXO_CONTA_PAGAR_CONFIG.outro

            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
                }}
              >
                {/* Miniatura ou Ícone */}
                <div
                  onClick={() => {
                    if (isImg) setPreviewItem(item)
                    else window.open(item.url, '_blank', 'noopener,noreferrer')
                  }}
                  title="Clique para visualizar"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    overflow: 'hidden',
                    background: isImg ? '#0f172a' : '#eff6ff',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    cursor: 'pointer',
                  }}
                >
                  {isImg ? (
                    <img
                      src={item.url}
                      alt={item.nome}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <FileText size={20} color="#2563eb" />
                  )}
                </div>

                {/* Metadados */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#0f172a',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={item.nome}
                  >
                    {item.nome}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: 99,
                        color: catCfg.color,
                        background: catCfg.bg,
                        border: `1px solid ${catCfg.border}`,
                      }}
                    >
                      {catCfg.label}
                    </span>
                    {item.origem === 'camera' && (
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          color: '#6d28d9',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 2,
                        }}
                      >
                        <Camera size={10} /> Câmera
                      </span>
                    )}
                    {item.tamanho ? (
                      <span style={{ fontSize: 10, color: '#64748b' }}>{formatBytes(item.tamanho)}</span>
                    ) : null}
                  </div>
                </div>

                {/* Ações do Anexo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <button
                    type="button"
                    title="Visualizar anexo"
                    onClick={() => {
                      if (isImg) setPreviewItem(item)
                      else window.open(item.url, '_blank', 'noopener,noreferrer')
                    }}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      color: '#0369a1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    {isImg ? <Eye size={13} /> : <ExternalLink size={13} />}
                  </button>

                  <a
                    href={item.url}
                    download={item.nome}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Baixar arquivo"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      color: '#334155',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textDecoration: 'none',
                    }}
                  >
                    <Download size={13} />
                  </a>

                  <button
                    type="button"
                    title="Remover anexo"
                    onClick={() => handleRemoveAnexo(item)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      background: '#fff1f2',
                      border: '1px solid #fecdd3',
                      color: '#be123c',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Lightbox de Visualização de Foto / Imagem */}
      {previewItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Visualização de ${previewItem.nome}`}
          onClick={() => setPreviewItem(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1350,
            background: 'rgba(15, 23, 42, 0.82)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '92vw',
              maxHeight: '88vh',
              background: '#0f172a',
              borderRadius: 16,
              border: '1px solid #334155',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ color: '#f8fafc', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ImageIcon size={16} color="#38bdf8" />
                <span>{previewItem.nome}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <a
                  href={previewItem.url}
                  download={previewItem.nome}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 12px',
                    borderRadius: 8,
                    background: '#1e293b',
                    border: '1px solid #475569',
                    color: '#e2e8f0',
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  <Download size={13} /> Baixar
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: '#1e293b',
                    border: '1px solid #475569',
                    color: '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <img
              src={previewItem.url}
              alt={previewItem.nome}
              style={{
                maxWidth: '86vw',
                maxHeight: '76vh',
                objectFit: 'contain',
                borderRadius: 10,
                background: '#020617',
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL DIRETO DE ANEXOS E CÂMERA PARA UM LANÇAMENTO DA TABELA
   ═══════════════════════════════════════════════════════════════════════════ */
interface AnexosLancamentoModalProps {
  conta: ContaPagarRecord | null
  initialMode?: 'arquivos' | 'camera'
  onClose: () => void
  onUpdateAnexos: (
    contaId: string,
    novosAnexos: AnexoContaPagarItem[],
    acaoHistorico?: string,
    detalhesHistorico?: string
  ) => Promise<void>
}

export function AnexosLancamentoModal({
  conta,
  initialMode = 'arquivos',
  onClose,
  onUpdateAnexos,
}: AnexosLancamentoModalProps) {
  const [localAnexos, setLocalAnexos] = useState<AnexoContaPagarItem[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (conta) {
      setLocalAnexos(Array.isArray(conta.anexos) ? conta.anexos : [])
    }
  }, [conta])

  if (!conta) return null

  const stCfg = STATUS_CONTA_PAGAR_CONFIG[conta.status] || STATUS_CONTA_PAGAR_CONFIG.pendente

  const handleAnexosChange = async (
    atualizados: AnexoContaPagarItem[],
    acao?: string,
    detalhes?: string
  ) => {
    setLocalAnexos(atualizados)
    setSaving(true)
    try {
      await onUpdateAnexos(conta.id, atualizados, acao, detalhes)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-anexos-lcto-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'rgba(15, 23, 42, 0.58)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 700,
          maxHeight: '92vh',
          background: '#ffffff',
          borderRadius: 18,
          border: '1px solid #cbd5e1',
          boxShadow: '0 25px 60px rgba(15, 23, 42, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 99,
                  fontSize: 10.5,
                  fontWeight: 800,
                  color: stCfg.color,
                  background: stCfg.bg,
                  border: `1px solid ${stCfg.border}`,
                }}
              >
                {stCfg.label}
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: '#0369a1', fontFamily: 'monospace' }}>
                {conta.codigo || conta.id}
              </span>
              {conta.numeroDocumento && (
                <span style={{ fontSize: 11.5, color: '#475569', fontWeight: 700 }}>
                  • {conta.tipoDocumento || 'Doc'}: {conta.numeroDocumento}
                </span>
              )}
              <span style={{ fontSize: 12, fontWeight: 900, color: '#047857' }}>
                • {formatCurrency(conta.valor)}
              </span>
            </div>
            <h2
              id="modal-anexos-lcto-title"
              style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 800, color: '#0f172a' }}
            >
              {conta.fornecedorNome}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de anexos"
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <AnexosInlineSection
            anexos={localAnexos}
            onChange={handleAnexosChange}
            codigoLancamento={conta.codigo || conta.id}
            initialOpenCamera={initialMode === 'camera'}
            tituloSecao="Central de Anexos, Comprovantes & Fotos deste Lançamento"
          />
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 22px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
            {saving
              ? 'Sincronizando anexos com o lançamento...'
              : `${localAnexos.length} arquivo(s) / foto(s) vinculado(s) a este lançamento`}
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: 9,
              background: '#0f172a',
              border: 'none',
              color: '#ffffff',
              fontSize: 12.5,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  )
}
