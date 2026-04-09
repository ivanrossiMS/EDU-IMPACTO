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
import dynamic from 'next/dynamic'
const ExtratoModal = dynamic(() => import('@/components/financeiro/ExtratoModal'), { ssr: false })
import { ReceiptModal } from '@/components/financeiro/ReceiptModal'
import { useDialog } from '@/lib/dialogContext'

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

// --- MAIN ---
export default function NovaMatriculaPage() {
  const genCodigo = () => String(Math.floor(100000 + Math.random() * 900000))
  const router = useRouter()
  const dlg = useDialog()
  const { alunos = [], setAlunos, titulos = [], setTitulos, turmas = [], cfgNiveisEnsino = [], cfgPadroesPagamento = [], cfgGruposDesconto = [], cfgEventos = [], cfgMetodosPagamento = [], cfgCartoes = [], cfgConvenios = [], setCfgConvenios, cfgSituacaoAluno = [], cfgTurnos = [], cfgGruposAlunos = [], caixasAbertos = [], setCaixasAbertos, movimentacoesManuais = [], setMovimentacoesManuais, logSystemAction } = useData() || {}
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

  const sourceAlunos = alunos || []
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

  // Função utilitária global para calcular juros e multa
  const calcAtraso = useCallback((p: any, dataPagtoStr?: string) => {
    if (p.status === 'pago' || p.status === 'isento') return { juros: p.juros || 0, multa: p.multa || 0, dias: 0, descAplicado: p.desconto || 0 }
    if (!p.vencimento) return { juros: 0, multa: 0, dias: 0, descAplicado: p.desconto || 0 }
    
    const dataAlvo = dataPagtoStr ? new Date(dataPagtoStr + 'T12:00:00') : new Date()
    dataAlvo.setHours(0, 0, 0, 0)
    
    const [d, m, a] = p.vencimento.split('/')
    if (!d || !m || !a) return { juros: 0, multa: 0, dias: 0, descAplicado: p.desconto || 0 }
    const dv = new Date(`${a}-${m}-${d}T12:00:00`)
    dv.setHours(0, 0, 0, 0)
    
    const dias = Math.max(0, Math.floor((dataAlvo.getTime() - dv.getTime()) / 86400000))
    if (dias <= 0) return { juros: p.juros || 0, multa: p.multa || 0, dias: 0, descAplicado: p.desconto || 0 }
    
    const juros = +(p.valor * 0.00033 * dias).toFixed(2)
    const multa = +(p.valor * 0.02).toFixed(2)
    const descAplicado = (p.desconto && !(p as any).manterDesconto) ? 0 : (p.desconto || 0)
    return { juros, multa, dias, descAplicado }
  }, [])


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
      void dlg.alert('Erro ao gerar documento: ' + (err?.message ?? 'Erro desconhecido.'), { type: 'error' })
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
  const [baixaLoteParcelas, setBaixaLoteParcelas] = useState<any[]>([])
  const [baixaLoteForm, setBaixaLoteForm] = useState({dataPagto: new Date().toISOString().split('T')[0], formaPagto:'PIX', comprovante:'', obs:'', codPreview:''})
  const [baixaLoteMultiFormas, setBaixaLoteMultiFormas] = useState<{id:string;forma:string;valor:string;cartao:any}[]>([{id:'f1',forma:'PIX',valor:'',cartao:null}])
  const [modalCartao, setModalCartao] = useState(false)
  const [cartaoFormIdx, setCartaoFormIdx] = useState(0)
  const [cartaoCtx, setCartaoCtx] = useState<'baixa'|'baixaResp'|'baixaLote'>('baixa')
  const [cartaoForm, setCartaoForm] = useState({bandeira:'Visa',numero:'',nome:'',validade:'',parcelas:'1',autorizacao:''})
  const [parcelasSelected, setParcelasSelected] = useState<number[]>([])
  const [descLote, setDescLote] = useState<{tipo:'%'|'R$';valor:string;deParcela:string;ateParcela:string;eventoId?:string;parcelasEvento?:number[]}>({tipo:'%',valor:'',deParcela:'1',ateParcela:'1',eventoId:'',parcelasEvento:[]})
  const [vctoForm, setVctoForm] = useState({deParcela:'1',ateParcela:'1',novoDia:'',eventoFiltro:''})
  const [eventoForm, setEventoForm] = useState({turmaId:'',turmaNome:'',eventoNome:'',eventoId:'',vencimentoInicial:'',parcelaInicial:'1',parcelaFinal:'1',tipoVencimento:'diaX' as 'diaX'|'30dias',diaVcto:'5',valor:'',tipoValor:'total' as 'total'|'parcela',descTipo:'%' as '%'|'R$',descValor:'',manterDesconto:false})
  const [obsFinForm, setObsFinForm] = useState({parcelas:[] as number[], obs:'' })
  const [alterarValorForm, setAlterarValorForm] = useState({parcelas:[] as number[], eventoFiltro:'', novoValor:'', motivo:''})
  const [turmaResumoId, setTurmaResumoId] = useState<string>('auto')
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

  const getEventoDisp = (p: any) => {
    if (p.eventoId) {
      const ev = cfgEventos.find((e:any) => e.id === p.eventoId);
      if (ev?.descricao) return ev.descricao;
    }
    return p.evento || 'Mensalidade';
  };

  // 🛡️ MOTOR FINANCEIRO CENTRAL
  // Substitui calcAtraso e calcJurosMulta resolvendo anomalias de recálculo retroativo e desconto vitalício
  const getResumoFinanceiro = (parc: any, dataRef?: string) => {
    const isManual = !!(parc as any).isManual;
    const vBruto = parseFloat(parc.valor) || 0;
    
    if (parc.status === 'pago' || parc.status === 'isento') {
      return { 
        juros: parc.juros||0, 
        multa: parc.multa||0, 
        dias: 0,
        desconto: parc.desconto||0,
        vFinal: parc.valorFinal||vBruto
      }
    }

    if (!parc?.vencimento) return { juros: 0, multa: 0, dias: 0, desconto: parc.desconto||0, vFinal: parc.valorFinal||vBruto }

    const dv = new Date(parc.vencimento.split('/').reverse().join('-') + 'T12:00')
    const dp = dataRef ? new Date(dataRef + 'T12:00') : new Date(); dp.setHours(12, 0, 0, 0)
    const dias = Math.max(0, Math.floor((dp.getTime() - dv.getTime()) / 86400000))

    if (isManual) {
      return {
        juros: parc.juros || 0,
        multa: parc.multa || 0,
        dias,
        desconto: parc.desconto || 0,
        vFinal: Math.max(0, +(vBruto - (parc.desconto||0) + (parc.juros||0) + (parc.multa||0)).toFixed(2))
      };
    }

    let mJuros = 0;
    let mMulta = 0;
    let mDesc = parc.desconto || 0;

    if (dias > 0) {
      mJuros = +(vBruto * 0.00033 * dias).toFixed(2);
      mMulta = +(vBruto * 0.02).toFixed(2);
      // Remove o desconto por quebra contratual (vcto. perdido), salvo se houver abono perpétuo (manterDesconto)
      if (!(parc as any).manterDesconto) {
        mDesc = 0;
      }
    }

    return {
      juros: mJuros,
      multa: mMulta,
      dias,
      desconto: mDesc,
      vFinal: Math.max(0, +(vBruto - mDesc + mJuros + mMulta).toFixed(2))
    }
  }

  const gerarParcelas = (): any[] => {
    const valor = parseMoeda(fin.valorMensalidade)
    const total = parseInt(fin.totalParcelas)||12
    const dia = parseInt(fin.diaVencimento)||10
    if (!valor || !total) return []
    const ano = parseInt(mat.anoLetivo) || new Date().getFullYear()
    const padrao = cfgPadroesPagamento.find(p=>p.id===fin.padraoId)
    const evtId = (padrao as any)?.eventoId || padrao?.parcelas?.[0]?.eventoId
    const evtData = evtId ? cfgEventos.find((e:any) => e.id === evtId) : null
    
    const tAssociada = turmas.find(t=>t.id === mat.turmaId)?.nome || ''
    const baseEvName = evtData?.descricao || (padrao as any)?.eventoDescricao || padrao?.parcelas?.[0]?.eventoDescricao || 'Mensalidade'
    
    // Devolve para apenas Mensalidade, sem sufixo no evento, o turmaNome já é armazenado.
    const nomeEvento = baseEvName
    const baseEvId = evtId || newId('EV')
    const novoEventoId = mat.turmaId ? `${baseEvId}_${mat.turmaId}` : baseEvId
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
        turmaId: mat.turmaId || undefined, turmaNome: tAssociada || undefined,
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
        if (!win) { void dlg.alert('Permita pop-ups para gerar o documento.', { type: 'warning' }); return }
        win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${doc.nome}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Georgia,serif;font-size:12pt;color:#000;background:#fff}@page{size:A4;margin:2cm}.wrap{max-width:800px;margin:0 auto}.title{font-size:16pt;font-weight:bold;text-align:center;margin-bottom:24pt}.body{line-height:1.9;white-space:pre-wrap}.footer{margin-top:40pt;display:flex;justify-content:space-between;font-size:10pt;color:#444;border-top:1px solid #ccc;padding-top:8pt}</style></head>
<body><div class="wrap"><div class="title">${doc.nome}</div><div class="body">${conteudo.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br/>')}</div><div class="footer"><span>IMPACTO EDU   ${aluno.nome}   Código ${numMatricula}</span><span>${new Date().toLocaleDateString('pt-BR')}</span></div></div><script>window.onload=function(){setTimeout(function(){window.print()},500)}<\/script></body></html>`)
        win.document.close()
      }
    } catch(err) {
      console.error('Erro ao gerar documento:', err)
      void dlg.alert(`Erro ao gerar "${doc.nome}".\n\nPara .docx: verifique se o arquivo enviado é um .docx válido.\nErro: ${(err as Error)?.message ?? err}`, { type: 'error' })
    } finally {
      setGerandoDoc(null)
    }
  }, [buildAlunoObj, substituirTexto, mapeamentos, MAPA_INT, aluno, numMatricula])
  const canNext = true

  const handleAplicarAlteracaoValor = () => {
    const nv = parseMoeda(alterarValorForm.novoValor);
    if (!nv || alterarValorForm.parcelas.length === 0) return;
    setParcelas(prev => prev.map(p => {
      // 🛡️ Nunca altera parcelas já pagas ou isentas
      if (p.status === 'pago' || p.status === 'isento') return p;
      if (alterarValorForm.parcelas.includes(p.num)) {
        const t = (p as any).descTipo, r = (p as any).descRaw;
        const d = (t === '%' && r) ? +(nv * r / 100).toFixed(2) : p.desconto;
        
        let newObs = p.obs || '';
        if (alterarValorForm.motivo) {
          const mText = `[Alt. Valor p/ ${fmtMoeda(nv)}]: ${alterarValorForm.motivo}`;
          newObs = newObs ? `${newObs} | ${mText}` : mText;
        }

        return {
          ...p,
          valor: nv,
          desconto: d,
          valorFinal: Math.max(0, nv - d),
          obs: newObs
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
    if (isEdicao && !forcarSaida) {
      if (editId) {
        fetch(`/api/alunos/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(console.error)
      }
      setAutoSaveMsg('✅ Todas as alterações foram salvas com sucesso!')
      setTimeout(() => setAutoSaveMsg(''), 4000)
    } else {
      if (isEdicao && forcarSaida && editId) {
        fetch(`/api/alunos/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(console.error)
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
    if (isEdicao && editId) {
      setAlunos(prev => prev.map(a => a.id === editId ? {...a, ...payload} : a))
      // Mock API HTTP só se houver nome garantido
      if (payload.nome && payload.nome.trim()) {
        fetch(`/api/alunos/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(console.error)
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

  // Salva automaticamente após edições explícitas (ex: modal de histórico)
  const autoSaveMountedRef = useRef(false)
  useEffect(() => {
    if (!autoSaveMountedRef.current) {
      autoSaveMountedRef.current = true; return
    }
    const temNomeAluno = (nomeAlunoRef.current || '').trim().length >= 1
    const temNomeResp = todosRespRef.current.some(r => (r.nome || '').trim().length >= 1)
    if (temNomeAluno || temNomeResp) {
      autoSalvarRef.current()
    }
  }, [historico, parcelas])

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
                  const fallbackSeg = [{codigo:'EI',nome:'Educação Infantil'},{codigo:'EF1',nome:'Ensino F. I'},{codigo:'EF2',nome:'Ensino F. II'},{codigo:'EM',nome:'Ensino Médio'},{codigo:'EJA',nome:'EJA'},{codigo:'1',nome:'Educação Infantil'},{codigo:'2',nome:'Ensino Fundamental I'},{codigo:'3',nome:'Ensino Fundamental II'},{codigo:'4',nome:'Ensino Médio'}]
                  const nivelEnsino = turmaH ? (cfgNiveisEnsino.find((n: any) => n.codigo === turmaH.serie) || fallbackSeg.find(s => s.codigo === String(turmaH.serie))) : null
                  const segmentoNome = nivelEnsino?.nome || turmaH?.serie || '—'
                  const padraoH = cfgPadroesPagamento.find(p=>p.id===h.padraoId)
                  const respH = todosResp.find(r=>r.id===h.respFinanceiroId)
                  
                  // Verifica se a situação é considerada Matrícula Ativa no config
                  const sitMatch = cfgSituacaoAluno.find((s: any) => s.nome === h.situacao || s.codigo === h.situacao)
                  const ativa = sitMatch ? (sitMatch.matriculaAtiva ?? false) : (h.situacao === 'Cursando' || h.situacao === 'Prog. Continuada')
                  
                  const bgRow = ativa ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)'
                  const bgRowHover = ativa ? 'rgba(16,185,129,0.14)' : 'rgba(245,158,11,0.14)'
                  const txtColor = ativa ? '#10b981' : '#d97706'

                  return (
                    <tr key={h.id} style={{borderBottom:'1px solid rgba(148,163,184,0.25)',background:bgRow,transition:'all 0.2s',borderLeft:`3px solid ${txtColor}`}}
                      onMouseEnter={e=>(e.currentTarget as HTMLTableRowElement).style.background=bgRowHover}
                      onMouseLeave={e=>(e.currentTarget as HTMLTableRowElement).style.background=bgRow}>
                      <td style={{padding:'8px 12px',fontWeight:700,color:txtColor}}>{h.ano}</td>
                      <td style={{padding:'8px 12px',fontWeight:600}}>{turmaH?.nome||'—'}</td>
                      <td style={{padding:'8px 12px'}}>
                        <span className="badge badge-primary">{segmentoNome}</span>
                      </td>
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
                            void (async () => {
                              if(await dlg.confirm(`Excluir a matrícula de ${h.ano}? Esta ação não pode ser desfeita.`, { title: 'Excluir Matrícula', confirmLabel: 'Excluir', type: 'error' })){
                                setHistorico(prev=>prev.filter(x=>x.id!==h.id))
                              }
                            })()
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
                    <F label="Valor Mens. (R$)">
                      <input className="form-input" style={{fontSize:12}} 
                        value={fin.valorMensalidade} 
                        onChange={e=>{
                          const raw = e.target.value.replace(/\D/g, '')
                          setFin(f=>({...f,valorMensalidade:raw?fmtMoeda(parseInt(raw)/100):''}))
                        }} 
                        placeholder="0,00"
                      />
                    </F>
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
                  
                  {/* Manter Desconto Toggle */}
                  <div style={{marginBottom:18,display:'flex',justifyContent:'flex-end'}}>
                    <button type="button" onClick={()=>setFin((f:any)=>({...f, manterDesconto: !f.manterDesconto}))}
                      style={{padding:'6px 14px',borderRadius:20,border:((fin as any).manterDesconto?'1px solid rgba(16,185,129,0.3)':'1px solid rgba(248,113,113,0.3)'),
                      background:((fin as any).manterDesconto?'rgba(16,185,129,0.1)':'rgba(248,113,113,0.1)'),
                      color:((fin as any).manterDesconto?'#10b981':'#f87171'),fontSize:11,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:6, transition:'all 0.2s'}}>
                      {(fin as any).manterDesconto?<><Check size={13}/> Mantém Desconto se houver atraso</>:<><X size={13}/> Perde Desconto se houver atraso</>}
                    </button>
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
        padding: '20px 28px',
        background: 'linear-gradient(135deg, #09090b 0%, #171723 50%, #1e1b4b 100%)',
        borderBottom: '2px solid rgba(129, 140, 248, 0.5)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        boxShadow: '0 8px 32px rgba(9, 9, 11, 0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
        position: 'relative', overflow: 'hidden', zIndex: 10
      }}>
        <div style={{ position: 'absolute', top: -40, right: '10%', width: 300, height: 300, background: 'radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: '5%', width: 250, height: 250, background: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
        
        <div style={{width:54,height:54,borderRadius:14,background:aluno.foto?'transparent':'linear-gradient(135deg,#6366f1,#8b5cf6)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0,border:'2px solid rgba(255,255,255,0.15)',boxShadow:'0 0 0 4px rgba(255,255,255,0.05),0 8px 16px rgba(0,0,0,0.4)', zIndex: 1}}>
          {aluno.foto?<img src={aluno.foto} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:24,color:'#fff'}}>👤</span>}
        </div>
        <div style={{flex:'0 0 auto', zIndex: 1}}>
          <div style={{fontSize:10,color:'rgba(255,255,255,0.6)',fontWeight:800,letterSpacing:1,textTransform:'uppercase',marginBottom:4}}>Financeiro · Cód. <span style={{color:'#a5b4fc',fontFamily:'monospace',fontWeight:900, background: 'rgba(255,255,255,0.1)', padding:'2px 6px', borderRadius:4}}>{codigoAluno}</span></div>
          <div style={{fontWeight:900,fontSize:17,letterSpacing:-.5,color:'#ffffff',lineHeight:1}}>{aluno.nome||'—'}</div>
        </div>
        <div style={{width:1,height:36,background:'rgba(255,255,255,0.15)',flexShrink:0, margin: '0 4px', zIndex: 1}}/>
        <div style={{flex:'0 0 auto', zIndex: 1}}>
          <div style={{fontSize:10,color:'rgba(255,255,255,0.6)',fontWeight:800,letterSpacing:.8,textTransform:'uppercase',marginBottom:4}}>Resp. Financeiro</div>
          <div style={{fontWeight:800,fontSize:13,color:'#c7d2fe'}}>{todosResp.find(r=>r.respFinanceiro)?.nome||'—'}</div>
        </div>
        <div style={{marginLeft:'auto',display:'flex',gap:12,alignItems:'center',flexWrap:'wrap', zIndex: 1}}>
          {/* Botão de Observação Financeira — sempre visível */}
          <button
            type="button"
            onClick={()=>setModalObsAluno(true)}
            style={{
              fontSize:11,padding:'8px 16px',borderRadius:20,cursor:'pointer',fontWeight:800,
              background: obsAlunoFin ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.03)',
              color:       obsAlunoFin ? '#f59e0b' : 'hsl(var(--text-secondary))',
              border:      obsAlunoFin ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(148, 163, 184, 0.3)',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              transition:'all 0.2s',
            }}
            onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background=obsAlunoFin?'rgba(245,158,11,0.15)':'rgba(255,255,255,0.08)';(e.currentTarget as HTMLButtonElement).style.color=obsAlunoFin?'#f59e0b':'hsl(var(--text-base))';(e.currentTarget as HTMLButtonElement).style.borderColor=obsAlunoFin?'rgba(245,158,11,0.6)':'rgba(148, 163, 184, 0.5)';(e.currentTarget as HTMLButtonElement).style.transform='translateY(-1px)';(e.currentTarget as HTMLButtonElement).style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'}}
            onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background=obsAlunoFin?'rgba(245,158,11,0.1)':'rgba(255,255,255,0.03)';(e.currentTarget as HTMLButtonElement).style.color=obsAlunoFin?'#f59e0b':'hsl(var(--text-secondary))';(e.currentTarget as HTMLButtonElement).style.borderColor=obsAlunoFin?'rgba(245,158,11,0.4)':'rgba(148, 163, 184, 0.3)';(e.currentTarget as HTMLButtonElement).style.transform='translateY(0)';(e.currentTarget as HTMLButtonElement).style.boxShadow='0 2px 8px rgba(0,0,0,0.05)'}}
            title={obsAlunoFin ? `Observação: ${obsAlunoFin}` : 'Adicionar observação financeira'}
          >
            {obsAlunoFin ? '📝 Obs. Financeira' : '📝 Adicionar Obs.'}
          </button>
          {parcelas.length>0&&<span style={{fontSize:11,padding:'8px 16px',borderRadius:20,background:parcelasConfirmadas?'rgba(16,185,129,0.1)':'rgba(245,158,11,0.08)',color:parcelasConfirmadas?'#10b981':'#f59e0b',fontWeight:800,border:'1px solid '+(parcelasConfirmadas?'rgba(16,185,129,0.2)':'rgba(245,158,11,0.18)'),boxShadow:'0 2px 8px rgba(0,0,0,0.05)'}}>{parcelasConfirmadas?'✓ Confirmadas':'⚠ Não confirmadas'}</span>}
        </div>
      </div>

      {/* ══ ACTION TOOLBAR ══ */}
      {(()=>{
        const selCount=parcelasSelected.length
        const temSel=selCount>0
        
        const GroupCard = ({ title, icon, color, children }: { title: string; icon: string; color: string; children: React.ReactNode }) => (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 10,
            padding: '16px',
            background: `linear-gradient(180deg, ${color}1A 0%, rgba(0,0,0,0.1) 100%)`,
            border: `1px solid ${color}30`,
            borderTop: `2px solid ${color}`,
            borderRadius: '16px',
            boxShadow: `0 8px 32px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.05)`,
            position: 'relative', overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', top: -30, right: -30, width: 80, height: 80, background: color, filter: 'blur(40px)', opacity: 0.2, pointerEvents: 'none' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ fontSize: 13, background: `${color}20`, padding: '4px', borderRadius: 6 }}>{icon}</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-base))', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{title}</span>
            </div>
            {children}
          </div>
        )

        const Btn=({icon,label,color,onClick,disabled,danger,title,full}:{icon:string;label:string;color?:string;onClick:()=>void;disabled?:boolean;danger?:boolean;title?:string;full?:boolean})=>{
          const c=danger?'#ef4444':color||'#64748b'
          return(
            <button type="button" disabled={disabled||false} onClick={onClick} title={title||label}
              style={{
                display:'flex',alignItems:'center',justifyContent:'center',gap:6,
                padding:'8px 12px',
                borderRadius:12,
                border:`1px solid ${disabled ? 'hsl(var(--border-subtle))' : c+'40'}`,
                background:disabled ? 'hsl(var(--bg-overlay))' : `linear-gradient(135deg, ${c}12 0%, ${c}05 100%)`,
                boxShadow:disabled ? 'none' : `0 2px 6px ${c}10, inset 0 1px 0 rgba(255,255,255,0.1)`,
                cursor:disabled ? 'not-allowed' : 'pointer',
                opacity:disabled ? 0.4 : 1,
                transition:'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                fontSize:12,fontWeight:700,
                whiteSpace:'nowrap',
                flex:full ? '1 1 0' : '0 0 auto',
                minWidth:0,
                color: disabled ? 'hsl(var(--text-muted))' : c,
              }}
              onMouseEnter={e=>{if(!disabled){const el=e.currentTarget as HTMLElement;el.style.transform='translateY(-2px)';el.style.boxShadow=`0 6px 14px ${c}25, inset 0 1px 0 rgba(255,255,255,0.2)`;el.style.background=`linear-gradient(135deg, ${c}20 0%, ${c}10 100%)`}}}
              onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.transform='translateY(0)';el.style.boxShadow=disabled?'none':`0 2px 6px ${c}10, inset 0 1px 0 rgba(255,255,255,0.1)`;el.style.background=disabled?'hsl(var(--bg-overlay))':`linear-gradient(135deg, ${c}12 0%, ${c}05 100%)`}}
            >
              <span style={{fontSize:14,lineHeight:1,flexShrink:0, filter: disabled ? 'grayscale(1)' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'}}>{icon}</span>
              <span style={{fontWeight:800,overflow:'hidden',textOverflow:'ellipsis'}}>{label}</span>
            </button>
          )
        }
        const Row=({children}:{children:React.ReactNode})=>(
          <div style={{display:'flex',gap:8}}>{children}</div>
        )

        return (
          <div style={{
            display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))',
            gap:16, padding:'20px 24px',
            background:'var(--bg-base)',
            borderBottom:'1px solid hsl(var(--border-subtle))',
          }}>
            {/* Coluna 1 — Baixas / Exclusão */}
            <GroupCard title="Liquidação & Gestão" icon="💸" color="#10b981">
              <Row>
                <Btn full icon="💳" label="Baixar" color="#10b981" disabled={!temSel} onClick={()=>{
                  if(selCount===1){
                    const p=parcelas.find(x=>x.num===parcelasSelected[0])
                    if(p&&p.status!=='pago'){
                      const atr = calcAtraso(p, new Date().toISOString().split('T')[0]);
                      const t = +(p.valor - atr.descAplicado + atr.juros + atr.multa).toFixed(2);
                      const c='BX'+String(p.num).padStart(3,'0')+String(Date.now()).slice(-6);
                      const cxDef=caixasAbertos.filter((c:any)=>!c.fechado).sort((a:any,b:any)=>b.dataAbertura.localeCompare(a.dataAbertura))[0]?.id??'';
                      setBaixaForm({dataPagto:new Date().toISOString().split('T')[0],formasPagto:[{id:'f1',forma:'PIX',valor:fmtMoeda(t),cartao:null}],juros:atr.juros>0?fmtMoeda(atr.juros):'0',multa:atr.multa>0?fmtMoeda(atr.multa):'0',desconto:fmtMoeda(atr.descAplicado),obs:'',comprovante:'',codPreview:c,caixaId:cxDef});
                      setParcelaAtiva({...p});
                      setModalBaixarParcela(true)
                    }
                  } else {
                    const sp=parcelas.filter(x=>parcelasSelected.includes(x.num)&&x.status!=='pago');
                    const dpTarget=new Date().toISOString().split('T')[0];
                    const loteParcs=sp.map(p=>{ const atr=calcAtraso(p, dpTarget); 
                      const eparcs = (p as any).evento ? parcelas.filter((x:any)=>x.status!=='cancelado'&&(x as any).evento===(p as any).evento) : null
                      const pDen = p.totalParcelas || (eparcs?eparcs.length:parcelas.filter(x=>x.status!=='cancelado').length)
                      const evtIndex = p.numParcela || (eparcs && eparcs.length > 0 ? eparcs.findIndex(x => x.num === p.num) + 1 : p.num)
                      const tNome = (p as any).turmaNome || turmas.find((t:any)=>t.id===((p as any).turmaId||mat.turmaId))?.nome || p.turma || mat.turma || ''
                      return {...p, loteJuros:fmtMoeda(atr.juros), loteMulta:fmtMoeda(atr.multa), loteDesc:fmtMoeda(atr.descAplicado), loteDias:atr.dias, pDen, evtIndex, tNome}; 
                    });
                    const tl=loteParcs.reduce((s,p)=>s+Math.max(0, p.valor-parseMoeda(p.loteDesc)+parseMoeda(p.loteJuros)+parseMoeda(p.loteMulta)),0);
                    const c='BX'+String(Date.now()).slice(-6)+String(Math.floor(Math.random()*100)).padStart(2,'0')+'LL';
                    setBaixaLoteParcelas(loteParcs);
                    setBaixaLoteForm({dataPagto:dpTarget,formaPagto:'PIX',comprovante:'',obs:'',codPreview:c});
                    setBaixaLoteMultiFormas([{id:'f1',forma:'PIX',valor:fmtMoeda(tl),cartao:null}]);
                    setModalBaixaLote(true)
                  }
                }}/>
                <Btn full icon="✏️" label="Editar" color="#6366f1"
                  disabled={selCount!==1}
                  onClick={()=>{
                    const rawP=parcelas.find(x=>x.num===parcelasSelected[0]);
                    if(rawP?.status==='pago'){
                      void dlg.alert('Esta parcela já foi PAGA e está bloqueada para edição.\n\nPara editar, utilize o botão "Excluir Baixa" primeiro para reverter o pagamento.', { type: 'warning', title: 'Parcela Paga' });
                      return;
                    }
                    if(rawP){
                      const { juros, multa, dias } = calcAtraso(rawP, new Date().toISOString().split('T')[0]);
                      setParcelaAtiva({...rawP, juros: rawP.juros || juros, multa: rawP.multa || multa, diasAtr: Math.max(0, dias)});
                      setModalEditarParcela(true)
                    }
                  }}/>
              </Row>
              <Row>
                <Btn full icon="🏦" label="Baixa Resp." color="#818cf8" onClick={()=>setModalBaixaResp(true)}/>
                <Btn full icon="🗑️" label="Excluir" danger disabled={!temSel||parcelas.some(p=>parcelasSelected.includes(p.num)&&p.status==='pago')} title={parcelas.some(p=>parcelasSelected.includes(p.num)&&p.status==='pago')?"Parcelas pagas não podem ser excluídas":undefined} onClick={()=>{setExcluirMotivo('');setModalExcluirMotivo(true)}}/>
              </Row>
            </GroupCard>

            {/* Coluna 2 — Eventos / Ajustes */}
            <GroupCard title="Lançamentos Manuais" icon="🛠️" color="#8b5cf6">
              <Row>
                <Btn full icon="➕" label="Inserir Evento" color="#8b5cf6" onClick={()=>{setEventoForm(f=>({...f,turmaId:mat.turmaId}));setModalEventoFin(true)}}/>
                <Btn full icon="🏷️" label="Descontos" color="#f59e0b" onClick={()=>{
                  const selP = parcelasSelected.length>0 ? parcelas.find(p=>p.num===parcelasSelected[0]) : null;
                  const se = selP ? ((selP as any).evento||'') : '';
                  const pendentes = parcelas.filter(p=>p.status!=='cancelado'&&p.status!=='pago'&&p.status!=='isento');
                  const lista = (se ? pendentes.filter(p=>(p as any).evento===se) : pendentes)
                    .sort((a,b)=>{
                      const da=new Date((a.vencimento||'').split('/').reverse().join('-')+'T12:00')
                      const db=new Date((b.vencimento||'').split('/').reverse().join('-')+'T12:00')
                      return da.getTime()-db.getTime()
                    });
                  if(lista.length===0){ void dlg.alert('Não há parcelas pendentes para aplicar desconto.\nParcelas já pagas não podem receber desconto retroativo.', { type: 'warning', title: 'Sem Parcelas Pendentes' }); return;}
                  // Se há 1 parcela selecionada, encontra o índice dela na lista do evento (1-based)
                  let deIdx = '1', ateIdx = String(lista.length);
                  if(selP && parcelasSelected.length===1){
                    const idx = lista.findIndex(p=>p.num===selP.num);
                    if(idx>=0){ deIdx = String(idx+1); ateIdx = String(idx+1); }
                  }
                  setDescLote({tipo:'%',valor:'',deParcela:deIdx,ateParcela:ateIdx,eventoId:se,parcelasEvento:lista.map(p=>p.num)});
                  setModalDesconto(true);
                }}/>
              </Row>
              <Row>
                <Btn full icon="📅" label="Vencimento" color="#06b6d4" onClick={()=>{
                  const naoPargas=parcelas.filter(p=>p.status!=='cancelado'&&p.status!=='pago');
                  if(naoPargas.length===0){ void dlg.alert('Não há parcelas pendentes.\nParcelas pagas não podem ter vencimento alterado.', { type: 'warning', title: 'Sem Parcelas Pendentes' }); return;}
                  // Pre-fill from selected pending parcelas
                  const selPend = parcelasSelected.length>0
                    ? parcelas.filter(p=>parcelasSelected.includes(p.num)&&p.status!=='pago'&&p.status!=='cancelado')
                    : [];
                  const ev = selPend.length>0
                    ? (selPend[0] as any).evento||''
                    : [...new Set(naoPargas.map(p=>(p as any).evento).filter(Boolean))][0]||'';
                  const parcsForEv = ev
                    ? naoPargas.filter(p=>(p as any).evento===ev)
                    : naoPargas;
                  const nums = selPend.length>0
                    ? selPend.map(p=>p.num)
                    : parcsForEv.map(p=>p.num);
                  setVctoForm({
                    eventoFiltro: ev,
                    deParcela: nums.length?String(Math.min(...nums)):'1',
                    ateParcela: nums.length?String(Math.max(...nums)):String(naoPargas.length),
                    novoDia:''
                  });
                  setModalVcto(true);
                }}/>
                <Btn full icon="💲" label="Alt. Valor" color="#a78bfa" onClick={()=>{
                  const se=parcelasSelected.length>0?(parcelas.find(p=>p.num===parcelasSelected[0]) as any)?.evento||'':'';
                  const ns=se
                    ?parcelas.filter(p=>p.status!=='cancelado'&&p.status!=='pago'&&(p as any).evento===se).map(p=>p.num)
                    :parcelas.filter(p=>p.status!=='cancelado'&&p.status!=='pago').map(p=>p.num);
                  if(ns.length===0){ void dlg.alert('Não há parcelas pendentes para alterar.\nParcelas já pagas não podem ter valor alterado.', { type: 'warning', title: 'Sem Parcelas Pendentes' }); return;}
                  setAlterarValorForm({parcelas:ns,eventoFiltro:se,novoValor:'',motivo:''});
                  setModalAlterarValor(true);
                }}/>
              </Row>
            </GroupCard>

            {/* Coluna 3 — Consultas */}
            <GroupCard title="Consultas & Estorno" icon="🔍" color="#38bdf8">
              <Row>
                <Btn full icon="🔍" label="Cons. Baixa" color="#38bdf8" onClick={()=>{
                  // If a single paid parcela is selected, jump directly to its baixa
                  if(parcelasSelected.length===1){
                    const selP = parcelas.find(p=>p.num===parcelasSelected[0]);
                    if(selP?.status==='pago'){
                      setParcelasSelected([selP.num]);
                      setModalRecibo(true);
                      return;
                    }
                  }
                  setModalConsultaBaixa(true);
                }}/>
                <Btn full icon="↩️" label="Excluir Baixa" color="#f97316" disabled={!temSel||!parcelas.some(p=>parcelasSelected.includes(p.num)&&p.status==='pago')} onClick={()=>setModalExcluirBaixa(true)}/>
              </Row>
              <Row>
                <Btn full icon="🗂️" label="Extrato" color="#64748b" onClick={()=>setModalExtrato(true)}/>
                <Btn full icon="🗑️" label="Excluídos" color="#94a3b8" onClick={()=>setModalItensExcluidos(true)}/>
              </Row>
            </GroupCard>

            {/* Coluna 4 — Boletos */}
            <GroupCard title="Cobrança Bancária" icon="🏦" color="#0ea5e9">
              <Row>
                <Btn full icon="📋" label="Histórico" color="#818cf8" onClick={()=>setModalHistorico(true)}/>
              </Row>
              <Row>
                <Btn full icon="🧾" label="Emitir Boleto" color="#0ea5e9"
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
            </GroupCard>
          </div>
        )
      })()}




      {/* ══ FILTROS + TABELA ══ */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {(()=>{
          const hoje=new Date();hoje.setHours(0,0,0,0)
          const pd=(s:string)=>new Date(s.split('/').reverse().join('-')+'T12:00')
          const calcJurosMulta=(p:any)=>{
            if(p.status==='pago'||p.status==='isento') return {juros:p.juros||0,multa:p.multa||0,dias:0,descAplicado:p.desconto||0}
            const dv=pd(p.vencimento);const dias=Math.max(0,Math.floor((hoje.getTime()-dv.getTime())/86400000))
            if(dias<=0) return {juros:p.juros||0,multa:p.multa||0,dias:0,descAplicado:p.desconto||0}
            return {juros:+(p.valor*0.00033*dias).toFixed(2),multa:+(p.valor*0.02).toFixed(2),dias,descAplicado:(p.desconto && !(p as any).manterDesconto) ? 0 : (p.desconto || 0)}
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
            {k:'pendente',l:'A Vencer / Vencidos',n:pendentes.length,c:ven.length>0?'#ef4444':'#f59e0b',bg:ven.length>0?'rgba(239,68,68,0.15)':'rgba(245,158,11,0.15)'},
            {k:'pago',l:'Pago',n:pag.length,c:'#10b981',bg:'rgba(16,185,129,0.12)'},
          ]
          return (
            <>
              {/* Barra de Filtros */}
              <div style={{padding:'16px 24px',borderBottom:'1px solid hsl(var(--border-subtle))',display:'flex',gap:16,alignItems:'center',background:'hsl(var(--bg-elevated))',flexWrap:'wrap'}}>
                
                <label style={{
                  display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,color:'hsl(var(--text-base))',
                  fontWeight:800,padding:'10px 16px',borderRadius:12,
                  border: allSel ? '2px solid #6366f1' : '2px solid hsl(var(--border-subtle))',
                  background: allSel ? 'rgba(99,102,241,0.08)' : 'hsl(var(--bg-base))',
                  transition:'all 0.2s', boxShadow: allSel ? '0 4px 12px rgba(99,102,241,0.15)' : '0 2px 4px rgba(0,0,0,0.02)'
                }}>
                  <input type="checkbox" checked={allSel} onChange={e=>setParcelasSelected(e.target.checked?pFilt.map(p=>p.num):[])} style={{cursor:'pointer',width:16,height:16,accentColor:'#6366f1'}}/>
                  Sel. Todos
                </label>
                
                <div style={{width:2,height:32,borderLeft:'2px dashed hsl(var(--border-subtle))', margin:'0 4px'}}/>
                
                <div style={{display:'flex',gap:12, flexWrap:'wrap'}}>
                  {FILTROS.map(f=>(
                    <button key={f.k} type="button" onClick={()=>setFin(ff=>({...ff,_filtro:f.k}))}
                      style={{
                        padding:'10px 20px',borderRadius:12,fontSize:13,fontWeight:800,cursor:'pointer',
                        display:'flex', alignItems:'center', gap: 8,
                        border: filtroAtual===f.k ? `2px solid ${f.c}` : '2px solid transparent',
                        background: filtroAtual===f.k ? f.bg : 'hsl(var(--bg-base))',
                        color: filtroAtual===f.k ? f.c : 'hsl(var(--text-secondary))',
                        transition:'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: filtroAtual===f.k ? `0 4px 16px ${f.c}30` : '0 2px 6px rgba(0,0,0,0.04)',
                        transform: filtroAtual===f.k ? 'translateY(-2px)' : 'translateY(0)'
                      }}>
                      {f.l}
                      <span style={{
                        background: filtroAtual===f.k ? f.c : 'hsl(var(--bg-overlay))', 
                        color: filtroAtual===f.k ? '#fff' : 'hsl(var(--text-muted))',
                        padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:900,
                        boxShadow: filtroAtual===f.k ? `0 2px 8px ${f.c}50` : 'none'
                      }}>{f.n}</span>
                    </button>
                  ))}
                </div>
                
                <div style={{flex:1}}/>
                {selCount>0&&(
                  <div style={{display:'flex',alignItems:'center',gap:8,padding:'4px 12px',borderRadius:20,background:'rgba(99,102,241,0.07)',border:'1px solid rgba(99,102,241,0.18)'}}>
                    <span style={{fontSize:11,fontWeight:800,color:'#818cf8',fontFamily:'monospace'}}>Σ R$ {fmtMoeda(parcelas.filter(p=>parcelasSelected.includes(p.num)).reduce((s,p)=>s+p.valorFinal,0))}</span>
                    {parcelas.some(p=>parcelasSelected.includes(p.num)&&p.status==='pago')&&(
                      <button type="button" style={{fontSize:10,padding:'2px 8px',borderRadius:6,border:'1px solid rgba(16,185,129,0.25)',background:'rgba(16,185,129,0.07)',color:'#10b981',cursor:'pointer',fontWeight:700}} onClick={()=>{const pg=parcelas.find(p=>parcelasSelected.includes(p.num)&&p.status==='pago');if(pg){setParcelaAtiva(pg);setModalRecibo(true)}}}>📄 Recibo</button>
                    )}
                    <button type="button" style={{border:'none',background:'none',color:'#f87171',cursor:'pointer',fontSize:13,lineHeight:1,padding:0}} onClick={()=>setParcelasSelected([])}>✖</button>
                  </div>
                )}
                
                <button type="button" 
                  style={{
                    fontSize:13,padding:'10px 24px',borderRadius:12,border:'none',
                    background:'linear-gradient(135deg,#6366f1,#8b5cf6)',color:'#fff',
                    cursor:'pointer',fontWeight:800,boxShadow:'0 4px 16px rgba(99,102,241,0.4)',
                    display:'flex',alignItems:'center',gap:8, transition:'all 0.2s',
                    textTransform:'uppercase', letterSpacing:'0.03em'
                  }}
                  onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.transform='translateY(-2px)';el.style.boxShadow='0 8px 24px rgba(99,102,241,0.5)'}}
                  onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.transform='none';el.style.boxShadow='0 4px 16px rgba(99,102,241,0.4)'}}
                  onClick={()=>{setEventoForm(f=>({...f,turmaId:mat.turmaId}));setModalEventoFin(true)}}>
                  <span style={{fontSize:18,lineHeight:1}}>+</span> Lançar Evento
                </button>
              </div>

              {/* TABLE or EMPTY */}
              {parcelas.length===0?(
                <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:60,gap:12,textAlign:'center'}}>
                  <div style={{fontSize:56,marginBottom:8}}>💳</div>
                  <div style={{fontWeight:800,fontSize:18}}>Nenhuma parcela cadastrada</div>
                  <div style={{fontSize:13,color:'hsl(var(--text-muted))',maxWidth:400}}>Use "Adicionar Evento" ou acesse a aba Código para confirmar parcelas.</div>
                  <div style={{display:'flex',gap:10,marginTop:8}}>
                    <button className="btn btn-secondary" onClick={()=>setStep(3)}>← Ir para Matrícula</button>
                    <button className="btn btn-primary" style={{background:'linear-gradient(135deg,#8b5cf6,#6366f1)'}} onClick={()=>{setEventoForm(f=>({...f,turmaId:mat.turmaId}));setModalEventoFin(true)}}>+ Inserir Evento</button>
                  </div>
                </div>
              ):(
                <div style={{flex:1,overflowX:'auto',overflowY:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'separate',borderSpacing:0,fontSize:12,fontFamily:"'Inter',sans-serif"}}>
                    <thead style={{position:'sticky',top:0,zIndex:10}}>
                      <tr style={{background:'hsl(var(--bg-elevated))'}}>
                        <th style={{padding:'8px 6px',width:40,borderBottom:'2px solid hsl(var(--border-subtle))',textAlign:'center',borderRight:'1px solid hsl(var(--border-subtle))'}}>
                          <input type="checkbox" checked={allSel} onChange={e=>setParcelasSelected(e.target.checked?pFilt.map(p=>p.num):[])} style={{cursor:'pointer',width:14,height:14,accentColor:'#6366f1'}}/>
                        </th>
                        {[
                          {l:'Parc.',w:50,center:true},
                          {l:'Evento / Competência'},
                          {l:'Vencimento',w:95},
                          {l:'Valor Bruto',w:95,r:true},
                          {l:'Desconto',w:85,r:true},
                          {l:'Juros / Multa',w:105,r:true},
                          {l:'Total a Pagar',w:105,r:true},
                          {l:'Pagamento',w:90},
                          {l:'Ação',w:86,center:true},
                          {l:'Dt. Emissão',w:95,center:true},
                        ].map((h:any,hi:number)=>(
                          <th key={hi} style={{padding:'10px 8px',textAlign:h.center?'center':h.r?'right':'left',fontWeight:700,fontSize:10,color:'hsl(var(--text-muted))',borderBottom:'2px solid hsl(var(--border-subtle))',whiteSpace:'nowrap',width:h.w,letterSpacing:.8,textTransform:'uppercase',fontFamily:"'Inter',sans-serif"}}>{h.l}</th>
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
                        const atr=p.status!=='pago'?calcJurosMulta(p):{juros:0,multa:0,dias:0,descAplicado:p.desconto||0}
                        const jEx=p.status==='pago'?((p as any).juros||0):atr.juros
                        const mEx=p.status==='pago'?((p as any).multa||0):atr.multa
                        const descAplicado = atr.descAplicado;
                        const totalP=p.status==='pago'?p.valorFinal:+(p.valor-descAplicado+jEx+mEx).toFixed(2)
                        const rowBg=sel?'rgba(99,102,241,0.055)':p.status==='pago'?'rgba(16,185,129,0.015)':isV?'rgba(239,68,68,0.015)':rowIdx%2===0?'transparent':'rgba(148,163,184,0.025)'
                        const eid=(p as any).eventoId
                        const savedNum=(p as any).numParcela
                        const savedTotal=(p as any).totalParcelas
                        // Prioridade: campo salvo numParcela (índice dentro do evento)
                        // Fallback: calcular via eventoId no array filtrado (compatibilidade com parcelas antigas)
                        const eparcs=(!savedNum && eid)?[...pFilt].filter(x=>(x as any).eventoId===eid).sort((a,b)=>pd(a.vencimento).getTime()-pd(b.vencimento).getTime()):null
                        const pNum=savedNum||(eparcs?eparcs.findIndex(x=>x.num===p.num)+1:rowIdx+1)
                        const pDen=savedTotal||(eparcs?eparcs.length:parcelas.filter(x=>x.status!=='cancelado').length)
                        const tNome=(p as any).turmaNome||(turmas.find((t:any)=>t.id===((p as any).turmaId||mat.turmaId)) as any)?.nome||''

                        return(
                          <tr key={p.num}
                            style={{background:rowBg,transition:'background 0.1s',cursor:'pointer',borderLeft:sel?'3px solid #6366f1':'3px solid transparent'}}
                            onMouseEnter={e=>{if(!sel)(e.currentTarget as HTMLElement).style.background='rgba(148,163,184,0.055)'}}
                            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=rowBg}}
                            onClick={e=>{if((e.target as HTMLElement).tagName==='INPUT') return;setParcelasSelected(prev=>prev.includes(p.num)?prev.filter(n=>n!==p.num):[...prev,p.num])}}
                          >
                            <td style={{padding:'8px 6px',textAlign:'center',borderBottom:'1px solid hsl(var(--border-subtle))',borderRight:'1px solid rgba(148,163,184,0.08)'}} onClick={e=>e.stopPropagation()}>
                              <input type="checkbox" checked={sel} onChange={e=>setParcelasSelected(prev=>e.target.checked?[...prev,p.num]:prev.filter(n=>n!==p.num))} style={{cursor:'pointer',width:14,height:14,accentColor:'#6366f1'}}/>
                            </td>

                            {/* Nº da parcela + badge turma acima */}
                            {/* Nº da parcela — limpo */}
                            <td style={{padding:'8px 6px',textAlign:'center',borderBottom:'1px solid hsl(var(--border-subtle))'}}>
                              <div style={{width:38,height:38,borderRadius:10,background:sBg,border:'1.5px solid '+sColor+'30',display:'inline-flex',alignItems:'center',justifyContent:'center',flexDirection:'column'}}>
                                <span style={{fontSize:13,fontWeight:900,color:sColor,lineHeight:1}}>{pNum}</span>
                                <span style={{fontSize:8,color:sColor,opacity:.5}}>/{pDen}</span>
                              </div>
                              {isH&&<div style={{fontSize:7,background:'#f59e0b',color:'#000',borderRadius:3,padding:'1px 4px',fontWeight:900,marginTop:3,textAlign:'center',lineHeight:1.5}}>HOJE</div>}
                            </td>

                            {/* Evento + competência + badge turma + badge status */}
                            <td style={{padding:'8px 6px',maxWidth:220,borderBottom:'1px solid hsl(var(--border-subtle))'}}>
                              <div style={{fontWeight:700,fontSize:12,color:'hsl(var(--text-base))',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{getEventoDisp(p)}</div>
                              <div style={{fontSize:10,color:'hsl(var(--text-muted))',textTransform:'capitalize',marginTop:1}}>{p.competencia}</div>
                              <div style={{display:'flex',alignItems:'center',gap:6,marginTop:5}}>
                                {tNome&&(
                                  <span title={tNome} style={{
                                    display:'inline-flex',alignItems:'center',fontSize:9,fontWeight:800,padding:'2px 7px',borderRadius:20,
                                    background:'rgba(99,102,241,0.1)',color:'#6366f1',border:'1px solid rgba(99,102,241,0.22)',
                                    whiteSpace:'nowrap',maxWidth:100,overflow:'hidden',textOverflow:'ellipsis',lineHeight:'14px'
                                  }}>🎓 {tNome}</span>
                                )}
                                <span style={{display:'inline-flex',alignItems:'center',fontSize:9,padding:'2px 7px',borderRadius:20,fontWeight:800,background:sBg,color:sColor,whiteSpace:'nowrap',border:'1px solid '+sColor+'25',lineHeight:'14px'}}>{sLabel}</span>
                              </div>
                            </td>
                            <td style={{padding:'8px 6px',borderBottom:'1px solid hsl(var(--border-subtle))',whiteSpace:'nowrap'}}>
                              <div style={{fontFamily:"'JetBrains Mono','Fira Mono',ui-monospace,monospace",fontSize:13,fontWeight:isV||isH?800:600,color:isV?'#ef4444':isH?'#f59e0b':'hsl(var(--text-base))'}}
                              >{p.vencimento ? formatDate(p.vencimento) : '—'}</div>
                              {isV&&atr.dias>0&&<div style={{fontSize:9,color:'#f87171',fontWeight:700,marginTop:2}}>{atr.dias}d atraso</div>}
                            </td>
                            <td style={{padding:'8px 6px',textAlign:'right',fontFamily:"'JetBrains Mono','Fira Mono',ui-monospace,monospace",fontSize:13,fontWeight:500,color:'hsl(var(--text-base))',borderBottom:'1px solid hsl(var(--border-subtle))',whiteSpace:'nowrap'}}>R$ {fmtMoeda(p.valor)}</td>
                            <td style={{padding:'8px 6px',textAlign:'right',borderBottom:'1px solid hsl(var(--border-subtle))',whiteSpace:'nowrap'}}>
                              {p.desconto>0 ? (
                                <div style={{display:'inline-flex',flexDirection:'column',alignItems:'flex-end',gap:1}}>
                                  <span style={{
                                    fontFamily:"'JetBrains Mono','Fira Mono',ui-monospace,monospace",
                                    fontSize:13,
                                    color: (isV && !(p as any).manterDesconto) ? 'hsl(var(--text-muted))' : '#d97706',
                                    fontWeight:700,
                                    textDecoration: (isV && !(p as any).manterDesconto) ? 'line-through' : 'none'
                                  }}>- R$ {fmtMoeda(p.desconto)}</span>
                                  <span style={{
                                    fontSize:10,
                                    color: (isV && !(p as any).manterDesconto) ? 'hsl(var(--text-muted))' : '#d97706',
                                    opacity:.65,
                                    fontWeight:600,
                                    textDecoration: (isV && !(p as any).manterDesconto) ? 'line-through' : 'none'
                                  }}>({p.valor>0?((p.desconto/p.valor)*100).toFixed(1):0}%)</span>
                                  {(p as any).manterDesconto ? (
                                    <span style={{fontSize:9,background:'rgba(16,185,129,0.1)',color:'#10b981',border:'1px solid rgba(16,185,129,0.3)',borderRadius:4,padding:'2px 5px',fontWeight:800,marginTop:3,lineHeight:1}}>Mantém desconto</span>
                                  ) : isV ? (
                                    <span style={{fontSize:9,background:'rgba(239,68,68,0.1)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)',borderRadius:4,padding:'2px 5px',fontWeight:800,marginTop:3,lineHeight:1}}>Desconto Perdido</span>
                                  ) : null}
                                </div>
                              ) : <span style={{color:'hsl(var(--text-muted))'}}>—</span>}
                            </td>
                            <td style={{padding:'8px 6px',textAlign:'right',borderBottom:'1px solid hsl(var(--border-subtle))',whiteSpace:'nowrap'}}>
                              {(jEx>0||mEx>0) ? (
                                <div style={{display:'inline-flex',flexDirection:'column',alignItems:'flex-end',gap:2}}>
                                  {jEx>0 && <div style={{display:'flex',alignItems:'center',gap:4}}>
                                    <span style={{fontSize:9,color:'#f87171',fontWeight:700,opacity:.8}}>J</span>
                                    <span style={{fontFamily:"'JetBrains Mono','Fira Mono',ui-monospace,monospace",fontSize:12,color:'#ef4444',fontWeight:700}}>R$ {fmtMoeda(jEx)}</span>
                                  </div>}
                                  {mEx>0 && <div style={{display:'flex',alignItems:'center',gap:4}}>
                                    <span style={{fontSize:9,color:'#f87171',fontWeight:700,opacity:.8}}>M</span>
                                    <span style={{fontFamily:"'JetBrains Mono','Fira Mono',ui-monospace,monospace",fontSize:12,color:'#ef4444',fontWeight:700}}>R$ {fmtMoeda(mEx)}</span>
                                  </div>}
                                </div>
                              ) : <span style={{color:'hsl(var(--text-muted))'}}>—</span>}
                            </td>
                            <td style={{padding:'8px 6px',textAlign:'right',borderBottom:'1px solid hsl(var(--border-subtle))',whiteSpace:'nowrap'}}>
                              <div style={{fontFamily:"'JetBrains Mono','Fira Mono',ui-monospace,monospace",fontSize:14,fontWeight:900,color:p.status==='pago'?'#10b981':(jEx+mEx)>0?'#ef4444':'hsl(var(--text-base))'}}>R$ {fmtMoeda(totalP)}</div>
                              {p.status!=='pago'&&(jEx+mEx)>0&&<div style={{fontSize:9,color:'#f87171',fontWeight:600,marginTop:2}}>c/ encargos</div>}
                            </td>
                            <td style={{padding:'8px 6px',borderBottom:'1px solid hsl(var(--border-subtle))',whiteSpace:'nowrap'}}>
                              <span style={{fontFamily:"'JetBrains Mono','Fira Mono',ui-monospace,monospace",fontSize:12,color:'hsl(var(--text-muted))'}}>
                                {(p as any).dtPagto?new Date((p as any).dtPagto+'T12:00').toLocaleDateString('pt-BR'):'—'}
                              </span>
                            </td>

                            <td style={{padding:'8px 6px',textAlign:'center',borderBottom:'1px solid hsl(var(--border-subtle))'}}>
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
                                      <span style={{fontSize:10,color:'hsl(var(--text-muted))',fontStyle:'italic',display:'flex',alignItems:'center'}}>Sem boleto</span>
                                    )}
                                    <button type="button"
                                      title={(p.obs||(p as any).obsFin) ? "Editar observação da parcela" : "Adicionar observação à parcela"}
                                      style={{fontSize:10,padding:'4px 8px',borderRadius:8,border:'1px solid rgba(139,92,246,0.4)',background:(p.obs||(p as any).obsFin)?'rgba(139,92,246,0.15)':'transparent',color:'#8b5cf6',cursor:'pointer',fontWeight:700,display:'inline-flex',alignItems:'center',gap:4,transition:'all .2s'}}
                                      onClick={e=>{e.stopPropagation();setObsFinForm({parcelas:[p.num],obs:(p as any).obsFin||p.obs||''});setModalObsFin(true)}}>
                                      {(p.obs||(p as any).obsFin) ? '📝 Ver Obs' : '📝 +Obs'}
                                    </button>
                                  </div>
                                )
                              })()}
                            </td>
                            <td style={{padding:'8px 6px',textAlign:'center',borderBottom:'1px solid hsl(var(--border-subtle))',whiteSpace:'nowrap'}} onClick={e=>e.stopPropagation()}>
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
                        <td colSpan={2} style={{padding:'8px 6px',fontWeight:700,fontSize:11,color:'hsl(var(--text-muted))',borderTop:'2px solid hsl(var(--border-subtle))'}}>
                          <span style={{padding:'4px 8px',borderRadius:6,background:'hsl(var(--bg-overlay))',border:'1px solid hsl(var(--border-subtle))'}}>Total · {pFilt.length} parcela{pFilt.length!==1?'s':''}</span>
                        </td>
                        {/* col 3: Evento */}
                        <td style={{padding:'8px 6px',fontSize:11,borderTop:'2px solid hsl(var(--border-subtle))',whiteSpace:'nowrap'}}>
                          <span style={{padding:'4px 8px',borderRadius:6,background:'rgba(99,102,241,0.1)',color:'#6366f1',marginRight:6, fontWeight:800}}>A Vencer: {aV.length}</span>
                          {ven.length>0&&<span style={{padding:'4px 8px',borderRadius:6,background:'rgba(239,68,68,0.1)',color:'#ef4444', fontWeight:800}}>Vencido: {ven.length}</span>}
                        </td>
                        {/* col 4: Vencimento — vazio */}
                        <td style={{borderTop:'2px solid hsl(var(--border-subtle))'}}/>
                        {/* col 5: Valor Bruto */}
                        <td style={{padding:'8px 6px',textAlign:'right',fontFamily:'monospace',fontSize:12,borderTop:'2px solid hsl(var(--border-subtle))'}}>
                          <span style={{padding:'4px 8px',borderRadius:6,background:'rgba(99,102,241,0.1)',color:'#6366f1',border:'1px solid rgba(99,102,241,0.2)',fontWeight:800}}>R$ {fmtMoeda(pFilt.reduce((s,p)=>s+p.valor,0))}</span>
                        </td>
                        {/* col 6: Desconto */}
                        <td style={{padding:'8px 6px',textAlign:'right',fontFamily:'monospace',fontSize:12,borderTop:'2px solid hsl(var(--border-subtle))'}}>
                          <span style={{padding:'4px 8px',borderRadius:6,background:'rgba(245,158,11,0.1)',color:'#d97706',border:'1px solid rgba(245,158,11,0.2)',fontWeight:800}}>- R$ {fmtMoeda(pFilt.reduce((s,p)=>s+(p.desconto||0),0))}</span>
                        </td>
                        {/* col 7: Juros */}
                        <td style={{padding:'8px 6px',textAlign:'right',fontFamily:'monospace',fontSize:12,borderTop:'2px solid hsl(var(--border-subtle))'}}>
                          <span style={{padding:'4px 8px',borderRadius:6,background:'rgba(234,179,8,0.1)',color:'#eab308',border:'1px solid rgba(234,179,8,0.2)',fontWeight:800}}>+ R$ {fmtMoeda(pFilt.reduce((s,p)=>s+(p.status==='pago'?parseMoeda(String((p as any).juros||0)):calcJurosMulta(p).juros),0))}</span>
                        </td>
                        {/* col 8: Multa */}
                        <td style={{padding:'8px 6px',textAlign:'right',fontFamily:'monospace',fontSize:12,borderTop:'2px solid hsl(var(--border-subtle))'}}>
                          <span style={{padding:'4px 8px',borderRadius:6,background:'rgba(234,179,8,0.1)',color:'#eab308',border:'1px solid rgba(234,179,8,0.2)',fontWeight:800}}>+ R$ {fmtMoeda(pFilt.reduce((s,p)=>s+(p.status==='pago'?parseMoeda(String((p as any).multa||0)):calcJurosMulta(p).multa),0))}</span>
                        </td>
                        {/* col 9: Total a Pagar */}
                        <td style={{padding:'8px 6px',textAlign:'right',fontFamily:'monospace',fontSize:13,borderTop:'2px solid hsl(var(--border-subtle))'}}>
                          <span style={{padding:'6px 10px',borderRadius:6,background:'rgba(16,185,129,0.1)',color:'#10b981',border:'1px solid rgba(16,185,129,0.2)',fontWeight:900}}>R$ {fmtMoeda(pFilt.reduce((s,p)=>{
                            const j = p.status==='pago'?parseMoeda(String((p as any).juros||0)):calcJurosMulta(p).juros;
                            const m = p.status==='pago'?parseMoeda(String((p as any).multa||0)):calcJurosMulta(p).multa;
                            return s + (p.status==='pago' ? p.valorFinal : +(p.valor-(p.desconto||0)+j+m));
                          },0))}</span>
                        </td>
                        {/* col 10+11+12: Pagamento + Ação + Dt.Emissão — vazio */}
                        <td colSpan={3} style={{borderTop:'2px solid hsl(var(--border-subtle))'}}/>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

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

      {/* MODAL RECIBO LUXO */}
      {modalRecibo && (
        <ReceiptModal
          aluno={{
            ...aluno,
            responsavelFinanceiro: todosResp.find(r => r.respFinanceiro)?.nome || undefined,
            emailResponsavelFinanceiro: todosResp.find(r => r.respFinanceiro)?.email || (aluno as any).email,
            telResponsavelFinanceiro: todosResp.find(r => r.respFinanceiro)?.celular || (aluno as any).celular
          }}
          parcelas={parcelasSelected.length > 0 ? parcelas.filter(p => parcelasSelected.includes(p.num)) : (parcelaAtiva ? [parcelaAtiva as any] : [])}
          onClose={() => setModalRecibo(false)}
          onBack={modalConsultaBaixa ? () => { setModalRecibo(false); setModalConsultaBaixa(true); } : undefined}
        />
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
                      <div style={{fontWeight:700,fontSize:12}}>{getEventoDisp(p)} — Parcela {p.num}</div>
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
                setParcelas(prev=>{
                  let next = prev.map(p=>parcelasSelected.includes(p.num)?{...p,status:'cancelado',dataExclusao:new Date().toLocaleDateString('pt-BR'),motivoExclusao:excluirMotivo}:p);
                  const eventosAfetados = new Set<string>();
                  parcelasSelected.forEach(n => {
                    const p = next.find(x => x.num === n);
                    if (p && p.eventoId) eventosAfetados.add(p.eventoId);
                  });
                  
                  eventosAfetados.forEach(eId => {
                    const ativas = next.filter(p=>p.eventoId===eId&&p.status!=='cancelado').sort((a,b)=>a.num-b.num);
                    const total = ativas.length;
                    
                    ativas.forEach((aP, idx) => {
                       const nextIdx = next.findIndex(x => x.num === aP.num);
                       if (nextIdx > -1) {
                         next[nextIdx] = { ...next[nextIdx], numParcela: idx + 1, totalParcelas: total };
                       }
                    });
                  });
                  
                  return next;
                })
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
                      <span><strong>{getEventoDisp(p)}</strong> · Parcela {p.num} · Vcto {p.vencimento ? formatDate(p.vencimento) : '—'}</span>
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
      {modalDesconto&&(()=>{
        // Parcelas pendentes (vencidas e a vencer) — excluindo pagas, canceladas, isentas
        const pendentes = parcelas.filter(p=>p.status!=='pago'&&p.status!=='cancelado'&&p.status!=='isento')
        // Eventos únicos presentes nas pendentes
        const evNomes = [...new Set(pendentes.map(p=>(p as any).evento).filter(Boolean))]
        // Parcelas do evento selecionado (pendentes, ordenadas por vencimento)
        const parcsDoEvento = descLote.eventoId
          ? pendentes.filter(p=>(p as any).evento===descLote.eventoId).sort((a,b)=>{
              const da=new Date((a.vencimento||'').split('/').reverse().join('-')+'T12:00')
              const db=new Date((b.vencimento||'').split('/').reverse().join('-')+'T12:00')
              return da.getTime()-db.getTime()
            })
          : []
        // Turma do evento selecionado
        const tNmSel = parcsDoEvento.map(p=>(p as any).turmaNome || turmas.find((t:any)=>t.id===(p as any).turmaId)?.nome).find(n=>!!n) || ''
        // Parcs afetadas pelo filtro De/Até (usando índice interno do evento)
        const deIdx = parseInt(descLote.deParcela||'1')-1
        const ateIdx = parseInt(descLote.ateParcela||'9999')-1
        const afetadas = descLote.eventoId
          ? parcsDoEvento.filter((_,i)=>i>=deIdx&&i<=ateIdx)
          : pendentes.filter((_,i)=>i>=deIdx&&i<=ateIdx)
        const totalDesc = afetadas.reduce((s,p)=>{
          const v=parseMoeda(descLote.valor||'0')
          return s+(descLote.tipo==='%'?+(p.valor*v/100).toFixed(2):v)
        },0)

        const handleChangeEvento = (ev:string) => {
          const ps = pendentes.filter(p=>(p as any).evento===ev||!ev)
            .sort((a,b)=>{
              const da=new Date((a.vencimento||'').split('/').reverse().join('-')+'T12:00')
              const db=new Date((b.vencimento||'').split('/').reverse().join('-')+'T12:00')
              return da.getTime()-db.getTime()
            })
          setDescLote(d=>({...d,eventoId:ev,parcelasEvento:ps.map(x=>x.num),deParcela:'1',ateParcela:String(ps.length||1)}))
        }

        return(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:4000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'hsl(var(--bg-base))',borderRadius:20,width:'100%',maxWidth:520,border:'1px solid hsl(var(--border-subtle))',boxShadow:'0 40px 120px rgba(0,0,0,0.8)'}}>
            {/* Header */}
            <div style={{padding:'18px 24px',borderBottom:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'space-between',alignItems:'center',background:'linear-gradient(135deg,rgba(245,158,11,0.1),rgba(251,191,36,0.04))'}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:40,height:40,borderRadius:10,background:'rgba(245,158,11,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>🏷️</div>
                <div>
                  <div style={{fontWeight:800,fontSize:15}}>Aplicar Desconto em Lote</div>
                  <div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>Filtre por evento e intervalo de parcelas</div>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={()=>setModalDesconto(false)}><X size={18}/></button>
            </div>

            <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:14}}>
              {/* Evento */}
              <div>
                <label className="form-label" style={{fontSize:11,marginBottom:6,display:'block',letterSpacing:.5}}>EVENTO (FILTRO DE PARCELAS)</label>
                <select className="form-input" value={descLote.eventoId||''} onChange={e=>handleChangeEvento(e.target.value)} style={{fontWeight:600}}>
                  <option value="">— Todos os eventos —</option>
                  {evNomes.map((ev:any)=>{
                    const tNm = pendentes.filter(p=>(p as any).evento===ev).map(p=>(p as any).turmaNome||turmas.find((t:any)=>t.id===(p as any).turmaId)?.nome).find(n=>!!n)||''
                    return <option key={ev} value={ev}>{ev}{tNm?` — ${tNm}`:''}</option>
                  })}
                </select>
                {descLote.eventoId&&(
                  <div style={{marginTop:6,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                    {tNmSel&&<span style={{padding:'2px 10px',borderRadius:20,background:'rgba(129,140,248,0.12)',border:'1px solid rgba(129,140,248,0.3)',color:'#818cf8',fontWeight:700,fontSize:10}}>🎓 {tNmSel}</span>}
                    <span style={{fontSize:11,color:'hsl(var(--text-muted))'}}>
                      {parcsDoEvento.length} parcela{parcsDoEvento.length!==1?'s':''} pendente{parcsDoEvento.length!==1?'s':''}
                    </span>
                  </div>
                )}
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

              {/* Tipo desconto */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {([{k:'%',l:'Percentual (%)',s:'Proporcional ao valor'},{k:'R$',l:'Valor Fixo (R$)',s:'Mesmo valor por parcela'}] as any[]).map((t:any)=>(
                  <button key={t.k} type="button" onClick={()=>setDescLote(d=>({...d,tipo:t.k}))} style={{padding:'12px',borderRadius:10,cursor:'pointer',textAlign:'left',border:'2px solid',borderColor:descLote.tipo===t.k?'#f59e0b':'hsl(var(--border-subtle))',background:descLote.tipo===t.k?'rgba(245,158,11,0.08)':'transparent'}}>
                    <div style={{fontWeight:700,fontSize:13,color:descLote.tipo===t.k?'#f59e0b':'hsl(var(--text-base))'}}>{descLote.tipo===t.k&&'✓ '}{t.l}</div>
                    <div style={{fontSize:11,color:'hsl(var(--text-muted))',marginTop:2}}>{t.s}</div>
                  </button>
                ))}
              </div>

              {/* Valor */}
              <F label={`Valor do Desconto (${descLote.tipo})`}>
                <input className="form-input" value={descLote.valor} onChange={e=>{
                  if(descLote.tipo==='R$'){
                    const raw=e.target.value.replace(/\D/g,''); const nv=raw?fmtMoeda(parseInt(raw,10)/100):'';
                    setDescLote(d=>({...d,valor:nv}))
                  } else {
                    setDescLote(d=>({...d,valor:e.target.value}))
                  }
                }} placeholder={descLote.tipo==='%'?'Ex: 10':'0,00'}/>
              </F>

              {/* Seletores de parcela — por índice interno do evento */}
              {(()=>{
                const lista = descLote.eventoId ? parcsDoEvento : pendentes.sort((a,b)=>{
                  const da=new Date((a.vencimento||'').split('/').reverse().join('-')+'T12:00')
                  const db=new Date((b.vencimento||'').split('/').reverse().join('-')+'T12:00')
                  return da.getTime()-db.getTime()
                })
                if(lista.length===0) return null
                return(
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                    <F label="Da Parcela">
                      <select className="form-input" value={descLote.deParcela} onChange={e=>setDescLote(d=>({...d,deParcela:e.target.value}))}>
                        {lista.map((p,i)=>(
                          <option key={p.num} value={String(i+1)}>{i+1}ª Parcela — {p.vencimento?formatDate(p.vencimento):'—'}</option>
                        ))}
                      </select>
                    </F>
                    <F label="Até a Parcela">
                      <select className="form-input" value={descLote.ateParcela} onChange={e=>setDescLote(d=>({...d,ateParcela:e.target.value}))}>
                        {lista.map((p,i)=>(
                          <option key={p.num} value={String(i+1)}>{i+1}ª Parcela — {p.vencimento?formatDate(p.vencimento):'—'}</option>
                        ))}
                      </select>
                    </F>
                  </div>
                )
              })()}

              {/* Preview total */}
              {descLote.valor&&afetadas.length>0&&(
                <div style={{padding:'12px 16px',background:'rgba(245,158,11,0.06)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{fontSize:12,color:'hsl(var(--text-muted))'}}>
                    <strong style={{color:'hsl(var(--text-base))'}}>{afetadas.length} parcela{afetadas.length!==1?'s':''}</strong> serão afetadas
                  </div>
                  <div>
                    <span style={{fontSize:11,color:'hsl(var(--text-muted))'}}>Total de desconto: </span>
                    <strong style={{color:'#f59e0b',fontFamily:'monospace',fontSize:14}}>R$ {fmtMoeda(totalDesc)}</strong>
                  </div>
                </div>
              )}
            </div>

            <div style={{padding:'14px 24px',borderTop:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'flex-end',gap:10,background:'hsl(var(--bg-elevated))'}}>
              <button className="btn btn-secondary" onClick={()=>setModalDesconto(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{background:'linear-gradient(135deg,#f59e0b,#d97706)'}} disabled={!descLote.valor||afetadas.length===0} onClick={()=>{
                const v=parseMoeda(descLote.valor)
                const lista = descLote.eventoId ? parcsDoEvento : pendentes.sort((a,b)=>{
                  const da=new Date((a.vencimento||'').split('/').reverse().join('-')+'T12:00')
                  const db=new Date((b.vencimento||'').split('/').reverse().join('-')+'T12:00')
                  return da.getTime()-db.getTime()
                })
                const numsAfetados = lista.filter((_,i)=>i>=deIdx&&i<=ateIdx).map(p=>p.num)
                setParcelas(prev=>prev.map(p=>{
                  if(!numsAfetados.includes(p.num)||p.status==='pago'||p.status==='cancelado') return p
                  // Sempre usa p.valor (bruto original), ignorando qualquer desconto anterior
                  const base = p.valor
                  const d = descLote.tipo==='%' ? +(base * v / 100).toFixed(2) : v
                  // Substitui (não acumula) o desconto existente
                  return {...p, desconto: d, descRaw: v, descTipo: descLote.tipo, valorFinal: Math.max(0, +(base - d).toFixed(2)), manterDesconto: (descLote as any).manterDesconto||false}
                }))
                setModalDesconto(false)
              }}><Check size={14}/> Aplicar Desconto</button>
            </div>
          </div>
        </div>
      )})()}

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
                    {evNomes.map(ev=>{
                      const tNm = parcelas.filter(p=>(p as any).evento===ev).map(p=>(p as any).turmaNome || turmas.find((t:any)=>t.id===(p as any).turmaId)?.nome).find(n=>!!n) || ''
                      return <option key={ev} value={ev}>{ev}{tNm ? ` — ${tNm}` : ''}</option>
                    })}
                  </select>
                  {vctoForm.eventoFiltro&&(()=>{
                    const parcEv = parcelas.filter(p=>p.status!=='cancelado'&&(p as any).evento===vctoForm.eventoFiltro)
                    const tNm = parcEv.map(p=>(p as any).turmaNome || turmas.find((t:any)=>t.id===(p as any).turmaId)?.nome).find(n=>!!n) || ''
                    return(
                      <div style={{marginTop:6,padding:'6px 12px',background:'rgba(6,182,212,0.08)',borderRadius:8,fontSize:11,color:'hsl(var(--text-muted))',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                        <span>Evento: <strong style={{color:'#06b6d4'}}>{vctoForm.eventoFiltro}</strong></span>
                        {tNm && <span style={{padding:'2px 8px',borderRadius:20,background:'rgba(129,140,248,0.15)',border:'1px solid rgba(129,140,248,0.3)',color:'#818cf8',fontWeight:700,fontSize:10}}>🎓 {tNm}</span>}
                        <span style={{marginLeft:'auto'}}>{parcEv.length} parcelas</span>
                      </div>
                    )
                  })()}
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
              const evNomes=[...new Set(parcelas.filter(p=>p.status!=='cancelado'&&p.status!=='pago'&&p.status!=='isento').map(p=>(p as any).evento).filter(Boolean))]
              return evNomes.length>0&&(
                <div>
                  <label className="form-label" style={{fontSize:11,marginBottom:6,display:'block'}}>Evento que sera alterado</label>
                  <select className="form-input" value={alterarValorForm.eventoFiltro} onChange={e=>{
                    const ev=e.target.value
                    const nums=parcelas.filter(p=>p.status!=='cancelado'&&p.status!=='pago'&&p.status!=='isento'&&((p as any).evento===ev||!ev)).map(p=>p.num)
                    setAlterarValorForm(f=>({...f,eventoFiltro:ev,parcelas:nums}))
                  }} style={{fontWeight:600}}>
                    <option value="">- Todos os eventos -</option>
                    {evNomes.map(ev=>{
                      const tNm = parcelas.filter(p=>(p as any).evento===ev).map(p=>(p as any).turmaNome || turmas.find((t:any)=>t.id===(p as any).turmaId)?.nome).find(n=>!!n) || ''
                      return <option key={ev} value={ev}>{ev}{tNm ? ` - ${tNm}` : ''}</option>
                    })}
                  </select>
                  {alterarValorForm.eventoFiltro&&(()=>{
                    const parcEv = parcelas.filter(p=>(p as any).evento===alterarValorForm.eventoFiltro)
                    const tNm = parcEv.map(p=>(p as any).turmaNome || turmas.find((t:any)=>t.id===(p as any).turmaId)?.nome).find(n=>!!n) || ''
                    return tNm ? (
                      <div style={{marginTop:6,padding:'4px 12px',borderRadius:8,background:'rgba(129,140,248,0.08)',border:'1px solid rgba(129,140,248,0.2)',display:'flex',alignItems:'center',gap:6}}>
                        <span style={{fontSize:10,color:'hsl(var(--text-muted))'}}>Turma:</span>
                        <span style={{padding:'2px 8px',borderRadius:20,background:'rgba(129,140,248,0.15)',border:'1px solid rgba(129,140,248,0.3)',color:'#818cf8',fontWeight:700,fontSize:10}}>Turma: {tNm}</span>
                      </div>
                    ) : null
                  })()}
                </div>
              )
            })()}
            <F label="Novo Valor por Parcela (R$)">
              <input className="form-input" value={alterarValorForm.novoValor} onChange={e=>{
                const vStr = e.target.value.replace(/\D/g, '');
                if (!vStr) { setAlterarValorForm(f=>({...f,novoValor:''})); return; }
                const num = (parseInt(vStr, 10) / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                setAlterarValorForm(f=>({...f,novoValor:num}));
              }} placeholder="0,00" style={{fontFamily:"'JetBrains Mono', monospace", fontSize:16, fontWeight:800, color:'#10b981'}}/>
            </F>
            <F label="Motivo da Alteração"><input className="form-input" value={alterarValorForm.motivo} onChange={e=>setAlterarValorForm(f=>({...f,motivo:e.target.value}))} placeholder="Ex: Acordo entre partes, erro no lançamento..."/></F>
            {/* Parcelas com checkboxes individuais */}
            {(()=>{
              const listaParc=alterarValorForm.eventoFiltro
                ?parcelas.filter(p=>p.status!=='cancelado'&&p.status!=='pago'&&p.status!=='isento'&&(p as any).evento===alterarValorForm.eventoFiltro)
                :parcelas.filter(p=>p.status!=='cancelado'&&p.status!=='pago'&&p.status!=='isento')
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
                              <span style={{fontWeight:600,fontSize:12,textTransform:'capitalize'}}>{getEventoDisp(p)}</span>
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
                              {alterarValorForm.novoValor&&isChecked ? (
                                <div style={{fontSize:9,color:'hsl(var(--text-muted))'}}>
                                  Bruto: R$ {alterarValorForm.novoValor} <span style={{opacity:0.6}}>(era R$ {fmtMoeda(p.valor)})</span>
                                </div>
                              ) : (
                                <div style={{fontSize:9,color:'hsl(var(--text-muted))',opacity:0.6}}>
                                  Bruto: R$ {fmtMoeda(p.valor)}
                                </div>
                              )}
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
                <button type="button" className="btn btn-primary" style={{background:'linear-gradient(to right,#a78bfa,#8b5cf6)',border:'none'}} disabled={!alterarValorForm.novoValor||alterarValorForm.parcelas.length===0} onClick={handleAplicarAlteracaoValor}>Aplicar R$ {alterarValorForm.novoValor||'0,00'}</button>
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
          <div style={{background:'hsl(var(--bg-base))',borderRadius:20,width:'100%',maxWidth:580,maxHeight:'92vh',display:'flex',flexDirection:'column',boxShadow:'0 30px 100px rgba(0,0,0,0.6)',border:'1px solid rgba(16,185,129,0.2)',position:'relative'}}>
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
            <div style={{padding:24,overflowY:'auto',display:'flex',flexDirection:'column',gap:24, background:'linear-gradient(to bottom, rgba(16,185,129,0.02), transparent)'}}>


              <div style={{display:'flex',flexDirection:'column',gap:24}}>
                
                {/* BLOCO 1: IDENTIFICAÇÃO DO EVENTO */}
                <div style={{background:'hsl(var(--bg-elevated))', padding:20, borderRadius:16, border:'1px solid hsl(var(--border-subtle))', boxShadow:'0 4px 24px rgba(0,0,0,0.04)', display:'flex', flexDirection:'column', gap:16, position:'relative'}}>
                  <div style={{position:'absolute', top:0, left:0, width:4, height:'100%', background:'#10b981', borderTopLeftRadius:16, borderBottomLeftRadius:16}} />
                  <div style={{fontSize:12,fontWeight:800,color:'#10b981',textTransform:'uppercase',letterSpacing:1.5,marginBottom:4}}>Identificação</div>
                  
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                    <F label="Turma do Evento">
                      <select
                        className="form-input"
                        value={eventoForm.turmaId}
                        onChange={e=>{
                          const t=turmas.find((x:any)=>x.id===e.target.value)
                          setEventoForm(f=>({...f,turmaId:e.target.value,turmaNome:(t as any)?.nome||''}))
                        }}
                        style={{fontWeight:600}}
                      >
                        <option value="">— Selecionar turma —</option>
                        {turmas.map((t:any)=>(
                          <option key={t.id} value={t.id}>{t.nome}{t.turno?' · '+t.turno:''}</option>
                        ))}
                      </select>
                    </F>

                    <div style={{position:'relative'}}>
                      <label className="form-label">Evento</label>
                      <div className="form-input" style={{display:'flex', alignItems:'center', cursor:'pointer', height: 40}} onClick={()=>setEventoForm((f:any)=>({...f, _showEventoModal: true}))}>
                        {eventoForm.eventoNome || <span style={{color:'hsl(var(--text-muted))'}}>Ex: Material Didático...</span>}
                      </div>
                      {/* EventSelecionar Dropdown internal */}
                      {(eventoForm as any)._showEventoModal && (
                        <div style={{position:'absolute', top:'100%', left:0, right:-10, marginTop:6, background:'hsl(var(--bg-base))', zIndex:100, borderRadius:12, display:'flex', flexDirection:'column', padding:12, border:'1px solid hsl(var(--border-strong))', boxShadow:'0 10px 40px rgba(0,0,0,0.2)'}}>
                          <div style={{display:'flex', gap:8, marginBottom:10}}>
                            <input type="text" className="form-input" placeholder="Buscar evento..." autoFocus onChange={e => {
                              document.querySelectorAll('.evento-item-novo').forEach(el => {
                                const v = (el.textContent||'').toLowerCase();
                                (el as HTMLElement).style.display = v.includes(e.target.value.toLowerCase()) ? 'block' : 'none';
                              })
                            }} />
                          </div>
                          <div style={{maxHeight:220, overflowY:'auto', display:'flex', flexDirection:'column', gap:6}}>
                            {cfgEventos.filter(ev=>ev.situacao==='ativo').map(ev=> (
                              <button key={ev.id} className="evento-item-novo" type="button" style={{textAlign:'left', padding: '10px 12px', background:'hsl(var(--bg-elevated))', border:'1px solid hsl(var(--border-subtle))', borderRadius:8, cursor:'pointer'}}
                                onClick={()=>setEventoForm((f:any)=>({...f, eventoNome: ev.descricao, eventoId: ev.id, _showEventoModal: false}))}>
                                <div style={{fontFamily:'monospace', fontSize:10, color:'#10b981', marginBottom:2}}>{ev.codigo}</div>
                                <div style={{fontWeight:600, fontSize:13}}>{ev.descricao}</div>
                              </button>
                            ))}
                          </div>
                          <div style={{marginTop: 10, display:'flex', justifyContent:'flex-end'}}>
                            <button type="button" className="btn btn-secondary" style={{padding:'6px 12px', fontSize:12, minHeight:30}} onClick={()=>setEventoForm((f:any)=>({...f, _showEventoModal: false}))}>Cancelar</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <F label="Observação da Parcela (opcional)">
                    <input className="form-input" value={(eventoForm as any).obs||''} onChange={e=>setEventoForm(f=>({...f,obs:e.target.value}))} placeholder="Anotações, referências, detalhes do acordo..."/>
                  </F>
                </div>

                {/* BLOCO 2: VALORES E DESCONTOS */}
                <div style={{background:'hsl(var(--bg-elevated))', padding:20, borderRadius:16, border:'1px solid hsl(var(--border-subtle))', boxShadow:'0 4px 24px rgba(0,0,0,0.04)', display:'flex', flexDirection:'column', gap:16, position:'relative', overflow:'hidden'}}>
                  <div style={{position:'absolute', top:0, left:0, width:4, height:'100%', background:'#6366f1'}} />
                  <div style={{fontSize:12,fontWeight:800,color:'#6366f1',textTransform:'uppercase',letterSpacing:1.5,marginBottom:4}}>Composição de Valor</div>
                  
                  <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:16}}>
                    <F label="">
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:6,height:22}}>
                        <span style={{fontSize:11,fontWeight:800,color:'hsl(var(--text-muted))',textTransform:'uppercase'}}>Valor (R$)</span>
                        <div style={{display:'flex',background:'hsl(var(--bg-base))',borderRadius:6,border:'1px solid hsl(var(--border-subtle))',overflow:'hidden',boxShadow:'inset 0 1px 3px rgba(0,0,0,0.05)'}}>
                          <button type="button" onClick={()=>setEventoForm(f=>({...f,tipoValor:'total'}))} style={{fontSize:9,fontWeight:800,padding:'4px 10px',background:(eventoForm as any).tipoValor==='total'?'#6366f1':'transparent',color:(eventoForm as any).tipoValor==='total'?'#fff':'hsl(var(--text-muted))',border:'none',cursor:'pointer',outline:'none',transition:'all .2s'}}>TOTAL</button>
                          <button type="button" onClick={()=>setEventoForm(f=>({...f,tipoValor:'parcela'}))} style={{fontSize:9,fontWeight:800,padding:'4px 10px',borderLeft:'1px solid hsl(var(--border-subtle))',background:(eventoForm as any).tipoValor==='parcela'?'#6366f1':'transparent',color:(eventoForm as any).tipoValor==='parcela'?'#fff':'hsl(var(--text-muted))',borderTop:'none',borderRight:'none',borderBottom:'none',cursor:'pointer',outline:'none',transition:'all .2s'}}>PARCELA</button>
                        </div>
                      </div>
                      <input className="form-input" value={eventoForm.valor} onChange={e=>setEventoForm(f=>({...f,valor:e.target.value}))} placeholder="0,00" style={{fontFamily:"'JetBrains Mono', monospace", fontSize:15, fontWeight:700}}/>
                    </F>
                    <F label="Tipo Desc.">
                      <div style={{display:'flex',borderRadius:8,overflow:'hidden',border:'1px solid hsl(var(--border-subtle))',height:42,boxShadow:'inset 0 1px 3px rgba(0,0,0,0.05)'}}>
                        {(['%','R$'] as const).map(t=><button key={t} type="button" style={{flex:1,fontSize:13,fontWeight:800,cursor:'pointer',border:'none',background:eventoForm.descTipo===t?'#6366f1':'hsl(var(--bg-base))',color:eventoForm.descTipo===t?'#fff':'hsl(var(--text-muted))',transition:'all .2s'}} onClick={()=>setEventoForm(f=>({...f,descTipo:t}))}>{t}</button>)}
                      </div>
                    </F>
                    <F label={`Desconto (${eventoForm.descTipo})`}>
                      <input className="form-input" value={eventoForm.descValor} onChange={e=>setEventoForm(f=>({...f,descValor:e.target.value}))} placeholder={eventoForm.descTipo==='%'?'Ex: 10':'Ex: 20,00'} style={{fontFamily:"'JetBrains Mono', monospace", fontSize:15, fontWeight:700, color:'#10b981'}}/>
                    </F>
                  </div>

                  {/* Manter Desconto (Agregado em Valores) */}
                  <div style={{background:'linear-gradient(135deg, rgba(236,72,153,0.05), rgba(79,70,229,0.05))', padding:'16px 20px', borderRadius:12, border:'1px solid rgba(236,72,153,0.15)', marginTop:4}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                      <div style={{paddingRight:20}}>
                        <div style={{fontWeight:800,fontSize:13,color:'#db2777'}}>Manter Desconto</div>
                        <div style={{fontSize:11,color:'hsl(var(--text-muted))',marginTop:4,lineHeight:1.4}}>Ao ativar, o sistema preservará o valor do desconto independentemente de atrasos.</div>
                      </div>
                      <button type="button" onClick={()=>setEventoForm(f=>({...f,manterDesconto:!f.manterDesconto}))}
                        style={{width:48,height:26,borderRadius:13,border:'none',cursor:'pointer',
                          background:eventoForm.manterDesconto?'#db2777':'hsl(var(--border-subtle))',
                          position:'relative',transition:'background 0.3s cubic-bezier(0.4, 0, 0.2, 1)',flexShrink:0,boxShadow:'inset 0 2px 4px rgba(0,0,0,0.1)'}}>
                        <div style={{position:'absolute',top:2,left:eventoForm.manterDesconto?'calc(100% - 24px)':2,width:22,height:22,borderRadius:11,background:'white',transition:'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',boxShadow:'0 2px 6px rgba(0,0,0,0.2)'}}/>
                      </button>
                    </div>
                  </div>
                </div>

                {/* BLOCO 3: VENCIMENTO E RECORRÊNCIA */}
                <div style={{background:'hsl(var(--bg-elevated))', padding:20, borderRadius:16, border:'1px solid hsl(var(--border-subtle))', boxShadow:'0 4px 24px rgba(0,0,0,0.04)', display:'flex', flexDirection:'column', gap:16, position:'relative', overflow:'hidden'}}>
                  <div style={{position:'absolute', top:0, left:0, width:4, height:'100%', background:'#f59e0b'}} />
                  <div style={{fontSize:12,fontWeight:800,color:'#f59e0b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:4}}>Agendamento Financeiro</div>

                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
                    <F label="Primeiro Vencimento">
                      <input className="form-input" type="date" value={eventoForm.vencimentoInicial} onChange={e=>setEventoForm(f=>({...f,vencimentoInicial:e.target.value}))} style={{fontWeight:700}}/>
                    </F>
                    {eventoForm.tipoVencimento==='diaX'&&(
                      <F label="Todo dia">
                        <input className="form-input" type="number" min="1" max="31" value={eventoForm.diaVcto} onChange={e=>setEventoForm(f=>({...f,diaVcto:e.target.value}))} placeholder="Ex: 5" style={{fontFamily:"'JetBrains Mono', monospace", fontWeight:700}}/>
                      </F>
                    )}
                    <F label="Total de Parcelas">
                      <input
                        className="form-input"
                        type="number" min="1" max="120"
                        value={eventoForm.parcelaFinal}
                        onChange={e=>{
                          const qtd=Math.max(1,parseInt(e.target.value)||1)
                          setEventoForm(f=>({...f,parcelaInicial:'1',parcelaFinal:String(qtd)}))
                        }}
                        style={{textAlign:'center',fontFamily:"'JetBrains Mono', monospace", fontWeight:800, fontSize:15}}
                        placeholder="Ex: 10"
                      />
                    </F>
                  </div>
                  
                  {/* Tipo de Vencimento */}
                  <div style={{background:'hsl(var(--bg-base))',padding:'16px',borderRadius:12,border:'1px solid hsl(var(--border-subtle))',boxShadow:'inset 0 2px 10px rgba(0,0,0,0.02)'}}>
                    <label style={{fontSize:11,fontWeight:800,color:'hsl(var(--text-muted))',textTransform:'uppercase',marginBottom:12,display:'block'}}>Padrão de Recorrência</label>
                    <div style={{display:'flex',gap:12}}>
                      {([{v:'diaX',l:'Todo dia X do mês',s:'Vencimentos ancorados ao mês subsequente'},{v:'30dias',l:'A cada 30 dias corridos',s:'Intervalo fixo exato a cada 30 dias'}] as const).map(opt=>(
                        <button key={opt.v} type="button" onClick={()=>setEventoForm(f=>({...f,tipoVencimento:opt.v}))}
                          style={{flex:1,padding:'14px',textAlign:'left',borderRadius:10,background:eventoForm.tipoVencimento===opt.v?'rgba(245,158,11,0.08)':'hsl(var(--bg-elevated))',border:`2px solid ${eventoForm.tipoVencimento===opt.v?'#f59e0b':'transparent'}`,boxShadow:eventoForm.tipoVencimento===opt.v?'0 4px 14px rgba(245,158,11,0.15)':'0 2px 8px rgba(0,0,0,0.05)',cursor:'pointer',transition:'all 0.2s',transform:eventoForm.tipoVencimento===opt.v?'translateY(-2px)':'none'}}>
                          <div style={{fontWeight:800,fontSize:14,color:eventoForm.tipoVencimento===opt.v?'#d97706':'hsl(var(--text-base))'}}>{opt.l}</div>
                          <div style={{fontSize:11,color:eventoForm.tipoVencimento===opt.v?'#b45309':'hsl(var(--text-muted))',marginTop:4,lineHeight:1.3}}>{opt.s}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            {eventoForm.valor&&eventoForm.parcelaFinal&&eventoForm.vencimentoInicial&&(()=>{
              const ev=cfgEventos.find(e=>e.id===eventoForm.eventoId)
              // Preview: sempre começa em 1, vai até qtd (independente de outros eventos)
              const qtd=Math.max(1,parseInt(eventoForm.parcelaFinal)||1)
              const valInput=parseMoeda(eventoForm.valor)
              let valTotal=valInput, valBase=+(valInput/qtd).toFixed(2), diff=+(valInput - (valBase*qtd)).toFixed(2)
              if ((eventoForm as any).tipoValor==='parcela') { valBase=valInput; valTotal=valInput*qtd; diff=0; }
              const dv=parseMoeda(eventoForm.descValor)
              const desc=eventoForm.descValor?(eventoForm.descTipo==='%'?+(valBase*dv/100).toFixed(2):dv):0
              const sd=new Date(eventoForm.vencimentoInicial+'T12:00')
              const calcData=(i:number)=>{
                if(eventoForm.tipoVencimento==='30dias'){const d=new Date(sd);d.setDate(d.getDate()+i*30);return d}
                else{const d=new Date(sd);d.setMonth(d.getMonth()+i);if(eventoForm.diaVcto&&i>0)d.setDate(parseInt(eventoForm.diaVcto));return d}
              }
              // n = índice interno do evento (1..qtd)
              const prevs=Array.from({length:Math.min(qtd,6)},(_,i)=>({n:i+1,v:calcData(i).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}),valP:+(valBase+(i===0?diff:0)).toFixed(2)}))
              const totalVlrF=Array.from({length:qtd},(_,i)=>Math.max(0,+(valBase+(i===0?diff:0)).toFixed(2)-desc)).reduce((a,b)=>a+b,0)
              return(<div style={{padding:'14px 16px',background:'rgba(16,185,129,0.06)',border:'1px solid rgba(16,185,129,0.2)',borderRadius:12}}>
                <div style={{fontWeight:700,fontSize:13,color:'#34d399',marginBottom:10,display:'flex',justifyContent:'space-between'}}>
                  <span>{ev?.descricao||eventoForm.eventoNome||'Evento'} · {qtd} parcela(s) <span style={{fontSize:11,color:'hsl(var(--text-muted))',fontWeight:400}}>(1 a {qtd})</span></span>
                  {desc>0&&<span style={{fontSize:12,color:'#f59e0b'}}>Desc.: R$ {fmtMoeda(desc)}/mês</span>}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:4}}>
                  {prevs.map(pv=><div key={pv.n} style={{display:'flex',justifyContent:'space-between',padding:'5px 8px',background:'rgba(16,185,129,0.06)',borderRadius:6,fontSize:12}}>
                    <span style={{color:'hsl(var(--text-muted))'}}><strong style={{color:'#818cf8',fontFamily:'monospace'}}>{pv.n}/{qtd}</strong> — <strong style={{color:'hsl(var(--text-secondary))'}}>{pv.v}</strong></span>
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
              // Quantidade de parcelas DESTE evento (sempre começa em 1 — independente de outros eventos)
              const qtd=Math.max(1,parseInt(eventoForm.parcelaFinal)||1)
              const valInput=parseMoeda(eventoForm.valor)
              let valTotal=valInput, valBase=+(valInput/qtd).toFixed(2), diff=+(valInput - (valBase*qtd)).toFixed(2)
              if ((eventoForm as any).tipoValor==='parcela') { valBase=valInput; valTotal=valInput*qtd; diff=0; }
              const dv=parseMoeda(eventoForm.descValor)
              const desc=eventoForm.descValor?(eventoForm.descTipo==='%'?+(valBase*dv/100).toFixed(2):dv):0

              const sd=new Date(eventoForm.vencimentoInicial+'T12:00')
              // ID único para este lançamento — nome do evento não é a chave, o ID é
              const alunoEventoId = newId('EV')
              const nomeEvento = ev?.descricao||eventoForm.eventoNome||'Evento'
              const calcData=(i:number)=>{
                if(eventoForm.tipoVencimento==='30dias'){const d=new Date(sd);d.setDate(d.getDate()+i*30);return d}
                else{const d=new Date(sd);d.setMonth(d.getMonth()+i);if(eventoForm.diaVcto&&i>0)d.setDate(parseInt(eventoForm.diaVcto));return d}
              }
              const dataLancamento = new Date().toISOString()
              // Cada parcela: numParcela vai de 1..qtd (específico deste evento)
              // totalParcelas é sempre qtd (deste evento)
              const novas=Array.from({length:qtd},(_,i)=>{
                const d=calcData(i);
                const valP=+(valBase+(i===0?diff:0)).toFixed(2);
                const vlrFP=Math.max(0,valP-desc);
                  return{
                  // num temporário; será substituído ao ordenar — use numParcela para exibição
                  num: 0,
                  competencia:d.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}),
                  vencimento:d.toLocaleDateString('pt-BR'),
                  valor:valP,desconto:desc,valorFinal:vlrFP,
                  status:'pendente' as const,obs:(eventoForm as any).obs||'',editando:false,
                  evento:nomeEvento,
                  eventoId:alunoEventoId,   // <— ID único: evento com mesmo nome = ID diferente
                  numParcela:i+1,           // <— sempre 1..N dentro deste evento
                  totalParcelas:qtd,        // <— total deste evento
                  turmaId:eventoForm.turmaId||undefined,    // <— turma específica deste evento
                  turmaNome:eventoForm.turmaNome||(turmas.find((t:any)=>t.id===eventoForm.turmaId) as any)?.nome||undefined,
                  codigo:String(Math.floor(100000+Math.random()*900000)),
                  manterDesconto:eventoForm.manterDesconto,
                  descTipo:eventoForm.descValor?eventoForm.descTipo:undefined,
                  descRaw:dv,
                  dataLancamento
                }
              })
              // Ordenar todas as parcelas por data e reatribuir num global (só para ordenação interna)
              const todasOrdenadas=[...parcelas,...novas].sort((a,b)=>{
                const pa=new Date(a.vencimento.split('/').reverse().join('-')+'T12:00')
                const pb=new Date(b.vencimento.split('/').reverse().join('-')+'T12:00')
                // Desempate: parcelas do mesmo vencimento → agrupa por eventoId
                if(pa.getTime()===pb.getTime()) return ((a as any).eventoId||'').localeCompare((b as any).eventoId||'')
                return pa.getTime()-pb.getTime()
              }).map((p,i)=>({...p,num:i+1}))  // num = índice global de ordenação apenas
              setParcelas(todasOrdenadas);setParcelasConfirmadas(false);setModalEventoFin(false)
              setEventoForm({turmaId:mat.turmaId,turmaNome:'',eventoNome:'',eventoId:'',vencimentoInicial:'',parcelaInicial:'1',parcelaFinal:'1',tipoVencimento:'diaX',diaVcto:'5',valor:'',descTipo:'%',descValor:'',manterDesconto:false,obs:''})
            }}><Check size={14}/> Inserir {Math.max(1,parseInt(eventoForm.parcelaFinal)||1)} Lançamento(s)</button>
          </div>
        </div>
      </div>)}

      {/* ══════════════ MODAL EDITAR PARCELA ══════════════ */}
      {modalEditarParcela&&parcelaAtiva&&(()=>{
        const eid = parcelaAtiva.eventoId;
        const pd = (dStr: string) => { const [d,m,a] = (dStr||'').split('/'); return new Date(`${a||0}-${m||0}-${d||0}T12:00:00`); };
        const eparcs = (!parcelaAtiva.numParcela && eid) ? [...parcelas].filter((x:any)=>x.status!=='cancelado' && x.eventoId===eid).sort((a:any,b:any)=>pd(a.vencimento).getTime()-pd(b.vencimento).getTime()) : null;
        const evtIndex = parcelaAtiva.numParcela || (eparcs ? eparcs.findIndex((x:any)=>x.num===parcelaAtiva.num) + 1 : 1);
        const pDen = parcelaAtiva.totalParcelas || (eparcs ? eparcs.length : 1);
        return(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:5000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'hsl(var(--bg-base))',borderRadius:20,width:'100%',maxWidth:580,maxHeight:'92vh',overflowY:'auto',border:'1px solid hsl(var(--border-subtle))',boxShadow:'0 40px 120px rgba(0,0,0,0.8)'}}>            
            {/* Header */}
            <div style={{padding:'18px 24px',borderBottom:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'space-between',alignItems:'center',background:'linear-gradient(135deg,rgba(99,102,241,0.1),rgba(139,92,246,0.04))'}}>
              <div style={{display:'flex',alignItems:'center',gap:14}}>
                {/* Badge numero */}
                <div style={{width:64,height:48,borderRadius:12,background:'rgba(99,102,241,0.15)',border:'2px solid rgba(99,102,241,0.3)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                  <div style={{fontSize:9,color:'#818cf8',fontWeight:700,letterSpacing:1}}>PARC.</div>
                  <div style={{fontFamily:'monospace',fontWeight:900,fontSize:15,color:'#818cf8'}}>{String(evtIndex).padStart(2,'0')}/{String(pDen).padStart(2,'0')}</div>
                </div>
                <div>
                  <div style={{fontWeight:800,fontSize:15}}>Editar Parcela</div>
                  <div style={{fontSize:11,color:'hsl(var(--text-muted))',textTransform:'capitalize',marginTop:1}}>
                    {parcelaAtiva.evento||parcelaAtiva.competencia}
                    {(()=>{const tNm=(parcelaAtiva as any).turmaNome||turmas.find((t:any)=>t.id===(parcelaAtiva as any).turmaId)?.nome;return tNm?<span style={{marginLeft:6,fontSize:10,color:'#818cf8',fontWeight:700}}>🎓 {tNm}</span>:null})()}
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
              <div style={{display:'grid',gridTemplateColumns:'repeat(6, 1fr)',gap:8,padding:'16px',background:'hsl(var(--bg-elevated))',borderRadius:12,border:'1px solid hsl(var(--border-subtle))'}}>
                <div style={{textAlign:'center'}}><div style={{fontSize:9,color:'hsl(var(--text-muted))',fontWeight:700,marginBottom:4,whiteSpace:'nowrap'}}>PARCELA</div><div style={{fontFamily:'monospace',fontWeight:900,fontSize:14,color:'#818cf8',whiteSpace:'nowrap'}}>{String(evtIndex).padStart(2,'0')}/{String(pDen).padStart(2,'0')}</div></div>
                <div style={{textAlign:'center'}}><div style={{fontSize:9,color:'hsl(var(--text-muted))',fontWeight:700,marginBottom:4,whiteSpace:'nowrap'}}>BRUTO (R$)</div><div style={{fontFamily:'monospace',fontWeight:800,fontSize:14,whiteSpace:'nowrap'}}>{fmtMoeda(parcelaAtiva.valor)}</div></div>
                <div style={{textAlign:'center'}}><div style={{fontSize:9,color:'hsl(var(--text-muted))',fontWeight:700,marginBottom:4,whiteSpace:'nowrap'}}>DESC. (R$)</div><div style={{fontFamily:'monospace',fontWeight:800,fontSize:14,color:'#f59e0b',whiteSpace:'nowrap'}}>{fmtMoeda(parcelaAtiva.desconto)}</div></div>
                <div style={{textAlign:'center'}}><div style={{fontSize:9,color:'hsl(var(--text-muted))',fontWeight:700,marginBottom:4,whiteSpace:'nowrap'}}>JUROS (R$)</div><div style={{fontFamily:'monospace',fontWeight:800,fontSize:14,color:'#ef4444',whiteSpace:'nowrap'}}>{fmtMoeda(parcelaAtiva.juros||0)}</div></div>
                <div style={{textAlign:'center'}}><div style={{fontSize:9,color:'hsl(var(--text-muted))',fontWeight:700,marginBottom:4,whiteSpace:'nowrap'}}>MULTA (R$)</div><div style={{fontFamily:'monospace',fontWeight:800,fontSize:14,color:'#ef4444',whiteSpace:'nowrap'}}>{fmtMoeda(parcelaAtiva.multa||0)}</div></div>
                <div style={{textAlign:'center'}}><div style={{fontSize:9,color:'hsl(var(--text-muted))',fontWeight:700,marginBottom:4,whiteSpace:'nowrap'}}>FINAL (R$)</div><div style={{fontFamily:'monospace',fontWeight:800,fontSize:14,color:'#34d399',whiteSpace:'nowrap'}}>{fmtMoeda(parcelaAtiva.valorFinal + (parcelaAtiva.juros||0) + (parcelaAtiva.multa||0))}</div></div>
              </div>
              {/* Evento e Vencimento */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div style={{position:'relative'}}>
                  <label className="form-label">Evento / Competência</label>
                  <div className="form-input" style={{display:'flex', alignItems:'center', cursor:'pointer', height: 40}} onClick={()=>setParcelaAtiva((a:any)=>({...a, _showEventoModal: true}))}>
                    {parcelaAtiva.evento || <span style={{color:'hsl(var(--text-muted))'}}>Selecionar o evento...</span>}
                  </div>
                  {/* EventSelecionar Dropdown internal */}
                  {parcelaAtiva._showEventoModal && (
                    <div style={{position:'absolute', top:'100%', left:0, right:-10, marginTop:6, background:'hsl(var(--bg-base))', zIndex:100, borderRadius:12, display:'flex', flexDirection:'column', padding:12, border:'1px solid hsl(var(--border-strong))', boxShadow:'0 10px 40px rgba(0,0,0,0.2)'}}>
                      <div style={{display:'flex', gap:8, marginBottom:10}}>
                        <input type="text" className="form-input" placeholder="Buscar evento..." autoFocus onChange={e => {
                          document.querySelectorAll('.evento-item-drop').forEach(el => {
                            const v = (el.textContent||'').toLowerCase();
                            (el as HTMLElement).style.display = v.includes(e.target.value.toLowerCase()) ? 'block' : 'none';
                          })
                        }} />
                      </div>
                      <div style={{maxHeight:220, overflowY:'auto', display:'flex', flexDirection:'column', gap:6}}>
                        {cfgEventos.filter(ev=>ev.situacao==='ativo').map(ev=> (
                          <button key={ev.id} className="evento-item-drop" type="button" style={{textAlign:'left', padding: '10px 12px', background:'hsl(var(--bg-elevated))', border:'1px solid hsl(var(--border-subtle))', borderRadius:8, cursor:'pointer'}}
                            onClick={()=>setParcelaAtiva((a:any)=>({...a, evento: ev.descricao, _showEventoModal: false}))}>
                            <div style={{fontFamily:'monospace', fontSize:10, color:'#6366f1', marginBottom:2}}>{ev.codigo}</div>
                            <div style={{fontWeight:600, fontSize:13}}>{ev.descricao}</div>
                          </button>
                        ))}
                      </div>
                      <div style={{marginTop: 10, display:'flex', justifyContent:'flex-end'}}>
                        <button type="button" className="btn btn-secondary" style={{padding:'6px 12px', fontSize:12, minHeight:30}} onClick={()=>setParcelaAtiva((a:any)=>({...a, _showEventoModal: false}))}>Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>
                <F label="Data de Vencimento">
                  <input className="form-input" type="date" value={parcelaAtiva.vencimento.split('/').reverse().join('-')} onChange={e=>{
                    const iso = e.target.value;
                    const brDate = iso.split('-').reverse().join('/');
                    setParcelaAtiva((a:any)=>({...a,vencimento:brDate}))
                  }}/>
                </F>
              </div>
              {/* Valores */}
              <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:12}}>
                <F label="Valor Principal (R$)">
                  <input type="text" className="form-input" style={{fontFamily:'monospace'}} value={fmtMoeda(parcelaAtiva.valor)} onChange={e=>{
                    const raw=e.target.value.replace(/\D/g,''); const v=raw?parseInt(raw,10)/100:0;
                    setParcelaAtiva((a:any)=>{
                      const t=a.descTipo||'R$', raw2=a.descRaw??a.desconto;
                      const d=t==='%' ? +(v*raw2/100).toFixed(2) : raw2;
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
                  <input type="text" className="form-input" style={{fontFamily:'monospace'}} value={fmtMoeda(parcelaAtiva.descRaw??parcelaAtiva.desconto)} onChange={e=>{
                    const raw=e.target.value.replace(/\D/g,''); const rawNum=raw?parseInt(raw,10)/100:0;
                    setParcelaAtiva((a:any)=>{
                      const t=a.descTipo||'R$';
                      const d=t==='%' ? +(a.valor*rawNum/100).toFixed(2) : rawNum;
                      return{...a,descRaw:rawNum,desconto:d,valorFinal:Math.max(0,a.valor-d)}
                    })
                  }}/>
                </F>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <F label="Juros (R$)">
                  <input type="text" className="form-input" style={{fontFamily:'monospace'}} value={fmtMoeda(parcelaAtiva.juros??0)} onChange={e=>{
                    const raw=e.target.value.replace(/\D/g,''); const v=raw?parseInt(raw,10)/100:0;
                    setParcelaAtiva((a:any)=>({...a,juros:v}))
                  }}/>
                </F>
                <F label="Multa (R$)">
                  <input type="text" className="form-input" style={{fontFamily:'monospace'}} value={fmtMoeda(parcelaAtiva.multa??0)} onChange={e=>{
                    const raw=e.target.value.replace(/\D/g,''); const v=raw?parseInt(raw,10)/100:0;
                    setParcelaAtiva((a:any)=>({...a,multa:v}))
                  }}/>
                </F>
              </div>
              <F label="Manter Desconto">
                <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',background:'rgba(236,72,153,0.05)',borderRadius:10,border:'1px solid rgba(236,72,153,0.15)'}}>
                  <button type="button" onClick={()=>setParcelaAtiva((a:any)=>({...a,manterDesconto:!a.manterDesconto}))}
                    style={{width:44,height:24,borderRadius:12,border:'none',cursor:'pointer',
                      background:parcelaAtiva.manterDesconto?'#db2777':'hsl(var(--border-subtle))',
                      position:'relative',transition:'background 0.3s cubic-bezier(0.4, 0, 0.2, 1)',flexShrink:0,boxShadow:'inset 0 2px 4px rgba(0,0,0,0.1)'}}>
                    <div style={{position:'absolute',top:2,left:parcelaAtiva.manterDesconto?'calc(100% - 22px)':2,width:20,height:20,borderRadius:10,background:'white',transition:'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',boxShadow:'0 2px 6px rgba(0,0,0,0.2)'}}/>
                  </button>
                  <label style={{fontSize:12,color:'hsl(var(--text-muted))',lineHeight:1.4}}>
                    <strong style={{color:'#db2777'}}>Ao ativar</strong>, o sistema preservará o valor do desconto independentemente de atrasos.
                  </label>
                </div>
              </F>
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
                  <button className="btn btn-ghost btn-sm" style={{color:'#f87171',fontSize:12}} onClick={()=>{void (async()=>{if(await dlg.confirm('Tem certeza que deseja marcar esta parcela como cancelada?',{type:'error',title:'Cancelar Parcela',confirmLabel:'Sim, cancelar'})){setParcelas(prev=>prev.map(p=>p.num===parcelaAtiva.num?{...p,status:'cancelado',dataExclusao:new Date().toLocaleDateString('pt-BR'),motivoExclusao:'Cancelamento via edição'}:p));setModalEditarParcela(false)}})()}}> 🗑️ Excluir</button>
                )}
                {parcelaAtiva.status === 'pago' && (
                  <div style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:8,background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.25)'}}>
                    <span style={{fontSize:11,color:'#10b981',fontWeight:700}}>✅ Parcela paga — somente leitura. Use "Excluir Baixa" para editar.</span>
                  </div>
                )}
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-secondary" onClick={()=>setModalEditarParcela(false)}>Fechar</button>
                {parcelaAtiva.status !== 'pago' && (
                  <button className="btn btn-primary" style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)'}} onClick={()=>{
                    setParcelas(prev=>prev.map(p=>p.num===parcelaAtiva.num?{...p,...parcelaAtiva}:p))
                    setModalEditarParcela(false)
                  }}><Check size={14}/> Salvar Alterações</button>
                )}
              </div>
            </div>
          </div>
        </div>
        )
      })()}

      {/* ══════════════ MODAL BAIXAR PARCELA ══════════════ */}
      {modalBaixarParcela&&parcelaAtiva&&(()=>{
        const eid = parcelaAtiva.eventoId;
        const pd = (dStr: string) => { const [d,m,a] = (dStr||'').split('/'); return new Date(`${a||0}-${m||0}-${d||0}T12:00:00`); };
        const eparcs = (!parcelaAtiva.numParcela && eid) ? [...parcelas].filter((x:any)=>x.status!=='cancelado' && x.eventoId===eid).sort((a:any,b:any)=>pd(a.vencimento).getTime()-pd(b.vencimento).getTime()) : null;
        const evtIndex = parcelaAtiva.numParcela || (eparcs ? eparcs.findIndex((x:any)=>x.num===parcelaAtiva.num) + 1 : 1);
        const pDen = parcelaAtiva.totalParcelas || (eparcs ? eparcs.length : 1);

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
                        {String(evtIndex).padStart(2,'0')}
                      </div>
                      <div style={{fontSize:8,color:'rgba(129,140,248,0.7)',fontFamily:'monospace'}}>de {String(pDen).padStart(2,'0')}</div>
                    </div>
                    <div>
                      <div style={{fontWeight:800,fontSize:14,color:'hsl(var(--text-base))',textTransform:'capitalize'}}>{(parcelaAtiva as any).evento||parcelaAtiva.competencia}</div>
                      {(()=>{const tNm=(parcelaAtiva as any).turmaNome||turmas.find((t:any)=>t.id===(parcelaAtiva as any).turmaId)?.nome;return tNm?<div style={{fontSize:11,color:'#818cf8',fontWeight:600,marginTop:1}}>🎓 {tNm}</div>:null})()}
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
                  <F label="Multa (R$)">
                    <input className="form-input" style={{fontFamily:'monospace',color:parseMoeda(baixaForm.multa)>0?'#f87171':'inherit'}} value={baixaForm.multa} onChange={e=>{
                      const raw=e.target.value.replace(/\D/g,''); const nv=raw?fmtMoeda(parseInt(raw,10)/100):'0,00';
                      setBaixaForm((ff:any)=>{
                         const tr=Math.max(0,parcelaAtiva.valor-parseMoeda(ff.desconto||String(parcelaAtiva.desconto||'0'))+parseMoeda(ff.juros)+parseMoeda(nv))
                         return{...ff,multa:nv,formasPagto:ff.formasPagto.length===1?[{...ff.formasPagto[0],valor:fmtMoeda(tr)}]:ff.formasPagto}
                      })
                    }} placeholder="0,00"/>
                  </F>
                  <F label="Juros (R$)">
                    <input className="form-input" style={{fontFamily:'monospace',color:parseMoeda(baixaForm.juros)>0?'#f87171':'inherit'}} value={baixaForm.juros} onChange={e=>{
                      const raw=e.target.value.replace(/\D/g,''); const nv=raw?fmtMoeda(parseInt(raw,10)/100):'0,00';
                      setBaixaForm((ff:any)=>{
                         const tr=Math.max(0,parcelaAtiva.valor-parseMoeda(ff.desconto||String(parcelaAtiva.desconto||'0'))+parseMoeda(nv)+parseMoeda(ff.multa))
                         return{...ff,juros:nv,formasPagto:ff.formasPagto.length===1?[{...ff.formasPagto[0],valor:fmtMoeda(tr)}]:ff.formasPagto}
                      })
                    }} placeholder="0,00"/>
                  </F>
                  <F label="Desconto (R$)">
                    <input className="form-input" style={{fontFamily:'monospace'}} value={baixaForm.desconto} onChange={e=>{
                      const raw=e.target.value.replace(/\D/g,''); const nv=raw?fmtMoeda(parseInt(raw,10)/100):'0,00';
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
                        value={item.valor} placeholder="0,00"
                        onChange={e=>{
                          const raw=e.target.value.replace(/\D/g,''); const nv=raw?fmtMoeda(parseInt(raw,10)/100):'0,00';
                          setBaixaForm((ff:any)=>({...ff,formasPagto:ff.formasPagto.map((x:any,i:number)=>i===idx?{...x,valor:nv}:x)}))
                        }}
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
        const cartaoSrcForma=cartaoCtx==='baixaResp'?baixaRespForm.formasPagto[cartaoFormIdx]:cartaoCtx==='baixaLote'?baixaLoteMultiFormas[cartaoFormIdx]:baixaForm.formasPagto[cartaoFormIdx]
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
                        <td style={{padding:'7px 10px',fontFamily:'monospace',fontWeight:900,color:'#818cf8',fontSize:12}}>R$ {fmtMoeda(parseMoeda(cartaoSrcForma?.valor||'0'))}</td>
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
                  } else if (cartaoCtx==='baixaLote') {
                    setBaixaLoteMultiFormas((ff:any)=>ff.map((x:any,i:number)=>i===cartaoFormIdx?{...x,cartao:{...cartaoForm}}:x))
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
        const brutoTotal = baixaLoteParcelas.reduce((s,p)=>s+p.valor,0)
        const totalJuros = baixaLoteParcelas.reduce((s,p)=>s+parseMoeda(p.loteJuros||'0'),0)
        const totalMulta = baixaLoteParcelas.reduce((s,p)=>s+parseMoeda(p.loteMulta||'0'),0)
        const totalDesc = baixaLoteParcelas.reduce((s,p)=>s+parseMoeda(p.loteDesc||'0'),0)
        const totalGeral = Math.max(0, brutoTotal - totalDesc + totalJuros + totalMulta)
        
        const totalFormasLt=baixaLoteMultiFormas.reduce((s:number,f:any)=>s+parseMoeda(f.valor||'0'),0)
        const saldoLt=+(totalGeral-totalFormasLt).toFixed(2)
        const addFormaLt=()=>setBaixaLoteMultiFormas((ff:any)=>[...ff,{id:String(Date.now()),forma:'Dinheiro',valor:saldoLt>0?fmtMoeda(saldoLt):'',cartao:null}])
        const syncSingleFormValue = (vf: number) => {
          if (baixaLoteMultiFormas.length === 1) {
            setBaixaLoteMultiFormas((prev:any) => [{...prev[0], valor:fmtMoeda(vf)}])
          }
        }
        
        const updatePrc = (num: number, field: string, value: string) => {
            setBaixaLoteParcelas(prev => {
                const arr = prev.map(p => p.num === num ? {...p, [field]: value} : p);
                const ntGeral = arr.reduce((acc, p) => acc + Math.max(0, p.valor - parseMoeda(p.loteDesc||'0') + parseMoeda(p.loteJuros||'0') + parseMoeda(p.loteMulta||'0')), 0);
                syncSingleFormValue(ntGeral);
                return arr;
            });
        }

        return(
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:5500,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
            <div style={{background:'hsl(var(--bg-base))',borderRadius:20,width:'100%',maxWidth:840,maxHeight:'96vh',overflowY:'auto',display:'flex',flexDirection:'column',border:'1px solid rgba(16,185,129,0.3)',boxShadow:'0 40px 120px rgba(0,0,0,0.9)'}}>
              <div style={{padding:'16px 24px',borderBottom:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0,background:'linear-gradient(135deg,rgba(16,185,129,0.1),rgba(52,211,153,0.04))'}}>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:48,height:48,borderRadius:12,background:'rgba(16,185,129,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>💳</div>
                  <div>
                    <div style={{fontWeight:800,fontSize:15}}>Registrar Pagamento em Lote</div>
                    <div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>{baixaLoteParcelas.length} parcela(s) selecionada(s)</div>
                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:24}}>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:9,color:'hsl(var(--text-muted))',fontWeight:700,letterSpacing:.5,marginBottom:4}}>DATA DO PAGAMENTO</div>
                    <input type="date" style={{background:'transparent',border:'1px solid hsl(var(--border-subtle))',borderRadius:6,padding:'4px 8px',fontSize:13,fontFamily:'monospace',color:'hsl(var(--text-base))',fontWeight:700}} value={baixaLoteForm.dataPagto} 
                      onChange={e=>{
                         const nd = e.target.value;
                         setBaixaLoteForm(f=>({...f,dataPagto:nd}));
                         setBaixaLoteParcelas(prev => {
                             const arr = prev.map(p => {
                               const atr = calcAtraso(p, nd);
                               return {...p, loteJuros:fmtMoeda(atr.juros), loteMulta:fmtMoeda(atr.multa), loteDias:atr.dias};
                             });
                             const ntGeral = arr.reduce((acc, p) => acc + Math.max(0, p.valor - parseMoeda(p.loteDesc||'0') + parseMoeda(p.loteJuros||'0') + parseMoeda(p.loteMulta||'0')), 0);
                             syncSingleFormValue(ntGeral);
                             return arr;
                         });
                      }} />
                  </div>
                  <div style={{width:1,height:38,background:'hsl(var(--border-subtle))'}}></div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:9,color:'hsl(var(--text-muted))',fontWeight:700,letterSpacing:.5}}>TOTAL A PAGAR</div>
                    <div style={{fontFamily:'monospace',fontWeight:900,fontSize:22,color:'#10b981'}}>R$ {fmtMoeda(totalGeral)}</div>
                  </div>
                  <button className="btn btn-ghost btn-icon" onClick={()=>setModalBaixaLote(false)}><X size={18}/></button>
                </div>
              </div>
              <div style={{background:'hsl(var(--bg-elevated))',borderBottom:'1px solid hsl(var(--border-subtle))',flex:1,overflowY:'auto',padding:'12px 24px',minHeight:140}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead>
                    <tr style={{textAlign:'left',fontSize:10,color:'hsl(var(--text-muted))'}}>
                      <th style={{paddingBottom:8,fontWeight:700}}>Parcela / Evento</th>
                      <th style={{paddingBottom:8,fontWeight:700}}>Bruto (R$)</th>
                      <th style={{paddingBottom:8,fontWeight:700,width:80}}>Desc. (R$)</th>
                      <th style={{paddingBottom:8,fontWeight:700,width:80}}>Multa (R$)</th>
                      <th style={{paddingBottom:8,fontWeight:700,width:80}}>Juros (R$)</th>
                      <th style={{paddingBottom:8,fontWeight:700,textAlign:'right'}}>Líquido (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {baixaLoteParcelas.map((p:any)=>(
                      <tr key={p.num} style={{borderTop:'1px solid hsl(var(--border-subtle))'}}>
                        <td style={{padding:'8px 0'}}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <div style={{width:32,height:32,borderRadius:6,background:'rgba(16,185,129,0.1)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                              <span style={{fontFamily:'monospace',fontWeight:800,fontSize:12,color:'#10b981'}}>{String(p.evtIndex||1).padStart(2,'0')}</span>
                            </div>
                            <div>
                               <div style={{fontSize:11,fontWeight:700}}>{getEventoDisp(p)} <span style={{fontSize:9,color:'hsl(var(--text-muted))',fontWeight:500,border:'1px solid hsl(var(--border-subtle))',borderRadius:4,padding:'0 4px'}}>{p.tNome}</span></div>
                               <div style={{fontSize:9,color:'hsl(var(--text-muted))'}}>Vcto: <span style={{color:p.loteDias>0?'#ef4444':'inherit'}}>{p.vencimento?formatDate(p.vencimento):'—'}</span> {p.loteDias>0&&<span style={{background:'rgba(239,68,68,0.1)',color:'#ef4444',padding:'1px 4px',borderRadius:4,fontWeight:700,marginLeft:6}}>{p.loteDias}d</span>}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{fontFamily:'monospace',fontSize:12,fontWeight:700,color:'hsl(var(--text-muted))'}}>
                          {fmtMoeda(p.valor)}
                        </td>
                        <td style={{padding:'8px 4px'}}>
                          <input className="form-input" style={{fontFamily:'monospace',fontSize:11,height:28,padding:'0 6px',width:'100%',color:'#f59e0b'}} value={p.loteDesc}
                            onChange={e=>{const raw=e.target.value.replace(/\D/g,'');updatePrc(p.num,'loteDesc',raw?fmtMoeda(parseInt(raw,10)/100):'0,00')}} />
                        </td>
                        <td style={{padding:'8px 4px'}}>
                          <input className="form-input" style={{fontFamily:'monospace',fontSize:11,height:28,padding:'0 6px',width:'100%',color:'#ef4444'}} value={p.loteMulta}
                            onChange={e=>{const raw=e.target.value.replace(/\D/g,'');updatePrc(p.num,'loteMulta',raw?fmtMoeda(parseInt(raw,10)/100):'0,00')}} />
                        </td>
                        <td style={{padding:'8px 4px'}}>
                          <input className="form-input" style={{fontFamily:'monospace',fontSize:11,height:28,padding:'0 6px',width:'100%',color:'#ef4444'}} value={p.loteJuros}
                            onChange={e=>{const raw=e.target.value.replace(/\D/g,'');updatePrc(p.num,'loteJuros',raw?fmtMoeda(parseInt(raw,10)/100):'0,00')}} />
                        </td>
                        <td style={{textAlign:'right',fontFamily:'monospace',fontWeight:800,fontSize:13,color:'#10b981',paddingRight:8}}>
                          R$ {fmtMoeda(Math.max(0, p.valor - parseMoeda(p.loteDesc||'0') + parseMoeda(p.loteMulta||'0') + parseMoeda(p.loteJuros||'0')))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:14}}>
                <div style={{padding:'14px 16px',background:'hsl(var(--bg-elevated))',border:'1px solid hsl(var(--border-subtle))',borderRadius:12}}>
                  <div style={{fontWeight:700,fontSize:12,marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{}}>💳 Formas de Pagamento</span>
                    <button type="button" onClick={()=>{
                      setBaixaLoteParcelas(prev => {
                          const arr = prev.map(p => ({...p, loteJuros:'0', loteMulta:'0'}));
                          const ntGeral = arr.reduce((acc, p) => acc + Math.max(0, p.valor - parseMoeda(p.loteDesc||'0')), 0);
                          syncSingleFormValue(ntGeral);
                          return arr;
                      });
                    }}
                      style={{fontSize:10,padding:'4px 12px',borderRadius:20,border:'1px solid rgba(239,68,68,0.4)',background:'rgba(239,68,68,0.08)',color:'#ef4444',cursor:'pointer',fontWeight:800}}>Zerar Todos os Acréscimos</button>
                  </div>
                  {baixaLoteMultiFormas.map((item:any,idx:number)=>(
                    <div key={item.id} style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
                      <select className="form-input" style={{flex:'0 0 160px',fontSize:12}} value={item.forma}
                        onChange={e=>setBaixaLoteMultiFormas((ff:any)=>ff.map((x:any,i:number)=>i===idx?{...x,forma:e.target.value}:x))}
                      >{FORMAS.map(fo=><option key={fo}>{fo}</option>)}</select>
                      <input className="form-input" style={{flex:1,fontFamily:'monospace',fontSize:12}}
                        value={item.valor} placeholder="0,00"
                        onChange={e=>{
                          const raw=e.target.value.replace(/\D/g,''); const nv=raw?fmtMoeda(parseInt(raw,10)/100):'0,00';
                          setBaixaLoteMultiFormas((ff:any)=>ff.map((x:any,i:number)=>i===idx?{...x,valor:nv}:x))
                        }}
                      />
                      {(item.forma.includes('Cartão')||item.forma.includes('Crédito')||item.forma.includes('Débito'))&&(
                        <button type="button" style={{padding:'0 10px',height:36,fontSize:11,background:'hsl(var(--bg-base))',border:'1px solid hsl(var(--border-subtle))',borderRadius:6,cursor:'pointer',color:'#818cf8',fontWeight:700,display:'flex',alignItems:'center',gap:4}}
                          onClick={()=>{setCartaoFormIdx(idx);setCartaoCtx('baixaLote');setCartaoForm(item.cartao||{bandeira:'Visa',numero:'',nome:'',validade:'',parcelas:'1',autorizacao:''});setModalCartao(true)}}>
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
                    <div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>Totalizador Otimizado ({baixaLoteParcelas.length} parcelas)</div>
                    <div style={{fontSize:10,color:'hsl(var(--text-muted))',marginTop:2}}>Cód. Lote: <span style={{fontFamily:'monospace',color:'#34d399',fontWeight:700}}>{baixaLoteForm.codPreview||'BX000000LL'}</span></div>
                  </div>
                  <div style={{textAlign:'right',marginRight:16}}>
                    <div style={{fontSize:10,color:'hsl(var(--text-muted))'}}>Valor: <strong style={{color:'hsl(var(--text-base))'}}>R$ {fmtMoeda(brutoTotal)}</strong> <span style={{color:'#f59e0b',marginLeft:4}}>(-) Desc: R$ {fmtMoeda(totalDesc)}</span> <span style={{color:'#f87171',marginLeft:4}}>(+) Acr: R$ {fmtMoeda(totalJuros+totalMulta)}</span></div>
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
                  disabled={!baixaLoteForm.dataPagto||baixaLoteParcelas.length===0||Math.abs(saldoLt)>0.01}
                  onClick={()=>{
                    const codPrv=baixaLoteForm.codPreview||('BX'+String(Date.now()).slice(-6)+'LL')
                    const formaStr=baixaLoteMultiFormas.map((f:any)=>f.forma).join('+')
                    const nums=baixaLoteParcelas.map(p=>p.num)
                    
                    setParcelas(prev=>prev.map(p=>{
                      if(!nums.includes(p.num)||p.status==='pago') return p
                      const lP = baixaLoteParcelas.find(x => x.num === p.num);
                      if (!lP) return p;
                      const jp=parseMoeda(lP.loteJuros); const mp=parseMoeda(lP.loteMulta); const dp=parseMoeda(lP.loteDesc);
                      const vf=Math.max(0, p.valor-dp+jp+mp)
                      return{...p,status:'pago',dtPagto:baixaLoteForm.dataPagto,formaPagto:formaStr,comprovante:baixaLoteForm.comprovante,codBaixa:codPrv,juros:jp,multa:mp,desconto:dp,valorFinal:vf,formasPagto:baixaLoteMultiFormas}
                    }))
                    setBaixaLoteMultiFormas([{id:'f1',forma:'PIX',valor:'',cartao:null}])
                    setParcelasSelected([])
                    setModalBaixaLote(false)
                  }}>Confirmar Baixa Múltipla R$ {fmtMoeda(totalGeral)}</button>
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
          .map(p=>{
            const calc = calcAtraso(p)
            return {
              ...(p as any),
              alunoNome:aluno.nome||'Aluno Atual',
              alunoId:'__novo__',
              alunoAvatar:(aluno.nome||'A')[0].toUpperCase(),
              turmaShow: (p as any).turmaNome || turmas.find((t:any)=>t.id===((p as any).turmaId||mat.turmaId))?.nome || p.turma || mat.turma || '',
              jurosCalc: calc.juros,
              multaCalc: calc.multa,
              diasAtr: calc.dias,
              totalP: +( (p.valorFinal||p.valor||0) + calc.juros + calc.multa ).toFixed(2)
            }
          })
          
        // Parcelas dos outros alunos do mesmo responsável
        const parcelasOutros=outrosAlunos.flatMap((a:any)=>
          (a.parcelas||[])
            .filter((p:any)=>p.status!=='pago'&&p.status!=='cancelado')
            .map((p:any)=>{
               const calc = calcAtraso(p)
               const matAt = a.dadosMatricula || {}
               return {
                 ...p,
                 alunoNome:a.nome,
                 alunoId:a.id||a.cpf||a.nome,
                 alunoAvatar:(a.nome||'A')[0].toUpperCase(),
                 turmaShow: p.turmaNome || turmas.find((t:any)=>t.id===(p.turmaId||matAt.turmaId))?.nome || p.turma || a.turma || matAt.turma || '',
                 jurosCalc: calc.juros,
                 multaCalc: calc.multa,
                 diasAtr: calc.dias,
                 totalP: +( (p.valorFinal||p.valor||0) + calc.juros + calc.multa ).toFixed(2)
               }
            })
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
        const totalSel=selResp.reduce((s:number,p:any)=>{
           const tp = p.totalP || p.valorFinal || p.valor || 0
           return s + tp
        }, 0)
        const allSel=selResp.length===todasParcelas.length&&todasParcelas.length>0
        
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
                  <span>🔴 Vencidas: <strong style={{color:'#ef4444'}}>{todasParcelas.filter(p=>p.diasAtr>0).length}</strong></span>
                  <span>🟡 A vencer: <strong style={{color:'#f59e0b'}}>{todasParcelas.filter(p=>p.diasAtr<=0).length}</strong></span>
                  <span>💰 Total geral: <strong style={{color:'#10b981',fontFamily:"'JetBrains Mono',monospace"}}>R$ {fmtMoeda(todasParcelas.reduce((s,p:any)=>s+(p.totalP||p.valorFinal||p.valor||0),0))}</strong></span>
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
                    const gTotal=g.parcelas.reduce((s,p:any)=>s+(p.totalP||p.valorFinal||p.valor||0),0)
                    const gSelTotal=gSel.reduce((s:number,p:any)=>s+(p.totalP||p.valorFinal||p.valor||0),0)
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
                          const isVenc=p.diasAtr>0
                          const eparcs = p.evento ? g.parcelas.filter((x:any)=>x.evento===p.evento) : null
                          const pDen = p.totalParcelas || (eparcs?eparcs.length:g.parcelas.length)
                          const evtIndex = p.numParcela || (eparcs && eparcs.length > 0 ? eparcs.findIndex((x:any) => x.num === p.num) + 1 : p.num)
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
                                <div style={{width:36,height:36,borderRadius:8,background:isSel?'rgba(99,102,241,0.18)':'rgba(99,102,241,0.08)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:"'JetBrains Mono',monospace",color:isSel?'#818cf8':'hsl(var(--text-muted))',border:`1px solid ${isSel?'rgba(99,102,241,0.35)':'transparent'}`}}>
                                  <span style={{fontSize:13,fontWeight:900,lineHeight:1}}>{String(evtIndex).padStart(2,'0')}</span>
                                  <span style={{fontSize:8,opacity:0.6,fontWeight:600}}>/{String(pDen).padStart(2,'0')}</span>
                                </div>
                              </div>
                              {/* Evento + competência + turma */}
                              <div style={{flex:'0 0 200px'}}>
                                <div style={{fontWeight:700,fontSize:12,color:'hsl(var(--text-base))'}}>{p.evento||'Mensalidade'}</div>
                                <div style={{fontSize:10,color:'hsl(var(--text-muted))',marginTop:2,display:'flex',gap:6,alignItems:'center'}}>
                                  <span>{p.competencia||'—'}</span>
                                  {p.turmaShow && <span style={{padding:'2px 6px',background:'hsl(var(--bg-base))',border:'1px solid hsl(var(--border-subtle))',borderRadius:4,fontSize:9}}>{p.turmaShow}</span>}
                                </div>
                              </div>
                              {/* Vencimento */}
                              <div style={{flex:'0 0 110px'}}>
                                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:isVenc?800:600,color:isVenc?'#ef4444':'hsl(var(--text-base))'}}>{p.vencimento ? formatDate(p.vencimento) : '—'}</div>
                                {isVenc?(
                                  <div style={{fontSize:9,marginTop:2,padding:'1px 6px',borderRadius:20,background:'rgba(239,68,68,0.12)',color:'#ef4444',fontWeight:700,display:'inline-block'}}>
                                    ⚠ {p.diasAtr}d atraso
                                  </div>
                                ):(
                                  <div style={{fontSize:9,marginTop:2,color:'hsl(var(--text-muted))'}}>a vencer</div>
                                )}
                              </div>
                              {/* Desconto & Acréscimos (Juros/Multa) */}
                              <div style={{flex:'0 0 130px',display:'flex',gap:16,justifyContent:'flex-end'}}>
                                {/* Desconto */}
                                <div style={{textAlign:'right'}}>
                                  <div style={{fontSize:9,color:'hsl(var(--text-muted))',marginBottom:2}}>Desc.</div>
                                  {(p.desconto||0)>0?(
                                    <div style={{fontSize:11,color:'#10b981',fontWeight:700}}>-{fmtMoeda(p.desconto||0)}</div>
                                  ):<div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>—</div>}
                                </div>
                                {/* Acréscimos */}
                                <div style={{textAlign:'right'}}>
                                  <div style={{fontSize:9,color:'hsl(var(--text-muted))',marginBottom:2}}>Juros/Mul.</div>
                                  {(p.jurosCalc||0)>0 || (p.multaCalc||0)>0?(
                                    <div style={{fontSize:11,color:'#ef4444',fontWeight:700}}>+{fmtMoeda((p.jurosCalc||0)+(p.multaCalc||0))}</div>
                                  ):<div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>—</div>}
                                </div>
                              </div>
                              {/* Valor Final */}
                              <div style={{flex:'0 0 120px',textAlign:'right'}}>
                                <div style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:800,fontSize:14,color:isSel?'#818cf8':'hsl(var(--text-base))'}}>
                                  R$ {fmtMoeda(p.totalP||p.valorFinal||p.valor||0)}
                                </div>
                                {(p.jurosCalc>0 || (p.desconto||0)>0) && (
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
                      return{...p,status:'pago',dtPagto:baixaRespForm.dataPagto,formaPagto:formaStr,comprovante:baixaRespForm.comprovante,obs:baixaRespForm.obs,codBaixa,formasPagto:baixaRespForm.formasPagto,baixaPorResponsavel:true,nomeResponsavel:nomeResp,parcelasVinculadas,juros:foundSel.jurosCalc||0,multa:foundSel.multaCalc||0,valorFinal:foundSel.totalP||p.valorFinal}
                    }))
                    // Atualiza parcelas dos outros alunos
                    if(selResp.some((s:any)=>s.alunoId!=='__novo__')){
                      setAlunos((prev:any[])=>prev.map((a:any)=>{
                        const alunoKey=a.id||a.cpf||a.nome
                        const parcsA=selResp.filter((s:any)=>s.alunoId===alunoKey)
                        if(parcsA.length===0) return a
                        return{...a,parcelas:(a.parcelas||[]).map((p:any)=>{
                          const selA = parcsA.find((s:any)=>s.num===p.num&&s.alunoId===alunoKey)
                          if(selA&&p.status!=='pago')
                            return{...p,status:'pago',dtPagto:baixaRespForm.dataPagto,formaPagto:formaStr,comprovante:baixaRespForm.comprovante,obs:baixaRespForm.obs,codBaixa,formasPagto:baixaRespForm.formasPagto,baixaPorResponsavel:true,nomeResponsavel:nomeResp,parcelasVinculadas,juros:selA.jurosCalc||0,multa:selA.multaCalc||0,valorFinal:selA.totalP||p.valorFinal}
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
    </div>
  )
}
