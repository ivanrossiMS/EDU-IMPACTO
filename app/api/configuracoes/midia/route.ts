import { NextResponse } from 'next/server'
import { requireProfile } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // Permite até 2 minutos para processamentos pesados de listagem recursiva

interface DbRef {
  url: string
  table: string
  id: string
  label: string
}

function safeDecode(str: string): string {
  try {
    return decodeURIComponent(str)
  } catch {
    return str
  }
}

// Helper para buscar referências de arquivos em todas as tabelas relevantes
async function fetchDbReferences(supabase: any): Promise<DbRef[]> {
  const refs: DbRef[] = []

  const safeQuery = async (table: string, select: string, mapFn: (row: any) => void) => {
    try {
      const { data, error } = await supabase.from(table).select(select)
      if (error) {
        console.warn(`[midia-api] Erro ao buscar tabela ${table}:`, error.message)
        return
      }
      if (data) {
        data.forEach(mapFn)
      }
    } catch (err: any) {
      console.warn(`[midia-api] Falha crítica de query na tabela ${table}:`, err.message)
    }
  }

  // Executa queries em paralelo para máxima performance
  await Promise.all([
    safeQuery('gp_documentos', 'id, nome, tipo, url', (row) => {
      if (row.url) refs.push({ url: row.url, table: 'gp_documentos', id: row.id, label: `Documento: ${row.nome} (${row.tipo})` })
    }),
    safeQuery('arquivos_adaptadas', 'id, titulo, file_url', (row) => {
      if (row.file_url) refs.push({ url: row.file_url, table: 'arquivos_adaptadas', id: row.id, label: `Prova Adaptada: ${row.titulo}` })
    }),
    safeQuery('dre_uploads', 'id, url', (row) => {
      if (row.url) refs.push({ url: row.url, table: 'dre_uploads', id: row.id, label: `DRE Upload` })
    }),
    safeQuery('chat_attachments', 'id, file_name, file_url', (row) => {
      if (row.file_url) refs.push({ url: row.file_url, table: 'chat_attachments', id: row.id, label: `Anexo de Chat: ${row.file_name}` })
    }),
    safeQuery('provas_alternativas', 'id, imagem_url', (row) => {
      if (row.imagem_url) refs.push({ url: row.imagem_url, table: 'provas_alternativas', id: row.id, label: `Alternativa de Prova` })
    }),
    safeQuery('simulados_alternativas', 'id, imagem_url', (row) => {
      if (row.imagem_url) refs.push({ url: row.imagem_url, table: 'simulados_alternativas', id: row.id, label: `Alternativa de Simulado` })
    }),
    safeQuery('alunos', 'id, nome, foto, dados', (row) => {
      const url = row.foto || row.dados?.foto || row.dados?.avatarUrl || row.dados?.fotoUrl
      if (url) refs.push({ url, table: 'alunos', id: row.id, label: `Foto do Aluno: ${row.nome}` })
    }),
    safeQuery('system_users', 'id, nome, dados', (row) => {
      const url = row.dados?.foto || row.dados?.avatarUrl || row.dados?.fotoUrl
      if (url) refs.push({ url, table: 'system_users', id: row.id, label: `Foto do Colaborador: ${row.nome}` })
    }),
    safeQuery('responsaveis', 'id, nome, dados', (row) => {
      const url = row.dados?.foto || row.dados?.avatarUrl || row.dados?.fotoUrl
      if (url) refs.push({ url, table: 'responsaveis', id: row.id, label: `Foto do Responsável: ${row.nome}` })
    })
  ])

  return refs
}

// Helper para listar recursivamente todos os arquivos em um bucket específico
async function listAllFilesRecursively(supabase: any, bucket: string) {
  const allFiles: any[] = []

  async function walk(folder: string) {
    try {
      const { data, error } = await supabase.storage.from(bucket).list(folder, {
        limit: 150,
        sortBy: { column: 'name', order: 'asc' }
      })

      if (error) {
        console.warn(`[midia-api] Erro ao listar pasta "${folder}" no bucket "${bucket}":`, error.message)
        return
      }

      if (!data) return

      for (const item of data) {
        const fullPath = folder ? `${folder}/${item.name}` : item.name
        
        // Verifica se é uma pasta (geralmente não tem ID ou metadados de tamanho)
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
            bucket
          })
        }
      }
    } catch (walkErr: any) {
      console.warn(`[midia-api] Exceção listando "${folder}" no bucket "${bucket}":`, walkErr.message)
    }
  }

  await walk('')
  return allFiles
}

