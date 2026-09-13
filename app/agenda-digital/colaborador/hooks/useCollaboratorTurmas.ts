'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useApp } from '@/lib/context'
import { useData } from '@/lib/dataContext'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { compareTurmasBySerie } from '@/lib/studentTurmaUtils'
import { TurmaOption } from '../components/TurmaDropdown'

export function useCollaboratorTurmas() {
  const { currentUser } = useApp()
  const searchParams = useSearchParams()
  const { turmas = [], cfgCalendarioLetivo = [] } = useData()
  const { chatGroups = [] } = useAgendaDigital()
  const [colaboradores] = useSupabaseArray<any>('configuracoes/usuarios')

  const espelharColabId = searchParams?.get('espelhar_colaborador')
  const espelharColabNome = searchParams?.get('espelhar_nome')
  const espelharColabCargo = searchParams?.get('espelhar_cargo')
  const espelharColabPerfil = searchParams?.get('espelhar_perfil')
  const espelharColabFoto = searchParams?.get('espelhar_foto')
  const isMirrorMode = !!espelharColabId

  const effectiveUser = useMemo(() => {
    if (isMirrorMode) {
      return {
        ...currentUser,
        id: espelharColabId,
        nome: espelharColabNome || currentUser?.nome || 'Colaborador',
        cargo: espelharColabCargo || currentUser?.cargo || 'Colaborador',
        perfil: espelharColabPerfil || 'colaborador',
        foto: espelharColabFoto || null
      }
    }
    return currentUser
  }, [isMirrorMode, espelharColabId, espelharColabNome, espelharColabCargo, espelharColabPerfil, espelharColabFoto, currentUser])

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

    addId(effectiveUser?.id)
    addId((effectiveUser as any)?.uid_legacy)
    addId((effectiveUser as any)?.auth_id)
    addId(currentUser?.id)
    addId((currentUser as any)?.uid_legacy)
    addId((currentUser as any)?.auth_id)

    const effEmail = String(effectiveUser?.email || '').trim().toLowerCase()
    const effCpf = String((effectiveUser as any)?.cpf || '').replace(/\D/g, '')
    const effNome = String(effectiveUser?.nome || '').trim().toLowerCase()
    const curEmail = String(currentUser?.email || '').trim().toLowerCase()

    ;(colaboradores || []).forEach((c: any) => {
      const cEmail = String(c.email || '').trim().toLowerCase()
      const cCpf = String(c.cpf || '').replace(/\D/g, '')
      const cNome = String(c.nome || '').trim().toLowerCase()
      const cId = String(c.id || '').trim().toLowerCase()
      const cLegacy = String(c.uid_legacy || '').trim().toLowerCase()

      const match = (
        (effEmail && cEmail && effEmail === cEmail) ||
        (curEmail && cEmail && curEmail === cEmail) ||
        (effCpf && cCpf && effCpf === cCpf) ||
        (effectiveUser?.id && cId && (String(effectiveUser.id).toLowerCase() === cId || String(effectiveUser.id).toLowerCase() === cLegacy)) ||
        (effNome && cNome && effNome === cNome)
      )

      if (match) {
        addId(c.id)
        addId(c.uid_legacy)
        addId(c.auth_id)
      }
    })

    return Array.from(ids)
  }, [colaboradores, effectiveUser, currentUser])

  // Grupos de turma aos quais o colaborador está vinculado em agenda/grupos
  // (Exclui grupos globais gerais como "Geral" ou "Equipe Escolar" para NÃO associar todas as turmas indevidamente)
  const userGroups = useMemo(() => {
    if (candidateColabIds.length === 0) return []
    return (chatGroups || []).filter((g: any) => {
      if (g.isGlobalAccess === true || g.isGlobalAccess === 'true' || g.isGlobalAccess === 1) {
        return false
      }
      let colabs = g.colaboradoresIds || g.dados?.colaboradoresIds || g.funcionariosIds || g.dados?.funcionariosIds
      if (typeof colabs === 'string') {
        try { colabs = JSON.parse(colabs) } catch (e) { colabs = [] }
      }
      if (!Array.isArray(colabs)) colabs = []
      return colabs.some((id: any) => {
        const clean = String(id).replace(/^f_?/, '').trim().toLowerCase()
        return candidateColabIds.includes(clean) || candidateColabIds.includes(String(id).trim().toLowerCase())
      })
    })
  }, [chatGroups, candidateColabIds])

  // FILTRAGEM ESTRITA: Retorna SOMENTE as turmas às quais o colaborador está efetivamente vinculado
  const baseTurmas = useMemo(() => {
    if (!effectiveUser?.id) return []

    const effNome = String(effectiveUser.nome || '').trim().toLowerCase()
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
    const matchingColab = (colaboradores || []).find((c: any) => 
      candidateColabIds.includes(String(c.id).trim().toLowerCase()) ||
      candidateColabIds.includes(String(c.id).replace(/^f_?/, '').trim().toLowerCase())
    )
    addExplicitTurmas(matchingColab)

    const matchedTurmas = turmas.filter((t: any) => {
      const tId = String(t.id).trim()
      const tCodigo = String(t.codigo || '').trim()
      const tNome = String(t.nome || '').trim().toLowerCase()

      // 1. Vínculo explícito no cadastro
      if (effTurmasIds.has(tId) || (tCodigo && effTurmasIds.has(tCodigo))) {
        return true
      }

      // 2. Vínculo via chatGroups da turma (sync-${t.id} ou nome da turma)
      const matchGroup = userGroups.some((g: any) => {
        const gSyncId = String(g.syncId || '').replace(/^sync-/, '').trim()
        const gId = String(g.id || '').replace(/^sync-/, '').trim()
        const gTurmaId = String(g.turmaId || g.turma_id || g.dados?.turmaId || g.dados?.turma_id || '').trim()
        const gNome = String(g.nome || '').trim().toLowerCase()

        return (
          (gSyncId && gSyncId === tId) ||
          (gId && gId === tId) ||
          (gTurmaId && gTurmaId === tId) ||
          (gNome && gNome === tNome)
        )
      })
      if (matchGroup) return true

      // 3. Vínculo direto no registro da turma como professor
      const profId = String(t.professor_id || t.dados?.professor_id || t.professorId || '').replace(/^f_?/, '').trim().toLowerCase()
      if (profId && candidateColabIds.includes(profId)) return true

      const profNome = String(t.professor || t.dados?.professor || '').toLowerCase().trim()
      if (profNome && effNome && (profNome === effNome || candidateColabIds.includes(profNome))) return true

      // t.professoresIds ou t.colaboradoresIds na turma
      const checkArrayOrString = (raw: any) => {
        if (!raw) return false
        let arr = raw
        if (typeof arr === 'string') {
          try { arr = JSON.parse(arr) } catch { arr = [arr] }
        }
        if (!Array.isArray(arr)) arr = [arr]
        return arr.some((id: any) => {
          const clean = String(id).replace(/^f_?/, '').trim().toLowerCase()
          return candidateColabIds.includes(clean)
        })
      }
      if (checkArrayOrString(t.professoresIds || t.dados?.professoresIds)) return true
      if (checkArrayOrString(t.colaboradoresIds || t.dados?.colaboradoresIds)) return true

      // 4. Vínculo nas disciplinas da turma
      const disciplinas = t.disciplinas || t.dados?.disciplinas
      if (Array.isArray(disciplinas)) {
        const hasDisc = disciplinas.some((d: any) => {
          const dProfId = String(d.professorId || d.professor_id || d.funcionarioId || '').replace(/^f_?/, '').trim().toLowerCase()
          const dProfNome = String(d.professorNome || d.professor_nome || d.professor || '').trim().toLowerCase()
          return (dProfId && candidateColabIds.includes(dProfId)) || (dProfNome && effNome && dProfNome === effNome)
        })
        if (hasDisc) return true
      }

      return false
    })

    return [...matchedTurmas].sort(compareTurmasBySerie)
  }, [turmas, userGroups, effectiveUser, candidateColabIds, colaboradores])

  const anosLetivos = useMemo(() => {
    const anos = new Set<string>()
    baseTurmas.forEach(t => {
      const anyT = t as any
      if (anyT.ano) anos.add(String(anyT.ano))
      if (anyT.ano_letivo) anos.add(String(anyT.ano_letivo))
    })
    if (anos.size === 0) {
      cfgCalendarioLetivo.forEach((c: any) => c.ano && anos.add(String(c.ano)))
    }
    return Array.from(anos).sort().reverse()
  }, [baseTurmas, cfgCalendarioLetivo])

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

  const activeTurmas = useMemo(() => {
    if (selectedTurmaId === 'all') return turmasDoAno
    return turmasDoAno.filter(t => String(t.id) === String(selectedTurmaId) || String(t.codigo) === String(selectedTurmaId))
  }, [turmasDoAno, selectedTurmaId])

  // Se a turma selecionada não pertencer mais às turmas do ano, reseta para 'all'
  useEffect(() => {
    if (selectedTurmaId !== 'all') {
      const exists = turmasDoAno.some(t => String(t.id) === String(selectedTurmaId) || String(t.codigo) === String(selectedTurmaId))
      if (!exists) {
        setSelectedTurmaId('all')
      }
    }
  }, [turmasDoAno, selectedTurmaId])

  const selectedTurmaName = useMemo(() => {
    if (baseTurmas.length === 0) return 'Nenhuma turma vinculada'
    if (selectedTurmaId === 'all') return 'Todas as turmas vinculadas'
    const found = turmasDoAno.find(t => String(t.id) === String(selectedTurmaId) || String(t.codigo) === String(selectedTurmaId))
    return found ? found.nome : 'Selecione uma turma'
  }, [selectedTurmaId, turmasDoAno, baseTurmas.length])

  const turmaOptions: TurmaOption[] = useMemo(() => {
    return turmasDoAno.map(t => {
      const anyT = t as any
      const seg = anyT.dados?.segmento || anyT.segmento || anyT.serie || ''
      return {
        id: String(t.id),
        nome: t.nome,
        categoria: seg ? String(seg) : 'Geral',
        badge: t.turno ? String(t.turno) : undefined
      }
    })
  }, [turmasDoAno])

  return {
    effectiveUser,
    isMirrorMode,
    isMasterAdmin: false, // Força a visão estritamente restrita ao colaborador
    turmas: baseTurmas,
    turmasDoAno,
    activeTurmas,
    turmaOptions,
    selectedTurmaId,
    setSelectedTurmaId,
    selectedTurmaName,
    selectedAno: effectiveAno,
    setSelectedAno,
    anosLetivos,
    anoVigente
  }
}
