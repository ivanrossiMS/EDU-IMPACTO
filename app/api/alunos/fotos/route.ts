import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { supabaseServer as supabase } from '@/lib/supabaseServer'
import { isValidStudentPhoto } from '@/lib/utils'

export const dynamic = 'force-dynamic'

async function getPhotosForIds(ids: string[]) {
  const cleanIds = Array.from(
    new Set(
      ids
        .map(id => String(id || '').trim().replace(/^a_?/, '').replace(/^_*(ALU)?/, ''))
        .filter(Boolean)
    )
  )

  if (cleanIds.length === 0) {
    return {}
  }

  // Limite razoável para evitar abuso (máximo 100 alunos por requisição)
  const queryIds = cleanIds.slice(0, 100)

  const { data, error } = await supabase
    .from('alunos')
    .select('id, matricula, foto, foto_url, dados')
    .or(`id.in.(${queryIds.join(',')}),matricula.in.(${queryIds.join(',')})`)

  if (error) {
    console.error('[API alunos/fotos] Erro ao buscar fotos dos alunos:', error)
    return {}
  }

  const result: Record<string, string | null> = {}

  for (const s of data || []) {
    const rawFoto = s.foto || s.foto_url || s.dados?.foto || s.dados?.avatarUrl || s.dados?.fotoUrl || null
    const validFoto = isValidStudentPhoto(rawFoto) ? rawFoto : null
    
    // Indexa pelo ID original e por variantes de formatação
    if (s.id) {
      result[String(s.id)] = validFoto
      result[`a_${s.id}`] = validFoto
      result[`ALU_${s.id}`] = validFoto
    }
    if (s.matricula) {
      result[String(s.matricula)] = validFoto
    }
  }

  return result
}

export async function GET(req: Request) {
  try {
    const { user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const url = new URL(req.url)
    const idsParam = url.searchParams.get('ids') || ''
    const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean)

    const photos = await getPhotosForIds(ids)
    return NextResponse.json({ photos })
  } catch (err: any) {
    console.error('[API alunos/fotos] Exception:', err)
    return NextResponse.json({ error: err?.message || 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const body = await req.json().catch(() => ({}))
    const ids = Array.isArray(body?.ids) ? body.ids : []

    const photos = await getPhotosForIds(ids)
    return NextResponse.json({ photos })
  } catch (err: any) {
    console.error('[API alunos/fotos] Exception:', err)
    return NextResponse.json({ error: err?.message || 'Erro interno' }, { status: 500 })
  }
}
