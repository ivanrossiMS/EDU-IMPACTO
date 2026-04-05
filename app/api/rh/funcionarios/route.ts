import { NextResponse } from 'next/server'
import { db } from '@/lib/mockDb'

export async function GET() {
  return NextResponse.json(db.funcionarios)
}
