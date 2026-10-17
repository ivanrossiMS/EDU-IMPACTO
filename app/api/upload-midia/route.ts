import { NextResponse } from 'next/server'
import { resolveUserRole } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { resolveMimeType } from '@/lib/upload/mimeUtils'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Next.js App Router: desabilitar o body parser interno para aceitar streams grandes
export const runtime = 'nodejs'

const STAFF_ONLY_BUCKETS = new Set(['documentos', 'simulados-arquivos', 'credimpacto'])
const BLOCKED_EXTENSIONS = new Set([
  '.html', '.htm', '.xhtml', '.svg', '.xml', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
  '.php', '.phtml', '.sh', '.bash', '.exe', '.dll', '.bat', '.cmd', '.msi', '.vbs', '.ps1'
])

export async function POST(request: Request) {
  const { user, isStaff, errorResponse } = await resolveUserRole(request)
  if (errorResponse || !user) return errorResponse || NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Use singleton admin client to bypass storage RLS after authenticating the user
  const supabase = getAdminClient()
  
  try {
    // Ler o Content-Type para validar que é multipart
    const contentType = request.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Content-Type deve ser multipart/form-data' }, { status: 400 })
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch (parseErr: any) {
      console.error('[upload-midia] FormData parse error:', parseErr)
      return NextResponse.json({ 
        error: 'Erro ao receber arquivo. O arquivo pode ser grande demais para esta rota. Use upload direto ao Supabase Storage.' 
      }, { status: 413 })
    }

    const file = formData.get('file') as File | null
    const requestedBucket = formData.get('bucket') as string
    
    // VALIDATION: Permite todos os buckets ativos do ecossistema EDU-IMPACTO
    const ALLOWED_BUCKETS = ['comunicados-midia', 'documentos', 'simulados-arquivos', 'credimpacto', 'fotos-perfil']
    const bucket = ALLOWED_BUCKETS.includes(requestedBucket) ? requestedBucket : 'comunicados-midia'
    
    if (STAFF_ONLY_BUCKETS.has(bucket) && !isStaff) {
      return NextResponse.json({ error: 'Acesso restrito a colaboradores para este repositório de arquivos.' }, { status: 403 })
    }

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : ''
    if (ext && BLOCKED_EXTENSIONS.has(ext)) {
      return NextResponse.json({ error: `Extensão de arquivo não permitida por segurança: ${ext}` }, { status: 415 })
    }

    // VALIDATION: Suporte robusto a imagens, vídeos, áudios, PDFs e documentos de escritório (bloqueando SVG/HTML ativo)
    const mimeType = resolveMimeType(file.name, file.type)
    if (mimeType === 'image/svg+xml' || mimeType === 'text/html' || mimeType === 'application/xhtml+xml') {
      return NextResponse.json({ error: `Tipo de arquivo não permitido por segurança: ${mimeType}` }, { status: 415 })
    }
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/heic', 'image/heif',
      'application/pdf', 
      'video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'video/3gpp', 'video/x-matroska', 'video/x-msvideo',
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac', 'audio/m4a', 'audio/x-m4a',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv', 'application/json', 'application/zip', 'application/x-zip-compressed',
      'application/octet-stream'
    ]
    if (
      !allowedTypes.includes(mimeType) && 
      !mimeType.startsWith('image/') && 
      !mimeType.startsWith('video/') && 
      !mimeType.startsWith('audio/')
    ) {
      return NextResponse.json({ error: `Tipo de arquivo não permitido: ${mimeType}` }, { status: 415 })
    }

    const MAX_SIZE = 100 * 1024 * 1024 // 100MB (limite físico do Supabase Storage)
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Arquivo muito grande. O limite suportado pelo servidor é de 100MB.' }, { status: 413 })
    }

    const baseName = file.name.includes('.') ? file.name.slice(0, file.name.lastIndexOf('.')) : file.name
    const safeBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)
    const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10)
    const requestedFolder = formData.get('folder') as string
    const folder = requestedFolder 
      ? requestedFolder.replace(/[^a-zA-Z0-9_\/-]/g, '').replace(/^\/+|\/+$/g, '') 
      : 'uploads'
    const filePath = `${folder || 'uploads'}/${Date.now()}_${safeBaseName || 'file'}${safeExt}`

    const usageType = formData.get('usageType') as string
    const cacheControl = usageType === 'fixed' ? '31536000' : '2592000'

    const arrayBuffer = await file.arrayBuffer()

    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, arrayBuffer, {
        contentType: mimeType,
        upsert: false,
        cacheControl,
      })

    if (error) {
      console.error('[upload-midia] Supabase storage error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filePath)

    return NextResponse.json({
      ok: true,
      url: publicData.publicUrl,
      name: file.name,
      type: mimeType,
      size: file.size,
      path: filePath,
    }, { status: 201 })
  } catch (e: any) {
    console.error('[upload-midia] Unexpected error:', e)
    return NextResponse.json({ error: e.message || 'Erro interno' }, { status: 500 })
  }
}
