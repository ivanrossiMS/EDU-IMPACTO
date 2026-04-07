'use client'
import { useState } from 'react'
import { CheckCircle, Download, Play, RotateCcw, AlertTriangle } from 'lucide-react'
import { FileDropzone } from './FileDropzone'
import { ColumnMapper } from './ColumnMapper'
import { autoMap, normalizeDate, snapshot, rollback, downloadText, downloadXlsxTemplate, buildModel, type ParsedRow, type ImportLog } from './useImportacao'

const TURMA_FIELDS = [
  { key: 'codigo', label: 'Código da Turma', required: true,  aliases: ['codigo','cod','codturma'] },
  { key: 'nome',   label: 'Nome da Turma',   required: true,  aliases: ['nome','nometurma','turma'] },
  { key: 'serie',  label: 'Série/Ano',        required: false, aliases: ['serie','ano','anoescolar'] },
  { key: 'turno',  label: 'Turno',            required: false, aliases: ['turno','periodo'] },
  { key: 'sala',   label: 'Sala',             required: false, aliases: ['sala','local'] },
  { key: 'capacidade', label: 'Capacidade',   required: false, aliases: ['capacidade','vagas','cap'] },
  { key: 'professor',  label: 'Professor Regente', required: false, aliases: ['professor','regente','docente'] },
  { key: 'unidade',    label: 'Unidade',      required: false, aliases: ['unidade','escola','unit'] },
  { key: 'ano',        label: 'Ano Letivo',   required: false, aliases: ['anoletivo','ano','letivo'] },
  { key: 'status',     label: 'Situação',       required: false, aliases: ['status','situacao'] },
  { key: 'dataMatricula', label: 'Data da Matrícula', required: false, aliases: ['datamatricula','dtmatricula'] },
  { key: 'dataResultado', label: 'Data do Resultado', required: false, aliases: ['dataresultado','dtresultado'] },
]

const RESP_FIELDS = [
  { key: 'nome',        label: 'Nome Completo',    required: true,  aliases: ['nome','nomeresponsavel','responsavel'] },
  { key: 'cpf',         label: 'CPF',              required: false, aliases: ['cpf','documento'] },
  { key: 'parentesco',  label: 'Parentesco',       required: false, aliases: ['parentesco','relacao','tipo'] },
  { key: 'telefone',    label: 'Telefone/Celular', required: false, aliases: ['telefone','celular','fone','tel'] },
  { key: 'email',       label: 'E-mail',           required: false, aliases: ['email','mail'] },
  { key: 'codigoAluno', label: 'Código do Aluno',  required: false, aliases: ['codigoaluno','aluno','codaluno'] },
  { key: 'respFin',     label: 'Resp. Financeiro', required: false, aliases: ['financeiro','respfin','responsavelfinanceiro'] },
  { key: 'respPed',     label: 'Resp. Pedagógico', required: false, aliases: ['pedagogico','respPed','responsavelpedagogico'] },
]

const FIN_FIELDS = [
  { key: 'codigoAluno', label: 'Código do Aluno', required: true,  aliases: ['codigoaluno','aluno','codaluno','matricula'] },
  { key: 'nomeAluno',   label: 'Nome do Aluno',   required: false, aliases: ['nomealuno','aluno','nome'] },
  { key: 'descricao',   label: 'Descrição/Evento', required: true, aliases: ['descricao','evento','lancamento'] },
  { key: 'valor',       label: 'Valor Original',  required: true,  aliases: ['valor','valororiginal','valorbruto'] },
  { key: 'vencimento',  label: 'Vencimento',      required: true,  aliases: ['vencimento','dtVencimento','vence'] },
  { key: 'status',      label: 'Status',          required: false, aliases: ['status','situacao'] },
  { key: 'parcela',     label: 'Parcela',         required: false, aliases: ['parcela','num','numeroparcela'] },
  { key: 'pagamento',   label: 'Data Pagamento',  required: false, aliases: ['pagamento','dtpagamento','pago'] },
  { key: 'valorPago',   label: 'Valor Pago',      required: false, aliases: ['valorpago','recebido'] },
  { key: 'desconto',    label: 'Desconto',        required: false, aliases: ['desconto','bolsa'] },
  { key: 'metodo',      label: 'Forma Pagamento', required: false, aliases: ['formapagamento','metodo','meio'] },
  { key: 'obs',         label: 'Observação',      required: false, aliases: ['obs','observacao','nota'] },
]

