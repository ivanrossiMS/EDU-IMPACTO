'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, Printer, ChevronLeft, Type, CheckSquare, Save, Settings, Info, X, Columns, LayoutList, Move, RotateCcw } from 'lucide-react'
import { PaginationEngine } from '@/components/simulados/PaginationEngine'
import { IgnoredQuestionsList } from '@/components/simulados/IgnoredQuestionsList'

export default function AdaptarProvaPage() {
  const { id } = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [prova, setProva] = useState<any>(null)
  const [questoes, setQuestoes] = useState<any[]>([])
  const [requisicoes, setRequisicoes] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [fontSize, setFontSize] = useState<number>(16) // base font size in px
  const [columns, setColumns] = useState<number>(1) // Layout de colunas
  const [alternativasLayout, setAlternativasLayout] = useState<'vertical' | 'horizontal'>('horizontal') // Layout das alternativas
  const [config, setConfig] = useState<any>(null)

  const defaultHeaderLayout = {
    title: { label: "Título", x: 60, y: 6.5, fontSize: 9, width: 25, align: "left" },
    disciplina: { label: "Disciplina", x: 62.3, y: 8.9, fontSize: 8, width: 15, align: "left" },
    professor: { label: "Professor", x: 84.2, y: 8.9, fontSize: 8, width: 10, align: "left" },
    data: { label: "Data", x: 59.5, y: 11.4, fontSize: 8, width: 15, align: "left" },
    turma: { label: "Turma", x: 81.9, y: 11.4, fontSize: 8, width: 10, align: "left" },
    valor: { label: "Valor", x: 75.8, y: 16.5, fontSize: 8, width: 10, align: "left" },
    nota: { label: "Nota", x: 75.8, y: 18.0, fontSize: 8, width: 10, align: "left" }
  }
  const [headerLayout, setHeaderLayout] = useState<any>(defaultHeaderLayout)
  const [isEditHeaderMode, setIsEditHeaderMode] = useState(false)
  const pageA4Ref = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadData() {
      if (!id) return

      const { data } = await supabase.from('simulados_configuracoes').select('*').eq('id', 'default').single()
      const confData = data as any;
      if (confData) {
        setConfig({
          ...confData,
          modelo_pdf_url: confData.provas_modelo_pdf_url || '',
          modelo_pdf_outras_paginas_url: confData.provas_modelo_pdf_outras_paginas_url || ''
        })
        if (confData.provas_header_layout) {
          setHeaderLayout({ ...defaultHeaderLayout, ...confData.provas_header_layout })
        }
      }

      const { data: pData } = await supabase.from('provas').select('*').eq('id', id).single()
      const simData = pData as any;

      const { data: rData } = await supabase.from('provas_requisicoes').select('*').eq('id_prova', id).order('created_at', { ascending: true })
      const reqs = rData as any;
      if (reqs) setRequisicoes(reqs)

      const { data: qResult } = await supabase.from('provas_questoes').select(`
        *,
        simulados_disciplinas(nome),
        provas_alternativas(*)
      `).eq('id_prova', id)
      const qData = qResult as any;

      if (qData) {
        const discOrder: Record<string, number> = {}
        if (reqs) {
          reqs.forEach((r: any, index: number) => {
            if (discOrder[r.id_disciplina] === undefined) {
              discOrder[r.id_disciplina] = index
            }
          })
        }

        qData.sort((a: any, b: any) => {
          const orderA = discOrder[a.id_disciplina] ?? 999
          const orderB = discOrder[b.id_disciplina] ?? 999
          if (orderA !== orderB) return orderA - orderB
          return a.ordem - b.ordem
        })
        qData.forEach((q: any) => {
          q.provas_alternativas?.sort((a: any, b: any) => a.letra.localeCompare(b.letra))
          q.simulados_alternativas = q.provas_alternativas

          // Extrair imagens embutidas no enunciado para q.imagens
          if (q.enunciado && q.enunciado.includes('<img')) {
            const tempDiv = document.createElement('div')
            tempDiv.innerHTML = q.enunciado
            const imgs = tempDiv.querySelectorAll('img')
            const extractedImages = [...(q.imagens || [])]
            
            imgs.forEach(img => {
              extractedImages.push(img.src)
              let elToRemove: HTMLElement | null = img
              
              if (img.parentElement && img.parentElement.tagName === 'DIV' && 
                 (img.parentElement.getAttribute('data-posicao') === 'inicio' || 
                  img.parentElement.getAttribute('data-posicao') === 'final' || 
                  img.parentElement.style.textAlign === 'center')) {
                elToRemove = img.parentElement
              }
              
              if (elToRemove && elToRemove.parentNode) {
                elToRemove.parentNode.removeChild(elToRemove)
              }
            })
            
            // Limpa as quebras de linha (<br>) que ficavam em volta da imagem
            let newHtml = tempDiv.innerHTML
            newHtml = newHtml.replace(/^(<br\s*\/?>\s*)+/, '')
            newHtml = newHtml.replace(/(<br\s*\/?>\s*)+$/, '')
            
            q.enunciado = newHtml
            q.imagens = extractedImages
          }
        })
        setQuestoes(qData)
        setSelectedIds(new Set(qData.map((q: any) => q.id)))
      }

      if (simData) {
        // Fetch professor names
        let profNames: string[] = []
        if (reqs && reqs.length > 0) {
          const profIds = Array.from(new Set(reqs.map((r: any) => r.id_professor).filter(Boolean)))
          if (profIds.length > 0) {
            try {
              const res = await fetch('/api/configuracoes/usuarios?type=colaboradores&limit=1000')
              if (res.ok) {
                const json = await res.json()
                const users = json.data || json
                
                const foundProfs = users.filter((u: any) => profIds.includes(u.id))
                profNames = foundProfs.map((p: any) => p.nome.split(' ')[0]) // Get first names
              }
            } catch(e) {
              console.error('Error fetching professors:', e)
            }
          }
        }
        
        const discNames = Array.from(new Set((qData || []).map((q: any) => q.simulados_disciplinas?.nome).filter(Boolean)))
        const dateStr = simData.data_aplicacao ? new Date(simData.data_aplicacao + 'T00:00:00').toLocaleDateString('pt-BR') : ''
        const seriesStr = (simData.turmas || []).join(', ')

        setProva({ 
          ...simData, 
          isProva: true,
          formattedProfessors: profNames.join(', '),
          formattedDisciplinas: discNames.join(', '),
          formattedDate: dateStr,
          formattedSeries: seriesStr
        })
      }

      setLoading(false)
    }
    loadData()
  }, [id])

  // --- Print Styles Injection ---
  useEffect(() => {
    const style = document.createElement('style')
    style.innerHTML = `
      #print-root {
        display: none !important;
      }

      @media print {
        body > *:not(#print-root) {
          display: none !important;
        }

        #print-root {
          display: block !important;
          position: static !important;
          width: 210mm !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        .print-page {
          width: 210mm !important;
          height: 297mm !important;
          margin: 0 !important;
          padding: 0 !important;
          page-break-after: always !important;
          break-after: page !important;
          overflow: hidden !important;
          background-size: 210mm 297mm !important;
          background-repeat: no-repeat !important;
          background-position: center !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        @page {
          size: A4 portrait;
          margin: 0;
        }

        .no-print {
          display: none !important;
        }
      }
    `
    document.head.appendChild(style)
    return () => { document.head.removeChild(style) }
  }, [])

  const handleToggleQuestion = (qId: string) => {
    const next = new Set(selectedIds)
    if (next.has(qId)) next.delete(qId)
    else next.add(qId)
    setSelectedIds(next)
  }

  const handleEditEnunciado = (qId: string, newText: string) => {
    setQuestoes(prev => prev.map(q => q.id === qId ? { ...q, enunciado: newText } : q))
  }

  const handleEditAlternativaImage = (qId: string, altId: string, url: string) => {
    setQuestoes(prev => prev.map(q => {
      if (q.id === qId) {
        const newAlts = q.provas_alternativas.map((a: any) => a.id === altId ? { ...a, imagem_url: url } : a)
        return {
          ...q,
          provas_alternativas: newAlts,
          simulados_alternativas: newAlts
        }
      }
      return q
    }))
  }

  const handleEditAlternativa = (qId: string, altId: string, newText: string) => {
    setQuestoes(prev => prev.map(q => {
      if (q.id === qId) {
        const newAlts = q.provas_alternativas.map((a: any) => a.id === altId ? { ...a, texto: newText } : a)
        return {
          ...q,
          provas_alternativas: newAlts,
          simulados_alternativas: newAlts
        }
      }
      return q
    }))
  }

  const handleEditEnunciadoImage = (qId: string, imgIndex: number, newUrl: string) => {
    setQuestoes(prev => prev.map(q => {
      if (q.id === qId && q.imagens) {
        const newImagens = [...q.imagens]
        if (!newUrl) {
          newImagens.splice(imgIndex, 1)
        } else {
          newImagens[imgIndex] = newUrl
        }
        return { ...q, imagens: newImagens }
      }
      return q
    }))
  }

  const handleRemoveAlternativa = (qId: string, altId: string) => {
    setQuestoes(prev => prev.map(q => {
      if (q.id === qId) {
        const remaining = q.provas_alternativas.filter((a: any) => a.id !== altId)
        const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
        const newAlts = remaining.map((a: any, idx: number) => ({
            ...a,
            letra: letters[idx] || a.letra
          }))
        return {
          ...q,
          provas_alternativas: newAlts,
          simulados_alternativas: newAlts
        }
      }
      return q
    }))
  }

  const handlePrint = async () => {
    // Se quiser salvar antes
    // await salvarConfiguracoes()
    setTimeout(() => {
      window.print()
    }, 300)
  }

  const handleSaveAndPrint = async () => {
    if (!confirm('Deseja salvar esta adaptação no banco e imprimir?')) return
    setSaving(true)

    try {
      // 1. Clone Prova
      const { data: newProva, error: simErr } = await supabase.from('provas').insert({
        titulo: prova.titulo + ' ADAPTADO',
        data_aplicacao: prova.data_aplicacao,
        id_bimestre: prova.id_bimestre,
        status: 'rascunho',
        turmas: prova.turmas
      } as any).select().single()

      if (simErr) throw simErr

      // 2. Clone Requisições
      if (requisicoes.length > 0) {
        const newReqs = requisicoes.map(r => {
          const { id, created_at, updated_at, provas, simulados_disciplinas, ...restR } = r
          return {
            ...restR,
            id_prova: (newProva as any).id
          }
        })
        const { error: rErr } = await supabase.from('provas_requisicoes').insert(newReqs as any)
        if (rErr) throw rErr
      }

      // 3. Clone selected Questoes and Alternativas
      const selectedList = questoes.filter(q => selectedIds.has(q.id))
      
      for (const q of selectedList) {
        const { id, created_at, updated_at, simulados_disciplinas, provas_alternativas, simulados_alternativas, ...restQ } = q
        const { data: newQ, error: qErr } = await supabase.from('provas_questoes').insert({
          ...restQ,
          id_prova: (newProva as any).id,
          eh_adaptada: true
        } as any).select().single()

        if (qErr) throw qErr

        const altsToClone = q.provas_alternativas || q.simulados_alternativas || []
        if (altsToClone.length > 0) {
          const newAlts = altsToClone.map((a: any) => ({
            id_questao: (newQ as any).id,
            letra: a.letra,
            texto: a.texto,
            eh_correta: a.eh_correta,
            imagem_url: a.imagem_url
          }))
          const { error: aErr } = await supabase.from('provas_alternativas').insert(newAlts as any)
          if (aErr) throw aErr
        }
      }

      // Automatically trigger print after slight delay
      setTimeout(() => {
        window.print()
        setSaving(false)
        router.push('/provas/lista')
      }, 500)

    } catch (e: any) {
      alert('Erro ao salvar adaptação: ' + e.message)
      setSaving(false)
    }
  }

  const handleSaveHeaderLayout = async () => {
    if (!config || !config.id) return
    setSaving(true)
    try {
      const { error } = await (supabase as any)
        .from('simulados_configuracoes')
        .update({ provas_header_layout: headerLayout })
        .eq('id', config.id)
      
      if (error) throw error
      alert('Posições do cabeçalho salvas com sucesso!')
      setIsEditHeaderMode(false)
    } catch (e: any) {
      alert('Erro ao salvar layout: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateHeaderField = (key: string, newField: any) => {
    setHeaderLayout((prev: any) => ({ ...prev, [key]: newField }))
  }

  const handleRestoreDefaultLayout = () => {
    if (confirm('Deseja restaurar as posições originais do sistema?')) {
      setHeaderLayout(defaultHeaderLayout)
    }
  }

  const selectedList = React.useMemo(() => {
    return questoes.filter(q => selectedIds.has(q.id))
  }, [questoes, selectedIds])

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc' }}>
        <Loader2 className="animate-spin" size={40} color="#3b82f6" style={{ marginBottom: 16 }} />
        <p style={{ color: '#64748b', fontWeight: 600 }}>Carregando estúdio de edição...</p>
      </div>
    )
  }

  return (
    <div className="page-layout" style={{ display: 'flex', height: '100vh', background: '#f1f5f9', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Sidebar de Configurações (No Print) */}
      <div className="no-print sidebar-layout" style={{ width: 380, background: 'white', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', boxShadow: '4px 0 24px rgba(0,0,0,0.02)', zIndex: 10 }}>
        <div style={{ padding: '24px 32px', borderBottom: '1px solid #e2e8f0' }}>
          <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', color: '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: 14, padding: 0, marginBottom: 24 }}>
            <ChevronLeft size={18} /> Voltar
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Settings size={20} />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>Estúdio de Adaptação</h1>
          </div>
          <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.5, margin: 0 }}>Molde a prova visualmente para alunos com necessidades específicas. Remova questões indesejadas e altere o tamanho da fonte global.</p>
        </div>

        <div style={{ padding: '32px', flex: 1, overflowY: 'auto' }}>
          
          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 16 }}>
              <Type size={16} color="#3b82f6" /> Tamanho da Fonte (Global)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[12, 14, 16, 18, 20, 24].map(size => (
                <button
                  key={size}
                  onClick={() => setFontSize(size)}
                  style={{
                    padding: '12px',
                    borderRadius: 12,
                    background: fontSize === size ? '#3b82f6' : '#f8fafc',
                    color: fontSize === size ? 'white' : '#475569',
                    border: `1px solid ${fontSize === size ? '#3b82f6' : '#e2e8f0'}`,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontSize: 14
                  }}
                >
                  {size}pt
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 16 }}>
              <Move size={16} color="#3b82f6" /> Cabeçalho (Fundo PNG)
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                onClick={() => setIsEditHeaderMode(!isEditHeaderMode)}
                style={{
                  padding: '12px', borderRadius: 12,
                  background: isEditHeaderMode ? '#ef4444' : '#f8fafc',
                  color: isEditHeaderMode ? 'white' : '#475569',
                  border: `1px solid ${isEditHeaderMode ? '#ef4444' : '#e2e8f0'}`,
                  fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                {isEditHeaderMode ? <X size={16} /> : <Move size={16} />}
                {isEditHeaderMode ? 'Sair da Edição' : 'Editar Posições'}
              </button>

              {isEditHeaderMode && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                     onClick={handleSaveHeaderLayout}
                     disabled={saving}
                     style={{
                       flex: 1, padding: '10px', borderRadius: 8,
                       background: '#10b981', color: 'white', border: 'none',
                       fontWeight: 600, cursor: 'pointer', fontSize: 13,
                       display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                     }}
                  >
                    <Save size={14} /> Salvar Posições
                  </button>
                  <button
                    onClick={handleRestoreDefaultLayout}
                    style={{
                      padding: '10px', borderRadius: 8,
                      background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0',
                      fontWeight: 600, cursor: 'pointer', fontSize: 13,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                    }}
                    title="Restaurar padrão"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 16 }}>
              <LayoutList size={16} color="#3b82f6" /> Layout da Prova
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                onClick={() => setColumns(1)}
                style={{
                  padding: '12px', borderRadius: 12,
                  background: columns === 1 ? '#3b82f6' : '#f8fafc',
                  color: columns === 1 ? 'white' : '#475569',
                  border: `1px solid ${columns === 1 ? '#3b82f6' : '#e2e8f0'}`,
                  fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                <LayoutList size={16} /> 1 Coluna
              </button>
              <button
                onClick={() => setColumns(2)}
                style={{
                  padding: '12px', borderRadius: 12,
                  background: columns === 2 ? '#3b82f6' : '#f8fafc',
                  color: columns === 2 ? 'white' : '#475569',
                  border: `1px solid ${columns === 2 ? '#3b82f6' : '#e2e8f0'}`,
                  fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                <Columns size={16} /> 2 Colunas
              </button>
            </div>
          </div>



          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 16 }}>
              <LayoutList size={16} color="#3b82f6" style={{ transform: 'rotate(90deg)' }} /> Layout das Alternativas
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                onClick={() => setAlternativasLayout('vertical')}
                style={{
                  padding: '12px', borderRadius: 12,
                  background: alternativasLayout === 'vertical' ? '#3b82f6' : '#f8fafc',
                  color: alternativasLayout === 'vertical' ? 'white' : '#475569',
                  border: `1px solid ${alternativasLayout === 'vertical' ? '#3b82f6' : '#e2e8f0'}`,
                  fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                Embaixo
              </button>
              <button
                onClick={() => setAlternativasLayout('horizontal')}
                style={{
                  padding: '12px', borderRadius: 12,
                  background: alternativasLayout === 'horizontal' ? '#3b82f6' : '#f8fafc',
                  color: alternativasLayout === 'horizontal' ? 'white' : '#475569',
                  border: `1px solid ${alternativasLayout === 'horizontal' ? '#3b82f6' : '#e2e8f0'}`,
                  fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                Lado a Lado
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 16 }}>
              <CheckSquare size={16} color="#10b981" /> Resumo de Seleção
            </label>
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#475569', fontSize: 14 }}>Questões Originais</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{questoes.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#475569', fontSize: 14 }}>Questões Selecionadas</span>
                <span style={{ fontWeight: 700, color: '#10b981' }}>{selectedIds.size}</span>
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(245,158,11,0.1)', padding: 16, borderRadius: 12, border: '1px solid rgba(245,158,11,0.2)' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <Info size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
              <p style={{ color: '#b45309', fontSize: 13, lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                Dica: Clique no texto das questões e alternativas na área central para editá-los diretamente. Suas edições serão salvas diretamente neste prova.
              </p>
            </div>
          </div>

        </div>

        <div style={{ padding: '24px 32px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <button 
            disabled={saving}
            onClick={handleSaveAndPrint} 
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', background: '#3b82f6', color: 'white', padding: '16px', borderRadius: 12, border: 'none', fontWeight: 700, fontSize: 15, cursor: saving ? 'wait' : 'pointer', transition: 'all 0.2s', opacity: saving ? 0.7 : 1, boxShadow: '0 8px 16px rgba(59,130,246,0.2)' }}
          >
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            {saving ? 'Salvando...' : 'Salvar e Imprimir'}
          </button>
        </div>
      </div>

      {/* Área Central (Canvas / Papel) */}
      <div className="canvas-layout" style={{ flex: 1, overflowY: 'auto', padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="print-wrapper" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <PaginationEngine 
              questoes={selectedList}
              columns={columns}
              alternativasLayout={alternativasLayout}
              fontSize={fontSize}
              config={config}
              simulado={prova}
              onEditEnunciado={handleEditEnunciado}
              onEditEnunciadoImage={handleEditEnunciadoImage}
              onEditAlternativa={handleEditAlternativa}
              onEditAlternativaImage={handleEditAlternativaImage}
              onRemoveAlternativa={handleRemoveAlternativa}
              onToggleQuestion={handleToggleQuestion}
              isEditHeaderMode={isEditHeaderMode}
              headerLayout={headerLayout}
              onUpdateHeaderField={handleUpdateHeaderField}
              pageA4Ref={pageA4Ref}
            />
        </div>
        <IgnoredQuestionsList
          questoes={questoes.filter(q => !selectedIds.has(q.id))}
          onToggle={handleToggleQuestion}
        />
      </div>

      <style>{`
        @media (max-width: 768px) {
          .page-layout { flex-direction: column !important; }
          .sidebar-layout { width: 100% !important; max-height: 50vh !important; border-right: none !important; border-bottom: 1px solid #e2e8f0 !important; }
          .canvas-layout { padding: 16px !important; }
        }
      `}</style>
    </div>
  )
}
