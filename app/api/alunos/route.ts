import { NextResponse } from 'next/server'
import { db } from '@/lib/mockDb'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.toLowerCase()
  const serie = searchParams.get('serie')
  const status = searchParams.get('status')

  let results = db.alunos

  if (q) {
    results = results.filter(a =>
      a.nome.toLowerCase().includes(q) || 
      a.matricula.toLowerCase().includes(q) ||
      a.turma.toLowerCase().includes(q) ||
      (a as any).codigo?.toLowerCase().includes(q)
    )
  }

  if (serie && serie !== 'Todos') {
    results = results.filter(a => a.serie === serie)
  }

  if (status && status !== 'Todos') {
    results = results.filter(a => a.status === status)
  }

  return NextResponse.json(results)
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const newAluno = {
      ...data,
      id: data.id || `A${Math.floor(Math.random() * 10000)}`,
      createdAt: data.createdAt || new Date().toISOString()
    }
    db.alunos.push(newAluno)
    return NextResponse.json(newAluno, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao criar aluno' }, { status: 400 })
  }
}
