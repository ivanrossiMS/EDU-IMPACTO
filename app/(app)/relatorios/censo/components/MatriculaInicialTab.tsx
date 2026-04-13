'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';

import { useState, useMemo, useCallback } from 'react'
import { useData } from '@/lib/dataContext'
import {
  type CensoAlunoData,
  INEP_ETAPAS, INEP_COR_RACA, INEP_DEFICIENCIAS, INEP_TIPO_ATENDIMENTO, INEP_SITUACOES_CENSO
} from '@/lib/dataContext'
import { Users, Search, CheckCircle2, AlertTriangle, XCircle, ExternalLink, Pencil, X, Save, ChevronDown } from 'lucide-react'
import Link from 'next/link'

// ─── CAMPOS OBRIGATÓRIOS (ERP + CENSO) ────────────────────────────────────────
const CAMPOS_ERP = [
  { campo:'nome',           label:'Nome Completo',      peso:3. },
  { campo:'dataNascimento', label:'Data de Nascimento', peso:3 },
  { campo:'turma',          label:'Turma',              peso:3 },
  { campo:'serie',          label:'Série/Ano',          peso:2 },
  { campo:'turno',          label:'Turno',              peso:2 },
  { campo:'matricula',      label:'Matrícula',          peso:2 },
  { campo:'cpf',            label:'CPF',                peso:1 },
]

const CAMPOS_CENSO_REQ = ['sexo','corRaca','etapaModalidade','tipoAtendimento']

function calcCompletudeERP(aluno: any) {
  const total = CAMPOS_ERP.reduce((s,c) => s + c.peso, 0)
  const preen = CAMPOS_ERP.reduce((s,c) => {
    const v = aluno[c.campo]; return s + (v && String(v).trim() ? c.peso : 0)
  }, 0)
  return Math.round((preen / total) * 100)
}

function calcCompletudeCenso(ca: CensoAlunoData | undefined) {
  if (!ca) return 0
  const ok = CAMPOS_CENSO_REQ.filter(f => !!(ca as any)[f]).length
  return Math.round((ok / CAMPOS_CENSO_REQ.length) * 100)
}

function CompletudeBar({ pct, slim }: { pct: number; slim?: boolean }) {
  const color = pct === 100 ? '#10b981' : pct >= 70 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ flex:1, height: slim ? 4 : 6, background:'hsl(var(--bg-overlay))', borderRadius:3, overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:3, transition:'width 0.3s' }}/>
      </div>
      <span style={{ fontSize:10, fontWeight:700, color, minWidth:28 }}>{pct}%</span>
    </div>
  )
}

function mapRacaErpToCenso(v?: string) {
  if (!v) return '0'
  const s = String(v).toLowerCase()
  if (s.includes('branc')) return '1'
  if (s.includes('pret')) return '2'
  if (s.includes('pard')) return '3'
  if (s.includes('amarel')) return '4'
  if (s.includes('indig')) return '5'
  return '0'
}

function mapRacaCensoToErp(v?: string) {
  const m: Record<string,string> = {'1':'Branca','2':'Preta','3':'Parda','4':'Amarela','5':'Indígena','0':'Não Declarada'}
  return m[v||'0'] || 'Não Declarada'
}