type Mod = 'turmas' | 'responsaveis' | 'financeiro'

const SNAP_KEYS: Record<Mod, string> = {
  turmas: 'edu-data-turmas',
  responsaveis: 'edu-data-responsaveis',
  financeiro: 'edu-data-titulos',
}

interface Props {
  modulo: Mod
  alunos?: any[]
  setTurmas?: (fn: (p: any[]) => any[]) => void
  setResponsaveis?: (fn: (p: any[]) => any[]) => void
  setTitulos?: (fn: (p: any[]) => any[]) => void
  onLog: (log: ImportLog) => void
}

type Step = 'file' | 'map' | 'import' | 'result'

export function ImportacaoGenerica({ modulo, alunos, setTurmas, setResponsaveis, setTitulos, onLog }: Props) {
  const fields = modulo === 'turmas' ? TURMA_FIELDS : modulo === 'responsaveis' ? RESP_FIELDS : FIN_FIELDS
  const [step, setStep] = useState<Step>('file')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [filename, setFilename] = useState('')
  const [mapping, setMapping] = useState<Record<string,string>>({})
  const [snapKey, setSnapKey] = useState<string | null>(null)
  const [result, setResult] = useState<{inseridos:number; erros:number} | null>(null)
  const [simOnly, setSimOnly] = useState(false)

  const headers = rows.length ? Object.keys(rows[0]) : []

  const handleFile = (r: ParsedRow[], fname: string) => {
    setRows(r); setFilename(fname)
    if (r.length > 0) setMapping(autoMap(Object.keys(r[0]), fields))
  }

  const handleImport = () => {
    const snap = snapshot(SNAP_KEYS[modulo])
    setSnapKey(snap)
    let inseridos = 0, erros = 0

    if (!simOnly) {
      if (modulo === 'turmas' && setTurmas) {
        setTurmas((prev: any[]) => {
          let next = [...prev]
          for (const raw of rows) {
            const m: Record<string,string> = {}
            Object.entries(mapping).forEach(([h, k]) => { m[k] = raw[h] ?? '' })
            if (!m.nome) { erros++; continue }
            const dup = next.some(t => t.codigo === m.codigo && m.codigo)
            if (!dup) {
              next.push({ id: `TIMP${Date.now()}_${inseridos}`, codigo: m.codigo || '', nome: m.nome, serie: m.serie || '', turno: m.turno || '', sala: m.sala || '', capacidade: parseInt(m.capacidade) || 30, professor: m.professor || '', matriculados: 0, unidade: m.unidade || '', ano: parseInt(m.ano) || new Date().getFullYear() })
              inseridos++
            }
          }
          return next
        })
      }

      if (modulo === 'financeiro' && setTitulos) {
        setTitulos((prev: any[]) => {
          let next = [...prev]
          for (const raw of rows) {
            const m: Record<string,string> = {}
            Object.entries(mapping).forEach(([h, k]) => { m[k] = raw[h] ?? '' })
            if (!m.codigoAluno || !m.valor) { erros++; continue }
            const aluno = alunos?.find(a => (a.codigo || a.matricula || a.id) === m.codigoAluno)
            next.push({
              id: `FIMP${Date.now()}_${inseridos}`,
              aluno: aluno?.nome || m.nomeAluno || m.codigoAluno,
              responsavel: aluno?.responsavel || '',
              descricao: m.descricao || '',
              valor: parseFloat(m.valor.replace(/[R$\s.]/g, '').replace(',', '.')) || 0,
              vencimento: normalizeDate(m.vencimento || ''),
              pagamento: m.pagamento ? normalizeDate(m.pagamento) : null,
              status: (m.pagamento ? 'pago' : 'pendente') as 'pago'|'pendente'|'atrasado',
              metodo: m.metodo || null,
              parcela: m.parcela || '1/1',
            })
            inseridos++
          }
          return next
        })
      }
    }

    onLog({ id: Date.now().toString(), dataHora: new Date().toISOString(), modulo: modulo.charAt(0).toUpperCase() + modulo.slice(1), arquivo: filename, total: rows.length, inseridos, atualizados: 0, erros, ignorados: 0, status: erros === 0 ? 'sucesso' : inseridos > 0 ? 'parcial' : 'erro', usuario: 'Admin', snapshot: snap })
    setResult({ inseridos, erros })
    setStep('result')
  }

  const LABELS: Record<Mod, string> = { turmas: 'Turmas', responsaveis: 'Responsáveis', financeiro: 'Financeiro' }
  const MODEL_COLS_MAP: Record<Mod, string[]> = {
    turmas: TURMA_FIELDS.map(f => f.label),
    responsaveis: RESP_FIELDS.map(f => f.label),
    financeiro: FIN_FIELDS.map(f => f.label),
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', gap: 0, borderRadius: 12, overflow: 'hidden', border: '1px solid hsl(var(--border-subtle))' }}>
        {(['file','map','import','result'] as Step[]).map((s, i) => {
          const labels = ['1. Arquivo','2. Mapeamento','3. Importar','4. Resultado']
          const active = s === step
          const passed = ['file','map','import','result'].indexOf(step) > i
          return (
            <div key={s} style={{ flex: 1, padding: '10px 8px', fontSize: 12, fontWeight: 700, textAlign: 'center',
              background: active ? '#6366f1' : passed ? 'rgba(99,102,241,0.12)' : 'hsl(var(--bg-elevated))',
              color: active ? '#fff' : passed ? '#818cf8' : 'hsl(var(--text-muted))',
              borderRight: i < 3 ? '1px solid hsl(var(--border-subtle))' : 'none',
            }}>
              {passed && !active ? '✓ ' : ''}{labels[i]}
            </div>
          )
        })}
      </div>

      {step === 'file' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => downloadXlsxTemplate(MODEL_COLS_MAP[modulo], `modelo-${modulo}.xlsx`)}>
              <Download size={13} /> Baixar Modelo XLSX
            </button>
          </div>
          <FileDropzone onData={handleFile} />
          {rows.length > 0 && <button className="btn btn-primary" onClick={() => setStep('map')}>Prosseguir para Mapeamento →</button>}
        </div>
      )}

      {step === 'map' && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>🔗 Mapeamento de Colunas — {LABELS[modulo]}</div>
          <ColumnMapper headers={headers} fields={fields} onSave={m => { setMapping(m); setStep('import') }} initialMapping={mapping} />
        </div>
      )}

      {step === 'import' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Pronto para importar</div>
            <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>{rows.length} registros · arquivo: {filename}</div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={simOnly} onChange={e => setSimOnly(e.target.checked)} />
            Simulação (não gravar no sistema)
          </label>
          <button className="btn btn-primary" onClick={handleImport}>
            <Play size={14} /> {simOnly ? 'Simular' : 'Importar'} {rows.length} registros
          </button>
        </div>
      )}

      {step === 'result' && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12 }}>{simOnly ? '🧪 Simulação concluída' : '✅ Importação concluída'}</div>
            <div style={{ display: 'flex', gap: 24 }}>
              <div><div style={{ fontSize: 28, fontWeight: 900, color: '#10b981', fontFamily:'Outfit' }}>{result.inseridos}</div><div style={{ fontSize: 12, color:'hsl(var(--text-muted))' }}>Inseridos</div></div>
              <div><div style={{ fontSize: 28, fontWeight: 900, color: '#ef4444', fontFamily:'Outfit' }}>{result.erros}</div><div style={{ fontSize: 12, color:'hsl(var(--text-muted))' }}>Erros</div></div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => { setStep('file'); setRows([]); setResult(null) }}>Nova Importação</button>
            {!simOnly && snapKey && (
              <button className="btn btn-ghost" style={{ color: '#f59e0b' }} onClick={() => { rollback(SNAP_KEYS[modulo], snapKey); window.location.reload() }}>
                <RotateCcw size={14} /> Desfazer
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
