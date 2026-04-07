'use client'
import { useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Download, Play, RotateCcw } from 'lucide-react'
import { FileDropzone } from './FileDropzone'
import { ColumnMapper } from './ColumnMapper'
import { autoMap, validateCPF, normalizeDate, snapshot, rollback, downloadText, downloadXlsxTemplate, buildModel, type ParsedRow, type ImportLog } from './useImportacao'

/* ─── FIELD DEFINITIONS ────────────────────────────────────────── */
const ALUNO_FIELDS = [
  { key: 'codigo',         label: 'Código do Sistema', required: true,  aliases: ['codigo','cod','codaluno','codsistema'] },
  { key: 'nome',           label: 'Nome Completo',      required: true,  aliases: ['nome','nomecompleto','aluno'] },
  { key: 'nomeSocial',     label: 'Nome Social',        required: false, aliases: ['nomesocial','social'] },
  { key: 'sexo',           label: 'Sexo',               required: false, aliases: ['sexo','genero','gender'] },
  { key: 'dataNasc',       label: 'Data de Nascimento', required: false, aliases: ['nascimento','datanasc','dtnascimento','dtnac'] },
  { key: 'cpf',            label: 'CPF',                required: false, aliases: ['cpf','documento'] },
  { key: 'rg',             label: 'RG',                 required: false, aliases: ['rg','identidade'] },
  { key: 'nis',            label: 'NIS/PIS',            required: false, aliases: ['nis','pis'] },
  { key: 'email',          label: 'E-mail',             required: false, aliases: ['email','emailaluno','mail'] },
  { key: 'telefone',       label: 'Telefone/Celular',   required: false, aliases: ['telefone','celular','fone','tel'] },
  { key: 'endereco',       label: 'Endereço',           required: false, aliases: ['endereco','logradouro','rua'] },
  { key: 'numero',         label: 'Número',             required: false, aliases: ['numero','nro','num'] },
  { key: 'bairro',         label: 'Bairro',             required: false, aliases: ['bairro'] },
  { key: 'cidade',         label: 'Cidade',             required: false, aliases: ['cidade','municipio'] },
  { key: 'estado',         label: 'Estado/UF',          required: false, aliases: ['estado','uf','estado'] },
  { key: 'cep',            label: 'CEP',                required: false, aliases: ['cep'] },
  { key: 'serie',          label: 'Série/Ano',          required: false, aliases: ['serie','ano','anoescolar','turma','class'] },
  { key: 'turma',          label: 'Turma',              required: false, aliases: ['turma','nomeTurma','class'] },
  { key: 'turno',          label: 'Turno',              required: false, aliases: ['turno','periodo','shift'] },
  { key: 'situacao',       label: 'Situação',           required: false, aliases: ['situacao','status','situacaoaluno'] },
  { key: 'racaCor',        label: 'Raça/Cor',           required: false, aliases: ['racaCor','raca','cor'] },
  { key: 'nacionalidade',  label: 'Nacionalidade',      required: false, aliases: ['nacionalidade'] },
  { key: 'naturalidade',   label: 'Naturalidade',       required: false, aliases: ['naturalidade'] },
  { key: 'filiacaoMae',    label: 'Nome da Mãe',        required: false, aliases: ['mae','nomemae','maternidade','filiacao'] },
  { key: 'filiacaoPai',    label: 'Nome do Pai',        required: false, aliases: ['pai','nomepai','paternidade'] },
  { key: 'obs',            label: 'Observações',        required: false, aliases: ['obs','observacao','nota'] },
  { key: 'saude_autorizaSaida', label: 'Saída Independente (Sim/Não)', required: false, aliases: ['saidasozinho','autorizasaida','saida'] },
  { key: 'saude_autorizado_nome', label: 'Autorizado (Nome)', required: false, aliases: ['autorizadonome','nomeautorizado'] },
  { key: 'saude_autorizado_telefone', label: 'Autorizado (Telefone)', required: false, aliases: ['autorizadotelefone','telautorizado'] },
  { key: 'saude_autorizado_parentesco', label: 'Autorizado (Parentesco)', required: false, aliases: ['autorizadoparentesco','parentescoautorizado'] },
  { key: 'saude_autorizado_liberado', label: 'Autorizado Liberado (Sim/Não)', required: false, aliases: ['autorizadoliberado','liberado'] },
  { key: 'saude_autorizado_dias', label: 'Autorizado Dias (ex: Seg, Ter)', required: false, aliases: ['autorizadodias','dias'] },
  { key: 'saude_autorizado_rfid', label: 'Autorizado RFID', required: false, aliases: ['autorizadorfid','rfid'] },
]

