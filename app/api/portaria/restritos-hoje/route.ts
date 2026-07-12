import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseServerFactory'
import { requireAuth } from '@/lib/server/authGuard'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient()

  try {
    const DIAS_LABEL = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
    const todayK = DIAS_LABEL[new Date().getDay()]

    // 1. Fetch Restritos from 'responsaveis'
    const { data: responsaveis, error: rError } = await supabase
      .from('responsaveis')
      .select('id, nome, proibido, dias_acesso')
      .or('proibido.eq.true,dias_acesso.neq.{}')
      
    if (rError) throw rError

    const restritosMap = new Map()
    ;(responsaveis || []).forEach(r => {
      let isRestrito = false
      let motivo = ''
      if (r.proibido === true) {
        isRestrito = true
        motivo = 'Proibido'
      } else if (r.dias_acesso && r.dias_acesso.length > 0) {
        if (!r.dias_acesso.includes(todayK)) {
          isRestrito = true
          motivo = 'Dia Restrito'
        }
      }
      if (isRestrito) {
        restritosMap.set(r.id, { id: r.id, nome: r.nome, motivo })
      }
    })

    // 2. Fetch all active students (lightweight) to check JSON 'autorizados'
    const { data: alunos, error: aError } = await supabase
      .from('alunos')
      .select('id, nome, turma, foto, dados')
      .or('status.eq.ativo,status.eq.matriculado,status.is.null')

    if (aError) throw aError

    // 3. Fetch links for the restritos responsaveis
    const restritosIds = Array.from(restritosMap.keys())
    let links: any[] = []
    if (restritosIds.length > 0) {
      const { data: lData, error: lError } = await supabase
        .from('aluno_responsavel')
        .select('aluno_id, responsavel_id, parentesco')
        .in('responsavel_id', restritosIds)
      
      if (lError) throw lError
      links = lData || []
    }

    const studentsResult: any[] = []

    // 4. Combine data
    for (const aluno of alunos || []) {
      const restritosDoAluno: any[] = []

      // Check linked responsaveis
      const alunoLinks = links.filter(l => l.aluno_id === aluno.id)
      alunoLinks.forEach(l => {
        const rData = restritosMap.get(l.responsavel_id)
        if (rData) {
          restritosDoAluno.push({
            nome: rData.nome,
            parentesco: l.parentesco || 'Responsável',
            motivo: rData.motivo
          })
        }
      })

      // Check JSON autorizados
      const autorizados = aluno.dados?.saude?.autorizados || []
      autorizados.forEach((aut: any) => {
        let isRestrito = false
        let motivo = ''
        if (aut.proibido === true) {
          isRestrito = true
          motivo = 'Proibido'
        } else if (aut.diasSemana && aut.diasSemana.length > 0) {
          if (!aut.diasSemana.includes(todayK)) {
            isRestrito = true
            motivo = 'Dia Restrito'
          }
        }

        if (isRestrito) {
          restritosDoAluno.push({
            nome: aut.nome,
            parentesco: aut.parentesco || 'Autorizado',
            motivo
          })
        }
      })

      // Check JSON responsaveis (legacy/fallback)
      const resps = aluno.dados?.responsaveis || []
      resps.forEach((r: any) => {
        let isRestrito = false
        let motivo = ''
        if (r.proibido === true) {
          isRestrito = true
          motivo = 'Proibido'
        } else if (r.diasAcesso && r.diasAcesso.length > 0) {
          if (!r.diasAcesso.includes(todayK)) {
            isRestrito = true
            motivo = 'Dia Restrito'
          }
        }
        if (isRestrito) {
          restritosDoAluno.push({
            nome: r.nome,
            parentesco: r.parentesco || 'Responsável',
            motivo
          })
        }
      })

      if (restritosDoAluno.length > 0) {
        // deduplicate by name
        const uniqueRestritos = restritosDoAluno.filter((v, i, a) => a.findIndex(t => (t.nome === v.nome)) === i)

        studentsResult.push({
          id: aluno.id,
          nome: aluno.nome,
          turma: aluno.turma,
          foto: aluno.foto,
          restritos: uniqueRestritos
        })
      }
    }

    return NextResponse.json({ data: studentsResult })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
