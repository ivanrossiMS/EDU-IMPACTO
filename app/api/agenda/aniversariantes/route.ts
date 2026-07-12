import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const supabase = await getAdminClient()
    const { searchParams } = new URL(request.url)
    const mes = searchParams.get('mes')

    if (!mes || isNaN(Number(mes))) {
      return NextResponse.json({ error: 'Mês inválido ou não informado' }, { status: 400 })
    }

    const mesStr = String(mes).padStart(2, '0')

    // Buscar alunos SEM foto
    const { data: alunosDB, error: errAlunos } = await supabase
      .from('alunos')
      .select('id, nome, turma, data_nascimento')
      .not('data_nascimento', 'is', null)

    if (errAlunos) throw errAlunos

    // Buscar funcionários
    const { data: profsDB, error: errProfs } = await supabase
      .from('funcionarios')
      .select('id, nome, data_nascimento')
      .not('data_nascimento', 'is', null)

    if (errProfs) throw errProfs

    const filterByMonth = (list: any[], type: string) => {
      return (list || []).filter(item => {
        if (!item.data_nascimento) return false;
        
        // Handle both YYYY-MM-DD and DD/MM/YYYY formats
        const hasDash = item.data_nascimento.includes('-');
        const hasSlash = item.data_nascimento.includes('/');
        let monthStr = null;
        
        if (hasDash) {
          const parts = item.data_nascimento.split('-');
          if (parts.length >= 2) monthStr = parts[1];
        } else if (hasSlash) {
          const parts = item.data_nascimento.split('/');
          if (parts.length >= 2) monthStr = parts[1];
        }
        
        return monthStr === mesStr;
      }).map(item => ({ ...item, tipo: type }));
    };

    const niversAlunos = filterByMonth(alunosDB, 'Aluno')
    const niversProfs = filterByMonth(profsDB, 'Colaborador')

    // Agora buscar a foto APENAS para os alunos aniversariantes deste mês
    const niversAlunosIds = niversAlunos.map(a => a.id)
    if (niversAlunosIds.length > 0) {
      const { data: fotos } = await supabase
        .from('alunos')
        .select('id, foto')
        .in('id', niversAlunosIds)
      
      if (fotos) {
        const fotoMap = new Map(fotos.map(f => [f.id, f.foto]))
        for (const aluno of niversAlunos) {
          aluno.foto = fotoMap.get(aluno.id) || null
        }
      }
    }

    const result = [
      ...niversAlunos,
      ...niversProfs
    ]

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=7200' }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
