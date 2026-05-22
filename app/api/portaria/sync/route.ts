import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ControliDClient } from '@/lib/controlid'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/**
 * POST /api/portaria/sync
 * Sincroniza um ou todos os alunos ativos com um dispositivo iDFace.
 * Body: { dispositivo_id, aluno_id? (opcional, se omitido sincroniza todos) }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { dispositivo_id, aluno_id } = body

    if (!dispositivo_id) {
      return NextResponse.json({ error: 'dispositivo_id obrigatório' }, { status: 400 })
    }

    // Buscar dispositivo
    const { data: device, error: devErr } = await supabase
      .from('portaria_dispositivos')
      .select('*')
      .eq('id', dispositivo_id)
      .single()

    if (devErr || !device) {
      return NextResponse.json({ error: 'Dispositivo não encontrado' }, { status: 404 })
    }

    if (!device.ip) {
      return NextResponse.json({ error: 'IP do dispositivo não configurado' }, { status: 400 })
    }

    // Buscar alunos
    let alunosQuery = supabase
      .from('alunos')
      .select('id, nome, matricula, foto, status')
      .in('status', ['matriculado', 'cursando', 'ativo', 'Cursando', 'Matriculado', 'Ativo'])

    if (aluno_id) {
      alunosQuery = alunosQuery.eq('id', aluno_id)
    }

    const { data: alunos, error: alunoErr } = await alunosQuery
    if (alunoErr) throw alunoErr

    if (!alunos || alunos.length === 0) {
      return NextResponse.json({ error: 'Nenhum aluno ativo encontrado' }, { status: 404 })
    }

    // Inicializar client iDFace
    const client = new ControliDClient({
      ip: device.ip,
      port: device.porta || 443,
      login: (device.configuracao as any)?.login || 'admin',
      password: (device.configuracao as any)?.password || 'admin',
    })

    const results: any[] = []

    for (const aluno of alunos) {
      const codigo = aluno.matricula
      if (!codigo) {
        results.push({ aluno_id: aluno.id, nome: aluno.nome, status: 'erro', erro: 'Sem código' })
        continue
      }

      const numericId = parseInt(codigo.replace(/\D/g, ''), 10)
      if (isNaN(numericId) || numericId <= 0) {
        results.push({ aluno_id: aluno.id, nome: aluno.nome, status: 'erro', erro: 'Código inválido' })
        continue
      }

      try {
        // Criar/atualizar usuário no iDFace
        await client.createUser(numericId, aluno.nome, codigo)

        let fotoEnviada = false

        // Enviar foto se existir
        if (aluno.foto && typeof aluno.foto === 'string' && aluno.foto.length > 50) {
          try {
            await client.setUserImage(numericId, aluno.foto)
            fotoEnviada = true
          } catch (photoErr: any) {
            // Foto falhou mas o usuário foi criado — aceitável
            console.warn(`Foto falhou para ${aluno.nome}: ${photoErr.message}`)
          }
        }

        // Atualizar registro de sync
        await supabase.from('portaria_sync').upsert({
          aluno_id: aluno.id,
          dispositivo_id,
          status: 'sincronizado',
          ultima_sync: new Date().toISOString(),
          foto_enviada: fotoEnviada,
          erro_detalhe: '',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'aluno_id,dispositivo_id' })

        results.push({ aluno_id: aluno.id, nome: aluno.nome, status: 'sucesso', foto: fotoEnviada })
      } catch (err: any) {
        // Registrar falha
        await supabase.from('portaria_sync').upsert({
          aluno_id: aluno.id,
          dispositivo_id,
          status: 'erro',
          erro_detalhe: err.message,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'aluno_id,dispositivo_id' })

        results.push({ aluno_id: aluno.id, nome: aluno.nome, status: 'erro', erro: err.message })
      }
    }

    // Atualizar status do dispositivo
    await supabase.from('portaria_dispositivos').update({
      status: 'online',
      ultima_comunicacao: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', dispositivo_id)

    const successCount = results.filter(r => r.status === 'sucesso').length
    const errorCount = results.filter(r => r.status === 'erro').length

    return NextResponse.json({
      total: results.length,
      sucesso: successCount,
      erros: errorCount,
      resultados: results,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

/** GET: buscar status de sync de alunos com dispositivo */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const dispositivo_id = url.searchParams.get('dispositivo_id')

    let query = supabase
      .from('portaria_sync')
      .select('*')
      .order('updated_at', { ascending: false })

    if (dispositivo_id) query = query.eq('dispositivo_id', dispositivo_id)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
