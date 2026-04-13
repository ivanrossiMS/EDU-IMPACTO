import { NextResponse, NextRequest } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { ZodResponsavel, APIListQuerySchema } from '@/lib/server/zodSchemas'

export const dynamic = 'force-dynamic'

// ─── Normaliza CPF (apenas dígitos, null se vazio) ────────────────────────────
function normCpf(v: string | null | undefined): string | null {
  const d = (v || '').replace(/\D/g, '')
  return d.length >= 11 ? d : null
}

// ─── Normaliza data: aceita DD/MM/AAAA ou YYYY-MM-DD → retorna YYYY-MM-DD ou null ──
function normDate(v: string | null | undefined): string | null {
  if (!v) return null
  const s = v.trim()
  // Já no formato ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // Formato DD/MM/AAAA
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  // Qualquer outro formato — não mandar para o banco (evita 400)
  return null
}


// ─── Monta row a partir do body ───────────────────────────────────────────────
// Extrai SOMENTE campos que existem como colunas reais na tabela `responsaveis`
function buildRow(body: any) {
  const { id, nome, cpf, rg, orgEmissor, org_emissor, sexo, dataNasc, data_nasc,
    email, telefone, celular, profissao, parentesco, tipo, naturalidade, uf,
    nacionalidade, estadoCivil, estado_civil, rfid, codigo, obs, endereco, dados,
    alunos_vinculados, ...rest } = body

  const nomeFinal = (nome || '').trim()
  if (nomeFinal.length < 2) return null

  return {
    id:           id || undefined,
    nome:         nomeFinal,
    cpf:          normCpf(cpf),
    rg:           rg || null,
    org_emissor:  orgEmissor || org_emissor || null,
    sexo:         sexo || null,
    data_nasc:    normDate(dataNasc || data_nasc),
    email:        email || null,
    telefone:     telefone || null,
    celular:      celular || null,
    profissao:    profissao || null,
    naturalidade: naturalidade || null,
    uf:           uf || null,
    nacionalidade:nacionalidade || 'Brasileira',
    estado_civil: estadoCivil || estado_civil || null,
    rfid:         rfid || null,
    codigo:       codigo || null,
    obs:          obs || null,
    endereco:     endereco || {},
    // parentesco e tipo NÃO são colunas — pertencem ao vínculo aluno_responsavel
    // Guardamos no JSONB para referência futura caso necessário
    dados:        { ...dados, parentesco: parentesco || null, tipo: tipo || null, ...rest },
  }
}

// ─── Tenta vincular responsável a aluno (tolerante a falhas de FK) ─────────────
async function tryLinkAlunos(
  supabase: any,
  responsavelId: string,
  body: any,
  dadosResp: any
) {
  if (!body.alunos_vinculados || !Array.isArray(body.alunos_vinculados) || body.alunos_vinculados.length === 0) return

  for (const vinculo of body.alunos_vinculados) {
    const alunoId = vinculo.aluno_id || vinculo.id
    if (!alunoId) continue

    // Verifica se o aluno existe ANTES de tentar o upsert (evita FK violation)
    const { data: alunoExiste } = await supabase
      .from('alunos')
      .select('id')
      .eq('id', alunoId)
      .maybeSingle()

    if (!alunoExiste) {
      console.log(`[responsaveis] Aluno ${alunoId} não existe ainda — vínculo será criado depois.`)
      continue
    }

    const { error } = await supabase.from('aluno_responsavel').upsert({
      aluno_id: alunoId,
      responsavel_id: responsavelId,
      parentesco: vinculo.parentesco || dadosResp?.parentesco || 'Outro',
      tipo: vinculo.tipo || dadosResp?.tipo || 'outro',
      resp_pedagogico: vinculo.resp_pedagogico ?? dadosResp?.respPedagogico ?? false,
      resp_financeiro: vinculo.resp_financeiro ?? dadosResp?.respFinanceiro ?? false,
      prioridade: vinculo.prioridade || 1
    }, { onConflict: 'aluno_id,responsavel_id' })

    if (error) {
      console.error(`[responsaveis] Erro ao vincular aluno ${alunoId}:`, error.message)
    }
  }
}

