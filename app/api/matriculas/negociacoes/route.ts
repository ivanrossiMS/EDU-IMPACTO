import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'

const CONFIG_KEY = 'matriculas_negociacoes_v1'

export interface NegociacaoAlunoItem {
  id?: string
  nome: string
  serieTurma: string
  segmentoId?: string
  tipoAluno?: 'veterano' | 'novo'
  vinculadoErp?: boolean
}

export interface HistoricoNegociacaoItem {
  id: string
  dataHora: string
  usuario: string
  acao: string
  detalhe?: string
}

export interface NegociacaoMatriculaRecord {
  id: string
  protocolo: string
  anoLetivo: string
  createdAt: string
  updatedAt: string

  // Identificação Aluno(s) e Responsável
  alunos: NegociacaoAlunoItem[]
  alunoNome: string
  serieTurma: string
  segmentoId?: string
  tipoAluno: 'veterano' | 'novo'
  vinculadoErp: boolean
  alunoIdErp?: string

  responsavelNome: string
  responsavelParentesco: string
  responsavelTelefone: string
  responsavelCpf: string
  responsavelIdErp?: string

  // Classificação Principal isaac vs Fora do isaac
  modalidadeIsaac: 'no_isaac' | 'fora_isaac' | 'hibrido'

  // Bloco 1: Matrícula / Rematrícula
  temMatricula: boolean
  valorTabelaMatricula: number
  descontoMatriculaPct: number
  valorAutorizadoMatricula: number
  formaPagamentoMatricula: string
  parcelasMatricula: number
  valorParcelaMatricula: number
  canalMatricula: 'no_isaac' | 'fora_isaac'
  detalheMatricula: string

  // Bloco 2: Mensalidades / Anuidade
  temMensalidade: boolean
  valorTabelaMensalidade: number
  descontoMensalidadePct: number
  valorAutorizadoMensalidade: number
  qtdParcelasMensalidade: number
  diaVencimentoMensalidade: number
  condicaoMensalidade: string
  canalMensalidade: 'no_isaac' | 'fora_isaac'

  // Bloco 3: Parcelamento Especial / Acordo
  temParcelamentoEspecial: boolean
  descricaoParcelamento: string
  valorOriginalParcelamento: number
  descontoParcelamentoPct: number
  valorAutorizadoParcelamento: number
  entradaParcelamento: number
  qtdParcelasEspecial: number
  valorParcelaEspecial: number
  formaPagamentoParcelamento: string
  canalParcelamento: 'no_isaac' | 'fora_isaac'

  // Bloco 4: Material Didático / Serviços Extras
  temMaterial: boolean
  descricaoMaterial: string
  valorTabelaMaterial: number
  descontoMaterialPct: number
  valorAutorizadoMaterial: number
  parcelasMaterial: number
  formaPagamentoMaterial: string
  canalMaterial: 'no_isaac' | 'fora_isaac'

  // Autorização & Governança
  autorizadoPor: string
  meioAutorizacao: string
  dataAutorizacao: string
  validadeNegociacao: string
  registradoPor: string
  status: 'autorizado' | 'lancado' | 'concluido' | 'cancelado'
  observacoesDirecao: string
  observacoesOperacionais: string
  historico: HistoricoNegociacaoItem[]
}

const CACHE_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Pragma': 'no-cache',
  'Expires': '0',
}

async function loadNegociacoesList(supabase: any): Promise<NegociacaoMatriculaRecord[]> {
  const { data, error } = await supabase
    .from('configuracoes')
    .select('valor')
    .eq('chave', CONFIG_KEY)
    .maybeSingle()

  if (error || !data || !Array.isArray(data.valor)) {
    return []
  }
  return data.valor as NegociacaoMatriculaRecord[]
}

