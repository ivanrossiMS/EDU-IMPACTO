'use client'
import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useData, newId } from '@/lib/dataContext'

import {
  User, MapPin, Layers, Users, Baby, Heart, GraduationCap, DollarSign, FileText,
  Check, ChevronRight, ChevronLeft, AlertCircle, CheckCircle,
  Copy, Plus, PlusCircle, Loader2, X, Search, Printer, Download, Eye, Pencil, Camera, Receipt, Trash2
} from 'lucide-react'
import { ModalEmitirAluno }     from '@/app/(app)/financeiro/boletos/components/ModalEmitirAluno'
import { ModalHistoricoBoletos } from '@/app/(app)/financeiro/boletos/components/ModalHistoricoBoletos'
import { Modal2aVia }            from '@/app/(app)/financeiro/boletos/components/Modal2aVia'
import { ReceiptModal }          from '@/components/financeiro/ReceiptModal'
import dynamic from 'next/dynamic'
const ExtratoModal = dynamic(() => import('@/components/financeiro/ExtratoModal'), { ssr: false })

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
const fmtDateMask = (v: string) => {
  let r = v.replace(/\D/g, '').slice(0, 8)
  if (r.length >= 5) return `${r.slice(0, 2)}/${r.slice(2, 4)}/${r.slice(4)}`
  if (r.length >= 3) return `${r.slice(0, 2)}/${r.slice(2)}`
  return r
}
const calcIdade = (nasc: string) => {
  if (!nasc || nasc.length < 10) return ''
  let y, m, d;
  if (nasc.includes('/')) { [d, m, y] = nasc.split('/') } else { [y, m, d] = nasc.split('-') }
  const n = new Date(+y, +m - 1, +d)
  const hoje = new Date()
  if (isNaN(n.getTime())) return ''
  let age = hoje.getFullYear() - n.getFullYear()
  if (hoje.getMonth() < n.getMonth() || (hoje.getMonth() === n.getMonth() && hoje.getDate() < n.getDate())) age--
  return age >= 0 && age < 130 ? `${age} anos` : ''
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
const ultraInputStyle = { borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', padding: '14px 16px', fontSize: 14, fontWeight: 600, color: '#0f172a', width: '100%', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.025)', outline: 'none', transition: 'all 0.2s' }

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:6}}>
      <label style={{fontSize:10,fontWeight:800,color:'#64748b',textTransform:'uppercase',letterSpacing:0.8,paddingLeft:2}}>{label}</label>
      {children}
    </div>
  )
}

