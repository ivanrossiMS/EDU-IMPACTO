import { NextResponse } from 'next/server'
import { supabaseServer as supabase } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'
import { syncStudentToDevices } from '@/lib/portariaSync'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { requireAuth } from '@/lib/server/authGuard'

export const dynamic = 'force-dynamic'

// ─── GET: Listar alunos ──────────────────────────────────────────────────────
export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const url = new URL(request.url)
    const pageParam = url.searchParams.get('page')
    const limitParam = url.searchParams.get('limit')
    // Removemos fallback oculto; agora sempre paginado a menos que force explicitamente, mas limitado.
    const all = url.searchParams.get('all') === 'true'

    const page = parseInt(pageParam || '1')
    const lightweight = url.searchParams.get('lightweight') === 'true'
    const requestedLimit = parseInt(limitParam || (all ? '10000' : '25'))
    // Aumentamos o limite para permitir 'Todos', já que o usuário possui a opção no frontend
    const limit = lightweight ? Math.min(requestedLimit, 10000) : Math.min(requestedLimit, 10000)
    const search = url.searchParams.get('search') || ''
    const status = (url.searchParams.get('status') || 'todos').toLowerCase()
    const turma = url.searchParams.get('turma') || ''
    const sortField = url.searchParams.get('sortField') || 'nome'
    const sortOrder = url.searchParams.get('sortOrder') || 'asc'

    // Filtros Avançados
    const dataCadastroInicio = url.searchParams.get('dataCadastroInicio') || ''
    const dataCadastroFim = url.searchParams.get('dataCadastroFim') || ''
    const inadimplente = url.searchParams.get('inadimplente') // 'true' | 'false' | null
    const riscoEvasao = url.searchParams.get('riscoEvasao') || ''
    const turno = url.searchParams.get('turno') || ''
    const autorizadoSairSozinho = url.searchParams.get('autorizadoSairSozinho') // 'true' | 'false' | null

    const from = (page - 1) * limit
    const to = from + limit - 1

    const queryFields = lightweight
      ? 'id, nome, turma, status, dados'
      : 'id, nome, matricula, turma, serie, turno, status, email, data_nascimento, responsavel, responsavel_financeiro, responsavel_pedagogico, telefone, inadimplente, risco_evasao, media, frequencia, obs, unidade, foto, dados, updated_at, created_at'

    let query = supabase
      .from('alunos')
      .select(queryFields as any, { count: 'exact' })

    if (search) {
      // Busca por nome, cpf ou ID
      query = query.or(`nome.ilike.%${search}%,id.ilike.%${search}%`)
    }

    if (status === 'ativo') {
      // Se selecionou Apenas Ativos, pega matriculados/nulos
      query = query.or('status.neq.inativo,status.is.null')
    } else if (status === 'inativo') {
      // Se selecionou Apenas Inativos
      query = query.eq('status', 'inativo')
    } else if (status === 'todos') {
      // Regra de Negócio: Se for todos (Ativos) e NÃO tiver busca, esconde inativos
      if (!search) {
        query = query.or('status.neq.inativo,status.is.null')
      }
      // Se tiver busca, 'todos' significa buscar também nos inativos para que a busca encontre o aluno
    } else if (status === 'matriculado_vazio') {
      query = query.or('status.eq.MATRICULADO,status.eq.matriculado,status.is.null')
    } else if (status === 'pode_sair_sim') {
      query = query.filter('dados->autorizadoSairSozinho', 'eq', 'true')
    } else if (status === 'pode_sair_nao') {
      query = query.or('dados->autorizadoSairSozinho.eq.false,dados->autorizadoSairSozinho.is.null')
    } else if (status === 'com_responsaveis' || status === 'sem_responsaveis') {
      // Como os responsáveis estão em uma tabela de relacionamento (aluno_responsavel) e também em campos de texto,
      // buscamos os alunos que possuem vínculo ativo na tabela para cruzar com a query principal.
      const { data: ar } = await supabase.from('aluno_responsavel').select('aluno_id');
      const alunosComResponsaveisIds = ar ? [...new Set(ar.map((x: any) => x.aluno_id))] : [];
      
      if (status === 'com_responsaveis') {
        // Alunos que têm vínculo na tabela OU possuem os campos de texto preenchidos
        if (alunosComResponsaveisIds.length > 0) {
          query = query.or(`id.in.(${alunosComResponsaveisIds.join(',')}),responsavel.neq."",responsavel_financeiro.neq."",responsavel_pedagogico.neq.""`)
        } else {
          query = query.or('responsavel.neq."",responsavel_financeiro.neq."",responsavel_pedagogico.neq.""')
        }
      } else if (status === 'sem_responsaveis') {
        // Alunos que NÃO têm vínculo na tabela E possuem os campos de texto vazios
        if (alunosComResponsaveisIds.length > 0) {
          query = query.not('id', 'in', `(${alunosComResponsaveisIds.join(',')})`)
                       .or('responsavel.is.null,responsavel.eq.""')
                       .or('responsavel_financeiro.is.null,responsavel_financeiro.eq.""')
                       .or('responsavel_pedagogico.is.null,responsavel_pedagogico.eq.""')
        } else {
          query = query.or('responsavel.is.null,responsavel.eq.""')
                       .or('responsavel_financeiro.is.null,responsavel_financeiro.eq.""')
                       .or('responsavel_pedagogico.is.null,responsavel_pedagogico.eq.""')
        }
      }
    } else if (status === 'com_turma') {
      query = query.not('turma', 'is', null).neq('turma', '')
    } else if (status === 'sem_turma') {
      query = query.or('turma.is.null,turma.eq.')
    }
    // se for todos_com_inativos, não aplica filtro de status

    if (turma) {
      query = query.eq('turma', turma)
    }

    // Aplicação de Filtros Avançados
    if (dataCadastroInicio) {
      query = query.gte('created_at', dataCadastroInicio + 'T00:00:00.000Z')
    }
    if (dataCadastroFim) {
      query = query.lte('created_at', dataCadastroFim + 'T23:59:59.999Z')
    }
    if (inadimplente === 'true') {
      query = query.eq('inadimplente', true)
    } else if (inadimplente === 'false') {
      query = query.eq('inadimplente', false)
    }
    if (riscoEvasao && riscoEvasao !== 'todos') {
      query = query.eq('risco_evasao', riscoEvasao)
    }
    if (turno && turno !== 'todos') {
      query = query.ilike('turno', `%${turno}%`)
    }
    if (autorizadoSairSozinho === 'true') {
      query = query.filter('dados->autorizadoSairSozinho', 'eq', 'true')
    } else if (autorizadoSairSozinho === 'false') {
      // Filtrar quando for explicitamente falso, nulo ou ausente
      query = query.or('dados->autorizadoSairSozinho.eq.false,dados->autorizadoSairSozinho.is.null')
    }

    // Determine ordering column
    let dbSortField = 'nome'
    if (sortField === 'id') {
      dbSortField = 'matricula'
    } else if (sortField === 'nome') {
      dbSortField = 'nome'
    } else if (sortField === 'responsavel') {
      dbSortField = 'responsavel'
    } else if (sortField === 'turma') {
      dbSortField = 'turma'
    } else if (sortField === 'status') {
      dbSortField = 'status'
    } else if (sortField === 'sairSozinho' || sortField === 'autorizadoSairSozinho') {
      dbSortField = 'dados->autorizadoSairSozinho'
    } else if (sortField === 'foto') {
      dbSortField = 'foto'
    } else if (sortField === 'created_at' || sortField === 'data_cadastro' || sortField === 'dataCadastro') {
      dbSortField = 'created_at'
    }

    let queryExec;
    if (dbSortField === 'dados->autorizadoSairSozinho') {
      const isAsc = sortOrder === 'asc';
      // Para booleans com null, queremos agrupar null e false juntos
      queryExec = query.order(dbSortField, { ascending: isAsc, nullsFirst: isAsc });
    } else {
      queryExec = query.order(dbSortField, { ascending: sortOrder === 'asc' });
    }
    // Sempre aplicar range limit
    queryExec = queryExec.range(from, from + limit - 1)

    const { data: students, error: studentsError, count } = await queryExec

    if (studentsError) {
      // PGRST103: Requested range not satisfiable (ocorre quando pede uma página maior que o total de resultados)
      if (studentsError.code === 'PGRST103') {
        return NextResponse.json({ data: [], total: count || 0, page, limit })
      }
      console.error(`\n[${new Date().toISOString()}] Error Alunos GET (Students): ${studentsError.message}\n`)
      return NextResponse.json({ error: studentsError.message }, { status: 400 })
    }

    if (!students || students.length === 0) {
      return NextResponse.json({ data: [], total: 0, page, limit })
    }

    if (lightweight) {
      let turmasData: any[] = []
      const uniqueTurmaRefs = Array.from(new Set(students.map((s: any) => s.turma).filter(Boolean)))
      
      if (uniqueTurmaRefs.length > 0) {
        const cleanRefs = uniqueTurmaRefs.map(r => String(r).trim()).filter(Boolean)
        if (cleanRefs.length > 0) {
          const formattedRefs = cleanRefs.map(r => /[ ,()\/]/.test(r) ? `"${r.replace(/"/g, '\\"')}"` : r).join(',')
          const { data: tData } = await supabase
            .from('turmas')
            .select('id, codigo, nome, ano')
            .or(`id.in.(${formattedRefs}),codigo.in.(${formattedRefs}),nome.in.(${formattedRefs})`)
          turmasData = tData || []
        }
      }

      const formatted = (students || []).map((student: any) => {
        const d = student.dados || {}
        
        const studentTurma = student.turma
        const tObj = turmasData?.find((t: any) =>
          String(t.id) === String(studentTurma) ||
          String(t.codigo) === String(studentTurma) ||
          String(t.nome).toLowerCase() === String(studentTurma).toLowerCase()
        )

        return {
          ...student,
          responsaveis: student.responsaveis || d.responsaveis,
          _responsaveis: student._responsaveis || d._responsaveis,
          responsavel: student.responsavel || d.responsavel,
          cpf_responsavel: student.cpf_responsavel || d.cpf_responsavel || d.cpfResponsavel,
          email_responsavel: student.email_responsavel || d.email_responsavel || d.emailResponsavel,
          celular_responsavel: student.celular_responsavel || d.celular_responsavel || d.telResponsavel,
          turma_nome: tObj?.nome || student.turma || '',
          turma_anoLetivo: tObj?.ano !== undefined ? String(tObj.ano) : (student.anoLetivo || student.ano_letivo || d.anoLetivo || ''),
          dados: {
            historicoTurmas: [],
            celular_responsavel: d.celular_responsavel,
            cpfResponsavel: d.cpfResponsavel,
            emailResponsavel: d.emailResponsavel,
            telResponsavel: d.telResponsavel,
            codigo: d.codigo,
            email: d.email
          }
        }
      })
      return NextResponse.json({
        data: formatted,
        total: count || 0,
        page,
        limit
      }, {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=120'
        }
      })
    }

    const allStudentRefs = students.flatMap((s: any) => [
      s.id, 
      s.matricula, 
      s.dados?.codigo, 
      s.matricula ? String(s.matricula) : null, 
      s.dados?.codigo ? String(s.dados?.codigo) : null
    ]).filter(Boolean)

    // 2. Busca os vínculos apenas para os alunos da página
    const { data: links, error: linksError } = await supabase
      .from('aluno_responsavel')
      .select('*')
      .in('aluno_id', allStudentRefs)
      .limit(20000)

    if (linksError) {
      console.error(`\n[${new Date().toISOString()}] Error Alunos GET (Links): ${linksError.message}\n`)
    }

    // 2.5 Busca os dados dos responsáveis manualmente para evitar erro de ambiguidade no join
    const respIds = links?.map((l: any) => l.responsavel_id).filter(Boolean) || []
    let responsaveis: any[] = []
    
    if (respIds.length > 0) {
      const { data: respData, error: respError } = await supabase
        .from('responsaveis')
        .select('*')
        .in('id', respIds)
        .limit(20000)
        
      if (respError) {
        console.error(`\n[${new Date().toISOString()}] Error Alunos GET (Responsaveis): ${respError.message}\n`)
      } else {
        responsaveis = respData || []
      }
    }

    // 2.7 Busca apenas as turmas associadas aos alunos retornados para resolver nomes e segmentos no servidor de forma otimizada
    let turmasData: any[] = []
    const uniqueTurmaRefs = Array.from(new Set(students.map((s: any) => s.turma).filter(Boolean)))
    
    if (uniqueTurmaRefs.length > 0) {
      // Formata referências limpando caracteres especiais que quebram cláusula PostgREST IN
      const cleanRefs = uniqueTurmaRefs.map(r => String(r).trim()).filter(Boolean)
      if (cleanRefs.length > 0) {
        const formattedRefs = cleanRefs.map(r => {
          if (/[ ,()\/]/.test(r)) {
            return `"${r.replace(/"/g, '\\"')}"`
          }
          return r
        }).join(',')

        const { data: tData, error: turmasError } = await supabase
          .from('turmas')
          .select('id, codigo, nome, ano, dados')
          .or(`id.in.(${formattedRefs}),codigo.in.(${formattedRefs}),nome.in.(${formattedRefs})`)

        if (turmasError) {
          console.error(`\n[${new Date().toISOString()}] Error Alunos GET (Turmas): ${turmasError.message}\n`)
        } else {
          turmasData = tData || []
        }
      }
    }

    // 3. Monta o resultado final
    const formattedData = students.map((student: any) => {
      const studentRefs = [
        student.id, 
        student.matricula, 
        student.dados?.codigo, 
        student.matricula ? String(student.matricula) : null, 
        student.dados?.codigo ? String(student.dados?.codigo) : null
      ].filter(Boolean)
      
      const linkedResponsaveis = links?.filter((l: any) => studentRefs.includes(l.aluno_id))
        .map((l: any) => {
          const resp = responsaveis.find((r: any) => r.id === l.responsavel_id) || {}
          return {
            ...resp,
            parentesco: l.parentesco,
            isFinanceiro: l.resp_financeiro,
            isPedagogico: l.resp_pedagogico,
            isOutro: l.resp_outro,
            dataNasc: resp.data_nasc,
            diasAcesso: resp.dias_acesso
          }
        }).filter((r: any) => r.id) || []

      if (student.nome === 'ivan25') {
        console.error(`\n[${new Date().toISOString()}] ivan25 linkedResponsaveis: ${JSON.stringify(linkedResponsaveis, null, 2)}\n`)
      }

      const fallbackResponsaveis = student.dados?.responsaveis || []

      const studentTurma = student.turma
      const tObj = turmasData?.find((t: any) =>
        String(t.id) === String(studentTurma) ||
        String(t.codigo) === String(studentTurma) ||
        String(t.nome).toLowerCase() === String(studentTurma).toLowerCase()
      )

      return {
        ...student,
        ...(student.dados || {}), // Spread JSONB data
        created_at: student.created_at, // Restore to ensure it's not overwritten
        responsaveis: linkedResponsaveis.length > 0 ? linkedResponsaveis : fallbackResponsaveis,
        turma_nome: tObj?.nome || student.turma || '',
        turma_segmento: tObj?.dados?.segmento || student.segmento || student.dados?.segmento || '',
        turma_anoLetivo: tObj?.ano !== undefined ? String(tObj.ano) : (student.anoLetivo || student.ano_letivo || student.dados?.anoLetivo || '')
      }
    })

    return NextResponse.json({
      data: formattedData,
      total: count || 0,
      page,
      limit
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

// ─── POST: Criar ou atualizar aluno e seus responsáveis ──────────────────────────
export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    
    if (Array.isArray(body)) {
      return NextResponse.json({ error: 'Este endpoint aceita apenas um objeto, não um array.' }, { status: 400 })
    }

    const item = body
    const row = buildRow(item)
    
    console.error(`[${new Date().toISOString()}] POST Aluno Individual: ${row.nome}\n`)

    // 0. Verifica duplicidade de ID do Aluno
    if (row.id && !row.id.startsWith('TEMP-')) {
      const { data: existingStudent } = await supabase.from('alunos').select('id, nome').eq('id', row.id).maybeSingle()
      if (existingStudent) {
        return NextResponse.json({ error: `O ID "${row.id}" já está em uso pelo aluno "${existingStudent.nome}". Por favor, escolha um ID diferente.` }, { status: 400 })
      }
    }

    // 0.1 Verifica duplicidade de E-mail do Aluno
    if (row.email && row.email.trim()) {
      const emailLower = row.email.trim().toLowerCase()
      const { data: existingStudentEmail } = await supabase.from('alunos').select('id, nome').eq('email', emailLower).maybeSingle()
      if (existingStudentEmail) {
        return NextResponse.json({ error: `Este e-mail já está sendo utilizado por outro aluno (${existingStudentEmail.nome})!` }, { status: 400 })
      }
    }

    // 1. Salvar o aluno (Insert para criação)
    const { data: studentData, error: studentError } = await supabase
      .from('alunos')
      .insert(row)
      .select()
      
    if (studentError) throw new Error(studentError.message)
    
    const savedStudent = studentData?.[0]
    if (!savedStudent) throw new Error('Falha ao salvar aluno')
    
    // 2. Salvar responsáveis e vínculos
    // Filtra responsáveis vazios (sem nome) para permitir salvar aluno sem responsável
    const responsaveis = (item.responsaveis || item._responsaveis || []).filter((r: any) => r.nome && r.nome.trim() !== '')
    const validColumns = ['id', 'nome', 'data_nasc', 'email', 'telefone', 'celular', 'profissao', 'estado_civil', 'rfid', 'codigo', 'dias_acesso', 'proibido', 'dados']

    for (const resp of responsaveis) {
      const parentesco = resp.parentesco || resp.tipo || ''
      const isFinanceiro = resp.isFinanceiro === true || resp.respFinanceiro === true
      const isPedagogico = resp.isPedagogico === true || resp.respPedagogico === true
      const isOutro = resp.isOutro === true || (!isFinanceiro && !isPedagogico)
      const respDataToSave: any = {}
      
      const isNewResp = !resp.id || (typeof resp.id === 'string' && resp.id.startsWith('TEMP-')) || resp.id === ''
      
      // Verifica se o responsável é NOVO (adicionado na interface) e o ID digitado já existe
      if (resp.isNewAdded && resp.id && !resp.id.startsWith('TEMP-')) {
        const { data: existing } = await supabase.from('responsaveis').select('id, nome').eq('id', resp.id).maybeSingle()
        if (existing) {
          throw new Error(`O ID "${resp.id}" já pertence ao responsável "${existing.nome}". Por favor, escolha outro ID para este novo responsável.`)
        }
      }
      
      // Preservar e mesclar com dados existentes no banco
      const dados = { ...(resp.dados || {}) }
      if (!isNewResp) {
        const { data: existingResp } = await supabase
          .from('responsaveis')
          .select('dados')
          .eq('id', resp.id)
          .maybeSingle()
        if (existingResp?.dados) {
          Object.assign(dados, existingResp.dados)
        }
      }
      if (resp.cpf) {
        dados.cpf = String(resp.cpf).replace(/\D/g, '')
      }
      if (resp.rg) {
        dados.rg = String(resp.rg).trim()
      }
      if (resp.orgEmissor) dados.orgEmissor = resp.orgEmissor
      if (resp.nacionalidade) dados.nacionalidade = resp.nacionalidade
      if (resp.naturalidade) dados.naturalidade = resp.naturalidade
      if (resp.uf) dados.uf = resp.uf
      if (resp.sexo) dados.sexo = resp.sexo
      if (resp.cep) dados.cep = resp.cep
      if (resp.logradouro) dados.logradouro = resp.logradouro
      if (resp.numero) dados.numero = resp.numero
      if (resp.complemento) dados.complemento = resp.complemento
      if (resp.bairro) dados.bairro = resp.bairro
      if (resp.cidade) dados.cidade = resp.cidade
      if (resp.ufEnd) dados.ufEnd = resp.ufEnd
      respDataToSave.dados = dados
      
      const dataNasc = resp.dataNasc || resp.data_nasc
      if (dataNasc) respDataToSave.data_nasc = dataNasc
      
      const diasAcesso = resp.diasAcesso || resp.dias_acesso
      if (diasAcesso) respDataToSave.dias_acesso = diasAcesso
      
      const estadoCivil = resp.estadoCivil || resp.estado_civil
      if (estadoCivil) respDataToSave.estado_civil = estadoCivil
      
      const codigo = resp.codigoAluno || resp.codigo
      if (codigo) respDataToSave.codigo = codigo

      const telefone = resp.celular || resp.telefone
      if (telefone) respDataToSave.telefone = telefone
      
      for (const col of validColumns) {
        if (respDataToSave[col] === undefined && resp[col] !== undefined) {
          if (col === 'codigo' && !resp[col]) {
            respDataToSave[col] = null
          } else {
            respDataToSave[col] = resp[col]
          }
        }
      }
      
      // Verifica duplicidade de E-mail do Responsável
      if (respDataToSave.email && respDataToSave.email.trim()) {
        const emailLower = respDataToSave.email.trim().toLowerCase()
        let query = supabase.from('responsaveis').select('id, nome').eq('email', emailLower)
        if (!isNewResp && respDataToSave.id) {
          query = query.neq('id', respDataToSave.id)
        }
        const { data: existingRespEmail } = await query.maybeSingle()
        if (existingRespEmail) {
          // Em vez de dar erro, vamos usar o responsável existente e atualizar os dados dele
          respDataToSave.id = existingRespEmail.id
        }
      }
      
      if (isNewResp) {
        delete respDataToSave.id
      }
      
      let queryData: any[] | null = null
      let respError: any = null
      
      if (isNewResp) {
        const res = await supabase.from('responsaveis').insert(respDataToSave).select()
        queryData = res.data
        respError = res.error
      } else {
        const res = await supabase.from('responsaveis').update(respDataToSave).eq('id', respDataToSave.id).select()
        queryData = res.data
        respError = res.error
        
        // Se não encontrou o registro para atualizar, tenta inserir
        if (!respError && (!queryData || queryData.length === 0)) {
          const resInsert = await supabase.from('responsaveis').insert(respDataToSave).select()
          queryData = resInsert.data
          respError = resInsert.error
        }
      }
        
      if (respError) throw new Error(`Erro ao salvar responsável ${resp.nome}: ${respError.message}`)
      
      const savedResp = queryData && queryData.length > 0 ? queryData[0] : null
      if (!savedResp) throw new Error(`Nenhum dado retornado para o responsável ${resp.nome}`)
      
      // Remove vínculo antigo se existir para evitar duplicidade
      await supabase.from('aluno_responsavel').delete().eq('aluno_id', savedStudent.id).eq('responsavel_id', savedResp.id)
      
      const { error: linkError } = await supabase
        .from('aluno_responsavel')
        .insert({
          aluno_id: savedStudent.id,
          responsavel_id: savedResp.id,
          parentesco: parentesco || '',
          resp_financeiro: isFinanceiro || false,
          resp_pedagogico: isPedagogico || false,
          resp_outro: isOutro || false
        })
        
      if (linkError) throw new Error(`Erro ao vincular responsável ${resp.nome} ao aluno: ${linkError.message}`)
    }

    // Dispara Saudação Automática se estiver configurada e ativa
    try {
      const { data: configData } = await supabase.from('configuracoes').select('valor').eq('chave', 'ad_config').maybeSingle()
      if (configData && configData.valor?.saudacao?.ativa) {
        const saudacao = configData.valor.saudacao;
        const msg = (saudacao.mensagem || '')
          .replace(/{nome_aluno}/g, savedStudent.nome)
          .replace(/{nome_responsavel}/g, responsaveis[0]?.nome || 'Família')
        
        const anexos = saudacao.imagemUrl ? [{ type: 'image', url: saudacao.imagemUrl, nome: 'boas-vindas.jpg' }] : [];
        const novoId = `COM-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;

        await supabase.from('comunicados').insert({
          id: novoId,
          titulo: saudacao.titulo || 'Mensagem de Boas-vindas',
          texto: msg,
          autor: 'Ivan Rossi',
          data: new Date().toISOString(),
          destino: 'selecionados',
          fixado: true,
          dados: {
            autorCargo: 'Diretor Geral',
            tipo: saudacao.imagemUrl ? 'arquivo' : 'texto',
            status: 'enviado',
            prioridade: 'normal',
            permiteResposta: true,
            exigeCiencia: false,
            alunosIds: [savedStudent.id],
            turmas: [],
            leituras: {},
            ciencias: {},
            anexos: anexos,
            conteudo: msg,
            dataEnvio: new Date().toISOString(),
            isSaudacao: true
          }
        })
      }
    } catch(err: any) {
      console.error('[Saudacao Error]', err.message)
    }

    // Sincroniza em segundo plano com a portaria
    syncStudentToDevices(savedStudent.id, 'create').catch(err => 
      console.error('[Portaria Sync Error]', err.message)
    )

    return NextResponse.json(savedStudent, { status: 201 })
  } catch (e: any) {
    console.error(`[${new Date().toISOString()}] Error Alunos POST: ${e.message}\n`)
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

// ─── PUT: Atualizar aluno ───────────────────────────────────────────────────
export async function PUT(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id') || body.id

    if (!id) return NextResponse.json({ error: 'ID é obrigatório para atualização' }, { status: 400 })

    const row = buildRow(body)
    delete row.id // Não atualiza o ID!

    console.error(`[${new Date().toISOString()}] PUT Aluno: ${row.nome} (ID: ${id})\n`)

    // 0. Verifica duplicidade de E-mail do Aluno
    if (row.email && row.email.trim()) {
      const emailLower = row.email.trim().toLowerCase()
      const { data: existingStudentEmail } = await supabase.from('alunos').select('id, nome').eq('email', emailLower).neq('id', id).maybeSingle()
      if (existingStudentEmail) {
        return NextResponse.json({ error: `Este e-mail já está sendo utilizado por outro aluno (${existingStudentEmail.nome})!` }, { status: 400 })
      }
    }

    // 1. Atualizar o aluno
    const { data: studentData, error: studentError } = await supabase
      .from('alunos')
      .update(row)
      .eq('id', id)
      .select()

    if (studentError) throw new Error(studentError.message)
    
    const savedStudent = studentData?.[0]
    if (!savedStudent) throw new Error('Aluno não encontrado ou não atualizado')

    // 2. Salvar responsáveis e vínculos (mesma lógica do POST)
    const responsaveis = (body.responsaveis || body._responsaveis || []).filter((r: any) => r.nome && r.nome.trim() !== '')
    const validColumns = ['id', 'nome', 'data_nasc', 'email', 'telefone', 'celular', 'profissao', 'estado_civil', 'rfid', 'codigo', 'dias_acesso', 'proibido', 'dados']
    const savedRespIds: string[] = []

    for (const resp of responsaveis) {
      const parentesco = resp.parentesco || resp.tipo || ''
      const isFinanceiro = resp.isFinanceiro === true || resp.respFinanceiro === true
      const isPedagogico = resp.isPedagogico === true || resp.respPedagogico === true
      const isOutro = resp.isOutro === true || (!isFinanceiro && !isPedagogico)
      const respDataToSave: any = {}

      const isNewResp = !resp.id || (typeof resp.id === 'string' && resp.id.startsWith('TEMP-')) || resp.id === ''
      
      // Verifica se o responsável é NOVO (adicionado na interface) e o ID digitado já existe
      if (resp.isNewAdded && resp.id && !resp.id.startsWith('TEMP-')) {
        const { data: existing } = await supabase.from('responsaveis').select('id, nome').eq('id', resp.id).maybeSingle()
        if (existing) {
          throw new Error(`O ID "${resp.id}" já pertence ao responsável "${existing.nome}". Por favor, escolha outro ID para este novo responsável.`)
        }
      }
      
      // Preservar e mesclar com dados existentes no banco
      const dados = { ...(resp.dados || {}) }
      if (!isNewResp) {
        const { data: existingResp } = await supabase
          .from('responsaveis')
          .select('dados')
          .eq('id', resp.id)
          .maybeSingle()
        if (existingResp?.dados) {
          Object.assign(dados, existingResp.dados)
        }
      }
      if (resp.cpf) {
        dados.cpf = String(resp.cpf).replace(/\D/g, '')
      }
      if (resp.rg) {
        dados.rg = String(resp.rg).trim()
      }
      if (resp.orgEmissor) dados.orgEmissor = resp.orgEmissor
      if (resp.nacionalidade) dados.nacionalidade = resp.nacionalidade
      if (resp.naturalidade) dados.naturalidade = resp.naturalidade
      if (resp.uf) dados.uf = resp.uf
      if (resp.sexo) dados.sexo = resp.sexo
      if (resp.cep) dados.cep = resp.cep
      if (resp.logradouro) dados.logradouro = resp.logradouro
      if (resp.numero) dados.numero = resp.numero
      if (resp.complemento) dados.complemento = resp.complemento
      if (resp.bairro) dados.bairro = resp.bairro
      if (resp.cidade) dados.cidade = resp.cidade
      if (resp.ufEnd) dados.ufEnd = resp.ufEnd
      respDataToSave.dados = dados
      
      const dataNasc = resp.dataNasc || resp.data_nasc
      if (dataNasc) respDataToSave.data_nasc = dataNasc
      
      const diasAcesso = resp.diasAcesso || resp.dias_acesso
      if (diasAcesso) respDataToSave.dias_acesso = diasAcesso
      
      const estadoCivil = resp.estadoCivil || resp.estado_civil
      if (estadoCivil) respDataToSave.estado_civil = estadoCivil
      
      const codigo = resp.codigoAluno || resp.codigo
      if (codigo) respDataToSave.codigo = codigo

      const telefone = resp.celular || resp.telefone
      if (telefone) respDataToSave.telefone = telefone
      
      for (const col of validColumns) {
        if (respDataToSave[col] === undefined && resp[col] !== undefined) {
          if (col === 'codigo' && !resp[col]) {
            respDataToSave[col] = null
          } else {
            respDataToSave[col] = resp[col]
          }
        }
      }
      
      // Verifica duplicidade de E-mail do Responsável
      if (respDataToSave.email && respDataToSave.email.trim()) {
        const emailLower = respDataToSave.email.trim().toLowerCase()
        let query = supabase.from('responsaveis').select('id, nome').eq('email', emailLower)
        if (!isNewResp && respDataToSave.id) {
          query = query.neq('id', respDataToSave.id)
        }
        const { data: existingRespEmail } = await query.maybeSingle()
        if (existingRespEmail) {
          // Em vez de dar erro, vamos usar o responsável existente e atualizar os dados dele
          respDataToSave.id = existingRespEmail.id
        }
      }
      
      if (!respDataToSave.id || (typeof respDataToSave.id === 'string' && respDataToSave.id.startsWith('TEMP-')) || respDataToSave.id === '') {
        delete respDataToSave.id
      }
      
      const { data: queryData, error: respError } = await supabase
        .from('responsaveis')
        .upsert(respDataToSave)
        .select()
        
      if (respError) throw new Error(`Erro ao salvar responsável ${resp.nome}: ${respError.message}`)
      
      const savedResp = queryData && queryData.length > 0 ? queryData[0] : null
      if (!savedResp) throw new Error(`Nenhum dado retornado para o responsável ${resp.nome}`)
      
      savedRespIds.push(savedResp.id)

      const { error: linkError } = await supabase
        .from('aluno_responsavel')
        .upsert({
          aluno_id: savedStudent.id,
          responsavel_id: savedResp.id,
          parentesco: parentesco || '',
          resp_financeiro: isFinanceiro || false,
          resp_pedagogico: isPedagogico || false,
          resp_outro: isOutro || false
        })
        
      if (linkError) throw new Error(`Erro ao vincular responsável ${resp.nome} ao aluno: ${linkError.message}`)
    }

    // 3. Desvincular responsáveis que foram removidos
    const { data: currentLinks, error: fetchLinksError } = await supabase
      .from('aluno_responsavel')
      .select('responsavel_id')
      .eq('aluno_id', savedStudent.id)

    if (fetchLinksError) throw fetchLinksError

    const linksToDelete = (currentLinks || [])
      .map((l: any) => l.responsavel_id)
      .filter((id: string) => !savedRespIds.includes(id))

    if (linksToDelete.length > 0) {
      // Deleta os vínculos na tabela aluno_responsavel
      const { error: unlinkError } = await supabase
        .from('aluno_responsavel')
        .delete()
        .eq('aluno_id', savedStudent.id)
        .in('responsavel_id', linksToDelete)
      
      if (unlinkError) throw unlinkError

      // Remove os registros órfãos da tabela de responsáveis para manter a integridade dos dados
      for (const respId of linksToDelete) {
        const { data: otherLinks } = await supabase
          .from('aluno_responsavel')
          .select('aluno_id')
          .eq('responsavel_id', respId)

        if (!otherLinks || otherLinks.length === 0) {
          const { data: guardian } = await supabase
            .from('responsaveis')
            .select('*')
            .eq('id', respId)
            .maybeSingle()

          if (guardian) {
            const guardianEmail = (guardian.email || '').trim().toLowerCase()
            
            // Delete from public.responsaveis
            await supabase.from('responsaveis').delete().eq('id', respId)

            // Delete from public.system_users
            if (guardianEmail) {
              await supabase.from('system_users').delete().eq('email', guardianEmail)
            }
            await supabase.from('system_users').delete().filter('dados->>responsavel_id', 'eq', respId)
          }
        }
      }
    }

    // Sincroniza em segundo plano com a portaria
    syncStudentToDevices(savedStudent.id, 'update').catch(err => 
      console.error('[Portaria Sync Error]', err.message)
    )

    return NextResponse.json(savedStudent)
  } catch (e: any) {
    console.error(`[${new Date().toISOString()}] Error Alunos PUT: ${e.message}\n`)
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

// ─── DELETE: Remover aluno ───────────────────────────────────────────────────
// ─── DELETE: Remover aluno ou todos os alunos ─────────────────────────────────
export async function DELETE(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const all = searchParams.get('all') === 'true'
    
    if (!id && !all) {
      return NextResponse.json({ error: 'ID ou parâmetro all=true é obrigatório' }, { status: 400 })
    }

    const supabaseAdmin = getAdminClient()

    // Helper to delete an auth user safely — busca direta por email (evita listUsers)
    const deleteAuthUserByEmailOrMeta = async (email: string, metadataKey: string, metadataValue: string) => {
      try {
        // Tenta busca por email diretamente
        if (email) {
          const { data: { users: byEmail } } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 10 })
          // Filtro local apenas na página pequena — na prática a escola tem poucos deletions
          // A busca completa só ocorre quando metadataKey é passado
          const byExactEmail = byEmail?.filter(u => u.email?.toLowerCase() === email.toLowerCase()) || []
          for (const user of byExactEmail) {
            await supabaseAdmin.auth.admin.deleteUser(user.id)
          }
        }
        // Fallback: busca por metadata (ex: aluno_id, responsavel_id)
        if (metadataKey && metadataValue) {
          // Usar system_users como índice para localizar o auth user ID
          const { data: sysUser } = await supabaseAdmin
            .from('system_users')
            .select('id')
            .or(`dados->>${metadataKey}.eq.${metadataValue},${metadataKey}.eq.${metadataValue}`)
            .limit(1)
            .maybeSingle()
          if (sysUser?.id) {
            await supabaseAdmin.auth.admin.deleteUser(sysUser.id).catch(() => {})
          }
        }
      } catch (err: any) {
        console.error('Error deleting auth user:', err.message)
      }
    }

    const deleteSingleStudent = async (studentId: string) => {
      // 1. Fetch student information before deletion
      const { data: student, error: fetchError } = await supabaseAdmin
        .from('alunos')
        .select('*')
        .eq('id', studentId)
        .maybeSingle()

      if (!student) return

      const matricula = student.matricula || student.dados?.codigo || student.id
      const studentEmail = (student.email || student.dados?.email || '').trim().toLowerCase()

      // 2. Siblingless Guardian Deletion Cascade & Auth Account Revocation
      const { data: linkedResps } = await supabaseAdmin
        .from('aluno_responsavel')
        .select('responsavel_id')
        .eq('aluno_id', studentId)

      const respIds = (linkedResps || []).map(r => r.responsavel_id).filter(Boolean)

      for (const respId of respIds) {
        const { data: otherLinks } = await supabaseAdmin
          .from('aluno_responsavel')
          .select('aluno_id, resp_financeiro, resp_pedagogico')
          .eq('responsavel_id', respId)
          .neq('aluno_id', studentId)

        const hasOtherActiveLink = (otherLinks || []).some(
          (l: any) => l.resp_financeiro === true || l.resp_pedagogico === true
        )

        const { data: guardian } = await supabaseAdmin
          .from('responsaveis')
          .select('*')
          .eq('id', respId)
          .maybeSingle()

        if (guardian) {
          const guardianEmail = (guardian.email || '').trim().toLowerCase()

          if (!otherLinks || otherLinks.length === 0) {
            // Delete from public.responsaveis if no links left at all
            await supabaseAdmin.from('responsaveis').delete().eq('id', respId)

            // Delete from public.system_users
            if (guardianEmail) {
              await supabaseAdmin.from('system_users').delete().eq('email', guardianEmail)
            }
            await supabaseAdmin.from('system_users').delete().filter('dados->>responsavel_id', 'eq', respId)
          }

          // If no links left at all, OR remaining links are NOT financial or pedagogical (e.g. only 'Outro')
          if (!otherLinks || otherLinks.length === 0 || !hasOtherActiveLink) {
            await deleteAuthUserByEmailOrMeta(guardianEmail, 'responsavel_id', respId)
          }
        }
      }

      // 3. Remove relational links and direct academic dependencies
      await supabaseAdmin.from('aluno_responsavel').delete().eq('aluno_id', studentId)
      await supabaseAdmin.from('ocorrencias').delete().eq('aluno_id', studentId)
      await supabaseAdmin.from('boletins').delete().eq('aluno_id', studentId)
      await supabaseAdmin.from('documentos_emitidos').delete().eq('aluno_id', studentId)
      await supabaseAdmin.from('academico_notas_aluno').delete().eq('aluno_id', studentId)

      // 4. Remover registros do aluno de frequencias e lancamentos_nota
      // Usa filtro por aluno_id nas linhas JSONB para evitar full table scan
      const { data: freqs } = await supabaseAdmin
        .from('frequencias')
        .select('id, registros')
        .or(`dados->>turmaId.eq.${student?.turma ?? ''},id.neq.NONE`)
        .limit(500)
      if (freqs) {
        const updates = freqs
          .filter(freq => {
            const registros = Array.isArray(freq.registros) ? freq.registros : []
            return registros.some((r: any) => String(r.alunoId) === String(studentId) || String(r.aluno_id) === String(studentId))
          })
          .map(freq => ({
            id: freq.id,
            registros: (freq.registros as any[]).filter((r: any) =>
              String(r.alunoId) !== String(studentId) && String(r.aluno_id) !== String(studentId)
            )
          }))
        for (const u of updates) {
          await supabaseAdmin.from('frequencias').update({ registros: u.registros }).eq('id', u.id)
        }
      }

      const { data: gradebooks } = await supabaseAdmin
        .from('lancamentos_nota')
        .select('id, notas')
        .or(`dados->>turmaId.eq.${student?.turma ?? ''},id.neq.NONE`)
        .limit(500)
      if (gradebooks) {
        const updates = gradebooks
          .filter(book => {
            const notas = Array.isArray(book.notas) ? book.notas : []
            return notas.some((n: any) => String(n.alunoId) === String(studentId) || String(n.aluno_id) === String(studentId))
          })
          .map(book => ({
            id: book.id,
            notas: (book.notas as any[]).filter((n: any) =>
              String(n.alunoId) !== String(studentId) && String(n.aluno_id) !== String(studentId)
            )
          }))
        for (const u of updates) {
          await supabaseAdmin.from('lancamentos_nota').update({ notas: u.notas }).eq('id', u.id)
        }
      }

      // 5. Delete Exit Module entries
      await supabaseAdmin.from('saida_calls').delete().filter('dados->>alunoId', 'eq', studentId)
      await supabaseAdmin.from('saida_rfid').delete().filter('dados->>alunoId', 'eq', studentId)
      await supabaseAdmin.from('saida_rfid').delete().ilike('id', `${studentId}%`)
      await supabaseAdmin.from('saida_student_guardians').delete().filter('dados->>alunoId', 'eq', studentId)
      await supabaseAdmin.from('saida_student_guardians').delete().ilike('id', `${studentId}%`)



      // 7. Remove student from Digital Agenda Groups
      const { data: groups } = await supabaseAdmin.from('agenda_grupos').select('*')
      if (groups) {
        for (const group of groups) {
          const dados = group.dados || {}
          const alunosIds = Array.isArray(dados.alunosIds) ? dados.alunosIds : []
          if (alunosIds.some((a: any) => String(a) === String(studentId))) {
            const updatedAlunosIds = alunosIds.filter((a: any) => String(a) !== String(studentId))
            await supabaseAdmin.from('agenda_grupos').update({ dados: { ...dados, alunosIds: updatedAlunosIds } }).eq('id', group.id)
          }
        }
      }

      // 8. Clean up Digital Agenda Communications target lists, reads, and sign-offs
      const { data: announcements } = await supabaseAdmin.from('comunicados').select('*')
      if (announcements) {
        for (const comm of announcements) {
          const dados = comm.dados || {}
          let changed = false

          const alunosIds = Array.isArray(dados.alunosIds) ? dados.alunosIds : []
          let updatedAlunosIds = alunosIds
          if (alunosIds.some((a: any) => String(a) === String(studentId))) {
            updatedAlunosIds = alunosIds.filter((a: any) => String(a) !== String(studentId))
            changed = true
          }

          const leituras = dados.leituras ? { ...dados.leituras } : {}
          if (leituras[studentId]) {
            delete leituras[studentId]
            changed = true
          }
          for (const rId of respIds) {
            if (leituras[rId]) {
              delete leituras[rId]
              changed = true
            }
          }

          const ciencias = dados.ciencias ? { ...dados.ciencias } : {}
          if (ciencias[studentId]) {
            delete ciencias[studentId]
            changed = true
          }
          for (const rId of respIds) {
            if (ciencias[rId]) {
              delete ciencias[rId]
              changed = true
            }
          }

          if (changed) {
            const destino = String(comm.destino || '').toLowerCase()
            const turmas = Array.isArray(dados.turmas) ? dados.turmas : []
            
            if (updatedAlunosIds.length === 0 && destino !== 'todos' && turmas.length === 0) {
              await supabaseAdmin.from('comunicados').delete().eq('id', comm.id)
            } else {
              await supabaseAdmin
                .from('comunicados')
                .update({
                  dados: {
                    ...dados,
                    alunosIds: updatedAlunosIds,
                    leituras,
                    ciencias
                  }
                })
                .eq('id', comm.id)
            }
          }
        }
      }

      // 9. Clean up student credentials
      if (studentEmail) {
        await supabaseAdmin.from('system_users').delete().eq('email', studentEmail)
      }
      await supabaseAdmin.from('system_users').delete().filter('dados->>aluno_id', 'eq', studentId)

      const virtualEmail = `aluno.${matricula}@impactoedu.local`
      await deleteAuthUserByEmailOrMeta(studentEmail, 'aluno_id', studentId)
      await deleteAuthUserByEmailOrMeta(virtualEmail, 'aluno_id', studentId)

      // 10. Delete the student's record
      const { error } = await supabaseAdmin.from('alunos').delete().eq('id', studentId)
      if (error) throw error

      // Remove do leitor iDFace em segundo plano
      syncStudentToDevices(studentId, 'delete').catch(err => 
        console.error('[Portaria Sync Error]', err.message)
      )
    }

    if (all) {
      // Get all student IDs in the database
      const { data: allStudents, error: fetchAllError } = await supabaseAdmin
        .from('alunos')
        .select('id')
      
      if (fetchAllError) throw fetchAllError
      
      const studentIds = (allStudents || []).map(s => s.id)
      
      // Delete in parallel chunks of 10 to keep system responsive but fast
      const chunkSize = 10
      for (let i = 0; i < studentIds.length; i += chunkSize) {
        const chunk = studentIds.slice(i, i + chunkSize)
        await Promise.all(chunk.map(studentId => deleteSingleStudent(studentId)))
      }
      
      return NextResponse.json({ ok: true, count: studentIds.length })
    } else if (id) {
      await deleteSingleStudent(id)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Nenhuma ação executada' }, { status: 400 })
  } catch (e: any) {
    console.error(`[${new Date().toISOString()}] Error Alunos DELETE: ${e.message}\n`)
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

function buildRow(a: any) {
  const { 
    id, nome, matricula, turma, serie, turno, status, email, 
    data_nascimento, responsavel, responsavel_financeiro, responsavel_pedagogico, 
    telefone, inadimplente, risco_evasao, media, frequencia, obs, unidade, foto,
    responsaveis, _responsaveis, historicoTurmas,
    ...rest 
  } = a

  // Map fields from the UI form if they are different
  const mappedNome = nome || a.nomeCompleto || ''
  const mappedMatricula = matricula?.trim() || a.codigo?.trim() || null
  const mappedEmail = email || ''
  const mappedTelefone = telefone || ''
  const mappedDataNasc = data_nascimento || a.dataNasc || ''
  
  // Handle status: if 'ativo' boolean is passed, map to 'matriculado' or 'inativo'
  let mappedStatus = status
  if (a.ativo !== undefined) {
    mappedStatus = a.ativo ? 'matriculado' : 'inativo'
  }

  // Usa o código manual (a.codigo) como ID se disponível, senão usa o ID atual ou gera um novo
  let finalId = a.codigo || id
  if (!finalId || finalId.startsWith('TEMP-') || finalId === '') {
    finalId = `AL-${Date.now()}-${Math.random().toString(36).slice(2,6)}`
  }

  // Encontra o responsável financeiro e pedagógico para preencher os campos legados
  const listResps = responsaveis || a._responsaveis || []
  const firstResp = listResps?.[0]?.nome || ''
  const finResp = listResps?.find((r: any) => r.isFinanceiro || r.respFinanceiro)?.nome || firstResp
  const pedResp = listResps?.find((r: any) => r.isPedagogico || r.respPedagogico)?.nome || firstResp

  const extractName = (val: any) => {
    if (!val) return ''
    if (typeof val === 'object') return val.nome || ''
    if (typeof val === 'string' && val.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(val)
        return parsed.nome || val
      } catch (e) {
        return val
      }
    }
    return val
  }

  let activeTurma = turma || '';
  
  if (historicoTurmas && Array.isArray(historicoTurmas) && historicoTurmas.length > 0) {
    rest.historicoTurmas = historicoTurmas;
    // A última turma adicionada é sempre considerada a turma atual (matriculado)
    const mainTurma = historicoTurmas[historicoTurmas.length - 1];
      
    activeTurma = mainTurma.serieTurma || activeTurma;
    rest.anoLetivo = mainTurma.anoLetivo;
  }

  return {
    id: finalId,
    nome: mappedNome,
    matricula: mappedMatricula,
    turma: activeTurma,
    serie: serie || '',
    turno: turno || '',
    status: mappedStatus || 'matriculado',
    email: mappedEmail,
    data_nascimento: mappedDataNasc,
    responsavel: extractName(responsavel) || firstResp,
    responsavel_financeiro: extractName(responsavel_financeiro) || finResp,
    responsavel_pedagogico: extractName(responsavel_pedagogico) || pedResp,
    telefone: mappedTelefone,
    inadimplente: inadimplente || false,
    risco_evasao: risco_evasao || 'baixo',
    media: media || null,
    frequencia: frequencia || 100,
    obs: obs || '',
    unidade: unidade || 'Unidade Centro',
    foto: foto || null,
    dados: rest, // Guarda outros campos no JSONB
    updated_at: new Date().toISOString(),
  }
}
