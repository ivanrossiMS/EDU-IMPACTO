import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseServerFactory'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // FORCE NEXT.JS TO TREAT AS DYNAMIC AND BUST CACHE IN DEV MODE HMR
    const url = new URL(req.url)
    const t = url.searchParams.get('t')
    console.log(`[API] Fetching results for id=${params}, t=${t}`)

    const { user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse
    const supabase = await createProtectedClient()
    const { id } = await params
    
    // Fetch pesquisa and its answers
    const { data: pesquisa, error } = await supabase
      .from('gp_pesquisas')
      .select(`
        *,
        gp_pesquisa_respostas (*)
      `)
      .eq('id', id)
      .single()
      
    if (error) throw error

    return NextResponse.json(pesquisa)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse
    const supabase = await createProtectedClient()
    const { id } = await params
    const body = await req.json()

    const { data, error } = await supabase
      .from('gp_pesquisas')
      .update(body)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse
    const supabase = await createProtectedClient()
    const { id } = await params

    const { error } = await supabase
      .from('gp_pesquisas')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }
}
