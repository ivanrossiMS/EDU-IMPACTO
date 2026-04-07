'use client'
import { useState, useCallback, useMemo } from 'react'
import { useData } from '@/lib/dataContext'
import { type CensoPendencia } from '@/lib/dataContext'
import {
  ShieldCheck, Play, RefreshCw, CheckCircle2, AlertTriangle,
  XCircle, Info, Zap, BarChart3, ChevronDown, ChevronUp, Filter
} from 'lucide-react'

// ─── UTILITÁRIOS ─────────────────────────────────────────────────────────────

function validarCPF(cpf: string): boolean {
  const num = cpf.replace(/\D/g, '')
  if (num.length !== 11 || /^(\d)\1+$/.test(num)) return false
  let d1 = 0, d2 = 0
  for (let i = 0; i < 9; i++) d1 += +num[i] * (10 - i)
  d1 = ((d1 * 10) % 11) % 10
  for (let i = 0; i < 10; i++) d2 += +num[i] * (11 - i)
  d2 = ((d2 * 10) % 11) % 10
  return d1 === +num[9] && d2 === +num[10]
}

function parseDate(d: string): Date | null {
  if (!d) return null
  const raw = d.includes('/') ? d.split('/').reverse().join('-') : d
  const dt = new Date(raw)
  return isNaN(dt.getTime()) ? null : dt
}

function idadeAnos(nascimento: Date): number {
  const hoje = new Date()
  let age = hoje.getFullYear() - nascimento.getFullYear()
  const m = hoje.getMonth() - nascimento.getMonth()
  if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) age--
  return age
}

// Faixas etárias esperadas por etapa (mín, máx suave)
const FAIXA_ETAPA: Record<string, [number, number]> = {
  EI: [0, 5], EF1: [6, 10], EF2: [11, 14], EM: [15, 17],
  EJA: [15, 70], EI01: [0, 1], EI02: [2, 5],
  EF01: [6, 7], EF02: [7, 8], EF03: [8, 9], EF04: [9, 10], EF05: [10, 11],
  EF06: [11, 12], EF07: [12, 13], EF08: [13, 14], EF09: [14, 15],
  EM01: [15, 16], EM02: [16, 17], EM03: [17, 18],
}

// ─── MOTOR DE VALIDAÇÃO COMPLETO ─────────────────────────────────────────────

interface ValidationContext {
  alunos: any[]; turmas: any[]; funcionarios: any[]
  mantenedores: any[]; transferencias: any[]; frequencias: any[]
  censoAlunosData: any[]; censoTurmasData: any[]; censoProfsData: any[]
  anoCensitario: number; etapa: string
}

type IssuePartial = Omit<CensoPendencia, 'criadoEm'>

function mkId() { return `CP-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}` }

function mkIssue(
  tipo: CensoPendencia['tipo'], categoria: CensoPendencia['categoria'], nivel: number,
  registroId: string, registroNome: string, campo: string,
  valorAtual: string, valorEsperado: string, descricao: string, sugestao: string,
  ctx: { anoCensitario: number; etapa: string }
): IssuePartial {
  return {
    id: mkId(), tipo, categoria, nivel, registroId, registroNome,
    campo, valorAtual, valorEsperado, descricao, sugestao,
    status: 'aberta', anoCensitario: ctx.anoCensitario, etapa: ctx.etapa,
  }
}

type PhaseFn = (ctx: ValidationContext) => IssuePartial[]

// ── FASE A: Escola ───────────────────────────────────────────────────────────
const validarEscola: PhaseFn = (ctx) => {
  const issues: IssuePartial[] = []
  const escola = ctx.mantenedores[0]?.unidades?.[0] as any
  const c = { anoCensitario: ctx.anoCensitario, etapa: ctx.etapa }

  if (!escola) {
    issues.push(mkIssue('critica','escola',1,'escola-base','Escola','Unidade','','Escola configurada',
      'Nenhuma escola/unidade cadastrada no ERP.','Vá em Configurações → Mantenedores e cadastre a unidade.',c))
    return issues
  }
  const nome = escola.nomeFantasia || escola.razaoSocial || ''
  if (!nome) issues.push(mkIssue('critica','escola',1,'esc-nome',nome||'Escola','Nome','','Nome preenchido','Nome da escola não informado.','Preencha o nome da unidade.',c))
  if (!escola.inep || String(escola.inep).replace(/\D/g,'').length < 7)
    issues.push(mkIssue('critica','escola',1,'esc-inep',nome,'Código INEP',escola.inep||'','8 dígitos','Código INEP ausente ou inválido (deve ter 8 dígitos).','Preencha o código INEP em Configurações → Unidade.',c))
  if (!escola.cnpj) issues.push(mkIssue('alta','escola',1,'esc-cnpj',nome,'CNPJ','','CNPJ da escola','CNPJ da unidade não informado.','Preencha o CNPJ da unidade.',c))
  if (!escola.cep)  issues.push(mkIssue('alta','escola',1,'esc-cep',nome,'CEP','','CEP completo','CEP da escola não informado.','Preencha o CEP na configuração da unidade.',c))
  if (!escola.endereco && !escola.logradouro)
    issues.push(mkIssue('alta','escola',1,'esc-end',nome,'Endereço','','Endereço completo','Endereço da escola não informado.',  'Preencha o endereço.',c))
  if (!escola.cidade) issues.push(mkIssue('alta','escola',1,'esc-cid',nome,'Município','','Município','Município da escola não informado.','Preencha a cidade.',c))
  if (!escola.estado) issues.push(mkIssue('alta','escola',1,'esc-uf',nome,'UF',escola.estado||'','UF válida (2 letras)','UF da escola não informada.','Preencha o estado.',c))
  if (!escola.telefone) issues.push(mkIssue('media','escola',2,'esc-tel',nome,'Telefone','','Telefone de contato','Telefone da escola não informado.','Preencha o telefone.',c))
  if (!escola.diretor?.nome)
    issues.push(mkIssue('alta','escola',1,'esc-dir',nome,'Gestor / Diretor','','Nome do diretor','Diretor / gestor escolar não cadastrado.','Preencha o campo Diretor na configuração da unidade.',c))
  return issues
}

