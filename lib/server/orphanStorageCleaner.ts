/**
 * lib/server/orphanStorageCleaner.ts
 *
 * Serviço de alta confiabilidade para detecção e limpeza automática de arquivos órfãos
 * em todos os buckets gerenciados do Supabase Storage.
 *
 * Segurança e Integridade:
 * - Varre de forma resiliente e paginada todas as tabelas do banco de dados (sem truncar em 1000 linhas).
 * - Identifica com precisão referências em campos JSONB (dados, anexos, avatares, imagens de questões, contratos digitais).
 * - Protege arquivos essenciais do sistema (papéis timbrados, placeholders e uploads recentes em andamento nas últimas 24h).
 * - Executa em background diariamente via cron Vercel e sob demanda por administradores autorizados.
 */

import { getAdminClient } from './supabaseAdminSingleton'
import { recordAuditLog } from './auditLogger'

export interface StorageAutoCleanConfig {
  enabled: boolean
  interval_days: number
  min_age_hours: number
  last_run: string | null
  next_run: string | null
  last_status: 'success' | 'error' | 'skipped' | 'blocked' | 'paused' | null
  last_deleted_count: number
  last_size_reclaimed: number
  last_error: string | null
}

export const DEFAULT_STORAGE_AUTO_CLEAN_CONFIG: StorageAutoCleanConfig = {
  enabled: true,
  interval_days: 30,
  min_age_hours: 72, // Janela ampliada: protege uploads recentes e de finais de semana (mínimo 72h)
  last_run: null,
  next_run: null,
  last_status: null,
  last_deleted_count: 0,
  last_size_reclaimed: 0,
  last_error: null,
}

export interface DbRef {
  url: string
  table: string
  id: string
  label: string
}

export function safeDecode(str: string): string {
  if (!str || typeof str !== 'string') return ''
  try {
    return decodeURIComponent(str)
  } catch {
    return str
  }
}

export function cleanStoragePath(str: string): string {
  if (!str || typeof str !== 'string') return ''
  const decoded = safeDecode(str)
  return decoded.split('?')[0].split('#')[0].trim()
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Extrai todas as URLs de armazenamento Supabase contidas em blocos de texto ou HTML.
 */
export function extractUrlsFromText(text: string): string[] {
  if (!text || typeof text !== 'string') return []
  const urls: string[] = []
  const regex = /https?:\/\/[^\s"'<>]+\/storage\/v1\/object\/(?:public|sign)\/[^\s"'<>]+/gi
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    urls.push(match[0])
  }
  return urls
}

/**
 * Identifica arquivos e pastas de infraestrutura que nunca devem ser expurgados.
 */
export function isProtectedSystemFile(bucket: string, path: string): boolean {
  if (!path) return false
  const cleanPath = path.toLowerCase().trim()

  // Placeholders de pastas vazias do Supabase
  if (cleanPath.endsWith('.emptyfolderplaceholder') || cleanPath.endsWith('.gitkeep')) {
    return true
  }

  // Modelos timbrados e configurações de margem da escola em 'documentos/timbrados'
  if (bucket === 'documentos' && (cleanPath.startsWith('timbrados/') || cleanPath === 'timbrados')) {
    return true
  }

  return false
}

/**
 * Retorna os buckets reais existentes no Supabase Storage.
 */
export async function getActiveManagedBuckets(supabase: any): Promise<string[]> {
  try {
    const { data, error } = await supabase.storage.listBuckets()
    if (!error && Array.isArray(data) && data.length > 0) {
      const names = data.map((b: any) => b.id || b.name).filter(Boolean)
      if (names.length > 0) return names
    }
  } catch (err: any) {
    console.warn('[orphanStorageCleaner] Aviso ao listar buckets dinâmicos:', err.message)
  }
  // Buckets padrão do ecossistema EDU-IMPACTO
  return ['comunicados-midia', 'documentos', 'simulados-arquivos', 'credimpacto']
}

/**
 * Busca a configuração persistida na tabela `configuracoes` (chave `storage_auto_clean`).
 */
export async function getStorageAutoCleanConfig(): Promise<StorageAutoCleanConfig> {
  try {
    const supabase = getAdminClient()
    const { data } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'storage_auto_clean')
      .maybeSingle()

    if (data?.valor && typeof data.valor === 'object') {
      return {
        enabled: data.valor.enabled ?? DEFAULT_STORAGE_AUTO_CLEAN_CONFIG.enabled,
        interval_days: Number(data.valor.interval_days) || 30,
        min_age_hours: Number(data.valor.min_age_hours) ?? 24,
        last_run: data.valor.last_run || null,
        next_run: data.valor.next_run || null,
        last_status: data.valor.last_status || null,
        last_deleted_count: Number(data.valor.last_deleted_count) || 0,
        last_size_reclaimed: Number(data.valor.last_size_reclaimed) || 0,
        last_error: data.valor.last_error || null,
      }
    }
  } catch (err: any) {
    console.warn('[orphanStorageCleaner] Falha ao carregar configurações:', err.message)
  }

  return { ...DEFAULT_STORAGE_AUTO_CLEAN_CONFIG }
}

