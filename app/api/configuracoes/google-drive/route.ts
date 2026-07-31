import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 120  // 2 min para chunked uploads grandes

/**
 * API Route para Upload REAL no Google Drive
 *
 * MODO 1 — Upload de arquivo binário (ZIP, XLSX) via body bruto + headers:
 *   Headers: X-Action: upload, X-Webhook-Url, X-File-Name, X-Folder-Path, X-Mime-Type
 *   Body: arquivo binário bruto
 *
 * MODO 2 — Teste de conexão / texto simples:
 *   Content-Type: application/json
 *   Body: JSON com action, webhookUrl, accessToken, etc.
 */

const CHUNK_SIZE_BYTES = 1 * 1024 * 1024 // 1MB por chunk (seguro para Apps Script + Drive temp files)

/**
 * Envia o arquivo em chunks para o Google Apps Script.
 * Cada chunk tem ~3MB de base64. O Apps Script monta e grava ao receber o último.
 */
async function uploadChunked(
  webhookUrl: string,
  fileName: string,
  folderName: string,
  mimeType: string,
  fileBase64: string
): Promise<{ success: boolean; fileUrl?: string; fileId?: string; error?: string }> {
  // Dividir base64 em pedaços de 3MB
  const chunks: string[] = []
  for (let i = 0; i < fileBase64.length; i += CHUNK_SIZE_BYTES) {
    chunks.push(fileBase64.slice(i, i + CHUNK_SIZE_BYTES))
  }

  const totalChunks = chunks.length
  const totalMB = (fileBase64.length * 0.75 / (1024 * 1024)).toFixed(2)
  console.log(`[Drive Chunked] Arquivo: ${fileName} | ~${totalMB} MB | ${totalChunks} chunks de 3MB`)

  let lastResponse: any = {}

  for (let i = 0; i < totalChunks; i++) {
    const isLast = i === totalChunks - 1

    const chunkPayload = JSON.stringify({
      action: 'uploadChunk',
      fileName,
      folderName,
      mimeType,
      chunkIndex: i,
      totalChunks,
      isLastChunk: isLast,
      chunkBase64: chunks[i],
      timestamp: new Date().toISOString()
    })

    console.log(`[Drive Chunked] Enviando chunk ${i + 1}/${totalChunks} (${Math.round(chunkPayload.length / 1024)} KB)...`)

    const res = await fetch(webhookUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: chunkPayload
    })

    const rawText = await res.text()
    let data: any = {}
    try { data = JSON.parse(rawText) } catch { data = { rawResponse: rawText } }

    console.log(`[Drive Chunked] Chunk ${i + 1} status: ${res.status} | resp: ${rawText.substring(0, 200)}`)

    if (data.success === false) {
      return { success: false, error: data.error || `Erro no chunk ${i + 1}` }
    }

    lastResponse = data
    // Pequena pausa entre chunks para não sobrecarregar
    if (!isLast) await new Promise(r => setTimeout(r, 200))
  }

  return {
    success: true,
    fileUrl: lastResponse.fileUrl,
    fileId: lastResponse.fileId
  }
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || ''

    // ─── MODO 1: Upload de arquivo binário via headers + body bruto ───
    const xAction = req.headers.get('x-action') || ''
    if (xAction === 'upload') {
      const webhookUrl  = (req.headers.get('x-webhook-url')  || '').trim()
      const accessToken = (req.headers.get('x-access-token') || '').trim()
      const fileName    = req.headers.get('x-file-name')    || `backup_impacto_edu_${Date.now()}.zip`
      const folderPath  = req.headers.get('x-folder-path')  || 'EDU-IMPACTO-Backups'
      const mimeType    = req.headers.get('x-mime-type')     || 'application/zip'

      const cleanFolderName = folderPath.replace(/^\/|\/$/g, '').replace(/[\/\\]/g, '-') || 'EDU-IMPACTO-Backups'

      const fileArrayBuffer = await req.arrayBuffer()
      const fileBuffer = Buffer.from(fileArrayBuffer)
      const fileBase64 = fileBuffer.toString('base64')
      const fileSizeMB = (fileBuffer.byteLength / (1024 * 1024)).toFixed(2)

      console.log(`[Drive Upload] Arquivo: ${fileName} | ${fileSizeMB} MB | Base64: ${Math.round(fileBase64.length / 1024)} KB`)

      // ── Opção A: OAuth2 Google Drive API direta ──
      if (accessToken) {
        try {
          let folderId = 'root'
          const searchRes = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(cleanFolderName)}'+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&fields=files(id,name)`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          )
          if (searchRes.ok) {
            const sd = await searchRes.json()
            if (sd.files?.length > 0) {
              folderId = sd.files[0].id
            } else {
              const cr = await fetch('https://www.googleapis.com/drive/v3/files', {
                method: 'POST',
                headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: cleanFolderName, mimeType: 'application/vnd.google-apps.folder' })
              })
              if (cr.ok) folderId = (await cr.json()).id
            }
          }

          const meta = { name: fileName, parents: [folderId] }
          const boundary = '-------ImpactoEduBoundary2024'
          const bodyStr =
            `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
            JSON.stringify(meta) +
            `\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n` +
            fileBase64 +
            `\r\n--${boundary}--`

          const uploadRes = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
            {
              method: 'POST',
              headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
              body: bodyStr
            }
          )

          if (uploadRes.ok) {
            const f = await uploadRes.json()
            return NextResponse.json({
              success: true,
              driveUrl: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
              fileId: f.id,
              fileName,
              uploadedAt: new Date().toLocaleString('pt-BR'),
              message: `Arquivo '${fileName}' criado com SUCESSO no Google Drive!`
            })
          }
          const err = await uploadRes.json()
          return NextResponse.json({ success: false, error: err.error?.message || 'Erro no upload OAuth2' }, { status: 400 })
        } catch (e: any) {
          return NextResponse.json({ success: false, error: e.message }, { status: 500 })
        }
      }

      // ── Opção B: Google Apps Script Webhook via Chunking ──
      if (webhookUrl) {
        try {
          const result = await uploadChunked(webhookUrl, fileName, cleanFolderName, mimeType, fileBase64)

          if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: 500 })
          }

          return NextResponse.json({
            success: true,
            driveUrl: result.fileUrl || null,
            fileId: result.fileId || null,
            fileName,
            uploadedAt: new Date().toLocaleString('pt-BR'),
            message: result.fileUrl
              ? `Arquivo '${fileName}' criado com SUCESSO na pasta '${cleanFolderName}'!`
              : `Arquivo '${fileName}' enviado com SUCESSO via Apps Script!`
          })
        } catch (e: any) {
          console.error('[Drive Chunked] Erro:', e)
          return NextResponse.json({ success: false, error: `Erro no upload: ${e.message}` }, { status: 500 })
        }
      }

      return NextResponse.json({
        success: false,
        error: 'Forneça X-Webhook-Url ou X-Access-Token para realizar o upload.'
      }, { status: 400 })
    }

    // ─── MODO 2: JSON — teste de conexão / upload de texto ───
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ success: false, error: 'Use application/json ou envie arquivo binário com X-Action: upload.' }, { status: 415 })
    }

    const rawText = await req.text()
    if (!rawText) return NextResponse.json({ success: false, error: 'Body vazio' }, { status: 400 })

    let body: any
    try { body = JSON.parse(rawText) } catch {
      return NextResponse.json({ success: false, error: 'JSON inválido no body' }, { status: 400 })
    }

    const { action, accessToken, webhookUrl, folderPath, fileName, fileContentBase64, fileTextContent, mimeType } = body
    const cleanWebhookUrl  = webhookUrl   ? String(webhookUrl).trim()  : ''
    const cleanAccessToken = accessToken  ? String(accessToken).trim() : ''
    const rawFolder = folderPath || 'EDU-IMPACTO-Backups'
    const cleanFolderName = rawFolder.replace(/^\/|\/$/g, '').replace(/[\/\\]/g, '-') || 'EDU-IMPACTO-Backups'

    // ── Testar conexão ──
    if (action === 'test') {
      if (cleanAccessToken) {
        try {
          const driveRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=user,storageQuota', {
            headers: { Authorization: `Bearer ${cleanAccessToken}` }
          })
          if (driveRes.ok) {
            const data = await driveRes.json()
            return NextResponse.json({
              success: true,
              message: `Autenticado com sucesso! Conta: ${data.user?.emailAddress}`,
              email: data.user?.emailAddress,
              name: data.user?.displayName
            })
          }
          const err = await driveRes.json()
          return NextResponse.json({ success: false, error: err.error?.message || 'Token inválido' }, { status: 401 })
        } catch (e: any) {
          return NextResponse.json({ success: false, error: e.message }, { status: 500 })
        }
      }

      if (cleanWebhookUrl) {
        try {
          const res = await fetch(cleanWebhookUrl, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'test', folderName: cleanFolderName, timestamp: new Date().toISOString() })
          })
          const txt = await res.text()
          let data: any = {}
          try { data = JSON.parse(txt) } catch { data = {} }
          return NextResponse.json({
            success: true,
            message: data.message || 'Conexão com Google Drive testada com SUCESSO!',
            email: data.email || 'Conta Google Conectada'
          })
        } catch (e: any) {
          return NextResponse.json({
            success: false,
            error: `Falha: ${e.message}. Verifique se o WebApp está publicado como "Qualquer pessoa".`
          }, { status: 500 })
        }
      }
      return NextResponse.json({ success: false, error: 'Nenhum método de autenticação fornecido.' }, { status: 400 })
    }

    // ── Upload de arquivo de texto simples via JSON (ex: .txt) ──
    if (action === 'upload') {
      const targetName = fileName || `backup_impacto_edu_${Date.now()}.txt`
      const targetMime = mimeType || 'text/plain'

      if (cleanWebhookUrl) {
        const requestBody = JSON.stringify({
          action: 'upload',
          fileName: targetName,
          folderName: cleanFolderName,
          fileContentBase64: fileContentBase64 || '',
          fileTextContent: fileTextContent || '',
          mimeType: targetMime,
          timestamp: new Date().toISOString()
        })
        try {
          const scriptRes = await fetch(cleanWebhookUrl, {
            method: 'POST', redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: requestBody
          })
          const textRes = await scriptRes.text()
          let scriptData: any = {}
          try { scriptData = JSON.parse(textRes) } catch { scriptData = {} }

          if (scriptData.success === false) {
            return NextResponse.json({ success: false, error: scriptData.error || 'Apps Script retornou erro' }, { status: 500 })
          }
          return NextResponse.json({
            success: true,
            driveUrl: scriptData.fileUrl || null,
            fileName: targetName,
            uploadedAt: new Date().toLocaleString('pt-BR'),
            message: `Arquivo '${targetName}' enviado com SUCESSO!`
          })
        } catch (e: any) {
          return NextResponse.json({ success: false, error: `Erro Apps Script: ${e.message}` }, { status: 500 })
        }
      }
      return NextResponse.json({ success: false, error: 'Webhook URL não fornecida.' }, { status: 400 })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })

  } catch (error: any) {
    console.error('[Google Drive API] Erro interno:', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}
