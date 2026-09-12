'use client'
import { LoadingGlass } from '@/components/LoadingGlass'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useApp } from '@/lib/context'
import { supabase } from '@/lib/supabase'
import { BookOpen, Sparkles } from 'lucide-react'

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
  const { currentUserPerfil, currentUser } = useApp()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Prevent execution if user is not loaded
    if (!currentUser) return;

    const perfil = currentUserPerfil || currentUser.perfil || ''
    const cargo = currentUser.cargo || ''
    const isAdmin = ADMIN_ROLES.includes(perfil) || ADMIN_ROLES.includes(cargo)
    const perfilDestino = searchParams.get('perfil_destino')
    const redirect = searchParams.get('redirect') || 'comunicados'
    const paramStr = searchParams.toString() ? `?${searchParams.toString()}` : ''
    
    // Se o destino for colaborador explicitamente
    if (perfilDestino === 'colaborador') {
      router.replace(`/agenda-digital/colaborador/${redirect}${paramStr}`);
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
      router.replace(`/agenda-digital/colaborador/${redirect}${paramStr}`);
      return;
    }

    const fetchSecureStudents = async () => {
      try {
        // Fast path para alunos que já tem o ID na sessão
        if (cargo === 'Aluno') {
           const directAlunoId = currentUser.aluno_id || (currentUser as any).user_metadata?.aluno_id;
           if (directAlunoId) {
             router.replace(`/agenda-digital/${directAlunoId}/${redirect}${paramStr}`);
             return;
           }
        }

        // Slow path seguro via API do backend (checa user_id ou vínculos)
        const url = `/api/agenda/meus-alunos`;
        const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length === 1 && data[0].id) {
            router.replace(`/agenda-digital/${data[0].id}/${redirect}${paramStr}`);
            return;
          }
          if (Array.isArray(data) && data.length === 0 && isStaff) {
            router.replace(`/agenda-digital/colaborador/${redirect}${paramStr}`);
            return;
          }
        }
        router.replace(`/agenda-digital/selecionar-aluno${paramStr}`);
      } catch (e) {
        console.error('Erro ao buscar alunos:', e);
        if (isStaff) {
          router.replace(`/agenda-digital/colaborador/${redirect}${paramStr}`);
        } else {
          router.replace(`/agenda-digital/selecionar-aluno${paramStr}`);
        }
      }
    };

    fetchSecureStudents();
  }, [currentUserPerfil, currentUser, router, searchParams])

  return <LoadingGlass />
}
