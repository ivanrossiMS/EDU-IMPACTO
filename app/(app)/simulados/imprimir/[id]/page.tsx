'use client'

import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'

// Mock Data for printing
const mockSimulado = {
  titulo: 'Simulado Geral 1º Bimestre',
  disciplinas: [
    {
      nome: 'Matemática',
      questoes: [
        {
          id: '1',
          enunciado: '<p>Um reservatório em formato cilíndrico possui raio da base igual a 2 metros e altura de 5 metros. Sabendo que π = 3,14, qual a capacidade máxima desse reservatório em litros?</p>',
          alternativas: [
            { letra: 'a', texto: '<p>62.800 litros</p>' },
            { letra: 'b', texto: '<p>31.400 litros</p>' },
            { letra: 'c', texto: '<p>125.600 litros</p>' },
            { letra: 'd', texto: '<p>15.700 litros</p>' },
            { letra: 'e', texto: '<p>6.280 litros</p>' },
          ]
        },
        {
          id: '2',
          enunciado: '<p>Resolva a equação de segundo grau: x² - 5x + 6 = 0.</p>',
          alternativas: [
            { letra: 'a', texto: '<p>S = {1, 6}</p>' },
            { letra: 'b', texto: '<p>S = {2, 3}</p>' },
            { letra: 'c', texto: '<p>S = {-2, -3}</p>' },
            { letra: 'd', texto: '<p>S = {0, 6}</p>' },
            { letra: 'e', texto: '<p>S = {∅}</p>' },
          ]
        }
      ]
    },
    {
      nome: 'Língua Portuguesa',
      questoes: [
        {
          id: '3',
          enunciado: '<p>Assinale a alternativa em que há erro de concordância verbal:</p>',
          alternativas: [
            { letra: 'a', texto: '<p>Fazem cinco anos que não o vejo.</p>' },
            { letra: 'b', texto: '<p>Havia muitas pessoas na festa.</p>' },
            { letra: 'c', texto: '<p>Deve existir outras opções.</p>' },
            { letra: 'd', texto: '<p>Vão dar três horas no relógio.</p>' },
            { letra: 'e', texto: '<p>Trata-se de casos delicados.</p>' },
          ]
        }
      ]
    }
  ]
}

export default function ImpressaoSimuladoPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Se desejar disparar a impressão logo de cara:
    // setTimeout(() => window.print(), 1000)
  }, [])

  if (!mounted) return null

  return (
    <div style={{ backgroundColor: 'hsl(var(--bg-app))', minHeight: '100vh', padding: '40px 0' }}>
      {/* 
        This style block is critical for making the print view look exactly like an A4 paper,
        hiding the Next.js layouts, removing the print button, and formatting the pages.
      */}
      <style>{`
        /* Reset para a tela de impressão */
        .print-container {
          background-color: white;
          color: black;
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          padding: 20mm;
          box-shadow: 0 0 20px rgba(0,0,0,0.1);
          font-family: 'Times New Roman', Times, serif;
        }

        .cabecalho-escola {
          border-bottom: 2px solid black;
          padding-bottom: 10px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .identificacao {
          border: 1px solid black;
          padding: 10px;
          margin-bottom: 20px;
        }

        .questao {
          margin-bottom: 30px;
          page-break-inside: avoid;
        }

        .alternativas {
          margin-top: 10px;
          padding-left: 20px;
        }

        .alternativa-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-bottom: 6px;
        }

        /* Estilos do botão flutuante apenas para tela */
        .print-button {
          position: fixed;
          bottom: 40px;
          right: 40px;
          padding: 16px 32px;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 100px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          box-shadow: 0 10px 25px rgba(37,99,235,0.4);
          display: flex;
          align-items: center;
          gap: 12px;
          z-index: 9999;
        }

        /* MEDIA PRINT: remove tudo que não for o container principal e formata a página */
        @media print {
          @page {
            size: A4;
            margin: 15mm;
          }
          body, html {
            background-color: white !important;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Esconde qualquer navbar lateral ou superior que venha do layout.tsx */
          nav, header, footer, aside {
            display: none !important;
          }
          /* Oculta botão de print */
          .print-button {
            display: none !important;
          }
          .print-container {
            box-shadow: none;
            width: 100%;
            margin: 0;
            padding: 0;
          }
        }
      `}</style>

      {/* Botão flutuante na tela para iniciar a impressão */}
      <button className="print-button" onClick={() => window.print()}>
        <Printer size={24} />
        Imprimir Simulado
      </button>

      {/* Conteúdo Formato A4 */}
      <div className="print-container">
        
        {/* Cabeçalho */}
        <div className="cabecalho-escola">
          {/* Pode adicionar a logo da escola aqui */}
          <div style={{ width: 60, height: 60, border: '1px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>LOGO</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, textTransform: 'uppercase' }}>Colégio EDU Impacto</h1>
            <h2 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 'normal' }}>{mockSimulado.titulo}</h2>
          </div>
        </div>

        {/* Quadro de Identificação */}
        <div className="identificacao">
          <div style={{ marginBottom: 10 }}><strong>Nome do Aluno:</strong> ____________________________________________________________________</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div><strong>Série/Turma:</strong> _________________</div>
            <div><strong>Nº:</strong> _______</div>
            <div><strong>Data:</strong> ___/___/2026</div>
          </div>
        </div>

        {/* Questões Agrupadas por Disciplina */}
        {mockSimulado.disciplinas.map((disciplina, dIndex) => (
          <div key={dIndex} style={{ marginBottom: 40 }}>
            <h3 style={{ textTransform: 'uppercase', borderBottom: '1px solid #ccc', paddingBottom: 4, marginBottom: 16 }}>
              {disciplina.nome}
            </h3>

            {disciplina.questoes.map((q, qIndex) => (
              <div key={q.id} className="questao">
                <div style={{ display: 'flex', gap: 8 }}>
                  <strong>{qIndex + 1})</strong>
                  <div dangerouslySetInnerHTML={{ __html: q.enunciado }} style={{ margin: 0 }} />
                </div>
                
                <div className="alternativas">
                  {q.alternativas.map(alt => (
                    <div key={alt.letra} className="alternativa-item">
                      <strong>{alt.letra})</strong>
                      <div dangerouslySetInnerHTML={{ __html: alt.texto }} style={{ margin: 0 }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}

      </div>
    </div>
  )
}
