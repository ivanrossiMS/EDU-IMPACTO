import { createClient } from '@supabase/supabase-js'
import { ControliDClient } from '@/lib/controlid'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Sincroniza as alterações de um aluno em segundo plano com todas as catracas iDFace online.
 * Com base nas regras ativas de "Configurações da Portaria".
 */
export async function syncStudentToDevices(studentId: string, actionType: 'create' | 'update' | 'delete') {
  try {
    console.log(`[Portaria Sync] Iniciando tarefa em lote para Aluno: ${studentId}, Ação: ${actionType}`)

    // 1. Buscar configurações ativas da portaria
    const { data: configRes } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'portaria_config')
      .maybeSingle()

    const config = configRes?.valor || {}

    // Respeitar os toggles da página de configurações
    if (actionType === 'create' && !config.sync_automatica_novos_alunos) {
      console.log('[Portaria Sync] Cadastro automático desativado nas configurações. Ignorando.')
      return
    }

    // 2. Buscar todos os dispositivos iDFace cadastrados e online
    const { data: devices } = await supabase
      .from('portaria_dispositivos')
      .select('*')
      .eq('status', 'online')

    if (!devices || devices.length === 0) {
      console.log('[Portaria Sync] Nenhum dispositivo iDFace online cadastrado para sincronizar.')
      return
    }

    // ─── CASO: DELEÇÃO ──────────────────────────────────────────────────────────
    if (actionType === 'delete') {
      if (!config.remover_inativos_automaticamente) {
        console.log('[Portaria Sync] Remoção automática desativada nas configurações. Ignorando.')
        return
      }

      const numericId = parseInt(studentId.replace(/\D/g, ''), 10)
      if (isNaN(numericId)) return

      await Promise.allSettled(devices.map(async (dev) => {
        try {
          const client = new ControliDClient({
            ip: dev.ip,
            port: dev.porta || 80,
            login: dev.configuracao?.login || 'admin',
            password: dev.configuracao?.password || 'admin'
          })

          await client.deleteUser(numericId)
          console.log(`✅ [Portaria Sync] Removido ID ${numericId} do leitor "${dev.nome}"`)
        } catch (err: any) {
          console.error(`❌ [Portaria Sync] Erro ao remover do leitor "${dev.nome}":`, err.message)
        }
      }))
      return
    }

    // ─── CASO: CRIAÇÃO OU ATUALIZAÇÃO ───────────────────────────────────────────
    const { data: student } = await supabase
      .from('alunos')
      .select('id, nome, matricula, foto, status')
      .eq('id', studentId)
      .maybeSingle()

    if (!student) {
      console.log(`[Portaria Sync] Aluno ${studentId} não encontrado no banco.`)
      return
    }

    const isStudentActive = ['matriculado', 'cursando', 'ativo', 'Cursando', 'Matriculado', 'Ativo'].includes(student.status)

    // Se o aluno foi alterado para inativo, e a remoção automática está ativa: exclui do leitor
    if (!isStudentActive) {
      if (config.remover_inativos_automaticamente) {
        console.log(`[Portaria Sync] Aluno ${student.nome} está inativo (${student.status}). Removendo do hardware.`)
        await syncStudentToDevices(studentId, 'delete')
      }
      return
    }

    const codigo = student.matricula
    if (!codigo) {
      console.log(`[Portaria Sync] Aluno ${student.nome} está sem número de matrícula. Sincronização cancelada.`)
      return
    }

    const numericId = parseInt(codigo.replace(/\D/g, ''), 10)
    if (isNaN(numericId)) {
      console.log(`[Portaria Sync] Matrícula "${codigo}" não pôde ser convertida para ID numérico.`)
      return
    }

    await Promise.allSettled(devices.map(async (dev) => {
      try {
        const client = new ControliDClient({
          ip: dev.ip,
          port: dev.porta || 80,
          login: dev.configuracao?.login || 'admin',
          password: dev.configuracao?.password || 'admin'
        })

        // Cadastrar/atualizar cadastro básico do usuário no leitor
        await client.createUser(numericId, student.nome, codigo)
        console.log(`✅ [Portaria Sync] Cadastro básico de "${student.nome}" sincronizado em "${dev.nome}"`)

        // Enviar/atualizar foto facial se a opção estiver ativa
        if (config.reenviar_foto_ao_atualizar && student.foto && typeof student.foto === 'string' && student.foto.length > 50) {
          try {
            await client.setUserImage(numericId, student.foto)
            console.log(`📸 [Portaria Sync] Foto facial de "${student.nome}" atualizada em "${dev.nome}"`)
          } catch (photoErr: any) {
            console.warn(`⚠️ [Portaria Sync] Foto falhou para "${student.nome}" em "${dev.nome}":`, photoErr.message)
          }
        }
      } catch (err: any) {
        console.error(`❌ [Portaria Sync] Falha ao sincronizar com "${dev.nome}":`, err.message)
      }
    }))
  } catch (err: any) {
    console.error('❌ [Portaria Sync General Error]', err.message)
  }
}