export async function GET(request: Request) {
  // Apenas Administradores podem gerenciar mídias do sistema
  const { user, errorResponse } = await requireProfile(['Diretor Geral', 'Administrador', 'Administrador Master', 'Master'])
  if (errorResponse) return errorResponse

  const supabase = getAdminClient()

  try {
    const ALLOWED_BUCKETS = ['comunicados-midia', 'fotos-perfil', 'documentos']
    
    // 1. Listar arquivos do Storage
    const storageFilesPromises = ALLOWED_BUCKETS.map(bucket => listAllFilesRecursively(supabase, bucket))
    const storageFilesResults = await Promise.all(storageFilesPromises)
    const rawFiles = storageFilesResults.flat()

    // 2. Buscar todas as referências do Banco de Dados
    const dbRefs = await fetchDbReferences(supabase)

    // 3. Indexar referências para busca O(1)
    const refIndex = new Map<string, DbRef[]>()
    for (const ref of dbRefs) {
      const url = ref.url
      if (!url) continue

      const decodedUrl = safeDecode(url)
      const parts = decodedUrl.split('/storage/v1/object/public/')
      const cleanPath = parts.length > 1 ? parts[1] : decodedUrl

      // Indexa pelo caminho completo: "bucket/uploads/file.png"
      if (!refIndex.has(cleanPath)) refIndex.set(cleanPath, [])
      refIndex.get(cleanPath)!.push(ref)

      // Indexa também sem o bucket (caso o BD salve apenas o path relativo): "uploads/file.png"
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
            const decodedCandUrl = safeDecode(cand.url)
            if (decodedCandUrl.endsWith(file.path) || decodedCandUrl.includes(`/${file.bucket}/${file.path}`)) {
              matches.push(cand)
            }
          }
        }
      }

      const isOrphan = matches.length === 0

      // Mapear módulo com base no bucket e pasta
      let module = 'outros'
      if (file.bucket === 'fotos-perfil') {
        if (file.path.includes('student') || file.path.includes('guardian') || file.path.includes('aluno') || file.path.includes('responsavel')) {
          module = 'gestao_escolar'
        } else {
          module = 'gestao_pessoas'
        }
      } else if (file.bucket === 'documentos') {
        module = 'gestao_pessoas' // Documentos de funcionários (ASO, PGR, PCMSO)
      } else if (file.bucket === 'comunicados-midia') {
        if (file.path.startsWith('uploads/')) {
          module = 'agenda_digital' // Arquivos de agenda e comunicados
        } else if (file.path.startsWith('timbrados/')) {
          module = 'gestao_escolar' // Modelos timbrados de secretaria
        } else {
          module = 'simulados_provas' // Banco de questões e simulados
        }
      }

      // Refinar módulo com base na referência do banco de dados
      if (matches.length > 0) {
        const firstTable = matches[0].table
        if (firstTable === 'gp_documentos') {
          module = 'gestao_pessoas'
        } else if (['arquivos_adaptadas', 'provas_alternativas', 'simulados_alternativas'].includes(firstTable)) {
          module = 'simulados_provas'
        } else if (['dre_uploads'].includes(firstTable)) {
          module = 'gestao_escolar'
        } else if (['chat_attachments'].includes(firstTable)) {
          module = 'agenda_digital'
        } else if (firstTable === 'alunos' || firstTable === 'responsaveis') {
          module = 'gestao_escolar'
        } else if (firstTable === 'system_users') {
          module = 'gestao_pessoas'
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
    const byBucket: Record<string, number> = { 'comunicados-midia': 0, 'fotos-perfil': 0, 'documentos': 0 }
    const byModule: Record<string, number> = { 'agenda_digital': 0, 'gestao_pessoas': 0, 'simulados_provas': 0, 'gestao_escolar': 0, 'outros': 0 }

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
        byModule
      },
      files: processedFiles
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

    for (const url of urls) {
      if (!url) continue
      try {
        const decodedUrl = safeDecode(url)
        const parts = decodedUrl.split('/storage/v1/object/public/')
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

        // Se for solicitado deletar também as referências do banco de dados
        if (deleteDbRecord) {
          // Buscamos qual tabela e ID correspondem a esse arquivo
          const dbRefs = await fetchDbReferences(supabase)
          const matched = dbRefs.filter(ref => {
            const decRefUrl = safeDecode(ref.url)
            return decRefUrl === decodedUrl || decRefUrl.endsWith(path)
          })

          for (const ref of matched) {
            console.log(`[midia-api] Removendo referência no BD da tabela ${ref.table}, ID: ${ref.id}`)
            
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
              await supabase.from('alunos').update({ foto: null }).eq('id', ref.id)
            } else if (ref.table === 'system_users') {
              await supabase.from('system_users').update({ foto: null }).eq('id', ref.id)
            } else if (ref.table === 'responsaveis') {
              await supabase.from('responsaveis').update({ foto: null }).eq('id', ref.id)
            }
            deletedRefs.push(ref)
          }
        }
      } catch (parseErr: any) {
        console.error('[midia-api] Erro ao parsear URL para exclusão:', url, parseErr.message)
      }
    }

    // Excluir arquivos físicos dos buckets correspondentes
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

