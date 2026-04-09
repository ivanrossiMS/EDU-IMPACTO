import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJWT } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('edu-auth-token');
  const path = request.nextUrl.pathname;

  // Public/Static routes bypass
  if (path.startsWith('/_next') || path.includes('.') || path.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Access validation for protected sections
  if (!token) {
    if (path !== '/login') {
      const url = new URL('/login', request.url);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Verify token signature with 'jose' Server-side
  const payload = await verifyJWT(token.value);

  // If token is invalid/tampered, clear it and redirect to login
  if (!payload) {
    console.log('Middleware: payload nulo ou inválido, redirecionando para o login.');
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('edu-auth-token');
    return response;
  }

  // Active session redirections
  if (path === '/login' || path === '/') {
    let dest = '/dashboard';
    if (payload.perfil === 'Família' || payload.cargo === 'Aluno' || payload.cargo === 'Responsável') dest = '/agenda-digital';
    if (payload.perfil === 'Professor') dest = '/dashboard';
    
    return NextResponse.redirect(new URL(dest, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
