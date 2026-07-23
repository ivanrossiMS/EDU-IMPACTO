'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { KeyRound, Save, AlertCircle, Shield, Lock, BookOpen } from 'lucide-react';

export default function AtualizarSenha() {
  const [novaSenha, setNovaSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sessionValid, setSessionValid] = useState<boolean | null>(null); // null = verificando, false = inválido/erro, true = válido
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 1. Interceptar erros da hash do URL (ex: otp_expired)
      const hash = window.location.hash;
      const search = window.location.search;
      const params = new URLSearchParams(hash.startsWith('#') ? hash.substring(1) : (hash || search));
      const err = params.get('error_description') || params.get('error');
      const errCode = params.get('error_code');

      if (err || errCode) {
        console.error('[Auth Error] Error detected in URL on atualizar-senha:', errCode, err);
        if (errCode === 'otp_expired' || err?.toLowerCase().includes('expired') || err?.toLowerCase().includes('invalid')) {
          setErro('O link de recuperação expirou ou já foi utilizado. Por segurança, os links de redefinição são de uso único e expiram após 24 horas. Por favor, solicite um novo link.');
        } else {
          setErro(err || 'O link de recuperação de senha é inválido ou expirou.');
        }
        setSessionValid(false);
        return;
      }

      // 2. Verificar se há sessão activa ou aguardar Supabase estabelecer
      const checkAuth = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSessionValid(true);
          return;
        }

        // Se há access_token na URL, aguarda brevemente o Supabase inicializar a sessão
        if (window.location.hash.includes('access_token=')) {
          let attempts = 0;
          const interval = setInterval(async () => {
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            attempts++;
            if (currentSession) {
              setSessionValid(true);
              clearInterval(interval);
            } else if (attempts >= 10) {
              clearInterval(interval);
              setErro('A validação do token de acesso falhou ou expirou. Solicite um novo link.');
              setSessionValid(false);
            }
          }, 300);
          return;
        }

        // Caso contrário, bloqueia o acesso
        setErro('Acesso inválido. Esta página só pode ser acessada através de um link de recuperação de senha válido enviado por e-mail.');
        setSessionValid(false);
      };

      checkAuth();
    }
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro('');

    const { error } = await supabase.auth.updateUser({
      password: novaSenha
    });

    if (error) {
      setErro(`Falha ao atualizar: ${error.message}`);
      setLoading(false);
    } else {
      alert('Senha atualizada com sucesso! Você pode usar a nova senha para acessar sua conta.');
      router.push('/login');
    }
  };

  // Estado de carregamento inicial
  if (sessionValid === null) {
    return (
      <div 
        style={{ 
          minHeight: '100vh', 
          width: '100vw', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          backgroundColor: '#0A0F24', 
          fontFamily: 'var(--font-inter), -apple-system, sans-serif' 
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid rgba(16,185,129,0.2)', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <span style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 500 }}>Verificando link de acesso...</span>
        </div>
        <style dangerouslySetInnerHTML={{__html: `@keyframes spin { to { transform: rotate(360deg); } }`}} />
      </div>
    );
  }

  // Estado de erro de sessão / link expirado
  if (sessionValid === false) {
    return (
      <div 
        style={{ 
          minHeight: '100vh', 
          width: '100vw', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          position: 'relative', 
          overflow: 'hidden',
          backgroundColor: '#0A0F24', 
          fontFamily: 'var(--font-inter), -apple-system, sans-serif' 
        }}
      >
        {/* Background dots & glows */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.2, backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, width: '400px', height: '400px', borderRadius: '50%', filter: 'blur(100px)', zIndex: 0, pointerEvents: 'none', backgroundColor: 'rgba(239, 68, 68, 0.08)', transform: 'translate(20%, -20%)' }} />
        
        <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '500px', padding: '0 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          
          {/* Logo Section */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <BookOpen size={36} color="#ef4444" strokeWidth={2} />
              <span style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '1px', color: '#ffffff', fontFamily: 'var(--font-outfit), sans-serif', margin: 0, lineHeight: 1 }}>
                IMPACTO <span style={{ color: '#ef4444' }}>EDU</span>
              </span>
            </div>
            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', marginTop: '4px' }}>
              Sistema de Ensino
            </span>
          </div>

          {/* Main Card */}
          <div 
            style={{ 
              width: '100%', 
              borderRadius: '24px', 
              padding: '40px 32px', 
              position: 'relative', 
              overflow: 'hidden', 
              display: 'flex', 
              flexDirection: 'column',
              backgroundColor: 'rgba(15, 23, 42, 0.8)', 
              border: '1px solid rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
          >
            {/* Glowing Top Line */}
            <div style={{ position: 'absolute', top: 0, left: '20%', width: '60%', height: '2px', background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.9), transparent)', boxShadow: '0 0 20px rgba(239,68,68,0.9)' }} />

            {/* Error Icon */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px', marginTop: '8px' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px' }}>
                <Shield style={{ position: 'absolute', width: '100%', height: '100%', color: 'rgba(239, 68, 68, 0.25)' }} strokeWidth={1} />
                <AlertCircle style={{ width: '24px', height: '24px', color: '#ef4444', zIndex: 10 }} strokeWidth={2} />
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', filter: 'blur(16px)', backgroundColor: 'rgba(239, 68, 68, 0.25)' }} />
              </div>
            </div>

            {/* Titles */}
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', textAlign: 'center', marginBottom: '12px', fontFamily: 'var(--font-outfit), sans-serif', margin: '0 0 12px 0' }}>
              Link Expirado ou Inválido
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center', marginBottom: '32px', lineHeight: 1.6, margin: '0 0 32px 0' }}>
              {erro}
            </p>

            <button
              onClick={() => router.push('/esqueci-senha')}
              style={{ 
                width: '100%', 
                borderRadius: '16px', 
                padding: '18px', 
                fontWeight: 600, 
                fontSize: '15px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: '#ffffff', 
                border: 'none', 
                cursor: 'pointer',
                background: 'linear-gradient(90deg, #dc2626, #b91c1c)',
                boxShadow: '0 8px 20px rgba(239,68,68,0.2)',
                fontFamily: 'var(--font-inter), sans-serif',
                transition: 'all 0.2s'
              }}
            >
              Solicitar Novo Link de Acesso
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Estado normal: exibe o formulário de nova senha
  return (
    <div 
      style={{ 
        minHeight: '100vh', 
        width: '100vw', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        position: 'relative', 
        overflow: 'hidden',
        backgroundColor: '#0A0F24', 
        fontFamily: 'var(--font-inter), -apple-system, sans-serif' 
      }}
    >
      {/* Dotted Pattern Background */}
      <div 
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          opacity: 0.2,
          pointerEvents: 'none',
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Glow Orbs */}
      <div style={{ position: 'absolute', top: 0, right: 0, width: '400px', height: '400px', borderRadius: '50%', filter: 'blur(100px)', zIndex: 0, pointerEvents: 'none', backgroundColor: 'rgba(16, 185, 129, 0.15)', transform: 'translate(20%, -20%)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '400px', height: '400px', borderRadius: '50%', filter: 'blur(100px)', zIndex: 0, pointerEvents: 'none', backgroundColor: 'rgba(16, 185, 129, 0.15)', transform: 'translate(-20%, 20%)' }} />

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '500px', padding: '0 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        {/* Logo Section */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <BookOpen size={36} color="#10b981" strokeWidth={2} />
            <span style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '1px', color: '#ffffff', fontFamily: 'var(--font-outfit), sans-serif', margin: 0, lineHeight: 1 }}>
              IMPACTO <span style={{ color: '#10b981' }}>EDU</span>
            </span>
          </div>
          <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', marginTop: '4px' }}>
            Sistema de Ensino
          </span>
        </div>

        {/* Main Card */}
        <div 
          style={{ 
            width: '100%', 
            borderRadius: '24px', 
            padding: '40px 32px', 
            position: 'relative', 
            overflow: 'hidden', 
            display: 'flex', 
            flexDirection: 'column',
            backgroundColor: 'rgba(15, 23, 42, 0.8)', 
            border: '1px solid rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}
        >
          {/* Glowing Top Line */}
          <div style={{ position: 'absolute', top: 0, left: '20%', width: '60%', height: '2px', background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.9), transparent)', boxShadow: '0 0 20px rgba(16,185,129,0.9)' }} />

          {/* Shield Icon */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px', marginTop: '8px' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px' }}>
              <Shield style={{ position: 'absolute', width: '100%', height: '100%', color: 'rgba(16, 185, 129, 0.25)' }} strokeWidth={1} />
              <Lock style={{ width: '24px', height: '24px', color: '#ffffff', zIndex: 10 }} strokeWidth={2} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', filter: 'blur(16px)', backgroundColor: 'rgba(16, 185, 129, 0.25)' }} />
            </div>
          </div>

          {/* Titles */}
          <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#ffffff', textAlign: 'center', marginBottom: '12px', fontFamily: 'var(--font-outfit), sans-serif', margin: '0 0 12px 0' }}>
            Criar Nova Senha
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center', marginBottom: '32px', lineHeight: 1.6, margin: '0 0 32px 0' }}>
            Você já pode definir uma nova senha para a sua conta. Escolha uma senha segura e fácil de lembrar.
          </p>

          {erro && (
            <div 
              style={{ 
                marginBottom: '24px', 
                display: 'flex', 
                alignItems: 'flex-start', 
                gap: '12px', 
                borderRadius: '12px', 
                padding: '16px', 
                fontSize: '14px', 
                fontWeight: 500,
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#f87171'
              }}
            >
              <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span style={{ lineHeight: 1.5 }}>{erro}</span>
            </div>
          )}

          <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', margin: 0 }}>
            {/* Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              <label style={{ fontSize: '12px', fontWeight: 800, color: '#10b981', letterSpacing: '1px', textTransform: 'uppercase', marginLeft: '4px' }}>
                NOVA SENHA
              </label>
              <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
                <div style={{ position: 'absolute', left: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <KeyRound size={20} color="#94a3b8" />
                </div>
                <input
                  type="password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  required
                  minLength={6}
                  style={{ 
                    width: '100%', 
                    borderRadius: '16px', 
                    padding: '16px 16px 16px 48px', 
                    fontSize: '15px', 
                    color: '#ffffff', 
                    outline: 'none', 
                    backgroundColor: 'rgba(30, 41, 59, 0.9)', 
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Mínimo de 6 caracteres"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || novaSenha.length < 6}
              style={{ 
                width: '100%', 
                borderRadius: '16px', 
                padding: '18px', 
                fontWeight: 600, 
                fontSize: '15px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '12px', 
                color: '#ffffff', 
                border: 'none', 
                cursor: (loading || novaSenha.length < 6) ? 'not-allowed' : 'pointer',
                opacity: (loading || novaSenha.length < 6) ? 0.7 : 1,
                background: 'linear-gradient(90deg, #059669, #0d9488)',
                boxShadow: '0 8px 20px rgba(16,185,129,0.3)',
                fontFamily: 'var(--font-inter), sans-serif',
                transition: 'all 0.2s'
              }}
            >
              {loading ? (
                <div style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#ffffff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              ) : (
                <Save size={18} />
              )}
              <span>{loading ? 'Salvando...' : 'Salvar Nova Senha'}</span>
            </button>
          </form>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
}
