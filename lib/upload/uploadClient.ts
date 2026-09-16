'use client'

// Retirado o import da Server Action generateSignedUploadUrl para evitar erros de registro no servidor

export interface UploadOptions {
  bucket: string
  folder?: string
  file: File
  /**
   * 'common' para imagens/anexos do dia a dia (cache: 30 dias)
   * 'fixed' para logos, avatares, assets estáticos (cache: 1 ano)
   */
  usageType: 'common' | 'fixed'
}

export interface UploadResult {
  ok: boolean
  url?: string
  path?: string
  error?: string
}

export function resolveMimeType(fileName: string, currentType?: string): string {
  if (currentType && currentType !== 'application/octet-stream' && currentType.trim() !== '') {
    return currentType
  }
  const ext = fileName.toLowerCase().split('.').pop() || ''
  const mimeMap: Record<string, string> = {
    // Imagens
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
    heic: 'image/heic',
    heif: 'image/heif',
    // Vídeos
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
    m4v: 'video/x-m4v',
    '3gp': 'video/3gpp',
    mkv: 'video/x-matroska',
    avi: 'video/x-msvideo',
    // Documentos
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }
  return mimeMap[ext] || 'application/octet-stream'
}

/**
 * Fallback transparente: envia o arquivo via rota de API servidora com autenticação e Service Role
 */
async function fallbackServerUpload(bucket: string, folder: string, file: File): Promise<UploadResult> {
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('bucket', bucket)
    formData.append('folder', folder)

    const res = await fetch('/api/upload-midia', {
      method: 'POST',
      body: formData
    })

    if (res.ok) {
      const data = await res.json()
      return {
        ok: true,
        url: data.url,
        path: data.path
      }
    } else {
      const errData = await res.json().catch(() => ({}))
      return {
        ok: false,
        error: errData.error || `Erro no servidor ao receber o arquivo (Status: ${res.status}).`
      }
    }
  } catch (err: any) {
    return {
      ok: false,
      error: err.message || 'Erro ao conectar ao servidor para envio do arquivo.'
    }
  }
}

/**
 * Função centralizada para upload de arquivos ao Supabase Storage.
 * Garante uso eficiente do Egress definindo o Cache-Control adequadamente
 * e evita timeouts ao usar URLs assinadas diretamente para o bucket,
 * com fallback automático para a rota de API caso o envio direto falhe.
 */
export async function uploadFileToSupabase({ bucket, folder = 'uploads', file, usageType }: UploadOptions): Promise<UploadResult> {
  try {
    // 0. Validação prévia de tamanho (100MB é o limite configurado no Supabase Storage)
    const MAX_BUCKET_SIZE = 100 * 1024 * 1024
    if (file.size > MAX_BUCKET_SIZE) {
      return {
        ok: false,
        error: `O arquivo "${file.name}" ultrapassa o limite máximo permitido de 100MB pelo servidor.`
      }
    }

    const mimeType = resolveMimeType(file.name, file.type)

    // 1. Obter URL assinada via API Route (evita UnrecognizedActionError do Next.js)
    const signRes = await fetch('/api/upload-midia/sign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ bucket, fileName: file.name, folder })
    })

    if (!signRes.ok) {
      const errData = await signRes.json().catch(() => ({}))
      console.warn('[uploadFileToSupabase] Falha ao obter URL assinada, tentando fallback:', errData.error)
      return await fallbackServerUpload(bucket, folder, file)
    }

    const signedRes = await signRes.json()

    // 2. Definir Cache-Control com base no uso
    const cacheControl = usageType === 'fixed' 
      ? 'max-age=31536000' // 1 ano para avatares, logos, etc.
      : 'max-age=2592000'  // 30 dias para comunicados, arquivos comuns

    // 3. Upload direto para o Supabase via PUT (usando a URL assinada)
    let directUploadOk = false
    let directError = ''

    try {
      const uploadRes = await fetch(signedRes.signedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': cacheControl
        }
      })

      if (uploadRes.ok) {
        directUploadOk = true
      } else {
        const errText = await uploadRes.text().catch(() => '')
        console.warn('[uploadFileToSupabase] Direct upload failed with status:', uploadRes.status, errText)

        if (uploadRes.status === 413 || errText.includes('EntityTooLarge') || errText.includes('exceeded the maximum')) {
          return { ok: false, error: `O arquivo "${file.name}" excede o limite máximo de 100MB suportado pelo servidor.` }
        }
        if (uploadRes.status === 415 || errText.includes('InvalidMimeType')) {
          directError = `Formato de mídia não suportado (${mimeType}).`
        }
      }
    } catch (netErr: any) {
      console.warn('[uploadFileToSupabase] Direct PUT fetch threw error (CORS/rede):', netErr)
    }

    if (directUploadOk) {
      return {
        ok: true,
        url: signedRes.publicUrl,
        path: signedRes.path
      }
    }

    // 4. Fallback automático transparente via rota servidora
    console.info('[uploadFileToSupabase] Tentando fallback para /api/upload-midia...')
    const fallbackResult = await fallbackServerUpload(bucket, folder, file)
    if (fallbackResult.ok) {
      return fallbackResult
    }

    return {
      ok: false,
      error: directError || fallbackResult.error || 'Falha no envio do arquivo ao servidor.'
    }
  } catch (err: any) {
    console.error('[uploadFileToSupabase] Unexpected error:', err)
    return { ok: false, error: err.message || 'Erro inesperado durante o upload.' }
  }
}
