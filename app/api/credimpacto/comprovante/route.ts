import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const pasta = (formData.get('pasta') as string) || 'comprovantes'

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })
    }

    const sb = getAdminClient()
    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf'
    const fileName = `${pasta}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`

    // Tenta upload no bucket 'credimpacto'
    let bucketName = 'credimpacto'
    let { data, error } = await sb.storage
      .from(bucketName)
      .upload(fileName, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: true
      })

    // Se o bucket credimpacto der erro, tenta bucket 'documentos'
    if (error) {
      bucketName = 'documentos'
      const resDoc = await sb.storage
        .from(bucketName)
        .upload(`credimpacto/${fileName}`, buffer, {
          contentType: file.type || 'application/octet-stream',
          upsert: true
        })
      if (resDoc.error) throw resDoc.error
      data = resDoc.data
    }

    const { data: publicData } = sb.storage.from(bucketName).getPublicUrl(data?.path || fileName)
    const fileUrl = publicData.publicUrl

    return NextResponse.json({
      success: true,
      url: fileUrl,
      path: data?.path || fileName
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro no upload do comprovante' }, { status: 400 })
  }
}
