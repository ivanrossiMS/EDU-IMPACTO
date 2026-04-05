import { NextResponse } from 'next/server'
import { db } from '@/lib/mockDb'

export async function PUT(request: Request, context: any) {
  const id = context.params.id;
  const updates = await request.json()
  const index = db.ocorrencias.findIndex((c: any) => c.id === id)
  if (index === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  db.ocorrencias[index] = { ...db.ocorrencias[index], ...updates }
  return NextResponse.json(db.ocorrencias[index])
}

export async function DELETE(request: Request, context: any) {
  const id = context.params.id;
  const index = db.ocorrencias.findIndex((c: any) => c.id === id)
  if (index === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const deleted = db.ocorrencias.splice(index, 1)
  return NextResponse.json(deleted)
}
