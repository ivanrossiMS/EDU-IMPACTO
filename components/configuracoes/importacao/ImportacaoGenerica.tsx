'use client'
import { useState } from 'react'
import { Download, Play, RotateCcw, AlertTriangle, Check, ChevronDown, ChevronUp, FileText } from 'lucide-react'
import { FileDropzone } from './FileDropzone'
import { ColumnMapper } from './ColumnMapper'
import { autoMap, downloadXlsxTemplate, downloadText, type ParsedRow, type ImportLog } from './useImportacao'

/* ─── Field definitions per module (aligned to real Supabase schema) ────── */

const TURMA_FIELDS = [
  { key: 'codigo',       label: 'Código da Turma',      required: false, aliases: ['codigo','cod','codturma','id'] },
  { key: 'nome',         label: 'Nome da Turma',         required: true,  aliases: ['nome','nometurma','turma','class'] },
  { key: 'serie',        label: 'Série/Ano Escolar',     required: false, aliases: ['serie','ano','anoescolar','etapa'] },
  { key: 'turno',        label: 'Turno',                 required: false, aliases: ['turno','periodo','shift','turno'] },
  { key: 'sala',         label: 'Sala',                  required: false, aliases: ['sala','local','room'] },
  { key: 'capacidade',   label: 'Capacidade (vagas)',     required: false, aliases: ['capacidade','vagas','cap'] },
  { key: 'professor',    label: 'Professor Regente',      required: false, aliases: ['professor','regente','docente'] },
  { key: 'unidade',      label: 'Unidade/Escola',        required: false, aliases: ['unidade','escola','unit'] },
  { key: 'anoLetivo',    label: 'Ano Letivo',            required: false, aliases: ['anoletivo','ano','letivo'] },
  { key: 'status',       label: 'Situação',              required: false, aliases: ['status','situacao','ativa'] },
  { key: 'dataMatricula',label: 'Data da Matrícula',     required: false, aliases: ['datamatricula','dtmatricula'] },
  { key: 'dataResultado',label: 'Data do Resultado',     required: false, aliases: ['dataresultado','dtresultado'] },
]

const RESP_FIELDS = [
  { key: 'nome',         label: 'Nome Completo',         required: true,  aliases: ['nome','nomeresponsavel','responsavel'] },
  { key: 'cpf',          label: 'CPF',                   required: false, aliases: ['cpf','documento'] },
  { key: 'rg',           label: 'RG',                    required: false, aliases: ['rg','identidade'] },
  { key: 'orgEmissor',   label: 'Órgão Emissor',         required: false, aliases: ['orgEmissor','emissor','orgaoemissor'] },
  { key: 'sexo',         label: 'Sexo',                  required: false, aliases: ['sexo','genero'] },
  { key: 'dataNasc',     label: 'Data de Nascimento',    required: false, aliases: ['datanasc','nascimento','dtnascimento'] },
  { key: 'email',        label: 'E-mail',                required: false, aliases: ['email','mail'] },
  { key: 'telefone',     label: 'Telefone',              required: false, aliases: ['telefone','fone','tel'] },
  { key: 'celular',      label: 'Celular',               required: false, aliases: ['celular','cell','mobile'] },
  { key: 'profissao',    label: 'Profissão',             required: false, aliases: ['profissao','ocupacao','profissão'] },
  { key: 'rfid',         label: 'RFID',                  required: false, aliases: ['rfid','tag','card'] },
  { key: 'codigoAluno',  label: 'Código do Aluno (vínculo)', required: false, aliases: ['codigoaluno','aluno','codaluno','matricula'] },
  { key: 'parentesco',   label: 'Parentesco',            required: false, aliases: ['parentesco','relacao','tipo'] },
  { key: 'respFinanceiro',label: 'Resp. Financeiro (Sim/Não)', required: false, aliases: ['financeiro','respfin','respFinanceiro'] },
  { key: 'respPedagogico',label: 'Resp. Pedagógico (Sim/Não)', required: false, aliases: ['pedagogico','respPed','respPedagogico'] },
  { key: 'naturalidade', label: 'Naturalidade',          required: false, aliases: ['naturalidade'] },
  { key: 'uf',           label: 'UF Naturalidade',       required: false, aliases: ['uf'] },
  { key: 'estadoCivil',  label: 'Estado Civil',          required: false, aliases: ['estadocivil','civil'] },
  { key: 'endereco',     label: 'Endereço',              required: false, aliases: ['endereco','logradouro','rua'] },
  { key: 'numero',       label: 'Número',                required: false, aliases: ['numero','nro','num'] },
  { key: 'bairro',       label: 'Bairro',                required: false, aliases: ['bairro'] },
  { key: 'cidade',       label: 'Cidade',                required: false, aliases: ['cidade','municipio'] },
  { key: 'estado',       label: 'Estado/UF',             required: false, aliases: ['estado'] },
  { key: 'cep',          label: 'CEP',                   required: false, aliases: ['cep'] },
  { key: 'obs',          label: 'Observações',           required: false, aliases: ['obs','observacao'] },
]

