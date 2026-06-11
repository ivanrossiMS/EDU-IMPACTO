'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AtualizarSenha() {
  const [novaSenha, setNovaSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const router = useRouter();

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro('');

    const { error } = await supabase.auth.updateUser({
      password: novaSenha
    });

    if (error) {
      setErro(`Erro ao atualizar: ${error.message}`);
      setLoading(false);
    } else {
      alert('Senha atualizada com sucesso!');
      router.push('/login');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4" style={{ background: 'linear-gradient(145deg, #050a18 0%, #0a0f2e 30%, #0d1a3a 60%, #060d24 100%)' }}>
      <form onSubmit={handleUpdatePassword} className="w-full max-w-md rounded-[22px] p-9 shadow-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}>
        <div className="mb-6 flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30">
                <span className="text-xl">🔒</span>
            </div>
        </div>
        <h2 className="mb-2 text-center text-3xl font-black text-white tracking-tight font-['Outfit']">Criar Nova Senha</h2>
        <p className="mb-6 text-center text-sm text-white/40">Defina uma nova senha para sua conta.</p>
        
        {erro && <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-medium text-red-400">{erro}</div>}

        <div className="mb-6">
          <label className="mb-2 block text-xs font-bold tracking-wider text-white/45 uppercase">Nova Senha</label>
          <input
            type="password"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white outline-none transition-all placeholder:text-white/20 focus:border-emerald-500/60 focus:bg-emerald-500/5 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.12)]"
            placeholder="Mínimo de 6 caracteres"
          />
        </div>

        <button
          type="submit"
          disabled={loading || novaSenha.length < 6}
          className="w-full relative overflow-hidden rounded-xl border-none bg-gradient-to-br from-emerald-500 to-teal-600 p-4 text-[15px] font-bold tracking-wide text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(16,185,129,0.4)] disabled:cursor-not-allowed disabled:bg-white/5 disabled:from-transparent disabled:to-transparent disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none font-['Outfit']"
        >
          {loading ? 'Salvando...' : 'Salvar Nova Senha'}
        </button>
      </form>
    </div>
  );
}
