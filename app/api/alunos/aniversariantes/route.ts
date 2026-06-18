import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const supabase = await createProtectedClient()
    
    // Obtém o mês atual (01 a 12)
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0')
    const currentDay = String(new Date().getDate()).padStart(2, '0')
    const todayStr = `-${currentMonth}-${currentDay}`
    const monthStr = `-${currentMonth}-`

    // Buscamos apenas os campos necessários, usando o campo nativo data_nascimento
    const { data, error } = await supabase
      .from('alunos')
      .select('id, nome, data_nascimento, turma, foto')
      .ilike('data_nascimento', `%${monthStr}%`)
      .eq('status', 'ativo')

    if (error) {
      console.error('[API alunos/aniversariantes] erro:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const formatData = (aluno: any) => {
       const dataNasc = aluno.data_nascimento || ''
       return {
         id: aluno.id,
         nome: aluno.nome,
         dataNascimento: dataNasc,
         turma: aluno.turma,
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