// ── FASE B: Turmas ───────────────────────────────────────────────────────────
const validarTurmas: PhaseFn = (ctx) => {
  const issues: IssuePartial[] = []
  const c = { anoCensitario: ctx.anoCensitario, etapa: ctx.etapa }
  const turmasValidas = ctx.turmas.filter((t:any) => t.nome?.trim())
  const censoTurmasMap = new Map(ctx.censoTurmasData.map((ct:any) => [ct.turmaId, ct]))
  const nomesTurma = new Set(turmasValidas.map((t:any) => t.nome))

  if (turmasValidas.length === 0)
    issues.push(mkIssue('critica','turma',1,'turmas-base','Turmas','Base','0','≥1 turma','Nenhuma turma cadastrada.','Cadastre turmas no módulo Acadêmico.',c))

  turmasValidas.forEach((t:any) => {
    const ct = censoTurmasMap.get(t.id) as any
    if (!t.turno) issues.push(mkIssue('critica','turma',1,t.id,t.nome,'Turno','','Turno definido',`Turma "${t.nome}" sem turno definido.`,'Edite a turma e defina o turno.',c))
    if (!t.serie) issues.push(mkIssue('alta','turma',1,t.id,t.nome,'Série/Ano','','Série ou Ano',`Turma "${t.nome}" sem série/ano definida.`,'Edite a turma e defina a série.',c))
    if (!ct?.etapaModalidade)
      issues.push(mkIssue('alta','turma',2,t.id,t.nome,'Etapa/Modalidade','','Código INEP da etapa',`Turma "${t.nome}" sem etapa/modalidade INEP definida.`,'Acesse a aba Cadastros → Turmas e preencha a etapa.',c))
    const alunosNaTurma = ctx.alunos.filter((a:any) => a.turma === t.nome && a.nome?.trim()).length
    if (alunosNaTurma === 0)
      issues.push(mkIssue('alta','turma',2,t.id,t.nome,'Alunos','0','≥1 aluno matriculado',`Turma "${t.nome}" sem alunos matriculados.`,'Verifique se os alunos estão vinculados.',c))
  })
  return issues
}

// ── FASE C: Vínculos Professor→Turma ─────────────────────────────────────────
const validarVinculos: PhaseFn = (ctx) => {
  const issues: IssuePartial[] = []
  const c = { anoCensitario: ctx.anoCensitario, etapa: ctx.etapa }
  const docentes = ctx.funcionarios.filter((f:any) =>
    f.cargo?.toLowerCase().includes('professor') || f.cargo?.toLowerCase().includes('docente')
  )
  const censoProfsMap = new Map(ctx.censoProfsData.map((cp:any) => [cp.funcionarioId, cp]))
  const turmasComProf = new Set(ctx.turmas.filter((t:any) => t.professor?.trim()).map((t:any) => t.nome))

  docentes.forEach((f:any) => {
    const cp = censoProfsMap.get(f.id) as any
    if (!f.email && !cp?.cpf) {
      issues.push(mkIssue('alta','profissional',1,f.id,f.nome,'CPF','','CPF do profissional',`Profissional "${f.nome}" sem CPF cadastrado.`,'Preencha o CPF no módulo RH ou nos dados censo do profissional.',c))
    }
    if (!cp?.turmasVinculadas?.length && !ctx.turmas.some((t:any) => t.professor === f.nome)) {
      issues.push(mkIssue('alta','profissional',2,f.id,f.nome,'Vínculo com Turma','','≥1 turma vinculada',`Professor "${f.nome}" sem vínculo com nenhuma turma.`,'Vincule o professor a pelo menos uma turma no módulo Acadêmico.',c))
    }
    if (cp?.turmasVinculadas?.length > 0) {
      cp.turmasVinculadas.forEach((v:any) => {
        if (!ctx.turmas.find((t:any) => t.id === v.turmaId)) {
          issues.push(mkIssue('alta','profissional',2,f.id,f.nome,'Turma Vinculada',v.turmaNome,'Turma existente',`Professor "${f.nome}" vinculado à turma "${v.turmaNome}" que não existe.`,'Corrija o vínculo no cadastro censo do profissional.',c))
        }
      })
    }
  })

  // Turmas sem professor
  ctx.turmas.filter((t:any) => t.nome?.trim()).forEach((t:any) => {
    if (!t.professor?.trim() && !ctx.censoProfsData.some((cp:any) => cp.turmasVinculadas?.some((v:any) => v.turmaId === t.id))) {
      issues.push(mkIssue('media','turma',2,t.id,t.nome,'Professor','','Professor vinculado',`Turma "${t.nome}" sem professor responsável.`,'Atribua um professor à turma no módulo Acadêmico.',c))
    }
  })
  return issues
}