// ─── GET: busca responsáveis ───────────────────────────────────────────────────
// ?q=texto   busca por nome/CPF/email/celular
// ?aluno_id= lista vínculos de um aluno específico
// ?id=       busca um responsável por ID
export async function GET(request: NextRequest) {
  try {
    const supabase = await createProtectedClient()
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || searchParams.get('search') || ''
    const alunoId = searchParams.get('aluno_id')
    const singleId = searchParams.get('id')

    const { page, limit } = APIListQuerySchema.parse({
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '200',
    })

    // Busca por ID único
    if (singleId) {
      const { data, error } = await supabase
        .from('responsaveis').select('*').eq('id', singleId).single()
      if (error) return NextResponse.json({ error: error.message }, { status: 404 })
      return NextResponse.json(data)
    }

    // Busca vínculos de um RESPONSÁVEL (aluno_id_of = responsavel_id)
    const responsavelIdOf = searchParams.get('aluno_id_of')
    if (responsavelIdOf) {
      const { data, error } = await supabase
        .from('aluno_responsavel')
        .select('*, aluno:alunos(id, nome, turma, serie, frequencia, inadimplente, risco_evasao, foto, dados)')
        .eq('responsavel_id', responsavelIdOf)
        .order('prioridade')
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json(data || [])
    }

    // Lista vinculados a um aluno específico
    if (alunoId) {
      const { data, error } = await supabase
        .from('aluno_responsavel')
        .select('*, responsavel:responsaveis!fk_ar_responsavel(*)')
        .eq('aluno_id', alunoId)
        .order('created_at')
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ data: data || [] })
    }

    // Busca por termo
    const incluirVinculos = searchParams.get('incluir_vinculos') === '1'
    const selectClause = incluirVinculos
      ? '*, _vinculos:aluno_responsavel!fk_ar_responsavel(aluno_id, parentesco, tipo, resp_pedagogico, resp_financeiro, prioridade, aluno:alunos(id, nome, turma, serie, frequencia, inadimplente, risco_evasao, foto, dados))'
      : '*'

    let query = supabase.from('responsaveis').select(selectClause, { count: 'exact' }).order('nome')

    if (q.trim()) {
      const safe = q.replace(/[%_().,]/g, '').trim()
      if (safe.length > 0) {
        const onlyDigits = safe.replace(/\D/g, '')
        if (onlyDigits.length >= 6) {
          // Busca numérica: CPF ou telefone
          query = query.or(`cpf.ilike.%${onlyDigits}%,celular.ilike.%${safe}%,telefone.ilike.%${safe}%`)
        } else {
          query = query.or(`nome.ilike.%${safe}%,email.ilike.%${safe}%`)
        }
      }
    }

    const from = (page - 1) * limit
    const { data, count, error } = await query.range(from, from + limit - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({
      data: data || [],
      meta: { total: count || 0, page, limit }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

// ─── POST: criar ou atualizar (upsert por CPF) ────────────────────────────────
export async function POST(request: Request) {
  try {
    const supabase = await createProtectedClient()
    const body = await request.json()

    const row = buildRow(body)
    if (!row) return NextResponse.json({ error: 'Nome inválido (mínimo 2 caracteres)' }, { status: 400 })

    const validated = ZodResponsavel.parse(row)

    // Anti-duplicidade e Match: tenta achar primeiro por ID (Update Explicito)
    let existingItem = null
    
    if (validated.id) {
      const { data } = await supabase.from('responsaveis').select('id,nome,codigo').eq('id', validated.id).maybeSingle()
      existingItem = data
    }

    // Se ainda não achou (ou não tem ID), mas tem CPF, tenta buscar por CPF (Anti-duplicata de Criação)
    if (!existingItem && validated.cpf) {
      const { data } = await supabase.from('responsaveis').select('id,nome,codigo').eq('cpf', validated.cpf).maybeSingle()
      // Se achou alguém com esse CPF e estava tentando dar update num ID diferente, seria conflito.
      // MAS, muitas vezes só pegamos o existing e atualizamos ele mesmo.
      if (data && validated.id && String(data.id) !== String(validated.id)) {
        return NextResponse.json({ error: 'Este CPF já está cadastrado para outro responsável.' }, { status: 400 })
      }
      existingItem = data
    }

    if (existingItem) {
      // Preserva o código existente caso a tela não o mandou. Se não tinha no BD nem na tela, gera.
      if (!validated.codigo) {
        validated.codigo = existingItem.codigo || Math.floor(100000 + Math.random() * 900000).toString()
      }

      const { data, error } = await supabase
        .from('responsaveis')
        .update({ ...validated, id: undefined })
        .eq('id', existingItem.id)
        .select().single()
      if (error) throw new Error(error.message)

      // --- SYNC: Propaga as alterações para os snapshots em alunos.dados.responsaveis ---
      try {
        const { data: links } = await supabase.from('aluno_responsavel').select('aluno_id').eq('responsavel_id', existingItem.id)
        if (links && links.length > 0) {
          for (const link of links) {
            const { data: alunoRow } = await supabase.from('alunos').select('id, dados').eq('id', link.aluno_id).single()
            if (alunoRow?.dados?.responsaveis && Array.isArray(alunoRow.dados.responsaveis)) {
              let mudou = false
              const novosResps = alunoRow.dados.responsaveis.map((r: any) => {
                if (r.id === existingItem.id || r.dbId === existingItem.id || (validated.cpf && r.cpf && r.cpf.replace(/\D/g,'') === validated.cpf.replace(/\D/g,''))) {
                  mudou = true
                  return { ...r, ...(data.dados || {}), nome: data.nome, cpf: data.cpf, rg: data.rg, celular: data.telefone || data.celular || r.celular, rfid: data.rfid || r.rfid, profissao: data.profissao || r.profissao, endereco: data.dados?.endereco || r.endereco, obs: data.dados?.obs || r.obs }
                }
                return r
              });
              if (mudou) {
                await supabase.from('alunos').update({ dados: { ...alunoRow.dados, responsaveis: novosResps } }).eq('id', alunoRow.id)
              }
            }

            // Sync RFID bi-direcional para o array de autorizados caso o nome bata
            if (alunoRow?.dados?.saude?.autorizados && Array.isArray(alunoRow.dados.saude.autorizados)) {
              let saudeMudou = false;
              const novosAut = alunoRow.dados.saude.autorizados.map((aut:any) => {
                if (aut.nome && data.nome && aut.nome.toLowerCase() === data.nome.toLowerCase()) {
                  if (aut.rfid !== data.rfid) {
                    saudeMudou = true;
                    return { ...aut, rfid: data.rfid };
                  }
                }
                return aut;
              });
              if (saudeMudou) {
                await supabase.from('alunos').update({ dados: { ...alunoRow.dados, saude: { ...alunoRow.dados.saude, autorizados: novosAut } } }).eq('id', alunoRow.id)
              }
            }
          }
        }
      } catch(syncErr) { console.error('Erro sincronizando resps em alunos:', syncErr) }

      // SYNC VINCULOS (tolerante a FK)
      await tryLinkAlunos(supabase, existingItem.id, body, data.dados)

      return NextResponse.json({ ...data, created: false, duplicate: !!validated.cpf }, { status: 200 })
    }

    // ═══ Cria novo registro do zero (se não achou por CPF ou ID) ═══════════════
    if (!validated.codigo) {
      validated.codigo = Math.floor(100000 + Math.random() * 900000).toString()
    }

    const finalId = validated.id && String(validated.id).length > 10 && validated.id !== 'null' ? validated.id : crypto.randomUUID()
    const { data, error } = await supabase
      .from('responsaveis')
      .insert({ ...validated, id: finalId })
      .select().single()

    if (error) throw new Error(error.message)

    // SYNC VINCULOS (tolerante a FK — não crasheia se aluno não existe ainda)
    await tryLinkAlunos(supabase, finalId, body, data.dados)

    return NextResponse.json({ ...data, created: true, duplicate: false }, { status: 201 })
  } catch (e: any) {
    console.error('[POST /api/responsaveis] Erro:', e.message || e)
    return NextResponse.json({ error: e.errors || e.message }, { status: 400 })
  }
}

// ─── DELETE: remover responsável se não tiver vínculos ────────────────────────
export async function DELETE(request: Request) {
  try {
    const supabase = await createProtectedClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID do responsável não fornecido' }, { status: 400 })

    // Remove vínculos primeiro e depois exclui o responsável
    await supabase.from('aluno_responsavel').delete().eq('responsavel_id', id)

    const { error: delErr } = await supabase.from('responsaveis').delete().eq('id', id)
    if (delErr) throw delErr

    return NextResponse.json({ success: true, message: 'Responsável excluído com sucesso.' }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro ao excluir responsável' }, { status: 400 })
  }
}
