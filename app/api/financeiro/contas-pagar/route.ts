import { NextResponse } from 'next/server'
import { db } from '@/lib/mockDb'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  
  let results = db.contas_pagar
  if (status && status !== 'Todos') {
    results = results.filter(t => t.status === status)
  }
  
  return NextResponse.json(results)
}
