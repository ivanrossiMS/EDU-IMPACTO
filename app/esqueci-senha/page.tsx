'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function EsqueciSenha() {
  const [email, setEmail] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensagem('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/atualizar-senha`,
    });

    if (error) {
      setMensagem(`Erro: ${error.message}`);
    } else {
      setMensagem('Verifique seu e-mail! Enviamos um link de recuperação para você.');
    }
    
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4" style={{ background: 'linear-gradient(145deg, #050a18 0%, #0a0f2e 30%, #0d1a3a 60%, #060d24 100%)' }}>
      <form onSubmit={handleResetPassword} className="w-full max-w-md rounded-[22px] p-9 shadow-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}>
        <h2 className="mb-2 text-3xl font-black text-white tracking-tight font-['Outfit']">Recuperar Senha</h2>
        <p className="mb-6 text-sm text-white/40">Informe seu e-mail cadastrado para receber o link.</p>
        
        {mensagem && (
          <div className={`mb-6 rounded-xl p-4 text-sm font-medium ${mensagem.startsWith('Erro') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
            {mensagem}
          </div>
        )}

        <div className="mb-6">
          <label className="mb-2 block text-xs font-bold tracking-wider text-white/45 uppercase">Seu E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white outline-none transition-all placeholder:text-white/20 focus:border-blue-500/60 focus:bg-blue-500/5 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)]"
            placeholder="exemplo@escola.com.br"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full relative overflow-hidden rounded-xl border-none bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 p-4 text-[15px] font-bold tracking-wide text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(59,130,246,0.5)] disabled:cursor-not-allowed disabled:bg-white/5 disabled:from-transparent disabled:to-transparent disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none font-['Outfit']"
        >
          {loading ? 'Enviando...' : 'Enviar link de recuperação'}
        </button>

        <div className="mt-8 text-center">
          <button 
            type="button" 
            onClick={() => router.push('/login')}
            className="text-sm font-semibold text-white/40 transition-colors hover:text-white/70"
          >
            ← Voltar para o login
          </button>
        </div>
      </form>
    </div>
  );
}
