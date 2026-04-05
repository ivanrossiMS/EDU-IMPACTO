import { NextResponse } from 'next/server'
import { db } from '@/lib/mockDb'

export async function PUT(request: Request, context: any) {
  const id = context.params.id;
  const updates = await request.json()
  
  const index = db.cfgCentrosCusto.findIndex(c => c.id === id)
  if (index === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  
  db.cfgCentrosCusto[index] = { ...db.cfgCentrosCusto[index], ...updates }
  return NextResponse.json(db.cfgCentrosCusto[index])
}

export async function DELETE(request: Request, context: any) {
  const id = context.params.id;
  const index = db.cfgCentrosCusto.findIndex(c => c.id === id)
  if (index === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  
  const deleted = db.cfgCentrosCusto.splice(index, 1)
  return NextResponse.json(deleted)
}
