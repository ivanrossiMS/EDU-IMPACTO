import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createClient } from '@supabase/supabase-js'
import { resolveMimeType } from '@/lib/upload/uploadClient'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Next.js App Router: desabilitar o body parser interno para aceitar streams grandes
export const runtime = 'nodejs'

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  // Use service role key to bypass storage RLS (since we already authenticated the user)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
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
    
    // VALIDATION: Only allow specific buckets to prevent arbitrary file uploads
    const ALLOWED_BUCKETS = ['comunicados-midia', 'fotos-perfil', 'documentos']
    const bucket = ALLOWED_BUCKETS.includes(requestedBucket) ? requestedBucket : 'comunicados-midia'
    
    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    // VALIDATION: Intelligent MIME type checking (prevents rejecting mobile files without browser MIME)
    const mimeType = resolveMimeType(file.name, file.type)
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/heic', 'image/heif',
      'application/pdf', 
      'video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'video/3gpp', 'video/x-matroska', 'video/x-msvideo',
      'application/octet-stream'
    ]
    if (!allowedTypes.includes(mimeType) && !mimeType.startsWith('image/') && !mimeType.startsWith('video/')) {
      return NextResponse.json({ error: `Tipo de arquivo não permitido: ${mimeType}` }, { status: 415 })
    }

    const MAX_SIZE = 100 * 1024 * 1024 // 100MB (limite físico do Supabase Storage)
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Arquivo muito grande. O limite suportado pelo servidor é de 100MB.' }, { status: 413 })
    }

    const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : ''
    const baseName = file.name.includes('.') ? file.name.slice(0, file.name.lastIndexOf('.')) : file.name
    const safeBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)
    const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10)
    const requestedFolder = formData.get('folder') as string
    const folder = requestedFolder ? requestedFolder.replace(/[^a-zA-Z0-9_-]/g, '') : 'uploads'
    const filePath = `${folder}/${Date.now()}_${safeBaseName || 'file'}${safeExt}`

    const arrayBuffer = await file.arrayBuffer()

    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, arrayBuffer, {
        contentType: mimeType,
        upsert: false,
        cacheControl: '2592000',
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