/**
 * Atualiza e persiste as configurações de limpeza automática.
 */
export async function updateStorageAutoCleanConfig(
  updates: Partial<StorageAutoCleanConfig>
): Promise<StorageAutoCleanConfig> {
  const current = await getStorageAutoCleanConfig()
  const updated: StorageAutoCleanConfig = {
    ...current,
    ...updates,
  }

  // Recalcular next_run se o intervalo foi alterado ou se next_run não existe
  if (updates.interval_days && (!updated.next_run || updates.last_run)) {
    const baseDate = updated.last_run ? new Date(updated.last_run) : new Date()
    updated.next_run = new Date(baseDate.getTime() + updated.interval_days * 24 * 60 * 60 * 1000).toISOString()
  }

  try {
    const supabase = getAdminClient()
    await supabase.from('configuracoes').upsert({
      chave: 'storage_auto_clean',
      valor: updated,
      updated_at: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('[orphanStorageCleaner] Erro ao salvar configurações:', err.message)
  }

  return updated
}

/**
 * Varre exaustivamente todas as tabelas e campos do banco em busca de referências a arquivos,
 * utilizando paginação por faixas para contornar com segurança o limite padrão de 1000 linhas do PostgREST.
 */
export async function fetchAllDbReferences(supabase: any): Promise<DbRef[]> {
  const refs: DbRef[] = []

  // Helper com paginação automática de registros e tamanho de lote configurável
  const safeQueryPaged = async (
    table: string,
    select: string,
    mapFn: (row: any) => void,
    chunkSize = 1000
  ) => {
    let from = 0

    while (true) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select(select)
          .range(from, from + chunkSize - 1)

        if (error) {
          // Se a tabela ou coluna não existir, registra aviso limpo e interrompe
          console.warn(`[orphanStorageCleaner] Aviso ao consultar ${table} (offset ${from}):`, error.message)
          break
        }

        if (!data || data.length === 0) break

        for (const row of data) {
          mapFn(row)
        }

        if (data.length < chunkSize) break
        from += chunkSize
      } catch (err: any) {
        console.warn(`[orphanStorageCleaner] Erro inesperado ao consultar ${table}:`, err.message)
        break
      }
    }
  }

  // Executamos as consultas de forma sequencial controlada para não sobrecarregar o pool de conexões
  // do PostgreSQL (evitando erros de timeout 57014 e saturação de memória).
  const tasks = [
    // 1. Gestão de Pessoas / Documentos Trabalhistas
    () => safeQueryPaged('gp_documentos', 'id, nome, tipo, url', (row) => {
      if (row.url) refs.push({ url: row.url, table: 'gp_documentos', id: row.id, label: `Documento: ${row.nome || 'Doc'} (${row.tipo || 'Geral'})` })
    }),

    // 2. Provas Adaptadas (AEE / Inclusão)
    () => safeQueryPaged('arquivos_adaptadas', 'id, titulo, file_url', (row) => {
      if (row.file_url) refs.push({ url: row.file_url, table: 'arquivos_adaptadas', id: row.id, label: `Prova Adaptada: ${row.titulo || 'Sem título'}` })
    }),

    // 3. Alternativas de Provas
    () => safeQueryPaged('provas_alternativas', 'id, imagem_url', (row) => {
      if (row.imagem_url) refs.push({ url: row.imagem_url, table: 'provas_alternativas', id: row.id, label: 'Alternativa de Prova' })
    }),

    // 4. Alternativas de Simulados
    () => safeQueryPaged('simulados_alternativas', 'id, imagem_url', (row) => {
      if (row.imagem_url) refs.push({ url: row.imagem_url, table: 'simulados_alternativas', id: row.id, label: 'Alternativa de Simulado' })
    }),

    // 5. Questões de Provas (Imagens incorporadas ao enunciado)
    () => safeQueryPaged('provas_questoes', 'id, enunciado', (row) => {
      if (row.enunciado) {
        const found = extractUrlsFromText(row.enunciado)
        for (const u of found) {
          refs.push({ url: u, table: 'provas_questoes', id: row.id, label: 'Imagem em Questão de Prova' })
        }
      }
    }),

    // 6. Questões de Simulados (Imagens incorporadas ao enunciado)
    () => safeQueryPaged('simulados_questoes', 'id, enunciado', (row) => {
      if (row.enunciado) {
        const found = extractUrlsFromText(row.enunciado)
        for (const u of found) {
          refs.push({ url: u, table: 'simulados_questoes', id: row.id, label: 'Imagem em Questão de Simulado' })
        }
      }
    }),

    // 7. Alunos (Fotos de Perfil e Anexos em dados)
    () => safeQueryPaged('alunos', 'id, nome, foto, foto_url, dados', (row) => {
      const url = row.foto_url || row.foto || row.dados?.fotoUrl || row.dados?.avatarUrl || row.dados?.foto
      if (url && typeof url === 'string') {
        refs.push({ url, table: 'alunos', id: row.id, label: `Foto do Aluno: ${row.nome || row.id}` })
      }
    }),

    // 8. Usuários do Sistema (Colaboradores, Professores, Direção)
    () => safeQueryPaged('system_users', 'id, nome, dados', (row) => {
      const url = row.dados?.fotoUrl || row.dados?.avatarUrl || row.dados?.foto || row.dados?.avatar
      if (url && typeof url === 'string') {
        refs.push({ url, table: 'system_users', id: row.id, label: `Foto do Colaborador: ${row.nome || row.id}` })
      }
    }),

    // 9. Responsáveis Legais e Financeiros
    () => safeQueryPaged('responsaveis', 'id, nome, dados', (row) => {
      const url = row.dados?.fotoUrl || row.dados?.avatarUrl || row.dados?.foto || row.dados?.avatar
      if (url && typeof url === 'string') {
        refs.push({ url, table: 'responsaveis', id: row.id, label: `Foto do Responsável: ${row.nome || row.id}` })
      }
    }),

    // 10. Comunicados e Mensagens da Agenda Digital (Anexos, imagens de capa, áudios e avatar do autor)
    // Usamos projeção de campos JSONB (anexos, imagem, audioUrl, autorFoto) e chunk de 500 para evitar
    // transferir centenas de MB de leituras/ciências e prevenir statement timeouts (57014).
    () => safeQueryPaged(
      'comunicados',
      'id, titulo, texto, anexos:dados->anexos, imagem:dados->imagem, audioUrl:dados->audioUrl, autorFoto:dados->autorFoto',
      (row) => {
        // Anexos estruturados
        const anexos = row.anexos || row.dados?.anexos
        if (Array.isArray(anexos)) {
          for (const item of anexos) {
            if (typeof item === 'string') {
              const parts = item.split('|')
              const candidate = parts.length > 1 ? parts[1] : parts[0]
              if (candidate && (candidate.startsWith('http') || candidate.includes('/storage/'))) {
                refs.push({ url: candidate, table: 'comunicados', id: row.id, label: `Anexo de Comunicado: ${row.titulo || 'Comunicado'}` })
              }
            } else if (item && typeof item === 'object' && item.url) {
              refs.push({ url: item.url, table: 'comunicados', id: row.id, label: `Anexo de Comunicado: ${row.titulo || 'Comunicado'}` })
            }
          }
        }

        // Imagem e Áudio diretos
        const imagem = row.imagem || row.dados?.imagem
        if (imagem && typeof imagem === 'string') {
          refs.push({ url: imagem, table: 'comunicados', id: row.id, label: `Imagem de Comunicado: ${row.titulo || 'Comunicado'}` })
        }
        const audioUrl = row.audioUrl || row.dados?.audioUrl
        if (audioUrl && typeof audioUrl === 'string') {
          refs.push({ url: audioUrl, table: 'comunicados', id: row.id, label: `Áudio de Comunicado: ${row.titulo || 'Comunicado'}` })
        }
        const autorFoto = row.autorFoto || row.dados?.autorFoto
        if (autorFoto && typeof autorFoto === 'string') {
          refs.push({ url: autorFoto, table: 'comunicados', id: row.id, label: `Foto de Autor: ${row.titulo || 'Comunicado'}` })
        }

        // Imagens inseridas no corpo HTML do texto
        if (row.texto && typeof row.texto === 'string') {
          const inlineUrls = extractUrlsFromText(row.texto)
          for (const u of inlineUrls) {
            refs.push({ url: u, table: 'comunicados', id: row.id, label: `Mídia no Texto: ${row.titulo || 'Comunicado'}` })
          }
        }
      },
      500
    ),

    // 11. Respostas de Comunicados com anexos
    () => safeQueryPaged('comunicados_respostas', 'id, comunicado_id, anexos, conteudo', (row) => {
      if (Array.isArray(row.anexos)) {
        for (const item of row.anexos) {
          const url = typeof item === 'string' ? (item.split('|')[1] || item) : item?.url
          if (url && (url.startsWith('http') || url.includes('/storage/'))) {
            refs.push({ url, table: 'comunicados_respostas', id: row.id, label: 'Resposta de Comunicado' })
          }
        }
      }
      if (row.conteudo && typeof row.conteudo === 'string') {
        const inline = extractUrlsFromText(row.conteudo)
        for (const u of inline) {
          refs.push({ url: u, table: 'comunicados_respostas', id: row.id, label: 'Mídia em Resposta' })
        }
      }
    }),

    // 12. DRE Uploads
    () => safeQueryPaged('dre_uploads', 'id, nome_arquivo, dados_dre', (row) => {
      const url = row.dados_dre?.arquivo_url || row.dados_dre?.url
      if (url && typeof url === 'string') {
        refs.push({ url, table: 'dre_uploads', id: row.id, label: `DRE: ${row.nome_arquivo || 'Upload'}` })
      }
    }),

    // 13. Anexos de Chat
    () => safeQueryPaged('chat_attachments', 'id, file_name, file_url', (row) => {
      if (row.file_url) {
        refs.push({ url: row.file_url, table: 'chat_attachments', id: row.id, label: `Anexo de Chat: ${row.file_name || 'Arquivo'}` })
      }
    }),

    // 14. Momentos da Agenda Digital (Fotos das atividades)
    () => safeQueryPaged('momentos', 'id, titulo, dados', (row) => {
      const list = row.dados?.media || row.dados?.midias || []
      if (Array.isArray(list)) {
        list.forEach((item: any) => {
          const url = typeof item === 'string' ? item : item?.url
          if (url && typeof url === 'string') {
            refs.push({ url, table: 'momentos', id: row.id, label: `Momento: ${row.dados?.desc || row.titulo || row.id}` })
          }
        })
      }
    }),

    // 15. Configurações Globais (Contratos Digitais, Banners, Logo da Escola)
    async () => {
      try {
        const { data: cfgs } = await supabase
          .from('configuracoes')
          .select('chave, valor')
          .in('chave', [
            'matriculas_digitais_list',
            'matriculas_contratos_list',
            'ad_banner',
            'cfgEscolaLogo',
            'ad_messages_v3',
            'ad_momentos_v3',
          ])

        for (const row of cfgs || []) {
          // Contratos de Matrícula Digital
          if (row.chave === 'matriculas_digitais_list' || row.chave === 'matriculas_contratos_list') {
            if (Array.isArray(row.valor)) {
              for (const item of row.valor) {
                if (item?.documento_pdf_storage_path) {
                  refs.push({
                    url: item.documento_pdf_storage_path,
                    table: 'matriculas_digitais',
                    id: item.id || item.protocolo || 'contrato',
                    label: `Contrato Original: ${item.aluno_nome || item.protocolo || 'Aluno'}`,
                  })
                }
                if (item?.documento_assinado_storage_path) {
                  refs.push({
                    url: item.documento_assinado_storage_path,
                    table: 'matriculas_digitais',
                    id: item.id || item.protocolo || 'contrato',
                    label: `Contrato Assinado: ${item.aluno_nome || item.protocolo || 'Aluno'}`,
                  })
                }
              }
            }
          }

          // Banner da Agenda Digital
          if (row.chave === 'ad_banner' && row.valor?.url) {
            refs.push({ url: row.valor.url, table: 'configuracoes', id: 'ad_banner', label: 'Banner da Agenda Digital' })
          }

          // Logotipo da Escola
          if (row.chave === 'cfgEscolaLogo' && typeof row.valor === 'string' && row.valor.startsWith('http')) {
            refs.push({ url: row.valor, table: 'configuracoes', id: 'cfgEscolaLogo', label: 'Logo da Escola' })
          }

          // Momentos e Fotos de Rotina
          if (row.chave === 'ad_momentos_v3' && Array.isArray(row.valor)) {
            for (const mom of row.valor) {
              if (Array.isArray(mom?.fotos)) {
                for (const f of mom.fotos) {
                  if (f && typeof f === 'string') refs.push({ url: f, table: 'configuracoes', id: mom.id || 'momento', label: 'Foto de Momento' })
                }
              }
            }
          }
        }
      } catch (cfgErr: any) {
        console.warn('[orphanStorageCleaner] Aviso ao consultar configurações:', cfgErr.message)
      }
    },

    // 16. Ocorrências disciplinares/pedagógicas (anexos em dados e comprovantes)
    () => safeQueryPaged('ocorrencias', 'id, aluno_id, dados', (row) => {
      const anexoUrl = row.dados?.anexoUrl || row.dados?.anexo_url || row.dados?.url
      if (anexoUrl && typeof anexoUrl === 'string') {
        refs.push({ url: anexoUrl, table: 'ocorrencias', id: row.id, label: `Anexo de Ocorrência: ${row.id}` })
      }
      if (Array.isArray(row.dados?.anexos)) {
        for (const a of row.dados.anexos) {
          const u = typeof a === 'string' ? a : a?.url
          if (u && typeof u === 'string') {
            refs.push({ url: u, table: 'ocorrencias', id: row.id, label: `Anexo de Ocorrência: ${row.id}` })
          }
        }
      }
    }),

    // 17. Boletins escolares
    () => safeQueryPaged('boletins', 'id, aluno_id, dados', (row) => {
      const url = row.dados?.arquivo_url || row.dados?.pdf_url || row.dados?.url
      if (url && typeof url === 'string') {
        refs.push({ url, table: 'boletins', id: row.id, label: `Boletim: ${row.id}` })
      }
    }),

    // 18. Tabela Dedicada de Contratos Digitais (matriculas_digitais)
    () => safeQueryPaged('matriculas_digitais', 'id, protocolo, aluno_nome, documento_pdf_storage_path, documento_assinado_storage_path', (row) => {
      const origPath = row.documento_pdf_storage_path || (row.id ? `contratos/${row.id}/original.pdf` : null)
      const assPath = row.documento_assinado_storage_path || (row.id ? `contratos/${row.id}/assinado.pdf` : null)
      if (origPath) {
        refs.push({
          url: origPath,
          table: 'matriculas_digitais',
          id: row.id || row.protocolo || 'contrato',
          label: `Contrato Original: ${row.aluno_nome || row.protocolo || row.id}`,
        })
      }
      if (assPath) {
        refs.push({
          url: assPath,
          table: 'matriculas_digitais',
          id: row.id || row.protocolo || 'contrato',
          label: `Contrato Assinado: ${row.aluno_nome || row.protocolo || row.id}`,
        })
      }
    }),
  ]

  for (const task of tasks) {
    await task()
  }

  return refs
}

