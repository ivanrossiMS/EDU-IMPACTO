'use client'
import { useState, useRef } from 'react'
import { Camera, Upload, CheckCircle, XCircle, AlertTriangle, Download } from 'lucide-react'
import { type ParsedRow, snapshot, rollback, downloadText } from './useImportacao'
import { type ImportLog } from './useImportacao'

interface AlunoBase { id: string; codigo?: string; matricula?: string; nome: string; foto?: string | null; fotoNome?: string }

interface Props {
  alunos: AlunoBase[]
  setAlunos: (fn: (prev: any[]) => any[]) => void
  onLog: (log: ImportLog) => void
}

interface FotoResult {
  arquivo: string
  codigo: string
  alunoNome: string | null
  status: 'ok' | 'nao_encontrado' | 'pendente'
  base64?: string
}

const SNAP_KEY = 'edu-data-alunos'

interface FotoResultEx extends FotoResult {
  alunoId: string | null
  alunoObj: AlunoBase | null
}

export function ImportacaoFotos({ alunos: alunosLS, setAlunos, onLog }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [results, setResults] = useState<FotoResultEx[]>([])
  const [processing, setProcessing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState(false)
  const [snapKey, setSnapKey] = useState<string | null>(null)
  const [overwrite, setOverwrite] = useState(false)
  const [progress, setProgress] = useState(0)

  // Fetch full aluno list from API (Supabase) + merge with localStorage
  const fetchAllAlunos = async (): Promise<AlunoBase[]> => {
    try {
      const res = await fetch('/api/alunos', { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } })
      if (res.ok) {
        const apiAlunos: AlunoBase[] = await res.json()
        // Merge: API first, then any localStorage-only records not in API
        const apiIds = new Set(apiAlunos.map(a => a.id))
        const lsOnly = alunosLS.filter(a => !apiIds.has(a.id))
        return [...apiAlunos, ...lsOnly]
      }
    } catch {}
    // Fallback: use localStorage only
    return alunosLS
  }

  const processImages = async (files: FileList) => {
    setProcessing(true)
    setImported(false)
    const list: FotoResultEx[] = []

    // Fetch merged list for lookup
    const allAlunos = await fetchAllAlunos()

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) continue
      const codRaw = file.name.replace(/\.[^.]+$/, '').trim()

      const aluno = allAlunos.find(a => {
        const cod = ((a as any).codigo || a.matricula || a.id || '').toString().trim()
        return cod === codRaw
      })

      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = ev => {
          const img = new Image()
          img.onload = () => {
            const MAX = 400
            const scale = Math.min(1, MAX / Math.max(img.width, img.height))
            const canvas = document.createElement('canvas')
            canvas.width = Math.round(img.width * scale)
            canvas.height = Math.round(img.height * scale)
            canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
            resolve(canvas.toDataURL('image/jpeg', 0.78))
          }
          img.src = ev.target?.result as string
        }
        reader.readAsDataURL(file)
      })

      list.push({
        arquivo: file.name,
        codigo: codRaw,
        alunoNome: aluno?.nome || null,
        alunoId: aluno?.id || null,
        alunoObj: aluno || null,
        status: aluno ? 'ok' : 'nao_encontrado',
        base64,
      })
    }
    setResults(list)
    setProcessing(false)
  }

  const handleImport = async () => {
    setImporting(true)
    setProgress(0)
    const snap = snapshot(SNAP_KEY)
    setSnapKey(snap)

    const toImport = results.filter(r => r.status === 'ok' && r.base64 && r.alunoId)
    let inseridos = 0

    for (let i = 0; i < toImport.length; i++) {
      const r = toImport[i]
      if (!r.alunoId || !r.base64) continue

      // Skip if aluno already has photo and overwrite is false
      if (r.alunoObj?.foto && !overwrite) {
        setProgress(Math.round(((i + 1) / toImport.length) * 100))
        continue
      }

      try {
        // 1. Persist to Supabase via API
        const res = await fetch(`/api/alunos/${r.alunoId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ foto: r.base64, fotoNome: `${r.codigo}.jpg` }),
        })

        if (res.ok) {
          inseridos++
          // 2. Also update localStorage so DataContext stays in sync
          setAlunos((prev: any[]) =>
            prev.map(a =>
              a.id === r.alunoId
                ? { ...a, foto: r.base64, fotoNome: `${r.codigo}.jpg` }
                : a
            )
          )
        }
      } catch {
        // If API fails, still update localStorage
        setAlunos((prev: any[]) =>
          prev.map(a =>
            a.id === r.alunoId
              ? { ...a, foto: r.base64, fotoNome: `${r.codigo}.jpg` }
              : a
          )
        )
        inseridos++
      }

      setProgress(Math.round(((i + 1) / toImport.length) * 100))
      // Small delay so browser doesn't freeze
      await new Promise(r => setTimeout(r, 80))
    }

    onLog({
      id: Date.now().toString(),
      dataHora: new Date().toISOString(),
      modulo: 'Fotos',
      arquivo: `${results.length} imagens`,
      total: results.length,
      inseridos,
      atualizados: 0,
      erros: results.filter(r => r.status === 'nao_encontrado').length,
      ignorados: toImport.length - inseridos,
      status: inseridos === results.filter(r => r.status === 'ok').length ? 'sucesso' : 'parcial',
      usuario: 'Admin',
      snapshot: snap,
    })
    setImporting(false)
    setImported(true)
  }

  const handleRollback = () => {
    if (!snapKey) return
    rollback(SNAP_KEY, snapKey)
    window.location.reload()
  }

  const ok = results.filter(r => r.status === 'ok').length
  const nao = results.filter(r => r.status === 'nao_encontrado').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Info */}
      <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 12, padding: '14px 18px', fontSize: 12 }}>
        <strong>📌 Regra de vínculo:</strong> O nome do arquivo deve ser o <strong>código do sistema</strong> do aluno.<br />
        Exemplo: <code style={{ background: 'hsl(var(--bg-overlay))', padding: '1px 5px', borderRadius: 4 }}>215872.jpg</code> → vincula ao aluno com código <strong>215872</strong>
      </div>

      {/* Options */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input type="checkbox" id="overwrite-foto" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} />
        <label htmlFor="overwrite-foto" style={{ fontSize: 13, cursor: 'pointer' }}>Substituir fotos já existentes</label>
      </div>

      {/* Dropzone */}
      <div
        style={{ border: '2px dashed hsl(var(--border-subtle))', borderRadius: 14, padding: '32px 20px', textAlign: 'center', cursor: 'pointer', background: 'hsl(var(--bg-elevated))' }}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => e.target.files && processImages(e.target.files)} />
        <Camera size={30} style={{ margin: '0 auto 10px', color: '#6366f1', display: 'block' }} />
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Selecionar fotos</div>
        <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>JPG, JPEG, PNG, WEBP · nomeie como {'{codigo_aluno}.jpg'}</div>
      </div>

      {processing && <div style={{ textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>⏳ Processando imagens...</div>}

      {/* Results */}
      {results.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 12 }}>
            {[{ label: 'Encontrados', val: ok, color: '#10b981' }, { label: 'Não encontrados', val: nao, color: '#ef4444' }].map(s => (
              <div key={s.label} style={{ flex: 1, background: 'hsl(var(--bg-surface))', border: `1px solid ${s.color}30`, borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: s.color, fontFamily: 'Outfit' }}>{s.val}</div>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ maxHeight: 320, overflowY: 'auto', borderRadius: 10, border: '1px solid hsl(var(--border-subtle))' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'hsl(var(--bg-overlay))' }}>
                  {['Arquivo', 'Código', 'Aluno', 'Status'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid hsl(var(--border-subtle))' }}>
                    <td style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {r.base64 && <img src={r.base64} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />}
                      <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.arquivo}</span>
                    </td>
                    <td style={{ padding: '8px 12px' }}><code style={{ fontSize: 11, background: 'hsl(var(--bg-overlay))', padding: '1px 5px', borderRadius: 4 }}>{r.codigo}</code></td>
                    <td style={{ padding: '8px 12px', fontWeight: r.alunoNome ? 600 : 400, color: r.alunoNome ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))' }}>{r.alunoNome || '—não encontrado—'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      {r.status === 'ok'
                        ? <span style={{ color: '#10b981', fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={12} /> Vinculado</span>
                        : <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}><XCircle size={12} /> Não encontrado</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {nao > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={() => {
              const csv = 'arquivo;codigo_nao_encontrado\n' + results.filter(r => r.status === 'nao_encontrado').map(r => `${r.arquivo};${r.codigo}`).join('\n')
              downloadText(csv, 'fotos-sem-aluno.csv')
            }}>
              <Download size={13} /> Baixar lista de não vinculados
            </button>
          )}

          {importing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>⏳ Salvando fotos... {progress}%</div>
              <div style={{ height: 6, borderRadius: 99, background: 'hsl(var(--bg-overlay))', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#6366f1,#3b82f6)', width: `${progress}%`, transition: 'width 0.3s' }} />
              </div>
            </div>
          )}

          {!imported && !importing ? (
            <button className="btn btn-primary" onClick={handleImport} disabled={ok === 0}>
              <Upload size={14} /> Importar {ok} foto{ok !== 1 ? 's' : ''} vinculadas
            </button>
          ) : imported ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '14px 18px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12 }}>
              <CheckCircle size={18} color="#10b981" />
              <span style={{ fontWeight: 700, fontSize: 14, color: '#10b981' }}>Fotos importadas! A página de alunos exibirá as fotos atualizadas.</span>
              <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', color: '#f59e0b' }} onClick={handleRollback}>↩ Desfazer</button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
