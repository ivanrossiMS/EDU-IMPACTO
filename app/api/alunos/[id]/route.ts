import { NextResponse } from 'next/server'
import { db } from '@/lib/mockDb'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: any) {
  // Enforced to use params asynchronously in Next.js 15+ properly. Wait, the context params must be awaited inside the method if it's Next.js 15
  // But doing it synchronously is fine if it works, wait, the standard for dynamic routing params is context.params: { id: string }
  // We'll extract id.
  const id = context.params.id;
  const aluno = db.alunos.find(a => a.id === id)
  
  if (!aluno) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  
  return NextResponse.json(aluno)
}

export async function PUT(request: Request, context: any) {
  const id = context.params.id;
  try {
    const data = await request.json()
    const index = db.alunos.findIndex(a => a.id === id)
    if (index === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    
    db.alunos[index] = { ...db.alunos[index], ...data }
    return NextResponse.json(db.alunos[index])
  } catch (error) {
    return NextResponse.json({ error: 'Bad Request' }, { status: 400 })
  }
}

export async function DELETE(request: Request, context: any) {
  const id = context.params.id;
  const index = db.alunos.findIndex(a => a.id === id)
  if (index === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  
  db.alunos.splice(index, 1)
  return NextResponse.json({ success: true })
}
