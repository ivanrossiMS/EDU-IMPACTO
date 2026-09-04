import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const supabase = await createProtectedClient()
    
    const { searchParams } = new URL(req.url)
    const mesQuery = searchParams.get('mes')
    
    // Obtém o mês atual ou o mês solicitado (01 a 12)
    const currentMonth = mesQuery 
      ? String(mesQuery).padStart(2, '0') 
      : String(new Date().getMonth() + 1).padStart(2, '0')
      
    const currentDay = String(new Date().getDate()).padStart(2, '0')
    const todayStr = `-${String(new Date().getMonth() + 1).padStart(2, '0')}-${currentDay}`
    const monthStr = `-${currentMonth}-`

    // Buscamos os campos necessários dos alunos e as turmas em paralelo
    const [{ data, error }, { data: turmasData }] = await Promise.all([
      supabase
        .from('alunos')
        .select('id, nome, data_nascimento, turma, foto, dados')
        .ilike('data_nascimento', `%${monthStr}%`)
        .or('status.neq.inativo,status.is.null'),
      supabase
        .from('turmas')
        .select('id, nome, codigo')
    ])

    if (error) {
      console.error('[API alunos/aniversariantes] erro:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Mapeamento de id, código e nome para o Nome Oficial da Turma
    const turmasMap = new Map<string, string>()
    ;(turmasData || []).forEach((t: any) => {
      if (t.nome) {
        const nomeTrimmed = String(t.nome).trim()
        if (t.id != null) {
          turmasMap.set(String(t.id).trim(), nomeTrimmed)
          turmasMap.set(String(t.id).trim().toLowerCase(), nomeTrimmed)
        }
        if (t.codigo) {
          turmasMap.set(String(t.codigo).trim(), nomeTrimmed)
          turmasMap.set(String(t.codigo).trim().toLowerCase(), nomeTrimmed)
        }
        turmasMap.set(nomeTrimmed, nomeTrimmed)
        turmasMap.set(nomeTrimmed.toLowerCase(), nomeTrimmed)
      }
    })

    const resolveTurmaNome = (aluno: any): string => {
      let dadosObj = aluno.dados
      if (typeof dadosObj === 'string') {
        try {
          dadosObj = JSON.parse(dadosObj)
        } catch {
          dadosObj = {}
        }
      }
      dadosObj = dadosObj || {}

      const refs = [
        aluno.turma,
        dadosObj.turma,
        dadosObj.turmaId,
        dadosObj.dadosMatricula?.turmaId,
        dadosObj.dadosMatricula?.turma
      ].filter(Boolean).map(r => String(r).trim())

      for (const ref of refs) {
        if (turmasMap.has(ref)) return turmasMap.get(ref)!
        if (turmasMap.has(ref.toLowerCase())) return turmasMap.get(ref.toLowerCase())!
      }

      // Checa se há nome explícito nos dados ou dadosMatricula
      if (dadosObj.turmaNome && typeof dadosObj.turmaNome === 'string') {
        const tNome = dadosObj.turmaNome.trim()
        if (!/^\d+$/.test(tNome) && !/^[0-9a-fA-F-]{10,}$/.test(tNome)) {
          return tNome
        }
      }
      if (dadosObj.dadosMatricula?.turmaNome && typeof dadosObj.dadosMatricula.turmaNome === 'string') {
        const tNome = dadosObj.dadosMatricula.turmaNome.trim()
        if (!/^\d+$/.test(tNome) && !/^[0-9a-fA-F-]{10,}$/.test(tNome)) {
          return tNome
        }
      }
      if (Array.isArray(dadosObj.historicoTurmas) && dadosObj.historicoTurmas.length > 0) {
        const lastHist = dadosObj.historicoTurmas[dadosObj.historicoTurmas.length - 1]
        if (lastHist?.turmaNome && typeof lastHist.turmaNome === 'string') {
          const tNome = lastHist.turmaNome.trim()
          if (!/^\d+$/.test(tNome) && !/^[0-9a-fA-F-]{10,}$/.test(tNome)) {
            return tNome
          }
        }
        if (lastHist?.turmaId != null) {
          const histRef = String(lastHist.turmaId).trim()
          if (turmasMap.has(histRef)) return turmasMap.get(histRef)!
          if (turmasMap.has(histRef.toLowerCase())) return turmasMap.get(histRef.toLowerCase())!
        }
      }

      // Se aluno.turma já for o nome da turma (não é ID numérico nem UUID)
      if (aluno.turma) {
        const str = String(aluno.turma).trim()
        const isNumeric = /^\d+$/.test(str)
        const isUuid = /^[0-9a-fA-F-]{10,}$/.test(str)
        if (!isNumeric && !isUuid) {
          return str
        }
      }

      return ''
    }

    const formatData = (aluno: any) => {
       const dataNasc = aluno.data_nascimento || ''
       const turmaNome = resolveTurmaNome(aluno)
       return {
         id: aluno.id,
         nome: aluno.nome,
         dataNascimento: dataNasc,
         turma: aluno.turma,
         turmaNome: turmaNome,
         foto: aluno.foto,
         hoje: dataNasc.includes(todayStr)
       }
    }

    const formatados = (data || []).map(formatData).sort((a, b) => {
       // Ordenar por dia
       const diaA = a.dataNascimento.split('-')[2] || '00'
       const diaB = b.dataNascimento.split('-')[2] || '00'
       return parseInt(diaA) - parseInt(diaB)
    })

    return NextResponse.json({
      data: formatados,
      meta: { total: formatados.length }
    })
  } catch (err: any) {
    console.error('[API alunos/aniversariantes] Error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
