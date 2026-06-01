'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useApp } from '@/lib/context'
import { supabase } from '@/lib/supabase'
import { BookOpen, Sparkles } from 'lucide-react'

const ADMIN_PERFIS = ['Diretor Geral', 'Coordenador', 'Secretária']

export default function AgendaDigitalIndex() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Carregando...</div>}>
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
    const redirectParamString = searchParams.get('redirect') ? `?redirect=${searchParams.get('redirect')}` : ''
    
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
          router.replace(`/agenda-digital/${directAlunoId}/${redirect}`)
          return
        }

        // Slow path: Only fetch from DB if we don't have the ID, and ONLY fetch one specific record
        const fetchAlunoId = async () => {
          try {
            const nomeLower = (currentUser.nome || '').trim()
            if (!nomeLower) {
              router.replace(`/agenda-digital/selecionar-aluno${redirectParamString}`)
              return
            }
            
            const { data, error } = await supabase
              .from('alunos')
              .select('id')
              .ilike('nome', nomeLower)
              .limit(1)
              .single()
              
            if (data && data.id) {
              router.replace(`/agenda-digital/${data.id}/${redirect}`)
            } else {
              router.replace(`/agenda-digital/selecionar-aluno${redirectParamString}`)
            }
          } catch (e) {
            console.error('Error fetching aluno ID', e)
            router.replace(`/agenda-digital/selecionar-aluno${redirectParamString}`)
          }
        }
        
        fetchAlunoId()
        return
      }
      
      // Default fallback for other roles
      router.replace(`/agenda-digital/selecionar-aluno${redirectParamString}`)
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
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* CSS Keyframes for modern micro-animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-10px) scale(1.02); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.5; transform: scale(1); filter: blur(40px); }
          50% { opacity: 0.8; transform: scale(1.15); filter: blur(60px); }
        }
        @keyframes rotateOuter {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes rotateInner {
          0% { transform: rotate(360deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes lineFlow {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes textShimmer {
          0% { opacity: 0.6; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-2px); }
          100% { opacity: 0.6; transform: translateY(0); }
        }
      `}</style>

      {/* Decorative ultra-modern glowing backdrop circles */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: '320px',
        height: '320px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(168,85,247,0.08) 50%, rgba(0,0,0,0) 70%)',
        transform: 'translate(-50%, -50%)',
        zIndex: 0,
        animation: 'pulseGlow 6s infinite ease-in-out',
        pointerEvents: 'none'
      }} />

      {/* Central Glassmorphic Loader Card */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'hsl(var(--card) / 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid hsl(var(--border))',
        borderRadius: '24px',
        padding: '48px 64px',
        boxShadow: '0 20px 50px rgba(99, 102, 241, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        animation: 'float 4s infinite ease-in-out',
        maxWidth: '380px',
        width: '90%',
        textAlign: 'center'
      }}>
        {/* Animated Loader Sphere & Rings */}
        <div style={{
          position: 'relative',
          width: '100px',
          height: '100px',
          marginBottom: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* Outer glowing orbital ring */}
          <div style={{
            position: 'absolute',
            inset: '0',
            border: '2px dashed rgba(99, 102, 241, 0.4)',
            borderRadius: '50%',
            animation: 'rotateOuter 15s linear infinite'
          }} />

          {/* Inner futuristic continuous flowing ring */}
          <div style={{
            position: 'absolute',
            inset: '8px',
            border: '2px solid transparent',
            borderTopColor: '#a855f7',
            borderBottomColor: '#6366f1',
            borderRadius: '50%',
            animation: 'rotateInner 3s cubic-bezier(0.5, 0, 0.5, 1) infinite',
            filter: 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.5))'
          }} />

          {/* Center glowing book/agenda icon container */}
          <div style={{
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
          }}>
            <BookOpen style={{
              width: '28px',
              height: '28px',
              color: '#a855f7',
              filter: 'drop-shadow(0 0 10px rgba(168, 85, 247, 0.8))'
            }} />
            
            <Sparkles style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              width: '14px',
              height: '14px',
              color: '#6366f1',
              animation: 'rotateOuter 4s linear infinite',
              filter: 'drop-shadow(0 0 6px rgba(99, 102, 241, 0.8))'
            }} />
          </div>
        </div>

        {/* Loading text with sleek typography */}
        <h2 style={{
          margin: '0 0 8px 0',
          fontSize: '18px',
          fontWeight: 600,
          color: '#6366f1',
          background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '0.05em',
          animation: 'textShimmer 3s infinite ease-in-out'
        }}>
          Carregando Agenda Digital...
        </h2>
        
        {/* Subtle, modern progress indicator bar */}
        <div style={{
          width: '120px',
          height: '3px',
          background: 'hsl(var(--muted-foreground) / 0.15)',
          borderRadius: '10px',
          overflow: 'hidden',
          marginTop: '16px',
          position: 'relative'
        }}>
          <div style={{
            height: '100%',
            width: '100%',
            background: 'linear-gradient(90deg, transparent, #6366f1, #a855f7, transparent)',
            borderRadius: '10px',
            animation: 'lineFlow 1.8s infinite linear',
            position: 'absolute',
            left: 0,
            top: 0
          }} />
        </div>
      </div>
    </div>
  )
}