const FUNC_FIELDS = [
  { key: 'nome',          label: 'Nome Completo',        required: true,  aliases: ['nome','nomefuncionario','funcionario'] },
  { key: 'cargo',         label: 'Cargo',                required: false, aliases: ['cargo','funcao','funcão','position'] },
  { key: 'departamento',  label: 'Departamento/Setor',   required: false, aliases: ['departamento','setor','dept'] },
  { key: 'salario',       label: 'Salário',              required: false, aliases: ['salario','remuneracao','salário'] },
  { key: 'status',        label: 'Situação',             required: false, aliases: ['status','situacao'] },
  { key: 'email',         label: 'E-mail',               required: false, aliases: ['email','mail'] },
  { key: 'admissao',      label: 'Data de Admissão',     required: false, aliases: ['admissao','dataadmissao','dtadmissao'] },
  { key: 'cpf',           label: 'CPF',                  required: false, aliases: ['cpf','documento'] },
  { key: 'rg',            label: 'RG',                   required: false, aliases: ['rg','identidade'] },
  { key: 'pis',           label: 'PIS/NIS',              required: false, aliases: ['pis','nis'] },
  { key: 'ctps',          label: 'CTPS',                 required: false, aliases: ['ctps','carteira'] },
  { key: 'tipoContrato',  label: 'Tipo de Contrato',     required: false, aliases: ['tipocontrato','contrato'] },
  { key: 'cargaHoraria',  label: 'Carga Horária',        required: false, aliases: ['cargahoraria','horas','carga'] },
  { key: 'banco',         label: 'Banco',                required: false, aliases: ['banco'] },
  { key: 'agencia',       label: 'Agência',              required: false, aliases: ['agencia','agência'] },
  { key: 'conta',         label: 'Conta Bancária',       required: false, aliases: ['conta','contabancaria'] },
  { key: 'unidade',       label: 'Unidade',              required: false, aliases: ['unidade','escola'] },
  { key: 'endereco',      label: 'Endereço',             required: false, aliases: ['endereco','logradouro'] },
  { key: 'cidade',        label: 'Cidade',               required: false, aliases: ['cidade'] },
  { key: 'estado',        label: 'Estado/UF',            required: false, aliases: ['estado','uf'] },
  { key: 'cep',           label: 'CEP',                  required: false, aliases: ['cep'] },
  { key: 'obs',           label: 'Observações',          required: false, aliases: ['obs','observacao'] },
]

const CPAGAR_FIELDS = [
  { key: 'descricao',      label: 'Descrição',           required: true,  aliases: ['descricao','titulo','lancamento'] },
  { key: 'categoria',      label: 'Categoria',           required: false, aliases: ['categoria','tipo','class'] },
  { key: 'valor',          label: 'Valor',               required: true,  aliases: ['valor','valororiginal','total'] },
  { key: 'vencimento',     label: 'Vencimento',          required: true,  aliases: ['vencimento','dtvencimento','vence'] },
  { key: 'status',         label: 'Status',              required: false, aliases: ['status','situacao'] },
  { key: 'fornecedor',     label: 'Fornecedor',          required: false, aliases: ['fornecedor','prestador','vendor'] },
  { key: 'numeroDocumento',label: 'Nº Documento/NF',     required: false, aliases: ['numerodocumento','nfdocumento','nota','nf'] },
  { key: 'dataPagamento',  label: 'Data Pagamento',      required: false, aliases: ['datapagamento','dtpagamento','pago'] },
  { key: 'formaPagamento', label: 'Forma Pagamento',     required: false, aliases: ['formapagamento','metodo','meio'] },
  { key: 'centroCusto',    label: 'Centro de Custo',     required: false, aliases: ['centrocusto','centro','custo'] },
  { key: 'obs',            label: 'Observação',          required: false, aliases: ['obs','observacao','nota'] },
]

