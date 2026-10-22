/**
 * app/agenda-digital/components/boletimImageGenerator.ts
 *
 * Gerador nativo em HTML5 Canvas 2D (Ultra-HD 3x Retina) do Boletim Escolar
 * para salvar como imagem no celular e compartilhar via Web Share API (WhatsApp, Fotos, etc.).
 *
 * Totalmente imune a falhas de foreignObject no iOS Safari / WebViews e funções de cor do Tailwind v4.
 */

import { getInitials } from '@/lib/utils'
import type { DiagnosticoPedagogico } from '@/lib/notasEngine'

export interface BoletimImageDisciplinaBimestre {
  nome: string
  avm?: any
  avb?: any
  simulado?: any
  pntBonu?: any
  bonus?: any
  rec?: any
  mediaF?: any
  mediaG?: any
  mediaFNum: number
}

export interface BoletimImageDisciplinaAnual {
  nome: string
  bimesters: Array<{
    bimNum: number
    bimNome: string
    valorStr: string
    valorNum: number
    lancado: boolean
    rec?: any
  }>
  lancadosCount: number
  totalBims: number
  mediaFNum: number
  mediaAnualFormatada: string
  isPassed: boolean
}

export interface GenerateBoletimImageParams {
  aluno: {
    id?: string | number
    nome?: string
    foto?: string | null
    matricula?: string | number
    codigo?: string | number
  }
  responsavelNome?: string
  turmaNome: string
  turno?: string
  anoLetivo: string
  isMediaAnual: boolean
  periodoTitulo: string
  totalBimestresLancados?: number
  mediaGlobal: number
  diagnostico?: DiagnosticoPedagogico | null
  disciplinasBimestre?: BoletimImageDisciplinaBimestre[]
  disciplinasAnuais?: BoletimImageDisciplinaAnual[]
}

export interface BoletimRemoteUrls {
  id: string
  fileName: string
  serverDownloadUrl: string
  externalDownloadUrl?: string
  externalViewUrl?: string
}

export interface GeneratedBoletimImage {
  blob: Blob
  dataUrl: string
  fileName: string
  title: string
  shareText: string
  remoteUrlsPromise: Promise<BoletimRemoteUrls | null>
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',')
  const mimeMatch = parts[0]?.match(/:(.*?);/)
  const mime = mimeMatch?.[1] || 'image/png'
  const bstr = atob(parts[1] || '')
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
}

async function uploadBoletimImageForDownload(
  blob: Blob,
  fileName: string
): Promise<BoletimRemoteUrls | null> {
  try {
    const formData = new FormData()
    formData.append('file', blob, fileName)
    formData.append('fileName', fileName)

    const res = await fetch('/api/boletins/imagem-download', {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) return null
    const json = await res.json()
    if (!json?.serverDownloadUrl) return null
    return {
      id: json.id,
      fileName: json.fileName || fileName,
      serverDownloadUrl: json.serverDownloadUrl,
      externalDownloadUrl: json.externalDownloadUrl,
      externalViewUrl: json.externalViewUrl,
    }
  } catch (err) {
    console.warn('[boletimImageGenerator] Falha ao preparar URL de download:', err)
    return null
  }
}

/**
 * Carrega uma imagem de forma segura com timeout e proteção contra tainting de CORS.
 */
async function loadSafeImage(url?: string | null, timeoutMs = 2500): Promise<HTMLImageElement | null> {
  if (!url || typeof window === 'undefined') return null

  // Tenta converter via fetch/blob primeiro para evitar problemas de CORS no canvas
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const response = await fetch(url, { signal: controller.signal, mode: 'cors', credentials: 'same-origin' })
    clearTimeout(timer)

    if (response.ok) {
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const img = await new Promise<HTMLImageElement | null>((resolve) => {
        const image = new Image()
        const t = setTimeout(() => resolve(null), timeoutMs)
        image.onload = () => {
          clearTimeout(t)
          resolve(image)
        }
        image.onerror = () => {
          clearTimeout(t)
          resolve(null)
        }
        image.src = objectUrl
      })
      URL.revokeObjectURL(objectUrl)
      if (img) return img
    }
  } catch {
    // Continua para tentativa direta com Image
  }

  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    const timer = setTimeout(() => resolve(null), timeoutMs)
    image.onload = () => {
      clearTimeout(timer)
      resolve(image)
    }
    image.onerror = () => {
      clearTimeout(timer)
      resolve(null)
    }
    image.src = url
  })
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

function fillAndStrokeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fillStyle?: string | CanvasGradient,
  strokeStyle?: string,
  lineWidth = 1
) {
  drawRoundedRect(ctx, x, y, w, h, r)
  if (fillStyle) {
    ctx.fillStyle = fillStyle
    ctx.fill()
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle
    ctx.lineWidth = lineWidth
    ctx.stroke()
  }
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (!text) return ''
  if (ctx.measureText(text).width <= maxWidth) return text
  let truncated = text
  while (truncated.length > 1 && ctx.measureText(truncated + '…').width > maxWidth) {
    truncated = truncated.slice(0, -1)
  }
  return truncated + '…'
}

interface EvalToken {
  label: string
  value: string
  valueColor: string
  badgeBg?: string
  badgeColor?: string
}

function buildBimestreTokens(d: BoletimImageDisciplinaBimestre): EvalToken[] {
  const tokens: EvalToken[] = [
    { label: 'AVM:', value: String(d.avm && d.avm !== '---' ? d.avm : '---'), valueColor: '#334155' },
    { label: 'AVB:', value: String(d.avb && d.avb !== '---' ? d.avb : '---'), valueColor: '#334155' },
  ]
  if (d.simulado && d.simulado !== '---' && String(d.simulado).trim() !== '') {
    tokens.push({ label: 'Sim:', value: String(d.simulado), valueColor: '#334155' })
  }
  const bonusVal = d.pntBonu || d.bonus
  if (bonusVal && bonusVal !== '---' && String(bonusVal).trim() !== '') {
    tokens.push({ label: 'Bônus:', value: String(bonusVal), valueColor: '#334155' })
  }
  if (d.rec && d.rec !== '---' && String(d.rec).trim() !== '') {
    tokens.push({ label: 'Rec:', value: String(d.rec), valueColor: '#b45309', badgeBg: '#fef3c7', badgeColor: '#b45309' })
  }
  return tokens
}

function buildAnualTokens(d: BoletimImageDisciplinaAnual): EvalToken[] {
  const tokens: EvalToken[] = []
  for (const b of d.bimesters) {
    tokens.push({
      label: `${b.bimNum}º Bim:`,
      value: b.valorStr,
      valueColor: b.lancado ? (b.valorNum >= 7.0 ? '#1e293b' : '#dc2626') : '#94a3b8',
    })
    const hasRec = b.rec && b.rec !== '---' && b.rec !== '-' && String(b.rec).trim() !== ''
    if (hasRec) {
      tokens.push({
        label: 'Rec:',
        value: String(b.rec),
        valueColor: '#b45309',
        badgeBg: '#fef3c7',
        badgeColor: '#b45309',
      })
    }
  }
  return tokens
}

