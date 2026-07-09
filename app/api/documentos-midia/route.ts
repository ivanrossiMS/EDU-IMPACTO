import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const formData = await req.formData()
    const action = formData.get('action')

    if (action === 'list') {
      const { data, error } = await supabase.storage.from('documentos').list('timbrados')
      if (error) throw error
      
      const list = []
      for (const file of data || []) {
        if (file.name !== '.emptyFolderPlaceholder') {
          const { data: pubUrl } = supabase.storage.from('documentos').getPublicUrl(`timbrados/${file.name}`)
          list.push({ name: file.name, url: pubUrl.publicUrl })
        }
      }
      return NextResponse.json({ success: true, list })
    }

    if (action === 'delete') {
      const fileName = formData.get('fileName') as string
      const { error } = await supabase.storage.from('documentos').remove([`timbrados/${fileName}`])
      if (error) throw error
      return NextResponse.json({ success: true })
    }
    
    if (action === 'upload') {
      const file = formData.get('file') as File
      if (!file) throw new Error('Nenhum arquivo enviado')
      
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      
      const buffer = Buffer.from(await file.arrayBuffer())
      const { data, error } = await supabase.storage.from('documentos').upload(`timbrados/${fileName}`, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      })
      if (error) throw error
      
      return NextResponse.json({ success: true, fileName })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (error: any) {
    console.error('[API Documentos Midia]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