const SNAP_KEY = 'edu-data-alunos'

const MODEL_COLS = ALUNO_FIELDS.map(f => f.label)

type Step = 'file' | 'map' | 'validate' | 'result'
type DupAction = 'ignorar' | 'atualizar'

interface ValidationRow { linha: number; valida: boolean; dados: ParsedRow; mapped: Record<string,string>; erros: string[]; avisos: string[]; dup?: boolean }

interface Props {
  alunos: any[]
  setAlunos: (fn: (prev: any[]) => any[]) => void
  onLog: (log: ImportLog) => void
}

export function ImportacaoAlunos({ alunos, setAlunos, onLog }: Props) {
  const [step, setStep] = useState<Step>('file')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [filename, setFilename] = useState('')
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [validation, setValidation] = useState<ValidationRow[]>([])
  const [dupAction, setDupAction] = useState<DupAction>('ignorar')
  const [snapKey, setSnapKey] = useState<string | null>(null)
  const [result, setResult] = useState<{ inseridos: number; atualizados: number; erros: number; ignorados: number } | null>(null)
  const [simOnly, setSimOnly] = useState(false)

  const headers = rows.length ? Object.keys(rows[0]) : []

  /* Step 1 → 2 */
  const handleFile = (r: ParsedRow[], fname: string) => {
    setRows(r); setFilename(fname)
    if (r.length > 0) {
      const auto = autoMap(Object.keys(r[0]), ALUNO_FIELDS)
      setMapping(auto)
    }
  }

  /* Step 2 → 3 */
  const handleMap = (m: Record<string, string>) => {
    setMapping(m)
    const invertedM = Object.fromEntries(Object.entries(m).map(([h, k]) => [k, h]))
    const results: ValidationRow[] = rows.map((raw, i) => {
      const mapped: Record<string, string> = {}
      Object.entries(m).forEach(([h, k]) => { mapped[k] = raw[h] ?? '' })
      const erros: string[] = []
      const avisos: string[] = []
      if (!mapped.codigo?.trim() && !mapped.nome?.trim()) erros.push('Código e Nome ausentes')
      else if (!mapped.codigo?.trim()) erros.push('Código do sistema ausente')
      if (mapped.cpf && !validateCPF(mapped.cpf)) erros.push('CPF inválido')
      if (mapped.dataNasc && !mapped.dataNasc.match(/\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{4}[\/\-]\d{2}[\/\-]\d{2}/))
        avisos.push('Data de nascimento pode estar em formato inesperado')
      const dup = alunos.some(a =>
        (a.codigo && mapped.codigo && a.codigo === mapped.codigo) ||
        (a.cpf && mapped.cpf && a.cpf === mapped.cpf)
      )
      if (dup) avisos.push('Registro já existe no sistema')
      return { linha: i + 2, valida: erros.length === 0, dados: raw, mapped, erros, avisos, dup }
    })
    setValidation(results)
    setStep('validate')
  }

  /* Import */
  const handleImport = () => {
    const snap = snapshot(SNAP_KEY)
    setSnapKey(snap)
    let inseridos = 0, atualizados = 0, erros = 0, ignorados = 0
    const validas = validation.filter(v => v.valida)

    if (!simOnly) {
      setAlunos((prev: any[]) => {
        let next = [...prev]
        for (const v of validas) {
          const m = v.mapped
          const existing = next.find(a =>
            (a.codigo && m.codigo && a.codigo === m.codigo) ||
            (a.cpf && m.cpf && a.cpf === m.cpf)
          )
          if (existing) {
            if (dupAction === 'atualizar') {
              next = next.map(a => a.id === existing.id ? {
                ...a, ...mapToAluno(m), fotoNome: a.fotoNome
              } : a)
              atualizados++
            } else { ignorados++; continue }
          } else {
            next.push({ id: `IMP${Date.now()}_${inseridos}`, ...mapToAluno(m) })
            inseridos++
          }
        }
        return next
      })
    }

    erros = validation.filter(v => !v.valida).length
    onLog({
      id: Date.now().toString(), dataHora: new Date().toISOString(), modulo: 'Alunos',
      arquivo: filename, total: rows.length, inseridos, atualizados, erros, ignorados,
      status: erros === 0 ? 'sucesso' : inseridos + atualizados > 0 ? 'parcial' : 'erro',
      usuario: 'Admin', snapshot: snap,
    })
    setResult({ inseridos, atualizados, erros, ignorados })
    setStep('result')
  }

  const handleRollback = () => {
    if (!snapKey) return
    rollback(SNAP_KEY, snapKey)
    window.location.reload()
  }

  const valid = validation.filter(v => v.valida)
  const invalid = validation.filter(v => !v.valida)
  const dups = validation.filter(v => v.dup)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 0, borderRadius: 12, overflow: 'hidden', border: '1px solid hsl(var(--border-subtle))' }}>
        {(['file','map','validate','result'] as Step[]).map((s, i) => {
          const labels = ['1. Arquivo','2. Mapeamento','3. Validação','4. Resultado']
          const active = s === step
          const passed = ['file','map','validate','result'].indexOf(step) > i
          return (
            <div key={s} style={{ flex: 1, padding: '10px 14px', fontSize: 12, fontWeight: 700, textAlign: 'center',
              background: active ? '#6366f1' : passed ? 'rgba(99,102,241,0.12)' : 'hsl(var(--bg-elevated))',
              color: active ? '#fff' : passed ? '#818cf8' : 'hsl(var(--text-muted))',
              borderRight: i < 3 ? '1px solid hsl(var(--border-subtle))' : 'none',
              cursor: passed ? 'pointer' : 'default',
            }} onClick={() => passed && setStep(s)}>
              {passed && !active ? '✓ ' : ''}{labels[i]}
            </div>
          )
        })}
      </div>

      {/* Step: File */}
      {step === 'file' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => downloadXlsxTemplate(MODEL_COLS, 'modelo-alunos.xlsx')}>
              <Download size={13} /> Baixar Modelo XLSX
            </button>
          </div>
          <FileDropzone onData={handleFile} />
          {rows.length > 0 && (
            <button className="btn btn-primary" onClick={() => setStep('map')}>
              Prosseguir para Mapeamento →
            </button>
          )}
        </div>
      )}

      {/* Step: Map */}
      {step === 'map' && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>🔗 Mapeamento de Colunas</div>
          <ColumnMapper headers={headers} fields={ALUNO_FIELDS} onSave={handleMap} initialMapping={mapping} />
        </div>
      )}

      {/* Step: Validate */}
      {step === 'validate' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {[
              { label: 'Total', val: validation.length, color: '#6366f1' },
              { label: 'Válidos', val: valid.length, color: '#10b981' },
              { label: 'Inválidos', val: invalid.length, color: '#ef4444' },
              { label: 'Duplicados', val: dups.length, color: '#f59e0b' },
            ].map(s => (
              <div key={s.label} style={{ background: 'hsl(var(--bg-surface))', border: `1px solid ${s.color}30`, borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: s.color, fontFamily: 'Outfit' }}>{s.val}</div>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Dup action */}
          {dups.length > 0 && (
            <div style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 12 }}><strong>{dups.length} duplicados</strong> encontrados. O que fazer?</div>
              <select className="form-input" value={dupAction} onChange={e => setDupAction(e.target.value as DupAction)} style={{ width: 180, fontSize: 12 }}>
                <option value="ignorar">Ignorar (não alterar)</option>
                <option value="atualizar">Atualizar existente</option>
              </select>
            </div>
          )}

          {/* Errors */}
          {invalid.length > 0 && (
            <div style={{ maxHeight: 250, overflowY: 'auto', border: '1px solid hsl(var(--border-subtle))', borderRadius: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'hsl(var(--bg-overlay))' }}>
                    {['Linha','Registro','Erros'].map(h => <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {invalid.map(v => (
                    <tr key={v.linha} style={{ borderTop: '1px solid hsl(var(--border-subtle))', background: 'rgba(239,68,68,0.02)' }}>
                      <td style={{ padding: '6px 12px', fontFamily: 'monospace' }}>{v.linha}</td>
                      <td style={{ padding: '6px 12px' }}>{v.dados[Object.keys(v.dados)[1]] || '—'}</td>
                      <td style={{ padding: '6px 12px', color: '#ef4444', fontSize: 11 }}>{v.erros.join('; ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={simOnly} onChange={e => setSimOnly(e.target.checked)} />
              Simulação (não gravar no sistema)
            </label>
            {invalid.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => {
                const csv = 'linha;registro;erros\n' + invalid.map(v => `${v.linha};${v.dados[Object.keys(v.dados)[0]]};${v.erros.join(' | ')}`).join('\n')
                downloadText(csv, 'erros-validacao.csv')
              }}>
                <Download size={13} /> Baixar erros
              </button>
            )}
            <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={handleImport} disabled={valid.length === 0}>
              <Play size={14} /> {simOnly ? 'Simular' : 'Importar'} {valid.length} registros válidos
            </button>
          </div>
        </div>
      )}

      {/* Step: Result */}
      {step === 'result' && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: simOnly ? 'rgba(99,102,241,0.08)' : 'rgba(16,185,129,0.08)', border: `1px solid ${simOnly ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.2)'}`, borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12 }}>{simOnly ? '🧪 Simulação concluída' : '✅ Importação concluída'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              {[
                { label: 'Inseridos', val: result.inseridos, color: '#10b981' },
                { label: 'Atualizados', val: result.atualizados, color: '#6366f1' },
                { label: 'Erros', val: result.erros, color: '#ef4444' },
                { label: 'Ignorados', val: result.ignorados, color: '#94a3b8' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: s.color, fontFamily: 'Outfit' }}>{s.val}</div>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => { setStep('file'); setRows([]); setResult(null) }}>Nova Importação</button>
            {!simOnly && snapKey && (
              <button className="btn btn-ghost" style={{ color: '#f59e0b' }} onClick={handleRollback}>
                <RotateCcw size={14} /> Desfazer Importação
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function mapToAluno(m: Record<string, string>): Record<string, any> {
  return {
    nome: m.nome || '',
    codigo: m.codigo || '',
    cpf: m.cpf || '',
    dataNascimento: normalizeDate(m.dataNasc || ''),
    email: m.email || '',
    telefone: m.telefone || '',
    turma: m.turma || '',
    serie: m.serie || '',
    turno: m.turno || '',
    status: m.situacao || 'matriculado',
    racaCor: m.racaCor || '',
    sexo: m.sexo || '',
    nacionalidade: m.nacionalidade || 'Brasileira',
    naturalidade: m.naturalidade || '',
    filiacaoMae: m.filiacaoMae || '',
    filiacaoPai: m.filiacaoPai || '',
    obs: m.obs || '',
    inadimplente: false,
    risco_evasao: 'baixo' as const,
    media: null,
    frequencia: 100,
    unidade: '',
    foto: null,
    matricula: m.codigo || '',
    responsavel: m.filiacaoMae || '',
    saude: {
      autorizaSaida: m.saude_autorizaSaida?.toLowerCase() === 'sim',
      autorizadosBusca: m.saude_autorizado_nome ? [{
        id: Date.now().toString(),
        nome: m.saude_autorizado_nome || '',
        telefone: m.saude_autorizado_telefone || '',
        parentesco: m.saude_autorizado_parentesco || '',
        diasSemana: m.saude_autorizado_dias ? m.saude_autorizado_dias.split(',').map(d => d.trim()) : [],
        liberado: m.saude_autorizado_liberado?.toLowerCase() !== 'não',
        rfid: m.saude_autorizado_rfid || ''
      }] : []
    }
  }
}
