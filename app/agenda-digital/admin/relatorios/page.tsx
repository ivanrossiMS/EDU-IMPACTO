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
    <div className="ad-admin-page-container ad-mobile-optimized ad-relatorios-wrapper" style={{ height: 'calc(100vh - 120px)', marginTop: -24, display: 'flex', flexDirection: 'column' }}>
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          .ad-relatorios-wrapper {
            height: auto !important;
            min-height: 100% !important;
            margin-top: 0 !important;
          }
        }
      `}} />
      {activeView === 'list' && <ReportList onNavigate={navigateTo} />}
      {activeView === 'builder' && <ReportBuilder templateId={activeTemplateId} onNavigate={navigateTo} />}
      {activeView === 'records' && <ReportRecords templateId={activeTemplateId} onNavigate={navigateTo} />}
      {activeView === 'filler' && <ReportFiller templateId={activeTemplateId!} onNavigate={navigateTo} />}
    </div>
  )
}
