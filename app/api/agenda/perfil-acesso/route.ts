import { NextResponse } from 'next/server'
import { resolveUserRole } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseServerFactory'
import { isAlunoIntegralIntermediario } from '@/lib/studentTurmaUtils'
import { getCachedTurmasAndGrupos } from '@/lib/server/turmasGruposCache'
import { getPerfilAcessoCache, setPerfilAcessoCache, CACHE_TTL } from '@/lib/server/perfilAcessoCache'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const { user, dbUser, isStaff, isFamilyOrStudent, errorResponse } = await resolveUserRole(request)
  if (errorResponse || !user) return errorResponse || NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const authHeader = request.headers.get('authorization') || ''
    const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.substring(7).trim() : undefined
    const supabase = await createProtectedClient(bearerToken)
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')
    const responsavel_id = searchParams.get('responsavel_id')
    const isAlunoProfile = searchParams.get('is_aluno_profile') === 'true'

    if (!slug) {
      return NextResponse.json({ error: 'Slug do aluno é obrigatório' }, { status: 400 })
    }

    // Slugs não-numéricos como 'colaborador', 'admin' etc. nunca serão IDs de aluno.
    // Retornar resposta vazia em vez de 404 para evitar erros desnecessários no log.
    const slugIsLikelyNumericId = /^\d+$/.test(slug) || /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(slug)
    if (!slugIsLikelyNumericId) {
      return NextResponse.json({ aluno: null, vinculo: null, meusAlunos: [] }, {
        headers: { 'Cache-Control': 'private, max-age=300' }
      })
    }

    const cacheKey = `${user.id}-${slug}-${responsavel_id}-${isAlunoProfile}`;
    const cached = getPerfilAcessoCache(cacheKey);
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
      // Retornar 200 com null em vez de 404 para evitar erros no console do cliente
      return NextResponse.json({ aluno: null, vinculo: null, meusAlunos: [] })
    }

    // 1.5. Resolver nome e turno da Turma e Modalidade Integral via cache
    const { allTurmas, allGrupos } = await getCachedTurmasAndGrupos()
    let allTurmasDbData: any[] = allTurmas || []
    let allGruposDbData: any[] = allGrupos || []

    if (aluno.turma) {
       const turmaData = (allTurmas || []).find((t: any) => 
         String(t.id) === String(aluno.turma) || 
         String(t.codigo) === String(aluno.turma) || 
         t.nome === aluno.turma
       )
       
       if (turmaData) {
         if (turmaData.nome) (aluno as any).turma_nome = turmaData.nome
         if (turmaData.turno) (aluno as any).turno_nome = turmaData.turno
       } else {
         (aluno as any).turma_nome = aluno.turma
       }
    } else {
       (aluno as any).turma_nome = 'S/T'
    }

    if (isAlunoIntegralIntermediario(aluno, allTurmasDbData, allGruposDbData)) {
      (aluno as any).turno_nome = 'Integral/Intermediário';
      (aluno as any).turno = 'Integral/Intermediário';
    }

    // 2. Buscar vínculos do aluno
    let vinculo = null;
    let responsaveisDb: any[] = [];
    let meusAlunos: any[] = [];
    
    const { data: links, error: linkError } = await supabase
      .from('aluno_responsavel')
      .select('parentesco, resp_financeiro, resp_pedagogico, responsaveis!fk_ar_responsavel(id, nome, email, rfid, dias_acesso, proibido, dados)')
      .eq('aluno_id', slug)

    if (!linkError && links && links.length > 0) {
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

    // Validação de isolamento familiar (anti-IDOR): se não for staff, precisa ter vínculo legítimo com o aluno
    if (!isStaff && isFamilyOrStudent) {
      const userEmail = String(user.email || dbUser?.email || '').trim().toLowerCase()
      const candidateIds = new Set(
        [
          String(user.id),
          user.user_metadata?.uid_legacy ? String(user.user_metadata.uid_legacy) : null,
          user.user_metadata?.aluno_id ? String(user.user_metadata.aluno_id) : null,
          user.user_metadata?.responsavel_id ? String(user.user_metadata.responsavel_id) : null,
          dbUser?.id ? String(dbUser.id) : null,
          dbUser?.dados?.aluno_id ? String(dbUser.dados.aluno_id) : null,
          dbUser?.dados?.responsavel_id ? String(dbUser.dados.responsavel_id) : null,
        ].filter(Boolean) as string[]
      )

      const isOwnStudentAccount =
        candidateIds.has(String(aluno.id)) ||
        (aluno.matricula && candidateIds.has(String(aluno.matricula))) ||
        (userEmail && String(aluno.dados?.email || '').trim().toLowerCase() === userEmail) ||
        (userEmail && userEmail === `${String(aluno.id).toLowerCase()}@impacto.edu.br`) ||
        (aluno.matricula && userEmail === `${String(aluno.matricula).toLowerCase()}@impacto.edu.br`)

      const isLinkedGuardian =
        responsaveisDb.some((r: any) =>
          (r.id && candidateIds.has(String(r.id))) ||
          (userEmail && r.email && String(r.email).trim().toLowerCase() === userEmail)
        ) ||
        (Array.isArray(aluno.dados?.responsaveis) &&
          aluno.dados.responsaveis.some((r: any) =>
            (r?.id && candidateIds.has(String(r.id))) ||
            (userEmail && r?.email && String(r.email).trim().toLowerCase() === userEmail)
          ))

      let isGuardianByEmailTable = false
      if (!isOwnStudentAccount && !isLinkedGuardian && userEmail) {
        const { data: respByEmail } = await supabase
          .from('responsaveis')
          .select('id')
          .ilike('email', userEmail)
        if (respByEmail && respByEmail.length > 0) {
          const respIds = respByEmail.map((r: any) => String(r.id))
          isGuardianByEmailTable = responsaveisDb.some((r: any) => respIds.includes(String(r.id)))
        }
      }

      if (!isOwnStudentAccount && !isLinkedGuardian && !isGuardianByEmailTable) {
        return NextResponse.json(
          { error: 'Acesso negado: você não possui vínculo com este aluno.' },
          { status: 403 }
        )
      }
    }

    if (isAlunoProfile) {
       vinculo = {
         parentesco: 'Próprio Aluno',
         resp_financeiro: false,
         resp_pedagogico: false
       }
       meusAlunos = [aluno]
    } else {
       if (links && links.length > 0 && responsavel_id) {
         const meuVinculo = links.find((l: any) => l.responsaveis?.id === responsavel_id || (Array.isArray(l.responsaveis) && l.responsaveis[0]?.id === responsavel_id));
         if (meuVinculo) {
           vinculo = {
             parentesco: meuVinculo.parentesco,
             resp_financeiro: meuVinculo.resp_financeiro,
             resp_pedagogico: meuVinculo.resp_pedagogico
           }
         }
       }

        if (responsavel_id) {
          // 3. Buscar todos os alunos vinculados a esse responsável (para o Switcher)
          const { data: meusLinks } = await supabase
            .from('aluno_responsavel')
            .select('alunos(*)')
            .eq('responsavel_id', responsavel_id)
          
          if (meusLinks && meusLinks.length > 0) {
            meusAlunos = meusLinks.map((l: any) => l.alunos).filter(Boolean)

            // Populate turma_nome for meusAlunos via cached turmas
            meusAlunos.forEach(a => {
              const tData = (allTurmasDbData || []).find((t: any) => 
                String(t.id) === String(a.turma) || 
                String(t.codigo) === String(a.turma) || 
                t.nome === a.turma
              )
              let baseNome = tData?.nome || a.turma_nome || a.turma || 'S/T'
              const isIntegral = isAlunoIntegralIntermediario(a, allTurmasDbData, allGruposDbData)
              if (isIntegral) {
                a.isIntegralIntermediario = true
                a.modalidade = 'INTEGRAL/INTERMEDIÁRIO'
                a.turno_nome = 'Integral/Intermediário'
                a.turno = 'Integral/Intermediário'
                if (baseNome && !baseNome.toUpperCase().includes('INTEGRAL') && !baseNome.toUpperCase().includes('INTERMEDIÁRIO')) {
                  baseNome = `${baseNome} - INTEGRAL/INTERMEDIÁRIO`
                }
              }
              a.turma_nome = baseNome
              a.turmaNome = baseNome
            })
          }
        }
    }

    const result = {
      aluno: { ...aluno, responsaveis: responsaveisDb },
      vinculo: vinculo,
      meusAlunos: meusAlunos
    };

    setPerfilAcessoCache(cacheKey, result);

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' }
    })

  } catch (e: any) {
    console.error('Perfil Acesso API Error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