const TITULOS_FIELDS = [
  { key: 'codigoAluno',   label: 'Código do Aluno',      required: true,  aliases: ['codigoaluno','aluno','codaluno','matricula'] },
  { key: 'nomeAluno',     label: 'Nome do Aluno',        required: false, aliases: ['nomealuno','aluno','nome'] },
  { key: 'descricao',     label: 'Descrição/Evento',     required: true,  aliases: ['descricao','evento','lancamento'] },
  { key: 'valor',         label: 'Valor Original',       required: true,  aliases: ['valor','valororiginal','valorbruto'] },
  { key: 'vencimento',    label: 'Vencimento',           required: true,  aliases: ['vencimento','dtvencimento','vence'] },
  { key: 'parcela',       label: 'Parcela (ex: 1/12)',   required: false, aliases: ['parcela','num','numeroparcela'] },
  { key: 'status',        label: 'Status',               required: false, aliases: ['status','situacao'] },
  { key: 'pagamento',     label: 'Data Pagamento',       required: false, aliases: ['pagamento','dtpagamento','pago'] },
  { key: 'valorPago',     label: 'Valor Pago',           required: false, aliases: ['valorpago','recebido','vlpago'] },
  { key: 'desconto',      label: 'Desconto',             required: false, aliases: ['desconto','bolsa'] },
  { key: 'juros',         label: 'Juros',                required: false, aliases: ['juros'] },
  { key: 'multa',         label: 'Multa',                required: false, aliases: ['multa'] },
  { key: 'formaPagamento',label: 'Forma Pagamento',      required: false, aliases: ['formapagamento','metodo','meio'] },
  { key: 'obs',           label: 'Observação',           required: false, aliases: ['obs','observacao','nota'] },
]

/* ─── Module config ──────────────────────────────────────────────────────── */

export type ImportMod = 'turmas' | 'responsaveis' | 'funcionarios' | 'contas_pagar' | 'titulos'

interface ModConfig {
  label: string
  icon: string
  desc: string
  fields: typeof TURMA_FIELDS
  requiredKeys: string[]
  color: string
}

const MOD_CONFIG: Record<ImportMod, ModConfig> = {
  turmas: {
    label: 'Turmas', icon: '📚', color: '#10b981',
    desc: 'Turmas e salas de aula com ano letivo, série e turno',
    fields: TURMA_FIELDS,
    requiredKeys: ['nome'],
  },
  responsaveis: {
    label: 'Responsáveis', icon: '👨‍👩‍👧', color: '#f59e0b',
    desc: 'Responsáveis financeiros e pedagógicos, vinculados aos alunos pelo código',
    fields: RESP_FIELDS,
    requiredKeys: ['nome'],
  },
  funcionarios: {
    label: 'Funcionários', icon: '👤', color: '#8b5cf6',
    desc: 'Funcionários e professores com dados de contrato e RH',
    fields: FUNC_FIELDS,
    requiredKeys: ['nome'],
  },
  contas_pagar: {
    label: 'Contas a Pagar', icon: '💳', color: '#ef4444',
    desc: 'Lançamentos de contas a pagar com fornecedor, valor e vencimento',
    fields: CPAGAR_FIELDS,
    requiredKeys: ['descricao', 'valor', 'vencimento'],
  },
  titulos: {
    label: 'Financeiro (Títulos)', icon: '💰', color: '#f59e0b',
    desc: 'Títulos e parcelas financeiras vinculadas ao aluno pelo código do sistema',
    fields: TITULOS_FIELDS,
    requiredKeys: ['codigoAluno', 'valor'],
  },
}

/* ─── Types ──────────────────────────────────────────────────────────────── */

type Step = 'file' | 'map' | 'import' | 'result'

interface ValidationRow {
  linha: number
  valida: boolean
  dados: ParsedRow
  mapped: Record<string, string>
  erros: string[]
  avisos: string[]
}

