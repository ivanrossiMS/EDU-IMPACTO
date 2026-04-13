import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import {
  ZodAlunoStepDados,
  ZodAlunoStepResponsaveis,
  ZodAlunoStepMatricula,
  ZodAlunoStepSaude,
  ZodAlunoStepFinanceiro,
} from '@/lib/server/zodSchemas'

export const dynamic = 'force-dynamic'

// PATCH /api/alunos/[id]/step — Atualiza parcialmente o aluno por step
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createProtectedClient()
    const { id } = params
    const body = await request.json()

    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
    if (!body.step) return NextResponse.json({ error: 'Campo "step" obrigatório no payload' }, { status: 400 })

    // Verifica existência do aluno
    const { data: alunoExistente, error: findErr } = await supabase
      .from('alunos')
      .select('id, dados, status')
      .eq('id', id)
      .maybeSingle()

    if (findErr) throw new Error(findErr.message)
    if (!alunoExistente) return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 })

    const dadosAtuais = alunoExistente.dados || {}

    // ── Step 1: Dados pessoais ──────────────────────────────────────────────
    if (body.step === 'dados') {
      const validated = ZodAlunoStepDados.parse(body)
      const { data, error } = await supabase
        .from('alunos')
        .update({
          nome: validated.nome,
          cpf: validated.cpf || alunoExistente.dados?.cpf || '',
          data_nascimento: validated.data_nascimento || '',
          email: validated.email || '',
          telefone: validated.telefone || '',
          status: validated.status || 'em_cadastro',
          ultimo_step: Math.max(validated.ultimo_step ?? 1, 1),
          dados: {
            ...dadosAtuais,
            sexo: validated.sexo,
            estado_civil: validated.estado_civil,
            nacionalidade: validated.nacionalidade,
            naturalidade: validated.naturalidade,
            uf: validated.uf,
            cor_raca: validated.cor_raca,
            id_censo: validated.id_censo,
            ...(validated.dados || {}),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single()

      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, step: 'dados', aluno: data })
    }

    // ── Step 2: Vínculos de responsáveis ────────────────────────────────────
    if (body.step === 'responsaveis') {
      const validated = ZodAlunoStepResponsaveis.parse(body)

      // Remove vínculos anteriores e recria (garante idempotência)
      if (validated.vinculos.length > 0) {
        await supabase.from('aluno_responsavel').delete().eq('aluno_id', id)

        const vinculos = validated.vinculos.map(v => ({
          aluno_id: id,
          responsavel_id: v.responsavel_id,
          parentesco: v.parentesco || null,
          tipo: v.tipo || null,
          resp_financeiro: v.resp_financeiro ?? false,
          resp_pedagogico: v.resp_pedagogico ?? false,
          prioridade: v.prioridade ?? 0,
        }))

        const { error: linkErr } = await supabase
          .from('aluno_responsavel')
          .insert(vinculos)

        if (linkErr) throw new Error(linkErr.message)
      }

      // Atualiza ultimo_step e referencias no aluno
      await supabase
        .from('alunos')
        .update({
          ultimo_step: Math.max(validated.ultimo_step ?? 2, 2),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      return NextResponse.json({ ok: true, step: 'responsaveis', count: validated.vinculos.length })
    }

    // ── Step 3: Matrícula ────────────────────────────────────────────────────
    if (body.step === 'matricula') {
      const validated = ZodAlunoStepMatricula.parse(body)

      // Tenta upsert em matriculas (one-per-aluno por ano letivo)
      const matId = dadosAtuais.matricula_id || crypto.randomUUID()

      const { error: matErr } = await supabase
        .from('matriculas')
        .upsert({
          id: matId,
          aluno_id: id,
          turma_id: validated.turma_id || null,
          turma: validated.turma || null,
          serie: validated.serie || null,
          turno: validated.turno || null,
          ano_letivo: validated.ano_letivo,
          data_matricula: validated.data_matricula || null,
          padrao_pagamento_id: validated.padrao_pagamento_id || null,
          situacao: validated.situacao || 'Aprovado',
          data_resultado: validated.data_resultado || null,
          grupo_alunos: validated.grupo_alunos || null,
          bolsista: validated.bolsista ?? false,
          responsavel_financeiro_id: validated.responsavel_financeiro_id || null,
          responsavel_pedagogico_id: validated.responsavel_pedagogico_id || null,
          status: 'Ativo',
        })

      if (matErr) throw new Error(matErr.message)

      // Atualiza campos de turma no aluno + salva matricula_id nos dados
      const { error: updErr } = await supabase
        .from('alunos')
        .update({
          turma: validated.turma || '',
          serie: validated.serie || '',
          turno: validated.turno || '',
          ultimo_step: Math.max(validated.ultimo_step ?? 3, 3),
          dados: { ...dadosAtuais, matricula_id: matId },
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (updErr) throw new Error(updErr.message)

      return NextResponse.json({ ok: true, step: 'matricula', matricula_id: matId })
    }

    // ── Step 4: Saúde e Obs ──────────────────────────────────────────────────
    if (body.step === 'saude') {
      const validated = ZodAlunoStepSaude.parse(body)

      const { error } = await supabase
        .from('alunos')
        .update({
          obs: validated.obs || dadosAtuais.obs || '',
          ultimo_step: Math.max(validated.ultimo_step ?? 4, 4),
          dados: {
            ...dadosAtuais,
            saude: validated.dados_saude || dadosAtuais.saude || {},
            obs: validated.obs,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw new Error(error.message)

      return NextResponse.json({ ok: true, step: 'saude' })
    }

    // ── Step 5: Financeiro ───────────────────────────────────────────────────
    if (body.step === 'financeiro') {
      const validated = ZodAlunoStepFinanceiro.parse(body)

      // Limpa eventos anteriores (idempotência)
      if (validated.eventos && validated.eventos.length > 0) {
        const { data: evtsAntigas } = await supabase
          .from('fin_eventos')
          .select('id')
          .eq('aluno_id', id)

        if (evtsAntigas && evtsAntigas.length > 0) {
          const evtIds = evtsAntigas.map((e: any) => e.id)
          await supabase.from('fin_parcelas').delete().in('evento_id', evtIds)
          await supabase.from('fin_eventos').delete().eq('aluno_id', id)
        }

        for (const ev of validated.eventos) {
          const { data: evtCriado, error: evtErr } = await supabase
            .from('fin_eventos')
            .insert({
              aluno_id: id,
              tipo: ev.tipo || 'mensalidade',
              descricao: ev.descricao || 'Receita',
              plano_contas_id: ev.planoContasId || null,
              valor_total: Number(ev.valorOriginal || ev.valor_total || 0),
              qtde_parcelas: ev.parcelas?.length || ev.qtde_parcelas || 1,
              status: 'ativo',
              dados_legados: ev,
            })
            .select()
            .single()

          if (evtErr) throw new Error(evtErr.message)

          if (evtCriado && ev.parcelas && ev.parcelas.length > 0) {
            const parcRows = ev.parcelas.map((p: any, idx: number) => ({
              evento_id: evtCriado.id,
              numero_parcela: p.num || p.numero || idx + 1,
              descricao: p.descricao || `${evtCriado.descricao} (${idx + 1}/${ev.parcelas.length})`,
              vencimento: p.vencimento || new Date().toISOString().split('T')[0],
              valor_original: Number(p.valor || p.valor_original || 0),
              desconto: Number(p.desconto || 0),
              juros: Number(p.juros || 0),
              multa: Number(p.multa || 0),
              valor_pago: (p.status === 'pago' || (p.valorPago && p.valorPago > 0))
                ? Number(p.valorPago || p.valor)
                : null,
              data_pagamento: p.dataPagamento || p.data_pagamento || null,
              status: p.status || 'pendente',
              dados_legados: p,
            }))

            await supabase.from('fin_parcelas').insert(parcRows)
          }
        }
      }

      // Atualiza obs financeira e ultimo_step
      await supabase
        .from('alunos')
        .update({
          ultimo_step: Math.max(validated.ultimo_step ?? 5, 5),
          dados: {
            ...dadosAtuais,
            obsFinanceira: validated.obs_financeira,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      return NextResponse.json({ ok: true, step: 'financeiro' })
    }

    return NextResponse.json({ error: `Step desconhecido: ${body.step}` }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.errors || e.message }, { status: 400 })
  }
}