export async function generateBoletimImage(
  params: GenerateBoletimImageParams
): Promise<GeneratedBoletimImage> {
  // Aguarda carregamento de fontes do navegador
  if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
    try {
      await Promise.race([
        (document as any).fonts.ready,
        new Promise((r) => setTimeout(r, 800)),
      ])
    } catch {
      // prossegue com fonte de sistema
    }
  }

  const [logoImg, avatarImg] = await Promise.all([
    loadSafeImage('/logo-impacto.png', 1800),
    loadSafeImage(params.aluno?.foto, 2200),
  ])

  const W = 720
  const SCALE = 3
  const PAD_X = 26
  const CONTENT_W = W - PAD_X * 2

  const isAnual = params.isMediaAnual
  const itemsCount = isAnual
    ? (params.disciplinasAnuais?.length || 0)
    : (params.disciplinasBimestre?.length || 0)

  const cols = itemsCount === 1 ? 1 : 2
  const colGap = 12
  const rowGap = 10
  const cardW = cols === 1 ? CONTENT_W : (CONTENT_W - colGap) / 2
  const numRows = Math.max(1, Math.ceil(itemsCount / cols))

  // Altura de cada card de disciplina (maior no modo anual para acomodar até 4 bimestres + rec)
  const discCardH = isAnual ? 94 : 84
  const discGridH = numRows * discCardH + Math.max(0, numRows - 1) * rowGap

  // Cálculo dinâmico da altura total do documento
  const headerH = 64
  const studentCardH = 98
  const globalCardH = 118
  const discSectionHeaderH = 44
  const discContainerPadY = 20 * 2
  const discContainerH = discSectionHeaderH + discGridH + discContainerPadY
  const footerH = 48

  const totalH =
    18 + // top accent + padding
    headerH +
    14 +
    studentCardH +
    16 +
    globalCardH +
    16 +
    discContainerH +
    footerH +
    14

  const canvas = document.createElement('canvas')
  canvas.width = W * SCALE
  canvas.height = Math.ceil(totalH * SCALE)

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Não foi possível inicializar o contexto gráfico 2D.')
  }

  ctx.scale(SCALE, SCALE)
  const fontMain = `'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

  // 1. Fundo Geral
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, totalH)

  // Malha suave decorativa no topo
  const topMesh = ctx.createLinearGradient(0, 0, W, 240)
  topMesh.addColorStop(0, 'rgba(239, 246, 255, 0.75)')
  topMesh.addColorStop(0.5, 'rgba(245, 243, 255, 0.5)')
  topMesh.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = topMesh
  ctx.fillRect(0, 0, W, 240)

  // Barra superior gradiente institucional
  const topBarGrad = ctx.createLinearGradient(0, 0, W, 0)
  topBarGrad.addColorStop(0, '#2563eb')
  topBarGrad.addColorStop(0.5, '#6366f1')
  topBarGrad.addColorStop(1, '#a855f7')
  ctx.fillStyle = topBarGrad
  ctx.fillRect(0, 0, W, 6)

  let curY = 20

  // 2. Cabeçalho Institucional
  const logoBoxSize = 46
  fillAndStrokeRoundRect(ctx, PAD_X, curY, logoBoxSize, logoBoxSize, 12, '#eff6ff', '#bfdbfe', 1.2)

  if (logoImg && logoImg.naturalWidth > 0) {
    ctx.save()
    drawRoundedRect(ctx, PAD_X + 4, curY + 4, logoBoxSize - 8, logoBoxSize - 8, 8)
    ctx.clip()
    const ratio = Math.min(
      (logoBoxSize - 8) / logoImg.naturalWidth,
      (logoBoxSize - 8) / logoImg.naturalHeight
    )
    const drawW = logoImg.naturalWidth * ratio
    const drawH = logoImg.naturalHeight * ratio
    const drawX = PAD_X + (logoBoxSize - drawW) / 2
    const drawY = curY + (logoBoxSize - drawH) / 2
    ctx.drawImage(logoImg, drawX, drawY, drawW, drawH)
    ctx.restore()
  } else {
    ctx.fillStyle = '#2563eb'
    ctx.font = `900 18px ${fontMain}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('IE', PAD_X + logoBoxSize / 2, curY + logoBoxSize / 2)
  }

  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#0f172a'
  ctx.font = `900 17px ${fontMain}`
  ctx.fillText('COLÉGIO IMPACTO', PAD_X + logoBoxSize + 12, curY + 5)

  ctx.fillStyle = '#64748b'
  ctx.font = `700 10.5px ${fontMain}`
  ctx.fillText('BOLETIM ESCOLAR OFICIAL • AGENDA DIGITAL', PAD_X + logoBoxSize + 12, curY + 27)

  // Badge do período à direita no cabeçalho
  const periodoBadgeLabel = `${params.periodoTitulo.toUpperCase()} • ${params.anoLetivo}`
  ctx.font = `800 11px ${fontMain}`
  const pBadgeW = Math.min(240, ctx.measureText(periodoBadgeLabel).width + 24)
  const pBadgeH = 30
  const pBadgeX = W - PAD_X - pBadgeW
  const pBadgeY = curY + (logoBoxSize - pBadgeH) / 2
  fillAndStrokeRoundRect(ctx, pBadgeX, pBadgeY, pBadgeW, pBadgeH, 10, '#eff6ff', '#bfdbfe', 1.2)
  ctx.fillStyle = '#1d4ed8'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(
    truncateText(ctx, periodoBadgeLabel, pBadgeW - 16),
    pBadgeX + pBadgeW / 2,
    pBadgeY + pBadgeH / 2
  )

  curY += headerH

  // 3. Card de Identificação do Aluno
  const sCardGrad = ctx.createLinearGradient(PAD_X, curY, PAD_X, curY + studentCardH)
  sCardGrad.addColorStop(0, '#ffffff')
  sCardGrad.addColorStop(1, '#f8fafc')
  fillAndStrokeRoundRect(ctx, PAD_X, curY, CONTENT_W, studentCardH, 18, sCardGrad, '#e2e8f0', 1.5)

  // Avatar do aluno
  const avSize = 68
  const avX = PAD_X + 15
  const avY = curY + (studentCardH - avSize) / 2

  const avGrad = ctx.createLinearGradient(avX, avY, avX + avSize, avY + avSize)
  avGrad.addColorStop(0, '#e0e7ff')
  avGrad.addColorStop(1, '#f3e8ff')
  fillAndStrokeRoundRect(ctx, avX, avY, avSize, avSize, 16, avGrad, '#c7d2fe', 1.5)

  if (avatarImg && avatarImg.naturalWidth > 0) {
    ctx.save()
    drawRoundedRect(ctx, avX, avY, avSize, avSize, 16)
    ctx.clip()
    const scaleCover = Math.max(avSize / avatarImg.naturalWidth, avSize / avatarImg.naturalHeight)
    const sw = avatarImg.naturalWidth * scaleCover
    const sh = avatarImg.naturalHeight * scaleCover
    ctx.drawImage(avatarImg, avX + (avSize - sw) / 2, avY + (avSize - sh) / 2, sw, sh)
    ctx.restore()
  } else {
    const initials = getInitials(params.aluno?.nome || 'Aluno')
    ctx.fillStyle = '#4f46e5'
    ctx.font = `900 22px ${fontMain}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(initials, avX + avSize / 2, avY + avSize / 2)
  }

  // Ponto verde de status no avatar
  ctx.beginPath()
  ctx.arc(avX + avSize - 6, avY + avSize - 6, 5.5, 0, Math.PI * 2)
  ctx.fillStyle = '#10b981'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()

  // Informações do aluno ao lado do avatar
  const infoX = avX + avSize + 14
  const maxInfoW = CONTENT_W - (avSize + 44)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#0f172a'
  ctx.font = `900 17px ${fontMain}`
  const studentDisplayName = truncateText(ctx, params.aluno?.nome || 'Estudante', maxInfoW - 26)
  ctx.fillText(studentDisplayName, infoX, curY + 14)

  // Selo verificado ao lado do nome
  const nameMeasuredW = ctx.measureText(studentDisplayName).width
  const vBadgeX = infoX + nameMeasuredW + 12
  const vBadgeY = curY + 23
  ctx.beginPath()
  ctx.arc(vBadgeX, vBadgeY, 7.5, 0, Math.PI * 2)
  ctx.fillStyle = '#4f46e5'
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1.8
  ctx.beginPath()
  ctx.moveTo(vBadgeX - 3.2, vBadgeY + 0.2)
  ctx.lineTo(vBadgeX - 0.8, vBadgeY + 2.6)
  ctx.lineTo(vBadgeX + 3.5, vBadgeY - 2.2)
  ctx.stroke()

  // Chips de Turma, Turno, Ano e Matrícula
  let chipX = infoX
  const chipY = curY + 40
  const chipH = 24

  const chips: Array<{ text: string; bg: string; border: string; color: string }> = []
  if (params.turmaNome) {
    chips.push({ text: `Turma: ${params.turmaNome}`, bg: '#ffffff', border: '#dcdffe', color: '#1e1b4b' })
  }
  if (params.turno) {
    chips.push({ text: params.turno, bg: '#ffffff', border: '#ebd5ff', color: '#4a044e' })
  }
  if (params.anoLetivo) {
    chips.push({ text: `Ano ${params.anoLetivo}`, bg: '#eff6ff', border: '#bfdbfe', color: '#2563eb' })
  }
  const matVal = params.aluno?.matricula || params.aluno?.codigo || params.aluno?.id
  if (matVal) {
    chips.push({ text: `Mat. ${matVal}`, bg: '#f1f5f9', border: '#cbd5e1', color: '#475569' })
  }

  ctx.font = `800 10.5px ${fontMain}`
  for (const chip of chips) {
    const cw = ctx.measureText(chip.text).width + 16
    if (chipX + cw > W - PAD_X - 12) break
    fillAndStrokeRoundRect(ctx, chipX, chipY, cw, chipH, 7, chip.bg, chip.border, 1.1)
    ctx.fillStyle = chip.color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(chip.text, chipX + cw / 2, chipY + chipH / 2)
    chipX += cw + 6
  }

  // Linha do Responsável
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.font = `700 10.5px ${fontMain}`
  ctx.fillStyle = '#64748b'
  const respText = params.responsavelNome
    ? `RESPONSÁVEL: ${params.responsavelNome.toUpperCase()}`
    : 'DOCUMENTO OFICIAL DE ACOMPANHAMENTO PEDAGÓGICO'
  ctx.fillText(truncateText(ctx, respText, maxInfoW), infoX, curY + 70)

  curY += studentCardH + 16

  // 4. Card Resumo Global (Média Global + Diagnóstico Pedagógico)
  const diag = params.diagnostico
  const isApprovedGlobal = params.mediaGlobal >= 7.0
  const globalBgGrad = ctx.createLinearGradient(PAD_X, curY, PAD_X + CONTENT_W, curY + globalCardH)
  if (diag?.tipo === 'adequado') {
    globalBgGrad.addColorStop(0, '#ffffff')
    globalBgGrad.addColorStop(1, '#ecfdf5')
  } else if (diag?.tipo === 'atencao') {
    globalBgGrad.addColorStop(0, '#ffffff')
    globalBgGrad.addColorStop(1, '#fffbeb')
  } else if (diag?.tipo === 'insuficiente' || diag?.tipo === 'critico') {
    globalBgGrad.addColorStop(0, '#ffffff')
    globalBgGrad.addColorStop(1, '#fef2f2')
  } else {
    globalBgGrad.addColorStop(0, '#ffffff')
    globalBgGrad.addColorStop(1, '#eff6ff')
  }

  const globalBorderColor = diag?.cardBorder || (isApprovedGlobal ? '#a7f3d0' : '#fecaca')
  fillAndStrokeRoundRect(ctx, PAD_X, curY, CONTENT_W, globalCardH, 18, globalBgGrad, globalBorderColor, 1.5)

  // Título Média Global
  const gLeftX = PAD_X + 18
  fillAndStrokeRoundRect(
    ctx,
    gLeftX,
    curY + 14,
    22,
    22,
    7,
    diag?.iconBg || '#dbeafe'
  )
  ctx.fillStyle = diag?.iconColor || '#2563eb'
  ctx.font = `900 11px ${fontMain}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('★', gLeftX + 11, curY + 25)

  ctx.textAlign = 'left'
  ctx.fillStyle = '#64748b'
  ctx.font = `800 10.5px ${fontMain}`
  ctx.fillText(isAnual ? 'MÉDIA GLOBAL ANUAL' : 'MÉDIA GLOBAL DO PERÍODO', gLeftX + 29, curY + 25)

  // Valor da Média Global
  const mediaValStr = (params.mediaGlobal || 0).toFixed(1)
  ctx.fillStyle = diag?.valueColor || (isApprovedGlobal ? '#065f46' : '#991b1b')
  ctx.font = `900 40px ${fontMain}`
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(mediaValStr, gLeftX, curY + 75)

  const mediaValW = ctx.measureText(mediaValStr).width
  ctx.fillStyle = '#64748b'
  ctx.font = `700 13px ${fontMain}`
  ctx.fillText('/ 10.0', gLeftX + mediaValW + 8, curY + 72)

  // Card de Diagnóstico à direita dentro do Card Global
  const badgeText = diag?.badgeText || (isApprovedGlobal ? 'Excelente Rendimento' : 'Atenção Pedagógica')
  const abaixoCount = isAnual
    ? (params.disciplinasAnuais || []).filter((d) => !d.isPassed).length
    : (params.disciplinasBimestre || []).filter((d) => d.mediaFNum < 7.0).length
  const subBadgeText = abaixoCount === 0 ? '100% na média' : `${abaixoCount} disc. < 7.0`

  ctx.font = `800 12px ${fontMain}`
  const diagBoxW = Math.max(168, ctx.measureText(badgeText).width + 34)
  const diagBoxH = 52
  const diagBoxX = W - PAD_X - 18 - diagBoxW
  const diagBoxY = curY + 18

  fillAndStrokeRoundRect(
    ctx,
    diagBoxX,
    diagBoxY,
    diagBoxW,
    diagBoxH,
    13,
    '#ffffff',
    diag?.badgeBorder || '#e2e8f0',
    1.2
  )

  ctx.fillStyle = diag?.badgeColor || (isApprovedGlobal ? '#059669' : '#dc2626')
  ctx.font = `800 12px ${fontMain}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(badgeText, diagBoxX + diagBoxW / 2, diagBoxY + 11)

  ctx.fillStyle = '#64748b'
  ctx.font = `600 10px ${fontMain}`
  ctx.fillText(subBadgeText, diagBoxX + diagBoxW / 2, diagBoxY + 30)

  // Linha divisória inferior do Card Global
  const metaDividerY = curY + globalCardH - 32
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.06)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PAD_X + 18, metaDividerY)
  ctx.lineTo(W - PAD_X - 18, metaDividerY)
  ctx.stroke()

  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#64748b'
  ctx.font = `600 11px ${fontMain}`
  const metaLeft = isAnual
    ? `Média acumulada dos ${params.totalBimestresLancados || 0} ${(params.totalBimestresLancados || 0) === 1 ? 'bimestre lançado' : 'bimestres lançados'}`
    : `Referente ao ${params.periodoTitulo} de ${params.anoLetivo}`
  ctx.fillText(metaLeft, PAD_X + 18, metaDividerY + 16)

  ctx.textAlign = 'right'
  ctx.fillStyle = '#475569'
  ctx.font = `700 11px ${fontMain}`
  ctx.fillText(
    truncateText(ctx, `Turma: ${params.turmaNome}${params.turno ? ` - ${params.turno.toUpperCase()}` : ''}`, 280),
    W - PAD_X - 18,
    metaDividerY + 16
  )

  curY += globalCardH + 16

  // 5. Seção Rendimento por Disciplina
  fillAndStrokeRoundRect(ctx, PAD_X, curY, CONTENT_W, discContainerH, 20, '#ffffff', '#e2e8f0', 1.5)

  const dHeaderY = curY + 18
  fillAndStrokeRoundRect(ctx, PAD_X + 18, dHeaderY, 28, 28, 8, '#eff6ff')
  ctx.fillStyle = '#2563eb'
  ctx.font = `900 13px ${fontMain}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('📊', PAD_X + 18 + 14, dHeaderY + 14)

  ctx.textAlign = 'left'
  ctx.fillStyle = '#0f172a'
  ctx.font = `800 15.5px ${fontMain}`
  ctx.fillText(`Rendimento por Disciplina (${itemsCount})`, PAD_X + 56, dHeaderY + 14)

  ctx.textAlign = 'right'
  ctx.fillStyle = '#64748b'
  ctx.font = `700 11px ${fontMain}`
  ctx.fillText(
    isAnual
      ? `Base: ${params.totalBimestresLancados || 0} ${(params.totalBimestresLancados || 0) === 1 ? 'bimestre' : 'bimestres'}`
      : 'Média mínima: 7.0',
    W - PAD_X - 18,
    dHeaderY + 14
  )

  const gridStartY = curY + 20 + discSectionHeaderH
  const innerPadX = 18
  const innerGridW = CONTENT_W - innerPadX * 2
  const realCardW = cols === 1 ? innerGridW : (innerGridW - colGap) / 2

  for (let i = 0; i < itemsCount; i++) {
    const colIdx = i % cols
    const rowIdx = Math.floor(i / cols)
    const cx = PAD_X + innerPadX + colIdx * (realCardW + colGap)
    const cy = gridStartY + rowIdx * (discCardH + rowGap)

    let nome = ''
    let isPassed = true
    let gradeDisplay = '---'
    let mediaNum = 0
    let tokens: EvalToken[] = []
    let subGradeLabel = 'Média Final'

    if (isAnual) {
      const item = params.disciplinasAnuais![i]
      nome = item.nome
      isPassed = item.isPassed
      gradeDisplay = item.mediaAnualFormatada
      mediaNum = item.mediaFNum
      tokens = buildAnualTokens(item)
      subGradeLabel = `Média (${item.lancadosCount}b)`
    } else {
      const item = params.disciplinasBimestre![i]
      nome = item.nome
      mediaNum = item.mediaFNum
      isPassed = mediaNum >= 7.0
      gradeDisplay = item.mediaF && item.mediaF !== '---' ? String(item.mediaF) : String(item.mediaG || '---')
      tokens = buildBimestreTokens(item)
      subGradeLabel = 'Média'
    }

    const cardBg = isPassed ? '#f8fafc' : '#fff8f8'
    const cardBorder = isPassed ? '#e2e8f0' : '#fecaca'
    fillAndStrokeRoundRect(ctx, cx, cy, realCardW, discCardH, 13, cardBg, cardBorder, 1.2)

    const leftMaxW = realCardW - 84
    const statusLabel = isPassed ? 'Na Média' : 'Abaixo'
    ctx.font = `800 9px ${fontMain}`
    const statusPillW = ctx.measureText(statusLabel).width + 10

    // Nome da disciplina
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#0f172a'
    ctx.font = `800 12.5px ${fontMain}`
    const maxNameW = leftMaxW - statusPillW - 8
    const truncName = truncateText(ctx, nome, maxNameW)
    ctx.fillText(truncName, cx + 12, cy + 11)

    // Pill Na Média / Abaixo
    const pillX = cx + 12 + ctx.measureText(truncName).width + 6
    const pillY = cy + 10
    fillAndStrokeRoundRect(
      ctx,
      pillX,
      pillY,
      statusPillW,
      16,
      4,
      isPassed ? '#dcfce7' : '#fee2e2'
    )
    ctx.fillStyle = isPassed ? '#15803d' : '#dc2626'
    ctx.font = `800 9px ${fontMain}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(statusLabel, pillX + statusPillW / 2, pillY + 8)

    // Tokens de avaliações (AVM, AVB, Simulado, Bônus, Rec ou Bimestres)
    let tx = cx + 12
    let ty = cy + 33
    const maxTokenX = cx + 12 + leftMaxW
    let lineCount = 1

    for (let tIdx = 0; tIdx < tokens.length; tIdx++) {
      const tk = tokens[tIdx]
      ctx.font = `600 9.5px ${fontMain}`
      const lblW = ctx.measureText(tk.label + ' ').width
      ctx.font = `800 9.5px ${fontMain}`
      const valW = ctx.measureText(tk.value).width
      const tokenTotalW = lblW + valW + (tk.badgeBg ? 8 : 0)

      if (tx + tokenTotalW > maxTokenX && tx > cx + 12) {
        if (lineCount >= 2) break
        lineCount++
        tx = cx + 12
        ty += 15
      }

      if (tk.badgeBg) {
        fillAndStrokeRoundRect(ctx, tx, ty - 1, tokenTotalW, 13, 4, tk.badgeBg)
        ctx.fillStyle = tk.badgeColor || '#b45309'
        ctx.font = `800 9px ${fontMain}`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText(`${tk.label} ${tk.value}`, tx + 4, ty + 1)
        tx += tokenTotalW + 6
      } else {
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillStyle = '#64748b'
        ctx.font = `600 9.5px ${fontMain}`
        ctx.fillText(tk.label, tx, ty)

        ctx.fillStyle = tk.valueColor
        ctx.font = `800 9.5px ${fontMain}`
        ctx.fillText(tk.value, tx + lblW, ty)
        tx += lblW + valW + 8
      }
    }

    // Barra de progresso
    const barY = cy + discCardH - 13
    const barW = leftMaxW - 6
    const barH = 4.5
    fillAndStrokeRoundRect(ctx, cx + 12, barY, barW, barH, 2.2, '#e2e8f0')
    const fillPct = Math.max(0, Math.min(1, (mediaNum || 0) / 10))
    if (fillPct > 0) {
      fillAndStrokeRoundRect(
        ctx,
        cx + 12,
        barY,
        Math.max(6, barW * fillPct),
        barH,
        2.2,
        isPassed ? '#10b981' : '#ef4444'
      )
    }

    // Nota Final à direita do card
    const rightX = cx + realCardW - 12
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillStyle = isPassed ? '#059669' : '#dc2626'
    ctx.font = `900 21px ${fontMain}`
    ctx.fillText(gradeDisplay, rightX, cy + (discCardH / 2) - 17)

    ctx.fillStyle = '#64748b'
    ctx.font = `700 9px ${fontMain}`
    ctx.fillText(subGradeLabel, rightX, cy + (discCardH / 2) + 8)
  }

  curY += discContainerH

  // 6. Rodapé Oficial
  const footerY = curY + 20
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#94a3b8'
  ctx.font = `700 10px ${fontMain}`
  ctx.fillText('IMPACTO EDU • Sistema de Gestão Escolar • Agenda Digital', PAD_X + 4, footerY)

  const now = new Date()
  const emissaoStr = `Emitido em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  ctx.textAlign = 'right'
  ctx.fillText(emissaoStr, W - PAD_X - 4, footerY)

  // Exporta o Canvas para PNG (DataURL + conversão síncrona para Blob sem dupla codificação PNG)
  const dataUrl = canvas.toDataURL('image/png', 1.0)
  const blob = dataUrlToBlob(dataUrl)

  const rawStudent = (params.aluno?.nome || 'Aluno')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  const rawPeriodo = (params.periodoTitulo || 'Boletim')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  const fileName = `Boletim_${rawStudent}_${rawPeriodo}_${params.anoLetivo}.png`
  const title = `Boletim Escolar - ${params.aluno?.nome || 'Aluno'} (${params.periodoTitulo} ${params.anoLetivo})`
  const shareText = `📊 Boletim Escolar (${params.periodoTitulo} - ${params.anoLetivo}) de ${params.aluno?.nome || 'Aluno'} • Média Global: ${(params.mediaGlobal || 0).toFixed(1)}`

  // Pré-carrega em background no servidor/Storage para que no Android (WebView e Chrome)
  // o download e compartilhamento funcionem instantaneamente ao toque do usuário
  const remoteUrlsPromise = uploadBoletimImageForDownload(blob, fileName)

  return {
    blob,
    dataUrl,
    fileName,
    title,
    shareText,
    remoteUrlsPromise,
  }
}
