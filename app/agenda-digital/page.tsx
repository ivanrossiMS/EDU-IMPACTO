'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import { useData } from '@/lib/dataContext'

const ADMIN_PERFIS = ['Diretor Geral', 'Coordenador', 'Secretária']

export default function AgendaDigitalIndex() {
  const router = useRouter()
  const { currentUserPerfil, currentUser } = useApp()
  const { alunos } = useData()

  useEffect(() => {
    const isAdmin = ADMIN_PERFIS.includes(currentUserPerfil)
    if (isAdmin) {
      router.replace('/agenda-digital/admin')
    } else {
      if (currentUser?.cargo === 'Aluno') {
        const nomeLower = (currentUser.nome || '').toLowerCase().trim()
        const myAluno = alunos.find(a => 
          (a.nome || '').toLowerCase().trim() === nomeLower || 
          (currentUser.id && currentUser.id.includes(String(a.id)))
        )
        if (myAluno) {
          router.replace(`/agenda-digital/${myAluno.id}/comunicados`)
          return
        }
      }
      router.replace('/agenda-digital/selecionar-aluno')
    }
  }, [currentUserPerfil, currentUser, alunos, router])

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0', color: 'hsl(var(--text-muted))' }}>
      Carregando Agenda Digital...
    </div>
  )
}
