'use client'
import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useData, newId } from '@/lib/dataContext'
import {
  Users, Baby, Heart, GraduationCap, DollarSign, FileText,
  Check, ChevronRight, ChevronLeft, AlertCircle, CheckCircle,
  Copy, Plus, PlusCircle, Loader2, X, Search, Printer, Download, Eye, Pencil, Camera, Receipt
} from 'lucide-react'
import { ModalEmitirAluno }     from '@/app/(app)/financeiro/boletos/components/ModalEmitirAluno'
import { ModalHistoricoBoletos } from '@/app/(app)/financeiro/boletos/components/ModalHistoricoBoletos'
import { Modal2aVia }            from '@/app/(app)/financeiro/boletos/components/Modal2aVia'
import ExtratoModal              from '@/components/financeiro/ExtratoModal'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function validarCPF(cpf: string) {
  const c = cpf.replace(/\D/g, '')
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false
  let s = 0; for (let i = 0; i < 9; i++) s += +c[i] * (10 - i)
  let r = (s * 10) % 11; if (r >= 10) r = 0; if (r !== +c[9]) return false
  s = 0; for (let i = 0; i < 10; i++) s += +c[i] * (11 - i)
  r = (s * 10) % 11; if (r >= 10) r = 0; return r === +c[10]
}
const fmtCPF = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 11); return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4') }
const fmtPhone = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 11); return d.length <= 10 ? d.replace(/(\d{2})(\d{4})(\d)/, '($1) $2-$3') : d.replace(/(\d{2})(\d{5})(\d)/, '($1) $2-$3') }
const fmtCEP = (v: string) => v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2')
const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável', 'Separado(a)']
const SEXOS = ['Masculino', 'Feminino', 'Não Declarado']
const calcIdade = (nasc: string) => {
  if (!nasc) return ''
  const hoje = new Date(), n = new Date(nasc)
  let age = hoje.getFullYear() - n.getFullYear()
  if (hoje.getMonth() < n.getMonth() || (hoje.getMonth() === n.getMonth() && hoje.getDate() < n.getDate())) age--
  return `${age} anos`
}
const genCodigo = () => String(Math.floor(10000 + Math.random() * 90000))
async function buscarCEP(cep: string) {
  try { const r = await fetch(`https://viacep.com.br/ws/${cep.replace(/\D/g,'')}/json/`); const d = await r.json(); if (d.erro) return null; return { logradouro: d.logradouro, bairro: d.bairro, cidade: d.localidade, estado: d.uf } } catch { return null }
}
const formatDate = (ds: string) => {
  if (!ds) return ''
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(ds)) return ds
  try {
    const [y, m, d] = ds.split('-')
    if (y && m && d) return `${d.slice(0,2)}/${m.slice(0,2)}/${y}`
    return ds
  } catch { return ds }
}

function formatDateFn(ds: string) { return formatDate(ds) }
// Keep generic formatDate name as a function for hoisting if needed, but since it's defined after some usages in components, 
// let's just make it a function at the top.


// ─── Types ────────────────────────────────────────────────────────────────────
interface Endereco { cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; estado: string }
const EMPTY_END: Endereco = { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '' }

interface Resp {
  id: string; tipo: 'mae'|'pai'|'outro1'|'outro2'; codigo: string
  nome: string; cpf: string; rg: string; orgEmissor: string; sexo: string
  dataNasc: string; email: string; celular: string; profissao: string
  parentesco: string; naturalidade: string; uf: string; nacionalidade: string
  estadoCivil: string; obs: string; endereco: Endereco
  respPedagogico: boolean; respFinanceiro: boolean
}
const mkResp = (tipo: Resp['tipo']): Resp => ({
  id: tipo, tipo, codigo: genCodigo(), nome: '', cpf: '', rg: '', orgEmissor: '', sexo: '',
  dataNasc: '', email: '', celular: '', profissao: '',
  parentesco: tipo==='mae'?'Mãe':tipo==='pai'?'Pai':'Outro',
  naturalidade: '', uf: '', nacionalidade: 'Brasileira', estadoCivil: '', obs: '',
  endereco: {...EMPTY_END}, respPedagogico: tipo==='mae', respFinanceiro: tipo==='mae'
})

// ─── Sub-components ───────────────────────────────────────────────────────────
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="form-label">{label}</label>{children}</div>
}

function CPFInput({ value, onChange, existentes }: { value: string; onChange: (v:string)=>void; existentes: string[] }) {
  const raw = value.replace(/\D/g,''); const ok = raw.length===11 && validarCPF(raw) && !existentes.some(c=>c.replace(/\D/g,'')===raw)
  const invalid = raw.length===11 && !validarCPF(raw); const dup = raw.length===11 && validarCPF(raw) && existentes.some(c=>c.replace(/\D/g,'')===raw)
  return (
    <div style={{position:'relative'}}>
      <input className="form-input" value={value} onChange={e=>onChange(fmtCPF(e.target.value))} placeholder="000.000.000-00"
        style={{paddingRight:32, borderColor: raw.length===11?(ok?'rgba(16,185,129,0.5)':'rgba(239,68,68,0.5)'):''}} />
      {raw.length===11 && (ok ? <CheckCircle size={14} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',color:'#10b981'}} />
        : <AlertCircle size={14} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',color:'#ef4444'}} />)}
      {invalid && <div style={{fontSize:10,color:'#f87171',marginTop:2}}>CPF inválido</div>}
      {dup && <div style={{fontSize:10,color:'#f87171',marginTop:2}}>CPF já cadastrado</div>}
    </div>
  )
}

function EnderecoSection({ end, onChange }: { end: Endereco; onChange: (e:Endereco)=>void }) {
  const [loading, setLoading] = useState(false)
  const upd = (k: keyof Endereco) => (v: string) => onChange({...end,[k]:v})
  const handleCEP = async (v: string) => {
    upd('cep')(fmtCEP(v))
    if (v.replace(/\D/g,'').length===8) { setLoading(true); const d = await buscarCEP(v); if(d) onChange({...end,cep:fmtCEP(v),...d}); setLoading(false) }
  }
  return (
    <div style={{display:'flex',flexDirection:'column',gap:8}}>
      <div style={{display:'grid',gridTemplateColumns:'120px 1fr 80px',gap:8}}>
        <F label="CEP"><div style={{position:'relative'}}><input className="form-input" value={end.cep} onChange={e=>handleCEP(e.target.value)} placeholder="00000-000"/>{loading&&<Loader2 size={12} style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)'}}/>}</div></F>
        <F label="Logradouro"><input className="form-input" value={end.logradouro} onChange={e=>upd('logradouro')(e.target.value)}/></F>
        <F label="Nº"><input className="form-input" value={end.numero} onChange={e=>upd('numero')(e.target.value)}/></F>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 60px',gap:8}}>
        <F label="Complemento"><input className="form-input" value={end.complemento} onChange={e=>upd('complemento')(e.target.value)} placeholder="Apto..."/></F>
        <F label="Bairro"><input className="form-input" value={end.bairro} onChange={e=>upd('bairro')(e.target.value)}/></F>
        <F label="Cidade"><input className="form-input" value={end.cidade} onChange={e=>upd('cidade')(e.target.value)}/></F>
        <F label="UF"><select className="form-input" value={end.estado} onChange={e=>upd('estado')(e.target.value)}><option value=""></option>{UFS.map(u=><option key={u}>{u}</option>)}</select></F>
      </div>
    </div>
  )
}

function RespCard({ resp, onChange, cpfExistentes, allResps = [] }: { resp: Resp; onChange:(r:Resp)=>void; cpfExistentes:string[]; allResps?: Resp[] }) {
  const [open, setOpen] = useState(true)
  const [buscarOpen, setBuscarOpen] = useState(false)
  const [buscarQ, setBuscarQ] = useState('')
  const u = (k: keyof Resp, v: any) => onChange({...resp,[k]:v})
  const labels: Record<string,string> = { mae:'👩 Mãe', pai:'👨 Pai', outro1:'👤 Outro 1', outro2:'👤 Outro 2' }
  const cpfOk = resp.cpf.replace(/\D/g,'').length===11 && validarCPF(resp.cpf.replace(/\D/g,''))
  const respsFiltrados = allResps.filter(r =>
    r.nome && (
      r.nome.toLowerCase().includes(buscarQ.toLowerCase()) ||
      r.cpf.replace(/\D/g,'').includes(buscarQ.replace(/\D/g,'')) ||
      (r.celular || '').replace(/\D/g,'').includes(buscarQ.replace(/\D/g,''))
    )
  )
  const selecionarResp = (r: Resp) => {
    onChange({ ...resp, nome: r.nome, cpf: r.cpf, rg: r.rg, orgEmissor: r.orgEmissor,
      sexo: r.sexo, dataNasc: r.dataNasc, estadoCivil: r.estadoCivil, celular: r.celular,
      email: r.email, profissao: r.profissao, naturalidade: r.naturalidade, uf: r.uf,
      nacionalidade: r.nacionalidade, obs: r.obs, endereco: { ...r.endereco } })
    setBuscarOpen(false); setBuscarQ(''); setOpen(true)
  }
  return (
    <div className="card" style={{marginBottom:12,overflow:'visible'}}>
      <div style={{padding:'10px 16px',background:'hsl(var(--bg-elevated))',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',borderBottom:open?'1px solid hsl(var(--border-subtle))':'none',borderRadius:'inherit'}} onClick={()=>setOpen(!open)}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontWeight:700,fontSize:13}}>{labels[resp.tipo]}</span>
          <code suppressHydrationWarning style={{fontSize:10,background:'hsl(var(--bg-overlay))',padding:'1px 6px',borderRadius:4,color:'hsl(var(--text-muted))'}}>{resp.codigo}</code>
          {resp.nome && <span style={{fontSize:12,color:'hsl(var(--text-muted))'}}>{resp.nome}</span>}
          {cpfOk && <CheckCircle size={12} color="#10b981"/>}
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center'}} onClick={e=>e.stopPropagation()}>
          {resp.respPedagogico&&<span style={{fontSize:10,padding:'1px 7px',borderRadius:20,background:'rgba(99,102,241,0.12)',color:'#818cf8',fontWeight:700}}>Pedagógico</span>}
          {resp.respFinanceiro&&<span style={{fontSize:10,padding:'1px 7px',borderRadius:20,background:'rgba(16,185,129,0.12)',color:'#10b981',fontWeight:700}}>Financeiro</span>}
          {/* ── Botão Buscar Responsável ── */}
          <div style={{position:'relative'}}>
            <button
              type="button"
              onClick={()=>{setBuscarOpen(v=>!v);setBuscarQ('')}}
              title="Buscar responsável já cadastrado"
              style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:8,border:'1px solid rgba(99,102,241,0.35)',background:buscarOpen?'rgba(99,102,241,0.15)':'rgba(99,102,241,0.07)',cursor:'pointer',fontSize:11,fontWeight:700,color:'#818cf8',transition:'all .15s'}}
            >
              <Search size={11}/> Buscar
            </button>
            {buscarOpen && (
              <div style={{position:'absolute',top:'calc(100% + 6px)',right:0,zIndex:9999,width:340,background:'hsl(var(--bg-base))',border:'1px solid rgba(99,102,241,0.3)',borderRadius:12,boxShadow:'0 16px 48px rgba(0,0,0,0.55)',overflow:'hidden'}}>
                {/* Header */}
                <div style={{padding:'10px 12px',borderBottom:'1px solid hsl(var(--border-subtle))',background:'hsl(var(--bg-elevated))'}}>
                  <div style={{fontSize:10,fontWeight:700,color:'#818cf8',marginBottom:6,letterSpacing:.5}}>BUSCAR RESPONSÁVEL EXISTENTE</div>
                  <input
                    autoFocus
                    className="form-input"
                    style={{fontSize:12,width:'100%'}}
                    placeholder="Nome, CPF ou telefone..."
                    value={buscarQ}
                    onChange={e=>setBuscarQ(e.target.value)}
                    onClick={e=>e.stopPropagation()}
                  />
                </div>
                {/* Results */}
                <div style={{maxHeight:220,overflowY:'auto'}}>
                  {buscarQ.length < 3 ? (
                    <div style={{padding:'20px 16px',textAlign:'center',color:'hsl(var(--text-muted))',fontSize:12}}>
                      Digite ao menos 3 letras para buscar
                    </div>
                  ) : respsFiltrados.length===0 ? (
                    <div style={{padding:'20px 16px',textAlign:'center',color:'hsl(var(--text-muted))',fontSize:12}}>
                      Nenhum resultado para &quot;{buscarQ}&quot;
                    </div>
                  ) : respsFiltrados.map((r,i) => (
                    <div
                      key={i}
                      style={{padding:'10px 14px',cursor:'pointer',borderBottom:'1px solid hsl(var(--border-subtle))',transition:'background .1s'}}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(99,102,241,0.08)'}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}
                      onClick={e=>{e.stopPropagation();selecionarResp(r)}}
                    >
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                        <div>
                          <div style={{fontWeight:700,fontSize:13}}>{r.nome}</div>
                          <div style={{fontSize:10,color:'hsl(var(--text-muted))',marginTop:2,display:'flex',gap:8}}>
                            {r.cpf && <span>CPF: {r.cpf}</span>}
                            {r.celular && <span>📱 {r.celular}</span>}
                          </div>
                          {r.email && <div style={{fontSize:10,color:'hsl(var(--text-muted))'}}>{r.email}</div>}
                        </div>
                        <span style={{fontSize:10,padding:'2px 7px',borderRadius:12,background:'rgba(99,102,241,0.1)',color:'#818cf8',fontWeight:700,flexShrink:0,marginLeft:8,marginTop:2}}>{r.parentesco}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Footer */}
                <div style={{padding:'8px 12px',borderTop:'1px solid hsl(var(--border-subtle))',background:'hsl(var(--bg-elevated))',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:10,color:'hsl(var(--text-muted))'}}>{allResps.length} responsável(eis) cadastrado(s)</span>
                  <button type="button" style={{fontSize:10,color:'hsl(var(--text-muted))',cursor:'pointer',background:'none',border:'none',padding:'2px 6px'}} onClick={e=>{e.stopPropagation();setBuscarOpen(false)}}>✕ Fechar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {open && (
        <div style={{padding:'16px',display:'flex',flexDirection:'column',gap:12}}>
          {/* Linha 1 */}
          <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:10}}>
            <F label="Nome Completo"><input className="form-input" value={resp.nome} onChange={e=>u('nome',e.target.value)}/></F>
            <F label="CPF"><CPFInput value={resp.cpf} onChange={v=>u('cpf',v)} existentes={cpfExistentes}/></F>
            <F label="Sexo">
              <select className="form-input" value={resp.sexo} onChange={e=>u('sexo',e.target.value)}>
                <option value="">Selecione</option>{SEXOS.map(s=><option key={s}>{s}</option>)}
              </select>
            </F>
          </div>
          {/* Linha 2 */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:10}}>
            <F label="RG"><input className="form-input" value={resp.rg} onChange={e=>u('rg',e.target.value)}/></F>
            <F label="Org. Emissor RG"><input className="form-input" value={resp.orgEmissor} onChange={e=>u('orgEmissor',e.target.value)} placeholder="SSP/SP"/></F>
            <F label="Data de Nascimento"><input className="form-input" type="date" value={resp.dataNasc} onChange={e=>u('dataNasc',e.target.value)}/></F>
            <F label="Estado Civil">
              <select className="form-input" value={resp.estadoCivil} onChange={e=>u('estadoCivil',e.target.value)}>
                <option value="">Selecione</option>{ESTADOS_CIVIS.map(s=><option key={s}>{s}</option>)}
              </select>
            </F>
          </div>
          {/* Linha 3 */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:10}}>
            <F label="Naturalidade"><input className="form-input" value={resp.naturalidade} onChange={e=>u('naturalidade',e.target.value)}/></F>
            <F label="UF"><select className="form-input" value={resp.uf} onChange={e=>u('uf',e.target.value)}><option value=""></option>{UFS.map(u=><option key={u}>{u}</option>)}</select></F>
            <F label="Nacionalidade"><input className="form-input" value={resp.nacionalidade} onChange={e=>u('nacionalidade',e.target.value)}/></F>
            <F label="Profissão"><input className="form-input" value={resp.profissao} onChange={e=>u('profissao',e.target.value)}/></F>
          </div>
          {/* Linha 4 */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <F label="Celular"><input className="form-input" value={resp.celular} onChange={e=>u('celular',fmtPhone(e.target.value))}/></F>
            <F label="E-mail"><input className="form-input" type="email" value={resp.email} onChange={e=>u('email',e.target.value)}/></F>
          </div>
          {(resp.tipo==='outro1'||resp.tipo==='outro2') && (
            <F label="Parentesco"><input className="form-input" value={resp.parentesco} onChange={e=>u('parentesco',e.target.value)} placeholder="Avó, Tio..."/></F>
          )}
          <EnderecoSection end={resp.endereco} onChange={e=>onChange({...resp,endereco:e})}/>
          <F label="Observações"><textarea className="form-input" rows={2} value={resp.obs} onChange={e=>u('obs',e.target.value)}/></F>
          {/* Responsabilidades */}
          <div style={{display:'flex',gap:20,padding:'10px 14px',background:'hsl(var(--bg-overlay))',borderRadius:8,border:'1px solid hsl(var(--border-subtle))'}}>
            <label style={{display:'flex',alignItems:'center',gap:7,cursor:'pointer',fontSize:13,fontWeight:600}}>
              <input type="checkbox" checked={resp.respPedagogico} onChange={e=>u('respPedagogico',e.target.checked)}/>
              <span style={{color:'#818cf8'}}>📚 Responsável Pedagógico</span>
            </label>
            <label style={{display:'flex',alignItems:'center',gap:7,cursor:'pointer',fontSize:13,fontWeight:600}}>
              <input type="checkbox" checked={resp.respFinanceiro} onChange={e=>u('respFinanceiro',e.target.checked)}/>
              <span style={{color:'#10b981'}}>💵 Responsável Financeiro</span>
            </label>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Filiação com busca ───────────────────────────────────────────────────────
function FiliacaoInput({ label, respList, value, onChange }: { label:string; respList:Resp[]; value:string; onChange:(v:string)=>void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const filtered = respList.filter(r => r.nome && (r.nome.toLowerCase().includes(q.toLowerCase()) || r.codigo.includes(q)))
  return (
    <div style={{position:'relative'}}>
      <F label={label}>
        <div style={{display:'flex',gap:6}}>
          <input className="form-input" style={{flex:1}} value={value} onChange={e=>onChange(e.target.value)} placeholder="Nome do responsável"/>
          <button type="button" className="btn btn-secondary btn-sm" onClick={()=>setOpen(!open)} title="Buscar responsável"><Search size={13}/></button>
        </div>
      </F>
      {open && (
        <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:100,background:'hsl(var(--bg-base))',border:'1px solid hsl(var(--border-subtle))',borderRadius:8,boxShadow:'0 8px 30px rgba(0,0,0,0.4)',maxHeight:200,overflowY:'auto'}}>
          <div style={{padding:'8px'}}>
            <input className="form-input" placeholder="Filtrar..." value={q} onChange={e=>setQ(e.target.value)} autoFocus style={{fontSize:12}}/>
          </div>
          {filtered.map(r=>(
            <div key={r.id} style={{padding:'8px 12px',cursor:'pointer',borderTop:'1px solid hsl(var(--border-subtle))'}} onClick={()=>{onChange(r.nome); setOpen(false); setQ('')}}>
              <div style={{fontSize:13,fontWeight:600}}>{r.nome}</div>
              <div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>
                <code style={{background:'hsl(var(--bg-overlay))',padding:'0 4px',borderRadius:3}}>{r.codigo}</code> · {r.parentesco}
              </div>
            </div>
          ))}
          {filtered.length===0 && <div style={{padding:'12px',fontSize:12,color:'hsl(var(--text-muted))',textAlign:'center'}}>Nenhum responsável encontrado</div>}
        </div>
      )}
    </div>
  )
}

const STEPS = [
  {label:'Responsaveis',icon:Users},{label:'Dados do Aluno',icon:Baby},{label:'Saude & Obs',icon:Heart},
  {label:'Matricula',icon:GraduationCap},{label:'Financeiro',icon:DollarSign},{label:'Contratos',icon:FileText}
]

// --- MAIN ---
export default function NovaMatriculaPage() {
  const genCodigo = () => String(Math.floor(100000 + Math.random() * 900000))
  const router = useRouter()
  const { alunos, setAlunos, titulos, setTitulos, turmas, cfgPadroesPagamento, cfgGruposDesconto, cfgEventos, cfgMetodosPagamento, cfgCartoes, cfgConvenios, setCfgConvenios, cfgSituacaoAluno, cfgTurnos, cfgGruposAlunos, caixasAbertos, setCaixasAbertos, movimentacoesManuais, setMovimentacoesManuais, logSystemAction } = useData()
  // Formas de pagamento dinâmicas com fallback
  const FORMAS_FALLBACK = ['PIX','Boleto','Dinheiro','Cartão de Crédito','Cartão de Débito','Débito Automático','Transferência','Cheque','Bolsa Integral']
  const FORMAS = cfgMetodosPagamento.filter((m: any) => m.situacao === 'ativo').length > 0
    ? cfgMetodosPagamento.filter((m: any) => m.situacao === 'ativo').map((m: any) => m.nome as string)
    : FORMAS_FALLBACK
  // Cartões ativos com fallback de bandeiras
  const BANDEIRAS_FALLBACK = ['VISA – CRÉDITO','VISA – DÉBITO','MASTERCARD – CRÉDITO','MASTERCARD – DÉBITO','ELO – CRÉDITO','ELO – DÉBITO','AMEX','HIPERCARD','OUTRAS']
  const BANDEIRAS_CARTAO = cfgCartoes.filter((c: any) => c.situacao === 'ativo').length > 0
    ? cfgCartoes.filter((c: any) => c.situacao === 'ativo').map((c: any) => c.nome as string)
    : BANDEIRAS_FALLBACK
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')  // ID do aluno a editar (vindo de /alunos)
  const alunoEditando = editId ? alunos.find(a => a.id === editId) ?? null : null
  const [step, setStep] = useState(0)
  const [salvando, setSalvando] = useState(false)
  const isEdicao = !!alunoEditando

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Documentos cadastrados no sistema (localStorage)
  const [docsModelos, setDocsModelos] = useState<any[]>([])
  const [mapeamentos, setMapeamentos] = useState<any[]>([])
  const [docsSelected, setDocsSelected] = useState<Set<string>>(new Set())
  const [gerandoDoc, setGerandoDoc] = useState<string|null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('edu-documentos-modelos')
      if (raw) setDocsModelos(JSON.parse(raw).filter((d: any) => d.status === 'ativo'))
      const rawMaps = localStorage.getItem('edu-mascaras-mapeamentos')
      if (rawMaps) setMapeamentos(JSON.parse(rawMaps))
    } catch {}
  }, [])

  // ─── CARREGAR DADOS DO ALUNO EM MODO EDIÇÃO ──────────────────────────────
  // Este useEffect carrega TODOS os dados persistidos do aluno (responsáveis, saúde,
  // matrícula, histórico, parcelas, financeiro) quando se abre em modo de edição.
  useEffect(() => {
    if (!alunoEditando) return
    isInitializingRef.current = true
    const a = alunoEditando as any

    // ── Responsáveis ──────────────────────────────────────────────────────────
    if (a.responsaveis) {
      const resps = a.responsaveis as any[]
      const maeData = resps.find(r => r.tipo === 'mae')
      const paiData = resps.find(r => r.tipo === 'pai')
      const out1Data = resps.find(r => r.tipo === 'outro1')
      const out2Data = resps.find(r => r.tipo === 'outro2')
      if (maeData) setMae({ ...mkResp('mae'), ...maeData })
      if (paiData) setPai({ ...mkResp('pai'), ...paiData })
      if (out1Data) { setOutro1({ ...mkResp('outro1'), ...out1Data }); setShowOutro1(true) }
      if (out2Data) { setOutro2({ ...mkResp('outro2'), ...out2Data }); setShowOutro2(true) }
    } else {
      // Compatibilidade com dados antigos: reconstructir responsável a partir dos campos simples
      const respNome = a.responsavel || ''
      const respTel = a.telefone || ''
      setMae(prev => ({ ...prev, nome: respNome, celular: respTel, respPedagogico: true, respFinanceiro: true }))
    }

    // ── Dados extras do aluno ─────────────────────────────────────────────────
    // (já carregados no useState lazy initializer - só garantir campos faltantes)
    if (a.filiacaoMae) updA('filiacaoMae', a.filiacaoMae)
    if (a.filiacaoPai) updA('filiacaoPai', a.filiacaoPai)
    if (a.idCenso) updA('idCenso', a.idCenso)

    // ── Saúde ─────────────────────────────────────────────────────────────────
    if (a.saude) {
      setSaude(prev => ({ ...prev, ...a.saude }))
    }

    // ── Matrícula ─────────────────────────────────────────────────────────────
    if (a.dadosMatricula) {
      setMat(prev => ({ ...prev, ...a.dadosMatricula }))
    } else {
      // Compatibilidade: preencher turmaId a partir do nome da turma
      const turmaEncontrada = turmas.find(t => t.nome === a.turma || t.id === a.turmaId)
      if (turmaEncontrada) setMat(prev => ({ ...prev, turmaId: turmaEncontrada.id, turno: a.turno || turmaEncontrada.turno || '' }))
    }

    // ── Histórico de Matrículas ───────────────────────────────────────────────
    if (a.historicoMatriculas && Array.isArray(a.historicoMatriculas)) {
      setHistorico(a.historicoMatriculas)
    }

    // ── Financeiro (configuração) ─────────────────────────────────────────────
    if (a.configFinanceiro) {
      setFin(prev => ({ ...prev, ...a.configFinanceiro, _filtro: 'a-vencer' }))
    }

    // ── Parcelas ─────────────────────────────────────────────────────────────
    // Carrega as parcelas salvas diretamente no aluno (campo 'parcelas')
    if (a.parcelas && Array.isArray(a.parcelas) && a.parcelas.length > 0) {
      setParcelas(a.parcelas)
      setParcelasConfirmadas(true)
    } else {
      // Fallback: buscar nos títulos do DataContext vinculados ao aluno
      const parcelasDoAluno = titulos.filter(t => (t as any).alunoId === a.id || (t.aluno === a.nome && !(t as any).alunoId))
      if (parcelasDoAluno.length > 0) {
        const mapped = parcelasDoAluno.map((t: any, idx: number) => ({
          num: idx + 1,
          competencia: t.competencia || (t.vencimento ? t.vencimento.slice(0, 7) : ''),
          vencimento: t.vencimento ? new Date(t.vencimento + 'T12:00').toLocaleDateString('pt-BR') : '',
          valor: t.valor || 0,
          desconto: t.desconto || 0,
          valorFinal: (t.valor || 0) - (t.desconto || 0),
          status: (t.status as any) || 'pendente',
          obs: t.descricao || '',
          editando: false,
          evento: t.descricao || 'Mensalidade',
          dtPagto: t.pagamento || undefined,
          formaPagto: t.metodo || undefined,
        }))
        setParcelas(mapped)
        setParcelasConfirmadas(mapped.length > 0)
      }
    }

    // ── Observações financeiras do aluno ─────────────────────────────────────
    if (a.obsFinanceiro) setObsAlunoFin(a.obsFinanceiro)

    // Finaliza carregamento — libera os auto-saves
    // Usa requestAnimationFrame para garantir que todos os setStates acima já foram processados
    requestAnimationFrame(() => { isInitializingRef.current = false })

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId])

  // Responsaveis
  const [mae, setMae] = useState<Resp>(mkResp('mae'))
  const [pai, setPai] = useState<Resp>(mkResp('pai'))
  const [outro1, setOutro1] = useState<Resp>(mkResp('outro1'))
  const [outro2, setOutro2] = useState<Resp>(mkResp('outro2'))
    const [showOutro1, setShowOutro1] = useState(false)
  const [showOutro2, setShowOutro2] = useState(false)
  const todosResp = [mae, pai, ...(showOutro1?[outro1]:[]), ...(showOutro2?[outro2]:[])]

  // Aluno
  const anoAtual = new Date().getFullYear()
  const codigoAlunoRef = useRef<string>((alunoEditando as any)?.codigo || genCodigo())
  const codigoAluno = codigoAlunoRef.current
  // Bloqueia auto-saves enquanto o useEffect de carregamento inicial popula os states
  const isInitializingRef = useRef(false)
  const numMatricula = (alunoEditando as any)?.matricula || `${anoAtual}${String(alunos.length+1).padStart(4,'0')}`
  const rgaAluno = (alunoEditando as any)?.rga || `${anoAtual}${codigoAluno}`

  const [aluno, setAluno] = useState(() => ({
    codigo: codigoAluno,
    cpf: (alunoEditando as any)?.cpf ?? '',
    nome: (alunoEditando as any)?.nome ?? '',
    idCenso: (alunoEditando as any)?.idCenso ?? '',
    rga: rgaAluno,
    dataNasc: (alunoEditando as any)?.dataNascimento ?? '',
    sexo: (alunoEditando as any)?.sexo ?? '',
    estadoCivil: (alunoEditando as any)?.estadoCivil ?? '',
    nacionalidade: (alunoEditando as any)?.nacionalidade ?? 'Brasileira',
    naturalidade: (alunoEditando as any)?.naturalidade ?? '',
    uf: (alunoEditando as any)?.uf ?? '',
    racaCor: (alunoEditando as any)?.racaCor ?? '',
    email: (alunoEditando as any)?.email ?? '',
    celular: (alunoEditando as any)?.telefone ?? '',
    filiacaoMae: (alunoEditando as any)?.filiacaoMae ?? '',
    filiacaoPai: (alunoEditando as any)?.filiacaoPai ?? '',
    foto: (alunoEditando as any)?.foto ?? '' as string,
    endereco: (alunoEditando as any)?.endereco ?? {...EMPTY_END}
  }))
  const fotoInputRef = useRef<HTMLInputElement>(null)
  const handleFotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const img = new Image()
      img.onload = () => {
        // Comprime para max 400×400 px, JPEG 0.75 → ~15-30KB
        const MAX = 400
        const scale = Math.min(1, MAX / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width  = Math.round(img.width  * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        const base64 = canvas.toDataURL('image/jpeg', 0.75)
        // 1. Preview imediato na UI
        updA('foto', base64)
        // 2. Persiste diretamente no alunos array (contorna closure stale do autoSalvar)
        const sid = autoSaveIdRef.current || (isEdicao ? editId : null)
        if (sid) {
          setAlunos((prev: any[]) =>
            prev.map((a: any) => a.id === sid ? { ...a, foto: base64 } : a)
          )
        }
      }
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
  }
  const updA = (k: string, v: any) => setAluno(a=>({...a,[k]:v}))

  // Saúde
  const [saude, setSaude] = useState<{
    tipoSanguineo:string; alergias:string; medicamentos:string; necessidades:string
    deficiencias:string; autorizaImagem:boolean; autorizaSaida:boolean; obs:string; obsMedica:string
    autorizados:{
      nome:string; telefone:string; parentesco:string;
      rfid:string; diasSemana:string[]; proibido:boolean
    }[]
  }>({
    tipoSanguineo:'', alergias:'', medicamentos:'', necessidades:'', deficiencias:'',
    autorizaImagem:true, autorizaSaida:false, obs:'', obsMedica:'', autorizados:[],
  })

  // Matrícula (dados básicos)
  const [mat, setMat] = useState({
    anoLetivo: String(anoAtual), turmaId:'', turno:'', escola:'', dataIngresso: new Date().toISOString().split('T')[0],
    tipoMatricula: '' as string  // '' = auto (derivado do histórico), 'nova' ou 'rematricula'
  })

  // Histórico de matrículas (grid)
  interface HistoricoItem {
    id: string; ano: string; turmaId: string; turno: string
    padraoId: string; situacao: string; dataMatricula: string
    dataResultado: string; grupoAlunos: string; bolsista: string
    respFinanceiroId: string; nrContrato: string; dataAlteracao: string
    tipoMatricula: string  // 'nova' | 'rematricula' | '' (auto)
  }
  const [historico, setHistorico] = useState<HistoricoItem[]>([])
  const [modalMatricula, setModalMatricula] = useState(false)
  const [editHistId, setEditHistId] = useState<string|null>(null)
  const novoHistItem = (): HistoricoItem => ({
    id: Date.now().toString(), ano: String(anoAtual), turmaId: mat.turmaId,
    turno: mat.turno, padraoId: '', situacao: 'Cursando',
    dataMatricula: new Date().toISOString().split('T')[0],
    dataResultado: '', grupoAlunos: '', bolsista: 'Não',
    respFinanceiroId: todosResp.find(r=>r.respFinanceiro)?.id ?? '',
    nrContrato: numMatricula, dataAlteracao: new Date().toLocaleDateString('pt-BR'),
    // Auto-detecta: se já existe alguma matrícula no histórico ou aluno está sendo editado → rematricula
    tipoMatricula: (historico.length > 0 || (isEdicao && (alunoEditando as any)?.historicoMatriculas?.length > 0)) ? 'rematricula' : 'nova'
  })
  const [formHist, setFormHist] = useState<HistoricoItem>(novoHistItem)
  const fH = (k: keyof HistoricoItem, v: string) => setFormHist(h=>({...h,[k]:v}))

  // Financeiro
  const [fin, setFin] = useState({
    padraoId:'', valorMensalidade:'', diaVencimento:'', totalParcelas:'',
    formaPagamento:'Boleto', bolsista:'Nao', grupoDescontoId:'', obsFinanceiro:'', _filtro:'a-vencer',
    descontoTipo: '%', descontoValor: ''
  })

  // Parcelas
  interface Parcela {
    num: number; competencia: string; vencimento: string
    valor: number; desconto: number; valorFinal: number
    status: 'pendente'|'pago'|'cobranca'|'isento'|'vencido'|'cancelado'
    obs: string; editando: boolean
    evento?: string; eventoId?: string; juros?: number; multa?: number
    dtPagto?: string; formaPagto?: string; comprovante?: string; obsFin?: string; codigo?: string; codBaixa?: string
    dataExclusao?: string; motivoExclusao?: string
  }
  const [parcelas, setParcelas] = useState<Parcela[]>([])
  const [descAplicar, setDescAplicar] = useState({ tipo:'%', valor:'', deParcela:'1' })
  const [parcelasConfirmadas, setParcelasConfirmadas] = useState(false)
  const [parcelasPreview, setParcelasPreview] = useState<any[]>([])

  // ── Modelos de documentos — lê do localStorage (configurações/pedagógico/documentos) ──
  const [docModelos, setDocModelos] = useState<any[]>([])
  const [mapeamentosDoc, setMapeamentosDoc] = useState<any[]>([])
  useEffect(() => {
    try {
      const s = localStorage.getItem('edu-documentos-modelos')
      if (s) setDocModelos(JSON.parse(s))
      const m = localStorage.getItem('edu-mascaras-mapeamentos')
      if (m) setMapeamentosDoc(JSON.parse(m))
    } catch {}
  }, [])

  // Status por documento: 'idle' | 'generating' | 'done'
  const [docGenStatus, setDocGenStatus] = useState<Record<string,'idle'|'generating'|'done'>>({})
  const [docGenUrls, setDocGenUrls]     = useState<Record<string,{url:string,filename:string,isPrint:boolean}>>({})

  const gerarDocumentoMatricula = useCallback(async (doc: any) => {
    const docId = doc.id
    setDocGenStatus(prev => ({...prev, [docId]: 'generating'}))
    // Resolve contexto
    const histAtivo = historico.find((h:any) => h.situacao === 'Cursando') || historico[historico.length - 1]
    const tObj = turmas.find(t => t.id === (histAtivo?.turmaId || mat.turmaId))
    const respPed = todosResp.find(r => r.respPedagogico)
    const respFin = todosResp.find(r => r.respFinanceiro)
    const parcelasAtivas = parcelas.filter(p => p.status !== 'cancelado')
    const anuidade = parcelasAtivas.reduce((s, p) => s + p.valor, 0)
    let unidadeNome = 'Colégio Impacto', cidadeNome = ''
    try {
      const cfgM = localStorage.getItem('edu-cfg-mantenedores')
      if (cfgM) { const m = JSON.parse(cfgM); unidadeNome = m[0]?.unidades?.[0]?.nomeFantasia || unidadeNome; cidadeNome = m[0]?.unidades?.[0]?.cidade || '' }
    } catch {}
    const turnoAtual = histAtivo?.turno || mat.turno || tObj?.turno || ''
    const anoAtualLetivo = histAtivo?.ano || mat.anoLetivo || String(anoAtual)
    const MAPA: Record<string, string> = {
      '<<aluno>>': aluno.nome || '', '<<nome_completo>>': aluno.nome || '',
      '<<cpf_aluno>>': aluno.cpf || '', '<<rg_aluno>>': (alunoEditando as any)?.rg || '',
      '<<data_nascimento>>': aluno.dataNasc ? new Date(aluno.dataNasc + 'T12:00').toLocaleDateString('pt-BR') : '',
      '<<matricula>>': numMatricula, '<<responsavel>>': mae.nome || pai.nome || '',
      '<<telefone_resp>>': mae.celular || pai.celular || '',
      '<<email_aluno>>': aluno.email || '', '<<endereco>>': aluno.endereco || '',
      '<<turma>>': tObj?.nome || '', '<<serie>>': (tObj as any)?.serie || '',
      '<<segmento>>': (tObj as any)?.segmento || '', '<<turno>>': turnoAtual,
      '<<ano_letivo>>': anoAtualLetivo, '<<data_hoje>>': new Date().toLocaleDateString('pt-BR'),
      '<<data_extenso>>': new Date().toLocaleDateString('pt-BR', { dateStyle: 'long' } as any),
      '<<mes_atual>>': new Date().toLocaleDateString('pt-BR', { month: 'long' } as any),
      '<<unidade>>': unidadeNome, '<<cidade>>': cidadeNome,
      '<<nome_mae>>': mae.nome || '', '<<cpf_mae>>': mae.cpf || '', '<<rg_mae>>': mae.rg || '',
      '<<celular_mae>>': mae.celular || '', '<<email_mae>>': mae.email || '', '<<profissao_mae>>': mae.profissao || '',
      '<<nome_pai>>': pai.nome || '', '<<cpf_pai>>': pai.cpf || '', '<<rg_pai>>': pai.rg || '',
      '<<celular_pai>>': pai.celular || '', '<<email_pai>>': pai.email || '', '<<profissao_pai>>': pai.profissao || '',
      '<<resp_ped>>': respPed?.nome || '', '<<resp_pedagogico>>': respPed?.nome || '', '<<cpf_resp_ped>>': respPed?.cpf || '',
      '<<resp_fin>>': respFin?.nome || '', '<<resp_financeiro>>': respFin?.nome || '', '<<cpf_resp_fin>>': respFin?.cpf || '',
      '<<mensalidade>>': `R$ ${fmtMoeda(parcelasAtivas[0]?.valor || 0)}`, '<<valor_mensalidade>>': `R$ ${fmtMoeda(parcelasAtivas[0]?.valor || 0)}`,
      '<<total_parcelas>>': String(parcelasAtivas.length), '<<anuidade>>': `R$ ${fmtMoeda(anuidade)}`,
      '<<vencimento>>': fin.diaVencimento || '', '<<num_contrato>>': histAtivo?.nrContrato || numMatricula,
      '<<bolsista>>': fin.bolsista === 'S' || fin.bolsista === 'Sim' ? 'Sim' : 'Não',
    }
    for (const map of mapeamentosDoc) { if (map.fonte === 'fixo' && map.valorFixo) MAPA[map.codigoMascara] = map.valorFixo }
    const subst = (t: string) => { let r = t; for (const [k,v] of Object.entries(MAPA)) r = r.split(k).join(v); return r }

    try {
      let blobUrl = '', filename = '', isPrint = false
      if (doc.arquivoBase64) {
        const PizZip = (await import('pizzip')).default
        const Docxtemplater = (await import('docxtemplater')).default
        const binaryStr = atob(doc.arquivoBase64)
        const bytes = new Uint8Array(binaryStr.length)
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
        const zip = new PizZip(bytes)
        const docxDoc = new Docxtemplater(zip, { delimiters:{start:'<<',end:'>>'}, paragraphLoop:true, linebreaks:true })
        const data: Record<string,string> = {}
        for (const [k,v] of Object.entries(MAPA)) data[k.replace(/<<|>>/g,'')] = v
        docxDoc.setData(data); docxDoc.render()
        const out = docxDoc.getZip().generate({ type:'blob', mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
        blobUrl = URL.createObjectURL(out)
        filename = `${doc.nome} - ${aluno.nome || 'aluno'}.docx`
      } else {
        const conteudo = subst(doc.templateTexto || '')
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${doc.nome}</title><style>body{font-family:Arial,sans-serif;padding:48px 56px;max-width:800px;margin:auto;line-height:1.9;font-size:14px;color:#111}pre{white-space:pre-wrap;font-family:Arial,sans-serif}@media print{.no-print{display:none!important}}</style></head><body><div class="no-print" style="text-align:right;margin-bottom:32px"><button onclick="window.print()" style="padding:8px 18px;background:#6366f1;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700">🖨️ Imprimir</button></div><pre>${conteudo.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')}</pre></body></html>`
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
        blobUrl = URL.createObjectURL(blob)
        filename = `${doc.nome} - ${aluno.nome || 'aluno'}.html`
        isPrint = true
      }
      // Animação mínima de processamento (UX feedback)
      await new Promise(r => setTimeout(r, 1400))
      setDocGenUrls(prev => ({...prev, [docId]: { url: blobUrl, filename, isPrint }}))
      setDocGenStatus(prev => ({...prev, [docId]: 'done'}))
    } catch (err: any) {
      setDocGenStatus(prev => ({...prev, [docId]: 'idle'}))
      alert('Erro ao gerar documento: ' + (err?.message ?? 'Erro desconhecido.'))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aluno, mae, pai, historico, mat, parcelas, fin, turmas, todosResp, numMatricula, mapeamentosDoc])

  // Baixa ou abre em nova aba o documento já gerado
  const baixarDocumentoGerado = useCallback((docId: string) => {
    const g = docGenUrls[docId]
    if (!g) return
    if (g.isPrint) {
      window.open(g.url, '_blank')
    } else {
      const a = document.createElement('a')
      a.href = g.url; a.download = g.filename; a.click()
    }
  }, [docGenUrls])


  // Se houver qualquer mutação (Baixa, Zerar Juros, Edição de Vcto), salvar no Aluno
  useEffect(() => {
    if (isInitializingRef.current) return
    if (alunoEditando && parcelas.length > 0 && !salvando) {
      setAlunos(prev => prev.map(a =>
        a.id === alunoEditando.id ? { ...a, parcelas } : a
      ))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcelas, salvando])

  useEffect(() => {
    if (isInitializingRef.current) return
    if (alunoEditando && !salvando) {
      setAlunos(prev => prev.map(a =>
        a.id === alunoEditando.id ? { ...a, configFinanceiro: fin } : a
      ))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fin, salvando])


  // ─── Modal states financeiro ─────────────────────────────────────────────────
  const [modalDesconto, setModalDesconto] = useState(false)
  const [modalVcto, setModalVcto] = useState(false)
  const [modalEventoFin, setModalEventoFin] = useState(false)
  const [modalObsFin, setModalObsFin] = useState(false)
  const [modalAlterarValor, setModalAlterarValor] = useState(false)
  const [modalExtrato, setModalExtrato] = useState(false)
  const [modalEditarParcela, setModalEditarParcela] = useState(false)
  const [modalBaixarParcela, setModalBaixarParcela] = useState(false)
  const [parcelaAtiva, setParcelaAtiva] = useState<any>(null)
  const [baixaForm, setBaixaForm] = useState<{dataPagto:string;formasPagto:{id:string;forma:string;valor:string;cartao:{bandeira:string;numero:string;nome:string;validade:string;parcelas:string;autorizacao:string}|null}[];juros:string;multa:string;desconto:string;obs:string;comprovante:string;codPreview?:string;caixaId:string}>({dataPagto:new Date().toISOString().split('T')[0],formasPagto:[{id:'f1',forma:'PIX',valor:'',cartao:null}],juros:'0',multa:'0',desconto:'',obs:'',comprovante:'',caixaId:''})
  const [modalRecibo, setModalRecibo] = useState(false)
  const [modalBaixaResp, setModalBaixaResp] = useState(false)
  const [baixaRespParcelas, setBaixaRespParcelas] = useState<any[]>([])
  const [modalBaixaRespConfirm, setModalBaixaRespConfirm] = useState(false)
  const [baixaRespForm, setBaixaRespForm] = useState({dataPagto:new Date().toISOString().split('T')[0],formasPagto:[{id:'rf1',forma:'PIX',valor:'',cartao:null}],obs:'',comprovante:'',caixaId:''})
  const [modalBaixaLote, setModalBaixaLote] = useState(false)
  const [baixaLoteForm, setBaixaLoteForm] = useState({dataPagto: new Date().toISOString().split('T')[0], formaPagto:'PIX', comprovante:'', obs:'', juros:'0', multa:'0', desconto:'0', codPreview:''})
  const [baixaLoteMultiFormas, setBaixaLoteMultiFormas] = useState<{id:string;forma:string;valor:string;cartao:any}[]>([{id:'f1',forma:'PIX',valor:'',cartao:null}])
  const [modalCartao, setModalCartao] = useState(false)
  const [cartaoFormIdx, setCartaoFormIdx] = useState(0)
  const [cartaoCtx, setCartaoCtx] = useState<'baixa'|'baixaResp'>('baixa')
  const [cartaoForm, setCartaoForm] = useState({bandeira:'Visa',numero:'',nome:'',validade:'',parcelas:'1',autorizacao:''})
  const [parcelasSelected, setParcelasSelected] = useState<number[]>([])
  const [descLote, setDescLote] = useState<{tipo:'%'|'R$';valor:string;deParcela:string;ateParcela:string;eventoId?:string;parcelasEvento?:number[]}>({tipo:'%',valor:'',deParcela:'1',ateParcela:'1',eventoId:'',parcelasEvento:[]})
  const [vctoForm, setVctoForm] = useState({deParcela:'1',ateParcela:'1',novoDia:'',eventoFiltro:''})
  const [eventoForm, setEventoForm] = useState({turmaId:'',eventoNome:'',eventoId:'',vencimentoInicial:'',parcelaInicial:'1',parcelaFinal:'1',tipoVencimento:'diaX' as 'diaX'|'30dias',diaVcto:'5',valor:'',descTipo:'%' as '%'|'R$',descValor:'',manterDesconto:false})
  const [obsFinForm, setObsFinForm] = useState({parcelas:[] as number[], obs:'' })
  const [alterarValorForm, setAlterarValorForm] = useState({parcelas:[] as number[], eventoFiltro:'', novoValor:'', motivo:''})
  const [parcelasExcluidas, setParcelasExcluidas] = useState<any[]>([])
  const [modalItensExcluidos, setModalItensExcluidos] = useState(false)
  const [modalConsultaBaixa, setModalConsultaBaixa] = useState(false)
  const [modalObsAluno, setModalObsAluno] = useState(false)
  const [obsAlunoFin, setObsAlunoFin] = useState('')
  const [hasShownObs, setHasShownObs] = useState(false)
  const hasShownObsRef = useRef(false)
  useEffect(() => {
    if (step !== 4) return
    const obsAtual = obsAlunoFin || (alunoEditando as any)?.obsFinanceiro || ''
    if (obsAtual && !hasShownObsRef.current) {
      hasShownObsRef.current = true
      setHasShownObs(true)
      setModalObsAluno(true)
      if (obsAtual && !obsAlunoFin) setObsAlunoFin(obsAtual)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // Auto-save da observação financeira do aluno
  useEffect(() => {
    if (isInitializingRef.current) return
    if (alunoEditando && !salvando) {
      setAlunos(prev => prev.map(a =>
        a.id === alunoEditando.id ? { ...a, obsFinanceiro: obsAlunoFin } : a
      ))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obsAlunoFin, salvando])
  const [modalBoleto, setModalBoleto]       = useState(false)
  const [modalHistorico, setModalHistorico] = useState(false)
  const [modal2aVia, setModal2aVia]         = useState<import('@/lib/dataContext').Titulo | null>(null)
  // parcelas brutas selecionadas para emissão (shape original do financeiro do aluno)
  const [parcelasParaBoleto, setParcelasParaBoleto] = useState<any[]>([])
  // Legacy states (mantidos só para evitar erros em código existente que os referencia)
  const [boletoForm, setBoletoForm]         = useState({tipo:'1via',instrucao:'',multa:'2',juros:'0.033'})
  const [boletoEventosSel, setBoletoEventosSel] = useState<string[]>([])
  const [boletoConvenioId, setBoletoConvenioId] = useState<string>('')
  const [boletoModo, setBoletoModo]         = useState<'enviar'|'imprimir'>('enviar')
  const [manterDesconto, setManterDesconto] = useState(false)
  const [modalExcluirMotivo, setModalExcluirMotivo] = useState(false)
  const [excluirMotivo, setExcluirMotivo] = useState('')
  const [modalExcluirBaixa, setModalExcluirBaixa] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  const fmtMoeda = (v: number) => v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})
  const parseMoeda = (s: string|number) => {
    if (typeof s === 'number') return s;
    let str = String(s).replace(/[^\d.,-]/g, '');
    if (str.includes(',')) return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
    return parseFloat(str) || 0;
  }
  // Calcula juros (0,033%/dia) e multa (2% fixo máx) para parcelas vencidas - inclusive retroativas
  const calcAtraso = (parc:any, dataPagto?:string) => {
    if(!parc?.vencimento) return {juros:0,multa:0,dias:0}
    const dv=new Date(parc.vencimento.split('/').reverse().join('-')+'T12:00')
    const dp=dataPagto?new Date(dataPagto+'T12:00'):new Date();dp.setHours(12,0,0,0)
    const dias=Math.max(0,Math.floor((dp.getTime()-dv.getTime())/86400000))
    if(dias<=0) return {juros:0,multa:0,dias:0}
    const multa=+(parc.valor*0.02).toFixed(2)
    const juros=+(parc.valor*0.00033*dias).toFixed(2)
    return {juros,multa,dias}
  }

  const gerarParcelas = (): any[] => {
    const valor = parseMoeda(fin.valorMensalidade)
    const total = parseInt(fin.totalParcelas)||12
    const dia = parseInt(fin.diaVencimento)||10
    if (!valor || !total) return []
    const ano = parseInt(mat.anoLetivo) || new Date().getFullYear()
    const padrao = cfgPadroesPagamento.find(p=>p.id===fin.padraoId)
    const nomeEvento = padrao?.nome || 'Mensalidade'
    const novoEventoId = newId('EV')

    // ── Calcula desconto por parcela ──────────────────────────────────────────
    const descontoValorRaw = parseFloat(((fin as any).descontoValor||'0').replace(',','.')) || 0
    const descontoTipo = (fin as any).descontoTipo || 'R$'
    // Mesmo desconto aplicado em CADA parcela:
    // R$ → valor fixo por parcela  |  % → % sobre a mensalidade
    const descontoPorParcela = descontoValorRaw > 0
      ? descontoTipo === '%'
        ? +(valor * descontoValorRaw / 100).toFixed(2)
        : +descontoValorRaw.toFixed(2)
      : 0

    const novas: any[] = []
    for (let i=0; i<total; i++) {
      const d = new Date(ano, i, dia)
      const comp = d.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})
      const venc = d.toLocaleDateString('pt-BR')
      const valorFinal = +(valor - descontoPorParcela).toFixed(2)
      novas.push({
        num: i+1, competencia: comp, vencimento: venc,
        valor, desconto: descontoPorParcela, valorFinal,
        status:'pendente', obs:'', editando:false,
        evento:nomeEvento, eventoId:novoEventoId,
        codigo: String(Math.floor(100000 + Math.random() * 900000)),
        selected: true
      })
    }
    return novas
  }

  const gerarParcelasPreview = () => {
    const novas = gerarParcelas()
    if (novas.length) setParcelasPreview(novas)
  }

  const confirmarParcelas = () => {
    const pFinal = parcelasPreview.filter((p:any)=>p.selected)
    if(pFinal.length === 0) return

    // ── ADICIONA ao invés de substituir ─────────────────────────────────────
    // Renumera as novas parcelas continuando depois das existentes
    const maxNum = parcelas.length > 0 ? Math.max(...parcelas.map((p:any)=>p.num||0)) : 0
    const novasRenumeradas = pFinal.map((p: any, i: number) => ({
      ...p,
      num: maxNum + i + 1,
      // Garante código único para cada nova parcela
      codigo: p.codigo || String(Math.floor(100000 + Math.random() * 900000))
    }))

    setParcelas(prev => [...prev, ...novasRenumeradas])
    setParcelasConfirmadas(true)
    setParcelasPreview([])
    setModalMatricula(false)
    const totalFinal = parcelas.length + novasRenumeradas.length
    setToastMsg(`✅ ${novasRenumeradas.length} parcela(s) adicionadas ao financeiro! Total: ${totalFinal} parcela(s).`)
    setTimeout(() => setToastMsg(''), 4000)
  }

  const aplicarDesconto = () => {
    const v = parseMoeda(descAplicar.valor)
    const de = parseInt(descAplicar.deParcela)||1
    if(!v) return
    setParcelas(prev => prev.map(p => {
      if (p.num < de) return p
      const desc = descAplicar.tipo==='%' ? +(p.valor * v / 100).toFixed(2) : v
      const final = Math.max(0, +(p.valor - desc).toFixed(2))
      return {...p, desconto: desc, valorFinal: final}
    }))
  }

  const editParcela = (num: number, k: keyof Parcela, v: any) =>
    setParcelas(prev => prev.map(p => p.num===num ? {...p, [k]:v} : p))

  const recalcParcela = (num: number, campo: 'valor'|'desconto', raw: string) => {
    const val = parseMoeda(raw)
    setParcelas(prev => prev.map(p => {
      if (p.num !== num) return p
      const novoValor = campo==='valor' ? val : p.valor
      const novoDesc = campo==='desconto' ? val : p.desconto
      return {...p, valor:novoValor, desconto:novoDesc, valorFinal:Math.max(0,+(novoValor-novoDesc).toFixed(2))}
    }))
  }

  // Auto-fill financeiro quando selecionar padrão
  const padraoSel = cfgPadroesPagamento.find(p=>p.id===fin.padraoId)
  const grupoSel = cfgGruposDesconto.find(g=>g.id===fin.grupoDescontoId)

  const handlePadrao = (id: string) => {
    const p = cfgPadroesPagamento.find(x=>x.id===id)
    if(p) setFin(f=>({...f, padraoId:id, valorMensalidade: String(p.anuidade/(p.totalParcelas||1)), diaVencimento: String(p.diaVencimento), totalParcelas: String(p.totalParcelas)}))
    else setFin(f=>({...f, padraoId:id}))
  }

  // Turmas filtradas por ano
  const turmasFiltradas = turmas.filter(t=>t.ano===Number(mat.anoLetivo)||!t.ano)

  // Validações por step
  const cpfsExist = alunos.map(a=>a.cpf).filter(Boolean)

  // ── Motor de substituição de máscaras (espelha documentos/page.tsx) ──────────
  const buildAlunoObj = useCallback(() => {
    const turmaSel = turmas.find(t=>t.id===mat.turmaId)
    const respPed = todosResp.find(r=>r.respPedagogico)
    const endStr = [aluno.endereco.logradouro, aluno.endereco.numero && `nº ${aluno.endereco.numero}`, aluno.endereco.complemento, aluno.endereco.bairro, aluno.endereco.cidade && `${aluno.endereco.cidade}/${aluno.endereco.estado}`].filter(Boolean).join(', ')
    return {
      // Campos usados pelos mapeamentos (fonte: 'aluno')
      nome: aluno.nome,
      cpf: aluno.cpf,
      rg: '',
      matricula: numMatricula,
      dataNascimento: aluno.dataNasc,
      email: aluno.email,
      telefone: aluno.celular,
      responsavel: respPed?.nome ?? mae.nome,
      nomeResponsavel: respPed?.nome ?? mae.nome,
      telefoneResponsavel: respPed?.celular ?? mae.celular,
      endereco: endStr,
      turma: turmaSel?.nome ?? '',
      situacao: 'Matriculado',
      naturalidade: aluno.naturalidade,
      sexo: aluno.sexo,
      racaCor: aluno.racaCor,
      nacionalidade: aluno.nacionalidade,
      uf: aluno.uf,
      // Turma object para mapeamentos fonte:'turma'
      _turma: turmaSel,
    }
  }, [aluno, mat, todosResp, turmas, numMatricula, mae])

  // MAPA_INTERNO idêntico ao de documentos/page.tsx
  const MAPA_INT: Record<string,(a:any,t:any)=>string> = {
    '<<aluno>>':           (a) => a?.nome ?? '',
    '<<nome_completo>>':   (a) => a?.nome ?? '',
    '<<cpf_aluno>>':       (a) => a?.cpf ?? '',
    '<<rg_aluno>>':        (a) => a?.rg ?? '',
    '<<data_nascimento>>': (a) => a?.dataNascimento ? new Date(a.dataNascimento+'T12:00').toLocaleDateString('pt-BR') : '',
    '<<responsavel>>':     (a) => a?.responsavel ?? a?.nomeResponsavel ?? '',
    '<<turma>>':           (_,t) => t?.nome ?? '',
    '<<serie>>':           (_,t) => t?.serie ?? t?.nome ?? '',
    '<<segmento>>':        (_,t) => t?.segmento ?? '',
    '<<turno>>':           (_,t) => t?.turno ?? '',
    '<<ano_letivo>>':      (_,t) => t?.anoLetivo ?? String(new Date().getFullYear()),
    '<<data_hoje>>':       () => new Date().toLocaleDateString('pt-BR'),
    '<<data_extenso>>':    () => new Date().toLocaleDateString('pt-BR', {dateStyle:'long' as const}),
    '<<mes_atual>>':       () => new Date().toLocaleDateString('pt-BR', {month:'long' as const}),
    '<<ano_atual>>':       () => String(new Date().getFullYear()),
    '<<unidade>>':         () => 'Colégio Impacto',
    '<<cidade>>':          () => '',
    '<<matricula>>':       (a) => a?.matricula ?? '',
    '<<email_aluno>>':     (a) => a?.email ?? '',
    '<<telefone_resp>>':   (a) => a?.telefoneResponsavel ?? a?.telefone ?? '',
    '<<endereco>>':        (a) => a?.endereco ?? '',
    '<<situacao>>':        (a) => a?.situacao ?? '',
    '<<naturalidade>>':    (a) => a?.naturalidade ?? '',
    '<<sexo>>':            (a) => a?.sexo ?? '',
    '<<raca_cor>>':        (a) => a?.racaCor ?? '',
    '<<nacionalidade>>':   (a) => a?.nacionalidade ?? '',
  }

  const substituirTexto = useCallback((texto: string): string => {
    const alunoObj = buildAlunoObj()
    const turmaObj = alunoObj._turma
    let result = texto
    // 1. Mapeamentos do usuário (fonte configurada em Config. Pedagógico → Documentos → Mapear)
    for (const map of mapeamentos) {
      const cod: string = map.codigoMascara
      let val = ''
      if (map.fonte === 'fixo') {
        val = map.valorFixo ?? ''
      } else if (map.fonte === 'data') {
        const dataMap: Record<string,string> = {
          data_hoje: new Date().toLocaleDateString('pt-BR'),
          data_extenso: new Date().toLocaleDateString('pt-BR', {dateStyle:'long' as const}),
          mes_atual: new Date().toLocaleDateString('pt-BR', {month:'long' as const}),
          ano_atual: String(new Date().getFullYear()),
        }
        val = dataMap[map.campo] ?? ''
      } else if (map.fonte === 'aluno') {
        val = (alunoObj as any)[map.campo] ?? ''
      } else if (map.fonte === 'turma') {
        val = (turmaObj as any)?.[map.campo] ?? ''
      } else if (map.fonte === 'escola') {
        const escolaMap: Record<string,string> = { unidade:'Colégio Impacto', cidade:'', estado:'', cnpj:'', diretor:'', secretaria:'' }
        val = escolaMap[map.campo] ?? ''
      }
      if (val) result = result.split(cod).join(val)
    }
    // 2. Fallback MAPA_INTERNO
    for (const [cod, fn] of Object.entries(MAPA_INT)) {
      result = result.split(cod).join(fn(alunoObj, turmaObj))
    }
    return result
  }, [buildAlunoObj, mapeamentos, MAPA_INT])

  const gerarDocumento = useCallback(async (doc: any) => {
    setGerandoDoc(doc.id)
    try {
      const alunoObj = buildAlunoObj()
      const turmaObj = alunoObj._turma

      if (doc.arquivoBase64) {
        // ── Modo DOCX: docxtemplater ───────────────────────────────────────────
        const PizZip = (await import('pizzip')).default
        const Docxtemplater = (await import('docxtemplater')).default
        const binaryStr = atob(doc.arquivoBase64)
        const bytes = new Uint8Array(binaryStr.length)
        for (let i=0; i<binaryStr.length; i++) bytes[i]=binaryStr.charCodeAt(i)
        const zip = new PizZip(bytes)
        const docxDoc = new Docxtemplater(zip, {
          delimiters:{start:'<<',end:'>>'},
          paragraphLoop:true, linebreaks:true,
          nullGetter: () => ''   // mascara não mapeada → string vazia
        })
        // Constrói data completo = mapeamentos do usuário + MAPA_INTERNO fallback
        const data: Record<string,string> = {}
        // 2. Fallback MAPA_INTERNO (sem <<>>)
        for (const [cod, fn] of Object.entries(MAPA_INT)) {
          const key = cod.replace(/<<|>>/g, '')
          if (!data[key]) data[key] = fn(alunoObj, turmaObj) ?? ''
        }
        // 1. Mapeamentos do usuário (sobrescreve fallback)
        for (const map of mapeamentos) {
          const key = map.codigoMascara.replace(/<<|>>/g, '')
          let val = ''
          if (map.fonte === 'fixo') {
            val = map.valorFixo ?? ''
          } else if (map.fonte === 'data') {
            const dataMap: Record<string,string> = {
              data_hoje: new Date().toLocaleDateString('pt-BR'),
              data_extenso: new Date().toLocaleDateString('pt-BR', {dateStyle:'long' as const}),
              mes_atual: new Date().toLocaleDateString('pt-BR', {month:'long' as const}),
              ano_atual: String(new Date().getFullYear()),
            }
            val = dataMap[map.campo] ?? ''
          } else if (map.fonte === 'aluno') {
            val = (alunoObj as any)[map.campo] ?? ''
          } else if (map.fonte === 'turma') {
            val = (turmaObj as any)?.[map.campo] ?? ''
          } else if (map.fonte === 'escola') {
            const em: Record<string,string> = { unidade:'Colégio Impacto', cidade:'', estado:'', cnpj:'', diretor:'', secretaria:'' }
            val = em[map.campo] ?? ''
          }
          data[key] = val
        }
        docxDoc.setData(data)
        docxDoc.render()
        const output = docxDoc.getZip().generate({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})
        const url = URL.createObjectURL(output)
        const a = document.createElement('a')
        a.href = url; a.download = `${doc.nome} - ${aluno.nome}.docx`; a.click()
        URL.revokeObjectURL(url)
      } else {
        // ── Modo texto: janela de impressão ───────────────────────────────────
        const conteudo = substituirTexto(doc.templateTexto ?? '')
        const win = window.open('','_blank')
        if (!win) { alert('Permita pop-ups para gerar o documento.'); return }
        win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${doc.nome}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Georgia,serif;font-size:12pt;color:#000;background:#fff}@page{size:A4;margin:2cm}.wrap{max-width:800px;margin:0 auto}.title{font-size:16pt;font-weight:bold;text-align:center;margin-bottom:24pt}.body{line-height:1.9;white-space:pre-wrap}.footer{margin-top:40pt;display:flex;justify-content:space-between;font-size:10pt;color:#444;border-top:1px solid #ccc;padding-top:8pt}</style></head>
<body><div class="wrap"><div class="title">${doc.nome}</div><div class="body">${conteudo.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br/>')}</div><div class="footer"><span>IMPACTO EDU   ${aluno.nome}   Matrícula ${numMatricula}</span><span>${new Date().toLocaleDateString('pt-BR')}</span></div></div><script>window.onload=function(){setTimeout(function(){window.print()},500)}<\/script></body></html>`)
        win.document.close()
      }
    } catch(err) {
      console.error('Erro ao gerar documento:', err)
      alert(`Erro ao gerar "${doc.nome}".\n\nPara .docx: verifique se o arquivo enviado é um .docx válido.\nErro: ${(err as Error)?.message ?? err}`)
    } finally {
      setGerandoDoc(null)
    }
  }, [buildAlunoObj, substituirTexto, mapeamentos, MAPA_INT, aluno, numMatricula])
  const canNext = true

  const handleAplicarAlteracaoValor = () => {
    const nv = parseMoeda(alterarValorForm.novoValor);
    if (!nv || alterarValorForm.parcelas.length === 0) return;
    setParcelas(prev => prev.map(p => {
      if (alterarValorForm.parcelas.includes(p.num)) {
        const t = (p as any).descTipo, r = (p as any).descRaw;
        const d = (t === '%' && r) ? +(nv * r / 100).toFixed(2) : p.desconto;
        return {
          ...p,
          valor: nv,
          desconto: d,
          valorFinal: Math.max(0, nv - d),
          obs: alterarValorForm.motivo ? (p.obs ? p.obs + ' | ' + alterarValorForm.motivo : alterarValorForm.motivo) : p.obs
        };
      }
      return p;
    }));
    setModalAlterarValor(false);
  };

  const handleFinalizar = async () => {
    setSalvando(true)
    await new Promise(r=>setTimeout(r,700))
    // Resolve turmaId: mat.turmaId ou fallback no histórico
    const turmaIdEfetivo2 = mat.turmaId ||
      (historico.find((h:any)=>h.situacao==='Cursando') || historico[historico.length-1])?.turmaId || ''
    const turmaSel = turmas.find(t=>t.id===turmaIdEfetivo2)
    const respPed = todosResp.find(r=>r.respPedagogico)
    const payload = {
      nome:aluno.nome,
      matricula: isEdicao ? (alunoEditando as any).matricula : numMatricula,
      turma:turmaSel?.nome??'', serie:turmaSel?.serie??'',
      turno:mat.turno||(turmaSel?.turno??''), status:'matriculado' as const,
      email:aluno.email, cpf:aluno.cpf, dataNascimento:aluno.dataNasc,
      responsavel:respPed?.nome??mae.nome, telefone:respPed?.celular??mae.celular,
      inadimplente: isEdicao ? ((alunoEditando as any).inadimplente ?? false) : false,
      risco_evasao:(isEdicao ? ((alunoEditando as any).risco_evasao ?? 'baixo') : 'baixo') as 'baixo'|'medio'|'alto',
      media: isEdicao ? (alunoEditando as any).media : null,
      frequencia: isEdicao ? ((alunoEditando as any).frequencia ?? 100) : 100,
      obs:saude.obs, unidade: isEdicao ? ((alunoEditando as any).unidade ?? '') : '',
      foto:aluno.foto,
      racaCor:aluno.racaCor, sexo:aluno.sexo, naturalidade:aluno.naturalidade,
      uf:aluno.uf, nacionalidade:aluno.nacionalidade, endereco:aluno.endereco,
      filiacaoMae: aluno.filiacaoMae, filiacaoPai: aluno.filiacaoPai,
      idCenso: aluno.idCenso, codigo: aluno.codigo,
      // ── Dados completos para preservar no modo edição ──
      responsaveis: todosResp,
      saude: saude,
      dadosMatricula: mat,
      historicoMatriculas: historico,
      configFinanceiro: { ...fin },
      parcelas: parcelas,
      obsFinanceiro: obsAlunoFin,
      turmaId:turmaIdEfetivo2,
    }
    if (isEdicao) {
      setAlunos(prev => prev.map(a => a.id === editId ? { ...a, ...payload } : a))
      logSystemAction('Acadêmico (Alunos)', 'Edição', `Atualização da matrícula/dados de ${payload.nome}`, { registroId: payload.codigo, nomeRelacionado: payload.nome, detalhesDepois: payload })
    } else {
      const novoId = autoSaveIdRef.current || `ALU${Date.now()}`
      autoSaveIdRef.current = novoId
      setAlunos(prev => {
        const existe = prev.some(a => a.id === novoId)
        if (existe) {
          return prev.map(a => a.id === novoId ? { ...a, ...payload } : a)
        }
        return [...prev, { id: novoId, ...payload }]
      })
      logSystemAction('Acadêmico (Alunos)', 'Cadastro', `Nova matrícula: ${payload.nome}`, { registroId: payload.codigo, nomeRelacionado: payload.nome, detalhesDepois: payload })
      // Vincular parcelas geradas ao aluno recém-criado
      if (parcelas.length > 0) {
        const parcsVinculadas = parcelas.map(p => ({
          id: `TIT${Date.now()}-${p.num}`,
          alunoId: novoId,
          aluno: aluno.nome,
          responsavel: todosResp.find(r => r.respFinanceiro)?.nome ?? mae.nome,
          descricao: p.evento || 'Mensalidade',
          eventoId: p.eventoId || newId('EV'),
          eventoDescricao: p.evento || 'Mensalidade',
          competencia: p.competencia || '',
          vencimento: p.vencimento ? p.vencimento.split('/').reverse().join('-') : '',
          valor: p.valor,
          desconto: p.desconto || 0,
          status: p.status === 'pendente' ? 'pendente' as const : (p.status as any) || 'pendente' as const,
          pagamento: p.dtPagto || null,
          metodo: p.formaPagto || 'Boleto',
          turma: payload.turma,
          obs: p.obs || '',
        }))
        setTitulos(prev => [...prev, ...(parcsVinculadas as any[])])
      }
    }
    setSalvando(false)
    router.push('/academico/alunos')
  }

  // ── Auto-save ao trocar de step (steps 0-3) ───────────────────────────────
  const autoSaveIdRef = useRef<string|null>(isEdicao ? editId : null)
  const [autoSaveMsg, setAutoSaveMsg] = useState('')

  // ── Secretaria Escolar: sincroniza aluno ↔ turma ────────────────────────────
  // Chamado sempre que o histórico de matrículas é salvo.
  // Regra:  se houver item com situação "Cursando" → vincula o aluno à turma
  //         se NÃO houver "Cursando" → remove o aluno da turma (ex: Desistente)
  const sincronizarTurmaAluno = useCallback((hist: typeof historico) => {
    const alunoIdAtual = autoSaveIdRef.current || (isEdicao ? editId : null)
    if (!alunoIdAtual) return // aluno ainda não criado

    const cursando = hist.find((h: any) => h.situacao === 'Cursando')

    if (cursando?.turmaId) {
      // Encontrou matrícula ativa → vincula na turma
      const turmaSel = turmas.find(t => t.id === cursando.turmaId)
      if (!turmaSel) return
      setAlunos((prev: any[]) => prev.map(a =>
        a.id === alunoIdAtual
          ? {
              ...a,
              turma: turmaSel.nome,
              turmaId: turmaSel.id,
              serie: turmaSel.serie ?? a.serie,
              turno: cursando.turno || turmaSel.turno || a.turno,
              status: 'matriculado',
            }
          : a
      ))
      // Sync estado local mat também
      setMat((m: any) => ({ ...m, turmaId: turmaSel.id, turno: cursando.turno || turmaSel.turno || m.turno }))
    } else {
      // Nenhum "Cursando" → aluno saiu de todas as turmas
      setAlunos((prev: any[]) => prev.map(a =>
        a.id === alunoIdAtual
          ? { ...a, turma: '', turmaId: '' }
          : a
      ))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turmas, isEdicao, editId])

  const autoSalvar = useCallback(() => {
    // ── Guard: não salvar registros sem nome do aluno E sem responsável ──────
    const temNomeAluno = (aluno.nome || '').trim().length >= 1
    const temNomeResp = todosResp.some(r => (r.nome || '').trim().length >= 1)
    if (!temNomeAluno && !temNomeResp) return   // nada preenchido ainda, ignora

    // Resolve turmaId: mat.turmaId ou fallback no histórico
    const turmaIdEfetivo = mat.turmaId ||
      (historico.find((h:any)=>h.situacao==='Cursando') || historico[historico.length-1])?.turmaId || ''
    // Resolve status: se tiver matrícula Cursando → matriculado, senão em_cadastro
    const statusAtual = isEdicao
      ? ((alunoEditando as any).status ?? 'matriculado')
      : (historico.some((h: any) => h.situacao === 'Cursando') ? 'matriculado' : 'em_cadastro')

    const turmaSel = turmas.find(t=>t.id===turmaIdEfetivo)
    const respPed = todosResp.find(r=>r.respPedagogico)
    const payload = {
      nome: aluno.nome || '',
      matricula: isEdicao ? (alunoEditando as any).matricula : numMatricula,
      turma:turmaSel?.nome??'', serie:turmaSel?.serie??'',
      turno:mat.turno||(turmaSel?.turno??''), status: statusAtual as any,
      email:aluno.email, cpf:aluno.cpf, dataNascimento:aluno.dataNasc,
      responsavel:respPed?.nome??mae.nome, telefone:respPed?.celular??mae.celular,
      inadimplente: isEdicao ? ((alunoEditando as any).inadimplente ?? false) : false,
      risco_evasao:(isEdicao ? ((alunoEditando as any).risco_evasao ?? 'baixo') : 'baixo') as any,
      media: isEdicao ? (alunoEditando as any).media : null,
      frequencia: isEdicao ? ((alunoEditando as any).frequencia ?? 100) : 100,
      obs:saude.obs, unidade: isEdicao ? ((alunoEditando as any).unidade ?? '') : '',
      foto:aluno.foto,
      racaCor:aluno.racaCor, sexo:aluno.sexo, naturalidade:aluno.naturalidade,
      uf:aluno.uf, nacionalidade:aluno.nacionalidade, endereco:aluno.endereco,
      filiacaoMae:aluno.filiacaoMae, filiacaoPai:aluno.filiacaoPai,
      idCenso:aluno.idCenso, codigo:aluno.codigo,
      responsaveis:todosResp,
      saude:saude,
      dadosMatricula:mat,
      historicoMatriculas:historico,
      configFinanceiro:{...fin},
      parcelas:parcelas,
      obsFinanceiro:obsAlunoFin,
      turmaId:turmaIdEfetivo,
    }
    if (isEdicao && editId) {
      setAlunos(prev => prev.map(a => a.id === editId ? {...a, ...payload} : a))
      // Integração Mock API
      fetch(`/api/alunos/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(console.error)
    } else {
      // Nova matrícula: upsert usando id estável gerado na primeira vez
      if (!autoSaveIdRef.current) autoSaveIdRef.current = `ALU${Date.now()}`
      const sid = autoSaveIdRef.current
      setAlunos(prev => {
        // 1. Busca por ID estável
        const existsById = prev.some(a => a.id === sid)
        if (existsById) return prev.map(a => a.id === sid ? {...a, ...payload} : a)

        // 2. Segurança anti-duplicatas: busca por mesma matrícula com ID diferente
        const duplicata = prev.find(a => a.matricula === payload.matricula && a.id !== sid)
        if (duplicata) {
          // Reutiliza o ID existente e remove o fantasma (se houver)
          autoSaveIdRef.current = duplicata.id
          return prev
            .filter(a => a.id !== sid) // remove eventual fantasma com outro ID
            .map(a => a.id === duplicata.id ? {...a, ...payload} : a)
        }

        // 3. Cria novo registro
        return [...prev, {id: sid, ...payload}]
      })
      // Integração Mock API
      fetch('/api/alunos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, id: sid }) }).catch(console.error)
    }
    setAutoSaveMsg('✅ Dados salvos')
    setTimeout(() => setAutoSaveMsg(''), 2500)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mae, pai, outro1, outro2, aluno, saude, mat, fin, parcelas, historico, obsAlunoFin])

  // ── Dispara save ao avançar de step ──────────────────────────────────────
  // Atribuição direta ao ref durante render (padrão React recomendado para manter
  // ref em sync sem useEffect, que causava "setState during render" warning).
  const autoSalvarRef = useRef(autoSalvar)
  autoSalvarRef.current = autoSalvar  // ✅ atualiza o ref na fase de render (permitido para refs)

  // Refs para ler valores frescos dentro do step-effect sem closure stale
  const todosRespRef = useRef(todosResp)
  todosRespRef.current = todosResp
  const nomeAlunoRef = useRef(aluno.nome)
  nomeAlunoRef.current = aluno.nome

  const prevStepRef = useRef(step)
  useEffect(() => {
    const leaving = prevStepRef.current
    prevStepRef.current = step
    if (leaving === step || leaving > 3) return

    // Regras por step (lê valores atuais via refs — sem closure stale):
    if (leaving === 0) {
      // Saindo do step de Responsáveis → salva se ao menos 1 responsável tem nome
      const temResp = todosRespRef.current.some(r => (r.nome || '').trim().length >= 1)
      if (temResp) autoSalvarRef.current()
    } else {
      // Saindo dos steps 1-3 (Aluno, Saúde, Matrícula) → salva se aluno tem nome
      if ((nomeAlunoRef.current || '').trim().length >= 1) autoSalvarRef.current()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // Todos os responsáveis já cadastrados no sistema (para busca)
  const allResps: Resp[] = useMemo(() => {
    const found: Resp[] = []
    const seenCpf = new Set<string>()
    for (const a of alunos) {
      const resps = (a as any).responsaveis
      if (Array.isArray(resps)) {
        for (const r of resps) {
          const cpfKey = r.cpf?.replace(/\D/g,'') || r.nome
          if (cpfKey && !seenCpf.has(cpfKey)) {
            seenCpf.add(cpfKey)
            found.push(r as Resp)
          }
        }
      }
    }
    return found
  }, [alunos])
  const stepContent = [
    // STEP 0: Responsáveis
    <div key="s0">
      <div style={{padding:'12px 16px',background:'rgba(99,102,241,0.06)',border:'1px solid rgba(99,102,241,0.2)',borderRadius:10,marginBottom:16,fontSize:12}}>
        <strong style={{color:'#818cf8'}}>Passo 1 — Responsáveis</strong> · Preencha mãe e pai (obrigatório). CPF será validado. Defina Responsável Pedagógico e Financeiro.
      </div>
      <RespCard resp={mae} onChange={setMae} cpfExistentes={cpfsExist} allResps={allResps}/>
      <RespCard resp={pai} onChange={setPai} cpfExistentes={cpfsExist} allResps={allResps}/>
      {showOutro1 ? <RespCard resp={outro1} onChange={setOutro1} cpfExistentes={cpfsExist} allResps={allResps}/> : (
        <button className="btn btn-secondary btn-sm" style={{marginBottom:8}} onClick={()=>setShowOutro1(true)}><Plus size={13}/>Adicionar Outro Responsável</button>
      )}
      {showOutro1 && (showOutro2 ? <RespCard resp={outro2} onChange={setOutro2} cpfExistentes={cpfsExist} allResps={allResps}/> : (
        <button className="btn btn-secondary btn-sm" onClick={()=>setShowOutro2(true)}><Plus size={13}/>Adicionar Outro Responsável 2</button>
      ))}
    </div>,

    // STEP 1: Dados do Aluno
    <div key="s1" style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{padding:'12px 16px',background:'rgba(59,130,246,0.06)',border:'1px solid rgba(59,130,246,0.2)',borderRadius:10,fontSize:12}}>
        <strong style={{color:'#60a5fa'}}>Passo 2 — Dados do Aluno</strong>
      </div>
      <div className="card" style={{padding:16,display:'flex',flexDirection:'column',gap:12}}>
        {/* ── Foto do Aluno ── */}
        <div style={{display:'flex',alignItems:'center',gap:20,padding:'4px 0 16px',borderBottom:'1px solid hsl(var(--border-subtle))',marginBottom:4}}>
          <div
            onClick={()=>fotoInputRef.current?.click()}
            title="Clique para enviar ou trocar foto"
            style={{
              width:96,height:96,borderRadius:16,flexShrink:0,cursor:'pointer',
              position:'relative',overflow:'hidden',
              background:aluno.foto?'transparent':'linear-gradient(135deg,rgba(99,102,241,0.1),rgba(59,130,246,0.06))',
              border:`2px ${aluno.foto?'solid':'dashed'} ${aluno.foto?'rgba(99,102,241,0.5)':'rgba(99,102,241,0.3)'}`,
              display:'flex',alignItems:'center',justifyContent:'center',
              transition:'all 0.2s',
              boxShadow:aluno.foto?'0 8px 24px rgba(99,102,241,0.2)':'none',
            }}
          >
            {aluno.foto ? (
              <img src={aluno.foto} alt="Foto do aluno" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
            ) : (
              <div style={{textAlign:'center',pointerEvents:'none',display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                <Camera size={24} color="rgba(99,102,241,0.5)"/>
                <div style={{fontSize:9,color:'hsl(var(--text-muted))',fontWeight:700,letterSpacing:.8,textTransform:'uppercase'}}>Foto</div>
              </div>
            )}
          </div>
          <div style={{flex:1}}>
            <div style={{fontWeight:800,fontSize:14,marginBottom:3}}>📸 Foto do Aluno</div>
            <div style={{fontSize:11,color:'hsl(var(--text-muted))',marginBottom:12,lineHeight:1.6}}>
              JPG, PNG ou WebP · Máx 5MB<br/>
              Utilizada na ficha, cartão e documentos.
            </div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{background:'linear-gradient(135deg,#6366f1,#3b82f6)',fontSize:12,gap:6}}
                onClick={()=>fotoInputRef.current?.click()}
              >
                <Camera size={13}/> {aluno.foto?'Trocar Foto':'Enviar Foto'}
              </button>
              {aluno.foto && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{fontSize:12,color:'#f87171',border:'1px solid rgba(248,113,113,0.3)'}}
                  onClick={()=>updA('foto','')}
                >
                  <X size={12}/> Remover
                </button>
              )}
            </div>
          </div>
          {aluno.foto && (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,padding:'8px 12px',background:'rgba(16,185,129,0.06)',border:'1px solid rgba(16,185,129,0.2)',borderRadius:10}}>
              <CheckCircle size={18} color="#10b981"/>
              <div style={{fontSize:10,fontWeight:700,color:'#10b981'}}>Foto OK</div>
            </div>
          )}
          <input ref={fotoInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleFotoUpload}/>
        </div>
        {/* IDs */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:10}}>
          <F label="Código">
            <input className="form-input" value={aluno.codigo} readOnly style={{fontFamily:'monospace',background:'hsl(var(--bg-overlay))',cursor:'not-allowed'}}/>
          </F>
          <F label="CPF"><CPFInput value={aluno.cpf} onChange={v=>updA('cpf',v)} existentes={cpfsExist}/></F>
          <F label="ID Censo"><input className="form-input" value={aluno.idCenso} onChange={e=>updA('idCenso',e.target.value)}/></F>
          <F label="RGA (auto)">
            <input className="form-input" value={rgaAluno} readOnly style={{fontFamily:'monospace',background:'hsl(var(--bg-overlay))',cursor:'not-allowed'}}/>
          </F>
        </div>
        {/* Nome */}
        <F label="Nome Completo"><input className="form-input" value={aluno.nome} onChange={e=>updA('nome',e.target.value)}/></F>
        {/* Nascimento + idade */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr',gap:10}}>
          <div>
            <F label="Data de Nascimento"><input className="form-input" type="date" value={aluno.dataNasc} onChange={e=>updA('dataNasc',e.target.value)}/></F>
            {aluno.dataNasc && <div style={{fontSize:11,color:'#10b981',marginTop:3,fontWeight:700}}>{calcIdade(aluno.dataNasc)}</div>}
          </div>
          <F label="Sexo">
            <select className="form-input" value={aluno.sexo} onChange={e=>updA('sexo',e.target.value)}>
              <option value="">Selecione</option>{SEXOS.map(s=><option key={s}>{s}</option>)}
            </select>
          </F>
          <F label="Estado Civil">
            <select className="form-input" value={aluno.estadoCivil} onChange={e=>updA('estadoCivil',e.target.value)}>
              <option value="">Selecione</option>{ESTADOS_CIVIS.map(s=><option key={s}>{s}</option>)}
            </select>
          </F>
          <F label="Cor/Raça">
            <select className="form-input" value={aluno.racaCor} onChange={e=>updA('racaCor',e.target.value)}>
              <option value="">Selecione</option>
              {['Branca','Preta','Parda','Amarela','Indígena','Não Declarada'].map(s=><option key={s}>{s}</option>)}
            </select>
          </F>
          <F label="Nacionalidade"><input className="form-input" value={aluno.nacionalidade} onChange={e=>updA('nacionalidade',e.target.value)}/></F>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
          <F label="Naturalidade"><input className="form-input" value={aluno.naturalidade} onChange={e=>updA('naturalidade',e.target.value)}/></F>
          <F label="UF">
            <select className="form-input" value={aluno.uf} onChange={e=>updA('uf',e.target.value)}>
              <option value=""></option>{UFS.map(u=><option key={u}>{u}</option>)}
            </select>
          </F>
          <F label="E-mail"><input className="form-input" type="email" value={aluno.email} onChange={e=>updA('email',e.target.value)}/></F>
        </div>
        <F label="Celular"><input className="form-input" value={aluno.celular} onChange={e=>updA('celular',fmtPhone(e.target.value))} style={{maxWidth:200}}/></F>
        {/* Filiação com busca */}
        <div style={{padding:'12px 14px',background:'hsl(var(--bg-elevated))',borderRadius:8,border:'1px solid hsl(var(--border-subtle))'}}>
          <div style={{fontWeight:700,fontSize:12,marginBottom:10,color:'hsl(var(--text-muted))'}}>📎 FILIAÇÃO</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <FiliacaoInput label="Filiação — Mãe" respList={todosResp} value={aluno.filiacaoMae||mae.nome} onChange={v=>updA('filiacaoMae',v)}/>
            <FiliacaoInput label="Filiação — Pai" respList={todosResp} value={aluno.filiacaoPai||pai.nome} onChange={v=>updA('filiacaoPai',v)}/>
          </div>
        </div>
        {/* Endereço */}
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <span style={{fontWeight:700,fontSize:12,color:'hsl(var(--text-muted))'}}>🏠 ENDEREÇO</span>
            <div style={{display:'flex',gap:6}}>
              {todosResp.filter(r=>r.nome).map(r=>(
                <button key={r.id} type="button" className="btn btn-secondary btn-sm" onClick={()=>updA('endereco',{...r.endereco})}>
                  <Copy size={11}/> {r.parentesco}
                </button>
              ))}
            </div>
          </div>
          <EnderecoSection end={aluno.endereco} onChange={e=>updA('endereco',e)}/>
        </div>
      </div>
    </div>,

    // STEP 2: Saúde
    <div key="s2" style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{padding:'12px 16px',background:'rgba(16,185,129,0.06)',border:'1px solid rgba(16,185,129,0.2)',borderRadius:10,fontSize:12}}>
        <strong style={{color:'#34d399'}}>Passo 3 — Saúde & Observações</strong>
      </div>
      <div className="card" style={{padding:16,display:'flex',flexDirection:'column',gap:12}}>
        <div style={{fontWeight:700,fontSize:12,color:'#34d399'}}>🏥 Informações Médicas</div>
        <div style={{display:'grid',gridTemplateColumns:'160px 1fr 1fr',gap:10}}>
          <F label="Tipo Sanguíneo">
            <select className="form-input" value={saude.tipoSanguineo} onChange={e=>setSaude(s=>({...s,tipoSanguineo:e.target.value}))}>
              <option value="">Não sei</option>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(t=><option key={t}>{t}</option>)}
            </select>
          </F>
          <F label="Alergias"><input className="form-input" value={saude.alergias} onChange={e=>setSaude(s=>({...s,alergias:e.target.value}))} placeholder="Alimentos, medicamentos, látex..."/></F>
          <F label="Deficiências (CID)"><input className="form-input" value={saude.deficiencias} onChange={e=>setSaude(s=>({...s,deficiencias:e.target.value}))} placeholder="Ex: F84.0, H54.0"/></F>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <F label="Medicamentos em Uso"><textarea className="form-input" rows={2} value={saude.medicamentos} onChange={e=>setSaude(s=>({...s,medicamentos:e.target.value}))} placeholder="Nome, dosagem e horário..."/></F>
          <F label="Necessidades Especiais / NEE"><textarea className="form-input" rows={2} value={saude.necessidades} onChange={e=>setSaude(s=>({...s,necessidades:e.target.value}))} placeholder="Descreva as necessidades..."/></F>
        </div>
        <div style={{display:'flex',gap:20,padding:'10px 14px',background:'hsl(var(--bg-overlay))',borderRadius:8}}>
          <label style={{display:'flex',alignItems:'center',gap:7,cursor:'pointer',fontSize:13}}>
            <input type="checkbox" checked={saude.autorizaImagem} onChange={e=>setSaude(s=>({...s,autorizaImagem:e.target.checked}))}/>
            Autorizo uso de imagem
          </label>
        </div>
        <F label="Observações Gerais"><textarea className="form-input" rows={3} value={saude.obs} onChange={e=>setSaude(s=>({...s,obs:e.target.value}))} placeholder="Informações adicionais relevantes para a escola..."/></F>
      </div>

      {/* ── Card: Autorizados a Retirar ── */}
      <div className="card" style={{padding:0,overflow:'hidden',border:'1px solid rgba(99,102,241,0.25)'}}>
        {/* Header com toggle de saída independente */}
        <div style={{padding:'14px 18px',background:'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(139,92,246,0.04))',borderBottom:'1px solid rgba(99,102,241,0.15)',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:36,height:36,borderRadius:10,background:'rgba(99,102,241,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>👥</div>
            <div>
              <div style={{fontWeight:800,fontSize:14}}>Autorizados a Retirar o Aluno</div>
              <div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>Pessoas autorizadas a retirar o aluno da escola</div>
            </div>
          </div>
          {/* Toggle: Saída Independente */}
          <button
            type="button"
            onClick={()=>setSaude(s=>({...s,autorizaSaida:!s.autorizaSaida}))}
            style={{
              display:'flex',alignItems:'center',gap:10,padding:'10px 16px',borderRadius:24,cursor:'pointer',
              border:`1.5px solid ${saude.autorizaSaida?'rgba(16,185,129,0.55)':'rgba(239,68,68,0.45)'}`,
              background:saude.autorizaSaida?'rgba(16,185,129,0.1)':'rgba(239,68,68,0.08)',
              transition:'all 0.2s',outline:'none',
            }}
          >
            {/* Pill switch */}
            <div style={{width:40,height:22,borderRadius:11,position:'relative',background:saude.autorizaSaida?'#10b981':'#ef4444',transition:'background 0.25s',flexShrink:0}}>
              <div style={{position:'absolute',top:3,left:saude.autorizaSaida?21:3,width:16,height:16,borderRadius:'50%',background:'#fff',transition:'left 0.22s cubic-bezier(.34,1.56,.64,1)',boxShadow:'0 1px 4px rgba(0,0,0,0.3)'}}/>
            </div>
            <div style={{textAlign:'left'}}>
              <div style={{fontSize:11,fontWeight:800,color:saude.autorizaSaida?'#34d399':'#f87171',lineHeight:1.2}}>
                {saude.autorizaSaida?'✅ PODE sair sozinho':'🚫 NÃO pode sair sozinho'}
              </div>
              <div style={{fontSize:9,color:'hsl(var(--text-muted))',marginTop:1,letterSpacing:.3}}>SAÍDA INDEPENDENTE — clique para alternar</div>
            </div>
          </button>
        </div>

        {/* Lista de autorizados */}
        <div style={{padding:'16px 18px',display:'flex',flexDirection:'column',gap:12}}>
          {((saude.autorizados||[]) as any[]).length === 0 && (
            <div style={{textAlign:'center',padding:'28px 16px',color:'hsl(var(--text-muted))',borderRadius:12,background:'hsl(var(--bg-elevated))',border:'1.5px dashed hsl(var(--border-subtle))'}}>
              <div style={{fontSize:34,marginBottom:10}}>👤</div>
              <div style={{fontWeight:800,fontSize:14,marginBottom:4}}>Nenhum autorizado cadastrado</div>
              <div style={{fontSize:12}}>Adicione as pessoas que podem retirar este aluno</div>
            </div>
          )}
            {((saude.autorizados||[]) as any[]).map((aut,idx)=>{
            const DIAS_LABEL = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom']
            const diasSemana: string[] = aut.diasSemana || []
            const toggleDia = (dia: string) => {
              setSaude(s => {
                const arr = [...(s.autorizados||[])] as any[]
                const dias: string[] = arr[idx].diasSemana || []
                arr[idx] = {...arr[idx], diasSemana: dias.includes(dia) ? dias.filter((d:string)=>d!==dia) : [...dias, dia]}
                return {...s, autorizados:arr}
              })
            }
            const updAut = (field: string, val: any) => {
              setSaude(s => {
                const arr = [...(s.autorizados||[])] as any[]
                arr[idx] = {...arr[idx], [field]: val}
                return {...s, autorizados:arr}
              })
            }
            return (
              <div key={idx} style={{
                background: aut.proibido ? 'rgba(239,68,68,0.04)' : 'hsl(var(--bg-elevated))',
                border: `1px solid ${aut.proibido ? 'rgba(239,68,68,0.35)' : 'hsl(var(--border-subtle))'}`,
                borderRadius:14, overflow:'hidden', transition:'all 0.2s',
              }}>
                {/* Row 1: número + seletor + telefone + parentesco + proibido + remover */}
                <div style={{display:'flex',alignItems:'flex-end',gap:10,padding:'12px 14px 10px',flexWrap:'wrap'}}>
                  <div style={{width:30,height:30,borderRadius:8,background:aut.proibido?'rgba(239,68,68,0.15)':'rgba(99,102,241,0.12)',border:`1px solid ${aut.proibido?'rgba(239,68,68,0.3)':'rgba(99,102,241,0.2)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:aut.proibido?'#f87171':'#818cf8',flexShrink:0,alignSelf:'flex-end',marginBottom:1}}>{idx+1}º</div>

                  {/* Seletor de responsável + input manual */}
                  <div style={{display:'flex',flexDirection:'column',flex:1,minWidth:200}}>
                    <div style={{fontSize:9,color:'hsl(var(--text-muted))',fontWeight:700,marginBottom:3,letterSpacing:.5}}>NOME COMPLETO *</div>
                    <select className="form-input" style={{fontSize:12,marginBottom:4}}
                      value={aut.nome ? `__sel__${aut.nome}` : ''}
                      onChange={e=>{
                        if (!e.target.value) { updAut('nome',''); return }
                        const resp = todosResp.find((r:any)=>r.nome===e.target.value.replace('__sel__',''))
                        if (resp) {
                          updAut('nome', resp.nome)
                          const t = resp.celular || (resp as any).telefone || ''
                          if (t) updAut('telefone', t)
                          if (resp.parentesco) updAut('parentesco', resp.parentesco)
                        } else updAut('nome', e.target.value.replace('__sel__',''))
                      }}>
                      <option value="">— Selecionar responsável cadastrado —</option>
                      {todosResp.filter((r:any)=>r.nome).map((r:any)=>(
                        <option key={r.id} value={`__sel__${r.nome}`}>{r.nome} ({r.parentesco})</option>
                      ))}
                    </select>
                    <input className="form-input" style={{fontSize:12}} placeholder="Ou digite manualmente..." value={aut.nome}
                      onChange={e=>updAut('nome',e.target.value)}/>
                  </div>

                  {/* Telefone */}
                  <div style={{display:'flex',flexDirection:'column',width:155,flexShrink:0}}>
                    <div style={{fontSize:9,color:'hsl(var(--text-muted))',fontWeight:700,marginBottom:3,letterSpacing:.5}}>TELEFONE *</div>
                    <input className="form-input" style={{fontSize:12}} placeholder="(11) 99999-9999" value={aut.telefone||''}
                      onChange={e=>updAut('telefone',fmtPhone(e.target.value))}/>
                  </div>

                  {/* Parentesco */}
                  <div style={{display:'flex',flexDirection:'column',width:135,flexShrink:0}}>
                    <div style={{fontSize:9,color:'hsl(var(--text-muted))',fontWeight:700,marginBottom:3,letterSpacing:.5}}>PARENTESCO</div>
                    <select className="form-input" style={{fontSize:12}} value={aut.parentesco||''}
                      onChange={e=>updAut('parentesco',e.target.value)}>
                      <option value="">Selecionar...</option>
                      {['Mãe','Pai','Avó','Avô','Tia','Tio','Irmã','Irmão','Madrinha','Padrinho','Cônjuge','Amigo(a) da família','Outro'].map(p=><option key={p}>{p}</option>)}
                    </select>
                  </div>

                  {/* Proibido toggle */}
                  <button type="button" onClick={()=>updAut('proibido',!aut.proibido)}
                    style={{
                      height:36,padding:'0 12px',borderRadius:10,border:'1.5px solid',
                      borderColor: aut.proibido?'rgba(239,68,68,0.6)':'rgba(100,116,139,0.3)',
                      background: aut.proibido?'rgba(239,68,68,0.12)':'transparent',
                      color: aut.proibido?'#f87171':'hsl(var(--text-muted))',
                      fontWeight:800,fontSize:10,cursor:'pointer',flexShrink:0,
                      display:'flex',alignItems:'center',gap:5,transition:'all 0.18s',
                      whiteSpace:'nowrap',alignSelf:'flex-end',marginBottom:1,
                    }}>
                    {aut.proibido ? '🚫 PROIBIDO' : '✅ LIBERADO'}
                  </button>

                  {/* Remover */}
                  <button type="button"
                    onClick={()=>setSaude(s=>{const arr=[...(s.autorizados||[])] as any[];arr.splice(idx,1);return{...s,autorizados:arr}})}
                    style={{width:32,height:32,borderRadius:8,background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.25)',color:'#f87171',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,fontSize:16,lineHeight:1,fontWeight:700,alignSelf:'flex-end',marginBottom:1,outline:'none'}}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(239,68,68,0.2)'}
                    onMouseLeave={e=>e.currentTarget.style.background='rgba(239,68,68,0.08)'}>✕</button>
                </div>

                {/* Row 2: Dias da semana + RFID */}
                <div style={{padding:'8px 14px 12px',borderTop:'1px solid hsl(var(--border-subtle))',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',background:aut.proibido?'rgba(239,68,68,0.03)':'rgba(0,0,0,0.015)'}}>
                  <span style={{fontSize:10,fontWeight:700,color:'hsl(var(--text-muted))',letterSpacing:.5,flexShrink:0}}>DIAS P/ RETIRAR:</span>
                  {DIAS_LABEL.map((label,di)=>{
                    const ativo = diasSemana.includes(label)
                    const isWeekend = di >= 5
                    return (
                      <button key={label} type="button"
                        onClick={()=>toggleDia(label)}
                        style={{
                          width:36,height:36,borderRadius:8,flexShrink:0,
                          border:`1.5px solid ${ativo?(aut.proibido?'rgba(239,68,68,0.5)':'rgba(99,102,241,0.6)'):'hsl(var(--border-subtle))'}`,
                          background: ativo?(aut.proibido?'rgba(239,68,68,0.15)':'rgba(99,102,241,0.15)'):'transparent',
                          color: ativo?(aut.proibido?'#f87171':'#818cf8'):isWeekend?'#f59e0b':'hsl(var(--text-muted))',
                          fontWeight: ativo?900:600, fontSize:10,
                          cursor:'pointer', transition:'all 0.15s',
                          display:'flex',alignItems:'center',justifyContent:'center',
                        }}>
                        {label.slice(0,3)}
                      </button>
                    )
                  })}
                  {diasSemana.length === 0 && <span style={{fontSize:10,color:'hsl(var(--text-muted))',fontStyle:'italic'}}>Todos os dias</span>}

                  {/* RFID */}
                  <div style={{display:'flex',alignItems:'center',gap:6,marginLeft:'auto'}}>
                    <span style={{fontSize:10,fontWeight:700,color:'hsl(var(--text-muted))',letterSpacing:.5,flexShrink:0}}>RFID:</span>
                    <input className="form-input" style={{fontSize:12,width:140,fontFamily:'monospace',letterSpacing:1}}
                      placeholder="Código RFID..." value={aut.rfid||''}
                      onChange={e=>updAut('rfid',e.target.value)}/>
                  </div>
                </div>

                {/* Banner proibido */}
                {aut.proibido && (
                  <div style={{padding:'8px 14px',background:'rgba(239,68,68,0.1)',borderTop:'1px solid rgba(239,68,68,0.2)',display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:15}}>🚫</span>
                    <span style={{fontSize:11,fontWeight:800,color:'#f87171'}}>PROIBIDO DE RETIRAR o aluno — este registro será bloqueado na portaria.</span>
                  </div>
                )}
              </div>
            )
          })}

          {/* Botão adicionar */}
          <button type="button"
            onClick={()=>setSaude(s=>({...s,autorizados:[...(s.autorizados||[]),{nome:'',telefone:'',parentesco:'',rfid:'',diasSemana:[],proibido:false}]}))}
            style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'11px 18px',borderRadius:12,border:'1.5px dashed rgba(99,102,241,0.45)',background:'rgba(99,102,241,0.04)',color:'#818cf8',cursor:'pointer',fontSize:13,fontWeight:700,transition:'all 0.2s',outline:'none'}}
            onMouseEnter={e=>{e.currentTarget.style.background='rgba(99,102,241,0.10)';e.currentTarget.style.borderColor='rgba(99,102,241,0.75)'}}
            onMouseLeave={e=>{e.currentTarget.style.background='rgba(99,102,241,0.04)';e.currentTarget.style.borderColor='rgba(99,102,241,0.45)'}}>
            <span style={{fontSize:20,lineHeight:1,fontWeight:300}}>+</span> Adicionar Autorizado
          </button>
        </div>
      </div>
    </div>,

    // STEP 3: Matricula
    <div key="s3" style={{display:'flex',flexDirection:'column',gap:16}}>
      <div style={{padding:'12px 16px',background:'rgba(139,92,246,0.06)',border:'1px solid rgba(139,92,246,0.2)',borderRadius:10,fontSize:12}}>
        <strong style={{color:'#a78bfa'}}>Passo 4 - Matricula</strong> · Registre o historico de matriculas e gere as parcelas.
      </div>
      <div className="card" style={{padding:0,overflow:'hidden'}}>
        <div style={{padding:'12px 20px',background:'linear-gradient(135deg,rgba(139,92,246,0.08),rgba(99,102,241,0.04))',borderBottom:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontWeight:800,fontSize:14,display:'flex',alignItems:'center',gap:8}}>
            <span style={{width:32,height:32,borderRadius:8,background:'rgba(139,92,246,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>🎓</span>
            Historico de Matriculas
            {historico.length>0&&<span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'rgba(139,92,246,0.12)',color:'#a78bfa',fontWeight:700}}>{historico.length} registro{historico.length!==1?'s':''}</span>}
          </div>
          <button className="btn btn-primary btn-sm" style={{background:'linear-gradient(135deg,#8b5cf6,#6366f1)'}}
            onClick={()=>{
              setFormHist(novoHistItem());
              setEditHistId(null);
              setFin(f=>({...f, padraoId:'', valorMensalidade:'', diaVencimento:'', totalParcelas:'', descontoValor:'', descontoTipo:'%'}));
              setParcelasPreview([]);
              setModalMatricula(true);
            }}>
            <Plus size={13}/> Inserir Matricula
          </button>
        </div>
        {historico.length===0 ? (
          <div style={{padding:'40px 20px',textAlign:'center',color:'hsl(var(--text-muted))'}}>
            <div style={{fontSize:32,marginBottom:8}}>📋</div>
            <div style={{fontWeight:600,fontSize:13}}>Nenhuma matricula registrada</div>
            <div style={{fontSize:11,marginTop:4}}>Clique em "Inserir Matricula" para adicionar</div>
          </div>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{background:'hsl(var(--bg-elevated))'}}>
                  {['Ano','Curso / Turma','Serie','Situacao','Data Matr.','Padrao Pgt.','Nr. Contrato','Grupo','Data Result.','Turno','Resp. Fin.',''].map(h=>(
                    <th key={h} style={{padding:'8px 12px',textAlign:'left',fontWeight:700,fontSize:11,color:'hsl(var(--text-muted))',borderBottom:'2px solid rgba(148,163,184,0.25)',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historico.map((h,i)=>{
                  const turmaH = turmas.find(t=>t.id===h.turmaId)
                  const padraoH = cfgPadroesPagamento.find(p=>p.id===h.padraoId)
                  const respH = todosResp.find(r=>r.id===h.respFinanceiroId)
                  const ativa = h.situacao==='Cursando'
                  return (
                    <tr key={h.id} style={{borderBottom:'1px solid rgba(148,163,184,0.25)',background:ativa?'rgba(99,102,241,0.04)':'transparent'}}
                      onMouseEnter={e=>(e.currentTarget as HTMLTableRowElement).style.background='hsl(var(--bg-elevated))'}
                      onMouseLeave={e=>(e.currentTarget as HTMLTableRowElement).style.background=ativa?'rgba(99,102,241,0.04)':'transparent'}>
                      <td style={{padding:'8px 12px',fontWeight:700,color:ativa?'#a78bfa':'hsl(var(--text-base))'}}>{h.ano}</td>
                      <td style={{padding:'8px 12px',fontWeight:600}}>{turmaH?.nome||'—'}</td>
                      <td style={{padding:'8px 12px'}}><span className="badge badge-primary">{turmaH?.serie||'—'}</span></td>
                      <td style={{padding:'8px 12px'}}>
                        <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,fontWeight:700,
                          background:h.situacao==='Cursando'?'rgba(99,102,241,0.12)':h.situacao==='Aprovado'||h.situacao==='Concluido'?'rgba(16,185,129,0.1)':h.situacao.startsWith('Reprovado')||h.situacao==='Desistente'?'rgba(239,68,68,0.1)':'rgba(245,158,11,0.1)',
                          color:h.situacao==='Cursando'?'#818cf8':h.situacao==='Aprovado'||h.situacao==='Concluido'?'#10b981':h.situacao.startsWith('Reprovado')||h.situacao==='Desistente'?'#ef4444':'#f59e0b'
                        }}>{h.situacao}</span>
                      </td>
                      <td style={{padding:'8px 12px',fontFamily:'monospace'}}>{h.dataMatricula?new Date(h.dataMatricula+'T12:00').toLocaleDateString('pt-BR'):'—'}</td>
                      <td style={{padding:'8px 12px',fontSize:11}}>{padraoH?.nome||'—'}</td>
                      <td style={{padding:'8px 12px',fontFamily:'monospace',fontSize:11}}>{h.nrContrato}</td>
                      <td style={{padding:'8px 12px'}}>{h.grupoAlunos||'—'}</td>
                      <td style={{padding:'8px 12px'}}>{h.dataResultado?new Date(h.dataResultado+'T12:00').toLocaleDateString('pt-BR'):'—'}</td>
                      <td style={{padding:'8px 12px'}}>{h.turno||'—'}</td>
                      <td style={{padding:'8px 12px',fontSize:11}}>{respH?.nome||'—'}</td>
                      <td style={{padding:'6px 8px'}}>
                        <div style={{display:'flex',gap:4}}>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>{
                            setFormHist(h);
                            setEditHistId(h.id);
                            setFin(f=>({...f, padraoId:'', valorMensalidade:'', diaVencimento:'', totalParcelas:'', descontoValor:'', descontoTipo:'%'}));
                            setParcelasPreview([]);
                            setModalMatricula(true);
                          }}><Pencil size={11}/></button>
                          <button className="btn btn-ghost btn-icon btn-sm" style={{color:'#f87171'}} onClick={()=>{
                            if(window.confirm(`Excluir a matrícula de ${h.ano}? Esta ação não pode ser desfeita.`)){
                              setHistorico(prev=>prev.filter(x=>x.id!==h.id))
                            }
                          }}><X size={11}/></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalMatricula && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:3000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'hsl(var(--bg-base))',borderRadius:20,width:'100%',maxWidth:720,maxHeight:'90vh',overflowY:'auto',border:'1px solid hsl(var(--border-subtle))',boxShadow:'0 40px 120px rgba(0,0,0,0.8)'}}>
            <div style={{padding:'18px 24px',borderBottom:'1px solid hsl(var(--border-subtle))',background:'linear-gradient(135deg,rgba(139,92,246,0.1),rgba(99,102,241,0.05))',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:40,height:40,borderRadius:10,background:'rgba(139,92,246,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>🎓</div>
                <div>
                  <div style={{fontWeight:800,fontSize:15}}>{editHistId?'Editar Matricula':'Nova Matricula'}</div>
                  <div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>Aluno: <strong>{aluno.nome||'(sem nome)'}</strong></div>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={()=>setModalMatricula(false)}><X size={18}/></button>
            </div>
            <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:14}}>

              {/* ── Tipo de Matrícula ── */}
              {(()=>{
                // Regra de auto-detecção:
                // editando item já existente → baseado na posição dele no histórico
                // novo item → se histórico já tem itens → rematricula, else nova
                const idxAtual = editHistId ? historico.findIndex(h=>h.id===editHistId) : historico.length
                const autoTipo = idxAtual > 0 ? 'rematricula' : 'nova'
                const tipoEfetivo = formHist.tipoMatricula || autoTipo
                const isRe = tipoEfetivo === 'rematricula'
                return (
                  <div style={{
                    padding:'14px 18px',
                    background:isRe?'rgba(139,92,246,0.07)':'rgba(99,102,241,0.07)',
                    border:'1px solid '+(isRe?'rgba(139,92,246,0.3)':'rgba(99,102,241,0.25)'),
                    borderRadius:12,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,
                  }}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:36,height:36,borderRadius:9,background:isRe?'rgba(139,92,246,0.15)':'rgba(99,102,241,0.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,flexShrink:0}}>
                        {isRe?'🔄':'🎓'}
                      </div>
                      <div>
                        <div style={{fontWeight:800,fontSize:13,color:isRe?'#a78bfa':'#818cf8'}}>
                          {isRe?'Rematrícula':'Nova Matrícula'}
                        </div>
                        <div style={{fontSize:10,color:'hsl(var(--text-muted))',marginTop:1}}>
                          {formHist.tipoMatricula
                            ?'Definido manualmente'
                            :idxAtual>0
                              ?`Detectado automaticamente — ${idxAtual} matrícula(s) já registrada(s)`
                              :'Detectado automaticamente — primeira matrícula do aluno'}
                        </div>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:4,flexShrink:0}}>
                      {([{v:'nova',l:'🎓 Nova'},{v:'rematricula',l:'🔄 Rematrícula'}] as const).map(opt=>(
                        <button key={opt.v} type="button"
                          onClick={()=>fH('tipoMatricula',opt.v)}
                          style={{
                            padding:'5px 10px',fontSize:10,fontWeight:700,borderRadius:7,border:'1px solid',cursor:'pointer',
                            borderColor:(formHist.tipoMatricula||'')===opt.v?(isRe?'rgba(139,92,246,0.5)':'rgba(99,102,241,0.5)'):'hsl(var(--border-subtle))',
                            background:(formHist.tipoMatricula||'')===opt.v?(isRe?'rgba(139,92,246,0.18)':'rgba(99,102,241,0.14)'):'transparent',
                            color:(formHist.tipoMatricula||'')===opt.v?(isRe?'#a78bfa':'#818cf8'):'hsl(var(--text-muted))',
                            transition:'all 0.15s',
                          }}
                        >{opt.l}</button>
                      ))}
                    </div>
                  </div>
                )
              })()}

              <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:12}}>
                <F label="Turma / Curso">
                  <select className="form-input" value={formHist.turmaId} onChange={e=>{
                    const tId=e.target.value
                    const t = turmas.find(x=>x.id===tId)
                    const turnoStr = t?.turno || ''
                    // Normaliza acentos para comparação
                    const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
                    const tCfg = cfgTurnos.find((cfg:any) =>
                      norm(cfg.nome) === norm(turnoStr) || norm(cfg.codigo) === norm(turnoStr)
                    )
                    const resolvedTurno = tCfg ? tCfg.nome : (turnoStr || '')
                    
                    // Lógica de Padrão Automático baseada nos vínculos da Turma
                    const ativos = cfgPadroesPagamento.filter(p=>p.situacao==='ativo')
                    const vinculados = t?.padraoPagamentoIds?.length 
                      ? ativos.filter(p => t.padraoPagamentoIds?.includes(p.id))
                      : ativos
                    const autoPadrao = vinculados.length === 1 ? vinculados[0] : null

                    setFormHist(h=>({
                      ...h,
                      turmaId: tId,
                      ano: String(t?.ano||anoAtual),
                      turno: resolvedTurno,
                      // Se houver apenas 1 padrão vinculado, seleciona ele. Caso contrário, limpa se o atual não for mais válido
                      padraoId: autoPadrao ? autoPadrao.id : (vinculados.some(p => p.id === h.padraoId) ? h.padraoId : '')
                    }))
                    
                    setMat(m=>({...m, turmaId: tId, turno: resolvedTurno}))
                    if(autoPadrao) handlePadrao(autoPadrao.id)
                    else if (!vinculados.some(p => p.id === formHist.padraoId)) handlePadrao('')
                  }}>
                    <option value="">Selecione a turma...</option>
                    {turmas.map(t=><option key={t.id} value={t.id}>{t.nome} — {t.serie} ({t.turno}) — {t.ano||anoAtual}</option>)}
                  </select>
                </F>
                <F label="Ano Letivo">
                  <input className="form-input" value={formHist.ano} readOnly style={{fontWeight:700,fontFamily:'monospace',background:'hsl(var(--bg-overlay))',cursor:'not-allowed'}}/>
                </F>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                <F label="Data de Matricula"><input className="form-input" type="date" value={formHist.dataMatricula} onChange={e=>fH('dataMatricula',e.target.value)}/></F>
                <F label="Situacao">
                  <select className="form-input" value={formHist.situacao} onChange={e=>fH('situacao',e.target.value)}>
                    <option value="">Selecione</option>
                    {cfgSituacaoAluno.filter((s:any)=>s.situacao==='ativo').map((s:any)=>(<option key={s.codigo} value={s.nome}>{s.nome}</option>))}
                  </select>
                </F>
                <F label="Data Resultado"><input className="form-input" type="date" value={formHist.dataResultado} onChange={e=>fH('dataResultado',e.target.value)}/></F>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:12}}>
                <F label="Padrao de Pagamento">
                  <select className="form-input" value={formHist.padraoId} onChange={e=>{fH('padraoId',e.target.value);handlePadrao(e.target.value)}}>
                    <option value="">— Selecione —</option>
                    {cfgPadroesPagamento.filter(p=>{
                      const isAtivo = p.situacao==='ativo'
                      if(!isAtivo) return false
                      if(formHist.turmaId){
                        const t = turmas.find(x=>x.id===formHist.turmaId)
                        if(t && t.padraoPagamentoIds && t.padraoPagamentoIds.length > 0){
                          return t.padraoPagamentoIds.includes(p.id)
                        }
                      }
                      return true
                    }).map(p=>(
                      <option key={p.id} value={p.id}>{p.codigo} — {p.nome} · {p.totalParcelas}x · R$ {p.anuidade?.toLocaleString('pt-BR',{minimumFractionDigits:2})}</option>
                    ))}
                  </select>
                  {cfgPadroesPagamento.length===0&&<div style={{fontSize:10,color:'#f59e0b',marginTop:2}}>Nenhum padrao cadastrado</div>}
                </F>
                <F label="Turno">
                  <select className="form-input" value={formHist.turno} onChange={e=>fH('turno',e.target.value)}>
                    <option value="">Selecione</option>
                    {cfgTurnos.filter((t:any)=>t.situacao==='ativo').map((t:any)=>(<option key={t.codigo} value={t.nome}>{t.nome}</option>))}
                  </select>
                </F>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:12}}>
                <F label="Grupo de Alunos">
                  <select className="form-input" value={formHist.grupoAlunos} onChange={e=>fH('grupoAlunos',e.target.value)}>
                    <option value="">Sem grupo</option>
                    {cfgGruposAlunos.filter((g:any)=>g.situacao==='ativo').map((g:any)=>(<option key={g.codigo} value={g.nome}>{g.nome}</option>))}
                  </select>
                </F>
                <F label="Bolsista">
                  <select className="form-input" value={formHist.bolsista} onChange={e=>fH('bolsista',e.target.value)}>
                    <option>Nao</option><option>Sim</option>
                  </select>
                </F>
              </div>
              <F label="Responsavel Financeiro">
                <select className="form-input" value={formHist.respFinanceiroId} onChange={e=>fH('respFinanceiroId',e.target.value)}>
                  <option value="">— Selecione —</option>
                  {todosResp.filter(r=>r.nome).map(r=>(<option key={r.id} value={r.id}>[{r.codigo}] {r.nome} — {r.parentesco}</option>))}
                </select>
                {todosResp.filter(r=>r.nome).length===0&&<div style={{fontSize:10,color:'#f59e0b',marginTop:2}}>Cadastre os responsaveis no Passo 1 primeiro</div>}
              </F>
              {formHist.padraoId && (
                <div style={{padding:'14px 16px',background:'rgba(16,185,129,0.06)',border:'1px solid rgba(16,185,129,0.2)',borderRadius:12}}>
                  <div style={{fontWeight:700,fontSize:12,color:'#34d399',marginBottom:10,display:'flex',alignItems:'center',gap:8}}>
                    💳 Configuracao de Parcelas
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:10}}>
                    <F label="Valor Mens. (R$)"><input className="form-input" style={{fontSize:12}} value={fin.valorMensalidade} onChange={e=>setFin(f=>({...f,valorMensalidade:e.target.value}))} placeholder="0,00"/></F>
                    <F label="Dia Vencimento"><select className="form-input" style={{fontSize:12}} value={fin.diaVencimento} onChange={e=>setFin(f=>({...f,diaVencimento:e.target.value}))}><option value="">Dia</option>{['1','5','7','10','15','20','25'].map(d=><option key={d}>{d}</option>)}</select></F>
                    <F label="Total Parcelas"><input className="form-input" style={{fontSize:12}} value={fin.totalParcelas} onChange={e=>setFin(f=>({...f,totalParcelas:e.target.value}))} placeholder="12"/></F>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                    <F label="Desconto">
                      <div style={{display:'flex',gap:0,borderRadius:8,overflow:'hidden',border:'1px solid hsl(var(--border-subtle))'}}>
                        <button type="button"
                          onClick={()=>setFin(f=>({...f,descontoTipo:(f as any).descontoTipo==='R$'?'%':'R$'}))}
                          style={{padding:'0 12px',fontSize:11,fontWeight:700,border:'none',cursor:'pointer',
                            background:(fin as any).descontoTipo==='%'?'rgba(16,185,129,0.15)':'rgba(99,102,241,0.15)',
                            color:(fin as any).descontoTipo==='%'?'#34d399':'#818cf8',
                            borderRight:'1px solid hsl(var(--border-subtle))',minWidth:36,flexShrink:0,
                          }}>
                          {(fin as any).descontoTipo==='%'?'%':'R$'}
                        </button>
                        <input className="form-input" style={{fontSize:12,border:'none',borderRadius:0,flex:1}}
                          value={(fin as any).descontoValor||''}
                          onChange={e=>setFin(f=>({...f,descontoValor:e.target.value}))}
                          placeholder={(fin as any).descontoTipo==='%'?'Ex: 10':'Ex: 100,00'}
                        />
                      </div>
                    </F>
                    <F label="Desconto Calculado">
                      <input className="form-input" style={{fontSize:12,background:'hsl(var(--bg-overlay))',cursor:'not-allowed',color:'#34d399',fontWeight:700}} readOnly
                        value={(()=>{
                          const mens=parseFloat((fin.valorMensalidade||'0').replace(',','.'))
                          const parc=parseInt(fin.totalParcelas||'0')
                          const val=parseFloat(((fin as any).descontoValor||'0').replace(',','.'))
                          if(!mens||!parc||!val) return '—'
                          // Mesmo desconto em cada parcela
                          const descParc=(fin as any).descontoTipo==='%'?(mens*val/100):val
                          const totalDesc=+(descParc*parc).toFixed(2)
                          const pctTotal=((totalDesc/(mens*parc))*100).toFixed(1)
                          return `R$ ${descParc.toLocaleString('pt-BR',{minimumFractionDigits:2})}/parcela · R$ ${totalDesc.toLocaleString('pt-BR',{minimumFractionDigits:2})} total (${pctTotal}%)`
                        })()}
                      />
                    </F>
                  </div>


                  {/* Preview das parcelas a serem geradas */}
                  {parcelasPreview.length === 0 ? (
                    <button className="btn btn-secondary btn-sm"
                      disabled={!fin.valorMensalidade||!fin.totalParcelas||!fin.diaVencimento}
                      onClick={gerarParcelasPreview}>
                      <DollarSign size={13}/> Gerar Preview ({fin.totalParcelas||'?'} parcelas)
                    </button>
                  ) : (
                    <div>
                      {/* Mini tabela de preview */}
                      <div style={{background:'hsl(var(--bg-overlay))',border:'1px solid rgba(16,185,129,0.25)',borderRadius:10,overflow:'hidden',marginBottom:10,maxHeight:260,overflowY:'auto'}}>
                        <div style={{display:'grid',gridTemplateColumns:'30px 36px 1fr 90px'+(parcelasPreview.some((p:any)=>p.desconto>0)?' 90px 90px':' 90px'),gap:6,padding:'6px 10px',background:'rgba(16,185,129,0.08)',fontSize:10,fontWeight:700,color:'#34d399',borderBottom:'1px solid rgba(16,185,129,0.15)'}}>
                          <span style={{display:'flex',alignItems:'center'}}><input type="checkbox" checked={parcelasPreview.every((p:any)=>p.selected)} onChange={e=>setParcelasPreview(parcelasPreview.map((p:any)=>({...p,selected:e.target.checked})))} style={{accentColor:'#10b981',width:14,height:14}}/></span>
                          <span>#</span><span>Competencia</span><span>Vencimento</span>
                          {parcelasPreview.some((p:any)=>p.desconto>0)&&<span style={{color:'#f87171'}}>Desconto</span>}
                          <span>Valor (R$)</span>
                        </div>
                        {parcelasPreview.map((p: any) => (
                          <div key={p.num} style={{display:'grid',gridTemplateColumns:'30px 36px 1fr 90px'+(p.desconto>0?' 90px 90px':' 90px'),gap:6,padding:'5px 10px',fontSize:11,borderBottom:'1px solid rgba(148,163,184,0.2)',opacity:p.selected?1:0.5,transition:'opacity 0.2s'}}>
                            <span style={{display:'flex',alignItems:'center'}}><input type="checkbox" checked={p.selected} onChange={e=>setParcelasPreview(parcelasPreview.map((x:any)=>x.num===p.num?{...x,selected:e.target.checked}:x))} style={{accentColor:'#10b981',width:14,height:14}}/></span>
                            <span style={{fontWeight:700,color:'hsl(var(--text-muted))'}}>{p.num}</span>
                            <span style={{textTransform:'capitalize'}}>{p.competencia}</span>
                            <span style={{fontFamily:'monospace'}}>{p.vencimento ? formatDate(p.vencimento) : '—'}</span>
                            {p.desconto>0&&<span style={{fontFamily:'monospace',color:'#f87171',fontSize:10}}>- R$ {fmtMoeda(p.desconto)}</span>}
                            <span style={{fontFamily:'monospace',fontWeight:700,color:p.desconto>0?'#34d399':'inherit'}}>R$ {fmtMoeda(p.valorFinal)}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{display:'flex',gap:10,alignItems:'center'}}>
                        <div style={{fontWeight:700,fontSize:12,color:'#34d399'}}>
                          ✓ {parcelasPreview.filter((p:any)=>p.selected).length} parcelas selecionadas
                          <span style={{fontWeight:400,color:'hsl(var(--text-muted))',marginLeft:8}}>Total: R$ {fmtMoeda(parcelasPreview.filter((p:any)=>p.selected).reduce((s:number,p:any)=>s+p.valor,0))}</span>
                        </div>
                        <button className="btn btn-ghost btn-sm" style={{fontSize:11,color:'hsl(var(--text-muted))'}} onClick={()=>setParcelasPreview([])}>
                          <X size={11}/> Refazer
                        </button>
                        <button className="btn btn-primary btn-sm"
                          style={{background:'linear-gradient(135deg,#10b981,#059669)',marginLeft:'auto'}}
                          onClick={()=>{
                            const item = {...formHist,dataAlteracao:new Date().toLocaleDateString('pt-BR')}
                            if(editHistId) setHistorico(prev=>{
                              const updated = prev.map(h=>h.id===editHistId?item:h)
                              const ativa = updated.find(h=>h.situacao==='Cursando') || updated[updated.length-1]
                              if(ativa?.turmaId) setMat(m=>({...m, turmaId:ativa.turmaId, turno:ativa.turno||m.turno}))
                              sincronizarTurmaAluno(updated)
                              return updated
                            })
                            else setHistorico(prev=>{
                              const updated = [...prev, item]
                              const ativa = updated.find(h=>h.situacao==='Cursando') || updated[updated.length-1]
                              if(ativa?.turmaId) setMat(m=>({...m, turmaId:ativa.turmaId, turno:ativa.turno||m.turno}))
                              sincronizarTurmaAluno(updated)
                              return updated
                            })
                            confirmarParcelas()
                          }}>
                          <Check size={13}/> Confirmar e Salvar Parcelas
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{padding:'14px 24px',borderTop:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'flex-end',gap:10,background:'hsl(var(--bg-elevated))'}}>
              <button className="btn btn-secondary" onClick={()=>setModalMatricula(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{background:'linear-gradient(135deg,#8b5cf6,#6366f1)'}}
                onClick={()=>{
                  const item = {...formHist,dataAlteracao:new Date().toLocaleDateString('pt-BR')}
                  const updateHist = (prev: typeof historico) => {
                    const updated = editHistId ? prev.map(h=>h.id===editHistId?item:h) : [...prev, item]
                    // sync mat + turma do aluno
                    const ativa = updated.find(h=>h.situacao==='Cursando') || updated[updated.length-1]
                    if(ativa?.turmaId) setMat(m=>({...m, turmaId:ativa.turmaId, turno:ativa.turno||m.turno}))
                    sincronizarTurmaAluno(updated)
                    return updated
                  }
                  setHistorico(updateHist)
                  setModalMatricula(false)
                }}>
                <Check size={14}/> {editHistId?'Salvar Alteracoes':'Adicionar Matricula'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    // STEP 4: Financeiro
    <div key="s4" style={{display:'flex',flexDirection:'column',gap:0,minHeight:600,background:'hsl(var(--bg-base))'}}>

      {/* ══ PREMIUM FINANCIAL HEADER ══ */}
      <div style={{
        padding:'14px 24px',
        background:'linear-gradient(135deg,hsl(var(--bg-elevated)) 0%,rgba(99,102,241,0.03) 100%)',
        borderBottom:'1px solid hsl(var(--border-subtle))',
        borderRadius:'16px 16px 0 0',
        display:'flex',alignItems:'center',gap:14,flexWrap:'wrap',
      }}>
        <div style={{width:46,height:46,borderRadius:12,background:aluno.foto?'transparent':'linear-gradient(135deg,#6366f1,#8b5cf6)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0,border:'2px solid rgba(99,102,241,0.25)',boxShadow:'0 0 0 4px rgba(99,102,241,0.08),0 4px 12px rgba(99,102,241,0.18)'}}>
          {aluno.foto?<img src={aluno.foto} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:18,color:'#fff'}}>👤</span>}
        </div>
        <div style={{flex:'0 0 auto'}}>
          <div style={{fontSize:9,color:'hsl(var(--text-muted))',fontWeight:700,letterSpacing:1,textTransform:'uppercase',marginBottom:2}}>Financeiro · Matr. <span style={{color:'#818cf8',fontFamily:'monospace',fontWeight:900}}>{numMatricula}</span></div>
          <div style={{fontWeight:900,fontSize:15,letterSpacing:-.4,color:'hsl(var(--text-base))',lineHeight:1}}>{aluno.nome||'—'}</div>
        </div>
        <div style={{width:1,height:32,background:'hsl(var(--border-subtle))',flexShrink:0}}/>
        <div style={{flex:'0 0 auto'}}>
          <div style={{fontSize:9,color:'hsl(var(--text-muted))',fontWeight:700,letterSpacing:.8,textTransform:'uppercase',marginBottom:2}}>Resp. Financeiro</div>
          <div style={{fontWeight:700,fontSize:12,color:'#818cf8'}}>{todosResp.find(r=>r.respFinanceiro)?.nome||'—'}</div>
        </div>
        <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          {/* Botão de Observação Financeira — sempre visível */}
          <button
            type="button"
            onClick={()=>setModalObsAluno(true)}
            style={{
              fontSize:10,padding:'5px 14px',borderRadius:20,cursor:'pointer',fontWeight:700,
              background: obsAlunoFin ? 'rgba(245,158,11,0.1)' : 'hsl(var(--bg-elevated))',
              color:       obsAlunoFin ? '#d97706' : 'hsl(var(--text-muted))',
              border:      obsAlunoFin ? '1px solid rgba(245,158,11,0.35)' : '1px solid hsl(var(--border-subtle))',
              transition:'all 0.2s',
            }}
            onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background='rgba(245,158,11,0.15)';(e.currentTarget as HTMLButtonElement).style.color='#d97706';(e.currentTarget as HTMLButtonElement).style.borderColor='rgba(245,158,11,0.4)'}}
            onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background=obsAlunoFin?'rgba(245,158,11,0.1)':'hsl(var(--bg-elevated))';(e.currentTarget as HTMLButtonElement).style.color=obsAlunoFin?'#d97706':'hsl(var(--text-muted))';(e.currentTarget as HTMLButtonElement).style.borderColor=obsAlunoFin?'rgba(245,158,11,0.35)':'hsl(var(--border-subtle))'}}
            title={obsAlunoFin ? `Observação: ${obsAlunoFin}` : 'Adicionar observação financeira'}
          >
            {obsAlunoFin ? '📝 Obs. Financeira' : '📝 Adicionar Obs.'}
          </button>
          {parcelas.length>0&&<span style={{fontSize:10,padding:'5px 14px',borderRadius:20,background:parcelasConfirmadas?'rgba(16,185,129,0.1)':'rgba(245,158,11,0.08)',color:parcelasConfirmadas?'#10b981':'#f59e0b',fontWeight:700,border:'1px solid '+(parcelasConfirmadas?'rgba(16,185,129,0.2)':'rgba(245,158,11,0.18)')}}>{parcelasConfirmadas?'✓ Confirmadas':'⚠ Não confirmadas'}</span>}
        </div>
      </div>

      {/* ══ KPI CARDS ══ */}
      {parcelas.length>0&&(()=>{
        const valid=parcelas.filter(p=>p.status!=='cancelado')
        const kpis=[
          {l:'Total Bruto',  v:valid.reduce((s,p)=>s+p.valor,0),                              vc:'#1e293b', lc:'#64748b', icon:'🪙'},
          {l:'Descontos',    v:valid.reduce((s,p)=>s+p.desconto,0),                            vc:'#d97706', lc:'#d97706', icon:'🏷️'},
          {l:'Total Líquido',v:valid.reduce((s,p)=>s+p.valorFinal,0),                         vc:'#10b981', lc:'#10b981', icon:'✅'},
          {l:'Recebido',     v:valid.filter(p=>p.status==='pago').reduce((s,p)=>s+p.valorFinal,0), vc:'#6366f1', lc:'#6366f1', icon:'💳'},
        ]
        return(
          <div style={{
            display:'grid',gridTemplateColumns:'repeat(4,1fr)',
            gap:14,padding:'14px 20px',
            background:'hsl(var(--bg-base))',
            borderBottom:'1px solid hsl(var(--border-subtle))',
          }}>
            {kpis.map(k=>(
              <div key={k.l} style={{
                padding:'16px 20px',
                background:'hsl(var(--bg-elevated))',
                borderRadius:16,
                border:'1px solid hsl(var(--border-subtle))',
                boxShadow:'0 2px 8px rgba(0,0,0,0.06),0 0 0 0px transparent',
                display:'flex',flexDirection:'column',gap:10,
                transition:'box-shadow 0.2s,transform 0.15s',
                cursor:'default',
              }}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.boxShadow='0 6px 20px rgba(0,0,0,0.1)';(e.currentTarget as HTMLElement).style.transform='translateY(-1px)'}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.boxShadow='0 2px 8px rgba(0,0,0,0.06)';(e.currentTarget as HTMLElement).style.transform='translateY(0)'}}
              >
                {/* Icon + Label row */}
                <div style={{display:'flex',alignItems:'center',gap:7}}>
                  <span style={{fontSize:15,lineHeight:1}}>{k.icon}</span>
                  <span style={{
                    fontSize:10,fontWeight:800,color:k.lc,
                    letterSpacing:.8,textTransform:'uppercase',
                  }}>{k.l}</span>
                </div>
                {/* Value */}
                <div style={{
                  fontFamily:'Inter,sans-serif',fontWeight:900,
                  fontSize:22,color:k.vc,letterSpacing:-.8,lineHeight:1,
                }}>
                  R$ {fmtMoeda(k.v)}
                </div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* ══ ACTION TOOLBAR ══ */}
      {(()=>{
        const selCount=parcelasSelected.length
        const temSel=selCount>0
        const Btn=({icon,label,color,onClick,disabled,danger,title,full}:{icon:string;label:string;color?:string;onClick:()=>void;disabled?:boolean;danger?:boolean;title?:string;full?:boolean})=>{
          const c=danger?'#ef4444':color||'#64748b'
          return(
            <button type="button" disabled={disabled||false} onClick={onClick} title={title||label}
              style={{
                display:'flex',alignItems:'center',gap:5,
                padding:'7px 10px',
                borderRadius:10,
                border:'1px solid '+(disabled?'hsl(var(--border-subtle))':c+'30'),
                background:disabled?'transparent':c+'09',
                boxShadow:disabled?'none':'0 1px 4px rgba(0,0,0,0.05)',
                cursor:disabled?'not-allowed':'pointer',
                opacity:disabled?.3:1,
                transition:'all 0.15s',
                fontSize:11,fontWeight:700,
                whiteSpace:'nowrap',
                flex:full?'1 1 0':'0 0 auto',
                minWidth:0,
                overflow:'hidden',
              }}
              onMouseEnter={e=>{if(!disabled){const el=e.currentTarget as HTMLElement;el.style.transform='translateY(-1px)';el.style.boxShadow='0 4px 10px rgba(0,0,0,0.1)';el.style.background=c+'18'}}}
              onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.transform='translateY(0)';el.style.boxShadow=disabled?'none':'0 1px 4px rgba(0,0,0,0.05)';el.style.background=disabled?'transparent':c+'09'}}
            >
              <span style={{fontSize:13,lineHeight:1,flexShrink:0}}>{icon}</span>
              <span style={{color:disabled?'#94a3b8':c,fontSize:11,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis'}}>{label}</span>
            </button>
          )
        }
        const Row=({children}:{children:React.ReactNode})=>(
          <div style={{display:'flex',gap:6}}>{children}</div>
        )
        return (
          <div style={{
            display:'grid',gridTemplateColumns:'repeat(4,1fr)',
            gap:14,padding:'14px 20px',
            background:'hsl(var(--bg-base))',
            borderBottom:'1px solid hsl(var(--border-subtle))',
          }}>
            {/* Coluna 1 — Baixas / Exclusão */}
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              <Row>
                <Btn full icon="💳" label="Baixar" color="#10b981" disabled={!temSel} onClick={()=>{
                  if(selCount===1){
                    const p=parcelas.find(x=>x.num===parcelasSelected[0])
                    if(p&&p.status!=='pago'){const{juros,multa}=calcAtraso(p);const t=+(p.valorFinal+juros+multa).toFixed(2);setParcelaAtiva({...p});const c='BX'+String(p.num).padStart(3,'0')+String(Date.now()).slice(-6);const cxDef=caixasAbertos.filter((c:any)=>!c.fechado).sort((a:any,b:any)=>b.dataAbertura.localeCompare(a.dataAbertura))[0]?.id??'';setBaixaForm({dataPagto:new Date().toISOString().split('T')[0],formasPagto:[{id:'f1',forma:'PIX',valor:fmtMoeda(t),cartao:null}],juros:juros>0?fmtMoeda(juros):'0',multa:multa>0?fmtMoeda(multa):'0',desconto:fmtMoeda(p.desconto||0),obs:'',comprovante:'',codPreview:c,caixaId:cxDef});setModalBaixarParcela(true)}
                  } else {
                    const sp=parcelas.filter(x=>parcelasSelected.includes(x.num)&&x.status!=='pago');const sj=sp.reduce((s,p)=>s+calcAtraso(p).juros,0);const sm=sp.reduce((s,p)=>s+calcAtraso(p).multa,0);const sd=sp.reduce((s,p)=>s+(p.desconto||0),0);const tl=sp.reduce((s,p)=>s+p.valorFinal,0)+sj+sm;const c='BX'+String(Date.now()).slice(-6)+String(Math.floor(Math.random()*100)).padStart(2,'0')+'LL';setBaixaLoteForm({dataPagto:new Date().toISOString().split('T')[0],formaPagto:'PIX',comprovante:'',obs:'',juros:sj>0?fmtMoeda(sj):'0',multa:sm>0?fmtMoeda(sm):'0',desconto:fmtMoeda(sd),codPreview:c});setBaixaLoteMultiFormas([{id:'f1',forma:'PIX',valor:fmtMoeda(tl),cartao:null}]);setModalBaixaLote(true)
                  }
                }}/>
                <Btn full icon="✏️" label="Editar" color="#6366f1" disabled={selCount!==1} onClick={()=>{const p=parcelas.find(x=>x.num===parcelasSelected[0]);if(p){setParcelaAtiva({...p});setModalEditarParcela(true)}}}/>
              </Row>
              <Row>
                <Btn full icon="🏦" label="Baixa Resp." color="#818cf8" onClick={()=>setModalBaixaResp(true)}/>
                <Btn full icon="🗑️" label="Excluir" danger disabled={!temSel||parcelas.some(p=>parcelasSelected.includes(p.num)&&p.status==='pago')} title={parcelas.some(p=>parcelasSelected.includes(p.num)&&p.status==='pago')?"Parcelas pagas não podem ser excluídas":undefined} onClick={()=>{setExcluirMotivo('');setModalExcluirMotivo(true)}}/>
              </Row>
            </div>

            {/* Coluna 2 — Eventos / Ajustes */}
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              <Row>
                <Btn full icon="➕" label="Inserir Evento" color="#8b5cf6" onClick={()=>{setEventoForm(f=>({...f,turmaId:mat.turmaId}));setModalEventoFin(true)}}/>
                <Btn full icon="🏷️" label="Descontos" color="#f59e0b" onClick={()=>{const se=parcelasSelected.length>0?(parcelas.find(p=>p.num===parcelasSelected[0]) as any)?.evento||'':'';const sn=se?parcelas.filter(p=>p.status!=='cancelado'&&(p as any).evento===se).map(p=>p.num):parcelas.filter(p=>p.status!=='cancelado').map(p=>p.num);setDescLote({tipo:'%',valor:'',deParcela:sn.length?String(Math.min(...sn)):'1',ateParcela:sn.length?String(Math.max(...sn)):'1',eventoId:se,parcelasEvento:sn});setModalDesconto(true)}}/>
              </Row>
              <Row>
                <Btn full icon="📅" label="Alt. Vencimento" color="#06b6d4" onClick={()=>{const ev=[...new Set(parcelas.filter(p=>p.status!=='cancelado').map(p=>(p as any).evento).filter(Boolean))];setVctoForm({deParcela:'1',ateParcela:String(parcelas.filter(p=>p.status!=='cancelado').length),novoDia:'',eventoFiltro:(ev[0] as string)||''});setModalVcto(true)}}/>
                <Btn full icon="💲" label="Alt. Valor" color="#a78bfa" onClick={()=>{const se=parcelasSelected.length>0?(parcelas.find(p=>p.num===parcelasSelected[0]) as any)?.evento||'':'';const ns=se?parcelas.filter(p=>p.status!=='cancelado'&&(p as any).evento===se).map(p=>p.num):parcelas.filter(p=>p.status!=='cancelado').map(p=>p.num);setAlterarValorForm({parcelas:ns,eventoFiltro:se,novoValor:'',motivo:''});setModalAlterarValor(true)}}/>
              </Row>
            </div>

            {/* Coluna 3 — Consultas */}
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              <Row>
                <Btn full icon="🔍" label="Cons. Baixa" color="#38bdf8" onClick={()=>setModalConsultaBaixa(true)}/>
                <Btn full icon="↩️" label="Excluir Baixa" color="#f97316" disabled={!temSel||!parcelas.some(p=>parcelasSelected.includes(p.num)&&p.status==='pago')} onClick={()=>setModalExcluirBaixa(true)}/>
              </Row>
              <Row>
                <Btn full icon="🗂️" label="Extrato" color="#64748b" onClick={()=>setModalExtrato(true)}/>
                <Btn full icon="🗑️" label="Excluídos" color="#94a3b8" onClick={()=>setModalItensExcluidos(true)}/>
              </Row>
            </div>

            {/* Coluna 4 — Boletos */}
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              <Row>
                <Btn full icon="📋" label="Histórico" color="#818cf8" onClick={()=>setModalHistorico(true)}/>
              </Row>
              <Row>
                <Btn full icon="🏦" label="Emitir Boleto" color="#0ea5e9"
                  disabled={parcelas.filter(p=>p.status!=='pago'&&p.status!=='cancelado').length===0}
                  onClick={()=>{
                    const pendentes=parcelas.filter(p=>p.status!=='pago'&&p.status!=='cancelado')
                    setParcelasParaBoleto(pendentes)
                    setModalBoleto(true)
                  }}/>
                <Btn full icon="📄" label="2ª Via" color="#a78bfa"
                  disabled={(titulos as any[]).filter(t=>(t as any).alunoId===alunoEditando?.id&&t.statusBancario&&t.statusBancario!=='rascunho').length===0}
                  title="Emitir 2ª via do último boleto"
                  onClick={()=>{
                    const ultimo=(titulos as any[]).filter(t=>(t as any).alunoId===alunoEditando?.id&&t.statusBancario&&t.statusBancario!=='rascunho').slice(-1)[0]
                    if(ultimo) setModal2aVia(ultimo)
                  }}/>
              </Row>
            </div>
          </div>
        )
      })()}




      {/* ══ FILTROS + TABELA ══ */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {(()=>{
          const hoje=new Date();hoje.setHours(0,0,0,0)
          const pd=(s:string)=>new Date(s.split('/').reverse().join('-')+'T12:00')
          const calcJurosMulta=(p:any)=>{
            if(p.status==='pago'||p.status==='isento') return {juros:p.juros||0,multa:p.multa||0,dias:0}
            const dv=pd(p.vencimento);const dias=Math.max(0,Math.floor((hoje.getTime()-dv.getTime())/86400000))
            if(dias<=0) return {juros:p.juros||0,multa:p.multa||0,dias:0}
            return {juros:+(p.valor*0.00033*dias).toFixed(2),multa:+(p.valor*0.02).toFixed(2),dias}
          }
          const valid=parcelas.filter(p=>p.status!=='cancelado')
          const aV=valid.filter(p=>p.status==='pendente'&&pd(p.vencimento)>=hoje)
          const ven=valid.filter(p=>p.status==='pendente'&&pd(p.vencimento)<hoje)
          const pendentes=[...aV,...ven]
          const pag=valid.filter(p=>p.status==='pago')
          const filtroAtual=fin._filtro||'pendente'
          const pFilt=filtroAtual==='pendente'?pendentes:filtroAtual==='pago'?pag:valid
          const allSel=pFilt.length>0&&pFilt.every(p=>parcelasSelected.includes(p.num))
          const selCount=parcelasSelected.length
          const FILTROS=[
            {k:'todos',l:'Todos',n:valid.length,c:'#6366f1',bg:'rgba(99,102,241,0.1)'},
            {k:'pendente',l:'A Vencer / Vencidos',n:pendentes.length,c:ven.length>0?'#ef4444':'#6366f1',bg:ven.length>0?'rgba(239,68,68,0.08)':'rgba(99,102,241,0.1)'},
            {k:'pago',l:'Pago',n:pag.length,c:'#10b981',bg:'rgba(16,185,129,0.08)'},
          ]
          return (
            <>
              {/* Barra de Filtros */}
              <div style={{padding:'10px 20px',borderBottom:'1px solid hsl(var(--border-subtle))',display:'flex',gap:6,alignItems:'center',background:'hsl(var(--bg-elevated))',flexWrap:'wrap'}}>
                <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:11,color:'hsl(var(--text-muted))',fontWeight:600,padding:'4px 8px',borderRadius:6,border:'1px solid hsl(var(--border-subtle))',background:'hsl(var(--bg-base))'}}>
                  <input type="checkbox" checked={allSel} onChange={e=>setParcelasSelected(e.target.checked?pFilt.map(p=>p.num):[])} style={{cursor:'pointer',width:13,height:13,accentColor:'#6366f1'}}/>
                  Sel. Todos
                </label>
                <div style={{width:1,height:20,background:'hsl(var(--border-subtle))'}}/>
                <div style={{display:'flex',gap:2,padding:'2px',background:'rgba(0,0,0,0.03)',borderRadius:10,border:'1px solid hsl(var(--border-subtle))'}}>
                  {FILTROS.map(f=>(
                    <button key={f.k} type="button" onClick={()=>setFin(ff=>({...ff,_filtro:f.k}))}
                      style={{padding:'4px 12px',borderRadius:8,fontSize:11,fontWeight:700,cursor:'pointer',border:'none',
                        background:filtroAtual===f.k?f.bg:'transparent',
                        color:filtroAtual===f.k?f.c:'hsl(var(--text-muted))',
                        transition:'all 0.15s',boxShadow:filtroAtual===f.k?'0 1px 3px rgba(0,0,0,0.07)':'none',
                      }}>
                      {f.l}<span style={{opacity:.6,marginLeft:4,fontSize:9}}>({f.n})</span>
                    </button>
                  ))}
                </div>
                <div style={{flex:1}}/>
                {selCount>0&&(
                  <div style={{display:'flex',alignItems:'center',gap:8,padding:'4px 12px',borderRadius:20,background:'rgba(99,102,241,0.07)',border:'1px solid rgba(99,102,241,0.18)'}}>
                    <span style={{fontSize:11,fontWeight:800,color:'#818cf8',fontFamily:'monospace'}}>Σ R$ {fmtMoeda(parcelas.filter(p=>parcelasSelected.includes(p.num)).reduce((s,p)=>s+p.valorFinal,0))}</span>
                    {parcelas.some(p=>parcelasSelected.includes(p.num)&&p.status==='pago')&&(
                      <button type="button" style={{fontSize:10,padding:'2px 8px',borderRadius:6,border:'1px solid rgba(16,185,129,0.25)',background:'rgba(16,185,129,0.07)',color:'#10b981',cursor:'pointer',fontWeight:700}} onClick={()=>{const pg=parcelas.find(p=>parcelasSelected.includes(p.num)&&p.status==='pago');if(pg){setParcelaAtiva(pg);setModalRecibo(true)}}}>🧾 Recibo</button>
                    )}
                    <button type="button" style={{border:'none',background:'none',color:'#f87171',cursor:'pointer',fontSize:13,lineHeight:1,padding:0}} onClick={()=>setParcelasSelected([])}>×</button>
                  </div>
                )}
                <button type="button" style={{fontSize:11,padding:'6px 16px',borderRadius:20,border:'none',background:'linear-gradient(135deg,#6366f1,#8b5cf6)',color:'#fff',cursor:'pointer',fontWeight:700,boxShadow:'0 2px 8px rgba(99,102,241,0.35)',display:'flex',alignItems:'center',gap:5}}
                  onClick={()=>{setEventoForm(f=>({...f,turmaId:mat.turmaId}));setModalEventoFin(true)}}>
                  + Adicionar Evento
                </button>
              </div>

              {/* TABLE or EMPTY */}
              {parcelas.length===0?(
                <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:60,gap:12,textAlign:'center'}}>
                  <div style={{fontSize:56,marginBottom:8}}>💳</div>
                  <div style={{fontWeight:800,fontSize:18}}>Nenhuma parcela cadastrada</div>
                  <div style={{fontSize:13,color:'hsl(var(--text-muted))',maxWidth:400}}>Use "Adicionar Evento" ou acesse a aba Matrícula para confirmar parcelas.</div>
                  <div style={{display:'flex',gap:10,marginTop:8}}>
                    <button className="btn btn-secondary" onClick={()=>setStep(3)}>← Ir para Matrícula</button>
                    <button className="btn btn-primary" style={{background:'linear-gradient(135deg,#8b5cf6,#6366f1)'}} onClick={()=>{setEventoForm(f=>({...f,turmaId:mat.turmaId}));setModalEventoFin(true)}}>+ Inserir Evento</button>
                  </div>
                </div>
              ):(
                <div style={{flex:1,overflowX:'auto',overflowY:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'separate',borderSpacing:0,fontSize:13,minWidth:860,fontFamily:"'Inter',sans-serif"}}>
                    <thead style={{position:'sticky',top:0,zIndex:10}}>
                      <tr style={{background:'hsl(var(--bg-elevated))'}}>
                        <th style={{padding:'11px 14px',width:40,borderBottom:'2px solid hsl(var(--border-subtle))',textAlign:'center',borderRight:'1px solid hsl(var(--border-subtle))'}}>
                          <input type="checkbox" checked={allSel} onChange={e=>setParcelasSelected(e.target.checked?pFilt.map(p=>p.num):[])} style={{cursor:'pointer',width:14,height:14,accentColor:'#6366f1'}}/>
                        </th>
                        {[
                          {l:'Parc.',w:64,center:true},
                          {l:'Evento / Competência'},
                          {l:'Vencimento',w:108},
                          {l:'Valor Bruto',w:112,r:true},
                          {l:'Desconto',w:100,r:true},
                          {l:'Juros',w:85,r:true},
                          {l:'Multa',w:85,r:true},
                          {l:'Total a Pagar',w:124,r:true},
                          {l:'Pagamento',w:104},
                          {l:'Ação',w:100,center:true},
                          {l:'Dt. Emissão',w:120,center:true},
                        ].map((h:any,hi:number)=>(
                          <th key={hi} style={{padding:'12px 16px',textAlign:h.center?'center':h.r?'right':'left',fontWeight:700,fontSize:10,color:'hsl(var(--text-muted))',borderBottom:'2px solid hsl(var(--border-subtle))',whiteSpace:'nowrap',width:h.w,letterSpacing:.8,textTransform:'uppercase',fontFamily:"'Inter',sans-serif"}}>{h.l}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...pFilt].sort((a,b)=>pd(a.vencimento).getTime()-pd(b.vencimento).getTime()).map((p,rowIdx)=>{
                        const dv=pd(p.vencimento)
                        const isV=p.status==='pendente'&&dv<hoje
                        const isH=dv.toDateString()===hoje.toDateString()&&p.status==='pendente'
                        const sel=parcelasSelected.includes(p.num)
                        const sColor=p.status==='pago'?'#10b981':isV?'#ef4444':isH?'#f59e0b':'#6366f1'
                        const sBg=p.status==='pago'?'rgba(16,185,129,0.09)':isV?'rgba(239,68,68,0.07)':isH?'rgba(245,158,11,0.08)':'rgba(99,102,241,0.07)'
                        const sLabel=p.status==='pago'?'✓ Pago':isV?'⚠ Vencido':isH?'📌 Hoje':'● Pendente'
                        const atr=p.status!=='pago'?calcJurosMulta(p):{juros:0,multa:0,dias:0}
                        const jEx=p.status==='pago'?((p as any).juros||0):atr.juros
                        const mEx=p.status==='pago'?((p as any).multa||0):atr.multa
                        const totalP=p.status==='pago'?p.valorFinal:+(p.valor-(p.desconto||0)+jEx+mEx).toFixed(2)
                        const rowBg=sel?'rgba(99,102,241,0.055)':p.status==='pago'?'rgba(16,185,129,0.015)':isV?'rgba(239,68,68,0.015)':rowIdx%2===0?'transparent':'rgba(148,163,184,0.025)'
                        const eid=(p as any).eventoId
                        const eparcs=eid?[...pFilt].filter(x=>(x as any).eventoId===eid).sort((a,b)=>pd(a.vencimento).getTime()-pd(b.vencimento).getTime()):null
                        const pNum=eparcs?eparcs.findIndex(x=>x.num===p.num)+1:rowIdx+1
                        const pDen=eparcs?eparcs.length:parcelas.filter(x=>x.status!=='cancelado').length
                        return(
                          <tr key={p.num}
                            style={{background:rowBg,transition:'background 0.1s',cursor:'pointer',borderLeft:sel?'3px solid #6366f1':'3px solid transparent'}}
                            onMouseEnter={e=>{if(!sel)(e.currentTarget as HTMLElement).style.background='rgba(148,163,184,0.055)'}}
                            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=rowBg}}
                            onClick={e=>{if((e.target as HTMLElement).tagName==='INPUT') return;setParcelasSelected(prev=>prev.includes(p.num)?prev.filter(n=>n!==p.num):[...prev,p.num])}}
                          >
                            <td style={{padding:'11px 14px',textAlign:'center',borderBottom:'1px solid hsl(var(--border-subtle))',borderRight:'1px solid rgba(148,163,184,0.08)'}} onClick={e=>e.stopPropagation()}>
                              <input type="checkbox" checked={sel} onChange={e=>setParcelasSelected(prev=>e.target.checked?[...prev,p.num]:prev.filter(n=>n!==p.num))} style={{cursor:'pointer',width:14,height:14,accentColor:'#6366f1'}}/>
                            </td>
                            <td style={{padding:'11px 14px',textAlign:'center',borderBottom:'1px solid hsl(var(--border-subtle))'}}>
                              <div style={{width:36,height:36,borderRadius:9,background:sBg,border:'1.5px solid '+sColor+'28',display:'inline-flex',alignItems:'center',justifyContent:'center',flexDirection:'column'}}>
                                <span style={{fontSize:12,fontWeight:900,color:sColor,lineHeight:1}}>{pNum}</span>
                                <span style={{fontSize:8,color:sColor,opacity:.55}}>/{pDen}</span>
                              </div>
                              {isH&&<div style={{fontSize:7,background:'#f59e0b',color:'#000',borderRadius:3,padding:'1px 4px',fontWeight:900,marginTop:2,textAlign:'center',lineHeight:1.5}}>HOJE</div>}
                            </td>
                            <td style={{padding:'11px 14px',maxWidth:200,borderBottom:'1px solid hsl(var(--border-subtle))'}}>
                              <div style={{fontWeight:700,fontSize:12,color:'hsl(var(--text-base))',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{(p as any).evento||'Mensalidade'}</div>
                              <div style={{fontSize:10,color:'hsl(var(--text-muted))',textTransform:'capitalize',marginTop:1}}>{p.competencia}</div>
                              <span style={{display:'inline-flex',alignItems:'center',gap:3,fontSize:9,padding:'2px 7px',borderRadius:20,fontWeight:700,background:sBg,color:sColor,whiteSpace:'nowrap',border:'1px solid '+sColor+'25',marginTop:4}}>{sLabel}</span>
                            </td>
                            <td style={{padding:'12px 14px',borderBottom:'1px solid hsl(var(--border-subtle))',whiteSpace:'nowrap'}}>
                              <div style={{fontFamily:"'JetBrains Mono','Fira Mono',ui-monospace,monospace",fontSize:13,fontWeight:isV||isH?800:600,color:isV?'#ef4444':isH?'#f59e0b':'hsl(var(--text-base))'}}
                              >{p.vencimento ? formatDate(p.vencimento) : '—'}</div>
                              {isV&&atr.dias>0&&<div style={{fontSize:9,color:'#f87171',fontWeight:700,marginTop:2}}>{atr.dias}d atraso</div>}
                            </td>
                            <td style={{padding:'12px 14px',textAlign:'right',fontFamily:"'JetBrains Mono','Fira Mono',ui-monospace,monospace",fontSize:13,fontWeight:500,color:'hsl(var(--text-base))',borderBottom:'1px solid hsl(var(--border-subtle))',whiteSpace:'nowrap'}}>R$ {fmtMoeda(p.valor)}</td>
                            <td style={{padding:'12px 14px',textAlign:'right',borderBottom:'1px solid hsl(var(--border-subtle))',whiteSpace:'nowrap'}}>
                              {p.desconto>0 ? (
                                <div style={{display:'inline-flex',flexDirection:'column',alignItems:'flex-end',gap:1}}>
                                  <span style={{fontFamily:"'JetBrains Mono','Fira Mono',ui-monospace,monospace",fontSize:13,color:'#d97706',fontWeight:700}}>- R$ {fmtMoeda(p.desconto)}</span>
                                  <span style={{fontSize:10,color:'#d97706',opacity:.65,fontWeight:600}}>({p.valor>0?((p.desconto/p.valor)*100).toFixed(1):0}%)</span>
                                </div>
                              ) : <span style={{color:'hsl(var(--text-muted))'}}>—</span>}
                            </td>
                            <td style={{padding:'12px 14px',textAlign:'right',borderBottom:'1px solid hsl(var(--border-subtle))',whiteSpace:'nowrap'}}>
                              <span style={{fontFamily:"'JetBrains Mono','Fira Mono',ui-monospace,monospace",fontSize:13,color:jEx>0?'#ef4444':'hsl(var(--text-muted))',fontWeight:jEx>0?700:400}}>{jEx>0?'R$ '+fmtMoeda(jEx):'—'}</span>
                            </td>
                            <td style={{padding:'12px 14px',textAlign:'right',borderBottom:'1px solid hsl(var(--border-subtle))',whiteSpace:'nowrap'}}>
                              <span style={{fontFamily:"'JetBrains Mono','Fira Mono',ui-monospace,monospace",fontSize:13,color:mEx>0?'#ef4444':'hsl(var(--text-muted))',fontWeight:mEx>0?700:400}}>{mEx>0?'R$ '+fmtMoeda(mEx):'—'}</span>
                            </td>
                            <td style={{padding:'12px 14px',textAlign:'right',borderBottom:'1px solid hsl(var(--border-subtle))',whiteSpace:'nowrap'}}>
                              <div style={{fontFamily:"'JetBrains Mono','Fira Mono',ui-monospace,monospace",fontSize:14,fontWeight:900,color:p.status==='pago'?'#10b981':(jEx+mEx)>0?'#ef4444':'hsl(var(--text-base))'}}>R$ {fmtMoeda(totalP)}</div>
                              {p.status!=='pago'&&(jEx+mEx)>0&&<div style={{fontSize:9,color:'#f87171',fontWeight:600,marginTop:2}}>c/ encargos</div>}
                            </td>
                            <td style={{padding:'12px 14px',borderBottom:'1px solid hsl(var(--border-subtle))',whiteSpace:'nowrap'}}>
                              <span style={{fontFamily:"'JetBrains Mono','Fira Mono',ui-monospace,monospace",fontSize:12,color:'hsl(var(--text-muted))'}}>
                                {(p as any).dtPagto?new Date((p as any).dtPagto+'T12:00').toLocaleDateString('pt-BR'):'—'}
                              </span>
                            </td>

                            <td style={{padding:'11px 14px',textAlign:'center',borderBottom:'1px solid hsl(var(--border-subtle))'}}>
                              {(()=>{
                                // Verifica se já tem boleto emitido no DataContext para esta parcela
                                const tituloEmitido = titulos.find(t =>
                                  (t as any).alunoId === alunoEditando?.id &&
                                  (t.id.includes(String(p.num)) || t.parcela?.startsWith(String(p.num))) &&
                                  t.statusBancario && t.statusBancario !== 'rascunho'
                                )
                                if (p.status === 'pago') return (
                                  <button type="button"
                                    style={{fontSize:10,padding:'5px 10px',borderRadius:8,border:'1px solid rgba(16,185,129,0.3)',background:'rgba(16,185,129,0.07)',color:'#10b981',cursor:'pointer',fontWeight:700,display:'inline-flex',alignItems:'center',gap:3}}
                                    onClick={e=>{e.stopPropagation();setParcelaAtiva(p);setModalRecibo(true)}}>
                                    🧾 Recibo
                                  </button>
                                )
                                return (
                                  <div style={{display:'flex',gap:4,justifyContent:'center',flexWrap:'wrap'}}>
                                    {tituloEmitido ? (
                                      <button type="button"
                                        title="Imprimir boleto já emitido"
                                        style={{fontSize:10,padding:'5px 10px',borderRadius:8,border:'1px solid rgba(14,165,233,0.3)',background:'rgba(14,165,233,0.07)',color:'#0ea5e9',cursor:'pointer',fontWeight:700,display:'inline-flex',alignItems:'center',gap:3,whiteSpace:'nowrap'}}
                                        onClick={e=>{
                                          e.stopPropagation()
                                          if(tituloEmitido.htmlBoleto) {
                                            const w=window.open('','_blank');if(w){w.document.write(tituloEmitido.htmlBoleto);w.document.close()}
                                          }
                                        }}>
                                        🖨️ Imprimir
                                      </button>
                                    ) : (
                                      <span style={{fontSize:10,color:'hsl(var(--text-muted))',fontStyle:'italic'}}>Sem boleto</span>
                                    )}
                                  </div>
                                )
                              })()}
                            </td>
                            <td style={{padding:'11px 14px',textAlign:'center',borderBottom:'1px solid hsl(var(--border-subtle))',whiteSpace:'nowrap'}} onClick={e=>e.stopPropagation()}>
                              {(()=>{
                                const emissao=(p as any).criadoEm||(p as any).dataEmissao
                                const dtStr=emissao
                                  ? new Date(emissao).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'})
                                  : new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'})
                                return(
                                  <span style={{
                                    display:'inline-flex',alignItems:'center',gap:5,
                                    padding:'4px 10px',borderRadius:20,
                                    fontSize:10,fontWeight:700,
                                    fontFamily:"'JetBrains Mono','Fira Mono',ui-monospace,monospace",
                                    background:'rgba(99,102,241,0.08)',
                                    color:'#818cf8',
                                    border:'1px solid rgba(99,102,241,0.2)',
                                    whiteSpace:'nowrap',
                                  }}>
                                    📅 {dtStr}
                                  </span>
                                )
                              })()}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{background:'hsl(var(--bg-elevated))'}}>
                        {/* col 1+2: checkbox + Parc. */}
                        <td colSpan={2} style={{padding:'10px 14px',fontWeight:700,fontSize:11,color:'hsl(var(--text-muted))',borderTop:'2px solid hsl(var(--border-subtle))'}}>
                          Total · {pFilt.length} parcela{pFilt.length!==1?'s':''}
                        </td>
                        {/* col 3: Evento */}
                        <td style={{padding:'10px 14px',fontSize:11,color:'hsl(var(--text-muted))',borderTop:'2px solid hsl(var(--border-subtle))'}}>
                          A Vencer: <strong style={{color:'#6366f1'}}>{aV.length}</strong>
                          {ven.length>0&&<> · Vencido: <strong style={{color:'#ef4444'}}>{ven.length}</strong></>}
                        </td>
                        {/* col 4: Vencimento — vazio */}
                        <td style={{borderTop:'2px solid hsl(var(--border-subtle))'}}/>
                        {/* col 5: Valor Bruto */}
                        <td style={{padding:'10px 14px',textAlign:'right',fontFamily:'monospace',fontWeight:700,fontSize:12,borderTop:'2px solid hsl(var(--border-subtle))'}}>R$ {fmtMoeda(pFilt.reduce((s,p)=>s+p.valor,0))}</td>
                        {/* col 6: Desconto */}
                        <td style={{padding:'10px 14px',textAlign:'right',fontFamily:'monospace',fontWeight:700,fontSize:12,color:'#d97706',borderTop:'2px solid hsl(var(--border-subtle))'}}>- R$ {fmtMoeda(pFilt.reduce((s,p)=>s+p.desconto,0))}</td>
                        {/* col 7+8: Juros + Multa — vazio */}
                        <td colSpan={2} style={{borderTop:'2px solid hsl(var(--border-subtle))'}}/>
                        {/* col 9: Total a Pagar */}
                        <td style={{padding:'10px 14px',textAlign:'right',fontFamily:'monospace',fontWeight:900,fontSize:14,color:'#10b981',borderTop:'2px solid hsl(var(--border-subtle))'}}>R$ {fmtMoeda(pFilt.reduce((s,p)=>s+p.valorFinal+((p as any).juros||0)+((p as any).multa||0),0))}</td>
                        {/* col 10+11+12: Pagamento + Ação + Dt.Emissão — vazio */}
                        <td colSpan={3} style={{borderTop:'2px solid hsl(var(--border-subtle))'}}/>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* BARRA STATUS INFERIOR */}
              <div style={{padding:'10px 20px',borderTop:'1px solid hsl(var(--border-subtle))',display:'flex',alignItems:'center',justifyContent:'space-between',background:'hsl(var(--bg-elevated))',fontSize:11,flexWrap:'wrap',gap:8}}>
                <div style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:0}}>
                  {[
                    {l:'A Vencer',v:parcelas.filter(p=>p.status!=='pago'&&p.status!=='cancelado').reduce((s,p)=>s+p.valorFinal,0),isV:true,c:'#6366f1'},
                    {l:'Recebido',v:parcelas.filter(p=>p.status==='pago').reduce((s,p)=>s+p.valorFinal,0),isV:true,c:'#10b981'},
                    {l:'Parcelas',n:parcelas.filter(p=>p.status!=='cancelado').length,isV:false,c:'hsl(var(--text-base))'},
                    {l:'Canceladas',n:parcelas.filter(p=>p.status==='cancelado').length,isV:false,c:'#f87171'},
                  ].map((item,i)=>(
                    <div key={item.l} style={{display:'flex',alignItems:'center'}}>
                      {i>0&&<span style={{width:1,height:14,background:'hsl(var(--border-subtle))',display:'inline-block',margin:'0 14px'}}/>}
                      <span style={{color:'hsl(var(--text-muted))'}}>{item.l}: </span>
                      <strong style={{color:item.c,fontFamily:(item as any).isV?'monospace':'inherit'}}>
                        {(item as any).isV?('R$ '+fmtMoeda((item as any).v)):(item as any).n}
                      </strong>
                    </div>
                  ))}
                </div>

              </div>
            </>
          )
        })()}
      </div>


      {/* ══ EXTRA MODALS: Boleto, Obs Aluno, Consulta Baixa, Itens Excluídos ══ */}

      {/* ══ MODAL EMITIR BOLETO (integrado com Financeiro → Boletos/Convênios) ══ */}
      {modalBoleto && alunoEditando && parcelasParaBoleto.length > 0 && (
        <ModalEmitirAluno
          aluno={alunoEditando}
          parcelasRaw={parcelasParaBoleto}
          convenios={cfgConvenios}
          titulos={titulos}
          onEmitido={(titulosAtualizados, novoSeq, convenioId) => {
            // Persiste no DataContext compartilhado (mesmo que boletos/page.tsx usa)
            setTitulos((prev: any) => {
              const mapa = new Map(prev.map((t: any) => [t.id, t]))
              for (const t of titulosAtualizados) mapa.set(t.id, t)
              return Array.from(mapa.values()) as import('@/lib/dataContext').Titulo[]
            })
            setCfgConvenios((prev: any) => prev.map((c: any) =>
              c.id === convenioId ? { ...c, nossoNumeroSequencial: novoSeq } : c
            ))
          }}
          onClose={() => { setModalBoleto(false); setParcelasParaBoleto([]) }}
        />
      )}

      {/* ══ MODAL HISTÓRICO DE BOLETOS ══ */}
      {modalHistorico && alunoEditando && (
        <ModalHistoricoBoletos
          aluno={alunoEditando}
          titulos={titulos}
          onSolicitarVia={(titulo) => { setModalHistorico(false); setModal2aVia(titulo) }}
          onClose={() => setModalHistorico(false)}
        />
      )}

      {/* ══ MODAL 2ª VIA ══ */}
      {modal2aVia && (
        <Modal2aVia
          titulo={modal2aVia}
          convenios={cfgConvenios}
          alunos={alunos}
          onReemitido={(titulosAtualizados, novoSeq, convenioId) => {
            setTitulos((prev: any) => {
              const mapa = new Map(prev.map((t: any) => [t.id, t]))
              for (const t of titulosAtualizados) mapa.set(t.id, t)
              return Array.from(mapa.values()) as import('@/lib/dataContext').Titulo[]
            })
            setCfgConvenios((prev: any) => prev.map((c: any) =>
              c.id === convenioId ? { ...c, nossoNumeroSequencial: novoSeq } : c
            ))
          }}
          onClose={() => setModal2aVia(null)}
        />
      )}








      {/* MODAL OBS FINANCEIRA DO ALUNO */}
      {modalObsAluno&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:4500,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'hsl(var(--bg-base))',borderRadius:20,width:'100%',maxWidth:480,border:'1px solid hsl(var(--border-subtle))',boxShadow:'0 40px 120px rgba(0,0,0,0.8)'}}>
            <div style={{padding:'18px 24px',borderBottom:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'space-between',alignItems:'center',background:'linear-gradient(135deg,rgba(244,114,182,0.1),rgba(236,72,153,0.04))'}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:40,height:40,borderRadius:10,background:'rgba(244,114,182,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>📝</div><div><div style={{fontWeight:800,fontSize:15}}>Observação Financeira do Aluno</div><div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>{aluno.nome||'—'}</div></div></div>
              <button className="btn btn-ghost btn-icon" onClick={()=>setModalObsAluno(false)}><X size={18}/></button>
            </div>
            <div style={{padding:'20px 24px'}}>
              <textarea className="form-input" rows={6} value={obsAlunoFin} onChange={e=>setObsAlunoFin(e.target.value)} placeholder="Registro de ocorrências, acordos, negociações, histórico financeiro..."/>
            </div>
            <div style={{padding:'14px 24px',borderTop:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'flex-end',gap:10,background:'hsl(var(--bg-elevated))'}}>
              <button className="btn btn-secondary" onClick={()=>setModalObsAluno(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{background:'linear-gradient(135deg,#f472b6,#ec4899)'}} onClick={()=>{
                // Persistir imediatamente no DataContext
                if (alunoEditando) {
                  setAlunos(prev => prev.map(a => a.id === alunoEditando.id ? {...a, obsFinanceiro: obsAlunoFin} : a))
                }
                setModalObsAluno(false)
              }}><Check size={14}/> Salvar Obs.</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONSULTA BAIXA */}
      {modalConsultaBaixa&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:4500,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'hsl(var(--bg-base))',borderRadius:20,width:'100%',maxWidth:620,maxHeight:'85vh',border:'1px solid hsl(var(--border-subtle))',boxShadow:'0 40px 120px rgba(0,0,0,0.8)',display:'flex',flexDirection:'column'}}>
            <div style={{padding:'18px 24px',borderBottom:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'space-between',alignItems:'center',background:'linear-gradient(135deg,rgba(56,189,248,0.1),rgba(14,165,233,0.04))',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:40,height:40,borderRadius:10,background:'rgba(56,189,248,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>🔍</div><div><div style={{fontWeight:800,fontSize:15}}>Consultar Baixas Realizadas</div><div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>Histórico de pagamentos registrados</div></div></div>
              <button className="btn btn-ghost btn-icon" onClick={()=>setModalConsultaBaixa(false)}><X size={18}/></button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'16px 24px'}}>
              {(()=>{
                const pagas = parcelas.filter(p=>p.status==='pago');
                if(pagas.length===0) return <div style={{textAlign:'center',padding:40,color:'hsl(var(--text-muted))'}}><div style={{fontSize:40}}>📭</div><div style={{marginTop:12,fontWeight:700}}>Nenhuma baixa registrada</div></div>;
                
                const grupos: Record<string, any[]> = {};
                pagas.forEach(p=>{
                  const key = (p as any).codBaixa || `IND-${p.num}`;
                  if(!grupos[key]) grupos[key] = [];
                  grupos[key].push(p);
                });
                
                // Sort by the first parcel's dtPagto assuming it's a valid string like YYYY-MM-DD
                const renderList = Object.entries(grupos).sort((a,b)=>new Date(b[1][0].dtPagto+'T12:00').getTime() - new Date(a[1][0].dtPagto+'T12:00').getTime());

                return renderList.map(([key, items])=>{
                  const totalG = items.reduce((s,p)=>s+p.valorFinal,0);
                  const isLote = items.length > 1;
                  const isBaixaResp = (items[0] as any).baixaPorResponsavel === true;
                  const first = items[0];
                  const nomeResp = (first as any).nomeResponsavel || '';
                  // Se for baixa por responsável, exibe as parcelas cross-aluno salvas
                  const parcelasVinc: any[] = (first as any).parcelasVinculadas || [];
                  return (
                    <div key={key} style={{padding:'14px 18px',borderRadius:12,background:isBaixaResp?'rgba(99,102,241,0.05)':'rgba(16,185,129,0.04)',border:`1px solid ${isBaixaResp?'rgba(99,102,241,0.3)':'rgba(16,185,129,0.2)'}`,marginBottom:10,cursor:'pointer',transition:'all 0.2s',display:'flex',flexDirection:'column',gap:8}}
                      onMouseEnter={e=>{e.currentTarget.style.background=isBaixaResp?'rgba(99,102,241,0.1)':'rgba(16,185,129,0.08)';e.currentTarget.style.borderColor=isBaixaResp?'rgba(99,102,241,0.5)':'rgba(16,185,129,0.4)'}} 
                      onMouseLeave={e=>{e.currentTarget.style.background=isBaixaResp?'rgba(99,102,241,0.05)':'rgba(16,185,129,0.04)';e.currentTarget.style.borderColor=isBaixaResp?'rgba(99,102,241,0.3)':'rgba(16,185,129,0.2)'}}
                      onClick={()=>{
                        setParcelasSelected(items.map(i=>i.num));
                        setModalConsultaBaixa(false);
                        setModalRecibo(true);
                      }}
                    >
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div style={{display:'flex',alignItems:'center',gap:12}}>
                          <div style={{width:32,height:32,background:isBaixaResp?'rgba(99,102,241,0.15)':isLote?'rgba(16,185,129,0.15)':'rgba(99,102,241,0.15)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>
                            {isBaixaResp?'👨‍👧':isLote?'📦':'📄'}
                          </div>
                          <div>
                            <div style={{display:'flex',alignItems:'center',gap:8}}>
                              <div style={{fontWeight:800,fontSize:14,color:'hsl(var(--text-base))'}}>{isBaixaResp ? 'Baixa por Responsável' : isLote ? 'Baixa em Lote' : (first.evento||'Mensalidade')}</div>
                              {isBaixaResp && <span style={{fontSize:9,padding:'2px 7px',borderRadius:12,background:'rgba(99,102,241,0.15)',color:'#818cf8',fontWeight:700,letterSpacing:.5}}>RESP. FINANCEIRO</span>}
                            </div>
                            <div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>
                              {isBaixaResp
                                ? <>{nomeResp && <><strong style={{color:'#818cf8'}}>{nomeResp}</strong> · </>}{parcelasVinc.length||items.length} parcela(s) de {[...new Set(parcelasVinc.map((v:any)=>v.alunoNome))].length||1} aluno(s)</>
                                : isLote ? `${items.length} parcelas agrupadas` : `Parcela ${String(first.num).padStart(2,'0')}`
                              }
                            </div>
                          </div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontFamily:'monospace',fontWeight:900,fontSize:16,color:isBaixaResp?'#818cf8':'#10b981'}}>R$ {fmtMoeda(totalG)}</div>
                          <div style={{fontSize:10,color:isBaixaResp?'#818cf8':'#10b981',fontWeight:700,letterSpacing:.5}}>PAGO</div>
                        </div>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,fontSize:11,color:'hsl(var(--text-muted))',background:'hsl(var(--bg-elevated))',padding:'8px 12px',borderRadius:6,border:'1px dashed hsl(var(--border-subtle))'}}>
                        <span>Dt. Pgt: <strong style={{color:'hsl(var(--text-base))'}}>{first.dtPagto?new Date(first.dtPagto+'T12:00').toLocaleDateString('pt-BR'):'—'}</strong></span>
                        <span>Cód: <strong style={{color:isBaixaResp?'#818cf8':'#34d399',fontFamily:'monospace'}}>{first.codBaixa||'—'}</strong></span>
                        <span>Forma: <strong style={{color:'#818cf8'}}>{first.formaPagto||'—'}</strong></span>
                        {(first.comprovante) && <span>Comprov.: <strong style={{color:'#f472b6'}}>{first.comprovante}</strong></span>}
                      </div>
                      {/* Parcelas vinculadas (baixa por responsável) */}
                      {isBaixaResp && parcelasVinc.length > 0 && (
                        <div style={{borderRadius:8,overflow:'hidden',border:'1px solid rgba(99,102,241,0.2)'}}>
                          <div style={{background:'rgba(99,102,241,0.1)',padding:'5px 12px',fontSize:10,fontWeight:700,color:'#818cf8',letterSpacing:.5}}>
                            PARCELAS DESTA BAIXA — {[...new Set(parcelasVinc.map((v:any)=>v.alunoNome))].join(', ')}
                          </div>
                          <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                            <tbody>
                              {parcelasVinc.map((v:any,i:number)=>(
                                <tr key={i} style={{borderBottom:i<parcelasVinc.length-1?'1px solid hsl(var(--border-subtle))':'none',background:i%2===0?'transparent':'rgba(99,102,241,0.03)'}}>
                                  <td style={{padding:'4px 12px',fontWeight:700,color:'hsl(var(--text-base))',whiteSpace:'nowrap',maxWidth:130,overflow:'hidden',textOverflow:'ellipsis'}}>{v.alunoNome}</td>
                                  <td style={{padding:'4px 8px',color:'hsl(var(--text-muted))'}}>{v.evento||'Mensalidade'}</td>
                                  <td style={{padding:'4px 8px',color:'hsl(var(--text-muted))',fontSize:10,textTransform:'capitalize'}}>{v.competencia}</td>
                                  <td style={{padding:'4px 12px',fontFamily:'monospace',fontWeight:800,color:'#818cf8',textAlign:'right',whiteSpace:'nowrap'}}>R$ {fmtMoeda(v.valor)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {(()=>{
                        const cartoes = ((first as any).formasPagto||[]).filter((f:any)=>f.cartao&&(f.forma?.toLowerCase().includes('crédito')||f.forma?.toLowerCase().includes('débito')||f.forma?.toLowerCase().includes('credito')||f.forma?.toLowerCase().includes('debito')))
                        if(cartoes.length===0) return null
                        return (
                          <div style={{background:'rgba(129,140,248,0.06)',border:'1px solid rgba(129,140,248,0.2)',borderRadius:8,padding:'8px 12px',fontSize:11}}>
                            <div style={{fontWeight:700,color:'#818cf8',marginBottom:6,fontSize:10,letterSpacing:.5}}>DADOS DO CARTÃO</div>
                            {cartoes.map((f:any,i:number)=>(
                              <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:4,marginBottom:i<cartoes.length-1?6:0}}>
                                <span>Bandeira: <strong style={{color:'hsl(var(--text-base))'}}>{f.cartao.bandeira||'—'}</strong></span>
                                <span>Final: <strong style={{color:'hsl(var(--text-base))',fontFamily:'monospace'}}>{f.cartao.numero?'**** '+f.cartao.numero.slice(-4):'—'}</strong></span>
                                <span>Titular: <strong style={{color:'hsl(var(--text-base))'}}>{f.cartao.nome||'—'}</strong></span>
                                {f.cartao.parcelas&&Number(f.cartao.parcelas)>1&&<span>Parcelas: <strong style={{color:'#f59e0b'}}>{f.cartao.parcelas}x</strong></span>}
                                {f.cartao.autorizacao&&<span>Aut: <strong style={{color:'#34d399',fontFamily:'monospace'}}>{f.cartao.autorizacao}</strong></span>}
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                      {(first.obs||first.obsFin) && (
                         <div style={{marginTop:4,fontSize:11,color:'hsl(var(--text-muted))',background:'rgba(245,158,11,0.06)',border:'1px solid rgba(245,158,11,0.2)',padding:'6px 12px',borderRadius:6}}>
                           <strong style={{color:'#d97706'}}>Obs:</strong> {first.obs||first.obsFin}
                         </div>
                      )}
                    </div>
                  )
                })
              })()}
            </div>
            <div style={{padding:'14px 24px',borderTop:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'flex-end',background:'hsl(var(--bg-elevated))',flexShrink:0}}>
              <button className="btn btn-secondary" onClick={()=>setModalConsultaBaixa(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RECIBO */}
      {modalRecibo&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:5000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          {(() => {
            const pagas = parcelasSelected.length > 0 ? parcelas.filter(p => parcelasSelected.includes(p.num)) : (parcelaAtiva ? [parcelaAtiva] : []);
            const total = pagas.reduce((s,p)=>s+p.valorFinal,0);
            const ref = pagas[0] || {} as any;
            return (
              <div style={{background:'hsl(var(--bg-base))',borderRadius:20,width:'100%',maxWidth:480,boxShadow:'0 40px 120px rgba(0,0,0,0.9)',display:'flex',flexDirection:'column',overflow:'hidden',border:'1px solid rgba(16,185,129,0.3)'}}>
                <div style={{background:'linear-gradient(135deg,#10b981,#059669)',color:'#fff',padding:'24px',textAlign:'center',position:'relative'}}>
                  <button style={{position:'absolute',top:16,right:16,background:'rgba(255,255,255,0.2)',border:'none',color:'#fff',width:28,height:28,borderRadius:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setModalRecibo(false)}><X size={16}/></button>
                  <div style={{width:60,height:60,background:'rgba(255,255,255,0.2)',borderRadius:30,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,margin:'0 auto 12px'}}>🧾</div>
                  <h3 style={{fontSize:18,fontWeight:800,margin:0}}>Comprovante de Pagamento</h3>
                  <div style={{fontSize:12,opacity:0.9,marginTop:4}}>Colégio Edu Impacto — CNPJ: 14.505.777/0001-90</div>
                </div>
                <div style={{padding:'24px'}}>
                  <div style={{textAlign:'center',marginBottom:24}}>
                    <div style={{fontSize:11,color:'hsl(var(--text-muted))',fontWeight:700,letterSpacing:1,marginBottom:4}}>VALOR RECEBIDO</div>
                    <div style={{fontFamily:'monospace',fontSize:36,fontWeight:900,color:'#10b981',lineHeight:1}}>R$ {fmtMoeda(total)}</div>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:12,fontSize:13}}>
                    <div style={{display:'flex',justifyContent:'space-between',borderBottom:'1px dashed hsl(var(--border-subtle))',paddingBottom:8}}>
                      <span style={{color:'hsl(var(--text-muted))'}}>Aluno</span>
                      <strong style={{textAlign:'right'}}>{aluno.nome}</strong>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',borderBottom:'1px dashed hsl(var(--border-subtle))',paddingBottom:8}}>
                      <span style={{color:'hsl(var(--text-muted))'}}>Itens Pagos</span>
                      <div className="custom-scrollbar" style={{textAlign:'right',maxHeight:160,overflowY:'auto',paddingRight:6}}>
                        {pagas.map((p,idx)=>(
                          <div key={p.num} style={{marginBottom:idx===pagas.length-1?0:6}}>
                            <div style={{fontWeight:800,lineHeight:1.2}}>{(p as any).evento||'Mensalidade'}</div>
                            <div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>Parc. {String(p.num).padStart(2,'0')} — <strong style={{color:'hsl(var(--text-base))'}}>R$ {fmtMoeda(p.valorFinal)}</strong></div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',borderBottom:'1px dashed hsl(var(--border-subtle))',paddingBottom:8}}>
                      <span style={{color:'hsl(var(--text-muted))'}}>Data do Pagamento</span>
                      <strong>{ref.dtPagto?new Date(ref.dtPagto+'T12:00').toLocaleDateString('pt-BR'):'—'}</strong>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',borderBottom:'1px dashed hsl(var(--border-subtle))',paddingBottom:8}}>
                      <span style={{color:'hsl(var(--text-muted))'}}>Forma de Pagto</span>
                      <strong>{ref.formaPagto||'—'}</strong>
                    </div>
                    {ref.comprovante && (
                      <div style={{display:'flex',justifyContent:'space-between',borderBottom:'1px dashed hsl(var(--border-subtle))',paddingBottom:8}}>
                        <span style={{color:'hsl(var(--text-muted))'}}>N. Comprovante / Doc.</span>
                        <strong style={{fontFamily:'monospace',color:'#f472b6'}}>{ref.comprovante}</strong>
                      </div>
                    )}
                    <div style={{display:'flex',justifyContent:'space-between',borderBottom:'1px dashed hsl(var(--border-subtle))',paddingBottom:8}}>
                      <span style={{color:'hsl(var(--text-muted))'}}>Código de Autenticação</span>
                      <strong style={{fontFamily:'monospace',color:'#6366f1'}}>{ref.codBaixa||'—'}</strong>
                    </div>
                    {(()=>{
                      const cartoes = ((ref as any).formasPagto||[]).filter((f:any)=>f.cartao&&(f.forma?.toLowerCase().includes('crédito')||f.forma?.toLowerCase().includes('débito')||f.forma?.toLowerCase().includes('credito')||f.forma?.toLowerCase().includes('debito')))
                      if(cartoes.length===0) return null
                      return (
                        <div style={{padding:'12px 14px',background:'rgba(129,140,248,0.06)',border:'1px solid rgba(129,140,248,0.25)',borderRadius:10,borderBottom:'none'}}>
                          <div style={{fontSize:11,fontWeight:700,color:'#818cf8',marginBottom:10,letterSpacing:.5}}>DADOS DO CARTÃO</div>
                          {cartoes.map((f:any,i:number)=>(
                            <div key={i} style={{display:'flex',flexDirection:'column',gap:6,fontSize:13,marginBottom:i<cartoes.length-1?12:0}}>
                              <div style={{display:'flex',justifyContent:'space-between'}}>
                                <span style={{color:'hsl(var(--text-muted))'}}>Bandeira / Tipo</span>
                                <strong>{f.cartao.bandeira||'—'}</strong>
                              </div>
                              <div style={{display:'flex',justifyContent:'space-between'}}>
                                <span style={{color:'hsl(var(--text-muted))'}}>Nº Cartão (Final)</span>
                                <strong style={{fontFamily:'monospace'}}>{f.cartao.numero?'**** **** **** '+f.cartao.numero.slice(-4):'—'}</strong>
                              </div>
                              <div style={{display:'flex',justifyContent:'space-between'}}>
                                <span style={{color:'hsl(var(--text-muted))'}}>Titular</span>
                                <strong>{f.cartao.nome||'—'}</strong>
                              </div>
                              {f.cartao.validade&&<div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'hsl(var(--text-muted))'}}>Validade</span><strong>{f.cartao.validade}</strong></div>}
                              {f.cartao.parcelas&&Number(f.cartao.parcelas)>1&&<div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'hsl(var(--text-muted))'}}>Parcelas Cartão</span><strong style={{color:'#f59e0b'}}>{f.cartao.parcelas}x</strong></div>}
                              {f.cartao.autorizacao&&<div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'hsl(var(--text-muted))'}}>Nº Autorização</span><strong style={{fontFamily:'monospace',color:'#34d399'}}>{f.cartao.autorizacao}</strong></div>}
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                    {(ref.obs||ref.obsFin) && (
                      <div style={{padding:'10px 14px',background:'rgba(245,158,11,0.06)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:8}}>
                        <div style={{fontSize:11,fontWeight:700,color:'#d97706',marginBottom:4}}>Observação</div>
                        <div style={{fontSize:12,color:'hsl(var(--text-base))'}}>{ref.obs||ref.obsFin}</div>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{padding:'16px 24px',background:'hsl(var(--bg-elevated))',display:'flex',justifyContent:'space-between',gap:12}}>
                  <button className="btn btn-secondary" style={{flex:1}} onClick={()=>{setModalRecibo(false); setModalConsultaBaixa(true)}}>Voltar</button>
                  <button className="btn btn-primary" style={{flex:1}} onClick={()=>window.print()}><Printer size={16}/> Imprimir Via</button>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* MODAL ITENS EXCLUÍDOS */}
      {modalItensExcluidos&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:4500,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'hsl(var(--bg-base))',borderRadius:20,width:'100%',maxWidth:600,maxHeight:'85vh',border:'1px solid hsl(var(--border-subtle))',boxShadow:'0 40px 120px rgba(0,0,0,0.8)',display:'flex',flexDirection:'column'}}>
            <div style={{padding:'18px 24px',borderBottom:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'space-between',alignItems:'center',background:'linear-gradient(135deg,rgba(107,114,128,0.1),rgba(75,85,99,0.04))',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:40,height:40,borderRadius:10,background:'rgba(107,114,128,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>🗂️</div><div><div style={{fontWeight:800,fontSize:15}}>Itens Excluídos</div><div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>Parcelas removidas — podem ser restauradas</div></div></div>
              <button className="btn btn-ghost btn-icon" onClick={()=>setModalItensExcluidos(false)}><X size={18}/></button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'16px 24px'}}>
              {(()=>{
                const excl=parcelas.filter(p=>p.status==='cancelado')
                if(excl.length===0) return <div style={{textAlign:'center',padding:40,color:'hsl(var(--text-muted))'}}><div style={{fontSize:40}}>✅</div><div style={{marginTop:12,fontWeight:700}}>Nenhum item excluído</div></div>
                return excl.map((p,i)=>(
                  <div key={i} style={{padding:'10px 16px',borderRadius:12,background:'rgba(239,68,68,0.04)',border:'1px solid rgba(239,68,68,0.15)',marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:12}}>{(p as any).evento||'Mensalidade'} — Parcela {p.num}</div>
                      <div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>Vcto: {p.vencimento ? formatDate(p.vencimento) : '—'} · R$ {fmtMoeda(p.valorFinal)} · Excluído em {(p as any).dataExclusao}</div>
                      {(p as any).motivoExclusao&&<div style={{fontSize:10,marginTop:3,color:'#f87171',fontStyle:'italic'}}>Motivo: {(p as any).motivoExclusao}</div>}
                    </div>
                    <button type="button" style={{fontSize:11,padding:'4px 12px',borderRadius:8,border:'1px solid rgba(16,185,129,0.4)',background:'rgba(16,185,129,0.08)',color:'#10b981',cursor:'pointer',fontWeight:700}}
                      onClick={()=>{
                        setParcelas(prev=>prev.map(item=>item.num===p.num?{...item,status:'pendente',dataExclusao:undefined,motivoExclusao:undefined}:item))
                      }}>↩ Restaurar</button>
                  </div>
                ))
              })()}
            </div>
            <div style={{padding:'14px 24px',borderTop:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'flex-end',background:'hsl(var(--bg-elevated))',flexShrink:0}}>
              <button className="btn btn-secondary" onClick={()=>setModalItensExcluidos(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EXCLUIR COM MOTIVO */}
      {modalExcluirMotivo&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:4500,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
        <div style={{background:'hsl(var(--bg-base))',borderRadius:20,width:'100%',maxWidth:460,border:'1px solid rgba(239,68,68,0.3)',boxShadow:'0 40px 120px rgba(0,0,0,0.8)'}}>
          <div style={{padding:'18px 24px',borderBottom:'1px solid rgba(239,68,68,0.2)',display:'flex',justifyContent:'space-between',alignItems:'center',background:'linear-gradient(135deg,rgba(239,68,68,0.1),rgba(239,68,68,0.04))'}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:40,height:40,borderRadius:10,background:'rgba(239,68,68,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>🗑️</div><div style={{fontWeight:800,fontSize:15,color:'#f87171'}}>Excluir Parcelas</div></div>
            <button className="btn btn-ghost btn-icon" onClick={()=>setModalExcluirMotivo(false)}><X size={18}/></button>
          </div>
          <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:14}}>
            <div style={{padding:'10px 14px',background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:10,fontSize:12}}>
              <strong style={{color:'#f87171'}}>{parcelasSelected.length} parcela(s)</strong> serão movidas para "Itens Excluídos" e poderão ser restauradas.
            </div>
            <div>
              <label className="form-label" style={{fontSize:11,marginBottom:6,display:'block'}}>Motivo da Exclusão <span style={{color:'#f87171'}}>*</span></label>
              <textarea className="form-input" rows={3} value={excluirMotivo} onChange={e=>setExcluirMotivo(e.target.value)} placeholder="Ex: Parcela lançada incorretamente..."/>
            </div>
          </div>
          <div style={{padding:'14px 24px',borderTop:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'flex-end',gap:10,background:'hsl(var(--bg-elevated))'}}>
            <button className="btn btn-secondary" onClick={()=>setModalExcluirMotivo(false)}>Cancelar</button>
              <button className="btn" style={{background:'linear-gradient(135deg,#ef4444,#dc2626)',color:'white',fontWeight:700,padding:'8px 20px',borderRadius:10,border:'none',cursor:excluirMotivo.trim()?'pointer':'not-allowed',opacity:excluirMotivo.trim()?1:0.5}}
              disabled={!excluirMotivo.trim()}
              onClick={()=>{
                const codigasBaixaPaga = parcelas
                  .filter(p=>parcelasSelected.includes(p.num)&&p.status==='pago'&&p.codBaixa)
                  .map(p=>p.codBaixa as string)
                setParcelas(prev=>prev.map(p=>parcelasSelected.includes(p.num)?{...p,status:'cancelado',dataExclusao:new Date().toLocaleDateString('pt-BR'),motivoExclusao:excluirMotivo}:p))
                if(codigasBaixaPaga.length>0){
                  setMovimentacoesManuais((prev:any)=>prev.filter((m:any)=>!codigasBaixaPaga.includes(m.referenciaId)))
                }
                setParcelasSelected([])
                setModalExcluirMotivo(false)
                setExcluirMotivo('')
              }}>🗑️ Confirmar Exclusão</button>
          </div>
        </div>
      </div>)}

      {/* MODAL EXCLUIR BAIXA */}
      {modalExcluirBaixa&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:4500,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
        <div style={{background:'hsl(var(--bg-base))',borderRadius:20,width:'100%',maxWidth:500,border:'1px solid rgba(249,115,22,0.3)',boxShadow:'0 40px 120px rgba(0,0,0,0.8)'}}>
          <div style={{padding:'18px 24px',borderBottom:'1px solid rgba(249,115,22,0.2)',display:'flex',justifyContent:'space-between',alignItems:'center',background:'linear-gradient(135deg,rgba(249,115,22,0.1),rgba(249,115,22,0.04))'}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:40,height:40,borderRadius:10,background:'rgba(249,115,22,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>↩️</div><div><div style={{fontWeight:800,fontSize:15,color:'#f97316'}}>Excluir Baixa</div><div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>Estornar pagamento registrado</div></div></div>
            <button className="btn btn-ghost btn-icon" onClick={()=>setModalExcluirBaixa(false)}><X size={18}/></button>
          </div>
          <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:14}}>
            {(()=>{
              const pagasSelecionadas=parcelas.filter(p=>parcelasSelected.includes(p.num)&&p.status==='pago')
              const codigosAfetados=pagasSelecionadas.map(p=>p.codBaixa).filter(Boolean)
              const pagas=parcelas.filter(p=>(parcelasSelected.includes(p.num)||(p.codBaixa&&codigosAfetados.includes(p.codBaixa)&&p.codBaixa.endsWith('LL')))&&p.status==='pago')
              if(pagas.length===0) return (
                <div style={{textAlign:'center',padding:32,color:'hsl(var(--text-muted))'}}>
                  <div style={{fontSize:40}}>⚠️</div>
                  <div style={{marginTop:12,fontWeight:700}}>Nenhuma parcela paga selecionada</div>
                  <div style={{fontSize:11,marginTop:6}}>Selecione apenas parcelas com status "Pago" para excluir a baixa.</div>
                </div>
              )
              return (<>
                <div style={{padding:'10px 14px',background:'rgba(249,115,22,0.06)',border:'1px solid rgba(249,115,22,0.2)',borderRadius:10,fontSize:12}}>
                  <strong style={{color:'#f97316'}}>{pagas.length} baixa(s)</strong> serão estornadas. As parcelas voltam ao status <strong>Pendente</strong>.
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {pagas.map(p=>(
                    <div key={p.num} style={{padding:'8px 14px',borderRadius:10,background:'rgba(249,115,22,0.04)',border:'1px solid rgba(249,115,22,0.15)',display:'flex',justifyContent:'space-between',fontSize:12}}>
                      <span><strong>{(p as any).evento||'Mensalidade'}</strong> · Parcela {p.num} · Vcto {p.vencimento ? formatDate(p.vencimento) : '—'}</span>
                      <span style={{color:'#10b981',fontFamily:'monospace',fontWeight:700}}>R$ {fmtMoeda(p.valorFinal)}</span>
                    </div>
                  ))}
                </div>
                <div style={{padding:'14px 24px',borderTop:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'flex-end',gap:10,background:'hsl(var(--bg-elevated))',margin:'0 -24px -20px',borderRadius:'0 0 20px 20px'}}>
                  <button className="btn btn-secondary" onClick={()=>setModalExcluirBaixa(false)}>Cancelar</button>
                  <button className="btn" style={{background:'linear-gradient(135deg,#f97316,#ea580c)',color:'white',fontWeight:700,padding:'8px 20px',borderRadius:10,border:'none',cursor:'pointer'}}
                    onClick={()=>{
                      const codigosAfetados=parcelas.filter(p=>parcelasSelected.includes(p.num)&&p.status==='pago').map(p=>p.codBaixa).filter(Boolean)
                      const todosCodigosEstornados=[...new Set([
                        ...parcelas.filter(p=>parcelasSelected.includes(p.num)&&p.status==='pago').map(p=>p.codBaixa).filter(Boolean),
                        ...codigosAfetados
                      ])]
                      setParcelas(prev=>prev.map(p=>{
                        const isDireto = parcelasSelected.includes(p.num)
                        const isInLote = p.codBaixa && codigosAfetados.includes(p.codBaixa) && p.codBaixa.endsWith('LL')
                        if((isDireto || isInLote) && p.status==='pago'){
                          return {...p,status:'pendente',dtPagto:undefined,formaPagto:undefined,codBaixa:undefined,juros:0,multa:0,obsFin:undefined,comprovante:undefined}
                        }
                        return p
                      }))
                      if(todosCodigosEstornados.length>0){
                        setMovimentacoesManuais((prev:any)=>prev.filter((m:any)=>!todosCodigosEstornados.includes(m.referenciaId)))
                      }
                      setParcelasSelected([])
                      setModalExcluirBaixa(false)
                    }}>↩️ Estornar Baixa(s)</button>
                </div>
              </>)
            })()}
          </div>
        </div>
      </div>)}

      {/* MODAL DESCONTO */}
      {modalDesconto&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:4000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
        <div style={{background:'hsl(var(--bg-base))',borderRadius:20,width:'100%',maxWidth:520,border:'1px solid hsl(var(--border-subtle))',boxShadow:'0 40px 120px rgba(0,0,0,0.8)'}}>
          <div style={{padding:'18px 24px',borderBottom:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'space-between',alignItems:'center',background:'linear-gradient(135deg,rgba(245,158,11,0.1),rgba(251,191,36,0.04))'}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:40,height:40,borderRadius:10,background:'rgba(245,158,11,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>🏷️</div><div><div style={{fontWeight:800,fontSize:15}}>Aplicar Desconto em Lote</div><div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>Filtre por evento e intervalo de parcelas</div></div></div>
            <button className="btn btn-ghost btn-icon" onClick={()=>setModalDesconto(false)}><X size={18}/></button>
          </div>
          <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:14}}>
            {/* Seleção do Evento */}
            <div>
              <label className="form-label" style={{fontSize:11,marginBottom:6,display:'block'}}>Evento (filtro de parcelas)</label>
              <select className="form-input" value={descLote.eventoId||''} onChange={e=>{
                  const ev=e.target.value
                  const nums=parcelas.filter(p=>(p as any).evento===ev||!ev).map(p=>p.num)
                  setDescLote(d=>({...d,eventoId:ev,parcelasEvento:nums,deParcela:nums.length?String(Math.min(...nums)):'1',ateParcela:nums.length?String(Math.max(...nums)):String(parcelas.length)}))
                }}
                style={{fontWeight:600}}>
                <option value="">— Todos os eventos —</option>
                {[...new Set(parcelas.map(p=>(p as any).evento).filter(Boolean))].map((ev:any)=>(
                  <option key={ev} value={ev}>{ev}</option>
                ))}
              </select>
              {descLote.eventoId&&(()=>{
                const evParcelas=parcelas.filter(p=>(p as any).evento===descLote.eventoId&&p.status!=='pago'&&p.num>=parseInt(descLote.deParcela||'1')&&p.num<=parseInt(descLote.ateParcela||'9999'))
                return evParcelas.length>0&&(
                  <div style={{marginTop:6,padding:'6px 12px',background:'rgba(245,158,11,0.08)',borderRadius:8,fontSize:11,color:'hsl(var(--text-muted))'}}>
                    <strong style={{color:'#f59e0b'}}>{evParcelas.length} parcelas</strong> deste evento serão afetadas (de {evParcelas.length?1:0} até {evParcelas.length})
                  </div>
                )
              })()}
            </div>
            {/* Manter Desconto toggle */}
            <div style={{padding:'12px 16px',background:'rgba(16,185,129,0.04)',border:'1px solid rgba(16,185,129,0.2)',borderRadius:10}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontWeight:700,fontSize:13}}>Manter Desconto</div>
                  <div style={{fontSize:11,color:'hsl(var(--text-muted))',marginTop:2}}>Mesmo após o vencimento da parcela, o desconto será mantido.</div>
                </div>
                <button type="button" onClick={()=>setDescLote(d=>({...d,manterDesconto:!(d as any).manterDesconto}))}
                  style={{width:44,height:24,borderRadius:12,border:'none',cursor:'pointer',
                    background:(descLote as any).manterDesconto?'#10b981':'hsl(var(--border-subtle))',
                    position:'relative',transition:'background 0.2s',flexShrink:0}}>
                  <div style={{position:'absolute',top:2,left:(descLote as any).manterDesconto?'calc(100% - 22px)':2,width:20,height:20,borderRadius:10,background:'white',transition:'left 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.3)'}}/>
                </button>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              {([{k:'%',l:'Percentual (%)',s:'Proporcional ao valor'},{k:'R$',l:'Valor Fixo (R$)',s:'Mesmo valor por parcela'}] as any[]).map((t:any)=>(
                <button key={t.k} type="button" onClick={()=>setDescLote(d=>({...d,tipo:t.k}))} style={{padding:'12px',borderRadius:10,cursor:'pointer',textAlign:'left',border:'2px solid',borderColor:descLote.tipo===t.k?'#f59e0b':'hsl(var(--border-subtle))',background:descLote.tipo===t.k?'rgba(245,158,11,0.08)':'transparent'}}>
                  <div style={{fontWeight:700,fontSize:13,color:descLote.tipo===t.k?'#f59e0b':'hsl(var(--text-base))'}}>{descLote.tipo===t.k&&'✓ '}{t.l}</div>
                  <div style={{fontSize:11,color:'hsl(var(--text-muted))',marginTop:2}}>{t.s}</div>
                </button>
              ))}
            </div>
            <F label={`Valor do Desconto (${descLote.tipo})`}><input className="form-input" value={descLote.valor} onChange={e=>setDescLote(d=>({...d,valor:e.target.value}))} placeholder={descLote.tipo==='%'?'Ex: 10':'Ex: 50,00'}/></F>
            {descLote.eventoId&&(<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <F label="Da Parcela (deste evento)"><select className="form-input" value={descLote.deParcela} onChange={e=>setDescLote(d=>({...d,deParcela:e.target.value}))}>
                {parcelas.filter(p=>(p as any).evento===descLote.eventoId).map((p,i)=><option key={p.num} value={p.num}>{i+1}ª Parcela ({p.vencimento ? formatDate(p.vencimento) : '—'})</option>)}
              </select></F>
              <F label="Até a Parcela"><select className="form-input" value={descLote.ateParcela} onChange={e=>setDescLote(d=>({...d,ateParcela:e.target.value}))}>
                {parcelas.filter(p=>(p as any).evento===descLote.eventoId).map((p,i)=><option key={p.num} value={p.num}>{i+1}ª Parcela ({p.vencimento ? formatDate(p.vencimento) : '—'})</option>)}
              </select></F>
            </div>)}
            {!descLote.eventoId&&(
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <F label="Da Parcela"><select className="form-input" value={descLote.deParcela} onChange={e=>setDescLote(d=>({...d,deParcela:e.target.value}))}>{parcelas.map(p=><option key={p.num} value={p.num}>#{p.num} — {(p as any).evento} ({p.vencimento ? formatDate(p.vencimento) : '—'})</option>)}</select></F>
                <F label="Até a Parcela"><select className="form-input" value={descLote.ateParcela} onChange={e=>setDescLote(d=>({...d,ateParcela:e.target.value}))}>{parcelas.map(p=><option key={p.num} value={p.num}>#{p.num} — {(p as any).evento} ({p.vencimento ? formatDate(p.vencimento) : '—'})</option>)}</select></F>
              </div>
            )}
            {descLote.valor&&<div style={{padding:'10px 14px',background:'rgba(245,158,11,0.06)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:10,fontSize:12}}>
              Desconto total estimado: <strong style={{color:'#f59e0b'}}>R$ {fmtMoeda(
                parcelas.filter(p=>{
                  const evOk=descLote.eventoId?(p as any).evento===descLote.eventoId:true;
                  const nmOk=p.num>=parseInt(descLote.deParcela||'1')&&p.num<=parseInt(descLote.ateParcela||'9999');
                  return evOk&&nmOk&&p.status!=='pago';
                }).reduce((s,p)=>{const v=parseMoeda(descLote.valor);return s+(descLote.tipo==='%'?+(p.valor*v/100).toFixed(2):v)},0)
              )}</strong>
            </div>}
          </div>
          <div style={{padding:'14px 24px',borderTop:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'flex-end',gap:10,background:'hsl(var(--bg-elevated))'}}>
            <button className="btn btn-secondary" onClick={()=>setModalDesconto(false)}>Cancelar</button>
            <button className="btn btn-primary" style={{background:'linear-gradient(135deg,#f59e0b,#d97706)'}} disabled={!descLote.valor} onClick={()=>{
              const v=parseMoeda(descLote.valor)
              setParcelas(prev=>prev.map(p=>{
                const matchesEv = descLote.eventoId ? ((p as any).evento===descLote.eventoId) : true;
                const matchesNum = p.num >= parseInt(descLote.deParcela||'1') && p.num <= parseInt(descLote.ateParcela||'9999');
                if(!matchesEv || !matchesNum || p.status==='pago') return p
                const d=descLote.tipo==='%'?+(p.valor*v/100).toFixed(2):v
                return{...p,desconto:d,valorFinal:Math.max(0,+(p.valor-d).toFixed(2)),manterDesconto:(descLote as any).manterDesconto||false,descTipo:descLote.tipo,descRaw:v}
              }))
              setModalDesconto(false)
            }}><Check size={14}/> Aplicar Desconto</button>
          </div>
        </div>
      </div>)}

      {/* MODAL MUDAR VENCIMENTO */}
      {modalVcto&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:4000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
        <div style={{background:'hsl(var(--bg-base))',borderRadius:20,width:'100%',maxWidth:500,border:'1px solid hsl(var(--border-subtle))',boxShadow:'0 40px 120px rgba(0,0,0,0.8)'}}>
          <div style={{padding:'18px 24px',borderBottom:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'space-between',alignItems:'center',background:'linear-gradient(135deg,rgba(99,102,241,0.1),rgba(139,92,246,0.04))'}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:40,height:40,borderRadius:10,background:'rgba(99,102,241,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>📅</div><div><div style={{fontWeight:800,fontSize:15}}>Mudar Dia de Vencimento</div><div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>Alterar vencimento das parcelas selecionadas</div></div></div>
            <button className="btn btn-ghost btn-icon" onClick={()=>setModalVcto(false)}><X size={18}/></button>
          </div>
          <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:14}}>
            {/* Evento filter */}
            {(()=>{
              const evNomes=[...new Set(parcelas.filter(p=>p.status!=='cancelado').map(p=>(p as any).evento).filter(Boolean))]
              return evNomes.length>0&&(
                <div>
                  <label className="form-label" style={{fontSize:11,marginBottom:6,display:'block'}}>Evento (filtrar parcelas)</label>
                  <select className="form-input" value={vctoForm.eventoFiltro} onChange={e=>{
                    const ev=e.target.value
                    const nums=parcelas.filter(p=>p.status!=='cancelado'&&((p as any).evento===ev||!ev)).map(p=>p.num)
                    setVctoForm(v=>({...v,eventoFiltro:ev,deParcela:nums.length?String(Math.min(...nums)):'1',ateParcela:nums.length?String(Math.max(...nums)):String(parcelas.filter(p=>p.status!=='cancelado').length)}))
                  }} style={{fontWeight:600}}>
                    <option value="">— Todos os eventos —</option>
                    {evNomes.map(ev=>(<option key={ev} value={ev}>{ev}</option>))}
                  </select>
                  {vctoForm.eventoFiltro&&(<div style={{marginTop:6,padding:'6px 12px',background:'rgba(6,182,212,0.08)',borderRadius:8,fontSize:11,color:'hsl(var(--text-muted))'}}>Evento selecionado: <strong style={{color:'#06b6d4'}}>{vctoForm.eventoFiltro}</strong> · {parcelas.filter(p=>p.status!=='cancelado'&&(p as any).evento===vctoForm.eventoFiltro).length} parcelas</div>)}
                </div>
              )
            })()}
            {vctoForm.eventoFiltro&&(<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <F label="Da Parcela"><select className="form-input" value={vctoForm.deParcela} onChange={e=>setVctoForm(v=>({...v,deParcela:e.target.value}))}>
                {parcelas.filter(p=>p.status!=='cancelado'&&(p as any).evento===vctoForm.eventoFiltro).map((p,i)=><option key={p.num} value={p.num}>{i+1}ª Parcela ({p.vencimento ? formatDate(p.vencimento) : '—'})</option>)}
              </select></F>
              <F label="Até a Parcela"><select className="form-input" value={vctoForm.ateParcela} onChange={e=>setVctoForm(v=>({...v,ateParcela:e.target.value}))}>
                {parcelas.filter(p=>p.status!=='cancelado'&&(p as any).evento===vctoForm.eventoFiltro).map((p,i)=><option key={p.num} value={p.num}>{i+1}ª Parcela ({p.vencimento ? formatDate(p.vencimento) : '—'})</option>)}
              </select></F>
            </div>)}
            {!vctoForm.eventoFiltro&&(<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <F label="Da Parcela"><select className="form-input" value={vctoForm.deParcela} onChange={e=>setVctoForm(v=>({...v,deParcela:e.target.value}))}>{parcelas.filter(p=>p.status!=='cancelado').map(p=><option key={p.num} value={p.num}>#{p.num} — {(p as any).evento||''} ({p.vencimento ? formatDate(p.vencimento) : '—'})</option>)}</select></F>
              <F label="Até a Parcela"><select className="form-input" value={vctoForm.ateParcela} onChange={e=>setVctoForm(v=>({...v,ateParcela:e.target.value}))}>{parcelas.filter(p=>p.status!=='cancelado').map(p=><option key={p.num} value={p.num}>#{p.num} — {(p as any).evento||''} ({p.vencimento ? formatDate(p.vencimento) : '—'})</option>)}</select></F>
            </div>)}
            <F label="Novo Dia de Vencimento">
              <select className="form-input" value={vctoForm.novoDia} onChange={e=>setVctoForm(v=>({...v,novoDia:e.target.value}))}>
                <option value="">-- Selecione o dia --</option>
                {Array.from({length:28},(_,i)=>i+1).map(d=><option key={d} value={d}>{String(d).padStart(2,'0')}</option>)}
              </select>
            </F>
            {vctoForm.novoDia&&<div style={{padding:'10px 14px',background:'rgba(99,102,241,0.06)',border:'1px solid rgba(99,102,241,0.2)',borderRadius:10,fontSize:12,color:'hsl(var(--text-muted))'}}>
              {vctoForm.eventoFiltro&&<><strong style={{color:'#06b6d4'}}>{vctoForm.eventoFiltro}</strong> · </>}
              As parcelas selecionadas terão vencimento alterado para o dia <strong style={{color:'#818cf8'}}>{String(vctoForm.novoDia).padStart(2,'0')}</strong>.
            </div>}
          </div>
          <div style={{padding:'14px 24px',borderTop:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'flex-end',gap:10,background:'hsl(var(--bg-elevated))'}}>
            <button className="btn btn-secondary" onClick={()=>setModalVcto(false)}>Cancelar</button>
            <button className="btn btn-primary" style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)'}} disabled={!vctoForm.novoDia} onClick={()=>{
              const de=parseInt(vctoForm.deParcela)||1,ate=parseInt(vctoForm.ateParcela)||parcelas.length,dia=vctoForm.novoDia
              setParcelas(prev=>prev.map(p=>{
                const matchesEv=vctoForm.eventoFiltro?(p as any).evento===vctoForm.eventoFiltro:true;
                if(p.num<de||p.num>ate||!matchesEv||p.status==='pago')return p;
                const pts=p.vencimento.split('/');pts[0]=String(dia).padStart(2,'0');return{...p,vencimento:pts.join('/')}
              }))
              setModalVcto(false)
            }}><Check size={14}/> Aplicar</button>
          </div>
        </div>
      </div>)}

      {/* MODAL OBS FINANCEIRA */}
      {modalObsFin&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:4000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
        <div style={{background:'hsl(var(--bg-base))',borderRadius:20,width:'100%',maxWidth:440,border:'1px solid hsl(var(--border-subtle))',boxShadow:'0 40px 120px rgba(0,0,0,0.8)'}}>
          <div style={{padding:'18px 24px',borderBottom:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'space-between',alignItems:'center',background:'linear-gradient(135deg,rgba(52,211,153,0.08),rgba(16,185,129,0.04))'}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:40,height:40,borderRadius:10,background:'rgba(52,211,153,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>📝</div><div><div style={{fontWeight:800,fontSize:15}}>Obs. Financeira</div><div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>{obsFinForm.parcelas.length} parcela(s) selecionada(s)</div></div></div>
            <button className="btn btn-ghost btn-icon" onClick={()=>setModalObsFin(false)}><X size={18}/></button>
          </div>
          <div style={{padding:'20px 24px'}}>
            <F label="Observacao Financeira"><textarea className="form-input" rows={4} value={obsFinForm.obs} onChange={e=>setObsFinForm(f=>({...f,obs:e.target.value}))} placeholder="Digite a observacao financeira..."/></F>
          </div>
          <div style={{padding:'14px 24px',borderTop:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'flex-end',gap:10,background:'hsl(var(--bg-elevated))'}}>
            <button className="btn btn-secondary" onClick={()=>setModalObsFin(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={()=>{setParcelas(prev=>prev.map(p=>obsFinForm.parcelas.includes(p.num)?{...p,...({obsFin:obsFinForm.obs})}:p));setModalObsFin(false)}}><Check size={14}/> Salvar Obs.</button>
          </div>
        </div>
      </div>)}

      {/* MODAL ALTERAR VALOR */}
      {modalAlterarValor&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:4000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
        <div style={{background:'hsl(var(--bg-base))',borderRadius:20,width:'100%',maxWidth:580,maxHeight:'92vh',overflowY:'auto',border:'1px solid hsl(var(--border-subtle))',boxShadow:'0 40px 120px rgba(0,0,0,0.8)'}}>
          <div style={{padding:'18px 24px',borderBottom:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'space-between',alignItems:'center',background:'linear-gradient(135deg,rgba(245,158,11,0.08),rgba(251,191,36,0.04))'}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:40,height:40,borderRadius:10,background:'rgba(245,158,11,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>✏️</div><div><div style={{fontWeight:800,fontSize:15}}>Alterar Valor</div><div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>{alterarValorForm.eventoFiltro||'Todos os eventos'}</div></div></div>
            <button className="btn btn-ghost btn-icon" onClick={()=>setModalAlterarValor(false)}><X size={18}/></button>
          </div>
          <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:14}}>
            {/* Evento selector */}
            {(()=>{
              const evNomes=[...new Set(parcelas.filter(p=>p.status!=='cancelado').map(p=>(p as any).evento).filter(Boolean))]
              return evNomes.length>0&&(
                <div>
                  <label className="form-label" style={{fontSize:11,marginBottom:6,display:'block'}}>Evento que será alterado</label>
                  <select className="form-input" value={alterarValorForm.eventoFiltro} onChange={e=>{
                    const ev=e.target.value
                    const nums=parcelas.filter(p=>p.status!=='cancelado'&&((p as any).evento===ev||!ev)).map(p=>p.num)
                    setAlterarValorForm(f=>({...f,eventoFiltro:ev,parcelas:nums}))
                  }} style={{fontWeight:600}}>
                    <option value="">— Todos os eventos —</option>
                    {evNomes.map(ev=>(<option key={ev} value={ev}>{ev}</option>))}
                  </select>
                </div>
              )
            })()}
            <F label="Novo Valor por Parcela (R$)"><input className="form-input" value={alterarValorForm.novoValor} onChange={e=>setAlterarValorForm(f=>({...f,novoValor:e.target.value}))} placeholder="0,00"/></F>
            <F label="Motivo da Alteração"><input className="form-input" value={alterarValorForm.motivo} onChange={e=>setAlterarValorForm(f=>({...f,motivo:e.target.value}))} placeholder="Ex: Reajuste contratual"/></F>
            {/* Parcelas com checkboxes individuais */}
            {(()=>{
              const listaParc=alterarValorForm.eventoFiltro
                ?parcelas.filter(p=>p.status!=='cancelado'&&(p as any).evento===alterarValorForm.eventoFiltro)
                :parcelas.filter(p=>p.status!=='cancelado')
              if(listaParc.length===0) return null
              return(
                <div style={{padding:'12px 16px',background:'hsl(var(--bg-elevated))',border:'1px solid hsl(var(--border-subtle))',borderRadius:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <div style={{fontWeight:700,fontSize:12,color:'#a78bfa'}}>Selecione as parcelas a alterar <span style={{color:'hsl(var(--text-muted))',fontWeight:400}}>({alterarValorForm.parcelas.length}/{listaParc.length})</span></div>
                    <div style={{display:'flex',gap:8}}>
                      <button type="button" style={{fontSize:10,padding:'2px 10px',borderRadius:20,border:'1px solid rgba(167,139,250,0.4)',background:'rgba(167,139,250,0.08)',color:'#a78bfa',cursor:'pointer',fontWeight:700}}
                        onClick={()=>setAlterarValorForm(f=>({...f,parcelas:listaParc.map(p=>p.num)}))}>Todos</button>
                      <button type="button" style={{fontSize:10,padding:'2px 10px',borderRadius:20,border:'1px solid rgba(107,114,128,0.4)',background:'rgba(107,114,128,0.06)',color:'hsl(var(--text-muted))',cursor:'pointer',fontWeight:700}}
                        onClick={()=>setAlterarValorForm(f=>({...f,parcelas:[]}))}>Nenhum</button>
                    </div>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:3,maxHeight:240,overflowY:'auto'}}>
                    {listaParc.map(p=>{
                      const isChecked=alterarValorForm.parcelas.includes(p.num)
                      return(
                        <div key={p.num}
                          onClick={()=>setAlterarValorForm(f=>({...f,parcelas:isChecked?f.parcelas.filter(n=>n!==p.num):[...f.parcelas,p.num]}))}
                          style={{display:'flex',alignItems:'center',gap:10,padding:'7px 10px',borderRadius:8,cursor:'pointer',
                            background:isChecked?'rgba(167,139,250,0.08)':'transparent',
                            border:`1px solid ${isChecked?'rgba(167,139,250,0.3)':'transparent'}`,
                            transition:'all 0.1s'}}>
                          <div style={{width:18,height:18,borderRadius:5,border:`2px solid ${isChecked?'#a78bfa':'hsl(var(--border-subtle))'}`,background:isChecked?'#a78bfa':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 0.15s'}}>
                            {isChecked&&<span style={{color:'white',fontSize:11,lineHeight:1}}>✓</span>}
                          </div>
                          <div style={{display:'flex',flex:1,justifyContent:'space-between',alignItems:'center'}}>
                            <div>
                              <span style={{fontWeight:600,fontSize:12,textTransform:'capitalize'}}>{(p as any).evento||'Mensalidade'}</span>
                              <span style={{fontSize:10,color:'hsl(var(--text-muted))',marginLeft:8}}>Vcto: {p.vencimento ? formatDate(p.vencimento) : '—'}</span>
                              {p.status==='pago'&&<span style={{fontSize:9,marginLeft:6,padding:'1px 6px',borderRadius:20,background:'rgba(16,185,129,0.12)',color:'#10b981',fontWeight:700}}>Pago</span>}
                            </div>
                            <div style={{textAlign:'right',flexShrink:0}}>
                              <div style={{fontFamily:'monospace',fontWeight:700,fontSize:12,color:alterarValorForm.novoValor&&isChecked?'#a78bfa':'hsl(var(--text-base))'}}>
                                {(()=>{
                                  if(alterarValorForm.novoValor&&isChecked){
                                     const nv=parseMoeda(alterarValorForm.novoValor);
                                     const t=(p as any).descTipo, r=(p as any).descRaw;
                                     const d=(t==='%'&&r)?+(nv*r/100).toFixed(2):p.desconto;
                                     return `R$ ${fmtMoeda(Math.max(0,nv-d))}`;
                                  }
                                  return `R$ ${fmtMoeda(p.valorFinal)}`;
                                })()}
                              </div>
                              {alterarValorForm.novoValor&&isChecked&&<div style={{fontSize:9,color:'hsl(var(--text-muted))'}}>era R$ {fmtMoeda(p.valorFinal)}</div>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
              </div>

              {/* Footer Actions */}
              <div style={{padding:'20px 24px',borderTop:'1px solid hsl(var(--border-subtle))',background:'hsl(var(--bg-elevated))',display:'flex',justifyContent:'flex-end',gap:12,borderBottomLeftRadius:20,borderBottomRightRadius:20}}>
                <button type="button" className="btn btn-secondary" onClick={()=>setModalAlterarValor(false)}>Cancelar</button>
                <button type="button" className="btn btn-primary" style={{background:'linear-gradient(to right,#a78bfa,#8b5cf6)',border:'none'}} disabled={!alterarValorForm.novoValor||parcelasSelected.length===0} onClick={handleAplicarAlteracaoValor}>Aplicar R$ {alterarValorForm.novoValor||'0,00'}</button>
              </div>
            </div>
          </div>
      )}

      {/* ══════════════ MODAL EXTRATO FINANCEIRO ══════════════ */}
      {modalExtrato && (
        <ExtratoModal
          aberto={modalExtrato}
          onFechar={() => setModalExtrato(false)}
          aluno={aluno}
          parcelas={parcelas}
          todosResp={todosResp}
          mat={mat}
          turmas={turmas}
          cfgEventos={cfgEventos}
        />
      )}

      {/* ══════════════ MODAL EVENTO FINANCEIRO (GENERICO) ══════════════ */}
      {modalEventoFin&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:5000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'hsl(var(--bg-base))',borderRadius:20,width:'100%',maxWidth:580,maxHeight:'92vh',display:'flex',flexDirection:'column',boxShadow:'0 30px 100px rgba(0,0,0,0.6)',border:'1px solid rgba(16,185,129,0.2)'}}>
            <div style={{padding:'20px 24px',borderBottom:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'space-between',alignItems:'center',background:'linear-gradient(to right,rgba(16,185,129,0.05),transparent)'}}>
              <div style={{display:'flex',alignItems:'center',gap:14}}>
                <div style={{width:44,height:44,borderRadius:12,background:'rgba(16,185,129,0.15)',border:'2px solid rgba(16,185,129,0.3)',display:'flex',alignItems:'center',justifyContent:'center',color:'#10b981'}}>
                  <PlusCircle size={22}/>
                </div>
                <div>
                  <div style={{fontWeight:800,fontSize:16,color:'#10b981',letterSpacing:'-0.02em'}}>Novo Evento</div>
                  <div style={{fontSize:12,color:'hsl(var(--text-muted))'}}>Material, Uniforme, Multas, etc.</div>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={()=>setModalEventoFin(false)}><X size={18}/></button>
            </div>
            <div style={{padding:24,overflowY:'auto',display:'flex',flexDirection:'column',gap:16}}>
              
              {/* Manter Desconto toggle */}
              <div style={{padding:'12px 16px',background:'rgba(16,185,129,0.04)',border:'1px solid rgba(16,185,129,0.2)',borderRadius:10}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:13}}>Manter Desconto</div>
                    <div style={{fontSize:11,color:'hsl(var(--text-muted))',marginTop:2}}>Mesmo após o vencimento da parcela, o desconto será mantido.</div>
                  </div>
                  <button type="button" onClick={()=>setEventoForm(f=>({...f,manterDesconto:!f.manterDesconto}))}
                    style={{width:44,height:24,borderRadius:12,border:'none',cursor:'pointer',
                      background:eventoForm.manterDesconto?'#10b981':'hsl(var(--border-subtle))',
                      position:'relative',transition:'background 0.2s',flexShrink:0}}>
                    <div style={{position:'absolute',top:2,left:eventoForm.manterDesconto?'calc(100% - 22px)':2,width:20,height:20,borderRadius:10,background:'white',transition:'left 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.3)'}}/>
                  </button>
                </div>
              </div>

              {/* Tipo de Vencimento */}
              <div>
                <label className="form-label">Tipo de Vencimento</label>
                <div style={{display:'flex',gap:10}}>
                  {([{v:'diaX',l:'Todo dia X do mês',s:'Parcelas vencem no mesmo dia de cada mês'},{v:'30dias',l:'A cada 30 dias corridos',s:'Intervalo fixo de 30 dias entre parcelas'}] as const).map(opt=>(
                    <button key={opt.v} type="button" onClick={()=>setEventoForm(f=>({...f,tipoVencimento:opt.v}))}
                      style={{flex:1,padding:'10px',textAlign:'left',borderRadius:10,background:eventoForm.tipoVencimento===opt.v?'rgba(167,139,250,0.1)':'hsl(var(--bg-overlay))',border:`1px solid ${eventoForm.tipoVencimento===opt.v?'#a78bfa':'hsl(var(--border-subtle))'}`,cursor:'pointer',transition:'all 0.2s'}}>
                      <div style={{fontWeight:700,fontSize:13,color:eventoForm.tipoVencimento===opt.v?'#a78bfa':'hsl(var(--text-base))'}}>{opt.l}</div>
                      <div style={{fontSize:11,color:'hsl(var(--text-muted))',marginTop:2}}>{opt.s}</div>
                    </button>
                  ))}
                </div>
              </div>
              
              <F label="Evento">
                <input className="form-input" value={eventoForm.eventoNome} list="eventos-fin-list"
                  onChange={e=>{
                    const nome=e.target.value
                    const match=cfgEventos.find(ev=>ev.descricao===nome||ev.codigo===nome)
                    setEventoForm(f=>({...f,eventoNome:nome,eventoId:match?.id||''}))
                  }}
                  placeholder="Ex: Material Didático"
                />
                <datalist id="eventos-fin-list">
                  {cfgEventos.map(ev=><option key={ev.id} value={ev.descricao}/>)}
                </datalist>
              </F>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                <F label="Primeiro Vencimento"><input className="form-input" type="date" value={eventoForm.vencimentoInicial} onChange={e=>setEventoForm(f=>({...f,vencimentoInicial:e.target.value}))}/></F>
                {eventoForm.tipoVencimento==='diaX'&&(
                  <F label="Todo dia">
                    <input className="form-input" type="number" min="1" max="31" value={eventoForm.diaVcto} onChange={e=>setEventoForm(f=>({...f,diaVcto:e.target.value}))} placeholder="Ex: 5"/>
                  </F>
                )}
                <F label="Parcelas (de / até)">
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <input
                      className="form-input"
                      type="number" min="1" max="120"
                      value={eventoForm.parcelaInicial}
                      onChange={e=>{
                        const ini=Math.max(1,parseInt(e.target.value)||1)
                        const fim=Math.max(ini,parseInt(eventoForm.parcelaFinal)||ini)
                        setEventoForm(f=>({...f,parcelaInicial:String(ini),parcelaFinal:String(fim)}))
                      }}
                      style={{width:'100%',textAlign:'center',fontWeight:700}}
                      title="Parcela inicial"
                      placeholder="1"
                    />
                    <span style={{color:'hsl(var(--text-muted))',fontSize:14,flexShrink:0}}>→</span>
                    <input
                      className="form-input"
                      type="number" min={eventoForm.parcelaInicial||'1'} max="120"
                      value={eventoForm.parcelaFinal}
                      onChange={e=>{
                        const fim=Math.max(parseInt(eventoForm.parcelaInicial)||1,parseInt(e.target.value)||1)
                        setEventoForm(f=>({...f,parcelaFinal:String(fim)}))
                      }}
                      style={{width:'100%',textAlign:'center',fontWeight:700}}
                      title="Parcela final"
                      placeholder="1"
                    />
                  </div>
                  {(()=>{const ini=parseInt(eventoForm.parcelaInicial)||1;const fim=parseInt(eventoForm.parcelaFinal)||1;const qtd=fim-ini+1;return qtd>1&&<div style={{fontSize:10,color:'#10b981',marginTop:3,fontWeight:600}}>{qtd} parcelas · {ini}/{fim}</div>})()}
                </F>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:12}}>
                <F label="Valor Total (R$)"><input className="form-input" value={eventoForm.valor} onChange={e=>setEventoForm(f=>({...f,valor:e.target.value}))} placeholder="0,00"/></F>
                <F label="Tipo Desc.">
                  <div style={{display:'flex',borderRadius:6,overflow:'hidden',border:'1px solid hsl(var(--border-subtle))',height:38}}>
                    {(['%','R$'] as const).map(t=><button key={t} type="button" style={{flex:1,fontSize:12,fontWeight:700,cursor:'pointer',border:'none',background:eventoForm.descTipo===t?'#10b981':'hsl(var(--bg-overlay))',color:eventoForm.descTipo===t?'#fff':'hsl(var(--text-muted))'}} onClick={()=>setEventoForm(f=>({...f,descTipo:t}))}>{t}</button>)}
                  </div>
                </F>
                <F label={`Desconto (${eventoForm.descTipo})`}><input className="form-input" value={eventoForm.descValor} onChange={e=>setEventoForm(f=>({...f,descValor:e.target.value}))} placeholder={eventoForm.descTipo==='%'?'Ex: 10':'Ex: 20,00'}/></F>
              </div>
            {eventoForm.valor&&eventoForm.parcelaFinal&&eventoForm.vencimentoInicial&&(()=>{
              const ev=cfgEventos.find(e=>e.id===eventoForm.eventoId)
              const parIni=Math.max(1,parseInt(eventoForm.parcelaInicial)||1)
              const parFim=Math.max(parIni,parseInt(eventoForm.parcelaFinal)||parIni)
              const qtd=parFim-parIni+1
              const valTotal=parseMoeda(eventoForm.valor)
              const valBase=+(valTotal/qtd).toFixed(2)
              const diff=+(valTotal - (valBase*qtd)).toFixed(2)
              const dv=parseMoeda(eventoForm.descValor)
              const desc=eventoForm.descValor?(eventoForm.descTipo==='%'?+(valBase*dv/100).toFixed(2):dv):0
              const sd=new Date(eventoForm.vencimentoInicial+'T12:00')
              const calcData=(i:number)=>{
                if(eventoForm.tipoVencimento==='30dias'){const d=new Date(sd);d.setDate(d.getDate()+i*30);return d}
                else{const d=new Date(sd);d.setMonth(d.getMonth()+i);if(eventoForm.diaVcto&&i>0)d.setDate(parseInt(eventoForm.diaVcto));return d}
              }
              const prevs=Array.from({length:Math.min(qtd,6)},(_,i)=>({n:parIni+i,v:calcData(i).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}),valP:+(valBase+(i===0?diff:0)).toFixed(2)}))
              const totalVlrF=Array.from({length:qtd},(_,i)=>Math.max(0,+(valBase+(i===0?diff:0)).toFixed(2)-desc)).reduce((a,b)=>a+b,0)
              return(<div style={{padding:'14px 16px',background:'rgba(16,185,129,0.06)',border:'1px solid rgba(16,185,129,0.2)',borderRadius:12}}>
                <div style={{fontWeight:700,fontSize:13,color:'#34d399',marginBottom:10,display:'flex',justifyContent:'space-between'}}>
                  <span>{ev?.descricao||'Evento'} · {qtd} parcela(s) <span style={{fontSize:11,color:'hsl(var(--text-muted))',fontWeight:400}}>({parIni}/{parFim})</span></span>
                  {desc>0&&<span style={{fontSize:12,color:'#f59e0b'}}>Desc.: R$ {fmtMoeda(desc)}/mês</span>}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:4}}>
                  {prevs.map(pv=><div key={pv.n} style={{display:'flex',justifyContent:'space-between',padding:'5px 8px',background:'rgba(16,185,129,0.06)',borderRadius:6,fontSize:12}}>
                    <span style={{color:'hsl(var(--text-muted))'}}><strong style={{color:'#818cf8',fontFamily:'monospace'}}>{pv.n}/{parFim}</strong> — <strong style={{color:'hsl(var(--text-secondary))'}}>{pv.v}</strong></span>
                    <span style={{fontFamily:'monospace',fontWeight:800,color:'#34d399'}}>R$ {fmtMoeda(Math.max(0,pv.valP-desc))}</span>
                  </div>)}
                  {qtd>6&&<div style={{fontSize:11,color:'hsl(var(--text-muted))',padding:'4px 8px'}}>...e mais {qtd-6} parcela(s)</div>}
                </div>
                <div style={{marginTop:8,fontSize:13,textAlign:'right',fontWeight:800,color:'#34d399',borderTop:'1px solid rgba(16,185,129,0.2)',paddingTop:8}}>Total c/ Desc: R$ {fmtMoeda(totalVlrF)}</div>
              </div>)
            })()}
          </div>
          <div style={{padding:'14px 24px',borderTop:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'flex-end',gap:10,background:'hsl(var(--bg-elevated))'}}>
            <button className="btn btn-secondary" onClick={()=>setModalEventoFin(false)}>Cancelar</button>
            <button className="btn btn-primary" style={{background:'linear-gradient(135deg,#10b981,#059669)'}} disabled={!eventoForm.valor||!eventoForm.parcelaFinal||!eventoForm.vencimentoInicial||(!eventoForm.eventoId&&!eventoForm.eventoNome.trim())} onClick={()=>{
              const ev=cfgEventos.find(e=>e.id===eventoForm.eventoId)
              const parIni=Math.max(1,parseInt(eventoForm.parcelaInicial)||1)
              const parFim=Math.max(parIni,parseInt(eventoForm.parcelaFinal)||parIni)
              const qtd=parFim-parIni+1
              const valTotal=parseMoeda(eventoForm.valor)
              const valBase=+(valTotal/qtd).toFixed(2)
              const diff=+(valTotal - (valBase*qtd)).toFixed(2)
              const dv=parseMoeda(eventoForm.descValor)
              const desc=eventoForm.descValor?(eventoForm.descTipo==='%'?+(valBase*dv/100).toFixed(2):dv):0
              
              const sd=new Date(eventoForm.vencimentoInicial+'T12:00'),maxN=parcelas.length>0?Math.max(...parcelas.map(p=>p.num)):0
              const alunoEventoId = newId('EV')
              const calcData=(i:number)=>{
                if(eventoForm.tipoVencimento==='30dias'){const d=new Date(sd);d.setDate(d.getDate()+i*30);return d}
                else{const d=new Date(sd);d.setMonth(d.getMonth()+i);if(eventoForm.diaVcto&&i>0)d.setDate(parseInt(eventoForm.diaVcto));return d}
              }
              const dataLancamento = new Date().toISOString()
              const novas=Array.from({length:qtd},(_,i)=>{
                const d=calcData(i);
                const valP=+(valBase+(i===0?diff:0)).toFixed(2);
                const vlrFP=Math.max(0,valP-desc);
                return{num:maxN+i+1,competencia:d.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}),vencimento:d.toLocaleDateString('pt-BR'),valor:valP,desconto:desc,valorFinal:vlrFP,status:'pendente' as const,obs:'',editando:false,evento:ev?.descricao||eventoForm.eventoNome||'Evento',eventoId:alunoEventoId,numParcela:parIni+i,totalParcelas:parFim,codigo:String(Math.floor(100000+Math.random()*900000)),manterDesconto:eventoForm.manterDesconto,descTipo:eventoForm.descValor?eventoForm.descTipo:undefined,descRaw:dv,dataLancamento}
              })
              const todasOrdenadas=[...parcelas,...novas].sort((a,b)=>{
                const pa=new Date(a.vencimento.split('/').reverse().join('-')+'T12:00'),pb=new Date(b.vencimento.split('/').reverse().join('-')+'T12:00');return pa.getTime()-pb.getTime()
              }).map((p,i)=>({...p,num:i+1}))
              setParcelas(todasOrdenadas);setParcelasConfirmadas(false);setModalEventoFin(false)
              setEventoForm({turmaId:mat.turmaId,eventoNome:'',eventoId:'',vencimentoInicial:'',parcelaInicial:'1',parcelaFinal:'1',tipoVencimento:'diaX',diaVcto:'5',valor:'',descTipo:'%',descValor:'',manterDesconto:false})
            }}><Check size={14}/> Inserir {(Math.max(parseInt(eventoForm.parcelaFinal)||1,parseInt(eventoForm.parcelaInicial)||1)-(parseInt(eventoForm.parcelaInicial)||1)+1)} Lançamento(s)</button>
          </div>
        </div>
      </div>)}

      {/* ══════════════ MODAL EDITAR PARCELA ══════════════ */}
      {modalEditarParcela&&parcelaAtiva&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:5000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'hsl(var(--bg-base))',borderRadius:20,width:'100%',maxWidth:580,maxHeight:'92vh',overflowY:'auto',border:'1px solid hsl(var(--border-subtle))',boxShadow:'0 40px 120px rgba(0,0,0,0.8)'}}>            
            {/* Header */}
            <div style={{padding:'18px 24px',borderBottom:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'space-between',alignItems:'center',background:'linear-gradient(135deg,rgba(99,102,241,0.1),rgba(139,92,246,0.04))'}}>
              <div style={{display:'flex',alignItems:'center',gap:14}}>
                {/* Badge numero */}
                <div style={{width:48,height:48,borderRadius:12,background:'rgba(99,102,241,0.15)',border:'2px solid rgba(99,102,241,0.3)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                  <div style={{fontSize:9,color:'#818cf8',fontWeight:700,letterSpacing:1}}>PARC.</div>
                  <div style={{fontFamily:'monospace',fontWeight:900,fontSize:17,color:'#818cf8'}}>{String(parcelaAtiva.num).padStart(2,'0')}</div>
                </div>
                <div>
                  <div style={{fontWeight:800,fontSize:15}}>Editar Parcela</div>
                  <div style={{fontSize:11,color:'hsl(var(--text-muted))',textTransform:'capitalize',marginTop:1}}>
                    {parcelaAtiva.evento||parcelaAtiva.competencia}
                    {parcelaAtiva.codigo&&<span style={{marginLeft:6,fontFamily:'monospace',fontSize:10,color:'#6366f1'}}>#{parcelaAtiva.codigo}</span>}
                  </div>
                  <div style={{fontSize:10,color:'hsl(var(--text-muted))',marginTop:1}}>
                    Emissão: <strong style={{color:'hsl(var(--text-base))'}}>{new Date().toLocaleDateString('pt-BR')}</strong>
                    {' · '}Vencimento: <strong style={{color:(() => { const d=new Date(parcelaAtiva.vencimento.split('/').reverse().join('-')+'T12:00'),h=new Date();h.setHours(0,0,0,0);return parcelaAtiva.status!=='pago'&&d<h?'#ef4444':'hsl(var(--text-base))' })()}}>{parcelaAtiva.vencimento ? formatDate(parcelaAtiva.vencimento) : '—'}</strong>
                  </div>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={()=>setModalEditarParcela(false)}><X size={18}/></button>
            </div>
            {/* Body */}
            <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:14}}>
              {/* Resumo atual */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:8,padding:'12px 16px',background:'hsl(var(--bg-elevated))',borderRadius:12,border:'1px solid hsl(var(--border-subtle))'}}>
                <div style={{textAlign:'center'}}><div style={{fontSize:10,color:'hsl(var(--text-muted))',fontWeight:600,marginBottom:3}}>Nº PARCELA</div><div style={{fontFamily:'monospace',fontWeight:900,fontSize:16,color:'#818cf8'}}>{String(parcelaAtiva.num).padStart(2,'0')}</div></div>
                <div style={{textAlign:'center'}}><div style={{fontSize:10,color:'hsl(var(--text-muted))',fontWeight:600,marginBottom:3}}>VALOR BRUTO</div><div style={{fontFamily:'monospace',fontWeight:800,fontSize:14}}>R$ {fmtMoeda(parcelaAtiva.valor)}</div></div>
                <div style={{textAlign:'center'}}><div style={{fontSize:10,color:'hsl(var(--text-muted))',fontWeight:600,marginBottom:3}}>DESCONTO</div><div style={{fontFamily:'monospace',fontWeight:800,fontSize:14,color:'#f59e0b'}}>R$ {fmtMoeda(parcelaAtiva.desconto)}</div></div>
                <div style={{textAlign:'center'}}><div style={{fontSize:10,color:'hsl(var(--text-muted))',fontWeight:600,marginBottom:3}}>VALOR FINAL</div><div style={{fontFamily:'monospace',fontWeight:800,fontSize:14,color:'#34d399'}}>R$ {fmtMoeda(parcelaAtiva.valorFinal)}</div></div>
              </div>
              {/* Evento: digitável com sugestões */}
              <div style={{position:'relative'}}>
                <label className="form-label">Evento / Competência</label>
                <input className="form-input" value={parcelaAtiva.evento||''}
                  onChange={e=>setParcelaAtiva((a:any)=>({...a,evento:e.target.value}))}
                  placeholder="Digite ou selecione um evento..."
                  list="eventos-list-editar"
                />
                <datalist id="eventos-list-editar">
                  {cfgEventos.filter(ev=>ev.situacao==='ativo').map(ev=>(
                    <option key={ev.id} value={ev.descricao}>{ev.codigo} — {ev.descricao}</option>
                  ))}
                </datalist>
              </div>
              {/* Vencimento */}
              <F label="Data de Vencimento">
                <input className="form-input" value={parcelaAtiva.vencimento} onChange={e=>setParcelaAtiva((a:any)=>({...a,vencimento:e.target.value}))} placeholder="DD/MM/AAAA"/>
              </F>
              {/* Valores */}
              <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:12}}>
                <F label="Valor Principal (R$)">
                  <input className="form-input" style={{fontFamily:'monospace'}} value={fmtMoeda(parcelaAtiva.valor)} onChange={e=>{
                    const v=parseMoeda(e.target.value)
                    setParcelaAtiva((a:any)=>{
                      const t=a.descTipo||'R$', raw=a.descRaw??a.desconto;
                      const d=t==='%' ? +(v*raw/100).toFixed(2) : raw;
                      return{...a,valor:v,desconto:d,valorFinal:Math.max(0,v-d)}
                    })
                  }}/>
                </F>
                <F label="Tipo Desc.">
                  <div style={{display:'flex',borderRadius:6,overflow:'hidden',border:'1px solid hsl(var(--border-subtle))',height:38}}>
                    {(['%','R$'] as const).map(t=><button key={t} type="button" style={{flex:1,fontSize:12,fontWeight:700,cursor:'pointer',border:'none',background:(parcelaAtiva.descTipo||'R$')===t?'#818cf8':'hsl(var(--bg-overlay))',color:(parcelaAtiva.descTipo||'R$')===t?'#fff':'hsl(var(--text-muted))'}} onClick={()=>{
                      setParcelaAtiva((a:any)=>{
                        const raw=a.descRaw??a.desconto;
                        const d=t==='%' ? +(a.valor*raw/100).toFixed(2) : raw;
                        return{...a,descTipo:t,desconto:d,valorFinal:Math.max(0,a.valor-d)}
                      })
                    }}>{t}</button>)}
                  </div>
                </F>
                <F label={`Desconto (${parcelaAtiva.descTipo||'R$'})`}>
                  <input className="form-input" style={{fontFamily:'monospace'}} value={fmtMoeda(parcelaAtiva.descRaw??parcelaAtiva.desconto)} onChange={e=>{
                    const raw=parseMoeda(e.target.value)
                    setParcelaAtiva((a:any)=>{
                      const t=a.descTipo||'R$';
                      const d=t==='%' ? +(a.valor*raw/100).toFixed(2) : raw;
                      return{...a,descRaw:raw,desconto:d,valorFinal:Math.max(0,a.valor-d)}
                    })
                  }}/>
                </F>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <F label="Juros (R$)">
                  <input className="form-input" style={{fontFamily:'monospace'}} value={fmtMoeda(parcelaAtiva.juros||0)} onChange={e=>setParcelaAtiva((a:any)=>({...a,juros:parseMoeda(e.target.value)}))}/>
                </F>
                <F label="Multa (R$)">
                  <input className="form-input" style={{fontFamily:'monospace'}} value={fmtMoeda(parcelaAtiva.multa||0)} onChange={e=>setParcelaAtiva((a:any)=>({...a,multa:parseMoeda(e.target.value)}))}/>
                </F>
              </div>
              <F label="Observação Financeira">
<textarea className="form-input" rows={2} value={parcelaAtiva.obs||''} onChange={e=>setParcelaAtiva((a:any)=>({...a,obs:e.target.value}))} placeholder="Anotações sobre esta parcela..."/>
              </F>
              {/* Total calculado */}
              <div style={{padding:'12px 16px',background:'rgba(99,102,241,0.06)',border:'1px solid rgba(99,102,241,0.2)',borderRadius:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:12,color:'hsl(var(--text-muted))'}}>Total a Receber (com juros e multa):</span>
                <span style={{fontFamily:'monospace',fontWeight:900,fontSize:18,color:'#818cf8'}}>
                  R$ {fmtMoeda(parcelaAtiva.valorFinal + (parcelaAtiva.juros||0) + (parcelaAtiva.multa||0))}
                </span>
              </div>
            </div>
            {/* Footer */}
            <div style={{padding:'14px 24px',borderTop:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'space-between',gap:10,background:'hsl(var(--bg-elevated))'}}>
              <div>
                {parcelaAtiva.status !== 'pago' && (
                  <button className="btn btn-ghost btn-sm" style={{color:'#f87171',fontSize:12}} onClick={()=>{if(confirm('Tem certeza que deseja marcar esta parcela como cancelada?')){setParcelas(prev=>prev.map(p=>p.num===parcelaAtiva.num?{...p,status:'cancelado',dataExclusao:new Date().toLocaleDateString('pt-BR'),motivoExclusao:'Cancelamento via edição'}:p));setModalEditarParcela(false)}}}>🗑️ Cancelar</button>
                )}
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-secondary" onClick={()=>setModalEditarParcela(false)}>Cancelar</button>
                <button className="btn btn-primary" style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)'}} onClick={()=>{
                  setParcelas(prev=>prev.map(p=>p.num===parcelaAtiva.num?{...p,...parcelaAtiva}:p))
                  setModalEditarParcela(false)
                }}><Check size={14}/> Salvar Alteracoes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ MODAL BAIXAR PARCELA ══════════════ */}
      {modalBaixarParcela&&parcelaAtiva&&(()=>{
        const jurosFin = parseMoeda(baixaForm.juros)
        const multaFin = parseMoeda(baixaForm.multa)
        const descNow  = parseMoeda(baixaForm.desconto||String(parcelaAtiva.desconto||'0'))
        const totalReceber = Math.max(0, parcelaAtiva.valor - descNow + jurosFin + multaFin)
        const dv=new Date(parcelaAtiva.vencimento.split('/').reverse().join('-')+'T12:00')
        const dp=baixaForm.dataPagto?new Date(baixaForm.dataPagto+'T12:00'):new Date();dp.setHours(12,0,0,0)
        const diasAtr=Math.max(0,Math.floor((dp.getTime()-dv.getTime())/86400000))
        // FORMAS é dinâmico (definido no topo do componente a partir de cfgMetodosPagamento)
        const totalFormas=baixaForm.formasPagto.reduce((s:number,f:any)=>s+parseMoeda(f.valor||'0'),0)
        const saldo=+(totalReceber-totalFormas).toFixed(2)
        const addForma=()=>setBaixaForm((ff:any)=>({...ff,formasPagto:[...ff.formasPagto,{id:String(Date.now()),forma:'Dinheiro',valor:saldo>0?fmtMoeda(saldo):'',cartao:null}]}))
        return (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:5000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
            <div style={{background:'hsl(var(--bg-base))',borderRadius:20,width:'100%',maxWidth:720,maxHeight:'94vh',overflowY:'auto',border:'1px solid hsl(var(--border-subtle))',boxShadow:'0 40px 120px rgba(0,0,0,0.8)'}}>              
              {/* Header */}
              <div style={{padding:'18px 24px',borderBottom:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'space-between',alignItems:'center',background:'linear-gradient(135deg,rgba(16,185,129,0.1),rgba(52,211,153,0.04))'}}>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:42,height:42,borderRadius:10,background:'rgba(16,185,129,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>💳</div>
                  <div>
                    <div style={{fontWeight:800,fontSize:15}}>Registrar Pagamento</div>
                    <div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>Baixa individual de parcela</div>
                  </div>
                </div>
                <button className="btn btn-ghost btn-icon" onClick={()=>setModalBaixarParcela(false)}><X size={18}/></button>
              </div>
              {/* Parcela Identity Card */}
              <div style={{padding:'12px 24px',background:'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(139,92,246,0.04))',borderBottom:'1px solid rgba(99,102,241,0.15)'}}>
                <div style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{width:52,height:52,borderRadius:14,background:'rgba(99,102,241,0.15)',border:'2px solid rgba(99,102,241,0.3)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <div style={{fontSize:9,color:'#818cf8',fontWeight:700,letterSpacing:1}}>PARC.</div>
                      <div style={{fontFamily:'monospace',fontWeight:900,fontSize:18,color:'#818cf8',lineHeight:1}}>
                        {String((parcelaAtiva as any).numParcela || parcelaAtiva.num).padStart(2,'0')}
                      </div>
                      {(parcelaAtiva as any).totalParcelas&&<div style={{fontSize:8,color:'rgba(129,140,248,0.7)',fontFamily:'monospace'}}>de {(parcelaAtiva as any).totalParcelas}</div>}
                    </div>
                    <div>
                      <div style={{fontWeight:800,fontSize:14,color:'hsl(var(--text-base))',textTransform:'capitalize'}}>{(parcelaAtiva as any).evento||parcelaAtiva.competencia}</div>
                      <div style={{display:'flex',gap:12,marginTop:3,fontSize:11,color:'hsl(var(--text-muted))'}}>
                        <span>Vcto: <strong style={{color:diasAtr>0?'#ef4444':'#f59e0b'}}>{parcelaAtiva.vencimento ? formatDate(parcelaAtiva.vencimento) : '—'}</strong></span>
                        {parcelaAtiva.codigo&&<span style={{fontFamily:'monospace',color:'#6366f1',fontSize:10}}>#{parcelaAtiva.codigo}</span>}
                        {diasAtr>0&&<span style={{padding:'1px 8px',borderRadius:20,background:'rgba(239,68,68,0.12)',color:'#f87171',fontWeight:700,fontSize:10}}>{diasAtr}d atraso</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{marginLeft:'auto',textAlign:'right'}}>
                    <div style={{fontSize:9,color:'hsl(var(--text-muted))',fontWeight:700,letterSpacing:.5}}>VALOR A PAGAR</div>
                    <div style={{fontFamily:'monospace',fontWeight:900,fontSize:22,color:'#10b981'}}>R$ {fmtMoeda(totalReceber)}</div>
                    {(jurosFin>0||multaFin>0)&&<div style={{fontSize:10,color:'#f87171'}}>incl. multa+juros R$ {fmtMoeda(jurosFin+multaFin)}</div>}
                  </div>
                </div>
              </div>
              {/* Aviso atraso */}
              {diasAtr>0&&(
                <div style={{padding:'8px 24px',background:'rgba(239,68,68,0.08)',borderBottom:'1px solid rgba(239,68,68,0.2)',display:'flex',alignItems:'center',gap:8}}>
                  <span>⚠️</span>
                  <div style={{fontSize:12}}><strong style={{color:'#ef4444'}}>Vencida há {diasAtr} dia(s)</strong> — Multa 2% e Juros 0,033%/dia calculados automaticamente. Ajuste se necessário.</div>
                </div>
              )}
              {/* Resumo */}
              <div style={{padding:'12px 24px',background:'hsl(var(--bg-elevated))',borderBottom:'1px solid hsl(var(--border-subtle))'}}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                  <div><div style={{fontSize:9,color:'hsl(var(--text-muted))',fontWeight:700}}>VENCIMENTO</div><div style={{fontFamily:'monospace',fontSize:12,fontWeight:700,color:diasAtr>0?'#ef4444':'#f59e0b'}}>{parcelaAtiva.vencimento ? formatDate(parcelaAtiva.vencimento) : '—'}</div></div>
                  <div><div style={{fontSize:9,color:'hsl(var(--text-muted))',fontWeight:700}}>VALOR ORIG.</div><div style={{fontFamily:'monospace',fontSize:12,fontWeight:700}}>R$ {fmtMoeda(parcelaAtiva.valor)}</div></div>
                  <div><div style={{fontSize:9,color:'hsl(var(--text-muted))',fontWeight:700}}>DESCONTO</div><div style={{fontFamily:'monospace',fontSize:12,fontWeight:700,color:'#f59e0b'}}>R$ {fmtMoeda(descNow)}</div></div>
                  <div><div style={{fontSize:9,color:'hsl(var(--text-muted))',fontWeight:700}}>TOTAL A PAGAR</div><div style={{fontFamily:'monospace',fontSize:14,fontWeight:800,color:'#10b981'}}>R$ {fmtMoeda(totalReceber)}</div></div>
                </div>
              </div>
              <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:14}}>
                {/* Caixa — seleção obrigatória */}
                {(()=>{
                  const caixasAtivos=caixasAbertos.filter(c=>!c.fechado)
                  return(
                    <div style={{padding:'12px 16px',background:!baixaForm.caixaId?'rgba(245,158,11,0.08)':'rgba(16,185,129,0.06)',border:`1px solid ${!baixaForm.caixaId?'rgba(245,158,11,0.35)':'rgba(16,185,129,0.25)'}`,borderRadius:10,display:'flex',gap:12,alignItems:'center'}}>
                      <div style={{fontSize:20}}>🏦</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:10,fontWeight:700,color:'hsl(var(--text-muted))',marginBottom:4,letterSpacing:.5}}>CAIXA *</div>
                        {caixasAtivos.length===0?(
                          <div style={{fontSize:12,color:'#f59e0b',fontWeight:600}}>⚠ Nenhum caixa aberto. Acesse Administrativo → Abertura de Caixa.</div>
                        ):(
                          <select className="form-input" style={{fontSize:12,fontWeight:700}} value={baixaForm.caixaId}
                            onChange={e=>setBaixaForm((ff:any)=>({...ff,caixaId:e.target.value}))}>
                            <option value="">— Selecionar caixa —</option>
                            {caixasAtivos.map(c=>(
                              <option key={c.id} value={c.id}>{c.nomeCaixa||'Caixa'} · {new Date(c.dataAbertura+'T12:00').toLocaleDateString('pt-BR')} ({c.operador})</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  )
                })()}
                {/* Data + Acréscimos */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:12}}>
                  <F label="Data do Pagamento">
                    <input className="form-input" type="date" value={baixaForm.dataPagto} onChange={e=>{
                      const nova=e.target.value
                      const {juros:j,multa:m}=calcAtraso(parcelaAtiva,nova)
                      setBaixaForm((ff:any)=>{
                        const newJ=j>0?fmtMoeda(j):ff.juros;
                        const newM=m>0?fmtMoeda(m):ff.multa;
                        const tr=Math.max(0,parcelaAtiva.valor-parseMoeda(ff.desconto||String(parcelaAtiva.desconto||'0'))+parseMoeda(newJ)+parseMoeda(newM));
                        return{...ff,dataPagto:nova,juros:newJ,multa:newM,formasPagto:ff.formasPagto.length===1?[{...ff.formasPagto[0],valor:fmtMoeda(tr)}]:ff.formasPagto}
                      })
                    }}/>
                  </F>
                  <F label="Multa">
                    <input className="form-input" style={{fontFamily:'monospace',color:parseMoeda(baixaForm.multa)>0?'#f87171':'inherit'}} value={baixaForm.multa} onChange={e=>{
                      const nv=e.target.value;
                      setBaixaForm((ff:any)=>{
                         const tr=Math.max(0,parcelaAtiva.valor-parseMoeda(ff.desconto||String(parcelaAtiva.desconto||'0'))+parseMoeda(ff.juros)+parseMoeda(nv))
                         return{...ff,multa:nv,formasPagto:ff.formasPagto.length===1?[{...ff.formasPagto[0],valor:fmtMoeda(tr)}]:ff.formasPagto}
                      })
                    }} placeholder="0,00"/>
                  </F>
                  <F label="Juros">
                    <input className="form-input" style={{fontFamily:'monospace',color:parseMoeda(baixaForm.juros)>0?'#f87171':'inherit'}} value={baixaForm.juros} onChange={e=>{
                      const nv=e.target.value;
                      setBaixaForm((ff:any)=>{
                         const tr=Math.max(0,parcelaAtiva.valor-parseMoeda(ff.desconto||String(parcelaAtiva.desconto||'0'))+parseMoeda(nv)+parseMoeda(ff.multa))
                         return{...ff,juros:nv,formasPagto:ff.formasPagto.length===1?[{...ff.formasPagto[0],valor:fmtMoeda(tr)}]:ff.formasPagto}
                      })
                    }} placeholder="0,00"/>
                  </F>
                  <F label="Desconto (R$)">
                    <input className="form-input" style={{fontFamily:'monospace'}} value={baixaForm.desconto} onChange={e=>{
                      const nv=e.target.value;
                      setBaixaForm((ff:any)=>{
                         const tr=Math.max(0,parcelaAtiva.valor-parseMoeda(nv)+parseMoeda(ff.juros)+parseMoeda(ff.multa))
                         return{...ff,desconto:nv,formasPagto:ff.formasPagto.length===1?[{...ff.formasPagto[0],valor:fmtMoeda(tr)}]:ff.formasPagto}
                      })
                    }} placeholder={fmtMoeda(parcelaAtiva.desconto)}/>
                  </F>
                </div>
                {/* Formas de pagamento múltiplas */}
                <div style={{padding:'14px 16px',background:'hsl(var(--bg-elevated))',border:'1px solid hsl(var(--border-subtle))',borderRadius:12}}>
                  <div style={{fontWeight:700,fontSize:12,marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span>💳 Formas de Pagamento</span>
                    <button type="button" onClick={()=>{
                      setBaixaForm((ff:any)=>{
                        const df=parseMoeda(ff.desconto||String(parcelaAtiva.desconto||'0'));
                        const tr=Math.max(0,parcelaAtiva.valor-df);
                        return{...ff,juros:'0',multa:'0',formasPagto:ff.formasPagto.length===1?[{...ff.formasPagto[0],valor:fmtMoeda(tr)}]:ff.formasPagto}
                      })
                    }}
                      style={{fontSize:11,padding:'4px 14px',borderRadius:8,border:'1px solid rgba(239,68,68,0.3)',background:'rgba(239,68,68,0.1)',color:'#f87171',cursor:'pointer',fontWeight:700,display:'flex',alignItems:'center',gap:4}}>Zerar Acréscimos</button>
                  </div>
                  {baixaForm.formasPagto.map((item:any,idx:number)=>(
                    <div key={item.id} style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
                      <select className="form-input" style={{flex:'0 0 180px',fontSize:12}} value={item.forma}
                        onChange={e=>setBaixaForm((ff:any)=>({...ff,formasPagto:ff.formasPagto.map((x:any,i:number)=>i===idx?{...x,forma:e.target.value,cartao:null}:x)}))}
                      >{FORMAS.map(fo=><option key={fo}>{fo}</option>)}</select>
                      <input className="form-input" style={{flex:'0 0 120px',fontFamily:'monospace',fontSize:12}}
                        value={item.valor} placeholder="R$ 0,00"
                        onChange={e=>setBaixaForm((ff:any)=>({...ff,formasPagto:ff.formasPagto.map((x:any,i:number)=>i===idx?{...x,valor:e.target.value}:x)}))}
                      />
                      {item.forma.startsWith('Cartão')&&(
                        <button type="button" style={{padding:'0 10px',height:38,borderRadius:8,border:'1px solid rgba(99,102,241,0.4)',background:item.cartao?'rgba(99,102,241,0.12)':'hsl(var(--bg-overlay))',cursor:'pointer',fontSize:11,fontWeight:700,color:item.cartao?'#818cf8':'hsl(var(--text-muted))',whiteSpace:'nowrap'}}
                          onClick={()=>{setCartaoFormIdx(idx);setCartaoForm(item.cartao||{bandeira:'Visa',numero:'',nome:'',validade:'',parcelas:'1',autorizacao:''});setModalCartao(true)}}>
                          {item.cartao?'✓ Cartão OK':'+ Dados do Cartão'}
                        </button>
                      )}
                      {baixaForm.formasPagto.length>1&&(
                        <button type="button" style={{width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:6,border:'none',background:'rgba(239,68,68,0.1)',cursor:'pointer',color:'#f87171',fontSize:16,fontWeight:700}}
                          onClick={()=>setBaixaForm((ff:any)=>({...ff,formasPagto:ff.formasPagto.filter((_:any,i:number)=>i!==idx)}))}>
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" className="btn btn-ghost btn-sm" style={{fontSize:11,marginTop:4}} onClick={addForma}>+ Adicionar forma de pagamento</button>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <F label="N. Comprovante / Documento">
                    <input className="form-input" value={baixaForm.comprovante} onChange={e=>setBaixaForm((ff:any)=>({...ff,comprovante:e.target.value}))} placeholder="PIX-12345 ou número do boleto"/>
                  </F>
                  <F label="Observação">
                    <input className="form-input" value={baixaForm.obs} onChange={e=>setBaixaForm((ff:any)=>({...ff,obs:e.target.value}))} placeholder="Anotações..."/>
                  </F>
                </div>
                {/* Saldo card */}
                {saldo!==0&&(
                  <div style={{padding:'16px 20px',borderRadius:14,background:saldo>0?'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(251,191,36,0.06))':'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(239,68,68,0.06))',border:`2px solid ${saldo>0?'rgba(245,158,11,0.4)':'rgba(239,68,68,0.4)'}`,display:'flex',alignItems:'center',gap:16}}>
                    <div style={{fontSize:32,lineHeight:1}}>{saldo>0?'⚠️':'❌'}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:800,fontSize:13,color:saldo>0?'#f59e0b':'#f87171',marginBottom:2}}>
                        {saldo>0?'Valor insuficiente':'Valor excedente'}
                      </div>
                      <div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>
                        {saldo>0?`Adicione mais R$ ${fmtMoeda(saldo)} para conciliar o pagamento.`:`O total das formas excede em R$ ${fmtMoeda(-saldo)}. Reduza alguma forma.`}
                      </div>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{fontSize:9,fontWeight:700,color:'hsl(var(--text-muted))',letterSpacing:.5,marginBottom:2}}>{saldo>0?'FALTAM':'EXCESSO'}</div>
                      <div style={{fontFamily:'monospace',fontWeight:900,fontSize:24,color:saldo>0?'#f59e0b':'#f87171'}}>R$ {fmtMoeda(Math.abs(saldo))}</div>
                    </div>
                  </div>
                )}
                {/* Totalizador */}
                <div style={{padding:'14px 16px',background:'rgba(16,185,129,0.08)',border:'2px solid rgba(16,185,129,0.25)',borderRadius:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
                    <div style={{display:'flex',gap:16,fontSize:12}}>
                      <span>Valor: <strong>R$ {fmtMoeda(parcelaAtiva.valor)}</strong></span>
                      <span style={{color:'#f59e0b'}}>(-) Desc: <strong>R$ {fmtMoeda(descNow)}</strong></span>
                      <span style={{color:'#f87171'}}>(+) Acr.: <strong>R$ {fmtMoeda(jurosFin+multaFin)}</strong></span>
                    </div>
                    <div style={{fontFamily:'monospace',fontWeight:900,fontSize:22,color:'#10b981'}}>R$ {fmtMoeda(totalReceber)}</div>
                  </div>
                  <div style={{marginTop:8,display:'flex',alignItems:'center',gap:6}}>
                    <span style={{fontSize:10,color:'hsl(var(--text-muted))'}}>Cód. Baixa gerado ao confirmar:</span>
                    <span style={{fontFamily:'monospace',fontSize:11,color:'#34d399',fontWeight:700}}>{baixaForm.codPreview||'BX000000'}</span>
                  </div>
                </div>
              </div>
              <div style={{padding:'14px 24px',borderTop:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'space-between',gap:10,background:'hsl(var(--bg-elevated))',flexWrap:'wrap'}}>
                <button className="btn btn-secondary" onClick={()=>setModalBaixarParcela(false)}>Cancelar</button>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  <button className="btn btn-primary" style={{gap:8,fontSize:14,border:'none',background:'linear-gradient(135deg,#6366f1,#8b5cf6)',color:'white',padding:'12px 24px',borderRadius:12,fontWeight:800,boxShadow:'0 4px 12px rgba(99,102,241,0.3)'}}
                    disabled={!baixaForm.dataPagto||Math.abs(saldo)>0.01||!baixaForm.caixaId}
                    onClick={()=>{
                      const df=parseMoeda(baixaForm.desconto||String(parcelaAtiva.desconto||'0'))
                      const jf=parseMoeda(baixaForm.juros); const mf=parseMoeda(baixaForm.multa)
                      const vf=Math.max(0,parcelaAtiva.valor-df+jf+mf)
                      const cb=baixaForm.codPreview||('BX'+String(Date.now()).slice(-6)+String(Math.floor(Math.random()*100)).padStart(2,'0'))
                      const fp=baixaForm.formasPagto[0]?.forma||'PIX'
                      const pRec={...parcelaAtiva,status:'pago' as any,dtPagto:baixaForm.dataPagto,
                        desconto:df,valorFinal:vf,juros:jf,multa:mf,obs:baixaForm.obs||((parcelaAtiva as any).obs||''),
                        formaPagto:fp,comprovante:baixaForm.comprovante,codBaixa:cb,formasPagto:baixaForm.formasPagto}
                      setParcelas((prev:any)=>prev.map((x:any)=>x.num===parcelaAtiva.num?pRec:x))
                      // Espelhar no caixa como Movimentação Manual
                      if(baixaForm.caixaId){
                        const now=new Date().toISOString()
                        setMovimentacoesManuais((prev:any)=>[...prev,{
                          id:cb,caixaId:baixaForm.caixaId,tipo:'receita',
                          fornecedorId:'',fornecedorNome:'',
                          descricao:`Baixa Parcela ${String((parcelaAtiva as any).numParcela||parcelaAtiva.num).padStart(2,'0')} — ${(parcelaAtiva as any).evento||parcelaAtiva.competencia} (${aluno?.nome||'Aluno'})`,
                          dataLancamento:baixaForm.dataPagto,dataMovimento:baixaForm.dataPagto,
                          valor:vf,planoContasId:'',planoContasDesc:'',
                          tipoDocumento:'REC',numeroDocumento:cb,dataEmissao:baixaForm.dataPagto,
                          compensadoBanco:false,observacoes:baixaForm.obs||'',
                          criadoEm:now,editadoEm:now,
                          origem:'baixa_aluno',referenciaId:cb
                        }])
                      }
                      setParcelaAtiva(pRec as any); setModalBaixarParcela(false); setModalRecibo(true)
                    }}>
                    🧾 Confirmar e Gerar Recibo
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ══════════════ MODAL DADOS CARTÃO ══════════════ */}
      {modalCartao&&(()=>{
        const cartaoSrcForma=cartaoCtx==='baixaResp'?baixaRespForm.formasPagto[cartaoFormIdx]:baixaForm.formasPagto[cartaoFormIdx]
        if(!cartaoSrcForma) return null
        return(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.92)',zIndex:7000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'hsl(var(--bg-base))',borderRadius:20,width:'100%',maxWidth:620,border:'1px solid hsl(var(--border-subtle))',boxShadow:'0 40px 120px rgba(0,0,0,0.9)',display:'flex',flexDirection:'column',maxHeight:'90vh',overflowY:'auto'}}>
            {/* Header */}
            <div style={{padding:'18px 24px',borderBottom:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'space-between',alignItems:'center',background:'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.04))',borderRadius:'20px 20px 0 0',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:42,height:42,borderRadius:10,background:'rgba(99,102,241,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>💳</div>
                <div>
                  <div style={{fontWeight:800,fontSize:15}}>Parcelamento no Cartão de {(cartaoSrcForma?.forma||'').includes('Débito')?'Débito':'Crédito'}</div>
                  <div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>{cartaoSrcForma?.forma} · Valor Total: <strong style={{color:'#ef4444',fontFamily:'monospace'}}>R$ {fmtMoeda(parseMoeda(cartaoSrcForma?.valor||'0'))}</strong></div>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={()=>setModalCartao(false)}><X size={18}/></button>
            </div>
            {/* Body */}
            <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:14}}>
              {/* Row 1: Cartão + Nome Titular */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <F label="Cartão (Bandeira · Tipo)">
                  <select className="form-input" value={cartaoForm.bandeira} onChange={e=>setCartaoForm(f=>({...f,bandeira:e.target.value}))}>
                    {BANDEIRAS_CARTAO.map(b=><option key={b} value={b}>{b}</option>)}
                  </select>
                </F>
                <F label="Nome Titular">
                  <input className="form-input" value={cartaoForm.nome} onChange={e=>setCartaoForm(f=>({...f,nome:e.target.value.toUpperCase()}))} placeholder="NOME COMO NO CARTÃO"/>
                </F>
              </div>
              {/* Row 2: Final Cartão + Emissão + Nº Parcelas + Valor Total */}
              <div style={{display:'grid',gridTemplateColumns:'100px 160px 110px 1fr',gap:12,alignItems:'end'}}>
                <F label="Nº Cartão (final)">
                  <input className="form-input" style={{fontFamily:'monospace',letterSpacing:4,textAlign:'center',fontSize:16,fontWeight:800}}
                    value={cartaoForm.numero}
                    onChange={e=>setCartaoForm(f=>({...f,numero:e.target.value.replace(/\D/g,'').slice(0,4)}))}
                    placeholder="0000" maxLength={4}/>
                </F>
                <F label="Emissão">
                  <input className="form-input" type="date"
                    value={cartaoForm.validade?.length===10?cartaoForm.validade:new Date().toISOString().split('T')[0]}
                    onChange={e=>setCartaoForm(f=>({...f,validade:e.target.value}))}/>
                </F>
                <F label="Nº Parcelas">
                  <input className="form-input" type="number" min={1} max={48}
                    style={{fontFamily:'monospace',textAlign:'center',fontWeight:700,fontSize:15}}
                    value={cartaoForm.parcelas}
                    onChange={e=>setCartaoForm((f:any)=>({...f,parcelas:String(Math.max(1,Math.min(48,parseInt(e.target.value)||1))),parcelasGeradas:[]}))}/>
                </F>
                <F label="Valor Total">
                  <div style={{display:'flex',alignItems:'center',height:38,padding:'0 12px',borderRadius:8,
                    border:'2px solid rgba(239,68,68,0.4)',background:'rgba(239,68,68,0.05)',
                    fontFamily:'monospace',fontWeight:900,fontSize:14,color:'#ef4444'}}>
                    R$ {fmtMoeda(parseMoeda(cartaoSrcForma?.valor||'0'))}
                  </div>
                </F>
              </div>
              {/* Row 3: Aut. + Documento */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <F label="Aut.">
                  <input className="form-input" style={{fontFamily:'monospace'}} value={cartaoForm.autorizacao}
                    onChange={e=>setCartaoForm(f=>({...f,autorizacao:e.target.value}))} placeholder="Nº autorização / NSU"/>
                </F>
                <F label="Documento">
                  <input className="form-input" style={{fontFamily:'monospace'}} value={(cartaoForm as any).documento||''}
                    onChange={e=>setCartaoForm((f:any)=>({...f,documento:e.target.value}))} placeholder="Nº doc. / comprovante"/>
                </F>
              </div>
              {/* Gerar Parcelas button */}
              <button type="button"
                style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'10px',borderRadius:10,
                  background:'linear-gradient(135deg,#6366f1,#8b5cf6)',color:'#fff',fontWeight:700,fontSize:13,
                  cursor:'pointer',border:'none',boxShadow:'0 4px 16px rgba(99,102,241,0.25)'}}
                onClick={()=>{
                  const total=parseMoeda(cartaoSrcForma?.valor||'0')
                  const qtd=parseInt(cartaoForm.parcelas||'1')
                  const vlrP=+(total/qtd).toFixed(2)
                  const base=cartaoForm.validade?.length===10?cartaoForm.validade:new Date().toISOString().split('T')[0]
                  const ps=Array.from({length:qtd},(_,i)=>{
                    const d=new Date(base+'T12:00');d.setMonth(d.getMonth()+i)
                    return {num:i+1,dataCredito:d.toLocaleDateString('pt-BR'),valor:vlrP,autorizacao:cartaoForm.autorizacao}
                  })
                  setCartaoForm((f:any)=>({...f,parcelasGeradas:ps}))
                }}>
                📋 Gerar Parcelas
              </button>
              {/* Installments table */}
              {(cartaoForm as any).parcelasGeradas?.length>0&&(
                <div style={{borderRadius:12,overflow:'hidden',border:'1px solid hsl(var(--border-subtle))'}}>
                  <div style={{padding:'8px 14px',background:'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.08))',
                    fontWeight:700,fontSize:12,color:'#818cf8',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span>📋 Parcelas Geradas — {cartaoForm.bandeira}</span>
                    <span style={{fontFamily:'monospace',fontSize:11,color:'hsl(var(--text-muted))'}}>Final **** **** **** {cartaoForm.numero||'????'}</span>
                  </div>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                    <thead>
                      <tr style={{background:'rgba(99,102,241,0.07)'}}>
                        {['Nome Usuário','Emissão','Parcela','Data Crédito','Valor','Nº Aut.'].map(h=>(
                          <th key={h} style={{padding:'6px 10px',textAlign:'left',fontWeight:700,color:'hsl(var(--text-muted))',borderBottom:'1px solid hsl(var(--border-subtle))',whiteSpace:'nowrap'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(cartaoForm as any).parcelasGeradas.map((row:any,i:number)=>(
                        <tr key={i} style={{borderBottom:'1px solid hsl(var(--border-subtle))',background:i%2===0?'transparent':'rgba(255,255,255,0.02)'}}>
                          <td style={{padding:'6px 10px',color:'hsl(var(--text-secondary))',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{cartaoForm.nome||'—'}</td>
                          <td style={{padding:'6px 10px',fontFamily:'monospace',fontSize:11}}>
                            {cartaoForm.validade?.length===10?new Date(cartaoForm.validade+'T12:00').toLocaleDateString('pt-BR'):new Date().toLocaleDateString('pt-BR')}
                          </td>
                          <td style={{padding:'6px 10px',textAlign:'center'}}>
                            <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',
                              minWidth:36,height:22,borderRadius:6,background:'rgba(99,102,241,0.12)',
                              color:'#818cf8',fontFamily:'monospace',fontWeight:900,fontSize:11,padding:'0 4px'}}>
                              {row.num}/{(cartaoForm as any).parcelasGeradas.length}
                            </span>
                          </td>
                          <td style={{padding:'6px 10px',fontFamily:'monospace',fontSize:11}}>{row.dataCredito}</td>
                          <td style={{padding:'6px 10px',fontFamily:'monospace',fontWeight:700,color:'#10b981',fontSize:12}}>R$ {fmtMoeda(row.valor)}</td>
                          <td style={{padding:'6px 10px',fontFamily:'monospace',color:'hsl(var(--text-muted))',fontSize:11}}>{row.autorizacao||'—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{background:'rgba(99,102,241,0.05)',borderTop:'2px solid hsl(var(--border-subtle))'}}>
                        <td colSpan={4} style={{padding:'7px 10px',fontWeight:700,fontSize:11,color:'hsl(var(--text-muted))'}}>Total · {(cartaoForm as any).parcelasGeradas.length} parcela(s)</td>
                        <td style={{padding:'7px 10px',fontFamily:'monospace',fontWeight:900,color:'#818cf8',fontSize:12}}>R$ {fmtMoeda(parseMoeda(baixaForm.formasPagto[cartaoFormIdx]?.valor||'0'))}</td>
                        <td/>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
            {/* Footer */}
            <div style={{padding:'14px 24px',borderTop:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'flex-end',
              gap:10,background:'hsl(var(--bg-elevated))',borderRadius:'0 0 20px 20px',flexShrink:0}}>
              <button className="btn btn-secondary" onClick={()=>setModalCartao(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)',fontWeight:800}}
                onClick={()=>{
                  if(cartaoCtx==='baixaResp'){
                    setBaixaRespForm((f:any)=>({...f,formasPagto:f.formasPagto.map((x:any,i:number)=>i===cartaoFormIdx?{...x,cartao:{...cartaoForm}}:x)}))
                  } else {
                    setBaixaForm((ff:any)=>({...ff,formasPagto:ff.formasPagto.map((x:any,i:number)=>i===cartaoFormIdx?{...x,cartao:{...cartaoForm}}:x)}))
                  }
                  setModalCartao(false)
                }}>
                <Check size={14}/> Gravar
              </button>
            </div>
          </div>
        </div>
      )})()}

      {/* ══════════════ MODAL BAIXA EM LOTE ══════════════ */}
      {modalBaixaLote&&(()=>{
        const selecionadas=parcelas.filter(p=>parcelasSelected.includes(p.num)&&p.status!=='pago')
        const df=parseMoeda(baixaLoteForm.desconto); const jf=parseMoeda(baixaLoteForm.juros); const mf=parseMoeda(baixaLoteForm.multa)
        const brutoTotal = selecionadas.reduce((s,p)=>s+p.valor,0)
        const totalGeral = Math.max(0, brutoTotal - df + jf + mf)
        const selecionadasComAcr=selecionadas.map(p=>{
          const {juros,multa,dias}=calcAtraso(p, baixaLoteForm.dataPagto)
          return{...(p as any),jurosCalc:juros,multaCalc:multa,diasAtr:dias,totalP:+(p.valorFinal+juros+multa).toFixed(2)}
        })
        const totalFormasLt=baixaLoteMultiFormas.reduce((s:number,f:any)=>s+parseMoeda(f.valor||'0'),0)
        const saldoLt=+(totalGeral-totalFormasLt).toFixed(2)
        const addFormaLt=()=>setBaixaLoteMultiFormas((ff:any)=>[...ff,{id:String(Date.now()),forma:'Dinheiro',valor:saldoLt>0?fmtMoeda(saldoLt):'',cartao:null}])
        const syncSingleFormValue = (vf: number) => {
          if (baixaLoteMultiFormas.length === 1) {
            setBaixaLoteMultiFormas((prev:any) => [{...prev[0], valor:fmtMoeda(vf)}])
          }
        }
        return(
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:5500,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
            <div style={{background:'hsl(var(--bg-base))',borderRadius:20,width:'100%',maxWidth:720,maxHeight:'94vh',overflowY:'auto',display:'flex',flexDirection:'column',border:'1px solid rgba(16,185,129,0.3)',boxShadow:'0 40px 120px rgba(0,0,0,0.9)'}}>
              <div style={{padding:'18px 24px',borderBottom:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0,background:'linear-gradient(135deg,rgba(16,185,129,0.1),rgba(52,211,153,0.04))'}}>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:48,height:48,borderRadius:12,background:'rgba(16,185,129,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>💳</div>
                  <div>
                    <div style={{fontWeight:800,fontSize:15}}>Registrar Pagamento em Lote</div>
                    <div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>{selecionadas.length} parcela(s) selecionada(s)</div>
                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:16}}>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:9,color:'hsl(var(--text-muted))',fontWeight:700,letterSpacing:.5}}>TOTAL A PAGAR</div>
                    <div style={{fontFamily:'monospace',fontWeight:900,fontSize:22,color:'#10b981'}}>R$ {fmtMoeda(totalGeral)}</div>
                  </div>
                  <button className="btn btn-ghost btn-icon" onClick={()=>setModalBaixaLote(false)}><X size={18}/></button>
                </div>
              </div>
              <div style={{background:'hsl(var(--bg-elevated))',borderBottom:'1px solid hsl(var(--border-subtle))',maxHeight:140,overflowY:'auto'}}>
                {selecionadasComAcr.map((p:any)=>(
                  <div key={p.num} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 24px',borderBottom:'1px solid hsl(var(--border-subtle))'}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:34,height:34,borderRadius:8,background:'rgba(16,185,129,0.12)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <span style={{fontSize:9,color:'#10b981',fontWeight:700}}>PARC</span>
                        <span style={{fontFamily:'monospace',fontWeight:900,fontSize:12,color:'#10b981',lineHeight:1}}>{String(p.num).padStart(2,'0')}</span>
                      </div>
                      <div>
                        <div style={{fontWeight:700,fontSize:12,textTransform:'capitalize'}}>{(p as any).evento||'Mensalidade'}</div>
                        <div style={{fontSize:10,color:'hsl(var(--text-muted))'}}>Vcto: <span style={{color:p.diasAtr>0?'#f87171':'inherit'}}>{p.vencimento ? formatDate(p.vencimento) : '—'}</span>{p.diasAtr>0&&<span style={{marginLeft:6,fontSize:9,padding:'1px 6px',borderRadius:20,background:'rgba(239,68,68,0.12)',color:'#f87171',fontWeight:700}}>{p.diasAtr}d atraso</span>}</div>
                      </div>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{fontFamily:'monospace',fontWeight:800,fontSize:13,color:(p.jurosCalc+p.multaCalc)>0?'#ef4444':'#10b981'}}>R$ {fmtMoeda(p.totalP)}</div>
                      {(p.jurosCalc+p.multaCalc)>0&&<div style={{fontSize:9,color:'#f87171'}}>+R$ {fmtMoeda(p.jurosCalc+p.multaCalc)} encargos</div>}
                        <div style={{fontSize:9,color:'hsl(var(--text-muted))'}}>Bruto R$ {fmtMoeda(p.valor)}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:14}}>
                <div style={{padding:'12px',background:'rgba(245,158,11,0.05)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:8}}>
                  <span style={{fontSize:11,color:'#f59e0b',fontWeight:700}}>⚠️ Atenção:</span> <span style={{fontSize:11,color:'hsl(var(--text-secondary))'}}>A edição dos campos abaixo substituirá os cálculos individuais das parcelas.</span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'110px 1fr 1fr 1fr',gap:10}}>
                  <F label="Data do Pagamento">
                    <input className="form-input" type="date" value={baixaLoteForm.dataPagto}
                      onChange={e=>{
                        const nd=e.target.value
                        setBaixaLoteForm(f=>({...f,dataPagto:nd}))
                        const sJ=selecionadas.reduce((s,p)=>s+calcAtraso(p,nd).juros,0)
                        const sM=selecionadas.reduce((s,p)=>s+calcAtraso(p,nd).multa,0)
                        setBaixaLoteForm(f=>({...f,juros:sJ>0?fmtMoeda(sJ):'0',multa:sM>0?fmtMoeda(sM):'0'}))
                        const newTotal=Math.max(0, brutoTotal - parseMoeda(baixaLoteForm.desconto) + sJ + sM)
                        syncSingleFormValue(newTotal)
                      }}/>
                  </F>
                  <F label="Multa (Total)"><input className="form-input" value={baixaLoteForm.multa}
                    onChange={e=>{setBaixaLoteForm(f=>({...f,multa:e.target.value}));syncSingleFormValue(Math.max(0,brutoTotal-df+jf+parseMoeda(e.target.value)))}}/></F>
                  <F label="Juros (Total)"><input className="form-input" value={baixaLoteForm.juros}
                    onChange={e=>{setBaixaLoteForm(f=>({...f,juros:e.target.value}));syncSingleFormValue(Math.max(0,brutoTotal-df+parseMoeda(e.target.value)+mf))}}/></F>
                  <F label="Desconto (R$) Lote"><input className="form-input" value={baixaLoteForm.desconto}
                    onChange={e=>{setBaixaLoteForm(f=>({...f,desconto:e.target.value}));syncSingleFormValue(Math.max(0,brutoTotal-parseMoeda(e.target.value)+jf+mf))}}/></F>
                </div>
                <div style={{padding:'14px 16px',background:'hsl(var(--bg-elevated))',border:'1px solid hsl(var(--border-subtle))',borderRadius:12}}>
                  <div style={{fontWeight:700,fontSize:12,marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{}}>💳 Formas de Pagamento</span>
                    <button type="button" onClick={()=>{
                      setBaixaLoteForm(f=>({...f,juros:'0',multa:'0'}));
                      syncSingleFormValue(Math.max(0,brutoTotal-df));
                    }}
                      style={{fontSize:10,padding:'4px 12px',borderRadius:20,border:'1px solid rgba(239,68,68,0.4)',background:'rgba(239,68,68,0.08)',color:'#ef4444',cursor:'pointer',fontWeight:800}}>Zerar Acréscimos</button>
                  </div>
                  {baixaLoteMultiFormas.map((item:any,idx:number)=>(
                    <div key={item.id} style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
                      <select className="form-input" style={{flex:'0 0 160px',fontSize:12}} value={item.forma}
                        onChange={e=>setBaixaLoteMultiFormas((ff:any)=>ff.map((x:any,i:number)=>i===idx?{...x,forma:e.target.value}:x))}
                      >{FORMAS.map(fo=><option key={fo}>{fo}</option>)}</select>
                      <input className="form-input" style={{flex:1,fontFamily:'monospace',fontSize:12}}
                        value={item.valor} placeholder="R$ 0,00"
                        onChange={e=>setBaixaLoteMultiFormas((ff:any)=>ff.map((x:any,i:number)=>i===idx?{...x,valor:e.target.value}:x))}
                      />
                      {(item.forma.includes('Cartão')||item.forma.includes('Crédito')||item.forma.includes('Débito'))&&(
                        <button type="button" style={{padding:'0 10px',height:36,fontSize:11,background:'hsl(var(--bg-base))',border:'1px solid hsl(var(--border-subtle))',borderRadius:6,cursor:'pointer',color:'#818cf8',fontWeight:700,display:'flex',alignItems:'center',gap:4}}
                          onClick={()=>{setCartaoFormIdx(idx);setModalCartao(true)}}>
                          {item.cartao?.numero ? `Final ${item.cartao.numero}` : '+ Dados Cartão'}
                        </button>
                      )}
                      {baixaLoteMultiFormas.length>1&&(
                        <button type="button" style={{width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:6,border:'none',background:'rgba(239,68,68,0.1)',cursor:'pointer',color:'#f87171',fontSize:16}}
                          onClick={()=>setBaixaLoteMultiFormas((ff:any)=>ff.filter((_:any,i:number)=>i!==idx))}>×</button>
                      )}
                    </div>
                  ))}
                  <button type="button" className="btn btn-ghost btn-sm" style={{fontSize:11,marginTop:4}} onClick={addFormaLt}>+ Adicionar forma de pagamento</button>
                </div>
                {saldoLt!==0&&(
                  <div style={{padding:'16px 20px',borderRadius:14,background:saldoLt>0?'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(251,191,36,0.06))':'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(239,68,68,0.06))',border:`2px solid ${saldoLt>0?'rgba(245,158,11,0.4)':'rgba(239,68,68,0.4)'}`,display:'flex',alignItems:'center',gap:16}}>
                    <div style={{fontSize:32,lineHeight:1}}>{saldoLt>0?'⚠️':'❌'}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:800,fontSize:13,color:saldoLt>0?'#f59e0b':'#f87171'}}>{saldoLt>0?'Valor insuficiente':'Valor excedente'}</div>
                      <div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>{saldoLt>0?`Adicione mais R$ ${fmtMoeda(saldoLt)}`:`Excede em R$ ${fmtMoeda(-saldoLt)}`}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:9,fontWeight:700,color:'hsl(var(--text-muted))',letterSpacing:.5}}>{saldoLt>0?'FALTAM':'EXCESSO'}</div>
                      <div style={{fontFamily:'monospace',fontWeight:900,fontSize:24,color:saldoLt>0?'#f59e0b':'#f87171'}}>R$ {fmtMoeda(Math.abs(saldoLt))}</div>
                    </div>
                  </div>
                )}
                <div style={{padding:'14px 16px',background:'rgba(16,185,129,0.08)',border:'2px solid rgba(16,185,129,0.25)',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div>
                    <div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>Totalizador Lote ({selecionadas.length} parcelas)</div>
                    <div style={{fontSize:10,color:'hsl(var(--text-muted))',marginTop:2}}>Cód. Lote: <span style={{fontFamily:'monospace',color:'#34d399',fontWeight:700}}>{baixaLoteForm.codPreview||'BX000000LL'}</span></div>
                  </div>
                  <div style={{textAlign:'right',marginRight:16}}>
                    <div style={{fontSize:10,color:'hsl(var(--text-muted))'}}>Valor: <strong style={{color:'hsl(var(--text-base))'}}>R$ {fmtMoeda(brutoTotal)}</strong> <span style={{color:'#f59e0b',marginLeft:4}}>(-) Desc: R$ {fmtMoeda(df)}</span> <span style={{color:'#f87171',marginLeft:4}}>(+) Acr: R$ {fmtMoeda(jf+mf)}</span></div>
                  </div>
                  <div style={{fontFamily:'monospace',fontWeight:900,fontSize:24,color:'#10b981'}}>R$ {fmtMoeda(totalGeral)}</div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <F label="N. Comprovante"><input className="form-input" value={baixaLoteForm.comprovante} onChange={e=>setBaixaLoteForm(f=>({...f,comprovante:e.target.value}))} placeholder="Ex: PIX-12345"/></F>
                  <F label="Observacao"><input className="form-input" value={baixaLoteForm.obs} onChange={e=>setBaixaLoteForm(f=>({...f,obs:e.target.value}))} placeholder="Observacoes..."/></F>
                </div>
              </div>
              <div style={{padding:'14px 24px',borderTop:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'space-between',gap:10,background:'hsl(var(--bg-elevated))'}}>
                <button className="btn btn-secondary" onClick={()=>setModalBaixaLote(false)}>Cancelar</button>
                <button className="btn btn-primary" style={{background:'linear-gradient(135deg,#10b981,#059669)',fontWeight:800,padding:'12px 24px',fontSize:14,borderRadius:12}}
                  disabled={!baixaLoteForm.dataPagto||selecionadas.length===0||Math.abs(saldoLt)>0.01}
                  onClick={()=>{
                    const codPrv=baixaLoteForm.codPreview||('BX'+String(Date.now()).slice(-6)+'LL')
                    const formaStr=baixaLoteMultiFormas.map((f:any)=>f.forma).join('+')
                    const nums=selecionadas.map(p=>p.num)
                    const descProp=df/brutoTotal; const jurosProp=jf/brutoTotal; const multaProp=mf/brutoTotal
                    setParcelas(prev=>prev.map(p=>{
                      if(!nums.includes(p.num)||p.status==='pago') return p
                      const jp=+(p.valor*jurosProp).toFixed(2); const mp=+(p.valor*multaProp).toFixed(2); const dp=+(p.valor*descProp).toFixed(2)
                      const vf=Math.max(0,p.valor-dp+jp+mp)
                      return{...p,status:'pago',dtPagto:baixaLoteForm.dataPagto,formaPagto:formaStr,comprovante:baixaLoteForm.comprovante,codBaixa:codPrv,juros:jp,multa:mp,desconto:dp,valorFinal:vf,formasPagto:baixaLoteMultiFormas}
                    }))
                    setBaixaLoteMultiFormas([{id:'f1',forma:'PIX',valor:'',cartao:null}])
                    setParcelasSelected([])
                    setModalBaixaLote(false)
                  }}>Confirmar Baixa Multiple R$ {fmtMoeda(totalGeral)}</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ══════════════ MODAL BAIXA POR RESPONSÁVEL — PASSO 1 ══════════════ */}
      {modalBaixaResp&&(()=>{
        // ── Busca correta: responsável financeiro do aluno atual ──────────────────
        const respFin=todosResp.find(r=>r.respFinanceiro)
        // Outros alunos que compartilham o mesmo responsável financeiro (por nome ou CPF)
        const outrosAlunos=alunos.filter((a:any)=>{
          if(a.id===editId) return false  // exclui o próprio aluno
          const resps=(a as any).responsaveis
          if(!Array.isArray(resps)) return false
          return resps.some((r:any)=>{
            if(respFin?.cpf&&r.cpf) return r.cpf.replace(/\D/g,'')===respFin.cpf.replace(/\D/g,'')
            return r.nome&&respFin?.nome&&r.nome.trim().toLowerCase()===respFin.nome.trim().toLowerCase()
          })
        })
        // Parcelas do aluno atual (em edição)
        const parcelasProprioAluno=parcelas
          .filter(p=>p.status!=='pago'&&p.status!=='cancelado')
          .map(p=>({...(p as any),alunoNome:aluno.nome||'Aluno Atual',alunoId:'__novo__',alunoAvatar:(aluno.nome||'A')[0].toUpperCase()}))
        // Parcelas dos outros alunos do mesmo responsável
        const parcelasOutros=outrosAlunos.flatMap((a:any)=>
          (a.parcelas||[])
            .filter((p:any)=>p.status!=='pago'&&p.status!=='cancelado')
            .map((p:any)=>({...p,alunoNome:a.nome,alunoId:a.id||a.cpf||a.nome,alunoAvatar:(a.nome||'A')[0].toUpperCase()}))
        )
        const todasParcelas=[...parcelasProprioAluno,...parcelasOutros]
        // Grupos por aluno para renderização agrupada
        const grupos:{id:string;nome:string;avatar:string;parcelas:any[]}[]=[]
        for(const p of todasParcelas){
          let g=grupos.find(x=>x.id===p.alunoId)
          if(!g){g={id:p.alunoId,nome:p.alunoNome,avatar:p.alunoAvatar,parcelas:[]};grupos.push(g)}
          g.parcelas.push(p)
        }
        const selResp=baixaRespParcelas
        const totalSel=selResp.reduce((s:number,p:any)=>s+(p.valorFinal||p.valor||0),0)
        const allSel=selResp.length===todasParcelas.length&&todasParcelas.length>0
        const hoje=new Date();hoje.setHours(12,0,0,0)
        const getDias=(venc:string)=>{
          const [d,m,a]=venc.split('/');const dv=new Date(+a,+m-1,+d,12);return Math.max(0,Math.floor((hoje.getTime()-dv.getTime())/86400000))
        }
        const toggleParcela=(p:any)=>{
          const isSel=selResp.some((s:any)=>s.alunoId===p.alunoId&&s.num===p.num)
          setBaixaRespParcelas(isSel?selResp.filter((s:any)=>!(s.alunoId===p.alunoId&&s.num===p.num)):[...selResp,p])
        }
        const toggleGrupo=(g:{id:string;parcelas:any[]})=>{
          const allGrupSel=g.parcelas.every(p=>selResp.some((s:any)=>s.alunoId===p.alunoId&&s.num===p.num))
          if(allGrupSel) setBaixaRespParcelas(selResp.filter((s:any)=>s.alunoId!==g.id))
          else{const novos=g.parcelas.filter(p=>!selResp.some((s:any)=>s.alunoId===p.alunoId&&s.num===p.num));setBaixaRespParcelas([...selResp,...novos])}
        }
        return(
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.9)',zIndex:5500,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
            <div style={{background:'hsl(var(--bg-base))',borderRadius:22,width:'100%',maxWidth:900,maxHeight:'94vh',display:'flex',flexDirection:'column',border:'1px solid rgba(99,102,241,0.35)',boxShadow:'0 48px 140px rgba(0,0,0,0.95)',overflow:'hidden'}}>

              {/* ── Header ── */}
              <div style={{padding:'20px 28px',borderBottom:'1px solid hsl(var(--border-subtle))',background:'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.05))',flexShrink:0}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                  <div style={{display:'flex',alignItems:'center',gap:14}}>
                    <div style={{width:52,height:52,borderRadius:14,background:'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.1))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,border:'1px solid rgba(99,102,241,0.3)'}}>👨‍👧‍👦</div>
                    <div>
                      <div style={{fontWeight:900,fontSize:16,letterSpacing:-.3}}>Baixa por Responsável Financeiro</div>
                      <div style={{fontSize:11,color:'hsl(var(--text-muted))',marginTop:3,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                        <span>Passo 1 — Selecione as parcelas a quitar</span>
                        {respFin?.nome&&<><span style={{color:'rgba(99,102,241,0.5)'}}>·</span><span>Resp: <strong style={{color:'#818cf8'}}>{respFin.nome}</strong>{respFin.cpf&&<span style={{color:'rgba(99,102,241,0.5)',marginLeft:4}}>({respFin.cpf})</span>}</span></>}
                      </div>
                      {/* Chips de alunos vinculados */}
                      <div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}}>
                        {grupos.map(g=>(
                          <span key={g.id} style={{fontSize:10,padding:'2px 9px',borderRadius:20,background:'rgba(99,102,241,0.1)',border:'1px solid rgba(99,102,241,0.2)',color:'#818cf8',fontWeight:700}}>
                            {g.avatar} {g.nome.split(' ')[0]} · {g.parcelas.length} parcela{g.parcelas.length!==1?'s':''}
                          </span>
                        ))}
                        {outrosAlunos.length===0&&<span style={{fontSize:10,color:'hsl(var(--text-muted))',fontStyle:'italic'}}>Nenhum outro aluno vinculado a este responsável</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:16}}>
                    {selResp.length>0&&(
                      <div style={{textAlign:'right',padding:'8px 14px',background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.3)',borderRadius:12}}>
                        <div style={{fontSize:9,color:'#10b981',fontWeight:700,letterSpacing:.8}}>{selResp.length} PARCEL{selResp.length!==1?'AS':'A'} SELECIONADA{selResp.length!==1?'S':''}</div>
                        <div style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:900,fontSize:22,color:'#10b981',lineHeight:1.2}}>R$ {fmtMoeda(totalSel)}</div>
                      </div>
                    )}
                    <button className="btn btn-ghost btn-icon" style={{borderRadius:10}} onClick={()=>{setModalBaixaResp(false);setBaixaRespParcelas([])}}><X size={18}/></button>
                  </div>
                </div>
              </div>

              {/* ── Toolbar ── */}
              <div style={{padding:'10px 28px',borderBottom:'1px solid hsl(var(--border-subtle))',background:'hsl(var(--bg-elevated))',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
                <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:12,fontWeight:700,color:'hsl(var(--text-base))'}}>
                  <input type="checkbox" style={{width:15,height:15,accentColor:'#6366f1',cursor:'pointer'}} checked={allSel} onChange={e=>setBaixaRespParcelas(e.target.checked?[...todasParcelas]:[])}/>
                  Selecionar todas ({todasParcelas.length})
                </label>
                <div style={{display:'flex',gap:12,fontSize:11,color:'hsl(var(--text-muted))'}}>
                  <span>🔴 Vencidas: <strong style={{color:'#ef4444'}}>{todasParcelas.filter(p=>{try{const [d,m,a]=p.vencimento.split('/');return new Date(+a,+m-1,+d,12)<hoje}catch{return false}}).length}</strong></span>
                  <span>🟡 A vencer: <strong style={{color:'#f59e0b'}}>{todasParcelas.filter(p=>{try{const [d,m,a]=p.vencimento.split('/');return new Date(+a,+m-1,+d,12)>=hoje}catch{return false}}).length}</strong></span>
                  <span>💰 Total geral: <strong style={{color:'#10b981',fontFamily:"'JetBrains Mono',monospace"}}>R$ {fmtMoeda(todasParcelas.reduce((s,p:any)=>s+(p.valorFinal||p.valor||0),0))}</strong></span>
                </div>
              </div>

              {/* ── Corpo: grupos de alunos ── */}
              <div style={{flex:1,overflowY:'auto'}}>
                {todasParcelas.length===0?(
                  <div style={{padding:'80px 40px',textAlign:'center',color:'hsl(var(--text-muted))'}}>
                    <div style={{fontSize:56,marginBottom:16}}>✅</div>
                    <div style={{fontWeight:800,fontSize:16,marginBottom:6}}>Tudo em dia!</div>
                    <div style={{fontSize:12}}>Este responsável não possui parcelas pendentes ou vencidas.</div>
                  </div>
                ):(
                  grupos.map(g=>{
                    const gSel=g.parcelas.filter(p=>selResp.some((s:any)=>s.alunoId===p.alunoId&&s.num===p.num))
                    const gTotal=g.parcelas.reduce((s,p:any)=>s+(p.valorFinal||p.valor||0),0)
                    const gSelTotal=gSel.reduce((s:number,p:any)=>s+(p.valorFinal||p.valor||0),0)
                    const allGrupSel=g.parcelas.length>0&&gSel.length===g.parcelas.length
                    return(
                      <div key={g.id} style={{borderBottom:'2px solid hsl(var(--border-subtle))'}}>
                        {/* Cabeçalho do grupo */}
                        <div style={{padding:'12px 28px',background:'hsl(var(--bg-elevated))',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:1}}>
                          <div style={{display:'flex',alignItems:'center',gap:10}}>
                            <input type="checkbox" style={{width:14,height:14,accentColor:'#6366f1',cursor:'pointer'}} checked={allGrupSel} onChange={()=>toggleGrupo(g)}/>
                            <div style={{width:32,height:32,borderRadius:8,background:'linear-gradient(135deg,rgba(99,102,241,0.25),rgba(139,92,246,0.1))',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:13,color:'#818cf8',border:'1px solid rgba(99,102,241,0.2)'}}>
                              {g.avatar}
                            </div>
                            <div>
                              <div style={{fontWeight:800,fontSize:13}}>{g.nome}</div>
                              <div style={{fontSize:10,color:'hsl(var(--text-muted))'}}>{g.parcelas.length} parcela{g.parcelas.length!==1?'s':''} pendente{g.parcelas.length!==1?'s':''} · Total: <span style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>R$ {fmtMoeda(gTotal)}</span></div>
                            </div>
                          </div>
                          {gSel.length>0&&(
                            <div style={{padding:'4px 12px',borderRadius:20,background:'rgba(16,185,129,0.12)',border:'1px solid rgba(16,185,129,0.25)',fontSize:11,fontWeight:700,color:'#10b981'}}>
                              {gSel.length} sel. · R$ {fmtMoeda(gSelTotal)}
                            </div>
                          )}
                        </div>
                        {/* Linhas de parcelas */}
                        {g.parcelas.map((p:any,i:number)=>{
                          const isSel=selResp.some((s:any)=>s.alunoId===p.alunoId&&s.num===p.num)
                          const dias=getDias(p.vencimento||'')
                          const isVenc=dias>0
                          return(
                            <div key={i}
                              onClick={()=>toggleParcela(p)}
                              style={{display:'flex',alignItems:'center',gap:0,padding:'12px 28px',cursor:'pointer',background:isSel?'rgba(99,102,241,0.06)':'transparent',borderBottom:'1px solid hsl(var(--border-subtle))',transition:'background .15s'}}
                              onMouseEnter={e=>{if(!isSel)(e.currentTarget as HTMLElement).style.background='rgba(99,102,241,0.03)'}}
                              onMouseLeave={e=>{if(!isSel)(e.currentTarget as HTMLElement).style.background='transparent'}}
                            >
                              {/* Checkbox */}
                              <div style={{width:40,flexShrink:0,display:'flex',alignItems:'center'}}>
                                <input type="checkbox" checked={isSel} onChange={()=>{}} style={{width:14,height:14,accentColor:'#6366f1',cursor:'pointer'}} onClick={e=>e.stopPropagation()}/>
                              </div>
                              {/* Nº parcela */}
                              <div style={{width:44,flexShrink:0}}>
                                <div style={{width:34,height:34,borderRadius:8,background:isSel?'rgba(99,102,241,0.18)':'rgba(99,102,241,0.08)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'JetBrains Mono',monospace",fontWeight:900,fontSize:12,color:isSel?'#818cf8':'hsl(var(--text-muted))',border:`1px solid ${isSel?'rgba(99,102,241,0.35)':'transparent'}`}}>
                                  {String(p.num).padStart(2,'0')}
                                </div>
                              </div>
                              {/* Evento + competência */}
                              <div style={{flex:'0 0 200px'}}>
                                <div style={{fontWeight:700,fontSize:12}}>{p.evento||'Mensalidade'}</div>
                                <div style={{fontSize:10,color:'hsl(var(--text-muted))',textTransform:'capitalize',marginTop:1}}>{p.competencia||'—'}</div>
                              </div>
                              {/* Vencimento */}
                              <div style={{flex:'0 0 110px'}}>
                                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:isVenc?800:600,color:isVenc?'#ef4444':'hsl(var(--text-base))'}}>{p.vencimento ? formatDate(p.vencimento) : '—'}</div>
                                {isVenc?(
                                  <div style={{fontSize:9,marginTop:2,padding:'1px 6px',borderRadius:20,background:'rgba(239,68,68,0.12)',color:'#ef4444',fontWeight:700,display:'inline-block'}}>
                                    ⚠ {dias}d atraso
                                  </div>
                                ):(
                                  <div style={{fontSize:9,marginTop:2,color:'hsl(var(--text-muted))'}}>a vencer</div>
                                )}
                              </div>
                              {/* Desconto */}
                              <div style={{flex:'0 0 80px',textAlign:'right'}}>
                                {(p.desconto||0)>0?(
                                  <div style={{fontSize:11,color:'#10b981',fontWeight:700}}>-R$ {fmtMoeda(p.desconto||0)}</div>
                                ):<div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>—</div>}
                              </div>
                              {/* Valor */}
                              <div style={{flex:'0 0 120px',textAlign:'right'}}>
                                <div style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:800,fontSize:14,color:isSel?'#818cf8':'hsl(var(--text-base))'}}>
                                  R$ {fmtMoeda(p.valorFinal||p.valor||0)}
                                </div>
                                {p.valorFinal&&p.valorFinal!==p.valor&&(
                                  <div style={{fontSize:9,color:'hsl(var(--text-muted))',textDecoration:'line-through'}}>R$ {fmtMoeda(p.valor||0)}</div>
                                )}
                              </div>
                              {/* Status badge */}
                              <div style={{flex:'0 0 90px',textAlign:'center'}}>
                                <span style={{fontSize:9,padding:'3px 8px',borderRadius:20,fontWeight:700,background:isVenc?'rgba(239,68,68,0.12)':'rgba(245,158,11,0.1)',color:isVenc?'#ef4444':'#f59e0b',whiteSpace:'nowrap'}}>
                                  {isVenc?'VENCIDA':'PENDENTE'}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })
                )}
              </div>

              {/* ── Footer ── */}
              <div style={{padding:'16px 28px',borderTop:'1px solid hsl(var(--border-subtle))',background:'hsl(var(--bg-elevated))',borderRadius:'0 0 22px 22px',flexShrink:0}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
                  <button className="btn btn-secondary" style={{borderRadius:10}} onClick={()=>{setModalBaixaResp(false);setBaixaRespParcelas([])}}>Cancelar</button>
                  <div style={{display:'flex',alignItems:'center',gap:14}}>
                    {selResp.length>0&&(
                      <div style={{fontSize:12,color:'hsl(var(--text-muted))'}}>
                        <strong style={{color:'hsl(var(--text-base))'}}>{selResp.length}</strong> parcela{selResp.length!==1?'s':''} · Total <strong style={{color:'#10b981',fontFamily:"'JetBrains Mono',monospace"}}>R$ {fmtMoeda(totalSel)}</strong>
                      </div>
                    )}
                    <button className="btn btn-primary"
                      style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)',fontWeight:800,boxShadow:'0 4px 16px rgba(99,102,241,0.4)',padding:'11px 26px',fontSize:13,borderRadius:12,display:'flex',alignItems:'center',gap:8}}
                      disabled={selResp.length===0}
                      onClick={()=>{
                        setBaixaRespForm((f:any)=>{const cxDefault=caixasAbertos.filter(c=>!c.fechado).sort((a,b)=>b.dataAbertura.localeCompare(a.dataAbertura))[0]?.id??''; return{dataPagto:new Date().toISOString().split('T')[0],formasPagto:[{id:'rf1',forma:'PIX',valor:fmtMoeda(totalSel),cartao:null}],obs:'',comprovante:'',caixaId:cxDefault}})
                        setModalBaixaRespConfirm(true)
                      }}>
                      <Check size={15}/> Continuar → Pagar {selResp.length} parcela{selResp.length!==1?'s':''} · R$ {fmtMoeda(totalSel)}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )
      })()}





      {modalBaixaRespConfirm&&(()=>{
        const selResp=baixaRespParcelas
        const totalBruto=selResp.reduce((s:number,p:any)=>s+(p.valorFinal||p.valor||0),0)
        const totalFormas=baixaRespForm.formasPagto.reduce((s:number,f:any)=>s+parseMoeda(f.valor||'0'),0)
        const saldo=+(totalBruto-totalFormas).toFixed(2)
        const addForma=()=>setBaixaRespForm((f:any)=>({...f,formasPagto:[...f.formasPagto,{id:String(Date.now()),forma:'Dinheiro',valor:saldo>0?fmtMoeda(saldo):'',cartao:null}]}))
        return(
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.92)',zIndex:5600,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
            <div style={{background:'hsl(var(--bg-base))',borderRadius:20,width:'100%',maxWidth:680,maxHeight:'92vh',display:'flex',flexDirection:'column',border:'1px solid rgba(16,185,129,0.35)',boxShadow:'0 40px 120px rgba(0,0,0,0.95)'}}>

              {/* Header */}
              <div style={{padding:'18px 24px',borderBottom:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'space-between',alignItems:'center',background:'linear-gradient(135deg,rgba(16,185,129,0.1),rgba(52,211,153,0.04))',borderRadius:'20px 20px 0 0',flexShrink:0}}>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:48,height:48,borderRadius:12,background:'rgba(16,185,129,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>💳</div>
                  <div>
                    <div style={{fontWeight:800,fontSize:15}}>Confirmar Pagamento</div>
                    <div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>Passo 2 — Informe a forma de pagamento · {selResp.length} parcela{selResp.length!==1?'s':''}</div>
                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:16}}>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:9,color:'hsl(var(--text-muted))',fontWeight:700,letterSpacing:.5}}>TOTAL</div>
                    <div style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:900,fontSize:22,color:'#10b981'}}>R$ {fmtMoeda(totalBruto)}</div>
                  </div>
                  <button className="btn btn-ghost btn-icon" onClick={()=>setModalBaixaRespConfirm(false)}><X size={18}/></button>
                </div>
              </div>

              {/* Parcelas resumo */}
              <div style={{background:'hsl(var(--bg-elevated))',borderBottom:'1px solid hsl(var(--border-subtle))',maxHeight:130,overflowY:'auto',flexShrink:0}}>
                {selResp.map((p:any,i:number)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 24px',borderBottom:'1px solid hsl(var(--border-subtle))'}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:30,height:30,borderRadius:7,background:'rgba(16,185,129,0.12)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <span style={{fontFamily:'monospace',fontWeight:900,fontSize:11,color:'#10b981'}}>{String(p.num).padStart(2,'0')}</span>
                      </div>
                      <div>
                        <div style={{fontWeight:700,fontSize:11}}>{p.alunoNome} — {p.evento||'Mensalidade'}</div>
                        <div style={{fontSize:10,color:'hsl(var(--text-muted))',textTransform:'capitalize'}}>{p.competencia} · Vcto {p.vencimento ? formatDate(p.vencimento) : '—'}</div>
                      </div>
                    </div>
                    <div style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:800,fontSize:13,color:'#10b981',flexShrink:0}}>R$ {fmtMoeda(p.valorFinal||p.valor)}</div>
                  </div>
                ))}
              </div>

              {/* Formulário */}
              <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:14,overflowY:'auto',flex:1}}>

                {/* Caixa — seleção obrigatória */}
                {(()=>{
                  const cxAtivos=caixasAbertos.filter(c=>!c.fechado)
                  return(
                    <div style={{padding:'10px 14px',background:!baixaRespForm.caixaId?'rgba(245,158,11,0.08)':'rgba(16,185,129,0.06)',border:`1px solid ${!baixaRespForm.caixaId?'rgba(245,158,11,0.35)':'rgba(16,185,129,0.25)'}`,borderRadius:10,display:'flex',gap:10,alignItems:'center'}}>
                      <div style={{fontSize:18}}>🏦</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:10,fontWeight:700,color:'hsl(var(--text-muted))',marginBottom:3,letterSpacing:.5}}>CAIXA *</div>
                        {cxAtivos.length===0?(
                          <div style={{fontSize:12,color:'#f59e0b',fontWeight:600}}>⚠ Nenhum caixa aberto. Acesse Administrativo → Abertura de Caixa.</div>
                        ):(
                          <select className="form-input" style={{fontSize:12,fontWeight:700}} value={baixaRespForm.caixaId}
                            onChange={e=>setBaixaRespForm((f:any)=>({...f,caixaId:e.target.value}))}>
                            <option value="">— Selecionar caixa —</option>
                            {cxAtivos.map(c=>(
                              <option key={c.id} value={c.id}>{c.nomeCaixa||'Caixa'} · {new Date(c.dataAbertura+'T12:00').toLocaleDateString('pt-BR')} ({c.operador})</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {/* Data pagamento */}
                <F label="Data do Pagamento">
                  <input className="form-input" type="date" value={baixaRespForm.dataPagto}
                    onChange={e=>setBaixaRespForm((f:any)=>({...f,dataPagto:e.target.value}))}/>
                </F>

                {/* Formas de pagamento */}
                <div style={{padding:'14px 16px',background:'hsl(var(--bg-elevated))',border:'1px solid hsl(var(--border-subtle))',borderRadius:12}}>
                  <div style={{fontWeight:700,fontSize:12,marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span>💳 Formas de Pagamento</span>
                    <button type="button" className="btn btn-ghost btn-sm" style={{fontSize:11}} onClick={addForma}>+ Adicionar</button>
                  </div>
                  {baixaRespForm.formasPagto.map((item:any,idx:number)=>(
                    <div key={item.id} style={{marginBottom:8}}>
                      <div style={{display:'flex',gap:8,alignItems:'center'}}>
                        <select className="form-input" style={{flex:'0 0 170px',fontSize:12}} value={item.forma}
                          onChange={e=>setBaixaRespForm((f:any)=>({...f,formasPagto:f.formasPagto.map((x:any,i:number)=>i===idx?{...x,forma:e.target.value,cartao:null}:x)}))}>
                          {FORMAS.map(fo=><option key={fo}>{fo}</option>)}
                        </select>
                        <input className="form-input" style={{flex:1,fontFamily:"'JetBrains Mono',monospace",fontSize:12}} value={item.valor} placeholder="R$ 0,00"
                          onChange={e=>setBaixaRespForm((f:any)=>({...f,formasPagto:f.formasPagto.map((x:any,i:number)=>i===idx?{...x,valor:e.target.value}:x)}))}/>
                        {/* Botão Dados do Cartão */}
                        {(item.forma?.toLowerCase().includes('cartão')||item.forma?.toLowerCase().includes('cartao'))&&(
                          <button type="button"
                            style={{padding:'0 12px',height:36,borderRadius:8,border:'1px solid rgba(99,102,241,0.5)',background:item.cartao?'rgba(99,102,241,0.2)':'rgba(99,102,241,0.08)',color:'#818cf8',fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:5,transition:'all .15s'}}
                            onClick={()=>{setCartaoFormIdx(idx);setCartaoCtx('baixaResp');setCartaoForm(item.cartao||{bandeira:'Visa',numero:'',nome:'',validade:'',parcelas:'1',autorizacao:''});setModalCartao(true)}}
                            title="Informar dados do cartão"
                          >
                            💳 {item.cartao?.bandeira?<span style={{maxWidth:70,overflow:'hidden',textOverflow:'ellipsis'}}>{item.cartao.bandeira}</span>:'Cartão'}
                          </button>
                        )}
                        {baixaRespForm.formasPagto.length>1&&(
                          <button type="button" style={{width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:6,border:'none',background:'rgba(239,68,68,0.1)',cursor:'pointer',color:'#f87171',fontSize:16,flexShrink:0}}
                            onClick={()=>setBaixaRespForm((f:any)=>({...f,formasPagto:f.formasPagto.filter((_:any,i:number)=>i!==idx)}))}>×</button>
                        )}
                      </div>
                      {/* Mini-resumo do cartão selecionado */}
                      {item.cartao&&(
                        <div style={{marginTop:4,display:'flex',alignItems:'center',gap:6,padding:'4px 10px',borderRadius:6,background:'rgba(99,102,241,0.07)',border:'1px solid rgba(99,102,241,0.15)',fontSize:10}}>
                          <span style={{color:'#818cf8',fontWeight:700}}>💳 {item.cartao.bandeira}</span>
                          {item.cartao.ultimos&&<span style={{color:'hsl(var(--text-muted))'}}>•••• {item.cartao.ultimos}</span>}
                          {item.cartao.parcelas&&item.cartao.parcelas>1&&<span style={{color:'hsl(var(--text-muted))'}}>· {item.cartao.parcelas}x</span>}
                          {item.cartao.autorizacao&&<span style={{color:'hsl(var(--text-muted))'}}>· Auth: {item.cartao.autorizacao}</span>}
                          <button type="button" style={{marginLeft:4,fontSize:9,color:'#818cf8',background:'none',border:'none',cursor:'pointer',padding:0}} onClick={()=>{setCartaoFormIdx(idx);setCartaoCtx('baixaResp');setCartaoForm(item.cartao||{bandeira:'Visa',numero:'',nome:'',validade:'',parcelas:'1',autorizacao:''});setModalCartao(true)}}>✏ editar</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Alerta saldo */}
                {Math.abs(saldo)>0.01&&(
                  <div style={{padding:'14px 18px',borderRadius:12,background:saldo>0?'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(251,191,36,0.06))':'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(239,68,68,0.06))',border:`2px solid ${saldo>0?'rgba(245,158,11,0.4)':'rgba(239,68,68,0.4)'}`,display:'flex',alignItems:'center',gap:14}}>
                    <div style={{fontSize:28}}>{saldo>0?'⚠️':'❌'}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:800,fontSize:13,color:saldo>0?'#f59e0b':'#f87171'}}>{saldo>0?'Valor insuficiente':'Valor excedente'}</div>
                      <div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>{saldo>0?`Adicione mais R$ ${fmtMoeda(saldo)}`:`Excede em R$ ${fmtMoeda(-saldo)}`}</div>
                    </div>
                    <div style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:900,fontSize:22,color:saldo>0?'#f59e0b':'#f87171'}}>R$ {fmtMoeda(Math.abs(saldo))}</div>
                  </div>
                )}

                {/* Comprovante + Obs */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <F label="Nº Comprovante">
                    <input className="form-input" value={baixaRespForm.comprovante} onChange={e=>setBaixaRespForm((f:any)=>({...f,comprovante:e.target.value}))} placeholder="Ex: PIX-12345"/>
                  </F>
                  <F label="Observação">
                    <input className="form-input" value={baixaRespForm.obs} onChange={e=>setBaixaRespForm((f:any)=>({...f,obs:e.target.value}))} placeholder="Observações..."/>
                  </F>
                </div>

                {/* Totalizador */}
                <div style={{padding:'14px 18px',background:'rgba(16,185,129,0.07)',border:'2px solid rgba(16,185,129,0.25)',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div>
                    <div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>Total do pagamento ({selResp.length} parcelas)</div>
                    <div style={{fontSize:10,color:'hsl(var(--text-muted))',marginTop:2}}>Data: <strong style={{color:'hsl(var(--text-base))'}}>{baixaRespForm.dataPagto?new Date(baixaRespForm.dataPagto+'T12:00').toLocaleDateString('pt-BR'):'—'}</strong></div>
                  </div>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:900,fontSize:26,color:'#10b981'}}>R$ {fmtMoeda(totalBruto)}</div>
                </div>
              </div>

              {/* Footer */}
              <div style={{padding:'14px 24px',borderTop:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'space-between',gap:10,background:'hsl(var(--bg-elevated))',borderRadius:'0 0 20px 20px',flexShrink:0}}>
                <button className="btn btn-secondary" onClick={()=>setModalBaixaRespConfirm(false)}>← Voltar</button>
                <button className="btn btn-primary"
                  style={{background:'linear-gradient(135deg,#10b981,#059669)',fontWeight:800,boxShadow:'0 4px 12px rgba(16,185,129,0.3)',padding:'12px 28px',fontSize:14,borderRadius:12}}
                  disabled={!baixaRespForm.dataPagto||selResp.length===0||Math.abs(saldo)>0.01||!baixaRespForm.caixaId}
                  onClick={()=>{
                    const formaStr=baixaRespForm.formasPagto.map((f:any)=>f.forma).join('+')
                    const codBaixa='BR'+String(Date.now()).slice(-6)+String(Math.floor(Math.random()*100)).padStart(2,'0')
                    const nomeResp=todosResp.find((r:any)=>r.respFinanceiro)?.nome||''
                    // Resumo de todas as parcelas pagas nesta baixa (para comprovante cruzado)
                    const parcelasVinculadas=selResp.map((s:any)=>({
                      alunoNome: s.alunoNome||aluno.nome,
                      alunoId:  s.alunoId,
                      num:      s.num,
                      evento:   s.evento||'Mensalidade',
                      competencia: s.competencia||'',
                      valor:    s.valorFinal||s.valor||0,
                    }))
                    // Atualiza parcelas do próprio aluno
                    setParcelas(prev=>prev.map(p=>{
                      const foundSel=selResp.find((s:any)=>s.alunoId==='__novo__'&&s.num===p.num)
                      if(!foundSel||p.status==='pago') return p
                      return{...p,status:'pago',dtPagto:baixaRespForm.dataPagto,formaPagto:formaStr,comprovante:baixaRespForm.comprovante,obs:baixaRespForm.obs,codBaixa,formasPagto:baixaRespForm.formasPagto,baixaPorResponsavel:true,nomeResponsavel:nomeResp,parcelasVinculadas}
                    }))
                    // Atualiza parcelas dos outros alunos
                    if(selResp.some((s:any)=>s.alunoId!=='__novo__')){
                      setAlunos((prev:any[])=>prev.map((a:any)=>{
                        const alunoKey=a.id||a.cpf||a.nome
                        const parcsA=selResp.filter((s:any)=>s.alunoId===alunoKey)
                        if(parcsA.length===0) return a
                        return{...a,parcelas:(a.parcelas||[]).map((p:any)=>{
                          if(parcsA.some((s:any)=>s.num===p.num&&s.alunoId===alunoKey)&&p.status!=='pago')
                            return{...p,status:'pago',dtPagto:baixaRespForm.dataPagto,formaPagto:formaStr,comprovante:baixaRespForm.comprovante,obs:baixaRespForm.obs,codBaixa,formasPagto:baixaRespForm.formasPagto,baixaPorResponsavel:true,nomeResponsavel:nomeResp,parcelasVinculadas}
                          return p
                        })}
                      }))
                    }
                    setModalBaixaRespConfirm(false)
                    setModalBaixaResp(false)
                    setBaixaRespParcelas([])
                    // Espelhar no caixa como Movimentação Manual
                    if(baixaRespForm.caixaId){
                      const now=new Date().toISOString()
                      const nomeRespLog=nomeResp||'Responsável'
                      setMovimentacoesManuais((prev:any)=>[...prev,{
                        id:codBaixa,caixaId:baixaRespForm.caixaId,tipo:'receita',
                        fornecedorId:'',fornecedorNome:nomeRespLog,
                        descricao:`Baixa por Responsável — ${selResp.length} parcela${selResp.length!==1?'s':''} · ${nomeRespLog}`,
                        dataLancamento:baixaRespForm.dataPagto,dataMovimento:baixaRespForm.dataPagto,
                        valor:totalBruto,planoContasId:'',planoContasDesc:'',
                        tipoDocumento:'REC',numeroDocumento:codBaixa,dataEmissao:baixaRespForm.dataPagto,
                        compensadoBanco:false,observacoes:baixaRespForm.obs||'',
                        criadoEm:now,editadoEm:now,
                        origem:'baixa_aluno',referenciaId:codBaixa
                      }])
                    }
                    setToastMsg(`✅ ${selResp.length} parcela${selResp.length!==1?'s':''} baixada${selResp.length!==1?'s':''} com sucesso — R$ ${fmtMoeda(totalBruto)}`)
                    setTimeout(()=>setToastMsg(''),3500)
                  }}>
                  ✅ Confirmar Pagamento · R$ {fmtMoeda(totalBruto)}
                </button>
              </div>
            </div>
          </div>
        )
      })()}


    </div>,

    // STEP 5: Contratos
    <div key="s5">
      <div style={{padding:'12px 16px',background:'rgba(99,102,241,0.06)',border:'1px solid rgba(99,102,241,0.2)',borderRadius:10,marginBottom:16,fontSize:12}}>
        <strong style={{color:'#818cf8'}}>Passo 6 — Contratos &amp; Confirmação</strong> · Selecione documentos, gere e imprima antes de finalizar.
      </div>

      {/* Resumo */}
      {(()=>{
        const respPed=todosResp.filter(r=>r.respPedagogico)
        const respFin=todosResp.filter(r=>r.respFinanceiro)
        const totalParcelas=parcelas.filter(p=>p.status!=='cancelado')
        const totalBruto=totalParcelas.reduce((s,p)=>s+p.valor,0)
        const totalRecebido=parcelas.filter(p=>p.status==='pago').reduce((s,p)=>s+p.valorFinal,0)
        const eventos=[...new Set(parcelas.map(p=>(p as any).evento).filter(Boolean))]
        const turmaObj=turmas.find(t=>t.id===mat.turmaId)
        const CardRow=({k,v}:{k:string;v:string|number|undefined|null})=>(
          <div style={{display:'flex',justifyContent:'space-between',fontSize:11,padding:'4px 0',borderBottom:'1px solid hsl(var(--border-subtle))'}}>
            <span style={{color:'hsl(var(--text-muted))',fontWeight:500}}>{k}</span>
            <span style={{fontWeight:700,color:'hsl(var(--text-base))',textAlign:'right',maxWidth:'60%'}}>{v||'—'}</span>
          </div>
        )
        const Card=({title,children}:{title:string;children:React.ReactNode})=>(
          <div className="card" style={{padding:'14px 16px',borderRadius:14,border:'1px solid hsl(var(--border-subtle))',boxShadow:'0 2px 8px rgba(0,0,0,0.05)'}}>
            <div style={{fontWeight:800,fontSize:12,marginBottom:10,color:'hsl(var(--text-base))',letterSpacing:.3}}>{title}</div>
            <div style={{display:'flex',flexDirection:'column',gap:1}}>{children}</div>
          </div>
        )
        return(
          <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:16}}>
            {/* Linha 1: Aluno + Matrícula */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <Card title="👤 Aluno">
                <CardRow k="Nome"        v={aluno.nome}/>
                <CardRow k="CPF"         v={aluno.cpf}/>
                <CardRow k="Código"      v={aluno.codigo}/>
                <CardRow k="RGA"         v={rgaAluno}/>
                <CardRow k="Nascimento"  v={aluno.dataNasc}/>
                <CardRow k="Sexo"        v={aluno.sexo}/>
              </Card>
              <Card title="🎓 Matrícula">
                {(()=>{
                  // Usa o histórico mais recente (Cursando ou último) para obter curso/turno corretos
                  const histAtivo=historico.find(h=>h.situacao==='Cursando')||historico[historico.length-1]
                  const turmaHistObj=histAtivo?turmas.find(t=>t.id===histAtivo.turmaId):turmaObj
                  const cursoLabel=(turmaHistObj as any)?.serie||(turmaHistObj as any)?.nome||turmaObj?.nome
                  const turnoLabel=histAtivo?.turno||mat.turno||(turmaHistObj as any)?.turno
                  const dataMat=histAtivo?.dataMatricula
                    ?new Date(histAtivo.dataMatricula+'T12:00').toLocaleDateString('pt-BR')
                    :new Date().toLocaleDateString('pt-BR')
                  return(<>
                    <CardRow k="Nº"           v={numMatricula}/>
                    <CardRow k="Ano Letivo"   v={mat.anoLetivo}/>
                    <CardRow k="Tipo"         v={(()=>{
                      const temHist=isEdicao?(alunoEditando as any)?.historicoMatriculas?.length>0:historico.length>0
                      const auto=temHist?'Rematrícula':'Nova Matrícula'
                      if(mat.tipoMatricula==='nova') return 'Nova Matrícula'
                      if(mat.tipoMatricula==='rematricula') return 'Rematrícula'
                      return auto+' (auto)'
                    })()}/>
                    <CardRow k="Curso"        v={cursoLabel}/>
                    <CardRow k="Turno"        v={turnoLabel}/>
                    <CardRow k="Data Matrícula" v={dataMat}/>
                  </>)
                })()}
              </Card>
            </div>
            {/* Linha 2: Resp. Pedagógico + Resp. Financeiro + Financeiro */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
              <Card title="👩‍🏫 Resp. Pedagógico">
                {respPed.length>0?respPed.map((r,i)=>(
                  <div key={i}>
                    {i>0&&<div style={{height:6}}/>}
                    <CardRow k="Nome"          v={r.nome}/>
                    <CardRow k="CPF"           v={r.cpf}/>
                    <CardRow k="E-mail"        v={r.email}/>
                    <CardRow k="Celular"       v={r.celular}/>
                    <CardRow k="Profissão"    v={r.profissao}/>
                    <CardRow k="Naturalidade" v={r.naturalidade}/>
                    <CardRow k="UF"            v={r.uf}/>
                  </div>
                )):(
                  <div style={{fontSize:11,color:'hsl(var(--text-muted))',fontStyle:'italic'}}>Não informado</div>
                )}
              </Card>
              <Card title="💳 Resp. Financeiro">
                {respFin.length>0?respFin.map((r,i)=>(
                  <div key={i}>
                    {i>0&&<div style={{height:6}}/>}
                    <CardRow k="Nome"          v={r.nome}/>
                    <CardRow k="CPF"           v={r.cpf}/>
                    <CardRow k="E-mail"        v={r.email}/>
                    <CardRow k="Celular"       v={r.celular}/>
                    <CardRow k="Profissão"    v={r.profissao}/>
                    <CardRow k="Naturalidade" v={r.naturalidade}/>
                    <CardRow k="UF"            v={r.uf}/>
                  </div>
                )):(
                  <div style={{fontSize:11,color:'hsl(var(--text-muted))',fontStyle:'italic'}}>Não informado</div>
                )}
              </Card>
              <Card title="💰 Financeiro">
                {(()=>{
                  // Parcelas do padrão selecionado (filtradas pelo evento do padrão)
                  const nomeEvPadrao=padraoSel?.nome||'Mensalidade'
                  const parcelasPadrao=parcelas.filter(p=>p.status!=='cancelado'&&(p as any).evento===nomeEvPadrao)
                  const qtdParcelas=parcelasPadrao.length||parcelas.filter(p=>p.status!=='cancelado').length
                  const anuidade=parcelasPadrao.reduce((s,p)=>s+p.valor,0)||
                    parcelas.filter(p=>p.status!=='cancelado').reduce((s,p)=>s+p.valor,0)
                  // Vencimento da 2ª parcela (ou 1ª se só houver uma)
                  const sorted=[...parcelasPadrao].sort((a,b)=>a.num-b.num)
                  const vcto2=sorted.length>1?sorted[1].vencimento:sorted[0]?.vencimento
                  // Desconto total
                  const descontoTotal=parcelasPadrao.reduce((s,p)=>s+(p.desconto||0),0)
                  const pct=anuidade>0?((descontoTotal/anuidade)*100).toFixed(1):'0'
                  return (<>
                    <CardRow k="Evento"        v={nomeEvPadrao}/>
                    <CardRow k="Parcelas"      v={String(qtdParcelas)}/>
                    <CardRow k="Total Anuidade" v={'R$ '+fmtMoeda(anuidade)}/>
                    <CardRow k="Vencimento"    v={vcto2||('Dia '+fin.diaVencimento)}/>
                    <CardRow k="Bolsista"      v={fin.bolsista==='S'?'Sim':'Não'}/>
                    <CardRow k="Desconto"      v={descontoTotal>0?`R$ ${fmtMoeda(descontoTotal)} (${pct}%)`:grupoSel?.nome||'—'}/>
                  </>)
                })()}
              </Card>
            </div>
          </div>
        )
      })()}

      {/* ══ DOCUMENTOS & CONTRATOS ══ */}
      {(()=>{
        const docsAtivos = docModelos.filter(d => d.status === 'ativo')
        if (docsAtivos.length === 0) return (
          <div style={{marginBottom:16,padding:'16px 20px',background:'rgba(99,102,241,0.04)',border:'1px dashed rgba(99,102,241,0.25)',borderRadius:14,display:'flex',alignItems:'center',gap:14}}>
            <div style={{width:40,height:40,borderRadius:10,background:'rgba(99,102,241,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>📄</div>
            <div>
              <div style={{fontWeight:700,fontSize:13,marginBottom:3}}>Nenhum modelo de documento cadastrado</div>
              <div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>Crie modelos em <strong>Configurações → Pedagógico → Documentos Escolares</strong> para que apareçam aqui para geração rápida.</div>
            </div>
          </div>
        )
        const sorted = [...docsAtivos].sort((a,b) => {
          const isContA = a.tipo?.toLowerCase().includes('contrato') ? 0 : 1
          const isContB = b.tipo?.toLowerCase().includes('contrato') ? 0 : 1
          return isContA - isContB
        })
        const TIPO_COLORS: Record<string,string> = {
          'Contrato por Segmento':'#6366f1','Contrato Atividades Extras':'#8b5cf6',
          'Declaração de Matrícula':'#10b981','Declaração de Frequência':'#10b981',
          'Transferência':'#f59e0b','Personalizado':'#64748b',
        }
        const corTipo = (tipo:string) => TIPO_COLORS[tipo] || '#3b82f6'
        return (
          <div style={{marginBottom:16}}>
            <div style={{fontWeight:800,fontSize:13,marginBottom:10,display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:30,height:30,borderRadius:8,background:'linear-gradient(135deg,#6366f1,#8b5cf6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>📄</div>
              Documentos & Contratos
              <span style={{fontSize:10,padding:'2px 8px',borderRadius:12,background:'rgba(99,102,241,0.12)',color:'#818cf8',fontWeight:700}}>{docsAtivos.length} disponíveis</span>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {sorted.map(doc => (
                <div key={doc.id} style={{
                  display:'flex',alignItems:'center',gap:14,
                  padding:'12px 16px',borderRadius:12,
                  background:'hsl(var(--bg-elevated))',
                  border:'1px solid hsl(var(--border-subtle))',
                  transition:'all 0.18s',
                }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(99,102,241,0.35)';e.currentTarget.style.background='rgba(99,102,241,0.04)'}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='hsl(var(--border-subtle))';e.currentTarget.style.background='hsl(var(--bg-elevated))'}}>
                  <div style={{width:36,height:36,borderRadius:9,background:`${corTipo(doc.tipo)}15`,border:`1px solid ${corTipo(doc.tipo)}30`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>
                    {doc.tipo?.toLowerCase().includes('contrato')?'📋':doc.tipo?.toLowerCase().includes('declaração')||doc.tipo?.toLowerCase().includes('declaracao')?'📜':'📄'}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:13,marginBottom:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{doc.nome}</div>
                    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                      <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:`${corTipo(doc.tipo)}15`,color:corTipo(doc.tipo),fontWeight:700}}>{doc.tipo}</span>
                      {doc.segmento&&doc.segmento!=='Todos'&&<span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:'rgba(16,185,129,0.1)',color:'#10b981',fontWeight:700}}>{doc.segmento}</span>}
                      {doc.arquivoBase64&&<span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:'rgba(59,130,246,0.1)',color:'#3b82f6',fontWeight:700}}>📎 DOCX</span>}
                    </div>
                  </div>
                  {/* ── Área de ação 3 estados ── */}
                  {(()=>{
                    const st = docGenStatus[doc.id] || 'idle'
                    const cor = corTipo(doc.tipo)
                    if (st === 'idle') return (
                      <button type="button" onClick={()=>gerarDocumentoMatricula(doc)} style={{
                        display:'flex',alignItems:'center',gap:7,flexShrink:0,
                        padding:'9px 20px',borderRadius:10,cursor:'pointer',fontWeight:700,fontSize:12,
                        background:`linear-gradient(135deg,#6366f1,#8b5cf6)`,color:'#fff',border:'none',
                        boxShadow:'0 3px 14px rgba(99,102,241,0.4)',transition:'all 0.18s',
                      }}
                        onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.transform='translateY(-2px)';(e.currentTarget as HTMLButtonElement).style.boxShadow='0 6px 20px rgba(99,102,241,0.55)'}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.transform='translateY(0)';(e.currentTarget as HTMLButtonElement).style.boxShadow='0 3px 14px rgba(99,102,241,0.4)'}}
                      >
                        <span style={{fontSize:14}}>📄</span> Gerar Documento
                      </button>
                    )
                    if (st === 'generating') return (
                      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,flexShrink:0,minWidth:140}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,padding:'9px 20px',borderRadius:10,background:'rgba(99,102,241,0.08)',border:'1px solid rgba(99,102,241,0.2)'}}>
                          <style>{`@keyframes spin-doc{to{transform:rotate(360deg)}}@keyframes pulse-bar{0%,100%{opacity:0.4}50%{opacity:1}}`}</style>
                          <div style={{width:14,height:14,border:'2px solid #6366f1',borderTopColor:'transparent',borderRadius:'50%',animation:'spin-doc 0.8s linear infinite',flexShrink:0}}/>
                          <span style={{fontSize:12,fontWeight:700,color:'#6366f1',whiteSpace:'nowrap'}}>Gerando...</span>
                        </div>
                        <div style={{width:'100%',height:3,borderRadius:4,background:'rgba(99,102,241,0.1)',overflow:'hidden'}}>
                          <div style={{height:'100%',background:'linear-gradient(90deg,#6366f1,#8b5cf6)',borderRadius:4,animation:'pulse-bar 1s ease-in-out infinite',width:'70%'}}/>
                        </div>
                      </div>
                    )
                    // done
                    return (
                      <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6,flexShrink:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{fontSize:11,fontWeight:700,color:'#10b981',display:'flex',alignItems:'center',gap:4}}>
                            <span style={{fontSize:13}}>✅</span> Concluído!
                          </span>
                          <button type="button" onClick={()=>baixarDocumentoGerado(doc.id)} style={{
                            display:'flex',alignItems:'center',gap:6,
                            padding:'8px 18px',borderRadius:10,cursor:'pointer',fontWeight:700,fontSize:12,
                            background:`linear-gradient(135deg,${cor},${cor}cc)`,color:'#fff',border:'none',
                            boxShadow:`0 2px 10px ${cor}40`,transition:'all 0.15s',
                          }}
                            onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.transform='translateY(-1px)';(e.currentTarget as HTMLButtonElement).style.boxShadow=`0 5px 18px ${cor}55`}}
                            onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.transform='translateY(0)';(e.currentTarget as HTMLButtonElement).style.boxShadow=`0 2px 10px ${cor}40`}}
                          >
                            {doc.arquivoBase64 ? <Download size={13}/> : <Printer size={13}/>}
                            {doc.arquivoBase64 ? 'Baixar DOCX' : 'Abrir / Imprimir'}
                          </button>
                        </div>
                        <button type="button" onClick={()=>setDocGenStatus(p=>({...p,[doc.id]:'idle'}))} style={{fontSize:10,color:'hsl(var(--text-muted))',background:'none',border:'none',cursor:'pointer',padding:0,textDecoration:'underline'}}>
                          Gerar novamente
                        </button>
                      </div>
                    )
                  })()}
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      <div style={{padding:'14px 18px',background:'rgba(16,185,129,0.06)',border:'1px solid rgba(16,185,129,0.3)',borderRadius:12,display:'flex',alignItems:'center',gap:12}}>
        <CheckCircle size={24} color="#10b981"/>
        <div>
          <div style={{fontWeight:800,fontSize:14,color:'#10b981'}}>Tudo pronto para finalizar!</div>
          <div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>Clique em &quot;Finalizar Matricula&quot; para criar o aluno no sistema.</div>
        </div>
      </div>
    </div>
  ]

  if (!mounted) return null

  return (
    <div style={{minHeight:'100%',display:'flex',flexDirection:'column',paddingBottom:40}}>
      {/* Header */}
      {isEdicao && (
        <div style={{margin:'12px 32px 0',padding:'10px 16px',background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.3)',borderRadius:10,display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:16}}>✏️</span>
          <div>
            <div style={{fontWeight:800,fontSize:13,color:'#fbbf24'}}>Modo Edição — {(alunoEditando as any)?.nome}</div>
            <div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>Matrícula {(alunoEditando as any)?.matricula} · Atualize os dados abaixo e clique em Salvar.</div>
          </div>
        </div>
      )}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'20px 32px 0',marginBottom:20}}>
        <div>
          <h1 className="page-title" style={{margin:0}}>{isEdicao ? 'Editar Matrícula' : 'Nova Matricula'}</h1>
          <p className="page-subtitle" style={{margin:'2px 0 0'}} suppressHydrationWarning>
            {isEdicao ? `Editando dados de ${(alunoEditando as any)?.nome ?? ''}` : `Processo completo · 6 etapas · Matrícula ${numMatricula}`}
          </p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button className="btn btn-ghost btn-sm" style={{fontSize:12,color:'#10b981',border:'1px solid rgba(16,185,129,0.3)'}} onClick={handleFinalizar} disabled={salvando}>
            {salvando?<><Loader2 size={12} style={{animation:'spin 1s linear infinite'}}/>Salvando...</>:<><Check size={12}/>{isEdicao ? 'Salvar Alterações' : 'Concluir'}</>}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={()=>router.push('/academico/alunos')}><X size={13}/>Cancelar</button>
        </div>
      </div>

      {/* Premium Stepper */}
      <div style={{padding:'0 32px',marginBottom:32}}>
        <div style={{position:'relative',display:'flex',alignItems:'flex-start'}}>
          <div style={{
            position:'absolute',top:22,left:'calc(100%/12)',right:'calc(100%/12)',
            height:2,background:'hsl(var(--border-subtle))',zIndex:0,borderRadius:2,
          }}/>
          <div style={{
            position:'absolute',top:22,left:'calc(100%/12)',
            width:step===0?'0%':('calc((100% - 100%/6) * '+(step/(STEPS.length-1))+')'),
            height:2,zIndex:1,borderRadius:2,
            background:'linear-gradient(90deg,#10b981,#6366f1)',
            transition:'width 0.4s cubic-bezier(0.4,0,0.2,1)',
          }}/>
          {STEPS.map((s, i) => {
            const done = i < step
            const active = i === step
            const Icon = s.icon
            const colors = ['#6366f1','#3b82f6','#ec4899','#f59e0b','#8b5cf6','#64748b']
            const glows  = ['rgba(99,102,241,0.2)','rgba(59,130,246,0.2)','rgba(236,72,153,0.2)','rgba(245,158,11,0.2)','rgba(139,92,246,0.2)','rgba(100,116,139,0.2)']
            const grads  = [
              'linear-gradient(135deg,#6366f1,#818cf8)',
              'linear-gradient(135deg,#3b82f6,#60a5fa)',
              'linear-gradient(135deg,#ec4899,#f472b6)',
              'linear-gradient(135deg,#f59e0b,#fbbf24)',
              'linear-gradient(135deg,#8b5cf6,#a78bfa)',
              'linear-gradient(135deg,#475569,#94a3b8)',
            ]
            const c = colors[i] || '#6366f1'
            const g = glows[i]  || 'rgba(99,102,241,0.2)'
            const gr = grads[i] || grads[0]
            return (
              <div
                key={i}
                style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:8,zIndex:2,cursor:'pointer',position:'relative'}}
                onClick={() => setStep(i)}
              >
                <div style={{
                  width:44,height:44,borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',
                  position:'relative',flexShrink:0,
                  background: done ? 'linear-gradient(135deg,#10b981,#059669)' : active ? gr : 'hsl(var(--bg-elevated))',
                  border: (!done&&!active) ? '2px solid hsl(var(--border-subtle))' : 'none',
                  boxShadow: active ? ('0 0 0 5px '+g+', 0 8px 20px rgba(0,0,0,0.14)') : done ? '0 4px 12px rgba(16,185,129,0.25)' : 'none',
                  transition:'all 0.3s cubic-bezier(0.4,0,0.2,1)',
                  transform: active ? 'scale(1.12)' : 'scale(1)',
                }}>
                  {done ? <Check size={18} color="#fff" strokeWidth={3}/> : active ? <Icon size={18} color="#fff"/> : <span style={{fontSize:13,fontWeight:700,color:'hsl(var(--text-muted))',fontFamily:'Outfit,sans-serif'}}>{i+1}</span>}
                  {active && (
                    <div style={{
                      position:'absolute',inset:-7,borderRadius:20,
                      border:('2px solid '+c+'66'),
                      animation:'stepPulse 2s ease-in-out infinite',
                      pointerEvents:'none',
                    }}/>
                  )}
                </div>
                <div style={{textAlign:'center'}}>
                  <div style={{
                    fontSize:10,lineHeight:1.3,
                    fontWeight: active ? 800 : done ? 600 : 400,
                    color: active ? c : done ? '#10b981' : 'hsl(var(--text-muted))',
                    transition:'color 0.25s',
                  }}>{s.label}</div>
                  {done && <div style={{fontSize:9,color:'rgba(16,185,129,0.7)',marginTop:2,fontWeight:600}}>✓ ok</div>}
                  {active && <div style={{width:14,height:2,borderRadius:1,margin:'3px auto 0',background:c}}/>}
                </div>
              </div>
            )
          })}
        </div>
        <style>{'@keyframes stepPulse{0%,100%{opacity:0.55;transform:scale(1)}50%{opacity:0.15;transform:scale(1.09)}}'}</style>
      </div>

      {/* Content */}
      <div style={{flex:1,padding:'0 32px'}}>{stepContent[step]}</div>

      {/* Bottom Nav */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:24,padding:'16px 32px 0',borderTop:'1px solid hsl(var(--border-subtle))'}}>
        <button className="btn btn-secondary" disabled={step===0} onClick={()=>setStep(s=>s-1)}><ChevronLeft size={15}/>Anterior</button>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <span style={{fontSize:11,color:'hsl(var(--text-muted))'}}>Etapa {step+1} de {STEPS.length}</span>
          <button className="btn btn-ghost btn-sm" style={{fontSize:12,color:'#10b981',border:'1px solid rgba(16,185,129,0.3)',padding:'5px 14px'}} onClick={handleFinalizar} disabled={salvando}>
            {salvando?<><Loader2 size={12} style={{animation:'spin 1s linear infinite'}}/>Salvando...</>:<><Check size={12}/>Concluir e Salvar</>}
          </button>
        </div>
        {step<STEPS.length-1
          ? <button className="btn btn-primary" onClick={()=>setStep(s=>s+1)}>Proximo<ChevronRight size={15}/></button>
          : <button className="btn btn-primary" disabled={salvando} onClick={handleFinalizar} style={{background:'linear-gradient(135deg,#10b981,#059669)'}}>
              {salvando?<><Loader2 size={13} style={{animation:'spin 1s linear infinite'}}/>Salvando...</>:<><Check size={13}/>Finalizar Matricula</>}
            </button>
        }
      </div>
      {toastMsg && (
        <div style={{position:'fixed',bottom:32,right:32,background:'linear-gradient(135deg,#10b981,#059669)',color:'#fff',padding:'14px 24px',borderRadius:12,boxShadow:'0 10px 40px rgba(16,185,129,0.4)',zIndex:9999,fontWeight:700,fontSize:14,display:'flex',alignItems:'center',gap:10}}>
          {toastMsg}
        </div>
      )}
      {autoSaveMsg && (
        <div style={{
          position:'fixed',bottom:32,left:32,
          background:'hsl(var(--bg-elevated))',
          border:'1px solid rgba(16,185,129,0.35)',
          color:'#10b981',
          padding:'10px 18px',borderRadius:10,
          boxShadow:'0 6px 24px rgba(0,0,0,0.25)',
          zIndex:9998,fontWeight:700,fontSize:12,
          display:'flex',alignItems:'center',gap:8,
          animation:'fadeInUp 0.2s ease',
        }}>
          {autoSaveMsg}
        </div>
      )}
    </div>
  )
}
