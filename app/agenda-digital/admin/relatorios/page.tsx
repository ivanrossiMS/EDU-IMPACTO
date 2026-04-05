'use client'

import React, { useState } from 'react'
import { ReportList } from '@/components/agenda-relatorios/ReportList'
import { ReportBuilder } from '@/components/agenda-relatorios/ReportBuilder'
import { ReportRecords } from '@/components/agenda-relatorios/ReportRecords'
import { ReportFiller } from '@/components/agenda-relatorios/ReportFiller'

export type RelatoriosView = 'list' | 'builder' | 'records' | 'filler'

export default function ADAdminRelatorios() {
  const [activeView, setActiveView] = useState<RelatoriosView>('list')
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)
  
  const navigateTo = (view: RelatoriosView, templateId: string | null = null) => {
    setActiveTemplateId(templateId)
    setActiveView(view)
  }

  return (
    <div className="ad-admin-page-container ad-mobile-optimized" style={{ height: 'calc(100vh - 120px)', marginTop: -24, display: 'flex', flexDirection: 'column' }}>
      {activeView === 'list' && <ReportList onNavigate={navigateTo} />}
      {activeView === 'builder' && <ReportBuilder templateId={activeTemplateId} onNavigate={navigateTo} />}
      {activeView === 'records' && <ReportRecords templateId={activeTemplateId} onNavigate={navigateTo} />}
      {activeView === 'filler' && <ReportFiller templateId={activeTemplateId!} onNavigate={navigateTo} />}
    </div>
  )
}