// ── FASE D: Alunos — dados básicos ERP ───────────────────────────────────────
const validarAlunosBasico: PhaseFn = (ctx) => {
  const issues: IssuePartial[] = []
  const c = { anoCensitario: ctx.anoCensitario, etapa: ctx.etapa }
  const alunosValidos = ctx.alunos.filter((a:any) => a.nome?.trim())
  const cpfSet = new Map<string, string>()
  const nomeNascMap = new Map<string, string>()
  const turmasExistentes = new Set(ctx.turmas.map((t:any) => t.nome))

  if (alunosValidos.length === 0)
    issues.push(mkIssue('critica','aluno',1,'','Base de Alunos','Base','0','≥1 aluno','Nenhum aluno cadastrado.','Cadastre alunos no módulo Acadêmico.',c))

  alunosValidos.forEach((a:any) => {
    // Campos obrigatórios básicos
    if (!a.dataNascimento?.trim())
      issues.push(mkIssue('critica','aluno',1,a.id,a.nome,'Data de Nascimento','','DD/MM/AAAA ou YYYY-MM-DD',`Aluno "${a.nome}" sem data de nascimento.`,'Edite o cadastro do aluno.',c))
    if (!a.turma?.trim())
      issues.push(mkIssue('critica','aluno',1,a.id,a.nome,'Turma','','Turma do aluno',`Aluno "${a.nome}" sem turma atribuída.`,'Vincule o aluno a uma turma.',c))
    if (!a.matricula?.trim())
      issues.push(mkIssue('alta','aluno',1,a.id,a.nome,'Matrícula','','Código de matrícula',`Aluno "${a.nome}" sem código de matrícula.`,'Preencha o campo matrícula.',c))

    // Turma existe?
    if (a.turma?.trim() && !turmasExistentes.has(a.turma))
      issues.push(mkIssue('alta','aluno',3,a.id,a.nome,'Turma',a.turma,'Turma cadastrada',`Turma "${a.turma}" do aluno "${a.nome}" não existe no sistema.`,'Crie a turma ou corrija o vínculo.',c))

    // CPF duplicado e inválido
    if (a.cpf?.trim()) {
      const cleanCpf = a.cpf.replace(/\D/g,'')
      if (cpfSet.has(cleanCpf))
        issues.push(mkIssue('critica','aluno',2,a.id,a.nome,'CPF',a.cpf,'CPF único',`CPF duplicado entre "${a.nome}" e "${cpfSet.get(cleanCpf)}".`,'Corrija o CPF.',c))
      else cpfSet.set(cleanCpf, a.nome)
      if (!validarCPF(cleanCpf))
        issues.push(mkIssue('alta','aluno',2,a.id,a.nome,'CPF',a.cpf,'CPF válido',`CPF inválido para "${a.nome}".`,'Corrija o CPF informado.',c))
    }

    // Data de nascimento
    if (a.dataNascimento) {
      const dt = parseDate(a.dataNascimento)
      if (!dt)
        issues.push(mkIssue('alta','aluno',2,a.id,a.nome,'Data de Nascimento',a.dataNascimento,'Data válida',`Data inválida para "${a.nome}".`,'Corrija a data de nascimento.',c))
      else {
        const idade = idadeAnos(dt)
        if (idade < 0 || idade > 100)
          issues.push(mkIssue('alta','aluno',2,a.id,a.nome,'Data de Nascimento',a.dataNascimento,'Idade 0-100 anos',`Data de nascimento implausível para "${a.nome}" (${a.dataNascimento}).`,'Verifique e corrija.',c))
        if (dt > new Date())
          issues.push(mkIssue('critica','aluno',2,a.id,a.nome,'Data de Nascimento',a.dataNascimento,'Data passada',`A data de nascimento de "${a.nome}" está no futuro.`,'Corrija a data de nascimento.',c))
      }
    }

    // Duplicidade nome + nascimento
    const chave = `${a.nome?.toLowerCase().trim()}|${a.dataNascimento}`
    if (nomeNascMap.has(chave))
      issues.push(mkIssue('alta','aluno',2,a.id,a.nome,'Possível Duplicidade',a.nome,'Nome único por nascimento',`Possível aluno duplicado: "${a.nome}" com mesma data de nascimento.`,'Verifique se há duplicidade no cadastro.',c))
    else nomeNascMap.set(chave, a.id)
  })
  return issues
}

