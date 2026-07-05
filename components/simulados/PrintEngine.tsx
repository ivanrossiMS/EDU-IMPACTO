'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Loader2, BookOpen } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { HtmlContent } from '../HtmlContent'

type Questao = any

interface PrintEngineProps {
  simulado: any
  questoes: Questao[]
  config: any
  onComplete?: () => void
}

export function PrintEngine({ simulado, questoes, config, onComplete }: PrintEngineProps) {
  const [pages, setPages] = useState<{ leftCol: Questao[], rightCol: Questao[] }[]>([])
  const [isPaginating, setIsPaginating] = useState(true)
  const measuringRef = useRef<HTMLDivElement>(null)
  const heightFirstRef = useRef<HTMLDivElement>(null)
  const heightInternalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!questoes || questoes.length === 0) {
      setIsPaginating(false)
      if (onComplete) onComplete()
      return
    }

    let isMounted = true

    const paginate = async () => {
      setIsPaginating(true)
      
      // Wait for DOM to render the measuring container
      await new Promise(resolve => setTimeout(resolve, 500))
      
      if (!isMounted) return

      const measureContainer = measuringRef.current
      if (!measureContainer) {
        setIsPaginating(false)
        return
      }

      const MAX_HEIGHT_FIRST = heightFirstRef.current?.getBoundingClientRect().height || 850
      const MAX_HEIGHT_INTERNAL = heightInternalRef.current?.getBoundingClientRect().height || 950
      
      const newPages: { leftCol: Questao[], rightCol: Questao[] }[] = []
      let currentLeft: Questao[] = []
      let currentRight: Questao[] = []
      let leftHeight = 0
      let rightHeight = 0

      // Get all child elements (the questions)
      const questionElements = Array.from(measureContainer.children) as HTMLElement[]

      for (let i = 0; i < questoes.length; i++) {
        const q = questoes[i]
        const qEl = questionElements[i]
        if (!qEl) continue
        
        // Add 16px gap to height
        const qHeight = qEl.getBoundingClientRect().height + 16

        // Determine current max height based on if this is the first page or not
        const CURRENT_MAX_HEIGHT = newPages.length === 0 ? MAX_HEIGHT_FIRST : MAX_HEIGHT_INTERNAL

        // Handle HUGE question (taller than column)
        if (qHeight >= CURRENT_MAX_HEIGHT) {
          if (leftHeight > 0 || rightHeight > 0) {
            newPages.push({ leftCol: currentLeft, rightCol: currentRight })
            currentLeft = []
            currentRight = []
            leftHeight = 0
            rightHeight = 0
          }
          currentLeft.push(q)
          newPages.push({ leftCol: currentLeft, rightCol: currentRight })
          currentLeft = []
          leftHeight = 0
          continue
        }

        if (leftHeight + qHeight <= CURRENT_MAX_HEIGHT) {
          currentLeft.push(q)
          leftHeight += qHeight
        } else if (rightHeight + qHeight <= CURRENT_MAX_HEIGHT) {
          currentRight.push(q)
          rightHeight += qHeight
        } else {
          // Page is full, start new page
          newPages.push({ leftCol: currentLeft, rightCol: currentRight })
          currentLeft = [q]
          currentRight = []
          leftHeight = qHeight
          rightHeight = 0
        }
      }

      if (currentLeft.length > 0 || currentRight.length > 0) {
        newPages.push({ leftCol: currentLeft, rightCol: currentRight })
      }

      setPages(newPages)
      setIsPaginating(false)
      if (onComplete) setTimeout(onComplete, 300)
    }

    paginate()

    return () => { isMounted = false }
  }, [questoes, onComplete])

  const renderQuestao = (q: Questao, globalIndex: number) => {
    const isNewDisciplina = globalIndex === 0 || q.id_disciplina !== questoes[globalIndex - 1].id_disciplina;

    return (
      <div key={q.id} className="print-question" style={{ marginBottom: 16, breakInside: 'auto' }}>
        {isNewDisciplina && q.simulados_disciplinas?.nome && (
          <div 
            style={{
              marginBottom: 16,
              padding: '8px 16px',
              borderLeft: '4px solid #3b82f6',
              background: 'linear-gradient(90deg, #f8fafc 0%, #ffffff 100%)',
              borderRadius: '0 8px 8px 0',
              fontWeight: 800,
              fontSize: '11pt',
              color: '#1e293b',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact',
              breakInside: 'avoid'
            }}
          >
            <BookOpen size={16} color="#3b82f6" style={{ marginTop: '-1px' }} />
            {q.simulados_disciplinas.nome}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            minWidth: '24px',
            backgroundColor: '#1e293b',
            color: '#ffffff',
            fontWeight: 900,
            borderRadius: '6px',
            fontSize: '10pt',
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact',
            marginTop: 2
          }}>
            {globalIndex + 1}
          </div>
          <div style={{ flex: 1 }}>
            <HtmlContent
              html={q.enunciado || ''}
              style={{ wordBreak: 'break-word', marginBottom: 12, fontSize: '10pt', lineHeight: 1.4, textAlign: 'justify' }}
            />
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {q.simulados_alternativas?.map((alt: any) => (
                <div key={alt.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '20px',
                    height: '20px',
                    minWidth: '20px',
                    border: '2px solid #cbd5e1',
                    color: '#334155',
                    fontWeight: 'bold',
                    borderRadius: '50%',
                    fontSize: '9pt',
                    marginTop: 1
                  }}>
                    {alt.letra}
                  </div>
                  <HtmlContent html={alt.texto} style={{ fontSize: '10pt', lineHeight: 1.4, textAlign: 'justify' }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderPage = (page: { leftCol: Questao[], rightCol: Questao[] }, pIndex: number) => (
    <div key={pIndex} className="print-page">
      
      {pIndex === 0 && config?.modelo_pdf_url && (
        <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, margin: 0, padding: 0 }}>
          <img src={config.modelo_pdf_url || undefined} alt="Capa" style={{ width: '100%', height: '100%', objectFit: 'fill', margin: 0, padding: 0, display: 'block' }} />
        </div>
      )}
      {pIndex > 0 && config?.modelo_pdf_outras_paginas_url && (
        <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, margin: 0, padding: 0 }}>
          <img src={config.modelo_pdf_outras_paginas_url || undefined} alt="Fundo Interna" style={{ width: '100%', height: '100%', objectFit: 'fill', margin: 0, padding: 0, display: 'block' }} />
        </div>
      )}

      {/* Title on cover */}
      {pIndex === 0 && (
        <div style={{
          position: 'absolute',
          top: '20mm',
          right: '25mm',
          width: '75mm',
          height: '24mm',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          fontWeight: 900,
          fontSize: '13pt', 
          color: '#1e293b',
          zIndex: 10
        }}>
          {simulado?.titulo}
        </div>
      )}

      <div className={`page-content ${pIndex === 0 ? 'first-page' : 'internal-page'}`} style={{ zIndex: 10 }}>
        {/* Columns Container */}
        <div style={{ display: 'flex', width: '100%', height: '100%', gap: '6mm' }}>
          
          {/* Left Column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {page.leftCol.map(q => {
              const globalIndex = questoes.findIndex(x => x.id === q.id)
              return renderQuestao(q, globalIndex)
            })}
          </div>

          {/* Ultra Modern Divider */}
          {page.rightCol.length > 0 && (
            <div style={{
              width: '1px',
              borderLeft: '1px dashed #cbd5e1',
              height: '100%',
              opacity: 0.7
            }} />
          )}

          {/* Right Column (Only render if it has items) */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {page.rightCol.map(q => {
              const globalIndex = questoes.findIndex(x => x.id === q.id)
              return renderQuestao(q, globalIndex)
            })}
          </div>

        </div>
      </div>
    </div>
  )

  return (
    <>
      {isPaginating && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <Loader2 className="animate-spin" size={40} color="#3b82f6" style={{ marginBottom: 16 }} />
          <p style={{ color: '#64748b', fontWeight: 600 }}>Calculando quebras de página em colunas ({questoes.length} questões)...</p>
          
          {/* Reference divs to get exact safe height in pixels */}
          <div 
            className="print-page"
            style={{ position: 'absolute', top: -9999, left: -9999, visibility: 'hidden' }}
          >
            <div 
              ref={heightFirstRef}
              className="page-content first-page"
            />
            <div 
              ref={heightInternalRef}
              className="page-content internal-page"
            />
          </div>

          {/* Measuring container simulating ONE column width */}
          <div 
            style={{ position: 'absolute', top: -9999, left: -9999, visibility: 'hidden' }}
          >
            <div className="print-page">
              <div className="page-content internal-page">
                <div style={{ display: 'flex', width: '100%', gap: '6mm' }}>
                  <div ref={measuringRef} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {questoes.map((q, i) => renderQuestao(q, i))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isPaginating && (
        <>
          <div className="screen-preview">
            {pages.map(renderPage)}
          </div>
          <div className="print-only">
            {pages.map(renderPage)}
          </div>
        </>
      )}
    </>
  )
}