/**
 * Sincroniza a foto cadastrada na catraca física de volta para o cadastro do aluno no ERP.
 * Disparado automaticamente quando um usuário cadastra/atualiza a face direto na catraca.
 */
export async function syncPhotoFromDeviceToStudent(userIdStr: string, deviceSerial?: string) {
  try {
    console.log(`[Portaria Webhook Image Sync] Sincronizando foto do ID do leitor: ${userIdStr}`)

    const numericId = parseInt(userIdStr.replace(/\D/g, ''), 10)
    if (isNaN(numericId)) return

    // 1. Resolver o leitor iDFace
    let device: any = null
    if (deviceSerial) {
      const { data: dev } = await supabase
        .from('portaria_dispositivos')
        .select('*')
        .eq('status', 'online')
        .or(`id.eq.${deviceSerial},nome.ilike.%${deviceSerial}%`)
        .limit(1)
        .maybeSingle()
      device = dev
    }

    if (!device) {
      const { data: firstDev } = await supabase
        .from('portaria_dispositivos')
        .select('*')
        .eq('status', 'online')
        .limit(1)
        .maybeSingle()
      device = firstDev
    }

    if (!device) {
      console.warn('[Portaria Webhook Image Sync] Nenhum leitor online encontrado para baixar a foto.')
      return
    }

    // 2. Inicializar cliente e baixar a foto
    const client = new ControliDClient({
      ip: device.ip,
      port: device.porta || 80,
      login: device.configuracao?.login || 'admin',
      password: device.configuracao?.password || 'admin'
    })

    const base64Image = await client.getUserImage(numericId)
    if (!base64Image) {
      console.log(`[Portaria Webhook Image Sync] Nenhuma foto encontrada na catraca para o ID ${numericId}`)
      return
    }

    // 3. Atualizar cadastro do aluno correspondente no banco (busca por matricula)
    const { data: student } = await supabase
      .from('alunos')
      .select('id, nome')
      .eq('matricula', userIdStr)
      .maybeSingle()

    if (!student) {
      console.warn(`[Portaria Webhook Image Sync] Aluno com matrícula "${userIdStr}" não encontrado no ERP.`)
      return
    }

    const { error: updateErr } = await supabase
      .from('alunos')
      .update({
        foto: base64Image,
        updated_at: new Date().toISOString()
      })
      .eq('id', student.id)

    if (updateErr) {
      console.error(`[Portaria Webhook Image Sync] Erro ao salvar foto no Supabase para ${student.nome}:`, updateErr.message)
    } else {
      console.log(`✅ [Portaria Webhook Image Sync] Foto facial de "${student.nome}" sincronizada com sucesso do leitor para o ERP!`)
    }
  } catch (err: any) {
    console.error('[Portaria Webhook Image Sync Error]', err.message)
  }
}
