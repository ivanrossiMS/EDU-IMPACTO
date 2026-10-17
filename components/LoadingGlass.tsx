'use client'

import { AgendaLuxuryLoader } from '@/components/agenda/AgendaLuxuryLoader'
import { isGlobalNavOverlayActive } from '@/lib/navigation/pageReadiness'

export function LoadingGlass({ statusText }: { statusText?: string } = {}) {
  if (isGlobalNavOverlayActive()) {
    return <div data-page-loading="true" style={{ minHeight: '60vh', width: '100%' }} />
  }

  return (
    <div data-page-loading="true">
      <AgendaLuxuryLoader isLoading={true} statusText={statusText || 'Carregando página e dados...'} />
    </div>
  )
}
