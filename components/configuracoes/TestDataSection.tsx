'use client'

import { useState, useCallback } from 'react'
import { useData } from '@/lib/dataContext'
import {
  Play, Trash2, CheckCircle2, Loader2, AlertCircle,
  ChevronDown, ChevronRight, Database,
} from 'lucide-react'

// ─── Seed prefix ─────────────────────────────────────────────────────────────
const S = '__SEED__'
const sid = () => `${S}${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`.toUpperCase()

// ─── Brazilian fake helpers ───────────────────────────────────────────────────
const rnd = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const rndN = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const rndF = (min: number, max: number) => parseFloat((Math.random() * (max - min) + min).toFixed(2))

const PRENOMES_M = ['Lucas','Gabriel','Matheus','Pedro','João','Rafael','Felipe','Bruno','André','Carlos','Eduardo','Gustavo','Thiago','Rodrigo','Leonardo','Henrique','Diego','Vinicius','Leandro','Ivan']
const PRENOMES_F = ['Ana','Maria','Julia','Beatriz','Amanda','Fernanda','Larissa','Camila','Bruna','Gabriela','Leticia','Paula','Claudia','Aline','Priscila','Rafaela','Vanessa','Mariana','Patricia','Isabela']
const SOBRENOMES = ['Silva','Santos','Oliveira','Souza','Lima','Pereira','Fernandes','Costa','Carvalho','Almeida','Rodrigues','Nascimento','Martins','Araújo','Gomes','Barbosa','Ribeiro','Monteiro','Ferreira','Alves']
const CIDADES = ['São Paulo','Rio de Janeiro','Curitiba','Porto Alegre','Salvador','Recife','Fortaleza','Manaus','Maceió','Vitória']
const BAIRROS = ['Centro','Jardim América','Vila Nova','Boa Viagem','Meireles','Batel','Moinhos de Vento','Graça','Boa Vista','Aldeota']
const UFS = ['SP','RJ','PR','RS','BA','PE','CE','AM','AL','ES']

const nome = (f = false) => `${rnd(f ? PRENOMES_F : PRENOMES_M)} ${rnd(SOBRENOMES)}`
const nomeCompleto = () => rnd([true,false]) ? nome(true) : nome(false)
const cpf = () => Array.from({length:11},()=>rndN(0,9)).join('').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4')
const cnpj = () => Array.from({length:14},()=>rndN(0,9)).join('').replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5')
const fone = () => `(${rndN(11,99)}) 9${rndN(1000,9999)}-${rndN(1000,9999)}`
const email = (n: string) => `${n.toLowerCase().replace(/\s+/g,'.')}@${rnd(['gmail.com','outlook.com','yahoo.com.br','hotmail.com'])}`
const cep = () => `${rndN(10000,99999)}-${rndN(100,999)}`
const dateStr = (daysBack = 0) => { const d = new Date(); d.setDate(d.getDate()-daysBack); return d.toISOString().slice(0,10) }
const futureDateStr = (daysAhead = 0) => { const d = new Date(); d.setDate(d.getDate()+daysAhead); return d.toISOString().slice(0,10) }
const isoNow = () => new Date().toISOString()

// ─── Module configs ───────────────────────────────────────────────────────────
interface ModuleGroup { id: string; label: string; color: string; modules: ModuleCfg[] }
interface ModuleCfg { id: string; label: string; qty: number; depends?: string[] }
type QtyMap = Record<string, number>

const GROUPS: ModuleGroup[] = [
  {
    id:'fin', label:'Financeiro', color:'#10b981',
    modules:[
      { id:'planoContas',        label:'Plano de Contas',       qty:10 },
      { id:'eventosFin',         label:'Eventos Financeiros',   qty:8,  depends:['planoContas'] },
      { id:'padroesPagamento',   label:'Padrão de Pagamentos',  qty:5,  depends:['eventosFin'] },
      { id:'fornecedores',       label:'Fornecedores',          qty:10 },
      { id:'aberturaCaixa',      label:'Abertura de Caixa',     qty:3 },
      { id:'contasReceber',      label:'Contas a Receber',      qty:20, depends:['fornecedores'] },
      { id:'contasPagar',        label:'Contas a Pagar',        qty:15, depends:['fornecedores','planoContas'] },
      { id:'renegociacao',       label:'Renegociações',         qty:5,  depends:['contasReceber'] },
      { id:'movimentacoes',      label:'Movimentações',         qty:15, depends:['aberturaCaixa','planoContas'] },
    ],
  },
  {
    id:'ped', label:'Pedagógico', color:'#8b5cf6',
    modules:[
      { id:'turmas', label:'Turmas', qty:6 },
    ],
  },
  {
    id:'acad', label:'Acadêmico', color:'#3b82f6',
    modules:[
      { id:'alunos',       label:'Matrículas (Alunos)',  qty:20, depends:['turmas'] },
      { id:'horarioAulas', label:'Horário de Aulas',     qty:10, depends:['turmas'] },
      { id:'frequencia',   label:'Frequência',           qty:5,  depends:['alunos','turmas'] },
      { id:'notas',        label:'Lançamento de Notas',  qty:5,  depends:['alunos','turmas'] },
      { id:'ocorrencias',  label:'Ocorrências',          qty:15, depends:['alunos'] },
      { id:'ensalamento',  label:'Ensalamento',          qty:5,  depends:['alunos','turmas'] },
      { id:'transferencias',label:'Transferências',      qty:5,  depends:['alunos'] },
      { id:'documentos',   label:'Documentos',           qty:5,  depends:['alunos'] },
    ],
  },
]

// ─── Status / log ─────────────────────────────────────────────────────────────
type LogEntry = { module: string; count: number; ok: boolean; msg?: string }

