'use server';

import { cookies } from 'next/headers';
import { signJWT, verifyJWT } from '@/lib/auth';

export async function createSession(user: any) {
  const token = await signJWT(user);
  
  const cookieStore = await cookies();
  cookieStore.set('edu-auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // No maxAge/expires = session cookie → browser deletes on close
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete('edu-auth-token');
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('edu-auth-token');
  if (!token) return null;
  const payload = await verifyJWT(token.value);
  return payload;
}
