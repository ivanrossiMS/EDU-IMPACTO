import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isValidStudentPhoto } from '@/lib/utils'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/portaria/cron-push
 * Cron job do Vercel (roda a cada minuto).
 * Para cada dispositivo com pendências, faz uma chamada direta via API do iDFace
 * usando as credenciais armazenadas no banco.
 * Isso garante que a sincronização acontece MESMO quando ninguém está passando pela catraca.
 */
export async function GET(req: Request) {
  // Verificar se é uma chamada autorizada do Vercel Cron
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.CRON_SECRET) {
    // Permitir chamadas locais de teste sem secret
    const host = req.headers.get('host') || ''
    if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    // Buscar dispositivos ativos e suas pendências
    const { data: devices } = await supabase
      .from('portaria_dispositivos')
      .select('id, nome, ip, porta, configuracao')
    
    if (!devices || devices.length === 0) {
      return NextResponse.json({ status: 'ok', message: 'Nenhum dispositivo cadastrado' })
    }

    const results: any[] = []

    for (const dev of devices) {
      // Buscar até 15 pendências para este dispositivo
      const altDevId = dev.id.includes('/') ? dev.id.replace('/', '-') : dev.id.replace('-', '/')
      const { data: pending } = await supabase
        .from('portaria_sync')
        .select('aluno_id, dispositivo_id, erro_detalhe')
        .eq('status', 'pendente')
        .or(`dispositivo_id.eq.${dev.id},dispositivo_id.eq.${altDevId}`)
        .order('updated_at', { ascending: false })
        .limit(15)

      if (!pending || pending.length === 0) {
        results.push({ device: dev.nome, processed: 0 })
        continue
      }

      const login = dev.configuracao?.login || 'admin'
      const password = dev.configuracao?.password || 'admin'
      const port = dev.porta || 80
      const protocol = port === 443 ? 'https' : 'http'
      const baseUrl = `${protocol}://${dev.ip}:${port}`

      // Tentar autenticar na catraca local
      let session = ''
      try {
        const loginRes = await fetch(`${baseUrl}/login.fcgi`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ login, password }),
          signal: AbortSignal.timeout(3000)
        })
        if (loginRes.ok) {
          const loginData = await loginRes.json()
          session = loginData.session || ''
        }
      } catch {
        // Catraca offline — marcar e continuar
        results.push({ device: dev.nome, error: 'offline', processed: 0 })
        continue
      }

      if (!session) {
        results.push({ device: dev.nome, error: 'auth_failed', processed: 0 })
        continue
      }

      let processed = 0

      for (const row of pending) {
        // Buscar dados do aluno
        const { data: aluno } = await supabase
          .from('alunos')
          .select('id, nome, matricula, codigo, foto, status')
          .or(`id.eq.${row.aluno_id},matricula.eq.${row.aluno_id}`)
          .maybeSingle()

        const codigoStr = aluno?.matricula || aluno?.codigo || String(aluno?.id || row.aluno_id)
        const numId = parseInt(String(codigoStr).replace(/\D/g, ''), 10)
        if (isNaN(numId) || numId <= 0) continue

        const isActive = aluno && ['matriculado', 'cursando', 'ativo', 'Cursando', 'Matriculado', 'Ativo'].includes(aluno.status)
        const isDeleteRequest = row.erro_detalhe?.toLowerCase().includes('exclus') || row.erro_detalhe?.toLowerCase().includes('remov') || !isActive

        try {
          if (isDeleteRequest) {
            await fetch(`${baseUrl}/destroy_objects.fcgi?session=${session}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ object: 'users', where: { users: { id: numId } } }),
              signal: AbortSignal.timeout(5000)
            })
          } else if (isActive) {
            const nameStr = aluno!.nome ? aluno!.nome.substring(0, 30) : `Aluno ${numId}`
            // Criar ou atualizar usuário
            await fetch(`${baseUrl}/add_objects.fcgi?session=${session}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ object: 'users', values: [{ id: numId, name: nameStr, registration: String(numId) }] }),
              signal: AbortSignal.timeout(5000)
            })

            // Enviar foto se disponível
            if (aluno!.foto && isValidStudentPhoto(aluno!.foto) && aluno!.foto.startsWith('data:image')) {
              const base64 = aluno!.foto.replace(/^data:image\/\w+;base64,/, '')
              await fetch(`${baseUrl}/set_user_image.fcgi?session=${session}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: numId, image: base64 }),
                signal: AbortSignal.timeout(10000)
              }).catch(() => {}) // Foto é opcional
            }
          }

          // Marcar como sincronizado
          let upd = supabase
            .from('portaria_sync')
            .update({ status: 'sincronizado', ultima_sync: new Date().toISOString(), erro_detalhe: null, updated_at: new Date().toISOString() })
            .eq('aluno_id', String(row.aluno_id))
          if (row.dispositivo_id) upd = upd.eq('dispositivo_id', String(row.dispositivo_id))
          await upd

          processed++
        } catch (err: any) {
          console.error(`[Cron Push] Erro ao sincronizar aluno ${row.aluno_id} em ${dev.nome}:`, err.message)
        }
      }

      // Atualizar status do dispositivo
      await supabase
        .from('portaria_dispositivos')
        .update({ status: processed > 0 ? 'online' : 'online', ultima_comunicacao: new Date().toISOString() })
        .eq('id', dev.id)

      results.push({ device: dev.nome, processed })
    }

    const totalProcessed = results.reduce((s, r) => s + (r.processed || 0), 0)
    console.log(`[Cron Push] Concluído: ${totalProcessed} alunos sincronizados`, results)

    return NextResponse.json({ status: 'ok', results, totalProcessed })
  } catch (err: any) {
    console.error('[Cron Push Error]', err.message)
    return NextResponse.json({ status: 'error', error: err.message }, { status: 500 })
  }
}
