import { NextResponse } from 'next/server'
import { db } from '@/lib/mockDb'
import { newId } from '@/lib/dataContext'

export async function GET() {
  return NextResponse.json(db.tarefas)
}

export async function POST(request: Request) {
  const body = await request.json()
  const nova = { ...body, id: newId('T') }
  db.tarefas.push(nova)
  return NextResponse.json(nova, { status: 201 })
}
