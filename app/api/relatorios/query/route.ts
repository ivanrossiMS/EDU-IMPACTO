import { NextRequest, NextResponse } from 'next/server'
import { resolveReportData } from '@/lib/reports/reportEngine'
import { requireAuth } from '@/lib/server/authGuard'

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const body = await req.json()
    const { source, filters = {}, page = 1, pageSize = 50, sortField, sortDir } = body

    if (!source) {
      return NextResponse.json({ error: 'source is required' }, { status: 400 })
    }

    const result = await resolveReportData({
      source,
      filters,
      page: Math.max(1, Number(page)),
      // Allow large pageSize for report pages that fetch all records at once
      pageSize: Number(pageSize) > 200 ? Math.min(99999, Number(pageSize)) : Math.min(200, Math.max(10, Number(pageSize))),
      sortField,
      sortDir,
    })

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[reports/query] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
