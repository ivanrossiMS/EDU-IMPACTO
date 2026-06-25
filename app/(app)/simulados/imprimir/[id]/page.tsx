'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, Printer, ChevronLeft } from 'lucide-react'

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

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc' }}>
        <Loader2 className="animate-spin" size={40} color="#3b82f6" style={{ marginBottom: 16 }} />
        <p style={{ color: '#64748b', fontWeight: 600 }}>Preparando documento para impressão...</p>
      </div>
    )
  }

  if (!simulado) return null

  return (
    <div className="print-root" style={{ background: '#e2e8f0', minHeight: '100vh', padding: '40px 0', fontFamily: 'Arial, Helvetica, sans-serif' }}>
      
      {/* Barra de Ações (Oculta na impressão) */}
      <div className="print-hide" style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: 'white', padding: '12px 24px', borderRadius: 100, boxShadow: '0 10px 25px rgba(0,0,0,0.1)', display: 'flex', gap: 16, zIndex: 1000 }}>
        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', color: '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
          <ChevronLeft size={18} /> Voltar
        </button>
        <div style={{ width: 1, background: '#e2e8f0' }} />
        <button onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#3b82f6', color: 'white', border: 'none', padding: '8px 20px', borderRadius: 100, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
          <Printer size={18} /> Imprimir Simulado
        </button>
      </div>

      {/* Página A4 */}
      <div className="a4-page" style={{ 
        width: '210mm', 
        minHeight: '297mm', 
        position: 'relative',
        margin: '0 auto', 
        background: 'white', 
        boxShadow: '0 0 10px rgba(0,0,0,0.1)',
        boxSizing: 'border-box',
        // overflow hidden removido para não cortar as próximas páginas na impressão
        padding: '0' 
      }}>
        
        {/* Imagem de Fundo (Demais Páginas - Se repete em todas) */}
        {config?.modelo_pdf_outras_paginas_url && (
          <div className="print-repeating-bg" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100vh', zIndex: 0, overflow: 'visible' }}>
            <img 
              src={config.modelo_pdf_outras_paginas_url} 
              alt="Fundo Outras Páginas" 
              style={{ position: 'absolute', top: 0, left: 0, width: '210mm', height: '297mm', objectFit: 'fill' }} 
            />
          </div>
        )}

        {/* Imagem de Fundo (Capa A4 Completo - APENAS NA PRIMEIRA PÁGINA) */}
        {config?.modelo_pdf_url && (
          <div className="print-cover-image" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100vh', zIndex: 1, overflow: 'visible' }}>
            <img 
              src={config.modelo_pdf_url} 
              alt="Capa" 
              style={{ position: 'absolute', top: 0, left: 0, width: '210mm', height: '297mm', objectFit: 'fill', backgroundColor: 'white' }} 
            />
          </div>
        )}

        {/* Camada de Conteúdo Sobreposto (position: relative na tela, mas static na impressão para permitir paginação correta do Chrome) */}
        <div className="print-text-layer" style={{ position: 'relative', zIndex: 2, width: '100%' }}>
          
          {/* Título do Simulado (No retângulo branco à direita no topo da folha A4) */}
          <div className="simulado-title" style={{
            position: 'absolute',
            top: '20mm',      // ~6.8% de 297mm
            right: '25mm',    // ~12% de 210mm
            width: '75mm',    // ~36% de 210mm
            height: '24mm',   // ~8% de 297mm
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            fontWeight: 900,
            fontSize: '13pt', 
            color: '#1e293b'
          }}>
            {simulado.titulo}
          </div>

          {/* Fallback de Título caso não tenha Imagem */}
          {!config?.modelo_pdf_url && (
            <div className="simulado-title" style={{ padding: '20mm', textAlign: 'center', borderBottom: '2px solid #000' }}>
              <h1 style={{ margin: 0, fontSize: 24, textTransform: 'uppercase' }}>{simulado.titulo}</h1>
              <p style={{ margin: '8px 0 0', color: '#666' }}>Cabeçalho não configurado.</p>
            </div>
          )}

          {/* Spacer para pular a altura do cabeçalho e ALUNO(A) */}
          <div style={{ height: '68mm' }}></div>

          {/* Conteúdo em 2 Colunas */}
          <div style={{ 
            paddingLeft: '15mm',
            paddingRight: '15mm',
            columnCount: 2, 
            columnGap: '12mm', 
            columnRule: '1px solid #94a3b8', /* Cor mais escura para o Chrome não ignorar na impressão */
            fontSize: '11pt', 
            lineHeight: 1.4,
            textAlign: 'justify',
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact'
          }}>
            {simulado.simulados_questoes?.map((questao: any, index: number) => (
              <div key={questao.id} className="print-question-container" style={{ breakInside: 'auto', paddingTop: '5mm', paddingBottom: '3mm' }}>
              <div style={{ display: 'flex', gap: 10 }}>
                {/* Número da questão moderno */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  minWidth: '28px',
                  backgroundColor: '#1e293b',
                  color: '#ffffff',
                  fontWeight: 900,
                  borderRadius: '8px',
                  fontSize: '11pt',
                  WebkitPrintColorAdjust: 'exact',
                  printColorAdjust: 'exact',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  {index + 1}
                </div>
                <div style={{ flex: 1, marginTop: '2px' }}>
                  {/* Enunciado */}
                  <div 
                    dangerouslySetInnerHTML={{ __html: questao.enunciado }} 
                    style={{ marginBottom: 12, wordBreak: 'break-word' }}
                  />
                  
                  {/* Alternativas */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, breakInside: 'avoid' }}>
                    {questao.simulados_alternativas?.map((alt: any) => (
                      <div key={alt.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        {/* Letra da Alternativa Moderna */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '24px',
                          height: '24px',
                          minWidth: '24px',
                          border: '2px solid #cbd5e1',
                          color: '#334155',
                          fontWeight: 'bold',
                          borderRadius: '50%', // Círculo perfeito
                          fontSize: '10pt',
                          backgroundColor: '#f8fafc',
                          WebkitPrintColorAdjust: 'exact',
                          printColorAdjust: 'exact',
                        }}>
                          {alt.letra}
                        </div>
                        <span style={{ color: '#1e293b', paddingTop: '1px' }}>{alt.texto}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media screen {
          .print-repeating-bg {
            display: none !important;
          }
        }
        @media print {
          html, body {
            background: transparent !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
          }
          .print-root {
            padding: 0 !important;
            background: transparent !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            display: block !important;
          }
          .print-hide {
            display: none !important;
          }
          .print-repeating-bg {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 210mm !important;
            height: 100vh !important; /* Wrapper encaixa na área de impressão para não ser fatiado */
            overflow: visible !important;
            z-index: 0 !important;
          }
          .print-cover-image {
            width: 210mm !important;
            height: 100vh !important;
            overflow: visible !important;
            z-index: 0 !important; 
          }
          .print-text-layer {
            position: static !important; /* OBRIGATÓRIO: Libera o container de texto para quebrar colunas */
            z-index: auto !important; 
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
          }
          .simulado-title {
            position: absolute !important;
            z-index: 1 !important; /* Pinta o título POR CIMA das imagens */
          }
          .print-question-container {
            position: relative !important;
            z-index: 1 !important; /* Pinta os textos POR CIMA das imagens (z-index 0) SEM quebrar a paginação da div pai */
          }
          .a4-page {
            box-shadow: none !important;
            background: transparent !important;
            margin: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            position: static !important; /* OBRIGATÓRIO: Ancestrais devem ser estáticos para colunas funcionarem */
          }
          /* Configuração da folha de impressão */
          @page {
            size: A4;
            margin-top: 0 !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
            margin-bottom: 32mm !important; /* Segura o texto na linha amarela (não afeta as imagens de fundo que estão absolutas/fixas) */
          }
        }
      `}} />
    </div>
  )
}
