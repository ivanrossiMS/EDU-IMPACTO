import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

// ─── Normaliza data: aceita DD/MM/AAAA ou YYYY-MM-DD → YYYY-MM-DD ou '' ───────
function normDate(v: string | null | undefined): string | null {
  if (!v) return null
  const s = v.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return null
}


export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createProtectedClient();
  const { id } = await params
  const { data, error } = await supabase.from('alunos').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  // CRITICAL: real row.id must win over any id stored inside dados JSONB
  const { id: _ignoredId, ...dadosWithoutId } = data.dados || {}
  return NextResponse.json({ ...dadosWithoutId, ...data })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createProtectedClient();
  const { id } = await params
  try {
    const body = await request.json()
    let existing = null;
    const { data: existingData, error: fetchErr } = await supabase.from('alunos').select('*').eq('id', id).single()
    if (!fetchErr && existingData) {
      existing = existingData;
    }

    const { nome, matricula, turma, serie, turno, status,
      email, cpf, dataNascimento, responsavel, responsavelFinanceiro,
      responsavelPedagogico, telefone, inadimplente, risco_evasao,
      media, frequencia, obs, unidade, foto, ...rest } = body

    let row;
    if (existing) {
      row = {
        id: id,
        nome: nome !== undefined ? nome : existing.nome,
        matricula: matricula !== undefined ? matricula : existing.matricula,
        turma: turma !== undefined ? turma : existing.turma,
        serie: serie !== undefined ? serie : existing.serie,
        turno: turno !== undefined ? turno : existing.turno,
        status: status !== undefined ? status : existing.status,
        email: email !== undefined ? (email?.trim() || null) : existing.email,
        cpf: cpf !== undefined ? (cpf?.trim() || null) : existing.cpf,
        data_nascimento: dataNascimento !== undefined ? normDate(dataNascimento) : existing.data_nascimento,
        telefone: telefone !== undefined ? (telefone?.trim() || null) : existing.telefone,
        inadimplente: inadimplente !== undefined ? inadimplente : existing.inadimplente,
        risco_evasao: risco_evasao !== undefined ? risco_evasao : existing.risco_evasao,
        media: media !== undefined ? media : existing.media,
        frequencia: frequencia !== undefined ? frequencia : existing.frequencia,
        obs: obs !== undefined ? (obs?.trim() || null) : existing.obs,
        unidade: unidade !== undefined ? unidade : existing.unidade,
        foto: foto !== undefined ? foto : existing.foto,
        // Campos de responsável vão para o JSONB dados (colunas não existem na tabela)
        dados: {
          ...(existing.dados || {}),
          ...rest,
          responsavel: responsavel !== undefined ? responsavel : (existing.dados?.responsavel || ''),
          responsavel_financeiro: responsavelFinanceiro !== undefined ? responsavelFinanceiro : (existing.dados?.responsavel_financeiro || ''),
          responsavel_pedagogico: responsavelPedagogico !== undefined ? responsavelPedagogico : (existing.dados?.responsavel_pedagogico || ''),
        },
      }
    } else {
      // Upsert full fallback if not in DB
      row = {
        id,
        nome: nome || '', matricula: matricula || '', turma: turma || '',
        serie: serie || '', turno: turno || '', status: status || 'matriculado',
        email: email?.trim() || null, cpf: cpf?.trim() || null,
        data_nascimento: normDate(dataNascimento),
        telefone: telefone?.trim() || null,
        inadimplente: inadimplente || false, risco_evasao: risco_evasao || 'baixo',
        media: media ?? null, frequencia: frequencia ?? 100,
        obs: obs?.trim() || null,
        unidade: unidade || '', foto: foto || null,
        dados: {
          ...rest,
          responsavel: responsavel || '',
          responsavel_financeiro: responsavelFinanceiro || '',
          responsavel_pedagogico: responsavelPedagogico || '',
        },
      }
    }


    const { data, error } = await supabase
      .from('alunos').upsert(row).select().single()

    if (error) {
      console.error("[app/api/alunos/[id]/route.ts] Supabase upsert error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // =========================================================================
    // FASE A & C: SINCRONIZAÇÃO FLAT SQL O(1) DE EVENTOS FINANCEIROS
    // =========================================================================
    try {
       if (rest.eventosFinanceiros && Array.isArray(rest.eventosFinanceiros)) {
          // Limpa eventos antigos para aquele Aluno (Cuidado: num sistema real, 
          // usariamos um Merge complexo, mas aqui o wizard é a fonte da verdade da V1)
          await supabase.from('fin_eventos').delete().eq('aluno_id', data.id)
          
          for (const ev of rest.eventosFinanceiros) {
             if (!ev.id) continue;
             const evtRet = await supabase.from('fin_eventos').insert({
                aluno_id: data.id,
                tipo: ev.detalheCurso ? 'matricula' : 'extra', 
                descricao: ev.descricao || 'Receita Diversa',
                plano_contas_id: ev.planoContasId || null,
                valor_total: Number(ev.valorOriginal || 0),
                qtde_parcelas: ev.parcelas ? ev.parcelas.length : 1,
                status: ev.status || 'ativo',
                dados_legados: ev,
             }).select().single()

             if (evtRet.data && ev.parcelas && ev.parcelas.length > 0) {
                const pacs = ev.parcelas.map((p: any, idx: number) => ({
                   evento_id: evtRet.data.id,
                   numero_parcela: p.num || idx + 1,
                   descricao: p.descricao || `${evtRet.data.descricao} (${p.num}/${ev.parcelas.length})`,
                   vencimento: p.vencimento || new Date().toISOString().split('T')[0],
                   valor_original: Number(p.valor || 0),
                   desconto: Number(p.desconto || 0),
                   juros: Number(p.juros || 0),
                   multa: Number(p.multa || 0),
                   valor_pago: (p.status === 'pago' || p.valorPago > 0) ? Number(p.valorPago || p.valor) : null,
                   data_pagamento: p.dataPagamento || null,
                   status: p.status || 'pendente',
                   dados_legados: p,
                }))
                await supabase.from('fin_parcelas').insert(pacs)
             }
          }
       }
    } catch(e) { console.error("Falha no interceptador ACID de parcelas", e) }

    const { id: _rId, ...putDadosWithoutId } = data.dados || {}
    return NextResponse.json({ ...putDadosWithoutId, ...data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createProtectedClient();
  const { id } = await params
  
  // Limpeza profunda em múltiplas tabelas para evitar travamento de RLS / FK Constraints Rejects
  const tables = ['titulos', 'ocorrencias', 'frequencias', 'agendamentos', 'contas_receber', 'matriculas']
  await Promise.all(tables.map(async t => {
    try { await supabase.from(t).delete().eq('alunoId', id) } catch(e) {}
    try { await supabase.from(t).delete().eq('aluno_id', id) } catch(e) {}
  }))
  
  // Exclusão principal forçando o retorno da row afetada
  const { data, error } = await supabase.from('alunos').delete().eq('id', id).select()
  
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  
  if (!data || data.length === 0) {
     return NextResponse.json({ error: "Aluno possui dependências blindadas ou já foi deletado do sistema." }, { status: 403 })
  }
  
  return NextResponse.json({ ok: true })
}
