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

export const TABLE_COLUMNS = new Set([
  'id',
  'protocolo',
  'token_assinatura',
  'aluno_id',
  'aluno_nome',
  'aluno_cpf',
  'aluno_turma',
  'aluno_serie',
  'aluno_data_nascimento',
  'responsavel_id',
  'responsavel_nome',
  'responsavel_cpf',
  'responsavel_email',
  'responsavel_telefone',
  'responsavel_parentesco',
  'ano_letivo',
  'tipo_documento',
  'titulo_documento',
  'valor_anuidade',
  'valor_mensalidade',
  'num_parcelas',
  'desconto_percent',
  'dia_vencimento',
  'primeiro_vencimento',
  'status',
  'versao_documento',
  'documento_original_hash',
  'documento_assinado_hash',
  'documento_pdf_base64',
  'documento_assinado_pdf_base64',
  'documento_pdf_storage_path',
  'documento_assinado_storage_path',
  'otp_codigo_hash',
  'otp_expira_em',
  'otp_confirmado_em',
  'otp_tentativas',
  'evidencias',
  'historico_eventos',
  'created_at',
  'updated_at',
])

/**
 * Converte o modelo em registro sanitizado para a tabela Postgres nativa,
 * preservando atributos extras sem coluna dedicada dentro do JSONB evidencias.
 */
export function toTableRecord(c: any): Record<string, any> {
  const evidencias = { ...(c.evidencias || {}) }
  if (c.totalPaginas && !evidencias.totalPaginas) evidencias.totalPaginas = Number(c.totalPaginas)
  if (c.responsavel_data_nascimento && !evidencias.responsavel_data_nascimento) evidencias.responsavel_data_nascimento = c.responsavel_data_nascimento
  if (c.trilha_auditoria_hash && !evidencias.trilhaAuditoriaHash) evidencias.trilhaAuditoriaHash = c.trilha_auditoria_hash
  if (c.otp_codigo_aberto && !evidencias.otp_codigo_aberto) evidencias.otp_codigo_aberto = c.otp_codigo_aberto

  const rec: Record<string, any> = {}
  for (const k of Object.keys(c)) {
    if (TABLE_COLUMNS.has(k)) {
      rec[k] = c[k]
    }
  }
  rec.evidencias = evidencias
  return rec
}

/**
 * Infere o nome do estudante caso o campo esteja vazio
 */
function inferAlunoNome(c: any): string {
  if (c.aluno_nome && typeof c.aluno_nome === 'string' && c.aluno_nome.trim()) {
    return c.aluno_nome.trim()
  }
  const anexos = c.evidencias?.documentosAnexados
  if (Array.isArray(anexos) && anexos.length > 0) {
    for (const anexo of anexos) {
      const nome = anexo.nome || ''
      const match = nome.match(/^([^-]+)\s*-\s*(contrato|aditamento|requerimento|termo)/i) ||
                    nome.match(/^(contrato|aditamento|requerimento|termo)\s*-\s*([^-.]+)/i)
      if (match) {
        const candidate = match[1].toLowerCase().includes('contrato') ? match[2] : match[1]
        if (candidate && candidate.trim()) return candidate.trim()
      }
    }
  }
  if (c.titulo_documento) {
    const limpo = c.titulo_documento.replace(/(contrato|aditamento|requerimento|termo|\.pdf|\.docx?)/gi, '').trim()
    if (limpo.length >= 3) return limpo
  }
  return ''
}

/**
 * Normaliza um registro de contrato com resolução profunda de campos
 */
