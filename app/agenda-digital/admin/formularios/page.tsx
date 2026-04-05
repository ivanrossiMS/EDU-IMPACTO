'use client'

import React, { useState } from 'react'
import { FormList } from '@/components/agenda-formularios/FormList'
import { FormBuilder } from '@/components/agenda-formularios/FormBuilder'
import { FormRecords } from '@/components/agenda-formularios/FormRecords'
import { FormFiller } from '@/components/agenda-formularios/FormFiller'
import { FormSender } from '@/components/agenda-formularios/FormSender'

export type FormulariosView = 'list' | 'builder' | 'records' | 'filler' | 'sender'

export default function ADAdminFormularios() {
  const [activeView, setActiveView] = useState<FormulariosView>('list')
  const [activeFormId, setActiveFormId] = useState<string | null>(null)
  
  const navigateTo = (view: FormulariosView, formId: string | null = null) => {
    setActiveFormId(formId)
    setActiveView(view)
  }

  return (
    <div className="ad-admin-page-container ad-mobile-optimized" style={{ height: 'calc(100vh - 120px)', marginTop: -24, display: 'flex', flexDirection: 'column' }}>
      {activeView === 'list' && <FormList onNavigate={navigateTo} />}
      {activeView === 'builder' && <FormBuilder formId={activeFormId} onNavigate={navigateTo} />}
      {activeView === 'sender' && <FormSender formId={activeFormId!} onNavigate={navigateTo} />}
      {activeView === 'records' && <FormRecords formId={activeFormId} onNavigate={navigateTo} />}
      {activeView === 'filler' && <FormFiller formId={activeFormId!} onNavigate={navigateTo} />}
    </div>
  )
}
