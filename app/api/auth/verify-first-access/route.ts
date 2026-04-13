import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { query } = await request.json()
    
    if (!query) {
      return NextResponse.json({ error: 'E-mail obrigatório' }, { status: 400 })
    }

    const q = query.trim().toLowerCase()

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    // 1. Check system_users — include senha_definida flag
    const { data: sysUser } = await supabaseAdmin
      .from('system_users')
      .select('id, nome, email, cargo, perfil, status, senha_definida')
      .eq('email', q)
      .eq('status', 'ativo')
      .single()
    
    if (sysUser) {
      // Prevent repeated first-access: if password already defined, block
      if (sysUser.senha_definida === true) {
        return NextResponse.json({ 
          error: 'Sua senha já foi configurada. Use a opção de Login normal ou recuperação de senha.' 
        }, { status: 409 })
      }
      return NextResponse.json({ user: sysUser })
    }

    // 2. Also check Supabase Auth directly — if user already signed in before, they have a password
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const authUser = listData?.users?.find((u: any) => u.email?.toLowerCase() === q)
    
    if (authUser?.last_sign_in_at) {
      // User has logged in before — password already set
      return NextResponse.json({ 
        error: 'Sua senha já foi configurada. Use a opção de Login normal.' 
      }, { status: 409 })
    }

    // 3. Check alunos for virtual/family users
    const { data: alunos } = await supabaseAdmin
      .from('alunos')
      .select('id, nome, email, dados, status_matricula')
    const aluno = (alunos || []).find((a: any) => 
      (a.email || a.dados?.email || '').trim().toLowerCase() === q
    )
    if (aluno && (aluno.status_matricula === 'ativo' || !aluno.status_matricula)) {
      return NextResponse.json({ 
        user: {
          id: `virtual-${aluno.id}`,
          nome: aluno.nome,
          email: q,
          cargo: 'Aluno',
          perfil: 'Família'
        }
      })
    }

    return NextResponse.json({ error: 'Nenhum cadastro encontrado. Verifique com a administração.' }, { status: 404 })
  } catch (err: any) {
    console.error('[API verify-first-access]', err)
    return NextResponse.json({ error: 'Erro interno na verificação' }, { status: 500 })
  }
}