// ── FASE E: Alunos — dados censo (enriquecimento) ────────────────────────────
const validarAlunosCenso: PhaseFn = (ctx) => {
  const issues: IssuePartial[] = []
  const c = { anoCensitario: ctx.anoCensitario, etapa: ctx.etapa }
  const alunosValidos = ctx.alunos.filter((a:any) => a.nome?.trim())
  const censoMap = new Map(ctx.censoAlunosData.map((ca:any) => [ca.alunoId, ca]))

  alunosValidos.forEach((a:any) => {
    const ca = censoMap.get(a.id) as any

    if (!ca) {
      issues.push(mkIssue('alta','aluno',2,a.id,a.nome,'Dados Censo','Não preenchidos','Dados censitários completos',
        `Aluno "${a.nome}" sem dados censitários (sexo, cor/raça, tipo atendimento, etapa).`,
        'Acesse Código Inicial → clique no aluno → preencha os dados censo.',c))
      return
    }

    if (!ca.sexo) issues.push(mkIssue('critica','aluno',1,a.id,a.nome,'Sexo','','1=Masculino ou 2=Feminino',`Aluno "${a.nome}" sem sexo informado para o Censo.`,'Preencha o campo Sexo nos dados censo do aluno.',c))
    if (!ca.corRaca) issues.push(mkIssue('alta','aluno',1,a.id,a.nome,'Cor/Raça','','Código INEP (0-5)',`Aluno "${a.nome}" sem cor/raça declarada.`,'Preencha o campo Cor/Raça.',c))
    if (!ca.etapaModalidade) issues.push(mkIssue('critica','aluno',1,a.id,a.nome,'Etapa/Modalidade','','Código INEP',`Aluno "${a.nome}" sem etapa/modalidade definida para o Censo.`,'Preencha a etapa no cadastro censo.',c))
    if (!ca.tipoAtendimento) issues.push(mkIssue('critica','aluno',1,a.id,a.nome,'Tipo de Atendimento','','1-6',`Aluno "${a.nome}" sem tipo de atendimento definido.`,'Preencha o tipo de atendimento.',c))

    // Etapa 2: situação deve estar preenchida
    if (ctx.etapa === '2-situacao' && !ca.situacaoCenso)
      issues.push(mkIssue('critica','aluno',3,a.id,a.nome,'Situação Final (Etapa 2)','','Situação definida',`Situação final de "${a.nome}" não definida para Etapa 2.`,'Acesse Situação do Aluno e defina a situação.',c))

    // AEE: exige deficiência
    if ((ca.tipoAtendimento === '4' || ca.tipoAtendimento === '5' || ca.tipoAtendimento === '6') && !ca.deficiencia)
      issues.push(mkIssue('alta','aluno',3,a.id,a.nome,'Deficiência','Não marcada','Deficiência obrigatória para AEE',`Aluno "${a.nome}" está em AEE mas sem deficiência marcada.`,'Marque a deficiência e selecione os tipos.',c))
    if (ca.deficiencia && (!ca.tiposDeficiencia || ca.tiposDeficiencia.length === 0))
      issues.push(mkIssue('alta','aluno',3,a.id,a.nome,'Tipos de Deficiência','','≥1 tipo selecionado',`Aluno "${a.nome}" tem deficiência marcada mas sem tipos selecionados.`,'Selecione os tipos de deficiência.',c))

    // EJA: exige idade mínima
    const dt = a.dataNascimento ? parseDate(a.dataNascimento) : null
    if (dt && ca.etapaModalidade?.startsWith('EJA')) {
      const idade = idadeAnos(dt)
      if (idade < 15)
        issues.push(mkIssue('critica','aluno',3,a.id,a.nome,'Idade vs EJA',`${idade} anos`,'≥15 anos',`Aluno "${a.nome}" tem ${idade} anos mas está em EJA.`,'EJA requer idade mínima de 15 anos (EF) ou 18 anos (EM).',c))
    }

    // Idade vs Etapa (faixa improvável — alerta)
    if (dt && ca.etapaModalidade && FAIXA_ETAPA[ca.etapaModalidade]) {
      const [minI, maxI] = FAIXA_ETAPA[ca.etapaModalidade]
      const idade = idadeAnos(dt)
      if (idade < minI - 2 || idade > maxI + 4)
        issues.push(mkIssue('media','aluno',3,a.id,a.nome,'Idade vs Etapa',`${idade} anos`,`${minI}-${maxI} anos`,
          `Aluno "${a.nome}" tem ${idade} anos, improvável para etapa ${ca.etapaModalidade}.`,'Verifique data de nascimento ou etapa.',c))
    }

    // Transferido sem registro
    if (ctx.etapa === '2-situacao' && ca.situacaoCenso === '3') {
      const hasTransfer = ctx.transferencias.some((tr:any) =>
        tr.alunoNome?.toLowerCase().includes(a.nome?.toLowerCase()) && tr.tipo === 'saida'
      )
      if (!hasTransfer)
        issues.push(mkIssue('media','aluno',3,a.id,a.nome,'Transferência','Sem registro','Registro de transferência',
          `Aluno "${a.nome}" marcado como Transferido mas sem registro de transferência no ERP.`,
          'Registre a transferência no módulo Acadêmico → Transferências.',c))
    }
  })
  return issues
}

