/**
 * lib/server/matriculaDigitalRepository.ts
 *
 * Repositório híbrido de alta resiliência para Matrículas Digitais.
 * Tenta persistir na tabela nativa `matriculas_digitais` do Supabase e,
 * caso a tabela ainda não tenha sido criada no schema, utiliza automaticamente
 * o armazenamento estruturado em `configuracoes` (chave: `matriculas_digitais_list`).
 */

import { getAdminClient } from './supabaseAdminSingleton'
import {
  generateProtocolCode,
  generateSecureToken,
  calculateSha256,
  calculateEventHash,
} from '../contracts/cryptoSignature'
import { EventoAuditoriaItem } from '../contracts/digitalEvidenceCertificate'

export interface ContratoDigitalModel {
  id: string
  protocolo: string
  token_assinatura: string
  aluno_id: string
  aluno_nome: string
  aluno_cpf?: string | null
  aluno_turma?: string | null
  aluno_serie?: string | null
  aluno_data_nascimento?: string | null
  responsavel_id?: string | null
  responsavel_nome: string
  responsavel_cpf: string
  responsavel_data_nascimento?: string | null
  responsavel_email: string
  responsavel_telefone: string
  responsavel_parentesco?: string | null
  ano_letivo: string
  tipo_documento: string
  titulo_documento: string
  valor_anuidade: number
  valor_mensalidade: number
  num_parcelas: number
  desconto_percent: number
  dia_vencimento: number
  primeiro_vencimento?: string | null
  status: 'rascunho' | 'pendente' | 'assinado' | 'recusado' | 'cancelado'
  versao_documento: string
  documento_original_hash: string
  documento_assinado_hash?: string | null
  trilha_auditoria_hash?: string | null
  documento_pdf_base64?: string | null
  documento_assinado_pdf_base64?: string | null
  documento_pdf_storage_path?: string | null
  documento_assinado_storage_path?: string | null
  totalPaginas?: number
  otp_codigo_hash?: string | null
  otp_codigo_aberto?: string | null // mantido para exibição administrativa em homologação
  otp_expira_em?: string | null
  otp_confirmado_em?: string | null
  otp_tentativas: number
  evidencias: Record<string, any>
  historico_eventos: EventoAuditoriaItem[]
  created_at: string
  updated_at: string
}

const FALLBACK_KEY = 'matriculas_digitais_list'

/**
 * Normaliza um registro de contrato
 */
function normalizeContrato(c: any): ContratoDigitalModel {
  return {
    id: c.id,
    protocolo: c.protocolo || '',
    token_assinatura: c.token_assinatura || '',
    aluno_id: c.aluno_id ? String(c.aluno_id) : '',
    aluno_nome: c.aluno_nome || '',
    aluno_cpf: c.aluno_cpf || null,
    aluno_turma: c.aluno_turma || null,
    aluno_serie: c.aluno_serie || null,
    aluno_data_nascimento: c.aluno_data_nascimento || null,
    responsavel_id: c.responsavel_id || null,
    responsavel_nome: c.responsavel_nome || 'Signatário',
    responsavel_cpf: c.responsavel_cpf || '',
    responsavel_data_nascimento: c.responsavel_data_nascimento || null,
    responsavel_email: c.responsavel_email || '',
    responsavel_telefone: c.responsavel_telefone || '',
    responsavel_parentesco: c.responsavel_parentesco || 'Signatário',
    ano_letivo: String(c.ano_letivo || new Date().getFullYear()),
    tipo_documento: c.tipo_documento || 'documento_upload',
    titulo_documento: c.titulo_documento || 'Documento para Assinatura Digital',
    valor_anuidade: Number(c.valor_anuidade) || 0,
    valor_mensalidade: Number(c.valor_mensalidade) || 0,
    num_parcelas: Number(c.num_parcelas) || 12,
    desconto_percent: Number(c.desconto_percent) || 0,
    dia_vencimento: Number(c.dia_vencimento) || 10,
    primeiro_vencimento: c.primeiro_vencimento || null,
    status: c.status || 'pendente',
    versao_documento: c.versao_documento || 'v2027.1',
    documento_original_hash: c.documento_original_hash || '',
    documento_assinado_hash: c.documento_assinado_hash || null,
    trilha_auditoria_hash: c.trilha_auditoria_hash || null,
    documento_pdf_base64: c.documento_pdf_base64 || null,
    documento_assinado_pdf_base64: c.documento_assinado_pdf_base64 || null,
    documento_pdf_storage_path: c.documento_pdf_storage_path || (c.id ? `contratos/${c.id}/original.pdf` : null),
    documento_assinado_storage_path: c.documento_assinado_storage_path || (c.id ? `contratos/${c.id}/assinado.pdf` : null),
    totalPaginas: Number(c.totalPaginas) || Number(c.evidencias?.totalPaginas) || 1,
    otp_codigo_hash: c.otp_codigo_hash || null,
    otp_codigo_aberto: c.otp_codigo_aberto || null,
    otp_expira_em: c.otp_expira_em || null,
    otp_confirmado_em: c.otp_confirmado_em || null,
    otp_tentativas: Number(c.otp_tentativas) || 0,
    evidencias: c.evidencias || {},
    historico_eventos: Array.isArray(c.historico_eventos) ? c.historico_eventos : [],
    created_at: c.created_at || new Date().toISOString(),
    updated_at: c.updated_at || new Date().toISOString(),
  }
}

