import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { supabaseServer as supabase } from '@/lib/supabaseServer'
import { isValidStudentPhoto } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const SERVER_PHOTO_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutos
const serverPhotoCache = new Map<string, { photo: string | null; expires: number }>()

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
  const now = Date.now()
  const result: Record<string, string | null> = {}
  const missingIds: string[] = []

  for (const id of queryIds) {
    const cached = serverPhotoCache.get(id)
    if (cached && cached.expires > now) {
      result[id] = cached.photo
      result[`a_${id}`] = cached.photo
      result[`ALU_${id}`] = cached.photo
    } else {
      missingIds.push(id)
    }
  }

  if (missingIds.length === 0) {
    return result
  }

  const { data, error } = await supabase
    .from('alunos')
    .select('id, matricula, foto, foto_url, dados_foto:dados->>foto, dados_avatar:dados->>avatarUrl, dados_foto_url:dados->>fotoUrl')
    .or(`id.in.(${missingIds.join(',')}),matricula.in.(${missingIds.join(',')})`)

  if (error) {
    console.error('[API alunos/fotos] Erro ao buscar fotos dos alunos:', error)
    return result
  }

  const foundSet = new Set<string>()

  for (const s of (data || []) as any[]) {
    const rawFoto = s.foto || s.foto_url || s.dados_foto || s.dados_avatar || s.dados_foto_url || null
    const validFoto = isValidStudentPhoto(rawFoto) ? rawFoto : null
    
    // Indexa pelo ID original e por variantes de formatação
    if (s.id) {
      const sId = String(s.id).trim()
      foundSet.add(sId)
      serverPhotoCache.set(sId, { photo: validFoto, expires: now + SERVER_PHOTO_CACHE_TTL_MS })
      result[sId] = validFoto
      result[`a_${sId}`] = validFoto
      result[`ALU_${sId}`] = validFoto
    }
    if (s.matricula) {
      const sMat = String(s.matricula).trim()
      foundSet.add(sMat)
      serverPhotoCache.set(sMat, { photo: validFoto, expires: now + SERVER_PHOTO_CACHE_TTL_MS })
      result[sMat] = validFoto
    }
  }

  // Cache negative lookups por 2 minutos para evitar consultas repetidas para alunos sem foto
  for (const id of missingIds) {
    if (!foundSet.has(id)) {
      serverPhotoCache.set(id, { photo: null, expires: now + 120_000 })
      result[id] = null
    }
  }

  if (serverPhotoCache.size > 2000) {
    serverPhotoCache.clear()
  }

  return result
}

export async function GET(req: Request) {
  try {
    const { user, errorResponse } = await requireAuth(req)
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
    const { user, errorResponse } = await requireAuth(req)
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