function CPFInput({ value, onChange, existentes }: { value: string; onChange: (v:string)=>void; existentes: string[] }) {
  const raw = value.replace(/\D/g,''); const ok = raw.length===11 && validarCPF(raw) && !existentes.some(c=>c.replace(/\D/g,'')===raw)
  const invalid = raw.length===11 && !validarCPF(raw); const dup = raw.length===11 && validarCPF(raw) && existentes.some(c=>c.replace(/\D/g,'')===raw)
  const currentBorder = raw.length===11 ? (ok?'rgba(16,185,129,0.5)':'rgba(239,68,68,0.5)') : ultraInputStyle.border;
  const currentBg = raw.length===11 ? (ok?'rgba(16,185,129,0.02)':'rgba(239,68,68,0.02)') : ultraInputStyle.background;
  
  return (
    <div style={{position:'relative'}}>
      <input style={{...ultraInputStyle, paddingRight:32, borderColor: currentBorder, background: currentBg}} value={value} onChange={e=>onChange(fmtCPF(e.target.value))} placeholder="000.000.000-00" />
      {raw.length===11 && (ok ? <CheckCircle size={16} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',color:'#10b981'}} />
        : <AlertCircle size={16} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',color:'#ef4444'}} />)}
      {invalid && <div style={{fontSize:10,color:'#f87171',marginTop:4,paddingLeft:4,fontWeight:700}}>CPF inválido</div>}
      {dup && <div style={{fontSize:10,color:'#f87171',marginTop:4,paddingLeft:4,fontWeight:700}}>CPF já cadastrado</div>}
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
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <div style={{display:'grid',gridTemplateColumns:'150px minmax(200px, 1fr) 110px',gap:20}}>
        <F label="CEP"><div style={{position:'relative'}}><input style={ultraInputStyle} value={end.cep} onChange={e=>handleCEP(e.target.value)} placeholder="00000-000"/>{loading&&<Loader2 size={12} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',animation:'spin 1s linear infinite',color:'#64748b'}}/>}</div></F>
        <F label="Logradouro"><input style={ultraInputStyle} value={end.logradouro} onChange={e=>upd('logradouro')(e.target.value)}/></F>
        <F label="Nº"><input style={ultraInputStyle} value={end.numero} onChange={e=>upd('numero')(e.target.value)}/></F>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'160px minmax(180px, 1fr) minmax(180px, 1fr) 110px',gap:20}}>
        <F label="Complemento"><input style={ultraInputStyle} value={end.complemento} onChange={e=>upd('complemento')(e.target.value)} placeholder="Apto..."/></F>
        <F label="Bairro"><input style={ultraInputStyle} value={end.bairro} onChange={e=>upd('bairro')(e.target.value)}/></F>
        <F label="Cidade"><input style={ultraInputStyle} value={end.cidade} onChange={e=>upd('cidade')(e.target.value)}/></F>
        <F label="UF"><select style={ultraInputStyle} value={end.estado} onChange={e=>upd('estado')(e.target.value)}><option value=""></option>{UFS.map(u=><option key={u}>{u}</option>)}</select></F>
      </div>
    </div>
  )
}

function RespCard({ resp, onChange, cpfExistentes, allResps = [], onRemove }: { resp: Resp; onChange:(r:Resp)=>void; cpfExistentes:string[]; allResps?: Resp[]; onRemove?: ()=>void }) {
  const [open, setOpen] = useState(true)
  const [buscarOpen, setBuscarOpen] = useState(false)
  const [buscarQ, setBuscarQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    setIsSearching(true)
    const timeout = setTimeout(() => {
      setDebouncedQ(buscarQ)
      setIsSearching(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [buscarQ])

  const u = (k: keyof Resp, v: any) => onChange({...resp,[k]:v})
  const labels: Record<string,string> = { mae:'👩 Mãe', pai:'👨 Pai', outro1:'👤 Outro 1', outro2:'👤 Outro 2' }
  const cpfOk = resp.cpf.replace(/\D/g,'').length===11 && validarCPF(resp.cpf.replace(/\D/g,''))

  const respsFiltrados = useMemo(() => {
    if (debouncedQ.length < 3) return []
    
    const norm = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    const rawSearch = debouncedQ.replace(/\s+/g, ' ').trim()
    const searchTerms = norm(rawSearch).split(' ')
    const searchNumber = debouncedQ.replace(/\D/g, '')

    const matches = allResps.reduce((acc, r) => {
       if (!r.nome) return acc
       const normN = norm(r.nome)
       const rCpf = (r.cpf || '').replace(/\D/g, '')
       const rCel = (r.celular || '').replace(/\D/g, '')

       const nameMatch = searchTerms.every(term => normN.includes(term))
       const numMatch = searchNumber && (rCpf.includes(searchNumber) || rCel.includes(searchNumber))

       if (nameMatch || numMatch) {
         let score = 0
         if (normN.startsWith(norm(rawSearch))) score += 10
         else if (normN.includes(norm(rawSearch))) score += 5
         else if (nameMatch) score += 2
         
         if (numMatch) score += 8
         
         acc.push({ item: r, score })
       }
       return acc
    }, [] as {item: Resp, score: number}[])

    return matches.sort((a,b) => b.score - a.score).slice(0, 15).map(m => m.item)
  }, [allResps, debouncedQ])

  const selecionarResp = (r: Resp) => {
    onChange({ ...resp, nome: r.nome, cpf: r.cpf, rg: r.rg, orgEmissor: r.orgEmissor,
      sexo: r.sexo, dataNasc: r.dataNasc, estadoCivil: r.estadoCivil, celular: r.celular,
      email: r.email, profissao: r.profissao, naturalidade: r.naturalidade, uf: r.uf,
      nacionalidade: r.nacionalidade, obs: r.obs, endereco: { ...r.endereco } })
    setBuscarOpen(false); setBuscarQ(''); setOpen(true)
  }
  return (
    <div style={{marginBottom:24,border:'1px solid hsl(var(--border-subtle))',borderRadius:16,background:'hsl(var(--bg-base))',overflow:'visible',boxShadow:'0 10px 40px -10px rgba(0,0,0,0.08)'}}>
      {/* ── HEADER DARK ── */}
      <div style={{
           padding:'18px 24px', 
           background: '#1c2938',
           display:'flex', alignItems:'center', justifyContent:'space-between',
           cursor:'pointer', borderBottom:open?'1px solid rgba(255,255,255,0.08)':'none',
           borderTopLeftRadius:15, borderTopRightRadius:15,
           borderBottomLeftRadius:open?0:15, borderBottomRightRadius:open?0:15,
           color:'#fff', transition:'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
           boxShadow: open ? 'none' : '0 8px 30px rgba(0,0,0,0.15)'
      }} onClick={()=>setOpen(!open)}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontWeight:800,fontSize:15,color:'#f8fafc',letterSpacing:0.5}}>{labels[resp.tipo]}</span>
          <code suppressHydrationWarning style={{fontSize:11,background:'rgba(255,255,255,0.08)',padding:'2px 8px',borderRadius:6,color:'#cbd5e1',border:'1px solid rgba(255,255,255,0.15)',fontWeight:600}}>{resp.codigo}</code>
          {resp.nome && <span style={{fontSize:14,color:'#94a3b8',fontWeight:500,marginLeft:4}}>{resp.nome}</span>}
          {cpfOk && <div style={{background:'rgba(16,185,129,0.15)',borderRadius:'50%',padding:2,marginLeft:4}}><CheckCircle size={15} color="#34d399"/></div>}
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}} onClick={e=>e.stopPropagation()}>
          {resp.respPedagogico&&<span style={{fontSize:11,padding:'4px 10px',borderRadius:8,background:'rgba(99,102,241,0.2)',border:'1px solid rgba(99,102,241,0.4)',color:'#a5b4fc',fontWeight:800,display:'flex',alignItems:'center',gap:4}}><Check size={12}/> Pedagógico</span>}
          {resp.respFinanceiro&&<span style={{fontSize:11,padding:'4px 10px',borderRadius:8,background:'rgba(16,185,129,0.2)',border:'1px solid rgba(16,185,129,0.4)',color:'#6ee7b7',fontWeight:800,display:'flex',alignItems:'center',gap:4}}><Check size={12}/> Financeiro</span>}
          {/* ── Botão Buscar Responsável ── */}
          <div style={{position:'relative',marginLeft:8}}>
            <div style={{display:'flex',gap:8}}>
              <button
                type="button"
                onClick={()=>{setBuscarOpen(v=>!v);setBuscarQ('')}}
                title="Buscar responsável já cadastrado"
                style={{display:'flex',alignItems:'center',gap:6,padding:'6px 14px',borderRadius:8,border:'1px solid rgba(255,255,255,0.15)',background:buscarOpen?'rgba(255,255,255,0.15)':'rgba(255,255,255,0.05)',cursor:'pointer',fontSize:12,fontWeight:700,color:'#f8fafc',transition:'all .15s'}}
              >
                <Search size={14} color="#94a3b8"/> Buscar
              </button>
              {onRemove && (
                <button
                  type="button"
                  onClick={e=>{e.stopPropagation(); onRemove()}}
                  title="Remover este responsável"
                  style={{display:'flex',alignItems:'center',justifyContent:'center',width:28,height:28,borderRadius:8,border:'1px solid rgba(239,68,68,0.3)',background:'rgba(239,68,68,0.1)',cursor:'pointer',transition:'all .15s',color:'#fca5a5'}}
                >
                  <Trash2 size={14}/>
                </button>
              )}
            </div>
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
                  ) : isSearching ? (
                    <div style={{padding:'20px 16px',color:'hsl(var(--text-muted))',fontSize:12,display:'flex',justifyContent:'center',alignItems:'center',gap:8}}>
                      <Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/> Buscando...
                    </div>
                  ) : respsFiltrados.length===0 ? (
                    <div style={{padding:'20px 16px',textAlign:'center',color:'hsl(var(--text-muted))',fontSize:12}}>
                      Nenhum resultado encontrado.
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
        <div className="ultra-form-panel" style={{
          padding:'32px', display:'flex', flexDirection:'column', gap:32, 
          background: '#ffffff', borderRadius: '0 0 16px 16px', 
          boxShadow: '0 18px 48px rgba(0,0,0,0.06), 0 4px 14px rgba(0,0,0,0.04)', 
          border: '1px solid rgba(0,0,0,0.04)', borderTop: 'none'
        }}>
          {/* Identificação Bloco */}
          <div style={{display:'flex', flexDirection:'column', gap:20}}>
            <h4 style={{fontSize:12, fontWeight:800, color:'#b4c6db', textTransform:'uppercase', letterSpacing:1.5, borderBottom:'1px solid #f1f5f9', paddingBottom:10}}>Identificação e Documentos</h4>
            <div style={{display:'flex',flexWrap:'wrap',gap:20}}>
              <div style={{flex:2,minWidth:250}}><F label="Nome Completo"><input style={ultraInputStyle} value={resp.nome} onChange={e=>u('nome',e.target.value)}/></F></div>
              <div style={{flexShrink:0,width:170}}><F label="CPF"><CPFInput value={resp.cpf} onChange={v=>u('cpf',v)} existentes={cpfExistentes}/></F></div>
              <div style={{flexShrink:0,width:150}}><F label="Sexo"><select style={ultraInputStyle} value={resp.sexo} onChange={e=>u('sexo',e.target.value)}><option value="">Selecione</option>{SEXOS.map(s=><option key={s}>{s}</option>)}</select></F></div>
              <div style={{flex:1,minWidth:170}}><F label="Data de Nascimento"><input style={ultraInputStyle} type="text" placeholder="DD/MM/AAAA" maxLength={10} value={resp.dataNasc} onChange={e=>u('dataNasc',fmtDateMask(e.target.value))}/></F></div>
              <div style={{flexShrink:0,width:180}}><F label="Estado Civil"><select style={ultraInputStyle} value={resp.estadoCivil} onChange={e=>u('estadoCivil',e.target.value)}><option value="">Selecione</option>{ESTADOS_CIVIS.map(s=><option key={s}>{s}</option>)}</select></F></div>
            </div>
            
            <div style={{display:'flex',flexWrap:'wrap',gap:20}}>
              <div style={{flexShrink:0,width:160}}><F label="RG"><input style={ultraInputStyle} value={resp.rg} onChange={e=>u('rg',e.target.value)}/></F></div>
              <div style={{flexShrink:0,width:120}}><F label="Org. Emissor RG"><input style={ultraInputStyle} value={resp.orgEmissor} onChange={e=>u('orgEmissor',e.target.value)} placeholder="SSP/SP"/></F></div>
              <div style={{flex:2,minWidth:250}}><F label="Profissão"><input style={ultraInputStyle} value={resp.profissao} onChange={e=>u('profissao',e.target.value)}/></F></div>
              <div style={{flex:2,minWidth:200}}><F label="Naturalidade"><input style={ultraInputStyle} value={resp.naturalidade} onChange={e=>u('naturalidade',e.target.value)}/></F></div>
              <div style={{flexShrink:0,width:90}}><F label="UF"><select style={ultraInputStyle} value={resp.uf} onChange={e=>u('uf',e.target.value)}><option value=""></option>{UFS.map(u=><option key={u}>{u}</option>)}</select></F></div>
              <div style={{flex:2,minWidth:180}}><F label="Nacionalidade"><input style={ultraInputStyle} value={resp.nacionalidade} onChange={e=>u('nacionalidade',e.target.value)}/></F></div>
            </div>
            {(resp.tipo==='outro1'||resp.tipo==='outro2') && (
              <div style={{display:'flex',flexWrap:'wrap',gap:20}}>
                <div style={{flex:1}}><F label="Parentesco"><input style={ultraInputStyle} value={resp.parentesco} onChange={e=>u('parentesco',e.target.value)} placeholder="Avó, Tio..."/></F></div>
              </div>
            )}
          </div>

          {/* Contato Bloco */}
          <div style={{display:'flex', flexDirection:'column', gap:20}}>
            <h4 style={{fontSize:12, fontWeight:800, color:'#b4c6db', textTransform:'uppercase', letterSpacing:1.5, borderBottom:'1px solid #f1f5f9', paddingBottom:10}}>Contato e Localização</h4>
            
            <div style={{display:'flex',flexWrap:'wrap',gap:20}}>
              <div style={{flexShrink:0,width:200}}><F label="Celular Principal"><input style={ultraInputStyle} value={resp.celular} onChange={e=>u('celular',fmtPhone(e.target.value))}/></F></div>
              <div style={{flex:2,minWidth:250}}><F label="E-mail Pessoal ou Empresarial"><input style={ultraInputStyle} type="email" value={resp.email} onChange={e=>u('email',e.target.value)}/></F></div>
              <div style={{flex:3,minWidth:300}}><F label="Observações Cadastrais"><input style={ultraInputStyle} value={resp.obs} onChange={e=>u('obs',e.target.value)} placeholder="Detalhes de saúde, restrições ou horários..."/></F></div>
            </div>
            
            <EnderecoSection end={resp.endereco} onChange={e=>onChange({...resp,endereco:e})}/>
          </div>

          {/* Responsabilidades */}
          <div style={{display:'grid',gridTemplateColumns:'minmax(auto, 1fr) minmax(auto, 1fr)',gap:20,marginTop:12}}>
            <label style={{
              display:'flex',alignItems:'center',gap:18,padding:'24px',borderRadius:16,cursor:'pointer',
              border:`2px solid ${resp.respPedagogico ? '#6366f1' : '#e2e8f0'}`,
              background: resp.respPedagogico ? 'linear-gradient(135deg, rgba(99,102,241,0.06), #fff)' : '#f8fafc',
              boxShadow: resp.respPedagogico ? '0 12px 30px rgba(99,102,241,0.12)' : 'none',
              transition:'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
              <div style={{width:28,height:28,borderRadius:10,border:resp.respPedagogico?'none':'2px solid #cbd5e1',background:resp.respPedagogico?'#6366f1':'#fff',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.3s',flexShrink:0,boxShadow:resp.respPedagogico?'0 4px 10px rgba(99,102,241,0.3)':'none'}}>
                 {resp.respPedagogico && <Check size={18} color="#fff" strokeWidth={3.5}/>}
              </div>
              <input type="checkbox" style={{display:'none'}} checked={resp.respPedagogico} onChange={e=>u('respPedagogico',e.target.checked)} />
              <div style={{display:'flex',flexDirection:'column',justifyContent:'center'}}>
                 <span style={{color:resp.respPedagogico?'#4f46e5':'#475569',fontWeight:800,fontSize:15,lineHeight:1.3}}>🎯 Responsável Pedagógico</span>
                 <span style={{fontSize:12,color:'#8492a6',marginTop:4,lineHeight:1.3}}>Detentor dos direitos e acessos acadêmicos para aulas, reuniões e rotina escolar da criança.</span>
              </div>
            </label>
            <label style={{
              display:'flex',alignItems:'center',gap:18,padding:'24px',borderRadius:16,cursor:'pointer',
              border:`2px solid ${resp.respFinanceiro ? '#10b981' : '#e2e8f0'}`,
              background: resp.respFinanceiro ? 'linear-gradient(135deg, rgba(16,185,129,0.06), #fff)' : '#f8fafc',
              boxShadow: resp.respFinanceiro ? '0 12px 30px rgba(16,185,129,0.12)' : 'none',
              transition:'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
              <div style={{width:28,height:28,borderRadius:10,border:resp.respFinanceiro?'none':'2px solid #cbd5e1',background:resp.respFinanceiro?'#10b981':'#fff',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.3s',flexShrink:0,boxShadow:resp.respFinanceiro?'0 4px 10px rgba(16,185,129,0.3)':'none'}}>
                 {resp.respFinanceiro && <Check size={18} color="#fff" strokeWidth={3.5}/>}
              </div>
              <input type="checkbox" style={{display:'none'}} checked={resp.respFinanceiro} onChange={e=>u('respFinanceiro',e.target.checked)} />
              <div style={{display:'flex',flexDirection:'column',justifyContent:'center'}}>
                 <span style={{color:resp.respFinanceiro?'#059669':'#475569',fontWeight:800,fontSize:15,lineHeight:1.3}}>💵 Responsável Financeiro</span>
                 <span style={{fontSize:12,color:'#8492a6',marginTop:4,lineHeight:1.3}}>Titular responsável pela assinatura de contratos, cobranças e obrigações monetárias.</span>
              </div>
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
        <div style={{display:'flex',gap:8}}>
          <input style={{...ultraInputStyle, flex:1}} value={value} onChange={e=>onChange(e.target.value)} placeholder="Nome do responsável"/>
          <button type="button" style={{padding:'0 16px',background:'#6366f1',color:'#fff',border:'none',borderRadius:12,cursor:'pointer',boxShadow:'0 4px 12px rgba(99,102,241,0.3)',transition:'all 0.2s',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setOpen(!open)} title="Buscar responsável" onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='#4f46e5'} onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='#6366f1'}><Search size={16}/></button>
        </div>
      </F>
      {open && (
        <div style={{position:'absolute',top:'calc(100% + 8px)',left:0,right:0,zIndex:100,background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,boxShadow:'0 12px 40px rgba(0,0,0,0.12)',maxHeight:250,overflowY:'auto',padding:8}}>
          <div style={{padding:'4px 4px 10px'}}>
            <input style={{...ultraInputStyle, padding:'10px 14px', fontSize:13}} placeholder="Filtrar por nome ou código..." value={q} onChange={e=>setQ(e.target.value)} autoFocus />
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            {filtered.map(r=>(
              <div key={r.id} style={{padding:'10px 12px',cursor:'pointer',borderRadius:10,transition:'background 0.2s',display:'flex',flexDirection:'column',gap:4}} onClick={()=>{onChange(r.nome); setOpen(false); setQ('')}} onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='#f8fafc'} onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                <div style={{fontSize:13,fontWeight:700,color:'#0f172a'}}>{r.nome}</div>
                <div style={{fontSize:11,color:'#64748b',display:'flex',alignItems:'center',gap:6}}>
                  <code style={{background:'#e2e8f0',padding:'2px 6px',borderRadius:6,fontWeight:600}}>{r.codigo}</code> <span style={{width:4,height:4,borderRadius:'50%',background:'#cbd5e1'}}/> {r.parentesco}
                </div>
              </div>
            ))}
            {filtered.length===0 && <div style={{padding:'20px',fontSize:12,color:'#94a3b8',textAlign:'center',fontWeight:600}}>Nenhum responsável encontrado</div>}
          </div>
        </div>
      )}
    </div>
  )
}

const STEPS = [
  {label:'Responsaveis',icon:Users},{label:'Dados do Aluno',icon:Baby},{label:'Saude & Obs',icon:Heart},
  {label:'Matricula',icon:GraduationCap},{label:'Financeiro',icon:DollarSign},{label:'Contratos',icon:FileText}
]

import { useConfigDb } from '@/lib/useConfigDb'

// --- MAIN ---
export default function NovaMatriculaPage() {
  const genCodigo = () => String(Math.floor(100000 + Math.random() * 900000))
  const router = useRouter()
  const { alunos: _alunos, setAlunos, titulos: _titulos, setTitulos, turmas: _turmas, cfgGruposDesconto: _cfgGruposDesc, cfgEventos: _cfgEventos, cfgMetodosPagamento: _cfgMetodos, cfgCartoes: _cfgCartoes, cfgConvenios, setCfgConvenios, cfgSituacaoAluno: _cfgSituacao, cfgTurnos: _cfgTurnos, cfgGruposAlunos: _cfgGruposAlunos, caixasAbertos, setCaixasAbertos, movimentacoesManuais, setMovimentacoesManuais, logSystemAction, cfgNiveisEnsino: _cfgNiveis } = useData()
  const alunos = Array.isArray(_alunos) ? _alunos : []
  const titulos = Array.isArray(_titulos) ? _titulos : []
  const turmas = Array.isArray(_turmas) ? _turmas : []
  
  const { data: cfgPadroesPagamento } = useConfigDb<any>('cfgPadroesPagamento')
  const cfgGruposDesconto = Array.isArray(_cfgGruposDesc) ? _cfgGruposDesc : []
  const cfgEventos = Array.isArray(_cfgEventos) ? _cfgEventos : []
  const cfgMetodosPagamento = Array.isArray(_cfgMetodos) ? _cfgMetodos : []
  const cfgCartoes = Array.isArray(_cfgCartoes) ? _cfgCartoes : []
  const cfgSituacaoAluno = Array.isArray(_cfgSituacao) ? _cfgSituacao : []
  const cfgTurnos = Array.isArray(_cfgTurnos) ? _cfgTurnos : []
  const cfgNiveisEnsino = Array.isArray(_cfgNiveis) ? _cfgNiveis : []
  const cfgGruposAlunos = Array.isArray(_cfgGruposAlunos) ? _cfgGruposAlunos : []

  const SEGMENTOS = useMemo(() => {
    if (!cfgNiveisEnsino || cfgNiveisEnsino.length === 0) return [
      { codigo: 'EI', nome: 'Educação Infantil' }, 
      { codigo: 'EF1', nome: 'Ensino F. I' }, 
      { codigo: 'EF2', nome: 'Ensino F. II' }, 
      { codigo: 'EM', nome: 'Ensino Médio' }, 
      { codigo: 'EJA', nome: 'EJA' }
    ]
    return cfgNiveisEnsino.filter((n: any) => n.situacao === 'ativo').map((n: any) => ({ codigo: n.codigo, nome: n.nome }))
  }, [cfgNiveisEnsino])

  // Resolve se uma situação de histórico representa matrícula ativa ou encerrada
  // Prioridade: lê de cfgSituacaoAluno (configurável), fallback por nome para robustez
  const SITUACOES_ATIVAS_FALLBACK = new Set(['Cursando', 'Prog. Continuada', 'Prog.Continuada', 'Em Curso', 'Rematrícula'])
  const isMatriculaAtiva = (situacaoNome: string): boolean => {
    const cfg = cfgSituacaoAluno.find(s => s.nome === situacaoNome || s.codigo === situacaoNome)
    if (cfg) return cfg.matriculaAtiva ?? SITUACOES_ATIVAS_FALLBACK.has(situacaoNome)
    return SITUACOES_ATIVAS_FALLBACK.has(situacaoNome)
  }

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

  const sourceAlunos = Array.isArray(alunos) ? alunos : []
  const alunoEditando = editId ? sourceAlunos.find((a: any) => String(a.codigo) === String(editId) || String(a.id) === String(editId)) ?? null : null
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
    setAluno(prev => ({ 
       ...prev, 
       codigo: a.codigo || prev.codigo,
       rga: a.rga || prev.rga,
       cpf: a.cpf || '', 
       nome: a.nome || '', 
       dataNasc: a.dataNascimento || '', 
       sexo: a.sexo || '', 
       estadoCivil: a.estadoCivil || '', 
       nacionalidade: a.nacionalidade || 'Brasileira', 
       naturalidade: a.naturalidade || '', 
       uf: a.uf || '', 
       racaCor: a.racaCor || '', 
       email: a.email || '', 
       celular: a.telefone || '', 
       filiacaoMae: a.filiacaoMae || '', 
       filiacaoPai: a.filiacaoPai || '', 
       idCenso: a.idCenso || '', 
       foto: a.foto || '', 
       endereco: a.endereco || {...EMPTY_END} 
    }))

    // Sincroniza refs estáticos para não usarem lixo temporário inicial
    if (a.codigo) codigoAlunoRef.current = a.codigo
    if (a.codigo) numMatriculaRef.current = a.codigo
    if (a.codigo) rgaAlunoRef.current = a.rga || `${new Date().getFullYear()}${a.codigo}`

    // ── Saúde ─────────────────────────────────────────────────────────────────
    if (a.saude) {
      setSaude(prev => ({ ...prev, ...a.saude }))
    }

    // ── Código ─────────────────────────────────────────────────────────────
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
      setFin(prev => ({ ...prev, ...a.configFinanceiro, _filtro: 'pendente' }))
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
  }, [editId, alunoEditando?.id, sourceAlunos.length])

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
  const numMatriculaRef = useRef<string>((alunoEditando as any)?.codigo || codigoAluno)
  const numMatricula = numMatriculaRef.current
  const rgaAlunoRef = useRef<string>(
    (alunoEditando as any)?.rga ||
    ((alunoEditando as any)?.codigo
      ? `${new Date().getFullYear()}${(alunoEditando as any).codigo}`
      : `${new Date().getFullYear()}${codigoAluno}`)
  )
  const rgaAluno = rgaAlunoRef.current

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
        //    Salva também o fotoNome = {codigo}.jpg para identificação correta no export
        const sid = autoSaveIdRef.current || (isEdicao ? editId : null)
        if (sid) {
          setAlunos((prev: any[]) =>
            prev.map((a: any) => {
              if (a.id !== sid) return a
              const codigoAluno = ((a as any).codigo || a.matricula || a.id || '').toString().trim()
              return { ...a, foto: base64, fotoNome: codigoAluno ? `${codigoAluno}.jpg` : a.fotoNome }
            })
          )
        }
        // 3. Atualiza também o campo no estado local do formulário
        const codigoLocal = (aluno.codigo || (alunoEditando as any)?.codigo || '').toString().trim()
        if (codigoLocal) updA('fotoNome', `${codigoLocal}.jpg`)
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

  // Código (dados básicos)
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
  const novoHistItem = (): HistoricoItem => {
    const matriculaId = Date.now().toString()
    return {
      id: matriculaId, ano: String(anoAtual), turmaId: mat.turmaId,
      turno: mat.turno, padraoId: '', situacao: 'Cursando',
      dataMatricula: new Date().toISOString().split('T')[0],
      dataResultado: '', grupoAlunos: '', bolsista: 'Não',
      respFinanceiroId: todosResp.find(r=>r.respFinanceiro)?.id ?? '',
      nrContrato: matriculaId, dataAlteracao: new Date().toLocaleDateString('pt-BR'),
      // Auto-detecta: se já existe alguma matrícula no histórico ou aluno está sendo editado → rematricula
      tipoMatricula: (historico.length > 0 || (isEdicao && (alunoEditando as any)?.historicoMatriculas?.length > 0)) ? 'rematricula' : 'nova'
    }
  }
  const [formHist, setFormHist] = useState<HistoricoItem>(novoHistItem)
  const fH = (k: keyof HistoricoItem, v: string) => setFormHist(h=>({...h,[k]:v}))

  // Financeiro — abre sempre no filtro A Vencer/Vencidos
  const [fin, setFin] = useState({
    padraoId:'', valorMensalidade:'', diaVencimento:'', totalParcelas:'',
    formaPagamento:'Boleto', bolsista:'Nao', grupoDescontoId:'', obsFinanceiro:'', _filtro:'pendente',
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
  }, [parcelas])

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
        // num é o índice interno do evento, será re-numerado globalmente em confirmarParcelas
        num: i+1,
        competencia: comp, vencimento: venc,
        valor, desconto: descontoPorParcela, valorFinal,
        status:'pendente', obs:'', editando:false,
        evento:nomeEvento, eventoId:novoEventoId,
        // numParcela / totalParcelas = numeração INTERNA do evento (imutável)
        numParcela: i + 1,
        totalParcelas: total,
        codigo: String(Math.floor(100000 + Math.random() * 900000)),
        selected: true,
        manterDesconto: (fin as any).manterDesconto || false,
        descTipo: descontoPorParcela > 0 ? descontoTipo : undefined,
        descRaw: descontoPorParcela > 0 ? descontoValorRaw : undefined,
        turmaId: formHist.turmaId || mat.turmaId
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
    // num = índice global para ordenação visual na tabela (continua de onde parou)
    const maxNum = parcelas.length > 0 ? Math.max(...parcelas.map((p:any)=>p.num||0)) : 0
    const novasRenumeradas = pFinal.map((p: any, i: number) => ({
      ...p,
      num: maxNum + i + 1,
      // numParcela / totalParcelas = numeração INTERNA e IMUTÁVEL do evento
      // Vem preenchida de gerarParcelas() — começa SEMPRE em 1 independente de outros eventos
      numParcela: p.numParcela ?? (i + 1),
      totalParcelas: p.totalParcelas ?? pFinal.length,
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
<body><div class="wrap"><div class="title">${doc.nome}</div><div class="body">${conteudo.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br/>')}</div><div class="footer"><span>IMPACTO EDU   ${aluno.nome}   Código ${numMatricula}</span><span>${new Date().toLocaleDateString('pt-BR')}</span></div></div><script>window.onload=function(){setTimeout(function(){window.print()},500)}<\/script></body></html>`)
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

  const handleFinalizar = async (forcarSaida: boolean = false) => {
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
      // fotoNome: nome do arquivo de exportação = {codigo do sistema}.jpg
      fotoNome: aluno.foto
        ? ((aluno as any).fotoNome || (() => {
            const cod = (aluno.codigo || numMatricula || '').toString().trim()
            return cod ? `${cod}.jpg` : undefined
          })())
        : undefined,
      racaCor:aluno.racaCor, sexo:aluno.sexo, naturalidade:aluno.naturalidade,
      uf:aluno.uf, nacionalidade:aluno.nacionalidade, endereco:aluno.endereco,
      filiacaoMae: aluno.filiacaoMae, filiacaoPai: aluno.filiacaoPai,
      idCenso: aluno.idCenso, codigo: aluno.codigo,
      // ── Dados completos para preservar no modo edição ──
      responsaveis: todosResp.filter(r=>r.nome.trim().length>0),
      saude: saude,
      dadosMatricula: mat,
      historicoMatriculas: historico,
      configFinanceiro: { ...fin },
      parcelas: parcelas,
      obsFinanceiro: obsAlunoFin,
      turmaId:turmaIdEfetivo2,
    }
    if (isEdicao) {
      const internalId = (alunoEditando as any).id
      setAlunos(prev => prev.map(a => a.id === internalId ? { ...a, ...payload } : a))
      logSystemAction('Acadêmico (Alunos)', 'Edição', `Atualização da matrícula/dados de ${payload.nome}`, { registroId: payload.codigo, nomeRelacionado: payload.nome, detalhesDepois: payload })
    } else {
      const novoId = autoSaveIdRef.current || `ALU${aluno.codigo}`
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
    const activeInternalId = isEdicao ? (alunoEditando as any)?.id || editId : autoSaveIdRef.current
    if (isEdicao && !forcarSaida) {
      if (activeInternalId) {
        fetch(`/api/alunos/${activeInternalId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(console.error)
      }
      setAutoSaveMsg('✅ Todas as alterações foram salvas com sucesso!')
      setTimeout(() => setAutoSaveMsg(''), 4000)
    } else {
      if (isEdicao && forcarSaida && activeInternalId) {
        fetch(`/api/alunos/${activeInternalId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(console.error)
      }
      router.push('/academico/alunos')
    }
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

  const autoSalvar = () => {
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
      idCenso:aluno.idCenso, codigo:aluno.codigo, rga:aluno.rga,
      responsaveis:todosResp,
      saude:saude,
      dadosMatricula:mat,
      historicoMatriculas:historico,
      configFinanceiro:{...fin},
      parcelas:parcelas,
      obsFinanceiro:obsAlunoFin,
      turmaId:turmaIdEfetivo,
    }
    if (isEdicao && editId && alunoEditando) {
      // CRITICAL: editId is the URL param (codigo/matricula). Use alunoEditando.id (internal id) for the map.
      const internalId = (alunoEditando as any).id
      setAlunos(prev => prev.map(a => a.id === internalId ? {...a, ...payload} : a))
      // Mock API HTTP só se houver nome garantido
      if (payload.nome && payload.nome.trim()) {
        fetch(`/api/alunos/${internalId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(console.error)
      }
    } else {
      // Nova matrícula: upsert usando id estável gerado na primeira vez
      if (!autoSaveIdRef.current) autoSaveIdRef.current = `ALU${aluno.codigo}`
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
      // Só empurra pro BD real se a matrícula tiver ganhado nome mínimo nas abas do wizard
      if (payload.nome && payload.nome.trim()) {
        fetch('/api/alunos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, id: sid }) }).catch(console.error)
      }
    }
    setAutoSaveMsg('✅ Dados salvos')
    setTimeout(() => setAutoSaveMsg(''), 2500)
  }

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
  
  
  const [modalVencimentoLote, setModalVencimentoLote] = useState(false)
  const [modalValorLote, setModalValorLote] = useState(false)
  const [modalDescontoLote, setModalDescontoLote] = useState(false)
  const [loteData, setLoteData] = useState({ dtPagto:'', formaPagto:'', dtVcto:'', valor:'', desconto:'' })

  const aplicarVencimentoLote = () => {
    if(!loteData.dtVcto) return setModalVencimentoLote(false)
    const novoVctoStr = loteData.dtVcto.split('-').reverse().join('/')
    setParcelas(prev => prev.map(p => parcelasSelected.includes(p.num) ? {...p, vencimento: novoVctoStr} : p))
    setModalVencimentoLote(false); setParcelasSelected([])
  }
  const aplicarBaixaLote = () => {
    if(!loteData.dtPagto) return setModalBaixaLote(false)
    setParcelas(prev => prev.map(p => parcelasSelected.includes(p.num) ? {...p, status:'pago', dtPagto: loteData.dtPagto, formaPagto: loteData.formaPagto} : p))
    setModalBaixaLote(false); setParcelasSelected([])
  }
  const aplicarValorLote = () => {
    const nv = parseFloat((loteData.valor||'').replace(/[^\d.,]/g, '').replace(',','.')) || 0
    if(nv <= 0) return setModalValorLote(false)
    setParcelas(prev => prev.map(p => {
       if(!parcelasSelected.includes(p.num)) return p;
       const descEfetivo = manterDesconto ? p.desconto : 0;
       return {...p, valor: nv, valorFinal: Math.max(0, nv - descEfetivo), desconto: descEfetivo}
    }))
    setModalValorLote(false); setParcelasSelected([])
  }
  const aplicarDescontoLote = () => {
    const d = parseFloat((loteData.desconto||'').replace(/[^\d.,]/g, '').replace(',','.')) || 0
    setParcelas(prev => prev.map(p => {
       if(!parcelasSelected.includes(p.num)) return p;
       return {...p, desconto: d, valorFinal: Math.max(0, p.valor - d)}
    }))
    setModalDescontoLote(false); setParcelasSelected([])
  }

  const stepContent = [
    // STEP 0: Responsáveis
    <div key="s0" style={{display:'flex',flexDirection:'column',gap:8}}>
      <div style={{padding:'16px 20px',background:'linear-gradient(135deg, #0f172a, #1e1b4b)',border:'1px solid rgba(99,102,241,0.2)',borderRadius:16,marginBottom:8,display:'flex',alignItems:'center',gap:16,boxShadow:'0 8px 30px rgba(15,23,42,0.1)'}}>
        <div style={{width:36,height:36,borderRadius:'50%',background:'rgba(99,102,241,0.2)',border:'1px solid rgba(99,102,241,0.5)',color:'#818cf8',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:16,flexShrink:0}}>1</div>
        <div style={{display:'flex',flexDirection:'column'}}>
           <div style={{color:'#f8fafc',fontWeight:800,fontSize:15,letterSpacing:0.5}}>Dados dos Responsáveis</div>
           <div style={{color:'#94a3b8',fontSize:12,marginTop:2}}>Preencha os responsáveis legais, indicando as autorizações pedagógicas e financeiras.</div>
        </div>
      </div>
      <RespCard resp={mae} onChange={setMae} cpfExistentes={cpfsExist} allResps={allResps}/>
      <RespCard resp={pai} onChange={setPai} cpfExistentes={cpfsExist} allResps={allResps}/>
      {showOutro1 ? <RespCard resp={outro1} onChange={setOutro1} cpfExistentes={cpfsExist} allResps={allResps} onRemove={() => { setShowOutro1(false); setOutro1(p => ({...p, nome:'', cpf:'', rg:'', parentesco:''})) }}/> : (
        <button type="button" onClick={()=>setShowOutro1(true)} style={{display:'flex',width:'100%',justifyContent:'center',alignItems:'center',gap:8,padding:'14px 20px',marginBottom:16,background:'#1c2938',color:'#f8fafc',borderRadius:14,border:'1px solid rgba(255,255,255,0.08)',cursor:'pointer',fontWeight:700,fontSize:13,transition:'all 0.2s',boxShadow:'0 6px 16px rgba(0,0,0,0.08)'}}>
          <Plus size={16} color="#94a3b8"/> Adicionar Outro Responsável
        </button>
      )}
      {showOutro1 && (showOutro2 ? <RespCard resp={outro2} onChange={setOutro2} cpfExistentes={cpfsExist} allResps={allResps} onRemove={() => { setShowOutro2(false); setOutro2(p => ({...p, nome:'', cpf:'', rg:'', parentesco:''})) }}/> : (
        <button type="button" onClick={()=>setShowOutro2(true)} style={{display:'flex',width:'100%',justifyContent:'center',alignItems:'center',gap:8,padding:'14px 20px',marginBottom:16,background:'#1c2938',color:'#f8fafc',borderRadius:14,border:'1px solid rgba(255,255,255,0.08)',cursor:'pointer',fontWeight:700,fontSize:13,transition:'all 0.2s',boxShadow:'0 6px 16px rgba(0,0,0,0.08)'}}>
          <Plus size={16} color="#94a3b8"/> Adicionar Outro Responsável 2
        </button>
      ))}
    </div>,

    // STEP 1: Dados do Aluno
    <div key="s1" style={{display:'flex',flexDirection:'column',gap:24,animation:'fadeIn 0.4s ease-out'}}>
      <div style={{padding:'20px 24px',background:'linear-gradient(135deg, #0f172a, #172554)',border:'1px solid rgba(59,130,246,0.3)',borderRadius:20,display:'flex',alignItems:'center',gap:20,boxShadow:'0 12px 40px rgba(15,23,42,0.15)'}}>
        <div style={{width:48,height:48,borderRadius:'50%',background:'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(99,102,241,0.2))',border:'2px solid rgba(99,102,241,0.5)',color:'#818cf8',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:20,flexShrink:0,boxShadow:'inset 0 2px 10px rgba(255,255,255,0.1)'}}>2</div>
        <div style={{display:'flex',flexDirection:'column'}}>
           <div style={{color:'#f8fafc',fontWeight:900,fontSize:18,letterSpacing:0.5}}>Dados Físicos do Aluno</div>
           <div style={{color:'#94a3b8',fontSize:13,marginTop:4}}>Informações fundamentais, identificação oficial e dados de contato.</div>
        </div>
      </div>
      
      <div className="ultra-form-panel" style={{
        padding:'40px 32px', display:'flex', flexDirection:'column', gap:40, 
        background: '#ffffff', borderRadius: '24px', 
        boxShadow: '0 20px 50px rgba(0,0,0,0.06), 0 4px 15px rgba(0,0,0,0.03)', 
        border: '1px solid rgba(0,0,0,0.05)', position: 'relative'
      }}>
        
        {/* ── Seção: Foto e Identificação Básica ── */}
        <div style={{display:'flex',flexDirection:'column',gap:24}}>
          <h4 style={{fontSize:13, fontWeight:800, color:'#b4c6db', textTransform:'uppercase', letterSpacing:1.5, borderBottom:'1px solid #f1f5f9', paddingBottom:12, display:'flex', alignItems:'center', gap:8}}>
            <User size={16} color="#60a5fa"/> Perfil Principal
          </h4>
          
          <div style={{display:'flex', gap:32, flexWrap:'wrap', alignItems:'flex-start'}}>
            {/* 📸 Foto Modernizada */}
            <div style={{flexShrink:0, width:140, display:'flex', flexDirection:'column', alignItems:'center', gap:16}}>
              <div
                onClick={()=>fotoInputRef.current?.click()}
                title="Clique para enviar ou trocar foto"
                style={{
                  width:140,height:140,borderRadius:32,cursor:'pointer',
                  position:'relative',overflow:'hidden',
                  background:aluno.foto?'#fff':'linear-gradient(135deg,rgba(99,102,241,0.05),rgba(59,130,246,0.08))',
                  border:`2px ${aluno.foto?'solid':'dashed'} ${aluno.foto?'rgba(99,102,241,0.4)':'rgba(99,102,241,0.3)'}`,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  transition:'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow:aluno.foto?'0 16px 32px rgba(99,102,241,0.25)':'0 8px 20px rgba(0,0,0,0.03)',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px) scale(1.02)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 20px 40px rgba(99,102,241,0.15)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0) scale(1)'; (e.currentTarget as HTMLElement).style.boxShadow = aluno.foto?'0 16px 32px rgba(99,102,241,0.25)':'0 8px 20px rgba(0,0,0,0.03)' }}
              >
                {aluno.foto ? (
                  <img src={aluno.foto} alt="Foto do aluno" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                ) : (
                  <div style={{textAlign:'center',pointerEvents:'none',display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
                    <div style={{width:52,height:52,borderRadius:'50%',background:'rgba(99,102,241,0.1)',display:'flex',alignItems:'center',justifyContent:'center'}}><Camera size={26} color="#6366f1"/></div>
                    <div style={{fontSize:11,color:'#64748b',fontWeight:800,textTransform:'uppercase',letterSpacing:.5}}>Adicionar<br/>Foto</div>
                  </div>
                )}
              </div>
              <input ref={fotoInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleFotoUpload}/>
              {aluno.foto && (
                <button type="button" onClick={()=>updA('foto','')} style={{fontSize:11,fontWeight:700,color:'#ef4444',background:'rgba(239,68,68,0.1)',border:'none',padding:'8px 16px',borderRadius:20,cursor:'pointer',transition:'all 0.2s'}} onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(239,68,68,0.15)'} onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='rgba(239,68,68,0.1)'}>Remover Foto</button>
              )}
            </div>

            {/* Inputs Principais */}
            <div style={{flex:1, minWidth:300, display:'flex', flexDirection:'column', gap:22}}>
              <div style={{display:'flex', gap:22, flexWrap:'wrap'}}>
                <div style={{flex:2, minWidth:250}}><F label="Nome Completo"><input style={{...ultraInputStyle, fontSize:15}} value={aluno.nome} onChange={e=>updA('nome',e.target.value)} placeholder="Nome completo do aluno"/></F></div>
                <div style={{flex:1, minWidth:160}}><F label="Sexo"><select style={ultraInputStyle} value={aluno.sexo} onChange={e=>updA('sexo',e.target.value)}><option value="">Selecione</option>{SEXOS.map(s=><option key={s}>{s}</option>)}</select></F></div>
              </div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:22}}>
                <div>
                  <F label="Data de Nascimento">
                    <div style={{position:'relative'}}>
                      <input style={ultraInputStyle} type="text" placeholder="DD/MM/AAAA" maxLength={10} value={aluno.dataNasc} onChange={e=>updA('dataNasc',fmtDateMask(e.target.value))}/>
                      {aluno.dataNasc && <div style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',fontSize:12,color:'#10b981',fontWeight:800,letterSpacing:.5,display:'flex',alignItems:'center',gap:4,background:'rgba(16,185,129,0.1)',padding:'4px 8px',borderRadius:8,pointerEvents:'none'}}><CheckCircle size={14}/> {calcIdade(aluno.dataNasc)}</div>}
                    </div>
                  </F>
                </div>
                <div><F label="CPF"><CPFInput value={aluno.cpf} onChange={v=>updA('cpf',v)} existentes={cpfsExist}/></F></div>
                <div><F label="Celular do Aluno / WhatsApp"><input style={ultraInputStyle} value={aluno.celular} onChange={e=>updA('celular',fmtPhone(e.target.value))} placeholder="(00) 00000-0000"/></F></div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Seção: Documentos Institucionais ── */}
        <div style={{display:'flex',flexDirection:'column',gap:24}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))',gap:24,background:'#f8fafc',padding:28,borderRadius:24,border:'1px solid #e2e8f0',boxShadow:'inset 0 4px 14px rgba(0,0,0,0.02)'}}>
            <F label="Código Sistema">
              <input style={{...ultraInputStyle, background:'rgba(226,232,240,0.5)', color:'#64748b', cursor:'not-allowed', border:'1px solid #e2e8f0', fontFamily:'JetBrains Mono, monospace',letterSpacing:1.5,fontSize:15}} value={aluno.codigo} readOnly/>
            </F>
            <F label="RGA (Registro Acadêmico)">
              <input style={{...ultraInputStyle, background:'rgba(226,232,240,0.5)', color:'#64748b', cursor:'not-allowed', border:'1px solid #e2e8f0', fontFamily:'JetBrains Mono, monospace',letterSpacing:1.5,fontSize:15}} value={rgaAluno} readOnly/>
            </F>
            <F label="ID Censo Escolar"><input style={ultraInputStyle} value={aluno.idCenso} onChange={e=>updA('idCenso',e.target.value)} placeholder="Identificador INEP"/></F>
          </div>
        </div>

        {/* ── Seção: Detalhes Pessoais ── */}
        <div style={{display:'flex',flexDirection:'column',gap:24}}>
          <h4 style={{fontSize:13, fontWeight:800, color:'#b4c6db', textTransform:'uppercase', letterSpacing:1.5, borderBottom:'1px solid #f1f5f9', paddingBottom:12, display:'flex', alignItems:'center', gap:8}}>
            <Layers size={16} color="#f59e0b"/> Informações Complementares
          </h4>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))',gap:22}}>
            <div style={{minWidth:220}}><F label="E-mail do Aluno"><input style={ultraInputStyle} type="email" value={aluno.email} onChange={e=>updA('email',e.target.value)} placeholder="aluno@email.com"/></F></div>
            <F label="Estado Civil">
              <select style={ultraInputStyle} value={aluno.estadoCivil} onChange={e=>updA('estadoCivil',e.target.value)}>
                <option value="">Selecione</option>{ESTADOS_CIVIS.map(s=><option key={s}>{s}</option>)}
              </select>
            </F>
            <F label="Cor/Raça">
              <select style={ultraInputStyle} value={aluno.racaCor} onChange={e=>updA('racaCor',e.target.value)}>
                <option value="">Selecione</option>
                {['Branca','Preta','Parda','Amarela','Indígena','Não Declarada'].map(s=><option key={s}>{s}</option>)}
              </select>
            </F>
            <F label="Nacionalidade"><input style={ultraInputStyle} value={aluno.nacionalidade} onChange={e=>updA('nacionalidade',e.target.value)}/></F>
            <F label="Naturalidade"><input style={ultraInputStyle} value={aluno.naturalidade} onChange={e=>updA('naturalidade',e.target.value)}/></F>
            <F label="UF">
              <select style={ultraInputStyle} value={aluno.uf} onChange={e=>updA('uf',e.target.value)}>
                <option value=""></option>{UFS.map(u=><option key={u}>{u}</option>)}
              </select>
            </F>
          </div>
        </div>

        {/* ── Seção: Filiação ── */}
        <div style={{display:'flex',flexDirection:'column',gap:24}}>
          <h4 style={{fontSize:13, fontWeight:800, color:'#b4c6db', textTransform:'uppercase', letterSpacing:1.5, borderBottom:'1px solid #f1f5f9', paddingBottom:12, display:'flex', alignItems:'center', gap:8}}>
            <Users size={16} color="#ec4899"/> Filiação
          </h4>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))',gap:24}}>
            <div style={{background:'linear-gradient(135deg, rgba(244,114,182,0.05), #ffffff)',padding:24,borderRadius:20,border:'1px solid rgba(244,114,182,0.2)',boxShadow:'0 8px 24px rgba(244,114,182,0.05)'}}>
              <FiliacaoInput label="Filiação — Mãe" respList={todosResp} value={aluno.filiacaoMae||mae.nome} onChange={v=>updA('filiacaoMae',v)}/>
            </div>
            <div style={{background:'linear-gradient(135deg, rgba(56,189,248,0.05), #ffffff)',padding:24,borderRadius:20,border:'1px solid rgba(56,189,248,0.2)',boxShadow:'0 8px 24px rgba(56,189,248,0.05)'}}>
              <FiliacaoInput label="Filiação — Pai" respList={todosResp} value={aluno.filiacaoPai||pai.nome} onChange={v=>updA('filiacaoPai',v)}/>
            </div>
          </div>
        </div>

        {/* ── Seção: Endereço ── */}
        <div style={{display:'flex',flexDirection:'column',gap:24}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end', borderBottom:'1px solid #f1f5f9', paddingBottom:12}}>
            <h4 style={{fontSize:13, fontWeight:800, color:'#b4c6db', textTransform:'uppercase', letterSpacing:1.5, display:'flex', alignItems:'center', gap:8, margin:0}}>
              <MapPin size={16} color="#10b981"/> Endereço do Aluno
            </h4>
            <div style={{display:'flex',gap:10}}>
              {todosResp.filter(r=>r.nome).map(r=>(
                <button key={r.id} type="button" style={{fontSize:12,fontWeight:700,padding:'8px 16px',background:'#f1f5f9',color:'#475569',borderRadius:12,border:'1px solid #cbd5e1',cursor:'pointer',transition:'all 0.2s',display:'flex',alignItems:'center',gap:6,boxShadow:'0 2px 6px rgba(0,0,0,0.05)'}} onClick={()=>updA('endereco',{...r.endereco})} onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='#e2e8f0'} onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='#f1f5f9'}>
                  <MapPin size={12}/> Copiar {r.parentesco}
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
      <div style={{padding:'16px 20px',background:'linear-gradient(135deg, #0f172a, #064e3b)',border:'1px solid rgba(16,185,129,0.2)',borderRadius:16,display:'flex',alignItems:'center',gap:16,boxShadow:'0 8px 30px rgba(15,23,42,0.1)'}}>
        <div style={{width:36,height:36,borderRadius:'50%',background:'rgba(16,185,129,0.2)',border:'1px solid rgba(16,185,129,0.5)',color:'#34d399',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:16,flexShrink:0}}>3</div>
        <div style={{display:'flex',flexDirection:'column'}}>
           <div style={{color:'#f8fafc',fontWeight:800,fontSize:15,letterSpacing:0.5}}>Saúde, Observações & Imagem</div>
           <div style={{color:'#94a3b8',fontSize:12,marginTop:2}}>Dados médicos críticos e acordos de confidencialidade/imagem da escola.</div>
        </div>
      </div>
      <div className="card" style={{padding:16,display:'flex',flexDirection:'column',gap:12}}>
        <div style={{fontWeight:700,fontSize:12,color:'#34d399'}}>🏥 Informações Médicas</div>
        <div style={{display:'grid',gridTemplateColumns:'140px minmax(200px, 1fr) minmax(200px, 1fr)',gap:16}}>
          <F label="Tipo Sanguíneo">
            <select className="form-input" value={saude.tipoSanguineo} onChange={e=>setSaude(s=>({...s,tipoSanguineo:e.target.value}))}>
              <option value="">Não sei</option>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(t=><option key={t}>{t}</option>)}
            </select>
          </F>
          <F label="Alergias"><input className="form-input" value={saude.alergias} onChange={e=>setSaude(s=>({...s,alergias:e.target.value}))} placeholder="Alimentos, medicamentos, látex..."/></F>
          <F label="Deficiências (CID)"><input className="form-input" value={saude.deficiencias} onChange={e=>setSaude(s=>({...s,deficiencias:e.target.value}))} placeholder="Ex: F84.0, H54.0"/></F>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          <F label="Medicamentos em Uso"><textarea className="form-input" rows={2} value={saude.medicamentos} onChange={e=>setSaude(s=>({...s,medicamentos:e.target.value}))} placeholder="Nome, dosagem e horário..."/></F>
          <F label="Necessidades Especiais / NEE"><textarea className="form-input" rows={2} value={saude.necessidades} onChange={e=>setSaude(s=>({...s,necessidades:e.target.value}))} placeholder="Descreva as necessidades..."/></F>
        </div>
        <div style={{display:'flex',gap:20,padding:'14px 18px',background:'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.02))',borderRadius:12,border:'1px solid rgba(16,185,129,0.25)',boxShadow:'0 2px 10px rgba(16,185,129,0.05)'}}>
          <label style={{display:'flex',alignItems:'center',gap:12,cursor:'pointer',fontSize:13,fontWeight:700,color:'hsl(var(--text-primary))'}}>
            <div style={{width:20,height:20,borderRadius:6,border:saude.autorizaImagem?'none':'2px solid hsl(var(--border-subtle))',background:saude.autorizaImagem?'#10b981':'transparent',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.2s',flexShrink:0}}>
               {saude.autorizaImagem && <Check size={14} color="#fff" strokeWidth={4}/>}
            </div>
            <input type="checkbox" style={{display:'none'}} checked={saude.autorizaImagem} onChange={e=>setSaude(s=>({...s,autorizaImagem:e.target.checked}))}/>
            Autorizo uso de imagem
          </label>
        </div>
        <F label="Observações Gerais"><textarea className="form-input" rows={2} value={saude.obs} onChange={e=>setSaude(s=>({...s,obs:e.target.value}))} placeholder="Informações adicionais relevantes para a escola..."/></F>
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
            {/* Último curso lançado — ordered by ano desc → dataMatricula desc → id (timestamp) desc */}
            {historico.length>0&&(()=>{
              const ultimo = [...historico].sort((a,b)=>{
                const ay=parseInt(a.ano)||0,by=parseInt(b.ano)||0
                if(ay!==by) return by-ay
                const dm=(b.dataMatricula||'').localeCompare(a.dataMatricula||'')
                if(dm!==0) return dm
                return (parseInt(b.id)||0)-(parseInt(a.id)||0)
              })[0]
              const turmaUltima = turmas.find(t=>t.id===ultimo.turmaId)
              if(!turmaUltima?.nome) return null
              return (
                <span style={{fontSize:11,padding:'3px 10px',borderRadius:20,background:'rgba(16,185,129,0.1)',color:'#10b981',fontWeight:700,display:'flex',alignItems:'center',gap:4}}>
                  📚 Último: {turmaUltima.nome} / {ultimo.ano} &middot; {ultimo.situacao}
                </span>
              )
            })()}
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
                  {['Ano','Curso / Turma','Segmento','Situacao','Data Matr.','Padrao Pgt.','Nr. Contrato','Grupo','Data Result.','Turno','Resp. Fin.',''].map(h=>(
                    <th key={h} style={{padding:'8px 12px',textAlign:'left',fontWeight:700,fontSize:11,color:'hsl(var(--text-muted))',borderBottom:'2px solid rgba(148,163,184,0.25)',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historico.map((h,i)=>{
                  const turmaH = turmas.find(t=>t.id===h.turmaId)
                  const padraoH = cfgPadroesPagamento.find(p=>p.id===h.padraoId)
                  const respH = todosResp.find(r=>r.id===h.respFinanceiroId)
                  const matriculaAtiva = isMatriculaAtiva(h.situacao)
                  const ativa = h.situacao==='Cursando'
                  // Row background: ativa (purple tint), desativada (yellow tint), neutro
                  const rowBg = ativa ? 'rgba(99,102,241,0.04)' : !matriculaAtiva ? 'rgba(245,158,11,0.10)' : 'transparent'
                  const rowBorderLeft = !matriculaAtiva ? '3px solid rgba(245,158,11,0.45)' : 'none'
                  return (
                    <tr key={h.id} style={{borderBottom:'1px solid rgba(148,163,184,0.25)',background:rowBg,borderLeft:rowBorderLeft}}
                      onMouseEnter={e=>{(e.currentTarget as HTMLTableRowElement).style.background=ativa?'rgba(99,102,241,0.08)':!matriculaAtiva?'rgba(245,158,11,0.18)':'hsl(var(--bg-elevated))'}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLTableRowElement).style.background=rowBg}}>
                      <td style={{padding:'8px 12px',fontWeight:700,color:ativa?'#a78bfa':!matriculaAtiva?'#d97706':'hsl(var(--text-base))'}}>
                        {h.ano}
                        {!matriculaAtiva && <span title="Matrícula desativada" style={{marginLeft:5,fontSize:9,verticalAlign:'middle'}}>⚠️</span>}
                      </td>
                      <td style={{padding:'8px 12px',fontWeight:600}}>{turmaH?.nome||'—'}</td>
                      <td style={{padding:'8px 12px'}}><span className="badge badge-primary">{turmaH?.serie ? (SEGMENTOS.find(s => s.codigo === turmaH.serie)?.nome || turmaH.serie) : '—'}</span></td>
                      <td style={{padding:'8px 12px'}}>
                        <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,fontWeight:700,
                          background:matriculaAtiva?(ativa?'rgba(99,102,241,0.12)':'rgba(16,185,129,0.1)'):'rgba(245,158,11,0.14)',
                          color:matriculaAtiva?(ativa?'#818cf8':'#10b981'):'#d97706'
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

              {/* ── Tipo de Código ── */}
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
                    // Normaliza acentos e mapeia sinonimos (Manha->Matutino, Tarde->Vespertino, etc)
                    const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
                    // Mapeamento semantico: valores antigos -> palavras-chave dos cfgTurnos atuais
                    const SINONIMOS: [string[], string[]][] = [
                      [['manha','matut','morning'],   ['manha','matut']],
                      [['tarde','vespert','afterno'],  ['tarde','vespert']],
                      [['noite','notur','noctur'],     ['noite','notur']],
                      [['interm'],                    ['interm']],
                      [['integr','fulltime'],          ['integr']],
                    ]
                    const tCfg = cfgTurnos.find((cfg: any) => {
                      const nNome = norm(cfg.nome); const nCod = norm(cfg.codigo || '')
                      const nStr  = norm(turnoStr)
                      if (nNome === nStr || nCod === nStr) return true
                      return SINONIMOS.some(([src, dst]) =>
                        src.some(k => nStr.includes(k)) && dst.some(k => nNome.includes(k))
                      )
                    })
                    const resolvedTurno = tCfg ? tCfg.nome : ''
                    
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
                    {formHist.turno && !cfgTurnos.filter((t:any)=>t.situacao==='ativo').some((t:any)=>t.nome===formHist.turno) && (<option value={formHist.turno}>{formHist.turno}</option>)}
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

                  {/* Manter Desconto toggle */}
                  <div style={{padding:'12px 16px',background:'rgba(16,185,129,0.04)',border:'1px solid rgba(16,185,129,0.2)',borderRadius:10,marginBottom:12}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:13}}>Manter Desconto</div>
                        <div style={{fontSize:11,color:'hsl(var(--text-muted))',marginTop:2}}>Mesmo após o vencimento da parcela, o desconto será mantido.</div>
                      </div>
                      <button type="button" onClick={()=>setFin(f=>({...f,manterDesconto:!(f as any).manterDesconto}))}
                        style={{width:44,height:24,borderRadius:12,border:'none',cursor:'pointer',
                          background:(fin as any).manterDesconto?'#10b981':'hsl(var(--border-subtle))',
                          position:'relative',transition:'background 0.2s',flexShrink:0}}>
                        <div style={{position:'absolute',top:2,left:(fin as any).manterDesconto?'calc(100% - 22px)':2,width:20,height:20,borderRadius:10,background:'white',transition:'left 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.3)'}}/>
                      </button>
                    </div>
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
                            const updated = editHistId ? historico.map(h=>h.id===editHistId?item:h) : [...historico, item];
                            const ativa = updated.find(h=>h.situacao==='Cursando') || updated[updated.length-1];
                            if(ativa?.turmaId) setMat(m=>({...m, turmaId:ativa.turmaId, turno:ativa.turno||m.turno}));
                            sincronizarTurmaAluno(updated);
                            setHistorico(updated);
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
                  // Compute new historico synchronously (avoid stale closure in autoSalvar)
                  const novoHistorico = editHistId
                    ? historico.map(h=>h.id===editHistId?item:h)
                    : [...historico, item]
                  // sync mat + turma do aluno
                  const ativa = novoHistorico.find(h=>h.situacao==='Cursando') || novoHistorico[novoHistorico.length-1]
                  if(ativa?.turmaId) setMat(m=>({...m, turmaId:ativa.turmaId, turno:ativa.turno||m.turno}))
                  sincronizarTurmaAluno(novoHistorico)
                  // Update state
                  setHistorico(novoHistorico)
                  setModalMatricula(false)

                  // ── Persist immediately so changes survive without requiring step navigation ──
                  const turmaIdEf = ativa?.turmaId || mat.turmaId || ''
                  const turmaSel = turmas.find(t=>t.id===turmaIdEf)
                  const respPed = todosResp.find(r=>r.respPedagogico)
                  const histPayload = {
                    turma: turmaSel?.nome ?? '',
                    serie: turmaSel?.serie ?? '',
                    turno: ativa?.turno || mat.turno || turmaSel?.turno || '',
                    historicoMatriculas: novoHistorico,
                    dadosMatricula: {...mat, turmaId: turmaIdEf},
                    responsaveis: todosResp,
                    saude: saude,
                    parcelas: parcelas,
                    obsFinanceiro: obsAlunoFin,
                    turmaId: turmaIdEf,
                    responsavel: respPed?.nome ?? mae.nome,
                  }
                  if (isEdicao && alunoEditando) {
                    const internalId = (alunoEditando as any).id
                    setAlunos((prev:any[]) => prev.map(a => a.id===internalId ? {...a, ...histPayload} : a))
                    fetch(`/api/alunos/${internalId}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...(alunoEditando as any), ...histPayload})}).catch(console.error)
                  } else if (autoSaveIdRef.current) {
                    const sid = autoSaveIdRef.current
                    setAlunos((prev:any[]) => prev.map(a => a.id===sid ? {...a, ...histPayload} : a))
                  }
                }}>
                <Check size={14}/> {editHistId?'Salvar Alteracoes':'Adicionar Matricula'}
              </button>

            </div>
          </div>
        </div>
      )}
    </div>,
    // STEP 4: Financeiro
    
    <div key="s4" style={{display:'flex',flexDirection:'column',gap:0,minHeight:600,background:'hsl(var(--bg-base))', position:'relative', paddingBottom: 40}}>
      {/* HEADER DA ABA */}
      <div style={{padding:'20px 24px',background:'linear-gradient(90deg, #1e293b, #0f172a)',display:'flex',alignItems:'center',gap:16}}>
        <div style={{width:40,height:40,borderRadius:'50%',background:'rgba(16,185,129,0.15)',border:'1px solid rgba(16,185,129,0.4)',color:'#10b981',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:18}}>5</div>
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:6,color:'hsl(var(--text-muted))',fontSize:10,fontWeight:700,letterSpacing:.5,textTransform:'uppercase'}}>
            FINANCEIRO · CÓD. {(alunoEditando as any)?.codigo || aluno.codigo || ''}
          </div>
          <div style={{color:'#f8fafc',fontWeight:800,fontSize:18,letterSpacing:0.5}}>{aluno.nome || (alunoEditando as any)?.nome || 'Novo Aluno'}</div>
        </div>
        <div style={{flex:1, borderLeft:'1px solid rgba(255,255,255,0.1)', paddingLeft:16}}>
           <div style={{color:'hsl(var(--text-muted))',fontSize:10,fontWeight:700,letterSpacing:.5,textTransform:'uppercase'}}>RESP. FINANCEIRO</div>
           <div style={{color:'#38bdf8',fontWeight:700,fontSize:13}}>{todosResp.find(r=>r.respFinanceiro)?.nome || mae.nome || 'Não informado'}</div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={()=>setModalObsAluno(true)} style={{fontSize:11, color:'#fbbf24', background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.2)'}}>
          ✏️ Obs. Financeira
        </button>
        {parcelasConfirmadas && <div style={{padding:'4px 12px', borderRadius:20, background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', color:'#10b981', fontSize:11, fontWeight:700}}>✓ Confirmadas</div>}
      </div>

      <div style={{padding:'20px 24px'}}>
        {(() => {
          if (!parcelasConfirmadas || parcelas.length === 0) {
            return (
              <div style={{textAlign:'center',padding:'40px 20px',color:'hsl(var(--text-muted))',background:'hsl(var(--bg-elevated))',borderRadius:16,border:'1px dashed hsl(var(--border-strong))'}}>
                Nenhuma parcela gerada ou confirmada ainda.<br/><span style={{fontSize:12}}>Revise a Matrícula (Passo 4) ou gere parcelas avulsas.</span>
              </div>
            )
          }

          const sA = ['pendente','vencido','pago']
          const pFilt = parcelas.filter(p => sA.includes(p.status) )
          const aV = pFilt.filter(p => !((p as any).status === 'vencido') && p.status !== 'pago')
          const ven = pFilt.filter(p => ((p as any).status === 'vencido') && p.status !== 'pago')

          const sA_all = ['pendente','vencido','pago'];
          const parcsAtivas = parcelas.filter(p => sA_all.includes(p.status));
          const totalBruto = parcsAtivas.reduce((s,p)=>s+p.valor,0);
          const totalDesc = parcsAtivas.reduce((s,p)=>s+p.desconto,0);
          const totalEncargos = parcsAtivas.reduce((s,p)=>s+((p as any).juros||0)+((p as any).multa||0),0);
          const totalLiq = parcsAtivas.reduce((s,p)=>s+p.valorFinal+((p as any).juros||0)+((p as any).multa||0),0);
          const totalPago = parcsAtivas.filter(p=>p.status==='pago').reduce((s,p)=>s+p.valorFinal+((p as any).juros||0)+((p as any).multa||0),0);

          const isAllSelected = pFilt.length > 0 && parcelasSelected.length === pFilt.length;

          return (
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              
              {/* 4 SUMMARY CARDS */}
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:16}}>
                 <div className="card" style={{padding:'16px',borderRadius:16,background:'hsl(var(--bg-elevated))',border:'1px solid hsl(var(--border-subtle))',boxShadow:'0 2px 8px rgba(0,0,0,0.02)'}}>
                    <div style={{fontSize:10,fontWeight:700,color:'hsl(var(--text-muted))',textTransform:'uppercase',display:'flex',alignItems:'center',gap:6}}>
                      <div style={{width:8,height:8,borderRadius:'50%',background:'#fbbf24'}}/> TOTAL BRUTO
                    </div>
                    <div style={{fontSize:22,fontWeight:900,color:'hsl(var(--text-base))',marginTop:8}}>R$ {fmtMoeda(totalBruto)}</div>
                 </div>
                 <div className="card" style={{padding:'16px',borderRadius:16,background:'hsl(var(--bg-elevated))',border:'1px dashed #fb923c',boxShadow:'0 2px 8px rgba(0,0,0,0.02)'}}>
                    <div style={{fontSize:10,fontWeight:700,color:'#ea580c',textTransform:'uppercase',display:'flex',alignItems:'center',gap:6}}>
                      🏷️ DESCONTOS
                    </div>
                    <div style={{fontSize:22,fontWeight:900,color:'#ea580c',marginTop:8}}>R$ {fmtMoeda(totalDesc)}</div>
                 </div>
                 <div className="card" style={{padding:'16px',borderRadius:16,background:'rgba(16,185,129,0.05)',border:'1px solid rgba(16,185,129,0.3)',boxShadow:'0 2px 8px rgba(0,0,0,0.02)'}}>
                    <div style={{fontSize:10,fontWeight:700,color:'#059669',textTransform:'uppercase',display:'flex',alignItems:'center',gap:6}}>
                      ☑️ TOTAL LÍQUIDO
                    </div>
                    <div style={{fontSize:22,fontWeight:900,color:'#10b981',marginTop:4}}>R$ {fmtMoeda(totalLiq)}</div>
                    <div style={{fontSize:9,color:'#059669',marginTop:2}}>incl. R$ {fmtMoeda(totalEncargos)} encargos</div>
                 </div>
                 <div className="card" style={{padding:'16px',borderRadius:16,background:'hsl(var(--bg-elevated))',border:'1px solid hsl(var(--border-subtle))',boxShadow:'0 2px 8px rgba(0,0,0,0.02)'}}>
                    <div style={{fontSize:10,fontWeight:700,color:'#3b82f6',textTransform:'uppercase',display:'flex',alignItems:'center',gap:6}}>
                      <div style={{width:16,height:3,background:'#38bdf8',borderRadius:2}}/> RECEBIDO
                    </div>
                    <div style={{fontSize:22,fontWeight:900,color:'#6366f1',marginTop:8}}>R$ {fmtMoeda(totalPago)}</div>
                 </div>
              </div>

              {/* 4 PANELS GRID */}
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:16}}>
                 <div className="card" style={{padding:'14px',borderRadius:12,border:'1px solid rgba(16,185,129,0.3)',background:'hsl(var(--bg-elevated))'}}>
                    <div style={{fontSize:10,fontWeight:800,color:'hsl(var(--text-base))',marginBottom:12,display:'flex',alignItems:'center',gap:8}}><div style={{width:8,height:8,background:'#10b981',transform:'rotate(45deg)'}}/> LIQUIDAÇÃO & GESTÃO</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                       <button type="button" className="btn btn-sm" onClick={(e)=>{e.preventDefault(); setModalBaixaLote(true)}} style={{fontSize:11,background:'rgba(16,185,129,0.1)',color:'#059669',border:'1px solid rgba(16,185,129,0.2)'}}>💳 Baixar</button>
                       <button type="button" className="btn btn-sm" style={{fontSize:11,background:'hsl(var(--bg-base))',color:'#6366f1',border:'1px solid hsl(var(--border-subtle))'}} onClick={(e)=>{e.preventDefault(); setModalEditarParcela(true)}}>✏️ Editar</button>
                       <button type="button" className="btn btn-sm" style={{fontSize:11,background:'hsl(var(--bg-base))',color:'hsl(var(--text-muted))',border:'1px solid hsl(var(--border-subtle))'}} onClick={(e)=>{e.preventDefault(); setModalBaixaResp(true)}}>🏦 Baixa Resp.</button>
                       <button type="button" className="btn btn-sm" style={{fontSize:11,background:'rgba(239,68,68,0.05)',color:'#ef4444',border:'1px dashed rgba(239,68,68,0.3)'}} onClick={(e)=>{e.preventDefault(); setModalExcluirMotivo(true)}}>🗑️ Excluir</button>
                    </div>
                 </div>
                 <div className="card" style={{padding:'14px',borderRadius:12,border:'1px solid rgba(139,92,246,0.2)',background:'hsl(var(--bg-elevated))'}}>
                    <div style={{fontSize:10,fontWeight:800,color:'hsl(var(--text-base))',marginBottom:12,display:'flex',alignItems:'center',gap:8}}>🛠️ LANÇAMENTOS MANUAIS</div>
                     <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                       <button type="button" className="btn btn-sm" onClick={(e)=>{e.preventDefault(); setModalEventoFin(true)}} style={{fontSize:11,background:'rgba(139,92,246,0.1)',color:'#7c3aed',border:'1px solid rgba(139,92,246,0.2)'}}>➕ Inserir Evento</button>
                       <button type="button" className="btn btn-sm" onClick={(e)=>{e.preventDefault(); setModalDescontoLote(true)}} style={{fontSize:11,background:'hsl(var(--bg-base))',color:'#ea580c',border:'1px solid hsl(var(--border-subtle))'}}>🏷️ Descontos</button>
                       <button type="button" className="btn btn-sm" onClick={(e)=>{e.preventDefault(); setModalVencimentoLote(true)}} style={{fontSize:11,background:'hsl(var(--bg-base))',color:'#38bdf8',border:'1px solid hsl(var(--border-subtle))'}}>📅 Vencimento</button>
                       <button type="button" className="btn btn-sm" onClick={(e)=>{e.preventDefault(); setModalValorLote(true)}} style={{fontSize:11,background:'hsl(var(--bg-base))',color:'#10b981',border:'1px solid hsl(var(--border-subtle))'}}>💰 Alt. Valor</button>
                    </div>
                 </div>
                 <div className="card" style={{padding:'14px',borderRadius:12,border:'1px solid hsl(var(--border-strong))',background:'hsl(var(--bg-elevated))'}}>
                    <div style={{fontSize:10,fontWeight:800,color:'hsl(var(--text-base))',marginBottom:12,display:'flex',alignItems:'center',gap:8}}>🔍 CONSULTAS & ESTORNO</div>
                     <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                       <button type="button" className="btn btn-sm" onClick={(e)=>{e.preventDefault(); setModalConsultaBaixa(true)}} style={{fontSize:11,background:'hsl(var(--bg-base))',color:'#3b82f6',border:'1px solid hsl(var(--border-subtle))'}}>🔍 Cons. Baixa</button>
                       <button type="button" className="btn btn-sm" style={{fontSize:11,background:'hsl(var(--bg-base))',color:'hsl(var(--text-muted))',border:'1px solid hsl(var(--border-subtle))'}} onClick={(e)=>{e.preventDefault(); setModalExcluirBaixa(true)}}>🗑️ Excluir Baixa</button>
                       <button type="button" className="btn btn-sm" style={{fontSize:11,background:'hsl(var(--bg-base))',color:'#fbbf24',border:'1px solid hsl(var(--border-subtle))'}} onClick={(e)=>{e.preventDefault(); setModalExtrato(true)}}>📄 Extrato</button>
                       <button type="button" className="btn btn-sm" onClick={(e)=>{e.preventDefault(); setModalItensExcluidos(true)}} style={{fontSize:11,background:'hsl(var(--bg-base))',color:'hsl(var(--text-muted))',border:'1px solid hsl(var(--border-subtle))'}}>🗑️ Excluidos</button>
                    </div>
                 </div>
                 <div className="card" style={{padding:'14px',borderRadius:12,border:'1px solid hsl(var(--border-subtle))',background:'hsl(var(--bg-elevated))'}}>
                    <div style={{fontSize:10,fontWeight:800,color:'hsl(var(--text-base))',marginBottom:12,display:'flex',alignItems:'center',gap:8}}>🏦 COBRANÇA BANCÁRIA</div>
                     <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                       <button type="button" className="btn btn-sm" style={{gridColumn:'span 2',fontSize:11,background:'hsl(var(--bg-base))',color:'#6366f1',border:'1px solid hsl(var(--border-subtle))'}} onClick={(e)=>{e.preventDefault(); setModalHistorico(true)}}>📄 Histórico</button>
                       <button type="button" className="btn btn-sm" style={{fontSize:11,background:'rgba(14,165,233,0.1)',color:'#0284c7',border:'1px solid rgba(14,165,233,0.2)'}} onClick={(e)=>{e.preventDefault(); setModalBoleto((f:any)=>({...f,tipo:'geral'}))}}>🧾 Emitir Boleto</button>
                       <button type="button" className="btn btn-sm" style={{fontSize:11,background:'hsl(var(--bg-base))',color:'hsl(var(--text-muted))',border:'1px solid hsl(var(--border-subtle))'}} onClick={(e)=>{e.preventDefault(); alert('Selecione um título para 2ª via');}}>⚡ 2ª Via</button>
                    </div>
                 </div>
              </div>

              {/* TABLE CONTROLS */}
              <div style={{padding:'10px 0', display:'flex', alignItems:'center', gap:10}}>
                 <label style={{display:'flex',alignItems:'center',gap:8,fontSize:11,fontWeight:700,cursor:'pointer',background:'hsl(var(--bg-elevated))',padding:'6px 12px',borderRadius:8,border:'1px solid hsl(var(--border-subtle))'}}>
                   <input type="checkbox" checked={isAllSelected} onChange={(e) => {
                       if (e.target.checked) setParcelasSelected(pFilt.map(p => p.num))
                       else setParcelasSelected([])
                   }} style={{cursor:'pointer', width:14, height:14}}/> Sel. Todos
                 </label>
                 <div style={{display:'flex',background:'hsl(var(--bg-elevated))',borderRadius:8,border:'1px solid hsl(var(--border-subtle))',overflow:'hidden'}}>
                   <button type="button" className="btn btn-sm" style={{borderRadius:0,border:0,borderRight:'1px solid hsl(var(--border-subtle))',background:fin._filtro==='todos'?'rgba(99,102,241,0.1)':'transparent',color:fin._filtro==='todos'?'#6366f1':'hsl(var(--text-muted))',fontSize:11, fontWeight:700}} onClick={(e)=>{e.preventDefault(); setFin((f:any)=>({...f,_filtro:'todos'}))}}>Todos ({parcelas.filter(p=>p.status!=='cancelado').length})</button>
                   <button type="button" className="btn btn-sm" style={{borderRadius:0,border:0,borderRight:'1px solid hsl(var(--border-subtle))',background:fin._filtro==='pendente'?'rgba(239,68,68,0.1)':'transparent',color:fin._filtro==='pendente'?'#ef4444':'hsl(var(--text-muted))',fontSize:11, fontWeight:700}} onClick={(e)=>{e.preventDefault(); setFin((f:any)=>({...f,_filtro:'pendente'}))}}>A Vencer / Vencidos ({aV.length + ven.length})</button>
                   <button type="button" className="btn btn-sm" style={{borderRadius:0,border:0,background:fin._filtro==='pago'?'rgba(16,185,129,0.1)':'transparent',color:fin._filtro==='pago'?'#10b981':'hsl(var(--text-muted))',fontSize:11, fontWeight:700}} onClick={(e)=>{e.preventDefault(); setFin((f:any)=>({...f,_filtro:'pago'}))}}>Pago ({parcelas.filter(p=>p.status==='pago').length})</button>
                 </div>

                 {parcelasSelected.length > 0 && (
                   <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:8, background:'rgba(99,102,241,0.05)', padding:'6px 12px', borderRadius:20, border:'1px solid rgba(99,102,241,0.3)', color:'#6366f1', fontSize:11, fontWeight:800}}>
                     I R$ {fmtMoeda(pFilt.filter(p=>parcelasSelected.includes(p.num)).reduce((s,p)=>s+p.valor,0))} ×
                   </div>
                 )}
                 <button type="button" className="btn btn-sm" onClick={(e)=>{e.preventDefault(); setModalEventoFin(true)}} style={{marginLeft:parcelasSelected.length>0?0:'auto', background:'linear-gradient(135deg, #8b5cf6, #6366f1)', color:'#fff', border:'none', fontSize:11, fontWeight:800, padding:'6px 16px', borderRadius:20, boxShadow:'0 0 10px rgba(99,102,241,0.4)'}}>+ Adicionar Evento</button>
              </div>

              {/* TABLE */}
              <div style={{background:'hsl(var(--bg-elevated))', borderRadius:12, border:'1px solid hsl(var(--border-subtle))', overflow:'hidden', boxShadow:'0 4px 20px rgba(0,0,0,0.03)'}}>
                 <table className="table" style={{margin:0,width:'100%',borderCollapse:'collapse'}}>
                    <thead style={{background:'hsl(var(--bg-base))',color:'hsl(var(--text-muted))',fontWeight:800,fontSize:10,textTransform:'uppercase',letterSpacing:.5, borderBottom:'2px solid hsl(var(--border-subtle))'}}>
                      <tr>
                        <th style={{padding:'14px 8px 14px 16px',width:30}}><input type="checkbox" style={{opacity:0}}/></th>
                        <th style={{padding:'14px',width:50,textAlign:'center'}}>PARC.</th>
                        <th style={{padding:'14px'}}>EVENTO / COMPETÊNCIA</th>
                        <th style={{padding:'14px',textAlign:'center'}}>VENCIMENTO</th>
                        <th style={{padding:'14px',textAlign:'right'}}>VALOR BRUTO</th>
                        <th style={{padding:'14px',textAlign:'center'}}>DESCONTO</th>
                        <th style={{padding:'14px',textAlign:'right'}}>JUROS</th>
                        <th style={{padding:'14px',textAlign:'right'}}>MULTA</th>
                        <th style={{padding:'14px',textAlign:'right'}}>TOTAL A PAGAR</th>
                        <th style={{padding:'14px',textAlign:'center'}}>PAGAMENTO</th>
                        <th style={{padding:'14px',textAlign:'center'}}>AÇÃO</th>
                        <th style={{padding:'14px',textAlign:'center'}}>DT. EMISSÃO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pFilt.map((p, idx) => {
                         const sel = parcelasSelected.includes(p.num);
                         const isVencido = p.status === 'vencido';
                         const isPago = p.status === 'pago';
                         const bgColor = sel ? 'rgba(99,102,241,0.05)' : idx%2===0?'transparent':'hsl(var(--bg-base))';
                         
                         const mantemDesc = (p as any).manterDescontoApósVencimento;

                         return (
                           <tr key={p.num} onClick={()=>setParcelasSelected(prev=>prev.includes(p.num)?prev.filter(x=>x!==p.num):[...prev,p.num])} style={{background:bgColor, borderBottom:'1px solid hsl(var(--border-subtle))', cursor:'pointer', transition:'all 0.2s'}}>
                             <td style={{padding:'14px 8px 14px 16px'}}><input type="checkbox" checked={sel} readOnly style={{cursor:'pointer', width:14, height:14, accentColor:'#6366f1'}}/></td>
                             <td style={{padding:'14px',textAlign:'center'}}>
                               {mat?.turmaId ? <div style={{fontSize:8,fontWeight:800,color:'#8b5cf6',marginBottom:4, whiteSpace:'nowrap'}}>{(p as any).turma||mat?.turmaId}</div> : null}
                               <div style={{fontSize:14,fontWeight:900,color:isVencido?'#ef4444':'#6366f1'}}>{p.num}</div>
                               <div style={{fontSize:9,color:'hsl(var(--text-muted))',marginTop:2}}>/{(p as any).totalParc||(mat as any).totalParcelas||1}</div>
                             </td>
                             <td style={{padding:'14px'}}>
                               <div style={{fontSize:12,fontWeight:800,color:'hsl(var(--text-base))'}}>{p.evento || 'Mensalidade'}</div>
                               <div style={{fontSize:10,color:'hsl(var(--text-muted))',marginTop:2}}>{p.competencia || 'Competência'}</div>
                               <div style={{display:'inline-flex',alignItems:'center',gap:4,marginTop:6,padding:'2px 6px',borderRadius:4,fontSize:9,fontWeight:800,background:isVencido?'rgba(239,68,68,0.1)':isPago?'rgba(16,185,129,0.1)':'rgba(56,189,248,0.1)',color:isVencido?'#ef4444':isPago?'#10b981':'#38bdf8'}}>
                                 {isVencido?'⚠️ Vencido':isPago?'✓ Pago':'• Pendente'}
                               </div>
                             </td>
                             <td style={{padding:'14px',textAlign:'center'}}>
                               <div style={{fontSize:12,fontWeight:800,color:isVencido?'#ef4444':'hsl(var(--text-base))'}}>{p.vencimento}</div>
                               {isVencido && <div style={{fontSize:9,color:'#ef4444',marginTop:4}}>{(p as any).diasAtraso || 0}d atraso</div>}
                               {isPago && <div style={{fontSize:9,color:'#10b981',marginTop:4}}>pago em {p.dtPagto}</div>}
                             </td>
                             <td style={{padding:'14px',textAlign:'right',fontSize:13,fontWeight:800,fontFamily:'monospace'}}>R$ {fmtMoeda(p.valor)}</td>
                             <td style={{padding:'14px',textAlign:'center'}}>
                               {p.desconto > 0 ? (
                                 <>
                                   <div style={{fontSize:11,fontWeight:800,color:'#ea580c',fontFamily:'monospace'}}>- R$ {fmtMoeda(p.desconto)} <span style={{fontSize:9}}>({((p.desconto/p.valor)*100).toFixed(1)}%)</span></div>
                                   {isVencido && !mantemDesc ? (
                                     <div style={{fontSize:9,color:'#ef4444',marginTop:6,display:'inline-flex',flexDirection:'column'}}>
                                       <span style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',padding:'2px 6px',borderRadius:20}}>❌ Perde Desc.</span>
                                       <span style={{fontSize:8,marginTop:2}}>(perdido no vcto)</span>
                                     </div>
                                   ) : (
                                     <div style={{fontSize:9,color:'#10b981',marginTop:6,display:'inline-flex',flexDirection:'column'}}>
                                       <span style={{background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.2)',padding:'2px 6px',borderRadius:20}}>✔️ Mantém Desc.</span>
                                     </div>
                                   )}
                                 </>
                               ) : <span style={{color:'hsl(var(--border-strong))'}}>—</span>}
                             </td>
                             <td style={{padding:'14px',textAlign:'right',fontSize:12,fontWeight:800,color:'#ef4444',fontFamily:'monospace'}}>{(p as any).juros>0 ? `R$ ${fmtMoeda((p as any).juros)}` : <span style={{color:'hsl(var(--border-strong))'}}>—</span>}</td>
                             <td style={{padding:'14px',textAlign:'right',fontSize:12,fontWeight:800,color:'#ef4444',fontFamily:'monospace'}}>{(p as any).multa>0 ? `R$ ${fmtMoeda((p as any).multa)}` : <span style={{color:'hsl(var(--border-strong))'}}>—</span>}</td>
                             <td style={{padding:'14px',textAlign:'right'}}>
                               <div style={{fontSize:13,fontWeight:900,color:(isVencido || (p as any).juros>0)?'#ef4444':'hsl(var(--text-base))',fontFamily:'monospace'}}>R$ {fmtMoeda(p.valorFinal+((p as any).juros||0)+((p as any).multa||0))}</div>
                               {((p as any).juros>0 || (p as any).multa>0) && <div style={{fontSize:9,color:'#ef4444',marginTop:4}}>c/ encargos</div>}
                             </td>
                             <td style={{padding:'14px',textAlign:'center'}}>
                               {isPago ? <div style={{fontSize:11,fontWeight:800,color:'#10b981'}}>Pago</div> : <span style={{color:'hsl(var(--border-strong))'}}>—</span>}
                             </td>
                             <td style={{padding:'14px',textAlign:'center'}}>
                               <div style={{fontSize:10,color:'hsl(var(--text-muted))'}}>Sem boleto</div>
                             </td>
                             <td style={{padding:'14px',textAlign:'center'}}>
                               <div style={{fontSize:10,fontWeight:700,color:'#6366f1',background:'rgba(99,102,241,0.05)',padding:'4px 8px',borderRadius:4,display:'inline-flex',alignItems:'center',gap:4}}>
                                 🗓️ {new Date().toLocaleDateString('pt-BR')}
                               </div>
                             </td>
                           </tr>
                         )
                      })}
                    </tbody>
                 </table>
                 
                 {/* Footer Sumário */}
                 <div style={{display:'flex',alignItems:'center',gap:16,padding:'16px 24px',fontSize:11,color:'hsl(var(--text-muted))',background:'hsl(var(--bg-elevated))', borderTop:'2px solid hsl(var(--border-subtle))'}}>
                   <div style={{fontWeight:700}}>Total · {pFilt.length} parcelas</div>
                   <div style={{fontWeight:700}}>A Vencer: {aV.length} · <span style={{color:'#ef4444'}}>Vencido: {ven.length}</span></div>
                   <div style={{marginLeft:'auto',display:'flex',gap:24,fontFamily:'monospace',fontSize:13,fontWeight:800,color:'hsl(var(--text-base))'}}>
                      <span>R$ {fmtMoeda(totalBruto)}</span>
                      <span style={{color:'#ea580c'}}>- R$ {fmtMoeda(totalDesc)}</span>
                      <span style={{color:'#ef4444'}}>+ R$ {fmtMoeda(totalEncargos)}</span>
                      <span style={{color:'#10b981'}}>R$ {fmtMoeda(totalLiq)}</span>
                   </div>
                 </div>
                 
                 <div style={{padding:'12px 24px',display:'flex',gap:24,fontSize:10,fontWeight:800,textTransform:'uppercase',borderTop:'1px solid hsl(var(--border-subtle))',background:'hsl(var(--bg-base))'}}>
                   <span style={{color:'hsl(var(--text-muted))'}}>A Vencer <span style={{color:'#6366f1'}}>R$ {fmtMoeda(aV.reduce((s,p)=>s+p.valorFinal,0))}</span></span>
                   <span style={{color:'hsl(var(--text-muted))'}}>Vencido <span style={{color:'#ef4444'}}>R$ {fmtMoeda(ven.reduce((s,p)=>s+p.valorFinal+((p as any).juros||0)+((p as any).multa||0),0))} {ven.length>0 && <span style={{background:'rgba(239,68,68,0.1)',padding:'2px 4px',borderRadius:4,fontSize:8,marginLeft:4}}>ATRASO</span>}</span></span>
                   <span style={{color:'hsl(var(--text-muted))'}}>Recebido: <span style={{color:'#10b981'}}>R$ {fmtMoeda(totalPago)}</span></span>
                   <span style={{color:'hsl(var(--text-muted))'}}>Parcelas <span style={{color:'hsl(var(--text-base))'}}>{parcelas.filter(p=>p.status!=='cancelado').length}</span></span>
                   <span style={{color:'hsl(var(--text-muted))'}}>Canceladas <span style={{color:'#ef4444'}}>{parcelas.filter(p=>p.status==='cancelado').length}</span></span>
                 </div>
              </div>
            </div>
          )
        })()}
      </div>
    </div>,

// STEP 5: Contratos// STEP 5: Contratos
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
            {/* Linha 1: Aluno + Código */}
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
            <div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>Código {(alunoEditando as any)?.matricula} · Atualize os dados abaixo e clique em Salvar.</div>
          </div>
        </div>
      )}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'20px 32px 0',marginBottom:20}}>
        <div>
          <h1 className="page-title" style={{margin:0}}>{isEdicao ? 'Editar Matrícula' : 'Nova Matricula'}</h1>
          <p className="page-subtitle" style={{margin:'2px 0 0'}} suppressHydrationWarning>
            {isEdicao ? `Editando dados de ${(alunoEditando as any)?.nome ?? ''}` : `Processo completo · 6 etapas · Código ${numMatricula}`}
          </p>
        </div>
        <div style={{display:'flex',gap:12,alignItems:'center'}}>
          <button className="btn" style={{background:'linear-gradient(135deg, #10b981, #059669)',color:'#fff',fontSize:13,fontWeight:700,padding:'8px 20px',border:'none',boxShadow:'0 4px 14px rgba(16,185,129,0.3)',cursor:'pointer',borderRadius:8}} onClick={() => handleFinalizar(false)} disabled={salvando}>
            {salvando?<><Loader2 size={14} style={{animation:'spin 1s linear infinite',marginRight:6}}/>Salvando...</>:<><Check size={16} style={{marginRight:6,color:'#fff'}}/>{isEdicao ? 'Salvar Alterações' : 'Concluir'}</>}
          </button>
          <button className="btn" style={{background:'hsl(var(--bg-elevated))',color:'hsl(var(--text-muted))',fontSize:13,fontWeight:600,padding:'8px 16px',border:'1px solid hsl(var(--border-subtle))',cursor:'pointer',borderRadius:8}} onClick={()=>router.push('/academico/alunos')}><X size={15} style={{marginRight:6}}/>Cancelar</button>
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
        <div style={{display:'flex',gap:14,alignItems:'center'}}>
          <span style={{fontSize:12,color:'hsl(var(--text-muted))',fontWeight:600}}>Etapa {step+1} de {STEPS.length}</span>
          <button className="btn" style={{background:'linear-gradient(135deg, #10b981, #059669)',color:'#fff',fontSize:13,fontWeight:700,padding:'8px 20px',border:'none',boxShadow:'0 4px 14px rgba(16,185,129,0.3)',cursor:'pointer',borderRadius:8}} onClick={() => handleFinalizar(true)} disabled={salvando}>
            {salvando?<><Loader2 size={14} style={{animation:'spin 1s linear infinite',marginRight:6}}/>Salvando...</>:<><Check size={16} style={{marginRight:6,color:'#fff'}}/>Concluir e Salvar</>}
          </button>
        </div>
        {step<STEPS.length-1
          ? <button className="btn btn-primary" onClick={()=>setStep(s=>s+1)}>Proximo<ChevronRight size={15}/></button>
          : <button className="btn btn-primary" disabled={salvando} onClick={() => handleFinalizar()} style={{background:'linear-gradient(135deg,#10b981,#059669)'}}>
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


      {/* ─── Restauracao de Modais Financeiros ─── */}
            <ExtratoModal
        aberto={modalExtrato}
        onFechar={() => setModalExtrato(false)}
        aluno={(alunoEditando || aluno || {nome: ""})} // fallback
        parcelas={parcelas}
        todosResp={todosResp || []}
        mat={mat || {}}
        turmas={turmas || []}
        cfgEventos={Array.isArray(cfgEventos) ? cfgEventos : []}
      />
      {modalRecibo && <ReceiptModal open={modalRecibo} onClose={() => setModalRecibo(false)} reciboId={(parcelaAtiva?.id || parcelaAtiva?.codPreview || 1).toString()} title="Recibo de Parcela" />}
            {modalBoleto && alunoEditando && parcelasParaBoleto.length > 0 && (
        <ModalEmitirAluno
          aluno={alunoEditando as Aluno}
          parcelasRaw={parcelasParaBoleto}
          convenios={cfgConvenios}
          titulos={titulos}
          onEmitido={(titulosAtualizados, novoSeq, convenioId) => {
            setTitulos((prev) => {
              const mapa = new Map(prev.map((t) => [t.id, t]))
              for (const t of titulosAtualizados) mapa.set(t.id, t)
              return Array.from(mapa.values())
            })
            setCfgConvenios((prev) => prev.map((c) =>
              c.id === convenioId ? { ...c, nossoNumeroSequencial: novoSeq } : c
            ))
            setModalBoleto(false);
            setParcelasParaBoleto([]);
            setParcelasSelected([]);
          }}
          onClose={() => { setModalBoleto(false); setParcelasParaBoleto([]) }}
        />
      )}
            {modalHistorico && alunoEditando && (
        <ModalHistoricoBoletos
          aluno={alunoEditando as Aluno}
          titulos={titulos}
          onSolicitarVia={(titulo) => { setModalHistorico(false); setModal2aVia(titulo as any) }}
          onClose={() => setModalHistorico(false)}
        />
      )}
      {modal2aVia && <Modal2aVia titulo={modal2aVia} onClose={() => setModal2aVia(null)} />}

      {modalBaixaLote && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModalBaixaLote(false) }} style={{ zIndex: 1000, position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div className="modal" style={{ background:'#fff', borderRadius:16, maxWidth: 500, width: '100%', display: 'flex', flexDirection: 'column', boxShadow:'0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 17, fontWeight: 700 }}>Baixar Parcela(s)</h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setModalBaixaLote(false)}><X size={16} /></button>
            </div>
            <div style={{ padding: '20px 24px', display:'flex', flexDirection:'column', gap:16 }}>
              <div><label className="form-label" style={{fontSize:12, fontWeight:600,color:'#64748b'}}>Data de Pagamento</label>
                <input type="date" className="form-input" value={baixaLoteForm.dataPagto} onChange={e => setBaixaLoteForm({ ...baixaLoteForm, dataPagto: e.target.value })} />
              </div>
              <div><label className="form-label" style={{fontSize:12, fontWeight:600,color:'#64748b'}}>Forma de Pagamento</label>
                <select className="form-input" value={baixaLoteForm.formaPagto} onChange={e => setBaixaLoteForm({ ...baixaLoteForm, formaPagto: e.target.value })}>
                  <option value="PIX">PIX</option><option value="Dinheiro">Dinheiro</option><option value="Boleto">Boleto</option><option value="Cartão">Cartão</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div><label style={{fontSize:12, fontWeight:600,color:'#64748b'}}>Juros Adic. (R$)</label>
                  <input type="text" className="form-input" value={baixaLoteForm.juros} onChange={e => setBaixaLoteForm({ ...baixaLoteForm, juros: e.target.value })} /></div>
                <div><label style={{fontSize:12, fontWeight:600,color:'#64748b'}}>Desconto Adic. (R$)</label>
                  <input type="text" className="form-input" value={baixaLoteForm.desconto} onChange={e => setBaixaLoteForm({ ...baixaLoteForm, desconto: e.target.value })} /></div>
              </div>
              <div><label style={{fontSize:12, fontWeight:600,color:'#64748b'}}>Observação</label>
                <input type="text" className="form-input" value={baixaLoteForm.obs} onChange={e => setBaixaLoteForm({ ...baixaLoteForm, obs: e.target.value })} />
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setModalBaixaLote(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => {
                const ids = parcelasSelected;
                setParcelas(prev => prev.map((p) => {
                  if (ids.includes(p.num) && p.status !== 'pago') {
                    return { ...p, status: 'pago', dtPagto: baixaLoteForm.dataPagto.split('-').reverse().join('/'), formaPagto: baixaLoteForm.formaPagto, obs: baixaLoteForm.obs, juros: parseFloat(baixaLoteForm.juros.replace(',','.')||'0'), multa: parseFloat(baixaLoteForm.multa.replace(',','.')||'0') };
                  }
                  return p;
                }));
                setModalBaixaLote(false); setParcelasSelected([]);
                setToastMsg('Parcelas baixadas!'); setTimeout(()=>setToastMsg(''), 3000);
              }}>Confirmar Baixa</button>
            </div>
          </div>
        </div>
      )}

      {modalDescontoLote && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModalDescontoLote(false) }} style={{ zIndex: 1000, position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div className="modal" style={{ background:'#fff', borderRadius:16, maxWidth: 400, width: '100%', padding: 0 }}>
             <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 17, fontWeight: 700 }}>Desconto em Lote</h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setModalDescontoLote(false)}><X size={16} /></button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div><label style={{fontSize:12, fontWeight:600,color:'#64748b'}}>Novo Desconto (R$ ou %)</label>
                <input type="text" className="form-input" value={loteData?.desconto||''} onChange={e=>setLoteData({...loteData, desconto:e.target.value})} placeholder="Ex: 50.00" /></div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop:24 }}>
                <button className="btn btn-secondary" onClick={() => setModalDescontoLote(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={() => {
                  const val = parseFloat((loteData?.desconto||'').replace(',', '.'));
                  if(!isNaN(val)) {
                    setParcelas(prev => prev.map((p) => {
                      if (parcelasSelected.includes(p.num)) return { ...p, desconto: val, valorFinal: Math.max(0, p.valor - val) };
                      return p;
                    }));
                  }
                  setModalDescontoLote(false); setParcelasSelected([]);
                }}>Aplicar Desconto</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalVencimentoLote && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModalVencimentoLote(false) }} style={{ zIndex: 1000, position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div className="modal" style={{ background:'#fff', borderRadius:16, maxWidth: 400, width: '100%', padding: 0 }}>
             <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 17, fontWeight: 700 }}>Alterar Vencimento Lote</h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setModalVencimentoLote(false)}><X size={16} /></button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div><label style={{fontSize:12, fontWeight:600,color:'#64748b'}}>Nova Data</label>
                <input type="date" className="form-input" value={loteData?.dtVcto||''} onChange={e=>setLoteData({...loteData, dtVcto:e.target.value})} /></div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop:24 }}>
                <button className="btn btn-secondary" onClick={() => setModalVencimentoLote(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={() => {
                  const ndt = (loteData?.dtVcto||'').split('-').reverse().join('/');
                  setParcelas(prev => prev.map((p) => {
                    if (parcelasSelected.includes(p.num)) return { ...p, vencimento: ndt };
                    return p;
                  }));
                  setModalVencimentoLote(false); setParcelasSelected([]);
                }}>Confirmar Data</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalEditarParcela && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModalEditarParcela(false) }} style={{ zIndex: 1000, position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div className="modal" style={{ background:'#fff', borderRadius:16, maxWidth: 450, width: '100%', padding: 0 }}>
             <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 17, fontWeight: 700 }}>Editar Parcela {parcelaAtiva?.num}</h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setModalEditarParcela(false)}><X size={16} /></button>
            </div>
            <div style={{ padding: '20px 24px', display:'flex', flexDirection:'column', gap:16 }}>
              <div><label style={{fontSize:12, fontWeight:600,color:'#64748b'}}>Novo Valor Bruto (R$)</label>
                <input type="text" className="form-input" value={parcelaAtiva?.valor} onChange={e=>setParcelaAtiva({...parcelaAtiva, valor:e.target.value})} /></div>
              <div><label style={{fontSize:12, fontWeight:600,color:'#64748b'}}>Novo Desconto (R$)</label>
                <input type="text" className="form-input" value={parcelaAtiva?.desconto} onChange={e=>setParcelaAtiva({...parcelaAtiva, desconto:e.target.value})} /></div>
              <div><label style={{fontSize:12, fontWeight:600,color:'#64748b'}}>Novo Vencimento</label>
                <input type="date" className="form-input" value={parcelaAtiva?.vencimento?.split('/').reverse().join('-') || ''} onChange={e=>setParcelaAtiva({...parcelaAtiva, vencimento:e.target.value.split('-').reverse().join('/')})} /></div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
               <button className="btn btn-secondary" onClick={() => setModalEditarParcela(false)}>Cancelar</button>
               <button className="btn btn-primary" onClick={() => {
                 setParcelas(prev => prev.map((p) => {
                    if (p.num === parcelaAtiva.num) {
                      const v = parseFloat(parcelaAtiva.valor?.toString().replace(',','.')||'0');
                      const d = parseFloat(parcelaAtiva.desconto?.toString().replace(',','.')||'0');
                      return { ...p, valor: v, desconto: d, valorFinal: Math.max(0, v - d), vencimento: parcelaAtiva.vencimento };
                    }
                    return p;
                 }));
                 setModalEditarParcela(false);
               }}>Salvar Edição</button>
            </div>
          </div>
        </div>
      )}
      
      {modalEventoFin && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModalEventoFin(false) }} style={{ zIndex: 1000, position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div className="modal" style={{ background:'#fff', borderRadius:16, maxWidth: 500, width: '100%', padding: 0 }}>
             <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 17, fontWeight: 700 }}>Adicionar Evento Múltiplo</h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setModalEventoFin(false)}><X size={16} /></button>
            </div>
            <div style={{ padding: '20px 24px', display:'flex', flexDirection:'column', gap:16, maxHeight:'70vh', overflowY:'auto' }}>
                <div><label style={{fontSize:12, fontWeight:600,color:'#64748b'}}>Nome do Evento</label><input type="text" className="form-input" value={eventoForm.eventoNome} onChange={e=>setEventoForm({...eventoForm, eventoNome:e.target.value})} placeholder="Mensalidade, Material..." /></div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                  <div><label style={{fontSize:12, fontWeight:600,color:'#64748b'}}>Parcela Inicial</label><input type="number" className="form-input" value={eventoForm.parcelaInicial} onChange={e=>setEventoForm({...eventoForm, parcelaInicial:e.target.value})} /></div>
                  <div><label style={{fontSize:12, fontWeight:600,color:'#64748b'}}>Parcela Final</label><input type="number" className="form-input" value={eventoForm.parcelaFinal} onChange={e=>setEventoForm({...eventoForm, parcelaFinal:e.target.value})} /></div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                  <div><label style={{fontSize:12, fontWeight:600,color:'#64748b'}}>Primeiro Vencimento</label><input type="date" className="form-input" value={eventoForm.vencimentoInicial} onChange={e=>setEventoForm({...eventoForm, vencimentoInicial:e.target.value})} /></div>
                  <div><label style={{fontSize:12, fontWeight:600,color:'#64748b'}}>Valor Unitário (R$)</label><input type="text" className="form-input" value={eventoForm.valor} onChange={e=>setEventoForm({...eventoForm, valor:e.target.value})} /></div>
                </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setModalEventoFin(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => {
                const qtd = Number(eventoForm.parcelaFinal) - Number(eventoForm.parcelaInicial) + 1;
                if(qtd > 0 && eventoForm.valor && eventoForm.eventoNome) {
                  const val = parseFloat(eventoForm.valor.replace(',','.'));
                  let dataInit = new Date(eventoForm.vencimentoInicial+'T12:00');
                  if (isNaN(dataInit.getTime())) dataInit = new Date();
                  const novas = Array.from({length: qtd}).map((_, i) => {
                    const dt = new Date(dataInit);
                    dt.setMonth(dt.getMonth() + i);
                    return {
                      num: parcelas.length + i + 1,
                      numParcela: Number(eventoForm.parcelaInicial) + i,
                      totalParcelas: Number(eventoForm.parcelaFinal),
                      evento: eventoForm.eventoNome,
                      vencimento: dt.toLocaleDateString('pt-BR'),
                      valor: val,
                      desconto: 0,
                      valorFinal: val,
                      status: 'pendente',
                    };
                  });
                  setParcelas((prev) => [...prev, ...novas]);
                  setModalEventoFin(false);
                  setToastMsg('Evento gerado e parcelas adicionadas.'); setTimeout(()=>setToastMsg(''), 3000);
                }
              }}>Gerar Banco de Parcelas</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
