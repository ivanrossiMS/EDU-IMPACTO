import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { supabaseServer as supabase } from '@/lib/supabaseServer'
import { invalidateAlunosCache } from '@/lib/server/turmasGruposCache'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const { id } = await context.params

    // The ID could be the aluno's UUID, matricula, or dados.codigo
    // Try to find the student by any of these identifiers
    const { data: byId } = await supabase
      .from('alunos')
      .select('*')
      .or(`id.eq.${id},matricula.eq.${id}`)
      .limit(1)
      .maybeSingle()

    const student = byId || null

    if (!student) {
      return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 })
    }

    // Build all possible refs for this student to match aluno_responsavel
    const studentRefs = [
      student.id,
      student.matricula,
      student.dados?.codigo,
      student.matricula ? String(student.matricula) : null,
      student.dados?.codigo ? String(student.dados?.codigo) : null,
    ].filter(Boolean).map(r => String(r).trim())

    // Fetch the links for this student
    const { data: links } = await supabase
      .from('aluno_responsavel')
      .select('*')
      .in('aluno_id', studentRefs)

    let responsaveis: any[] = []

    if (links && links.length > 0) {
      const respIds = links.map((l: any) => l.responsavel_id).filter(Boolean)
      if (respIds.length > 0) {
        const { data: respData } = await supabase
          .from('responsaveis')
          .select('*')
          .in('id', respIds)

        responsaveis = (respData || [])
      }
    }

    const linkedResponsaveis = (links || []).filter((l: any) => studentRefs.includes(String(l.aluno_id).trim()))
      .map((l: any) => {
        const resp = responsaveis.find((r: any) => String(r.id).trim() === String(l.responsavel_id).trim()) || {}
        const d = resp.dados || {}
        const isPed = l.resp_pedagogico === true || l.tipo === 'pedagogico' || resp.isPedagogico === true
        const isFin = l.resp_financeiro === true || l.tipo === 'financeiro' || resp.isFinanceiro === true
        const isOut = l.resp_outro === true || l.tipo === 'outro' || l.tipo === 'outros' || resp.isOutro === true
        const parentesco = l.parentesco || resp.parentesco || (isPed ? 'Resp. Pedagógico' : (isFin ? 'Resp. Financeiro' : (isOut ? 'Outros' : 'Responsável')))

        return {
          ...resp,
          cpf: d.cpf || resp.cpf || '',
          rg: d.rg || resp.rg || '',
          rgOrgaoEmissor: d.rgOrgaoEmissor || d.orgEmissor || '',
          sexo: d.sexo || resp.sexo || '',
          estadoCivil: d.estadoCivil || resp.estado_civil || '',
          profissao: d.profissao || resp.profissao || '',
          nacionalidade: d.nacionalidade || 'Brasileira',
          naturalidade: d.naturalidade || '',
          naturalidadeUf: d.naturalidadeUf || '',
          cep: d.cep || '',
          endereco: d.endereco || d.logradouro || '',
          numero: d.numero || '',
          complemento: d.complemento || '',
          bairro: d.bairro || '',
          cidade: d.cidade || '',
          uf: d.uf || d.ufEnd || '',
          comercialEmpresa: d.comercialEmpresa || '',
          comercialTelefone: d.comercialTelefone || '',
          comercialCep: d.comercialCep || '',
          comercialEndereco: d.comercialEndereco || '',
          comercialNumero: d.comercialNumero || '',
          comercialComplemento: d.comercialComplemento || '',
          comercialBairro: d.comercialBairro || '',
          comercialCidade: d.comercialCidade || '',
          comercialUf: d.comercialUf || '',
          parentesco,
          isFinanceiro: isFin,
          respFinanceiro: isFin,
          isPedagogico: isPed,
          respPedagogico: isPed,
          isOutro: isOut,
          respOutro: isOut,
          dataNasc: resp.data_nasc || d.dataNasc || d.data_nasc || '',
          diasAcesso: resp.dias_acesso || d.diasAcesso || d.dias_acesso || ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'],
          proibido: resp.proibido === true,
        }
      }).filter((r: any) => r.id || r.nome)

    const fallbackResponsaveis = student.dados?.responsaveis || []

    let finalResponsaveis = linkedResponsaveis.length > 0 ? linkedResponsaveis : fallbackResponsaveis
    if (finalResponsaveis.length === 0) {
      const candidateText = (student.responsavel || student.responsavel_financeiro || student.responsavel_pedagogico || '').trim()
      if (candidateText && candidateText.toLowerCase() !== 'none' && candidateText.toLowerCase() !== 'nenhum') {
        const { data: matchedResp } = await supabase
          .from('responsaveis')
          .select('*')
          .ilike('nome', candidateText)
          .maybeSingle()

        if (matchedResp) {
          const d = matchedResp.dados || {}
          finalResponsaveis = [{
            ...matchedResp,
            cpf: d.cpf || matchedResp.cpf || '',
            rg: d.rg || matchedResp.rg || '',
            parentesco: 'mae',
            isFinanceiro: true,
            isPedagogico: true,
            isOutro: false
          }]
        } else {
          finalResponsaveis = [{
            id: '',
            nome: candidateText,
            parentesco: 'mae',
            isFinanceiro: true,
            isPedagogico: true,
            isOutro: false
          }]
        }
      }
    }

    let turmaInfo: any = null
    if (student.turma) {
      const { data: t } = await supabase.from('turmas').select('*').or(`id.eq.${student.turma},codigo.eq.${student.turma},nome.eq.${student.turma}`).limit(1).maybeSingle()
      turmaInfo = t
    }

    const formattedStudent = {
      ...student,
      ...(student.dados || {}),
      responsaveis: finalResponsaveis,
      turma_nome: turmaInfo?.nome || student.turma || '',
      turma_segmento: turmaInfo?.dados?.segmento || turmaInfo?.segmento || student.segmento || student.dados?.segmento || '',
      turma_anoLetivo: turmaInfo?.ano !== undefined ? String(turmaInfo.ano) : (student.anoLetivo || student.ano_letivo || student.dados?.anoLetivo || '')
    }

    return NextResponse.json({ data: formattedStudent })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = await request.json()
    
    const { email, telefone } = body

    const updates: any = {}
    if (email !== undefined) updates.email = email
    if (telefone !== undefined) updates.telefone = telefone

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nenhum dado para atualizar' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('alunos')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    invalidateAlunosCache()
    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
