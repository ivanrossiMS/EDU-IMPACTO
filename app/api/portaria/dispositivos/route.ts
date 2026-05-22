import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ControliDClient } from '@/lib/controlid'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('portaria_dispositivos')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    let id = body.id

    const port = body.porta || (body.ip?.includes(':') ? parseInt(body.ip.split(':')[1], 10) : 443)
    const ipOnly = body.ip ? body.ip.replace(/^https?:\/\//i, '').split(':')[0] : ''

    // Tentar obter o número de série caso o dispositivo esteja online e não tenha ID definido
    if (!id && ipOnly) {
      try {
        const client = new ControliDClient({
          ip: ipOnly,
          port: port,
          login: body.configuracao?.login || 'admin',
          password: body.configuracao?.password || 'admin',
        })
        const info = await client.getDeviceInfo()
        if (info && info.serial) {
          id = info.serial
        }
      } catch (err: any) {
        console.warn('[Dispositivos API] Não foi possível obter o Serial do dispositivo físico:', err.message)
      }
    }

    if (!id) {
      id = crypto.randomUUID()
    }

    const record = {
      id,
      nome: body.nome || 'Novo Dispositivo',
      ip: ipOnly,
      porta: port,
      unidade: body.unidade || '',
      modelo: body.modelo || 'iDFace',
      status: 'offline',
      configuracao: {
        ...(body.configuracao || {}),
        ...(id && !id.includes('-') ? { serial: id } : {})
      },
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('portaria_dispositivos')
      .upsert(record, { onConflict: 'id' })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    const { error } = await supabase.from('portaria_dispositivos').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
