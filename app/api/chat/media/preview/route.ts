import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

const CACHE_DIR = path.join('/tmp', 'chat_media_preview_cache')

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    try {
      fs.mkdirSync(CACHE_DIR, { recursive: true })
    } catch {}
  }
}

async function convertHeicToJpeg(heicBuffer: Buffer): Promise<Buffer> {
  const hash = crypto.randomBytes(8).toString('hex')
  const tmpInput = path.join('/tmp', `heic_in_${hash}.heic`)
  const tmpOutput = path.join('/tmp', `heic_out_${hash}.jpg`)

  try {
    fs.writeFileSync(tmpInput, heicBuffer)

    // 1. Tenta nativo do macOS (sips) se disponível: ~40ms
    if (process.platform === 'darwin') {
      try {
        execSync(`/usr/bin/sips -s format jpeg -s formatOptions 82 -Z 1600 "${tmpInput}" --out "${tmpOutput}"`, {
          stdio: 'ignore',
          timeout: 8000
        })
        if (fs.existsSync(tmpOutput)) {
          return fs.readFileSync(tmpOutput)
        }
      } catch (sipsErr) {
        console.warn('[ChatMediaPreview] sips falhou, tentando heic-convert:', sipsErr)
      }
    }

    // 2. Fallback universal (Linux, Windows, Docker): heic-convert
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const convert = require('heic-convert')
    const outputBuffer = await convert({
      buffer: heicBuffer,
      format: 'JPEG',
      quality: 0.85
    })
    return Buffer.from(outputBuffer)
  } finally {
    try { if (fs.existsSync(tmpInput)) fs.unlinkSync(tmpInput) } catch {}
    try { if (fs.existsSync(tmpOutput)) fs.unlinkSync(tmpOutput) } catch {}
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'URL do arquivo não informada' }, { status: 400 })
  }

  try {
    const isHeic = /\.(heic|heif)(\?|$)/i.test(url)
    const urlHash = crypto.createHash('sha256').update(url).digest('hex')

    ensureCacheDir()
    const cachedFilePath = path.join(CACHE_DIR, `${urlHash}.jpg`)

    // Se já estiver convertido em cache de disco, retorna imediatamente
    if (isHeic && fs.existsSync(cachedFilePath)) {
      const fileBuffer = fs.readFileSync(cachedFilePath)
      return new Response(new Uint8Array(fileBuffer), {
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Length': String(fileBuffer.length),
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Content-Disposition': 'inline'
        }
      })
    }

    // Faz download do arquivo original
    const fetchRes = await fetch(url, {
      headers: {
        'User-Agent': 'ImpactoEdu-MediaProcessor/1.0'
      }
    })

    if (!fetchRes.ok) {
      return NextResponse.json(
        { error: `Falha ao buscar mídia: HTTP ${fetchRes.status}` },
        { status: fetchRes.status }
      )
    }

    const arrayBuffer = await fetchRes.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)

    if (isHeic) {
      const jpegBuffer = await convertHeicToJpeg(inputBuffer)
      try {
        fs.writeFileSync(cachedFilePath, jpegBuffer)
      } catch {}

      return new Response(new Uint8Array(jpegBuffer), {
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Length': String(jpegBuffer.length),
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Content-Disposition': 'inline'
        }
      })
    }

    // Se não for HEIC, repassa com o content-type original
    const contentType = fetchRes.headers.get('content-type') || 'application/octet-stream'
    return new Response(new Uint8Array(inputBuffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Disposition': 'inline'
      }
    })
  } catch (err: any) {
    console.error('[ChatMediaPreview] Erro ao processar preview:', err)
    return NextResponse.json(
      { error: err?.message || 'Erro ao processar preview' },
      { status: 500 }
    )
  }
}
