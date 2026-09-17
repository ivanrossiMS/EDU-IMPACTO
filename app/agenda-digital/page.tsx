'use client'
import { LoadingGlass } from '@/components/LoadingGlass'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useApp } from '@/lib/context'
import { supabase } from '@/lib/supabase'
import { BookOpen, Sparkles } from 'lucide-react'

import { PENDING_PUSH_ROUTE_KEY } from '@/components/providers/GlobalNotificationProvider'

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

        if (cleanDest && cleanDest !== '/' && cleanDest !== '/agenda-digital' && cleanDest !== '/agenda-digital/selecionar-aluno') {
          console.log(`🚀 [AgendaDigitalIndex] Rota pendente identificada: ${cleanDest}. Redirecionando...`);
          window.location.replace(cleanDest);
          return true;
        }
      }
      return false;
    };

    checkPendingPush().then((handled) => {
      if (handled) return;

      const perfil = currentUserPerfil || currentUser.perfil || ''
      const cargo = currentUser.cargo || ''
      const isAdmin = ADMIN_ROLES.includes(perfil) || ADMIN_ROLES.includes(cargo)
      const perfilDestino = searchParams.get('perfil_destino')
      const redirect = searchParams.get('redirect') || 'comunicados'
      const paramStr = searchParams.toString() ? `?${searchParams.toString()}` : ''
      
      // Se o destino for colaborador explicitamente
      if (perfilDestino === 'colaborador') {
        window.location.replace(`/agenda-digital/colaborador/${redirect}${paramStr}`);
        return;
      }
      
      if (isAdmin) {
        if (perfil === 'Diretor Geral' || cargo === 'Administrador Master' || perfil === 'Administrador') {
          router.replace('/agenda-digital/selecionar-perfil-admin')
        } else {
          router.replace(searchParams.get('redirect') ? `/agenda-digital/admin/${searchParams.get('redirect')}` : '/agenda-digital/admin')
        }
        return;
      }

      // Para colaboradores que NÃO são alunos nem família
      const isStaff = !['Família', 'Responsável', 'Aluno'].includes(perfil) && !['Responsável', 'Aluno'].includes(cargo);
      const hasDualRole = Boolean(currentUser.hasDualRole || currentUser.responsavel_id);

      // Se é colaborador puro (sem filhos/responsável vinculados), vai direto para colaborador sem esperar
      if (isStaff && !hasDualRole) {
        window.location.replace(`/agenda-digital/colaborador/${redirect}${paramStr}`);
        return;
      }

      const fetchSecureStudents = async () => {
        try {
          // Fast path para alunos que já tem o ID na sessão
          if (cargo === 'Aluno') {
             const directAlunoId = currentUser.aluno_id || (currentUser as any).user_metadata?.aluno_id;
             if (directAlunoId) {
               window.location.replace(`/agenda-digital/${directAlunoId}/${redirect}${paramStr}`);
               return;
             }
          }

          // Slow path seguro via API do backend (checa user_id ou vínculos)
          const url = `/api/agenda/meus-alunos`;
          const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length === 1 && data[0].id) {
              window.location.replace(`/agenda-digital/${data[0].id}/${redirect}${paramStr}`);
              return;
            }
            if (Array.isArray(data) && data.length === 0 && isStaff) {
              window.location.replace(`/agenda-digital/colaborador/${redirect}${paramStr}`);
              return;
            }
          }
          router.replace(`/agenda-digital/selecionar-aluno${paramStr}`);
        } catch (e) {
          console.error('Erro ao buscar alunos:', e);
          if (isStaff) {
            window.location.replace(`/agenda-digital/colaborador/${redirect}${paramStr}`);
          } else {
            router.replace(`/agenda-digital/selecionar-aluno${paramStr}`);
          }
        }
      };

      fetchSecureStudents();
    });
  }, [currentUserPerfil, currentUser, router, searchParams])

  return <LoadingGlass />
}