async function saveNegociacoesList(supabase: any, list: NegociacaoMatriculaRecord[]): Promise<void> {
  const { error } = await supabase
    .from('configuracoes')
    .upsert({
      chave: CONFIG_KEY,
      valor: list,
      updated_at: new Date().toISOString(),
    })

  if (error) {
    throw new Error(error.message)
  }

  // Limpa cache global de configuracoes se existir no processo
  const globalCache = (globalThis as any).configCache
  if (globalCache && typeof globalCache.clear === 'function') {
    globalCache.clear()
  }
}

function generateProtocolo(anoLetivo: string, existingList: NegociacaoMatriculaRecord[]): string {
  const anoClean = String(anoLetivo || '2027').trim()
  const prefix = `NEG-${anoClean}-`
  let maxSeq = 0
  for (const item of existingList) {
    if (item.protocolo && item.protocolo.startsWith(prefix)) {
      const numPart = parseInt(item.protocolo.slice(prefix.length), 10)
      if (!isNaN(numPart) && numPart > maxSeq) {
        maxSeq = numPart
      }
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`
}

/**
 * GET /api/matriculas/negociacoes
 */
export async function GET(request: Request) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const supabase = getAdminClient()
    const list = await loadNegociacoesList(supabase)

    const sorted = [...list].sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime()
      const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime()
      return dateB - dateA
    })

    return NextResponse.json({ negociacoes: sorted }, { headers: CACHE_HEADERS })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao carregar negociações' }, { status: 500 })
  }
}

/**
 * POST /api/matriculas/negociacoes
 * Cria ou atualiza uma negociação autorizada
 */
export async function POST(request: Request) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const supabase = getAdminClient()
    const currentList = await loadNegociacoesList(supabase)

    const nowIso = new Date().toISOString()
    const anoLetivo = String(body.anoLetivo || '2027').trim()
    const existingIdx = body.id ? currentList.findIndex(item => item.id === body.id) : -1
    const existingItem = existingIdx >= 0 ? currentList[existingIdx] : null

    const id = existingItem?.id || body.id || `neg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    const protocolo = existingItem?.protocolo || body.protocolo || generateProtocolo(anoLetivo, currentList)

    const usuarioAcao = String(body.usuarioAcao || body.registradoPor || body.autorizadoPor || 'Colaborador').trim()

    const novoHistorico: HistoricoNegociacaoItem = {
      id: `hist-${Date.now()}`,
      dataHora: nowIso,
      usuario: usuarioAcao,
      acao: existingItem ? 'Negociação atualizada' : 'Negociação registrada',
      detalhe: body.detalheHistorico || (existingItem
        ? `Dados da negociação atualizados por ${usuarioAcao}`
        : `Autorizada por ${body.autorizadoPor || 'Direção'}`),
    }

    const historicoAnterior = Array.isArray(existingItem?.historico)
      ? existingItem.historico
      : Array.isArray(body.historico)
        ? body.historico
        : []

    const alunosArray: NegociacaoAlunoItem[] = Array.isArray(body.alunos) && body.alunos.length > 0
      ? body.alunos
      : [{
          id: body.alunoIdErp || undefined,
          nome: String(body.alunoNome || '').trim(),
          serieTurma: String(body.serieTurma || '').trim(),
          segmentoId: body.segmentoId || '',
          tipoAluno: body.tipoAluno === 'novo' ? 'novo' : 'veterano',
          vinculadoErp: Boolean(body.vinculadoErp),
        }]

    const record: NegociacaoMatriculaRecord = {
      id,
      protocolo,
      anoLetivo,
      createdAt: existingItem?.createdAt || body.createdAt || nowIso,
      updatedAt: nowIso,

      alunos: alunosArray,
      alunoNome: alunosArray.map(a => a.nome).filter(Boolean).join(' / ') || String(body.alunoNome || '').trim(),
      serieTurma: alunosArray[0]?.serieTurma || String(body.serieTurma || '').trim(),
      segmentoId: alunosArray[0]?.segmentoId || body.segmentoId || '',
      tipoAluno: body.tipoAluno === 'novo' ? 'novo' : 'veterano',
      vinculadoErp: Boolean(body.vinculadoErp),
      alunoIdErp: body.alunoIdErp || '',

      responsavelNome: String(body.responsavelNome || '').trim(),
      responsavelParentesco: String(body.responsavelParentesco || 'Responsável Financeiro').trim(),
      responsavelTelefone: String(body.responsavelTelefone || '').trim(),
      responsavelCpf: String(body.responsavelCpf || '').trim(),
      responsavelIdErp: body.responsavelIdErp || '',

      modalidadeIsaac: ['no_isaac', 'fora_isaac', 'hibrido'].includes(body.modalidadeIsaac)
        ? body.modalidadeIsaac
        : 'no_isaac',

      temMatricula: Boolean(body.temMatricula),
      valorTabelaMatricula: Number(body.valorTabelaMatricula) || 0,
      descontoMatriculaPct: Number(body.descontoMatriculaPct) || 0,
      valorAutorizadoMatricula: Number(body.valorAutorizadoMatricula) || 0,
      formaPagamentoMatricula: String(body.formaPagamentoMatricula || 'Cartão de Crédito').trim(),
      parcelasMatricula: Math.max(1, Number(body.parcelasMatricula) || 1),
      valorParcelaMatricula: Number(body.valorParcelaMatricula) || 0,
      canalMatricula: body.canalMatricula === 'no_isaac' ? 'no_isaac' : 'fora_isaac',
      detalheMatricula: String(body.detalheMatricula || '').trim(),

      temMensalidade: Boolean(body.temMensalidade),
      valorTabelaMensalidade: Number(body.valorTabelaMensalidade) || 0,
      descontoMensalidadePct: Number(body.descontoMensalidadePct) || 0,
      valorAutorizadoMensalidade: Number(body.valorAutorizadoMensalidade) || 0,
      qtdParcelasMensalidade: Math.max(1, Number(body.qtdParcelasMensalidade) || 12),
      diaVencimentoMensalidade: Math.min(31, Math.max(1, Number(body.diaVencimentoMensalidade) || 10)),
      condicaoMensalidade: String(body.condicaoMensalidade || 'Desconto válido para pagamento até o vencimento').trim(),
      canalMensalidade: body.canalMensalidade === 'fora_isaac' ? 'fora_isaac' : 'no_isaac',

      temParcelamentoEspecial: Boolean(body.temParcelamentoEspecial),
      descricaoParcelamento: String(body.descricaoParcelamento || '').trim(),
      valorOriginalParcelamento: Number(body.valorOriginalParcelamento) || 0,
      descontoParcelamentoPct: Number(body.descontoParcelamentoPct) || 0,
      valorAutorizadoParcelamento: Number(body.valorAutorizadoParcelamento) || 0,
      entradaParcelamento: Number(body.entradaParcelamento) || 0,
      qtdParcelasEspecial: Math.max(1, Number(body.qtdParcelasEspecial) || 1),
      valorParcelaEspecial: Number(body.valorParcelaEspecial) || 0,
      formaPagamentoParcelamento: String(body.formaPagamentoParcelamento || 'Cartão de Crédito').trim(),
      canalParcelamento: body.canalParcelamento === 'no_isaac' ? 'no_isaac' : 'fora_isaac',

      temMaterial: Boolean(body.temMaterial),
      descricaoMaterial: String(body.descricaoMaterial || '').trim(),
      valorTabelaMaterial: Number(body.valorTabelaMaterial) || 0,
      descontoMaterialPct: Number(body.descontoMaterialPct) || 0,
      valorAutorizadoMaterial: Number(body.valorAutorizadoMaterial) || 0,
      parcelasMaterial: Math.max(1, Number(body.parcelasMaterial) || 1),
      formaPagamentoMaterial: String(body.formaPagamentoMaterial || 'Cartão de Crédito').trim(),
      canalMaterial: body.canalMaterial === 'no_isaac' ? 'no_isaac' : 'fora_isaac',

      autorizadoPor: String(body.autorizadoPor || 'Diretor Geral').trim(),
      meioAutorizacao: String(body.meioAutorizacao || 'Presencial na Direção').trim(),
      dataAutorizacao: String(body.dataAutorizacao || nowIso.slice(0, 10)).trim(),
      validadeNegociacao: String(body.validadeNegociacao || '').trim(),
      registradoPor: existingItem?.registradoPor || String(body.registradoPor || usuarioAcao).trim(),
      status: ['autorizado', 'lancado', 'concluido', 'cancelado'].includes(body.status)
        ? body.status
        : 'autorizado',
      observacoesDirecao: String(body.observacoesDirecao || '').trim(),
      observacoesOperacionais: String(body.observacoesOperacionais || '').trim(),
      historico: [novoHistorico, ...historicoAnterior].slice(0, 30),
    }

    const nextList = existingIdx >= 0
      ? currentList.map((it, idx) => (idx === existingIdx ? record : it))
      : [record, ...currentList]

    await saveNegociacoesList(supabase, nextList)

    return NextResponse.json({
      ok: true,
      negociacao: record,
      negociacoes: nextList,
    }, { headers: CACHE_HEADERS })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao salvar negociação' }, { status: 400 })
  }
}

/**
 * PATCH /api/matriculas/negociacoes
 * Atualização rápida de status operacional ou anotação de colaborador
 */
export async function PATCH(request: Request) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const { id, status, observacoesOperacionais, usuarioAcao, acaoLabel } = body
    if (!id) {
      return NextResponse.json({ error: 'ID da negociação é obrigatório' }, { status: 400 })
    }

    const supabase = getAdminClient()
    const currentList = await loadNegociacoesList(supabase)
    const idx = currentList.findIndex(item => item.id === id)
    if (idx < 0) {
      return NextResponse.json({ error: 'Negociação não encontrada' }, { status: 404 })
    }

    const target = currentList[idx]
    const nowIso = new Date().toISOString()
    const userStr = String(usuarioAcao || 'Colaborador').trim()

    const statusLabels: Record<string, string> = {
      autorizado: 'Autorizado (Aguardando Lançamento)',
      lancado: 'Lançado no isaac / Sistema',
      concluido: 'Concluído / Matrícula Efetivada',
      cancelado: 'Cancelado',
    }

    const novoHist: HistoricoNegociacaoItem = {
      id: `hist-${Date.now()}`,
      dataHora: nowIso,
      usuario: userStr,
      acao: acaoLabel || (status ? `Status alterado para: ${statusLabels[status] || status}` : 'Observação operacional registrada'),
      detalhe: observacoesOperacionais !== undefined ? observacoesOperacionais : undefined,
    }

    const updated: NegociacaoMatriculaRecord = {
      ...target,
      updatedAt: nowIso,
      status: status && ['autorizado', 'lancado', 'concluido', 'cancelado'].includes(status)
        ? status
        : target.status,
      observacoesOperacionais: observacoesOperacionais !== undefined
        ? String(observacoesOperacionais).trim()
        : target.observacoesOperacionais,
      historico: [novoHist, ...(Array.isArray(target.historico) ? target.historico : [])].slice(0, 30),
    }

    const nextList = currentList.map((it, i) => (i === idx ? updated : it))
    await saveNegociacoesList(supabase, nextList)

    return NextResponse.json({
      ok: true,
      negociacao: updated,
      negociacoes: nextList,
    }, { headers: CACHE_HEADERS })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao atualizar status da negociação' }, { status: 400 })
  }
}

/**
 * DELETE /api/matriculas/negociacoes?id=...
 */
export async function DELETE(request: Request) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    const supabase = getAdminClient()
    const currentList = await loadNegociacoesList(supabase)
    const nextList = currentList.filter(item => item.id !== id)

    await saveNegociacoesList(supabase, nextList)

    return NextResponse.json({
      ok: true,
      negociacoes: nextList,
    }, { headers: CACHE_HEADERS })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao excluir negociação' }, { status: 400 })
  }
}
