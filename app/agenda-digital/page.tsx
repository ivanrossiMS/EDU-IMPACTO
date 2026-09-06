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

    const perfil = String(currentUserPerfil || currentUser?.perfil || '').toLowerCase().trim()
    const cargo = String(currentUser?.cargo || '').toLowerCase().trim()
    const isFamilyOrStudent =
      perfil === 'família' ||
      perfil === 'familia' ||
      perfil === 'responsável' ||
      perfil === 'responsavel' ||
      perfil === 'aluno' ||
      cargo === 'responsável' ||
      cargo === 'responsavel' ||
      cargo === 'aluno'

    const redirect = searchParams.get('redirect')
    const paramStr = searchParams.toString() ? `?${searchParams.toString()}` : ''

    // Se for colaborador ou administrador:
    if (!isFamilyOrStudent) {
      if (redirect) {
        // Notificação ou deep link institucional direto: NUNCA parar em tela de seleção!
        router.replace(`/agenda-digital/colaborador/${redirect}${paramStr}`)
        return
      }

      const isAdmin = ADMIN_PERFIS.includes(currentUserPerfil)
      if (currentUserPerfil === 'Diretor Geral' || currentUser?.cargo === 'Administrador Master') {
        router.replace('/agenda-digital/selecionar-perfil-admin')
      } else if (isAdmin) {
        router.replace('/agenda-digital/admin')
      } else {
        router.replace('/agenda-digital/colaborador/comunicados')
      }
      return
    }

    // Se for família ou aluno:
    const targetSection = redirect || 'comunicados'
    const fetchSecureStudents = async () => {
      try {
        // Fast path para alunos que já tem o ID na sessão
        if (currentUser?.cargo === 'Aluno') {
          const directAlunoId = currentUser.aluno_id || (currentUser as any).user_metadata?.aluno_id
          if (directAlunoId) {
            router.replace(`/agenda-digital/${directAlunoId}/${targetSection}${paramStr}`)
            return
          }
        }

        // Slow path seguro via API do backend (checa user_id ou vínculos)
        const url = `/api/agenda/meus-alunos`
        const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data) && data.length === 1 && data[0].id) {
            router.replace(`/agenda-digital/${data[0].id}/${targetSection}${paramStr}`)
            return
          }
        }
        router.replace(`/agenda-digital/selecionar-aluno${paramStr}`)
      } catch (e) {
        console.error('Erro ao buscar alunos:', e)
        router.replace(`/agenda-digital/selecionar-aluno${paramStr}`)
      }
    }

    fetchSecureStudents()
  }, [currentUserPerfil, currentUser, router, searchParams])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      width: '100%',
      background: 'transparent',
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
