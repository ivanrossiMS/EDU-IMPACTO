'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, Printer, ChevronLeft } from 'lucide-react'
import { PrintEngine } from '@/components/simulados/PrintEngine'

export default function SimuladoImprimirPage() {
  const { id } = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [simulado, setSimulado] = useState<any>(null)
  const [config, setConfig] = useState<any>(null)

  useEffect(() => {
    async function loadData() {
      if (!id) return

      // Load config (header image)
      const { data: confData } = await supabase.from('simulados_configuracoes').select('*').eq('id', 'default').single()
      setConfig(confData)

      // Load Simulado with questions and alternatives
      const { data: simData, error } = await supabase.from('simulados').select(`
        *,
        simulados_questoes (
          *,
          simulados_alternativas (*)
        )
      `).eq('id', id).single()

      if (simData) {
        // Sort questions
        simData.simulados_questoes?.sort((a: any, b: any) => a.ordem - b.ordem)
        
        // Sort alternatives
        simData.simulados_questoes?.forEach((q: any) => {
          q.simulados_alternativas?.sort((a: any, b: any) => a.letra.localeCompare(b.letra))
        })
        
        setSimulado(simData)
      } else {
        alert('Simulado não encontrado')
      }

      setLoading(false)
    }
    loadData()
  }, [id])

  // --- Print Styles Injection ---
  useEffect(() => {
    const style = document.createElement('style')
    style.innerHTML = `
      .print-preview-wrapper {
        min-height: 100vh;
        background: #e8eef5;
        padding: 32px 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 24px;
        font-family: Arial, Helvetica, sans-serif;
      }

      .print-actions {
        position: sticky;
        top: 16px;
        z-index: 50;
        background: white;
        padding: 12px 24px;
        border-radius: 100px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        display: flex;
        gap: 16px;
      }

      .print-only {
        display: none !important;
      }

      .screen-preview {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 24px;
      }

      .a4-page {
        position: relative;
        width: 210mm;
        height: 297mm;
        background: white;
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(0,0,0,.12);
        box-sizing: border-box;
      }

      .a4-bg {
        position: absolute;
        inset: 0;
        width: 210mm;
        height: 297mm;
        object-fit: fill;
        z-index: 0;
        display: block;
      }

      .a4-content {
        position: relative;
        z-index: 2;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
      }

      .first-page {
        padding: 62mm 18mm 22mm 18mm;
      }

      .internal-page {
        padding: 22mm 18mm 22mm 18mm;
      }

      @media print {
        @page {
          size: 210mm 297mm;
          margin: 0;
        }

        html,
        body {
          margin: 0 !important;
          padding: 0 !important;
          width: 210mm !important;
          min-height: 297mm !important;
          background: white !important;
          overflow: visible !important;
        }

        .no-print,
        .floating-button,
        .chat-widget,
        .whatsapp-button,
        .avatar-floating,
        .screen-only,
        .screen-preview,
        .print-actions {
          display: none !important;
        }

        .print-only {
          display: block !important;
          width: 210mm !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: visible !important;
        }

        .a4-page {
          position: relative !important;
          width: 210mm !important;
          height: 297mm !important;
          min-width: 210mm !important;
          min-height: 297mm !important;
          max-width: 210mm !important;
          max-height: 297mm !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          box-sizing: border-box !important;
          page-break-after: always !important;
          break-after: page !important;
          background: white !important;
          box-shadow: none !important;
        }

        .a4-page:last-child {
          page-break-after: auto !important;
          break-after: auto !important;
        }

        .a4-bg {
          position: absolute !important;
          inset: 0 !important;
          width: 210mm !important;
          height: 297mm !important;
          min-width: 210mm !important;
          min-height: 297mm !important;
          object-fit: fill !important;
          z-index: 0 !important;
          display: block !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .a4-content {
          position: relative !important;
          z-index: 2 !important;
        }

        .print-preview-wrapper {
          display: block !important;
          height: auto !important;
          min-height: auto !important;
          background: white !important;
          padding: 0 !important;
          margin: 0 !important;
          overflow: visible !important;
        }
      }
    `
    document.head.appendChild(style)
    return () => { document.head.removeChild(style) }
  }, [])

  const handlePrint = () => {
    // Timeout to ensure any layout thrashing settles before print dialog
    setTimeout(() => {
      window.print()
    }, 100)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#e8eef5' }}>
        <Loader2 className="animate-spin" size={40} color="#3b82f6" style={{ marginBottom: 16 }} />
        <p style={{ color: '#64748b', fontWeight: 600 }}>Preparando documento para impressão...</p>
      </div>
    )
  }

  if (!simulado) return null

  return (
    <div className="print-preview-wrapper">
      
      {/* Barra de Ações */}
      <div className="print-actions">
        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', color: '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
          <ChevronLeft size={18} /> Voltar
        </button>
        <div style={{ width: 1, background: '#e2e8f0' }} />
        <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#3b82f6', color: 'white', border: 'none', padding: '8px 20px', borderRadius: 100, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
          <Printer size={18} /> Imprimir Simulado
        </button>
      </div>

      <PrintEngine 
        simulado={simulado} 
        questoes={simulado.simulados_questoes || []} 
        config={config} 
      />
      
    </div>
  )
}
