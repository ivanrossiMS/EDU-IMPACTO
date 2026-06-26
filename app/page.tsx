import { redirect } from 'next/navigation'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export default async function Root() {
  const supabase = await createProtectedClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const perfil = user.user_metadata?.perfil || ''
  const cargo = user.user_metadata?.cargo || ''
  const isFamilyOrStudent = (
    perfil === 'Família' ||
    perfil === 'Responsável' ||
    perfil === 'Aluno' ||
    cargo === 'Responsável' ||
    cargo === 'Aluno'
  )

  if (isFamilyOrStudent) {
    if (cargo === 'Aluno') {
      const alunoId = user.user_metadata?.aluno_id;
      if (alunoId) {
        redirect(`/agenda-digital/${alunoId}/comunicados`)
      }
    }
    redirect('/agenda-digital/selecionar-aluno')
  }

  redirect('/login?step=choose_system')
}
