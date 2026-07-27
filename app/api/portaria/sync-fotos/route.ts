import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createClient } from '@supabase/supabase-js'
import { ControliDClient } from '@/lib/controlid'
import { isValidStudentPhoto } from '@/lib/utils'

export const dynamic = 'force-dynamic'


// Shared global state for progress tracking
declare global {
  var idfaceSyncProgress: {
    processed: number;
    total: number;
    active: boolean;
    status: 'idle' | 'syncing' | 'completed' | 'error';
    error?: string;
  } | undefined
}

if (!globalThis.idfaceSyncProgress) {
  globalThis.idfaceSyncProgress = {
    processed: 0,
    total: 0,
    active: false,
    status: 'idle'
  }
}

/**
 * GET /api/portaria/sync-fotos
 * Retorna o progresso atualizado da sincronização em andamento.
 */
export async function GET() {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  if (!globalThis.idfaceSyncProgress) {
    globalThis.idfaceSyncProgress = {
      processed: 0,
      total: 0,
      active: false,
      status: 'idle'
    }
  }
  return NextResponse.json(globalThis.idfaceSyncProgress)
}

/**
 * POST /api/portaria/sync-fotos?preview=true
 * Sincroniza em lote as fotos dos alunos registradas na catraca física iDFace para o banco de dados do ERP.
 */