// Cache em memória da disponibilidade da tabela matriculas_digitais para eliminar roundtrips com 404
let isTableAvailable: boolean | null = null
let memoryCacheContratos: { list: ContratoDigitalModel[]; usedFallback: boolean; timestamp: number } | null = null
const CACHE_TTL_MS = 2500 // 2.5 segundos para agilizar bursts de leituras concorrentes

export function invalidarCacheMemoriaContratos() {
  memoryCacheContratos = null
}

const STORAGE_BUCKET = 'documentos'

/**
 * Obtém os bytes binários do PDF do contrato sob demanda (Lazy Loading ultrarrápido)
 */
export async function obterPdfBytes(
  contrato: ContratoDigitalModel,
  tipo: 'original' | 'assinado' = 'original'
): Promise<Buffer | null> {
  const inlineBase64 = tipo === 'assinado' ? contrato.documento_assinado_pdf_base64 : contrato.documento_pdf_base64
  if (inlineBase64 && inlineBase64.length > 100) {
    return Buffer.from(inlineBase64.replace(/^data:application\/pdf;base64,/, ''), 'base64')
  }

  const supabase = getAdminClient()
  const customPath = tipo === 'assinado' ? contrato.documento_assinado_storage_path : contrato.documento_pdf_storage_path
  const fallbackPath = `contratos/${contrato.id}/${tipo === 'assinado' ? 'assinado' : 'original'}.pdf`
  const path = customPath || fallbackPath

  try {
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(path)
    if (!error && data) {
      const arrayBuf = await data.arrayBuffer()
      return Buffer.from(arrayBuf)
    }
  } catch (e) {
    console.warn(`[Repository] Erro ao baixar PDF (${tipo}) do storage:`, e)
  }

  // Fallback em chave dedicada em configuracoes
  try {
    const cfgKey = `matricula_pdf_${tipo === 'assinado' ? 'ass' : 'orig'}_${contrato.id}`
    const { data: cfgRow } = await supabase.from('configuracoes').select('valor').eq('chave', cfgKey).maybeSingle()
    if (cfgRow?.valor && typeof cfgRow.valor === 'string') {
      return Buffer.from(cfgRow.valor.replace(/^data:application\/pdf;base64,/, ''), 'base64')
    }
  } catch {}

  return null
}

/**
 * Obtém a representação Base64 do PDF sob demanda
 */
export async function obterPdfBase64(
  contrato: ContratoDigitalModel,
  tipo: 'original' | 'assinado' = 'original'
): Promise<string | null> {
  const bytes = await obterPdfBytes(contrato, tipo)
  if (!bytes) return null
  return bytes.toString('base64')
}

/**
 * Salva bytes do PDF de forma desacoplada no Supabase Storage
 */
