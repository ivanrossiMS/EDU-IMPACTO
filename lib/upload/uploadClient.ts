import { generateSignedUploadUrl } from './uploadActions'

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
 * Função centralizada para upload de arquivos ao Supabase Storage.
 * Garante uso eficiente do Egress definindo o Cache-Control adequadamente
 * e evita timeouts ao usar URLs assinadas diretamente para o bucket.
 */
export async function uploadFileToSupabase({ bucket, folder = 'uploads', file, usageType }: UploadOptions): Promise<UploadResult> {
  try {
    // 1. Obter URL assinada
    const signedRes = await generateSignedUploadUrl(bucket, file.name, folder)

    if (signedRes.error || !signedRes.signedUrl) {
      console.error('[uploadFileToSupabase] Error getting signed URL:', signedRes.error)
      return { ok: false, error: signedRes.error || 'Erro ao preparar upload.' }
    }

    // 2. Definir Cache-Control com base no uso
    const cacheControl = usageType === 'fixed' 
      ? 'max-age=31536000' // 1 ano para avatares, logos, etc.
      : 'max-age=2592000'  // 30 dias para comunicados, arquivos comuns

    // 3. Upload direto para o Supabase via PUT (usando a URL assinada)
    const uploadRes = await fetch(signedRes.signedUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'Cache-Control': cacheControl,
        'x-upsert': 'false'
      }
    })

    if (!uploadRes.ok) {
      const errText = await uploadRes.text()
      console.error('[uploadFileToSupabase] Direct upload failed:', errText)
      return { ok: false, error: 'Falha no envio direto do arquivo ao servidor.' }
    }

    return {
      ok: true,
      url: signedRes.publicUrl,
      path: signedRes.path
    }
  } catch (err: any) {
    console.error('[uploadFileToSupabase] Unexpected error:', err)
    return { ok: false, error: err.message || 'Erro inesperado durante o upload.' }
  }
}