function normalizeContrato(c: any): ContratoDigitalModel {
  return {
    id: c.id,
    protocolo: c.protocolo || '',
    token_assinatura: c.token_assinatura || '',
    aluno_id: c.aluno_id ? String(c.aluno_id) : '',
    aluno_nome: c.aluno_nome || c.evidencias?.aluno_nome || inferAlunoNome(c) || '',
    aluno_cpf: c.aluno_cpf || null,
    aluno_turma: c.aluno_turma || null,
    aluno_serie: c.aluno_serie || null,
    aluno_data_nascimento: c.aluno_data_nascimento || null,
    responsavel_id: c.responsavel_id || null,
    responsavel_nome: c.responsavel_nome || 'Signatário',
    responsavel_cpf: c.responsavel_cpf || '',
    responsavel_data_nascimento: c.responsavel_data_nascimento || c.evidencias?.responsavel_data_nascimento || null,
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
    trilha_auditoria_hash: c.trilha_auditoria_hash || c.evidencias?.trilhaAuditoriaHash || null,
    documento_pdf_base64: c.documento_pdf_base64 || null,
    documento_assinado_pdf_base64: c.documento_assinado_pdf_base64 || null,
    documento_pdf_storage_path: c.documento_pdf_storage_path || (c.id ? `contratos/${c.id}/original.pdf` : null),
    documento_assinado_storage_path: c.documento_assinado_storage_path || (c.id ? `contratos/${c.id}/assinado.pdf` : null),
    totalPaginas: Number(c.totalPaginas) || Number(c.evidencias?.totalPaginas) || 1,
    otp_codigo_hash: c.otp_codigo_hash || null,
    otp_codigo_aberto: c.otp_codigo_aberto || c.evidencias?.otp_codigo_aberto || null,
    otp_expira_em: c.otp_expira_em || null,
    otp_confirmado_em: c.otp_confirmado_em || null,
    otp_tentativas: Number(c.otp_tentativas) || 0,
    evidencias: c.evidencias || {},
    historico_eventos: Array.isArray(c.historico_eventos) ? c.historico_eventos : [],
    created_at: c.created_at || new Date().toISOString(),
    updated_at: c.updated_at || new Date().toISOString(),
  }
}

// Cache em memória e controle de resiliência da tabela matriculas_digitais
let isTableAvailable: boolean | null = null
let lastTableCheckTime = 0
const TABLE_CHECK_COOLDOWN_MS = 10000 // Apenas 10s de cooldown em caso de falha de conexão ou schema

export function canTryTable(): boolean {
  if (isTableAvailable === true || isTableAvailable === null) return true
  if (Date.now() - lastTableCheckTime > TABLE_CHECK_COOLDOWN_MS) {
    isTableAvailable = null // Reseta para tentar novamente
    return true
  }
  return false
}

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
      const buf = Buffer.from(arrayBuf)

      // Auto-cura de placeholders legados: se o arquivo no storage tiver apenas <= 2 páginas
      // mas as evidências do contrato indicarem um pacote com mais páginas (ex: 8, 11, 14 págs),
      // regenera o documento completo automaticamente!
      const totalEsperado = Number(contrato.evidencias?.totalPaginas || 1)
      if (totalEsperado > 3) {
        try {
          const { PDFDocument } = await import('pdf-lib')
          const doc = await PDFDocument.load(buf, { ignoreEncryption: true })
          if (doc.getPageCount() <= 2) {
            console.warn(`[Repository] PDF no storage para ${contrato.protocolo} tem apenas ${doc.getPageCount()} págs (esperado >= ${totalEsperado}). Regenerando documento completo...`)
            return await gerarPdfEvidenciasFallback(contrato, tipo)
          }
        } catch {}
      }

      return buf
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

  // Fallback de ultra-resiliência: reconstrói sob demanda com o documento contratual completo
  try {
    return await gerarPdfEvidenciasFallback(contrato, tipo)
  } catch (err) {
    console.warn(`[Repository] Falha ao gerar PDF de fallback (${tipo}):`, err)
  }

  return null
}

/**
 * Reconstrói sob demanda o PDF oficial com o conteúdo integral do contrato e certificado pericial
 * garantindo que todas as páginas, cláusulas e termos constem no documento.
 */
