import { NextResponse } from 'next/server'
import { db } from '@/lib/mockDb'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: any) {
  const id = context.params.id;
  const record = db.turmas.find(r => r.id === id)
  
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  
  return NextResponse.json(record)
}

export async function PUT(request: Request, context: any) {
  const id = context.params.id;
  try {
    const data = await request.json()
    const index = db.turmas.findIndex(r => r.id === id)
    if (index === -1) {
      // Upsert
      db.turmas.push({ ...data, id })
      return NextResponse.json(data)
    }
    
    db.turmas[index] = { ...db.turmas[index], ...data }
    return NextResponse.json(db.turmas[index])
  } catch (error) {
    return NextResponse.json({ error: 'Bad Request' }, { status: 400 })
  }
}

export async function DELETE(request: Request, context: any) {
  const id = context.params.id;
  const index = db.turmas.findIndex(r => r.id === id)
  if (index === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  
  db.turmas.splice(index, 1)
  return NextResponse.json({ success: true })
}
