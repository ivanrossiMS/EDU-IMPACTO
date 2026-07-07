'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Mail, ArrowLeft, Send, CheckCircle2, AlertCircle, Shield, Lock, HelpCircle, BookOpen } from 'lucide-react';
import { BackgroundEffects } from '@/components/ui/LoginBackground';

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
      setMensagem({ tipo: 'sucesso', texto: 'Link seguro de recuperação enviado para o seu e-mail! Pode demorar alguns minutos para chegar.' });
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
      <BackgroundEffects />

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '500px', padding: '0 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        {/* Logo Section */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width:36, height:36, borderRadius:12, background:'linear-gradient(135deg, #3b82f6, #8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 8px 24px rgba(59,130,246,0.4)', overflow: 'hidden' }}>
              <img src="/logo-impacto.png" alt="Logo Impacto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
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
            flexDirection: 'column',
            gap: '16px',
            backgroundColor: 'rgba(15, 23, 42, 0.6)', 
            border: '1px solid rgba(255, 255, 255, 0.05)',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0, backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <HelpCircle size={24} color="#3b82f6" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                Precisa de ajuda?
              </span>
              <span style={{ fontSize: '12px', lineHeight: 1.5, color: '#94a3b8' }}>
                Entre em contato com nossa equipe através do WhatsApp.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => window.open('https://wa.me/556730286316?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20para%20recuperar%20minha%20senha%20no%20IMPACTO-EDU', '_blank')}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              backgroundColor: '#25D366',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(37,211,102,0.15)',
              transition: 'all 0.2s',
              fontFamily: 'var(--font-inter), -apple-system, sans-serif'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(37,211,102,0.25)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(37,211,102,0.15)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.347-.272.297-1.04 1.016-1.04 2.479 0 1.463 1.065 2.876 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
            </svg>
            Solicitar nova senha
          </button>
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