export async function salvarPdfBytes(
  contratoId: string,
  tipo: 'original' | 'assinado',
  pdfBuffer: Buffer
): Promise<string> {
  const supabase = getAdminClient()
  const storagePath = `contratos/${contratoId}/${tipo === 'assinado' ? 'assinado' : 'original'}.pdf`

  try {
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })
    if (!error) {
      return storagePath
    }
    console.warn(`[Repository] Falha ao persistir no bucket ${STORAGE_BUCKET}:`, error)
  } catch (err) {
    console.warn(`[Repository] Exceção no upload para storage:`, err)
  }

  // Fallback em chave isolada em configuracoes
  try {
    const cfgKey = `matricula_pdf_${tipo === 'assinado' ? 'ass' : 'orig'}_${contratoId}`
    await supabase.from('configuracoes').upsert(
      {
        chave: cfgKey,
        valor: pdfBuffer.toString('base64'),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'chave' }
    )
  } catch (err) {
    console.warn(`[Repository] Falha no fallback de PDF individual em configuracoes:`, err)
  }

  return storagePath
}

/**
 * Anexa evento à trilha de auditoria em memória (imutável e encadeado)
 * Evita roundtrips redundantes de rede quando o contrato já está em memória.
 */
export function adicionarEventoAuditoriaEmMemoria(
  contrato: ContratoDigitalModel,
  evento: string,
  descricao: string,
  ip: string
): EventoAuditoriaItem {
  const historico = contrato.historico_eventos || []
  const ultimoEvento = historico[historico.length - 1]
  const prevHash = ultimoEvento?.hash || contrato.documento_original_hash || 'GENESIS_HASH'

  const eventId = `ev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
  const timestamp = new Date().toISOString()
  const eventHash = calculateEventHash(prevHash, eventId, timestamp, evento, ip)

  const novoEvento: EventoAuditoriaItem = {
    id: eventId,
    timestamp,
    evento,
    descricao,
    ip,
    hash: eventHash,
  }

  contrato.historico_eventos = [...historico, novoEvento]
  return novoEvento
}

/**
 * Lê todos os contratos do storage (tabela dedicada ou fallback ultraleve em configuracoes)
 */
async function getAllFromStorage(forceRefresh = false): Promise<{ list: ContratoDigitalModel[]; usedFallback: boolean }> {
  if (!forceRefresh && memoryCacheContratos && Date.now() - memoryCacheContratos.timestamp < CACHE_TTL_MS) {
    return {
      list: [...memoryCacheContratos.list],
      usedFallback: memoryCacheContratos.usedFallback,
    }
  }

  const supabase = getAdminClient()

  // 1. Tenta buscar na tabela pública matriculas_digitais apenas se a tabela estiver disponível
  if (isTableAvailable !== false) {
    try {
      const { data, error } = await supabase
        .from('matriculas_digitais')
        .select('*')
        .order('created_at', { ascending: false })

      if (!error && Array.isArray(data)) {
        isTableAvailable = true
        const result = {
          list: data.map(normalizeContrato),
          usedFallback: false,
        }
        memoryCacheContratos = { ...result, timestamp: Date.now() }
        return result
      }

      if (error && (
        error.code === 'PGRST205' ||
        error.message?.includes('Could not find the table') ||
        error.message?.includes('schema cache')
      )) {
        isTableAvailable = false
      }
    } catch {
      isTableAvailable = false
    }
  }

  // 2. Fallback para configuracoes (ultraleve ~13 KB)
  try {
    const { data: cfgRow, error: cfgError } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', FALLBACK_KEY)
      .maybeSingle()

    if (cfgError) {
      console.warn('[Repository] Aviso ao ler configuracoes fallback, realizando retry:', cfgError)
      // Retry único para tolerância a falhas transitórias
      const { data: retryRow, error: retryErr } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', FALLBACK_KEY)
        .maybeSingle()

      if (!retryErr && retryRow) {
        const rawList: any[] = Array.isArray(retryRow.valor) ? retryRow.valor : []
        const result = {
          list: rawList.map(normalizeContrato),
          usedFallback: true,
        }
        memoryCacheContratos = { ...result, timestamp: Date.now() }
        return result
      }
    }

    const rawList: any[] = Array.isArray(cfgRow?.valor) ? cfgRow.valor : []
    const result = {
      list: rawList.map(normalizeContrato),
      usedFallback: true,
    }
    memoryCacheContratos = { ...result, timestamp: Date.now() }
    return result
  } catch (err) {
    console.error('[Repository] Falha ao ler do fallback configuracoes:', err)
    return { list: [], usedFallback: true }
  }
}

/**
 * Salva a lista no fallback de configuracoes
 */
async function saveToFallback(list: ContratoDigitalModel[]) {
  const supabase = getAdminClient()
  const { error } = await supabase.from('configuracoes').upsert(
    {
      chave: FALLBACK_KEY,
      valor: list,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'chave' }
  )
  if (error) {
    console.error('[Repository] Erro ao salvar fallback em configuracoes:', error)
    throw new Error(`Falha ao salvar no fallback: ${error.message}`)
  }
  invalidarCacheMemoriaContratos()
}

/**
 * Salva ou atualiza um contrato individual no storage
 */
export async function salvarContrato(contrato: ContratoDigitalModel): Promise<ContratoDigitalModel> {
  const supabase = getAdminClient()

  // 1. Se o contrato possuir PDF original em Base64 pesado (>1KB), extrai para storage desacoplado
  if (contrato.documento_pdf_base64 && contrato.documento_pdf_base64.length > 1000) {
    const buf = Buffer.from(contrato.documento_pdf_base64.replace(/^data:application\/pdf;base64,/, ''), 'base64')
    contrato.documento_pdf_storage_path = await salvarPdfBytes(contrato.id, 'original', buf)
    contrato.documento_pdf_base64 = null
  }

  // 2. Se o contrato possuir PDF assinado em Base64 pesado (>1KB), extrai para storage desacoplado
  if (contrato.documento_assinado_pdf_base64 && contrato.documento_assinado_pdf_base64.length > 1000) {
    const buf = Buffer.from(contrato.documento_assinado_pdf_base64.replace(/^data:application\/pdf;base64,/, ''), 'base64')
    contrato.documento_assinado_storage_path = await salvarPdfBytes(contrato.id, 'assinado', buf)
    contrato.documento_assinado_pdf_base64 = null
  }

  const payload = {
    ...contrato,
    updated_at: new Date().toISOString(),
  }

  // Tenta salvar na tabela dedicada se disponível
  if (isTableAvailable !== false) {
    try {
      const { data, error } = await supabase
        .from('matriculas_digitais')
        .upsert(payload)
        .select()
        .maybeSingle()

      if (!error && data) {
        isTableAvailable = true
      } else if (error && (
        error.code === 'PGRST205' ||
        error.message?.includes('Could not find the table') ||
        error.message?.includes('schema cache')
      )) {
        isTableAvailable = false
      }
    } catch {
      isTableAvailable = false
    }
  }

  // Sincroniza com o fallback de metadados leves (agora ~13 KB!)
  try {
    const { list } = await getAllFromStorage(true)
    const idx = list.findIndex(c => c.id === contrato.id)
    let updatedList: ContratoDigitalModel[] = []
    if (idx >= 0) {
      updatedList = [...list]
      updatedList[idx] = payload
    } else {
      updatedList = [payload, ...list]
    }
    await saveToFallback(updatedList)
  } catch (err) {
    console.warn('[Repository] Falha ao sincronizar fallback:', err)
  }

  invalidarCacheMemoriaContratos()
  return payload
}

/**
 * Lista contratos com filtros e métricas de conversão
 */
export async function listarContratos(filtros?: {
  status?: string
  search?: string
  ano?: string
}) {
  const { list, usedFallback } = await getAllFromStorage()

  // Base filtrada pelo ano letivo para calcular métricas consistentes por ano
  const baseAnoList = (filtros?.ano && filtros.ano !== 'todos')
    ? list.filter(c => String(c.ano_letivo) === String(filtros.ano))
    : list

  const total = baseAnoList.length
  const pendentes = baseAnoList.filter(c => c.status === 'pendente').length
  const assinados = baseAnoList.filter(c => c.status === 'assinado').length
  const cancelados = baseAnoList.filter(c => c.status === 'cancelado' || c.status === 'recusado').length
  const taxaAssinatura = total > 0 ? Math.round((assinados / total) * 100) : 0

  let filtrados = baseAnoList

  if (filtros?.status && filtros.status !== 'todos') {
    filtrados = filtrados.filter(c => c.status === filtros.status)
  }

  if (filtros?.search) {
    const s = filtros.search.toLowerCase()
    filtrados = filtrados.filter(
      c =>
        (c.aluno_nome || '').toLowerCase().includes(s) ||
        (c.responsavel_nome || '').toLowerCase().includes(s) ||
        (c.responsavel_cpf || '').includes(s) ||
        (c.protocolo || '').toLowerCase().includes(s)
    )
  }

  const anosCadastrados = Array.from(
    new Set(list.map(c => String(c.ano_letivo || '').trim()).filter(Boolean))
  ).sort((a, b) => Number(b) - Number(a))

  // Identifica ano vigente e ano mais recente do sistema
  const supabase = getAdminClient()
  let anoVigente = '2026'
  let ultimoAnoCadastrado = anosCadastrados[0] || '2027'

  try {
    const { data: calRow } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'cfgCalendarioLetivo')
      .maybeSingle()

    if (Array.isArray(calRow?.valor)) {
      const vig = calRow.valor.find((c: any) => c && (c.isVigente || c.status === 'Aberto'))
      if (vig?.ano) anoVigente = String(vig.ano).trim()

      const ordenados = calRow.valor
        .filter((c: any) => c && c.ano)
        .map((c: any) => ({
          ano: String(c.ano).trim(),
          criadoEm: c.criadoEm || c.createdAt || '',
        }))
        .sort((a: any, b: any) => {
          const timeA = a.criadoEm ? new Date(a.criadoEm).getTime() : 0
          const timeB = b.criadoEm ? new Date(b.criadoEm).getTime() : 0
          if (timeA !== timeB) return timeB - timeA
          return Number(b.ano) - Number(a.ano)
        })

      if (ordenados[0]?.ano) {
        ultimoAnoCadastrado = ordenados[0].ano
      }
    }
  } catch {}

  return {
    contratos: filtrados,
    metrics: {
      total,
      pendentes,
      assinados,
      cancelados,
      taxaAssinatura,
      integridadePercentual: 100,
    },
    totalGeralContratos: list.length,
    anoFiltroAplicado: filtros?.ano || 'todos',
    anosCadastrados,
    anoVigente,
    ultimoAnoCadastrado,
    storageMode: usedFallback ? 'configuracoes_fallback' : 'database_table',
  }
}

/**
 * Busca contrato por ID ou Protocolo
 */
export async function buscarContratoPorId(
  id: string,
  options?: { includePdf?: boolean }
): Promise<ContratoDigitalModel | null> {
  const { list } = await getAllFromStorage()
  const clean = String(id || '').trim().toUpperCase()
  const contrato = (
    list.find(
      c =>
        String(c.id || '').trim().toUpperCase() === clean ||
        String(c.protocolo || '').trim().toUpperCase() === clean
    ) || null
  )

  if (contrato && options?.includePdf) {
    contrato.documento_pdf_base64 = await obterPdfBase64(contrato, 'original')
    if (contrato.status === 'assinado') {
      contrato.documento_assinado_pdf_base64 = await obterPdfBase64(contrato, 'assinado')
    }
  }

  return contrato
}

/**
 * Busca contrato por Token de Assinatura (para o portal /assinar/[token])
 */
export async function buscarContratoPorToken(
  token: string,
  options?: { includePdf?: boolean }
): Promise<ContratoDigitalModel | null> {
  const { list } = await getAllFromStorage()
  const contrato = list.find(c => c.token_assinatura === token) || null

  if (contrato && options?.includePdf) {
    contrato.documento_pdf_base64 = await obterPdfBase64(contrato, 'original')
    if (contrato.status === 'assinado') {
      contrato.documento_assinado_pdf_base64 = await obterPdfBase64(contrato, 'assinado')
    }
  }

  return contrato
}

/**
 * Busca contrato por Código de Protocolo (para o portal público /validar-assinatura/[protocolo])
 */
export async function buscarContratoPorProtocolo(
  protocolo: string,
  options?: { includePdf?: boolean }
): Promise<ContratoDigitalModel | null> {
  const { list } = await getAllFromStorage()
  const clean = protocolo.trim().toUpperCase()
  const contrato = list.find(c => c.protocolo.toUpperCase() === clean) || null

  if (contrato && options?.includePdf) {
    contrato.documento_pdf_base64 = await obterPdfBase64(contrato, 'original')
    if (contrato.status === 'assinado') {
      contrato.documento_assinado_pdf_base64 = await obterPdfBase64(contrato, 'assinado')
    }
  }

  return contrato
}

/**
 * Busca contrato por Hash SHA-256 (para verificação de inalterabilidade por upload)
 */
export async function buscarContratoPorHash(
  hash: string,
  options?: { includePdf?: boolean }
): Promise<ContratoDigitalModel | null> {
  const { list } = await getAllFromStorage()
  const clean = hash.trim().toUpperCase()
  const contrato = (
    list.find(
      c =>
        (c.documento_assinado_hash && c.documento_assinado_hash.toUpperCase() === clean) ||
        (c.documento_original_hash && c.documento_original_hash.toUpperCase() === clean) ||
        (c.trilha_auditoria_hash && c.trilha_auditoria_hash.toUpperCase() === clean)
    ) || null
  )

  if (contrato && options?.includePdf) {
    contrato.documento_pdf_base64 = await obterPdfBase64(contrato, 'original')
    if (contrato.status === 'assinado') {
      contrato.documento_assinado_pdf_base64 = await obterPdfBase64(contrato, 'assinado')
    }
  }

  return contrato
}

/**
 * Registra um evento imutável na trilha de auditoria (Cadeia de Custódia Encadeada)
 */
export async function registrarEventoAuditoria(params: {
  contratoId: string
  evento: string
  descricao: string
  ip: string
}): Promise<ContratoDigitalModel | null> {
  const contrato = await buscarContratoPorId(params.contratoId)
  if (!contrato) return null

  const historico = contrato.historico_eventos || []
  const ultimoEvento = historico[historico.length - 1]
  const prevHash = ultimoEvento?.hash || contrato.documento_original_hash || 'GENESIS_HASH'

  const eventId = `ev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
  const timestamp = new Date().toISOString()
  const eventHash = calculateEventHash(prevHash, eventId, timestamp, params.evento, params.ip)

  const novoEvento: EventoAuditoriaItem = {
    id: eventId,
    timestamp,
    evento: params.evento,
    descricao: params.descricao,
    ip: params.ip,
    hash: eventHash,
  }

  contrato.historico_eventos = [...historico, novoEvento]
  return await salvarContrato(contrato)
}

