import { NextResponse } from 'next/server'
import { db } from '@/lib/mockDb'

export async function PUT(request: Request, context: any) {
  const id = context.params.id;
  const updates = await request.json()
  
  const index = db.titulos.findIndex(t => t.id === id)
  if (index === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  
  db.titulos[index] = { ...db.titulos[index], ...updates }
  return NextResponse.json(db.titulos[index])
}