interface ImportResult {
  total: number; inseridos: number; atualizados: number; erros: number
  erroDetails?: { linha: number; msg: string }[]
}

interface Props {
  modulo: ImportMod
  alunos?: any[]
  setTurmas?: (fn: (p: any[]) => any[]) => void
  setResponsaveis?: (fn: (p: any[]) => any[]) => void
  setTitulos?: (fn: (p: any[]) => any[]) => void
  onLog: (log: ImportLog) => void
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function ImportacaoGenerica({ modulo, onLog }: Props) {
  const cfg = MOD_CONFIG[modulo]
  const { fields, requiredKeys, color, label } = cfg

  const [step, setStep] = useState<Step>('file')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [filename, setFilename] = useState('')
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [validation, setValidation] = useState<ValidationRow[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [simOnly, setSimOnly] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showErrors, setShowErrors] = useState(true)

  const headers = rows.length ? Object.keys(rows[0]) : []
  const valid = validation.filter(v => v.valida)
  const invalid = validation.filter(v => !v.valida)

  /* Step 1 → 2 */
  const handleFile = (r: ParsedRow[], fname: string) => {
    setRows(r); setFilename(fname)
    if (r.length > 0) setMapping(autoMap(Object.keys(r[0]), fields))
  }

  /* Step 2 → 3 */
  const handleMap = (m: Record<string, string>) => {
    setMapping(m)
    const results: ValidationRow[] = rows.map((raw, i) => {
      const mapped: Record<string, string> = {}
      Object.entries(m).forEach(([h, k]) => { mapped[k] = raw[h] ?? '' })
      const erros: string[] = []
      const avisos: string[] = []
      // Check required
      for (const req of requiredKeys) {
        if (!mapped[req]?.trim()) erros.push(`Campo obrigatório ausente: ${fields.find(f => f.key === req)?.label || req}`)
      }
      return { linha: i + 2, valida: erros.length === 0, dados: raw, mapped, erros, avisos }
    })
    setValidation(results)
    setStep('import')
  }

  /* Step 3 → resultado: chama API */
  const handleImport = async () => {
    if (simOnly) {
      setResult({ total: rows.length, inseridos: valid.length, atualizados: 0, erros: invalid.length })
      setStep('result')
      onLog({ id: Date.now().toString(), dataHora: new Date().toISOString(), modulo: label, arquivo: filename, total: rows.length, inseridos: valid.length, atualizados: 0, erros: invalid.length, ignorados: 0, status: invalid.length === 0 ? 'sucesso' : valid.length > 0 ? 'parcial' : 'erro', usuario: 'Admin' })
      return
    }

    setLoading(true)
    try {
      const mapped = valid.map(v => v.mapped)
      const res = await fetch('/api/importacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modulo, rows: mapped }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro na importação')

      const r: ImportResult = {
        total: rows.length,
        inseridos: data.inseridos || 0,
        atualizados: data.atualizados || 0,
        erros: data.erros + invalid.length,
        erroDetails: data.erroDetails || [],
      }
      setResult(r)
      setStep('result')
      onLog({
        id: Date.now().toString(), dataHora: new Date().toISOString(), modulo: label,
        arquivo: filename, total: rows.length, inseridos: r.inseridos, atualizados: r.atualizados,
        erros: r.erros, ignorados: 0,
        status: r.erros === 0 ? 'sucesso' : r.inseridos + r.atualizados > 0 ? 'parcial' : 'erro',
        usuario: 'Admin',
      })
    } catch (e: any) {
      setResult({ total: rows.length, inseridos: 0, atualizados: 0, erros: rows.length, erroDetails: [{ linha: 0, msg: e.message }] })
      setStep('result')
    } finally { setLoading(false) }
  }

  const modelCols = fields.map(f => f.label)
  const modelKeys = fields.map(f => f.key)
  const stepFlow: Step[] = ['file', 'map', 'import', 'result']
  const stepLabels = ['1. Arquivo', '2. Mapeamento', '3. Validar', '4. Resultado']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Stepper */}
      <div style={{ display: 'flex', gap: 0, borderRadius: 12, overflow: 'hidden', border: '1px solid hsl(var(--border-subtle))' }}>
        {stepFlow.map((s, i) => {
          const active = s === step
          const passed = stepFlow.indexOf(step) > i
          return (
            <div key={s} style={{
              flex: 1, padding: '10px 8px', fontSize: 12, fontWeight: 700, textAlign: 'center',
              background: active ? color : passed ? `${color}20` : 'hsl(var(--bg-elevated))',
              color: active ? '#fff' : passed ? color : 'hsl(var(--text-muted))',
              borderRight: i < 3 ? '1px solid hsl(var(--border-subtle))' : 'none',
              cursor: passed ? 'pointer' : 'default', transition: 'all .15s'
            }} onClick={() => passed && setStep(s)}>
              {passed && !active ? '✓ ' : ''}{stepLabels[i]}
            </div>
          )
        })}
      </div>

