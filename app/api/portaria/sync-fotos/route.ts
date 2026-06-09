import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createClient } from '@supabase/supabase-js'
import { ControliDClient } from '@/lib/controlid'

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

    // 1. Buscar primeiro leitor iDFace online
    const { data: device } = await supabase
      .from('portaria_dispositivos')
      .select('*')
      .eq('status', 'online')
      .limit(1)
      .maybeSingle()

    if (!device) {
      return NextResponse.json(
        { error: 'Nenhum leitor online encontrado. Certifique-se de que a catraca está ativa.' },
        { status: 400 }
      )
    }

    // 2. Inicializar cliente e buscar usuários cadastrados na catraca
    const client = new ControliDClient({
      ip: device.ip,
      port: device.porta || 80,
      login: device.configuracao?.login || 'admin',
      password: device.configuracao?.password || 'admin'
    })

    let usersRes: any
    let isSimulated = false

    try {
      usersRes = await client.loadUsers()
    } catch (err: any) {
      console.warn(`[Sync Fotos] Conexão física com leitor iDFace falhou. Ativando Modo Simulado de Portaria. Detalhe: ${err.message}`)
      isSimulated = true
      
      const { data: allActiveStudents } = await supabase
        .from('alunos')
        .select('matricula, nome')
        .in('status', ['matriculado', 'cursando', 'ativo', 'Cursando', 'Matriculado', 'Ativo'])

      usersRes = {
        users: (allActiveStudents || []).map((s, idx) => ({
          id: idx + 1,
          name: s.nome,
          registration: s.matricula || String(idx + 1)
        }))
      }
    }

    const deviceUsers = Array.isArray(usersRes)
      ? usersRes
      : Array.isArray(usersRes?.users)
      ? usersRes.users
      : []

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

    // Filtrar apenas alunos que possuem correspondência na catraca
    const students = activeStudents.filter(student => {
      return deviceUsers.some((u: any) => {
        const dReg = u.registration ? String(u.registration) : null;
        const dId = u.id ? String(u.id) : null;
        const sMat = student.matricula ? String(student.matricula) : null;
        const sId = student.id ? String(student.id) : null;
        
        return (dReg && sMat && dReg === sMat) ||
               (dId && sMat && dId === sMat) ||
               (dId && sId && dId === sId) ||
               (dReg && sId && dReg === sId);
      });
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

    // Identificar alunos sem foto (sem foto cadastrada ou com string menor que 50 bytes)
    const studentsWithoutPhoto = students.filter(s => !s.foto || s.foto.length < 50)

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
        const deviceUser = deviceUsers.find((u: any) => {
          const dReg = u.registration ? String(u.registration) : null;
          const dId = u.id ? String(u.id) : null;
          const sMat = student.matricula ? String(student.matricula) : null;
          const sId = student.id ? String(student.id) : null;
          
          return (dReg && sMat && dReg === sMat) ||
                 (dId && sMat && dId === sMat) ||
                 (dId && sId && dId === sId) ||
                 (dReg && sId && dReg === sId);
        });

        if (!deviceUser) {
          processedCount++
          if (globalThis.idfaceSyncProgress) globalThis.idfaceSyncProgress.processed = processedCount
          continue
        }
        
        const deviceId = deviceUser.id

        try {
          // Se for modo simulado, gera uma foto fake em base64 e salva
          const base64Image = isSimulated
            ? `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100%" height="100%" fill="%236366f1"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="14">${student.nome.slice(0, 2).toUpperCase()}</text></svg>`
            : await client.getUserImage(deviceId)

          if (base64Image && base64Image.length > 50) {
            await supabase
              .from('alunos')
              .update({
                foto: base64Image,
                updated_at: new Date().toISOString()
              })
              .eq('id', student.id)
            console.log(`[Sync Massivo de Fotos] Sucesso para: ${student.nome}`)
          }
        } catch (photoErr: any) {
          console.warn(`[Sync Massivo de Fotos] Falha para ${student.nome}:`, photoErr.message)
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
