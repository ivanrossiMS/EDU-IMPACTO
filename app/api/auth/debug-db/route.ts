import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const urlObj = new URL(request.url)
    const secret = urlObj.searchParams.get('secret')

    // Secure authentication for the debug endpoint
    if (secret !== 'debug123') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const envServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const envAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // Analyze NEXT_PUBLIC_SUPABASE_URL
    const urlAnalysis = {
      defined: !!envUrl,
      valueObfuscated: envUrl ? `${envUrl.substring(0, 12)}...${envUrl.substring(envUrl.length - 5)}` : null,
      length: envUrl ? envUrl.length : 0,
      hasLeadingSpaces: envUrl ? envUrl.startsWith(' ') : false,
      hasTrailingSpaces: envUrl ? envUrl.endsWith(' ') : false,
      hasQuotes: envUrl ? (envUrl.startsWith('"') && envUrl.endsWith('"')) || (envUrl.startsWith("'") && envUrl.endsWith("'")) : false,
    }

    // Helper to extract JWT payload metadata safely
    const analyzeJwt = (jwt?: string) => {
      if (!jwt) return { defined: false }
      const cleanJwt = jwt.trim().replace(/^['"]|['"]$/g, '')
      const parts = cleanJwt.split('.')
      if (parts.length !== 3) {
        return { defined: true, validJwtFormat: false, length: jwt.length }
      }
      try {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'))
        return {
          defined: true,
          validJwtFormat: true,
          length: jwt.length,
          hasQuotes: (jwt.startsWith('"') && jwt.endsWith('"')) || (jwt.startsWith("'") && jwt.endsWith("'")),
          ref: payload.ref,
          role: payload.role,
          iss: payload.iss,
        }
      } catch (e: any) {
        return { defined: true, validJwtFormat: false, length: jwt.length, error: e.message }
      }
    }

    const serviceKeyAnalysis = analyzeJwt(envServiceKey)
    const anonKeyAnalysis = analyzeJwt(envAnonKey)

    // Test database connection using raw variables
    let rawConnectionTest = { success: false, error: null as string | null, data: null as any }
    if (envUrl && envServiceKey) {
      try {
        const supabase = createClient(envUrl, envServiceKey, {
          auth: { persistSession: false }
        })
        const { data, error } = await supabase.from('system_users').select('id, email, nome').limit(2)
        if (error) {
          rawConnectionTest.error = error.message
        } else {
          rawConnectionTest.success = true
          rawConnectionTest.data = data
        }
      } catch (e: any) {
        rawConnectionTest.error = e.message
      }
    }

    // Test database connection using sanitized/cleaned variables
    let sanitizedConnectionTest = { success: false, error: null as string | null, data: null as any }
    if (envUrl && envServiceKey) {
      try {
        const cleanUrl = envUrl.trim().replace(/^['"]|['"]$/g, '')
        const cleanServiceKey = envServiceKey.trim().replace(/^['"]|['"]$/g, '')
        const supabase = createClient(cleanUrl, cleanServiceKey, {
          auth: { persistSession: false }
        })
        const { data, error } = await supabase.from('system_users').select('id, email, nome').limit(2)
        if (error) {
          sanitizedConnectionTest.error = error.message
        } else {
          sanitizedConnectionTest.success = true
          sanitizedConnectionTest.data = data
        }
      } catch (e: any) {
        sanitizedConnectionTest.error = e.message
      }
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      urlAnalysis,
      serviceKeyAnalysis,
      anonKeyAnalysis,
      rawConnectionTest,
      sanitizedConnectionTest,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
