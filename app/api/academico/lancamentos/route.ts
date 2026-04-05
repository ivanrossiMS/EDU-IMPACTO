import { NextResponse } from 'next/server'
import { db } from '@/lib/mockDb'
import { newId } from '@/lib/dataContext'

export async function GET() { return NextResponse.json(db.lancamentosNota) }

export async function POST(request: Request) {
  const body = await request.json()
  const novo = { ...body, id: newId('LANC') }
  db.lancamentosNota.push(novo)
  return NextResponse.json(novo, { status: 201 })
}
