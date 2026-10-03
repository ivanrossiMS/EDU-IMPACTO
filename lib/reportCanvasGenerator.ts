export interface GenerateReportImageParams {
  colaboradorNome: string
  colaboradorCargo?: string
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
  dias: Record<number, {
    total: number
    comunicados: number
    relatorios: number
    momentos: number
  }>
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

// Helper para desenhar retângulos com cantos arredondados (cross-browser fallback)
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number | number[]
) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath()
    ctx.roundRect(x, y, width, height, radius)
    return
  }
  const r = typeof radius === 'number' ? radius : radius[0] || 0
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/**
 * Gera um infográfico de alta resolução em HTML5 Canvas e retorna a Data URL em PNG.
 */
export async function generateFrequencyReportImage(params: GenerateReportImageParams): Promise<string> {
  const { colaboradorNome, colaboradorCargo = 'Colaborador(a)', mes, ano, summary, dias } = params
  const mesNome = MONTH_NAMES[mes - 1]

  const width = 1200
  const height = 900

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível inicializar o contexto 2D do Canvas.')

  // 1. Fundo Geral
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(0, 0, width, height)

  // Card Principal com borda suave
  const margin = 24
  const cardW = width - margin * 2
  const cardH = height - margin * 2

  roundRect(ctx, margin, margin, cardW, cardH, 24)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = '#e2e8f0'
  ctx.stroke()

  // 2. Header Superior com Gradiente Moderno
  const headerH = 130
  roundRect(ctx, margin, margin, cardW, headerH, [24, 24, 0, 0])
  const headerGrad = ctx.createLinearGradient(margin, margin, margin + cardW, margin + headerH)
  headerGrad.addColorStop(0, '#4338ca')
  headerGrad.addColorStop(0.5, '#6366f1')
  headerGrad.addColorStop(1, '#7c3aed')
  ctx.fillStyle = headerGrad
  ctx.fill()

  // Tag do Colégio
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
  roundRect(ctx, margin + 32, margin + 22, 180, 26, 8)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 11.5px "Inter", -apple-system, sans-serif'
  ctx.fillText('COLÉGIO IMPACTO • AGENDA', margin + 44, margin + 39)

  // Título do Documento
  ctx.fillStyle = '#ffffff'
  ctx.font = '800 28px "Inter", -apple-system, sans-serif'
  ctx.fillText('RELATÓRIO MENSAL DE FREQUÊNCIA E ENVIOS', margin + 32, margin + 80)

  // Subtítulo
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.font = '600 14px "Inter", -apple-system, sans-serif'
  ctx.fillText(`Período de Referência: ${mesNome.toUpperCase()} DE ${ano} • Acompanhamento Institucional`, margin + 32, margin + 106)

  // Selo no canto direito do header
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
  roundRect(ctx, width - margin - 190, margin + 35, 158, 60, 14)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = '800 11px "Inter", -apple-system, sans-serif'
  ctx.fillText('DOCUMENTO OFICIAL', width - margin - 176, margin + 58)
  ctx.font = '600 12px "Inter", -apple-system, sans-serif'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.fillText('DIREÇÃO GERAL', width - margin - 176, margin + 78)

  // 3. Seção do Colaborador (Banner de Perfil)
  const profileY = margin + headerH + 20
  const profileH = 92
  roundRect(ctx, margin + 32, profileY, cardW - 64, profileH, 18)
  ctx.fillStyle = '#f8fafc'
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = '#e2e8f0'
  ctx.stroke()

  // Avatar do Colaborador
  const avatarSize = 56
  const avatarX = margin + 54
  const avatarY = profileY + 18
  roundRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 16)
  const avatarGrad = ctx.createLinearGradient(avatarX, avatarY, avatarX + avatarSize, avatarY + avatarSize)
  avatarGrad.addColorStop(0, '#4f46e5')
  avatarGrad.addColorStop(1, '#7c3aed')
  ctx.fillStyle = avatarGrad
  ctx.fill()

  // Letra Inicial
  ctx.fillStyle = '#ffffff'
  ctx.font = '800 24px "Inter", -apple-system, sans-serif'
  const initial = colaboradorNome ? colaboradorNome.charAt(0).toUpperCase() : 'U'
  ctx.fillText(initial, avatarX + 20, avatarY + 38)

  // Nome e Cargo
  ctx.fillStyle = '#0f172a'
  ctx.font = '800 22px "Inter", -apple-system, sans-serif'
  ctx.fillText(colaboradorNome, avatarX + avatarSize + 18, avatarY + 28)

  ctx.fillStyle = '#4f46e5'
  ctx.font = '700 13px "Inter", -apple-system, sans-serif'
  ctx.fillText(`Função / Cargo: ${colaboradorCargo}`, avatarX + avatarSize + 18, avatarY + 49)

  // Data de Emissão no canto direito
  const hojeFormatado = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  ctx.fillStyle = '#64748b'
  ctx.font = '600 12px "Inter", -apple-system, sans-serif'
  ctx.fillText(`Data de Emissão: ${hojeFormatado}`, width - margin - 230, profileY + 42)
  ctx.fillText(`Status: Homologado`, width - margin - 230, profileY + 60)

  // 4. Cards de Métricas Principais (4 colunas)
  const metricsY = profileY + profileH + 20
  const metricCardW = (cardW - 64 - 36) / 4
  const metricCardH = 120

  const metricsConfig = [
    {
      title: 'TOTAL DE PUBLICAÇÕES',
      value: String(summary.totalGeral),
      sub: 'envios no período',
      borderColor: '#6366f1',
      bgColor: '#eef2ff',
      textColor: '#4338ca'
    },
    {
      title: 'COMUNICADOS',
      value: String(summary.totalComunicados),
      sub: 'avisos e comunicados',
      borderColor: '#3b82f6',
      bgColor: '#eff6ff',
      textColor: '#1d4ed8'
    },
    {
      title: 'RELATÓRIOS DE ROTINA',
      value: String(summary.totalRelatorios),
      sub: 'rotinas pedagógicas',
      borderColor: '#8b5cf6',
      bgColor: '#f5f3ff',
      textColor: '#6d28d9'
    },
    {
      title: 'MOMENTOS & FOTOS',
      value: String(summary.totalMomentos),
      sub: 'fotos e vídeos',
      borderColor: '#ec4899',
      bgColor: '#fdf2f8',
      textColor: '#be185d'
    }
  ]

  metricsConfig.forEach((m, idx) => {
    const cardX = margin + 32 + idx * (metricCardW + 12)
    roundRect(ctx, cardX, metricsY, metricCardW, metricCardH, 16)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = '#e2e8f0'
    ctx.stroke()

    // Borda superior colorida
    roundRect(ctx, cardX, metricsY, metricCardW, 6, [16, 16, 0, 0])
    ctx.fillStyle = m.borderColor
    ctx.fill()

    // Título da Métrica
    ctx.fillStyle = '#64748b'
    ctx.font = '800 11px "Inter", -apple-system, sans-serif'
    ctx.fillText(m.title, cardX + 16, metricsY + 30)

    // Valor da Métrica
    ctx.fillStyle = m.textColor
    ctx.font = '900 34px "Inter", -apple-system, sans-serif'
    ctx.fillText(m.value, cardX + 16, metricsY + 74)

    // Subtítulo da Métrica
    ctx.fillStyle = '#94a3b8'
    ctx.font = '600 11px "Inter", -apple-system, sans-serif'
    ctx.fillText(m.sub, cardX + 16, metricsY + 98)
  })

  // 5. Seção de Consistência e Dias Ativos
  const summaryY = metricsY + metricCardH + 18
  const summaryH = 88
  const isZeroActivity = (summary.totalGeral || 0) === 0 || (summary.diasComEnvios || 0) === 0
  const pct = summary.diasNoMes > 0 ? Math.round((summary.diasComEnvios / summary.diasNoMes) * 100) : 0

  roundRect(ctx, margin + 32, summaryY, cardW - 64, summaryH, 16)
  ctx.fillStyle = isZeroActivity ? '#fffbeb' : '#f0fdf4'
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = isZeroActivity ? '#fde68a' : '#bbf7d0'
  ctx.stroke()

  ctx.fillStyle = isZeroActivity ? '#b45309' : '#15803d'
  ctx.font = '800 12px "Inter", -apple-system, sans-serif'
  ctx.fillText('ASSIDUIDADE E FREQUÊNCIA NO MÊS', margin + 54, summaryY + 28)

  if (isZeroActivity) {
    ctx.fillStyle = '#92400e'
    ctx.font = '800 20px "Inter", -apple-system, sans-serif'
    ctx.fillText('0 dias com envios registrados (0% de atividade)', margin + 54, summaryY + 54)

    ctx.fillStyle = '#b45309'
    ctx.font = '600 12px "Inter", -apple-system, sans-serif'
    ctx.fillText('Atenção: Nenhum registro pedagógico ou comunicado realizado neste mês', margin + 54, summaryY + 73)
  } else {
    ctx.fillStyle = '#14532d'
    ctx.font = '800 20px "Inter", -apple-system, sans-serif'
    ctx.fillText(`${summary.diasComEnvios} de ${summary.diasNoMes} dias com envios (${pct}% de atividade)`, margin + 54, summaryY + 54)

    ctx.fillStyle = '#166534'
    ctx.font = '600 12px "Inter", -apple-system, sans-serif'
    ctx.fillText(`Média de ${summary.mediaPorDiaAtivo} envios diários nos dias ativos`, margin + 54, summaryY + 73)
  }

  // Barra de progresso visual
  const barX = width - margin - 380
  const barY = summaryY + 36
  const barW = 320
  const barH = 14
  roundRect(ctx, barX, barY, barW, barH, 7)
  ctx.fillStyle = isZeroActivity ? '#fef3c7' : '#dcfce7'
  ctx.fill()

  const progressW = Math.max(8, (pct / 100) * barW)
  roundRect(ctx, barX, barY, progressW, barH, 7)
  ctx.fillStyle = isZeroActivity ? '#f59e0b' : '#16a34a'
  ctx.fill()

  ctx.fillStyle = isZeroActivity ? '#b45309' : '#15803d'
  ctx.font = '800 12px "Inter", -apple-system, sans-serif'
  ctx.fillText(`${pct}% de assiduidade`, barX + barW - 120, barY - 8)

  // 6. Mini Calendário Heatmap do Mês
  const calY = summaryY + summaryH + 18
  const calH = 190
  roundRect(ctx, margin + 32, calY, cardW - 64, calH, 16)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = '#e2e8f0'
  ctx.stroke()

  ctx.fillStyle = '#334155'
  ctx.font = '800 13px "Inter", -apple-system, sans-serif'
  ctx.fillText(`Calendário de Envios do Colaborador (${mesNome} / ${ano})`, margin + 54, calY + 28)

  ctx.fillStyle = '#94a3b8'
  ctx.font = '600 11.5px "Inter", -apple-system, sans-serif'
  ctx.fillText('Dias destacados indicam publicações realizadas no dia', margin + 54, calY + 46)

  // Renderizar 31 quadradinhos (em até 2 linhas ou matriz horizontal limpa)
  const totalDays = summary.diasNoMes || 31
  const cols = 16
  const cellSize = 30
  const cellGap = 8
  const startCalX = margin + 54
  const startCalY = calY + 65

  for (let d = 1; d <= totalDays; d++) {
    const row = Math.floor((d - 1) / cols)
    const col = (d - 1) % cols
    const cx = startCalX + col * (cellSize + cellGap)
    const cy = startCalY + row * (cellSize + cellGap + 16)

    const dayData = dias[d]
    const qtd = dayData ? dayData.total : 0

    roundRect(ctx, cx, cy, cellSize, cellSize, 8)
    if (qtd > 0) {
      ctx.fillStyle = '#4f46e5'
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.font = '800 12px "Inter", -apple-system, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(String(d), cx + cellSize / 2, cy + cellSize / 2 + 4)
      ctx.textAlign = 'left'

      // Micro badge com a quantidade
      ctx.fillStyle = '#10b981'
      ctx.font = '800 9px "Inter", -apple-system, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`${qtd}`, cx + cellSize / 2, cy + cellSize + 11)
      ctx.textAlign = 'left'
    } else {
      ctx.fillStyle = '#f1f5f9'
      ctx.fill()
      ctx.fillStyle = '#94a3b8'
      ctx.font = '700 11px "Inter", -apple-system, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(String(d), cx + cellSize / 2, cy + cellSize / 2 + 4)
      ctx.textAlign = 'left'
    }
  }

  // Legenda do Mini Calendário
  const legX = width - margin - 240
  const legY = calY + 28
  roundRect(ctx, legX, legY, 12, 12, 3)
  ctx.fillStyle = '#4f46e5'
  ctx.fill()
  ctx.fillStyle = '#475569'
  ctx.font = '700 11px "Inter", -apple-system, sans-serif'
  ctx.fillText('Com Envios', legX + 18, legY + 10)

  roundRect(ctx, legX + 100, legY, 12, 12, 3)
  ctx.fillStyle = '#f1f5f9'
  ctx.fill()
  ctx.fillStyle = '#94a3b8'
  ctx.fillText('Sem Envios', legX + 118, legY + 10)

  // 7. Rodapé de Assinatura Oficial (Remetente Administrador Master)
  const footerY = height - margin - 50
  ctx.fillStyle = '#e2e8f0'
  ctx.fillRect(margin + 32, footerY - 14, cardW - 64, 1)

  ctx.fillStyle = '#4f46e5'
  ctx.font = '800 12px "Inter", -apple-system, sans-serif'
  ctx.fillText('👑 REMETENTE: IVAN ROSSI • ADMINISTRADOR MASTER / DIRETOR GERAL', margin + 44, footerY + 10)

  ctx.fillStyle = '#94a3b8'
  ctx.font = '600 11px "Inter", -apple-system, sans-serif'
  ctx.fillText('Colégio Impacto • Sistema Integrado de Gestão Escolar (Agenda Digital)', margin + 44, footerY + 28)

  const authCode = `AD-FREQ-${ano}-${String(mes).padStart(2, '0')}-${Date.now().toString(36).toUpperCase()}`
  ctx.textAlign = 'right'
  ctx.fillText(`Chave de Autenticação: ${authCode}`, width - margin - 44, footerY + 18)
  ctx.textAlign = 'left'

  return canvas.toDataURL('image/png')
}
