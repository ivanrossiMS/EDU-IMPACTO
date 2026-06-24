import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createAdminClient } from '@/lib/server/supabaseServerFactory'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const { responsavelId, email, avatarUrl } = await request.json()

    if (!responsavelId || !avatarUrl) {
      return NextResponse.json({ error: 'Faltam parâmetros: responsavelId ou avatarUrl' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    // 1. Atualizar a tabela responsaveis (tentar atualizar a coluna 'foto', se falhar ignora e atualiza o jsonb 'dados')
    const { data: respData, error: fetchErr } = await supabaseAdmin.from('responsaveis').select('dados').eq('id', responsavelId).single()
    
    if (!fetchErr) {
      const novosDados = { ...(respData?.dados || {}), foto: avatarUrl }
      const { error: updErr } = await supabaseAdmin.from('responsaveis').update({ dados: novosDados }).eq('id', responsavelId)
      
      // Tentativa de update na coluna foto (caso ela exista)
      await supabaseAdmin.from('responsaveis').update({ foto: avatarUrl }).eq('id', responsavelId)
    }

    // 2. Sincronizar com a tabela system_users se o email for informado
    if (email) {
      const emailLower = email.trim().toLowerCase()
      await supabaseAdmin.from('system_users')
        .update({ foto: avatarUrl })
        .eq('email', emailLower)
        
      const { data: uData } = await supabaseAdmin.from('system_users').select('auth_id').eq('email', emailLower).single()
      if (uData?.auth_id) {
         await supabaseAdmin.auth.admin.updateUserById(uData.auth_id, {
           user_metadata: { foto: avatarUrl }
         })
      }
    }

    return NextResponse.json({ ok: true, message: 'Avatar atualizado com sucesso', avatarUrl })
  } catch (err: any) {
    console.error('[API responsaveis/avatar]', err)
    require('fs').writeFileSync('/tmp/avatar_err.log', String(err.stack || err.message))
    return NextResponse.json({ error: err.message || 'Erro inesperado', stack: err.stack, full: String(err) }, { status: 500 })
  }
}
