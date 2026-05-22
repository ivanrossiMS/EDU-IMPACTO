'use server'

import { createAdminClient } from '@/lib/server/supabaseServerFactory'

/**
 * Gera uma URL assinada para upload direto ao Supabase Storage.
 * Isso evita passar o arquivo pelo servidor Next.js, eliminando limites de tamanho e timeouts.
 */
export async function getSignedUploadUrlAction(fileName: string, bucket: string = 'comunicados-midia') {
  const supabase = createAdminClient()
  
  const safeBaseName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
  const filePath = `uploads/${Date.now()}_${safeBaseName}`

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(filePath)

    if (error) {
      console.error('[getSignedUploadUrlAction] Error:', error)
      return { error: error.message }
    }

    return {
      ok: true,
      token: data.token,
      path: data.path,
      signedUrl: data.signedUrl,
      // Retornamos o path para o cliente saber onde o arquivo ficou
      publicUrl: supabase.storage.from(bucket).getPublicUrl(filePath).data.publicUrl
    }
  } catch (e: any) {
    console.error('[getSignedUploadUrlAction] Unexpected:', e)
    return { error: e.message || 'Erro ao gerar URL de upload' }
  }
}
