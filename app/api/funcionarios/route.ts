import { NextResponse, type NextRequest } from 'next/server'

// Proxy/Redirect endpoint to prevent 404s from stale frontend clients (Fast Refresh / Cache)
// that still attempt to fetch `/api/funcionarios` instead of `/api/rh/funcionarios`
export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone()
  url.pathname = '/api/rh/funcionarios'
  return NextResponse.redirect(url)
}

export async function POST(request: NextRequest) {
  // Pass-through redirection
  const url = request.nextUrl.clone()
  url.pathname = '/api/rh/funcionarios'
  return NextResponse.redirect(url, 307)
}