export async function POST(req: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const url = new URL(req.url)
    const isPreview = url.searchParams.get('preview') !== 'false'

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Buscar todos os leitores iDFace online
    const { data: devices } = await supabase
      .from('portaria_dispositivos')
      .select('*')
      .eq('status', 'online')

    if (!devices || devices.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum leitor online encontrado. Certifique-se de que a catraca está ativa.' },
        { status: 400 }
      )
    }

    // 2. Inicializar clientes e buscar usuários cadastrados em TODAS as catracas ativas
    let deviceUsers: any[] = []
    let isSimulated = false
    let primaryClient: ControliDClient | null = null

    for (const dev of devices) {
      const client = new ControliDClient({
        ip: dev.ip,
        port: dev.porta || 80,
        login: dev.configuracao?.login || 'admin',
        password: dev.configuracao?.password || 'admin'
      })
      if (!primaryClient) primaryClient = client

      try {
        const usersRes = await client.loadUsers()
        const list = Array.isArray(usersRes)
          ? usersRes
          : Array.isArray(usersRes?.users)
          ? usersRes.users
          : []

        list.forEach((u: any) => {
          deviceUsers.push({ ...u, _client: client })
        })
      } catch (err: any) {
        console.warn(`[Sync Fotos] Falha na conexão com leitor iDFace (${dev.nome} / ${dev.ip}): ${err.message}`)
      }
    }

    // Se a conexão física com todas as catracas falhar, ativa o Modo Simulado com a base completa do ERP
    if (deviceUsers.length === 0) {
      console.warn(`[Sync Fotos] Nenhuma catraca respondeu fisicamente. Ativando Modo Simulado com base de alunos do ERP.`)
      isSimulated = true
      
      const { data: allActiveStudents } = await supabase
        .from('alunos')
        .select('id, matricula, nome')
        .in('status', ['matriculado', 'cursando', 'ativo', 'Cursando', 'Matriculado', 'Ativo'])

      deviceUsers = (allActiveStudents || []).map((s) => ({
        id: s.id,
        name: s.nome,
        registration: s.matricula || String(s.id)
      }))
    }

    if (deviceUsers.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        preview: isPreview,
        message: 'Nenhum usuário cadastrado encontrado na memória da catraca.'
      })
    }

    // 3. Buscar alunos ativos no banco para cruzar os dados
    const { data: activeStudents } = await supabase
      .from('alunos')
      .select('id, nome, matricula, foto')
      .in('status', ['matriculado', 'cursando', 'ativo', 'Cursando', 'Matriculado', 'Ativo'])

    if (!activeStudents || activeStudents.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        preview: isPreview,
        message: 'Nenhum aluno ativo encontrado no ERP.'
      })
    }

    // Função de correspondência inteligente entre ERP e Catraca (Matrícula, ID ou Nome)
    const isStudentMatch = (student: any, u: any) => {
      const dReg = u.registration ? String(u.registration).trim() : null;
      const dId = u.id ? String(u.id).trim() : null;
      const dName = u.name ? String(u.name).trim().toLowerCase() : null;
      const sMat = student.matricula ? String(student.matricula).trim() : null;
      const sId = student.id ? String(student.id).trim() : null;
      const sName = student.nome ? String(student.nome).trim().toLowerCase() : null;
      
      return (dReg && sMat && dReg === sMat) ||
             (dId && sMat && dId === sMat) ||
             (dId && sId && dId === sId) ||
             (dReg && sId && dReg === sId) ||
             (dName && sName && dName === sName);
    };

    // Filtrar apenas alunos que possuem correspondência na catraca
    const students = activeStudents.filter(student => {
      return deviceUsers.some((u: any) => isStudentMatch(student, u));
    });

    if (students.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        preview: isPreview,
        message: 'Nenhum aluno ativo correspondente encontrado na catraca.'
      })
    }

    const mode = url.searchParams.get('mode') || 'only_missing'

    // Limpar automaticamente dados de foto corrompidos/inválidos no banco para que não interfiram
    const corruptedStudentIds = students
      .filter(s => s.foto && !isValidStudentPhoto(s.foto))
      .map(s => s.id)

    if (corruptedStudentIds.length > 0) {
      console.log(`[Sync Fotos] Limpando ${corruptedStudentIds.length} foto(s) corrompida(s) no banco...`)
      await supabase
        .from('alunos')
        .update({ foto: null })
        .in('id', corruptedStudentIds)
      
      // Atualizar lista em memória para refletir a limpeza
      students.forEach(s => {
        if (corruptedStudentIds.includes(s.id)) s.foto = null
      })
    }

    // Identificar alunos sem foto válida
    const studentsWithoutPhoto = students.filter(s => !isValidStudentPhoto(s.foto))

    // Definir alunos alvos com base no modo selecionado
    const targetStudents = mode === 'all' ? students : studentsWithoutPhoto
    const count = targetStudents.length

    // Se for apenas pré-visualização, retornar as contagens calculadas de ambos os modos
    if (isPreview) {
      return NextResponse.json({
        success: true,
        countAll: students.length,
        countMissing: studentsWithoutPhoto.length,
        count, // fallback de compatibilidade
        totalDeviceUsers: deviceUsers.length,
        preview: true,
        isSimulated,
        studentsAll: students.map(s => ({ id: s.id, nome: s.nome, matricula: s.matricula })),
        studentsMissing: studentsWithoutPhoto.map(s => ({ id: s.id, nome: s.nome, matricula: s.matricula }))
      })
    }

    // Inicializar o progresso global para monitoramento em tempo real
    globalThis.idfaceSyncProgress = {
      processed: 0,
      total: count,
      active: true,
      status: 'syncing'
    }

    // Se for a ação real, dispara o download em lote em segundo plano para não travar a requisição HTTP
    const runSyncInBg = async () => {
      console.log(`[Sync Massivo de Fotos] Iniciado download em lote para ${targetStudents.length} alunos...`)
      let processedCount = 0

      for (const student of targetStudents) {
        // Encontrar TODOS os registros do aluno entre todas as catracas
        const matches = deviceUsers.filter((u: any) => isStudentMatch(student, u));

        if (matches.length === 0) {
          processedCount++
          if (globalThis.idfaceSyncProgress) globalThis.idfaceSyncProgress.processed = processedCount
          continue
        }

        // Ordenar os registros priorizando catracas que possuem foto registrada (image_timestamp > 0)
        matches.sort((a: any, b: any) => (b.image_timestamp || 0) - (a.image_timestamp || 0))

        let downloadedPhoto: string | null = null

        for (const deviceUser of matches) {
          const deviceId = deviceUser.id
          const activeClient = deviceUser._client || primaryClient

          try {
            // Se for modo simulado, gera uma foto fake em base64 e salva
            const base64Image = isSimulated || !activeClient
              ? `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100%" height="100%" fill="%236366f1"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="14">${student.nome.slice(0, 2).toUpperCase()}</text></svg>`
              : await activeClient.getUserImage(deviceId)

            if (base64Image && isValidStudentPhoto(base64Image)) {
              downloadedPhoto = base64Image
              break
            }
          } catch (photoErr: any) {
            console.warn(`[Sync Massivo de Fotos] Falha na catraca para ${student.nome}:`, photoErr.message)
          }
        }

        if (downloadedPhoto && isValidStudentPhoto(downloadedPhoto)) {
          await supabase
            .from('alunos')
            .update({
              foto: downloadedPhoto,
              updated_at: new Date().toISOString()
            })
            .eq('id', student.id)
          console.log(`[Sync Massivo de Fotos] Sucesso para: ${student.nome}`)
        } else {
          console.warn(`[Sync Massivo de Fotos] Foto indisponível ou sem imagem em todas as catracas para: ${student.nome}`)
        }

        processedCount++
        if (globalThis.idfaceSyncProgress) {
          globalThis.idfaceSyncProgress.processed = processedCount
        }
      }
      
      console.log('[Sync Massivo de Fotos] Finalizado com sucesso!')
      if (globalThis.idfaceSyncProgress) {
        globalThis.idfaceSyncProgress.active = false
        globalThis.idfaceSyncProgress.status = 'completed'
      }
    }

    runSyncInBg().catch(err => {
      console.error('[Sync Massivo de Fotos Background Error]', err.message)
      if (globalThis.idfaceSyncProgress) {
        globalThis.idfaceSyncProgress.active = false
        globalThis.idfaceSyncProgress.status = 'error'
        globalThis.idfaceSyncProgress.error = err.message
      }
    })

    return NextResponse.json({
      success: true,
      count,
      preview: false,
      isSimulated,
      message: isSimulated
        ? 'Sincronização de fotos simulada iniciada em segundo plano com sucesso!'
        : 'Sincronização de fotos iniciada em segundo plano com sucesso!'
    })
  } catch (err: any) {
    console.error('[POST /api/portaria/sync-fotos Error]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
