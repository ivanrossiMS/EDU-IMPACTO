import { NextResponse } from 'next/server'
import { requireProfile } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import {
  fetchAllDbReferences,
  listAllFilesRecursively,
  getActiveManagedBuckets,
  getStorageAutoCleanConfig,
  updateStorageAutoCleanConfig,
  runOrphanCleanup,
  safeDecode,
  cleanStoragePath,
  isProtectedSystemFile,
  DbRef
} from '@/lib/server/orphanStorageCleaner'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // Permite até 2 minutos para processamentos pesados de listagem recursiva

// Cache em memória de curta duração para referências do BD (60s)
let dbRefsCache: { data: DbRef[]; timestamp: number } | null = null
const DB_REFS_CACHE_TTL = 60_000

function invalidateRefsCache() {
  dbRefsCache = null
}

async function getCachedDbReferences(supabase: any, forceRefresh = false): Promise<DbRef[]> {
  const now = Date.now()
  if (!forceRefresh && dbRefsCache && now - dbRefsCache.timestamp < DB_REFS_CACHE_TTL) {
    return dbRefsCache.data
  }
  const refs = await fetchAllDbReferences(supabase)
  dbRefsCache = { data: refs, timestamp: now }
  return refs
}

export async function GET(request: Request) {
  // Apenas Administradores podem gerenciar mídias do sistema
  const { user, errorResponse } = await requireProfile(['Diretor Geral', 'Administrador', 'Administrador Master', 'Master'])
  if (errorResponse) return errorResponse

  const supabase = getAdminClient()

  try {
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get('refresh') === 'true'

    // 1. Obter lista de buckets reais gerenciados
    const managedBuckets = await getActiveManagedBuckets(supabase)

    // 2. Listar arquivos do Storage e buscar referências do banco em paralelo
    const [storageFilesResults, dbRefs, autoCleanConfig] = await Promise.all([
      Promise.all(managedBuckets.map(bucket => listAllFilesRecursively(supabase, bucket))),
      getCachedDbReferences(supabase, forceRefresh),
      getStorageAutoCleanConfig()
    ])
    const rawFiles = storageFilesResults.flat()

    // 3. Indexar referências para busca O(1)
    const refIndex = new Map<string, DbRef[]>()
    for (const ref of dbRefs) {
      const url = ref.url
      if (!url) continue

      const cleanPath = cleanStoragePath(url)
      const parts = cleanPath.split(/\/storage\/v1\/object\/(?:public|sign)\//)
      const normalizedPath = parts.length > 1 ? parts[1] : cleanPath

      // Indexa pelo caminho completo: "bucket/uploads/file.png"
      if (!refIndex.has(normalizedPath)) refIndex.set(normalizedPath, [])
      refIndex.get(normalizedPath)!.push(ref)

      // Indexa sem o bucket (caso o BD salve apenas o path relativo): "uploads/file.png"
      const firstSlash = normalizedPath.indexOf('/')
      if (firstSlash !== -1) {
        const pathOnly = normalizedPath.substring(firstSlash + 1)
        if (!refIndex.has(pathOnly)) refIndex.set(pathOnly, [])
        refIndex.get(pathOnly)!.push(ref)
      }

      // Indexa pelo nome do arquivo como fallback
      const fileName = normalizedPath.split('/').pop()
      if (fileName) {
        if (!refIndex.has(fileName)) refIndex.set(fileName, [])
        refIndex.get(fileName)!.push(ref)
      }
    }

    // 4. Mapear e classificar cada arquivo físico
    const processedFiles = rawFiles.map(file => {
      const fullCleanPath = `${file.bucket}/${file.path}`
      let matches: DbRef[] = []

      // Prioridade 1: Caminho com bucket
      if (refIndex.has(fullCleanPath)) {
        matches = refIndex.get(fullCleanPath)!
      } 
      // Prioridade 2: Caminho relativo do arquivo (sem bucket)
      else if (refIndex.has(file.path)) {
        matches = refIndex.get(file.path)!
      } 
      // Prioridade 3: Filename com checagem de sufixo para evitar falsos positivos
      else {
        const fileName = file.path.split('/').pop()
        if (fileName && refIndex.has(fileName)) {
          const candidates = refIndex.get(fileName)!
          for (const cand of candidates) {
            const decUrl = cleanStoragePath(cand.url)
            if (decUrl.endsWith(file.path) || decUrl.includes(`/${file.bucket}/${file.path}`)) {
              matches.push(cand)
            }
          }
        }
      }

      // Proteção de arquivos institucionais e do sistema (papéis timbrados, placeholders)
      const isSystemProtected = isProtectedSystemFile(file.bucket, file.path)
      if (isSystemProtected && matches.length === 0) {
        matches.push({
          table: 'sistema',
          id: 'timbrados',
          label: 'Papel Timbrado Institucional',
          url: file.url
        })
      }

      const isOrphan = matches.length === 0 && !isSystemProtected

      // Mapear módulo com base no bucket e pasta
      let module = 'outros'
      if (file.bucket === 'documentos') {
        if (file.path.startsWith('timbrados/')) {
          module = 'gestao_escolar'
        } else if (file.path.startsWith('contratos/') || file.path.startsWith('matriculas/')) {
          module = 'gestao_escolar'
        } else {
          module = 'gestao_pessoas'
        }
      } else if (file.bucket === 'simulados-arquivos') {
        module = 'simulados_provas'
      } else if (file.bucket === 'credimpacto') {
        module = 'financeiro'
      } else if (file.bucket === 'comunicados-midia') {
        if (file.path.startsWith('avatars/')) {
          module = 'gestao_pessoas'
        } else if (file.path.startsWith('uploads/')) {
          module = 'agenda_digital'
        } else if (file.path.startsWith('provas-online/')) {
          module = 'simulados_provas'
        } else {
          module = 'simulados_provas'
        }
      }

      // Refinar módulo com base na referência do banco de dados encontrada
      if (matches.length > 0) {
        const firstTable = matches[0].table
        if (firstTable === 'gp_documentos' || firstTable === 'system_users') {
          module = 'gestao_pessoas'
        } else if (['arquivos_adaptadas', 'provas_alternativas', 'simulados_alternativas', 'provas_questoes', 'simulados_questoes'].includes(firstTable)) {
          module = 'simulados_provas'
        } else if (firstTable === 'dre_uploads' || firstTable === 'credimpacto') {
          module = 'financeiro'
        } else if (firstTable === 'chat_attachments' || firstTable === 'comunicados' || firstTable === 'comunicados_respostas') {
          module = 'agenda_digital'
        } else if (firstTable === 'alunos' || firstTable === 'responsaveis' || firstTable === 'matriculas_digitais') {
          module = 'gestao_escolar'
        }
      }

      return {
        ...file,
        module,
        isOrphan,
        references: matches
      }
    })

    // 5. Calcular Estatísticas
    let totalSize = 0
    let orphansCount = 0
    let orphansSize = 0
    const byBucket: Record<string, number> = {}
    for (const b of managedBuckets) {
      byBucket[b] = 0
    }
    const byModule: Record<string, number> = {
      'agenda_digital': 0,
      'gestao_pessoas': 0,
      'simulados_provas': 0,
      'gestao_escolar': 0,
      'financeiro': 0,
      'outros': 0
    }

    for (const f of processedFiles) {
      totalSize += f.size
      byBucket[f.bucket] = (byBucket[f.bucket] || 0) + 1
      byModule[f.module] = (byModule[f.module] || 0) + 1
      
      if (f.isOrphan) {
        orphansCount++
        orphansSize += f.size
      }
    }

    return NextResponse.json({
      stats: {
        totalSize,
        totalCount: processedFiles.length,
        orphansCount,
        orphansSize,
        byBucket,
        byModule,
        managedBuckets
      },
      files: processedFiles,
      autoCleanConfig
    })
  } catch (e: any) {
    console.error('[midia-api] GET erro inesperado:', e)
    return NextResponse.json({ error: e.message || 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const { user, errorResponse } = await requireProfile(['Diretor Geral', 'Administrador', 'Administrador Master', 'Master'])
  if (errorResponse) return errorResponse

  const supabase = getAdminClient()

  try {
    const { urls, deleteDbRecord = false } = await request.json()
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'Nenhum URL fornecido para exclusão.' }, { status: 400 })
    }

    const bucketPaths: Record<string, string[]> = {}
    const deletedRefs: any[] = []

    for (const rawUrl of urls) {
      if (!rawUrl) continue
      try {
        const cleanUrl = cleanStoragePath(rawUrl)
        const parts = cleanUrl.split(/\/storage\/v1\/object\/(?:public|sign)\//)
        if (parts.length < 2) continue

        const bucketAndPath = parts[1]
        const slashIndex = bucketAndPath.indexOf('/')
        if (slashIndex === -1) continue

        const bucket = bucketAndPath.substring(0, slashIndex)
        const path = bucketAndPath.substring(slashIndex + 1)

        if (!bucketPaths[bucket]) {
          bucketPaths[bucket] = []
        }
        bucketPaths[bucket].push(path)

        // Se for solicitado deletar também as referências correspondentes no banco de dados
        if (deleteDbRecord) {
          const dbRefs = await getCachedDbReferences(supabase)
          const matched = dbRefs.filter(ref => {
            const decRefUrl = cleanStoragePath(ref.url)
            return decRefUrl === cleanUrl || decRefUrl.endsWith(path) || decRefUrl.includes(`/${bucket}/${path}`)
          })

          for (const ref of matched) {
            console.log(`[midia-api] Removendo referência no BD da tabela ${ref.table}, ID: ${ref.id}`)
            
            try {
              if (ref.table === 'gp_documentos') {
                await supabase.from('gp_documentos').delete().eq('id', ref.id)
              } else if (ref.table === 'arquivos_adaptadas') {
                await supabase.from('arquivos_adaptadas').delete().eq('id', ref.id)
              } else if (ref.table === 'dre_uploads') {
                await supabase.from('dre_uploads').delete().eq('id', ref.id)
              } else if (ref.table === 'chat_attachments') {
                await supabase.from('chat_attachments').delete().eq('id', ref.id)
              } else if (ref.table === 'provas_alternativas') {
                await supabase.from('provas_alternativas').update({ imagem_url: null }).eq('id', ref.id)
              } else if (ref.table === 'simulados_alternativas') {
                await supabase.from('simulados_alternativas').update({ imagem_url: null }).eq('id', ref.id)
              } else if (ref.table === 'alunos') {
                await supabase.from('alunos').update({ foto: null, foto_url: null }).eq('id', ref.id)
              } else if (ref.table === 'system_users') {
                const { data: u } = await supabase.from('system_users').select('dados').eq('id', ref.id).single()
                const newDados = { ...(u?.dados || {}), foto: null, fotoUrl: null, avatarUrl: null, avatar: null }
                await supabase.from('system_users').update({ dados: newDados }).eq('id', ref.id)
              } else if (ref.table === 'responsaveis') {
                const { data: r } = await supabase.from('responsaveis').select('dados').eq('id', ref.id).single()
                const newDados = { ...(r?.dados || {}), foto: null, fotoUrl: null, avatarUrl: null, avatar: null }
                await supabase.from('responsaveis').update({ dados: newDados }).eq('id', ref.id)
              }
              deletedRefs.push(ref)
            } catch (dbDelErr: any) {
              console.warn(`[midia-api] Erro ao desvincular ${ref.table} ID ${ref.id}:`, dbDelErr.message)
            }
          }
        }
      } catch (parseErr: any) {
        console.error('[midia-api] Erro ao parsear URL para exclusão:', rawUrl, parseErr.message)
      }
    }

    // Excluir arquivos físicos dos buckets correspondentes no Supabase Storage
    let physicalDeletedCount = 0
    for (const [bucket, paths] of Object.entries(bucketPaths)) {
      if (paths.length > 0) {
        const { data, error } = await supabase.storage.from(bucket).remove(paths)
        if (error) {
          console.error(`[midia-api] Erro ao deletar mídias do bucket ${bucket}:`, error.message)
        } else if (data) {
          physicalDeletedCount += data.length
        }
      }
    }

    // Invalida cache de referências após modificações
    invalidateRefsCache()

    return NextResponse.json({
      ok: true,
      physicalDeletedCount,
      deletedRefsCount: deletedRefs.length,
      deletedRefs
    })
  } catch (e: any) {
    console.error('[midia-api] DELETE erro inesperado:', e)
    return NextResponse.json({ error: e.message || 'Erro interno do servidor' }, { status: 500 })
  }
}

// POST endpoint para ações administrativas como limpar órfãos ou atualizar configurações automáticas
export async function POST(request: Request) {
  const { user, errorResponse } = await requireProfile(['Diretor Geral', 'Administrador', 'Administrador Master', 'Master'])
  if (errorResponse) return errorResponse

  try {
    const body = await request.json().catch(() => ({}))
    const { action } = body
    
    // Atualizar parâmetros de agendamento automático (30 dias, ativar/desativar)
    if (action === 'update-auto-clean') {
      const updated = await updateStorageAutoCleanConfig(body.config || {})
      return NextResponse.json({ ok: true, config: updated })
    }

    // Limpeza de arquivos órfãos sob demanda
    if (action === 'clean-orphans' || action === 'trigger-auto-clean') {
      invalidateRefsCache()
      const result = await runOrphanCleanup({
        force: true,
        triggeredBy: 'admin',
        minAgeHours: 0
      })

      if (!result.ok) {
        return NextResponse.json({ error: result.error || 'Falha ao limpar órfãos.' }, { status: 500 })
      }

      return NextResponse.json({
        ok: true,
        deletedCount: result.deletedCount,
        sizeReclaimed: result.sizeReclaimed,
        message: result.deletedCount > 0
          ? `Limpeza concluída com sucesso! ${result.deletedCount} arquivos órfãos (${result.formattedSizeReclaimed}) foram removidos.`
          : 'Nenhum arquivo órfão encontrado para limpar.'
      })
    }

    return NextResponse.json({ error: 'Ação não suportada.' }, { status: 400 })
  } catch (e: any) {
    console.error('[midia-api] POST erro inesperado:', e)
    return NextResponse.json({ error: e.message || 'Erro interno do servidor' }, { status: 500 })
  }
}
