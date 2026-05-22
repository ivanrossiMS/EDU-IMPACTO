import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

// Aumentar o limite de payload para fotos
export const maxDuration = 60 // 60 seconds

export async function POST(request: Request) {
  try {
    const supabase = await createProtectedClient()
    const body = await request.json()
    const { photos } = body as { photos: { id: string; base64: string }[] }

    if (!Array.isArray(photos)) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    let atualizados = 0
    let erros = 0
    const erroDetails: { id: string; msg: string }[] = []

    // Processar em lotes para não sobrecarregar
    for (const photo of photos) {
      try {
        // Tenta encontrar o aluno por código ou matrícula
        // Primeiro por ID exato (UUID)
        let { data: aluno, error: findError } = await supabase
          .from('alunos')
          .select('id')
          .eq('id', photo.id)
          .maybeSingle()

        if (!aluno) {
          // Depois por matrícula
          const { data: byMatricula } = await supabase
            .from('alunos')
            .select('id')
            .eq('matricula', photo.id)
            .maybeSingle()
          aluno = byMatricula
        }

        if (!aluno) {
          // Por fim por codigo (se existir campo codigo)
          const { data: byCodigo } = await supabase
            .from('alunos')
            .select('id')
            .filter('dados->>codigo', 'eq', photo.id)
            .maybeSingle()
          aluno = byCodigo
        }

        if (aluno) {
          const { error: updateError } = await supabase
            .from('alunos')
            .update({ foto: photo.base64 })
            .eq('id', aluno.id)

          if (updateError) throw updateError
          atualizados++
        } else {
          erros++
          erroDetails.push({ id: photo.id, msg: 'Aluno não encontrado' })
        }
      } catch (e: any) {
        erros++
        erroDetails.push({ id: photo.id, msg: e.message })
      }
    }

    return NextResponse.json({
      ok: true,
      total: photos.length,
      atualizados,
      erros,
      erroDetails: erroDetails.slice(0, 20),
    })

  } catch (e: any) {
    console.error('[POST /api/importacao/fotos]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
