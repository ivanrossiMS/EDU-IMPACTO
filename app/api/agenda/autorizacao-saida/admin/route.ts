import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/server/authGuard'
import { createAdminClient } from '@/lib/server/supabaseServerFactory'
import { getCachedTurmasAndGrupos } from '@/lib/server/turmasGruposCache'
import { resolveStudentAutorizadoSairSozinho } from '@/lib/portariaUtils'
import { isValidStudentPhoto } from '@/lib/utils'
import {
  SCHOOL_TIMEZONE,
  formatDateTimeSchoolBR,
} from '@/lib/autorizacoes/saidaSozinhoUtils'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const url = new URL(request.url)
    const incluirSecretaria = url.searchParams.get('incluir_secretaria') === 'true'

    const supabase = createAdminClient()

    const [logsRes, alunosRes, turmasGrupos] = await Promise.all([
      supabase
        .from('logs_auditoria')
        .select('id, registro_id, acao, dados_novos, data_hora')
        .eq('tabela_nome', 'autorizacao_sair_sozinho')
        .order('data_hora', { ascending: false })
        .limit(600),
      supabase
        .from('alunos')
        .select('id, nome, matricula, turma, status, foto, foto_url, dados')
        .or('status.neq.inativo,status.is.null')
        .limit(5000),
      getCachedTurmasAndGrupos(),
    ])

    if (logsRes.error) {
      throw new Error(logsRes.error.message)
    }

    const allTurmas = turmasGrupos?.allTurmas || []
    const turmaNameMap = new Map<string, string>()
    for (const t of allTurmas) {
      const tNome = String(t?.nome || t?.dados?.nome || '').trim()
      if (!tNome) continue
      if (t.id) turmaNameMap.set(String(t.id).trim(), tNome)
      if (t.codigo) turmaNameMap.set(String(t.codigo).trim(), tNome)
      if (t.dados?.codigo) turmaNameMap.set(String(t.dados.codigo).trim(), tNome)
      turmaNameMap.set(tNome, tNome)
    }

    const resolveTurmaLabel = (rawTurma?: string | null): string => {
      const clean = String(rawTurma || '').trim()
      if (!clean) return 'Sem Turma'
      return turmaNameMap.get(clean) || clean.split('-')[0].trim() || clean
    }

    const alunosRows = alunosRes.data || []
    const alunoById = new Map<string, any>()
    for (const a of alunosRows) {
      if (a?.id) alunoById.set(String(a.id).trim(), a)
      if (a?.matricula) alunoById.set(String(a.matricula).trim(), a)
    }

    const todayYmd = new Intl.DateTimeFormat('en-CA', { timeZone: SCHOOL_TIMEZONE }).format(new Date())

    const seenAnyLogAluno = new Set<string>()
    const rawLogs = logsRes.data || []

    const mappedRegistros = rawLogs
      .map((row: any) => {
        const d = (row.dados_novos && typeof row.dados_novos === 'object') ? row.dados_novos : {}
        const alunoId = String(d.alunoId || row.registro_id || '').trim()
        if (!alunoId) return null

        const origem: 'agenda_digital' | 'gestao_alunos' =
          d.origem === 'gestao_alunos' || d.tipoAssinatura === 'institucional'
            ? 'gestao_alunos'
            : 'agenda_digital'

        const isLatestOverall = !seenAnyLogAluno.has(alunoId)
        seenAnyLogAluno.add(alunoId)

        if (!incluirSecretaria && origem !== 'agenda_digital') {
          return null
        }

        const student = alunoById.get(alunoId)
        const rawFoto =
          student?.foto ||
          student?.foto_url ||
          student?.dados?.foto ||
          student?.dados?.avatarUrl ||
          student?.dados?.fotoUrl ||
          null
        const alunoFoto = isValidStudentPhoto(rawFoto) ? rawFoto : null

        const dataHoraIso = d.dataHoraIso || row.data_hora
        const dataHoraFormatada = d.dataHoraFormatada || formatDateTimeSchoolBR(dataHoraIso)
        let logYmd = ''
        try {
          if (dataHoraIso) {
            logYmd = new Intl.DateTimeFormat('en-CA', { timeZone: SCHOOL_TIMEZONE }).format(new Date(dataHoraIso))
          }
        } catch {}

        const autorizado =
          typeof d.autorizado === 'boolean'
            ? d.autorizado
            : row.acao === 'AUTORIZAR_SAIDA_SOZINHO'

        const atualAutorizado = student
          ? resolveStudentAutorizadoSairSozinho(student, student.dados)
          : autorizado

        return {
          id: String(row.id),
          protocolo: d.protocolo || `IMP-SAIDA-${String(row.id).slice(0, 8).toUpperCase()}`,
          hashVerificacao: d.hashVerificacao || '',
          acao: row.acao || (autorizado ? 'AUTORIZAR_SAIDA_SOZINHO' : 'DESAUTORIZAR_SAIDA_SOZINHO'),
          autorizado,
          atualAutorizado,
          isRegistroVigente: isLatestOverall && atualAutorizado === autorizado,
          isHoje: logYmd === todayYmd,
          dataHoraIso,
          dataHoraFormatada,
          alunoId,
          alunoNome: String(student?.nome || d.alunoNome || 'Aluno').trim(),
          alunoMatricula: String(student?.matricula || d.alunoMatricula || student?.dados?.codigo || alunoId).trim(),
          alunoTurma: resolveTurmaLabel(student?.turma || student?.dados?.turma),
          alunoFoto,
          assinanteId: d.assinanteId || '',
          assinanteNome: String(d.assinanteNome || 'Responsável').trim(),
          assinanteParentesco: String(d.assinanteParentesco || 'Responsável Legal').trim(),
          assinanteEmail: d.assinanteEmail || '',
          assinanteCpfMascarado: d.assinanteCpfMascarado || '',
          tipoAssinatura: d.tipoAssinatura || 'caligrafica',
          estiloCaligrafico: d.estiloCaligrafico || 'classica',
          assinaturaTexto: d.assinaturaTexto || d.assinanteNome || '',
          assinaturaSvgPath: d.assinaturaSvgPath || null,
          assinaturaBase64: d.assinaturaBase64 || null,
          observacoes: d.observacoes || '',
          termoAceite: d.termoAceite || '',
          origem,
        }
      })
      .filter(Boolean) as any[]

    // Caso existam alunos com comprovante salvo direto em alunos.dados sem entrada correspondente retornada
    const seenByProtocol = new Set(mappedRegistros.map((r) => r.protocolo).filter(Boolean))
    for (const st of alunosRows) {
      const comp = st?.dados?.autorizacaoSairSozinhoComprovante
      if (!comp || !comp.protocolo || seenByProtocol.has(comp.protocolo)) continue
      const origem = comp.origem || (comp.tipoAssinatura === 'institucional' ? 'gestao_alunos' : 'agenda_digital')
      if (!incluirSecretaria && origem !== 'agenda_digital') continue

      const atualAutorizado = resolveStudentAutorizadoSairSozinho(st, st.dados)
      const rawFoto = st.foto || st.foto_url || st.dados?.foto || st.dados?.avatarUrl || st.dados?.fotoUrl || null
      const alunoFoto = isValidStudentPhoto(rawFoto) ? rawFoto : null
      let logYmd = ''
      try {
        if (comp.dataHoraIso) {
          logYmd = new Intl.DateTimeFormat('en-CA', { timeZone: SCHOOL_TIMEZONE }).format(new Date(comp.dataHoraIso))
        }
      } catch {}

      mappedRegistros.push({
        id: `dados-${st.id}-${comp.protocolo}`,
        protocolo: comp.protocolo,
        hashVerificacao: comp.hashVerificacao || '',
        acao: comp.acao,
        autorizado: Boolean(comp.autorizado),
        atualAutorizado,
        isRegistroVigente: atualAutorizado === Boolean(comp.autorizado),
        isHoje: logYmd === todayYmd,
        dataHoraIso: comp.dataHoraIso,
        dataHoraFormatada: comp.dataHoraFormatada || formatDateTimeSchoolBR(comp.dataHoraIso),
        alunoId: String(st.id),
        alunoNome: String(st.nome || comp.alunoNome || 'Aluno').trim(),
        alunoMatricula: String(st.matricula || comp.alunoMatricula || st.dados?.codigo || st.id).trim(),
        alunoTurma: resolveTurmaLabel(st.turma || st.dados?.turma),
        alunoFoto,
        assinanteId: comp.assinanteId || '',
        assinanteNome: String(comp.assinanteNome || 'Responsável').trim(),
        assinanteParentesco: String(comp.assinanteParentesco || 'Responsável Legal').trim(),
        assinanteEmail: comp.assinanteEmail || '',
        assinanteCpfMascarado: comp.assinanteCpfMascarado || '',
        tipoAssinatura: comp.tipoAssinatura || 'caligrafica',
        estiloCaligrafico: comp.estiloCaligrafico || 'classica',
        assinaturaTexto: comp.assinaturaTexto || comp.assinanteNome || '',
        assinaturaSvgPath: comp.assinaturaSvgPath || null,
        assinaturaBase64: comp.assinaturaBase64 || null,
        observacoes: comp.observacoes || '',
        termoAceite: comp.termoAceite || '',
        origem,
      })
    }

    mappedRegistros.sort((a, b) => {
      const ta = new Date(a.dataHoraIso || 0).getTime()
      const tb = new Date(b.dataHoraIso || 0).getTime()
      return tb - ta
    })

    // Situação atual consolidada por aluno (todos alunos com registro na Agenda Digital + visão geral)
    const latestAgendaByAluno = new Map<string, any>()
    for (const r of mappedRegistros) {
      if (!latestAgendaByAluno.has(r.alunoId)) {
        latestAgendaByAluno.set(r.alunoId, r)
      }
    }

    const alunosStatus = Array.from(latestAgendaByAluno.values())

    const totalAutorizacoes = mappedRegistros.filter((r) => r.autorizado).length
    const totalDesautorizacoes = mappedRegistros.filter((r) => !r.autorizado).length
    const vigentesAutorizados = alunosStatus.filter((s) => s.atualAutorizado).length
    const vigentesDesautorizados = alunosStatus.filter((s) => !s.atualAutorizado).length
    const registrosHoje = mappedRegistros.filter((r) => r.isHoje).length

    const turmasUnicas = Array.from(
      new Set(mappedRegistros.map((r) => r.alunoTurma).filter((t) => t && t !== 'Sem Turma'))
    ).sort((a, b) => a.localeCompare(b, 'pt-BR'))

    return NextResponse.json(
      {
        registros: mappedRegistros,
        alunosStatus,
        turmas: turmasUnicas,
        stats: {
          totalRegistros: mappedRegistros.length,
          totalAutorizacoes,
          totalDesautorizacoes,
          vigentesAutorizados,
          vigentesDesautorizados,
          registrosHoje,
          alunosComRegistro: alunosStatus.length,
        },
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch (err: any) {
    console.error('[Admin Autorizacoes Saida GET Error]:', err)
    return NextResponse.json(
      { error: err.message || 'Erro ao carregar autorizações de saída' },
      { status: 500 }
    )
  }
}
