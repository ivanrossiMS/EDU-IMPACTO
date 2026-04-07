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
     if (aluno.email) {
        acc.push({
           id: `virtual-${aluno.id}`, // login/page.tsx usa .replace('virtual-', '')
           nome: aluno.nome,
           email: aluno.email,
           cargo: 'Aluno',
           perfil: 'Família',
           status: ['matriculado', 'ativo', 'em_cadastro', 'pendente'].includes(aluno.status?.toLowerCase()) ? 'ativo' : 'inativo',
           senha: aluno.dados?.senha || '',
           ultimoAcesso: 'Nunca'
        })
     }
     
     // 2. Criar Virtual User para o Responsável
     const respEmail = aluno.email || aluno.dados?.emailResponsavel || aluno.dados?.email_responsavel; 
     // obs: se o responsável tem o próprio email diferente do aluno, adicionamos:
     const realRespEmail = aluno.dados?.emailResponsavel || aluno.dados?.email_responsavel || (aluno.email_responsavel ? aluno.email_responsavel : null);
     
     if (realRespEmail) {
        const respNome = aluno.responsavel || `Responsável por ${aluno.nome}`;
        // Evita duplicar responsavel se já inserido
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
     
     return acc;
  }, []);

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
