import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createAdminClient } from '@/lib/server/supabaseServerFactory'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const { bucket: requestedBucket, fileName, folder = 'uploads' } = await request.json()

    if (!requestedBucket || !fileName) {
      return NextResponse.json({ error: 'Faltam parâmetros obrigatórios: bucket, fileName' }, { status: 400 })
    }

    const ALLOWED_BUCKETS = ['comunicados-midia', 'fotos-perfil', 'documentos']
    const bucket = ALLOWED_BUCKETS.includes(requestedBucket) ? requestedBucket : 'comunicados-midia'

    const supabase = createAdminClient()
    
    const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : ''
    const baseName = fileName.includes('.') ? fileName.slice(0, fileName.lastIndexOf('.')) : fileName
    const safeBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)
    const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10)
    const cleanFolder = String(folder || 'uploads').replace(/[^a-zA-Z0-9_-]/g, '') || 'uploads'
    const filePath = `${cleanFolder}/${Date.now()}_${safeBaseName || 'file'}${safeExt}`

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(filePath)

    if (error) {
      console.error('[API upload-midia/sign] Storage Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const publicUrl = supabase.storage.from(bucket).getPublicUrl(filePath).data.publicUrl

    return NextResponse.json({
      ok: true,
      token: data.token,
      path: data.path,
      signedUrl: data.signedUrl,
      publicUrl
    })
  } catch (err: any) {
    console.error('[API upload-midia/sign] Unexpected:', err)
    return NextResponse.json({ error: err.message || 'Erro ao gerar URL assinada' }, { status: 500 })
  }
}