// ── FASE F: Regras de negócio globais ────────────────────────────────────────
const validarRegrasNegocio: PhaseFn = (ctx) => {
  const issues: IssuePartial[] = []
  const c = { anoCensitario: ctx.anoCensitario, etapa: ctx.etapa }
  const escola = ctx.mantenedores[0]?.unidades?.[0] as any

  // Escola sem código INEP → não consegue gerar de forma alguma
  if (escola && escola.inep && String(escola.inep).replace(/\D/g,'').length !== 8)
    issues.push(mkIssue('critica','escola',3,'esc-inep-len',escola.nomeFantasia||'Escola','Código INEP',escola.inep,'8 dígitos exatos','O código INEP deve ter exatamente 8 dígitos.','Corrija o código INEP.',c))

  // Turmas com capacidade 0 ou indefinida
  ctx.turmas.filter((t:any) => t.nome?.trim()).forEach((t:any) => {
    if (!t.capacidade || t.capacidade < 1)
      issues.push(mkIssue('baixa','turma',3,t.id,t.nome,'Capacidade',String(t.capacidade||0),'≥1','Capacidade da turma zerada ou não definida.','Defina a capacidade máxima.',c))
    const alunosTurma = ctx.alunos.filter((a:any) => a.turma === t.nome && a.nome?.trim()).length
    if (t.capacidade && alunosTurma > t.capacidade)
      issues.push(mkIssue('media','turma',3,t.id,t.nome,'Capacidade Excedida',`${alunosTurma}/${t.capacidade}`,'≤ capacidade',`Turma "${t.nome}" com ${alunosTurma} alunos e capacidade ${t.capacidade}.`,'Ajuste a capacidade ou transfira alunos.',c))
  })

  // Profissionais com CPF
  const docentes = ctx.funcionarios.filter((f:any) =>
    f.cargo?.toLowerCase().includes('professor') || f.cargo?.toLowerCase().includes('docente')
  )
  docentes.forEach((f:any) => {
    const censoPf = ctx.censoProfsData.find((cp:any) => cp.funcionarioId === f.id) as any
    if (censoPf?.cpf) {
      const clean = censoPf.cpf.replace(/\D/g,'')
      if (!validarCPF(clean))
        issues.push(mkIssue('alta','profissional',2,f.id,f.nome,'CPF',censoPf.cpf,'CPF válido',`CPF do profissional "${f.nome}" é inválido.`,'Corrija o CPF.',c))
    }
  })

  return issues
}

// ─── PIPELINE DE VALIDAÇÃO ───────────────────────────────────────────────────
// 6 fases ordenadas com progresso granular
const PIPELINE = [
  { nome: 'Escola & Unidade',          fn: validarEscola },
  { nome: 'Turmas',                    fn: validarTurmas },
  { nome: 'Vínculos Professor→Turma', fn: validarVinculos },
  { nome: 'Alunos — Dados ERP',        fn: validarAlunosBasico },
  { nome: 'Alunos — Dados Censo',      fn: validarAlunosCenso },
  { nome: 'Regras de Negócio INEP',    fn: validarRegrasNegocio },
]

// ─── CONFIG DE TIPOS ─────────────────────────────────────────────────────────
const TIPO_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  critica:     { label:'Crítica',     color:'#ef4444', bg:'rgba(239,68,68,0.08)',   icon: XCircle },
  alta:        { label:'Alta',        color:'#f59e0b', bg:'rgba(245,158,11,0.08)',  icon: AlertTriangle },
  media:       { label:'Média',       color:'#0ea5e9', bg:'rgba(14,165,233,0.08)',  icon: AlertTriangle },
  baixa:       { label:'Baixa',       color:'#94a3b8', bg:'rgba(148,163,184,0.08)',icon: Info },
  informativa: { label:'Informativa', color:'#94a3b8', bg:'rgba(148,163,184,0.08)',icon: Info },
}

