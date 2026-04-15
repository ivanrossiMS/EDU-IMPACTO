import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normDate(v: string | null | undefined): string | null {
  if (!v) return null
  const s = v.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return null
}

function normMoney(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'number') return v
  return parseFloat(String(v).replace(/[R$\s.]/g, '').replace(',', '.')) || 0
}

// ─── Entity builders ──────────────────────────────────────────────────────────

function buildAluno(m: Record<string, string>) {
  return {
    id: m.id || crypto.randomUUID(),
    nome: m.nome || '',
    matricula: m.matricula || m.codigo || '',
    turma: m.turma || '',
    serie: m.serie || '',
    turno: m.turno || '',
    status: m.situacao || m.status || 'matriculado',
    email: m.email || null,
    cpf: m.cpf || null,
    data_nascimento: normDate(m.dataNasc || m.data_nascimento || ''),
    telefone: m.telefone || m.celular || null,
    inadimplente: false,
    risco_evasao: 'baixo',
    obs: m.obs || null,
    unidade: m.unidade || '',
    foto: null,
    dados: {
      codigo: m.codigo || m.matricula || '',
      nomeSocial: m.nomeSocial || '',
      rg: m.rg || '',
      nis: m.nis || '',
      racaCor: m.racaCor || '',
      nacionalidade: m.nacionalidade || 'Brasileira',
      naturalidade: m.naturalidade || '',
      filiacaoMae: m.filiacaoMae || '',
      filiacaoPai: m.filiacaoPai || '',
      endereco: m.endereco || '',
      numero: m.numero || '',
      bairro: m.bairro || '',
      cidade: m.cidade || '',
      estado: m.estado || '',
      cep: m.cep || '',
      sexo: m.sexo || '',
      responsavel: m.respNome || m.filiacaoMae || '',
      saude: {
        autorizaSaida: (m.saude_autorizaSaida || '').toLowerCase() === 'sim',
        autorizadosBusca: m.saude_autorizado_nome ? [{
          id: crypto.randomUUID(),
          nome: m.saude_autorizado_nome || '',
          telefone: m.saude_autorizado_telefone || '',
          parentesco: m.saude_autorizado_parentesco || '',
          diasSemana: m.saude_autorizado_dias
            ? m.saude_autorizado_dias.split(',').map((d: string) => d.trim())
            : [],
          liberado: (m.saude_autorizado_liberado || '').toLowerCase() !== 'não',
          rfid: m.saude_autorizado_rfid || ''
        }] : []
      }
    }
  }
}

