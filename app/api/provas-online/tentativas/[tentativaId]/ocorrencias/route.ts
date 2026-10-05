import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import {
  dbGetTentativaById,
  dbSaveTentativa,
  dbRecordOcorrencia,
  dbGetOcorrenciasByTentativaId,
  dbGetProvaById,
  dbSaveExcecao
} from '@/lib/provas-online/db'
import { autoGradeTentativa } from '@/lib/provas-online/engine'
import { OcorrenciaMonitoramento } from '@/types/provas-online'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tentativaId: string }> }
) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  const { tentativaId } = await params
  const ocorrencias = await dbGetOcorrenciasByTentativaId(tentativaId)
  return NextResponse.json({ ok: true, ocorrencias, total: ocorrencias.length })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tentativaId: string }> }
) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  const { tentativaId } = await params
  const tentativa = await dbGetTentativaById(tentativaId)
  if (!tentativa) {
    return NextResponse.json({ error: 'Tentativa não encontrada' }, { status: 404 })
  }

  const body = await request.json()
  const rawTipo = String(body.tipo || '')
  const tipo: OcorrenciaMonitoramento['tipo'] =
    rawTipo === 'troca_aba' ? 'saida_tela' :
    rawTipo === 'tentativa_cola' ? 'tentativa_colar' :
    (body.tipo as OcorrenciaMonitoramento['tipo'])
  const descricao = body.descricao || 'Ocorrência registrada durante a aplicação'
  const duracaoSegundos = Number(body.duracaoSegundos || 0)

  // Debouncing: check if an identical event was recorded in the last 5 seconds to avoid flooding
  const recent = await dbGetOcorrenciasByTentativaId(tentativaId)
  const now = Date.now()
  const duplicate = recent.find(r => {
    const timeDiff = Math.abs(now - new Date(r.createdAt).getTime())
    return r.tipo === tipo && timeDiff < 5000
  })

  if (duplicate) {
    return NextResponse.json({ ok: true, debounced: true })
  }

  const novaOcorrencia: OcorrenciaMonitoramento = {
    id: crypto.randomUUID(),
    tentativaId,
    alunoId: tentativa.alunoId,
    alunoNome: tentativa.alunoNome,
    tipo,
    descricao,
    duracaoSegundos,
    detalhes: body.detalhes || null,
    createdAt: new Date().toISOString()
  }

  await dbRecordOcorrencia(novaOcorrencia)

  // Check if exam config mandates cancellation or suspension on incident
  const prova = await dbGetProvaById(tentativa.provaId)
  let suspensa = false
  let cancelada = false

  const acaoConfig = prova?.configuracaoMonitoramento?.acaoOcorrencia || (prova as any)?.acaoOcorrencia || 'alertar'

  if (acaoConfig === 'cancelar' && prova) {
    const isCancellationIncident = 
      tipo === 'saida_tela' || 
      tipo === 'saida_tela_cheia' || 
      tipo === 'perda_foco' ||
      tipo === 'tentativa_colar'

    if (isCancellationIncident) {
      if (body.respostas && typeof body.respostas === 'object') {
        tentativa.respostas = { ...tentativa.respostas, ...body.respostas }
      }
      const nowIso = new Date().toISOString()
      tentativa.status = 'entregue'
      tentativa.entregueEm = nowIso
      tentativa.motivoCancelamento = `Prova encerrada e cancelada por infringir a regra de não minimizar ou sair da tela da avaliação.`
      const graded = autoGradeTentativa(prova, tentativa)
      tentativa.pontuacaoObjetiva = graded.pontuacaoObjetiva
      tentativa.notaFinal = graded.notaFinal
      tentativa.statusCorrecao = graded.statusCorrecao
      tentativa.comprovanteCodigo = graded.comprovanteCodigo
      tentativa.respostas = graded.respostas
      tentativa.comprovanteEntrega = {
        hash: graded.comprovanteCodigo,
        provaId: prova.id,
        alunoId: tentativa.alunoId,
        alunoNome: tentativa.alunoNome,
        matricula: tentativa.alunoMatricula || '',
        dataHoraEntrega: nowIso,
        totalQuestoes: prova.questoes?.length || 0,
        totalRespostasRegistradas: Object.keys(tentativa.respostas || {}).length,
        protocolo: graded.comprovanteCodigo
      }
      tentativa.updatedAt = nowIso
      await dbSaveTentativa(tentativa)
      cancelada = true

      await dbSaveExcecao({
        id: crypto.randomUUID(),
        provaId: prova.id,
        alunoId: tentativa.alunoId,
        alunoNome: tentativa.alunoNome,
        tipoExcecao: 'encerramento_antecipado',
        justificativa: `Cancelamento automático por infringir regras de integridade (não minimizar): ${descricao}`,
        autorizadoPor: 'Supervisão Automática (Sistema)',
        createdAt: nowIso
      }).catch(() => {})
    }
  } else if (acaoConfig === 'suspender') {
    const isSuspensionIncident = 
      tipo === 'saida_tela' || 
      tipo === 'saida_tela_cheia' || 
      tipo === 'tentativa_colar'

    if (isSuspensionIncident) {
      tentativa.status = 'suspensa'
      tentativa.motivoSuspensao = `Sessão suspensa automaticamente: ${descricao}`
      await dbSaveTentativa(tentativa)
      suspensa = true
    }
  }

  return NextResponse.json({
    ok: true,
    ocorrencia: novaOcorrencia,
    acao: acaoConfig,
    suspensa,
    cancelada,
    tentativa: cancelada ? tentativa : undefined
  }, { status: 201 })
}
