import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { APIListQuerySchema, ZodAluno } from '@/lib/server/zodSchemas'

export const dynamic = 'force-dynamic'

// ─── Normaliza data: aceita DD/MM/AAAA ou YYYY-MM-DD → YYYY-MM-DD ou '' ───────────
function normDate(v: string | null | undefined): string | null {
  if (!v) return null
  const s = v.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return null // formato desconhecido — não mandar pro banco
}


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const serie = searchParams.get('serie')
    const status = searchParams.get('status')
    const q = searchParams.get('search') || searchParams.get('q')

    // 1. Zod Validation for queries
    const qParams = {
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
      search: q || undefined
    }
    const { page, limit, search } = APIListQuerySchema.parse(qParams)

    // 2. Supabase Authenticated (RLS Enforced)
    const supabase = await createProtectedClient()

    let query = supabase.from('alunos').select('*', { count: 'exact' }).order('nome')

    if (search) {
      // Sanitize search to prevent PostgREST filter injection (characters like . % ( ) could manipulate or() semantics)
      const safeSearch = search.replace(/[%_().,]/g, '')
      if (safeSearch.length > 0) {
        query = query.or(`nome.ilike.%${safeSearch}%,matricula.ilike.%${safeSearch}%,turma.ilike.%${safeSearch}%`)
      }
    }
    if (serie && serie !== 'Todos') query = query.eq('serie', serie)
    if (status && status !== 'Todos') query = query.eq('status', status)

    // 3. Paginação no nível de Banco de Dados (Prevenindo estouro de RAM)
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data, count, error } = await query

    if (error) throw new Error(error.message)

    // Merge dados JSONB para a estrutura flat da UI
    // CRITICAL: row.id must always win over dados.id (dados may contain stale/nested ids)
    const result = (data || []).map(row => {
      const { id: _ignoredId, ...dadosWithoutId } = row.dados || {}
      return { ...dadosWithoutId, ...row }
    })
    
    return NextResponse.json({
      data: result,
      meta: { total: count || 0, page, limit }
    }, { 
      headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=59' } 
    })
    
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const supabase = await createProtectedClient()

    if (Array.isArray(body)) {
      if (body.length === 0) return NextResponse.json({ ok: true, count: 0 })
      
      const rows = body.map(a => buildRowAuth(a)).filter(Boolean)
      if (rows.length === 0) return NextResponse.json({ ok: true, count: 0 })
      
      // Zod Batch Validation — usa safeParse para pular registros inválidos
      // em vez de abortar toda a operação com erro 400
      const validRows: any[] = []
      for (const r of rows) {
        const zodRes = ZodAluno.safeParse(r)
        if (zodRes.success) {
          validRows.push(zodRes.data)
        } else {
          const issues = zodRes.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
          console.warn('[POST /api/alunos batch] Pulando linha inválida:', issues, '| nome:', (r as any).nome?.slice?.(0, 30))
        }
      }
      if (validRows.length === 0) return NextResponse.json({ ok: true, count: 0 })
      
      const { error } = await supabase.from('alunos').upsert(validRows)
      if (error) throw new Error(error.message)
      
      return NextResponse.json({ ok: true, count: validRows.length })
    }

    const rawRow = buildRowAuth(body)
    if (!rawRow) throw new Error("O Aluno não pode ter nome vazio ou reservado.")
    
    // Zod Single Validation (safeParse para não abortar o flow em campos extras)
    const zodResult = ZodAluno.safeParse(rawRow)
    if (!zodResult.success) {
      const issues = zodResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
      console.error('[POST /api/alunos] Zod validation failed:', issues, '\nPayload:', JSON.stringify(rawRow).slice(0, 500))
      return NextResponse.json({ error: `Validação: ${issues}` }, { status: 400 })
    }
    const row = zodResult.data

    const { data, error } = await supabase.from('alunos').upsert(row).select().single()
    if (error) {
      console.error('[POST /api/alunos] Supabase upsert error:', error)
      throw new Error(error.message)
    }

    // =========================================================================
    // FASE C: SINCRONIZAÇÃO O(1) NA CRIAÇÃO DE ALUNOS
    // =========================================================================
    try {
      const rest = rawRow.dados;
      if (rest && rest.eventosFinanceiros && Array.isArray(rest.eventosFinanceiros)) {
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
    } catch(e) { console.error("Falha no interceptador ACID de parcelas v2", e) }

    // =========================================================================
    // FASE D: NORMALIZAÇÃO DE RESPONSÁVEIS E MATRÍCULAS (Proxy Relacional)
    // =========================================================================
    try {
      const rest = rawRow.dados;
      const responsaveisArray = rest?.responsaveis || [];
      const respsGerados: Record<string, string> = {};
      
      for (const resp of responsaveisArray) {
        if (!resp.nome || resp.nome.trim() === '') continue;
        
        const respRow = {
          id: resp.id || crypto.randomUUID(),
          nome: resp.nome,
          cpf: resp.cpf ? String(resp.cpf).replace(/\D/g, '') : null,
          email: resp.email || null,
          telefone: resp.celular || resp.telefone || null,
          codigo: resp.codigo || null,
          rfid: resp.rfid || null,
          profissao: resp.profissao || null,
          dados: resp
        };
        
        respsGerados[resp.nome.toLowerCase()] = respRow.id;
        if (!resp.id) resp.id = respRow.id; 
        
        await supabase.from('responsaveis').upsert(respRow);
        
        await supabase.from('aluno_responsavel').upsert({
          aluno_id: data.id,
          responsavel_id: respRow.id,
          parentesco: resp.parentesco || resp.tipo || 'Outro',
          resp_financeiro: !!resp.respFinanceiro,
          resp_pedagogico: !!resp.respPedagogico
        });
      }

      // rawRow.responsavel e rawRow.responsavel_financeiro agora vivem dentro de rawRow.dados
      // (foram movidos do flat row para o JSONB na última refatoração do buildRowAuth)
      const rawResponsavel = rawRow.dados?.responsavel || ''
      const rawResponsavelFinanceiro = rawRow.dados?.responsavel_financeiro || ''

      if (rawResponsavel && !respsGerados[rawResponsavel.toLowerCase()]) {
         const defId = crypto.randomUUID();
         await supabase.from('responsaveis').upsert({
           id: defId, nome: rawResponsavel, telefone: rawRow.telefone || null, dados: {}
         });
         await supabase.from('aluno_responsavel').upsert({
           aluno_id: data.id, responsavel_id: defId, parentesco: 'Responsável Primário',
           resp_financeiro: true, resp_pedagogico: true
         });
         respsGerados[rawResponsavel.toLowerCase()] = defId;
      }
      
      let vf_id = null;
      if (rawResponsavelFinanceiro && respsGerados[rawResponsavelFinanceiro.toLowerCase()]) {
         vf_id = respsGerados[rawResponsavelFinanceiro.toLowerCase()];
      } else {
         const foundFin = responsaveisArray.find((r:any) => r.respFinanceiro);
         if (foundFin && foundFin.id) vf_id = foundFin.id;
      }


      const matId = rest?.matricula_id || crypto.randomUUID();
      await supabase.from('matriculas').upsert({
         id: matId,
         aluno_id: data.id,
         responsavel_financeiro_id: vf_id,
         turma: rawRow.turma,
         serie: rawRow.serie,
         turno: rawRow.turno,
         status: rawRow.status,
         ano_letivo: new Date().getFullYear(),
         dados_contrato: {}
      });

      if (!rest.matricula_id) {
         rawRow.dados.matricula_id = matId;
         await supabase.from('alunos').update({ dados: rawRow.dados }).eq('id', data.id);
         data.dados = rawRow.dados;
      }

    } catch(e) { console.error("Falha na Sincronização Relacional de Matrículas/Responsáveis", e) }
    
    const { id: _pId, ...postDadosWithoutId } = data.dados || {}
    return NextResponse.json({ ...postDadosWithoutId, ...data }, { status: 201 })
  } catch (e: any) {
    const msg = e?.errors ? e.errors.map((i: any) => `${i.path?.join('.')}: ${i.message}`).join('; ') : (e?.message || String(e))
    console.error('[POST /api/alunos] catch:', msg)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    let id = searchParams.get('id')
    if (!id) {
       try {
          const body = await request.json()
          if (body && body.id) id = body.id
       } catch(e) {}
    }
    if (!id) return NextResponse.json({ error: 'ID faltando' }, { status: 400 })

    const supabase = await createProtectedClient()
    const { error } = await supabase.from('alunos').delete().eq('id', id)
    if (error) throw new Error(error.message)
    
    return NextResponse.json({ success: true, id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

function buildRowAuth(body: any) {
  const { id, nome, matricula, turma, serie, turno, status,
    email, cpf, dataNascimento, responsavel, responsavelFinanceiro,
    responsavelPedagogico, telefone, inadimplente, risco_evasao,
    media, frequencia, obs, unidade, foto, ...rest } = body

  if (!nome || nome.trim().length === 0 || nome.trim().toLowerCase() === 'aluno teste' || nome === 'cec' || nome === 'Rascunho Incompleto') {
    return null
  }

  // IMPORTANTE: A tabela alunos NÃO possui colunas responsavel, responsavel_financeiro,
  // responsavel_pedagogico. Esses dados são armazenados no campo JSONB 'dados'.
  // Incluir colunas inexistentes causa erro 400 no Supabase silenciosamente.
  const emailClean = email && email.trim() ? email.trim() : null
  const dataNasc = normDate(dataNascimento)

  return {
    id: id || crypto.randomUUID(),
    nome, matricula: matricula || '', turma: turma || '',
    serie: serie || '', turno: turno || '',
    status: status || 'matriculado',
    email: emailClean,
    cpf: cpf || null,
    data_nascimento: dataNasc,
    telefone: telefone || null,
    inadimplente: inadimplente || false,
    risco_evasao: risco_evasao || 'baixo',
    media: media ?? null,
    frequencia: frequencia ?? 100,
    obs: obs || null, unidade: unidade || '', foto: foto || null,
    dados: {
      ...rest,
      // Campos de responsável armazenados no JSONB
      responsavel: responsavel || '',
      responsavel_financeiro: responsavelFinanceiro || '',
      responsavel_pedagogico: responsavelPedagogico || '',
    },
  }
}