// ─── DRAWER DE ENRIQUECIMENTO ──────────────────────────────────────────────────
function EnriquecimentoDrawer({
  aluno, censoData, onClose, onSave,
}: {
  aluno: any
  censoData: CensoAlunoData | undefined
  onClose: () => void
  onSave: (data: CensoAlunoData) => void
}) {
  const [form, setForm] = useState<Partial<CensoAlunoData>>(() => ({
    alunoId: aluno.id,
    sexo: censoData?.sexo || aluno.sexo || '',
    corRaca: censoData?.corRaca || mapRacaErpToCenso(aluno.racaCor),
    nacionalidade: censoData?.nacionalidade || '1',
    naturalidadeUF: censoData?.naturalidadeUF || aluno.uf || '',
    naturalidadeMunicipio: censoData?.naturalidadeMunicipio || aluno.naturalidade || '',
    deficiencia: censoData?.deficiencia || false,
    tiposDeficiencia: censoData?.tiposDeficiencia || [],
    tipoAtendimento: censoData?.tipoAtendimento || '1',
    etapaModalidade: censoData?.etapaModalidade || '',
    situacaoCenso: censoData?.situacaoCenso || '8',
    dataMatricula: censoData?.dataMatricula || '',
    tipoMatricula: censoData?.tipoMatricula || '1',
    updatedAt: new Date().toISOString(),
  } as CensoAlunoData))

  const set = (field: keyof CensoAlunoData, value: any) =>
    setForm(p => ({ ...p, [field]: value }))

  const toggleDef = (cod: string) => {
    const arr = (form.tiposDeficiencia || []) as string[]
    set('tiposDeficiencia', arr.includes(cod) ? arr.filter(x => x !== cod) : [...arr, cod])
  }

  const handleSave = () => {
    onSave({ ...form, updatedAt: new Date().toISOString() } as CensoAlunoData)
    onClose()
  }

  const Label = ({ children }: any) => (
    <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5, color:'hsl(var(--text-muted))', marginBottom:4 }}>
      {children}
    </div>
  )

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999 }} onClick={onClose}>
      <div style={{ position:'fixed', right:0, top:0, bottom:0, width:480, background:'hsl(var(--bg-surface))', borderLeft:'1px solid hsl(var(--border-subtle))', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'-10px 0 40px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding:'16px 20px', borderBottom:'1px solid hsl(var(--border-subtle))', background:'hsl(var(--bg-overlay))', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontWeight:800, fontSize:14 }}>Enriquecimento Censitário</div>
            <div style={{ fontSize:12, color:'hsl(var(--text-muted))', marginTop:2 }}>{aluno.nome}</div>
          </div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16}/></button>
        </div>

        {/* Form */}
        <div style={{ flex:1, overflowY:'auto', padding:20, display:'flex', flexDirection:'column', gap:16 }}>
          {/* Sexo */}
          <div>
            <Label>Sexo <span style={{ color:'#ef4444' }}>*</span></Label>
            <div style={{ display:'flex', gap:8 }}>
              {[['1','Masculino'],['2','Feminino']].map(([v,l]) => (
                <button key={v} onClick={() => set('sexo', v as any)} style={{
                  flex:1, padding:'8px', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:13,
                  background: form.sexo === v ? 'rgba(99,102,241,0.15)' : 'hsl(var(--bg-elevated))',
                  border: `2px solid ${form.sexo === v ? '#6366f1' : 'hsl(var(--border-subtle))'}`,
                  color: form.sexo === v ? '#a5b4fc' : 'hsl(var(--text-secondary))',
                }}>{l}</button>
              ))}
            </div>
          </div>

          {/* Cor/Raça */}
          <div>
            <Label>Cor / Raça <span style={{ color:'#ef4444' }}>*</span></Label>
            <select className="form-input" value={form.corRaca} onChange={e => set('corRaca', e.target.value as any)}>
              {INEP_COR_RACA.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nome}</option>)}
            </select>
          </div>

          {/* Etapa/Modalidade */}
          <div>
            <Label>Etapa / Modalidade INEP <span style={{ color:'#ef4444' }}>*</span></Label>
            <select className="form-input" value={form.etapaModalidade} onChange={e => set('etapaModalidade', e.target.value)}>
              <option value="">Selecione...</option>
              {INEP_ETAPAS.map(e => <option key={e.codigo} value={e.codigo}>{e.codigo} — {e.nome} ({e.grupo})</option>)}
            </select>
          </div>

          {/* Tipo de Atendimento */}
          <div>
            <Label>Tipo de Atendimento <span style={{ color:'#ef4444' }}>*</span></Label>
            <select className="form-input" value={form.tipoAtendimento} onChange={e => set('tipoAtendimento', e.target.value as any)}>
              {INEP_TIPO_ATENDIMENTO.map(t => <option key={t.codigo} value={t.codigo}>{t.codigo} — {t.nome}</option>)}
            </select>
          </div>

          {/* Nacionalidade */}
          <div>
            <Label>Nacionalidade</Label>
            <select className="form-input" value={form.nacionalidade} onChange={e => set('nacionalidade', e.target.value as any)}>
              <option value="1">1 — Brasileira</option>
              <option value="2">2 — Brasileira Naturalizada</option>
              <option value="3">3 — Estrangeira</option>
            </select>
          </div>

          {/* UF de Nascimento */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <Label>UF de Nascimento</Label>
              <select className="form-input" value={form.naturalidadeUF || ''} onChange={e => set('naturalidadeUF', e.target.value)}>
                <option value="">Selecione...</option>
                {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Município de Nascimento</Label>
              <input className="form-input" value={form.naturalidadeMunicipio || ''} onChange={e => set('naturalidadeMunicipio', e.target.value)} placeholder="Cidade de nascimento"/>
            </div>
          </div>

          {/* Deficiência */}
          <div>
            <Label>Deficiência / NEE</Label>
            <div style={{ display:'flex', gap:8, marginBottom:form.deficiencia ? 10:0 }}>
              {([false, true] as const).map((v,i) => (
                <button key={i} onClick={() => set('deficiencia', v)} style={{
                  flex:1, padding:'7px', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:12,
                  background: form.deficiencia === v ? (v ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.1)') : 'hsl(var(--bg-elevated))',
                  border: `2px solid ${form.deficiencia === v ? (v ? '#f59e0b' : '#10b981') : 'hsl(var(--border-subtle))'}`,
                  color: form.deficiencia === v ? (v ? '#fbbf24' : '#10b981') : 'hsl(var(--text-muted))',
                }}>{v ? 'Possui deficiência' : 'Sem deficiência'}</button>
              ))}
            </div>
            {form.deficiencia && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:8 }}>
                {INEP_DEFICIENCIAS.map(d => {
                  const sel = ((form.tiposDeficiencia || []) as string[]).includes(d.codigo)
                  return (
                    <label key={d.codigo} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:8, background: sel ? 'rgba(245,158,11,0.08)' : 'hsl(var(--bg-elevated))', border:`1px solid ${sel ? 'rgba(245,158,11,0.25)' : 'hsl(var(--border-subtle))'}`, cursor:'pointer', fontSize:11 }}>
                      <input type="checkbox" checked={sel} onChange={() => toggleDef(d.codigo)} style={{ accentColor:'#f59e0b' }}/>
                      <span>{d.codigo} — {d.nome}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* Situação Final Etapa 2 */}
          <div>
            <Label>Situação Final (Etapa 2)</Label>
            <select className="form-input" value={form.situacaoCenso} onChange={e => set('situacaoCenso', e.target.value as any)}>
              {INEP_SITUACOES_CENSO.map(s => <option key={s.codigo} value={s.codigo}>{s.codigo} — {s.nome}</option>)}
            </select>
          </div>

          {/* Data de Código */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <Label>Data de Matrícula</Label>
              <input type="date" className="form-input" value={form.dataMatricula || ''} onChange={e => set('dataMatricula', e.target.value)}/>
            </div>
            <div>
              <Label>Tipo de Matrícula</Label>
              <select className="form-input" value={form.tipoMatricula} onChange={e => set('tipoMatricula', e.target.value as any)}>
                <option value="1">1 — Código Regular</option>
                <option value="2">2 — Rematrícula</option>
                <option value="3">3 — Novo (Transferência)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding:'16px 20px', borderTop:'1px solid hsl(var(--border-subtle))', display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} style={{ gap:8 }}>
            <Save size={14}/> Salvar Dados Censo
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
export function MatriculaInicialTab() {
  const { turmas = [], censoConfig, censoAlunosData, setCensoAlunosData, logCensoAction, mantenedores = [] } = useData();
  const [alunos, setAlunos] = useSupabaseArray<any>('alunos');
  const [search, setSearch]           = useState('')
  const [filterTurma, setFilterTurma] = useState('')
  const [filterStatus, setFilterStatus] = useState<'todos'|'completo'|'incompleto'|'critico'>('todos')
  const [filterCenso, setFilterCenso] = useState<'todos'|'ok'|'pendente'>('todos')
  const [page, setPage]               = useState(1)
  const [editAluno, setEditAluno]     = useState<any | null>(null)
  const PAGE_SIZE = 20

  const todasUnidades = (mantenedores || []).flatMap(m => m.unidades || [])
  const unidadeAtivaId = censoConfig.unidadeId || (todasUnidades[0]?.id || '')
  const escola = todasUnidades.find(u => u.id === unidadeAtivaId) || (todasUnidades[0] as any)

  const isUnidade = (regUnid: string) => {
    if (!unidadeAtivaId) return true
    if (regUnid === unidadeAtivaId) return true
    if (escola && (regUnid === escola.nomeFantasia || regUnid === escola.razaoSocial)) return true
    return false
  }

  const censoMap = useMemo(() =>
    new Map(censoAlunosData.map(ca => [ca.alunoId, ca])),
  [censoAlunosData])

  const alunosValidos = useMemo(() => alunos.filter(a => isUnidade(a.unidade)).filter(a => a.nome?.trim()), [alunos, unidadeAtivaId, escola])

  const processed = useMemo(() => alunosValidos.map(a => ({
    ...a,
    completudeERP: calcCompletudeERP(a),
    completudeCenso: calcCompletudeCenso(censoMap.get(a.id)),
    censoData: censoMap.get(a.id),
    camposFaltandoERP: CAMPOS_ERP.filter(c => { const v = (a as any)[c.campo]; return !v || !String(v).trim() }).map(c => c.label),
  })), [alunosValidos, censoMap])

  const filtered = useMemo(() => {
    let res = processed
    if (search)        res = res.filter(a => a.nome.toLowerCase().includes(search.toLowerCase()) || a.matricula?.toLowerCase().includes(search.toLowerCase()))
    if (filterTurma)   res = res.filter(a => a.turma === filterTurma)
    if (filterStatus === 'completo')   res = res.filter(a => a.completudeERP === 100)
    if (filterStatus === 'incompleto') res = res.filter(a => a.completudeERP < 100 && a.completudeERP >= 60)
    if (filterStatus === 'critico')    res = res.filter(a => a.completudeERP < 60)
    if (filterCenso === 'ok')          res = res.filter(a => a.completudeCenso === 100)
    if (filterCenso === 'pendente')    res = res.filter(a => a.completudeCenso < 100)
    return res
  }, [processed, search, filterTurma, filterStatus, filterCenso])

  const paginated  = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const uniqueTurmas = [...new Set(alunosValidos.map(a => a.turma).filter(Boolean))]

  const erpOk     = processed.filter(a => a.completudeERP === 100).length
  const erpParcial = processed.filter(a => a.completudeERP >= 60 && a.completudeERP < 100).length
  const erpCritico = processed.filter(a => a.completudeERP < 60).length
  const censoOk   = processed.filter(a => a.completudeCenso === 100).length
  const censoPend = processed.filter(a => a.completudeCenso < 100).length

  const handleSaveCensoData = useCallback((data: CensoAlunoData) => {
    setCensoAlunosData(prev => {
      const idx = prev.findIndex(ca => ca.alunoId === data.alunoId)
      if (idx >= 0) { const next = [...prev]; next[idx] = data; return next }
      return [...prev, data]
    })

    // Sincroniza de volta para o ERP (Aluno base)
    if (setAlunos) {
      setAlunos(prev => prev.map(a => {
        if (a.id === data.alunoId) {
          const aAny = a as any;
          return {
            ...a,
            racaCor: mapRacaCensoToErp(data.corRaca),
            uf: data.naturalidadeUF || aAny.uf,
            naturalidade: data.naturalidadeMunicipio || aAny.naturalidade,
            sexo: data.sexo || aAny.sexo
          }
        }
        return a
      }))
    }

    logCensoAction('Código Inicial', `Enriquecimento censo: ${editAluno?.nome}`, { registroId: data.alunoId, registroNome: editAluno?.nome })
  }, [setCensoAlunosData, setAlunos, editAluno])

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {/* HEADER */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:16 }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:800, margin:0 }}>Código Inicial — Etapa 1</h2>
          <p style={{ fontSize:13, color:'hsl(var(--text-muted))', margin:'4px 0 0' }}>
            Ano Censitário <strong>{censoConfig.anoCensitario}</strong> · Completude ERP + dados censitários obrigatórios
          </p>
        </div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          {/* ERP */}
          <div style={{ background:'hsl(var(--bg-surface))', border:'1px solid hsl(var(--border-subtle))', borderRadius:12, padding:'10px 16px' }}>
            <div style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:0.5, color:'hsl(var(--text-muted))', marginBottom:4 }}>Dados ERP</div>
            <div style={{ display:'flex', gap:10 }}>
              {[{l:'OK', c:erpOk, color:'#10b981'},{l:'Parcial', c:erpParcial, color:'#f59e0b'},{l:'Crítico', c:erpCritico, color:'#ef4444'}].map(s => (
                <div key={s.l} style={{ textAlign:'center' }}>
                  <div style={{ fontSize:16, fontWeight:900, color:s.color, fontFamily:'Outfit' }}>{s.c}</div>
                  <div style={{ fontSize:9, color:'hsl(var(--text-muted))' }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
          {/* CENSO */}
          <div style={{ background:'hsl(var(--bg-surface))', border:'1px solid rgba(99,102,241,0.2)', borderRadius:12, padding:'10px 16px' }}>
            <div style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:0.5, color:'#a5b4fc', marginBottom:4 }}>Dados Censo</div>
            <div style={{ display:'flex', gap:10 }}>
              {[{l:'Completo', c:censoOk, color:'#10b981'},{l:'Pendente', c:censoPend, color:'#ef4444'}].map(s => (
                <div key={s.l} style={{ textAlign:'center' }}>
                  <div style={{ fontSize:16, fontWeight:900, color:s.color, fontFamily:'Outfit' }}>{s.c}</div>
                  <div style={{ fontSize:9, color:'hsl(var(--text-muted))' }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* FILTROS */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:'1 1 240px' }}>
          <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'hsl(var(--text-muted))' }}/>
          <input className="form-input" placeholder="Buscar por nome ou matrícula..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} style={{ paddingLeft:36 }}/>
        </div>
        <select className="form-input" style={{ flex:'0 0 180px' }} value={filterTurma} onChange={e => { setFilterTurma(e.target.value); setPage(1) }}>
          <option value="">Todas as Turmas</option>
          {uniqueTurmas.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="form-input" style={{ flex:'0 0 180px' }} value={filterStatus} onChange={e => { setFilterStatus(e.target.value as any); setPage(1) }}>
          <option value="todos">Completude ERP</option>
          <option value="completo">✅ Completos (100%)</option>
          <option value="incompleto">⚠️ Parciais (60-99%)</option>
          <option value="critico">❌ Críticos (&lt;60%)</option>
        </select>
        <select className="form-input" style={{ flex:'0 0 180px' }} value={filterCenso} onChange={e => { setFilterCenso(e.target.value as any); setPage(1) }}>
          <option value="todos">Dados Censo</option>
          <option value="ok">✅ Censo Completo</option>
          <option value="pendente">⚠️ Censo Pendente</option>
        </select>
      </div>

      {/* TABELA */}
      <div className="card" style={{ padding:0, overflow:'hidden', minWidth:0 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', tableLayout:'fixed' }}>
          <colgroup>
            <col style={{ width:36 }} />
            <col style={{ minWidth:180 }} />
            <col style={{ width:100 }} />
            <col style={{ width:110 }} />
            <col style={{ width:70 }} />
            <col style={{ width:70 }} />
            <col style={{ width:110 }} />
            <col style={{ width:140 }} />
            <col style={{ width:60 }} />
          </colgroup>
          <thead>
            <tr style={{ background:'hsl(var(--bg-overlay))' }}>
              {['#','Aluno','Matrícula','Turma','Série','Turno','ERP %','Censo',''].map(h => (
                <th key={h} style={{ padding:'10px 10px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5, color:'hsl(var(--text-muted))', textAlign:'left', whiteSpace:'nowrap', overflow:'hidden' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign:'center', padding:48, color:'hsl(var(--text-muted))' }}>
                <Users size={36} style={{ opacity:0.15, display:'block', margin:'0 auto 8px' }}/>
                Nenhum aluno encontrado.
              </td></tr>
            ) : paginated.map((a, i) => {
              const erpIcon = a.completudeERP === 100
                ? <CheckCircle2 size={12} color="#10b981"/>
                : a.completudeERP >= 60 ? <AlertTriangle size={12} color="#f59e0b"/>
                : <XCircle size={12} color="#ef4444"/>
              const ca = a.censoData as CensoAlunoData | undefined
              const censoOk = a.completudeCenso === 100
              const INEP_RACA_MAP: Record<string, string> = {'0':'NID','1':'Bra','2':'Pre','3':'Par','4':'Ama','5':'Ind'}
              return (
                <tr key={a.id} style={{ borderTop:'1px solid hsl(var(--border-subtle))', transition:'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--bg-elevated))')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding:'8px 10px', fontSize:11, color:'hsl(var(--text-muted))' }}>{(page-1)*PAGE_SIZE+i+1}</td>

                  {/* Aluno */}
                  <td style={{ padding:'8px 10px', overflow:'hidden' }}>
                    <div style={{ fontWeight:700, fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.nome}</div>
                    {a.camposFaltandoERP.length > 0 && (
                      <div style={{ fontSize:9, color:'#ef4444', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        ✗ {a.camposFaltandoERP.slice(0,2).join(', ')}{a.camposFaltandoERP.length > 2 ? ` +${a.camposFaltandoERP.length-2}` : ''}
                      </div>
                    )}
                  </td>

                  {/* Código */}
                  <td style={{ padding:'8px 10px' }}>
                    <code style={{ fontSize:10, background:'hsl(var(--bg-overlay))', padding:'1px 4px', borderRadius:3 }}>{a.matricula||'—'}</code>
                  </td>

                  {/* Turma */}
                  <td style={{ padding:'8px 10px', fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {a.turma || <span style={{ color:'#ef4444', fontWeight:700, fontSize:10 }}>FALTANDO</span>}
                  </td>

                  {/* Série */}
                  <td style={{ padding:'8px 10px', fontSize:11, color:'hsl(var(--text-secondary))' }}>
                    {a.serie||'—'}
                  </td>

                  {/* Turno */}
                  <td style={{ padding:'8px 10px', fontSize:11, color:'hsl(var(--text-secondary))', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {a.turno||'—'}
                  </td>

                  {/* ERP Completude */}
                  <td style={{ padding:'8px 10px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:2 }}>
                      {erpIcon}
                      <span style={{ fontSize:10, fontWeight:700 }}>{a.completudeERP}%</span>
                    </div>
                    <CompletudeBar pct={a.completudeERP} slim/>
                  </td>

                  {/* CENSO — status compacto */}
                  <td style={{ padding:'8px 10px' }}>
                    {censoOk ? (
                      <span style={{ fontSize:10, fontWeight:700, color:'#10b981', display:'flex', alignItems:'center', gap:3 }}>
                        <CheckCircle2 size={11}/> Completo
                      </span>
                    ) : (
                      <div>
                        <div style={{ display:'flex', alignItems:'center', gap:3, marginBottom:2 }}>
                          <AlertTriangle size={11} color="#ef4444"/>
                          <span style={{ fontSize:10, fontWeight:700, color:'#ef4444' }}>{a.completudeCenso}%</span>
                        </div>
                        {/* Pills dos campos preenchidos */}
                        <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
                          {ca?.sexo && <span style={{ fontSize:8, padding:'0 3px', borderRadius:2, background:'rgba(16,185,129,0.1)', color:'#10b981' }}>{ca.sexo==='1'?'M':'F'}</span>}
                          {ca?.corRaca && <span style={{ fontSize:8, padding:'0 3px', borderRadius:2, background:'rgba(16,185,129,0.1)', color:'#10b981' }}>{INEP_RACA_MAP[ca.corRaca]||ca.corRaca}</span>}
                          {ca?.etapaModalidade && <span style={{ fontSize:8, padding:'0 3px', borderRadius:2, background:'rgba(99,102,241,0.1)', color:'#818cf8', fontWeight:700 }}>{ca.etapaModalidade}</span>}
                          {!ca?.sexo && <span style={{ fontSize:8, padding:'0 3px', borderRadius:2, background:'rgba(239,68,68,0.08)', color:'#ef4444' }}>sex</span>}
                          {!ca?.corRaca && <span style={{ fontSize:8, padding:'0 3px', borderRadius:2, background:'rgba(239,68,68,0.08)', color:'#ef4444' }}>raça</span>}
                          {!ca?.etapaModalidade && <span style={{ fontSize:8, padding:'0 3px', borderRadius:2, background:'rgba(239,68,68,0.08)', color:'#ef4444' }}>etapa</span>}
                          {!ca?.tipoAtendimento && <span style={{ fontSize:8, padding:'0 3px', borderRadius:2, background:'rgba(239,68,68,0.08)', color:'#ef4444' }}>atend</span>}
                        </div>
                      </div>
                    )}
                  </td>

                  {/* Ações */}
                  <td style={{ padding:'8px 10px' }}>
                    <div style={{ display:'flex', gap:4 }}>
                      <button className="btn btn-ghost btn-icon btn-sm" title="Enriquecer dados censo" onClick={() => setEditAluno(a)} style={{ color:'#818cf8', padding:4 }}>
                        <Pencil size={12}/>
                      </button>
                      <Link href={`/academico/alunos?id=${a.id}`} style={{ display:'flex', alignItems:'center', padding:4, borderRadius:6, color:'hsl(var(--text-muted))' }} title="Abrir no ERP">
                        <ExternalLink size={11}/>
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>


        {/* PAGINAÇÃO */}
        {totalPages > 1 && (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', borderTop:'1px solid hsl(var(--border-subtle))', background:'hsl(var(--bg-surface))' }}>
            <span style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>
              Mostrando {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, filtered.length)} de {filtered.length}
            </span>
            <div style={{ display:'flex', gap:6 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}>← Anterior</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}>Próxima →</button>
            </div>
          </div>
        )}
      </div>

      {/* DRAWER */}
      {editAluno && (
        <EnriquecimentoDrawer
          aluno={editAluno}
          censoData={censoMap.get(editAluno.id)}
          onClose={() => setEditAluno(null)}
          onSave={handleSaveCensoData}
        />
      )}
    </div>
  )
}
