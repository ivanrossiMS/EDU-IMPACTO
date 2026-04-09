import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data: sysUsers, error: sysErr } = await supabase.from('system_users').select('*')
  if (sysErr) return NextResponse.json({ error: sysErr.message }, { status: 500 })
  
  const mappedSys = sysUsers?.map(u => ({ ...u, ultimoAcesso: u.ultimoacesso || u.ultimoAcesso })) || []

  // Buscar alunos para prover acesso virtual à família/alunos
  const { data: alunosData } = await supabase.from('alunos').select('*')
  
  const mappedAlunos = (alunosData || []).reduce((acc: any[], aluno: any) => {
     // 1. Criar Virtual User para o Aluno
     const alunoEmail = (aluno.email || aluno.dados?.email || '').trim().toLowerCase()
     if (alunoEmail) {
        acc.push({
           id: `virtual-${aluno.id}`,
           nome: aluno.nome,
           email: alunoEmail,
           cargo: 'Aluno',
           perfil: 'Família',
           status: 'ativo',
           senha: aluno.dados?.senha || '',
           ultimoAcesso: 'Nunca'
        })
     }
     
     // 2. Criar Virtual User para o Responsável (email DIFERENTE do aluno)
     const realRespEmail = (
       aluno.dados?.emailResponsavel ||
       aluno.dados?.email_responsavel ||
       aluno.email_responsavel ||
       aluno.emailResponsavel ||
       aluno.dados?.responsaveis?.[0]?.email ||
       (Array.isArray(aluno.responsaveis) ? aluno.responsaveis[0]?.email : null)
     )?.trim().toLowerCase()
     
     // Só adicionar responsável se tiver email diferente do aluno
     if (realRespEmail && realRespEmail !== alunoEmail) {
        const respNome = aluno.responsavel || aluno.dados?.responsavel || `Responsável por ${aluno.nome}`
        if (!acc.some(u => u.email === realRespEmail)) {
           acc.push({
             id: `virtual-resp-${aluno.id}`, 
             nome: respNome,
             email: realRespEmail,
             cargo: 'Responsável',
             perfil: 'Família',
             status: 'ativo',
             senha: '',
             ultimoAcesso: 'Nunca'
           })
        }
     }
     
     return acc
  }, [])

  return NextResponse.json([...mappedSys, ...mappedAlunos])
}

export async function POST(req: Request) {
  const body = await req.json()
  
  const prepare = (b: any) => { 
     const out = { ...b }; 
     if ('ultimoAcesso' in out) { out.ultimoacesso = out.ultimoAcesso; delete out.ultimoAcesso; }
     return out;
  }

  // se for array faz upsert de tudo para evitar duplo POST no mesmo milisegundo (Next.js react bugs)
  if (Array.isArray(body)) {
      const fixedBody = body.map(prepare)
      const { data, error } = await supabase.from('system_users').upsert(fixedBody).select()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
  }
  
  // single upsert
  const fixedBody = prepare(body)
  const { data, error } = await supabase.from('system_users').upsert([fixedBody]).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
