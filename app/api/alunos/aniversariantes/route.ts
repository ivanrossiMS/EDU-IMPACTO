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

    // Buscamos apenas os campos necessários, usando o campo nativo data_nascimento
    const { data, error } = await supabase
      .from('alunos')
      .select('id, nome, data_nascimento, turma, foto')
      .ilike('data_nascimento', `%${monthStr}%`)
      .or('status.neq.inativo,status.is.null')

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
