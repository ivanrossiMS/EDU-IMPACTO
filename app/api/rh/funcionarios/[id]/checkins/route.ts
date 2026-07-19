import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export async function GET(request: Request, context: any) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  // Using await on params to avoid next.js 15 sync access errors
  const params = await context.params;
  const funcionarioId = params.id;

  const supabase = getAdminClient()

  try {
    // 1. Fetch funcionario email
    const { data: func, error: funcError } = await supabase
      .from('funcionarios')
      .select('email')
      .eq('id', funcionarioId)
      .single()
      
    if (funcError || !func?.email) {
       return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })
    }

    // 2. Fetch system_user id from email
    const { data: sysUser, error: sysError } = await supabase
      .from('system_users')
      .select('id')
      .eq('email', func.email)
      .single()

    if (sysError || !sysUser?.id) {
       return NextResponse.json([]) // No checkins if no system access
    }

    // 3. Fetch checkins
    const { data: checkins, error: checkinsError } = await supabase
      .from('colaborador_checkin')
      .select('*')
      .eq('usuario_id', sysUser.id)
      .order('data_checkin', { ascending: false })

    if (checkinsError) {
      if (checkinsError.code === '42P01') {
         return NextResponse.json([]) // Table does not exist
      }
      throw checkinsError
    }

    return NextResponse.json(checkins || [])
  } catch (err: any) {
    console.error('Erro ao buscar histórico de checkin:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
