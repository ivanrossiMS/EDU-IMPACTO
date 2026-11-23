'use client'

import React, { useState, useEffect, useRef, useId, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  PenTool,
  CalendarClock,
  CheckCircle2,
  Copy,
  Check,
  Printer,
  History,
  Lock,
  Loader2,
  Eraser,
  X,
  FileBadge2,
  AlertTriangle,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api/apiClient'
import {
  ESTILOS_CHANCELA,
  carregarFontesCaligraficas,
  formatarCPF,
  gerarAssinaturaCaligraficaCanvas,
  sanitizeSignerName,
  validarCPF,
} from '@/lib/contracts/sealUtils'
import {
  AutorizacaoSaidaComprovante,
  formatDateTimeSchoolBR,
} from '@/lib/autorizacoes/saidaSozinhoUtils'

interface AutorizacaoSaidaSozinhoSectionProps {
  aluno: any
  isStudentView?: boolean
  isMirroring?: boolean
  currentLoggedUserName?: string
  compact?: boolean
  onStatusUpdated?: (newAutorizado: boolean, comprovante: AutorizacaoSaidaComprovante) => void
}

function escapeHtml(text?: string | null): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function legacyCopyText(text: string): boolean {
  const field = Object.assign(document.createElement('textarea'), { value: text })
  field.setAttribute('readonly', '')
  field.style.cssText = 'position:fixed;inset-block-start:0;opacity:0'
  document.body.append(field)
  field.select()
  try {
    return document.execCommand('copy')
  } finally {
    field.remove()
  }
}

export function AutorizacaoSaidaSozinhoSection({
  aluno,
  isStudentView = false,
  isMirroring = false,
  currentLoggedUserName = 'Responsável',
  compact = false,
  onStatusUpdated,
}: AutorizacaoSaidaSozinhoSectionProps) {
  const queryClient = useQueryClient()
  const alunoId = aluno?.id ? String(aluno.id) : ''

  const headingId = useId()
  const dialogTitleId = useId()
  const protocoloElId = useId()
  const comprovanteBodyId = useId()
  const signerNameInputId = useId()
  const cpfInputId = useId()
  const obsInputId = useId()
  const consentCheckId = useId()
  const formHintId = useId()

  // Query dedicada para status + comprovante + histórico
  const { data: saidaData, refetch: refetchSaida, isFetching } = useQuery({
    queryKey: ['agenda', 'autorizacao-saida', alunoId],
    queryFn: async () => {
      if (!alunoId) return null
      const res = await apiFetch(`/api/agenda/autorizacao-saida?aluno_id=${encodeURIComponent(alunoId)}`)
      if (!res.ok) return null
      return res.json()
    },
    enabled: !!alunoId,
    staleTime: 15_000,
  })

  const fallbackRawAut =
    aluno?.autorizadoSairSozinho ??
    aluno?.dados?.autorizadoSairSozinho ??
    aluno?.saude?.autorizaSaida ??
    aluno?.dados?.saude?.autorizaSaida

  const fallbackAutorizado =
    fallbackRawAut === true ||
    (typeof fallbackRawAut === 'string' && ['true', 'sim', 's', '1', 'autorizado'].includes(fallbackRawAut.trim().toLowerCase()))

  const autorizado: boolean =
    typeof saidaData?.autorizadoSairSozinho === 'boolean'
      ? saidaData.autorizadoSairSozinho
      : fallbackAutorizado

  const fallbackComprovante: AutorizacaoSaidaComprovante | null =
    aluno?.dados?.autorizacaoSairSozinhoComprovante &&
    Boolean(aluno.dados.autorizacaoSairSozinhoComprovante.autorizado) === autorizado
      ? aluno.dados.autorizacaoSairSozinhoComprovante
      : null

  const comprovanteAtual: AutorizacaoSaidaComprovante | null =
    saidaData !== undefined ? (saidaData?.comprovanteAtual ?? null) : fallbackComprovante

  const historico: AutorizacaoSaidaComprovante[] = Array.isArray(saidaData?.historico)
    ? saidaData.historico
    : []

  const canAuthorizeFromApi = saidaData?.canAuthorize ?? !isStudentView
  const canAuthorize = Boolean(canAuthorizeFromApi && !isStudentView && !isMirroring)

  const currentSigner = saidaData?.currentSigner || {
    nome: currentLoggedUserName,
    parentesco: 'Responsável Legal',
    email: '',
    cpfMascarado: '',
  }

  // Estados da UI na página
  const [isComprovanteExpanded, setIsComprovanteExpanded] = useState(false)
  const comprovanteBodyRef = useRef<HTMLDivElement | null>(null)
  const [showHistorico, setShowHistorico] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [copyStatusMsg, setCopyStatusMsg] = useState('')
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastAnnouncementRef = useRef<string>('')

  useEffect(() => {
    setIsComprovanteExpanded(false)
    setShowHistorico(false)
  }, [alunoId])

  useEffect(() => {
    const el = comprovanteBodyRef.current
    if (!el) return
    const handleBeforeMatch = () => setIsComprovanteExpanded(true)
    el.addEventListener('beforematch', handleBeforeMatch)
    return () => el.removeEventListener('beforematch', handleBeforeMatch)
  }, [comprovanteAtual?.protocolo])

  // Estados do Dialog nativo (<dialog>)
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [targetAutorizar, setTargetAutorizar] = useState<boolean>(true)
  const [tipoAssinatura, setTipoAssinatura] = useState<'manual' | 'caligrafica'>('manual')
  const [estiloCaligrafico, setEstiloCaligrafico] = useState<string>('classica')
  const [assinaturaTexto, setAssinaturaTexto] = useState<string>('')
  const [cpfInput, setCpfInput] = useState<string>('')
  const [obsInput, setObsInput] = useState<string>('')
  const [aceitouTermo, setAceitouTermo] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Canvas de desenho manual
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDrawingRef = useRef(false)
  const strokesRef = useRef<Array<Array<{ x: number; y: number }>>>([])
  const [hasManualDrawing, setHasManualDrawing] = useState(false)

  useEffect(() => {
    carregarFontesCaligraficas()
  }, [])

  // Sincroniza nome sugerido quando abrir o modal
  const openSignatureDialog = (nextAutorizar: boolean) => {
    setTargetAutorizar(nextAutorizar)
    setTipoAssinatura('manual')
    setEstiloCaligrafico('classica')
    setAssinaturaTexto(sanitizeSignerName(currentSigner?.nome || currentLoggedUserName || ''))
    setCpfInput('')
    setObsInput('')
    setAceitouTermo(false)
    setSubmitError(null)
    setHasManualDrawing(false)
    strokesRef.current = []

    const dialog = dialogRef.current
    if (dialog) {
      if (!dialog.open) {
        dialog.showModal()
      }
      setIsDialogOpen(true)
    }
  }

  const closeSignatureDialog = useCallback(() => {
    if (isSubmitting) return
    const dialog = dialogRef.current
    if (dialog && dialog.open) {
      dialog.close('')
    }
    setIsDialogOpen(false)
  }, [isSubmitting])

  // Inicializa contexto 2D do canvas sempre que modo manual estiver ativo
  useEffect(() => {
    if (!isDialogOpen || tipoAssinatura !== 'manual' || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = '#0f2757'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    }
  }, [isDialogOpen, tipoAssinatura])

  // Listeners nativos de <dialog> (close, cancel, e fallback light-dismiss para Safari)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleClose = () => {
      dialog.returnValue = ''
      setIsDialogOpen(false)
    }

    const handleCancel = (e: Event) => {
      if (isSubmitting) {
        e.preventDefault()
      }
    }

    dialog.addEventListener('close', handleClose)
    dialog.addEventListener('cancel', handleCancel)

    let removeFallback: (() => void) | undefined
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      let pressedOutside = false
      const isOutside = (e: PointerEvent) => {
        const r = dialog.getBoundingClientRect()
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
      }
      const onPointerDown = (e: PointerEvent) => {
        if (!dialog.open) return
        pressedOutside = isOutside(e)
      }
      const onPointerUp = (e: PointerEvent) => {
        if (!dialog.open || isSubmitting) return
        if (pressedOutside && isOutside(e)) {
          dialog.close('')
        }
        pressedOutside = false
      }
      dialog.addEventListener('pointerdown', onPointerDown)
      dialog.addEventListener('pointerup', onPointerUp)
      removeFallback = () => {
        dialog.removeEventListener('pointerdown', onPointerDown)
        dialog.removeEventListener('pointerup', onPointerUp)
      }
    }

    return () => {
      dialog.removeEventListener('close', handleClose)
      dialog.removeEventListener('cancel', handleCancel)
      removeFallback?.()
    }
  }, [isSubmitting])

  // Drawing handlers com Pointer Events
  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / (rect.width || 1)
    const scaleY = canvas.height / (rect.height || 1)
    return {
      x: Math.max(0, Math.min(canvas.width, (e.clientX - rect.left) * scaleX)),
      y: Math.max(0, Math.min(canvas.height, (e.clientY - rect.top) * scaleY)),
    }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    e.currentTarget.setPointerCapture(e.pointerId)
    const pt = getCanvasPoint(e)
    isDrawingRef.current = true
    strokesRef.current.push([pt])

    ctx.beginPath()
    ctx.moveTo(pt.x, pt.y)
    ctx.lineTo(pt.x + 0.1, pt.y + 0.1)
    ctx.stroke()
    setHasManualDrawing(true)
    if (submitError) setSubmitError(null)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    const pt = getCanvasPoint(e)
    const currentStroke = strokesRef.current[strokesRef.current.length - 1]
    if (currentStroke) {
      currentStroke.push(pt)
    }

    ctx.lineTo(pt.x, pt.y)
    ctx.stroke()
  }

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
  }

  const handleClearCanvas = () => {
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx?.clearRect(0, 0, canvas.width, canvas.height)
    }
    strokesRef.current = []
    setHasManualDrawing(false)
  }

  const buildSvgPathFromStrokes = (): string | null => {
    const strokes = strokesRef.current
    if (!strokes || strokes.length === 0) return null
    const segments: string[] = []
    for (const stroke of strokes) {
      if (!stroke || stroke.length === 0) continue
      const first = stroke[0]
      segments.push(`M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`)
      if (stroke.length === 1) {
        segments.push(`L ${(first.x + 0.5).toFixed(1)} ${(first.y + 0.5).toFixed(1)}`)
      } else {
        for (let i = 1; i < stroke.length; i++) {
          const prev = stroke[i - 1]
          const curr = stroke[i]
          if (Math.hypot(curr.x - prev.x, curr.y - prev.y) < 1.2 && i < stroke.length - 1) {
            continue
          }
          segments.push(`L ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`)
        }
      }
    }
    return segments.length > 0 ? segments.join(' ') : null
  }

  const handleCopyProtocolo = async (textToCopy: string) => {
    if (!textToCopy) return
    clearTimeout(copyTimerRef.current ?? undefined)

    let ok = false
    try {
      await navigator.clipboard.writeText(textToCopy)
      ok = true
    } catch {
      ok = legacyCopyText(textToCopy)
    }

    let msg = ok ? 'Protocolo copiado' : 'Falha ao copiar'
    if (msg === lastAnnouncementRef.current) {
      msg += '\u00A0'
    }
    lastAnnouncementRef.current = msg

    setCopyState(ok ? 'copied' : 'failed')
    setCopyStatusMsg('')
    requestAnimationFrame(() => setCopyStatusMsg(msg))

    copyTimerRef.current = setTimeout(() => {
      setCopyState('idle')
      setCopyStatusMsg('')
    }, 2200)
  }

  const handleSubmitAuthorization = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    setSubmitError(null)

    if (!aceitouTermo) {
      setSubmitError('Marque a declaração de ciência e responsabilidade antes de assinar.')
      return
    }

    const cpfDigits = cpfInput.replace(/\D/g, '')
    if (cpfDigits.length !== 11 || !validarCPF(cpfDigits)) {
      setSubmitError('O CPF do responsável é obrigatório. Informe os 11 dígitos de um CPF válido para assinar.')
      return
    }

    let assinaturaSvgPath: string | null = null
    let assinaturaBase64: string | null = null
    const cleanTexto = sanitizeSignerName(assinaturaTexto || currentSigner?.nome || currentLoggedUserName)

    if (tipoAssinatura === 'manual') {
      assinaturaSvgPath = buildSvgPathFromStrokes()
      if (!hasManualDrawing || !assinaturaSvgPath || !canvasRef.current) {
        setSubmitError('Desenhe sua assinatura no quadro acima antes de confirmar.')
        return
      }
      assinaturaBase64 = canvasRef.current.toDataURL('image/png')
    } else {
      if (!cleanTexto || cleanTexto.length < 2) {
        setSubmitError('Informe seu nome completo para gerar a assinatura digital.')
        return
      }
      assinaturaBase64 = gerarAssinaturaCaligraficaCanvas(cleanTexto, estiloCaligrafico) || null
    }

    setIsSubmitting(true)
    try {
      const res = await apiFetch('/api/agenda/autorizacao-saida', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alunoId,
          autorizar: targetAutorizar,
          tipoAssinatura,
          assinaturaTexto: cleanTexto,
          assinaturaSvgPath,
          assinaturaBase64,
          estiloCaligrafico,
          cpfResponsavel: cpfDigits,
          observacoes: obsInput.trim() || undefined,
          aceitouTermo: true,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json.error || 'Não foi possível registrar a autorização.')
      }

      // Atualiza cache localStorage de meusAlunos para manter consistência imediata
      if (typeof window !== 'undefined') {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i)
            if (k && k.startsWith('edu-meus-alunos-')) {
              const raw = localStorage.getItem(k)
              if (!raw) continue
              const parsed = JSON.parse(raw)
              const updateItem = (item: any) => {
                if (item && String(item.id) === alunoId) {
                  return {
                    ...item,
                    autorizadoSairSozinho: targetAutorizar,
                    dados: {
                      ...(item.dados || {}),
                      autorizadoSairSozinho: targetAutorizar,
                      autorizacaoSairSozinhoComprovante: json.comprovante,
                    },
                  }
                }
                return item
              }
              if (Array.isArray(parsed)) {
                localStorage.setItem(k, JSON.stringify(parsed.map(updateItem)))
              } else if (Array.isArray(parsed?.alunos)) {
                localStorage.setItem(k, JSON.stringify({ ...parsed, alunos: parsed.alunos.map(updateItem) }))
              }
            }
          }
        } catch {}
        window.dispatchEvent(
          new CustomEvent('ad:aluno-saida-updated', {
            detail: {
              alunoId,
              autorizado: targetAutorizar,
              comprovante: json.comprovante,
            },
          })
        )
      }

      toast.success(
        targetAutorizar
          ? 'Saída sozinho autorizada e comprovante assinado!'
          : 'Saída sozinho desautorizada e comprovante registrado!'
      )

      const dialog = dialogRef.current
      if (dialog && dialog.open) {
        dialog.close('')
      }
      setIsDialogOpen(false)
      setIsComprovanteExpanded(true)

      await Promise.all([
        refetchSaida(),
        queryClient.invalidateQueries({ queryKey: ['aluno', alunoId] }),
        queryClient.invalidateQueries({ queryKey: ['alunos'] }),
      ])

      if (json.comprovante && onStatusUpdated) {
        onStatusUpdated(targetAutorizar, json.comprovante)
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Erro ao salvar assinatura.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePrintComprovante = () => {
    if (!comprovanteAtual || typeof window === 'undefined') return

    const sigVisualHtml =
      comprovanteAtual.tipoAssinatura === 'manual' && comprovanteAtual.assinaturaSvgPath
        ? `<svg viewBox="0 0 500 140" style="width:260px;height:74px;display:block;margin:0 auto;"><path d="${escapeHtml(
            comprovanteAtual.assinaturaSvgPath
          )}" fill="none" stroke="#0f2757" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" /></svg>`
        : comprovanteAtual.assinaturaBase64
          ? `<img src="${escapeHtml(comprovanteAtual.assinaturaBase64)}" alt="Assinatura" style="max-height:74px;max-width:260px;display:block;margin:0 auto;object-fit:contain;" />`
          : `<div style="font-family:${
              comprovanteAtual.estiloCaligrafico === 'formal' ? 'Georgia, serif' : "'Dancing Script', cursive, serif"
            };font-size:28px;font-style:italic;color:#0f2757;padding:12px 0;">${escapeHtml(
              comprovanteAtual.assinaturaTexto || comprovanteAtual.assinanteNome
            )}</div>`

    const statusColor = comprovanteAtual.autorizado ? '#047857' : '#be123c'
    const statusBg = comprovanteAtual.autorizado ? '#ecfdf5' : '#fff1f2'
    const statusLabel = comprovanteAtual.autorizado
      ? 'AUTORIZADO A SAIR SOZINHO'
      : 'SAÍDA RESTRITA (DESAUTORIZADO)'

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Comprovante ${escapeHtml(comprovanteAtual.protocolo)} - Colégio Impacto</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Inter:wght@400;600;700;800&display=swap" />
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; color: #0f172a; margin: 0; padding: 32px; background: #fff; }
    .sheet { max-width: 720px; margin: 0 auto; border: 1.5px solid #cbd5e1; border-radius: 16px; overflow: hidden; }
    .top { background: linear-gradient(135deg, #312e81 0%, #4f46e5 100%); color: #fff; padding: 22px 26px; display: flex; justify-content: space-between; align-items: center; }
    .top h1 { margin: 0; font-size: 18px; font-weight: 800; }
    .top p { margin: 4px 0 0; font-size: 12px; opacity: 0.9; }
    .proto { font-family: monospace; font-size: 12px; background: rgba(255,255,255,0.16); padding: 6px 10px; border-radius: 8px; }
    .body { padding: 24px 26px; }
    .badge { display: inline-block; padding: 7px 14px; border-radius: 999px; font-size: 12px; font-weight: 800; color: ${statusColor}; background: ${statusBg}; border: 1px solid ${statusColor}33; margin-bottom: 18px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; }
    .cell { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px; }
    .lbl { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; }
    .val { font-size: 13.5px; font-weight: 700; color: #0f172a; margin-top: 3px; }
    .term { font-size: 12.5px; line-height: 1.55; color: #334155; background: #f8fafc; border-left: 3px solid #4f46e5; padding: 12px 14px; border-radius: 6px; margin-bottom: 22px; }
    .sig-box { border: 1px dashed #94a3b8; border-radius: 12px; padding: 16px; text-align: center; background: #fff; }
    .sig-line { border-top: 1px solid #cbd5e1; max-width: 320px; margin: 10px auto 0; padding-top: 6px; font-size: 12px; font-weight: 700; color: #334155; }
    .foot { font-size: 10.5px; color: #64748b; margin-top: 18px; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 12px; }
    @media print { body { padding: 0; } .sheet { border: 1px solid #cbd5e1; } }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="top">
      <div>
        <h1>Colégio Impacto — Comprovante Oficial de Saída</h1>
        <p>Registro eletrônico de autorização / revogação de saída desacompanhada</p>
      </div>
      <div class="proto">${escapeHtml(comprovanteAtual.protocolo)}</div>
    </div>
    <div class="body">
      <div class="badge">${statusLabel}</div>
      <div class="grid">
        <div class="cell"><div class="lbl">Aluno(a)</div><div class="val">${escapeHtml(comprovanteAtual.alunoNome || aluno?.nome)}</div></div>
        <div class="cell"><div class="lbl">Matrícula</div><div class="val">#${escapeHtml(comprovanteAtual.alunoMatricula || aluno?.matricula || aluno?.id)}</div></div>
        <div class="cell"><div class="lbl">Responsável Signatário</div><div class="val">${escapeHtml(comprovanteAtual.assinanteNome)}</div></div>
        <div class="cell"><div class="lbl">Data e Hora (MS)</div><div class="val">${escapeHtml(comprovanteAtual.dataHoraFormatada)}</div></div>
      </div>
      ${
        comprovanteAtual.termoAceite
          ? `<div class="term">${escapeHtml(comprovanteAtual.termoAceite)}</div>`
          : ''
      }
      ${
        comprovanteAtual.observacoes
          ? `<div class="cell" style="margin-bottom:18px;"><div class="lbl">Observação</div><div class="val" style="font-weight:600;">${escapeHtml(
              comprovanteAtual.observacoes
            )}</div></div>`
          : ''
      }
      <div class="sig-box">
        ${sigVisualHtml}
        <div class="sig-line">${escapeHtml(comprovanteAtual.assinanteNome)} (${escapeHtml(
      comprovanteAtual.assinanteParentesco || 'Responsável'
    )})</div>
      </div>
      <div class="foot">
        <span>Hash SHA-256: <strong>${escapeHtml(comprovanteAtual.hashVerificacao)}</strong></span>
        <span>Emitido em ${escapeHtml(formatDateTimeSchoolBR(new Date().toISOString()))}</span>
      </div>
    </div>
  </div>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };</script>
</body>
</html>`

    const win = window.open('', '_blank', 'width=820,height=720')
    if (win) {
      win.document.open()
      win.document.write(html)
      win.document.close()
    } else {
      toast.error('Permita pop-ups para imprimir ou salvar o comprovante em PDF.')
    }
  }

  const renderSignatureVisual = (comp: AutorizacaoSaidaComprovante) => {
    if (comp.tipoAssinatura === 'manual' && comp.assinaturaSvgPath) {
      return (
        <svg
          viewBox="0 0 500 140"
          role="img"
          aria-label={`Assinatura manuscrita de ${comp.assinanteNome}`}
          style={{ width: '100%', maxWidth: 280, height: 74, display: 'block', margin: '0 auto' }}
        >
          <path
            d={comp.assinaturaSvgPath}
            fill="none"
            stroke="#0f2757"
            strokeWidth={3.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    }

    if (comp.assinaturaBase64) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={comp.assinaturaBase64}
          alt={`Assinatura digital de ${comp.assinanteNome}`}
          style={{ maxHeight: 74, maxWidth: 280, display: 'block', margin: '0 auto', objectFit: 'contain' }}
        />
      )
    }

    if (comp.tipoAssinatura === 'caligrafica') {
      const styleCfg =
        ESTILOS_CHANCELA.find((e) => e.id === comp.estiloCaligrafico) || ESTILOS_CHANCELA[0]
      return (
        <div
          style={{
            fontFamily: styleCfg.font,
            fontSize: 'clamp(22px, 4vw, 29px)',
            fontStyle: 'italic',
            fontWeight: 700,
            color: '#0f2757',
            lineHeight: 1.2,
            padding: '10px 8px',
            textAlign: 'center',
            wordBreak: 'break-word',
          }}
        >
          {comp.assinaturaTexto || comp.assinanteNome}
        </div>
      )
    }

    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px',
          borderRadius: 10,
          background: '#eef2ff',
          border: '1px solid #c7d2fe',
          color: '#3730a3',
          fontSize: 12.5,
          fontWeight: 800,
        }}
      >
        <ShieldCheck size={16} aria-hidden="true" />
        <span>Alteração Institucional — {comp.assinanteNome}</span>
      </div>
    )
  }

  return (
    <section
      aria-labelledby={headingId}
      className="ad-perfil-section-card"
      style={{
        background: '#ffffff',
        borderRadius: 24,
        border: '1px solid rgba(226, 232, 240, 0.95)',
        padding: compact ? 18 : 22,
        boxShadow: '0 16px 40px -12px rgba(15, 23, 42, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            dialog.ad-saida-dialog {
              margin: auto;
              padding: 0;
              border: none;
              border-radius: 26px;
              width: min(560px, calc(100% - 24px));
              max-width: calc(100% - 24px);
              max-height: 90vh;
              max-height: 90dvh;
              background: #ffffff;
              box-shadow: 0 28px 65px -16px rgba(15, 23, 42, 0.36), 0 0 0 1px rgba(15, 23, 42, 0.08);
              font-family: 'Outfit', Inter, system-ui, sans-serif;
              overflow: hidden;
            }
            dialog.ad-saida-dialog[open] {
              display: flex;
              flex-direction: column;
            }
            .ad-saida-dialog-form {
              display: block;
              flex: 1 1 auto;
              min-height: 0;
              overflow-y: auto;
              overscroll-behavior: contain;
              -webkit-overflow-scrolling: touch;
            }
            .ad-saida-dialog-body {
              padding: 18px 22px;
              display: flex;
              flex-direction: column;
              gap: 16px;
            }
            dialog.ad-saida-dialog:modal {
              overscroll-behavior: contain;
            }
            dialog.ad-saida-dialog::backdrop {
              overflow: hidden;
              overscroll-behavior: contain;
              background: rgba(15, 23, 42, 0.68);
              backdrop-filter: blur(8px);
              -webkit-backdrop-filter: blur(8px);
            }
            .ad-saida-focusable:focus-visible {
              outline: 3px solid #4f46e5;
              outline-offset: 2px;
            }
            .ad-saida-receipt-grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 10px;
            }
            .ad-copy-wrap {
              position: relative;
              display: inline-flex;
              align-items: center;
              gap: 6px;
            }
            .ad-copy-btn {
              min-inline-size: 28px;
              min-block-size: 28px;
              padding: 4px 9px;
              border-radius: 8px;
              border: 1px solid #cbd5e1;
              background: #ffffff;
              color: #334155;
              font-size: 11px;
              font-weight: 700;
              cursor: pointer;
              display: inline-flex;
              align-items: center;
              gap: 5px;
              transition: background-color 0.15s, border-color 0.15s, color 0.15s;
            }
            .ad-copy-btn:hover {
              background: #f8fafc;
              border-color: #94a3b8;
            }
            .ad-copy-btn[data-copied] {
              background: #ecfdf5;
              border-color: #6ee7b7;
              color: #047857;
            }
            .ad-copy-btn[data-failed] {
              background: #fef2f2;
              border-color: #fca5a5;
              color: #b91c1c;
            }
            .ad-copy-tip {
              font-size: 11px;
              font-weight: 700;
              color: #047857;
              opacity: 0;
              transition: opacity 0.15s ease;
              pointer-events: none;
              white-space: nowrap;
            }
            .ad-copy-tip.visible {
              opacity: 1;
            }
            .ad-copy-tip.failed {
              color: #b91c1c;
            }
            .ad-receipt-toggle {
              flex: 1;
              min-width: 210px;
              min-block-size: 36px;
              background: transparent;
              border: none;
              padding: 4px 6px;
              margin: -4px -6px;
              border-radius: 10px;
              display: flex;
              align-items: center;
              gap: 9px;
              text-align: left;
              cursor: pointer;
              transition: background-color 0.15s ease;
            }
            .ad-receipt-toggle:hover {
              background: rgba(15, 23, 42, 0.04);
            }
            .ad-receipt-chevron {
              flex-shrink: 0;
              color: #475569;
              rotate: -90deg;
            }
            .ad-receipt-toggle[aria-expanded="true"] .ad-receipt-chevron {
              rotate: 0deg;
            }
            @media (prefers-reduced-motion: no-preference) {
              .ad-receipt-chevron {
                transition: rotate 0.2s ease;
              }
            }
            .ad-receipt-body:not([hidden]) {
              padding: 16px 18px;
              display: flex;
              flex-direction: column;
              gap: 14px;
            }
            @media (prefers-reduced-motion: reduce) {
              .ad-copy-tip, .ad-copy-btn { transition: opacity 0.05s linear; }
            }
            @media (max-width: 640px) {
              .ad-saida-dialog-body {
                padding: 16px 16px 18px;
                gap: 14px;
              }
              .ad-saida-receipt-grid {
                grid-template-columns: 1fr;
              }
              .ad-saida-action-row {
                flex-direction: column;
                align-items: stretch !important;
              }
            }
          `,
        }}
      />

      {/* Header da Seção */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          paddingBottom: 14,
          borderBottom: '1px solid #f1f5f9',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: autorizado
                ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)'
                : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
              border: `1px solid ${autorizado ? '#86efac' : '#fca5a5'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: autorizado ? '#15803d' : '#b91c1c',
              flexShrink: 0,
            }}
          >
            {autorizado ? (
              <ShieldCheck size={21} strokeWidth={2.2} aria-hidden="true" />
            ) : (
              <ShieldAlert size={21} strokeWidth={2.2} aria-hidden="true" />
            )}
          </div>
          <div>
            <h3
              id={headingId}
              style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}
            >
              Autorização de Saída Sozinho(a)
            </h3>
            <p style={{ margin: '3px 0 0 0', fontSize: 12, fontWeight: 500, color: '#64748b' }}>
              Permissão para deixar a escola desacompanhado(a) e sincronização com a portaria
            </p>
          </div>
        </div>

        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 999,
            background: autorizado ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${autorizado ? '#a7f3d0' : '#fecaca'}`,
            color: autorizado ? '#047857' : '#b91c1c',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.03em',
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: autorizado ? '#10b981' : '#ef4444',
            }}
          />
          {autorizado ? 'AUTORIZADO A SAIR SOZINHO' : 'SAÍDA RESTRITA'}
        </span>
      </div>

      {/* Painel Principal com Botão de Ação (Autorizar / Desautorizar) */}
      <div
        className="ad-saida-action-row"
        style={{
          padding: '16px 18px',
          borderRadius: 18,
          background: autorizado
            ? 'linear-gradient(135deg, rgba(236, 253, 245, 0.85) 0%, rgba(240, 253, 250, 0.95) 100%)'
            : 'linear-gradient(135deg, rgba(254, 242, 242, 0.78) 0%, rgba(248, 250, 252, 0.95) 100%)',
          border: `1.5px solid ${autorizado ? '#bbf7d0' : '#fecaca'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 230 }}>
          <div
            style={{
              fontSize: 14.5,
              fontWeight: 800,
              color: autorizado ? '#065f46' : '#991b1b',
              marginBottom: 4,
            }}
          >
            {autorizado
              ? 'Saída Independente Ativa na Portaria'
              : 'Saída Independente Não Autorizada'}
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 12.5,
              fontWeight: 500,
              color: autorizado ? '#047857' : '#7f1d1d',
              lineHeight: 1.45,
            }}
          >
            {autorizado
              ? 'O(a) aluno(a) possui permissão ativa para deixar as dependências do colégio sem acompanhante. Essa informação reflete imediatamente na Gestão de Alunos e catracas.'
              : 'O(a) aluno(a) NÃO está autorizado(a) a sair sozinho(a). A saída na portaria requer a presença de um responsável ou pessoa autorizada.'}
          </p>
        </div>

        {canAuthorize ? (
          <button
            type="button"
            onClick={() => openSignatureDialog(!autorizado)}
            className="ad-saida-focusable"
            style={{
              minHeight: 46,
              padding: '0 20px',
              borderRadius: 14,
              border: autorizado ? '1.5px solid #fecdd3' : 'none',
              background: autorizado
                ? 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)'
                : 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              color: autorizado ? '#be123c' : '#ffffff',
              fontFamily: 'Outfit, Inter, sans-serif',
              fontSize: 13.5,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              flexShrink: 0,
              boxShadow: autorizado
                ? '0 4px 12px rgba(225, 29, 72, 0.12)'
                : '0 8px 20px -4px rgba(16, 185, 129, 0.4)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
          >
            {autorizado ? (
              <>
                <ShieldOff size={17} strokeWidth={2.3} aria-hidden="true" />
                <span>Desautorizar Saída Sozinho</span>
              </>
            ) : (
              <>
                <PenTool size={17} strokeWidth={2.3} aria-hidden="true" />
                <span>Autorizar Sair Sozinho</span>
              </>
            )}
          </button>
        ) : (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '10px 14px',
              borderRadius: 12,
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: '#475569',
              fontSize: 12,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            <Lock size={14} aria-hidden="true" />
            <span>
              {isMirroring
                ? 'Somente visualização (espelhamento)'
                : 'Alteração exclusiva do responsável legal'}
            </span>
          </div>
        )}
      </div>

      {/* Comprovante Permanente na Página (Data e Assinatura) */}
      {comprovanteAtual ? (
        <div
          style={{
            borderRadius: 20,
            border: `1.5px dashed ${comprovanteAtual.autorizado ? '#6ee7b7' : '#fda4af'}`,
            background: '#ffffff',
            overflow: 'hidden',
            boxShadow: '0 8px 24px -10px rgba(15, 23, 42, 0.08)',
          }}
        >
          {/* Faixa Superior do Comprovante (Título clicável para recolher/expandir) */}
          <div
            style={{
              padding: '12px 16px',
              background: comprovanteAtual.autorizado
                ? 'linear-gradient(90deg, #ecfdf5 0%, #f0fdfa 100%)'
                : 'linear-gradient(90deg, #fff1f2 0%, #fef2f2 100%)',
              borderBottom: isComprovanteExpanded ? '1px solid #f1f5f9' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <h4 style={{ margin: 0, flex: 1, minWidth: 210, display: 'flex' }}>
              <button
                type="button"
                onClick={() => setIsComprovanteExpanded((prev) => !prev)}
                aria-expanded={isComprovanteExpanded}
                className="ad-receipt-toggle ad-saida-focusable"
              >
                <ChevronDown
                  size={17}
                  strokeWidth={2.5}
                  className="ad-receipt-chevron"
                  aria-hidden="true"
                />
                <FileBadge2
                  size={18}
                  color={comprovanteAtual.autorizado ? '#059669' : '#e11d48'}
                  aria-hidden="true"
                  style={{ flexShrink: 0 }}
                />
                <span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 11.5,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: comprovanteAtual.autorizado ? '#065f46' : '#9f1239',
                    }}
                  >
                    Comprovante de {comprovanteAtual.autorizado ? 'Autorização' : 'Desautorização'}
                  </span>
                  <span style={{ display: 'block', fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                    {isComprovanteExpanded
                      ? 'Registro permanente com data, hora e assinatura digital (clique para recolher)'
                      : `${comprovanteAtual.dataHoraFormatada} • Clique para expandir assinatura`}
                  </span>
                </span>
              </button>
            </h4>

            {/* Protocolo + Botão Copiar acessível */}
            <div className="ad-copy-wrap">
              <span
                id={protocoloElId}
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: '#0f172a',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  padding: '4px 9px',
                  borderRadius: 8,
                }}
              >
                {comprovanteAtual.protocolo}
              </span>
              <button
                type="button"
                onClick={() => handleCopyProtocolo(comprovanteAtual.protocolo)}
                aria-label={`Copiar protocolo ${comprovanteAtual.protocolo}`}
                className="ad-copy-btn ad-saida-focusable"
                data-copied={copyState === 'copied' ? '' : undefined}
                data-failed={copyState === 'failed' ? '' : undefined}
              >
                {copyState === 'copied' ? (
                  <Check size={13} aria-hidden="true" />
                ) : (
                  <Copy size={13} aria-hidden="true" />
                )}
                <span>{copyState === 'copied' ? 'Copiado' : 'Copiar'}</span>
              </button>
              <span
                className={`ad-copy-tip ${copyStatusMsg ? 'visible' : ''} ${
                  copyState === 'failed' ? 'failed' : ''
                }`}
                role="status"
              >
                {copyStatusMsg}
              </span>
            </div>
          </div>

          {/* Corpo do Comprovante (recolhível via clique no título) */}
          <div
            id={comprovanteBodyId}
            ref={comprovanteBodyRef}
            className="ad-receipt-body"
            hidden={!isComprovanteExpanded ? ('until-found' as any) : false}
          >
            <div className="ad-saida-receipt-grid">
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
                  Data e Hora do Registro
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CalendarClock size={14} color="#4f46e5" aria-hidden="true" />
                  <span>{comprovanteAtual.dataHoraFormatada}</span>
                </div>
              </div>

              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
                  Responsável Signatário
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginTop: 3 }}>
                  {comprovanteAtual.assinanteNome}
                  {comprovanteAtual.assinanteParentesco && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginLeft: 6 }}>
                      ({comprovanteAtual.assinanteParentesco})
                    </span>
                  )}
                </div>
              </div>

              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
                  Status Declarado
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: comprovanteAtual.autorizado ? '#047857' : '#be123c',
                    marginTop: 3,
                  }}
                >
                  {comprovanteAtual.autorizado
                    ? 'Autorizado a sair sozinho'
                    : 'Desautorizado (requer acompanhante)'}
                </div>
              </div>

              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
                  Código de Autenticidade (SHA-256)
                </div>
                <div
                  style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#334155',
                    marginTop: 3,
                    wordBreak: 'break-all',
                  }}
                >
                  {comprovanteAtual.hashVerificacao}
                  {comprovanteAtual.assinanteCpfMascarado
                    ? ` • CPF ${comprovanteAtual.assinanteCpfMascarado}`
                    : ''}
                </div>
              </div>
            </div>

            {comprovanteAtual.observacoes && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#92400e',
                }}
              >
                <strong>Observação:</strong> {comprovanteAtual.observacoes}
              </div>
            )}

            {/* Quadro da Assinatura na Página */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 16,
                background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                border: '1px solid #e2e8f0',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: '#64748b',
                  marginBottom: 8,
                }}
              >
                Assinatura Digital Registrada
              </div>

              <div
                style={{
                  minHeight: 74,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {renderSignatureVisual(comprovanteAtual)}
              </div>

              <div
                style={{
                  borderTop: '1px solid #cbd5e1',
                  maxWidth: 320,
                  margin: '8px auto 0',
                  paddingTop: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#334155',
                }}
              >
                {comprovanteAtual.assinanteNome}
              </div>
              <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 500, marginTop: 2 }}>
                Assinado em {comprovanteAtual.dataHoraFormatada} • Validade institucional
              </div>
            </div>

            {/* Rodapé do Comprovante (Imprimir + Histórico) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
                paddingTop: 4,
              }}
            >
              <button
                type="button"
                onClick={handlePrintComprovante}
                className="ad-saida-focusable"
                style={{
                  minHeight: 36,
                  padding: '6px 13px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Printer size={14} aria-hidden="true" />
                <span>Imprimir / Salvar Comprovante</span>
              </button>

              {historico.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHistorico((prev) => !prev)}
                  aria-expanded={showHistorico}
                  className="ad-saida-focusable"
                  style={{
                    minHeight: 36,
                    padding: '6px 13px',
                    borderRadius: 10,
                    border: '1px solid #e0e7ff',
                    background: '#eef2ff',
                    color: '#4338ca',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <History size={14} aria-hidden="true" />
                  <span>Histórico de Alterações ({historico.length})</span>
                  {showHistorico ? (
                    <ChevronUp size={14} aria-hidden="true" />
                  ) : (
                    <ChevronDown size={14} aria-hidden="true" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 16,
            border: '1px dashed #cbd5e1',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: '#475569', fontWeight: 500 }}>
            <FileBadge2 size={18} color="#94a3b8" aria-hidden="true" />
            <span>
              {isFetching
                ? 'Verificando comprovantes registrados...'
                : 'Nenhum comprovante assinado registrado ainda. Ao alterar a permissão, o comprovante com data e assinatura ficará visível aqui.'}
            </span>
          </div>

          {historico.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistorico((prev) => !prev)}
              aria-expanded={showHistorico}
              className="ad-saida-focusable"
              style={{
                minHeight: 32,
                padding: '5px 12px',
                borderRadius: 10,
                border: '1px solid #e0e7ff',
                background: '#eef2ff',
                color: '#4338ca',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <History size={14} aria-hidden="true" />
              <span>Histórico ({historico.length})</span>
            </button>
          )}
        </div>
      )}

      {/* Linha do Tempo (Histórico na página) */}
      {showHistorico && historico.length > 0 && (
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 16,
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Linha do Tempo de Autorizações e Revogações
          </div>
          {historico.map((item, idx) => (
            <div
              key={item.protocolo || idx}
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                background: '#ffffff',
                border: `1px solid ${item.autorizado ? '#bbf7d0' : '#fecaca'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: item.autorizado ? '#dcfce7' : '#ffe4e6',
                    color: item.autorizado ? '#15803d' : '#be123c',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {item.autorizado ? (
                    <CheckCircle2 size={15} aria-hidden="true" />
                  ) : (
                    <ShieldOff size={14} aria-hidden="true" />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: item.autorizado ? '#065f46' : '#9f1239' }}>
                    {item.autorizado ? 'Autorizado a sair sozinho' : 'Saída sozinho desautorizada'}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 500 }}>
                    Por <strong>{item.assinanteNome}</strong> • {item.dataHoraFormatada}
                  </div>
                </div>
              </div>
              <span
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#475569',
                  background: '#f1f5f9',
                  padding: '3px 8px',
                  borderRadius: 6,
                }}
              >
                {item.protocolo}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Modal Nativo <dialog> para Confirmação e Assinatura Digital */}
      <dialog
        ref={dialogRef}
        className="ad-saida-dialog"
        aria-labelledby={dialogTitleId}
        {...({ closedby: isSubmitting ? 'none' : 'any' } as any)}
      >
        {/* Cabeçalho do Modal */}
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid #f1f5f9',
            background: targetAutorizar
              ? 'linear-gradient(135deg, #ecfdf5 0%, #f0fdfa 100%)'
              : 'linear-gradient(135deg, #fff1f2 0%, #fef2f2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: targetAutorizar ? '#dcfce7' : '#ffe4e6',
                color: targetAutorizar ? '#15803d' : '#be123c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {targetAutorizar ? (
                <ShieldCheck size={20} aria-hidden="true" />
              ) : (
                <ShieldOff size={20} aria-hidden="true" />
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <h4
                id={dialogTitleId}
                style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a' }}
              >
                {targetAutorizar
                  ? 'Autorizar Saída Sozinho(a)'
                  : 'Desautorizar Saída Sozinho(a)'}
              </h4>
              <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                Aluno(a): {aluno?.nome}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeSignatureDialog}
            disabled={isSubmitting}
            aria-label="Fechar modal de assinatura"
            className="ad-saida-focusable"
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              color: '#64748b',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>

        {/* Formulário com Assinatura */}
        <form
          onSubmit={handleSubmitAuthorization}
          className="ad-saida-dialog-form"
        >
          <div className="ad-saida-dialog-body">
          {/* Resumo da Ação */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 14,
              background: targetAutorizar ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${targetAutorizar ? '#bbf7d0' : '#fecaca'}`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              fontSize: 12.5,
              lineHeight: 1.45,
              color: targetAutorizar ? '#166534' : '#991b1b',
              fontWeight: 500,
            }}
          >
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
            <div>
              {targetAutorizar ? (
                <>
                  Ao assinar, <strong>{aluno?.nome}</strong> passará a constar como{' '}
                  <strong>Autorizado(a) a Sair Sozinho(a)</strong> na Gestão de Alunos e na
                  portaria/catraca escolar.
                </>
              ) : (
                <>
                  Ao assinar, <strong>{aluno?.nome}</strong> deixará de ter saída independente,
                  exigindo acompanhamento de um responsável autorizado para deixar a escola.
                </>
              )}
            </div>
          </div>

          {/* Seletor do Tipo de Assinatura */}
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#475569',
                marginBottom: 8,
              }}
            >
              Modo de Assinatura Digital
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                padding: 4,
                background: '#f1f5f9',
                borderRadius: 12,
              }}
            >
              <button
                type="button"
                onClick={() => setTipoAssinatura('manual')}
                className="ad-saida-focusable"
                style={{
                  minHeight: 38,
                  borderRadius: 9,
                  border: 'none',
                  background: tipoAssinatura === 'manual' ? '#ffffff' : 'transparent',
                  color: tipoAssinatura === 'manual' ? '#0f172a' : '#64748b',
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  boxShadow: tipoAssinatura === 'manual' ? '0 2px 8px rgba(15,23,42,0.08)' : 'none',
                }}
              >
                <PenTool size={14} aria-hidden="true" />
                <span>Desenhar na Tela</span>
              </button>

              <button
                type="button"
                onClick={() => setTipoAssinatura('caligrafica')}
                className="ad-saida-focusable"
                style={{
                  minHeight: 38,
                  borderRadius: 9,
                  border: 'none',
                  background: tipoAssinatura === 'caligrafica' ? '#ffffff' : 'transparent',
                  color: tipoAssinatura === 'caligrafica' ? '#0f172a' : '#64748b',
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  boxShadow:
                    tipoAssinatura === 'caligrafica' ? '0 2px 8px rgba(15,23,42,0.08)' : 'none',
                }}
              >
                <Sparkles size={14} aria-hidden="true" />
                <span>Assinatura Caligráfica</span>
              </button>
            </div>
          </div>

          {/* Área de Desenho Manual */}
          {tipoAssinatura === 'manual' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                  Assine com o dedo ou mouse no quadro abaixo:
                </span>
                <button
                  type="button"
                  onClick={handleClearCanvas}
                  className="ad-saida-focusable"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#dc2626',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 4px',
                  }}
                >
                  <Eraser size={13} aria-hidden="true" />
                  <span>Limpar</span>
                </button>
              </div>

              <div
                style={{
                  position: 'relative',
                  borderRadius: 14,
                  border: '1.5px solid #cbd5e1',
                  background: '#ffffff',
                  overflow: 'hidden',
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={140}
                  aria-label="Área para desenhar sua assinatura"
                  style={{
                    width: '100%',
                    height: 140,
                    display: 'block',
                    cursor: 'crosshair',
                    touchAction: 'none',
                  }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                />
                {!hasManualDrawing && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94a3b8',
                      fontSize: 13,
                      fontWeight: 600,
                      pointerEvents: 'none',
                    }}
                  >
                    ✍️ Assine aqui
                  </div>
                )}
                <div
                  style={{
                    position: 'absolute',
                    left: 24,
                    right: 24,
                    bottom: 24,
                    borderBottom: '1px dashed #cbd5e1',
                    pointerEvents: 'none',
                  }}
                />
              </div>
            </div>
          )}

          {/* Área Caligráfica */}
          {tipoAssinatura === 'caligrafica' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label
                  htmlFor={signerNameInputId}
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    color: '#475569',
                    marginBottom: 5,
                  }}
                >
                  Nome Completo do Signatário
                </label>
                <input
                  id={signerNameInputId}
                  type="text"
                  value={assinaturaTexto}
                  onChange={(e) => setAssinaturaTexto(e.target.value)}
                  placeholder="Seu nome completo"
                  autoComplete="name"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 11,
                    border: '1.5px solid #cbd5e1',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#0f172a',
                    background: '#f8fafc',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {ESTILOS_CHANCELA.map((estilo) => {
                  const selected = estiloCaligrafico === estilo.id
                  return (
                    <button
                      key={estilo.id}
                      type="button"
                      onClick={() => setEstiloCaligrafico(estilo.id)}
                      className="ad-saida-focusable"
                      style={{
                        padding: '10px 10px',
                        borderRadius: 12,
                        border: selected ? '2px solid #4f46e5' : '1.5px solid #e2e8f0',
                        background: selected ? '#eef2ff' : '#ffffff',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>
                        {estilo.rotulo}
                      </div>
                      <div
                        style={{
                          fontFamily: estilo.font,
                          fontSize: 18,
                          fontStyle: 'italic',
                          color: '#0f2757',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {assinaturaTexto || currentLoggedUserName}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Campos: CPF (Obrigatório) e Observação */}
          <div className="ad-saida-receipt-grid">
            <div>
              <label
                htmlFor={cpfInputId}
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: '#475569',
                  marginBottom: 5,
                }}
              >
                CPF do Responsável <span style={{ color: '#e11d48' }}>*</span>
              </label>
              {(() => {
                const cpfDigits = cpfInput.replace(/\D/g, '')
                const cpfComplete = cpfDigits.length === 11
                const cpfValid = cpfComplete && validarCPF(cpfDigits)
                const cpfInvalid = cpfComplete && !cpfValid
                return (
                  <>
                    <input
                      id={cpfInputId}
                      type="text"
                      inputMode="numeric"
                      required
                      aria-invalid={cpfInvalid ? 'true' : undefined}
                      value={cpfInput}
                      onChange={(e) => {
                        setCpfInput(formatarCPF(e.target.value))
                        if (submitError) setSubmitError(null)
                      }}
                      placeholder="000.000.000-00"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 11,
                        border: `1.5px solid ${cpfInvalid ? '#ef4444' : cpfValid ? '#10b981' : '#cbd5e1'}`,
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: '#0f172a',
                        background: cpfInvalid ? '#fef2f2' : '#f8fafc',
                        boxSizing: 'border-box',
                      }}
                    />
                    {cpfInvalid && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginTop: 4 }}>
                        CPF inválido. Confira os 11 dígitos.
                      </div>
                    )}
                    {cpfValid && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', marginTop: 4 }}>
                        ✓ CPF validado para assinatura
                      </div>
                    )}
                  </>
                )
              })()}
            </div>

            <div>
              <label
                htmlFor={obsInputId}
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: '#475569',
                  marginBottom: 5,
                }}
              >
                Observação (Opcional)
              </label>
              <input
                id={obsInputId}
                type="text"
                maxLength={250}
                value={obsInput}
                onChange={(e) => setObsInput(e.target.value)}
                placeholder={
                  targetAutorizar
                    ? 'Ex.: Sai a pé após a aula'
                    : 'Ex.: Somente mãe/pai retira'
                }
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 11,
                  border: '1.5px solid #cbd5e1',
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: '#0f172a',
                  background: '#f8fafc',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Checkbox de Declaração Obrigatória */}
          <label
            htmlFor={consentCheckId}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '12px 14px',
              borderRadius: 14,
              background: aceitouTermo ? '#f0fdf4' : '#f8fafc',
              border: `1.5px solid ${aceitouTermo ? '#86efac' : '#cbd5e1'}`,
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              id={consentCheckId}
              type="checkbox"
              checked={aceitouTermo}
              onChange={(e) => {
                setAceitouTermo(e.target.checked)
                if (submitError) setSubmitError(null)
              }}
              required
              style={{
                marginTop: 2,
                width: 18,
                height: 18,
                accentColor: targetAutorizar ? '#059669' : '#e11d48',
                flexShrink: 0,
                cursor: 'pointer',
              }}
            />
            <span style={{ fontSize: 12, color: '#1e293b', fontWeight: 600, lineHeight: 1.45 }}>
              {targetAutorizar
                ? `Declaro que autorizo ${aluno?.nome || 'o(a) aluno(a)'} a sair sozinho(a) das dependências da escola, assumindo total responsabilidade com registro de data, hora e assinatura digital.`
                : `Declaro que revogo a autorização de saída sozinho(a) de ${aluno?.nome || 'o(a) aluno(a)'}, exigindo retirada presencial por responsável autorizado, com registro de data, hora e assinatura digital.`}
            </span>
          </label>

          {/* Mensagem de Erro */}
          {submitError && (
            <div
              id={formHintId}
              role="alert"
              style={{
                padding: '10px 14px',
                borderRadius: 12,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: 12.5,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0 }} aria-hidden="true" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Rodapé do Dialog */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              flexWrap: 'wrap',
              gap: 10,
              paddingTop: 8,
              borderTop: '1px solid #f1f5f9',
            }}
          >
            <button
              type="button"
              onClick={closeSignatureDialog}
              disabled={isSubmitting}
              autoFocus={!targetAutorizar}
              className="ad-saida-focusable"
              style={{
                minHeight: 42,
                padding: '0 18px',
                borderRadius: 12,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontSize: 13.5,
                fontWeight: 700,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              aria-describedby={submitError ? formHintId : undefined}
              className="ad-saida-focusable"
              style={{
                minHeight: 42,
                padding: '0 20px',
                borderRadius: 12,
                border: 'none',
                background: targetAutorizar
                  ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
                  : 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
                color: '#ffffff',
                fontSize: 13.5,
                fontWeight: 800,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: targetAutorizar
                  ? '0 6px 16px rgba(16, 185, 129, 0.28)'
                  : '0 6px 16px rgba(225, 29, 72, 0.28)',
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  <span>Registrando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} aria-hidden="true" />
                  <span>
                    {targetAutorizar ? 'Confirmar e Assinar' : 'Desautorizar e Assinar'}
                  </span>
                </>
              )}
            </button>
          </div>
          </div>
        </form>
      </dialog>
    </section>
  )
}
