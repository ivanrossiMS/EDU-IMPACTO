'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';



import { useState, useMemo, useEffect } from 'react'
import { useData, newId } from '@/lib/dataContext'
import {
  X, ChevronLeft, ChevronRight, Check, Plus, Trash2, Edit2,
  User, Users, GraduationCap, FileText, DollarSign, AlertCircle,
  RefreshCw, Eye, EyeOff, Download, CalendarDays
} from 'lucide-react'
import { CepAddressFields } from '@/components/ui/CepInput'

// ─── helpers ────────────────────────────────────────────────────────
const gerarCodigo = (seq: number) => String(seq).padStart(6, '0')

// Retorna o próximo seq do aluno sem repetir mesmo que haja exclusões
const proximoSeqAluno = (alunos: any[]): number => {
  if (!alunos || alunos.length === 0) return 1
  const nums = alunos
    .map(a => parseInt(a._dadosAluno?.codigo || '0', 10))
    .filter(n => !isNaN(n) && n > 0)
  return nums.length > 0 ? Math.max(...nums) + 1 : alunos.length + 1
}

// Gera código de responsável único verificando todos já cadastrados
const gerarCodigoRespUnico = (alunos: any[]): string => {
  const existentes = new Set<string>()
  if (alunos && Array.isArray(alunos)) {
    alunos.forEach(a => {
      const resps: any[] = a._responsaveis || []
      resps.forEach(r => { if (r.codigo) existentes.add(r.codigo) })
    })
  }
  let code: string
  do { code = gerarCodigo(Math.floor(Math.random() * 999999)) }
  while (existentes.has(code))
  return code
}

const calcIdade = (dataNasc: string) => {
  if (!dataNasc) return ''
  const h = new Date(), n = new Date(dataNasc)
  return `${h.getFullYear() - n.getFullYear() - (h < new Date(h.getFullYear(), n.getMonth(), n.getDate()) ? 1 : 0)} anos`
}
const fmtCur = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const hoje = () => new Date().toISOString().slice(0, 10)
const anoAtual = new Date().getFullYear()

// ─── opções ─────────────────────────────────────────────────────────
const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']
const COR_RACA = ['Branca','Preta','Parda','Amarela','Indigena','Nao declarado']
const ESTADO_CIVIL = ['Solteiro(a)','Casado(a)','Divorciado(a)','Viuvo(a)','Uniao estavel']
const SEXO_OPTS = ['Masculino','Feminino','Nao informado']
const SITUACAO_MATRICULA = ['Aprovado','Aprovado com PP','Concluido','Desistente','Cancelada','Trancada','Remanejado','Reprovado','Reprovado por falta','Transferido']
const METODOS_PAGAMENTO = ['PIX','Boleto','Cartao Credito','Cartao Debito','Dinheiro','Transferencia']

// ─── tipos internos ──────────────────────────────────────────────────
interface RespData {
  tipo: 'mae' | 'pai' | 'outro'
  codigo: string; cpf: string; nome: string; dataNasc: string; sexo: string
  rg: string; orgEmissor: string; nacionalidade: string; naturalidade: string
  uf: string; estadoCivil: string; profissao: string; email: string; celular: string
  cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; ufEnd: string
  respPedagogico: boolean; respFinanceiro: boolean
}

interface MatriculaData {
  id: string; turmaId: string; turmaNome: string; serie: string; turno: string; ano: number
  dataMatricula: string; padraoPagamentoId: string; situacao: string; dataResultado: string
  grupoAlunos: string; bolsista: boolean; respFinanceiroNome: string
}

interface ParcelaAluno {
  id: string; numero: number; vencimento: string; valor: number
  desconto: number; status: 'aberto' | 'pago' | 'cancelado'
  dataPagamento: string; metodoPagamento: string; obs: string
  historico: string[]
  eventoId?: string
  eventoDescricao?: string
}

const BLANK_RESP = (tipo: 'mae' | 'pai' | 'outro', alunos: any[] = []): RespData => ({
  tipo, codigo: gerarCodigoRespUnico(alunos),
  cpf: '', nome: '', dataNasc: '', sexo: '', rg: '', orgEmissor: '',
  nacionalidade: 'Brasileiro(a)', naturalidade: '', uf: 'SP',
  estadoCivil: '', profissao: '', email: '', celular: '',
  cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', ufEnd: 'SP',
  respPedagogico: tipo !== 'outro', respFinanceiro: tipo === 'mae',
})

// ─── PASSO STEPS ────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Dados do Aluno', icon: User },
  { id: 2, label: 'Responsaveis', icon: Users },
  { id: 3, label: 'Matricula', icon: GraduationCap },
  { id: 4, label: 'Obs e Saude', icon: FileText },
  { id: 5, label: 'Pagamentos', icon: DollarSign },
]

