'use server'

import { createAdminClient } from '@/lib/server/supabaseServerFactory'

/**
 * Gera uma URL assinada para upload da foto de perfil.
 */
export async function getProfileUploadUrlAction(userId: string, fileName: string) {
  const supabase = createAdminClient()
  
  const ext = fileName.split('.').pop() || 'jpg'
  const filePath = `avatars/${userId}_${Date.now()}.${ext}`

  try {
    const { data, error } = await supabase.storage
      .from('comunicados-midia') // Reusando o bucket existente por simplicidade, ou use um 'perfis' se existir
      .createSignedUploadUrl(filePath)

    if (error) return { error: error.message }

    return {
      ok: true,
      signedUrl: data.signedUrl,
      publicUrl: supabase.storage.from('comunicados-midia').getPublicUrl(filePath).data.publicUrl
    }
  } catch (e: any) {
    return { error: e.message }
  }
}

/**
 * Atualiza a foto do usuário no Auth Metadata e na tabela system_users.
 */
export async function updateProfilePhotoAction(userId: string, fotoUrl: string) {
  const supabase = createAdminClient()

  try {
    // 1. Atualizar Auth Metadata
    const { error: authErr } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { foto: fotoUrl }
    })
    if (authErr) console.warn('[updateProfilePhotoAction] Auth update warning:', authErr.message)

    // 2. Atualizar tabela system_users
    // Tenta salvar em uma coluna 'foto' ou dentro de 'dados'
    const { error: dbErr } = await supabase
      .from('system_users')
      .update({ foto: fotoUrl })
      .eq('id', userId)
    
    if (dbErr) {
      // Se a coluna 'foto' não existir, salva dentro do JSONB 'dados' sem sobrescrever o resto
      const { data: current } = await supabase
        .from('system_users')
        .select('dados')
        .eq('id', userId)
        .single()
      
      const newDados = { ...(current?.dados || {}), foto: fotoUrl }
      
      await supabase
        .from('system_users')
        .update({ dados: newDados })
        .eq('id', userId)
    }

    return { ok: true }
  } catch (e: any) {
    return { error: e.message }
  }
}