function buildTurma(m: Record<string, string>) {
  return {
    id: m.id || `T${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    codigo: m.codigo || '',
    nome: m.nome || '',
    serie: m.serie || '',
    turno: m.turno || '',
    professor: m.professor || '',
    sala: m.sala || '',
    capacidade: parseInt(m.capacidade) || 30,
    matriculados: 0,
    unidade: m.unidade || '',
    ano: parseInt(m.anoLetivo || m.ano || '') || new Date().getFullYear(),
    dados: {
      status: m.status || 'ativa',
      dataMatricula: normDate(m.dataMatricula || '') || '',
      dataResultado: normDate(m.dataResultado || '') || '',
    }
  }
}

function buildResponsavel(m: Record<string, string>) {
  return {
    id: m.id || crypto.randomUUID(),
    nome: m.nome || '',
    cpf: m.cpf ? String(m.cpf).replace(/\D/g, '') : null,
    rg: m.rg || null,
    org_emissor: m.orgEmissor || null,
    sexo: m.sexo || null,
    data_nasc: normDate(m.dataNasc || '') || null,
    email: m.email || null,
    telefone: m.telefone || null,
    celular: m.celular || null,
    rfid: m.rfid || null,
    codigo: m.codigo || null,
    profissao: m.profissao || null,
    naturalidade: m.naturalidade || null,
    uf: m.uf || null,
    nacionalidade: m.nacionalidade || 'Brasileira',
    estado_civil: m.estadoCivil || null,
    obs: m.obs || null,
    endereco: {
      logradouro: m.endereco || '',
      numero: m.numero || '',
      bairro: m.bairro || '',
      cidade: m.cidade || '',
      estado: m.estado || '',
      cep: m.cep || '',
    },
    dados: {}
  }
}

function buildFuncionario(m: Record<string, string>) {
  return {
    id: m.id || crypto.randomUUID(),
    nome: m.nome || '',
    cargo: m.cargo || '',
    departamento: m.departamento || m.setor || '',
    salario: normMoney(m.salario),
    status: m.status || m.situacao || 'ativo',
    email: m.email || '',
    admissao: normDate(m.admissao || m.dataAdmissao || '') || '',
    unidade: m.unidade || '',
    dados: {
      cpf: m.cpf || '',
      rg: m.rg || '',
      telefone: m.telefone || m.celular || '',
      pis: m.pis || m.nis || '',
      ctps: m.ctps || '',
      tipoContrato: m.tipoContrato || '',
      carga_horaria: m.cargaHoraria || '',
      banco: m.banco || '',
      agencia: m.agencia || '',
      conta: m.conta || '',
      endereco: m.endereco || '',
      cidade: m.cidade || '',
      estado: m.estado || '',
      cep: m.cep || '',
      obs: m.obs || ''
    }
  }
}

function buildContaPagar(m: Record<string, string>) {
  return {
    id: m.id || crypto.randomUUID(),
    descricao: m.descricao || '',
    categoria: m.categoria || '',
    valor: normMoney(m.valor),
    vencimento: normDate(m.vencimento || '') || '',
    status: m.status || (m.dataPagamento ? 'pago' : 'pendente'),
    fornecedor: m.fornecedor || '',
    numero_documento: m.numeroDocumento || null,
    dados: {
      dataPagamento: normDate(m.dataPagamento || '') || '',
      formaPagamento: m.formaPagamento || '',
      centroCusto: m.centroCusto || '',
      obs: m.obs || ''
    }
  }
}

function buildTitulo(m: Record<string, string>) {
  const dtPagto = normDate(m.pagamento || m.dataPagamento || '')
  return {
    id: m.id || crypto.randomUUID(),
    aluno: m.nomeAluno || m.codigoAluno || '',
    responsavel: m.responsavel || '',
    descricao: m.descricao || m.evento || '',
    valor: normMoney(m.valor),
    vencimento: normDate(m.vencimento || '') || '',
    pagamento: dtPagto,
    status: dtPagto ? 'pago' : (m.status || 'pendente'),
    metodo: m.formaPagamento || m.metodo || null,
    parcela: m.parcela || '1/1',
    dados: {
      codigoAluno: m.codigoAluno || '',
      desconto: normMoney(m.desconto),
      juros: normMoney(m.juros),
      multa: normMoney(m.multa),
      valorPago: normMoney(m.valorPago || m.valor),
      obs: m.obs || ''
    }
  }
}

// ─── GET /api/importacao?modulo=X → retorna modelo de colunas ────────────────

const MODELS: Record<string, string[]> = {
  alunos: [
    'codigo','nome','nomeSocial','sexo','dataNasc','cpf','rg','nis',
    'email','telefone','celular','endereco','numero','bairro','cidade','estado','cep',
    'serie','turma','turno','situacao','racaCor','nacionalidade','naturalidade',
    'filiacaoMae','filiacaoPai','unidade','obs',
    'saude_autorizaSaida','saude_autorizado_nome','saude_autorizado_telefone',
    'saude_autorizado_parentesco','saude_autorizado_liberado','saude_autorizado_dias'
  ],
  turmas: ['codigo','nome','serie','turno','sala','capacidade','professor','unidade','anoLetivo','status','dataMatricula','dataResultado'],
  responsaveis: ['nome','cpf','rg','orgEmissor','sexo','dataNasc','email','telefone','celular','profissao','parentesco','codigoAluno','respFinanceiro','respPedagogico','rfid','naturalidade','uf','estadoCivil','endereco','numero','bairro','cidade','estado','cep','obs'],
  funcionarios: ['nome','cargo','departamento','salario','status','email','admissao','cpf','rg','pis','ctps','tipoContrato','cargaHoraria','banco','agencia','conta','unidade','endereco','cidade','estado','cep','obs'],
  contas_pagar: ['descricao','categoria','valor','vencimento','status','fornecedor','numeroDocumento','dataPagamento','formaPagamento','centroCusto','obs'],
  titulos: ['codigoAluno','nomeAluno','descricao','valor','vencimento','parcela','status','pagamento','valorPago','desconto','juros','multa','formaPagamento','obs'],
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const modulo = searchParams.get('modulo') || ''
  const fields = MODELS[modulo]
  if (!fields) return NextResponse.json({ error: 'Módulo inválido' }, { status: 400 })
  return NextResponse.json({ modulo, fields })
}

// ─── POST /api/importacao ────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const supabase = await createProtectedClient()
    const body = await request.json()
    const { modulo, rows } = body as { modulo: string; rows: Record<string, string>[] }

    if (!modulo || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'modulo e rows são obrigatórios' }, { status: 400 })
    }

    let inseridos = 0
    let atualizados = 0
    let erros = 0
    const erroDetails: { linha: number; msg: string }[] = []

    // ── ALUNOS ──────────────────────────────────────────────────────────────
    if (modulo === 'alunos') {
      const builtRows: any[] = []
      rows.forEach((m, i) => {
        if (!m.nome?.trim()) { erros++; erroDetails.push({ linha: i + 2, msg: 'Nome obrigatório' }); return }
        builtRows.push(buildAluno(m))
      })

      if (builtRows.length > 0) {
        // Checar existentes por matricula
        const matriculas = builtRows.map(r => r.matricula).filter(Boolean)
        const { data: existentes } = await supabase.from('alunos').select('id,matricula').in('matricula', matriculas)
        const existenteMap = new Map((existentes || []).map(e => [e.matricula, e.id]))

        for (const row of builtRows) {
          const existeId = existenteMap.get(row.matricula)
          if (existeId) { row.id = existeId; atualizados++ } else { inseridos++ }
        }

        const { error } = await supabase.from('alunos').upsert(builtRows)
        if (error) throw new Error(error.message)
      }
    }

    // ── TURMAS ──────────────────────────────────────────────────────────────
    else if (modulo === 'turmas') {
      const builtRows: any[] = []
      rows.forEach((m, i) => {
        if (!m.nome?.trim()) { erros++; erroDetails.push({ linha: i + 2, msg: 'Nome da Turma obrigatório' }); return }
        builtRows.push(buildTurma(m))
      })

      if (builtRows.length > 0) {
        const codigos = builtRows.map(r => r.codigo).filter(Boolean)
        const { data: exist } = codigos.length
          ? await supabase.from('turmas').select('id,codigo').in('codigo', codigos)
          : { data: [] }
        const existMap = new Map((exist || []).map(e => [e.codigo, e.id]))

        for (const row of builtRows) {
          const eId = row.codigo ? existMap.get(row.codigo) : null
          if (eId) { row.id = eId; atualizados++ } else { inseridos++ }
        }

        const { error } = await supabase.from('turmas').upsert(builtRows)
        if (error) throw new Error(error.message)
      }
    }

    // ── RESPONSÁVEIS ────────────────────────────────────────────────────────
    else if (modulo === 'responsaveis') {
      for (const [i, m] of rows.entries()) {
        if (!m.nome?.trim()) { erros++; erroDetails.push({ linha: i + 2, msg: 'Nome obrigatório' }); continue }
        const respRow = buildResponsavel(m)

        // Checar por CPF ou nome
        let existeId: string | null = null
        if (respRow.cpf) {
          const { data: ex } = await supabase.from('responsaveis').select('id').eq('cpf', respRow.cpf).maybeSingle()
          if (ex) { existeId = ex.id; atualizados++ } else { inseridos++ }
        } else { inseridos++ }
        if (existeId) respRow.id = existeId

        await supabase.from('responsaveis').upsert(respRow)

        // Vincular ao aluno se codigoAluno informado
        if (m.codigoAluno) {
          const { data: aluno } = await supabase.from('alunos').select('id').eq('matricula', m.codigoAluno).maybeSingle()
          if (aluno) {
            await supabase.from('aluno_responsavel').upsert({
              aluno_id: aluno.id,
              responsavel_id: respRow.id,
              parentesco: m.parentesco || 'Outro',
              resp_financeiro: (m.respFinanceiro || '').toLowerCase() === 'sim',
              resp_pedagogico: (m.respPedagogico || '').toLowerCase() === 'sim',
            })
          }
        }
      }
    }

    // ── FUNCIONÁRIOS ────────────────────────────────────────────────────────
    else if (modulo === 'funcionarios') {
      const builtRows: any[] = []
      rows.forEach((m, i) => {
        if (!m.nome?.trim()) { erros++; erroDetails.push({ linha: i + 2, msg: 'Nome obrigatório' }); return }
        builtRows.push(buildFuncionario(m))
      })

      if (builtRows.length > 0) {
        // Checar duplicata por email
        const emails = builtRows.map(r => r.email).filter(Boolean)
        const { data: exist } = emails.length
          ? await supabase.from('funcionarios').select('id,email').in('email', emails)
          : { data: [] }
        const existMap = new Map((exist || []).map(e => [e.email, e.id]))

        for (const row of builtRows) {
          const eId = row.email ? existMap.get(row.email) : null
          if (eId) { row.id = eId; atualizados++ } else { inseridos++ }
        }

        const { error } = await supabase.from('funcionarios').upsert(builtRows)
        if (error) throw new Error(error.message)
      }
    }

    // ── CONTAS A PAGAR ──────────────────────────────────────────────────────
    else if (modulo === 'contas_pagar') {
      const builtRows: any[] = []
      rows.forEach((m, i) => {
        if (!m.descricao?.trim() && !m.valor) { erros++; erroDetails.push({ linha: i + 2, msg: 'Descrição ou Valor obrigatórios' }); return }
        builtRows.push(buildContaPagar(m))
        inseridos++
      })

      if (builtRows.length > 0) {
        const { error } = await supabase.from('contas_pagar').insert(builtRows)
        if (error) throw new Error(error.message)
      }
    }

    // ── FINANCEIRO (TÍTULOS LEGADOS) ─────────────────────────────────────────
    else if (modulo === 'titulos') {
      const builtRows: any[] = []
      rows.forEach((m, i) => {
        if (!m.codigoAluno && !m.nomeAluno) { erros++; erroDetails.push({ linha: i + 2, msg: 'Código do Aluno obrigatório' }); return }
        if (!m.valor) { erros++; erroDetails.push({ linha: i + 2, msg: 'Valor obrigatório' }); return }

        // Enriquecer com aluno_id real se possível — feito de forma fire-and-forget
        builtRows.push(buildTitulo(m))
        inseridos++
      })

      if (builtRows.length > 0) {
        const { error } = await supabase.from('titulos').insert(builtRows)
        if (error) throw new Error(error.message)
      }
    }

    else {
      return NextResponse.json({ error: `Módulo desconhecido: ${modulo}` }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      modulo,
      total: rows.length,
      inseridos,
      atualizados,
      erros,
      ignorados: 0,
      erroDetails: erroDetails.slice(0, 20),
    })

  } catch (e: any) {
    console.error('[POST /api/importacao]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
