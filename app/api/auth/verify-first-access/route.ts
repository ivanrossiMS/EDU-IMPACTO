import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Consistent with login/update-password: valid email must have TLD of >=2 chars
const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && !email.endsWith('@impactoedu.local')

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
    const { data: sysUserRows } = await supabaseAdmin
      .from('system_users')
      .select('id, nome, email, cargo, perfil, status, senha_definida')
      .eq('email', q)
      .eq('status', 'ativo')
      .limit(1)
    
    const sysUser = sysUserRows?.[0]
    
    if (sysUser) {
      const userPayload = {
        id: sysUser.id,
        realId: sysUser.id,
        nome: sysUser.nome,
        email: sysUser.email,
        cargo: sysUser.cargo,
        perfil: sysUser.perfil,
        userType: 'system_user'
      }

      if (sysUser.senha_definida === true) {
        return NextResponse.json({ 
          error: "Sua senha já foi configurada. Use o Login normal ou 'Esqueci minha senha' para receber um link por e-mail.",
          alreadyConfigured: true,
          user: userPayload
        }, { status: 409 })
      }
      return NextResponse.json({ user: userPayload })
    }

    // Helper: busca auth user por email
    const findAuthByEmail = async (email: string) => {
      let page = 1;
      while (page <= 5) {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 }).catch(() => ({ data: { users: [] } }))
        if (!list || !list.users || list.users.length === 0) break;
        const found = list.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase())
        if (found) return found;
        if (list.users.length < 1000) break;
        page++;
      }
      return null;
    }

    // ── 2. Check ALUNOS — by email, matricula or CPF ────────────────
    const safeQ = q.replace(/"/g, '""')
    const qDigits = q.replace(/\D/g, '')

    let orAlunos = `id.eq."${safeQ}",email.eq."${safeQ}",matricula.eq."${safeQ}",dados->>email.eq."${safeQ}",dados->>codigo.eq."${safeQ}"`
    if (qDigits.length >= 11) {
      orAlunos += `,cpf.eq."${qDigits}",dados->>cpf.eq."${qDigits}"`
    }

    const { data: alunosRows } = await supabaseAdmin
      .from('alunos')
      .select('id, nome, email, matricula, telefone, dados, status')
      .or(orAlunos)

    const aluno = (alunosRows || []).find((a: any) => {
      const emailA   = (a.email || a.dados?.email || '').trim().toLowerCase()
      const matricA  = (a.matricula || a.dados?.codigo || '').trim().toLowerCase()
      const idA      = (a.id || '').trim().toLowerCase()
      const cpfA     = (a.cpf || a.dados?.cpf || '').replace(/\D/g, '')
      const qDigits  = q.replace(/\D/g, '')
      return (
        (idA && idA === q) ||
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
      const storedAlunoEmail = (aluno.email || aluno.dados?.email || '').trim().toLowerCase()
      
      let existingAuth = await findAuthByEmail(virtualEmail)
      if (!existingAuth && isValidEmail(storedAlunoEmail)) {
        existingAuth = await findAuthByEmail(storedAlunoEmail)
      }
      if (!existingAuth && isValidEmail(q)) {
        existingAuth = await findAuthByEmail(q)
      }
      
      const authEmail = existingAuth?.email && isValidEmail(existingAuth.email) ? existingAuth.email : ''
      const finalAlunoEmail = storedAlunoEmail || authEmail || (isValidEmail(q) ? q : '')
      
      const userPayload = {
        id: `aluno-${aluno.id}`,
        realId: aluno.id,
        nome: aluno.nome,
        email: finalAlunoEmail,
        cargo: 'Aluno',
        perfil: 'Família',
        matricula: aluno.matricula || aluno.dados?.codigo || aluno.id || '',
        userType: 'aluno'
      }

      if (existingAuth) {
        return NextResponse.json({ 
          error: "Sua senha já foi configurada. Use o Login normal ou 'Esqueci minha senha' para receber um link por e-mail.",
          alreadyConfigured: true,
          user: userPayload
        }, { status: 409 })
      }

      return NextResponse.json({ 
        user: userPayload
      })
    }

    // ── 3. Check RESPONSAVEIS table — by email, CPF or celular ──────
    let orResp = `email.eq."${safeQ}",codigo.eq."${safeQ}"`
    if (qDigits.length >= 10) {
      orResp += `,celular.ilike.%${qDigits}%,telefone.ilike.%${qDigits}%`
    }
    if (qDigits.length >= 11) {
      orResp += `,cpf.eq."${qDigits}",dados->>cpf.eq."${qDigits}"`
    }

    const { data: responsaveisRows } = await supabaseAdmin
      .from('responsaveis')
      .select('id, nome, email, celular, codigo, telefone, dados')
      .or(orResp)

    const responsavel = (responsaveisRows || []).find((r: any) => {
      const emailR   = (r.email || '').trim().toLowerCase()
      const cpfR     = (r.cpf || r.dados?.cpf || '').replace(/\D/g, '')
      const celR     = (r.celular || r.telefone || '').replace(/\D/g, '')
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
      // ── Verify if they are Financeiro or Pedagogico ────────────────
      const { data: links } = await supabaseAdmin
        .from('aluno_responsavel')
        .select('resp_financeiro, resp_pedagogico')
        .eq('responsavel_id', responsavel.id)

      const isAllowed = (links || []).some(
        (l: any) => l.resp_financeiro === true || l.resp_pedagogico === true
      )

      if (!isAllowed) {
        return NextResponse.json({ 
          error: 'Acesso não autorizado. Apenas responsáveis Financeiro ou Pedagógico possuem login no sistema.' 
        }, { status: 403 })
      }

      const storedRespEmail = (responsavel.email || '').trim().toLowerCase()
      const finalRespEmail = storedRespEmail || (isValidEmail(q) ? q : '')

      const userPayload = {
        id: `responsavel-${responsavel.id}`,
        realId: responsavel.id,
        nome: responsavel.nome,
        email: finalRespEmail,
        cargo: 'Responsável',
        perfil: 'Família',
        userType: 'responsavel'
      }

      const emailToCheck = finalRespEmail || responsavel.email
      if (emailToCheck) {
        const existingAuthResp = await findAuthByEmail(emailToCheck.trim())
        if (existingAuthResp) {
          return NextResponse.json({ 
            error: "Sua senha já foi configurada. Use o Login normal ou 'Esqueci minha senha' para receber um link por e-mail.",
            alreadyConfigured: true,
            user: userPayload
          }, { status: 409 })
        }
      }
      return NextResponse.json({ 
        user: userPayload
      })
    }

    return NextResponse.json({ error: 'Nenhum cadastro ativo encontrado.' }, { status: 404 })
  } catch (err: any) {
    console.error('[API verify-first-access]', err)
    return NextResponse.json({ error: 'Erro interno na verificação' }, { status: 500 })
  }
}
