import { NextResponse } from 'next/server'
import { db } from '@/lib/mockDb'
import { newId } from '@/lib/dataContext'

export async function GET() {
  return NextResponse.json(db.comunicados)
}

export async function POST(request: Request) {
  const body = await request.json()
  const newComunicado = { ...body, id: newId('COM') }
  db.comunicados.push(newComunicado)
  return NextResponse.json(newComunicado, { status: 201 })
}
