'use client'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { useData } from '@/lib/dataContext'
import {
  RefreshCw, CheckCircle2, Clock, XCircle, Users, Search, Filter,
  ChevronDown, FileText, Send, Pen, DollarSign, Eye, MoreHorizontal,
  AlertTriangle, TrendingUp, BarChart3, Settings, History, X,
  CheckCircle, Circle, ArrowRight, Building2, Phone, Mail,
  Shield, Zap, Download, Plus, Star, CalendarDays
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────
type RStatus = 'nao_iniciado'|'em_andamento'|'aguarda_assinatura'|'aguarda_pagamento'|'concluida'|'cancelada'|'pendencia_doc'
type AbaKey = 'painel'|'alunos'|'assinaturas'|'configuracoes'|'historico'

const STATUS_CFG: Record<RStatus, {label:string; color:string; bg:string; icon:string}> = {
  nao_iniciado:       { label:'Não iniciado',       color:'#64748b', bg:'rgba(100,116,139,0.1)', icon:'⬜' },
  em_andamento:       { label:'Em andamento',        color:'#3b82f6', bg:'rgba(59,130,246,0.1)',  icon:'🔄' },
  aguarda_assinatura: { label:'Aguarda assinatura',  color:'#a78bfa', bg:'rgba(167,139,250,0.1)', icon:'✍️' },
  aguarda_pagamento:  { label:'Aguarda pagamento',   color:'#f59e0b', bg:'rgba(245,158,11,0.1)',  icon:'💳' },
  concluida:          { label:'Concluída',           color:'#10b981', bg:'rgba(16,185,129,0.1)',  icon:'✅' },
  cancelada:          { label:'Cancelada',           color:'#ef4444', bg:'rgba(239,68,68,0.1)',   icon:'❌' },
  pendencia_doc:      { label:'Pendência documental',color:'#f97316', bg:'rgba(249,115,22,0.1)',  icon:'📄' },
}

const ABAS: {key:AbaKey; label:string; icon:React.ReactNode}[] = [
  { key:'painel',        label:'Painel Geral',    icon:<BarChart3 size={15}/> },
  { key:'alunos',        label:'Alunos Aptos',    icon:<Users size={15}/> },
  { key:'assinaturas',   label:'Assinaturas',     icon:<Pen size={15}/> },
  { key:'configuracoes', label:'Configurações',   icon:<Settings size={15}/> },
  { key:'historico',     label:'Histórico',       icon:<History size={15}/> },
]

// ─── Modal de Documentos do Aluno ───────────────────────────────────────────
type ZapDocStatus = 'nao_enviado'|'enviado'|'visualizado'|'pendente'|'assinado'|'recusado'|'expirado'

const ZAP_STATUS_CFG: Record<ZapDocStatus, {label:string; color:string; icon:string}> = {
  nao_enviado: { label:'Não enviado',  color:'#64748b', icon:'—' },
  enviado:     { label:'Enviado',      color:'#3b82f6', icon:'📤' },
  visualizado: { label:'Visualizado',  color:'#06b6d4', icon:'👁️' },
  pendente:    { label:'Ass. pendente',color:'#f59e0b', icon:'⏳' },
  assinado:    { label:'Assinado',     color:'#10b981', icon:'✅' },
  recusado:    { label:'Recusado',     color:'#ef4444', icon:'❌' },
  expirado:    { label:'Expirado',     color:'#94a3b8', icon:'⌛' },
}

function AlunoModal({ aluno, onClose }: { aluno: any; onClose: () => void }) {
  const [docs, setDocs] = useState<any[]>([])
  const [docStatus, setDocStatus] = useState<Record<string, ZapDocStatus>>({})
  const [enviando, setEnviando] = useState<string|null>(null)
  const [consultando, setConsultando] = useState<string|null>(null)
  const [msg, setMsg] = useState<{id:string; text:string; ok:boolean}|null>(null)

  // Carrega modelos de documentos do localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('edu-documentos-modelos')
      const modelos = raw ? JSON.parse(raw).filter((d: any) => d.status === 'ativo') : []
      // Carrega status ZapSign salvo (per aluno+doc)
      const zapRaw = localStorage.getItem(`edu-zapsign-status-${aluno.id}`)
      const zapSaved: Record<string, ZapDocStatus> = zapRaw ? JSON.parse(zapRaw) : {}
      setDocs(modelos)
      // Inicializa status: usa salvo ou 'nao_enviado'
      const init: Record<string, ZapDocStatus> = {}
      modelos.forEach((d: any) => { init[d.id] = zapSaved[d.id] || 'nao_enviado' })
      setDocStatus(init)
    } catch {}
  }, [aluno.id])

  const saveStatus = (newStatus: Record<string, ZapDocStatus>) => {
    setDocStatus(newStatus)
    localStorage.setItem(`edu-zapsign-status-${aluno.id}`, JSON.stringify(newStatus))
  }

  // Consulta status real na API ZapSign (token no localStorage)
  const consultarZapSign = useCallback(async (docId: string, docNome: string) => {
    const token = localStorage.getItem('edu-zapsign-token') || ''
    const zapDocId = localStorage.getItem(`edu-zapsign-docid-${aluno.id}-${docId}`)
    if (!token || !zapDocId) {
      setMsg({ id: docId, text: 'Documento não foi enviado via ZapSign ainda.', ok: false })
      return
    }
    setConsultando(docId)
    try {
      const res = await fetch(`https://api.zapsign.com.br/api/v1/docs/${zapDocId}/`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        const zapSt = data.status === 'signed' ? 'assinado'
          : data.status === 'pending' ? 'pendente'
          : data.status === 'refused' ? 'recusado'
          : data.status === 'expired' ? 'expirado'
          : 'enviado'
        saveStatus({ ...docStatus, [docId]: zapSt as ZapDocStatus })
        setMsg({ id: docId, text: `Status: ${ZAP_STATUS_CFG[zapSt as ZapDocStatus].label}`, ok: true })
      } else {
        setMsg({ id: docId, text: `Erro ${res.status} ao consultar ZapSign.`, ok: false })
      }
    } catch {
      setMsg({ id: docId, text: 'Erro de conexão com ZapSign.', ok: false })
    } finally { setConsultando(null) }
  }, [docStatus, aluno.id])

  // Envia documento por WhatsApp (link)
  const enviarWhatsApp = (doc: any) => {
    const tel = aluno.telefone?.replace(/\D/g, '') || ''
    const link = localStorage.getItem(`edu-zapsign-signurl-${aluno.id}-${doc.id}`) || '#'
    const txt = encodeURIComponent(`Olá ${aluno.responsavelFinanceiro || aluno.responsavel || 'responsável'}! Segue o link para assinar o documento "${doc.nome}" da matrícula de ${aluno.nome}: ${link}`)
    const wa = tel ? `https://wa.me/55${tel}?text=${txt}` : `https://wa.me/?text=${txt}`
    window.open(wa, '_blank')
    const ns = { ...docStatus, [doc.id]: docStatus[doc.id] === 'nao_enviado' ? 'enviado' : docStatus[doc.id] }
    saveStatus(ns)
  }

  // Envia por e-mail (mailto)
  const enviarEmail = (doc: any) => {
    const email = aluno.email || ''
    const link = localStorage.getItem(`edu-zapsign-signurl-${aluno.id}-${doc.id}`) || '(link não gerado)'
    const sub = encodeURIComponent(`Assinatura de Documento — ${doc.nome}`)
    const bod = encodeURIComponent(`Prezado(a) ${aluno.responsavelFinanceiro || aluno.responsavel || 'responsável'},\n\nSolicita-se a assinatura do documento "${doc.nome}" referente à matrícula do(a) aluno(a) ${aluno.nome}.\n\nLink: ${link}\n\nAtenciosamente,\nSecretaria IMPACTO EDU`)
    window.location.href = `mailto:${email}?subject=${sub}&body=${bod}`
    const ns = { ...docStatus, [doc.id]: docStatus[doc.id] === 'nao_enviado' ? 'enviado' : docStatus[doc.id] }
    saveStatus(ns)
  }

  // Simular marcar como assinado (teste/manual)
  const marcarAssinado = (docId: string) => {
    saveStatus({ ...docStatus, [docId]: 'assinado' })
    setMsg({ id: docId, text: 'Marcado como assinado manualmente.', ok: true })
  }

  const todosAssinados = docs.length > 0 && docs.every(d => docStatus[d.id] === 'assinado')

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16,backdropFilter:'blur(4px)'}}>
      <div style={{background:'hsl(var(--bg-base))',borderRadius:24,width:'100%',maxWidth:780,maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'0 40px 120px rgba(0,0,0,0.6)',border:'1px solid hsl(var(--border-subtle))',overflow:'hidden'}}>

        {/* Header */}
        <div style={{padding:'18px 24px',background:'linear-gradient(135deg,rgba(6,182,212,0.08),rgba(99,102,241,0.04))',borderBottom:'1px solid hsl(var(--border-subtle))',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:44,height:44,borderRadius:12,background:'linear-gradient(135deg,#06b6d4,#6366f1)',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:900,fontSize:17}}>
              {aluno.nome?.[0]?.toUpperCase() || 'A'}
            </div>
            <div>
              <div style={{fontWeight:900,fontSize:16,letterSpacing:'-0.02em'}}>{aluno.nome}</div>
              <div style={{fontSize:11,color:'hsl(var(--text-muted))',marginTop:1}}>
                {aluno.turma} · {aluno.turno}
                {aluno.responsavelFinanceiro && <> · <span style={{color:'#06b6d4'}}>Resp. Fin.: {aluno.responsavelFinanceiro}</span></>}
              </div>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            {todosAssinados && <span style={{fontSize:10,padding:'3px 10px',borderRadius:100,background:'rgba(16,185,129,0.12)',color:'#10b981',fontWeight:700,border:'1px solid rgba(16,185,129,0.25)'}}>✅ TODOS ASSINADOS</span>}
            <button onClick={onClose} className="btn btn-ghost btn-icon"><X size={18}/></button>
          </div>
        </div>

        {/* Situação financeira */}
        {aluno.inadimplente && (
          <div style={{padding:'10px 24px',background:'rgba(239,68,68,0.06)',borderBottom:'1px solid rgba(239,68,68,0.15)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:12,color:'#ef4444',fontWeight:600}}>⚠️ Aluno inadimplente — verifique a situação financeira antes de prosseguir</span>
            <button className="btn btn-sm" style={{fontSize:10,background:'rgba(239,68,68,0.1)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)'}}>🔓 Liberar Exceção</button>
          </div>
        )}

        {/* Lista de documentos */}
        <div style={{flex:1,overflowY:'auto',padding:20}}>
          {docs.length === 0 ? (
            <div style={{textAlign:'center',padding:'40px 20px'}}>
              <div style={{fontSize:36,marginBottom:12}}>📭</div>
              <div style={{fontWeight:700,fontSize:14,marginBottom:6}}>Nenhum modelo de documento cadastrado</div>
              <div style={{fontSize:12,color:'hsl(var(--text-muted))'}}>Cadastre modelos em <strong>Configurações → Documentos</strong> para exibi-los aqui.</div>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {docs.map((doc: any) => {
                const st = docStatus[doc.id] || 'nao_enviado'
                const stCfg = ZAP_STATUS_CFG[st]
                const isAssinado = st === 'assinado'
                const isMsgDoc = msg?.id === doc.id
                return (
                  <div key={doc.id} style={{padding:'14px 16px',background:isAssinado?'rgba(16,185,129,0.04)':'hsl(var(--bg-elevated))',borderRadius:12,border:`1px solid ${isAssinado?'rgba(16,185,129,0.2)':'hsl(var(--border-subtle))'}`,transition:'all 0.2s'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
                      {/* Doc info */}
                      <div style={{display:'flex',alignItems:'center',gap:10,flex:1,minWidth:180}}>
                        <div style={{width:36,height:36,borderRadius:10,background:'rgba(129,140,248,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>📄</div>
                        <div>
                          <div style={{fontWeight:700,fontSize:13}}>{doc.nome}</div>
                          <div style={{fontSize:10,color:'hsl(var(--text-muted))',marginTop:1}}>{doc.categoria || 'Contrato'}</div>
                        </div>
                      </div>

                      {/* Status ZapSign */}
                      <span style={{fontSize:10,padding:'3px 10px',borderRadius:100,fontWeight:700,background:`${stCfg.color}12`,color:stCfg.color,border:`1px solid ${stCfg.color}25`,whiteSpace:'nowrap'}}>
                        {stCfg.icon} {stCfg.label}
                      </span>

                      {/* Ações */}
                      <div style={{display:'flex',gap:6,flexShrink:0}}>
                        <button
                          onClick={() => enviarWhatsApp(doc)}
                          className="btn btn-sm"
                          title="Enviar link por WhatsApp"
                          style={{fontSize:10,padding:'5px 10px',background:'rgba(37,211,102,0.1)',color:'#25d366',border:'1px solid rgba(37,211,102,0.25)',display:'flex',alignItems:'center',gap:4}}>
                          📱 WhatsApp
                        </button>
                        <button
                          onClick={() => enviarEmail(doc)}
                          className="btn btn-sm"
                          title="Enviar por e-mail"
                          style={{fontSize:10,padding:'5px 10px',background:'rgba(59,130,246,0.1)',color:'#3b82f6',border:'1px solid rgba(59,130,246,0.25)',display:'flex',alignItems:'center',gap:4}}>
                          ✉️ E-mail
                        </button>
                        <button
                          onClick={() => consultarZapSign(doc.id, doc.nome)}
                          disabled={consultando===doc.id}
                          className="btn btn-sm"
                          title="Consultar status na API ZapSign"
                          style={{fontSize:10,padding:'5px 10px',background:'rgba(129,140,248,0.1)',color:'#818cf8',border:'1px solid rgba(129,140,248,0.25)',display:'flex',alignItems:'center',gap:4,opacity:consultando===doc.id?0.6:1}}>
                          {consultando===doc.id ? '⏳' : '🔄'} ZapSign
                        </button>
                        {!isAssinado && (
                          <button
                            onClick={() => marcarAssinado(doc.id)}
                            className="btn btn-sm"
                            title="Marcar como assinado manualmente"
                            style={{fontSize:10,padding:'5px 10px',background:'rgba(16,185,129,0.1)',color:'#10b981',border:'1px solid rgba(16,185,129,0.25)',display:'flex',alignItems:'center',gap:4}}>
                            ✅ Marcar assinado
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Feedback message */}
                    {isMsgDoc && msg && (
                      <div style={{marginTop:8,padding:'6px 10px',borderRadius:7,fontSize:11,fontWeight:600,background:msg.ok?'rgba(16,185,129,0.08)':'rgba(239,68,68,0.07)',color:msg.ok?'#10b981':'#ef4444',border:`1px solid ${msg.ok?'rgba(16,185,129,0.2)':'rgba(239,68,68,0.2)'}`}}>
                        {msg.text}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:'12px 24px',borderTop:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'space-between',alignItems:'center',background:'hsl(var(--bg-elevated))'}}>
          <div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>
            {docs.filter((d:any) => docStatus[d.id]==='assinado').length}/{docs.length} documentos assinados
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function RematriculaPage() {
  const { alunos, turmas } = useData()
  const [aba, setAba] = useState<AbaKey>('painel')
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<RStatus|'todos'>('todos')
  const [alunoModal, setAlunoModal] = useState<any>(null)
  const [menuAberto, setMenuAberto] = useState<string|null>(null)
  const [zapToken, setZapToken] = useState('')
  const [zapWebhook, setZapWebhook] = useState('')
  const [zapStatus, setZapStatus] = useState<'idle'|'loading'|'ok'|'error'>('idle')
  const [zapMsg, setZapMsg] = useState('')

  // Inclui todos os alunos ativos (status ativo, matriculado, ou qualquer um que não seja cancelado/transferido/histórico)
  const INATIVOS = ['cancelado','transferido','histórico','historico','inativo','Cancelado','Transferido','Histórico','Inativo']
  const matriculados = alunos.filter(a => !INATIVOS.includes(a.status || ''))

  // Gera rematriculas simuladas com seed estável (index-based)
  const rematriculas = useMemo(() => matriculados.map((a, i) => {
    const statuses: RStatus[] = ['nao_iniciado','em_andamento','aguarda_assinatura','aguarda_pagamento','concluida','concluida','pendencia_doc']
    const st = a.inadimplente ? 'aguarda_pagamento' : statuses[i % statuses.length]
    return { ...a, rStatus: st as RStatus, taxaValor: 250, taxaPaga: st==='concluida' }
  }), [matriculados])

  // ── ZapSign test connection ────────────────────────────────────────────────
  const handleTestarZapSign = async () => {
    if (!zapToken.trim()) {
      setZapStatus('error')
      setZapMsg('Insira o API Token antes de testar.')
      return
    }
    setZapStatus('loading')
    setZapMsg('')
    try {
      const res = await fetch('https://api.zapsign.com.br/api/v1/account/', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${zapToken.trim()}`, 'Content-Type': 'application/json' },
      })
      if (res.ok) {
        const data = await res.json()
        setZapStatus('ok')
        setZapMsg(`✅ Conectado! Conta: ${data?.name || data?.email || 'ZapSign'}`)
      } else if (res.status === 401) {
        setZapStatus('error')
        setZapMsg('❌ Token inválido ou expirado.')
      } else {
        setZapStatus('error')
        setZapMsg(`❌ Erro ${res.status}: ${res.statusText}`)
      }
    } catch {
      setZapStatus('error')
      setZapMsg('⚠️ CORS bloqueou a requisição direta. Configure via backend ou teste com a chave no servidor.')
    }
  }

  const filtradas = rematriculas.filter(a => {
    const busOk = a.nome?.toLowerCase().includes(busca.toLowerCase()) || a.turma?.toLowerCase().includes(busca.toLowerCase())
    const stOk = filtroStatus === 'todos' || a.rStatus === filtroStatus
    return busOk && stOk
  })

  // KPIs
  const total = rematriculas.length
  const concluidas = rematriculas.filter(r => r.rStatus === 'concluida').length
  const pendentes = rematriculas.filter(r => r.rStatus === 'em_andamento' || r.rStatus === 'nao_iniciado').length
  const assinatura = rematriculas.filter(r => r.rStatus === 'aguarda_assinatura').length
  const pagamento = rematriculas.filter(r => r.rStatus === 'aguarda_pagamento').length
  const pct = total > 0 ? Math.round((concluidas/total)*100) : 0
  const valorTotal = rematriculas.reduce((s,r) => s + r.taxaValor, 0)
  const valorRecebido = rematriculas.filter(r => r.taxaPaga).reduce((s,r) => s + r.taxaValor, 0)

  return (
    <div style={{padding:'24px 28px',maxWidth:1400,margin:'0 auto'}}>
      {/* Page Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <div style={{width:46,height:46,borderRadius:14,background:'linear-gradient(135deg,#06b6d4,#6366f1)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 24px rgba(6,182,212,0.35)'}}>
            <RefreshCw size={22} color="#fff"/>
          </div>
          <div>
            <h1 style={{fontSize:22,fontWeight:900,margin:0,letterSpacing:'-0.03em'}} className="gradient-text">Rematrícula Digital</h1>
            <p style={{fontSize:12,color:'hsl(var(--text-muted))',margin:0}}>Campanha {new Date().getFullYear()} → {new Date().getFullYear()+1}</p>
          </div>
          <span style={{padding:'3px 10px',borderRadius:100,background:'rgba(16,185,129,0.12)',color:'#10b981',fontSize:10,fontWeight:800,border:'1px solid rgba(16,185,129,0.25)',letterSpacing:'0.05em'}}>
            AO VIVO
          </span>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button className="btn btn-secondary btn-sm" style={{display:'flex',alignItems:'center',gap:6,fontSize:12}}>
            <Download size={13}/> Exportar
          </button>
          <button className="btn btn-primary btn-sm" style={{display:'flex',alignItems:'center',gap:6,fontSize:12}}>
            <Plus size={13}/> Nova Campanha
          </button>
        </div>
      </div>

      {/* Progress Bar da Campanha */}
      <div style={{padding:'14px 20px',background:'hsl(var(--bg-elevated))',borderRadius:14,border:'1px solid hsl(var(--border-subtle))',marginBottom:20,display:'flex',alignItems:'center',gap:20}}>
        <div style={{flex:1}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
            <span style={{fontSize:11,fontWeight:700,color:'hsl(var(--text-muted))'}}>PROGRESSO DA CAMPANHA</span>
            <span style={{fontSize:13,fontWeight:900,color:'#10b981'}}>{pct}% concluído</span>
          </div>
          <div style={{height:8,background:'hsl(var(--bg-overlay))',borderRadius:100,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${pct}%`,background:'linear-gradient(90deg,#06b6d4,#10b981)',borderRadius:100,transition:'width 0.5s ease'}}/>
          </div>
        </div>
        <div style={{display:'flex',gap:16,fontSize:11,color:'hsl(var(--text-muted))',flexShrink:0}}>
          <span>📅 Início: 01/01/{new Date().getFullYear()}</span>
          <span>🏁 Prazo: 31/01/{new Date().getFullYear()+1}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12,marginBottom:24}}>
        {[
          {label:'Elegíveis',value:total,color:'#818cf8',icon:'🎓',sub:'alunos'},
          {label:'Concluídas',value:concluidas,color:'#10b981',icon:'✅',sub:'rematrículas'},
          {label:'Pendentes',value:pendentes,color:'#3b82f6',icon:'🔄',sub:'em processo'},
          {label:'Aguard. Assinatura',value:assinatura,color:'#a78bfa',icon:'✍️',sub:'documentos'},
          {label:'Taxa de Adesão',value:`${pct}%`,color:'#06b6d4',icon:'📊',sub:'do total'},
          {label:'Valor Recebido',value:`R$${valorRecebido.toLocaleString()}`,color:'#10b981',icon:'💵',sub:'confirmado'},
        ].map(k => (
          <div key={k.label} style={{background:'hsl(var(--bg-elevated))',border:'1px solid hsl(var(--border-subtle))',borderRadius:14,padding:'14px 16px',transition:'transform 0.15s,box-shadow 0.15s',cursor:'default'}}
            onMouseEnter={e => {(e.currentTarget as HTMLDivElement).style.transform='translateY(-2px)';(e.currentTarget as HTMLDivElement).style.boxShadow=`0 8px 24px ${k.color}18`}}
            onMouseLeave={e => {(e.currentTarget as HTMLDivElement).style.transform='';(e.currentTarget as HTMLDivElement).style.boxShadow=''}}>
            <div style={{fontSize:20,marginBottom:6}}>{k.icon}</div>
            <div style={{fontFamily:'Outfit,sans-serif',fontWeight:900,fontSize:18,color:k.color,lineHeight:1}}>{k.value}</div>
            <div style={{fontSize:10,fontWeight:700,color:'hsl(var(--text-muted))',marginTop:4}}>{k.label}</div>
            <div style={{fontSize:9,color:'hsl(var(--text-muted))',opacity:0.7}}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div style={{display:'flex',gap:2,marginBottom:20,background:'hsl(var(--bg-elevated))',borderRadius:12,padding:4,border:'1px solid hsl(var(--border-subtle))',flexWrap:'wrap'}}>
        {ABAS.map(a => (
          <button key={a.key} onClick={() => setAba(a.key)}
            style={{display:'flex',alignItems:'center',gap:7,padding:'8px 14px',borderRadius:9,border:'none',cursor:'pointer',fontSize:12,fontWeight:aba===a.key?700:500,
              background:aba===a.key?'hsl(var(--bg-base))':'transparent',
              color:aba===a.key?'hsl(var(--text-base))':'hsl(var(--text-muted))',
              boxShadow:aba===a.key?'0 1px 6px rgba(0,0,0,0.15)':'none',
              transition:'all 0.15s',whiteSpace:'nowrap'}}>
            <span style={{color:aba===a.key?'#06b6d4':'inherit'}}>{a.icon}</span>{a.label}
          </button>
        ))}
      </div>

      {/* ── ABA PAINEL ─────────────────────────────────────── */}
      {aba === 'painel' && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
          {/* Por status */}
          <div style={{background:'hsl(var(--bg-elevated))',borderRadius:16,border:'1px solid hsl(var(--border-subtle))',overflow:'hidden'}}>
            <div style={{padding:'14px 20px',borderBottom:'1px solid hsl(var(--border-subtle))',fontWeight:700,fontSize:13}}>📊 Por Status</div>
            <div style={{padding:'14px 20px',display:'flex',flexDirection:'column',gap:10}}>
              {Object.entries(STATUS_CFG).map(([key,cfg]) => {
                const count = rematriculas.filter(r => r.rStatus === key).length
                const pctBar = total > 0 ? (count/total)*100 : 0
                return (
                  <div key={key}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                      <span style={{fontSize:11,fontWeight:600}}>{cfg.icon} {cfg.label}</span>
                      <span style={{fontSize:11,fontWeight:900,color:cfg.color}}>{count}</span>
                    </div>
                    <div style={{height:5,background:'hsl(var(--bg-overlay))',borderRadius:100,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${pctBar}%`,background:cfg.color,borderRadius:100,transition:'width 0.4s'}}/>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Por turma */}
          <div style={{background:'hsl(var(--bg-elevated))',borderRadius:16,border:'1px solid hsl(var(--border-subtle))',overflow:'hidden'}}>
            <div style={{padding:'14px 20px',borderBottom:'1px solid hsl(var(--border-subtle))',fontWeight:700,fontSize:13}}>🏆 Ranking por Turma</div>
            <div style={{padding:'14px 20px',display:'flex',flexDirection:'column',gap:8}}>
              {[...new Set(rematriculas.map(r => r.turma).filter(Boolean))].slice(0,6).map((turma, i) => {
                const turmaAlunos = rematriculas.filter(r => r.turma === turma)
                const turmaConc = turmaAlunos.filter(r => r.rStatus === 'concluida').length
                const turmaPct = turmaAlunos.length > 0 ? Math.round((turmaConc/turmaAlunos.length)*100) : 0
                return (
                  <div key={turma} style={{display:'flex',alignItems:'center',gap:12}}>
                    <span style={{fontSize:11,fontWeight:900,color:i<3?'#f59e0b':'hsl(var(--text-muted))',width:16}}>{i+1}º</span>
                    <span style={{flex:1,fontSize:12,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{turma}</span>
                    <div style={{width:80,height:5,background:'hsl(var(--bg-overlay))',borderRadius:100,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${turmaPct}%`,background:'linear-gradient(90deg,#06b6d4,#10b981)',borderRadius:100}}/>
                    </div>
                    <span style={{fontSize:11,fontWeight:800,color:'#10b981',width:34,textAlign:'right'}}>{turmaPct}%</span>
                  </div>
                )
              })}
              {rematriculas.length === 0 && <div style={{textAlign:'center',padding:'20px',color:'hsl(var(--text-muted))',fontSize:12}}>Nenhum aluno matriculado</div>}
            </div>
          </div>

          {/* Alertas críticos */}
          <div style={{gridColumn:'1/-1',background:'hsl(var(--bg-elevated))',borderRadius:16,border:'1px solid hsl(var(--border-subtle))',overflow:'hidden'}}>
            <div style={{padding:'14px 20px',borderBottom:'1px solid hsl(var(--border-subtle))',fontWeight:700,fontSize:13}}>🚨 Alertas Inteligentes</div>
            <div style={{padding:'14px 20px',display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12}}>
              {[
                {icon:'⚠️',label:`${pagamento} alunos aguardam pagamento`,color:'#f59e0b',desc:'Taxa de rematrícula pendente'},
                {icon:'✍️',label:`${assinatura} contratos aguardam assinatura`,color:'#a78bfa',desc:'Envio pelo ZapSign pendente'},
                {icon:'📄',label:`${rematriculas.filter(r=>r.rStatus==='pendencia_doc').length} com pendência documental`,color:'#f97316',desc:'Documentos em falta'},
                {icon:'🕐',label:`${pendentes} não iniciaram o processo`,color:'#3b82f6',desc:'Comunicado recomendado'},
              ].map(al => (
                <div key={al.label} style={{padding:'12px 14px',borderRadius:12,background:`${al.color}08`,border:`1px solid ${al.color}25`,display:'flex',gap:10,alignItems:'flex-start'}}>
                  <span style={{fontSize:16}}>{al.icon}</span>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:al.color}}>{al.label}</div>
                    <div style={{fontSize:10,color:'hsl(var(--text-muted))',marginTop:2}}>{al.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── ABA ALUNOS ─────────────────────────────────────── */}
      {aba === 'alunos' && (
        <div>
          {/* Barra de busca/filtro */}
          <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
            <div style={{position:'relative',flex:'1 1 240px'}}>
              <Search size={14} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'hsl(var(--text-muted))'}}/>
              <input className="form-input" placeholder="Buscar aluno, turma..." value={busca} onChange={e=>setBusca(e.target.value)} style={{paddingLeft:32,fontSize:12}}/>
            </div>
            <select className="form-input" value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value as any)} style={{flex:'0 0 200px',fontSize:12}}>
              <option value="todos">Todos os status</option>
              {Object.entries(STATUS_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button className="btn btn-secondary btn-sm" style={{display:'flex',alignItems:'center',gap:6,fontSize:12}}>
              <Send size={12}/> Cobrar em Lote
            </button>
            <button className="btn btn-secondary btn-sm" style={{display:'flex',alignItems:'center',gap:6,fontSize:12}}>
              <FileText size={12}/> Gerar Contratos
            </button>
          </div>

          <div style={{background:'hsl(var(--bg-elevated))',borderRadius:16,border:'1px solid hsl(var(--border-subtle))',overflow:'hidden'}}>
            <div style={{padding:'12px 20px',borderBottom:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:700,fontSize:13}}>{filtradas.length} aluno{filtradas.length!==1?'s':''}</span>
              <button className="btn btn-ghost btn-sm" style={{fontSize:11}}>Selecionar todos</button>
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead>
                  <tr style={{background:'hsl(var(--bg-overlay))'}}>
                    {['Aluno','Turma','Responsável Financeiro','Sit. Financ.','Status Rematrícula','Contrato','Assinatura','Ações'].map(h => (
                      <th key={h} style={{padding:'9px 12px',textAlign:'left',fontSize:9,fontWeight:800,color:'hsl(var(--text-muted))',letterSpacing:'0.06em',textTransform:'uppercase',whiteSpace:'nowrap',borderBottom:'1px solid hsl(var(--border-subtle))'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtradas.length === 0 && (
                    <tr><td colSpan={9} style={{padding:'40px',textAlign:'center',color:'hsl(var(--text-muted))'}}>Nenhum resultado encontrado</td></tr>
                  )}
                  {filtradas.map((a,idx) => {
                    const sc = STATUS_CFG[a.rStatus]
                    const iniciais = a.nome?.split(' ').slice(0,2).map((n:string)=>n[0]).join('').toUpperCase() || '?'
                    return (
                      <tr key={a.id} style={{borderBottom:'1px solid hsl(var(--border-subtle))',background:idx%2===0?'transparent':'hsl(var(--bg-overlay))',transition:'background 0.1s'}}
                        onMouseEnter={e=>(e.currentTarget as HTMLTableRowElement).style.background='rgba(6,182,212,0.03)'}
                        onMouseLeave={e=>(e.currentTarget as HTMLTableRowElement).style.background=idx%2===0?'transparent':'hsl(var(--bg-overlay))'}>
                        <td style={{padding:'10px 12px'}}>
                          <div style={{display:'flex',alignItems:'center',gap:9}}>
                            <div style={{width:32,height:32,borderRadius:'50%',background:`linear-gradient(135deg,#06b6d4,#6366f1)`,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:800,fontSize:11,flexShrink:0}}>{iniciais}</div>
                            <div>
                              <div style={{fontWeight:700,fontSize:12}}>{a.nome}</div>
                              <div style={{fontSize:10,color:'hsl(var(--text-muted))'}}>{a.turno}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{padding:'10px 12px',fontSize:11,color:'hsl(var(--text-muted))'}}>{a.turma||'—'}</td>
                        <td style={{padding:'10px 12px',fontSize:11}}>{a.responsavelFinanceiro || a.responsavel||'—'}</td>
                        <td style={{padding:'10px 12px'}}>
                          <span style={{fontSize:10,padding:'2px 8px',borderRadius:100,fontWeight:700,background:a.inadimplente?'rgba(239,68,68,0.1)':'rgba(16,185,129,0.1)',color:a.inadimplente?'#ef4444':'#10b981',border:`1px solid ${a.inadimplente?'rgba(239,68,68,0.2)':'rgba(16,185,129,0.2)'}`}}>
                            {a.inadimplente?'⚠ Inadimplente':'✓ Em dia'}
                          </span>
                        </td>
                        <td style={{padding:'10px 12px'}}>
                          <span style={{fontSize:10,padding:'2px 9px',borderRadius:100,fontWeight:700,background:sc.bg,color:sc.color,border:`1px solid ${sc.color}25`,whiteSpace:'nowrap'}}>
                            {sc.icon} {sc.label}
                          </span>
                        </td>
                        <td style={{padding:'10px 12px'}}>
                          <span style={{fontSize:10,padding:'2px 8px',borderRadius:100,background:'rgba(99,102,241,0.1)',color:'#818cf8',fontWeight:600}}>
                            {a.rStatus==='nao_iniciado'?'—':'Gerado'}
                          </span>
                        </td>
                        <td style={{padding:'10px 12px'}}>
                          {(() => {
                            let zapSaved: Record<string,string> = {}
                            try { const r = localStorage.getItem(`edu-zapsign-status-${a.id}`); if(r) zapSaved = JSON.parse(r) } catch {}
                            const allDocs: any[] = (() => { try { const r = localStorage.getItem('edu-documentos-modelos'); return r ? JSON.parse(r).filter((d:any)=>d.status==='ativo') : [] } catch { return [] } })()
                            const todosAss = allDocs.length > 0 && allDocs.every((d:any) => zapSaved[d.id]==='assinado')
                            const algumPend = allDocs.some((d:any) => !zapSaved[d.id] || zapSaved[d.id]==='nao_enviado' || zapSaved[d.id]==='pendente')
                            return (
                              <span style={{fontSize:10,padding:'2px 8px',borderRadius:100,fontWeight:600,
                                background:todosAss?'rgba(16,185,129,0.1)':algumPend?'rgba(167,139,250,0.1)':'rgba(100,116,139,0.1)',
                                color:todosAss?'#10b981':algumPend?'#a78bfa':'#64748b'}}>
                                {allDocs.length===0?'—':todosAss?'✅ Todos assinados':algumPend?'⏳ Pendente':'📤 Enviado'}
                              </span>
                            )
                          })()}
                        </td>

                        <td style={{padding:'10px 12px'}}>
                          <div style={{display:'flex',gap:4}}>
                            <button onClick={()=>setAlunoModal(a)} className="btn btn-sm" style={{fontSize:10,padding:'4px 8px',background:'rgba(6,182,212,0.1)',color:'#06b6d4',border:'1px solid rgba(6,182,212,0.2)'}}>
                              <Eye size={10}/> Ver
                            </button>
                            <button className="btn btn-sm" style={{fontSize:10,padding:'4px 8px',background:'rgba(167,139,250,0.1)',color:'#a78bfa',border:'1px solid rgba(167,139,250,0.2)'}}>
                              <Send size={10}/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}


      {/* ── ABA ASSINATURAS ────────────────────────────────── */}
      {aba === 'assinaturas' && (
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div style={{padding:'14px 20px',background:'rgba(167,139,250,0.05)',border:'1px solid rgba(167,139,250,0.2)',borderRadius:14,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <Zap size={18} color="#a78bfa"/>
              <div>
                <div style={{fontWeight:800,fontSize:13}}>ZapSign — Assinatura Digital</div>
                <div style={{fontSize:11,color:'hsl(var(--text-muted))'}}>Integração configurada e pronta para uso</div>
              </div>
            </div>
            <span style={{padding:'4px 12px',background:'rgba(16,185,129,0.12)',color:'#10b981',borderRadius:100,fontSize:11,fontWeight:700,border:'1px solid rgba(16,185,129,0.25)'}}>🟢 Conectado</span>
          </div>
          <div style={{background:'hsl(var(--bg-elevated))',borderRadius:14,border:'1px solid hsl(var(--border-subtle))',overflow:'hidden'}}>
            <div style={{padding:'12px 20px',borderBottom:'1px solid hsl(var(--border-subtle))',fontWeight:700,fontSize:13}}>Status das Assinaturas</div>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{background:'hsl(var(--bg-overlay))'}}>
                  {['Aluno','Documento','Signatários','ZapSign Status','Enviado em','Assinado em','Ações'].map(h => (
                    <th key={h} style={{padding:'9px 14px',textAlign:'left',fontSize:9,fontWeight:800,color:'hsl(var(--text-muted))',letterSpacing:'0.06em',textTransform:'uppercase',borderBottom:'1px solid hsl(var(--border-subtle))'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.filter((_,i)=>i<8).map((a,idx) => {
                  const zapStatus = a.rStatus==='concluida'?'assinado':a.rStatus==='aguarda_assinatura'?'pendente':'nao_enviado'
                  return (
                    <tr key={a.id} style={{borderBottom:'1px solid hsl(var(--border-subtle))',background:idx%2===0?'transparent':'hsl(var(--bg-overlay))'}}>
                      <td style={{padding:'9px 14px',fontWeight:600}}>{a.nome}</td>
                      <td style={{padding:'9px 14px',fontSize:11,color:'hsl(var(--text-muted))'}}>Contrato Rematrícula</td>
                      <td style={{padding:'9px 14px',fontSize:10}}>{a.responsavel||'Responsável'}</td>
                      <td style={{padding:'9px 14px'}}>
                        <span style={{fontSize:10,padding:'2px 8px',borderRadius:100,fontWeight:700,
                          background:zapStatus==='assinado'?'rgba(16,185,129,0.1)':zapStatus==='pendente'?'rgba(167,139,250,0.1)':'rgba(100,116,139,0.1)',
                          color:zapStatus==='assinado'?'#10b981':zapStatus==='pendente'?'#a78bfa':'#64748b'}}>
                          {zapStatus==='assinado'?'✅ Assinado':zapStatus==='pendente'?'⏳ Pendente':'— Não enviado'}
                        </span>
                      </td>
                      <td style={{padding:'9px 14px',fontSize:10,color:'hsl(var(--text-muted))'}}>{zapStatus!=='nao_enviado'?`${String(idx%28+1).padStart(2,'0')}/01/${new Date().getFullYear()}`:'—'}</td>
                      <td style={{padding:'9px 14px',fontSize:10,color:'#10b981'}}>{zapStatus==='assinado'?`${String(idx%28+3).padStart(2,'0')}/01/${new Date().getFullYear()}`:'—'}</td>
                      <td style={{padding:'9px 14px'}}>
                        <div style={{display:'flex',gap:4}}>
                          {zapStatus==='nao_enviado'&&<button className="btn btn-sm" style={{fontSize:10,padding:'4px 8px',background:'rgba(167,139,250,0.1)',color:'#a78bfa',border:'1px solid rgba(167,139,250,0.2)'}}>Enviar</button>}
                          {zapStatus==='pendente'&&<button className="btn btn-sm" style={{fontSize:10,padding:'4px 8px',background:'rgba(245,158,11,0.1)',color:'#f59e0b',border:'1px solid rgba(245,158,11,0.2)'}}>Reenviar</button>}
                          {zapStatus==='assinado'&&<button className="btn btn-sm" style={{fontSize:10,padding:'4px 8px',background:'rgba(16,185,129,0.1)',color:'#10b981',border:'1px solid rgba(16,185,129,0.2)'}}><Download size={10}/></button>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* ── ABA CONFIGURAÇÕES ──────────────────────────────── */}
      {aba === 'configuracoes' && (
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div style={{padding:20,background:'hsl(var(--bg-elevated))',borderRadius:14,border:'1px solid hsl(var(--border-subtle))'}}>
            <div style={{fontWeight:700,fontSize:13,marginBottom:16}}>📋 Configurações da Campanha</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              {[['Ano de Origem',String(new Date().getFullYear())],['Ano de Destino',String(new Date().getFullYear()+1)],['Início da Campanha',''],['Fim da Campanha','']].map(([l,v])=>(
                <div key={l}><label style={{fontSize:10,color:'hsl(var(--text-muted))',fontWeight:700,display:'block',marginBottom:4}}>{l.toUpperCase()}</label>
                  <input className="form-input" defaultValue={v} type={l.includes('Ano')?'text':'date'} style={{fontSize:12}}/></div>
              ))}
            </div>
          </div>
          <div style={{padding:20,background:'hsl(var(--bg-elevated))',borderRadius:14,border:'1px solid hsl(var(--border-subtle))'}}>
            <div style={{fontWeight:700,fontSize:13,marginBottom:16}}>🔒 Regras de Negócio</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {[
                ['Bloquear rematrícula de inadimplentes','inadimplente'],
                ['Exigir atualização cadastral','cadastro'],
                ['Exigir assinatura do contrato','assinatura'],
                ['Exigir pagamento da taxa','taxa'],
                ['Permitir exceção manual','excecao'],
              ].map(([label,key])=>(
                <div key={key} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:'hsl(var(--bg-overlay))',borderRadius:8,border:'1px solid hsl(var(--border-subtle))'}}>
                  <span style={{fontSize:12,fontWeight:600}}>{label}</span>
                  <div
                    onClick={evt=>{const btn=evt.currentTarget as HTMLDivElement;const active=btn.dataset.active==='true';btn.dataset.active=String(!active);btn.style.background=!active?'#10b981':'hsl(var(--bg-overlay))';(btn.firstElementChild as HTMLElement).style.left=!active?'18px':'2px'}}
                    data-active="false"
                    style={{position:'relative',width:40,height:22,cursor:'pointer',background:'hsl(var(--bg-overlay))',borderRadius:100,border:'1px solid hsl(var(--border-subtle))',transition:'background 0.2s'}}>
                    <div style={{position:'absolute',top:2,left:2,width:16,height:16,borderRadius:'50%',background:'hsl(var(--text-muted))',transition:'left 0.2s,background 0.2s'}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{padding:20,background:'rgba(129,140,248,0.05)',borderRadius:14,border:'1px solid rgba(129,140,248,0.2)'}}>
            <div style={{fontWeight:700,fontSize:13,marginBottom:12,display:'flex',alignItems:'center',gap:8}}><Zap size={14} color="#818cf8"/>ZapSign API</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div>
                <label style={{fontSize:10,color:'hsl(var(--text-muted))',fontWeight:700,display:'block',marginBottom:4}}>API TOKEN</label>
                <input className="form-input" type="password" placeholder="eyJ..." style={{fontSize:12}}
                  value={zapToken} onChange={e => { setZapToken(e.target.value); setZapStatus('idle'); setZapMsg('') }}/>
              </div>
              <div>
                <label style={{fontSize:10,color:'hsl(var(--text-muted))',fontWeight:700,display:'block',marginBottom:4}}>WEBHOOK URL</label>
                <input className="form-input" placeholder="https://seu-dominio.com/api/webhook/zapsign" style={{fontSize:12}}
                  value={zapWebhook} onChange={e => setZapWebhook(e.target.value)}/>
              </div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10,marginTop:12,flexWrap:'wrap'}}>
              <button
                className="btn btn-sm"
                onClick={handleTestarZapSign}
                disabled={zapStatus==='loading'}
                style={{fontSize:12,
                  background: zapStatus==='ok' ? 'rgba(16,185,129,0.12)' : zapStatus==='error' ? 'rgba(239,68,68,0.10)' : 'rgba(129,140,248,0.1)',
                  color: zapStatus==='ok' ? '#10b981' : zapStatus==='error' ? '#ef4444' : '#818cf8',
                  border: `1px solid ${zapStatus==='ok'?'rgba(16,185,129,0.3)':zapStatus==='error'?'rgba(239,68,68,0.25)':'rgba(129,140,248,0.3)'}`,
                  display:'flex',alignItems:'center',gap:6,opacity:zapStatus==='loading'?0.7:1,cursor:zapStatus==='loading'?'wait':'pointer',
                }}>
                {zapStatus==='loading' ? <><span style={{display:'inline-block',width:10,height:10,border:'2px solid #818cf8',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/> Testando...</>
                  : zapStatus==='ok' ? '✅ Reconectar'
                  : zapStatus==='error' ? '🔁 Tentar novamente'
                  : '⚡ Testar Conexão'}
              </button>
              {zapMsg && (
                <span style={{fontSize:11,fontWeight:600,
                  color: zapStatus==='ok'?'#10b981' : zapStatus==='error'?'#ef4444' : '#f59e0b',
                }}>
                  {zapMsg}
                </span>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ── ABA HISTÓRICO ──────────────────────────────────── */}
      {aba === 'historico' && (
        <div style={{background:'hsl(var(--bg-elevated))',borderRadius:16,border:'1px solid hsl(var(--border-subtle))',overflow:'hidden'}}>
          <div style={{padding:'14px 20px',borderBottom:'1px solid hsl(var(--border-subtle))',fontWeight:700,fontSize:13}}>📋 Log de Auditoria</div>
          <div style={{padding:'14px 20px',display:'flex',flexDirection:'column',gap:0}}>
            {[
              {time:'Hoje 09:14',user:'Secretaria',action:'Gerou contrato em lote',target:'32 alunos',color:'#818cf8',icon:'📄'},
              {time:'Hoje 08:47',user:'Financeiro',action:'Confirmou pagamento manual',target:'Ana Souza',color:'#10b981',icon:'💳'},
              {time:'Ontem 17:22',user:'Sistema',action:'ZapSign: Documento assinado',target:'Carlos Lima',color:'#06b6d4',icon:'✍️'},
              {time:'Ontem 15:10',user:'Diretora',action:'Liberou exceção financeira',target:'Pedro Santos',color:'#f59e0b',icon:'🔓'},
              {time:'Ontem 11:30',user:'Secretaria',action:'Enviou comunicado em lote',target:'85 responsáveis',color:'#a78bfa',icon:'📨'},
              {time:'01/01 08:00',user:'Sistema',action:'Campanha de rematrícula iniciada',target:`Ano ${new Date().getFullYear()+1}`,color:'#10b981',icon:'🚀'},
            ].map((log,i,arr)=>(
              <div key={i} style={{display:'flex',gap:16,paddingBottom:i<arr.length-1?16:0,marginBottom:i<arr.length-1?16:0,borderBottom:i<arr.length-1?'1px dashed hsl(var(--border-subtle))':'none'}}>
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:0,flexShrink:0}}>
                  <div style={{width:32,height:32,borderRadius:'50%',background:`${log.color}12`,border:`2px solid ${log.color}30`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>{log.icon}</div>
                  {i<arr.length-1&&<div style={{width:2,height:16,background:'hsl(var(--border-subtle))',marginTop:4}}/>}
                </div>
                <div style={{flex:1,paddingTop:6}}>
                  <div style={{fontSize:12,fontWeight:700}}>{log.action} — <span style={{color:log.color}}>{log.target}</span></div>
                  <div style={{fontSize:10,color:'hsl(var(--text-muted))',marginTop:2}}>Por <strong>{log.user}</strong> · {log.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal aluno */}
      {alunoModal && <AlunoModal aluno={alunoModal} onClose={()=>setAlunoModal(null)}/>}
    </div>
  )
}
