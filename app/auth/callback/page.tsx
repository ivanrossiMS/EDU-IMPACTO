'use client';

import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

export default function AuthCallbackPage() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const search = window.location.search || '';
    const hash = window.location.hash || '';
    const params = new URLSearchParams(search);
    const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);

    const isRecovery =
      params.get('type') === 'recovery' ||
      hashParams.get('type') === 'recovery' ||
      params.has('token_hash') ||
      hashParams.has('token_hash') ||
      params.has('error_code') ||
      hashParams.has('error_code');

    if (isRecovery) {
      window.location.replace(`/atualizar-senha${search}${hash}`);
      return;
    }

    const next = params.get('next') || '/atualizar-senha';
    const safeNext = next.startsWith('/') ? next : '/atualizar-senha';
    window.location.replace(`${safeNext}${search}${hash}`);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f6f8]">
      <div className="flex flex-col items-center gap-3 text-gray-600">
        <RefreshCw className="w-8 h-8 animate-spin text-[#0f52ba]" />
        <p className="text-sm font-medium">Redirecionando com segurança...</p>
      </div>
    </div>
  );
}
