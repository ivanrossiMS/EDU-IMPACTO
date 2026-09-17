'use client'

import { AgendaLuxuryLoader } from '@/components/agenda/AgendaLuxuryLoader'

export function LoadingGlass({ statusText }: { statusText?: string } = {}) {
  return <AgendaLuxuryLoader isLoading={true} statusText={statusText || 'Carregando página e dados...'} />
}
