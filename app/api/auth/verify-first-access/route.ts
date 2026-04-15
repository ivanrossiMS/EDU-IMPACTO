import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { query } = await request.json()
    
    if (!query) {
      return NextResponse.json({ error: 'E-mail, matrícula ou CPF obrigatório' }, { status: 400 })
    }

    const q = query.trim().toLowerCase()

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    // ── 1. Check system_users by email ──────────────────────────────
    const { data: sysUser } = await supabaseAdmin
      .from('system_users')
      .select('id, nome, email, cargo, perfil, status, senha_definida')
      .eq('email', q)
      .eq('status', 'ativo')
      .maybeSingle()
    
    if (sysUser) {
      if (sysUser.senha_definida === true) {
        return NextResponse.json({ 
          error: 'Sua senha já foi configurada. Use Login normal ou recuperação de senha.' 
        }, { status: 409 })
      }
      return NextResponse.json({ user: sysUser })
    }

    // ── 2. Check Supabase Auth for users with a prior login ─────────
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const authUser = listData?.users?.find((u: any) => u.email?.toLowerCase() === q)
    
    if (authUser?.last_sign_in_at) {
      return NextResponse.json({ 
        error: 'Sua senha já foi configurada. Use Login normal.' 
      }, { status: 409 })
    }

    // ── 3. Check ALUNOS — by email, matricula or CPF ────────────────
    const { data: alunosRows } = await supabaseAdmin
      .from('alunos')
      .select('id, nome, email, matricula, cpf, telefone, dados, status')

    const aluno = (alunosRows || []).find((a: any) => {
      const emailA   = (a.email || a.dados?.email || '').trim().toLowerCase()
      const matricA  = (a.matricula || a.dados?.codigo || '').trim().toLowerCase()
      const cpfA     = (a.cpf || '').replace(/\D/g, '')
      const qDigits  = q.replace(/\D/g, '')
      return (
        (emailA && emailA === q) ||
        (matricA && matricA === q) ||
        (cpfA && qDigits.length >= 11 && cpfA === qDigits)
      )
    })

    if (aluno) {
      const activeStatus = ['ativo', 'matriculado', 'cursando', 'ativo_transferencia']
      const isActive = !aluno.status || activeStatus.includes((aluno.status || '').toLowerCase())
      if (!isActive) {
        return NextResponse.json({ error: 'Matrícula inativa. Verifique com a secretaria.' }, { status: 403 })
      }

      // Check if student already set a password in Auth
      const matricula = aluno.matricula || aluno.dados?.codigo || aluno.id
      const virtualEmail = `aluno.${matricula}@impactoedu.local`
      const existingAuth = listData?.users?.find(
        (u: any) => u.email?.toLowerCase() === virtualEmail || u.email?.toLowerCase() === (aluno.email || '').toLowerCase()
      )
      if (existingAuth?.last_sign_in_at) {
        return NextResponse.json({ 
          error: 'Sua senha já foi configurada. Use Login normal com sua matrícula.' 
        }, { status: 409 })
      }

      return NextResponse.json({ 
        user: {
          id: `aluno-${aluno.id}`,
          realId: aluno.id,
          nome: aluno.nome,
          email: aluno.email || aluno.dados?.email || '',
          cargo: 'Aluno',
          perfil: 'Família',
          matricula: aluno.matricula || aluno.dados?.codigo || '',
          userType: 'aluno'
        }
      })
    }

    // ── 4. Check RESPONSAVEIS table — by email, CPF or celular ──────
    const { data: responsaveisRows } = await supabaseAdmin
      .from('responsaveis')
      .select('id, nome, email, cpf, celular, codigo')

    const responsavel = (responsaveisRows || []).find((r: any) => {
      const emailR   = (r.email || '').trim().toLowerCase()
      const cpfR     = (r.cpf || '').replace(/\D/g, '')
      const celR     = (r.celular || '').replace(/\D/g, '')
      const codigoR  = (r.codigo || '').trim().toLowerCase()
      const qDigits  = q.replace(/\D/g, '')
      return (
        (emailR && emailR === q) ||
        (cpfR && qDigits.length >= 11 && cpfR === qDigits) ||
        (celR && qDigits.length >= 10 && celR === qDigits) ||
        (codigoR && codigoR === q)
      )
    })

    if (responsavel) {
      const existingAuthResp = listData?.users?.find(
        (u: any) => u.email?.toLowerCase() === (responsavel.email || '').toLowerCase()
      )
      if (existingAuthResp?.last_sign_in_at) {
        return NextResponse.json({ 
          error: 'Sua senha já foi configurada. Use Login normal.' 
        }, { status: 409 })
      }
      return NextResponse.json({ 
        user: {
          id: `responsavel-${responsavel.id}`,
          realId: responsavel.id,
          nome: responsavel.nome,
          email: responsavel.email || '',
          cargo: 'Responsável',
          perfil: 'Família',
          userType: 'responsavel'
        }
      })
    }

    return NextResponse.json({ error: 'Nenhum cadastro encontrado. Verifique com a administração.' }, { status: 404 })
  } catch (err: any) {
    console.error('[API verify-first-access]', err)
    return NextResponse.json({ error: 'Erro interno na verificação' }, { status: 500 })
  }
}
