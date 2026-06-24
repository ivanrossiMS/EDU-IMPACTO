import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const memCache = new Map<string, { value: any, timestamp: number }>();
const CACHE_TTL = 300_000; // 5 minutos

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const supabase = await createProtectedClient()
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')
    const responsavel_id = searchParams.get('responsavel_id')
    const isAlunoProfile = searchParams.get('is_aluno_profile') === 'true'

    if (!slug) {
      return NextResponse.json({ error: 'Slug do aluno é obrigatório' }, { status: 400 })
    }

    const cacheKey = `${user.id}-${slug}-${responsavel_id}-${isAlunoProfile}`;
    const cached = memCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
       return NextResponse.json(cached.value, {
         headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' }
       })
    }

    // 1. Buscar os dados essenciais do aluno
    const { data: aluno, error: errorAluno } = await supabase
      .from('alunos')
      .select('id, nome, foto, turma, turno, status, matricula, dados')
      .eq('id', slug)
      .maybeSingle()

    if (errorAluno) {
      console.error('Erro buscando aluno:', errorAluno)
      return NextResponse.json({ error: 'Erro ao buscar aluno' }, { status: 500 })
    }

    if (!aluno) {
      return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 })
    }

    // 1.5. Resolver nome e turno da Turma
    if (aluno.turma) {
       const { data: turmaData } = await supabase
         .from('turmas')
         .select('nome, turno')
         .or(`id.eq."${aluno.turma}",codigo.eq."${aluno.turma}",nome.eq."${aluno.turma}"`)
         .maybeSingle()
       
       if (turmaData) {
         if (turmaData.nome) (aluno as any).turma_nome = turmaData.nome
         if (turmaData.turno) (aluno as any).turno_nome = turmaData.turno
       } else {
         (aluno as any).turma_nome = aluno.turma
       }
    } else {
       (aluno as any).turma_nome = 'S/T'
    }

    // 2. Buscar vínculos do aluno
    let vinculo = null;
    let responsaveisDb: any[] = [];
    let meusAlunos: any[] = [];
    
    if (isAlunoProfile) {
       vinculo = {
         parentesco: 'Próprio Aluno',
         resp_financeiro: false,
         resp_pedagogico: false
       }
       meusAlunos = [aluno]
    } else {
       // Sempre buscar os responsáveis do aluno para ter os dados de restrição atualizados, independente de quem acessa
       const { data: links, error: linkError } = await supabase
         .from('aluno_responsavel')
         .select('parentesco, resp_financeiro, resp_pedagogico, responsaveis!fk_ar_responsavel(id, nome, email, rfid, dias_acesso, proibido, dados)')
         .eq('aluno_id', slug)
         
       if (!linkError && links && links.length > 0) {
         if (responsavel_id) {
           const meuVinculo = links.find((l: any) => l.responsaveis?.id === responsavel_id || (Array.isArray(l.responsaveis) && l.responsaveis[0]?.id === responsavel_id));
           if (meuVinculo) {
             vinculo = {
               parentesco: meuVinculo.parentesco,
               resp_financeiro: meuVinculo.resp_financeiro,
               resp_pedagogico: meuVinculo.resp_pedagogico
             }
           }
         }
         
         responsaveisDb = links.map((l: any) => {
            const resp = Array.isArray(l.responsaveis) ? l.responsaveis[0] : l.responsaveis;
            return {
              id: resp?.id,
              nome: resp?.nome,
              email: resp?.email,
              parentesco: l.parentesco,
              resp_financeiro: l.resp_financeiro,
              resp_pedagogico: l.resp_pedagogico,
              dias_acesso: resp?.dias_acesso || resp?.dados?.diasPermitidos || resp?.dados?.dias_acesso || resp?.dados?.diasAcesso || resp?.dados?.diasSemana || [],
              proibido: resp?.proibido === true || resp?.dados?.proibido === true,
              dados: resp?.dados || {}
            };
         });
       }

        if (responsavel_id) {
          // 3. Buscar todos os alunos vinculados a esse responsável (para o Switcher)
          const { data: meusLinks } = await supabase
            .from('aluno_responsavel')
            .select('alunos(*)')
            .eq('responsavel_id', responsavel_id)
          
          if (meusLinks && meusLinks.length > 0) {
            meusAlunos = meusLinks.map((l: any) => l.alunos).filter(Boolean)

            // Populate turma_nome for meusAlunos
            const turmaIds = [...new Set(meusAlunos.map(a => a.turma).filter(Boolean))]
            if (turmaIds.length > 0) {
              const { data: turmasData } = await supabase
                .from('turmas')
                .select('id, codigo, nome')
                .in('id', turmaIds)
              
              if (turmasData) {
                meusAlunos.forEach(a => {
                  const tData = turmasData.find(t => String(t.id) === String(a.turma) || String(t.codigo) === String(a.turma))
                  if (tData && tData.nome) {
                    a.turma_nome = tData.nome
                  } else {
                    a.turma_nome = a.turma
                  }
                })
              }
            }
          }
        }
    }

    const result = {
      aluno: { ...aluno, responsaveis: responsaveisDb },
      vinculo: vinculo,
      meusAlunos: meusAlunos
    };

    memCache.set(cacheKey, { value: result, timestamp: Date.now() });

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' }
    })

  } catch (e: any) {
    console.error('Perfil Acesso API Error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
