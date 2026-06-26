'use client'

import { useState, useEffect, memo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useApp } from '@/lib/context'
import { DEFAULT_PERFIS } from '@/lib/dataContext'

type Step = 'login' | 'first_access_verify' | 'first_access_create' | 'setup_master' | 'choose_system' | 'choose_agenda_role'

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
type FoundUser  = { id: string; nome: string; email: string; cargo: string; perfil: string; userType?: string; matricula?: string; realId?: string }

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

import { BackgroundEffects } from '@/components/ui/LoginBackground'

export default function LoginPage() {
  const router = useRouter()
  const { setCurrentUser } = useApp()
  const [showBlockModal, setShowBlockModal] = useState(false)

  // ── step manager
  const [step, setStep] = useState<Step>('login')
  const [pendingAuth, setPendingAuth] = useState<any>(null)
  const [hasDualRole, setHasDualRole] = useState(false)
  const [profileData, setProfileData] = useState<any>(null)
  const [isProfileLoading, setIsProfileLoading] = useState(false)

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
  const headline = 'Bem-vindo de volta!'

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
  const [setupNome, setSetupNome]   = useState('Administrador do Sistema')
  const [setupEmail, setSetupEmail] = useState('direcao@colegioimpacto.net')
  const [setupPass, setSetupPass]   = useState('')
  const [setupLoading, setSetupLoading] = useState(false)
  const [mounted, setMounted]       = useState(false)

  useEffect(() => {
    setMounted(true)
    // Otimização: verifica se o sistema está vazio apenas 1 vez por navegador
    const systemChecked = localStorage.getItem('edu-master-checked')
    if (!systemChecked) {
      fetch('/api/configuracoes/usuarios?checkMaster=true', { cache: 'no-store' })
        .then(r => {
          if (!r.ok) throw new Error('API não retornou 200 OK')
          return r.json()
        })
        .then(data => {
          setIsSystemEmpty(data.masterExists === false)
          if (data.masterExists === true) {
            localStorage.setItem('edu-master-checked', 'true')
          }
        })
        .catch(() => {
          setIsSystemEmpty(false)
        })
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const stepParam = params.get('step') as Step
      
      if (stepParam === 'choose_agenda_role' || stepParam === 'choose_system') {
        const storedUser = localStorage.getItem('edu-current-user')
        if (storedUser) {
          try {
            const user = JSON.parse(storedUser)
            const isAlsoFamily = !!user.responsavel_id || !!user.hasDualRole;
            
            setPendingAuth({
              cargo: user.cargo,
              perfil: user.perfil
            })
            setHasDualRole(isAlsoFamily)
            setStep(stepParam)
          } catch (e) {
            console.error("Error restoring user for step:", e)
          }
        }
      }
    }
  }, [])

  useEffect(() => {
    if (step === 'choose_system' && pendingAuth?.perfil) {
      setIsProfileLoading(true)
      fetch('/api/configuracoes/perfis')
        .then(res => res.json())
        .then(data => {
          let perfisList = DEFAULT_PERFIS
          if (Array.isArray(data) && data.length > 0) {
             perfisList = data
          }
          // Caso não ache, garante um objeto vazio para pelo menos exibir os acessos padrão (liberados)
          const pData = perfisList.find(x => x.nome === pendingAuth.perfil) || {}
          setProfileData(pData)
          
          // Auto-redirect se só houver 1 módulo liberado
          const hasERP = !pData.bloqueadoGestaoEscolar
          const hasAgenda = !pData.bloqueadoAgendaDigital
          const hasGestaoPessoas = !pData.bloqueadoGestaoPessoas
          const hasSimulados = !pData.bloqueadoSimulados
          
          const arr = [
            hasERP ? 'erp' : null,
            hasAgenda ? 'agenda' : null,
            hasGestaoPessoas ? 'pessoas' : null,
            hasSimulados ? 'simulados' : null
          ].filter(Boolean)
          
          if (arr.length === 1) {
             if (arr[0] === 'erp') window.location.href = pendingAuth.perfil === 'Professor' ? '/professor' : '/dashboard';
             else if (arr[0] === 'agenda') {
                if (pendingAuth.perfil === 'Diretor Geral' || pendingAuth.cargo === 'Administrador Master') window.location.href = '/agenda-digital/selecionar-perfil-admin';
                else window.location.href = '/agenda-digital/selecionar-aluno';
             }
             else if (arr[0] === 'pessoas') window.location.href = '/gestao-pessoas';
             else if (arr[0] === 'simulados') window.location.href = '/simulados';
          } else {
             setIsProfileLoading(false)
          }
        })
        .catch(err => {
          console.error('Erro ao buscar perfis:', err)
          setProfileData({})
          setIsProfileLoading(false)
        })
    }
  }, [step, pendingAuth])



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
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Credenciais inválidas.')
      }

      const authData = await res.json()
      
      // Update local context with enriched profile from system_users
      const meta = authData.user?.user_metadata || {}
      const nomeReal = meta.nome || email.split('@')[0]
      const cargoReal = meta.cargo || 'Colaborador'
      const perfilReal = meta.perfil || 'Usuário'

      const userObj = { 
        id: authData.user.id, 
        nome: nomeReal, 
        email: email, 
        cargo: cargoReal, 
        perfil: perfilReal,
        foto: meta.foto || undefined,
        aluno_id: meta.aluno_id || '',
        responsavel_id: meta.responsavel_id || ''
      }
      setCurrentUser(userObj)
      
      // FIX: Force synchronous localStorage write to avoid React batching race condition before navigation
      try {
        localStorage.setItem('edu-current-user', JSON.stringify(userObj))
        localStorage.setItem('edu-current-perfil', JSON.stringify(perfilReal))
      } catch (e) {}

      if (cargoReal === 'Aluno') {
        if (meta.aluno_id) {
          router.push(`/agenda-digital/${meta.aluno_id}/comunicados`)
        } else {
          router.push('/agenda-digital')
        }
      } else if (perfilReal === 'Família' || cargoReal === 'Responsável') {
        router.push('/agenda-digital/selecionar-aluno')
      } else {
        // É um colaborador (Professor, Diretor, Coordenador, Financeiro, Secretaria, etc)
        // Verificação de papel duplo feita no backend de forma performática
        const isAlsoFamily = !!meta.responsavel_id || !!authData.user?.hasDualRole;
        
        setPendingAuth({
           cargo: cargoReal,
           perfil: perfilReal
        })
        setHasDualRole(isAlsoFamily)
        setHasDualRole(isAlsoFamily)

        const isApp = typeof window !== 'undefined' && !!(window as any).Capacitor;
        if (isApp) {
          if (perfilReal === 'Diretor Geral' || cargoReal === 'Administrador Master') {
            router.push('/agenda-digital/selecionar-perfil-admin');
          } else {
            router.push('/agenda-digital/selecionar-aluno');
          }
        } else {
          setStep('choose_system')
        }
        
        setLoginLoading(false)
        return;
      }
    } catch (err: any) {
      setLoginLoading(false)
      setLoginError(err.message || 'Credenciais inválidas.')
      console.log('Login falhou:', err.message)
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!faQuery.trim()) { setFaError('Informe seu e-mail ou código.'); return }
    setFaLoading(true); setFaError('')
    await new Promise(r => setTimeout(r, 900))
    const q = faQuery.trim().toLowerCase()
    
    try {
      const res = await fetch('/api/auth/verify-first-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Nenhum cadastro encontrado. Verifique com a administração.')
      }

      const { user } = await res.json()
      setFaUser(user); setStep('first_access_create'); setFaRegEmail(user.email || '') 
    } catch (err: any) {
      setFaError(err.message)
    } finally {
      setFaLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!faRegEmail.trim()) { setCreateError('Informe seu e-mail para continuar.'); return }
    if (newPass.length < 6) { setCreateError('Mínimo 6 caracteres.'); return }
    if (newPass !== confirmPass) { setCreateError('As senhas não coincidem.'); return }
    setCreateLoading(true); setCreateError('')
    
    try {
        const passRes = await fetch('/api/auth/update-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            userIdLegacy: faUser!.id, 
            newPass,
            registeredEmail: faRegEmail.trim() || faUser!.email || ''
          })
        })
        
        if (!passRes.ok) {
           const errData = await passRes.json().catch(() => ({}))
           throw new Error(errData.error || 'Erro ao sincronizar senha com servidor.')
        }

        setCreateLoading(false); setCreateSuccess(true)
       await new Promise(r => setTimeout(r, 2200))
       setStep('login')
       // Preenche com o e-mail cadastrado ou a matrícula
       const loginHint = faRegEmail ? faRegEmail : (faUser?.matricula || '')
       setEmail(loginHint)
       setFaQuery(''); setFaUser(null); setNewPass(''); setConfirmPass(''); setCreateSuccess(false)
    } catch (err: any) {
       console.error("Setup erro:", err)
       setCreateLoading(false)
       setCreateError(err.message || 'Erro ao sincronizar senha com servidor.')
    }
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
      const res = await fetch('/api/configuracoes/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      })
      if (!res.ok) {
         setSetupLoading(false)
         const err = await res.json()
         alert('Falha ao salvar Administrador: ' + err.error)
         return;
      }
    } catch(err) { 
      console.error('Erro ao salvar admin no banco', err);
      setSetupLoading(false)
      alert('Erro critico da rede localizando API!')
      return;
    }

    setSetupLoading(false)
    setIsSystemEmpty(false)
    setStep('login')
    setEmail(setupEmail)
  }

  // ── shared styles
  const cardStyle: React.CSSProperties = { padding:'36px', borderRadius:28, background:'linear-gradient(145deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%)', border:'1px solid rgba(96, 165, 250, 0.2)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', boxShadow:'0 32px 80px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.1)' }
  const baseInputStyle: React.CSSProperties = { width:'100%', padding:'15px 16px 15px 44px', borderRadius:16, background:'rgba(59, 130, 246, 0.08)', border:'1px solid rgba(96, 165, 250, 0.2)', color:'#fff', fontSize:14, outline:'none', transition:'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', fontFamily:"'Inter',sans-serif", boxShadow:'inset 0 2px 6px rgba(0,0,0,0.1)' }
  const btnBase = (disabled: boolean): React.CSSProperties => ({
    position:'relative', padding:'16px', borderRadius:16, width:'100%',
    background: disabled ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)',
    border:'none', color:'#fff', fontSize:15, fontWeight:800,
    cursor: disabled ? 'not-allowed' : 'pointer', overflow:'hidden', letterSpacing:'0.02em',
    fontFamily:"'Outfit',sans-serif", transition:'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: disabled ? 'none' : '0 8px 30px rgba(99,102,241,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
  })
  const focusOn  = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor='rgba(96, 165, 250, 0.8)'; e.target.style.boxShadow='0 0 0 4px rgba(96, 165, 250, 0.25), inset 0 2px 6px rgba(0,0,0,0.1)'; e.target.style.background='rgba(59, 130, 246, 0.15)' }
  const focusOff = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor='rgba(96, 165, 250, 0.2)'; e.target.style.boxShadow='inset 0 2px 6px rgba(0,0,0,0.1)'; e.target.style.background='rgba(59, 130, 246, 0.08)' }
  const Spinner = () => <div style={{ width:18, height:18, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.2)', borderTopColor:'#fff', animation:'spin 0.8s linear infinite', display:'inline-block' }} />
  const ErrorBox = ({ msg }: { msg: string }) => msg ? <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', fontSize:13, color:'#f87171', display:'flex', alignItems:'center', gap:8 }}>⚠ {msg}</div> : null
  const ShimmerOverlay = () => <div style={{ position:'absolute', inset:0, background:'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)', backgroundSize:'200% 100%', animation:'shimmerBtn 2.5s ease-in-out infinite' }} />
  const Label = ({ text }: { text: string }) => <label style={{ display:'block', fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.45)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:8 }}>{text}</label>



  // ────────────────────────────────────────────────────────────────
  // STEP: Login
  // ────────────────────────────────────────────────────────────────
  const LoginContent = (
    <div className="login-form-wrapper" style={{ width:'100%', maxWidth:420, position:'relative', zIndex:1, margin: '0 auto' }}>
      


      <div className="login-header-group" style={{ marginBottom:32, textAlign: 'center' }}>

        <h2 className="login-h2" style={{ fontFamily:"'Outfit',sans-serif", fontSize:32, fontWeight:900, color:'#fff', letterSpacing:'-0.02em', marginBottom:12, minHeight: 38 }}>
          {typedText}<span style={{ display:'inline-block', width:3, height:'0.85em', background:'#60a5fa', marginLeft:3, verticalAlign:'middle', animation:'blink 1s step-end infinite', borderRadius:1 }} />
        </h2>
        <p className="login-p" style={{ fontSize:15, color:'rgba(255,255,255,0.4)', lineHeight:1.5, margin: '0 auto', maxWidth: 300 }}>Entre com suas credenciais para acessar sua plataforma.</p>
      </div>

      <div className="login-card" style={cardStyle}>
        <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:22 }}>
          <div>
            <Label text="E-mail, Matrícula (Aluno) ou CPF" />
            <div style={{ position:'relative' }} suppressHydrationWarning>
              <span style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)', fontSize:16, color: '#a78bfa', pointerEvents:'none' }}>👤</span>
              <input type="text" value={email} onChange={e=>{setEmail(e.target.value);setLoginError('')}} placeholder="Digite seu e-mail, matrícula ou CPF" autoComplete="username"
                suppressHydrationWarning
                style={{ ...baseInputStyle, paddingLeft: 46, background: 'rgba(255,255,255,0.03)', borderRadius: 14, borderColor: loginError&&!email?'rgba(239,68,68,0.5)':'rgba(255,255,255,0.06)' }} onFocus={focusOn} onBlur={focusOff} />
            </div>
          </div>
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <Label text="Senha" />
              <button type="button" onClick={(e) => { e.preventDefault(); window.location.href = '/esqueci-senha'; }} style={{ fontSize:12, color:'#a78bfa', background:'none', border:'none', cursor:'pointer', fontWeight:600, position:'relative', zIndex:50, padding: 0 }}>Esqueci minha senha</button>
            </div>
            <div style={{ position:'relative' }} suppressHydrationWarning>
              <span style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)', fontSize:16, color: '#a78bfa', pointerEvents:'none' }}>🔒</span>
              <input type={showPw?'text':'password'} value={password} onChange={e=>{setPassword(e.target.value);setLoginError('')}} placeholder="Digite sua senha" autoComplete="current-password"
                suppressHydrationWarning
                style={{ ...baseInputStyle, paddingLeft: 46, paddingRight:46, background: 'rgba(255,255,255,0.03)', borderRadius: 14, borderColor: loginError&&!password?'rgba(239,68,68,0.5)':'rgba(255,255,255,0.06)' }} onFocus={focusOn} onBlur={focusOff} />
              <button type="button" onClick={()=>setShowPw(p=>!p)} style={{ position:'absolute', right:16, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:16, color:'rgba(255,255,255,0.5)' }}>{showPw?'🙈':'👁'}</button>
            </div>
          </div>
          <ErrorBox msg={loginError} />
          
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <input type="checkbox" id="remember" defaultChecked style={{ width:20, height:20, accentColor:'#2563eb', cursor:'pointer', borderRadius: 4 }} />
            <label htmlFor="remember" style={{ fontSize:14, color:'rgba(255,255,255,0.5)', cursor:'pointer' }}>Manter conectado por 30 dias</label>
          </div>

          <button type="submit" disabled={loginLoading} style={{...btnBase(loginLoading), padding: '16px', background: loginLoading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(90deg, #2563eb 0%, #a855f7 100%)', borderRadius: 16, boxShadow: loginLoading ? 'none' : '0 8px 32px rgba(139,92,246,0.4)'}}
            onMouseEnter={e=>{if(!loginLoading){e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 12px 40px rgba(139,92,246,0.6)'}}}
            onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='0 8px 32px rgba(139,92,246,0.4)'}}>
            {!loginLoading && <ShimmerOverlay />}
            <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
              {loginLoading ? <><Spinner /><span>Autenticando...</span></> : <><span style={{ fontSize: 16 }}>Entrar na Plataforma</span><span style={{ fontSize:18 }}>→</span></>}
            </div>
          </button>
        </form>

        {/* Separador + Primeiro Acesso */}
        <div style={{ marginTop:28 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
            <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.08)' }} />
            <span style={{ fontSize:12, color:'rgba(255,255,255,0.3)', fontWeight:700 }}>OU</span>
            <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.08)' }} />
          </div>
          <button type="button" onClick={()=>setStep('first_access_verify')}
            style={{ width:'100%', padding:'16px', borderRadius:16, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.8)', fontSize:14, fontWeight:700, cursor:'pointer', transition:'all 0.25s', fontFamily:"'Outfit',sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.06)'}}
            onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.03)'}}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 14 }}>🔑</span>
              </div>
              <span>Primeiro Acesso (Alunos/Pais)</span>
            </div>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 20, paddingRight: 4 }}>›</span>
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
      
      {/* Bottom Disclaimer Mobile */}
      <div className="mobile-only" style={{ display: 'none', flexDirection: 'column', alignItems: 'center', marginTop: 32, paddingBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 24, maxWidth: 300 }}>
          <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.2)', filter:'grayscale(1)' }}>🛡️</span>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, margin: 0 }}>
            Seus dados estão protegidos com<br/>criptografia de ponta.
          </p>
        </div>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginBottom: 20 }}>IMPACTO EDU v3.2.0 • © 2025 Todos os direitos reservados.</p>
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 16px', borderRadius:100, border:'1px solid rgba(16,185,129,0.15)', background: 'rgba(16,185,129,0.05)' }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:'#10b981', boxShadow:'0 0 8px #10b981' }} />
          <span style={{ fontSize:11, color:'#34d399', fontWeight:800, letterSpacing:'0.08em' }}>SISTEMA SEGURO</span>
        </div>
      </div>

      <div className="hide-on-mobile" style={{ marginTop:28, textAlign:'center' }}>
        <p style={{ fontSize:11, color:'rgba(255,255,255,0.13)' }}>IMPACTO EDU v3.2.0 • © 2025 Todos os direitos reservados</p>
      </div>
    </div>
  )

  // ────────────────────────────────────────────────────────────────
  // STEP: Primeiro Acesso — Verificação
  // ────────────────────────────────────────────────────────────────
  const FirstAccessVerify = (
    <div className="login-form-wrapper" style={{ width:'100%', maxWidth:420, position:'relative', zIndex:1, animation:'fadeSlideIn 0.35s ease-out both' }}>
      <motion.button 
        type="button" 
        onClick={goLogin} 
        whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)' }}
        whileTap={{ scale: 0.95 }}
        style={{ 
          display:'inline-flex', alignItems:'center', gap:8, 
          fontSize:13, color:'white', fontWeight:700, letterSpacing: '0.02em',
          background:'rgba(255,255,255,0.08)', 
          border:'1px solid rgba(255,255,255,0.15)', 
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          padding: '8px 18px', borderRadius: 100,
          cursor:'pointer', marginBottom:32, transition:'all 0.3s ease',
          boxShadow: '0 8px 16px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)'
        }}
      >
        <span style={{ fontSize: 16, transition: 'transform 0.2s ease' }} className="back-arrow">←</span> Voltar ao login
      </motion.button>
      <style dangerouslySetInnerHTML={{__html: `button:hover .back-arrow { transform: translateX(-3px); }`}} />
      <div style={{ marginBottom:32 }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'5px 14px', borderRadius:100, background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.25)', marginBottom:20 }}>
          <span>🔑</span><span style={{ fontSize:11, fontWeight:700, color:'#a78bfa', letterSpacing:'0.06em' }}>PRIMEIRO ACESSO</span>
        </div>
        <h2 style={{ fontFamily:"'Outfit',sans-serif", fontSize:30, fontWeight:900, color:'#fff', letterSpacing:'-0.02em', marginBottom:8 }}>Identificação</h2>
        <p style={{ fontSize:14, color:'rgba(255,255,255,0.35)', lineHeight:1.6 }}>Informe o <strong style={{ color:'rgba(255,255,255,0.6)' }}>e-mail cadastrado</strong>, <strong style={{ color:'rgba(255,255,255,0.6)' }}>matrícula do aluno</strong> ou <strong style={{ color:'rgba(255,255,255,0.6)' }}>CPF</strong> para verificar seu acesso.</p>
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
        onMouseEnter={e=>(e.currentTarget.style.color='rgba(255,255,255,0.75)')} onMouseLeave={e=>(e.currentTarget.style.color='rgba(255,255,255,0.4)')}>← Voltar</button>
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
              <Label text="E-mail de Cadastro *" />
              <div style={{ position:'relative' }} suppressHydrationWarning>
                <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:15, opacity:0.4, pointerEvents:'none' }}>✉</span>
                <input type="email" value={faRegEmail} onChange={e=>{setFaRegEmail(e.target.value);setCreateError('')}} placeholder="Preencha seu e-mail principal" required suppressHydrationWarning
                  style={{ ...baseInputStyle }} onFocus={focusOn} onBlur={focusOff} />
              </div>
              {faUser?.cargo === 'Aluno' && (
                <p style={{ fontSize:11, color:'rgba(255,255,255,0.3)', marginTop:6 }}>Seu login pode ser este e-mail ou sua matrícula: <strong style={{color:'rgba(255,255,255,0.6)'}}>{faUser?.matricula || faUser?.id}</strong></p>
              )}
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
      <motion.button 
        type="button" 
        onClick={goLogin} 
        whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)' }}
        whileTap={{ scale: 0.95 }}
        style={{ 
          display:'inline-flex', alignItems:'center', gap:8, 
          fontSize:13, color:'white', fontWeight:700, letterSpacing: '0.02em',
          background:'rgba(255,255,255,0.08)', 
          border:'1px solid rgba(255,255,255,0.15)', 
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          padding: '8px 18px', borderRadius: 100,
          cursor:'pointer', marginBottom:32, transition:'all 0.3s ease',
          boxShadow: '0 8px 16px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)'
        }}
      >
        <span style={{ fontSize: 16, transition: 'transform 0.2s ease' }} className="back-arrow">←</span> Cancelar setup
      </motion.button>
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
            <input type="email" value={setupEmail} disabled suppressHydrationWarning style={{...baseInputStyle, opacity: 0.6, cursor: 'not-allowed'}} />
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
  // STEP: Escolher Sistema (ERP vs Agenda)
  // ────────────────────────────────────────────────────────────────
  const ChooseSystemContent = (
    <div className="login-form-wrapper" style={{ width:'100%', maxWidth:540, position:'relative', zIndex:1, animation:'fadeSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) both' }}>
      <div style={{ marginBottom:36, textAlign:'center' }}>
        <h2 style={{ fontFamily:"'Outfit',sans-serif", fontSize:32, fontWeight:900, color:'#fff', letterSpacing:'-0.02em', marginBottom:8 }}>Acesso Autorizado</h2>
        <p style={{ fontSize:15, color:'rgba(255,255,255,0.45)' }}>Bem-vindo. Onde você deseja entrar?</p>
      </div>

      <div style={{ display:'flex', gap:20, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
        {isProfileLoading ? (
          <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <Spinner />
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>Carregando permissões...</span>
          </div>
        ) : (
          <>
            {profileData && !profileData.bloqueadoGestaoEscolar && (
              <button type="button" 
                onClick={() => {
                  const p = pendingAuth?.perfil;
                  if (p === 'Professor') window.location.href = '/professor';
                  else window.location.href = '/dashboard';
                }}
                style={{ flex:'1 1 200px', padding:'32px 24px', borderRadius:24, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', backdropFilter:'blur(20px)', cursor:'pointer', transition:'all 0.3s', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, minWidth: '180px' }}
                onMouseEnter={e=>{e.currentTarget.style.background='rgba(59,130,246,0.08)'; e.currentTarget.style.borderColor='rgba(59,130,246,0.3)'; e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 20px 40px rgba(0,0,0,0.3), 0 0 40px rgba(59,130,246,0.1)'}}
                onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'; e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'}}>
                <div style={{ width:64, height:64, borderRadius:20, background:'linear-gradient(135deg, #3b82f6, #2563eb)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, boxShadow:'0 10px 24px rgba(59,130,246,0.4)' }}>🏢</div>
                <div>
                  <div style={{ fontSize:18, fontWeight:800, color:'#fff', marginBottom:4 }}>Gestão Escolar</div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>Sistema ERP Principal</div>
                </div>
              </button>
            )}

            {profileData && !profileData.bloqueadoAgendaDigital && (
              <button type="button" 
                onClick={() => {
                  const p = pendingAuth?.perfil;
                  if (p === 'Diretor Geral' || pendingAuth?.cargo === 'Administrador Master') {
                      window.location.href = '/agenda-digital/selecionar-perfil-admin';
                  } else {
                      window.location.href = '/agenda-digital/selecionar-aluno';
                  }
                }}
                style={{ flex:'1 1 200px', padding:'32px 24px', borderRadius:24, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', backdropFilter:'blur(20px)', cursor:'pointer', transition:'all 0.3s', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, minWidth: '180px' }}
                onMouseEnter={e=>{e.currentTarget.style.background='rgba(139,92,246,0.08)'; e.currentTarget.style.borderColor='rgba(139,92,246,0.3)'; e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 20px 40px rgba(0,0,0,0.3), 0 0 40px rgba(139,92,246,0.1)'}}
                onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'; e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'}}>
                <div style={{ width:64, height:64, borderRadius:20, background:'linear-gradient(135deg, #8b5cf6, #6d28d9)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, boxShadow:'0 10px 24px rgba(139,92,246,0.4)' }}>📱</div>
                <div>
                  <div style={{ fontSize:18, fontWeight:800, color:'#fff', marginBottom:4 }}>Agenda Digital</div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>Comunicação Diária</div>
                </div>
              </button>
            )}

            {profileData && !profileData.bloqueadoGestaoPessoas && (
              <button type="button" 
                onClick={() => {
                  window.location.href = '/gestao-pessoas';
                }}
                style={{ flex:'1 1 200px', padding:'32px 24px', borderRadius:24, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', backdropFilter:'blur(20px)', cursor:'pointer', transition:'all 0.3s', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, minWidth: '180px' }}
                onMouseEnter={e=>{e.currentTarget.style.background='rgba(16,185,129,0.08)'; e.currentTarget.style.borderColor='rgba(16,185,129,0.3)'; e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 20px 40px rgba(0,0,0,0.3), 0 0 40px rgba(16,185,129,0.1)'}}
                onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'; e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'}}>
                <div style={{ width:64, height:64, borderRadius:20, background:'linear-gradient(135deg, #10b981, #059669)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, boxShadow:'0 10px 24px rgba(16,185,129,0.4)' }}>👥</div>
                <div>
                  <div style={{ fontSize:18, fontWeight:800, color:'#fff', marginBottom:4 }}>Gestão de Pessoas</div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>RH, SST e NR-01</div>
                </div>
              </button>
            )}

            {profileData && !profileData.bloqueadoSimulados && (
              <button type="button" 
                onClick={() => {
                  window.location.href = '/simulados';
                }}
                style={{ flex:'1 1 200px', padding:'32px 24px', borderRadius:24, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', backdropFilter:'blur(20px)', cursor:'pointer', transition:'all 0.3s', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, minWidth: '180px' }}
                onMouseEnter={e=>{e.currentTarget.style.background='rgba(244,63,94,0.08)'; e.currentTarget.style.borderColor='rgba(244,63,94,0.3)'; e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 20px 40px rgba(0,0,0,0.3), 0 0 40px rgba(244,63,94,0.1)'}}
                onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'; e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'}}>
                <div style={{ width:64, height:64, borderRadius:20, background:'linear-gradient(135deg, #f43f5e, #be123c)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, boxShadow:'0 10px 24px rgba(244,63,94,0.4)' }}>📝</div>
                <div>
                  <div style={{ fontSize:18, fontWeight:800, color:'#fff', marginBottom:4 }}>SIMULADOS</div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>Geração de Provas</div>
                </div>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )

  // ────────────────────────────────────────────────────────────────
  // STEP: Escolher Contexto da Agenda (Duplo Perfil)
  // ────────────────────────────────────────────────────────────────
  const ChooseAgendaRoleContent = (
    <div className="login-form-wrapper" style={{ width:'100%', maxWidth:540, position:'relative', zIndex:1, animation:'fadeSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) both' }}>
      <button type="button" onClick={() => setStep('choose_system')} style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:13, color:'rgba(255,255,255,0.4)', background:'none', border:'none', cursor:'pointer', marginBottom:24, fontWeight:600 }}>← Voltar</button>
      
      <div style={{ marginBottom:36, textAlign:'center' }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'5px 14px', borderRadius:100, background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.25)', marginBottom:16 }}>
          <span style={{ fontSize:10, fontWeight:900, color:'#34d399' }}>MÚLTIPLOS PERFIS DETECTADOS</span>
        </div>
        <h2 style={{ fontFamily:"'Outfit',sans-serif", fontSize:28, fontWeight:900, color:'#fff', letterSpacing:'-0.02em', marginBottom:8 }}>Acessar a Agenda como:</h2>
      </div>

      <div style={{ display:'flex', gap:20, flexDirection: 'row' }}>
        <button type="button" 
          onClick={() => { window.location.href = '/agenda-digital/selecionar-aluno'; }}
          style={{ flex:1, padding:'28px 24px', borderRadius:24, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', backdropFilter:'blur(20px)', cursor:'pointer', transition:'all 0.3s', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16 }}
          onMouseEnter={e=>{e.currentTarget.style.background='rgba(16,185,129,0.08)'; e.currentTarget.style.borderColor='rgba(16,185,129,0.3)'; e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 20px 40px rgba(0,0,0,0.3), 0 0 40px rgba(16,185,129,0.1)'}}
          onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'; e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'}}>
          <div style={{ width:56, height:56, borderRadius:18, background:'linear-gradient(135deg, #10b981, #059669)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, boxShadow:'0 10px 24px rgba(16,185,129,0.4)' }}>👨‍👩‍👧‍👦</div>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:'#fff', marginBottom:4 }}>Família</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>Perfil de Pais/Responsáveis</div>
          </div>
        </button>

        <button type="button" 
          onClick={() => {
             const p = pendingAuth?.perfil;
             if (p === 'Diretor Geral' || pendingAuth?.cargo === 'Administrador Master') {
                 window.location.href = '/agenda-digital/selecionar-perfil-admin';
             } else {
                 window.location.href = '/agenda-digital/colaborador/comunicados';
             }
          }}
          style={{ flex:1, padding:'28px 24px', borderRadius:24, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', backdropFilter:'blur(20px)', cursor:'pointer', transition:'all 0.3s', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16 }}
          onMouseEnter={e=>{e.currentTarget.style.background='rgba(245,158,11,0.08)'; e.currentTarget.style.borderColor='rgba(245,158,11,0.3)'; e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 20px 40px rgba(0,0,0,0.3), 0 0 40px rgba(245,158,11,0.1)'}}
          onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'; e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'}}>
          <div style={{ width:56, height:56, borderRadius:18, background:'linear-gradient(135deg, #f59e0b, #d97706)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, boxShadow:'0 10px 24px rgba(245,158,11,0.4)' }}>💼</div>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:'#fff', marginBottom:4 }}>Colaborador</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>Perfil Escolar Interno</div>
          </div>
        </button>
      </div>
    </div>
  )

  return (
    <div className="login-wrapper" style={{ display:'flex', minHeight:'100vh', fontFamily:"'Inter',sans-serif", overflow:'hidden' }}>
      
      {/* Top Bar with Glassmorphism */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)', zIndex: 50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:40, height:40, borderRadius:12, background:'linear-gradient(135deg, #3b82f6, #8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px rgba(59,130,246,0.3)', overflow: 'hidden' }}>
            <img src="/logo-impacto.png" alt="Logo Impacto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontFamily:"'Outfit',sans-serif", fontSize:18, fontWeight:900, color:'#fff', letterSpacing:'-0.02em', lineHeight: 1 }}>IMPACTO <span style={{ background:'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>EDU</span></div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', marginTop: 2 }}>Enterprise Learning Suite</div>
          </div>
        </div>
      </div>

      <div className="login-right-panel" style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 20px 48px', background:'linear-gradient(-45deg, #020617, #0f172a, #172554, #082f49)', backgroundSize: '400% 400%', animation: 'gradientBG 15s ease infinite', position:'relative', overflow:'hidden', overflowY:'auto' }}>
        

        {/* Enterprise SaaS Background Overlay */}
        <BackgroundEffects />
        {step === 'login'                && LoginContent}
        {step === 'first_access_verify'  && FirstAccessVerify}
        {step === 'first_access_create' && FirstAccessCreate}
        {step === 'setup_master' && SetupMasterContent}
        {step === 'choose_system' && ChooseSystemContent}
        {step === 'choose_agenda_role' && ChooseAgendaRoleContent}
        
        {/* Modal de bloqueio */}
        {showBlockModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(20px)', animation: 'fadeIn 0.3s ease-out' }} onClick={() => setShowBlockModal(false)} />
            <div style={{ position: 'relative', background: 'linear-gradient(145deg, #0f172a 0%, #1e1b4b 100%)', padding: 40, borderRadius: 24, border: '1px solid rgba(139,92,246,0.3)', boxShadow: '0 32px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1)', maxWidth: 440, width: '100%', textAlign: 'center', animation: 'scaleUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', border: '1px solid rgba(239,68,68,0.2)', boxShadow: '0 0 40px rgba(239,68,68,0.2)' }}>
                <span style={{ fontSize: 36 }}>🔒</span>
              </div>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 26, fontWeight: 900, color: '#fff', marginBottom: 12, letterSpacing: '-0.02em' }}>Acesso Restrito</h3>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: 32 }}>
                Seu perfil atual (<strong style={{ color: '#fff' }}>{pendingAuth?.perfil}</strong>) não possui permissão para acessar o Sistema de Gestão Escolar. <br/><br/>
                Caso precise de acesso, entre em contato com a diretoria ou a equipe de TI.
              </p>
              <button onClick={() => setShowBlockModal(false)} style={{ width: '100%', padding: '16px', borderRadius: 14, background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 24px rgba(59,130,246,0.3)' }}>
                Entendi, voltar
              </button>
            </div>
          </div>
        )}

        <div className="hide-on-mobile" style={{ position:'absolute', bottom:24, right:32, display:'flex', alignItems:'center', gap:8, padding:'6px 14px', borderRadius:100, background:'rgba(16,185,129,0.07)', border:'1px solid rgba(16,185,129,0.15)' }}>
          <div style={{ width:5, height:5, borderRadius:'50%', background:'#10b981', boxShadow:'0 0 6px #10b981' }} />
          <span style={{ fontSize:10, color:'rgba(16,185,129,0.7)', fontWeight:700, letterSpacing:'0.06em' }}>SISTEMA SEGURO</span>
        </div>
      </div>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes spin  { to{transform:rotate(360deg)} }
        @keyframes scaleUp { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes floatOrb1 { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-18px) scale(1.15)} }
        @keyframes floatOrb2 { 0%,100%{transform:translateY(0) translateX(0)} 33%{transform:translateY(-12px) translateX(8px)} 66%{transform:translateY(6px) translateX(-5px)} }
        @keyframes floatOrb3 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(14px)} }
        @keyframes fadeSlideIn { from{opacity:0;transform:translateX(-16px)} to{opacity:1;transform:translateX(0)} }
        @keyframes shimmerBtn { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes progressFill { from{width:0%} to{width:100%} }
        @keyframes gradientBG { 0% { background-position: 0% 50% } 50% { background-position: 100% 50% } 100% { background-position: 0% 50% } }
        input::placeholder { color:rgba(255,255,255,0.2) !important; }
        input:-webkit-autofill { -webkit-box-shadow:0 0 0 30px #0d1a3a inset !important; -webkit-text-fill-color:#fff !important; }
        
        /* Mobile Optimizaton for Login */
        @media (max-width: 768px) {
          .login-wrapper {
            flex-direction: column !important;
            overflow-y: auto !important;
            background: linear-gradient(-45deg, #020617, #0f172a, #172554, #082f49) !important;
            background-size: 400% 400% !important;
            animation: gradientBG 15s ease infinite !important;
          }
          .login-left-panel {
            display: none !important;
          }
          .login-right-panel {
            padding: 100px 20px 48px 20px !important;
            justify-content: flex-start !important;
            background: transparent !important;
            align-items: stretch !important;
          }
          .hide-on-mobile {
            display: none !important;
          }
          .mobile-only {
            display: flex !important;
          }
          .login-card {
            padding: 24px 20px !important;
            border-radius: 24px !important;
          }
          .login-header-group {
            margin-bottom: 24px !important;
          }
          .login-h2 {
            font-size: 28px !important;
          }
        }
      `}</style>
    </div>
  )
}