// ═════════════════════════════════════════════════════════════════════════════
export default function TestDataSection() {
  const data = useData()
  const [qty, setQty] = useState<QtyMap>(() => {
    const m: QtyMap = {}
    GROUPS.forEach(g => g.modules.forEach(mod => { m[mod.id] = mod.qty }))
    return m
  })
  const [selected, setSelected] = useState<Set<string>>(() => new Set(GROUPS.flatMap(g => g.modules.map(m => m.id))))
  const [running, setRunning] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [done, setDone] = useState(false)
  const [expanded, setExpanded] = useState<Record<string,boolean>>({fin:true,ped:true,acad:true})

  const addLog = (l: LogEntry) => setLogs(p => [...p, l])

  const toggleModule = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const toggleGroup = (g: ModuleGroup) => {
    const ids = g.modules.map(m => m.id)
    const allOn = ids.every(id => selected.has(id))
    setSelected(prev => {
      const s = new Set(prev)
      ids.forEach(id => allOn ? s.delete(id) : s.add(id))
      return s
    })
  }

  // ─── Execution order: respect dependencies ──────────────────────────────
  const ORDER = GROUPS.flatMap(g => g.modules.map(m => m.id))

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

  // ─── Main generator ─────────────────────────────────────────────────────
  const generate = useCallback(async () => {
    setRunning(true); setLogs([]); setDone(false)

    // Snapshot generated IDs so dependents can reference them
    const genTurmaIds: string[] = []
    const genAlunoIds: string[] = []
    const genPlanoIds: string[] = []
    const genEventoIds: string[] = []
    const genFornecedorIds: string[] = []
    const genCaixaIds: string[] = []
    const genTituloIds: string[] = []

    for (const moduleId of ORDER) {
      if (!selected.has(moduleId)) continue
      const q = qty[moduleId] || 5

      await sleep(120)

      try {
        switch (moduleId) {

          // ── Plano de Contas ──────────────────────────────────────────────
          case 'planoContas': {
            const GRUPOS_REC = ['Mensalidades','Matrículas','Eventos','Serviços','Outros Receitas']
            const GRUPOS_DESP = ['Pessoal','Manutenção','Material','Serviços Externos','Outros Despesas']
            const items: any[] = []
            for (let i=0;i<q;i++) {
              const tipo = rnd(['receitas','despesas']) as 'receitas'|'despesas'
              const id = sid()
              genPlanoIds.push(id)
              items.push({
                id, codPlano:`${rndN(1,9)}.${rndN(1,9)}.${rndN(1,9)}`,
                descricao: rnd(tipo==='receitas'?GRUPOS_REC:GRUPOS_DESP) + ` ${i+1}`,
                tipo: rnd(['analitico','sintetico','detalhe']) as 'analitico'|'sintetico'|'detalhe',
                grupoConta: tipo,
                parentId:'', situacao:'ativo', createdAt: isoNow(),
              })
            }
            data.setCfgPlanoContas(p => [...p, ...items])
            addLog({ module:'Plano de Contas', count:q, ok:true })
            break
          }


          // ── Eventos Financeiros ──────────────────────────────────────────
          case 'eventosFin': {

            const curPlanos  = data.cfgPlanoContas
            const DESCS_REC = ['Mensalidade Jan','Mensalidade Fev','Mensalidade Mar','Matrícula','Rematrícula','Taxa de Material','Uniforme','Excursão','Evento Cultural','Reforço']
            const DESCS_DESP = ['Salários Docentes','Salários Admin','Energia Elétrica','Água','Internet','Materiais Didáticos','Limpeza','Segurança','Manutenção Predial','Material de Escritório']
            const items: any[] = []
            for (let i=0;i<q;i++) {
              const tipo = rnd(['receita','despesa']) as 'receita'|'despesa'
              const id = sid()
              genEventoIds.push(id)
              items.push({
                id, codigo:`EV${String(i+1).padStart(3,'0')}`,
                descricao:rnd(tipo==='receita'?DESCS_REC:DESCS_DESP),
                planoContasId: curPlanos.length ? rnd([...curPlanos, ...genPlanoIds.map(x=>({id:x}))]).id : genPlanoIds[0] || '',
                situacao:'ativo', createdAt:isoNow(),
              })
            }
            data.setCfgEventos(p => [...p, ...items])
            addLog({ module:'Eventos Financeiros', count:q, ok:true })
            break
          }

          // ── Padrões de Pagamento ─────────────────────────────────────────
          case 'padroesPagamento': {
            const items: any[] = []
            for (let i=0;i<q;i++) {
              const parcelas = rndN(1,12)
              const anuidade = rndF(3000,15000)
              const valorParc = parseFloat((anuidade/parcelas).toFixed(2))
              const ps = Array.from({length:parcelas},(_,pi) => ({
                numero: pi+1,
                vencimento: futureDateStr((pi+1)*30),
                valor: valorParc,
                desconto: 0,
                eventoId: genEventoIds[0] || '',
                eventoDescricao: 'Mensalidade',
              }))
              items.push({
                id:sid(), codigo:`PP${String(i+1).padStart(3,'0')}`,
                nome:`Plano ${parcelas}x ${i+1}`,
                totalParcelas:parcelas, anuidade, ano: new Date().getFullYear(),
                diaVencimento: rndN(5,25), situacao:'ativo', parcelas:ps, createdAt:isoNow(),
              })
            }
            data.setCfgPadroesPagamento(p => [...p, ...items])
            addLog({ module:'Padrão de Pagamentos', count:q, ok:true })
            break
          }

          // ── Fornecedores ─────────────────────────────────────────────────
          case 'fornecedores': {
            const CATS = ['Materiais Didáticos','Limpeza','TI','Alimentação','Transporte','Segurança','Manutenção','Uniforme','Papelaria','Saúde']
            const BANCOS = ['001-Banco do Brasil','341-Itaú','237-Bradesco','033-Santander','104-Caixa']
            const items: any[] = []
            for (let i=0;i<q;i++) {
              const tipo = rnd(['juridico','fisico']) as 'juridico'|'fisico'
              const n = nomeCompleto()
              const id = sid()
              genFornecedorIds.push(id)
              items.push({
                id, codigo:`FOR${String(i+1).padStart(3,'0')}`,
                razaoSocial: tipo==='juridico' ? `${n} Comércio LTDA` : n,
                nomeFantasia: `Fornecedor ${i+1}`,
                cnpj: tipo==='juridico' ? cnpj() : '',
                cpf: tipo==='fisico' ? cpf() : '',
                tipo, categoria:rnd(CATS),
                email:email(n), telefone:fone(), celular:fone(),
                cep:cep(), logradouro:`Rua ${rnd(SOBRENOMES)}`, numero:`${rndN(1,999)}`,
                complemento:rnd(['Sala 1','Apt 2','','Loja 3','']),
                bairro:rnd(BAIRROS), cidade:rnd(CIDADES), uf:rnd(UFS),
                contato:nomeCompleto(), banco:rnd(BANCOS),
                agencia:`${rndN(1000,9999)}`, conta:`${rndN(10000,99999)}-${rndN(0,9)}`,
                situacao:'ativo', observacoes:'Gerado automaticamente.',
                createdAt:isoNow(),
              })
            }
            data.setFornecedoresCad(p => [...p, ...items])
            addLog({ module:'Fornecedores', count:q, ok:true })
            break
          }

          // ── Abertura de Caixa ────────────────────────────────────────────
          case 'aberturaCaixa': {
            const OPERADORES = ['Admin','Secretaria','Financeiro','Tesoureiro']
            const items: any[] = []
            for (let i=0;i<q;i++) {
              const id = sid()
              genCaixaIds.push(id)
              items.push({
                id, codigo:`CAX${String(i+1).padStart(3,'0')}`,
                nomeCaixa:`Caixa Principal ${i+1}`,
                dataAbertura:dateStr(rndN(0,30)),
                horaAbertura:`${String(rndN(7,9)).padStart(2,'0')}:${rndN(0,5)}0`,
                operador:rnd(OPERADORES),
                unidade:'Unidade Centro',
                saldoInicial:rndF(500,3000),
                movimentacoes:[],
                fechado: rnd([true,false]),
                horaFechamento:'18:00',
                saldoFinal:rndF(1000,5000),
              })
            }
            data.setCaixasAbertos(p => [...p, ...items])
            addLog({ module:'Abertura de Caixa', count:q, ok:true })
            break
          }

          // ── Contas a Receber ─────────────────────────────────────────────
          case 'contasReceber': {
            const DESCS_REC = ['Mensalidade','Matrícula','Taxa de Material','Uniforme','Excursão','Rematrícula','Seguro Escolar']
            const STATUS: Array<'pago'|'pendente'|'atrasado'> = ['pago','pendente','atrasado']
            const items: any[] = []
            for (let i=0;i<q;i++) {
              const status = rnd(STATUS)
              const n = nomeCompleto()
              const id = sid()
              genTituloIds.push(id)
              items.push({
                id, aluno:n, responsavel:nomeCompleto(),
                descricao:rnd(DESCS_REC), valor:rndF(200,2500),
                vencimento:status==='atrasado' ? dateStr(rndN(5,60)) : futureDateStr(rndN(5,90)),
                pagamento:status==='pago' ? dateStr(rndN(0,10)) : null,
                status, metodo:status==='pago' ? rnd(['pix','boleto','cartao_credito','dinheiro']) : null,
                parcela:`${rndN(1,12)}/${rndN(1,12)}`,
                eventoId: genEventoIds[0]||'', eventoDescricao:'Mensalidade',
              })
            }
            data.setTitulos(p => [...p, ...items])
            addLog({ module:'Contas a Receber', count:q, ok:true })
            break
          }

          // ── Contas a Pagar ───────────────────────────────────────────────
          case 'contasPagar': {
            const CATS = ['Pessoal','Serviços','Material','Manutenção','Utilidades','TI','Outros']
            const items: any[] = []
            for (let i=0;i<q;i++) {
              const status = rnd(['pago','pendente']) as 'pago'|'pendente'
              const fornId = genFornecedorIds.length ? rnd(genFornecedorIds) : ''
              const fornObj = data.fornecedoresCad.find(f=>f.id===fornId)
              items.push({
                id:sid(), descricao:`Despesa ${rnd(CATS)} ${i+1}`,
                categoria:rnd(CATS), valor:rndF(100,8000),
                vencimento:status==='pago'?dateStr(rndN(5,60)):futureDateStr(rndN(5,90)),
                status, fornecedor:fornObj?.razaoSocial||nomeCompleto(),
                numeroDocumento:`NF${rndN(10000,99999)}`,
                planoContasId:genPlanoIds[0]||'',
              })
            }
            data.setContasPagar(p => [...p, ...items])
            addLog({ module:'Contas a Pagar', count:q, ok:true })
            break
          }

          // ── Renegociação ─────────────────────────────────────────────────
          case 'renegociacao': {
            // Renegociação = novo titulo com desc "Renegociação"
            const items: any[] = []
            for (let i=0;i<q;i++) {
              const n = nomeCompleto()
              const id = sid()
              items.push({
                id, aluno:n, responsavel:nomeCompleto(),
                descricao:`Renegociação ${i+1}`, valor:rndF(500,5000),
                vencimento:futureDateStr(rndN(10,90)),
                pagamento:null, status:'pendente' as const,
                metodo:null, parcela:`1/${rndN(2,6)}`,
                eventoId:'', eventoDescricao:'Renegociação',
              })
            }
            data.setTitulos(p => [...p, ...items])
            addLog({ module:'Renegociações', count:q, ok:true })
            break
          }

          // ── Movimentações ────────────────────────────────────────────────
          case 'movimentacoes': {
            const TIPOS_DOC = ['NF','NFe','REC','DUP','PIX','TED','OUTRO'] as const
            const items: any[] = []
            for (let i=0;i<q;i++) {
              const caixaId = genCaixaIds.length ? rnd(genCaixaIds) : `${S}DEFAULT`
              const planoId = genPlanoIds.length ? rnd(genPlanoIds) : ''
              const fornId  = genFornecedorIds.length ? rnd(genFornecedorIds) : ''
              const fornObj = data.fornecedoresCad.find(f=>f.id===fornId)
              const tipo = rnd(['receita','despesa']) as 'receita'|'despesa'
              items.push({
                id:sid(), caixaId, tipo,
                fornecedorId:fornId, fornecedorNome:fornObj?.razaoSocial||nomeCompleto(),
                descricao:`${tipo==='receita'?'Recebimento':'Pagamento'} ${i+1}`,
                dataLancamento:dateStr(rndN(0,20)),
                dataMovimento:dateStr(rndN(0,20)),
                valor:rndF(100,5000),
                planoContasId:planoId, planoContasDesc:'Lançamento Geral',
                tipoDocumento:rnd([...TIPOS_DOC]),
                numeroDocumento:`DOC${rndN(10000,99999)}`,
                dataEmissao:dateStr(rndN(0,5)),
                compensadoBanco:rnd([true,false]),
                observacoes:'Gerado automaticamente.',
                criadoEm:isoNow(), editadoEm:isoNow(),
              })
            }
            data.setMovimentacoesManuais(p => [...p, ...items])
            addLog({ module:'Movimentações', count:q, ok:true })
            break
          }

          // ── Turmas ───────────────────────────────────────────────────────
          case 'turmas': {
            const SERIES  = ['Berçário','Maternal I','Maternal II','1º Ano','2º Ano','3º Ano','4º Ano','5º Ano','6º Ano','7º Ano','8º Ano','9º Ano','1ª Série','2ª Série','3ª Série']
            const TURNOS  = ['Manhã','Tarde','Noite','Integral']
            const SALAS   = ['Sala 01','Sala 02','Sala 03','Sala 04','Sala 05','Sala 06','Sala A','Sala B','Sala C']
            const PROFS   = [nome(),nome(),nome(),nome(),nome()]
            const items: any[] = []
            for (let i=0;i<q;i++) {
              const serie = rnd(SERIES)
              const turno = rnd(TURNOS)
              const id = sid()
              genTurmaIds.push(id)
              items.push({
                id, codigo:`T${String(i+1).padStart(3,'0')}`,
                nome:`${serie} ${String.fromCharCode(65+i)} — ${turno}`,
                serie, turno, professor:rnd(PROFS),
                sala:rnd(SALAS), capacidade:rndN(20,40),
                matriculados:0, unidade:'Unidade Centro',
                ano: new Date().getFullYear(),
              })
            }
            data.setTurmas(p => [...p, ...items])
            addLog({ module:'Turmas', count:q, ok:true })
            break
          }

          // ── Alunos (ficha completa) ──────────────────────────────────────
          case 'alunos': {
            const allTurmas = [...data.turmas, ...genTurmaIds.map(id => data.turmas.find(t=>t.id===id)||({ id, nome:'Turma A', serie:'1º Ano', turno:'Manhã' } as any))]
            const STATUS = ['matriculado','cursando','em_cadastro']
            const TIPOS_RESP = ['mae','pai','responsavel','avo']
            const GRUPOS_SANG = ['A+','A-','B+','B-','AB+','AB-','O+','O-']
            const PLANOS_SAUDE = ['Unimed','Bradesco Saúde','Amil','SulAmérica','Sem plano']
            const ALERGIAS = ['Nenhuma','Amendoim','Lactose','Glúten','Polen','Poeira','Insetos','Frutos do mar']
            const MEDICAMENTOS = ['Nenhum','Ritalina 10mg','Concerta 18mg','Rivotril 0,5mg','Amoxicilina']
            const DEFICIENCIAS = ['Nenhuma','TEA (Autismo)','TDAH','Dislexia','Baixa visão','Deficiência auditiva']

            const items: any[] = []
            for (let i=0;i<q;i++) {
              const feminino = rnd([true,false])
              const primeiroNome = rnd(feminino ? PRENOMES_F : PRENOMES_M)
              const nomeAluno = `${primeiroNome} ${rnd(SOBRENOMES)}`
              const anoNasc = new Date().getFullYear() - rndN(4, 18)
              const turmaObj = allTurmas.length ? rnd(allTurmas) : null
              const inadimplente = Math.random() < 0.2
              const risco: 'baixo'|'medio'|'alto' = rnd(['baixo','baixo','baixo','medio','alto'])

              const responsaveis = [
                {
                  tipo:'mae', nome:`${rnd(PRENOMES_F)} ${rnd(SOBRENOMES)}`,
                  cpf:cpf(), rg:`${rndN(1000000,9999999)}`, dataNascimento:`${rndN(1965,1990)}-${String(rndN(1,12)).padStart(2,'0')}-${String(rndN(1,28)).padStart(2,'0')}`,
                  profissao:rnd(['Professora','Enfermeira','Advogada','Médica','Comerciante','Do lar','Empresária']),
                  celular:fone(), email:email(rnd(PRENOMES_F)+' '+rnd(SOBRENOMES)),
                  parentesco:'Mãe', respPedagogico:true, respFinanceiro:false,
                  endereco:`Rua ${rnd(SOBRENOMES)}, ${rndN(1,999)}`, bairro:rnd(BAIRROS), cidade:rnd(CIDADES), estado:rnd(UFS), cep:cep(),
                  empresa:rnd(['Escola Estadual','Hospital Regional','Escritório Central','Autônoma','']),
                },
                {
                  tipo:'pai', nome:`${rnd(PRENOMES_M)} ${rnd(SOBRENOMES)}`,
                  cpf:cpf(), rg:`${rndN(1000000,9999999)}`, dataNascimento:`${rndN(1960,1988)}-${String(rndN(1,12)).padStart(2,'0')}-${String(rndN(1,28)).padStart(2,'0')}`,
                  profissao:rnd(['Engenheiro','Motorista','Médico','Advogado','Comerciante','Empresário','Professor']),
                  celular:fone(), email:email(rnd(PRENOMES_M)+' '+rnd(SOBRENOMES)),
                  parentesco:'Pai', respPedagogico:false, respFinanceiro:true,
                  endereco:`Rua ${rnd(SOBRENOMES)}, ${rndN(1,999)}`, bairro:rnd(BAIRROS), cidade:rnd(CIDADES), estado:rnd(UFS), cep:cep(),
                  empresa:rnd(['Construtora XYZ','Hospital Central','Empresa ABC','Autônomo','']),
                },
              ]

              const saude = {
                tipoSanguineo: rnd(GRUPOS_SANG),
                planoSaude: rnd(PLANOS_SAUDE),
                numeroCarteirinha: rnd(PLANOS_SAUDE) !== 'Sem plano' ? `${rndN(100000000,999999999)}` : '',
                alergias: rnd(ALERGIAS),
                medicamentosContinuos: rnd(MEDICAMENTOS),
                deficiencia: rnd(DEFICIENCIAS),
                laudoMedico: rnd(['Nenhum','CID F84.0','CID F90.0','CID H52','','']),
                restricaoAlimentar: rnd(['Nenhuma','Sem glúten','Sem lactose','Vegetariano','']),
                observacoesSaude: rnd(['','Acompanhamento psicológico em andamento.','Uso de óculos.','Aluno faz fonoaudiologia.','','']),
              }

              const docs = {
                rg: `${rndN(1000000,9999999)}`,
                orgaoEmissorRG: rnd(['SSP/SP','SSP/RJ','SSP/PR','SSP/RS']),
                dataEmissaoRG: `${rndN(2000,2015)}-${String(rndN(1,12)).padStart(2,'0')}-${String(rndN(1,28)).padStart(2,'0')}`,
                certidaoNascimento: `${rndN(100000,999999)} ${rndN(10,99)} ${rndN(2000,2015)} ${rndN(100000,999999)} ${rndN(1000,9999)}`,
                declaracaoEscolar: `DEC${rndN(10000,99999)}`,
                comprovante: rnd(['Conta de água','Conta de luz','Contrato de aluguel','Escritura']),
                cartaoVacinacao: rnd(['Completo','Incompleto','Em dia']),
              }

              const id = sid()
              genAlunoIds.push(id)
              items.push({
                id,
                nome: nomeAluno,
                matricula: `2026${String(rndN(1,9999)).padStart(7,'0')}`,
                turma: turmaObj?.nome || 'Sem turma',
                turmaId: turmaObj?.id || '',
                serie: turmaObj?.serie || '1º Ano',
                turno: turmaObj?.turno || 'Manhã',
                status: rnd(STATUS),
                email: email(nomeAluno),
                cpf: cpf(),
                rg: docs.rg,
                dataNascimento: `${anoNasc}-${String(rndN(1,12)).padStart(2,'0')}-${String(rndN(1,28)).padStart(2,'0')}`,
                naturalidade: rnd(CIDADES),
                nacionalidade: 'Brasileiro(a)',
                sexo: feminino ? 'F' : 'M',
                corRaca: rnd(['Branca','Parda','Preta','Amarela','Indígena']),
                responsavel: responsaveis[0].nome,
                responsavelFinanceiro: (responsaveis.find((r: any) => r.respFinanceiro) || responsaveis[1] || responsaveis[0]).nome,
                responsavelPedagogico: (responsaveis.find((r: any) => r.respPedagogico) || responsaveis[0]).nome,
                telefone: responsaveis[0].celular,
                inadimplente,
                risco_evasao: risco,
                media: rndF(4, 10),
                frequencia: risco === 'alto' ? rndN(40, 65) : risco === 'medio' ? rndN(66, 80) : rndN(81, 100),
                obs: rnd(['','Aluno bolsista 50%.','Filhos de funcionário.','Aluno monitorado pela coordenação.','Necessidade de reforço em Matemática.','','']),
                unidade: 'Unidade Centro',
                foto: null,
                // Dados extras completos
                responsaveis,
                saude,
                documentos: docs,
                endereco: {
                  cep: cep(), logradouro:`Rua ${rnd(SOBRENOMES)}`, numero:`${rndN(1,999)}`,
                  complemento: rnd(['Apt 1','Casa','','Bloco B','']),
                  bairro:rnd(BAIRROS), cidade:rnd(CIDADES), estado:rnd(UFS),
                },
                dadosEscolares: {
                  anoLetivo: new Date().getFullYear(),
                  formaPagamento: rnd(['boleto','pix','cartao_credito','dinheiro']),
                  desconto: rnd([0,0,0,10,25,50]),
                  tipoDesconto: rnd(['percentual','fixo']),
                  bolsaEstudo: Math.random() < 0.15,
                  transporteEscolar: rnd([true,false]),
                  periodoLetivo: rnd(['Anual','Semestral']),
                  observacoesFinanceiras: rnd(['','Pagamento via PIX mensal.','Parcelas negociadas para o dia 10.','','Boleto bancário cadastrado.','']),
                },
              })
            }
            data.setAlunos(p => [...p, ...items])
            addLog({ module:'Matrículas (Alunos)', count:q, ok:true })
            break
          }

          // ── Horário de Aulas ─────────────────────────────────────────────
          case 'horarioAulas': {
            const DISC = ['Matemática','Português','Ciências','História','Geografia','Inglês','Artes','Educação Física','Física','Química','Biologia','Filosofia']
            const DIAS: Array<0|1|2|3|4|5|6> = [1,2,3,4,5]
            const CORES = ['#6366f1','#10b981','#f59e0b','#3b82f6','#ec4899','#8b5cf6','#ef4444','#14b8a6']
            const allTurmas = data.turmas.filter(t => genTurmaIds.includes(t.id) || !t.id.startsWith(S))
            const items: any[] = []
            const used = new Set<string>()
            let tries = 0
            while (items.length < q && tries < q*10) {
              tries++
              const turmaId = allTurmas.length ? rnd(allTurmas).id : genTurmaIds[0]||`${S}T0`
              const dia = rnd(DIAS)
              const hora = rndN(7,16)
              const key = `${turmaId}_${dia}_${hora}`
              if (used.has(key)) continue
              used.add(key)
              const inicio = `${String(hora).padStart(2,'0')}:00`
              const fim    = `${String(hora+1).padStart(2,'0')}:50`
              items.push({
                id:sid(), turma:turmaId, diaSemana:dia,
                horaInicio:inicio, horaFim:fim,
                disciplina:rnd(DISC),
                professor:nomeCompleto(),
                sala:rnd(['Sala 01','Sala 02','Sala 03','Lab. Informática','Quadra']),
                tipo:'aula' as const,
                cor:rnd(CORES),
              })
            }
            data.setRotinaItems(p => [...p, ...items])
            addLog({ module:'Horário de Aulas', count:items.length, ok:true })
            break
          }

          // ── Frequência ──────────────────────────────────────────────────
          case 'frequencia': {
            const allAlunos = data.alunos.filter(a => genAlunoIds.includes(a.id))
            const allTurmas = data.turmas.filter(t => genTurmaIds.includes(t.id))
            if (!allAlunos.length || !allTurmas.length) {
              addLog({ module:'Frequência', count:0, ok:false, msg:'Sem alunos/turmas gerados' }); break
            }
            const items: any[] = []
            for (let i=0;i<q;i++) {
              const turma = rnd(allTurmas)
              const alunosDaTurma = allAlunos.filter(a => (a as any).turmaId === turma.id || a.turma === turma.nome)
              const registros = (alunosDaTurma.length ? alunosDaTurma : allAlunos.slice(0,5)).map(a => ({
                alunoId:a.id,
                status: rnd(['P','P','P','P','F','J','A']) as 'P'|'F'|'J'|'A',
              }))
              items.push({
                id:sid(), turmaId:turma.id,
                data:dateStr(rndN(0,60)),
                registros, criadoPor:'Professor(a)', createdAt:isoNow(),
              })
            }
            data.setFrequencias(p => [...p, ...items])
            addLog({ module:'Frequência', count:q, ok:true })
            break
          }

          // ── Lançamento de Notas ─────────────────────────────────────────
          case 'notas': {
            const allAlunos = data.alunos.filter(a => genAlunoIds.includes(a.id))
            const allTurmas = data.turmas.filter(t => genTurmaIds.includes(t.id))
            if (!allAlunos.length || !allTurmas.length) {
              addLog({ module:'Lançamento de Notas', count:0, ok:false, msg:'Sem alunos/turmas gerados' }); break
            }
            const DISC = ['Matemática','Português','Ciências','História','Geografia']
            const items: any[] = []
            for (let i=0;i<q;i++) {
              const turma = rnd(allTurmas)
              const alunosDaTurma = allAlunos.filter(a => (a as any).turmaId === turma.id || a.turma === turma.nome)
              const notas = (alunosDaTurma.length ? alunosDaTurma : allAlunos.slice(0,5)).map(a => {
                const n1=rndF(0,10), n2=rndF(0,10), n3=rndF(0,10)
                return { alunoId:a.id, n1, n2, n3, media: parseFloat(((n1+n2+n3)/3).toFixed(1)) }
              })
              items.push({
                id:sid(), turmaId:turma.id,
                disciplina:rnd(DISC),
                bimestre:rndN(1,4),
                notas, criadoPor:'Professor(a)', createdAt:isoNow(),
              })
            }
            data.setLancamentosNota(p => [...p, ...items])
            addLog({ module:'Lançamento de Notas', count:q, ok:true })
            break
          }

          // ── Ocorrências ─────────────────────────────────────────────────
          case 'ocorrencias': {
            const allAlunos = data.alunos.filter(a => genAlunoIds.includes(a.id))
            if (!allAlunos.length) { addLog({ module:'Ocorrências', count:0, ok:false, msg:'Sem alunos' }); break }
            const TIPOS = ['Atraso','Indisciplina em sala','Uso de celular em sala','Tarefa não realizada','Desrespeito ao professor','Briga com colega','Fardamento incompleto','Dano ao patrimônio']
            const GRAVS: Array<'leve'|'media'|'grave'> = ['leve','leve','media','media','grave']
            const RESP = ['Coordenação','Secretaria','Professor(a)','Diretoria']
            const items: any[] = []
            for (let i=0;i<q;i++) {
              const aluno = rnd(allAlunos)
              const tipo = rnd(TIPOS)
              items.push({
                id:sid(), alunoId:aluno.id, alunoNome:aluno.nome,
                turma:aluno.turma, tipo,
                descricao:`${tipo}. Ocorrência registrada para ${aluno.nome}.`,
                gravidade:rnd(GRAVS),
                data:dateStr(rndN(0,90)),
                responsavel:rnd(RESP),
                ciencia_responsavel:rnd([true,false]),
                createdAt:isoNow(),
              })
            }
            data.setOcorrencias(p => [...p, ...items])
            addLog({ module:'Ocorrências', count:q, ok:true })
            break
          }

          // ── Ensalamento ─────────────────────────────────────────────────
          case 'ensalamento': {
            // Ensalamento: associar alunos a turmas via RotinaItem com tipo 'aula'
            const allAlunos = data.alunos.filter(a => genAlunoIds.includes(a.id))
            const allTurmas = data.turmas.filter(t => genTurmaIds.includes(t.id))
            if (!allAlunos.length || !allTurmas.length) {
              addLog({ module:'Ensalamento', count:0, ok:false, msg:'Sem alunos/turmas' }); break
            }
            // Atualizar turmas com matriculados
            data.setTurmas(prev => prev.map(t => {
              if (genTurmaIds.includes(t.id)) {
                const qt = allAlunos.filter(a => (a as any).turmaId === t.id || a.turma === t.nome).length
                return { ...t, matriculados: qt }
              }
              return t
            }))
            addLog({ module:'Ensalamento', count:allTurmas.length, ok:true })
            break
          }

          // ── Transferências ──────────────────────────────────────────────
          case 'transferencias': {
            const allAlunos = data.alunos.filter(a => genAlunoIds.includes(a.id))
            if (!allAlunos.length) { addLog({ module:'Transferências', count:0, ok:false, msg:'Sem alunos' }); break }
            const ESCOLAS = ['Escola Estadual São José','Instituto Federal','Colégio Municipal','Centro Educacional','Escola Municipal Tiradentes']
            const MOTIVOS = ['Mudança de endereço','Transferência a pedido da família','Questão financeira','Mudança de cidade','Vaga em escola pública','Motivos pessoais']
            const STATUS_TRANSF: Array<'pendente'|'aprovado'|'enviado'|'recebido'> = ['pendente','aprovado','enviado','recebido']
            const items: any[] = []
            for (let i=0;i<q;i++) {
              items.push({
                id:sid(),
                alunoNome:rnd(allAlunos).nome,
                tipo: rnd(['entrada','saida']) as 'entrada'|'saida',
                escola:rnd(ESCOLAS), motivo:rnd(MOTIVOS),
                data:dateStr(rndN(0,60)),
                status:rnd(STATUS_TRANSF),
                docs:rnd([['RG','Histórico Escolar'],['Histórico Escolar','Declaração'],['RG','CPF','Histórico Escolar']]),
                createdAt:isoNow(),
              })
            }
            data.setTransferencias(p => [...p, ...items])
            addLog({ module:'Transferências', count:q, ok:true })
            break
          }

          // ── Documentos ─────────────────────────────────────────────────
          case 'documentos': {
            const allAlunos = data.alunos.filter(a => genAlunoIds.includes(a.id))
            if (!allAlunos.length) { addLog({ module:'Documentos', count:0, ok:false, msg:'Sem alunos' }); break }
            const TIPOS_DOC_MUN = ['Histórico Escolar','Declaração de Matrícula','Boletim','Contrato','Declaração de Frequência','Atestado de Escolaridade']
            // Salva como eventos de agenda (documentos emitidos)
            const items: any[] = []
            for (let i=0;i<q;i++) {
              const aluno = rnd(allAlunos)
              items.push({
                id:sid(),
                titulo:`${rnd(TIPOS_DOC_MUN)} - ${aluno.nome}`,
                descricao:`Documento gerado para ${aluno.nome} em ${dateStr(rndN(0,30))}.`,
                tipo:'entrega' as const,
                data:dateStr(rndN(0,30)),
                horaInicio:'08:00', horaFim:'09:00',
                turmas:[(aluno as any).turmaId||''],
                local:'Secretaria',
                cor:'#6366f1',
                recorrente:false,
                criadoPor:'Secretaria',
                confirmacaoNecessaria:false,
                confirmados:[],
                unidade:'Unidade Centro',
                createdAt:isoNow(),
              })
            }
            data.setEventosAgenda(p => [...p, ...items])
            addLog({ module:'Documentos', count:q, ok:true })
            break
          }

          default:
            addLog({ module:moduleId, count:0, ok:false, msg:'Módulo não implementado' })
        }
      } catch(e: any) {
        addLog({ module:moduleId, count:0, ok:false, msg:e?.message||'Erro desconhecido' })
      }
    }

    setRunning(false); setDone(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qty, selected, data])

  // ─── Delete seed data ────────────────────────────────────────────────────
  const deleteSeed = useCallback(async () => {
    setDeleting(true); setLogs([]); setDone(false)
    await sleep(200)
    const isSeed = (id?: string) => typeof id === 'string' && id.toUpperCase().startsWith('__SEED__')
    data.setAlunos(p => p.filter(x => !isSeed(x.id)))
    data.setTurmas(p => p.filter(x => !isSeed(x.id)))
    data.setTitulos(p => p.filter(x => !isSeed(x.id)))
    data.setContasPagar(p => p.filter(x => !isSeed(x.id)))
    data.setFornecedoresCad(p => p.filter(x => !isSeed(x.id)))
    data.setCaixasAbertos(p => p.filter(x => !isSeed(x.id)))
    data.setMovimentacoesManuais(p => p.filter(x => !isSeed(x.id)))
    data.setCfgPlanoContas(p => p.filter(x => !isSeed(x.id)))

    data.setCfgEventos(p => p.filter(x => !isSeed(x.id)))
    data.setCfgPadroesPagamento(p => p.filter(x => !isSeed(x.id)))
    data.setFrequencias(p => p.filter(x => !isSeed(x.id)))
    data.setLancamentosNota(p => p.filter(x => !isSeed(x.id)))
    data.setOcorrencias(p => p.filter(x => !isSeed(x.id)))
    data.setTransferencias(p => p.filter(x => !isSeed(x.id)))
    data.setRotinaItems(p => p.filter(x => !isSeed(x.id)))
    data.setEventosAgenda(p => p.filter(x => !isSeed(x.id)))
    addLog({ module:'Limpeza concluída', count:0, ok:true })
    setDeleting(false); setDone(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  // ─── Count totals ────────────────────────────────────────────────────────
  const totalQty = [...selected].reduce((s, id) => s + (qty[id]||0), 0)

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:44,height:44,borderRadius:14,background:'linear-gradient(135deg,#6366f1,#3b82f6)',display:'flex',alignItems:'center',justifyContent:'center' }}>
            <Database size={22} color="#fff"/>
          </div>
          <div>
            <div style={{ fontWeight:800, fontSize:16, fontFamily:'Outfit,sans-serif' }}>Gerador de Dados de Teste</div>
            <div style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>
              {[...selected].length} módulo{[...selected].length!==1?'s':''} selecionado{[...selected].length!==1?'s':''} · {totalQty} registros a gerar
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button
            className="btn btn-danger btn-sm"
            onClick={deleteSeed}
            disabled={running||deleting}
            style={{ gap:6 }}
          >
            {deleting ? <Loader2 size={14} style={{ animation:'spin 1s linear infinite' }}/> : <Trash2 size={14}/>}
            Excluir Dados de Teste
          </button>
          <button
            className="btn btn-primary"
            onClick={generate}
            disabled={running||deleting||[...selected].length===0}
            style={{ background:'linear-gradient(135deg,#6366f1,#3b82f6)', gap:6, minWidth:160 }}
          >
            {running ? <Loader2 size={16} style={{ animation:'spin 1s linear infinite' }}/> : <Play size={16}/>}
            {running ? 'Gerando…' : 'Gerar Dados'}
          </button>
        </div>
      </div>

      {/* Groups */}
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        {GROUPS.map(group => {
          const allOn = group.modules.every(m => selected.has(m.id))
          const isOpen = expanded[group.id]
          return (
            <div key={group.id} className="card" style={{ overflow:'hidden', padding:0 }}>
              {/* Group header */}
              <div
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', background:`${group.color}10`, borderBottom:`2px solid ${group.color}30`, cursor:'pointer' }}
                onClick={() => setExpanded(p => ({...p, [group.id]:!p[group.id]}))}
              >
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:10,height:10,borderRadius:'50%',background:group.color }}/>
                  <span style={{ fontWeight:800, fontSize:14, color:group.color }}>{group.label}</span>
                  <span style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>{group.modules.length} módulo{group.modules.length!==1?'s':''}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, cursor:'pointer' }} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={allOn} onChange={() => toggleGroup(group)} style={{ accentColor:group.color }}/>
                    Selecionar todos
                  </label>
                  {isOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                </div>
              </div>

              {/* Modules */}
              {isOpen && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:12, padding:16 }}>
                  {group.modules.map(mod => {
                    const on = selected.has(mod.id)
                    return (
                      <div key={mod.id} style={{ border:`1.5px solid ${on ? group.color : 'hsl(var(--border-subtle))'}`, borderRadius:12, padding:'12px 14px', background:on?`${group.color}08`:'transparent', transition:'all 0.15s' }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontWeight:600, fontSize:12 }}>
                            <input type="checkbox" checked={on} onChange={() => toggleModule(mod.id)} style={{ accentColor:group.color }}/>
                            {mod.label}
                          </label>
                        </div>
                        {mod.depends && (
                          <div style={{ fontSize:10, color:'hsl(var(--text-muted))', marginBottom:8 }}>
                            ↳ depende de: {mod.depends.join(', ')}
                          </div>
                        )}
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ fontSize:11, color:'hsl(var(--text-muted))' }}>Quantidade:</span>
                          <input
                            type="number" min={1} max={500}
                            value={qty[mod.id]||mod.qty}
                            onChange={e => setQty(p => ({...p, [mod.id]:Math.max(1,parseInt(e.target.value)||1)}))}
                            disabled={!on}
                            style={{ width:72, height:28, fontSize:12, padding:'0 8px', borderRadius:8, border:'1px solid hsl(var(--border-subtle))', background:'hsl(var(--bg-base))', color:'hsl(var(--text-primary))', opacity:on?1:0.4 }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Log */}
      {logs.length > 0 && (
        <div className="card" style={{ padding:'16px 20px' }}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
            <CheckCircle2 size={16} color="#10b981"/>
            Log de Geração
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {logs.map((l,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12 }}>
                {l.ok
                  ? <CheckCircle2 size={13} color="#10b981"/>
                  : <AlertCircle size={13} color="#ef4444"/>}
                <span style={{ fontWeight:600 }}>{l.module}</span>
                {l.ok
                  ? <span style={{ color:'hsl(var(--text-muted))' }}>— {l.count} registros gerados</span>
                  : <span style={{ color:'#f87171' }}>— {l.msg}</span>}
              </div>
            ))}
            {done && !running && !deleting && (
              <div style={{ marginTop:8, padding:'10px 14px', borderRadius:10, background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)', color:'#10b981', fontWeight:700, fontSize:12 }}>
                ✅ Concluído! Acesse as páginas indicadas para ver os dados.
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
