'use client'

import React, { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { ImpactoLoader } from '@/components/ui/ImpactoLoader'
import { useIsMobileVersion } from '@/lib/utils/isMobileVersion'

export function GlobalNavigationLoader() {
  // A tela de carregamento só deve aparecer na abertura do APP e no logout
  return null
}
