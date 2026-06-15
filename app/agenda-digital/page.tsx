'use client'
import { LoadingGlass } from '@/components/LoadingGlass'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useApp } from '@/lib/context'
import { supabase } from '@/lib/supabase'
import { BookOpen, Sparkles } from 'lucide-react'

const ADMIN_PERFIS = ['Diretor Geral', 'Coordenador', 'Secretária']

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
    if (!currentUserPerfil || !currentUser) return;

    const isAdmin = ADMIN_PERFIS.includes(currentUserPerfil)
    const redirect = searchParams.get('redirect') || 'comunicados'
    const paramStr = searchParams.toString() ? `?${searchParams.toString()}` : ''
    
    if (isAdmin) {
      if (currentUserPerfil === 'Diretor Geral' || currentUser?.cargo === 'Administrador Master') {
        router.replace('/agenda-digital/selecionar-perfil-admin')
      } else {
        router.replace(searchParams.get('redirect') ? `/agenda-digital/admin/${searchParams.get('redirect')}` : '/agenda-digital/admin')
      }
    } else {
      if (currentUser?.cargo === 'Aluno') {
        const directAlunoId = currentUser.aluno_id || (currentUser as any).user_metadata?.aluno_id
        
        // Fast path: if we already have the ID, redirect immediately!
        if (directAlunoId) {
          router.replace(`/agenda-digital/${directAlunoId}/${redirect}${paramStr}`)
          return
        }

        // Slow path: Only fetch from DB if we don't have the ID, and ONLY fetch one specific record
        const fetchAlunoId = async () => {
          try {
            const nomeLower = (currentUser.nome || '').trim()
            if (!nomeLower) {
              router.replace(`/agenda-digital/selecionar-aluno${paramStr}`)
              return
            }
            
            const { data, error } = await supabase
              .from('alunos')
              .select('id')
              .ilike('nome', nomeLower)
              .limit(1)
              .single()
              
            if (data && data.id) {
              router.replace(`/agenda-digital/${data.id}/${redirect}${paramStr}`)
            } else {
              router.replace(`/agenda-digital/selecionar-aluno${paramStr}`)
            }
          } catch (e) {
            console.error('Error fetching aluno ID', e)
            router.replace(`/agenda-digital/selecionar-aluno${paramStr}`)
          }
        }
        
        fetchAlunoId()
        return
      }
      // Check if user is Responsável and has only one child using the same logic as selecionar-aluno
      const fetchResponsavelChildren = async () => {
        try {
          const respId = (currentUser as any)?.responsavel_id || (currentUser as any)?.user_metadata?.responsavel_id || '';
          const emailBusca = (currentUser?.email || '').toLowerCase().trim();
          const nomeBusca = (currentUser?.nome || '').toLowerCase().trim();

          const url = `/api/agenda/meus-alunos?respId=${encodeURIComponent(respId)}&email=${encodeURIComponent(emailBusca)}&nome=${encodeURIComponent(nomeBusca)}`;
          const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length === 1 && data[0].id) {
              router.replace(`/agenda-digital/${data[0].id}/${redirect}${paramStr}`);
              return;
            }
          }
          router.replace(`/agenda-digital/selecionar-aluno${paramStr}`);
        } catch (e) {
          router.replace(`/agenda-digital/selecionar-aluno${paramStr}`);
        }
      }
      
      fetchResponsavelChildren()
    }
  }, [currentUserPerfil, currentUser, router, searchParams])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      width: '100%',
      background: 'hsl(var(--bg-main))',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: '#ffffff',
        border: '1px solid rgba(0,0,0,0.05)',
        borderRadius: '24px',
        padding: '40px 48px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
        maxWidth: '320px',
        width: '90%',
        textAlign: 'center'
      }}>
        <LoadingGlass />
      </div>
    </div>
  )
}
