const fs = require('fs')
const path = require('path')

const routes = [
  { p: 'app/api/agenda/eventos/route.ts', t: 'eventos_agenda' },
  { p: 'app/api/agenda/rotina/route.ts', t: 'rotina_items' },
  { p: 'app/api/agenda/autorizacoes/route.ts', t: 'autorizacoes' },
  { p: 'app/api/agenda/momentos/route.ts', t: 'momentos' },
  { p: 'app/api/agenda/enquetes/route.ts', t: 'enquetes' },
  { p: 'app/api/academico/transferencias/route.ts', t: 'transferencias' },
  { p: 'app/api/financeiro/unidades-fiscais/route.ts', t: 'unidades_fiscais' },
  { p: 'app/api/financeiro/notas-fiscais/route.ts', t: 'notas_fiscais' },
  { p: 'app/api/configuracoes/perfis/route.ts', t: 'perfis' },
  { p: 'app/api/censo/pendencias/route.ts', t: 'censo_pendencias' },
  { p: 'app/api/censo/exports/route.ts', t: 'censo_exports' },
  { p: 'app/api/censo/auditoria/route.ts', t: 'censo_audit_logs' },
  { p: 'app/api/censo/operacoes/route.ts', t: 'censo_operacoes' },
  { p: 'app/api/censo/escola/route.ts', t: 'censo_escola_data' },
]

const template = (table) => `import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabase = await createProtectedClient()
    const { data, error } = await supabase.from('${table}').select('*')
    if (error) throw new Error(error.message)
    const result = (data || []).map(row => ({ ...row, ...(row.dados || {}) }))
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=59' }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const supabase = await createProtectedClient()

    if (Array.isArray(body)) {
      if (body.length === 0) return NextResponse.json({ ok: true, count: 0 })
      const rows = body.map(buildRowAuth)
      const { error } = await supabase.from('${table}').upsert(rows)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, count: rows.length })
    }

    const row = buildRowAuth(body)
    const { data, error } = await supabase.from('${table}').upsert(row).select().single()
    if (error) throw new Error(error.message)

    return NextResponse.json({ ...data, ...(data.dados || {}) }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

function buildRowAuth(body: any) {
  const { id, ...rest } = body
  return {
    id: id || crypto.randomUUID(),
    dados: rest,
  }
}
`

routes.forEach(({ p, t }) => {
  const fullPath = path.join(process.cwd(), p)
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  if (!fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath, template(t))
    console.log('Created: ' + fullPath)
  } else {
    // Overwrite to fix previous structures if existing
    fs.writeFileSync(fullPath, template(t))
    console.log('Updated: ' + fullPath)
  }
})
