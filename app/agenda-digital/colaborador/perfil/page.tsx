'use client'

import MeuPerfilPage from '@/app/(app)/meu-perfil/page'

export default function ColaboradorPerfilPage() {
  // Espelha o perfil do colaborador sem o card redundante de informações da conta
  return <MeuPerfilPage hideAccountInfo />
}
