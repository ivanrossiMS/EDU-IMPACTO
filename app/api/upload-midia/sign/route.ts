import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/supabaseServerFactory'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { bucket, fileName, folder = 'uploads' } = await request.json()

    if (!bucket || !fileName) {
      return NextResponse.json({ error: 'Faltam parâmetros obrigatórios: bucket, fileName' }, { status: 400 })
    }

    const supabase = createAdminClient()
    
    const safeBaseName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
    const filePath = `${folder}/${Date.now()}_${safeBaseName}`

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
