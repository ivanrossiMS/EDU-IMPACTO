'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Mail, ArrowLeft, Send, CheckCircle2, AlertCircle, Shield, Lock, HelpCircle, BookOpen } from 'lucide-react';

export default function EsqueciSenha() {
  const [email, setEmail] = useState('');
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro', texto: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensagem(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/atualizar-senha`,
    });

    if (error) {
      setMensagem({ tipo: 'erro', texto: error.message });
    } else {
      setMensagem({ tipo: 'sucesso', texto: 'Link seguro de recuperação enviado para o seu e-mail!' });
    }
    
    setLoading(false);
  };

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
      <div style={{ position: 'absolute', top: 0, right: 0, width: '400px', height: '400px', borderRadius: '50%', filter: 'blur(100px)', zIndex: 0, pointerEvents: 'none', backgroundColor: 'rgba(29, 78, 216, 0.15)', transform: 'translate(20%, -20%)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '400px', height: '400px', borderRadius: '50%', filter: 'blur(100px)', zIndex: 0, pointerEvents: 'none', backgroundColor: 'rgba(29, 78, 216, 0.15)', transform: 'translate(-20%, 20%)' }} />

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '500px', padding: '0 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        {/* Logo Section */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <BookOpen size={36} color="#3b82f6" strokeWidth={2} />
            <span style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '1px', color: '#ffffff', fontFamily: 'var(--font-outfit), sans-serif', margin: 0, lineHeight: 1 }}>
              IMPACTO <span style={{ color: '#3b82f6' }}>EDU</span>
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
          <div style={{ position: 'absolute', top: 0, left: '20%', width: '60%', height: '2px', background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.9), transparent)', boxShadow: '0 0 20px rgba(59,130,246,0.9)' }} />

          {/* Shield Icon */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px', marginTop: '8px' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px' }}>
              <Shield style={{ position: 'absolute', width: '100%', height: '100%', color: 'rgba(59, 130, 246, 0.25)' }} strokeWidth={1} />
              <Lock style={{ width: '24px', height: '24px', color: '#ffffff', zIndex: 10 }} strokeWidth={2} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', filter: 'blur(16px)', backgroundColor: 'rgba(59, 130, 246, 0.25)' }} />
            </div>
          </div>

          {/* Titles */}
          <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#ffffff', textAlign: 'center', marginBottom: '12px', fontFamily: 'var(--font-outfit), sans-serif', margin: '0 0 12px 0' }}>
            Recuperar Senha
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center', marginBottom: '32px', lineHeight: 1.6, margin: '0 0 32px 0' }}>
            Não se preocupe! Informe seu e-mail e enviaremos as instruções
            para você voltar a acessar sua conta.
          </p>

          {mensagem && (
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
                backgroundColor: mensagem.tipo === 'erro' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                border: `1px solid ${mensagem.tipo === 'erro' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                color: mensagem.tipo === 'erro' ? '#f87171' : '#34d399'
              }}
            >
              {mensagem.tipo === 'erro' ? <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} /> : <CheckCircle2 size={20} style={{ flexShrink: 0, marginTop: '2px' }} />}
              <span style={{ lineHeight: 1.5 }}>{mensagem.texto}</span>
            </div>
          )}

          <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', margin: 0 }}>
            {/* Email Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              <label style={{ fontSize: '12px', fontWeight: 800, color: '#3b82f6', letterSpacing: '1px', textTransform: 'uppercase', marginLeft: '4px' }}>
                E-MAIL CADASTRADO
              </label>
              <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
                <div style={{ position: 'absolute', left: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <Mail size={20} color="#94a3b8" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
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
                  placeholder="exemplo@escola.com.br"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
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
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                background: 'linear-gradient(90deg, #2563eb, #4f46e5)',
                boxShadow: '0 8px 20px rgba(59,130,246,0.3)',
                fontFamily: 'var(--font-inter), sans-serif',
                transition: 'all 0.2s'
              }}
            >
              {loading ? (
                <div style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#ffffff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              ) : (
                <Send size={18} />
              )}
              <span>{loading ? 'Enviando...' : 'Enviar instruções'}</span>
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '28px 0', width: '100%' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.08)' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', color: '#64748b' }}>
              OU
            </span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.08)' }} />
          </div>

          {/* Back to Login Link */}
          <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <button
              type="button"
              onClick={() => router.push('/login')}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                fontSize: '14px', 
                fontWeight: 600, 
                backgroundColor: 'transparent', 
                border: 'none', 
                cursor: 'pointer',
                color: '#3b82f6',
                padding: '8px'
              }}
            >
              <ArrowLeft size={16} />
              Voltar para o login
            </button>
          </div>
        </div>

        {/* Support Box */}
        <div 
          style={{ 
            marginTop: '24px', 
            width: '100%', 
            borderRadius: '20px', 
            padding: '20px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '16px',
            backgroundColor: 'rgba(15, 23, 42, 0.6)', 
            border: '1px solid rgba(255, 255, 255, 0.05)',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0, backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <HelpCircle size={24} color="#3b82f6" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
              Precisa de ajuda?
            </span>
            <span style={{ fontSize: '12px', lineHeight: 1.5, color: '#94a3b8' }}>
              Entre em contato com nossa equipe através do suporte da sua instituição.
            </span>
          </div>
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
