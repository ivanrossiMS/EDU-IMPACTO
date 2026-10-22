'use client'

import React, { useState } from 'react'
import { ReportList } from '@/components/agenda-relatorios/ReportList'
import { ReportBuilder } from '@/components/agenda-relatorios/ReportBuilder'
import { ReportFiller } from '@/components/agenda-relatorios/ReportFiller'

export type RelatoriosView = 'list' | 'builder' | 'records' | 'filler'

export default function ADAdminRelatorios() {
  const [activeView, setActiveView] = useState<RelatoriosView>('list')
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)
  
  const navigateTo = (view: RelatoriosView, templateId: string | null = null) => {
    setActiveTemplateId(templateId)
    setActiveView(view === 'records' ? 'builder' : view)
  }

  return (
    <div
      className="ad-admin-page-container ad-mobile-optimized ad-relatorios-wrapper"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        paddingBottom: 32
      }}
    >
      {activeView === 'list' && <ReportList onNavigate={navigateTo} />}
      {activeView === 'builder' && <ReportBuilder templateId={activeTemplateId} onNavigate={navigateTo} />}
      {activeView === 'filler' && <ReportFiller templateId={activeTemplateId!} onNavigate={navigateTo} />}
    </div>
  )
}
