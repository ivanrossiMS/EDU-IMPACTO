'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useApp } from '@/lib/context'
import { useData } from '@/lib/dataContext'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { compareTurmasBySerie } from '@/lib/studentTurmaUtils'
import { getTurmaSchedule } from '@/lib/frequenciaEngine'
import { TurmaOption } from '../components/TurmaDropdown'

function normalizeStr(str: any): string {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function useCollaboratorTurmas(options?: { includeGroups?: boolean }) {
  const includeGroups = options?.includeGroups ?? false
  const { currentUser } = useApp()
  const searchParams = useSearchParams()
  const { turmas = [], turmasLoading = false, cfgCalendarioLetivo = [] } = useData()
  const { chatGroups = [] } = useAgendaDigital()
  const [colaboradores, , { loading: loadingColabs }] = useSupabaseArray<any>('configuracoes/usuarios')
  const [equipes = [], , { loading: loadingEquipes }] = useSupabaseArray<any>('agenda/equipes')

  const espelharColabId = searchParams?.get('espelhar_colaborador')
  const espelharColabNome = searchParams?.get('espelhar_nome')
  const espelharColabCargo = searchParams?.get('espelhar_cargo')
  const espelharColabPerfil = searchParams?.get('espelhar_perfil')
  const espelharColabFoto = searchParams?.get('espelhar_foto')
  const isMirrorMode = !!espelharColabId

  const mirroredColab = useMemo(() => {
    if (!isMirrorMode || !espelharColabId) return null
    const cleanId = String(espelharColabId).replace(/^f_?/, '').trim().toLowerCase()
    return (colaboradores || []).find((c: any) => {
      const cId = String(c.id || c.dados?.id || '').replace(/^f_?/, '').trim().toLowerCase()
      const cAuth = String(c.auth_id || c.dados?.auth_id || '').replace(/^f_?/, '').trim().toLowerCase()
      const cLegacy = String(c.uid_legacy || c.dados?.uid_legacy || '').replace(/^f_?/, '').trim().toLowerCase()
      return cId === cleanId || cAuth === cleanId || cLegacy === cleanId
    })
  }, [isMirrorMode, espelharColabId, colaboradores])

  const effectiveUser = useMemo(() => {
    if (isMirrorMode) {
      return {
        ...currentUser,
        id: espelharColabId,
        nome: espelharColabNome || mirroredColab?.nome || currentUser?.nome || 'Colaborador',
        cargo: espelharColabCargo || mirroredColab?.cargo || currentUser?.cargo || 'Colaborador',
        perfil: espelharColabPerfil || mirroredColab?.perfil || 'colaborador',
        foto: espelharColabFoto || mirroredColab?.foto || mirroredColab?.dados?.foto || null,
        email: mirroredColab?.email || mirroredColab?.dados?.email || '',
        auth_id: mirroredColab?.auth_id || mirroredColab?.dados?.auth_id || '',
        uid_legacy: mirroredColab?.uid_legacy || mirroredColab?.dados?.uid_legacy || ''
      }
    }
    return currentUser
  }, [isMirrorMode, espelharColabId, espelharColabNome, espelharColabCargo, espelharColabPerfil, espelharColabFoto, currentUser, mirroredColab])

  // Identificadores possíveis do colaborador (IDs, legado, auth_id, email, etc.)
  const candidateColabIds = useMemo(() => {
    const ids = new Set<string>()
    const addId = (val: any) => {
      if (!val) return
      const s = String(val).trim().toLowerCase()
      if (!s) return
      ids.add(s)
      const clean = s.replace(/^f_?/, '')
      if (clean) {
        ids.add(clean)
        ids.add(`f_${clean}`)
      }
    }

    if (isMirrorMode) {
      addId(espelharColabId)
      addId(effectiveUser?.id)
      addId((effectiveUser as any)?.auth_id)
      addId((effectiveUser as any)?.uid_legacy)
      addId(mirroredColab?.id)
      addId(mirroredColab?.dados?.id)
      addId(mirroredColab?.auth_id)
      addId(mirroredColab?.dados?.auth_id)
      addId(mirroredColab?.uid_legacy)
      addId(mirroredColab?.dados?.uid_legacy)
      addId(mirroredColab?.colaborador_id)
      addId(mirroredColab?.usuarioId)
    } else {
      addId(currentUser?.id)
      addId((currentUser as any)?.uid_legacy)
      addId((currentUser as any)?.auth_id)
      addId((currentUser as any)?.colaborador_id)
      addId((currentUser as any)?.system_user_id)
      addId((currentUser as any)?.usuarioId)
      addId((currentUser as any)?.dados?.id)
      addId((currentUser as any)?.dados?.auth_id)
      addId((currentUser as any)?.dados?.uid_legacy)

      const curEmail = String(currentUser?.email || (currentUser as any)?.dados?.email || '').trim().toLowerCase()
      const curCpf = String((currentUser as any)?.cpf || (currentUser as any)?.dados?.cpf || '').replace(/\D/g, '')
      const curNome = normalizeStr(currentUser?.nome || (currentUser as any)?.dados?.nome || '')

      ;(colaboradores || []).forEach((c: any) => {
        const cEmail = String(c.email || c.dados?.email || '').trim().toLowerCase()
        const cCpf = String(c.cpf || c.dados?.cpf || '').replace(/\D/g, '')
        const cNome = normalizeStr(c.nome || c.dados?.nome || '')
        const cId = String(c.id || c.dados?.id || '').trim().toLowerCase()
        const cLegacy = String(c.uid_legacy || c.dados?.uid_legacy || '').trim().toLowerCase()
        const cAuthId = String(c.auth_id || c.dados?.auth_id || '').trim().toLowerCase()

        const match = (
          (curEmail && cEmail && curEmail === cEmail) ||
          (curCpf && cCpf && curCpf === cCpf) ||
          (currentUser?.id && (cId === String(currentUser.id).toLowerCase() || cLegacy === String(currentUser.id).toLowerCase() || cAuthId === String(currentUser.id).toLowerCase())) ||
          (curNome && cNome && (curNome === cNome || curNome.includes(cNome) || cNome.includes(curNome)))
        )

        if (match) {
          addId(c.id)
          addId(c.dados?.id)
          addId(c.uid_legacy)
          addId(c.dados?.uid_legacy)
          addId(c.auth_id)
          addId(c.dados?.auth_id)
          addId(c.colaborador_id || c.dados?.colaborador_id)
          addId(c.usuarioId || c.dados?.usuarioId)
          addId(c.system_user_id || c.dados?.system_user_id)
        }
      })
    }

    return Array.from(ids)
  }, [colaboradores, effectiveUser, currentUser, isMirrorMode, espelharColabId, mirroredColab])

  // Helper para verificar se o colaborador atual é membro de um grupo de chatGroups
  const isColabMemberOfGroup = (g: any) => {
    if (!g) return false
    if (g.isGlobalAccess === true || g.isGlobalAccess === 'true' || g.isGlobalAccess === 1 || g.dados?.isGlobalAccess === true) {
      return true
    }
    const myNameNorm = normalizeStr(effectiveUser?.nome || currentUser?.nome || '')

    const checkList = (raw: any) => {
      if (!raw) return false
      let arr = raw
      if (typeof arr === 'string') {
        try { arr = JSON.parse(arr) } catch { arr = [arr] }
      }
      if (!Array.isArray(arr)) arr = [arr]
      return arr.some((item: any) => {
        if (!item) return false
        if (typeof item === 'object') {
          const itemId = String(item.id || item.usuarioId || item.colaborador_id || '').replace(/^f_?/, '').trim().toLowerCase()
          const itemNome = normalizeStr(item.nome || item.name || '')
          if (itemId && candidateColabIds.includes(itemId)) return true
          if (myNameNorm && itemNome && (itemNome === myNameNorm || itemNome.includes(myNameNorm) || myNameNorm.includes(itemNome))) return true
          return false
        }
        const s = String(item).trim().toLowerCase()
        const clean = s.replace(/^f_?/, '')
        if (candidateColabIds.includes(clean) || candidateColabIds.includes(s)) return true
        if (myNameNorm && (normalizeStr(s) === myNameNorm || normalizeStr(s).includes(myNameNorm) || myNameNorm.includes(normalizeStr(s)))) return true
        return false
      })
    }

    if (checkList(g.colaboradoresIds || g.dados?.colaboradoresIds)) return true
    if (checkList(g.funcionariosIds || g.dados?.funcionariosIds)) return true
    if (checkList(g.membrosIds || g.dados?.membrosIds)) return true
    if (checkList(g.usuariosIds || g.dados?.usuariosIds)) return true
    if (checkList(g.colaboradores || g.dados?.colaboradores)) return true
    if (checkList(g.professoresIds || g.dados?.professoresIds)) return true

    return false
  }

  // Grupos aos quais o colaborador está vinculado em agenda/grupos
  const userGroups = useMemo(() => {
    if (candidateColabIds.length === 0 && !effectiveUser?.nome) return []
    return (chatGroups || []).filter((g: any) => isColabMemberOfGroup(g))
  }, [chatGroups, candidateColabIds, effectiveUser, currentUser])

  // Determina se o usuário atual pertence à Equipe Escolar ou possui privilégios administrativos
  const isEquipeEscolar = useMemo(() => {
    if (!effectiveUser?.id && !currentUser?.id) return false

    // 1. Cargos ou Perfis de Gestão / Equipe Escolar
    const staffRoles = [
      'administrador master', 'administrador', 'admin', 'master',
      'diretor geral', 'diretora geral', 'diretor', 'diretora',
      'coordenador geral', 'coordenadora geral', 'coordenador', 'coordenadora',
      'coordenador pedagógico', 'coordenadora pedagógica', 'coordenacao', 'coordenação',
      'orientador', 'orientadora', 'orientador pedagógico', 'orientadora pedagógica',
      'secretaria', 'secretário', 'secretária',
      'inspetor', 'inspetora', 'inspetores',
      'apoio pedagógico', 'apoio', 'equipe escolar', 'institucional', 'gestor', 'gestora'
    ]
    const userPerfil = isMirrorMode
      ? String(effectiveUser?.perfil || '').toLowerCase().trim()
      : String(effectiveUser?.perfil || currentUser?.perfil || '').toLowerCase().trim()
    const userCargo = isMirrorMode
      ? String(effectiveUser?.cargo || '').toLowerCase().trim()
      : String(effectiveUser?.cargo || currentUser?.cargo || '').toLowerCase().trim()
    const userAcesso = isMirrorMode
      ? String((effectiveUser as any)?.acesso || '').toLowerCase().trim()
      : String((effectiveUser as any)?.acesso || (currentUser as any)?.acesso || '').toLowerCase().trim()

    const isTeacher = userCargo.includes('professor') || userPerfil.includes('professor')

    const hasStaffRole = !isTeacher && (
      staffRoles.some(r => userPerfil.includes(r) || userCargo.includes(r)) ||
      (userAcesso === 'institucional' && !isTeacher) ||
      Boolean((effectiveUser as any)?.isMasterAdmin || (!isMirrorMode && (currentUser as any)?.isMasterAdmin)) ||
      effectiveUser?.perfil === 'administrador' ||
      effectiveUser?.perfil === 'admin'
    )

    if (hasStaffRole) return true

    // 2. Vínculo do colaborador com algum grupo de Equipe Escolar em chatGroups
    const isInEquipeGroup = (chatGroups || []).some((g: any) => {
      const isEq = (
        g.isEquipeEscolar === true || g.isEquipeEscolar === 'true' || g.isEquipeEscolar === 1 || g.dados?.isEquipeEscolar === true ||
        g.isGlobalAccess === true || g.isGlobalAccess === 'true' || g.isGlobalAccess === 1 || g.dados?.isGlobalAccess === true ||
        String(g.ano || '').toLowerCase() === 'equipe escolar' ||
        String(g.categoria || '').toLowerCase().includes('equipe') ||
        String(g.nome || '').toLowerCase().includes('equipe escolar') ||
        String(g.nome || '').toLowerCase().includes('coordenação') ||
        String(g.nome || '').toLowerCase().includes('coordenacao') ||
        String(g.nome || '').toLowerCase().includes('direção') ||
        String(g.nome || '').toLowerCase().includes('direcao') ||
        String(g.nome || '').toLowerCase().includes('inspetor') ||
        String(g.nome || '').toLowerCase().includes('secretaria') ||
        String(g.nome || '').toLowerCase().includes('financeiro') ||
        String(g.nome || '').toLowerCase().includes('recepção') ||
        String(g.nome || '').toLowerCase().includes('recepcao')
      )

      if (!isEq) return false
      return isColabMemberOfGroup(g)
    })

    if (isInEquipeGroup) return true

    // 3. Vínculo do colaborador na tabela agenda/equipes
    const myNameNorm = normalizeStr(effectiveUser?.nome || currentUser?.nome || '')
    const isInAgendaEquipes = (equipes || []).some((eq: any) => {
      let membros = eq.membrosIds || eq.colaboradoresIds || eq.dados?.membrosIds || eq.dados?.colaboradoresIds || []
      if (typeof membros === 'string') {
        try { membros = JSON.parse(membros) } catch { membros = [] }
      }
      if (!Array.isArray(membros)) membros = []
      return membros.some((id: any) => {
        if (!id) return false
        if (typeof id === 'object') {
          const mId = String(id.id || id.usuarioId || '').replace(/^f_?/, '').trim().toLowerCase()
          const mNome = normalizeStr(id.nome || id.name || '')
          return (mId && candidateColabIds.includes(mId)) || (myNameNorm && mNome && mNome === myNameNorm)
        }
        const s = String(id).trim().toLowerCase()
        const clean = s.replace(/^f_?/, '')
        return candidateColabIds.includes(clean) || candidateColabIds.includes(s) || (myNameNorm && normalizeStr(s) === myNameNorm)
      })
    })

    return isInAgendaEquipes
  }, [effectiveUser, currentUser, candidateColabIds, chatGroups, equipes])

  // Retorna as turmas base: se for equipe escolar, todas as turmas; se for professor, apenas as vinculadas
  const baseTurmas = useMemo(() => {
    if (!effectiveUser?.id && !currentUser?.id) return []

    // Se o colaborador faz parte da Equipe Escolar, tem visão de todas as turmas escolares
    if (isEquipeEscolar) {
      return [...turmas].sort(compareTurmasBySerie)
    }

    const effNomeNorm = normalizeStr(effectiveUser?.nome || currentUser?.nome || '')
    const effTurmasIds = new Set<string>()

    // Vínculos explícitos no cadastro do colaborador/usuário
    const addExplicitTurmas = (obj: any) => {
      if (!obj) return
      const list = obj.turmasIds || obj.turmas || obj.dados?.turmasIds || obj.dados?.turmas
      if (Array.isArray(list)) {
        list.forEach((tId: any) => effTurmasIds.add(String(tId).trim()))
      } else if (typeof list === 'string') {
        try {
          const parsed = JSON.parse(list)
          if (Array.isArray(parsed)) parsed.forEach((tId: any) => effTurmasIds.add(String(tId).trim()))
          else effTurmasIds.add(list.trim())
        } catch {
          effTurmasIds.add(list.trim())
        }
      }
    }
    addExplicitTurmas(effectiveUser)
    addExplicitTurmas(currentUser)
    const matchingColab = (colaboradores || []).find((c: any) => 
      candidateColabIds.includes(String(c.id).trim().toLowerCase()) ||
      candidateColabIds.includes(String(c.id).replace(/^f_?/, '').trim().toLowerCase()) ||
      (effNomeNorm && normalizeStr(c.nome || c.dados?.nome) === effNomeNorm)
    )
    addExplicitTurmas(matchingColab)

    const matchedTurmas = turmas.filter((t: any) => {
      const tId = String(t.id).trim()
      const tCodigo = String(t.codigo || '').trim()
      const tNomeNorm = normalizeStr(t.nome || '')

      // 1. Vínculo explícito no cadastro
      if (effTurmasIds.has(tId) || (tCodigo && effTurmasIds.has(tCodigo))) {
        return true
      }

      // 2. Vínculo via chatGroups da turma (sync-${t.id} ou nome da turma)
      const matchGroup = userGroups.some((g: any) => {
        const gSyncId = String(g.syncId || '').replace(/^sync-/, '').trim()
        const gId = String(g.id || '').replace(/^sync-/, '').trim()
        const gTurmaId = String(g.turmaId || g.turma_id || g.dados?.turmaId || g.dados?.turma_id || '').trim()
        const gNomeNorm = normalizeStr(g.nome || '')

        return (
          (gSyncId && gSyncId === tId) ||
          (gId && gId === tId) ||
          (gTurmaId && gTurmaId === tId) ||
          (gNomeNorm && tNomeNorm && (gNomeNorm === tNomeNorm || gNomeNorm.includes(tNomeNorm) || tNomeNorm.includes(gNomeNorm)))
        )
      })
      if (matchGroup) return true

      // 3. Vínculo direto no registro da turma como professor
      const profId = String(t.professor_id || t.dados?.professor_id || t.professorId || '').replace(/^f_?/, '').trim().toLowerCase()
      if (profId && candidateColabIds.includes(profId)) return true

      const profNome = normalizeStr(t.professor || t.dados?.professor || '')
      if (profNome && effNomeNorm && (profNome === effNomeNorm || profNome.includes(effNomeNorm) || effNomeNorm.includes(profNome) || candidateColabIds.includes(profNome))) return true

      // t.professoresIds ou t.colaboradoresIds na turma
      const checkArrayOrString = (raw: any) => {
        if (!raw) return false
        let arr = raw
        if (typeof arr === 'string') {
          try { arr = JSON.parse(arr) } catch { arr = [arr] }
        }
        if (!Array.isArray(arr)) arr = [arr]
        return arr.some((id: any) => {
          if (!id) return false
          const clean = String(id).replace(/^f_?/, '').trim().toLowerCase()
          if (candidateColabIds.includes(clean)) return true
          const norm = normalizeStr(id)
          if (effNomeNorm && norm && (norm === effNomeNorm || norm.includes(effNomeNorm) || effNomeNorm.includes(norm))) return true
          return false
        })
      }
      if (checkArrayOrString(t.professoresIds || t.dados?.professoresIds)) return true
      if (checkArrayOrString(t.colaboradoresIds || t.dados?.colaboradoresIds)) return true

      // 4. Vínculo nas disciplinas da turma
      const disciplinas = t.disciplinas || t.dados?.disciplinas
      if (Array.isArray(disciplinas)) {
        const hasDisc = disciplinas.some((d: any) => {
          const dProfId = String(d.professorId || d.professor_id || d.funcionarioId || d.dados?.professorId || '').replace(/^f_?/, '').trim().toLowerCase()
          const dProfNome = normalizeStr(d.professorNome || d.professor_nome || d.professor || d.dados?.professor || '')
          return (dProfId && candidateColabIds.includes(dProfId)) || (effNomeNorm && dProfNome && (dProfNome === effNomeNorm || dProfNome.includes(effNomeNorm) || effNomeNorm.includes(dProfNome)))
        })
        if (hasDisc) return true
      }

      return false
    })

    return [...matchedTurmas].sort(compareTurmasBySerie)
  }, [turmas, userGroups, effectiveUser, currentUser, candidateColabIds, colaboradores, isEquipeEscolar])

  // Grupos vinculados ao colaborador (quando includeGroups está habilitado)
  const vinculatedGroups = useMemo(() => {
    if (!includeGroups) return []
    if (isEquipeEscolar) {
      return chatGroups || []
    }
    return userGroups
  }, [includeGroups, isEquipeEscolar, chatGroups, userGroups])

  const anosLetivos = useMemo(() => {
    const anos = new Set<string>()
    baseTurmas.forEach(t => {
      const anyT = t as any
      if (anyT.ano) anos.add(String(anyT.ano))
      if (anyT.ano_letivo) anos.add(String(anyT.ano_letivo))
      if (anyT.dados?.anoLetivo) anos.add(String(anyT.dados.anoLetivo))
    })
    if (includeGroups) {
      vinculatedGroups.forEach((g: any) => {
        const gAno = g.ano !== undefined ? String(g.ano) : (g.anoLetivo || g.ano_letivo || g.dados?.anoLetivo || '')
        if (gAno && gAno !== 'todos') anos.add(String(gAno))
      })
    }
    if (anos.size === 0) {
      cfgCalendarioLetivo.forEach((c: any) => c.ano && anos.add(String(c.ano)))
    }
    return Array.from(anos).sort().reverse()
  }, [baseTurmas, includeGroups, vinculatedGroups, cfgCalendarioLetivo])

  const anoVigente = useMemo(() => {
    const vigente = cfgCalendarioLetivo.find((c: any) => c.status === 'Aberto' || c.isVigente)
    return vigente ? String(vigente.ano) : (anosLetivos[0] || new Date().getFullYear().toString())
  }, [cfgCalendarioLetivo, anosLetivos])

  const [selectedAno, setSelectedAno] = useState<string>('')

  // Garante que o filtro do ano letivo venha selecionado com o ano vigente
  useEffect(() => {
    if (anoVigente && !selectedAno) {
      setSelectedAno(anoVigente)
    }
  }, [anoVigente, selectedAno])

  const effectiveAno = selectedAno || anoVigente || new Date().getFullYear().toString()

  const [selectedTurmaId, setSelectedTurmaId] = useState<string>('all')

  const turmasDoAno = useMemo(() => {
    if (effectiveAno === 'todos') return baseTurmas
    return baseTurmas.filter(t => {
      const anyT = t as any
      const tAno = anyT.ano !== undefined ? String(anyT.ano) : (anyT.anoLetivo || anyT.ano_letivo || anyT.dados?.anoLetivo || '')
      return String(tAno) === String(effectiveAno)
    })
  }, [baseTurmas, effectiveAno])

  // Grupos filtrados pelo ano letivo
  const groupsDoAno = useMemo(() => {
    if (!includeGroups) return []
    if (effectiveAno === 'todos') return vinculatedGroups
    return vinculatedGroups.filter((g: any) => {
      const gAno = g.ano !== undefined ? String(g.ano) : (g.anoLetivo || g.ano_letivo || g.dados?.anoLetivo || '')
      return !gAno || gAno === 'todos' || String(gAno) === String(effectiveAno)
    })
  }, [includeGroups, effectiveAno, vinculatedGroups])

  const activeTurmas = useMemo(() => {
    if (selectedTurmaId === 'all') return turmasDoAno
    if (selectedTurmaId.startsWith('grupo_')) return []
    return turmasDoAno.filter(t => String(t.id) === String(selectedTurmaId) || String(t.codigo) === String(selectedTurmaId))
  }, [turmasDoAno, selectedTurmaId])

  const activeGrupos = useMemo(() => {
    if (!includeGroups) return []
    if (selectedTurmaId === 'all') return groupsDoAno
    if (selectedTurmaId.startsWith('grupo_')) {
      const gId = selectedTurmaId.replace(/^grupo_/, '')
      return groupsDoAno.filter((g: any) => String(g.id) === gId || String(g.nome) === gId)
    }
    return []
  }, [includeGroups, selectedTurmaId, groupsDoAno])

  // Se a turma selecionada não pertencer mais às turmas/grupos do ano, reseta para 'all'
  useEffect(() => {
    if (selectedTurmaId !== 'all') {
      if (selectedTurmaId.startsWith('grupo_')) {
        const gId = selectedTurmaId.replace(/^grupo_/, '')
        const existsG = groupsDoAno.some((g: any) => String(g.id) === gId || String(g.nome) === gId)
        if (!existsG) setSelectedTurmaId('all')
      } else {
        const existsT = turmasDoAno.some(t => String(t.id) === String(selectedTurmaId) || String(t.codigo) === String(selectedTurmaId))
        if (!existsT) setSelectedTurmaId('all')
      }
    }
  }, [turmasDoAno, groupsDoAno, selectedTurmaId])

  const selectedTurmaName = useMemo(() => {
    if (baseTurmas.length === 0 && (!includeGroups || vinculatedGroups.length === 0)) return 'Nenhuma opção vinculada'
    if (selectedTurmaId === 'all') {
      if (includeGroups) {
        return isEquipeEscolar ? 'Todos (Equipe e Turmas)' : 'Todas as turmas e grupos'
      }
      return isEquipeEscolar ? 'Todas as Turmas' : 'Todas as turmas vinculadas'
    }
    if (selectedTurmaId.startsWith('grupo_')) {
      const gId = selectedTurmaId.replace(/^grupo_/, '')
      const foundG = (chatGroups || []).find((g: any) => String(g.id) === gId || String(g.nome) === gId)
      return foundG ? (foundG.nome || 'Grupo Selecionado') : 'Grupo Selecionado'
    }
    const found = turmasDoAno.find(t => String(t.id) === String(selectedTurmaId) || String(t.codigo) === String(selectedTurmaId))
    return found ? found.nome : 'Selecione uma turma'
  }, [selectedTurmaId, turmasDoAno, baseTurmas.length, isEquipeEscolar, includeGroups, vinculatedGroups.length, chatGroups])

  const turmaOptions: TurmaOption[] = useMemo(() => {
    const opts: TurmaOption[] = []
    const seenNames = new Set<string>()

    // 1. Turmas Acadêmicas
    turmasDoAno.forEach(t => {
      const anyT = t as any
      const schedule = getTurmaSchedule(t)
      const seg = anyT.dados?.segmento || anyT.segmento || schedule?.segmento || anyT.serie || ''
      opts.push({
        id: String(t.id),
        nome: t.nome,
        categoria: seg ? String(seg) : (isEquipeEscolar ? 'Turmas' : 'Minhas Turmas'),
        badge: t.turno ? String(t.turno) : undefined
      })
      seenNames.add(normalizeStr(t.nome))
    })

    // 2. Grupos de Atividades / Equipe Escolar (se includeGroups estiver habilitado)
    if (includeGroups) {
      groupsDoAno.forEach((g: any) => {
        const gName = String(g.nome || g.dados?.nome || '').trim()
        if (!gName) return

        // Se o grupo é espelho/sync de uma turma já incluída, evitar duplicidade
        const gSyncTurmaId = String(g.syncId || '').replace(/^sync-/, '').trim()
        if (gSyncTurmaId && turmasDoAno.some(t => String(t.id) === gSyncTurmaId)) return
        if (seenNames.has(normalizeStr(gName))) return

        const isEq = Boolean(
          g.isEquipeEscolar === true || g.isEquipeEscolar === 'true' || g.isEquipeEscolar === 1 || g.dados?.isEquipeEscolar === true ||
          String(g.ano || '').toLowerCase() === 'equipe escolar' ||
          String(g.categoria || '').toLowerCase().includes('equipe')
        )

        opts.push({
          id: `grupo_${g.id}`,
          nome: gName,
          categoria: isEq ? 'Equipe Escolar' : 'Meus Grupos',
          badge: isEq ? 'Equipe' : 'Grupo'
        })
      })
    }

    return opts
  }, [turmasDoAno, includeGroups, groupsDoAno, isEquipeEscolar])

  return {
    effectiveUser,
    isMirrorMode,
    isMasterAdmin: isEquipeEscolar,
    isEquipeEscolar,
    turmas: baseTurmas,
    turmasDoAno,
    userGroups,
    vinculatedGroups,
    groupsDoAno,
    activeTurmas,
    activeGrupos,
    turmaOptions,
    selectedTurmaId,
    setSelectedTurmaId,
    selectedTurmaName,
    selectedAno: effectiveAno,
    setSelectedAno,
    anosLetivos,
    anoVigente,
    isLoading: Boolean(turmasLoading || loadingColabs || loadingEquipes)
  }
}