      {/* Dica de ordem */}
      <div style={{ background: `${color}0d`, border: `1px solid ${color}25`, borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'hsl(var(--text-base))' }}>
        <strong>{cfg.icon} {cfg.label}:</strong> {cfg.desc}
      </div>

      {/* Step: File */}
      {step === 'file' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => downloadXlsxTemplate(modelCols, `modelo-${modulo}.xlsx`)}>
              <Download size={13} /> Baixar Modelo XLSX
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => {
              // CSV com linha de exemplo
              const EXAMPLES: Record<string, string[]> = {
                turmas: ['T001','3º Ano A','3º Ano','Manhã','Sala 5','30','Prof. Carlos','Unidade Centro','2026','ativa','',''],
                responsaveis: ['Maria Silva','123.456.789-00','','','F','15/03/1980','maria@email.com','(11)99999-9999','','Engenheira','','001','Mãe','Sim','Não',''],
                funcionarios: ['João Costa','Professor','Pedagógico','4500,00','ativo','joao@escola.com','01/03/2022','','','','','CLT','40h','','','','Unidade Centro'],
                contas_pagar: ['Aluguel Imóvel','Administrativo','3500,00','05/05/2026','pendente','Imobiliária Central','','','','Geral',''],
                titulos: ['001','Ana Costa','Mensalidade','980,00','10/05/2026','1/12','pendente','','','','','','PIX',''],
              }
              const ex = EXAMPLES[modulo] || modelKeys.map(() => '')
              const csv = modelKeys.join(';') + '\n' + ex.join(';')
              downloadText(csv, `modelo-${modulo}.csv`)
            }}>
              <Download size={13} /> Baixar Modelo CSV
            </button>
          </div>

          {/* Column reference */}
          <details style={{ background: 'hsl(var(--bg-elevated))', borderRadius: 10, padding: '10px 14px', border: '1px solid hsl(var(--border-subtle))' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 12, userSelect: 'none' }}>
              📋 Ver todas as colunas do modelo ({fields.length} campos)
            </summary>
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {fields.map(f => (
                <span key={f.key} style={{
                  fontSize: 11, padding: '3px 8px', borderRadius: 6,
                  background: f.required ? `${color}20` : 'hsl(var(--bg-overlay))',
                  color: f.required ? color : 'hsl(var(--text-muted))',
                  fontWeight: f.required ? 700 : 400,
                  border: `1px solid ${f.required ? color + '40' : 'transparent'}`,
                }}>
                  {f.required ? '* ' : ''}{f.label}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 8 }}>
              * Campos obrigatórios em destaque
            </div>
          </details>

          <FileDropzone onData={handleFile} />
          {rows.length > 0 && (
            <button className="btn btn-primary" style={{ background: color, borderColor: color }} onClick={() => setStep('map')}>
              Prosseguir para Mapeamento → ({rows.length} linhas)
            </button>
          )}
        </div>
      )}

      {/* Step: Map */}
      {step === 'map' && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>🔗 Mapeamento de Colunas — {label}</div>
          <ColumnMapper headers={headers} fields={fields} onSave={handleMap} initialMapping={mapping} />
        </div>
      )}

      {/* Step: Import (validateion + confirm) */}
      {step === 'import' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {[
              { label: 'Total', val: validation.length, c: '#6366f1' },
              { label: 'Válidos', val: valid.length, c: '#10b981' },
              { label: 'Inválidos', val: invalid.length, c: '#ef4444' },
            ].map(s => (
              <div key={s.label} style={{ background: 'hsl(var(--bg-surface))', border: `1px solid ${s.c}30`, borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: s.c, fontFamily: 'Outfit' }}>{s.val}</div>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Errors list */}
          {invalid.length > 0 && (
            <div style={{ border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, overflow: 'hidden' }}>
              <div
                onClick={() => setShowErrors(p => !p)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(239,68,68,0.06)', cursor: 'pointer', borderBottom: showErrors ? '1px solid rgba(239,68,68,0.15)' : 'none' }}>
                <AlertTriangle size={14} color="#ef4444" />
                <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{invalid.length} linha(s) com erro serão ignoradas</span>
                {showErrors ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
              {showErrors && (
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'hsl(var(--bg-overlay))' }}>
                        {['Linha', 'Registro', 'Problema'].map(h => <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 700, color: 'hsl(var(--text-muted))' }}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {invalid.map(v => (
                        <tr key={v.linha} style={{ borderTop: '1px solid hsl(var(--border-subtle))' }}>
                          <td style={{ padding: '6px 12px', fontFamily: 'monospace' }}>{v.linha}</td>
                          <td style={{ padding: '6px 12px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{Object.values(v.dados)[1] || '—'}</td>
                          <td style={{ padding: '6px 12px', color: '#ef4444', fontSize: 11 }}>{v.erros.join('; ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {invalid.length > 0 && (
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => {
              const csv = 'linha;registro;erros\n' + invalid.map(v => `${v.linha};${Object.values(v.dados)[0]};${v.erros.join(' | ')}`).join('\n')
              downloadText(csv, 'erros-validacao.csv')
            }}>
              <Download size={13} /> Baixar relatório de erros
            </button>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '10px 14px', background: 'hsl(var(--bg-elevated))', borderRadius: 8 }}>
            <input type="checkbox" checked={simOnly} onChange={e => setSimOnly(e.target.checked)} />
            <span><strong>Modo simulação</strong> — não grava dados no sistema</span>
          </label>

          <button
            className="btn btn-primary"
            style={{ background: color, borderColor: color }}
            onClick={handleImport}
            disabled={valid.length === 0 || loading}
          >
            {loading ? '⏳ Importando...' : <><Play size={14} /> {simOnly ? 'Simular' : 'Importar'} {valid.length} registro(s) válido(s)</>}
          </button>
        </div>
      )}

      {/* Step: Result */}
      {step === 'result' && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{
            background: simOnly ? 'rgba(99,102,241,0.08)' : result.erros === 0 ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
            border: `1px solid ${simOnly ? 'rgba(99,102,241,0.2)' : result.erros === 0 ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
            borderRadius: 14, padding: '20px 24px'
          }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 14 }}>
              {simOnly ? '🧪 Simulação concluída' : result.erros === 0 ? '✅ Importação concluída com sucesso' : '⚠️ Importação concluída com erros'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              {[
                { label: 'Total', val: result.total, c: '#6366f1' },
                { label: 'Inseridos', val: result.inseridos, c: '#10b981' },
                { label: 'Atualizados', val: result.atualizados, c: '#3b82f6' },
                { label: 'Erros', val: result.erros, c: '#ef4444' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: s.c, fontFamily: 'Outfit' }}>{s.val}</div>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Error details from API */}
          {result.erroDetails && result.erroDetails.length > 0 && (
            <div style={{ border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '8px 14px', background: 'rgba(239,68,68,0.06)', fontWeight: 700, fontSize: 12, color: '#ef4444' }}>
                ✗ Erros na importação
              </div>
              {result.erroDetails.map((e, i) => (
                <div key={i} style={{ padding: '6px 14px', fontSize: 12, borderTop: '1px solid hsl(var(--border-subtle))' }}>
                  <span style={{ fontFamily: 'monospace', marginRight: 8 }}>Linha {e.linha}:</span>{e.msg}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => { setStep('file'); setRows([]); setResult(null); setValidation([]) }}>
              Nova Importação
            </button>
            {!simOnly && result.inseridos + result.atualizados > 0 && (
              <span style={{ fontSize: 12, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Check size={14} /> Dados salvos no Supabase com sucesso
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