// ─── COMPONENTE ──────────────────────────────────────────────────────────────
export function ValidadorTab() {
  const {
    alunos, turmas, funcionarios, mantenedores, censoConfig,
    setCensoPendencias, censoPendencias, logCensoAction,
    censoAlunosData, censoTurmasData, censoProfsData,
    transferencias, frequencias,
  } = useData()

  const [running, setRunning]       = useState(false)
  const [phase, setPhase]           = useState(0)          // índice da fase atual
  const [phaseName, setPhaseName]   = useState('')
  const [progress, setProgress]     = useState(0)
  const [done, setDone]             = useState(false)
  const [lastResult, setLastResult] = useState<IssuePartial[]>([])
  const [filterTipo, setFilterTipo] = useState('')
  const [filterCat, setFilterCat]   = useState('')
  const [expanded, setExpanded]     = useState<Record<string, boolean>>({})

  const handleValidar = useCallback(async () => {
    setRunning(true); setDone(false); setProgress(0); setPhase(0); setLastResult([])
    
    const todasUnidades = mantenedores.flatMap(m => m.unidades)
    const unidadeAtivaId = censoConfig.unidadeId || (todasUnidades[0]?.id || '')
    const escola = todasUnidades.find(u => u.id === unidadeAtivaId) || (todasUnidades[0] as any)
    const man = mantenedores.find(m => m.unidades.some(u => u.id === escola?.id)) || mantenedores[0]
  
    const isUnidade = (regUnid: string) => {
      if (!unidadeAtivaId) return true
      if (regUnid === unidadeAtivaId) return true
      if (escola && (regUnid === escola.nomeFantasia || regUnid === escola.razaoSocial)) return true
      return false
    }

    const ctx: ValidationContext = {
      alunos: alunos.filter(a => isUnidade(a.unidade)), 
      turmas: turmas.filter(t => isUnidade(t.unidade)), 
      funcionarios: funcionarios.filter(f => isUnidade(f.unidade)), 
      mantenedores: man ? [{ ...man, unidades: [escola] }] : [], 
      transferencias, frequencias,
      censoAlunosData, censoTurmasData, censoProfsData,
      anoCensitario: censoConfig.anoCensitario, etapa: censoConfig.etapaAtiva,
    }
    const all: IssuePartial[] = []
    for (let i = 0; i < PIPELINE.length; i++) {
      setPhaseName(PIPELINE[i].nome)
      setPhase(i)
      setProgress(Math.round((i / PIPELINE.length) * 90))
      await new Promise(r => setTimeout(r, 180))
      const result = PIPELINE[i].fn(ctx)
      all.push(...result)
    }
    setProgress(100)
    await new Promise(r => setTimeout(r, 200))
    setLastResult(all)
    const withDate = all.map(r => ({ ...r, criadoEm: new Date().toISOString() } as CensoPendencia))
    setCensoPendencias(withDate)
    logCensoAction('Validação', 'Validador — Execução Completa', {
      anoCensitario: censoConfig.anoCensitario, etapa: censoConfig.etapaAtiva,
      registroNome: `${all.length} pendências encontradas`,
    })
    setDone(true); setRunning(false)
  }, [alunos, turmas, funcionarios, mantenedores, censoConfig, censoAlunosData, censoTurmasData, censoProfsData, transferencias, frequencias])

  const summary = useMemo(() => ({
    critica:     lastResult.filter(r => r.tipo === 'critica').length,
    alta:        lastResult.filter(r => r.tipo === 'alta').length,
    media:       lastResult.filter(r => r.tipo === 'media').length,
    baixa:       lastResult.filter(r => r.tipo === 'baixa' || r.tipo === 'informativa').length,
  }), [lastResult])

  const filtered = useMemo(() => {
    let res = lastResult
    if (filterTipo) res = res.filter(r => r.tipo === filterTipo)
    if (filterCat)  res = res.filter(r => r.categoria === filterCat)
    return res
  }, [lastResult, filterTipo, filterCat])

  const byTipo = useMemo(() => {
    const ord = ['critica','alta','media','baixa','informativa'] as const
    return ord.map(t => ({ tipo: t, items: filtered.filter(r => r.tipo === t) })).filter(g => g.items.length > 0)
  }, [filtered])

  const toggleExpand = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
      <div>
        <h2 style={{ fontSize:18, fontWeight:800, margin:0 }}>Motor de Validação INEP</h2>
        <p style={{ fontSize:13, color:'hsl(var(--text-muted))', margin:'4px 0 0' }}>
          Análise profunda em 6 fases · Obrigatoriedade · Consistência · Regras INEP · Vínculos
        </p>
      </div>

      {/* PAINEL DE CONTROLE */}
      <div style={{ background:'hsl(var(--bg-surface))', border:'1px solid hsl(var(--border-subtle))', borderRadius:16, padding:28, display:'flex', flexDirection:'column', gap:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:20, flexWrap:'wrap' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:15, marginBottom:6 }}>Executar Validação Completa — 6 Fases</div>
            <div style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>
              Escola · Turmas · Vínculos · Alunos ERP · Alunos Censo · Regras INEP ·
              Ano {censoConfig.anoCensitario} · {censoConfig.etapaAtiva === '1-matricula' ? 'Etapa 1 — Código Inicial' : 'Etapa 2 — Situação do Aluno'}
            </div>
          </div>
          <button
            onClick={handleValidar}
            disabled={running}
            className="btn btn-primary"
            style={{ gap:8, padding:'12px 28px', fontSize:14, fontWeight:700, minWidth:200, opacity:running?0.7:1 }}
          >
            {running ? <RefreshCw size={16} style={{ animation:'spin 1s linear infinite' }}/> : <Play size={16}/>}
            {running ? `Fase ${phase+1}/6...` : 'Validar Tudo'}
          </button>
        </div>

        {/* BARRA DE PROGRESSO EM FASES */}
        {running && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:8 }}>
              <span style={{ color:'hsl(var(--text-muted))' }}>
                <span style={{ color:'#818cf8', fontWeight:700 }}>Fase {phase+1}/6:</span> {phaseName}
              </span>
              <span style={{ fontWeight:700 }}>{progress}%</span>
            </div>
            <div style={{ height:8, background:'hsl(var(--bg-overlay))', borderRadius:4, overflow:'hidden' }}>
              <div style={{ width:`${progress}%`, height:'100%', background:'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius:4, transition:'width 0.3s' }}/>
            </div>
            <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
              {PIPELINE.map((p, i) => (
                <span key={i} style={{
                  fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:12,
                  background: i < phase ? 'rgba(16,185,129,0.15)' : i === phase ? 'rgba(99,102,241,0.2)' : 'hsl(var(--bg-overlay))',
                  color: i < phase ? '#10b981' : i === phase ? '#a5b4fc' : 'hsl(var(--text-muted))',
                  border: `1px solid ${i < phase ? 'rgba(16,185,129,0.2)' : i === phase ? 'rgba(99,102,241,0.3)' : 'transparent'}`,
                }}>
                  {i < phase ? '✓' : i === phase ? '▶' : `${i+1}`} {p.nome}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RESULTADO */}
      {done && (
        <>
          {/* RESUMO CARDS */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12 }}>
            {([
              { tipo:'critica', label:'Críticas', count:summary.critica, blocked:true },
              { tipo:'alta',    label:'Altas',    count:summary.alta,    blocked:false },
              { tipo:'media',   label:'Médias',   count:summary.media,   blocked:false },
              { tipo:'baixa',   label:'Informativas', count:summary.baixa, blocked:false },
            ]).map(s => {
              const cfg = TIPO_CONFIG[s.tipo]; const Icon = cfg.icon
              return (
                <div key={s.tipo} style={{ background:'hsl(var(--bg-surface))', border:`1px solid ${cfg.color}30`, borderRadius:14, padding:'16px 20px', cursor:'pointer' }}
                  onClick={() => setFilterTipo(filterTipo === s.tipo ? '' : s.tipo)}
                >
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                    <Icon size={18} color={cfg.color}/>
                    {s.blocked && s.count > 0 && <span style={{ fontSize:9, padding:'1px 5px', background:'rgba(239,68,68,0.1)', color:'#ef4444', borderRadius:4, fontWeight:800 }}>BLOQUEANTE</span>}
                    {filterTipo === s.tipo && <span style={{ fontSize:9, padding:'1px 5px', background:'rgba(99,102,241,0.15)', color:'#818cf8', borderRadius:4, fontWeight:700 }}>FILTRO</span>}
                  </div>
                  <div style={{ fontSize:26, fontWeight:900, color:cfg.color, fontFamily:'Outfit', lineHeight:1 }}>{s.count}</div>
                  <div style={{ fontSize:12, color:'hsl(var(--text-muted))', marginTop:4 }}>{s.label}</div>
                </div>
              )
            })}
          </div>

          {/* FILTROS */}
          {lastResult.length > 0 && (
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'hsl(var(--text-muted))' }}>
                <Filter size={13}/> Filtros rápidos:
              </div>
              {(['','critica','alta','media','baixa'] as const).map(t => (
                <button key={t} onClick={() => setFilterTipo(t)} style={{
                  fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, cursor:'pointer',
                  background: filterTipo === t ? (t ? TIPO_CONFIG[t]?.bg : 'rgba(99,102,241,0.1)') : 'hsl(var(--bg-overlay))',
                  color: filterTipo === t ? (t ? TIPO_CONFIG[t]?.color : '#818cf8') : 'hsl(var(--text-muted))',
                  border: `1px solid ${filterTipo === t ? (t ? TIPO_CONFIG[t]?.color+'40' : 'rgba(99,102,241,0.3)') : 'transparent'}`,
                }}>
                  {t ? TIPO_CONFIG[t]?.label : 'Todos'}
                </button>
              ))}
              <span style={{ width:1, background:'hsl(var(--border-subtle))', margin:'0 4px' }}/>
              {(['','aluno','turma','escola','profissional'] as const).map(cat => (
                <button key={cat} onClick={() => setFilterCat(cat)} style={{
                  fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, cursor:'pointer',
                  background: filterCat === cat ? 'rgba(14,165,233,0.1)' : 'hsl(var(--bg-overlay))',
                  color: filterCat === cat ? '#38bdf8' : 'hsl(var(--text-muted))',
                  border: `1px solid ${filterCat === cat ? 'rgba(14,165,233,0.3)' : 'transparent'}`,
                }}>
                  {cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : 'Todas categorias'}
                </button>
              ))}
            </div>
          )}

          {/* LISTA */}
          {lastResult.length === 0 ? (
            <div style={{ background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:14, padding:'28px 32px', display:'flex', alignItems:'center', gap:16 }}>
              <CheckCircle2 size={40} color="#10b981"/>
              <div>
                <div style={{ fontWeight:800, fontSize:15, color:'#10b981' }}>Base validada sem inconsistências!</div>
                <div style={{ fontSize:13, color:'hsl(var(--text-muted))', marginTop:4 }}>Pronto para geração do arquivo oficial do Censo.</div>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign:'center', padding:48, color:'hsl(var(--text-muted))' }}>
              <Filter size={36} style={{ opacity:0.15, display:'block', margin:'0 auto 8px' }}/>
              Nenhuma pendência com esses filtros.
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ fontWeight:700, fontSize:14, display:'flex', alignItems:'center', gap:8 }}>
                <BarChart3 size={16} color="#6366f1"/> {filtered.length} pendência(s){filterTipo || filterCat ? ' filtradas' : ' encontradas'}
              </div>
              {byTipo.map(({ tipo, items }) => {
                const cfg = TIPO_CONFIG[tipo]; const Icon = cfg.icon
                const key = `tipo-${tipo}`; const isOpen = expanded[key] !== false
                return (
                  <div key={tipo}>
                    <button onClick={() => toggleExpand(key)} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', width:'100%', background:'transparent', border:'none', cursor:'pointer', textAlign:'left', borderRadius:8, borderBottom:`2px solid ${cfg.color}20` }}>
                      <Icon size={14} color={cfg.color}/>
                      <span style={{ fontSize:12, fontWeight:800, color:cfg.color, textTransform:'uppercase', letterSpacing:0.5, flex:1 }}>{cfg.label} ({items.length})</span>
                      {items.some(i => i.tipo === 'critica') && <span style={{ fontSize:9, fontWeight:800, padding:'1px 6px', borderRadius:4, background:'rgba(239,68,68,0.1)', color:'#ef4444' }}>BLOQUEIA ENVIO</span>}
                      {isOpen ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                    </button>
                    {isOpen && (
                      <div style={{ display:'flex', flexDirection:'column', gap:4, marginTop:4, paddingLeft:4 }}>
                        {items.map(p => (
                          <div key={p.id} style={{ background:cfg.bg, border:`1px solid ${cfg.color}20`, borderRadius:10, padding:'10px 14px', display:'flex', gap:12 }}>
                            <div style={{ flex:1 }}>
                              <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4 }}>
                                <span style={{ fontSize:10, fontWeight:700, padding:'1px 6px', background:'hsl(var(--bg-overlay))', borderRadius:4, color:'hsl(var(--text-muted))' }}>
                                  {p.categoria.toUpperCase()} · N{p.nivel}
                                </span>
                                <span style={{ fontSize:12, fontWeight:700 }}>{p.registroNome}</span>
                              </div>
                              <div style={{ fontSize:12, color:'hsl(var(--text-secondary))', marginBottom:4 }}>{p.descricao}</div>
                              <div style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>
                                <strong>Campo:</strong> {p.campo} · <strong>Atual:</strong> {p.valorAtual || 'vazio'} · <strong>Esperado:</strong> {p.valorEsperado}
                              </div>
                              <div style={{ fontSize:11, color:cfg.color, marginTop:4 }}>💡 {p.sugestao}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {!done && !running && censoPendencias.length > 0 && (
        <div style={{ background:'hsl(var(--bg-overlay))', borderRadius:12, padding:'14px 18px', fontSize:13, color:'hsl(var(--text-secondary))' }}>
          <Zap size={14} style={{ display:'inline', marginRight:6, verticalAlign:'middle', color:'#6366f1' }}/>
          Última validação: {censoPendencias.length} pendências registradas. Execute novamente para revalidar.
        </div>
      )}
      <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
    </div>
  )
}