/**
 * Lista recursivamente todos os arquivos de um bucket no Supabase Storage.
 */
export async function listAllFilesRecursively(supabase: any, bucket: string) {
  const allFiles: any[] = []

  async function walk(folder: string) {
    let offset = 0
    const PAGE_SIZE = 500

    while (true) {
      try {
        const { data, error } = await supabase.storage.from(bucket).list(folder, {
          limit: PAGE_SIZE,
          offset,
          sortBy: { column: 'name', order: 'asc' },
        })

        if (error) {
          console.warn(`[orphanStorageCleaner] Erro ao listar pasta "${folder}" no bucket "${bucket}":`, error.message)
          break
        }

        if (!data || data.length === 0) break

        for (const item of data) {
          const fullPath = folder ? `${folder}/${item.name}` : item.name
          const isFolder = !item.id || !item.metadata || Object.keys(item.metadata).length === 0

          if (isFolder) {
            await walk(fullPath)
          } else {
            const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(fullPath)
            allFiles.push({
              name: item.name,
              path: fullPath,
              id: item.id,
              size: item.metadata?.size || 0,
              mimeType: item.metadata?.mimetype || 'application/octet-stream',
              updatedAt: item.updated_at || item.created_at,
              url: publicUrlData?.publicUrl || '',
              bucket,
            })
          }
        }

        if (data.length < PAGE_SIZE) break
        offset += PAGE_SIZE
      } catch (walkErr: any) {
        console.warn(`[orphanStorageCleaner] Exceção listando "${folder}" no bucket "${bucket}":`, walkErr.message)
        break
      }
    }
  }

  await walk('')
  return allFiles
}

