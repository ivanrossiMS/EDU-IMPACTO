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
      params.get('error_code') === 'otp_expired' ||
      hashParams.get('error_code') === 'otp_expired' ||
      window.sessionStorage?.getItem('edu_password_recovery_pending') === '1';

    // Prioridade 1: Se for fluxo de recuperação de senha genuíno
    if (isRecovery) {
      window.location.replace(`/atualizar-senha${search}${hash}`);
      return;
    }

    // Prioridade 2: Se for retorno de autenticação para um formulário de Gestão de Pessoas
    const pendingFormId =
      window.sessionStorage?.getItem('gp_form_auth_pending') ||
      window.localStorage?.getItem('gp_form_auth_pending');
    const pendingFormUrl =
      window.sessionStorage?.getItem('gp_form_return_url') ||
      window.localStorage?.getItem('gp_form_return_url') ||
      (pendingFormId ? `/gestao-pessoas/formularios/${pendingFormId}` : null);

    if (pendingFormUrl) {
      const cleanFormBase = pendingFormUrl.split('#')[0].split('?')[0];
      window.location.replace(`${cleanFormBase}${search}${hash}`);
      return;
    }

    // Prioridade 3: Próxima rota padrão (dashboard) ou rota especificada em ?next=
    const next = params.get('next');
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
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
