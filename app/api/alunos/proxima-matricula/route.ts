import { NextResponse } from 'next/server'
import { supabaseServer as supabase } from '@/lib/supabaseServer'
import { requireAuth } from '@/lib/server/authGuard'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAuth(request)
    if (errorResponse) return errorResponse

    // Busca leve para determinar o próximo código/matrícula sequencial de aluno
    const { data, error } = await supabase
      .from('alunos')
      .select('id, matricula')

    if (error) {
      console.error('[API alunos/proxima-matricula] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let maxId = 0
    for (const a of data || []) {
      const candidates = [
        String(a.matricula || '').trim(),
        String(a.id || '').trim()
      ]
      for (const raw of candidates) {
        if (/^\d{1,7}$/.test(raw)) {
          const num = parseInt(raw, 10)
          if (num > maxId && num < 1000000) {
            maxId = num
          }
        }
      }
    }

    const proximaMatricula = maxId > 0 ? String(maxId + 1) : '1001'

    return NextResponse.json({
      success: true,
      maxId,
      proximaMatricula,
      codigo: proximaMatricula
    })
  } catch (e: any) {
    console.error('[API alunos/proxima-matricula] Unhandled error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
