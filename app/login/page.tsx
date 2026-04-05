'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import { createSession } from '../actions/authActions'

type Step = 'login' | 'first_access_verify' | 'first_access_create' | 'setup_master'

const FEATURES = [
  { icon: '🎓', label: 'Gestão Acadêmica', desc: 'Turmas, notas, frequência e ocorrências em tempo real' },
  { icon: '💰', label: 'Financeiro Completo', desc: 'Mensalidades, inadimplência e fluxo de caixa' },
  { icon: '👥', label: 'RH Integrado', desc: 'Folha, ponto, férias e avaliação de desempenho' },
  { icon: '🤖', label: 'Inteligência Artificial', desc: 'Insights preditivos e copiloto pedagógico' },
]
const TESTIMONIALS = [
  { text: '"Reduzimos a inadimplência em 40% no primeiro semestre."', author: 'Diretora Financeira', school: 'Colégio Excelência' },
  { text: '"O módulo de IA transformou nosso planejamento pedagógico."', author: 'Coordenadora Pedagógica', school: 'Instituto Futuro' },
  { text: '"Dashboard em tempo real, dados que antes levavam semanas."', author: 'Diretor Geral', school: 'Grupo Educacional Alpha' },
]



interface SysUser { id: string; nome: string; email: string; cargo: string; perfil: string; status: string; ultimoAcesso: string }
type FoundUser  = { id: string; nome: string; email: string; cargo: string; perfil: string }

// ── Senha storage ─────────────────────────────────────────────────────────────
const PASS_KEY = 'edu-user-passwords'
function getSenhas(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(PASS_KEY) ?? '{}') } catch { return {} }
}
function setSenha(uid: string, senha: string) {
  const all = getSenhas(); all[uid] = senha; localStorage.setItem(PASS_KEY, JSON.stringify(all))
}
function verificarSenha(uid: string, senha: string): boolean { return getSenhas()[uid] === senha }
function temSenha(uid: string): boolean { return !!getSenhas()[uid] }

// ── Buscar todos os usuários ativos ───────────────────────────────────────────
function getAllUsers(): FoundUser[] {
  try {
    const sysUsers: SysUser[] = JSON.parse(localStorage.getItem('edu-sys-users') ?? '[]')
    const fromSys = sysUsers
      .filter(u => u.status === 'ativo')
      .map(u => ({ id: u.id, nome: u.nome, email: u.email.toLowerCase(), login: u.email.toLowerCase(), cargo: u.cargo || u.perfil, perfil: u.perfil }))
    
    // Alunos & Responsáveis (Acesso Família)
    const extraUsers: any[] = []
    const alunos = JSON.parse(localStorage.getItem('edu-data-alunos') ?? '[]')
    const authUsers = JSON.parse(localStorage.getItem('edu-auth-users') ?? '[]')

    alunos.forEach((a: any) => {
       const sAuth = authUsers.find((u: any) => u.academic_id === a.id && u.user_type === 'student')
       if ((sAuth?.status || 'ATIVO') !== 'INATIVO') {
          const login = sAuth?.login || a.codigo || a.matricula || a.id.substring(0,8)
          const email = a.email || sAuth?.email || login
          const loginStr = String(login || '').trim().toLowerCase()
          const emailStr = String(email || '').trim().toLowerCase()
          extraUsers.push({ id: sAuth?.id || `virtual-${a.id}`, nome: a.nome, email: emailStr, login: loginStr, cargo: 'Aluno', perfil: 'Família' })
       }

       const parseG = (g: any) => {
         if (!g.nome) return
         const emailRaw = g.email || g.email_responsavel || g.emailResponsavel || ''
         const cpfRaw = g.cpf || g.cpf_responsavel || g.cpfResponsavel || ''
         const celRaw = g.celular || g.telefone || g.celular_responsavel || g.telResponsavel || ''
         
         const key = emailRaw || cpfRaw || g.nome
         const gAuth = authUsers.find((u: any) => u.reference_key === key && u.user_type === 'guardian')
         if ((gAuth?.status || 'ATIVO') !== 'INATIVO') {
            const login = gAuth?.login || emailRaw || celRaw || ''
            const email = emailRaw || gAuth?.email || login
            const loginStr = String(login || '').trim().toLowerCase()
            const emailStr = String(email || '').trim().toLowerCase()
            if (!extraUsers.some(u => u.id === (gAuth?.id || `virtual-${key}`))) {
               extraUsers.push({ id: gAuth?.id || `virtual-${key}`, nome: g.nome, email: emailStr, login: loginStr, cargo: 'Responsável', perfil: 'Família' })
            }
         }
       }
       if (a._responsaveis && Array.isArray(a._responsaveis)) a._responsaveis.forEach(parseG)
       else if (a.responsaveis && Array.isArray(a.responsaveis)) a.responsaveis.forEach(parseG)
       else if (a.responsavel) parseG({ nome: a.responsavel, cpf: a.cpf_responsavel || a.cpfResponsavel, email: a.email_responsavel || a.emailResponsavel, celular: a.celular_responsavel || a.telResponsavel })
    })

    return [...fromSys, ...extraUsers] as FoundUser[]
  } catch { return [] }
}

