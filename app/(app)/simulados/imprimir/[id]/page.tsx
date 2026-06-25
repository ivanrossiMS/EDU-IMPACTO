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

      .print-page {
        width: 210mm;
        height: 297mm;
        background: white;
        position: relative;
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(0,0,0,.12);
        box-sizing: border-box;
      }
        
      .page-content {
        position: absolute;
        left: 18mm;
        right: 18mm;
        overflow: hidden;
      }

      .page-content.first-page {
        top: 58mm; /* logo abaixo de ALUNO(A), com espaço leve */
        bottom: 18mm;
      }

      .page-content.internal-page {
        top: 18mm; /* página 2 em diante começa mais acima */
        bottom: 18mm;
      }

      @media print {
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
          width: 210mm !important;
        }

        .print-actions,
        .no-print {
          display: none !important;
        }

        .print-preview-wrapper {
          display: block !important;
          background: white !important;
          padding: 0 !important;
          margin: 0 !important;
        }

        .print-page {
          width: 210mm !important;
          height: 297mm !important;
          margin: 0 !important;
          padding: 0 !important;
          box-shadow: none !important;
          page-break-after: always !important;
          break-after: page !important;
          overflow: hidden !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .print-page:last-child {
          page-break-after: auto !important;
          break-after: auto !important;
        }

        @page {
          size: A4 portrait;
          margin: 0;
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