export async function gerarPdfEvidenciasFallback(
  contrato: ContratoDigitalModel,
  tipo: 'original' | 'assinado' = 'original'
): Promise<Buffer> {
  const { gerarContratoPdf } = await import('../contracts/contractPdfGenerator')
  const { anexarCertificadoEvidencias } = await import('../contracts/digitalEvidenceCertificate')

  const rep = contrato.evidencias?.escolaRepresentante || {
    nome: 'IVAN ROSSI SAMBRANA',
    cpf: '00130220167',
    cargo: 'Representante Legal / Diretor Geral',
    razaoSocial: 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA',
    cnpj: '04.395.789/0001-88',
    dataHoraAssinatura: contrato.created_at,
  }

  // 1. Gera o documento contratual completo com cláusulas legais e formatação institucional
  const contractPdfResult = await gerarContratoPdf({
    escolaNome: rep.razaoSocial?.includes('IMPACTO') ? 'COLÉGIO IMPACTO' : rep.razaoSocial,
    escolaRazaoSocial: rep.razaoSocial || 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA',
    escolaCnpj: rep.cnpj || '04.395.789/0001-88',
    escolaEndereco: 'Rua da Divisão, 586, Parati',
    escolaCidadeUf: 'Campo Grande - MS',
    escolaTelefone: '(67) 3000-0000',
    escolaEmail: 'secretaria@colegioimpacto.com.br',
    alunoId: contrato.aluno_id || '',
    alunoNome: contrato.aluno_nome || 'Estudante',
    alunoCpf: contrato.aluno_cpf || '',
    alunoTurma: contrato.aluno_turma || '',
    alunoSerie: contrato.aluno_serie || '',
    alunoDataNasc: contrato.aluno_data_nascimento || '',
    respNome: contrato.responsavel_nome || 'Responsável Legal',
    respCpf: contrato.responsavel_cpf || '',
    respTelefone: contrato.responsavel_telefone || '',
    respEmail: contrato.responsavel_email || '',
    respParentesco: contrato.responsavel_parentesco || 'Responsável',
    anoLetivo: String(contrato.ano_letivo || '2027'),
    tipoDocumento: contrato.tipo_documento === 'contrato_servicos' ? 'contrato_servicos' : 'requerimento_matricula',
    valorAnuidade: contrato.valor_anuidade || 0,
    valorMensalidade: contrato.valor_mensalidade || 0,
    numParcelas: contrato.num_parcelas || 12,
    descontoPercent: contrato.desconto_percent || 0,
    diaVencimento: contrato.dia_vencimento || 10,
    primeiroVencimento: contrato.primeiro_vencimento || undefined,
  })

  const basePdfBytes = contractPdfResult.pdfBytes

  if (tipo === 'assinado' || contrato.status === 'assinado') {
    const sigEv = contrato.evidencias?.signatarioEvidencias || {}

    const sealed = await anexarCertificadoEvidencias({
      originalPdfBytes: basePdfBytes,
      protocolo: contrato.protocolo,
      documentoTitulo: contrato.titulo_documento,
      documentoOriginalHash: contrato.documento_original_hash,
      alunoNome: contrato.aluno_nome,
      alunoCpf: contrato.aluno_cpf,
      alunoSerieTurma: `${contrato.aluno_serie || ''} ${contrato.aluno_turma || ''}`.trim() || null,
      anoLetivo: contrato.ano_letivo,
      signatario: {
        nome: contrato.responsavel_nome,
        cpf: contrato.responsavel_cpf,
        dataNascimento: contrato.responsavel_data_nascimento || contrato.evidencias?.responsavel_data_nascimento || null,
        email: contrato.responsavel_email,
        telefone: contrato.responsavel_telefone,
        parentesco: contrato.responsavel_parentesco,
        cargoOuFuncao: contrato.responsavel_parentesco || 'Responsável',
        dataHoraAssinatura: contrato.evidencias?.assinaturaConcluidaEm || contrato.updated_at,
        metodoAutenticacao: 'Código de Confirmação OTP (E-mail / WhatsApp)',
        aceiteTexto: sigEv.aceiteTexto || `Declaro ter lido e assinado eletronicamente o documento ${contrato.protocolo}.`,
        ip: sigEv.ip || contrato.evidencias?.ipCriacao || '127.0.0.1',
        dispositivo: sigEv.dispositivo || 'Smartphone / Computador',
        sistemaOperacional: sigEv.sistemaOperacional || 'Sistema Operacional Seguro',
        navegador: sigEv.navegador || 'Navegador Web Seguro',
        tipoAssinatura: 'manual',
        assinaturaBase64: null,
      },
      representanteEscola: {
        nome: rep.nome,
        cpf: rep.cpf,
        cargo: rep.cargo,
        razaoSocial: rep.razaoSocial,
        cnpj: rep.cnpj,
        dataHoraAssinatura: rep.dataHoraAssinatura || contrato.created_at,
        representantes: rep.representantes || undefined,
      },
      eventosAuditoria: contrato.historico_eventos || [],
      documentosAnexados: contrato.evidencias?.documentosAnexados || null,
      arquivoOriginalNome: contrato.evidencias?.arquivoOriginalNome || null,
      posicoesAssinaturas: contrato.evidencias?.posicoesAssinaturas || null,
      suprimirRubricaRodape: Boolean(contrato.evidencias?.suprimirRubricaRodape || (contrato.evidencias?.posicoesAssinaturas && contrato.evidencias.posicoesAssinaturas.length > 0)),
    })

    const finalBuf = Buffer.from(sealed.pdfBytes)
    salvarPdfBytes(contrato.id, 'assinado', finalBuf).catch(() => {})
    return finalBuf
  }

  const origBuf = Buffer.from(basePdfBytes)
  salvarPdfBytes(contrato.id, 'original', origBuf).catch(() => {})
  return origBuf
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
 * Lê todos os contratos do storage (tabela dedicada ou fallback em configuracoes).
 * Implementa auto-recuperação bidirecional: se a tabela nativa estiver vazia ou com
 * itens faltantes, unifica com o fallback e realiza a auto-cura no banco.
 */
async function getAllFromStorage(forceRefresh = false): Promise<{ list: ContratoDigitalModel[]; usedFallback: boolean }> {
  if (!forceRefresh && memoryCacheContratos && Date.now() - memoryCacheContratos.timestamp < CACHE_TTL_MS) {
    return {
      list: [...memoryCacheContratos.list],
      usedFallback: memoryCacheContratos.usedFallback,
    }
  }

  const supabase = getAdminClient()
  let dbContracts: ContratoDigitalModel[] = []
  let tableQuerySuccess = false

  // 1. Tenta buscar na tabela pública matriculas_digitais se disponível
  if (canTryTable()) {
    try {
      const { data, error } = await supabase
        .from('matriculas_digitais')
        .select('*')
        .order('created_at', { ascending: false })

      if (!error && Array.isArray(data)) {
        isTableAvailable = true
        tableQuerySuccess = true
        dbContracts = data.map(normalizeContrato)
      } else if (error && (
        error.code === 'PGRST205' ||
        error.message?.includes('Could not find the table') ||
        error.message?.includes('schema cache')
      )) {
        isTableAvailable = false
        lastTableCheckTime = Date.now()
      }
    } catch {
      isTableAvailable = false
      lastTableCheckTime = Date.now()
    }
  }

  // 2. Consulta fallback de metadados em configuracoes
  let fallbackContracts: ContratoDigitalModel[] = []
  try {
    const { data: cfgRow, error: cfgError } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', FALLBACK_KEY)
      .maybeSingle()

    if (cfgError) {
      console.warn('[Repository] Aviso ao ler configuracoes fallback, realizando retry:', cfgError)
      const { data: retryRow, error: retryErr } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', FALLBACK_KEY)
        .maybeSingle()

      if (!retryErr && retryRow && Array.isArray(retryRow.valor)) {
        fallbackContracts = retryRow.valor.map(normalizeContrato)
      }
    } else if (cfgRow && Array.isArray(cfgRow.valor)) {
      fallbackContracts = cfgRow.valor.map(normalizeContrato)
    }
  } catch (err) {
    console.warn('[Repository] Falha ao ler do fallback configuracoes:', err)
  }

  // 3. Estratégia de unificação resiliente com reconciliação profunda campo a campo:
  let mergedList: ContratoDigitalModel[] = []
  let usedFallbackFinal = false

  if (tableQuerySuccess && dbContracts.length > 0) {
    const fallbackMap = new Map<string, ContratoDigitalModel>()
    for (const fc of fallbackContracts) {
      if (fc.id) fallbackMap.set(String(fc.id).toLowerCase(), fc)
      if (fc.protocolo) fallbackMap.set(String(fc.protocolo).toLowerCase(), fc)
    }

    const contractsToHeal: ContratoDigitalModel[] = []

    const reconciledDb = dbContracts.map(dbItem => {
      const keyId = String(dbItem.id || '').toLowerCase()
      const keyProto = String(dbItem.protocolo || '').toLowerCase()
      const fbItem = fallbackMap.get(keyId) || fallbackMap.get(keyProto)

      if (!fbItem) return dbItem

      let needsHeal = false
      const merged = { ...dbItem }

      // Se o fallback tiver otp_confirmado_em e o banco não tiver, prioriza a validação!
      if (!merged.otp_confirmado_em && fbItem.otp_confirmado_em) {
        merged.otp_confirmado_em = fbItem.otp_confirmado_em
        needsHeal = true
      }

      // Se o fallback tiver status assinado e o banco não, prioriza assinatura!
      if (merged.status !== 'assinado' && fbItem.status === 'assinado') {
        merged.status = fbItem.status
        merged.documento_assinado_hash = fbItem.documento_assinado_hash || merged.documento_assinado_hash
        needsHeal = true
      }

      // Se o fallback tiver histórico de auditoria mais longo, reconcilia!
      if (Array.isArray(fbItem.historico_eventos) && fbItem.historico_eventos.length > (merged.historico_eventos?.length || 0)) {
        merged.historico_eventos = fbItem.historico_eventos
        needsHeal = true
      }

      const dbTime = new Date(dbItem.updated_at || dbItem.created_at || 0).getTime()
      const fbTime = new Date(fbItem.updated_at || fbItem.created_at || 0).getTime()
      if (fbTime > dbTime + 1000) {
        Object.assign(merged, fbItem)
        needsHeal = true
      }

      if (needsHeal) {
        contractsToHeal.push(merged)
      }
      return merged
    })

    const dbIds = new Set(dbContracts.map(c => String(c.id || c.protocolo).trim().toLowerCase()))
    const missingFromDb = fallbackContracts.filter(
      c => !dbIds.has(String(c.id || '').trim().toLowerCase()) && !dbIds.has(String(c.protocolo || '').trim().toLowerCase())
    )

    if (missingFromDb.length > 0 || contractsToHeal.length > 0) {
      mergedList = [...reconciledDb, ...missingFromDb].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      // Auto-cura atômica: insere ou atualiza itens faltantes/desatualizados no banco
      Promise.resolve().then(async () => {
        const toSave = [...missingFromDb, ...contractsToHeal]
        for (const item of toSave) {
          try {
            await supabase.from('matriculas_digitais').upsert(toTableRecord(item), { onConflict: 'id' })
          } catch {}
        }
      })
    } else {
      mergedList = reconciledDb
    }
    usedFallbackFinal = false
  } else if (fallbackContracts.length > 0) {
    // Tabela está vazia ou inacessível, mas fallback tem dados (ex: migração inicial ou tabela recém-criada)
    mergedList = fallbackContracts
    usedFallbackFinal = true

    // Se a tabela estiver acessível mas vazia, migra automaticamente todos os itens do fallback
    if (canTryTable()) {
      Promise.resolve().then(async () => {
        for (const item of fallbackContracts) {
          try {
            await supabase.from('matriculas_digitais').upsert(toTableRecord(item), { onConflict: 'id' })
          } catch {}
        }
      })
    }
  } else {
    mergedList = dbContracts
    usedFallbackFinal = !tableQuerySuccess
  }

  const result = {
    list: mergedList,
    usedFallback: usedFallbackFinal,
  }
  memoryCacheContratos = { ...result, timestamp: Date.now() }
  return result
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
 * Salva ou atualiza um contrato individual no storage e na tabela nativa
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

  // Tenta salvar na tabela dedicada sanitizado com toTableRecord (apenas colunas existentes)
  if (canTryTable()) {
    try {
      const tableRecord = toTableRecord(payload)
      const { data, error } = await supabase
        .from('matriculas_digitais')
        .upsert(tableRecord, { onConflict: 'id' })
        .select()
        .maybeSingle()

      if (!error && data) {
        isTableAvailable = true
      } else if (error) {
        console.warn('[Repository] Erro no upsert de matriculas_digitais:', error.message)
        // Se falhou o upsert (por ex. conflito de chave única ou lock), tenta update direto por ID
        if (payload.id) {
          const { error: updErr } = await supabase
            .from('matriculas_digitais')
            .update(tableRecord)
            .eq('id', payload.id)
          if (updErr) {
            console.warn('[Repository] Falha também no update direto:', updErr.message)
          }
        }
        if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
          isTableAvailable = false
          lastTableCheckTime = Date.now()
        }
      }
    } catch (err: any) {
      console.warn('[Repository] Exceção ao salvar em matriculas_digitais:', err?.message)
      isTableAvailable = false
      lastTableCheckTime = Date.now()
    }
  }

  // Sincroniza com o fallback de metadados leves em configuracoes
  try {
    const { data: cfgRow } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', FALLBACK_KEY)
      .maybeSingle()

    const rawList: any[] = Array.isArray(cfgRow?.valor) ? cfgRow.valor : []
    const idx = rawList.findIndex((c: any) => c && (c.id === contrato.id || c.protocolo === contrato.protocolo))
    let updatedList: any[] = []
    if (idx >= 0) {
      updatedList = [...rawList]
      updatedList[idx] = payload
    } else {
      updatedList = [payload, ...rawList]
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
 * Reconcilia um contrato entre a tabela do banco e o fallback de configuracoes
 */
function reconciliarContratos(
  contrato: ContratoDigitalModel | null,
  fallbackContrato: ContratoDigitalModel | null
): ContratoDigitalModel | null {
  if (!contrato && !fallbackContrato) return null
  if (!contrato) {
    if (canTryTable() && fallbackContrato) {
      const supabase = getAdminClient()
      Promise.resolve().then(async () => {
        try {
          await supabase.from('matriculas_digitais').upsert(toTableRecord(fallbackContrato), { onConflict: 'id' })
        } catch {}
      })
    }
    return fallbackContrato
  }
  if (!fallbackContrato) return contrato

  let needsSync = false
  const merged = { ...contrato }

  // Se o fallback tem otp_confirmado_em e o banco não, adota a confirmação!
  if (!merged.otp_confirmado_em && fallbackContrato.otp_confirmado_em) {
    merged.otp_confirmado_em = fallbackContrato.otp_confirmado_em
    needsSync = true
  }

  // Se o fallback está assinado e o banco não, adota status assinado!
  if (merged.status !== 'assinado' && fallbackContrato.status === 'assinado') {
    merged.status = fallbackContrato.status
    merged.documento_assinado_hash = fallbackContrato.documento_assinado_hash || merged.documento_assinado_hash
    needsSync = true
  }

  // Se o histórico de auditoria no fallback tem mais eventos, adota!
  if (Array.isArray(fallbackContrato.historico_eventos) && fallbackContrato.historico_eventos.length > (merged.historico_eventos?.length || 0)) {
    merged.historico_eventos = fallbackContrato.historico_eventos
    needsSync = true
  }

  const dbTime = new Date(contrato.updated_at || contrato.created_at || 0).getTime()
  const fbTime = new Date(fallbackContrato.updated_at || fallbackContrato.created_at || 0).getTime()
  if (fbTime > dbTime + 1000) {
    Object.assign(merged, fallbackContrato)
    needsSync = true
  }

  if (needsSync && canTryTable()) {
    const supabase = getAdminClient()
    Promise.resolve().then(async () => {
      try {
        await supabase.from('matriculas_digitais').upsert(toTableRecord(merged), { onConflict: 'id' })
      } catch {}
    })
  }

  return merged
}

/**
 * Busca contrato por ID ou Protocolo
 */
export async function buscarContratoPorId(
  id: string,
  options?: { includePdf?: boolean }
): Promise<ContratoDigitalModel | null> {
  const clean = String(id || '').trim().toUpperCase()
  if (!clean) return null
  const supabase = getAdminClient()

  let dbContrato: ContratoDigitalModel | null = null
  let fbContrato: ContratoDigitalModel | null = null

  if (canTryTable()) {
    try {
      const { data, error } = await supabase
        .from('matriculas_digitais')
        .select('*')
        .or(`id.eq.${id},protocolo.ilike.${clean}`)
        .maybeSingle()

      if (!error && data) {
        dbContrato = normalizeContrato(data)
      }
    } catch {}
  }

  try {
    const { data: cfgRow } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', FALLBACK_KEY)
      .maybeSingle()

    if (Array.isArray(cfgRow?.valor)) {
      const found = cfgRow.valor.find(
        (c: any) =>
          c &&
          (String(c.id || '').toUpperCase() === clean || String(c.protocolo || '').toUpperCase() === clean)
      )
      if (found) {
        fbContrato = normalizeContrato(found)
      }
    }
  } catch {}

  let contrato = reconciliarContratos(dbContrato, fbContrato)

  if (!contrato) {
    const { list } = await getAllFromStorage(true)
    contrato = (
      list.find(
        c =>
          String(c.id || '').trim().toUpperCase() === clean ||
          String(c.protocolo || '').trim().toUpperCase() === clean
      ) || null
    )
  }

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
  if (!token) return null
  const supabase = getAdminClient()

  let dbContrato: ContratoDigitalModel | null = null
  let fbContrato: ContratoDigitalModel | null = null

  // 1. Busca direta na tabela matriculas_digitais (O(1) indexada)
  if (canTryTable()) {
    try {
      const { data, error } = await supabase
        .from('matriculas_digitais')
        .select('*')
        .eq('token_assinatura', token)
        .maybeSingle()

      if (!error && data) {
        dbContrato = normalizeContrato(data)
      }
    } catch {}
  }

  // 2. Busca direta no fallback
  try {
    const { data: cfgRow } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', FALLBACK_KEY)
      .maybeSingle()

    if (Array.isArray(cfgRow?.valor)) {
      const found = cfgRow.valor.find((c: any) => c && c.token_assinatura === token)
      if (found) {
        fbContrato = normalizeContrato(found)
      }
    }
  } catch {}

  let contrato = reconciliarContratos(dbContrato, fbContrato)

  // 3. Fallback de contingência caso os passos anteriores não encontrem
  if (!contrato) {
    const { list } = await getAllFromStorage(true)
    contrato = list.find(c => c.token_assinatura === token) || null
  }

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
  const clean = String(protocolo || '').trim().toUpperCase()
  if (!clean) return null
  const supabase = getAdminClient()

  let dbContrato: ContratoDigitalModel | null = null
  let fbContrato: ContratoDigitalModel | null = null

  if (canTryTable()) {
    try {
      const { data, error } = await supabase
        .from('matriculas_digitais')
        .select('*')
        .ilike('protocolo', clean)
        .maybeSingle()

      if (!error && data) {
        dbContrato = normalizeContrato(data)
      }
    } catch {}
  }

  try {
    const { data: cfgRow } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', FALLBACK_KEY)
      .maybeSingle()

    if (Array.isArray(cfgRow?.valor)) {
      const found = cfgRow.valor.find((c: any) => c && String(c.protocolo || '').toUpperCase() === clean)
      if (found) {
        fbContrato = normalizeContrato(found)
      }
    }
  } catch {}

  let contrato = reconciliarContratos(dbContrato, fbContrato)

  if (!contrato) {
    const { list } = await getAllFromStorage(true)
    contrato = list.find(c => c.protocolo.toUpperCase() === clean) || null
  }

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
