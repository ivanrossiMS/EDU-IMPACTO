import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/authGuard'
export async function GET() {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse
 return NextResponse.json({ hello: 'world' }); }
