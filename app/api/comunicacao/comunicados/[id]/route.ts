import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { db } from '@/lib/mockDb'

export async function PUT(request: Request, context: any) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const id = context.params.id;
  const updates = await request.json()
  
  const index = db.comunicados.findIndex(c => c.id === id)
  if (index === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  
  db.comunicados[index] = { ...db.comunicados[index], ...updates }
  return NextResponse.json(db.comunicados[index])
}

export async function DELETE(request: Request, context: any) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const id = context.params.id;
  const index = db.comunicados.findIndex(c => c.id === id)
  if (index === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  
  const deleted = db.comunicados.splice(index, 1)
  return NextResponse.json(deleted)
}