// ─── Sub-form de responsável ─────────────────────────────────────────
function RespForm({ data, onChange, label }: { data: RespData; onChange: (d: RespData) => void; label: string }) {
  const set = (k: keyof RespData, v: unknown) => onChange({ ...data, [k]: v })
  const idadeResp = calcIdade(data.dataNasc)
  return (
    <div style={{ border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, padding: 20, marginBottom: 16, background: 'hsl(var(--bg-elevated))' }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: '#60a5fa', display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span>
        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={data.respPedagogico} onChange={e => set('respPedagogico', e.target.checked)} />
            Resp. Pedagogico
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={data.respFinanceiro} onChange={e => set('respFinanceiro', e.target.checked)} />
            Resp. Financeiro
          </label>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 130px 1fr', gap: 10, marginBottom: 10 }}>
        <div><label className="form-label">Codigo</label><input className="form-input" value={data.codigo} readOnly style={{ color: '#60a5fa', fontWeight: 700 }} /></div>
        <div><label className="form-label">Nome Completo *</label><input className="form-input" value={data.nome} onChange={e => set('nome', e.target.value)} placeholder="Nome completo" /></div>
        <div><label className="form-label">CPF</label><input className="form-input" value={data.cpf} onChange={e => set('cpf', e.target.value)} placeholder="000.000.000-00" /></div>
        <div>
          <label className="form-label">Nascimento {idadeResp && <span style={{ color: '#10b981', fontWeight: 700 }}>({idadeResp})</span>}</label>
          <input type="date" className="form-input" value={data.dataNasc} onChange={e => set('dataNasc', e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 130px 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div><label className="form-label">Sexo</label><select className="form-input" value={data.sexo} onChange={e => set('sexo', e.target.value)}><option value="">Selecionar</option>{SEXO_OPTS.map(s => <option key={s}>{s}</option>)}</select></div>
        <div><label className="form-label">Estado Civil</label><select className="form-input" value={data.estadoCivil} onChange={e => set('estadoCivil', e.target.value)}><option value="">Selecionar</option>{ESTADO_CIVIL.map(s => <option key={s}>{s}</option>)}</select></div>
        <div><label className="form-label">RG</label><input className="form-input" value={data.rg} onChange={e => set('rg', e.target.value)} /></div>
        <div><label className="form-label">Org. Emissor</label><input className="form-input" value={data.orgEmissor} onChange={e => set('orgEmissor', e.target.value)} /></div>
        <div><label className="form-label">Profissao</label><input className="form-input" value={data.profissao} onChange={e => set('profissao', e.target.value)} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div><label className="form-label">Nacionalidade</label><input className="form-input" value={data.nacionalidade} onChange={e => set('nacionalidade', e.target.value)} /></div>
        <div><label className="form-label">Naturalidade</label><input className="form-input" value={data.naturalidade} onChange={e => set('naturalidade', e.target.value)} /></div>
        <div><label className="form-label">UF Nascimento</label><select className="form-input" value={data.uf} onChange={e => set('uf', e.target.value)}>{UFS.map(u => <option key={u}>{u}</option>)}</select></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div><label className="form-label">Email</label><input type="email" className="form-input" value={data.email} onChange={e => set('email', e.target.value)} /></div>
        <div><label className="form-label">Celular / WhatsApp</label><input type="tel" className="form-input" value={data.celular} onChange={e => set('celular', e.target.value)} placeholder="(11) 99999-0000" /></div>
      </div>
      <div style={{ borderTop: '1px solid hsl(var(--border-subtle))', paddingTop: 12, marginTop: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 8 }}>ENDEREÇO</div>
        <CepAddressFields
          cep={data.cep}
          logradouro={data.logradouro}
          numero={data.numero}
          complemento={data.complemento}
          bairro={data.bairro}
          cidade={data.cidade}
          estado={data.ufEnd}
          onChange={(field, value) => {
            const map: Record<string, keyof RespData> = {
              cep: 'cep', logradouro: 'logradouro', numero: 'numero',
              complemento: 'complemento', bairro: 'bairro',
              cidade: 'cidade', estado: 'ufEnd',
            }
            if (map[field]) set(map[field], value)
          }}
        />
      </div>
    </div>
  )
}

// ─── Modal de adicionar matrícula ────────────────────────────────────
function ModalMatricula({
  open, onClose, onSave, editing, responsaveis, padroes, turmas
}: {
  open: boolean; onClose: () => void; editing: MatriculaData | null
  onSave: (m: MatriculaData) => void
  responsaveis: RespData[]; padroes: any[]; turmas: any[]
}) {
  const blank: MatriculaData = {
    id: newId('MAT'), turmaId: '', turmaNome: '', serie: '', turno: '', ano: anoAtual,
    dataMatricula: hoje(), padraoPagamentoId: '', situacao: 'Aprovado',
    dataResultado: '', grupoAlunos: '', bolsista: false, respFinanceiroNome: '',
  }
  const [form, setForm] = useState<MatriculaData>(editing ?? blank)

  useEffect(() => { if (open) setForm(editing ?? blank) }, [open, editing])

  const set = (k: keyof MatriculaData, v: unknown) => setForm(p => ({ ...p, [k]: v }))

  const handleTurma = (id: string) => {
    const t = turmas.find((x: any) => x.id === id)
    if (t) setForm(p => ({ ...p, turmaId: id, turmaNome: t.nome, serie: t.serie, turno: t.turno, ano: t.ano ?? anoAtual }))
  }

  const padraoesDaTurma = padroes.filter((p: any) => !p.turma || p.turma === form.turmaNome || !p.turma)

  const respFinanc = responsaveis.filter(r => r.respFinanceiro)

  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: 'hsl(var(--bg-elevated))', borderRadius: 16, padding: 28, width: '100%', maxWidth: 600, border: '1px solid hsl(var(--border-default))', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 20 }}>
          {editing ? 'Editar Matricula' : 'Nova Matricula'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label className="form-label">Turma *</label>
            <select className="form-input" value={form.turmaId} onChange={e => handleTurma(e.target.value)}>
              <option value="">Selecionar turma</option>
              {turmas.map((t: any) => <option key={t.id} value={t.id}>{t.nome} — {t.serie}/{t.turno}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Ano Letivo</label>
            <input className="form-input" value={form.ano} readOnly style={{ color: '#60a5fa', fontWeight: 700 }} />
          </div>
          <div>
            <label className="form-label">Data da Matricula</label>
            <input type="date" className="form-input" value={form.dataMatricula} onChange={e => set('dataMatricula', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Padrao de Pagamento</label>
            <select className="form-input" value={form.padraoPagamentoId} onChange={e => set('padraoPagamentoId', e.target.value)}>
              <option value="">Selecionar padrao</option>
              {padraoesDaTurma.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Situacao</label>
            <select className="form-input" value={form.situacao} onChange={e => set('situacao', e.target.value)}>
              {SITUACAO_MATRICULA.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Data Resultado</label>
            <input type="date" className="form-input" value={form.dataResultado} onChange={e => set('dataResultado', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Grupo de Alunos</label>
            <input className="form-input" value={form.grupoAlunos} onChange={e => set('grupoAlunos', e.target.value)} placeholder="Ex: Grupo A" />
          </div>
          <div>
            <label className="form-label">Bolsista</label>
            <select className="form-input" value={form.bolsista ? 'sim' : 'nao'} onChange={e => set('bolsista', e.target.value === 'sim')}>
              <option value="nao">Nao</option>
              <option value="sim">Sim</option>
            </select>
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Responsavel Financeiro</label>
            <select className="form-input" value={form.respFinanceiroNome} onChange={e => set('respFinanceiroNome', e.target.value)}>
              <option value="">Selecionar responsavel</option>
              {respFinanc.map(r => <option key={r.codigo} value={r.nome}>{r.nome} ({r.tipo})</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => { onSave(form); onClose() }}>
            <Check size={14} />{editing ? 'Salvar' : 'Adicionar Matricula'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// MODAL PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
interface Props { open: boolean; onClose: () => void; editingId?: string | null }

export default function CadastroAlunoModal({ open, onClose, editingId }: Props) {
  const { turmas, cfgPadroesPagamento } = useData();
  const [alunos, setAlunos] = useSupabaseArray<any>('alunos');
  const [titulos, setTitulos] = useSupabaseArray<any>('titulos');

  const [step, setStep] = useState(1)

  // ── PASSO 1: Dados do aluno ──────────────────────────────────────
  const seq0 = proximoSeqAluno(alunos)
  const [dadosAluno, setDadosAluno] = useState({
    codigo: gerarCodigo(seq0),
    cpf: '', nome: '', idCenso: '',
    rga: `${anoAtual}${gerarCodigo(seq0)}`,
    dataNasc: '', sexo: '', estadoCivil: '', nacionalidade: 'Brasileiro(a)',
    naturalidade: '', uf: 'SP', corRaca: '', outros: '',
  })
  const idadeAluno = calcIdade(dadosAluno.dataNasc)

  // ── PASSO 2: Responsáveis ────────────────────────────────────────
  const [mae, setMae] = useState<RespData>(() => BLANK_RESP('mae', alunos))
  const [pai, setPai] = useState<RespData>(() => BLANK_RESP('pai', alunos))
  const [outro, setOutro] = useState<RespData>(() => BLANK_RESP('outro', alunos))
  const [temOutro, setTemOutro] = useState(false)

  // ── PASSO 3: Matrículas ──────────────────────────────────────────
  const [matriculas, setMatriculas] = useState<MatriculaData[]>([])
  const [modalMat, setModalMat] = useState(false)
  const [editingMat, setEditingMat] = useState<MatriculaData | null>(null)

  // ── PASSO 4: Obs e Saúde ─────────────────────────────────────────
  const [obs, setObs] = useState('')
  const [temInfoMedica, setTemInfoMedica] = useState(false)
  const [infoMedica, setInfoMedica] = useState('')

  // ── PASSO 5: Parcelas ────────────────────────────────────────────
  const [parcelas, setParcelas] = useState<ParcelaAluno[]>([])
  const [parcelaInicio, setParcelaInicio] = useState(1)
  const [obsFinanceira, setObsFinanceira] = useState('')
  const [editingParcela, setEditingParcela] = useState<string | null>(null)

  const respFinanc = [mae, pai, ...(temOutro ? [outro] : [])].filter(r => r.respFinanceiro)

  // Gera parcelas do padrão selecionado na matrícula mais recente
  // Herda eventoId/eventoDescricao de cada ParcelaPadrao
  const gerarParcelas = () => {
    const mat = matriculas[matriculas.length - 1]
    if (!mat?.padraoPagamentoId) { alert('Selecione um padrao de pagamento na matricula primeiro.'); return }
    const padrao = cfgPadroesPagamento?.find(p => p.id === mat.padraoPagamentoId)
    if (!padrao) { alert('Padrao nao encontrado.'); return }
    const geradas: ParcelaAluno[] = padrao.parcelas
      .filter(p => p.numero >= parcelaInicio)
      .map(p => ({
        id: newId('PAR'), numero: p.numero, vencimento: p.vencimento,
        valor: p.valor, desconto: p.desconto ?? 0,
        status: 'aberto', dataPagamento: '', metodoPagamento: '', obs: '',
        historico: [
          `${hoje()} — Parcela gerada a partir do padrao ${padrao.nome}${
            p.eventoDescricao ? ` | Evento: ${p.eventoDescricao}` : ''
          }`
        ],
        // Herdar evento do padrão
        eventoId: p.eventoId ?? (padrao as any).eventoId ?? '',
        eventoDescricao: p.eventoDescricao ?? (padrao as any).eventoDescricao ?? '',
      }))
    setParcelas(prev => [...prev, ...geradas.filter(g => !prev.some(pp => pp.numero === g.numero))])
  }

  const baixarParcela = (id: string, metodo: string) => {
    setParcelas(prev => prev.map(p => p.id === id
      ? { ...p, status: 'pago', dataPagamento: hoje(), metodoPagamento: metodo, historico: [...p.historico, `${hoje()} — Baixa: ${metodo}`] }
      : p
    ))
  }

  const cancelarParcela = (id: string) => {
    setParcelas(prev => prev.map(p => p.id === id
      ? { ...p, status: 'cancelado', historico: [...p.historico, `${hoje()} — Cancelada`] }
      : p
    ))
  }

  const editarParcela = (id: string, campo: keyof ParcelaAluno, val: unknown) => {
    setParcelas(prev => prev.map(p => p.id === id ? { ...p, [campo]: val } : p))
  }

  const totalAberto = parcelas.filter(p => p.status === 'aberto').reduce((s, p) => s + p.valor - p.desconto, 0)
  const totalPago = parcelas.filter(p => p.status === 'pago').reduce((s, p) => s + p.valor - p.desconto, 0)

  // ── Reiniciar ao abrir ───────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    setStep(1)
    const seq = proximoSeqAluno(alunos)
    setDadosAluno({
      codigo: gerarCodigo(seq), cpf: '', nome: '', idCenso: '',
      rga: `${anoAtual}${gerarCodigo(seq)}`,
      dataNasc: '', sexo: '', estadoCivil: '', nacionalidade: 'Brasileiro(a)',
      naturalidade: '', uf: 'SP', corRaca: '', outros: '',
    })
    setMae(BLANK_RESP('mae', alunos)); setPai(BLANK_RESP('pai', alunos)); setOutro(BLANK_RESP('outro', alunos))
    setTemOutro(false); setMatriculas([]); setObs(''); setTemInfoMedica(false)
    setInfoMedica(''); setParcelas([]); setObsFinanceira('')
  }, [open])

  const canNext = () => {
    if (step === 1) return !!dadosAluno.nome.trim()
    if (step === 2) return !!mae.nome.trim() && !!pai.nome.trim()
    return true
  }

  const handleFinalizar = () => {
    const respPrincipal = [mae, pai, ...(temOutro ? [outro] : [])].find(r => r.respPedagogico)
    const respFin = [mae, pai, ...(temOutro ? [outro] : [])].find(r => r.respFinanceiro)
    const matAtual = matriculas[0]
    const alunoId = newId('A')

    // ── Criar títulos em Contas a Receber para parcelas em aberto ──
    const novosTitulos = parcelas
      .filter(p => p.status !== 'cancelado')
      .map(p => {
        const totalParcelas = parcelas.filter(x => x.status !== 'cancelado').length
        const titulo = {
          id: newId('TIT'),
          codigo: `TIT-${Math.floor(Math.random() * 90000) + 10000}`,
          aluno: dadosAluno.nome,
          responsavel: respFin?.nome ?? mae.nome,
          // Descrição: usa o nome do evento se vinculado, senão o nome do padrão
          descricao: p.eventoDescricao
            ? `${p.eventoDescricao} — Parcela ${p.numero}/${totalParcelas}`
            : `Mensalidade — Parcela ${p.numero}/${totalParcelas}`,
          valor: +(p.valor - p.desconto).toFixed(2),
          vencimento: p.vencimento,
          pagamento: p.status === 'pago' ? (p.dataPagamento || hoje()) : null,
          status: p.status === 'pago' ? 'pago' as const : 'pendente' as const,
          metodo: p.status === 'pago' ? (p.metodoPagamento || null) : null,
          parcela: `${p.numero}/${totalParcelas}`,
          // Propagar evento financeiro
          eventoId: p.eventoId || '',
          eventoDescricao: p.eventoDescricao || '',
          // Metadados extras
          alunoId,
          turma: matAtual?.turmaNome ?? '',
          ano: matAtual?.ano ?? new Date().getFullYear(),
        }
        return titulo
      })

    if (novosTitulos.length > 0) {
      setTitulos((prev: any[]) => [...prev, ...novosTitulos])
    }

    const novoAluno = {
      id: alunoId,
      nome: dadosAluno.nome,
      matricula: dadosAluno.rga,
      turma: matAtual?.turmaNome ?? '',
      serie: matAtual?.serie ?? '',
      turno: matAtual?.turno ?? '',
      status: 'matriculado',
      email: mae.email || pai.email,
      cpf: dadosAluno.cpf,
      dataNascimento: dadosAluno.dataNasc,
      responsavel: respPrincipal?.nome ?? mae.nome,
      // Responsáveis separados por função
      responsavelFinanceiro: respFin?.nome ?? '',
      responsavelPedagogico: respPrincipal?.nome ?? '',
      telefone: mae.celular || pai.celular,
      inadimplente: false,
      risco_evasao: 'baixo' as const,
      media: null,
      frequencia: 100,
      obs: [obs, infoMedica ? `[SAUDE] ${infoMedica}` : ''].filter(Boolean).join('\n'),
      unidade: 'Unidade Centro',
      foto: null,
      _dadosAluno: dadosAluno,
      _responsaveis: [mae, pai, ...(temOutro ? [outro] : [])],
      _matriculas: matriculas,
      _parcelas: parcelas,
    }
    setAlunos((prev: any[]) => [...prev, novoAluno as any])
    
    // Dispara POST para banco de dados oficial (Supabase)
    fetch('/api/alunos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novoAluno)
    }).catch(console.error)

    onClose()
  }

  if (!open) return null

  const stepColor = '#3b82f6'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 2000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}>
      <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 20, width: '100%', maxWidth: 900, border: '1px solid hsl(var(--border-default))', boxShadow: '0 32px 100px rgba(0,0,0,0.6)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '20px 28px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'hsl(var(--bg-elevated))' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Cadastro de Aluno</div>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 2 }}>Passo {step} de {STEPS.length}: {STEPS[step - 1].label}</div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon"><X size={18} /></button>
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', padding: '16px 28px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-elevated))', gap: 6, alignItems: 'center' }}>
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const done = step > s.id
            const active = step === s.id
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'unset' }}>
                <button
                  onClick={() => done ? setStep(s.id) : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: `1px solid ${active ? stepColor : done ? '#10b981' : 'hsl(var(--border-subtle))'}`, background: active ? `${stepColor}15` : done ? 'rgba(16,185,129,0.1)' : 'transparent', color: active ? stepColor : done ? '#10b981' : 'hsl(var(--text-muted))', fontWeight: active || done ? 700 : 400, fontSize: 12, cursor: done ? 'pointer' : 'default', whiteSpace: 'nowrap' }}
                >
                  {done ? <Check size={13} /> : <Icon size={13} />}
                  {s.label}
                </button>
                {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1, background: done ? '#10b981' : 'hsl(var(--border-subtle))', margin: '0 4px' }} />}
              </div>
            )
          })}
        </div>

        {/* Conteúdo */}
        <div style={{ padding: '24px 28px', maxHeight: '60vh', overflowY: 'auto' }}>

          {/* ─── PASSO 1 ─── */}
          {step === 1 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: stepColor }}>Dados Pessoais do Aluno</div>
              <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div><label className="form-label">Codigo</label><input className="form-input" value={dadosAluno.codigo} readOnly style={{ color: '#60a5fa', fontWeight: 700 }} /></div>
                <div><label className="form-label">Nome Completo *</label><input className="form-input" value={dadosAluno.nome} onChange={e => setDadosAluno(p => ({ ...p, nome: e.target.value }))} placeholder="Nome do aluno" /></div>
                <div><label className="form-label">CPF</label><input className="form-input" value={dadosAluno.cpf} onChange={e => setDadosAluno(p => ({ ...p, cpf: e.target.value }))} placeholder="000.000.000-00" /></div>
                <div><label className="form-label">ID Censo</label><input className="form-input" value={dadosAluno.idCenso} onChange={e => setDadosAluno(p => ({ ...p, idCenso: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label className="form-label">RGA (auto)</label>
                  <input className="form-input" value={dadosAluno.rga} readOnly style={{ color: '#10b981', fontWeight: 700, fontSize: 12 }} />
                </div>
                <div>
                  <label className="form-label">Data de Nascimento {idadeAluno && <span style={{ color: '#10b981', fontWeight: 700 }}>({idadeAluno})</span>}</label>
                  <input type="date" className="form-input" value={dadosAluno.dataNasc} onChange={e => setDadosAluno(p => ({ ...p, dataNasc: e.target.value }))} />
                </div>
                <div><label className="form-label">Sexo</label><select className="form-input" value={dadosAluno.sexo} onChange={e => setDadosAluno(p => ({ ...p, sexo: e.target.value }))}><option value="">Selecionar</option>{SEXO_OPTS.map(s => <option key={s}>{s}</option>)}</select></div>
                <div><label className="form-label">Estado Civil</label><select className="form-input" value={dadosAluno.estadoCivil} onChange={e => setDadosAluno(p => ({ ...p, estadoCivil: e.target.value }))}><option value="">Selecionar</option>{ESTADO_CIVIL.map(s => <option key={s}>{s}</option>)}</select></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 1fr', gap: 12, marginBottom: 12 }}>
                <div><label className="form-label">Nacionalidade</label><input className="form-input" value={dadosAluno.nacionalidade} onChange={e => setDadosAluno(p => ({ ...p, nacionalidade: e.target.value }))} /></div>
                <div><label className="form-label">Naturalidade</label><input className="form-input" value={dadosAluno.naturalidade} onChange={e => setDadosAluno(p => ({ ...p, naturalidade: e.target.value }))} /></div>
                <div><label className="form-label">UF</label><select className="form-input" value={dadosAluno.uf} onChange={e => setDadosAluno(p => ({ ...p, uf: e.target.value }))}>{UFS.map(u => <option key={u}>{u}</option>)}</select></div>
                <div><label className="form-label">Cor / Raca</label><select className="form-input" value={dadosAluno.corRaca} onChange={e => setDadosAluno(p => ({ ...p, corRaca: e.target.value }))}><option value="">Selecionar</option>{COR_RACA.map(c => <option key={c}>{c}</option>)}</select></div>
              </div>
              <div><label className="form-label">Outros / Observacoes gerais</label><textarea className="form-input" rows={2} value={dadosAluno.outros} onChange={e => setDadosAluno(p => ({ ...p, outros: e.target.value }))} placeholder="Informacoes adicionais..." /></div>
            </div>
          )}

          {/* ─── PASSO 2 ─── */}
          {step === 2 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: stepColor }}>Responsaveis do Aluno</div>
              <RespForm data={mae} onChange={setMae} label="Mae *" />
              <RespForm data={pai} onChange={setPai} label="Pai *" />
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '12px 16px', border: '1px dashed hsl(var(--border-default))', borderRadius: 10 }}>
                  <input type="checkbox" checked={temOutro} onChange={e => setTemOutro(e.target.checked)} />
                  <span style={{ fontWeight: 600, fontSize: 13 }}>Adicionar outro responsavel</span>
                </label>
              </div>
              {temOutro && <RespForm data={outro} onChange={setOutro} label="Outro Responsavel" />}
            </div>
          )}

          {/* ─── PASSO 3 ─── */}
          {step === 3 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: stepColor }}>Matriculas ({matriculas.length})</div>
                <button className="btn btn-primary btn-sm" onClick={() => { setEditingMat(null); setModalMat(true) }}><Plus size={13} />Inserir Matricula</button>
              </div>
              {matriculas.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', border: '1px dashed hsl(var(--border-subtle))', borderRadius: 12, color: 'hsl(var(--text-muted))' }}>
                  <GraduationCap size={40} style={{ opacity: 0.2, marginBottom: 10 }} />
                  <div>Nenhuma matricula adicionada</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {matriculas.map(m => (
                    <div key={m.id} style={{ padding: '14px 18px', border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, background: 'hsl(var(--bg-elevated))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{m.turmaNome} — {m.serie} ({m.turno})</div>
                        <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4, display: 'flex', gap: 12 }}>
                          <span>Ano: {m.ano}</span>
                          <span>Situacao: {m.situacao}</span>
                          {m.bolsista && <span style={{ color: '#10b981', fontWeight: 700 }}>Bolsista</span>}
                          {m.respFinanceiroNome && <span>Resp. Fin.: {m.respFinanceiroNome}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setEditingMat(m); setModalMat(true) }}><Edit2 size={13} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => setMatriculas(prev => prev.filter(x => x.id !== m.id))}><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <ModalMatricula
                open={modalMat} onClose={() => setModalMat(false)} editing={editingMat}
                onSave={m => setMatriculas(prev => editingMat ? prev.map(x => x.id === m.id ? m : x) : [...prev, m])}
                responsaveis={[mae, pai, ...(temOutro ? [outro] : [])]}
                padroes={cfgPadroesPagamento ?? []} turmas={turmas}
              />
            </div>
          )}

          {/* ─── PASSO 4 ─── */}
          {step === 4 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: stepColor }}>Observacoes e Informacoes de Saude</div>
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Observacoes gerais do aluno</label>
                <textarea className="form-input" rows={4} value={obs} onChange={e => setObs(e.target.value)} placeholder="Observacoes pedagogicas, comportamentais, necessidades especiais..." />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, padding: '12px 16px', border: '1px solid hsl(var(--border-subtle))', borderRadius: 10, background: 'hsl(var(--bg-elevated))' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                  <input type="checkbox" checked={temInfoMedica} onChange={e => setTemInfoMedica(e.target.checked)} />
                  Possui informacoes medicas relevantes?
                </label>
                {temInfoMedica && <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 700 }}>Ativo — preencha abaixo</span>}
              </div>
              {temInfoMedica && (
                <div>
                  <label className="form-label">Informacoes Medicas</label>
                  <textarea className="form-input" rows={5} value={infoMedica} onChange={e => setInfoMedica(e.target.value)} placeholder="Alergias, medicamentos em uso, restricoes alimentares, condicoes de saude, contatos de emergencia medica..." />
                  <div style={{ padding: '10px 14px', marginTop: 8, background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.25)', fontSize: 12, color: '#f87171' }}>
                    Estas informacoes sao sigilosas e de uso exclusivo da equipe escolar autorizada.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── PASSO 5 ─── */}
          {step === 5 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: stepColor }}>Pagamentos e Financeiro</div>

              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Total parcelas', value: parcelas.length, color: '#3b82f6' },
                  { label: 'Em aberto', value: fmtCur(totalAberto), color: '#f59e0b' },
                  { label: 'Pago', value: fmtCur(totalPago), color: '#10b981' },
                  { label: 'Canceladas', value: parcelas.filter(p => p.status === 'cancelado').length, color: '#6b7280' },
                ].map(k => (
                  <div key={k.label} className="kpi-card">
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginBottom: 4 }}>{k.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: k.color }}>{k.value}</div>
                  </div>
                ))}
              </div>

              {/* Info sobre evento vinculado ao padrão */}
              {(() => {
                const mat = matriculas[matriculas.length - 1]
                const padrao = mat?.padraoPagamentoId ? cfgPadroesPagamento?.find(p => p.id === mat.padraoPagamentoId) : null
                const eventoDesc = (padrao as any)?.eventoDescricao
                return eventoDesc ? (
                  <div style={{ padding: '10px 14px', marginBottom: 12, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CalendarDays size={14} color="#818cf8" />
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#818cf8' }}>Evento vinculado ao padrão: </span>
                      <span style={{ fontSize: 12, color: 'hsl(var(--text-secondary))' }}>{eventoDesc}</span>
                      <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginLeft: 8 }}>As parcelas geradas serão automaticamente ligadas a este evento em Contas a Receber.</span>
                    </div>
                  </div>
                ) : null
              })()}

              {/* Controles */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>A partir da parcela:</label>
                  <input type="number" min={1} value={parcelaInicio} onChange={e => setParcelaInicio(+e.target.value)} className="form-input" style={{ width: 70 }} />
                </div>
                <button className="btn btn-primary btn-sm" onClick={gerarParcelas}><RefreshCw size={13} />Gerar Parcelas</button>
                <div style={{ flex: 1 }} />
                <div>
                  <label className="form-label" style={{ fontSize: 10, marginBottom: 2 }}>Obs. Financeira</label>
                  <input className="form-input" style={{ width: 220 }} value={obsFinanceira} onChange={e => setObsFinanceira(e.target.value)} placeholder="Obs para o financeiro..." />
                </div>
              </div>

              {/* Tabela de parcelas */}
              {parcelas.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', border: '1px dashed hsl(var(--border-subtle))', borderRadius: 12, color: 'hsl(var(--text-muted))' }}>
                  <DollarSign size={36} style={{ opacity: 0.2, marginBottom: 8 }} />
                  <div style={{ fontSize: 13 }}>Nenhuma parcela gerada. Selecione um padrao de pagamento na matricula e clique em "Gerar Parcelas".</div>
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 50 }}>#</th>
                        <th>Vencimento</th>
                        <th>Valor</th>
                        <th>Desconto</th>
                        <th>Liquido</th>
                        <th>Evento</th>
                        <th>Status</th>
                        <th>Pgto</th>
                        <th>Acoes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parcelas.map(p => (
                        <tr key={p.id} style={{ opacity: p.status === 'cancelado' ? 0.4 : 1 }}>
                          <td style={{ fontWeight: 800, color: '#60a5fa', fontSize: 13 }}>{p.numero}</td>
                          <td>
                            {editingParcela === p.id
                              ? <input type="date" className="form-input" style={{ padding: '3px 6px', fontSize: 11 }} value={p.vencimento} onChange={e => editarParcela(p.id, 'vencimento', e.target.value)} />
                              : <span style={{ fontSize: 12 }}>{p.vencimento.split('-').reverse().join('/')}</span>
                            }
                          </td>
                          <td>
                            {editingParcela === p.id
                              ? <input type="number" className="form-input" style={{ padding: '3px 6px', fontSize: 11, width: 80 }} value={p.valor} onChange={e => editarParcela(p.id, 'valor', +e.target.value)} />
                              : <span style={{ fontWeight: 700, color: '#34d399' }}>{fmtCur(p.valor)}</span>
                            }
                          </td>
                          <td>
                            {editingParcela === p.id
                              ? <input type="number" className="form-input" style={{ padding: '3px 6px', fontSize: 11, width: 70 }} value={p.desconto} onChange={e => editarParcela(p.id, 'desconto', +e.target.value)} />
                              : <span style={{ fontSize: 12, color: p.desconto > 0 ? '#f59e0b' : 'hsl(var(--text-muted))' }}>{p.desconto > 0 ? <>{fmtCur(p.desconto)}<span style={{fontSize:10,opacity:.7,marginLeft:4}}>({p.valor>0?((p.desconto/p.valor)*100).toFixed(1):0}%)</span></> : '—'}</span>
                            }
                          </td>
                          <td style={{ fontWeight: 700, fontSize: 13, color: '#60a5fa' }}>{fmtCur(p.valor - p.desconto)}</td>
                          <td>
                            {p.eventoDescricao ? (
                              <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: 'rgba(99,102,241,0.1)', color: '#818cf8', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                📅 {p.eventoDescricao}
                              </span>
                            ) : <span style={{ color: 'hsl(var(--text-muted))', fontSize: 11 }}>—</span>}
                          </td>
                          <td>
                            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, fontWeight: 700, background: p.status === 'pago' ? 'rgba(16,185,129,0.15)' : p.status === 'cancelado' ? 'rgba(107,114,128,0.15)' : 'rgba(245,158,11,0.15)', color: p.status === 'pago' ? '#10b981' : p.status === 'cancelado' ? '#6b7280' : '#f59e0b' }}>
                              {p.status === 'pago' ? 'Pago' : p.status === 'cancelado' ? 'Cancelado' : 'Aberto'}
                            </span>
                          </td>
                          <td style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                            {p.dataPagamento ? p.dataPagamento.split('-').reverse().join('/') : '—'}
                            {p.metodoPagamento && <div style={{ fontSize: 10, color: '#60a5fa' }}>{p.metodoPagamento}</div>}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 3 }}>
                              {p.status === 'aberto' && (
                                <>
                                  <button title="Baixar" className="btn btn-success btn-sm" style={{ fontSize: 10, padding: '2px 7px' }}
                                    onClick={() => {
                                      const m = prompt('Metodo de pagamento:\n' + METODOS_PAGAMENTO.join(', '), 'PIX')
                                      if (m) baixarParcela(p.id, m)
                                    }}>Baixar</button>
                                  <button title="Editar" className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditingParcela(editingParcela === p.id ? null : p.id)}><Edit2 size={11} /></button>
                                  <button title="Cancelar parcela" className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => cancelarParcela(p.id)}><Trash2 size={11} /></button>
                                </>
                              )}
                              {editingParcela === p.id && (
                                <button className="btn btn-primary btn-sm" style={{ fontSize: 10, padding: '2px 7px' }} onClick={() => setEditingParcela(null)}><Check size={11} /></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Historico */}
              {parcelas.some(p => p.historico.length > 0) && (
                <div style={{ marginTop: 16, padding: '14px', background: 'hsl(var(--bg-elevated))', borderRadius: 10, border: '1px solid hsl(var(--border-subtle))' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Historico de Lancamentos</div>
                  {parcelas.flatMap(p => p.historico.map(h => ({ parcela: p.numero, texto: h }))).map((h, i) => (
                    <div key={i} style={{ fontSize: 11, color: 'hsl(var(--text-secondary))', padding: '4px 0', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                      <span style={{ color: '#60a5fa', fontWeight: 700 }}>Parcela {h.parcela}:</span> {h.texto}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'hsl(var(--bg-elevated))' }}>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
            {dadosAluno.nome && <span style={{ fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Aluno: {dadosAluno.nome}</span>}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            {step > 1 && (
              <button className="btn btn-secondary" onClick={() => setStep(p => p - 1)}>
                <ChevronLeft size={14} />Anterior
              </button>
            )}
            {step < STEPS.length ? (
              <button className="btn btn-primary" onClick={() => canNext() && setStep(p => p + 1)} style={{ opacity: canNext() ? 1 : 0.5 }}>
                Proximo<ChevronRight size={14} />
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handleFinalizar} style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                <Check size={14} />Finalizar Cadastro
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