/**
 * Exclui ou cancela um contrato
 */
export async function cancelarOuExcluirContrato(
  id: string,
  tipo: 'cancelar' | 'excluir',
  motivo?: string
): Promise<{ success: boolean; message: string }> {
  const supabase = getAdminClient()
  const cleanId = String(id || '').trim()

  if (!cleanId) {
    throw new Error('ID do contrato é obrigatório para exclusão/cancelamento.')
  }

  if (tipo === 'excluir') {
    // 1. Remove da tabela nativa se existir
    try {
      await supabase
        .from('matriculas_digitais')
        .delete()
        .or(`id.eq.${cleanId},protocolo.eq.${cleanId}`)
    } catch (err) {
      console.warn('[Repository] Aviso ao deletar de matriculas_digitais:', err)
    }

    // 2. Remove diretamente do fallback em configuracoes
    try {
      const { data: cfgRow } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', FALLBACK_KEY)
        .maybeSingle()

      const rawList: any[] = Array.isArray(cfgRow?.valor) ? cfgRow.valor : []
      const filtrada = rawList.filter(
        (c: any) =>
          String(c.id || '').trim() !== cleanId &&
          String(c.protocolo || '').trim().toUpperCase() !== cleanId.toUpperCase()
      )
      await saveToFallback(filtrada)
    } catch (err: any) {
      console.error('[Repository] Erro ao deletar do fallback configuracoes:', err)
      throw err
    }

    return { success: true, message: 'Documento excluído com sucesso.' }
  }

  // Cancelar com registro na auditoria
  const contrato = await buscarContratoPorId(cleanId)
  if (contrato) {
    contrato.status = 'cancelado'
    const historico = contrato.historico_eventos || []
    const ultimoEvento = historico[historico.length - 1]
    const prevHash = ultimoEvento?.hash || contrato.documento_original_hash || 'GENESIS_HASH'

    const eventId = `ev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    const timestamp = new Date().toISOString()
    const eventHash = calculateEventHash(prevHash, eventId, timestamp, 'CANCELAMENTO', '127.0.0.1')

    contrato.historico_eventos = [
      ...historico,
      {
        id: eventId,
        timestamp,
        evento: 'CANCELAMENTO',
        descricao: `Documento cancelado no sistema. Motivo: ${motivo || 'Solicitação administrativa'}`,
        ip: '127.0.0.1',
        hash: eventHash,
      },
    ]
    await salvarContrato(contrato)
  }

  return { success: true, message: 'Documento cancelado com sucesso.' }
}