// POST endpoint para ações administrativas como limpar órfãos
export async function POST(request: Request) {
  const { user, errorResponse } = await requireProfile(['Diretor Geral', 'Administrador', 'Administrador Master', 'Master'])
  if (errorResponse) return errorResponse

  const supabase = getAdminClient()

  try {
    const { action } = await request.json()
    
    if (action === 'clean-orphans') {
      const ALLOWED_BUCKETS = ['comunicados-midia', 'fotos-perfil', 'documentos']
      
      // 1. Listar todos os arquivos
      const storageFilesPromises = ALLOWED_BUCKETS.map(bucket => listAllFilesRecursively(supabase, bucket))
      const storageFilesResults = await Promise.all(storageFilesPromises)
      const rawFiles = storageFilesResults.flat()

      // 2. Buscar todas as referências do banco
      const dbRefs = await fetchDbReferences(supabase)
      
      // Normalizar e indexar as URLs do BD
      const refUrls = new Set<string>()
      for (const ref of dbRefs) {
        if (ref.url) {
          refUrls.add(safeDecode(ref.url))
        }
      }

      const orphanUrls: string[] = []
      let sizeReclaimed = 0

      // 3. Filtrar arquivos físicos órfãos
      for (const file of rawFiles) {
        const decodedFileUrl = safeDecode(file.url)
        let isReferenced = false

        // Verifica correspondência direta de URL ou se a URL do BD contém a assinatura
        for (const dbUrl of refUrls) {
          if (dbUrl === decodedFileUrl || dbUrl.endsWith(file.path) || dbUrl.includes(`/${file.bucket}/${file.path}`)) {
            isReferenced = true
            break
          }
        }

        if (!isReferenced) {
          orphanUrls.push(file.url)
          sizeReclaimed += file.size
        }
      }

      if (orphanUrls.length === 0) {
        return NextResponse.json({
          ok: true,
          deletedCount: 0,
          sizeReclaimed: 0,
          message: 'Nenhum arquivo órfão encontrado para limpar.'
        })
      }

      // 4. Agrupar caminhos de órfãos por bucket para exclusão em lote
      const bucketPaths: Record<string, string[]> = {}
      for (const url of orphanUrls) {
        const decodedUrl = safeDecode(url)
        const parts = decodedUrl.split('/storage/v1/object/public/')
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
      }

      let deletedCount = 0
      for (const [bucket, paths] of Object.entries(bucketPaths)) {
        if (paths.length > 0) {
          const { data, error } = await supabase.storage.from(bucket).remove(paths)
          if (error) {
            console.error(`[midia-api] Erro ao limpar órfãos do bucket ${bucket}:`, error.message)
          } else if (data) {
            deletedCount += data.length
          }
        }
      }

      return NextResponse.json({
        ok: true,
        deletedCount,
        sizeReclaimed,
        message: `Limpeza concluída com sucesso! ${deletedCount} arquivos órfãos foram removidos.`
      })
    }

    return NextResponse.json({ error: 'Ação não suportada.' }, { status: 400 })
  } catch (e: any) {
    console.error('[midia-api] POST erro inesperado:', e)
    return NextResponse.json({ error: e.message || 'Erro interno do servidor' }, { status: 500 })
  }
}
