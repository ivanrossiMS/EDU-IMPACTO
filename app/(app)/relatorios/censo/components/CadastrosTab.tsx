'use client'
import { useState, useMemo, useCallback } from 'react'
import { useData } from '@/lib/dataContext'
import {
  type CensoProfissionalData, type CensoTurmaData,
  INEP_ETAPAS, INEP_FUNCOES_DOCENTES, INEP_TIPO_ATENDIMENTO,
} from '@/lib/dataContext'
import { Building2, Users, BookOpen, GraduationCap, CheckCircle2, AlertTriangle, XCircle, Link2, Pencil, Save, X } from 'lucide-react'

type SubTab = 'escola' | 'turmas' | 'alunos' | 'profissionais' | 'vinculos'

function StatusChip({ ok, warn, label }: { ok?: boolean; warn?: boolean; label: string }) {
  const bg    = ok ? 'rgba(16,185,129,0.1)' : warn ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.08)'
  const color = ok ? '#10b981' : warn ? '#f59e0b' : '#ef4444'
  const Icon  = ok ? CheckCircle2 : warn ? AlertTriangle : XCircle
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:6, background:bg, color }}>
      <Icon size={11}/> {label}
    </span>
  )
}

// ─── ESCOLA ────────────────────────────────────────────────────────────────────
function EscolaSection() {
  const { mantenedores, censoConfig } = useData()
  const todasUnidades = mantenedores.flatMap(m => m.unidades)
  const unidadeAtivaId = censoConfig.unidadeId || (todasUnidades[0]?.id || '')
  const escola = todasUnidades.find(u => u.id === unidadeAtivaId) || (todasUnidades[0] as any)
  const man = mantenedores.find(m => m.unidades.some(u => u.id === escola?.id)) || mantenedores[0]

  if (!escola) return (
    <div style={{ textAlign:'center', padding:60, color:'hsl(var(--text-muted))' }}>
      <Building2 size={48} style={{ opacity:0.15, display:'block', margin:'0 auto 12px' }}/>
      <div style={{ fontWeight:700 }}>Escola não configurada</div>
      <div style={{ fontSize:13, marginTop:4 }}>Configure em Configurações → Mantenedores / Unidades</div>
    </div>
  )

  const campos: [string, any, boolean, boolean?][] = [
    ['Nome / Razão Social', escola.nomeFantasia||escola.razaoSocial, !!(escola.nomeFantasia||escola.razaoSocial), true],
    ['CNPJ', escola.cnpj, !!escola.cnpj, true],
    ['Código INEP', escola.inep, !!escola.inep && String(escola.inep).replace(/\D/g,'').length >= 7, true],
    ['Código MEC', escola.codigoMec, !!escola.codigoMec],
    ['Endereço', `${escola.endereco||''} ${escola.numero||''}`.trim(), !!escola.endereco, true],
    ['Bairro', escola.bairro, !!escola.bairro],
    ['Cidade', escola.cidade, !!escola.cidade, true],
    ['Estado (UF)', escola.estado, !!escola.estado && escola.estado.length === 2, true],
    ['CEP', escola.cep, !!escola.cep, true],
    ['Telefone', escola.telefone, !!escola.telefone],
    ['E-mail', escola.email, !!escola.email],
    ['Diretor / Gestor', escola.diretor?.nome, !!escola.diretor?.nome, true],
    ['Mantenedora', man?.nome||man?.razaoSocial, !!(man?.nome||man?.razaoSocial)],
    ['CNPJ Mantenedora', man?.cnpj, !!man?.cnpj],
  ]

  const faltandoCriticos = campos.filter(([,,ok,crit]) => crit && !ok).length

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20, flexWrap:'wrap' }}>
        <div style={{ width:50, height:50, background:'rgba(99,102,241,0.1)', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Building2 size={26} color="#6366f1"/>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:16, fontWeight:800 }}>{escola.nomeFantasia||escola.razaoSocial||'Escola'}</div>
          <div style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>INEP: {escola.inep||'—'} · CNPJ: {escola.cnpj||'—'}</div>
        </div>
        {faltandoCriticos > 0 ? (
          <StatusChip label={`${faltandoCriticos} campo(s) crítico(s) faltando`}/>
        ) : (
          <StatusChip ok label="Escola OK para o Censo"/>
        )}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:10 }}>
        {campos.map(([label, valor, ok, critico]) => (
          <div key={label} style={{ padding:'12px 16px', background:'hsl(var(--bg-elevated))', borderRadius:10, border:`1px solid ${!ok && critico ? 'rgba(239,68,68,0.3)' : !ok ? 'rgba(245,158,11,0.2)' : 'hsl(var(--border-subtle))'}` }}>
            <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5, color:'hsl(var(--text-muted))', marginBottom:4, display:'flex', alignItems:'center', gap:6 }}>
              {label} {!ok && critico && <span style={{ fontSize:9, padding:'0 4px', background:'rgba(239,68,68,0.1)', color:'#ef4444', borderRadius:3 }}>OBRIG.</span>}
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontSize:13, fontWeight:600, color: ok ? 'hsl(var(--text-primary))' : !ok&&critico?'#ef4444':'#f59e0b' }}>
                {valor || <span style={{ fontStyle:'italic', opacity:0.5 }}>Não informado</span>}
              </div>
              {ok ? <CheckCircle2 size={14} color="#10b981"/> : <XCircle size={14} color={critico?'#ef4444':'#f59e0b'}/>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── TURMAS ────────────────────────────────────────────────────────────────────
function TurmasSection() {
  const { turmas, alunos, censoTurmasData, setCensoTurmasData, logCensoAction, censoConfig, mantenedores } = useData()
  const [editingId, setEditingId] = useState<string|null>(null)
  const [editForm, setEditForm]   = useState<Partial<CensoTurmaData>>({})

  const todasUnidades = mantenedores.flatMap(m => m.unidades)
  const unidadeAtivaId = censoConfig.unidadeId || (todasUnidades[0]?.id || '')
  const escola = todasUnidades.find(u => u.id === unidadeAtivaId) || (todasUnidades[0] as any)

  const isUnidade = (regUnid: string) => {
    if (!unidadeAtivaId) return true
    if (regUnid === unidadeAtivaId) return true
    if (escola && (regUnid === escola.nomeFantasia || regUnid === escola.razaoSocial)) return true
    return false
  }

  const censoTurMap = useMemo(() => new Map(censoTurmasData.map(ct => [ct.turmaId, ct])), [censoTurmasData])
  const turmasValidas = turmas.filter(t => isUnidade(t.unidade)).filter(t => t.nome?.trim())

  const startEdit = (t: any) => {
    const ct = censoTurMap.get(t.id) as CensoTurmaData|undefined
    setEditForm({ turmaId:t.id, etapaModalidade:ct?.etapaModalidade||'', codigoINEP:ct?.codigoINEP||'', tipoAtendimento:ct?.tipoAtendimento||'1', tipoMediacaoDidatica:ct?.tipoMediacaoDidatica||'1', localizacaoDiferenciada:ct?.localizacaoDiferenciada||'0', updatedAt:'' })
    setEditingId(t.id)
  }

  const saveEdit = (turmaId: string) => {
    const data = { ...editForm, turmaId, updatedAt:new Date().toISOString() } as CensoTurmaData
    setCensoTurmasData(prev => {
      const idx = prev.findIndex(ct => ct.turmaId === turmaId)
      if (idx>=0) { const n=[...prev]; n[idx]=data; return n }
      return [...prev, data]
    })
    logCensoAction('Cadastros', `Turma censo: ${turmas.find(t=>t.id===turmaId)?.nome}`, { registroId:turmaId, anoCensitario:censoConfig.anoCensitario })
    setEditingId(null)
  }

  return (
    <div>
      <div style={{ fontSize:14, fontWeight:800, marginBottom:14 }}>Turmas — {turmasValidas.length} cadastradas</div>
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'hsl(var(--bg-overlay))' }}>
              {['Turma','Série','Turno','Alunos','Etapa INEP','Tipo Atend.','Mediação','Status',''].map(h => (
                <th key={h} style={{ padding:'10px 12px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5, color:'hsl(var(--text-muted))', textAlign:'left', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {turmasValidas.map(t => {
              const ct = censoTurMap.get(t.id) as CensoTurmaData|undefined
              const alunosTurma = alunos.filter(a => a.turma === t.nome && a.nome?.trim()).length
              const isEdit      = editingId === t.id
              const status      = !t.turno ? 'erro' : !ct?.etapaModalidade ? 'alerta' : alunosTurma === 0 ? 'alerta' : 'ok'
              const etapaLabel  = ct?.etapaModalidade ? INEP_ETAPAS.find(e => e.codigo === ct.etapaModalidade)?.nome||ct.etapaModalidade : '—'
              return (
                <tr key={t.id} style={{ borderTop:'1px solid hsl(var(--border-subtle))' }}>
                  <td style={{ padding:'10px 12px', fontWeight:700, fontSize:13 }}>{t.nome}</td>
                  <td style={{ padding:'10px 12px', fontSize:12 }}>{t.serie||'—'}</td>
                  <td style={{ padding:'10px 12px', fontSize:12 }}>{t.turno||<span style={{ color:'#ef4444', fontWeight:700 }}>FALTANDO</span>}</td>
                  <td style={{ padding:'10px 12px', fontSize:12 }}>{alunosTurma}</td>
                  {isEdit ? (
                    <>
                      <td style={{ padding:'6px 8px' }}>
                        <select className="form-input" style={{ fontSize:11, padding:'4px 6px', minWidth:120 }} value={editForm.etapaModalidade} onChange={e => setEditForm(p=>({...p,etapaModalidade:e.target.value}))}>
                          <option value="">-- Etapa --</option>
                          {INEP_ETAPAS.map(e => <option key={e.codigo} value={e.codigo}>{e.codigo}</option>)}
                        </select>
                      </td>
                      <td style={{ padding:'6px 8px' }}>
                        <select className="form-input" style={{ fontSize:11, padding:'4px 6px', minWidth:80 }} value={editForm.tipoAtendimento} onChange={e => setEditForm(p=>({...p,tipoAtendimento:e.target.value as any}))}>
                          {INEP_TIPO_ATENDIMENTO.map(t => <option key={t.codigo} value={t.codigo}>{t.codigo}</option>)}
                        </select>
                      </td>
                      <td style={{ padding:'6px 8px' }}>
                        <select className="form-input" style={{ fontSize:11, padding:'4px 6px' }} value={editForm.tipoMediacaoDidatica} onChange={e => setEditForm(p=>({...p,tipoMediacaoDidatica:e.target.value as any}))}>
                          <option value="1">Presencial</option>
                          <option value="2">Semipresencial</option>
                          <option value="3">EAD</option>
                        </select>
                      </td>
                      <td style={{ padding:'6px 8px' }}>
                        <div style={{ display:'flex', gap:4 }}>
                          <button className="btn btn-primary btn-sm" onClick={() => saveEdit(t.id)} style={{ gap:4, padding:'4px 8px' }}><Save size={11}/></button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)} style={{ padding:'4px 6px' }}><X size={11}/></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding:'10px 12px' }}>
                        {ct?.etapaModalidade ? (
                          <span style={{ fontSize:11, fontWeight:700, padding:'2px 6px', borderRadius:4, background:'rgba(99,102,241,0.1)', color:'#818cf8' }}>{ct.etapaModalidade}</span>
                        ) : <span style={{ color:'#ef4444', fontSize:11, fontWeight:700 }}>FALTA</span>}
                      </td>
                      <td style={{ padding:'10px 12px', fontSize:11, color:'hsl(var(--text-muted))' }}>{ct?.tipoAtendimento||'—'}</td>
                      <td style={{ padding:'10px 12px', fontSize:11, color:'hsl(var(--text-muted))' }}>
                        {ct?.tipoMediacaoDidatica ? {1:'Presencial',2:'Semipres.',3:'EAD'}[ct.tipoMediacaoDidatica as '1'|'2'|'3']||'—' : '—'}
                      </td>
                      <td style={{ padding:'10px 12px' }}>
                        <StatusChip ok={status==='ok'} warn={status==='alerta'} label={status==='ok'?'OK':status==='alerta'?'Dados faltando':'Sem turno'}/>
                      </td>
                      <td style={{ padding:'10px 12px' }}>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => startEdit(t)}><Pencil size={12}/></button>
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── ALUNOS ────────────────────────────────────────────────────────────────────
function AlunosSection() {
  const { alunos, censoAlunosData, censoConfig, mantenedores } = useData()
  const todasUnidades = mantenedores.flatMap(m => m.unidades)
  const unidadeAtivaId = censoConfig.unidadeId || (todasUnidades[0]?.id || '')
  const escola = todasUnidades.find(u => u.id === unidadeAtivaId) || (todasUnidades[0] as any)

  const isUnidade = (regUnid: string) => {
    if (!unidadeAtivaId) return true
    if (regUnid === unidadeAtivaId) return true
    if (escola && (regUnid === escola.nomeFantasia || regUnid === escola.razaoSocial)) return true
    return false
  }

  const validos     = alunos.filter(a => isUnidade(a.unidade)).filter(a => a.nome?.trim())
  const censoMap    = new Map(censoAlunosData.map(ca => [ca.alunoId, ca]))
  const comCenso    = validos.filter(a => censoMap.has(a.id) && censoMap.get(a.id)?.sexo && censoMap.get(a.id)?.etapaModalidade).length
  const semTurma    = validos.filter(a => !a.turma?.trim()).length
  const semNasc     = validos.filter(a => !a.dataNascimento?.trim()).length
  const semCpf      = validos.filter(a => !a.cpf?.trim()).length
  const semCenso    = validos.length - comCenso

  return (
    <div>
      <div style={{ fontSize:14, fontWeight:800, marginBottom:14 }}>Alunos — {validos.length} na base</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:20 }}>
        {[
          { label:'Com dados censo',  v:comCenso,  color:'#10b981', icon:<CheckCircle2 size={16}/> },
          { label:'Sem dados censo',  v:semCenso,  color:'#ef4444', icon:<XCircle size={16}/> },
          { label:'Sem turma',        v:semTurma,  color:'#ef4444', icon:<AlertTriangle size={16}/> },
          { label:'Sem nascimento',   v:semNasc,   color:'#f59e0b', icon:<AlertTriangle size={16}/> },
          { label:'Com CPF',          v:validos.length - semCpf, color:'#6366f1', icon:<CheckCircle2 size={16}/> },
          { label:'Sem CPF',          v:semCpf,    color:'#94a3b8', icon:<AlertTriangle size={16}/> },
        ].map(s => (
          <div key={s.label} style={{ background:'hsl(var(--bg-surface))', border:`1px solid ${s.color}25`, borderRadius:12, padding:'14px 16px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <span style={{ color:s.color, opacity:0.7 }}>{s.icon}</span>
            </div>
            <div style={{ fontSize:22, fontWeight:900, color:s.color, fontFamily:'Outfit' }}>{s.v}</div>
            <div style={{ fontSize:11, color:'hsl(var(--text-muted))', marginTop:3 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize:12, color:'hsl(var(--text-muted))', background:'rgba(99,102,241,0.04)', borderRadius:10, padding:'10px 14px', border:'1px solid rgba(99,102,241,0.12)' }}>
        💡 Para enriquecer os dados censitários dos alunos (sexo, cor/raça, etapa, deficiência), acesse a aba <strong>Código Inicial</strong> e clique no ícone de lápis em cada aluno.
      </div>
    </div>
  )
}

// ─── PROFISSIONAIS ─────────────────────────────────────────────────────────────
const DISCIPLINAS_COMUNS = [
  { id:'port', nome:'Língua Portuguesa' }, { id:'mat', nome:'Matemática' },
  { id:'cien', nome:'Ciências' }, { id:'hist', nome:'História' },
  { id:'geo', nome:'Geografia' }, { id:'ing', nome:'Língua Inglesa' },
  { id:'ef', nome:'Educação Física' }, { id:'art', nome:'Arte' },
  { id:'bio', nome:'Biologia' }, { id:'fis', nome:'Física' },
  { id:'qui', nome:'Química' }, { id:'fil', nome:'Filosofia' },
  { id:'soc', nome:'Sociologia' }, { id:'edfin', nome:'Educação Financeira' },
  { id:'multid', nome:'Multidisciplinar' }, { id:'outro', nome:'Outro' },
]

function ProfissionaisSection() {
  const { funcionarios, turmas, censoProfsData, setCensoProfsData, logCensoAction, censoConfig, mantenedores } = useData()
  const cfgDisciplinas = DISCIPLINAS_COMUNS
  const [editingId, setEditingId] = useState<string|null>(null)
  const [editForm, setEditForm]   = useState<Partial<CensoProfissionalData>>({})
  const [addVinculo, setAddVinculo] = useState({ turmaId:'', disciplinaId:'', cargaHoraria:0 })

  const todasUnidades = mantenedores.flatMap(m => m.unidades)
  const unidadeAtivaId = censoConfig.unidadeId || (todasUnidades[0]?.id || '')
  const escola = todasUnidades.find(u => u.id === unidadeAtivaId) || (todasUnidades[0] as any)

  const isUnidade = (regUnid: string) => {
    if (!unidadeAtivaId) return true
    if (regUnid === unidadeAtivaId) return true
    if (escola && (regUnid === escola.nomeFantasia || regUnid === escola.razaoSocial)) return true
    return false
  }

  const censoPrfMap = useMemo(() => new Map(censoProfsData.map(cp => [cp.funcionarioId, cp])), [censoProfsData])
  const docentes    = funcionarios.filter(f => isUnidade(f.unidade)).filter(f => f.cargo?.toLowerCase().includes('professor') || f.cargo?.toLowerCase().includes('docente') || f.cargo?.toLowerCase().includes('auxiliar'))
  const turmasValidas = turmas.filter(t => isUnidade(t.unidade)).filter(t => t.nome?.trim())

  const startEdit = (f: any) => {
    const cp = censoPrfMap.get(f.id) as CensoProfissionalData|undefined
    setEditForm({ funcionarioId:f.id, cpf:cp?.cpf||f.cpf||'', funcaoDocente:cp?.funcaoDocente||'1', escolaridade:cp?.escolaridade||'7', turmasVinculadas:cp?.turmasVinculadas||[] })
    setEditingId(f.id)
  }

  const saveProf = (fId: string, nome: string) => {
    const data = { ...editForm, funcionarioId:fId, updatedAt:new Date().toISOString() } as CensoProfissionalData
    setCensoProfsData(prev => {
      const idx = prev.findIndex(cp => cp.funcionarioId === fId)
      if (idx>=0) { const n=[...prev]; n[idx]=data; return n }
      return [...prev, data]
    })
    logCensoAction('Cadastros', `Profissional censo: ${nome}`, { registroId:fId, anoCensitario:censoConfig.anoCensitario })
    setEditingId(null)
  }

  const addVinc = () => {
    if (!addVinculo.turmaId) return
    const turma = turmasValidas.find(t => t.id === addVinculo.turmaId)
    const disc  = cfgDisciplinas.find(d => d.id === addVinculo.disciplinaId)
    const vinc  = { turmaId:addVinculo.turmaId, turmaNome:turma?.nome||'', disciplinaId:addVinculo.disciplinaId, disciplinaNome:disc?.nome||'', cargaHoraria:Number(addVinculo.cargaHoraria)||0 }
    setEditForm(p => ({ ...p, turmasVinculadas:[...(p.turmasVinculadas||[]), vinc] }))
    setAddVinculo({ turmaId:'', disciplinaId:'', cargaHoraria:0 })
  }

  const removeVinc = (i: number) =>
    setEditForm(p => ({ ...p, turmasVinculadas:(p.turmasVinculadas||[]).filter((_,j)=>j!==i) }))

  return (
    <div>
      <div style={{ fontSize:14, fontWeight:800, marginBottom:14 }}>Profissionais — {docentes.length} docentes</div>
      {docentes.length === 0 ? (
        <div style={{ textAlign:'center', padding:48, color:'hsl(var(--text-muted))' }}>
          <GraduationCap size={40} style={{ opacity:0.15, display:'block', margin:'0 auto 12px' }}/>
          Nenhum docente com cargo "Professor", "Docente" ou "Auxiliar" cadastrado no módulo RH.
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {docentes.map(f => {
            const cp = censoPrfMap.get(f.id) as CensoProfissionalData|undefined
            const isEdit = editingId === f.id
            const funcaoNome = INEP_FUNCOES_DOCENTES.find(fn => fn.codigo === cp?.funcaoDocente)?.nome || cp?.funcaoDocente || '—'
            return (
              <div key={f.id} style={{ background:'hsl(var(--bg-surface))', border:'1px solid hsl(var(--border-subtle))', borderRadius:12, overflow:'hidden' }}>
                {/* Linha de cabeçalho do prof */}
                <div style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', borderBottom: isEdit ? '1px solid hsl(var(--border-subtle))':undefined }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:'rgba(139,92,246,0.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <GraduationCap size={18} color="#8b5cf6"/>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:13 }}>{f.nome}</div>
                    <div style={{ fontSize:11, color:'hsl(var(--text-muted))', marginTop:1 }}>
                      {f.cargo} · {cp?.cpf || <span style={{ color:'#ef4444' }}>CPF não informado</span>} · {funcaoNome}
                    </div>
                    {(cp?.turmasVinculadas?.length ?? 0) > 0 && (
                      <div style={{ display:'flex', gap:4, marginTop:4, flexWrap:'wrap' }}>
                        {cp!.turmasVinculadas!.map((v,i) => (
                          <span key={i} style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:'rgba(99,102,241,0.1)', color:'#818cf8', fontWeight:600 }}>
                            {v.turmaNome} / {v.disciplinaNome||'—'} ({v.cargaHoraria}h)
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <StatusChip ok={!!(cp?.cpf && cp?.funcaoDocente)} warn={!cp} label={!cp?'Sem dados censo':!(cp.cpf)?'Sem CPF':'OK'}/>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => isEdit ? setEditingId(null) : startEdit(f)}>
                    {isEdit ? <X size={13}/> : <Pencil size={13}/>}
                  </button>
                </div>
                {/* Formulário de edição */}
                {isEdit && (
                  <div style={{ padding:16, display:'flex', flexDirection:'column', gap:12, background:'hsl(var(--bg-elevated))' }}>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10 }}>
                      <div>
                        <div className="form-label" style={{ fontSize:10 }}>CPF</div>
                        <input className="form-input" style={{ fontSize:12 }} value={editForm.cpf||''} onChange={e => setEditForm(p=>({...p,cpf:e.target.value}))} placeholder="000.000.000-00"/>
                      </div>
                      <div>
                        <div className="form-label" style={{ fontSize:10 }}>Função Docente INEP</div>
                        <select className="form-input" style={{ fontSize:12 }} value={editForm.funcaoDocente} onChange={e => setEditForm(p=>({...p,funcaoDocente:e.target.value}))}>
                          {INEP_FUNCOES_DOCENTES.map(f => <option key={f.codigo} value={f.codigo}>{f.codigo} — {f.nome}</option>)}
                        </select>
                      </div>
                      <div>
                        <div className="form-label" style={{ fontSize:10 }}>Escolaridade</div>
                        <select className="form-input" style={{ fontSize:12 }} value={editForm.escolaridade} onChange={e => setEditForm(p=>({...p,escolaridade:e.target.value as any}))}>
                          <option value="1">1 — Sem Escolaridade</option>
                          <option value="2">2 — Fund. Incompleto</option>
                          <option value="3">3 — Fund. Completo</option>
                          <option value="4">4 — Médio Incompleto</option>
                          <option value="5">5 — Médio Completo</option>
                          <option value="6">6 — Superior Incompleto</option>
                          <option value="7">7 — Superior Completo</option>
                        </select>
                      </div>
                    </div>
                    {/* Vínculos */}
                    <div>
                      <div className="form-label" style={{ fontSize:10, marginBottom:6 }}>Vínculos com Turmas</div>
                      {(editForm.turmasVinculadas||[]).map((v, i) => (
                        <div key={i} style={{ display:'flex', gap:6, alignItems:'center', padding:'4px 8px', background:'hsl(var(--bg-surface))', borderRadius:6, marginBottom:4, fontSize:11 }}>
                          <span style={{ flex:1 }}>{v.turmaNome||'—'} / {v.disciplinaNome||'—'} ({v.cargaHoraria}h)</span>
                          <button className="btn btn-ghost btn-icon" style={{ padding:3 }} onClick={() => removeVinc(i)}><X size={11}/></button>
                        </div>
                      ))}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 80px auto', gap:6, marginTop:6 }}>
                        <select className="form-input" style={{ fontSize:11 }} value={addVinculo.turmaId} onChange={e => setAddVinculo(p=>({...p,turmaId:e.target.value}))}>
                          <option value="">Turma...</option>
                          {turmasValidas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                        </select>
                        <select className="form-input" style={{ fontSize:11 }} value={addVinculo.disciplinaId} onChange={e => setAddVinculo(p=>({...p,disciplinaId:e.target.value}))}>
                          <option value="">Disciplina...</option>
                          {cfgDisciplinas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                        </select>
                        <input className="form-input" type="number" min={1} max={40} style={{ fontSize:11 }} placeholder="CH" value={addVinculo.cargaHoraria||''} onChange={e => setAddVinculo(p=>({...p,cargaHoraria:Number(e.target.value)}))}/>
                        <button className="btn btn-secondary btn-sm" onClick={addVinc} style={{ fontSize:11 }}>+ Add</button>
                      </div>
                    </div>
                    <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:4 }}>
                      <button className="btn btn-ghost" onClick={() => setEditingId(null)}>Cancelar</button>
                      <button className="btn btn-primary" onClick={() => saveProf(f.id, f.nome)} style={{ gap:6 }}>
                        <Save size={13}/> Salvar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── VÍNCULOS ──────────────────────────────────────────────────────────────────
function VinculosSection() {
  const { turmas, censoProfsData, funcionarios } = useData()
  const turmasValidas = turmas.filter(t => t.nome?.trim())
  const rows: { turma:string; prof:string; disc:string; ch:number }[] = []
  censoProfsData.forEach(cp => {
    const prof = funcionarios.find(f => f.id === cp.funcionarioId)
    ;(cp.turmasVinculadas||[]).forEach(v => {
      rows.push({ turma:v.turmaNome, prof:prof?.nome || cp.funcionarioId, disc:v.disciplinaNome||'—', ch:v.cargaHoraria })
    })
  })
  return (
    <div>
      <div style={{ fontSize:14, fontWeight:800, marginBottom:14 }}>Matriz de Vínculos — Professor × Turma × Disciplina</div>
      {rows.length === 0 ? (
        <div style={{ textAlign:'center', padding:48, color:'hsl(var(--text-muted))' }}>
          <Link2 size={40} style={{ opacity:0.15, display:'block', margin:'0 auto 12px' }}/>
          <div>Nenhum vínculo mapeado ainda.</div>
          <div style={{ fontSize:12, marginTop:6 }}>Adicione vínculos na aba Profissionais → clique no ícone de lápis.</div>
        </div>
      ) : (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'hsl(var(--bg-overlay))' }}>
                {['Turma','Professor','Disciplina','Carga Horária'].map(h => (
                  <th key={h} style={{ padding:'10px 12px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5, color:'hsl(var(--text-muted))', textAlign:'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderTop:'1px solid hsl(var(--border-subtle))' }}>
                  <td style={{ padding:'9px 12px', fontWeight:700, fontSize:13 }}>{r.turma}</td>
                  <td style={{ padding:'9px 12px', fontSize:12 }}>{r.prof}</td>
                  <td style={{ padding:'9px 12px', fontSize:12 }}>{r.disc}</td>
                  <td style={{ padding:'9px 12px', fontSize:12 }}>{r.ch}h/sem</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
export function CadastrosTab() {
  const [sub, setSub] = useState<SubTab>('escola')
  const SUBS: { key:SubTab; label:string; icon:any }[] = [
    { key:'escola',        label:'Escola / Unidade', icon:<Building2 size={13}/> },
    { key:'turmas',        label:'Turmas',           icon:<BookOpen size={13}/> },
    { key:'alunos',        label:'Alunos',           icon:<Users size={13}/> },
    { key:'profissionais', label:'Profissionais',    icon:<GraduationCap size={13}/> },
    { key:'vinculos',      label:'Vínculos',         icon:<Link2 size={13}/> },
  ]
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div>
        <h2 style={{ fontSize:18, fontWeight:800, margin:0 }}>Cadastros Vinculados ao Censo</h2>
        <p style={{ fontSize:13, color:'hsl(var(--text-muted))', margin:'4px 0 0' }}>Dados do ERP + enriquecimento censitário INEP</p>
      </div>
      <div style={{ display:'flex', gap:4, borderBottom:'1px solid hsl(var(--border-subtle))', flexWrap:'wrap' }}>
        {SUBS.map(s => (
          <button key={s.key} onClick={() => setSub(s.key)} style={{
            display:'flex', alignItems:'center', gap:6, padding:'8px 14px',
            background:'transparent', border:'none',
            borderBottom: sub===s.key ? '2px solid #6366f1' : '2px solid transparent',
            color: sub===s.key ? '#818cf8' : 'hsl(var(--text-muted))',
            cursor:'pointer', fontSize:12, fontWeight:sub===s.key?700:500, transition:'all 0.15s', marginBottom:-1,
          }}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>
      <div style={{ paddingTop:4 }}>
        {sub==='escola'        && <EscolaSection/>}
        {sub==='turmas'        && <TurmasSection/>}
        {sub==='alunos'        && <AlunosSection/>}
        {sub==='profissionais' && <ProfissionaisSection/>}
        {sub==='vinculos'      && <VinculosSection/>}
      </div>
    </div>
  )
}
