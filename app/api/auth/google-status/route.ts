import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) {
      return NextResponse.json({ enabled: false, reason: 'URL do Supabase não configurada' })
    }

    const testUrl = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=http://localhost:3000`
    const res = await fetch(testUrl, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
    })

    if (res.status === 400) {
      const data = await res.json().catch(() => ({}))
      if (
        data.msg?.includes('not enabled') ||
        data.error_code === 'validation_failed' ||
        data.msg?.includes('Unsupported provider')
      ) {
        return NextResponse.json({
          enabled: false,
          reason: 'Provedor Google não está ativado no painel do Supabase',
        })
      }
    }

    // Status 302, 303, 307 ou 200 indicam que o provedor está habilitado e redirecionou para accounts.google.com
    const location = res.headers.get('location') || ''
    let clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''
    if (!clientId && location) {
      try {
        const parsed = new URL(location)
        clientId = parsed.searchParams.get('client_id') || ''
      } catch {}
    }
    if (!clientId) {
      clientId = '805517903971-dage2hg6l432538c9tncgtb37c74jje0.apps.googleusercontent.com'
    }

    return NextResponse.json({ enabled: true, clientId })
  } catch (err: any) {
    return NextResponse.json({ enabled: false, error: err.message })
  }
}
