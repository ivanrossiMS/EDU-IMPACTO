import { NextResponse } from 'next/server'
import {
  resolveUserRole,
  getAuthorizedAlunoIdsForUser,
  getAuthorizedResponsavelIdsForUser,
} from '@/lib/server/authGuard'
import { supabaseServer as supabase } from '@/lib/supabaseServer'
import { getAllAuthUsersCached } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'

/**
 * GET /api/aluno-responsavel?aluno_id=XXXX
 * Carrega responsáveis de um aluno na Agenda Digital com verificação de escopo.
 */
export async function GET(request: Request) {
  const { user, isStaff, errorResponse } = await resolveUserRole(request)
  if (errorResponse || !user) return errorResponse!

  try {
    const url = new URL(request.url)
    const alunoId = url.searchParams.get('aluno_id')
    const alunoIdsStr = url.searchParams.get('aluno_ids')

    const responsavelId = url.searchParams.get('responsavel_id')
    const mode = url.searchParams.get('mode')

    const allowedAlunoIds = !isStaff ? await getAuthorizedAlunoIdsForUser(user) : null
    const allowedRespIds = !isStaff ? await getAuthorizedResponsavelIdsForUser(user) : null
    const isAllowedAluno = (idVal: string) => {
      if (isStaff) return true
      if (!allowedAlunoIds) return false
      const clean = String(idVal).trim()
      const unpadded = clean.replace(/^0+/, '')
      return allowedAlunoIds.has(clean) || (Boolean(unpadded) && allowedAlunoIds.has(unpadded))
    }

    // ── Se fornecido responsavel_id ou mode=co_students, retorna os alunos vinculados ao responsável financeiro ──
    if (responsavelId || (alunoId && mode === 'co_students')) {
      if (!isStaff) {
        if (responsavelId && (!allowedRespIds || !allowedRespIds.has(String(responsavelId).trim()))) {
          return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
        }
        if (alunoId && !isAllowedAluno(alunoId)) {
          return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
        }
      }
      let targetRespIds: string[] = []
      if (responsavelId) {
        targetRespIds = [String(responsavelId).trim()]
      } else if (alunoId) {
        const { data: myLinks } = await supabase
          .from('aluno_responsavel')
          .select('responsavel_id, resp_financeiro')
          .eq('aluno_id', alunoId)

        if (myLinks && myLinks.length > 0) {
          const fin = myLinks.find((l: any) => l.resp_financeiro)
          if (fin?.responsavel_id) {
            targetRespIds = [String(fin.responsavel_id).trim()]
          } else {
            targetRespIds = myLinks.map((l: any) => String(l.responsavel_id).trim()).filter(Boolean)
          }
        }
      }

      if (targetRespIds.length === 0) {
        return NextResponse.json({ alunos: [] })
      }

      const { data: respLinks } = await supabase
        .from('aluno_responsavel')
        .select('aluno_id, parentesco, resp_financeiro')
        .in('responsavel_id', targetRespIds)

      if (!respLinks || respLinks.length === 0) {
        return NextResponse.json({ alunos: [] })
      }

      const linkedStudentIds = Array.from(
        new Set(respLinks.map((l: any) => String(l.aluno_id).trim()).filter(Boolean))
      )

      const { data: studentsData } = await supabase
        .from('alunos')
        .select('id, nome, matricula, turma, status, foto, dados')
        .or(`id.in.(${linkedStudentIds.join(',')}),matricula.in.(${linkedStudentIds.join(',')})`)

      const turmaIds = [...new Set((studentsData || []).map((s: any) => s.turma).filter(Boolean))]
      const turmasMap: Record<string, string> = {}
      if (turmaIds.length > 0) {
        const { data: turmasData } = await supabase
          .from('turmas')
          .select('id, codigo, nome')
          .in('id', turmaIds)

        if (turmasData) {
          turmasData.forEach((t: any) => {
            if (t.id) turmasMap[String(t.id)] = t.nome
            if (t.codigo) turmasMap[String(t.codigo)] = t.nome
          })
        }
      }

      const alunos = (studentsData || []).map((s: any) => {
        const l = respLinks.find(
          (link: any) =>
            String(link.aluno_id).trim() === String(s.id).trim() ||
            String(link.aluno_id).trim() === String(s.matricula).trim()
        )
        return {
          id: String(s.id),
          nome: s.nome,
          matricula: s.matricula || s.id,
          turma: turmasMap[String(s.turma)] || s.turma || 'Ensino Regular',
          status: s.status,
          foto: s.foto || s.dados?.foto || null,
          parentesco: l?.parentesco || 'Dependente',
          isFinanceiro: Boolean(l?.resp_financeiro),
        }
      })

      return NextResponse.json({ alunos })
    }

    let alunoIds: string[] = []
    if (alunoIdsStr) {
      alunoIds = alunoIdsStr.split(',').map(s => s.trim()).filter(Boolean)
    } else if (alunoId) {
      alunoIds = [alunoId.trim()]
    }

    if (!isStaff) {
      alunoIds = alunoIds.filter(isAllowedAluno)
      if (alunoIds.length === 0) {
        return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
      }
    }

    if (alunoIds.length === 0) {
      return NextResponse.json({ error: 'aluno_id, aluno_ids ou responsavel_id é obrigatório' }, { status: 400 })
    }

    // Build all possible refs for these students (id, matricula, codigo podem diferir)
    let refs: string[] = [...alunoIds]
    const refsMap: Record<string, string> = {}

    // Try to find the students to get all their refs
    const { data: students } = await supabase
      .from('alunos')
      .select('id, matricula, dados')
      .in('id', alunoIds)

    if (students && students.length > 0) {
      students.forEach(student => {
        const extraRefs = [
          student.id,
          student.matricula,
          student.dados?.codigo,
          student.matricula ? String(student.matricula) : null,
          student.dados?.codigo ? String(student.dados?.codigo) : null,
        ].filter(Boolean)
        
        extraRefs.forEach(r => {
          refsMap[r] = student.id
          if (!refs.includes(r)) refs.push(r)
        })
      })
    }

    // Fetch the links
    const { data: links, error: linksError } = await supabase
      .from('aluno_responsavel')
      .select('*')
      .in('aluno_id', refs)

    if (linksError) {
      return NextResponse.json({ error: linksError.message }, { status: 400 })
    }

    if (!links || links.length === 0) {
      if (alunoIdsStr) {
        return NextResponse.json({ responsaveisMap: {} })
      }
      return NextResponse.json({ responsaveis: [] })
    }

    // Fetch the actual responsavel records and cached Auth users in parallel
    const respIds = links.map((l: any) => l.responsavel_id).filter(Boolean)
    const [respQueryRes, authUsers] = await Promise.all([
      supabase.from('responsaveis').select('*').in('id', respIds),
      getAllAuthUsersCached().catch(() => [] as any[]),
    ])
    const respData = respQueryRes.data
    const respError = respQueryRes.error

    if (respError) {
      return NextResponse.json({ error: respError.message }, { status: 400 })
    }

    const enrichResp = (resp: any, link: any) => {
      const rIdStr = String(resp.id || link.responsavel_id || '').trim()
      const rIdClean = rIdStr.replace(/^0+/, '')
      const rEmail = String(resp.email || resp.dados?.email || '').toLowerCase().trim()
      const rCpf = String(resp.cpf || resp.dados?.cpf || '').replace(/\D/g, '')
      const rPhone = String(resp.telefone || resp.celular || resp.dados?.telefone || resp.dados?.celular || '')
      const rPhoneDigits = rPhone.replace(/\D/g, '').slice(-8)

      const authUser = (authUsers || []).find((u: any) => {
        if (resp.auth_id && String(u.id) === String(resp.auth_id)) return true
        const uEmail = String(u.email || u.user_metadata?.email || '').toLowerCase().trim()
        const uMetaRespId = String(u.user_metadata?.responsavel_id || u.user_metadata?.responsavelId || '').trim()
        const uCpf = String(u.user_metadata?.cpf || '').replace(/\D/g, '')
        const uPhoneDigits = String(u.phone || u.user_metadata?.telefone || u.user_metadata?.celular || '').replace(/\D/g, '').slice(-8)
        return (
          (rEmail && uEmail === rEmail) ||
          (uMetaRespId && (uMetaRespId === rIdStr || (rIdClean && uMetaRespId.replace(/^0+/, '') === rIdClean))) ||
          (rCpf.length >= 11 && uCpf.length >= 11 && rCpf === uCpf) ||
          (rPhoneDigits.length >= 8 && uPhoneDigits.length >= 8 && rPhoneDigits === uPhoneDigits)
        )
      })

      const ultimoAcesso = authUser?.last_sign_in_at || resp.ultimo_acesso || resp.dados?.ultimo_acesso || null
      const temContaAtiva = Boolean(
        authUser && (authUser.last_sign_in_at || authUser.user_metadata?.password_confirmed_at)
      )

      return {
        ...resp,
        cpf: resp.cpf || resp.dados?.cpf || '',
        telefone: resp.telefone || resp.celular || resp.dados?.telefone || resp.dados?.celular || '',
        email: resp.email || resp.dados?.email || authUser?.email || '',
        auth_id: resp.auth_id || authUser?.id || null,
        temContaAtiva,
        appInstalado: Boolean(temContaAtiva || resp.app_instalado || resp.appInstalado),
        ultimoAcesso,
        ultimo_acesso: ultimoAcesso,
        parentesco: link.parentesco,
        isFinanceiro: link.resp_financeiro,
        respFinanceiro: link.resp_financeiro,
        isPedagogico: link.resp_pedagogico,
        respPedagogico: link.resp_pedagogico,
        isOutro: link.resp_outro,
      }
    }

    // If multiple IDs requested, return a map
    if (alunoIdsStr) {
      const map: Record<string, any[]> = {}
      alunoIds.forEach(id => map[id] = [])
      
      links.forEach((l: any) => {
        const studentId = refsMap[l.aluno_id] || l.aluno_id
        if (!map[studentId]) map[studentId] = []
        
        const resp = (respData || []).find((r: any) => String(r.id).trim() === String(l.responsavel_id).trim()) || {}
        if (resp.id) {
          map[studentId].push(enrichResp(resp, l))
        }
      })
      
      // Remove empty entries or duplicates if any
      Object.keys(map).forEach(k => {
        map[k] = map[k].filter((r: any) => r.id)
      })

      return NextResponse.json({ responsaveisMap: map })
    }

    // If single ID requested (legacy logic for the modal)
    const refsStr = refs.map(r => String(r).trim())
    const responsaveis = links
      .filter((l: any) => refsStr.includes(String(l.aluno_id).trim()))
      .map((l: any) => {
        const resp = (respData || []).find((r: any) => String(r.id).trim() === String(l.responsavel_id).trim()) || {}
        return resp.id ? enrichResp(resp, l) : null
      })
      .filter(Boolean)

    return NextResponse.json({ responsaveis })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