export interface CleanupResult {
  ok: boolean
  executed: boolean
  skipped?: boolean
  dryRun?: boolean
  abortedByCircuitBreaker?: boolean
  reason?: string
  deletedCount: number
  sizeReclaimed: number
  formattedSizeReclaimed?: string
  lastRun?: string | null
  nextRun?: string | null
  error?: string
  candidateFiles?: { bucket: string; path: string; size: number }[]
}

/**
 * Executa a rotina de exclusão segura de arquivos órfãos.
 *
 * @param options.force - Se verdadeiro, ignora a contagem de 30 dias, flag de ativação e trava de circuit breaker.
 * @param options.dryRun - Se verdadeiro, simula a execução listando os candidatos sem apagar fisicamente nenhum arquivo.
 * @param options.triggeredBy - Identificador de quem disparou ('cron' | 'admin' | 'manual').
 * @param options.minAgeHours - Tempo mínimo de existência do arquivo antes de ser considerado para exclusão (padrão 72h).
 */
export async function runOrphanCleanup(options: {
  force?: boolean
  dryRun?: boolean
  triggeredBy?: 'cron' | 'admin' | 'manual'
  minAgeHours?: number
} = {}): Promise<CleanupResult> {
  const { force = false, dryRun = false, triggeredBy = 'cron' } = options
  const config = await getStorageAutoCleanConfig()
  const supabase = getAdminClient()

  // 1. Verificação se a limpeza automática está habilitada
  if (!config.enabled && !force) {
    return {
      ok: true,
      executed: false,
      skipped: true,
      reason: 'Limpeza automática desativada nas configurações.',
      deletedCount: 0,
      sizeReclaimed: 0,
      lastRun: config.last_run,
      nextRun: config.next_run,
    }
  }

  // 2. Verificação se o ciclo de 30 dias (ou configurado) já foi atingido
  const now = new Date()
  if (!force && config.last_run) {
    const lastRunDate = new Date(config.last_run)
    const intervalMs = config.interval_days * 24 * 60 * 60 * 1000
    const nextAllowedDate = new Date(lastRunDate.getTime() + intervalMs)

    if (now.getTime() < nextAllowedDate.getTime()) {
      return {
        ok: true,
        executed: false,
        skipped: true,
        reason: `Ainda não completou o ciclo de ${config.interval_days} dias desde a última limpeza.`,
        deletedCount: 0,
        sizeReclaimed: 0,
        lastRun: config.last_run,
        nextRun: config.next_run || nextAllowedDate.toISOString(),
      }
    }
  }

  console.log(`[orphanStorageCleaner] Iniciando rotina de limpeza de arquivos órfãos (disparado por: ${triggeredBy}, force: ${force})...`)

  try {
    // 3. Obter buckets gerenciados ativos
    const managedBuckets = await getActiveManagedBuckets(supabase)

    // 4. Listar arquivos de todos os buckets gerenciados em paralelo
    const storageFilesPromises = managedBuckets.map((bucket) => listAllFilesRecursively(supabase, bucket))
    const storageFilesResults = await Promise.all(storageFilesPromises)
    const rawFiles = storageFilesResults.flat()

    // 5. Buscar referências em todas as tabelas do banco
    const dbRefs = await fetchAllDbReferences(supabase)

    // 6. Indexar referências do BD para busca ultrarrápida O(1)
    const refIndex = new Map<string, DbRef[]>()
    for (const ref of dbRefs) {
      if (!ref.url) continue

      const cleanUrl = cleanStoragePath(ref.url)
      const parts = cleanUrl.split(/\/storage\/v1\/object\/(?:public|sign)\//)
      const cleanPath = parts.length > 1 ? parts[1] : cleanUrl

      // Indexa pelo caminho completo: "comunicados-midia/uploads/file.png"
      if (!refIndex.has(cleanPath)) refIndex.set(cleanPath, [])
      refIndex.get(cleanPath)!.push(ref)

      // Indexa sem o bucket: "uploads/file.png"
      const firstSlash = cleanPath.indexOf('/')
      if (firstSlash !== -1) {
        const pathOnly = cleanPath.substring(firstSlash + 1)
        if (!refIndex.has(pathOnly)) refIndex.set(pathOnly, [])
        refIndex.get(pathOnly)!.push(ref)
      }

      // Indexa pelo nome do arquivo como último recurso
      const fileName = cleanPath.split('/').pop()
      if (fileName) {
        if (!refIndex.has(fileName)) refIndex.set(fileName, [])
        refIndex.get(fileName)!.push(ref)
      }
    }

    // 7. Janela de segurança (por padrão 24 horas para cron automático)
    const effectiveMinAgeHours = options.minAgeHours ?? (force ? 0 : config.min_age_hours ?? 24)
    const minAgeMs = effectiveMinAgeHours * 60 * 60 * 1000

    // 8. Filtrar arquivos físicos órfãos
    const orphanFiles: any[] = []
    let totalSizeReclaimed = 0

    for (const file of rawFiles) {
      // Proteção de arquivos institucionais essenciais (papéis timbrados, placeholders)
      if (isProtectedSystemFile(file.bucket, file.path)) {
        continue
      }

      const fullCleanPath = `${file.bucket}/${file.path}`
      let isReferenced = false

      if (refIndex.has(fullCleanPath) || refIndex.has(file.path)) {
        isReferenced = true
      } else {
        const fileName = file.path.split('/').pop()
        if (fileName && refIndex.has(fileName)) {
          const candidates = refIndex.get(fileName)!
          for (const cand of candidates) {
            const decUrl = cleanStoragePath(cand.url)
            if (decUrl.endsWith(file.path) || decUrl.includes(`/${file.bucket}/${file.path}`)) {
              isReferenced = true
              break
            }
          }
        }
      }

      // Se for órfão, verifica a idade mínima de proteção
      if (!isReferenced) {
        if (minAgeMs > 0 && file.updatedAt) {
          const fileAge = now.getTime() - new Date(file.updatedAt).getTime()
          if (fileAge < minAgeMs) {
            // Ignora arquivos muito recentes para resguardar uploads em andamento
            continue
          }
        }

        orphanFiles.push(file)
        totalSizeReclaimed += file.size
      }
    }

    // 8.1 Modo Dry-Run (Simulação sem exclusão física)
    if (dryRun) {
      console.log(`[orphanStorageCleaner] Dry-Run concluído: ${orphanFiles.length} arquivos seriam deletados (${formatBytes(totalSizeReclaimed)}).`)
      return {
        ok: true,
        executed: false,
        skipped: false,
        dryRun: true,
        deletedCount: orphanFiles.length,
        sizeReclaimed: totalSizeReclaimed,
        formattedSizeReclaimed: formatBytes(totalSizeReclaimed),
        lastRun: config.last_run,
        nextRun: config.next_run,
        candidateFiles: orphanFiles.slice(0, 100).map(f => ({ bucket: f.bucket, path: f.path, size: f.size })),
      }
    }

    // 8.2 Trava de Segurança Crítica (Circuit Breaker)
    // Se a rotina detectar que mais de 50 arquivos ou mais de 10% do bucket seriam apagados de uma só vez,
    // interrompe imediatamente sem apagar nada e exige confirmação manual (force=true).
    const MAX_SAFE_DELETE_COUNT = 50
    const MAX_SAFE_PERCENTAGE = 0.10 // 10%
    const isHighVolume = orphanFiles.length > MAX_SAFE_DELETE_COUNT
    const isHighPercentage = rawFiles.length > 0 && (orphanFiles.length / rawFiles.length) > MAX_SAFE_PERCENTAGE

    if (!force && (isHighVolume || isHighPercentage)) {
      const alertMsg = `[CIRCUIT BREAKER] Limpeza automática suspensa por segurança: tentativa de remover ${orphanFiles.length} arquivos (${((orphanFiles.length / Math.max(rawFiles.length, 1)) * 100).toFixed(1)}% do armazenamento). Requer verificação prévia no painel com force=true.`
      console.warn(alertMsg)

      await updateStorageAutoCleanConfig({
        last_status: 'blocked',
        last_error: alertMsg,
      })

      await recordAuditLog({
        modulo: 'configuracoes',
        acao: 'limpeza_automatica_orfaos_bloqueada',
        descricao: alertMsg,
        status: 'aviso',
        origem: triggeredBy === 'cron' ? 'sistema' : 'web',
        detalhesDepois: {
          candidateCount: orphanFiles.length,
          totalStorageFiles: rawFiles.length,
          sizeReclaimedBytes: totalSizeReclaimed,
          sizeReclaimedFormatted: formatBytes(totalSizeReclaimed),
        },
      })

      return {
        ok: false,
        executed: false,
        skipped: true,
        abortedByCircuitBreaker: true,
        reason: alertMsg,
        deletedCount: 0,
        sizeReclaimed: 0,
        lastRun: config.last_run,
        nextRun: config.next_run,
      }
    }

    // 9. Agrupar caminhos de órfãos por bucket para exclusão
    const bucketPaths: Record<string, string[]> = {}
    for (const file of orphanFiles) {
      if (!bucketPaths[file.bucket]) {
        bucketPaths[file.bucket] = []
      }
      bucketPaths[file.bucket].push(file.path)
    }

    // 10. Deletar arquivos físicos em lotes seguros de até 100 itens
    let totalDeleted = 0
    for (const [bucket, paths] of Object.entries(bucketPaths)) {
      if (paths.length === 0) continue

      const CHUNK_SIZE = 100
      for (let i = 0; i < paths.length; i += CHUNK_SIZE) {
        const chunk = paths.slice(i, i + CHUNK_SIZE)
        const { data, error } = await supabase.storage.from(bucket).remove(chunk)
        if (error) {
          console.error(`[orphanStorageCleaner] Erro ao remover lote do bucket "${bucket}":`, error.message)
        } else if (data) {
          totalDeleted += data.length
        }
      }
    }

    // 11. Calcular datas e atualizar configuração persistida
    const nextRun = new Date(now.getTime() + config.interval_days * 24 * 60 * 60 * 1000).toISOString()
    const updatedConfig = await updateStorageAutoCleanConfig({
      last_run: now.toISOString(),
      next_run: nextRun,
      last_status: 'success',
      last_deleted_count: totalDeleted,
      last_size_reclaimed: totalSizeReclaimed,
      last_error: null,
    })

    // 12. Gravar registro detalhado no log de auditoria
    await recordAuditLog({
      modulo: 'configuracoes',
      acao: 'limpeza_automatica_orfaos',
      descricao: `Limpeza automática de arquivos órfãos executada (${triggeredBy}). Foram removidos ${totalDeleted} arquivo(s), liberando ${formatBytes(totalSizeReclaimed)}. Próxima execução prevista: ${new Date(nextRun).toLocaleDateString('pt-BR')}.`,
      status: 'sucesso',
      origem: triggeredBy === 'cron' ? 'sistema' : 'web',
      detalhesDepois: {
        totalDeleted,
        sizeReclaimedBytes: totalSizeReclaimed,
        sizeReclaimedFormatted: formatBytes(totalSizeReclaimed),
        nextRun,
        intervalDays: config.interval_days,
        triggeredBy,
      },
    })

    console.log(`[orphanStorageCleaner] Limpeza concluída: ${totalDeleted} arquivos deletados, ${formatBytes(totalSizeReclaimed)} liberados.`)

    return {
      ok: true,
      executed: true,
      deletedCount: totalDeleted,
      sizeReclaimed: totalSizeReclaimed,
      formattedSizeReclaimed: formatBytes(totalSizeReclaimed),
      lastRun: updatedConfig.last_run,
      nextRun: updatedConfig.next_run,
    }
  } catch (err: any) {
    console.error('[orphanStorageCleaner] Erro crítico na limpeza de órfãos:', err)

    await updateStorageAutoCleanConfig({
      last_status: 'error',
      last_error: err.message || 'Erro desconhecido',
    })

    await recordAuditLog({
      modulo: 'configuracoes',
      acao: 'limpeza_automatica_orfaos',
      descricao: `Falha na limpeza automática de arquivos órfãos: ${err.message || 'Erro interno'}`,
      status: 'erro',
      origem: triggeredBy === 'cron' ? 'sistema' : 'web',
    })

    return {
      ok: false,
      executed: false,
      error: err.message || 'Erro ao processar limpeza de arquivos órfãos',
      deletedCount: 0,
      sizeReclaimed: 0,
    }
  }
}
