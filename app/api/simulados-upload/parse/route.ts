import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createClient } from '@supabase/supabase-js'
import { parseDocx, parsePdf, parseQuestionsFromText } from '@/lib/server/docxMathParser'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════════════════════
// POST HANDLER FOR SIMULADOS UPLOAD
// ═══════════════════════════════════════════════════════════════════════════
export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const filename = file.name.toLowerCase()

    let text = ''
    let imageMap = new Map<string, any>()

    if (filename.endsWith('.docx') || filename.endsWith('.doc')) {
      try {
        const r = await parseDocx(buffer)
        text = r.text
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
                'O arquivo .DOC enviado é de um formato antigo (Word 97-2003). Por favor, abra-o no Word e salve como .DOCX para importar.',
            },
            { status: 400 }
          )
        }
        throw err
      }
    } else if (filename.endsWith('.pdf')) {
      const r = await parsePdf(buffer)
      text = r.text
      imageMap = r.imageMap
    } else {
      return NextResponse.json(
        { error: 'Formato não suportado. Use .docx ou .pdf.' },
        { status: 400 }
      )
    }

    if (!text || text.trim().length < 10) {
      return NextResponse.json(
        { error: 'Não foi possível extrair texto. O arquivo pode estar protegido ou corrompido.' },
        { status: 400 }
      )
    }

    const questions = parseQuestionsFromText(text, imageMap)

    // ═══════════════════════════════════════════════════════════════════════════
    // PERSIST ORIGINAL FILE IN STORAGE & DATABASE
    // ═══════════════════════════════════════════════════════════════════════════
    let arquivoUrl = ''
    let arquivoNome = file.name
    let arquivoTamanho = file.size
    let arquivoPath = ''

    try {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const itemId = formData.get('itemId') as string | null
      const itemTipo = (formData.get('itemTipo') as string | null) || 'simulado'
      const reqId = formData.get('reqId') as string | null
      const discId = formData.get('discId') as string | null
      const profId = formData.get('profId') as string | null

      const safeBaseName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
      const folder = itemTipo === 'prova' ? 'provas-upload-originais' : 'simulados-upload-originais'
      const filePath = `${folder}/${itemId || 'geral'}/${Date.now()}_${safeBaseName}`

      // Try uploading to simulados-arquivos bucket first
      let { error: storageError } = await supabaseAdmin.storage
        .from('simulados-arquivos')
        .upload(filePath, buffer, {
          contentType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          upsert: true,
          cacheControl: '31536000',
        })

      let usedBucket = 'simulados-arquivos'

      // Fallback to comunicados-midia if needed
      if (storageError) {
        const { error: fallbackError } = await supabaseAdmin.storage
          .from('comunicados-midia')
          .upload(filePath, buffer, {
            contentType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            upsert: true,
            cacheControl: '31536000',
          })
        if (!fallbackError) {
          storageError = null
          usedBucket = 'comunicados-midia'
        }
      }

      if (!storageError) {
        const { data: pubData } = supabaseAdmin.storage.from(usedBucket).getPublicUrl(filePath)
        arquivoUrl = pubData?.publicUrl || ''
        arquivoPath = filePath
      }

      // If itemId is provided, save metadata into config_estudio in database
      if (itemId && arquivoUrl) {
        const table = itemTipo === 'prova' ? 'provas_upload' : (itemTipo === 'redacao' ? 'redacao_upload' : 'simulados_upload')
        const { data: existingItem } = await supabaseAdmin.from(table).select('config_estudio').eq('id', itemId).single()
        const currentConfig = existingItem?.config_estudio || {}
        const currentArquivos: any[] = Array.isArray(currentConfig.arquivos_originais) ? [...currentConfig.arquivos_originais] : []

        const newArquivoEntry = {
          id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          url: arquivoUrl,
          nome: file.name,
          tamanho: file.size,
          path: arquivoPath,
          id_requisicao: reqId || null,
          id_disciplina: discId || null,
          id_professor: profId || null,
          uploaded_at: new Date().toISOString()
        }

        const filteredArquivos = currentArquivos.filter((a: any) => {
          if (reqId && a.id_requisicao === reqId) return false
          if (discId && a.id_disciplina === discId && !a.id_requisicao) return false
          return true
        })
        filteredArquivos.push(newArquivoEntry)

        const updatedConfig = {
          ...currentConfig,
          arquivos_originais: filteredArquivos,
          arquivo_original_url: arquivoUrl,
          arquivo_original_nome: file.name,
          arquivo_original_tamanho: file.size,
          arquivo_original_path: arquivoPath,
          arquivo_original_uploaded_at: new Date().toISOString()
        }

        await supabaseAdmin.from(table).update({ config_estudio: updatedConfig, updated_at: new Date().toISOString() }).eq('id', itemId)
      }
    } catch (storageErr) {
      console.warn('[Storage upload warning]:', storageErr)
    }

    return NextResponse.json({
      success: true,
      totalQuestoes: questions.length,
      questoes: questions,
      arquivoUrl,
      arquivoNome,
      arquivoTamanho,
      arquivoPath,
      rawText: text.slice(0, 1000) + (text.length > 1000 ? `\n...[+${text.length - 1000} chars]` : ''),
    })
  } catch (e: any) {
    console.error('[SimuladosUpload Parse Error]', e)
    return NextResponse.json(
      { error: `Erro ao processar arquivo: ${e.message}` },
      { status: 500 }
    )
  }
}
