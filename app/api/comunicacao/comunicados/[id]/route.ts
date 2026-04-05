import { NextResponse } from 'next/server'
import { db } from '@/lib/mockDb'

export async function PUT(request: Request, context: any) {
  const id = context.params.id;
  const updates = await request.json()
  
  const index = db.comunicados.findIndex(c => c.id === id)
  if (index === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  
  db.comunicados[index] = { ...db.comunicados[index], ...updates }
  return NextResponse.json(db.comunicados[index])
}

export async function DELETE(request: Request, context: any) {
  const id = context.params.id;
  const index = db.comunicados.findIndex(c => c.id === id)
  if (index === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  
  const deleted = db.comunicados.splice(index, 1)
  return NextResponse.json(deleted)
}
