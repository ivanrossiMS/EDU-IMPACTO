import { NextResponse } from 'next/server'
import { db } from '@/lib/mockDb'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(db.turmas)
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const newRecord = {
      ...data,
      id: data.id || `T${Math.floor(Math.random() * 10000)}`,
      createdAt: data.createdAt || new Date().toISOString()
    }
    db.turmas.push(newRecord)
    return NextResponse.json(newRecord, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao criar turma' }, { status: 400 })
  }
}
