import { NextResponse } from 'next/server'
import { requireAuth, getAuthorizedAlunoIdsForUser, getAuthorizedResponsavelIdsForUser } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'
import { getColaboradorIds, getInstitutionalMasterAdminIds } from '@/lib/server/notificationHelper'

export const dynamic = 'force-dynamic'

function normalizeRole(str?: string | null): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const STAFF_KEYWORDS = [
  'diretor', 'diretora', 'direcao', 'administrador', 'admin', 'master',
  'coordenador', 'coordenadora', 'coordenacao', 'professor', 'professora',
  'docente', 'secretaria', 'secretario', 'auxiliar administrativo',
  'assistente', 'auxiliar', 'financeiro', 'tesouraria', 'portaria',
  'seguranca', 'inspetoria', 'inspetor', 'colaborador', 'funcionario'
];

async function checkIsStaffOrAuthor({
  user,
  supabase,
  comunicadoId,
  groupedAutorId,
  espelharColabId
}: {
  user: any;
  supabase: any;
  comunicadoId?: string | null;
  groupedAutorId?: string | null;
  espelharColabId?: string | null;
}): Promise<{ isStaff: boolean; isAuthor: boolean; canViewAllThreads: boolean }> {
  const perfil = user.user_metadata?.perfil || '';
  const cargo = user.user_metadata?.cargo || '';
  const pNorm = normalizeRole(perfil);
  const cNorm = normalizeRole(cargo);

  const hasStaffKeyword = STAFF_KEYWORDS.some(kw => pNorm.includes(kw) || cNorm.includes(kw));

  const isFamilyOrStudent = 
    (pNorm === 'familia' || pNorm === 'responsavel' || pNorm === 'aluno' || cNorm === 'responsavel' || cNorm === 'aluno') &&
    !user.user_metadata?.colaborador_id &&
    !user.user_metadata?.system_user_id &&
    !hasStaffKeyword;

  let isStaff = !isFamilyOrStudent && (
    hasStaffKeyword || 
    Boolean(user.user_metadata?.colaborador_id || user.user_metadata?.system_user_id || user.user_metadata?.uid_legacy)
  );

  let dbUserPerfil = '';
  let dbUserCargo = '';
  if (!isFamilyOrStudent) {
    try {
      const { data: dbUser } = await supabase
        .from('system_users')
        .select('id, perfil, cargo, status')
        .or(`id.eq."${user.id}",auth_id.eq."${user.id}",email.ilike."${user.email || ''}"`)
        .eq('status', 'ativo')
        .maybeSingle();

      if (dbUser) {
        isStaff = true;
        dbUserPerfil = normalizeRole(dbUser.perfil);
        dbUserCargo = normalizeRole(dbUser.cargo);
      }
    } catch (e) {
      console.warn('Erro ao checar system_users:', e);
    }
  }

  const perfisAdmin = ['diretor geral', 'administrador', 'admin', 'master'];
  const cargosAdmin = ['administrador master', 'diretor geral'];
  const isAdmin = isStaff && (
    perfisAdmin.includes(pNorm) ||
    cargosAdmin.includes(cNorm) ||
    perfisAdmin.includes(dbUserPerfil) ||
    cargosAdmin.includes(dbUserCargo) ||
    pNorm.includes('administrador master') ||
    cNorm.includes('administrador master') ||
    pNorm.includes('diretor geral') ||
    cNorm.includes('diretor geral')
  );

  let isAuthor = false;
  if (isStaff) {
    const effectiveEspelhar = isAdmin ? espelharColabId : null;
    const userCandidateIds = new Set<string>([
      String(user.id),
      String(user.id).replace(/^f_?/, ''),
      String(user.user_metadata?.colaborador_id || ''),
      String(user.user_metadata?.colaborador_id || '').replace(/^f_?/, ''),
      String(user.user_metadata?.system_user_id || ''),
      String(user.user_metadata?.system_user_id || '').replace(/^f_?/, ''),
      String(user.user_metadata?.uid_legacy || ''),
      String(user.user_metadata?.uid_legacy || '').replace(/^f_?/, ''),
      String(effectiveEspelhar || ''),
      String(effectiveEspelhar || '').replace(/^f_?/, '')
    ].filter(Boolean).map(s => s.toLowerCase()));

    if (groupedAutorId) {
      const gClean = String(groupedAutorId).replace(/^f_?/, '').toLowerCase();
      if (userCandidateIds.has(gClean)) {
        isAuthor = true;
      }
    }

    if (comunicadoId && !isAuthor) {
      try {
        const { data: comData } = await supabase
          .from('comunicados')
          .select('autor, dados')
          .eq('id', comunicadoId)
          .maybeSingle();

        if (comData) {
          const comAutorId = String(comData.dados?.autorId || comData.dados?.autor_id || '').replace(/^f_?/, '').toLowerCase();
          if (comAutorId && userCandidateIds.has(comAutorId)) {
            isAuthor = true;
          }
          const comAutorNome = normalizeRole(comData.autor || comData.dados?.autor || comData.dados?.autorNome);
          const userNome = normalizeRole(user.user_metadata?.nome || user.user_metadata?.name);
          if (comAutorNome && userNome && comAutorNome === userNome) {
            isAuthor = true;
          }
        }
      } catch (e) {
        console.warn('Erro ao checar autor do comunicado:', e);
      }
    }
  }

  const canViewAllThreads = Boolean(isAdmin || isAuthor);

  return { isStaff, isAuthor, canViewAllThreads };
}

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();
  const { searchParams } = new URL(request.url);
  const comunicadoId = searchParams.get('comunicado_id');
  const comunicadoIds = searchParams.get('comunicado_ids');
  const remetenteId = searchParams.get('remetente_id'); // If parent is viewing, they pass their ID to only see their chat
  const espelharColabId = searchParams.get('espelhar_colaborador');
  const adminParam = searchParams.get('admin') === 'true';

  let groupedAutorId = searchParams.get('grouped_autor_id');
  let groupedTime = searchParams.get('grouped_time');

  if (!comunicadoId && !comunicadoIds && !groupedAutorId) {
    return NextResponse.json({ error: 'comunicado_id or comunicado_ids is required' }, { status: 400 });
  }

  // Se for um comunicado de relatório agrupado (COLAB / TURMA), auto-detecta stuIds, autor e timestamp
  let resolvedReportStuIds: string[] = [];
  let parentAutorNorm = '';
  if (comunicadoId && comunicadoId.startsWith('AD-COM-REL-') && !comunicadoId.startsWith('AD-COM-REL-STU-')) {
    const { data: parentData } = await supabase
      .from('comunicados')
      .select('autor, created_at, dados')
      .eq('id', comunicadoId)
      .maybeSingle();

    if (parentData) {
      parentAutorNorm = normalizeRole(parentData.autor || parentData.dados?.autor || parentData.dados?.autorNome);
      if (Array.isArray(parentData.dados?.stuIds) && parentData.dados.stuIds.length > 0) {
        resolvedReportStuIds = parentData.dados.stuIds.map(String);
      }
      if (!groupedAutorId && parentData.dados?.autorId) {
        groupedAutorId = String(parentData.dados.autorId);
      }
      if (!groupedTime) {
        const idMatch = comunicadoId.match(/AD-COM-REL-[A-Za-z]+-(\d+)/);
        const colabTs = idMatch ? parseInt(idMatch[1], 10) : new Date(parentData.created_at || parentData.dados?.dataEnvio || 0).getTime();
        if (colabTs) groupedTime = String(colabTs);
      }
    }
  }

  // Verifica permissão institucional (staff) ou autoria do comunicado
  const { isStaff, canViewAllThreads } = await checkIsStaffOrAuthor({
    user,
    supabase,
    comunicadoId,
    groupedAutorId,
    espelharColabId
  });

  let query = supabase
    .from('comunicados_respostas')
    .select('*')
    .order('created_at', { ascending: true });

  if (resolvedReportStuIds.length > 0) {
    const idsArray = Array.from(new Set([...resolvedReportStuIds, ...(comunicadoId ? [comunicadoId] : [])]));
    query = query.in('comunicado_id', idsArray);
  } else if ((comunicadoId && comunicadoId.startsWith('AD-COM-REL-') && !comunicadoId.startsWith('AD-COM-REL-STU-')) || (groupedAutorId && groupedTime)) {
    // Busca os IDs dos relatórios filhos no banco por prefixo de timestamp e autor
    const idMatch = comunicadoId ? comunicadoId.match(/AD-COM-REL-[A-Za-z]+-(\d+)/) : null;
    const timeNum = (idMatch ? parseInt(idMatch[1], 10) : 0) || (groupedTime ? parseInt(groupedTime, 10) : 0);
    let idsArray: string[] = [];

    if (timeNum > 0) {
      const prefix = String(timeNum).substring(0, 7);
      const { data: relatedComs } = await supabase
        .from('comunicados')
        .select('id, autor, dados')
        .like('id', `AD-COM-REL-STU-${prefix}%`)
        .limit(300);

      idsArray = (relatedComs || [])
        .filter((c: any) => {
          const sMatch = String(c.id).match(/AD-COM-REL-STU-(\d+)/);
          const sTs = sMatch ? parseInt(sMatch[1], 10) : 0;
          if (!sTs || Math.abs(sTs - timeNum) >= 15000) return false;
          const sAutorNorm = normalizeRole(c.autor || c.dados?.autor || '');
          const sAutorId = String(c.dados?.autorId || '').replace(/^f_?/, '').toLowerCase();
          const gAutorClean = String(groupedAutorId || '').replace(/^f_?/, '').toLowerCase();
          if (parentAutorNorm && sAutorNorm) return parentAutorNorm === sAutorNorm;
          if (gAutorClean && sAutorId) return gAutorClean === sAutorId;
          return true;
        })
        .map((c: any) => String(c.id));
    }

    if (comunicadoId && !idsArray.includes(comunicadoId)) {
      idsArray.push(comunicadoId);
    }
    if (idsArray.length > 0) {
      query = query.in('comunicado_id', idsArray);
    } else {
      return NextResponse.json([]); // Nenhum filho encontrado, logo nenhuma conversa
    }
  } else if (comunicadoIds) {
    const idsArray = comunicadoIds.split(',').slice(0, 50); // Limitar a 50 IDs
    query = query.in('comunicado_id', idsArray);
  } else if (comunicadoId) {
    query = query.eq('comunicado_id', comunicadoId);
  }

  // Regra de privacidade:
  // Se o usuário pode ver todas as threads (autor ou admin) e solicitou admin=true (ou não passou remetente_id):
  // -> Ele vê todas as threads (adminThreads).
  // Se não puder ver todas as threads (família/aluno ou colaborador que NÃO é autor):
  // -> Filtra apenas a conversa pertencente ao próprio usuário (remetente ou destinatário).
  if (!canViewAllThreads || (!adminParam && remetenteId)) {
    const [authAlunoIds, authRespIds] = !isStaff
      ? await Promise.all([getAuthorizedAlunoIdsForUser(user), getAuthorizedResponsavelIdsForUser(user)])
      : [new Set<string>(), new Set<string>()];

    const effectiveEspelhar = isStaff ? espelharColabId : null;
    const userCandidateIds = new Set<string>([
      String(user.id),
      String(user.id).replace(/^f_?/, ''),
      String(user.user_metadata?.aluno_id || ''),
      String(user.user_metadata?.aluno_id || '').replace(/^f_?/, ''),
      String(user.user_metadata?.responsavel_id || ''),
      String(user.user_metadata?.responsavel_id || '').replace(/^f_?/, ''),
      ...(isStaff ? [
        String(user.user_metadata?.colaborador_id || ''),
        String(user.user_metadata?.colaborador_id || '').replace(/^f_?/, ''),
        String(user.user_metadata?.system_user_id || ''),
        String(user.user_metadata?.system_user_id || '').replace(/^f_?/, ''),
        String(user.user_metadata?.uid_legacy || ''),
        String(user.user_metadata?.uid_legacy || '').replace(/^f_?/, ''),
        String(effectiveEspelhar || ''),
        String(effectiveEspelhar || '').replace(/^f_?/, '')
      ] : []),
      ...Array.from(authAlunoIds),
      ...Array.from(authRespIds),
    ].filter(Boolean).map(s => s.toLowerCase()));

    let effectiveRemetente = remetenteId;
    if (!effectiveRemetente || (!canViewAllThreads && !userCandidateIds.has(effectiveRemetente.replace(/^f_?/, '').toLowerCase()))) {
      effectiveRemetente = user.user_metadata?.aluno_id || user.user_metadata?.responsavel_id || Array.from(authAlunoIds)[0] || Array.from(authRespIds)[0] || (isStaff ? (user.user_metadata?.colaborador_id || effectiveEspelhar) : null) || user.id;
    }

    const cleanRemetente = String(effectiveRemetente).replace(/^f_?/, '');
    query = query.or(`remetente_id.eq."${cleanRemetente}",remetente_id.eq."f_${cleanRemetente}"`);
  }

  const { data, error } = await query;
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Coleta nomes de administradores/colaboradores para buscar as fotos reais deles na tabela system_users
  const adminNames = Array.from(new Set(
    (data || [])
      .filter((r: any) => r.is_admin && r.remetente_nome)
      .map((r: any) => r.remetente_nome.trim())
  ));

  const systemUsersMap = new Map<string, { foto: string | null; id: string }>();
  if (adminNames.length > 0) {
    try {
      const { data: sysUsers } = await supabase
        .from('system_users')
        .select('id, nome, dados');
      
      if (sysUsers && Array.isArray(sysUsers)) {
        sysUsers.forEach((su: any) => {
          if (su && su.nome) {
            const foto = su.dados?.foto || null;
            systemUsersMap.set(normalizeRole(su.nome), { foto, id: su.id });
          }
        });
      }
    } catch (e) {
      console.warn('Erro ao buscar fotos de administradores em system_users:', e);
    }
  }

  const findAdminPhoto = (name?: string | null) => {
    if (!name) return null;
    const norm = normalizeRole(name);
    if (systemUsersMap.has(norm)) {
      return systemUsersMap.get(norm);
    }
    for (const [sNorm, sData] of systemUsersMap.entries()) {
      if (sNorm && norm && (sNorm.includes(norm) || norm.includes(sNorm))) {
        return sData;
      }
    }
    return null;
  };

  const formattedData = (data || []).map((row: any) => {
    let reacoes = Array.isArray(row.reacoes) ? row.reacoes : [];
    let anexos = Array.isArray(row.anexos) ? row.anexos : [];

    if (reacoes.length === 0 && anexos.length > 0) {
      const rxItem = anexos.find((a: any) => typeof a === 'object' && a !== null && a.__reactions__);
      if (rxItem && Array.isArray(rxItem.__reactions__)) {
        reacoes = rxItem.__reactions__;
      }
    }

    const authorItem = anexos.find((a: any) => typeof a === 'object' && a !== null && a.__author__);
    const authorMeta = authorItem?.__author__;

    const cleanAnexos = anexos.filter((a: any) => !(typeof a === 'object' && a !== null && (a.__reactions__ || a.__author__)));

    let autorFoto = authorMeta?.foto || null;
    let autorId = authorMeta?.id || null;

    if (!autorFoto && row.is_admin && row.remetente_nome) {
      const adminInfo = findAdminPhoto(row.remetente_nome);
      if (adminInfo) {
        autorFoto = adminInfo.foto || null;
        autorId = adminInfo.id || null;
      }
    }

    return {
      ...row,
      anexos: cleanAnexos,
      reacoes,
      autor_foto: autorFoto,
      autor_id: autorId
    };
  });

  return NextResponse.json(formattedData);
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const espelharColabId = body.espelhar_colaborador || searchParams.get('espelhar_colaborador');
    
    // Validate required fields
    if (!body.comunicado_id || !body.remetente_id || !body.conteudo) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Identifica se o remetente atua como autoridade escolar / staff
    const { canViewAllThreads } = await checkIsStaffOrAuthor({
      user,
      supabase,
      comunicadoId: body.comunicado_id,
      espelharColabId
    });
    const serverIsAdmin = canViewAllThreads;

    let finalComunicadoId = body.comunicado_id;

    // Se o admin responder a um relatorio agrupado, o frontend (que nao tem os filhos carregados)
    // enviara o ID do pai (COLAB). Precisamos encontrar o filho (STU) correspondente ao aluno.
    if (serverIsAdmin && finalComunicadoId.startsWith('AD-COM-REL-COLAB')) {
      const { data: parentCom } = await supabase
        .from('comunicados')
        .select('created_at, dados')
        .eq('id', finalComunicadoId)
        .single();
        
      if (parentCom && parentCom.dados && parentCom.dados.autorId) {
        const pTime = new Date(parentCom.created_at).getTime();
        const minDate = new Date(pTime - 15000).toISOString();
        const maxDate = new Date(pTime + 15000).toISOString();
        
        const { data: stus } = await supabase
          .from('comunicados')
          .select('id, dados')
          .like('id', 'AD-COM-REL-STU-%')
          .gte('created_at', minDate)
          .lte('created_at', maxDate);
          
        if (stus && stus.length > 0) {
          const child = stus.find(s => s.dados && s.dados.autorId === parentCom.dados.autorId && (s.dados.alunosIds || []).some((id: any) => String(id) === String(body.remetente_id)));
          if (child) {
            finalComunicadoId = child.id;
          }
        }
      }
    }

    // Se o admin tentar responder num report agrupado (pai), o frontend as vezes nao tem o ID do filho carregado
    // Vamos auto-resolver o ID do filho correspondente no servidor se possivel
    if (serverIsAdmin && finalComunicadoId.startsWith('AD-COM-REL-') && !finalComunicadoId.startsWith('AD-COM-REL-STU-') && body.remetente_id) {
      const { data: parentData } = await supabase.from('comunicados').select('created_at, dados').eq('id', finalComunicadoId).single();
      if (parentData) {
        const timeNum = new Date(parentData.created_at).getTime();
        const minTime = new Date(timeNum - 15000).toISOString();
        const maxTime = new Date(timeNum + 15000).toISOString();
        const parentAutorId = parentData.dados?.autorId;
        
        if (parentAutorId) {
          // Busca um filho deste autor naquele intervalo que contenha o remetente_id nos alunosIds
          const { data: relatedComs } = await supabase
            .from('comunicados')
            .select('id, dados')
            .eq('dados->>autorId', parentAutorId)
            .like('id', 'AD-COM-REL-STU%')
            .gte('created_at', minTime)
            .lte('created_at', maxTime);
            
          if (relatedComs) {
            const studentChild = relatedComs.find((c: any) => {
               const rawAlIds = c.dados?.alunosIds ?? c.alunosIds;
               const alIds = Array.isArray(rawAlIds) ? rawAlIds : (rawAlIds ? JSON.parse(rawAlIds) : []);
               return alIds.some((id: any) => String(id) === String(body.remetente_id));
            });
            if (studentChild) {
              finalComunicadoId = studentChild.id;
            }
          }
        }
      }
    }

    let authorFoto: string | null = null;
    let authorId: string = user.id;

    if (serverIsAdmin) {
      authorFoto = user.user_metadata?.foto || user.user_metadata?.fotoUrl || null;
      if (!authorFoto) {
        try {
          const { data: sysU } = await supabase
            .from('system_users')
            .select('id, dados')
            .or(`id.eq."${user.id}",auth_id.eq."${user.id}"${user.email ? `,email.ilike."${user.email}"` : ''}`)
            .maybeSingle();
          if (sysU?.dados?.foto) {
            authorFoto = sysU.dados.foto;
            authorId = sysU.id;
          }
        } catch {}
      }
      if (!authorFoto && body.remetente_nome) {
        try {
          const { data: sysByName } = await supabase
            .from('system_users')
            .select('id, dados')
            .ilike('nome', `%${body.remetente_nome.trim()}%`)
            .maybeSingle();
          if (sysByName?.dados?.foto) {
            authorFoto = sysByName.dados.foto;
            authorId = sysByName.id;
          }
        } catch {}
      }
    }

    const rawAnexos = Array.isArray(body.anexos) ? [...body.anexos] : [];
    if (serverIsAdmin) {
      rawAnexos.push({
        __author__: {
          id: authorId,
          nome: body.remetente_nome || user.user_metadata?.nome || 'Administrador',
          foto: authorFoto
        }
      });
    }

    const row = {
      comunicado_id: finalComunicadoId,
      remetente_id: body.remetente_id,
      remetente_nome: body.remetente_nome || 'Usuário',
      conteudo: body.conteudo,
      anexos: rawAnexos,
      is_admin: serverIsAdmin  // Determinado pelo servidor, não pelo cliente
    };

    const { data, error } = await supabase
      .from('comunicados_respostas')
      .insert(row)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // ── Notificações Push e In-App bidirecionais ──
    try {
      const msgTexto = body.conteudo.length > 50 ? body.conteudo.substring(0, 50) + '...' : body.conteudo;
      const remetenteNome = body.remetente_nome || user.user_metadata?.nome || user.user_metadata?.name || (serverIsAdmin ? 'A Escola' : 'Usuário');

      if (!serverIsAdmin) {
        // Responsável/Aluno respondeu -> Notifica a Escola (Autor original do comunicado + Colaboradores marcados)
        const { data: comData } = await supabase
          .from('comunicados')
          .select('titulo, autor, dados')
          .eq('id', finalComunicadoId)
          .single();
        
        if (comData) {
          const rawAutorId = comData.dados?.autorId || comData.dados?.autor_id || comData.dados?.authorId || comData.dados?.colaborador_id;
          const rawAutorName = String(comData.autor || comData.dados?.autor || '').trim();
          const markedColabs = [
            ...(comData.dados?.colaboradoresIds || []),
            ...(comData.dados?.funcionariosIds || [])
          ];
          const currentSenderIds = new Set([
            String(user.id),
            String(user.user_metadata?.colaborador_id || ''),
            String(user.user_metadata?.system_user_id || ''),
            String(body.remetente_id || '')
          ].filter(Boolean));

          const candidateColabTokens = new Set<string>(
            [rawAutorId, ...markedColabs].filter(Boolean).map(String)
          );

          // Se o comunicado antigo só tiver o nome do autor, resolve o ID pelo nome
          if (candidateColabTokens.size === 0 && rawAutorName) {
            const [{ data: byNameColab }, { data: byNameSys }] = await Promise.all([
              supabase.from('funcionarios').select('id, email, dados').ilike('nome', rawAutorName).limit(5),
              supabase.from('system_users').select('id, email, auth_id, dados').ilike('nome', rawAutorName).limit(5),
            ]);
            byNameColab?.forEach((c: any) => {
              if (c.id) candidateColabTokens.add(String(c.id));
              if (c.dados?.auth_id) candidateColabTokens.add(String(c.dados.auth_id));
              if (c.email) candidateColabTokens.add(String(c.email).toLowerCase());
            });
            byNameSys?.forEach((u: any) => {
              if (u.id) candidateColabTokens.add(String(u.id));
              if (u.auth_id) candidateColabTokens.add(String(u.auth_id));
              if (u.dados?.colaborador_id) candidateColabTokens.add(String(u.dados.colaborador_id));
              if (u.email) candidateColabTokens.add(String(u.email).toLowerCase());
            });
          }

          const allRelevantColabs = Array.from(candidateColabTokens)
            .filter(id => !currentSenderIds.has(String(id)));
          let targetUserIds: string[] = [];
          if (allRelevantColabs.length > 0) {
            const resolvedIds = await getColaboradorIds(allRelevantColabs);
            targetUserIds = Array.from(new Set([...resolvedIds, ...allRelevantColabs.map(String)]))
              .filter(id => !currentSenderIds.has(String(id)));
          }
          
          const colabTargetUrl = `/agenda-digital/colaborador/comunicados?id=${finalComunicadoId}`;

          if (targetUserIds.length > 0) {
            try {
              await sendAgendaPushNotification({
                type: 'comunicados',
                itemId: String(data.id), // ID único do comentário evita deduplicação indevida
                title: `💬 Resposta de ${remetenteNome}`,
                message: `No comunicado "${comData.titulo}": ${msgTexto}`,
                targetUserIds,
                targetUrl: colabTargetUrl,
                metadata: { perfil_destino: 'colaborador', item_id: String(finalComunicadoId), rota: 'comunicados', targetUrl: colabTargetUrl }
              });
            } catch (err) {
              console.error("Push erro:", err);
            }
          }
        }
      } else {
        // Escola respondeu -> Notifica o Pai/Aluno dono da thread (remetente_id da thread)
        const targetUserId = String(body.remetente_id || '').trim(); 
        if (targetUserId) {
          const { data: comData } = await supabase
            .from('comunicados')
            .select('titulo, dados')
            .eq('id', finalComunicadoId)
            .single();
            
          const tituloCom = comData ? comData.titulo : 'Comunicado';
          let targetAlunoId = body.aluno_id || comData?.dados?.aluno_id || (Array.isArray(comData?.dados?.targetStudents) && comData.dados.targetStudents.length === 1 ? comData.dados.targetStudents[0] : null);

          // Expandir todos os identificadores do responsável/aluno destinatário para garantir entrega 100% no OneSignal
          const expandedFamilyTargets = new Set<string>([targetUserId]);
          const cleanTargetId = targetUserId.replace(/^(?:a_|r_|resp_)/i, '').trim();
          if (cleanTargetId) expandedFamilyTargets.add(cleanTargetId);

          try {
            const isNumericId = /^\d+$/.test(cleanTargetId);
            const isUuidTarget = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanTargetId);
            const respOrFilter = isUuidTarget
              ? `id.eq.${cleanTargetId},auth_id.eq.${cleanTargetId}`
              : `id.eq.${cleanTargetId}`;
            const { data: respRows } = await supabase
              .from('responsaveis')
              .select('id, auth_id, email')
              .or(respOrFilter)
              .limit(5);

            const numericRespIds: string[] = [];
            respRows?.forEach((r: any) => {
              if (r.id) {
                expandedFamilyTargets.add(String(r.id));
                numericRespIds.push(String(r.id));
              }
              if (r.auth_id) expandedFamilyTargets.add(String(r.auth_id));
              if (r.email) expandedFamilyTargets.add(String(r.email).trim().toLowerCase());
            });
            if (isNumericId && !numericRespIds.includes(cleanTargetId)) {
              numericRespIds.push(cleanTargetId);
            }

            if (numericRespIds.length > 0) {
              const vincOrFilter = isNumericId
                ? `responsavel_id.in.(${numericRespIds.join(',')}),aluno_id.eq.${cleanTargetId}`
                : `responsavel_id.in.(${numericRespIds.join(',')})`;
              const { data: vincs } = await supabase
                .from('aluno_responsavel')
                .select('aluno_id, responsavel_id')
                .or(vincOrFilter);
              if (vincs && vincs.length > 0) {
                if (!targetAlunoId && vincs.length === 1 && vincs[0].aluno_id) {
                  targetAlunoId = String(vincs[0].aluno_id);
                }
                const extraRespIdsToFetch: string[] = [];
                vincs.forEach((v: any) => {
                  if (v.aluno_id) {
                    expandedFamilyTargets.add(String(v.aluno_id));
                    if (!targetAlunoId && String(v.aluno_id) === cleanTargetId) {
                      targetAlunoId = cleanTargetId;
                    }
                  }
                  if (v.responsavel_id) {
                    const rIdStr = String(v.responsavel_id);
                    expandedFamilyTargets.add(rIdStr);
                    if (!respRows?.some((r: any) => String(r.id) === rIdStr)) {
                      extraRespIdsToFetch.push(rIdStr);
                    }
                  }
                });
                if (extraRespIdsToFetch.length > 0) {
                  const { data: extraResps } = await supabase
                    .from('responsaveis')
                    .select('id, auth_id, email')
                    .in('id', Array.from(new Set(extraRespIdsToFetch)));
                  extraResps?.forEach((er: any) => {
                    if (er.id) expandedFamilyTargets.add(String(er.id));
                    if (er.auth_id) expandedFamilyTargets.add(String(er.auth_id));
                    if (er.email) expandedFamilyTargets.add(String(er.email).trim().toLowerCase());
                  });
                }
              }
            }
          } catch (expandErr) {
            console.warn('[comunicados_respostas] Aviso ao expandir IDs da família:', expandErr);
          }

          const studentUrl = targetAlunoId 
            ? `/agenda-digital/${targetAlunoId}/comunicados?id=${finalComunicadoId}`
            : `/agenda-digital/selecionar-aluno?redirect=comunicados&id=${finalComunicadoId}`;

          try {
            await sendAgendaPushNotification({
              type: 'comunicados',
              itemId: String(data.id),
              title: `🏫 Nova mensagem de ${remetenteNome}`,
              message: `Sobre "${tituloCom}": ${msgTexto}`,
              targetUserIds: Array.from(expandedFamilyTargets),
              targetUrl: studentUrl,
              metadata: { 
                perfil_destino: 'familia', 
                item_id: String(finalComunicadoId), 
                rota: 'comunicados', 
                targetUrl: studentUrl,
                ...(targetAlunoId ? { aluno_id: String(targetAlunoId) } : {})
              }
            });
          } catch (err) {
            console.error("Push erro:", err);
          }
        }
      }
    } catch (notifError) {
      console.error("Erro geral nas notificações de resposta:", notifError);
      // Nao damos throw para nao quebrar a insercao original da mensagem
    }

    // --- LÓGICA DE RESET DE LEITURA (NOVO/NÃO LIDO) ---
    try {
      const { data: comData } = await supabase.from('comunicados').select('id, created_at, dados').eq('id', finalComunicadoId).single();
      if (comData) {
        const comDados = comData.dados || {};
        let leituras = { ...(comDados.leituras || {}) };
        let usersToReset: string[] = [];

        if (!serverIsAdmin) {
           // Família respondeu. O autor e a equipe escolar devem ver como NÃO LIDO.
           const autorId = comDados.autorId;
           if (autorId) usersToReset.push(String(autorId));
           if (autorId && leituras[autorId]) delete leituras[autorId];
           // Remove todas as leituras da equipe/autor para garantir status Não Lido
           Object.keys(leituras).forEach(k => {
             if (k === autorId || k.startsWith('colab_') || k.startsWith('admin_')) {
               delete leituras[k];
             }
           });
        } else {
           // Equipe/Admin respondeu. A família/aluno precisa ver como NÃO LIDO.
           if (body.remetente_id) {
             const rId = String(body.remetente_id);
             usersToReset.push(rId);
             delete leituras[rId];
             Object.keys(leituras).forEach(k => {
               if (k === rId || k.includes(rId)) {
                 delete leituras[k];
               }
             });
           }
        }

        if (usersToReset.length > 0) {
          // Atualiza a coluna 'dados' de comunicados com o novo timestamp _last_reply e leituras atualizadas
          await supabase.from('comunicados').update({ 
            dados: { 
              ...comDados, 
              leituras, 
              _last_reply: new Date().toISOString() 
            } 
          }).eq('id', finalComunicadoId);
          
          // Deleta a leitura da tabela agenda_notification_reads também
          for (const uid of usersToReset) {
            if (!serverIsAdmin) {
               // Família respondeu, reseta para o admin / autor
               await supabase.from('agenda_notification_reads')
                 .delete()
                 .eq('content_id', finalComunicadoId)
                 .eq('usuario_id', uid);
            } else {
               // Admin respondeu, reseta para a família / aluno
               await supabase.from('agenda_notification_reads')
                 .delete()
                 .eq('content_id', finalComunicadoId)
                 .or(`usuario_id.eq.${uid},aluno_id.eq.${uid}`);
            }
          }

          // Se a resposta foi feita por uma família num child report, reseta o lido do PAI também pro Admin!
          if (!serverIsAdmin && finalComunicadoId.startsWith('AD-COM-REL-STU-')) {
             const autorId = comDados.autorId;
             if (autorId) {
               const timeNum = new Date(comData.created_at).getTime();
               if (timeNum > 0) {
                 const minTime = new Date(timeNum - 15000).toISOString();
                 const maxTime = new Date(timeNum + 15000).toISOString();
                 // Busca o pai
                 const { data: parentCom } = await supabase.from('comunicados')
                   .select('id, dados')
                   .eq('dados->>autorId', String(autorId))
                   .not('id', 'like', 'AD-COM-REL-STU-%')
                   .like('id', 'AD-COM-REL-%')
                   .gte('created_at', minTime)
                   .lte('created_at', maxTime)
                   .limit(1)
                   .single();
                   
                 if (parentCom && parentCom.dados) {
                   let parentLeituras = { ...(parentCom.dados.leituras || {}) };
                   if (parentLeituras[autorId]) delete parentLeituras[autorId];
                   await supabase.from('comunicados').update({ 
                     dados: {
                       ...parentCom.dados,
                       leituras: parentLeituras,
                       _last_reply: new Date().toISOString()
                     }
                   }).eq('id', parentCom.id);
                   
                   // Deleta do pai na nova tabela também
                   await supabase.from('agenda_notification_reads')
                     .delete()
                     .eq('content_id', parentCom.id)
                     .eq('usuario_id', autorId);
                 }
               }
             }
          }
        }
      }
    } catch (resetErr) {
      console.error("Erro ao resetar status LIDO:", resetErr);
    }

    const cleanAnexos = Array.isArray(data.anexos)
      ? data.anexos.filter((a: any) => !(typeof a === 'object' && a !== null && (a.__reactions__ || a.__author__)))
      : [];

    return NextResponse.json({
      ...data,
      anexos: cleanAnexos,
      reacoes: [],
      autor_foto: authorFoto,
      autor_id: authorId
    }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const { user, errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  try {
    const supabase = await createProtectedClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const espelharColabId = searchParams.get('espelhar_colaborador');

    if (!id) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }

    // Buscar a mensagem atual
    const { data: msg, error: fetchErr } = await supabase.from('comunicados_respostas').select('*').eq('id', id).single();
    
    if (fetchErr || !msg) {
      return NextResponse.json({ error: 'Mensagem não encontrada' }, { status: 404 });
    }

    // Identificar permissão institucional (staff) ou autoria do comunicado
    const { canViewAllThreads } = await checkIsStaffOrAuthor({
      user,
      supabase,
      comunicadoId: msg.comunicado_id,
      espelharColabId
    });
    const isAdmin = canViewAllThreads;

    const currentUserId = user.id;

    // Regras de exclusão:
    // 1. Staff / Admin / Autor pode excluir qualquer mensagem para moderação
    // 2. O aluno/família só pode excluir a PRÓPRIA mensagem.
    if (!isAdmin) {
      const allowedIds = [
        currentUserId,
        user.user_metadata?.aluno_id,
        user.user_metadata?.responsavel_id,
        user.user_metadata?.slug
      ].filter(Boolean).map(String);

      if (!allowedIds.includes(String(msg.remetente_id))) {
         return NextResponse.json({ error: 'Sem permissão para excluir esta mensagem' }, { status: 403 });
      }
    }

    const { error: delErr } = await supabase.from('comunicados_respostas').delete().eq('id', id);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 400 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
