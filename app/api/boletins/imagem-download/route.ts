import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

interface CachedBoletimImage {
  buffer: Buffer
  fileName: string
  createdAt: number
  externalDownloadUrl?: string
  externalViewUrl?: string
}

const TTL_MS = 30 * 60 * 1000 // 30 minutos

function getCache(): Map<string, CachedBoletimImage> {
  const g = globalThis as any
  if (!g.__boletimImageCache) {
    g.__boletimImageCache = new Map<string, CachedBoletimImage>()
  }
  const cache: Map<string, CachedBoletimImage> = g.__boletimImageCache
  const now = Date.now()
  for (const [key, val] of cache.entries()) {
    if (now - val.createdAt > TTL_MS) {
      cache.delete(key)
    }
  }
  return cache
}

function sanitizeFileName(raw?: string | null): string {
  const base = (raw || 'Boletim_Escolar.png')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return base.toLowerCase().endsWith('.png') ? base : `${base}.png`
}

export async function POST(req: NextRequest) {
  try {
    let buffer: Buffer | null = null
    let rawFileName = 'Boletim_Escolar.png'

    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      const nameField = formData.get('fileName')
      if (typeof nameField === 'string' && nameField.trim()) {
        rawFileName = nameField.trim()
      } else if (file?.name) {
        rawFileName = file.name
      }
      if (file) {
        const ab = await file.arrayBuffer()
        buffer = Buffer.from(ab)
      }
    } else {
      const body = await req.json()
      if (body?.fileName) rawFileName = String(body.fileName)
      if (typeof body?.dataUrl === 'string') {
        const base64Part = body.dataUrl.includes(',')
          ? body.dataUrl.split(',')[1]
          : body.dataUrl
        buffer = Buffer.from(base64Part, 'base64')
      }
    }

    if (!buffer || buffer.length === 0) {
      return NextResponse.json({ error: 'Imagem inválida ou vazia.' }, { status: 400 })
    }

    const safeFileName = sanitizeFileName(rawFileName)
    const id = crypto.randomUUID()

    let externalDownloadUrl: string | undefined
    let externalViewUrl: string | undefined

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (supabaseUrl && supabaseServiceKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const storagePath = `boletins-temp/${id}/${safeFileName}`
        const { error: uploadErr } = await supabase.storage
          .from('documentos')
          .upload(storagePath, buffer, {
            contentType: 'image/png',
            cacheControl: '1800',
            upsert: true,
          })

        if (!uploadErr) {
          const { data: pubData } = supabase.storage
            .from('documentos')
            .getPublicUrl(storagePath)

          if (pubData?.publicUrl) {
            externalViewUrl = pubData.publicUrl
            externalDownloadUrl = `${pubData.publicUrl}?download=${encodeURIComponent(safeFileName)}`
          }
        }
      } catch (storageErr) {
        console.warn('[BoletimImagemDownload] Falha opcional no Supabase Storage:', storageErr)
      }
    }

    const cache = getCache()
    cache.set(id, {
      buffer,
      fileName: safeFileName,
      createdAt: Date.now(),
      externalDownloadUrl,
      externalViewUrl,
    })

    const serverDownloadUrl = `/api/boletins/imagem-download?id=${encodeURIComponent(id)}&filename=${encodeURIComponent(safeFileName)}`

    return NextResponse.json({
      id,
      fileName: safeFileName,
      serverDownloadUrl,
      externalDownloadUrl,
      externalViewUrl,
    })
  } catch (err: any) {
    console.error('[BoletimImagemDownload POST]', err)
    return NextResponse.json(
      { error: err?.message || 'Erro ao preparar imagem para download.' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const id = searchParams.get('id') || ''
    const rawName = searchParams.get('filename') || 'Boletim_Escolar.png'
    const isInline = searchParams.get('inline') === '1'
    const safeFileName = sanitizeFileName(rawName)

    if (!id || !/^[a-zA-Z0-9-]+$/.test(id)) {
      return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })
    }

    const cache = getCache()
    let cached = cache.get(id)
    let buffer: Buffer | null = cached?.buffer || null
    const finalFileName = cached?.fileName || safeFileName

    if (!buffer) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const storagePath = `boletins-temp/${id}/${finalFileName}`
        const { data: blobData, error } = await supabase.storage
          .from('documentos')
          .download(storagePath)

        if (!error && blobData) {
          const ab = await blobData.arrayBuffer()
          buffer = Buffer.from(ab)
        }
      }
    }

    if (!buffer) {
      return NextResponse.json(
        { error: 'Imagem expirada ou não encontrada. Gere o boletim novamente.' },
        { status: 404 }
      )
    }

    const disposition = isInline
      ? `inline; filename="${finalFileName}"`
      : `attachment; filename="${finalFileName}"`

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': disposition,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'public, max-age=1800',
      },
    })
  } catch (err: any) {
    console.error('[BoletimImagemDownload GET]', err)
    return NextResponse.json(
      { error: err?.message || 'Erro ao baixar imagem do boletim.' },
      { status: 500 }
    )
  }
}
