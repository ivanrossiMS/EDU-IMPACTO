'use client'

import { supabase } from '@/lib/supabase'
import { apiFetch } from '@/lib/api/apiClient'
import { resolveMimeType } from './mimeUtils'

// Re-exporta para manter 100% de compatibilidade reversa com arquivos clientes existentes
export { resolveMimeType } from './mimeUtils'

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

/**
 * Fallback transparente: envia o arquivo via rota de API servidora com autenticação e Service Role
 */
async function fallbackServerUpload(
  bucket: string,
  folder: string,
  file: File,
  usageType: 'common' | 'fixed' = 'common'
): Promise<UploadResult> {
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('bucket', bucket)
    formData.append('folder', folder)
    formData.append('usageType', usageType)

    const res = await apiFetch('/api/upload-midia', {
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
export async function uploadFileToSupabase({
  bucket,
  folder = 'uploads',
  file,
  usageType
}: UploadOptions): Promise<UploadResult> {
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

    // 1. Obter URL assinada via API Route (com Bearer token via apiFetch)
    const signRes = await apiFetch('/api/upload-midia/sign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ bucket, fileName: file.name, folder })
    })

    if (!signRes.ok) {
      const errData = await signRes.json().catch(() => ({}))
      console.warn('[uploadFileToSupabase] Falha ao obter URL assinada, tentando fallback:', errData.error)
      return await fallbackServerUpload(bucket, folder, file, usageType)
    }

    const signedRes = await signRes.json()

    // 2. Definir Cache-Control com base no uso (em segundos para Supabase)
    const cacheControlSeconds = usageType === 'fixed'
      ? '31536000' // 1 ano para avatares, logos, etc.
      : '2592000'  // 30 dias para comunicados, arquivos comuns

    // 3. Upload direto para o Supabase Storage via URL assinada
    let directUploadOk = false
    let directError = ''

    // 3.1 Tentativa prioritária: SDK Supabase oficial (monta FormData correto e evita cabeçalhos customizados que causam CORS)
    try {
      if (signedRes.token && signedRes.path) {
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from(bucket)
          .uploadToSignedUrl(signedRes.path, signedRes.token, file, {
            cacheControl: cacheControlSeconds,
            contentType: mimeType,
            upsert: false
          })

        if (!uploadErr && uploadData) {
          directUploadOk = true
        } else if (uploadErr) {
          console.warn('[uploadFileToSupabase] SDK uploadToSignedUrl falhou:', uploadErr.message)
          directError = uploadErr.message
        }
      }
    } catch (sdkErr: any) {
      console.warn('[uploadFileToSupabase] Exceção no SDK uploadToSignedUrl:', sdkErr)
    }

    // 3.2 Tentativa secundária: Se o SDK falhou mas há URL assinada direta, tentar via FormData PUT nativo
    if (!directUploadOk && signedRes.signedUrl) {
      try {
        const formBody = new FormData()
        formBody.append('cacheControl', cacheControlSeconds)
        formBody.append('', file)

        const uploadRes = await fetch(signedRes.signedUrl, {
          method: 'PUT',
          body: formBody
        })

        if (uploadRes.ok) {
          directUploadOk = true
        } else {
          const errText = await uploadRes.text().catch(() => '')
          console.warn('[uploadFileToSupabase] Direct FormData PUT falhou:', uploadRes.status, errText)
          if (uploadRes.status === 413 || errText.includes('EntityTooLarge') || errText.includes('exceeded the maximum')) {
            return { ok: false, error: `O arquivo "${file.name}" excede o limite máximo de 100MB suportado pelo servidor.` }
          }
          if (uploadRes.status === 415 || errText.includes('InvalidMimeType')) {
            directError = `Formato de mídia não suportado (${mimeType}).`
          }
        }
      } catch (putErr: any) {
        console.warn('[uploadFileToSupabase] Exceção no Direct FormData PUT:', putErr)
      }
    }

    if (directUploadOk) {
      return {
        ok: true,
        url: signedRes.publicUrl,
        path: signedRes.path
      }
    }

    // 4. Fallback automático transparente via rota servidora (com apiFetch e Service Role)
    console.info('[uploadFileToSupabase] Tentando fallback para /api/upload-midia...')
    const fallbackResult = await fallbackServerUpload(bucket, folder, file, usageType)
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