export default function LoginPage() {
  const router = useRouter()
  const { setCurrentUser } = useApp()

  // ── step manager
  const [step, setStep] = useState<Step>('login')

  // ── login form
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError]     = useState('')

  // ── primeiro acesso — verificação
  const [faQuery, setFaQuery]   = useState('')
  const [faLoading, setFaLoading] = useState(false)
  const [faError, setFaError]     = useState('')
  const [faUser, setFaUser]       = useState<FoundUser | null>(null)

  // ── primeiro acesso — criar senha
  const [newPass, setNewPass]       = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showNewPw, setShowNewPw]     = useState(false)
  const [showConfPw, setShowConfPw]   = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError]     = useState('')
  const [createSuccess, setCreateSuccess] = useState(false)
  const [faRegEmail, setFaRegEmail] = useState('')

  // ── animations
  const [typedText, setTypedText]       = useState('')
  const [testimonialIdx, setTestimonialIdx] = useState(0)
  const [mousePos, setMousePos]         = useState({ x: 0, y: 0 })
  const headline = 'Gestão escolar do futuro, hoje.'

  useEffect(() => {
    let i = 0; setTypedText('')
    const iv = setInterval(() => { if (i <= headline.length) { setTypedText(headline.slice(0, i)); i++ } else clearInterval(iv) }, 55)
    return () => clearInterval(iv)
  }, [])
  useEffect(() => {
    const t = setInterval(() => setTestimonialIdx(p => (p + 1) % TESTIMONIALS.length), 4000)
    return () => clearInterval(t)
  }, [])
  const [isSystemEmpty, setIsSystemEmpty] = useState(false)
  const [setupNome, setSetupNome]   = useState('')
  const [setupEmail, setSetupEmail] = useState('')
  const [setupPass, setSetupPass]   = useState('')
  const [setupLoading, setSetupLoading] = useState(false)
  const [mounted, setMounted]       = useState(false)

  useEffect(() => {
    setMounted(true)
    const h = (e: MouseEvent) => setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight })
    window.addEventListener('mousemove', h); 
    
    // Verifica se sistema está vazio para exibir botão Master
    fetch('/api/configuracoes/usuarios', { cache: 'no-store' }).then(r => r.json()).then(data => {
      setIsSystemEmpty(!data || data.length === 0)
    }).catch(() => {
      const sysUsers = JSON.parse(localStorage.getItem('edu-sys-users') ?? '[]')
      setIsSystemEmpty(sysUsers.length === 0)
    })

    return () => window.removeEventListener('mousemove', h)
  }, [])

  const orbitX = (mousePos.x - 0.5) * 30
  const orbitY = (mousePos.y - 0.5) * 30

  // ── password strength
  const passStrength = (p: string) => {
    if (!p.length) return { label: '', color: 'transparent', pct: 0 }
    const has = { u: /[A-Z]/.test(p), l: /[a-z]/.test(p), n: /\d/.test(p), s: /[^A-Za-z0-9]/.test(p) }
    const score = Object.values(has).filter(Boolean).length
    if (p.length < 6) return { label: 'Muito fraca', color: '#ef4444', pct: 20 }
    if (p.length < 8 || score <= 2) return { label: 'Razoável', color: '#f59e0b', pct: 50 }
    if (score === 3)                  return { label: 'Boa',      color: '#fbbf24', pct: 75 }
    if (p.length >= 8 && score >= 3)return { label: 'Forte',     color: '#10b981', pct: 100 }
    return { label: 'Boa', color: '#34d399', pct: 82 }
  }
  const strength = passStrength(newPass)

  // ── handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { setLoginError('Preencha e-mail e senha.'); return }
    setLoginLoading(true); setLoginError('')
    await new Promise(r => setTimeout(r, 600))
    const q = email.trim().toLowerCase()

    let foundSysDb: any = null
    try {
      const dbUsers = await fetch('/api/configuracoes/usuarios', { cache: 'no-store' }).then(r => r.json())
      foundSysDb = (dbUsers || []).find((u: any) => u.email?.toLowerCase() === q)
    } catch(err) {}

    let found: any = null;
    let isDbUser = false;

    if (foundSysDb) {
       found = foundSysDb;
       if (found.senha) {
          if (found.senha !== password) {
             setLoginLoading(false); setLoginError('Senha incorreta.'); return
          }
       } else {
          if (!temSenha(found.id)) {
            setLoginLoading(false); setLoginError('Você ainda não criou sua senha. Use "Primeiro Acesso" abaixo.'); return
          }
          if (!verificarSenha(found.id, password)) {
            setLoginLoading(false); setLoginError('Senha incorreta.'); return
          }
       }
       isDbUser = true;
    } else {
       const users = getAllUsers()
       found = users.find(u => (u.email && u.email.toLowerCase() === q) || ((u as any).login && (u as any).login.toLowerCase() === q))
       
       if (!found) { setLoginLoading(false); setLoginError('Login ou e-mail não cadastrado / inativo.'); return }
       if (!temSenha(found.id)) {
         setLoginLoading(false); setLoginError('Você ainda não criou sua senha. Use "Primeiro Acesso" abaixo.'); return
       }
       if (!verificarSenha(found.id, password)) {
         setLoginLoading(false); setLoginError('Senha incorreta.'); return
       }
    }

    setLoginLoading(false)

    // ── Update último acesso (sys-users ou auth-users)
    const nowStr = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())
    if (isDbUser) {
      fetch(`/api/configuracoes/usuarios/${found.id}`, { method: 'PUT', body: JSON.stringify({ ultimoAcesso: nowStr }) }).catch(()=>null)
    } else {
      const authUsers = JSON.parse(localStorage.getItem('edu-auth-users') ?? '[]')
      const authId = found.id.replace('virtual-', '')
      const authIdx = authUsers.findIndex((u: any) => u.id === authId || u.academic_id === authId)
      if (authIdx >= 0) {
        authUsers[authIdx].last_login = nowStr
        localStorage.setItem('edu-auth-users', JSON.stringify(authUsers))
      }
    }

    // ── Salva o usuário logado no context e gera JWT no Server via Action
    await createSession({ id: found.id, nome: found.nome, email: found.email, cargo: found.cargo, perfil: found.perfil })
    setCurrentUser({ id: found.id, nome: found.nome, email: found.email, cargo: found.cargo, perfil: found.perfil })
    if (found.perfil === 'Família' || found.cargo === 'Aluno' || found.cargo === 'Responsável') {
      router.push('/agenda-digital')
    } else if (found.perfil === 'Professor') {
      router.push('/professor')
    } else {
      router.push('/dashboard')
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!faQuery.trim()) { setFaError('Informe seu e-mail ou código.'); return }
    setFaLoading(true); setFaError('')
    await new Promise(r => setTimeout(r, 900))
    const q = faQuery.trim().toLowerCase()
    const users = getAllUsers()
    const found = users.find(u => (u.email && u.email.toLowerCase() === q) || ((u as any).login && (u as any).login.toLowerCase() === q))
    setFaLoading(false)
    if (found) { 
      if (temSenha(found.id)) {
        setFaError('Seu acesso já foi configurado. Faça login normalmente.')
      } else {
        setFaUser(found); setStep('first_access_create'); setFaRegEmail(found.email || '') 
      }
    }
    else setFaError('Nenhum cadastro encontrado. Verifique com a administração.')
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!faRegEmail.trim()) { setCreateError('Informe seu e-mail para continuar.'); return }
    if (newPass.length < 6) { setCreateError('Mínimo 6 caracteres.'); return }
    if (newPass !== confirmPass) { setCreateError('As senhas não coincidem.'); return }
    setCreateLoading(true); setCreateError('')
    await new Promise(r => setTimeout(r, 1200))
    setSenha(faUser!.id, newPass)

    const userId = faUser!.id.replace('virtual-', '')
    const authUsers = JSON.parse(localStorage.getItem('edu-auth-users') ?? '[]')
    const idx = authUsers.findIndex((u: any) => u.academic_id === userId || u.id === userId)
    if (idx >= 0) {
      authUsers[idx].email = faRegEmail
      localStorage.setItem('edu-auth-users', JSON.stringify(authUsers))
    }

    const alunos = JSON.parse(localStorage.getItem('edu-data-alunos') ?? '[]')
    const alIdx = alunos.findIndex((a: any) => a.id === userId)
    if (alIdx >= 0) {
      alunos[alIdx].email = faRegEmail
      localStorage.setItem('edu-data-alunos', JSON.stringify(alunos))
    }

    setCreateLoading(false); setCreateSuccess(true)
    await new Promise(r => setTimeout(r, 2200))
    setStep('login')
    setEmail(faRegEmail)
    setFaQuery(''); setFaUser(null); setNewPass(''); setConfirmPass(''); setCreateSuccess(false)
  }

  const goLogin = () => { setStep('login'); setFaError(''); setFaQuery(''); setFaUser(null); setNewPass(''); setConfirmPass(''); setCreateError(''); setCreateSuccess(false); setFaRegEmail('') }

  const handleSetupMaster = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!setupNome || !setupEmail || !setupPass) return
    setSetupLoading(true)
    await new Promise(r => setTimeout(r, 1500))

    const newId = 'master-' + Math.random().toString(36).substring(2, 9)
    const newUser = {
      id: newId,
      nome: setupNome,
      email: setupEmail,
      cargo: 'Administrador Master',
      perfil: 'Diretor Geral',
      status: 'ativo',
      twofa: false,
      ultimoAcesso: 'Agora',
      senha: setupPass,
    }

    // Salvar na API
    try {
      await fetch('/api/configuracoes/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      })
    } catch(err) { console.error('Erro ao salvar admin no banco', err) }

    // Salvar local storage também para garantir o login imediato com mock
    const sysUsers = JSON.parse(localStorage.getItem('edu-sys-users') ?? '[]')
    sysUsers.push(newUser)
    localStorage.setItem('edu-sys-users', JSON.stringify(sysUsers))
    setSenha(newId, setupPass)

    setSetupLoading(false)
    setIsSystemEmpty(false)
    setStep('login')
    setEmail(setupEmail)
  }

  // ── shared styles
  const cardStyle: React.CSSProperties = { padding:'36px', borderRadius:22, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', backdropFilter:'blur(20px)', boxShadow:'0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)' }
  const baseInputStyle: React.CSSProperties = { width:'100%', padding:'13px 14px 13px 42px', borderRadius:12, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', fontSize:14, outline:'none', transition:'all 0.2s', fontFamily:"'Inter',sans-serif" }
  const btnBase = (disabled: boolean): React.CSSProperties => ({
    position:'relative', padding:'15px', borderRadius:14, width:'100%',
    background: disabled ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)',
    border:'none', color:'#fff', fontSize:15, fontWeight:700,
    cursor: disabled ? 'not-allowed' : 'pointer', overflow:'hidden', letterSpacing:'0.02em',
    fontFamily:"'Outfit',sans-serif", transition:'all 0.25s',
    boxShadow: disabled ? 'none' : '0 8px 26px rgba(59,130,246,0.4)',
  })
  const focusOn  = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor='rgba(59,130,246,0.6)'; e.target.style.boxShadow='0 0 0 3px rgba(59,130,246,0.12)'; e.target.style.background='rgba(59,130,246,0.04)' }
  const focusOff = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor='rgba(255,255,255,0.1)'; e.target.style.boxShadow='none'; e.target.style.background='rgba(255,255,255,0.04)' }
  const Spinner = () => <div style={{ width:18, height:18, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.2)', borderTopColor:'#fff', animation:'spin 0.8s linear infinite', display:'inline-block' }} />
  const ErrorBox = ({ msg }: { msg: string }) => msg ? <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', fontSize:13, color:'#f87171', display:'flex', alignItems:'center', gap:8 }}>⚠ {msg}</div> : null
  const ShimmerOverlay = () => <div style={{ position:'absolute', inset:0, background:'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)', backgroundSize:'200% 100%', animation:'shimmerBtn 2.5s ease-in-out infinite' }} />
  const Label = ({ text }: { text: string }) => <label style={{ display:'block', fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.45)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:8 }}>{text}</label>

  // ────────────────────────────────────────────────────────────────
  // LEFT PANEL
  // ────────────────────────────────────────────────────────────────
  const LeftPanel = (
    <div className="login-left-panel" style={{ flex:'0 0 52%', position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', justifyContent:'space-between', padding:'48px 56px', background:'linear-gradient(145deg, #050a18 0%, #0a0f2e 30%, #0d1a3a 60%, #060d24 100%)' }}>
      {/* Glows */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
        <div style={{ position:'absolute', top:'-10%', left:'20%', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)', transform:`translate(${orbitX*.4}px,${orbitY*.4}px)`, transition:'transform 0.8s ease-out' }} />
        <div style={{ position:'absolute', bottom:'0%', right:'-10%', width:440, height:440, borderRadius:'50%', background:'radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)', transform:`translate(${orbitX*-.3}px,${orbitY*-.3}px)`, transition:'transform 0.8s ease-out' }} />
        <div style={{ position:'absolute', inset:0, opacity:0.04, backgroundImage:'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize:'48px 48px' }} />
        {[{ t:'15%',r:'18%',s:6,c:'#60a5fa',a:'floatOrb1 6s'},{t:'35%',r:'8%',s:4,c:'#a78bfa',a:'floatOrb2 8s'},{b:'25%',r:'22%',s:5,c:'#34d399',a:'floatOrb3 7s'},{t:'60%',l:'12%',s:3,c:'#f59e0b',a:'floatOrb1 9s reverse'},{t:'80%',r:'35%',s:4,c:'#ec4899',a:'floatOrb2 5s'}].map((o:{t?:string;r?:string;b?:string;l?:string;s:number;c:string;a:string},i)=>(
          <div key={i} style={{ position:'absolute', top:o.t, right:o.r, bottom:o.b, left:o.l, width:o.s, height:o.s, borderRadius:'50%', background:o.c, boxShadow:`0 0 ${o.s*2}px ${o.c}`, animation:`${o.a} ease-in-out infinite` }} />
        ))}
        <div style={{ position:'absolute', bottom:'-80px', right:'-80px', width:420, height:420, borderRadius:'50%', border:'1px solid rgba(59,130,246,0.08)', transform:`translate(${orbitX*.15}px,${orbitY*.15}px)`, transition:'transform 1.2s ease-out' }} />
      </div>

      {/* Logo */}
      <div style={{ position:'relative', zIndex:2 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:46, height:46, borderRadius:14, background:'linear-gradient(135deg, #3b82f6, #8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, boxShadow:'0 8px 24px rgba(59,130,246,0.4)' }}>⚡</div>
          <div>
            <div style={{ fontFamily:"'Outfit',sans-serif", fontSize:20, fontWeight:900, color:'#fff', letterSpacing:'-0.02em' }}>IMPACTO <span style={{ background:'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>EDU</span></div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase' }}>Enterprise Learning Suite</div>
          </div>
        </div>
      </div>

      {/* Headline + features */}
      <div className="login-headline-wrapper" style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'center', paddingTop:40, paddingBottom:40 }}>
        <div className="login-tag" style={{ fontSize:11, fontWeight:700, letterSpacing:'0.14em', color:'#60a5fa', textTransform:'uppercase', marginBottom:20, display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:20, height:1.5, background:'#60a5fa', borderRadius:2 }} /> Plataforma #1 em Gestão Escolar
        </div>
        <h1 className="login-title" style={{ fontFamily:"'Outfit',sans-serif", fontSize:46, fontWeight:900, lineHeight:1.08, color:'#fff', letterSpacing:'-0.03em', marginBottom:24, minHeight:108 }}>
          {typedText}<span style={{ display:'inline-block', width:3, height:'0.85em', background:'#60a5fa', marginLeft:3, verticalAlign:'middle', animation:'blink 1s step-end infinite', borderRadius:1 }} />
        </h1>
        <p className="login-subtitle" style={{ fontSize:16, color:'rgba(255,255,255,0.45)', lineHeight:1.7, marginBottom:40, maxWidth:380 }}>Unificamos acadêmico, financeiro, RH, CRM e IA em uma única plataforma enterprise-grade.</p>
        <div className="hide-on-mobile" style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {FEATURES.map((f, i) => (
            <div key={f.label} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 18px', borderRadius:14, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', backdropFilter:'blur(8px)', animation:`fadeSlideIn 0.5s ease-out ${i*.1}s both`, transition:'all 0.2s', cursor:'default' }}
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(59,130,246,0.08)';e.currentTarget.style.borderColor='rgba(59,130,246,0.2)'}}
              onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.03)';e.currentTarget.style.borderColor='rgba(255,255,255,0.06)'}}>
              <div style={{ width:36, height:36, borderRadius:10, background:'rgba(59,130,246,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{f.icon}</div>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.85)' }}>{f.label}</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:1 }}>{f.desc}</div>
              </div>
              <div style={{ marginLeft:'auto', width:6, height:6, borderRadius:'50%', background:'#10b981', boxShadow:'0 0 6px #10b981' }} />
            </div>
          ))}
        </div>
      </div>

      {/* Testimonial + stats */}
      <div className="hide-on-mobile" style={{ position:'relative', zIndex:2 }}>
        <div style={{ padding:'20px 22px', borderRadius:16, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', backdropFilter:'blur(8px)', minHeight:96 }}>
          <div style={{ fontSize:13, color:'rgba(255,255,255,0.6)', lineHeight:1.6, marginBottom:12, fontStyle:'italic' }}>{TESTIMONIALS[testimonialIdx].text}</div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color:'#fff' }}>{TESTIMONIALS[testimonialIdx].author[0]}</div>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.7)' }}>{TESTIMONIALS[testimonialIdx].author}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)' }}>{TESTIMONIALS[testimonialIdx].school}</div>
            </div>
            <div style={{ marginLeft:'auto', display:'flex', gap:5 }}>
              {TESTIMONIALS.map((_,i)=><div key={i} style={{ width:i===testimonialIdx?16:5, height:5, borderRadius:3, background:i===testimonialIdx?'#60a5fa':'rgba(255,255,255,0.15)', transition:'all 0.4s' }} />)}
            </div>
          </div>
        </div>
        <div style={{ display:'flex', marginTop:20, borderRadius:12, overflow:'hidden', border:'1px solid rgba(255,255,255,0.06)' }}>
          {[{v:'2.400+',l:'Instituições'},{v:'98%',l:'Satisfação'},{v:'R$2bi+',l:'Gerenciados'}].map((s,i)=>(
            <div key={s.l} style={{ flex:1, textAlign:'center', padding:'14px 8px', background:'rgba(255,255,255,0.02)', borderRight:i<2?'1px solid rgba(255,255,255,0.06)':'none' }}>
              <div style={{ fontFamily:"'Outfit',sans-serif", fontSize:18, fontWeight:900, color:'#fff' }}>{s.v}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', marginTop:2, fontWeight:600 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  // ────────────────────────────────────────────────────────────────
  // STEP: Login
  // ────────────────────────────────────────────────────────────────
  const LoginContent = (
    <div className="login-form-wrapper" style={{ width:'100%', maxWidth:420, position:'relative', zIndex:1 }}>
      <div className="login-header-group" style={{ marginBottom:36 }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'5px 14px', borderRadius:100, background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.2)', marginBottom:20 }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:'#10b981', boxShadow:'0 0 6px #10b981', animation:'blink 2s ease-in-out infinite' }} />
          <span style={{ fontSize:11, fontWeight:700, color:'#60a5fa', letterSpacing:'0.06em' }}>ACESSO SEGURO — 256-bit SSL</span>
        </div>
        <h2 className="login-h2" style={{ fontFamily:"'Outfit',sans-serif", fontSize:32, fontWeight:900, color:'#fff', letterSpacing:'-0.02em', marginBottom:8 }}>Bem-vindo de volta</h2>
        <p className="login-p" style={{ fontSize:14, color:'rgba(255,255,255,0.35)' }}>Entre com suas credenciais para acessar a plataforma.</p>
      </div>

      <div className="login-card" style={cardStyle}>
        <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:20 }}>
          <div>
            <Label text="E-mail Institucional ou Login (Celular/CPF)" />
            <div style={{ position:'relative' }} suppressHydrationWarning>
              <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:15, opacity:0.4, pointerEvents:'none' }}>👤</span>
              <input type="text" value={email} onChange={e=>{setEmail(e.target.value);setLoginError('')}} placeholder="E-mail ou CPF/Código do Aluno" autoComplete="username"
                suppressHydrationWarning
                style={{ ...baseInputStyle, borderColor: loginError&&!email?'rgba(239,68,68,0.5)':'rgba(255,255,255,0.1)' }} onFocus={focusOn} onBlur={focusOff} />
            </div>
          </div>
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <Label text="Senha" />
              <button type="button" style={{ fontSize:11, color:'#60a5fa', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>Esqueci minha senha</button>
            </div>
            <div style={{ position:'relative' }} suppressHydrationWarning>
              <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:15, opacity:0.4, pointerEvents:'none' }}>🔒</span>
              <input type={showPw?'text':'password'} value={password} onChange={e=>{setPassword(e.target.value);setLoginError('')}} placeholder="••••••••••" autoComplete="current-password"
                suppressHydrationWarning
                style={{ ...baseInputStyle, paddingRight:44, borderColor: loginError&&!password?'rgba(239,68,68,0.5)':'rgba(255,255,255,0.1)' }} onFocus={focusOn} onBlur={focusOff} />
              <button type="button" onClick={()=>setShowPw(p=>!p)} style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:14, opacity:0.5, color:'#fff' }}>{showPw?'🙈':'👁'}</button>
            </div>
          </div>
          <ErrorBox msg={loginError} />
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <input type="checkbox" id="remember" defaultChecked style={{ width:16, height:16, accentColor:'#3b82f6', cursor:'pointer' }} />
            <label htmlFor="remember" style={{ fontSize:13, color:'rgba(255,255,255,0.4)', cursor:'pointer' }}>Manter conectado por 30 dias</label>
          </div>
          <button type="submit" disabled={loginLoading} style={btnBase(loginLoading)}
            onMouseEnter={e=>{if(!loginLoading){e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 16px 40px rgba(59,130,246,0.5)'}}}
            onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='0 8px 26px rgba(59,130,246,0.4)'}}>
            {!loginLoading && <ShimmerOverlay />}
            <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
              {loginLoading ? <><Spinner /><span>Autenticando...</span></> : <><span>Entrar na Plataforma</span><span style={{ fontSize:18 }}>→</span></>}
            </div>
          </button>
        </form>

        {/* Separador + Primeiro Acesso */}
        <div style={{ marginTop:22 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
            <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.06)' }} />
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.2)', fontWeight:600 }}>OU</span>
            <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.06)' }} />
          </div>
          <button type="button" onClick={()=>setStep('first_access_verify')}
            style={{ width:'100%', padding:'14px', borderRadius:14, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.7)', fontSize:14, fontWeight:700, cursor:'pointer', transition:'all 0.25s', fontFamily:"'Outfit',sans-serif" }}
            onMouseEnter={e=>{e.currentTarget.style.background='rgba(139,92,246,0.1)';e.currentTarget.style.borderColor='rgba(139,92,246,0.4)';e.currentTarget.style.color='#c4b5fd';e.currentTarget.style.transform='translateY(-1px)'}}
            onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.02)';e.currentTarget.style.borderColor='rgba(255,255,255,0.1)';e.currentTarget.style.color='rgba(255,255,255,0.7)';e.currentTarget.style.transform=''}}>
            <span style={{ marginRight:8 }}>🔑</span>Primeiro Acesso (Alunos/Pais)
          </button>

          {isSystemEmpty && (
            <button type="button" onClick={()=>setStep('setup_master')}
              style={{ width:'100%', marginTop:12, padding:'14px', borderRadius:14, background:'rgba(16,185,129,0.05)', border:'1px solid rgba(16,185,129,0.2)', color:'#34d399', fontSize:13, fontWeight:800, cursor:'pointer', transition:'all 0.25s', textTransform:'uppercase', letterSpacing:'0.03em' }}
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(16,185,129,0.15)';e.currentTarget.style.transform='translateY(-1px)'}}
              onMouseLeave={e=>{e.currentTarget.style.background='rgba(16,185,129,0.05)';e.currentTarget.style.transform=''}}>
              ⚙️ Configurar Administrador Master
            </button>
          )}
        </div>
      </div>
      <div style={{ marginTop:28, textAlign:'center' }}>
        <p style={{ fontSize:11, color:'rgba(255,255,255,0.13)' }}>IMPACTO EDU v3.2.0 • © 2026 Todos os direitos reservados</p>
      </div>
    </div>
  )

  // ────────────────────────────────────────────────────────────────
  // STEP: Primeiro Acesso — Verificação
  // ────────────────────────────────────────────────────────────────
  const FirstAccessVerify = (
    <div className="login-form-wrapper" style={{ width:'100%', maxWidth:420, position:'relative', zIndex:1, animation:'fadeSlideIn 0.35s ease-out both' }}>
      <button type="button" onClick={goLogin} style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:13, color:'rgba(255,255,255,0.4)', background:'none', border:'none', cursor:'pointer', marginBottom:32, fontWeight:600, transition:'color 0.2s' }}
        onMouseEnter={e=>(e.currentTarget.style.color='rgba(255,255,255,0.75)')} onMouseLeave={e=>(e.currentTarget.style.color='rgba(255,255,255,0.4)')}>← Voltar ao login</button>
      <div style={{ marginBottom:32 }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'5px 14px', borderRadius:100, background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.25)', marginBottom:20 }}>
          <span>🔑</span><span style={{ fontSize:11, fontWeight:700, color:'#a78bfa', letterSpacing:'0.06em' }}>PRIMEIRO ACESSO</span>
        </div>
        <h2 style={{ fontFamily:"'Outfit',sans-serif", fontSize:30, fontWeight:900, color:'#fff', letterSpacing:'-0.02em', marginBottom:8 }}>Identificação</h2>
        <p style={{ fontSize:14, color:'rgba(255,255,255,0.35)', lineHeight:1.6 }}>Informe o <strong style={{ color:'rgba(255,255,255,0.6)' }}>e-mail institucional</strong> cadastrado no sistema para verificar seu acesso.</p>
      </div>
      <div className="login-card" style={cardStyle}>
        <form onSubmit={handleVerify} style={{ display:'flex', flexDirection:'column', gap:20 }}>
          <div>
            <Label text="E-mail Institucional, Celular ou Código" />
            <div style={{ position:'relative' }} suppressHydrationWarning>
              <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:15, opacity:0.4, pointerEvents:'none' }}>👤</span>
              <input type="text" value={faQuery} onChange={e=>{setFaQuery(e.target.value);setFaError('')}} placeholder="E-mail, CPF, ou Código do Aluno" autoFocus suppressHydrationWarning
                style={baseInputStyle} onFocus={focusOn} onBlur={focusOff} />
            </div>
            <p style={{ fontSize:11, color:'rgba(255,255,255,0.2)', marginTop:8 }}>Use o e-mail ou código/login vinculado ao seu cadastro escolar.</p>
          </div>
          <ErrorBox msg={faError} />
          <button type="submit" disabled={faLoading||!faQuery.trim()} style={btnBase(faLoading||!faQuery.trim())}
            onMouseEnter={e=>{if(!faLoading){e.currentTarget.style.transform='translateY(-2px)'}}}
            onMouseLeave={e=>{e.currentTarget.style.transform=''}}>
            {!(faLoading||!faQuery.trim()) && <ShimmerOverlay />}
            <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
              {faLoading ? <><Spinner /><span>Verificando...</span></> : <><span>Verificar Cadastro</span><span>→</span></>}
            </div>
          </button>
        </form>
        {/* Hint para admin */}
        <div style={{ marginTop:20, padding:'12px 16px', borderRadius:12, background:'rgba(59,130,246,0.05)', border:'1px solid rgba(59,130,246,0.15)' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'rgba(59,130,246,0.7)', marginBottom:4, letterSpacing:'0.06em' }}>ℹ PRIMEIRO ACESSO</div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,0.3)' }}>
            Este fluxo é destinado a alunos e responsáveis para criação da primeira senha no app.
          </div>
        </div>
      </div>
      <div style={{ marginTop:24, textAlign:'center' }}>
        <p style={{ fontSize:12, color:'rgba(255,255,255,0.2)' }}>Não encontrou seu cadastro? <button type="button" style={{ background:'none', border:'none', color:'rgba(100,160,255,0.6)', cursor:'pointer', fontSize:12, fontWeight:600 }}>Fale com a secretaria</button></p>
      </div>
    </div>
  )

  // ────────────────────────────────────────────────────────────────
  // STEP: Primeiro Acesso — Criar Senha
  // ────────────────────────────────────────────────────────────────
  const FirstAccessCreate = (
    <div className="login-form-wrapper" style={{ width:'100%', maxWidth:440, position:'relative', zIndex:1, animation:'fadeSlideIn 0.35s ease-out both' }}>
      <button type="button" onClick={()=>setStep('first_access_verify')} style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:13, color:'rgba(255,255,255,0.4)', background:'none', border:'none', cursor:'pointer', marginBottom:32, fontWeight:600 }}
        onMouseEnter={e=>(e.currentTarget.style.color='rgba(255,255,255,0.75)')} onMouseLeave={e=>(e.currentTarget.style.color='rgba(255,255,255,0.4)')}>← Alterar e-mail</button>
      <div style={{ marginBottom:28 }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'5px 14px', borderRadius:100, background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.25)', marginBottom:20 }}>
          <span>✅</span><span style={{ fontSize:11, fontWeight:700, color:'#34d399', letterSpacing:'0.06em' }}>CADASTRO ENCONTRADO</span>
        </div>
        {/* Usuário encontrado */}
        <div style={{ display:'flex', alignItems:'center', gap:14, padding:'16px 18px', borderRadius:14, background:'rgba(16,185,129,0.05)', border:'1px solid rgba(16,185,129,0.15)', marginBottom:20 }}>
          <div style={{ width:44, height:44, borderRadius:13, background:'linear-gradient(135deg,#10b981,#059669)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:900, color:'#fff', flexShrink:0 }}>{faUser?.nome[0]}</div>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:'#fff' }}>{faUser?.nome}</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>{faUser?.cargo} • {faUser?.email}</div>
          </div>
          <span style={{ marginLeft:'auto', fontSize:20 }}>👍</span>
        </div>
        <h2 style={{ fontFamily:"'Outfit',sans-serif", fontSize:28, fontWeight:900, color:'#fff', marginBottom:6 }}>Crie sua senha</h2>
        <p style={{ fontSize:14, color:'rgba(255,255,255,0.35)' }}>Defina uma senha segura para acessar a plataforma.</p>
      </div>

      <div className="login-card" style={cardStyle}>
        {createSuccess ? (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{ fontSize:52, marginBottom:16 }}>🎉</div>
            <div style={{ fontFamily:"'Outfit',sans-serif", fontSize:22, fontWeight:900, color:'#fff', marginBottom:8 }}>Senha criada com sucesso!</div>
            <p style={{ fontSize:14, color:'rgba(255,255,255,0.4)' }}>Redirecionando para o login...</p>
            <div style={{ marginTop:20, height:3, borderRadius:2, background:'rgba(255,255,255,0.1)', overflow:'hidden' }}>
              <div style={{ height:'100%', borderRadius:2, background:'linear-gradient(90deg,#10b981,#3b82f6)', width:'100%', animation:'progressFill 2.2s linear forwards' }} />
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreate} style={{ display:'flex', flexDirection:'column', gap:18 }}>
            {/* E-mail de Registro */}
            <div>
              <Label text="E-mail de Cadastro" />
              <div style={{ position:'relative' }} suppressHydrationWarning>
                <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:15, opacity:0.4, pointerEvents:'none' }}>✉</span>
                <input type="email" value={faRegEmail} onChange={e=>{setFaRegEmail(e.target.value);setCreateError('')}} placeholder="Preencha seu e-mail principal" required suppressHydrationWarning
                  style={{ ...baseInputStyle }} onFocus={focusOn} onBlur={focusOff} />
              </div>
            </div>
            {/* Nova senha */}
            <div>
              <Label text="Nova Senha" />
              <div style={{ position:'relative' }} suppressHydrationWarning>
                <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:15, opacity:0.4, pointerEvents:'none' }}>🔒</span>
                <input type={showNewPw?'text':'password'} value={newPass} onChange={e=>{setNewPass(e.target.value);setCreateError('')}} placeholder="Mínimo 6 caracteres" suppressHydrationWarning
                  style={{ ...baseInputStyle, paddingRight:44 }} onFocus={focusOn} onBlur={focusOff} />
                <button type="button" onClick={()=>setShowNewPw(p=>!p)} style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:14, opacity:0.5, color:'#fff' }}>{showNewPw?'🙈':'👁'}</button>
              </div>
              {newPass.length > 0 && (
                <div style={{ marginTop:8 }}>
                  <div style={{ height:4, borderRadius:2, background:'rgba(255,255,255,0.08)', overflow:'hidden' }}>
                    <div style={{ height:'100%', borderRadius:2, background:strength.color, width:`${strength.pct}%`, transition:'all 0.4s' }} />
                  </div>
                  <div style={{ fontSize:11, color:strength.color, fontWeight:700, marginTop:4 }}>{strength.label}</div>
                </div>
              )}
            </div>
            {/* Confirmar */}
            <div>
              <Label text="Confirmar Senha" />
              <div style={{ position:'relative' }} suppressHydrationWarning>
                <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:15, opacity:0.4, pointerEvents:'none' }}>🔒</span>
                <input type={showConfPw?'text':'password'} value={confirmPass} onChange={e=>{setConfirmPass(e.target.value);setCreateError('')}} placeholder="Repita a senha" suppressHydrationWarning
                  style={{ ...baseInputStyle, paddingRight:44, borderColor: confirmPass&&confirmPass!==newPass?'rgba(239,68,68,0.5)':'rgba(255,255,255,0.1)' }} onFocus={focusOn} onBlur={focusOff} />
                <button type="button" onClick={()=>setShowConfPw(p=>!p)} style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:14, opacity:0.5, color:'#fff' }}>{showConfPw?'🙈':'👁'}</button>
              </div>
              {confirmPass && (
                <div style={{ fontSize:11, marginTop:5, color: confirmPass===newPass?'#34d399':'#f87171' }}>
                  {confirmPass===newPass ? '✓ Senhas coincidem' : '⚠ Senhas não coincidem'}
                </div>
              )}
            </div>
            {/* Requisitos */}
            <div style={{ padding:'12px 14px', borderRadius:10, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.3)', letterSpacing:'0.08em', marginBottom:8 }}>REQUISITOS</div>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {[
                  { label:'Mínimo 6 caracteres', ok: newPass.length>=6 },
                ].map(r => (
                  <div key={r.label} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12 }}>
                    <span style={{ color: !newPass.length?'rgba(255,255,255,0.2)':r.ok?'#10b981':'#ef4444' }}>{!newPass.length?'○':r.ok?'✓':'✗'}</span>
                    <span style={{ color: !newPass.length?'rgba(255,255,255,0.25)':r.ok?'rgba(255,255,255,0.6)':'rgba(255,255,255,0.35)' }}>{r.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <ErrorBox msg={createError} />
            <button type="submit" disabled={createLoading||newPass.length<6||newPass!==confirmPass||!faRegEmail} style={btnBase(createLoading||newPass.length<6||newPass!==confirmPass||!faRegEmail)}
              onMouseEnter={e=>{if(!createLoading){e.currentTarget.style.transform='translateY(-2px)'}}}
              onMouseLeave={e=>{e.currentTarget.style.transform=''}}>
              {!(createLoading||newPass.length<6||newPass!==confirmPass||!faRegEmail) && <ShimmerOverlay />}
              <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
                {createLoading ? <><Spinner /><span>Criando acesso...</span></> : <><span>🚀 Criar Minha Senha</span></>}
              </div>
            </button>
          </form>
        )}
      </div>
    </div>
  )

  // ────────────────────────────────────────────────────────────────
  // STEP: Configuração Master Inicial
  // ────────────────────────────────────────────────────────────────
  const SetupMasterContent = (
    <div className="login-form-wrapper" style={{ width:'100%', maxWidth:420, position:'relative', zIndex:1, animation:'fadeSlideIn 0.35s ease-out both' }}>
      <button type="button" onClick={goLogin} style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:13, color:'rgba(255,255,255,0.4)', background:'none', border:'none', cursor:'pointer', marginBottom:32, fontWeight:600 }}>← Cancelar setup</button>
      <div style={{ marginBottom:32 }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'5px 14px', borderRadius:100, background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.25)', marginBottom:20 }}>
          <span style={{ fontSize:10, fontWeight:900, color:'#34d399' }}>SETUP INICIAL</span>
        </div>
        <h2 style={{ fontFamily:"'Outfit',sans-serif", fontSize:30, fontWeight:900, color:'#fff', letterSpacing:'-0.02em', marginBottom:8 }}>Configurar Master</h2>
        <p style={{ fontSize:14, color:'rgba(255,255,255,0.35)', lineHeight:1.6 }}>Crie a primeira conta de Administrador Geral para assumir o controle total do sistema.</p>
      </div>
      <div className="login-card" style={cardStyle}>
        <form onSubmit={handleSetupMaster} style={{ display:'flex', flexDirection:'column', gap:18 }}>
          <div suppressHydrationWarning>
            <Label text="Nome Completo do Administrador" />
            <input type="text" value={setupNome} onChange={e=>setSetupNome(e.target.value)} placeholder="Ex: Administrador Impacto" required suppressHydrationWarning style={baseInputStyle} onFocus={focusOn} onBlur={focusOff} />
          </div>
          <div suppressHydrationWarning>
            <Label text="E-mail de Login Interno" />
            <input type="email" value={setupEmail} onChange={e=>setSetupEmail(e.target.value)} placeholder="admin@escola.com.br" required suppressHydrationWarning style={baseInputStyle} onFocus={focusOn} onBlur={focusOff} />
          </div>
          <div suppressHydrationWarning>
            <Label text="Definir Senha Mestra" />
            <input type="password" value={setupPass} onChange={e=>setSetupPass(e.target.value)} placeholder="••••••••" required suppressHydrationWarning style={baseInputStyle} onFocus={focusOn} onBlur={focusOff} />
          </div>
          <button type="submit" disabled={setupLoading||!setupNome||!setupEmail||setupPass.length<6} style={btnBase(setupLoading||!setupNome||!setupEmail||setupPass.length<6)}
            onMouseEnter={e=>{if(!setupLoading){e.currentTarget.style.transform='translateY(-2px)'}}}
            onMouseLeave={e=>{e.currentTarget.style.transform=''}}>
            <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
              {setupLoading ? <><Spinner /><span>Configurando...</span></> : <span>Finalizar Configuração</span>}
            </div>
          </button>
        </form>
      </div>
    </div>
  )

  // ────────────────────────────────────────────────────────────────
  return (
    <div className="login-wrapper" style={{ display:'flex', minHeight:'100vh', fontFamily:"'Inter',sans-serif", overflow:'hidden' }}>
      {LeftPanel}
      <div className="login-right-panel" style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'48px 40px', background:'linear-gradient(160deg,#08101e 0%,#090d1f 50%,#0a0e1c 100%)', position:'relative', overflow:'hidden', overflowY:'auto' }}>
        <div style={{ position:'absolute', top:'20%', right:'10%', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle,rgba(139,92,246,0.06) 0%,transparent 70%)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:'15%', left:'5%', width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(59,130,246,0.05) 0%,transparent 70%)', pointerEvents:'none' }} />
        {mounted && step === 'login'                && LoginContent}
        {mounted && step === 'first_access_verify'  && FirstAccessVerify}
        {mounted && step === 'first_access_create'  && FirstAccessCreate}
        {mounted && step === 'setup_master'         && SetupMasterContent}
        <div style={{ position:'absolute', bottom:24, right:32, display:'flex', alignItems:'center', gap:8, padding:'6px 14px', borderRadius:100, background:'rgba(16,185,129,0.07)', border:'1px solid rgba(16,185,129,0.15)' }}>
          <div style={{ width:5, height:5, borderRadius:'50%', background:'#10b981', boxShadow:'0 0 6px #10b981' }} />
          <span style={{ fontSize:10, color:'rgba(16,185,129,0.7)', fontWeight:700, letterSpacing:'0.06em' }}>SISTEMA SEGURO</span>
        </div>
      </div>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes spin  { to{transform:rotate(360deg)} }
        @keyframes floatOrb1 { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-18px) scale(1.15)} }
        @keyframes floatOrb2 { 0%,100%{transform:translateY(0) translateX(0)} 33%{transform:translateY(-12px) translateX(8px)} 66%{transform:translateY(6px) translateX(-5px)} }
        @keyframes floatOrb3 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(14px)} }
        @keyframes fadeSlideIn { from{opacity:0;transform:translateX(-16px)} to{opacity:1;transform:translateX(0)} }
        @keyframes shimmerBtn { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes progressFill { from{width:0%} to{width:100%} }
        input::placeholder { color:rgba(255,255,255,0.2) !important; }
        input:-webkit-autofill { -webkit-box-shadow:0 0 0 30px #0d1a3a inset !important; -webkit-text-fill-color:#fff !important; }
        
        /* Mobile Optimizaton for Login */
        @media (max-width: 768px) {
          .login-wrapper {
            flex-direction: column !important;
            overflow-y: auto !important;
          }
          .login-left-panel {
            padding: 32px 24px !important;
            flex: none !important;
          }
          .login-right-panel {
            padding: 24px 20px 48px 20px !important;
            justify-content: flex-start !important;
          }
          .hide-on-mobile {
            display: none !important;
          }
          .login-headline-wrapper {
            padding-top: 24px !important;
            padding-bottom: 0px !important;
          }
          .login-title {
            font-size: 32px !important;
            min-height: auto !important;
            margin-bottom: 12px !important;
          }
          .login-subtitle {
            font-size: 14px !important;
            margin-bottom: 0px !important;
          }
          .login-header-group {
            margin-bottom: 24px !important;
          }
          .login-h2 {
            font-size: 26px !important;
          }
          .login-card {
            padding: 24px 20px !important;
            border-radius: 16px !important;
          }
        }
      `}</style>
    </div>
  )
}
