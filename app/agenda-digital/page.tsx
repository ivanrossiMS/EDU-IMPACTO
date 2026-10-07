'use client'
import { LoadingGlass } from '@/components/LoadingGlass'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useApp } from '@/lib/context'
import { supabase } from '@/lib/supabase'
import { BookOpen, Sparkles } from 'lucide-react'

import { PENDING_PUSH_ROUTE_KEY } from '@/components/providers/GlobalNotificationProvider'
import { getMeusAlunosDedup } from '@/lib/api/meusAlunosClient'

const ADMIN_ROLES = ['Direção', 'Administrador', 'Diretor Geral', 'Administrador Master']

export default function AgendaDigitalIndex() {
  return (
    <Suspense fallback={<LoadingGlass />}>
      <AgendaDigitalIndexContent />
    </Suspense>
  )
}

function AgendaDigitalIndexContent() {
  const router = useRouter()
  const { currentUserPerfil, currentUser, hydrated } = useApp()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!hydrated) return;

    // Se o usuário não estiver autenticado, redireciona de forma limpa para /login
    if (!currentUser) {
      router.replace('/login');
      return;
    }

    // 0. Prioridade máxima: Notificação Push pendente
    const checkPendingPush = async () => {
      let pendingRoute =
        (typeof window !== 'undefined' ? (window as any).__EDU_PENDING_PUSH_ROUTE__ : null) ||
        (typeof window !== 'undefined' ? localStorage.getItem(PENDING_PUSH_ROUTE_KEY) : null);

      if (!pendingRoute) {
        try {
          const { Preferences } = await import('@capacitor/preferences');
          const { value } = await Preferences.get({ key: PENDING_PUSH_ROUTE_KEY });
          if (value) pendingRoute = value;
        } catch {}
      }

      if (pendingRoute && typeof pendingRoute === 'string') {
        let cleanDest = pendingRoute.trim();
        try {
          if (cleanDest.startsWith('http://') || cleanDest.startsWith('https://')) {
            const u = new URL(cleanDest);
            cleanDest = u.pathname + u.search + u.hash;
          } else {
            cleanDest = cleanDest.replace(/^[a-zA-Z0-9._-]+:\/*/, '/');
          }
        } catch (_) {}

        if (!cleanDest.startsWith('/')) cleanDest = '/' + cleanDest;

        if (cleanDest.startsWith('/agenda-digital/selecionar-aluno') || cleanDest === '/agenda-digital' || cleanDest === '/') {
          if (typeof window !== 'undefined') {
            delete (window as any).__EDU_PENDING_PUSH_ROUTE__;
            try {
              localStorage.removeItem(PENDING_PUSH_ROUTE_KEY);
            } catch (_) {}
          }
          return false;
        }

        if (cleanDest) {
          console.log(`🚀 [AgendaDigitalIndex] Rota pendente identificada: ${cleanDest}. Redirecionando...`);
          if (typeof window !== 'undefined') {
            delete (window as any).__EDU_PENDING_PUSH_ROUTE__;
            try {
              localStorage.removeItem(PENDING_PUSH_ROUTE_KEY);
            } catch (_) {}
          }
          router.replace(cleanDest);
          return true;
        }
      }
      return false;
    };

    // Failsafe de resolução: se em 2.8s nenhuma rota foi resolvida, direciona para selecionar-aluno sem travar a tela
    const failsafeTimer = setTimeout(() => {
      console.warn('[AgendaDigitalIndex] Failsafe acionado por lentidão de rede: navegando para selecionar-aluno...');
      const paramStr = searchParams.toString() ? `?${searchParams.toString()}` : ''
      router.replace(`/agenda-digital/selecionar-aluno${paramStr}`);
    }, 2800);

    checkPendingPush().then((handled) => {
      if (handled) {
        clearTimeout(failsafeTimer);
        return;
      }

      const perfil = currentUserPerfil || currentUser.perfil || ''
      const cargo = currentUser.cargo || ''
      const isAdmin = ADMIN_ROLES.includes(perfil) || ADMIN_ROLES.includes(cargo)
      const perfilDestino = searchParams.get('perfil_destino')
      const redirect = searchParams.get('redirect') || 'comunicados'
      const paramStr = searchParams.toString() ? `?${searchParams.toString()}` : ''
      
      // Se o destino for colaborador explicitamente
      if (perfilDestino === 'colaborador') {
        clearTimeout(failsafeTimer);
        router.replace(`/agenda-digital/colaborador/${redirect}${paramStr}`);
        return;
      }
      
      if (isAdmin) {
        clearTimeout(failsafeTimer);
        if (perfil === 'Diretor Geral' || cargo === 'Administrador Master' || perfil === 'Administrador') {
          router.replace('/agenda-digital/selecionar-perfil-admin')
        } else {
          router.replace(searchParams.get('redirect') ? `/agenda-digital/admin/${searchParams.get('redirect')}` : '/agenda-digital/admin')
        }
        return;
      }

      // Para colaboradores que NÃO são alunos nem família
      const isStaff = !['Família', 'Responsável', 'Aluno'].includes(perfil) && !['Responsável', 'Aluno'].includes(cargo);
      const hasDualRole = isStaff && Boolean(currentUser.hasDualRole || currentUser.responsavel_id);

      // Se é colaborador puro (sem filhos/responsável vinculados), vai direto para colaborador sem esperar
      if (isStaff && !hasDualRole) {
        clearTimeout(failsafeTimer);
        router.replace(`/agenda-digital/colaborador/${redirect}${paramStr}`);
        return;
      }

      const fetchSecureStudents = async () => {
        try {
          // Fast path para alunos que já tem o ID na sessão
          if (cargo === 'Aluno') {
             const directAlunoId = currentUser.aluno_id || (currentUser as any).user_metadata?.aluno_id;
             if (directAlunoId) {
               clearTimeout(failsafeTimer);
               router.replace(`/agenda-digital/${directAlunoId}/${redirect}${paramStr}`);
               return;
             }
          }

          // Cache instantâneo do localStorage: redireciona imediatamente sem travar na tela de loading
          const userCacheKey = `edu-meus-alunos-${currentUser.id}`;
          try {
            const cached = localStorage.getItem(userCacheKey);
            if (cached) {
              const parsed = JSON.parse(cached);
              const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.data) ? parsed.data : null);
              if (list && list.length === 1 && list[0]?.id) {
                clearTimeout(failsafeTimer);
                router.replace(`/agenda-digital/${list[0].id}/${redirect}${paramStr}`);
                return;
              }
              if (list && list.length > 1) {
                clearTimeout(failsafeTimer);
                router.replace(`/agenda-digital/selecionar-aluno${paramStr}`);
                return;
              }
            }
          } catch (_) {}

          // Chamada otimizada e deduplicada ao backend
          const data = await getMeusAlunosDedup();
          clearTimeout(failsafeTimer);
          if (Array.isArray(data) && data.length === 1 && data[0].id) {
            try {
              localStorage.setItem(userCacheKey, JSON.stringify(data));
            } catch (_) {}
            router.replace(`/agenda-digital/${data[0].id}/${redirect}${paramStr}`);
            return;
          }
          if (Array.isArray(data) && data.length === 0 && isStaff) {
            router.replace(`/agenda-digital/colaborador/${redirect}${paramStr}`);
            return;
          }
          if (Array.isArray(data) && data.length > 1) {
            try {
              localStorage.setItem(userCacheKey, JSON.stringify(data));
            } catch (_) {}
          }
          router.replace(`/agenda-digital/selecionar-aluno${paramStr}`);
        } catch (e) {
          clearTimeout(failsafeTimer);
          console.error('Erro ao buscar alunos:', e);
          if (isStaff) {
            router.replace(`/agenda-digital/colaborador/${redirect}${paramStr}`);
          } else {
            router.replace(`/agenda-digital/selecionar-aluno${paramStr}`);
          }
        }
      };

      fetchSecureStudents();
    });

    return () => clearTimeout(failsafeTimer);
  }, [currentUserPerfil, currentUser, router, searchParams, hydrated])

  return (
    <div style={{ minHeight: '100dvh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <LoadingGlass statusText="Iniciando Agenda Digital..." />
    </div>
  )
}
