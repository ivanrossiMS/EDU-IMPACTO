import re

with open('app/login/page.tsx', 'r') as f:
    code = f.read()

# We want to replace everything from the start of the `cardStyle` down to the end of the file with our new layout.
# Let's extract the first part of the file up to `  // ── shared styles`
parts = code.split('  // ── shared styles')
top_part = parts[0]

new_styles = """
  // ── shared styles
  const cardStyle: React.CSSProperties = { padding:'24px', borderRadius:24, background:'#ffffff', boxShadow:'0 24px 60px rgba(99, 102, 241, 0.1)', position: 'relative', zIndex: 10 }
  const baseInputStyle: React.CSSProperties = { width:'100%', padding:'15px 14px 15px 46px', borderRadius:14, background:'#ffffff', border:'1.5px solid #e2e8f0', color:'#1e293b', fontSize:14, outline:'none', transition:'all 0.2s', fontFamily:"'Inter',sans-serif", fontWeight: 500 }
  const btnBase = (disabled: boolean): React.CSSProperties => ({
    position:'relative', padding:'16px', borderRadius:14, width:'100%',
    background: disabled ? '#e2e8f0' : 'linear-gradient(90deg, #6366f1 0%, #3b82f6 100%)',
    border:'none', color: disabled ? '#94a3b8' : '#fff', fontSize:15, fontWeight:700,
    cursor: disabled ? 'not-allowed' : 'pointer', overflow:'hidden',
    fontFamily:"'Inter',sans-serif", transition:'all 0.25s',
    boxShadow: disabled ? 'none' : '0 12px 24px rgba(99, 102, 241, 0.25)',
  })
  const focusOn  = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor='#6366f1'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.1)'; }
  const focusOff = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor='#e2e8f0'; e.target.style.boxShadow='none'; }
  const Spinner = () => <div style={{ width:18, height:18, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.2)', borderTopColor:'#fff', animation:'spin 0.8s linear infinite', display:'inline-block' }} />
  const ErrorBox = ({ msg }: { msg: string }) => msg ? <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', fontSize:13, color:'#ef4444', display:'flex', alignItems:'center', gap:8, fontWeight: 500 }}>⚠ {msg}</div> : null
  const ShimmerOverlay = () => <div style={{ position:'absolute', inset:0, background:'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)', backgroundSize:'200% 100%', animation:'shimmerBtn 2.5s ease-in-out infinite' }} />
  const Label = ({ text }: { text: string }) => <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:8 }}>{text}</label>

  // ────────────────────────────────────────────────────────────────
  // STEP: Login
  // ────────────────────────────────────────────────────────────────
  const LoginContent = (
    <div className="login-form-wrapper" style={{ width:'100%', maxWidth:440, position:'relative', zIndex:1, margin: '0 auto', paddingTop: 20 }}>
      
      {/* HEADER LOGO */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom: 20, zIndex: 10, position: 'relative' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom: 4 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:50 }}>
            {/* The abstract figures logo from the image can be replaced by a simple icon or the text logo. Here we use an image if we had one, but we will use the text. */}
            {/* We will use a fallback icon for the two abstract people. */}
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="none" style={{ background: 'linear-gradient(135deg, #6366f1, #0ea5e9)', WebkitBackgroundClip: 'text', color: 'transparent', transform: 'scale(1.5)'}}>
              <path d="M17 20C17 18.3431 14.7614 17 12 17C9.23858 17 7 18.3431 7 20" stroke="url(#grad)" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="12" cy="12" r="3" stroke="url(#grad)" strokeWidth="2"/>
              <defs>
                <linearGradient id="grad" x1="7" y1="9" x2="17" y2="20" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#0ea5e9" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
        <div style={{ fontFamily:"'Outfit',sans-serif", fontSize:28, fontWeight:900, color:'#0f172a', letterSpacing:'-0.02em', marginBottom:4 }}>
          IMPACTO <span style={{ color:'#6366f1' }}>EDU</span>
        </div>
        <div style={{ fontSize:10, color:'#64748b', fontWeight:700, letterSpacing:'0.16em', textTransform:'uppercase' }}>Enterprise Learning Suite</div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 10, position: 'relative', zIndex: 10 }}>
        <h2 style={{ fontFamily:"'Outfit',sans-serif", fontSize:32, fontWeight:900, color:'#0f172a', letterSpacing:'-0.03em', marginBottom:8 }}>
          Bem-vindo de <span style={{ color:'#6366f1' }}>volta!</span>
        </h2>
        <p style={{ fontSize:14, color:'#64748b', lineHeight:1.5, margin: '0 auto', maxWidth: 260 }}>Entre com suas credenciais para acessar sua plataforma.</p>
      </div>

      {/* 3D Illustration */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: -20, marginBottom: -40, position: 'relative', zIndex: 5, pointerEvents: 'none' }}>
        <img src="/login_illustration.png" alt="3D Boy" style={{ width: 280, objectFit: 'contain', filter: 'drop-shadow(0 20px 30px rgba(99,102,241,0.15))' }} />
      </div>

      <div className="login-card" style={cardStyle}>
        <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:20 }}>
          <div>
            <Label text="E-mail, Matrícula (Aluno) ou CPF" />
            <div style={{ position:'relative' }} suppressHydrationWarning>
              <span style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)', fontSize:18, color: '#94a3b8', pointerEvents:'none' }}>✉</span>
              <input type="text" value={email} onChange={e=>{setEmail(e.target.value);setLoginError('')}} placeholder="Digite seu e-mail, matrícula ou CPF" autoComplete="username"
                suppressHydrationWarning
                style={{ ...baseInputStyle, borderColor: loginError&&!email?'#ef4444':'#e2e8f0' }} onFocus={focusOn} onBlur={focusOff} />
            </div>
          </div>
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <Label text="Senha" />
              <button type="button" onClick={(e) => { e.preventDefault(); window.location.href = '/esqueci-senha'; }} style={{ fontSize:12, color:'#6366f1', background:'none', border:'none', cursor:'pointer', fontWeight:700, position:'relative', zIndex:50, padding: 0 }}>Esqueci minha senha</button>
            </div>
            <div style={{ position:'relative' }} suppressHydrationWarning>
              <span style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)', fontSize:18, color: '#94a3b8', pointerEvents:'none' }}>🔒</span>
              <input type={showPw?'text':'password'} value={password} onChange={e=>{setPassword(e.target.value);setLoginError('')}} placeholder="Digite sua senha" autoComplete="current-password"
                suppressHydrationWarning
                style={{ ...baseInputStyle, paddingRight:46, borderColor: loginError&&!password?'#ef4444':'#e2e8f0' }} onFocus={focusOn} onBlur={focusOff} />
              <button type="button" onClick={()=>setShowPw(p=>!p)} style={{ position:'absolute', right:16, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#94a3b8' }}>{showPw?'🙈':'👁'}</button>
            </div>
          </div>
          <ErrorBox msg={loginError} />
          
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ position: 'relative', width: 20, height: 20 }}>
              <input type="checkbox" id="remember" defaultChecked style={{ width:'100%', height:'100%', accentColor:'#6366f1', cursor:'pointer', borderRadius: 6, margin: 0 }} />
            </div>
            <label htmlFor="remember" style={{ fontSize:13, color:'#475569', cursor:'pointer', fontWeight: 500 }}>Manter conectado por 30 dias</label>
          </div>

          <button type="submit" disabled={loginLoading} style={btnBase(loginLoading)}
            onMouseEnter={e=>{if(!loginLoading){e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 16px 32px rgba(99, 102, 241, 0.3)'}}}
            onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='0 12px 24px rgba(99, 102, 241, 0.25)'}}>
            {!loginLoading && <ShimmerOverlay />}
            <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
              {loginLoading ? <><Spinner /><span>Autenticando...</span></> : <><span style={{ fontSize: 16 }}>Entrar na Plataforma</span><span style={{ fontSize:18 }}>→</span></>}
            </div>
          </button>
        </form>

        {/* Separador + Primeiro Acesso */}
        <div style={{ marginTop:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
            <div style={{ flex:1, height:1, background:'#e2e8f0' }} />
            <span style={{ fontSize:11, color:'#94a3b8', fontWeight:700, letterSpacing: '0.05em' }}>OU</span>
            <div style={{ flex:1, height:1, background:'#e2e8f0' }} />
          </div>
          <button type="button" onClick={()=>setStep('first_access_verify')}
            style={{ width:'100%', padding:'14px', borderRadius:14, background:'#ffffff', border:'1.5px solid #e2e8f0', color:'#1e293b', fontSize:14, fontWeight:700, cursor:'pointer', transition:'all 0.25s', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}
            onMouseEnter={e=>{e.currentTarget.style.background='#f8fafc'; e.currentTarget.style.borderColor='#cbd5e1'}}
            onMouseLeave={e=>{e.currentTarget.style.background='#ffffff'; e.currentTarget.style.borderColor='#e2e8f0'}}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 16, transform: 'rotate(-45deg)', color: '#6366f1' }}>🔑</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ color: '#0f172a' }}>Primeiro acesso</span>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Ative sua conta e crie sua senha</span>
              </div>
            </div>
            <span style={{ color: '#94a3b8', fontSize: 20, paddingRight: 4 }}>›</span>
          </button>

          {isSystemEmpty && (
            <button type="button" onClick={()=>setStep('setup_master')}
              style={{ width:'100%', marginTop:12, padding:'14px', borderRadius:14, background:'rgba(16,185,129,0.05)', border:'1px solid rgba(16,185,129,0.2)', color:'#10b981', fontSize:13, fontWeight:800, cursor:'pointer', transition:'all 0.25s', textTransform:'uppercase', letterSpacing:'0.03em' }}
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(16,185,129,0.1)';e.currentTarget.style.transform='translateY(-1px)'}}
              onMouseLeave={e=>{e.currentTarget.style.background='rgba(16,185,129,0.05)';e.currentTarget.style.transform=''}}>
              ⚙️ Configurar Administrador Master
            </button>
          )}
        </div>
      </div>
      
      {/* Bottom Disclaimer (Trust Badges) */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 32, paddingBottom: 24, zIndex: 10, position: 'relative', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', fontSize: 16 }}>🛡️</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>Dados protegidos</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>Criptografia de ponta</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', fontSize: 16 }}>🔒</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>Acesso seguro</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>SSL 256 bits</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0ea5e9', fontSize: 16 }}>👆</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>Login biométrico</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>Disponível</div>
          </div>
        </div>
      </div>
    </div>
  )

  // ────────────────────────────────────────────────────────────────
  // STEP: Primeiro Acesso — Verificação
  // ────────────────────────────────────────────────────────────────
  const FirstAccessVerify = (
    <div className="login-form-wrapper" style={{ width:'100%', maxWidth:440, position:'relative', zIndex:1, animation:'fadeSlideIn 0.35s ease-out both', margin: '0 auto', paddingTop: 20 }}>
      <button type="button" onClick={goLogin} style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:13, color:'#64748b', background:'none', border:'none', cursor:'pointer', marginBottom:32, fontWeight:600, transition:'color 0.2s' }}
        onMouseEnter={e=>(e.currentTarget.style.color='#0f172a')} onMouseLeave={e=>(e.currentTarget.style.color='#64748b')}>← Voltar ao login</button>
      <div style={{ marginBottom:32 }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'5px 14px', borderRadius:100, background:'#e0e7ff', border:'1px solid #c7d2fe', marginBottom:20 }}>
          <span>🔑</span><span style={{ fontSize:11, fontWeight:800, color:'#6366f1', letterSpacing:'0.06em' }}>PRIMEIRO ACESSO</span>
        </div>
        <h2 style={{ fontFamily:"'Outfit',sans-serif", fontSize:30, fontWeight:900, color:'#0f172a', letterSpacing:'-0.02em', marginBottom:8 }}>Identificação</h2>
        <p style={{ fontSize:14, color:'#64748b', lineHeight:1.6 }}>Informe o <strong style={{ color:'#1e293b' }}>e-mail cadastrado</strong>, <strong style={{ color:'#1e293b' }}>matrícula do aluno</strong> ou <strong style={{ color:'#1e293b' }}>CPF</strong> para verificar seu acesso.</p>
      </div>
      <div className="login-card" style={cardStyle}>
        <form onSubmit={handleVerify} style={{ display:'flex', flexDirection:'column', gap:20 }}>
          <div>
            <Label text="E-mail Institucional, Celular ou Código" />
            <div style={{ position:'relative' }} suppressHydrationWarning>
              <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:15, color:'#94a3b8', pointerEvents:'none' }}>👤</span>
              <input type="text" value={faQuery} onChange={e=>{setFaQuery(e.target.value);setFaError('')}} placeholder="E-mail, CPF, ou Código do Aluno" autoFocus suppressHydrationWarning
                style={baseInputStyle} onFocus={focusOn} onBlur={focusOff} />
            </div>
            <p style={{ fontSize:11, color:'#94a3b8', marginTop:8 }}>Use o e-mail ou código/login vinculado ao seu cadastro escolar.</p>
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
        <div style={{ marginTop:20, padding:'12px 16px', borderRadius:12, background:'#eff6ff', border:'1px solid #bfdbfe' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:4, letterSpacing:'0.06em' }}>ℹ PRIMEIRO ACESSO</div>
          <div style={{ fontSize:12, color:'#475569' }}>
            Este fluxo é destinado a alunos e responsáveis para criação da primeira senha no app.
          </div>
        </div>
      </div>
    </div>
  )

  // ────────────────────────────────────────────────────────────────
  // STEP: Primeiro Acesso — Criar Senha
  // ────────────────────────────────────────────────────────────────
  const FirstAccessCreate = (
    <div className="login-form-wrapper" style={{ width:'100%', maxWidth:440, position:'relative', zIndex:1, animation:'fadeSlideIn 0.35s ease-out both', margin: '0 auto', paddingTop: 20 }}>
      <button type="button" onClick={()=>setStep('first_access_verify')} style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:13, color:'#64748b', background:'none', border:'none', cursor:'pointer', marginBottom:32, fontWeight:600 }}
        onMouseEnter={e=>(e.currentTarget.style.color='#0f172a')} onMouseLeave={e=>(e.currentTarget.style.color='#64748b')}>← Voltar</button>
      <div style={{ marginBottom:28 }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'5px 14px', borderRadius:100, background:'#dcfce7', border:'1px solid #86efac', marginBottom:20 }}>
          <span>✅</span><span style={{ fontSize:11, fontWeight:800, color:'#16a34a', letterSpacing:'0.06em' }}>CADASTRO ENCONTRADO</span>
        </div>
        {/* Usuário encontrado */}
        <div style={{ display:'flex', alignItems:'center', gap:14, padding:'16px 18px', borderRadius:14, background:'#f8fafc', border:'1px solid #e2e8f0', marginBottom:20 }}>
          <div style={{ width:44, height:44, borderRadius:13, background:'linear-gradient(135deg,#10b981,#059669)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:900, color:'#fff', flexShrink:0 }}>{faUser?.nome[0]}</div>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:'#0f172a' }}>{faUser?.nome}</div>
            <div style={{ fontSize:12, color:'#64748b' }}>{faUser?.cargo} • {faUser?.email}</div>
          </div>
          <span style={{ marginLeft:'auto', fontSize:20 }}>👍</span>
        </div>
        <h2 style={{ fontFamily:"'Outfit',sans-serif", fontSize:28, fontWeight:900, color:'#0f172a', marginBottom:6 }}>Crie sua senha</h2>
        <p style={{ fontSize:14, color:'#64748b' }}>Defina uma senha segura para acessar a plataforma.</p>
      </div>

      <div className="login-card" style={cardStyle}>
        {createSuccess ? (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{ fontSize:52, marginBottom:16 }}>🎉</div>
            <div style={{ fontFamily:"'Outfit',sans-serif", fontSize:22, fontWeight:900, color:'#0f172a', marginBottom:8 }}>Senha criada com sucesso!</div>
            <p style={{ fontSize:14, color:'#64748b' }}>Redirecionando para o login...</p>
            <div style={{ marginTop:20, height:4, borderRadius:2, background:'#e2e8f0', overflow:'hidden' }}>
              <div style={{ height:'100%', borderRadius:2, background:'linear-gradient(90deg,#10b981,#3b82f6)', width:'100%', animation:'progressFill 2.2s linear forwards' }} />
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreate} style={{ display:'flex', flexDirection:'column', gap:18 }}>
            <div>
              <Label text="E-mail de Cadastro *" />
              <div style={{ position:'relative' }} suppressHydrationWarning>
                <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:15, color:'#94a3b8', pointerEvents:'none' }}>✉</span>
                <input type="email" value={faRegEmail} onChange={e=>{setFaRegEmail(e.target.value);setCreateError('')}} placeholder="Preencha seu e-mail principal" required suppressHydrationWarning
                  style={{ ...baseInputStyle }} onFocus={focusOn} onBlur={focusOff} />
              </div>
              {faUser?.cargo === 'Aluno' && (
                <p style={{ fontSize:11, color:'#94a3b8', marginTop:6 }}>Seu login pode ser este e-mail ou sua matrícula: <strong style={{color:'#1e293b'}}>{faUser?.matricula || faUser?.id}</strong></p>
              )}
            </div>
            <div>
              <Label text="Nova Senha" />
              <div style={{ position:'relative' }} suppressHydrationWarning>
                <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:15, color:'#94a3b8', pointerEvents:'none' }}>🔒</span>
                <input type={showNewPw?'text':'password'} value={newPass} onChange={e=>{setNewPass(e.target.value);setCreateError('')}} placeholder="Mínimo 6 caracteres" suppressHydrationWarning
                  style={{ ...baseInputStyle, paddingRight:44 }} onFocus={focusOn} onBlur={focusOff} />
                <button type="button" onClick={()=>setShowNewPw(p=>!p)} style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:14, color:'#94a3b8' }}>{showNewPw?'🙈':'👁'}</button>
              </div>
              {newPass.length > 0 && (
                <div style={{ marginTop:8 }}>
                  <div style={{ height:4, borderRadius:2, background:'#e2e8f0', overflow:'hidden' }}>
                    <div style={{ height:'100%', borderRadius:2, background:strength.color, width:`${strength.pct}%`, transition:'all 0.4s' }} />
                  </div>
                  <div style={{ fontSize:11, color:strength.color, fontWeight:700, marginTop:4 }}>{strength.label}</div>
                </div>
              )}
            </div>
            <div>
              <Label text="Confirmar Senha" />
              <div style={{ position:'relative' }} suppressHydrationWarning>
                <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:15, color:'#94a3b8', pointerEvents:'none' }}>🔒</span>
                <input type={showConfPw?'text':'password'} value={confirmPass} onChange={e=>{setConfirmPass(e.target.value);setCreateError('')}} placeholder="Repita a senha" suppressHydrationWarning
                  style={{ ...baseInputStyle, paddingRight:44, borderColor: confirmPass&&confirmPass!==newPass?'#ef4444':'#e2e8f0' }} onFocus={focusOn} onBlur={focusOff} />
                <button type="button" onClick={()=>setShowConfPw(p=>!p)} style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:14, color:'#94a3b8' }}>{showConfPw?'🙈':'👁'}</button>
              </div>
              {confirmPass && (
                <div style={{ fontSize:11, marginTop:5, color: confirmPass===newPass?'#10b981':'#ef4444' }}>
                  {confirmPass===newPass ? '✓ Senhas coincidem' : '⚠ Senhas não coincidem'}
                </div>
              )}
            </div>
            <div style={{ padding:'12px 14px', borderRadius:10, background:'#f8fafc', border:'1px solid #e2e8f0' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#64748b', letterSpacing:'0.08em', marginBottom:8 }}>REQUISITOS</div>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {[
                  { label:'Mínimo 6 caracteres', ok: newPass.length>=6 },
                ].map(r => (
                  <div key={r.label} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12 }}>
                    <span style={{ color: !newPass.length?'#cbd5e1':r.ok?'#10b981':'#ef4444' }}>{!newPass.length?'○':r.ok?'✓':'✗'}</span>
                    <span style={{ color: !newPass.length?'#94a3b8':r.ok?'#1e293b':'#64748b' }}>{r.label}</span>
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
    <div className="login-form-wrapper" style={{ width:'100%', maxWidth:440, position:'relative', zIndex:1, animation:'fadeSlideIn 0.35s ease-out both', margin: '0 auto', paddingTop: 20 }}>
      <button type="button" onClick={goLogin} style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:13, color:'#64748b', background:'none', border:'none', cursor:'pointer', marginBottom:32, fontWeight:600 }}>← Cancelar setup</button>
      <div style={{ marginBottom:32 }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'5px 14px', borderRadius:100, background:'#dcfce7', border:'1px solid #86efac', marginBottom:20 }}>
          <span style={{ fontSize:10, fontWeight:900, color:'#16a34a' }}>SETUP INICIAL</span>
        </div>
        <h2 style={{ fontFamily:"'Outfit',sans-serif", fontSize:30, fontWeight:900, color:'#0f172a', letterSpacing:'-0.02em', marginBottom:8 }}>Configurar Master</h2>
        <p style={{ fontSize:14, color:'#64748b', lineHeight:1.6 }}>Crie a primeira conta de Administrador Geral para assumir o controle total do sistema.</p>
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
    <div className="login-form-wrapper" style={{ width:'100%', maxWidth:540, position:'relative', zIndex:1, animation:'fadeSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) both', margin: '0 auto', paddingTop: 20 }}>
      <div style={{ marginBottom:36, textAlign:'center' }}>
        <h2 style={{ fontFamily:"'Outfit',sans-serif", fontSize:32, fontWeight:900, color:'#0f172a', letterSpacing:'-0.02em', marginBottom:8 }}>Acesso Autorizado</h2>
        <p style={{ fontSize:15, color:'#64748b' }}>Bem-vindo. Onde você deseja entrar?</p>
      </div>

      <div style={{ display:'flex', gap:20, flexDirection: 'row' }}>
        <button type="button" 
          onClick={async () => {
             const p = pendingAuth?.perfil;
             let perfisList = DEFAULT_PERFIS;
             try {
               const res = await fetch('/api/configuracoes/perfis');
               if (res.ok) {
                 const data = await res.json();
                 if (Array.isArray(data) && data.length > 0) {
                   perfisList = data;
                 }
               }
             } catch (e) {}
             
             const perfilObj = perfisList?.find(x => x.nome === p);
             if (perfilObj?.bloqueadoGestaoEscolar) {
               setShowBlockModal(true);
               return;
             }
             if (p === 'Professor') window.location.href = '/professor';
             else window.location.href = '/dashboard';
          }}
          style={{ flex:1, padding:'32px 24px', borderRadius:24, background:'#ffffff', border:'1px solid #e2e8f0', cursor:'pointer', transition:'all 0.3s', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='#93c5fd'; e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 20px 40px rgba(0,0,0,0.06), 0 0 0 4px rgba(59,130,246,0.1)'}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='#e2e8f0'; e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 10px 30px rgba(0,0,0,0.02)'}}>
          <div style={{ width:64, height:64, borderRadius:20, background:'linear-gradient(135deg, #3b82f6, #2563eb)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, boxShadow:'0 10px 24px rgba(59,130,246,0.3)', color: '#fff' }}>🏢</div>
          <div>
            <div style={{ fontSize:18, fontWeight:800, color:'#0f172a', marginBottom:4 }}>Gestão Escolar</div>
            <div style={{ fontSize:12, color:'#64748b' }}>Sistema ERP Principal</div>
          </div>
        </button>

        <button type="button" 
          onClick={() => {
             const p = pendingAuth?.perfil;
             if (p === 'Diretor Geral' || pendingAuth?.cargo === 'Administrador Master') {
                 window.location.href = '/agenda-digital/selecionar-perfil-admin';
             } else {
                 window.location.href = '/agenda-digital/selecionar-aluno';
             }
          }}
          style={{ flex:1, padding:'32px 24px', borderRadius:24, background:'#ffffff', border:'1px solid #e2e8f0', cursor:'pointer', transition:'all 0.3s', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='#c4b5fd'; e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 20px 40px rgba(0,0,0,0.06), 0 0 0 4px rgba(139,92,246,0.1)'}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='#e2e8f0'; e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 10px 30px rgba(0,0,0,0.02)'}}>
          <div style={{ width:64, height:64, borderRadius:20, background:'linear-gradient(135deg, #8b5cf6, #6d28d9)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, boxShadow:'0 10px 24px rgba(139,92,246,0.3)', color: '#fff' }}>📱</div>
          <div>
            <div style={{ fontSize:18, fontWeight:800, color:'#0f172a', marginBottom:4 }}>Agenda Digital</div>
            <div style={{ fontSize:12, color:'#64748b' }}>Comunicação Diária</div>
          </div>
        </button>
      </div>
    </div>
  )

  // ────────────────────────────────────────────────────────────────
  // STEP: Escolher Contexto da Agenda (Duplo Perfil)
  // ────────────────────────────────────────────────────────────────
  const ChooseAgendaRoleContent = (
    <div className="login-form-wrapper" style={{ width:'100%', maxWidth:540, position:'relative', zIndex:1, animation:'fadeSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) both', margin: '0 auto', paddingTop: 20 }}>
      <button type="button" onClick={() => setStep('choose_system')} style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:13, color:'#64748b', background:'none', border:'none', cursor:'pointer', marginBottom:24, fontWeight:600 }}>← Voltar</button>
      
      <div style={{ marginBottom:36, textAlign:'center' }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'5px 14px', borderRadius:100, background:'#dcfce7', border:'1px solid #86efac', marginBottom:16 }}>
          <span style={{ fontSize:10, fontWeight:900, color:'#16a34a' }}>MÚLTIPLOS PERFIS DETECTADOS</span>
        </div>
        <h2 style={{ fontFamily:"'Outfit',sans-serif", fontSize:28, fontWeight:900, color:'#0f172a', letterSpacing:'-0.02em', marginBottom:8 }}>Acessar a Agenda como:</h2>
      </div>

      <div style={{ display:'flex', gap:20, flexDirection: 'row' }}>
        <button type="button" 
          onClick={() => { window.location.href = '/agenda-digital/selecionar-aluno'; }}
          style={{ flex:1, padding:'28px 24px', borderRadius:24, background:'#ffffff', border:'1px solid #e2e8f0', cursor:'pointer', transition:'all 0.3s', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='#86efac'; e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 20px 40px rgba(0,0,0,0.06), 0 0 0 4px rgba(16,185,129,0.1)'}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='#e2e8f0'; e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 10px 30px rgba(0,0,0,0.02)'}}>
          <div style={{ width:56, height:56, borderRadius:18, background:'linear-gradient(135deg, #10b981, #059669)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, boxShadow:'0 10px 24px rgba(16,185,129,0.3)' }}>👨‍👩‍👧‍👦</div>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:'#0f172a', marginBottom:4 }}>Família</div>
            <div style={{ fontSize:11, color:'#64748b' }}>Perfil de Pais/Responsáveis</div>
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
          style={{ flex:1, padding:'28px 24px', borderRadius:24, background:'#ffffff', border:'1px solid #e2e8f0', cursor:'pointer', transition:'all 0.3s', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='#fcd34d'; e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 20px 40px rgba(0,0,0,0.06), 0 0 0 4px rgba(245,158,11,0.1)'}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='#e2e8f0'; e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 10px 30px rgba(0,0,0,0.02)'}}>
          <div style={{ width:56, height:56, borderRadius:18, background:'linear-gradient(135deg, #f59e0b, #d97706)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, boxShadow:'0 10px 24px rgba(245,158,11,0.3)' }}>💼</div>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:'#0f172a', marginBottom:4 }}>Colaborador</div>
            <div style={{ fontSize:11, color:'#64748b' }}>Perfil Escolar Interno</div>
          </div>
        </button>
      </div>
    </div>
  )

  return (
    <div className="login-wrapper" style={{ display:'flex', minHeight:'100vh', fontFamily:"'Inter',sans-serif", overflow:'hidden' }}>
      <div className="login-right-panel" style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'20px', position:'relative', overflow:'hidden', overflowY:'auto', background: '#f8fafc' }}>
        
        {/* Soft Background Mesh/Gradients */}
        <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '60%', height: '50%', background: 'radial-gradient(circle, rgba(167, 139, 250, 0.15) 0%, transparent 60%)', filter: 'blur(60px)', zIndex: 0 }} />
        <div style={{ position: 'absolute', top: '10%', right: '-5%', width: '50%', height: '60%', background: 'radial-gradient(circle, rgba(56, 189, 248, 0.1) 0%, transparent 60%)', filter: 'blur(60px)', zIndex: 0 }} />
        <div style={{ position: 'absolute', bottom: '-10%', right: '20%', width: '60%', height: '50%', background: 'radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 60%)', filter: 'blur(80px)', zIndex: 0 }} />

        {/* Wavy lines SVG background */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.4, zIndex: 0, pointerEvents: 'none', backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100%25\' height=\'100%25\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 200 C300 0, 700 400, 1000 200\' fill=\'none\' stroke=\'%23c7d2fe\' stroke-width=\'1\' opacity=\'0.5\' /%3E%3Cpath d=\'M0 600 C400 800, 800 400, 1200 600\' fill=\'none\' stroke=\'%23bfdbfe\' stroke-width=\'1\' opacity=\'0.5\' /%3E%3C/svg%3E")', backgroundSize: 'cover' }} />

        <div style={{ width: '100%', position: 'relative', zIndex: 10 }}>
          {step === 'login'                && LoginContent}
          {step === 'first_access_verify'  && FirstAccessVerify}
          {step === 'first_access_create' && FirstAccessCreate}
          {step === 'setup_master' && SetupMasterContent}
          {step === 'choose_system' && ChooseSystemContent}
          {step === 'choose_agenda_role' && ChooseAgendaRoleContent}
        </div>
        
        {/* Modal de bloqueio */}
        {showBlockModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)', animation: 'fadeIn 0.3s ease-out' }} onClick={() => setShowBlockModal(false)} />
            <div style={{ position: 'relative', background: '#ffffff', padding: 40, borderRadius: 24, border: '1px solid #e2e8f0', boxShadow: '0 32px 80px rgba(0,0,0,0.1)', maxWidth: 440, width: '100%', textAlign: 'center', animation: 'scaleUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', border: '1px solid #fca5a5' }}>
                <span style={{ fontSize: 36 }}>🔒</span>
              </div>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 26, fontWeight: 900, color: '#0f172a', marginBottom: 12, letterSpacing: '-0.02em' }}>Acesso Restrito</h3>
              <p style={{ fontSize: 15, color: '#64748b', lineHeight: 1.6, marginBottom: 32 }}>
                Seu perfil atual (<strong style={{ color: '#0f172a' }}>{pendingAuth?.perfil}</strong>) não possui permissão para acessar o Sistema de Gestão Escolar. <br/><br/>
                Caso precise de acesso, entre em contato com a diretoria ou a equipe de TI.
              </p>
              <button onClick={() => setShowBlockModal(false)} style={{ width: '100%', padding: '16px', borderRadius: 14, background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 24px rgba(59,130,246,0.3)' }}>
                Entendi, voltar
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes spin  { to{transform:rotate(360deg)} }
        @keyframes scaleUp { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes fadeSlideIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmerBtn { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes progressFill { from{width:0%} to{width:100%} }
        input::placeholder { color: #cbd5e1 !important; font-weight: 400; }
        input:-webkit-autofill { -webkit-box-shadow:0 0 0 30px #ffffff inset !important; -webkit-text-fill-color:#1e293b !important; }
        
        .login-wrapper {
          background: #f8fafc;
        }
        
        /* Mobile Optimizaton for Login */
        @media (max-width: 768px) {
          .login-wrapper {
            flex-direction: column !important;
            overflow-y: auto !important;
          }
          .login-right-panel {
            padding: 20px 16px 40px 16px !important;
            justify-content: flex-start !important;
            align-items: stretch !important;
          }
          .login-card {
            padding: 24px 20px !important;
            border-radius: 20px !important;
            box-shadow: 0 16px 40px rgba(99, 102, 241, 0.08) !important;
          }
        }
      `}</style>
    </div>
  )
}
"""

with open('app/login/page.tsx', 'w') as f:
    f.write(top_part + new_styles)

