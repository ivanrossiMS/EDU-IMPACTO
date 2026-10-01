import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createClient } from '@supabase/supabase-js'
import { parseDocx, parsePdf, parseQuestionsFromText } from '@/lib/server/docxMathParser'
import {
  parseRawTextOrHtmlToQuestoes,
  convertServerParsedToQuestoes,
  extractImagesFromRtf,
  injectRtfImagesIntoHtml
} from '@/lib/provas-online/importParser'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Uploads a base64 image or buffer to Supabase Storage if available,
 * returning the public CDN URL or falling back to the dataUrl.
 */
async function tryUploadImageToStorage(
  supabase: any,
  dataUrlOrBuffer: string | Buffer,
  filenamePrefix: string
): Promise<string> {
  if (!supabase) {
    return typeof dataUrlOrBuffer === 'string' ? dataUrlOrBuffer : ''
  }

  try {
    let buffer: Buffer
    let contentType = 'image/png'
    let ext = '.png'

    if (typeof dataUrlOrBuffer === 'string') {
      const match = dataUrlOrBuffer.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/)
      if (!match) return dataUrlOrBuffer // already a remote URL
      contentType = match[1]
      buffer = Buffer.from(match[2], 'base64')
    } else {
      buffer = dataUrlOrBuffer
    }

    if (buffer.length < 16) {
      return typeof dataUrlOrBuffer === 'string' ? dataUrlOrBuffer : ''
    }

    // Sniff actual magic bytes from buffer
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      contentType = 'image/jpeg'
      ext = '.jpg'
    } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      contentType = 'image/png'
      ext = '.png'
    } else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      contentType = 'image/gif'
      ext = '.gif'
    } else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
      contentType = 'image/webp'
      ext = '.webp'
    } else if (contentType.includes('svg')) {
      contentType = 'image/svg+xml'
      ext = '.svg'
    }

    const cleanPrefix = filenamePrefix.replace(/[^a-zA-Z0-9_-]/g, '_')
    const fileName = `provas-online/importadas/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${cleanPrefix}${ext}`
    const bucket = 'comunicados-midia'

    const { error } = await supabase.storage.from(bucket).upload(fileName, buffer, {
      contentType,
      upsert: true,
      cacheControl: '31536000'
    })

    if (!error) {
      const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(fileName)
      if (pubData?.publicUrl) {
        return pubData.publicUrl
      }
    }
  } catch (err) {
    console.warn('[tryUploadImageToStorage error]:', err)
  }

  // Graceful fallback to raw dataUrl if string
  return typeof dataUrlOrBuffer === 'string' ? dataUrlOrBuffer : ''
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  let supabase: any = null
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
    } catch (e) {
      console.warn('Could not initialize supabase admin for import', e)
    }
  }

  try {
    const contentType = request.headers.get('content-type') || ''

    // ── CASE 1: MULTIPART FORM DATA (File Upload or Form Text) ──
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      const rawText = formData.get('text') as string | null
      const rawHtml = formData.get('html') as string | null
      const defaultPoints = Number(formData.get('defaultPoints') || 1.0)
      const totalExamPoints = formData.get('totalExamPoints') ? Number(formData.get('totalExamPoints')) : undefined

      // If raw text or HTML was submitted via FormData
      if (!file && (rawText || rawHtml)) {
        const textToParse = rawHtml || rawText || ''
        const questoes = parseRawTextOrHtmlToQuestoes(textToParse, {
          defaultPoints,
          totalExamPoints
        })

        // Optimize any base64 images inside questions
        if (supabase) {
          for (const q of questoes) {
            const imgRegex = /<img\b[^>]*?\bsrc=["'](data:image\/[^"']+)["'][^>]*?>/gi
            let match: RegExpExecArray | null
            const replacements: Array<{ from: string; to: string }> = []
            while ((match = imgRegex.exec(q.enunciado)) !== null) {
              const base64Data = match[1]
              const cdnUrl = await tryUploadImageToStorage(supabase, base64Data, `q_${q.ordem}`)
              if (cdnUrl && cdnUrl !== base64Data) {
                replacements.push({ from: base64Data, to: cdnUrl })
              }
            }
            for (const r of replacements) {
              q.enunciado = q.enunciado.replaceAll(r.from, r.to)
            }

            if (q.alternativas) {
              for (const a of q.alternativas) {
                const altImgRegex = /<img\b[^>]*?\bsrc=["'](data:image\/[^"']+)["'][^>]*?>/gi
                let altMatch: RegExpExecArray | null
                const altReplacements: Array<{ from: string; to: string }> = []
                while ((altMatch = altImgRegex.exec(a.texto)) !== null) {
                  const base64Data = altMatch[1]
                  const cdnUrl = await tryUploadImageToStorage(supabase, base64Data, `alt_${q.ordem}_${a.letra}`)
                  if (cdnUrl && cdnUrl !== base64Data) {
                    altReplacements.push({ from: base64Data, to: cdnUrl })
                  }
                }
                for (const r of altReplacements) {
                  a.texto = a.texto.replaceAll(r.from, r.to)
                }
              }
            }
          }
        }

        return NextResponse.json({
          success: true,
          totalQuestoes: questoes.length,
          questoes
        })
      }

      // If a file was uploaded
      if (!file) {
        return NextResponse.json({ error: 'Nenhum arquivo ou texto enviado.' }, { status: 400 })
      }

      const filename = file.name.toLowerCase()
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      let extractedText = ''
      let imageMap = new Map<string, any>()

      if (filename.endsWith('.docx') || filename.endsWith('.doc')) {
        try {
          const r = await parseDocx(buffer)
          extractedText = r.text
          imageMap = r.imageMap
        } catch (err: any) {
          if (
            err.message &&
            (err.message.includes('End of data reached') ||
              err.message.includes('signature not found') ||
              err.message.includes("Can't find end of central directory") ||
              err.message.includes('is this a zip file'))
          ) {
            return NextResponse.json(
              {
                error:
                  'O arquivo .DOC enviado é de um formato antigo (Word 97-2003). Por favor, abra-o no Word e salve como .DOCX para importar.'
              },
              { status: 400 }
            )
          }
          throw err
        }
      } else if (filename.endsWith('.pdf')) {
        const r = await parsePdf(buffer)
        extractedText = r.text
        imageMap = r.imageMap
      } else if (filename.endsWith('.txt')) {
        extractedText = buffer.toString('utf-8')
      } else {
        return NextResponse.json(
          { error: 'Formato não suportado. Por favor, envie arquivos .docx, .pdf ou .txt.' },
          { status: 400 }
        )
      }

      if (!extractedText || extractedText.trim().length < 5) {
        return NextResponse.json(
          { error: 'Não foi possível extrair texto legível deste arquivo.' },
          { status: 400 }
        )
      }

      // Upload extracted Word images to CDN if supabase available
      if (supabase && imageMap && imageMap.size > 0) {
        for (const [key, img] of imageMap.entries()) {
          if (img.src && typeof img.src === 'string' && img.src.startsWith('data:image')) {
            const publicUrl = await tryUploadImageToStorage(supabase, img.src, key)
            if (publicUrl) {
              img.src = publicUrl
            }
          }
        }
      }

      // Parse with docxMathParser splitter
      const parsedRaw = parseQuestionsFromText(extractedText, imageMap)

      // Convert into rich QuestaoProva
      const questoes = convertServerParsedToQuestoes(parsedRaw, {
        defaultPoints,
        totalExamPoints
      })

      return NextResponse.json({
        success: true,
        arquivoNome: file.name,
        arquivoTamanho: file.size,
        totalQuestoes: questoes.length,
        questoes
      })
    }

    // ── CASE 2: JSON BODY (Direct Text/HTML/Images Paste) ──
    const body = await request.json()
    const { text, html, rtf, defaultPoints, totalExamPoints } = body || {}

    let textToParse = html || text || ''
    if (rtf && textToParse && !textToParse.includes('data:image/')) {
      try {
        const rtfImages = extractImagesFromRtf(rtf)
        if (rtfImages.length > 0) {
          const { injectedHtml } = injectRtfImagesIntoHtml(textToParse, rtfImages)
          textToParse = injectedHtml
        }
      } catch (e) {
        console.warn('[importar] Error extracting RTF images on server:', e)
      }
    }

    if (!textToParse.trim()) {
      return NextResponse.json({ error: 'Nenhum conteúdo fornecido para importação.' }, { status: 400 })
    }

    const questoes = parseRawTextOrHtmlToQuestoes(textToParse, {
      defaultPoints: Number(defaultPoints || 1.0),
      totalExamPoints: totalExamPoints ? Number(totalExamPoints) : undefined
    })

    // Optimize any base64 images inside questions to CDN
    if (supabase) {
      for (const q of questoes) {
        const imgRegex = /<img\b[^>]*?\bsrc=["'](data:image\/[^"']+)["'][^>]*?>/gi
        let match: RegExpExecArray | null
        const replacements: Array<{ from: string; to: string }> = []
        while ((match = imgRegex.exec(q.enunciado)) !== null) {
          const base64Data = match[1]
          const cdnUrl = await tryUploadImageToStorage(supabase, base64Data, `q_${q.ordem}`)
          if (cdnUrl && cdnUrl !== base64Data) {
            replacements.push({ from: base64Data, to: cdnUrl })
          }
        }
        for (const r of replacements) {
          q.enunciado = q.enunciado.replaceAll(r.from, r.to)
        }

        if (q.alternativas) {
          for (const a of q.alternativas) {
            const altImgRegex = /<img\b[^>]*?\bsrc=["'](data:image\/[^"']+)["'][^>]*?>/gi
            let altMatch: RegExpExecArray | null
            const altReplacements: Array<{ from: string; to: string }> = []
            while ((altMatch = altImgRegex.exec(a.texto)) !== null) {
              const base64Data = altMatch[1]
              const cdnUrl = await tryUploadImageToStorage(supabase, base64Data, `alt_${q.ordem}_${a.letra}`)
              if (cdnUrl && cdnUrl !== base64Data) {
                altReplacements.push({ from: base64Data, to: cdnUrl })
              }
            }
            for (const r of altReplacements) {
              a.texto = a.texto.replaceAll(r.from, r.to)
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      totalQuestoes: questoes.length,
      questoes
    })
  } catch (err: any) {
    console.error('[API /api/provas-online/importar Error]:', err)
    return NextResponse.json(
      { error: `Erro ao importar questões: ${err.message || 'Erro inesperado'}` },
      { status: 500 }
    )
  }
}
