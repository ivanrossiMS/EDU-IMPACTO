import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Next.js App Router: desabilitar o body parser interno para aceitar streams grandes
export const runtime = 'nodejs'

export async function POST(request: Request) {
  const supabase = await createProtectedClient()
  
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
    const bucket = (formData.get('bucket') as string) || 'comunicados-midia'
    
    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    const MAX_SIZE = 50 * 1024 * 1024 // 50MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Arquivo muito grande. Máximo: 50MB' }, { status: 413 })
    }

    const safeBaseName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
    const filePath = `uploads/${Date.now()}_${safeBaseName}`

    const arrayBuffer = await file.arrayBuffer()

    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, arrayBuffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
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
      type: file.type,
      size: file.size,
      path: filePath,
    }, { status: 201 })
  } catch (e: any) {
    console.error('[upload-midia] Unexpected error:', e)
    return NextResponse.json({ error: e.message || 'Erro interno' }, { status: 500 })
  }
}
