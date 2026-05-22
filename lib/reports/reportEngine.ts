// ═══════════════════════════════════════════════════════════
// REPORT ENGINE — Motor de resolução de dados
// Lê de JSONB alunos.dados + tabelas normalizadas
// ═══════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface QueryRequest {
  source: string
  filters: Record<string, string>
  page: number
  pageSize: number
  sortField?: string
  sortDir?: 'asc' | 'desc'
}

export interface QueryResult {
  data: Record<string, unknown>[]
  total: number
  page: number
  pageSize: number
  aggregates?: Record<string, number>
}

// ─── Helpers ─────────────────────────────────────────────

function calcAge(dateStr: string): number {
  if (!dateStr) return 0
  const parts = dateStr.includes('/') ? dateStr.split('/').reverse().join('-') : dateStr
  const d = new Date(parts + 'T12:00:00')
  if (isNaN(d.getTime())) return 0
  const diff = Date.now() - d.getTime()
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
}

function parseDateForFilter(dateStr: string): string {
  if (!dateStr) return ''
  if (dateStr.includes('/')) {
    const [d, m, y] = dateStr.split('/')
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return dateStr
}

function normalize(s: string): string {
  if (!s) return ''
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function matchFilter(value: string | undefined, filter: string): boolean {
  if (!filter) return true
  if (!value) return false
  return normalize(value.toString()).includes(normalize(filter.toString()))
}

// ─── Source Resolvers ────────────────────────────────────

async function resolveAlunos(filters: Record<string, string>): Promise<Record<string, unknown>[]> {
  const [
    { data: alunos },
    { data: matriculas },
    { data: arLinks },
    { data: resps },
    { data: turmasData }
  ] = await Promise.all([
    supabase.from('alunos').select('id, nome, matricula, turma, status, unidade, email, data_nascimento, telefone, dados, serie, turno'),
    supabase.from('matriculas').select('aluno_id, turma, serie, turno, ano_letivo, status, turma_id'),
    supabase.from('aluno_responsavel').select('aluno_id, responsavel_id, resp_financeiro'),
    supabase.from('responsaveis').select('id, nome, cpf'),
    supabase.from('turmas').select('id, nome, serie, turno, dados')
  ])

  if (!alunos) return []

  const matMap = new Map<string, any>()
  ;(matriculas || []).forEach(m => {
    if (!matMap.has(m.aluno_id) || (m.ano_letivo > (matMap.get(m.aluno_id)?.ano_letivo || 0))) {
      matMap.set(m.aluno_id, m)
    }
  })

  const respMap = new Map<string, any>()
  ;(resps || []).forEach(r => respMap.set(r.id, r))

  const turmaNomeById = new Map<string, string>()
  const turmaSerieById = new Map<string, string>()
  const turmaTurnoById = new Map<string, string>()
  ;(turmasData || []).forEach(t => {
    turmaNomeById.set(t.id, t.nome)
    turmaSerieById.set(t.id, t.dados?.serieId || t.serie)
    turmaTurnoById.set(t.id, t.turno)
  })

  return alunos.map(a => {
    const mat = matMap.get(a.id)
    const arLink = (arLinks || []).find(ar => ar.aluno_id === a.id && ar.resp_financeiro)
    const resp = arLink ? respMap.get(arLink.responsavel_id) : null
    const dados = a.dados || {}
    const dataNasc = dados.dataNasc || a.data_nascimento || ''

    // Extract tipoMatricula and dataMatricula
    const histArr = Array.isArray(dados.historicoMatriculas) ? dados.historicoMatriculas : []
    // Tenta pegar histórico ativo (Cursando) primeiro, senão pega o último lançado
    const hist = histArr.find((h: any) => {
      const sit = (h.situacao || '').toLowerCase()
      return sit === 'cursando' || sit === 'prog. continuada' || sit === 'progredido' || sit === 'matriculado' || sit === 'ativo'
    }) || histArr[histArr.length - 1] || null

    const tipoMatriculaRaw = hist?.tipoMatricula || dados.dadosMatricula?.tipoMatricula || 'nova'
    const dataMatricula = hist?.dataMatricula || dados.dadosMatricula?.dataIngresso || ''
    const nivelEnsino = mat?.nivel || dados.dadosMatricula?.nivelEnsino || (mat?.turma ? (mat.turma.toLowerCase().includes('infantil') ? 'Infantil' : mat.turma.toLowerCase().includes('médio') || mat.turma.toLowerCase().includes('medio') ? 'Ensino Médio' : 'Ensino Fundamental') : '')

    return {
      id: a.id,
      codigo: dados.codigo || a.matricula || a.id.slice(0, 8),
      nome: a.nome,
      turma: turmaNomeById.get(mat?.turma_id) || turmaNomeById.get(hist?.turmaId) || turmaNomeById.get(dados.dadosMatricula?.turmaId) || mat?.turma || a.turma || '',
      serie: turmaSerieById.get(mat?.turma_id) || turmaSerieById.get(hist?.turmaId) || turmaSerieById.get(dados.dadosMatricula?.turmaId) || mat?.serie || a.serie || '',
      turno: turmaTurnoById.get(mat?.turma_id) || turmaTurnoById.get(hist?.turmaId) || turmaTurnoById.get(dados.dadosMatricula?.turmaId) || mat?.turno || a.turno || '',
      unidade: a.unidade || '',
      status: mat?.status || a.status || 'matriculado',
      statusMatricula: mat?.status || a.status || '',
      tipoMatricula: tipoMatriculaRaw,
      dataMatricula,
      nivelEnsino,
      dataNascimento: dataNasc,
      idade: calcAge(dataNasc),
      email: dados.email || a.email || '',
      telefone: dados.celular || a.telefone || '',
      responsavelFinanceiro: resp?.nome || '',
      cpfResponsavel: resp?.cpf || '',
      anoLetivo: mat?.ano_letivo || new Date().getFullYear(),
      mesAniversario: dataNasc ? String(new Date(parseDateForFilter(dataNasc) + 'T12:00').getMonth() + 1) : '',
      sexo: dados.sexo || '',
    }
  }).filter(row => {
    if (filters.busca && !row.nome.toLowerCase().includes(filters.busca.toLowerCase()) && !(row.codigo || '').toLowerCase().includes(filters.busca.toLowerCase())) return false
    if (filters.unidade && !matchFilter(row.unidade as string, filters.unidade)) return false
    if (filters.turma && !matchFilter(row.turma as string, filters.turma)) return false
    if (filters.serie && !matchFilter(row.serie as string, filters.serie)) return false
    if (filters.turno && row.turno !== filters.turno) return false
    if (filters.statusMatricula && row.statusMatricula !== filters.statusMatricula) return false
    if (filters.sexo && row.sexo !== filters.sexo) return false
    if (filters.mesAniversario && row.mesAniversario !== filters.mesAniversario) return false
    if (filters.anoLetivo && String(row.anoLetivo) !== filters.anoLetivo) return false
    return true
  })
}

async function resolveFinanceiro(filters: Record<string, string>, source: string): Promise<Record<string, unknown>[]> {
  // Read financial data from alunos.dados JSONB (where real data lives)
  const [
    { data: alunos },
    { data: arLinks },
    { data: resps },
    { data: matriculas },
    { data: turmasData }
  ] = await Promise.all([
    supabase.from('alunos').select('id, nome, turma, serie, turno, unidade, dados, matricula'),
    supabase.from('aluno_responsavel').select('aluno_id, responsavel_id, parentesco, resp_financeiro'),
    supabase.from('responsaveis').select('id, nome, cpf, rg, email, telefone, celular, dados, profissao, empresa'),
    supabase.from('matriculas').select('aluno_id, turma, serie, turma_id, ano_letivo, status, unidade'),
    supabase.from('turmas').select('id, nome, unidade')
  ])

  if (!alunos) return []

  const respMap = new Map<string, any>()
  ;(resps || []).forEach(r => respMap.set(r.id, r))

  // turmaUnidadeMap: id → unidade AND nome → unidade (both lookups needed)
  const turmaUnidadeById = new Map<string, string>()
  const turmaUnidadeByNome = new Map<string, string>()
  const turmaNomeById = new Map<string, string>()
  ;(turmasData || []).forEach(t => {
    if (t.id) {
      turmaUnidadeById.set(t.id, t.unidade || '')
      turmaNomeById.set(t.id, t.nome || '')
    }
    if (t.nome) {
      turmaUnidadeByNome.set(t.nome, t.unidade || '')
    }
  })

  const matMap = new Map<string, any>()
  ;(matriculas || []).forEach(m => {
    if (!matMap.has(m.aluno_id) || (m.ano_letivo > (matMap.get(m.aluno_id)?.ano_letivo || 0)))
      matMap.set(m.aluno_id, m)
  })

  const rows: Record<string, unknown>[] = []
  const today = new Date().toISOString().slice(0, 10)

  for (const a of alunos) {
    const dados = a.dados || {}
    const parcelas = dados.parcelas || dados.financeiro?.parcelas || []
    if (!Array.isArray(parcelas) || parcelas.length === 0) continue

    const mat = matMap.get(a.id)
    const arLink = (arLinks || []).find(ar => ar.aluno_id === a.id && ar.resp_financeiro)
    const resp = arLink ? respMap.get(arLink.responsavel_id) : null

    for (const p of parcelas) {
      if (p.status === 'cancelado' && source !== 'financeiro_extrato') continue

      // Normalize vencimento — can arrive as DD/MM/YYYY or YYYY-MM-DD
      const rawVenc = p.vencimento || ''
      const venc = parseDateForFilter(rawVenc) || ''
      const vencDisplay = venc ? venc : rawVenc   // keep raw as fallback for display

      const dtPagto = parseDateForFilter(p.dtPagto || '') || ''
      const valor = Number(p.valor) || 0
      let desconto = Number(p.desconto) || 0
      const isPago = p.status === 'pago' || p.situacao === 'pago'
      const isVencido = !isPago && venc && venc < today

      // Perda automática de desconto por vencimento
      if (isVencido && !p.manterDesconto) {
        desconto = 0
      }

      // Juros & multa: use stored value if present;
      // otherwise auto-calculate for overdue parcelas (common when system stores 0)
      // Multa: 2% flat on first day late. Juros: 0.033%/day (≈1%/month) after first day.
      let juros  = Number(p.juros)  || 0
      let multa  = Number(p.multa)  || 0
      if (isVencido && juros === 0 && multa === 0) {
        const diasAtr = Math.max(0, Math.floor((Date.now() - new Date(venc + 'T12:00:00').getTime()) / 86400000))
        if (diasAtr >= 1) {
          multa = Number(((valor - desconto) * 0.02).toFixed(2))
          juros = Number(((valor - desconto) * 0.00033 * diasAtr).toFixed(2))
        }
      }

      const valorPago = Number(p.valorFinal || p.valorPago) || 0

      const statusFin = isPago ? 'pago' : (p.status === 'cancelado' ? 'cancelado' : (p.status === 'renegociado' ? 'renegociado' : (isVencido ? 'vencido' : 'pendente')))

      // Build responsável data
      // NOTE: address lives inside resp.dados.endereco (nested object), NOT flat columns
      const respDados   = resp?.dados || {}
      const respEnd_obj = respDados.endereco || {}   // { logradouro, numero, bairro, cidade, estado, cep, complemento }

      const respNome    = resp?.nome      || p.responsavel || ''
      const respCpf     = resp?.cpf       || respDados.cpf  || ''
      const respRg      = resp?.rg        || respDados.rg   || ''
      const respEmail   = resp?.email     || respDados.email || ''
      const respTel     = resp?.telefone  || respDados.telefone || ''
      const respCel     = resp?.celular   || respDados.celular  || ''
      // Address from nested object
      const respEnd     = respEnd_obj.logradouro  || ''
      const respNum     = respEnd_obj.numero       || ''
      const respComp    = respEnd_obj.complemento  || ''
      const respBairro  = respEnd_obj.bairro       || ''
      const respCidade  = respEnd_obj.cidade       || ''
      const respUF      = respEnd_obj.estado || respEnd_obj.uf || respDados.uf || ''
      const respCep     = respEnd_obj.cep          || respDados.cep || ''
      const respProfissao  = resp?.profissao  || respDados.profissao  || ''
      const respEmpresa    = resp?.empresa    || respDados.empresa    || ''
      const respParentesco = respDados.parentesco || arLink?.parentesco || ''

      const row: Record<string, unknown> = {
        alunoId: a.id,
        codigo: dados.codigo || a.matricula || a.id.slice(0, 8),
        nome: a.nome,
        turma: mat?.turma 
          || turmaNomeById.get(mat?.turma_id) 
          || p.turmaNome 
          || turmaNomeById.get(p.turmaId) 
          || turmaNomeById.get(dados.dadosMatricula?.turmaId) 
          || a.turma 
          || '',
        serie: mat?.serie || a.serie || '',
        // Resolve unidade from: aluno → matricula → turma (by id or name)
        unidade: a.unidade
          || mat?.unidade
          || turmaUnidadeById.get(mat?.turma_id || '')
          || turmaUnidadeByNome.get(mat?.turma || a.turma || '')
          || '',
        // Responsável — completo
        responsavelFinanceiro: respNome,
        cpfResponsavel: respCpf,
        rgResponsavel: respRg,
        emailResponsavel: respEmail,
        telefoneResponsavel: respTel,
        celularResponsavel: respCel,
        enderecoResponsavel: respEnd,
        numeroResponsavel: respNum,
        complementoResponsavel: respComp,
        bairroResponsavel: respBairro,
        cidadeResponsavel: respCidade,
        ufResponsavel: respUF,
        cepResponsavel: respCep,
        profissaoResponsavel: respProfissao,
        empresaResponsavel: respEmpresa,
        parentescoResponsavel: respParentesco,
        // Financeiro
        evento: p.evento || p.descricao || 'Mensalidade',
        parcela: String(p.num || p.parcela || ''),
        competencia: p.competencia || '',
        vencimento: vencDisplay || rawVenc,
        dataPagamento: p.dtPagto || '',
        observacaoBaixa: String(p.obs || p.observacao || ''),
        valor,
        desconto,
        juros,
        multa,
        valorPago: isPago ? valorPago : 0,
        saldo: isPago ? 0 : Math.max(0, valor - desconto + juros + multa),
        formaPagamento: p.formaPagto || (p.formasPagto?.[0]?.forma) || '',
        statusFinanceiro: statusFin,
        percDesconto: valor > 0 ? (desconto / valor * 100) : 0,
        anoLetivo: mat?.ano_letivo || new Date().getFullYear(),
        // Campos extras para Fluxo de Recebimentos
        caixa: p.caixa || '',
        nossoNumero: p.nossoNumero || p.referencia || '',
        origemBaixa: p.origemBaixa || (isPago ? 'manual' : ''),
        usuarioBaixa: p.usuarioBaixa || '',
        dataBaixa: p.dataBaixa || (isPago ? p.dtPagto || '' : ''),
        descricaoTitulo: p.descricao || p.evento || 'Mensalidade',
      }

      // Apply source-specific filters
      if (source === 'financeiro_inadimplentes' && statusFin !== 'vencido') continue
      if (source === 'financeiro_descontos' && desconto <= 0) continue
      // Para 'financeiro_recebimentos' a exclusão de 'não pagos' é transferida p/ o UI

      // Apply user filters
      if (filters.busca && !normalize(a.nome || '').includes(normalize(filters.busca))) continue
      if (filters.responsavelNome && !normalize((row.responsavelFinanceiro as string) || '').includes(normalize(filters.responsavelNome))) continue
      if (filters.unidade && !matchFilter(row.unidade as string, filters.unidade)) continue
      if (filters.turma && !matchFilter(row.turma as string, filters.turma)) continue
      if (filters.serie && !matchFilter(row.serie as string, filters.serie)) continue
      if (filters.statusFinanceiro && statusFin !== filters.statusFinanceiro) continue
      if (filters.formaPagamento && row.formaPagamento !== filters.formaPagamento) continue
      if (filters.anoLetivo && String(row.anoLetivo) !== filters.anoLetivo) continue
      
      if (filters.dataInicio) {
        // Se for relatorio recebimentos e estiver PAGO, usar a dtPagto, senão fallback pra venc
        const d = (source.includes('recebimentos') || source.includes('extrato')) && isPago ? dtPagto : venc
        if (d && d < filters.dataInicio) continue
      }
      if (filters.dataFim) {
        const d = (source.includes('recebimentos') || source.includes('extrato')) && isPago ? dtPagto : venc
        if (d && d > filters.dataFim) continue
      }

      rows.push(row)
    }
  }

  return rows
}

async function resolveTurmas(filters: Record<string, string>): Promise<Record<string, unknown>[]> {
  const { data: turmas } = await supabase.from('turmas').select('*')
  if (!turmas) return []

  return turmas.map(t => ({
    id: t.id,
    codigo: t.codigo || '',
    nome: t.nome,
    serie: t.serie || '',
    turno: t.turno || '',
    professor: t.professor || '',
    sala: t.sala || '',
    capacidade: t.capacidade || 30,
    matriculados: t.matriculados || 0,
    vagas: Math.max(0, (t.capacidade || 30) - (t.matriculados || 0)),
    ocupacao: t.capacidade > 0 ? Math.round((t.matriculados || 0) / t.capacidade * 100) : 0,
    unidade: t.unidade || '',
    ano: t.ano,
  })).filter(row => {
    if (filters.unidade && !matchFilter(row.unidade as string, filters.unidade)) return false
    if (filters.serie && !matchFilter(row.serie as string, filters.serie)) return false
    if (filters.turno && row.turno !== filters.turno) return false
    if (filters.anoLetivo && String(row.ano) !== filters.anoLetivo) return false
    return true
  })
}

async function resolveSimpleTable(table: string, filters: Record<string, string>): Promise<Record<string, unknown>[]> {
  const { data } = await supabase.from(table).select('*').order('created_at', { ascending: false }).limit(500)
  if (!data) return []

  return data.filter((row: any) => {
    if (filters.busca) {
      const searchable = Object.values(row).join(' ').toLowerCase()
      if (!searchable.includes(filters.busca.toLowerCase())) return false
    }
    if (filters.unidade && row.unidade && !matchFilter(row.unidade, filters.unidade)) return false
    if (filters.statusFunc && row.status !== filters.statusFunc) return false
    if (filters.perfil && row.perfil && !matchFilter(row.perfil, filters.perfil)) return false
    if (filters.modulo && row.modulo && !matchFilter(row.modulo, filters.modulo)) return false
    if (filters.cargo && row.cargo && !matchFilter(row.cargo, filters.cargo)) return false
    if (filters.dataInicio && row.data_hora && row.data_hora < filters.dataInicio) return false
    if (filters.dataFim && row.data_hora && row.data_hora > filters.dataFim + 'T23:59:59') return false
    return true
  })
}

// ─── alunos_completo ─────────────────────────────────────
// Returns raw aluno rows with all 4 responsible parties attached
// as _mae, _pai, _rped, _rfin (plus their links as _mae_link etc.)
// and the latest matricula as _mat — ready for the 133-field catalog.

async function resolveAlunosCompleto(filters: Record<string, string>): Promise<Record<string, unknown>[]> {
  const [
    { data: alunos },
    { data: matriculas },
    { data: arLinks },
    { data: resps },
    { data: turmasRows }
  ] = await Promise.all([
    supabase.from('alunos').select('id, nome, matricula, turma, status, unidade, email, data_nascimento, telefone, dados, sexo, serie, turno'),
    supabase.from('matriculas').select('id, aluno_id, responsavel_financeiro_id, turma, serie, turno, ano_letivo, status, dados_contrato, created_at, updated_at, data_matricula, bolsista, grupo_alunos, turma_id, responsavel_pedagogico_id, situacao, padrao_pagamento_id, data_resultado'),
    supabase.from('aluno_responsavel').select('id, aluno_id, responsavel_id, parentesco, resp_financeiro, resp_pedagogico, created_at, tipo, updated_at, prioridade, autorizacao_retirada, resp_outro'),
    supabase.from('responsaveis').select('id, nome, cpf, rg, email, telefone, celular, dados, profissao, empresa'),
    supabase.from('turmas').select('id, nome, professor, sala, capacidade, matriculados, unidade, codigo, dados')
  ])

  if (!alunos) return []

  // Build maps
  const matMap = new Map<string, any>()
  ;(matriculas || []).forEach(m => {
    if (!matMap.has(m.aluno_id) || (m.ano_letivo > (matMap.get(m.aluno_id)?.ano_letivo || 0)))
      matMap.set(m.aluno_id, m)
  })

  const respMap = new Map<string, any>()
  ;(resps || []).forEach(r => respMap.set(r.id, r))

  // turma lookup for professor/sala/capacidade data
  const turmaByNome = new Map<string, any>()
  ;(turmasRows || []).forEach((t: any) => { if (t.nome) turmaByNome.set(t.nome, t) })

  // parentesco constants
  const PARENTESCO_MAE  = ['mae', 'mãe', 'mother', 'mae']
  const PARENTESCO_PAI  = ['pai', 'father', 'pai']
  const PARENTESCO_PED  = ['resp_pedagogico', 'responsavel_pedagogico', 'pedagogico', 'ped']

  return alunos.map(a => {
    const dados = a.dados || {}
    const mat   = matMap.get(a.id)
    const links = (arLinks || []).filter(ar => ar.aluno_id === a.id)

    // Resolve specific responsible party by role/parentesco
    const rfin_link = links.find(ar => ar.resp_financeiro)
    const rped_link = links.find(ar => ar.resp_pedagogico)
    const mae_link  = links.find(ar => PARENTESCO_MAE.includes(String(ar.parentesco || '').toLowerCase()))
    const pai_link  = links.find(ar => PARENTESCO_PAI.includes(String(ar.parentesco || '').toLowerCase()))

    const rfin = rfin_link ? respMap.get(rfin_link.responsavel_id) : null
    const rped = rped_link ? respMap.get(rped_link.responsavel_id) : null
    const mae  = mae_link  ? respMap.get(mae_link.responsavel_id)  : null
    const pai  = pai_link  ? respMap.get(pai_link.responsavel_id)  : null

    // Derive some quick lookup fields for filters
    const dataNasc       = dados.dataNasc || dados.dataNascimento || a.data_nascimento || ''
    const statusMatricula = mat?.status || a.status || ''
    const anoLetivo      = mat?.ano_letivo || new Date().getFullYear()
    const turma          = mat?.turma || a.turma || ''
    const serie          = mat?.serie || a.serie || ''
    const turno          = mat?.turno || a.turno || ''
    const unidade        = a.unidade || mat?.unidade || ''
    const sexo           = dados.sexo || a.sexo || ''
    const codigo         = dados.codigo || a.matricula || a.id?.slice(0, 8) || ''

    // Filter application
    if (filters.busca && !a.nome?.toLowerCase().includes(filters.busca.toLowerCase()) && !codigo.toLowerCase().includes(filters.busca.toLowerCase())) return null
    if (filters.unidade && !matchFilter(unidade, filters.unidade)) return null
    if (filters.turma   && !matchFilter(turma, filters.turma))     return null
    if (filters.serie   && !matchFilter(serie, filters.serie))     return null
    if (filters.turno   && turno !== filters.turno)               return null
    if (filters.statusMatricula && statusMatricula !== filters.statusMatricula) return null
    if (filters.sexo    && sexo !== filters.sexo)                 return null
    if (filters.anoLetivo && String(anoLetivo) !== filters.anoLetivo) return null

    // Resolve turmaObj for professor/sala/capacidade fields
    const _turmaObj = turmaByNome.get(turma) || (turmasRows || []).find((t: any) => t.id === mat?.turma_id) || null

    return {
      // Raw aluno fields (used by resolve functions)
      ...a,
      dados,
      turma, serie, turno, unidade, statusMatricula, anoLetivo, sexo, codigo,
      // Related rows
      _mat:      mat       || null,
      _rfin:     rfin      || null,
      _rfin_link:rfin_link || null,
      _rped:     rped      || null,
      _rped_link:rped_link || null,
      _mae:      mae       || null,
      _mae_link: mae_link  || null,
      _pai:      pai       || null,
      _pai_link: pai_link  || null,
      _turmaObj: _turmaObj || null,
    }
  }).filter(Boolean) as Record<string, unknown>[]
}

// ─── alunos_relacao ──────────────────────────────────────
// Resolver dedicado ao relatório Relação de Alunos.
//
// Arquitetura de dados (descoberta via análise profunda):
//   - Os dados da matrícula ativa ficam em DOIS lugares:
//     a) aluno.dados.historicoMatriculas[] → fonte principal (wizard salva aqui)
//     b) tabela `matriculas` → fonte secundária (step/matricula + PUT route)
//   - situacao = historicoAtivo.situacao || matriculas.situacao
//   - grupoAlunos = historicoAtivo.grupoAlunos || matriculas.grupo_alunos
//   - turno = historicoAtivo.turno || matriculas.turno || aluno.turno
//   - nivelEnsino = turmas.serie (código: EI, EF1, EF2, EM, EJA) → full name
//   - Responsáveis: via aluno_responsavel → responsaveis (ped > fin)


// ——— alunos_progressao ———
// Resolver destinado a listar alunos com base no histórico de Progressão Parcial.
// Ele extrai "dados.progressaoParcial" do Payload JSONB e achata a estrutura.
async function resolveAlunosProgressao(filters: Record<string, string>): Promise<Record<string, unknown>[]> {
  const [ { data: alunos }, { data: turmasData } ] = await Promise.all([
    supabase.from('alunos').select('id, matricula, nome, unidade, dados'),
    supabase.from('turmas').select('id, nome, serie, dados, turno')
  ]);
  
  if (!alunos) return [];

  const turmaNomeById = new Map<string, string>();
  const turmaSerieById = new Map<string, string>();
  const turmaTurnoById = new Map<string, string>();
  (turmasData || []).forEach(t => {
    turmaNomeById.set(t.id, t.nome);
    turmaSerieById.set(t.id, String(t.dados?.serieId || t.serie || ''));
    turmaTurnoById.set(t.id, t.turno);
  });

  const rawRows: any[] = [];

  for (const a of alunos) {
    const dados = a.dados || {};
    const progArr = Array.isArray(dados.progressaoParcial) ? dados.progressaoParcial : [];
    if (progArr.length === 0) continue;

    for (const prog of progArr) {
      if (!prog) continue;

      let tipoMatch = true;
      let turnoMatch = true;
      let anoMatch = true;
      let ensinoMatch = true; // Níveis de Ensino global
      let serieMatch = true;
      let disciplinaMatch = true;
      let cursandoMatch = true;

      if (filters.tipoReport && filters.tipoReport !== 'todos') {
         if (normalize(prog.tipo || '') !== normalize(filters.tipoReport)) tipoMatch = false;
      }
      if (filters.turno) {
         if ((prog.turno || '') !== filters.turno) turnoMatch = false;
      }
      if (filters.anoLetivo) {
         if (String(prog.ano) !== filters.anoLetivo) anoMatch = false;
      }
      if (filters.serie) {
         if (!matchFilter(prog.serie, filters.serie)) serieMatch = false;
      }
      if (filters.disciplina) {
         if (!matchFilter(prog.disciplina, filters.disciplina)) disciplinaMatch = false;
      }
      if (filters.somenteCursando === 'true') {
         if (prog.resultado !== 'Cursando') cursandoMatch = false;
      }
      // NivelEnsino (Todos vs specific)
      // Usually progressao serie name defines its element, we match the prefix if nivelEnsino is selected
      if (filters.nivelEnsino && filters.nivelEnsino !== 'Todos') {
         // E.g. 'Ensino Medio' usually match 'Serie'
         // We do a soft substring check since the prog format doesn't save raw nivelId
         if (!matchFilter(prog.serie, filters.nivelEnsino)) {
            // Let's try matching if 'Serie' vs 'Fundamental'/'Médio' is loosely connected
            // In ERP, "1ª Série" is High School (Médio). "1º Ano" is Fundamental.
            let isMedio = String(prog.serie).toLowerCase().includes('série') || String(prog.serie).toLowerCase().includes('serie');
            let isFund = String(prog.serie).toLowerCase().includes('ano') || String(prog.serie).toLowerCase().includes('fundamental');
            
            if (filters.nivelEnsino.toLowerCase().includes('médio') && !isMedio) ensinoMatch = false;
            else if (filters.nivelEnsino.toLowerCase().includes('fundamental') && !isFund) ensinoMatch = false;
         }
      }

      if (tipoMatch && turnoMatch && anoMatch && ensinoMatch && serieMatch && disciplinaMatch && cursandoMatch) {
         rawRows.push({
            id: a.id + '_' + prog.id,
            alunoId: a.id,
            codigo: dados.codigo || a.matricula || a.id.slice(0, 8),
            nome: a.nome,
            unidade: a.unidade || '',
            
            // From prog
            progAno: prog.ano,
            progSerie: prog.serie,
            progDisciplina: prog.disciplina,
            progTipo: prog.tipo,
            progTurno: prog.turno,
            progResultado: prog.resultado,
            progCargaHoraria: prog.cargaHoraria,
            progDataResultado: prog.dataResultado || '',
            progNumeroChamada: prog.numeroChamada || ''
         });
      }
    }
  }

  return rawRows;
}

// ─── Shared Helpers for Reports ────────────────────────────────────────────

const NIVEL_CODIGO_MAP: Record<string, string> = {
  'EI': 'Educação Infantil',
  'EI01': 'Educação Infantil',
  'EI02': 'Educação Infantil',
  '1': 'Educação Infantil',
  'EF1': 'Ensino Fundamental I',
  'EF01': 'Ensino Fundamental I',
  '2': 'Ensino Fundamental I',
  'EF2': 'Ensino Fundamental II',
  'EF02': 'Ensino Fundamental II',
  '3': 'Ensino Fundamental II',
  'EM': 'Ensino Médio',
  '4': 'Ensino Médio',
  'EJA': 'EJA',
  '5': 'EJA',
  'TEC': 'Técnico',
  'TECNICO': 'Técnico',
}

const resolveNivelDeTurma = (turmaObj: any): string => {
  if (!turmaObj) return ''
  const serie = (turmaObj.serie || '').toString().trim().toUpperCase()
  if (!serie) return ''
  if (NIVEL_CODIGO_MAP[serie]) return NIVEL_CODIGO_MAP[serie]
  for (const [codigo, nome] of Object.entries(NIVEL_CODIGO_MAP)) {
    if (serie.startsWith(codigo)) return nome
  }
  const seg = turmaObj.dados?.segmento || turmaObj.dados?.nivel || ''
  if (seg) return seg
  return ''
}

const getPhone = (r: any): string => {
  if (!r) return ''
  return r.celular || r.telefone || r.dados?.celular || r.dados?.telefone || ''
}

async function resolveAlunosRelacao(filters: Record<string, string>): Promise<Record<string, unknown>[]> {
  // ── 1. Fetch all base tables in parallel ──────────────────────────────────
  const [
    { data: alunos },
    { data: matriculas },
    { data: arLinks },
    { data: resps },
    { data: turmasRows },
  ] = await Promise.all([
    supabase.from('alunos').select('id, nome, matricula, status, unidade, email, data_nascimento, telefone, dados, sexo, serie, turno'),
    supabase.from('matriculas').select('id, aluno_id, turma_id, turma, status, ano_letivo, data_matricula, data_inicio, created_at, situacao, grupo_alunos'),
    supabase.from('aluno_responsavel').select('aluno_id, responsavel_id, resp_pedagogico, resp_financeiro'),
    supabase.from('responsaveis').select('id, nome, telefone, celular, dados'),
    supabase.from('turmas').select('id, nome, serie, turno, unidade, dados'),
  ])

  if (!alunos) return []

  // ── 2. Build index maps for O(1) lookups ─────────────────────────────────
  // Turmas
  const turmaById   = new Map<string, any>()
  const turmaByNome = new Map<string, any>()
  ;(turmasRows || []).forEach((t: any) => {
    turmaById.set(t.id, t)
    if (t.nome) turmaByNome.set(t.nome.toLowerCase().trim(), t)
  })

  // Latest matricula per aluno (highest ano_letivo)
  const matMap = new Map<string, any>()
  ;(matriculas || []).forEach((m: any) => {
    const existing = matMap.get(m.aluno_id)
    if (!existing || (m.ano_letivo > (existing.ano_letivo || 0)))
      matMap.set(m.aluno_id, m)
  })

  // Responsible lookup
  const respMap = new Map<string, any>()
  ;(resps || []).forEach((r: any) => respMap.set(r.id, r))

  // Helpers moved to file level

  const normalizeStatus = (s: string): string => {
    if (!s) return ''
    const sl = s.toLowerCase().trim()
    if (['ativo', 'matriculado', 'cursando', 'prog. continuada', 'progredido', 'em_cadastro'].includes(sl)) return 'Ativo'
    if (['inativo'].includes(sl)) return 'Inativo'
    if (['trancado', 'trancamento', 'trancada'].includes(sl)) return 'Trancado'
    if (['cancelado', 'matrícula cancelada', 'cancelada'].includes(sl)) return 'Cancelado'
    if (['formado', 'concluido', 'concluído', 'aprovado', 'aprovada', 'formatura'].includes(sl)) return 'Formado'
    return s
  }

  // ── 5. Pre-compute filter values ────────────────────────────────────────────
  const filterStatus   = filters.statusMatricula ? normalizeStatus(filters.statusMatricula) : ''
  const filterSituacao = (filters.situacaoNome || '').toLowerCase().trim()
  const filterTurno    = (filters.turno || '').toLowerCase().trim()
  const filterGrupo    = (filters.grupoAluno || '').toLowerCase().trim()
  const filterNivel    = (filters.nivelEnsino || '').toLowerCase().trim()
  const filterTurmaId  = (filters.turmaId || '').trim()
  const filterMesAniversario = (filters.mesAniversario || '').trim()

  // ── 6. Map each aluno ────────────────────────────────────────────────────
  return (alunos || []).map((a: any) => {
    const dados  = a.dados || {}

    // ── 6a. Resolve matrícula ativa ────────────────────────────────────────
    // Source A: dados.historicoMatriculas[] — saved by wizard (most complete)
    const historicoMatriculas: any[] = Array.isArray(dados.historicoMatriculas)
      ? dados.historicoMatriculas : []

    // historicoAtivo: item com situação 'Cursando' (ou 'Prog. Continuada'), ou o último item
    const historicoAtivo = historicoMatriculas.find(
      (h: any) => {
        const sit = (h.situacao || '').toLowerCase()
        return sit === 'cursando' || sit === 'prog. continuada' || sit === 'progredido'
      }
    ) || historicoMatriculas[historicoMatriculas.length - 1] || null

    // Source B: tabela `matriculas` (salvo pelo step/matricula)
    const mat = matMap.get(a.id)

    // ── 6b. Resolve campos com prioridade: historicoAtivo > mat > aluno ────
    const anoLetivo  = historicoAtivo?.ano || mat?.ano_letivo || new Date().getFullYear()

    // turmaId: vem do histórico ativo, então lookup na turma pelo ID
    const turmaIdHist = historicoAtivo?.turmaId || mat?.turma_id || ''
    const turmaObj    = turmaById.get(turmaIdHist) ||
                        turmaByNome.get((mat?.turma || a.turma || '').toLowerCase().trim()) ||
                        null
    const turma       = turmaObj?.nome || mat?.turma || a.turma || ''

    // turno: histórico > matriculas > aluno > turma padrão
    const turno       = (historicoAtivo?.turno || mat?.turno || a.turno || turmaObj?.turno || '').trim()

    // situacaoNome: texto exato de cfgSituacaoAluno (ex: 'Cursando', 'Aprovado')
    // Prioridade: historicoAtivo.situacao > matriculas.situacao
    const situacaoNome = (historicoAtivo?.situacao || mat?.situacao || '').trim()

    // grupoAlunos: histórico tem campo 'grupoAlunos', matriculas tem 'grupo_alunos'
    const grupoAlunos  = (historicoAtivo?.grupoAlunos || mat?.grupo_alunos || '').trim()

    // nivelEnsino: derivado da turma via codigo do segmento
    const nivelEnsino  = resolveNivelDeTurma(turmaObj)

    // statusMatricula: normalizado da situacao do historico OU status do aluno
    const statusRaw     = historicoAtivo?.situacao || mat?.status || a.status || ''
    const statusMatricula = normalizeStatus(statusRaw)

    // dataMatricula: data de entrada na matrícula ativa
    const dataMatricula = historicoAtivo?.dataMatricula ||
                          mat?.data_matricula || mat?.data_inicio ||
                          (mat?.created_at ? mat.created_at.slice(0, 10) : '') || ''

    // Dados pessoais
    const dataNasc = dados.dataNasc || dados.dataNascimento || a.data_nascimento || ''
    const sexo     = dados.sexo || a.sexo || ''
    // Unidade: aluno > matricula > turmaObj (garantindo que sempre capture mesmo quando aluno.unidade está vazio)
    const unidade  = a.unidade || mat?.unidade || turmaObj?.unidade || ''
    const codigo   = dados.codigo || a.matricula || a.id?.slice(0, 8) || ''

    // ── 6c. Responsible lookup ────────────────────────────────────────────
    const links    = (arLinks || []).filter((ar: any) => ar.aluno_id === a.id)
    const rped_link = links.find((ar: any) => ar.resp_pedagogico)
    const rfin_link = links.find((ar: any) => ar.resp_financeiro)
    const rped  = rped_link ? respMap.get(rped_link.responsavel_id) : null
    const rfin  = rfin_link ? respMap.get(rfin_link.responsavel_id) : null
    const respRef = rped || rfin

    // ── 6d. Apply filters ─────────────────────────────────────────────────
    if (filters.busca && !(
      a.nome?.toLowerCase().includes(filters.busca.toLowerCase()) ||
      codigo.toLowerCase().includes(filters.busca.toLowerCase())
    )) return null
    // Turma: quando turmaId está presente, usa exact-match por ID (muito mais preciso que nome)
    // quando não há turmaId, usa busca por substring no nome (compatível com filtros manuais)
    if (filterTurmaId) {
      const alunoTurmaId = historicoAtivo?.turmaId || mat?.turma_id || ''
      if (alunoTurmaId !== filterTurmaId) return null
    } else if (filters.turma) {
      if (!matchFilter(turma, filters.turma)) return null
    }
    // Unidade: match tanto pelo unidade resolvida quanto pela unidade da turmaObj
    if (filters.unidade) {
      const unidadeParaFiltro = unidade || turmaObj?.unidade || ''
      if (!matchFilter(unidadeParaFiltro, filters.unidade)) return null
    }
    if (filterTurno      && turno.toLowerCase() !== filterTurno)          return null
    if (filterStatus     && statusMatricula !== filterStatus)              return null
    if (filterSituacao   && situacaoNome.toLowerCase() !== filterSituacao) return null
    if (filterGrupo      && grupoAlunos.toLowerCase() !== filterGrupo)     return null
    if (filterNivel      && nivelEnsino.toLowerCase() !== filterNivel)     return null
    if (filters.sexo     && sexo !== filters.sexo)                        return null
    if (filters.anoLetivo && String(anoLetivo) !== filters.anoLetivo)     return null
    if (filters.dataInicio && dataMatricula && dataMatricula < filters.dataInicio) return null
    if (filters.dataFim    && dataMatricula && dataMatricula > filters.dataFim)    return null

    if (filterMesAniversario) {
      if (!dataNasc) return null
      const mes = dataNasc.split('-')[1] || dataNasc.split('/')[1]
      if (mes !== filterMesAniversario) return null
    }

    // ── 6e. Return resolved row ───────────────────────────────────────────
    return {
      id:                    a.id,
      codigo,
      nome:                  a.nome || '',
      turma,
      turno,
      unidade,
      statusMatricula,       // Ativo | Inativo | Trancado | Cancelado | Formado
      situacaoNome,          // nome real de cfgSituacaoAluno: 'Cursando', 'Aprovado', etc.
      grupoAlunos,           // nome real de cfgGruposAlunos
      nivelEnsino,           // nome do nível: 'Educação Infantil', 'Ensino Médio', etc.
      anoLetivo:             String(anoLetivo),
      dataMatricula,
      dataNascimento:        dataNasc,
      idade:                 calcAge(dataNasc),
      sexo,
      email:                 dados.email || a.email || '',
      telefone:              dados.celular || a.telefone || '',
      responsavelPedagogico: respRef?.nome || '',
      telefonePedagogico:    getPhone(respRef),
      responsavelFinanceiro: rfin?.nome || '',
    }
  }).filter(Boolean) as Record<string, unknown>[]
}

// ─── Resolver: Não Rematriculados / Retenção ───────────────────────────

async function resolveRetencaoAlunos(filters: Record<string, string>): Promise<Record<string, unknown>[]> {
  const [
    { data: alunos },
    { data: arLinks },
    { data: respDb }
  ] = await Promise.all([
    supabase.from('alunos').select('id, nome, matricula, status, unidade, email, data_nascimento, dados, foto_url'),
    supabase.from('aluno_responsavel').select('aluno_id, responsavel_id, resp_pedagogico, resp_financeiro'),
    supabase.from('responsaveis').select('id, nome, email, telefone, celular, dados')
  ])

  const respMap = new Map((respDb || []).map((r: any) => [r.id, r]))

  const anoBase = Number(filters.anoBase || new Date().getFullYear() - 1)
  const anoAlvo = Number(filters.anoAlvo || new Date().getFullYear())

  const results: Record<string, unknown>[] = []

  for (const a of (alunos || [])) {
    const dados = a.dados || {}
    const hist = Array.isArray(dados.historicoMatriculas) ? dados.historicoMatriculas : []

    // 1. Procura registro no ANO BASE com situação válida
    const histBase = hist.find((h: any) => {
      if (Number(h.ano) !== anoBase) return false
      const s = (h.situacao || '').toLowerCase()
      // Elegível se Aprovado, Concluído, etc, ou Cursando num ano passado (se o erro de digitação os deixou como cursando)
      return s.includes('aprovado') || s.includes('conclu') || s.includes('apr.c/pp') || s === 'cursando' || s === 'prog. continuada'
    })

    if (!histBase) continue // Não tem histórico no ano base, ou não terminou elegível

    // 2. Excluir concluintes finais (Terceirão)
    const nomeTurmaBase = (histBase.turmaNome || histBase.turma || '').toLowerCase()
    const serieBase = (histBase.serie || '').toLowerCase()
    const isExcluido = (nomeTurmaBase.includes('3') && nomeTurmaBase.includes('em')) ||
                       (serieBase.includes('3') && serieBase.includes('médio')) ||
                       nomeTurmaBase.includes('terceirão') ||
                       (histBase.situacao || '').toLowerCase().includes('concluinte')
                       
    if (isExcluido) continue

    // 3. Procura registro no ANO ALVO
    const histAlvo = hist.find((h: any) => Number(h.ano) === anoAlvo)
    
    const isRematriculado = !!histAlvo
    const statusRetencao = isRematriculado ? 'Rematriculado' : 'Evasão'

    // Filtros de UI
    if (filters.statusRetencao && statusRetencao !== filters.statusRetencao) continue

    // Responsáveis
    const links = (arLinks || []).filter((ar: any) => ar.aluno_id === a.id)
    const rpedLink = links.find((ar: any) => ar.resp_pedagogico)
    const rfinLink = links.find((ar: any) => ar.resp_financeiro)
    const rped = rpedLink ? respMap.get(rpedLink.responsavel_id) : null
    const rfin = rfinLink ? respMap.get(rfinLink.responsavel_id) : null

    // Financeiro (só para os que evadiram calculamos pendência diretamente do JSONB de parcelas do aluno)
    let saldoAberto = 0
    let parcelasAbertas = 0
    if (!isRematriculado) {
      const parcelas = dados.parcelas || dados.financeiro?.parcelas || []
      const today = new Date().toISOString().slice(0, 10)
      const myAbertas = parcelas.filter((p: any) => p.status !== 'pago' && p.status !== 'cancelado')
      
      saldoAberto = myAbertas.reduce((acc: number, p: any) => {
        const valor = Number(p.valor) || 0
        const desc = Number(p.desconto) || 0
        const isVencido = p.vencimento && p.vencimento < today
        let juros = Number(p.juros) || 0
        let multa = Number(p.multa) || 0
        if (isVencido && juros === 0 && multa === 0) {
          const diasAtr = Math.max(0, Math.floor((Date.now() - new Date(p.vencimento + 'T12:00:00').getTime()) / 86400000))
          if (diasAtr >= 1) {
            multa = Number(((valor - desc) * 0.02).toFixed(2))
            juros = Number(((valor - desc) * 0.00033 * diasAtr).toFixed(2))
          }
        }
        return acc + Math.max(0, valor - desc + juros + multa)
      }, 0)
      parcelasAbertas = myAbertas.length
    }

    // Motivo Salvo
    const evasaoSalvo = dados.evasao || {}
    let motivo = evasaoSalvo.motivoPrincipal || (saldoAberto > 0 ? 'financeiro_auto' : '')

    results.push({
      id: a.id,
      codigo: dados.codigo || a.matricula || a.id?.slice(0, 8) || '',
      nome: a.nome,
      dataNascimento: dados.dataNascimento || a.data_nascimento,
      idade: calcAge(dados.dataNascimento || a.data_nascimento),
      foto: a.foto_url || '',
      // Dados Ano Base
      turmaAnterior: histBase.turmaNome || histBase.turma || '',
      serieAnterior: histBase.serie || '',
      nivelAnterior: resolveNivelDeTurma({ nome: histBase.turmaNome || histBase.turma }) || '',
      turnoAnterior: histBase.turno || '',
      situacaoAnterior: histBase.situacao || '',
      anoAnterior: anoBase,
      // Status
      statusRetencao,
      // Financeiro
      saldoAberto,
      parcelasAbertas,
      // Motivo
      motivoPrincipal: motivo,
      descricaoLivre: evasaoSalvo.descricaoLivre || '',
      // Responsáveis
      responsavelFinanceiro: rfin?.nome || '',
      responsavelPedagogico: rped?.nome || '',
      telefonesStr: [getPhone(rfin), getPhone(rped)].filter(Boolean).join(' / '),
      emailsStr: [rfin?.email, rped?.email].filter(Boolean).join(' / ')
    })
  }

  return results
}


// ─── Main Resolver ───────────────────────────────────────

export async function resolveReportData(req: QueryRequest): Promise<QueryResult> {
  let allData: Record<string, unknown>[]

  const src = req.source
  if (src === 'alunos_progressao') {
    allData = await resolveAlunosProgressao(req.filters)
  } else if (src === 'alunos_relacao') {
    allData = await resolveAlunosRelacao(req.filters)
  } else if (src === 'alunos_completo') {
    allData = await resolveAlunosCompleto(req.filters)
  } else if (src === 'alunos' || src === 'alunos_nao_rematriculados') {
    allData = await resolveAlunos(req.filters)
    if (src === 'alunos_nao_rematriculados') {
      allData = allData.filter(a => a.statusMatricula !== 'Ativo' && a.statusMatricula !== 'matriculado')
    }
  } else if (src === 'retencao_alunos') {
    allData = await resolveRetencaoAlunos(req.filters)
  } else if (src.startsWith('financeiro')) {
    allData = await resolveFinanceiro(req.filters, src)
  } else if (src === 'turmas') {
    allData = await resolveTurmas(req.filters)
  } else if (src === 'ocorrencias') {
    allData = await resolveSimpleTable('ocorrencias', req.filters)
  } else if (src === 'funcionarios') {
    allData = await resolveSimpleTable('funcionarios', req.filters)
  } else if (src === 'system_users') {
    allData = await resolveSimpleTable('system_users', req.filters)
  } else if (src === 'system_logs') {
    allData = await resolveSimpleTable('system_logs', req.filters)
  } else {
    allData = []
  }

  // Sort
  if (req.sortField) {
    const dir = req.sortDir === 'desc' ? -1 : 1
    allData.sort((a, b) => {
      const va = a[req.sortField!]
      const vb = b[req.sortField!]
      if (va === vb) return 0
      if (va === null || va === undefined) return 1
      if (vb === null || vb === undefined) return -1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
      return String(va).localeCompare(String(vb), 'pt-BR') * dir
    })
  }

  const total = allData.length

  // Compute aggregates on full dataset
  const aggregates: Record<string, number> = {}
  const numKeys = ['valor', 'desconto', 'juros', 'multa', 'valorPago', 'saldo', 'percDesconto']
  for (const key of numKeys) {
    const sum = allData.reduce((s, r) => s + (Number(r[key]) || 0), 0)
    if (sum > 0) aggregates[key] = sum
  }
  aggregates['count'] = total

  // Paginate
  const start = (req.page - 1) * req.pageSize
  const pageData = allData.slice(start, start + req.pageSize)

  return { data: pageData, total, page: req.page, pageSize: req.pageSize, aggregates }
}
