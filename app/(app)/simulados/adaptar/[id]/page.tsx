'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, Printer, ChevronLeft, Type, CheckSquare, Save, Settings, Info, X, Columns, LayoutList } from 'lucide-react'
import { PaginationEngine } from '@/components/simulados/PaginationEngine'
import { IgnoredQuestionsList } from '@/components/simulados/IgnoredQuestionsList'

export default function AdaptarSimuladoPage() {
  const { id } = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [simulado, setSimulado] = useState<any>(null)
  const [questoes, setQuestoes] = useState<any[]>([])
  const [requisicoes, setRequisicoes] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [fontSize, setFontSize] = useState<number>(14) // base font size in px (default 14pt)
  const [columns, setColumns] = useState<number>(1) // Layout de colunas
  const [config, setConfig] = useState<any>(null)

  useEffect(() => {
    async function loadData() {
      if (!id) return

      const { data: confData } = await supabase.from('simulados_configuracoes').select('*').eq('id', 'default').single()
      setConfig(confData)

      const { data: simData } = await supabase.from('simulados').select('*').eq('id', id).single()
      if (simData) {
        const s = simData as any
        setSimulado({ ...s, titulo: `${s.titulo} (Adaptado)` })
        if (s.config_estudio?.config_fonte_enunciado) {
          setFontSize(s.config_estudio.config_fonte_enunciado)
        }
      }

      const { data: reqs } = await supabase.from('simulados_requisicoes').select('*').eq('id_simulado', id).order('created_at', { ascending: true })
      if (reqs) setRequisicoes(reqs)

      const { data: qData } = await supabase.from('simulados_questoes').select(`
        *,
        simulados_disciplinas(nome),
        simulados_alternativas(*)
      `).eq('id_simulado', id)

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
          q.simulados_alternativas?.sort((a: any, b: any) => a.letra.localeCompare(b.letra))
        })
        setQuestoes(qData)
        setSelectedIds(new Set(qData.map((q: any) => q.id)))
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

  const handleEditAlternativa = (qId: string, altId: string, newText: string) => {
    setQuestoes(prev => prev.map(q => {
      if (q.id === qId) {
        return {
          ...q,
          simulados_alternativas: q.simulados_alternativas.map((a: any) => a.id === altId ? { ...a, texto: newText } : a)
        }
      }
      return q
    }))
  }

  const handleRemoveAlternativa = (qId: string, altId: string) => {
    setQuestoes(prev => prev.map(q => {
      if (q.id === qId) {
        const remaining = q.simulados_alternativas.filter((a: any) => a.id !== altId)
        const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
        return {
          ...q,
          simulados_alternativas: remaining.map((a: any, idx: number) => ({
            ...a,
            letra: letters[idx] || a.letra
          }))
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
      // 1. Clone Simulado
      const { data: newSimulado, error: simErr } = await (supabase as any).from('simulados').insert({
        titulo: simulado.titulo,
        data_aplicacao: simulado.data_aplicacao,
        id_bimestre: simulado.id_bimestre,
        status: 'rascunho',
        turmas: simulado.turmas
      }).select().single()

      if (simErr) throw simErr

      // 2. Clone Requisições
      if (requisicoes.length > 0) {
        const newReqs = requisicoes.map(r => {
          const { id, created_at, updated_at, simulados_disciplinas, ...restR } = r
          return {
            ...restR,
            id_simulado: (newSimulado as any).id
          }
        })
        const { error: rErr } = await (supabase as any).from('simulados_requisicoes').insert(newReqs)
        if (rErr) throw rErr
      }

      // 3. Clone selected Questoes and Alternativas
      const selectedList = questoes.filter(q => selectedIds.has(q.id))
      
      for (const q of selectedList) {
        const { id, created_at, updated_at, simulados_disciplinas, simulados_alternativas, ...restQ } = q
        const { data: newQ, error: qErr } = await (supabase as any).from('simulados_questoes').insert({
          ...restQ,
          id_simulado: (newSimulado as any).id,
          eh_adaptada: true
        }).select().single()

        if (qErr) throw qErr

        if (q.simulados_alternativas && q.simulados_alternativas.length > 0) {
          const newAlts = q.simulados_alternativas.map((a: any) => ({
            id_questao: (newQ as any).id,
            letra: a.letra,
            texto: a.texto,
            eh_correta: a.eh_correta
          }))
          const { error: aErr } = await (supabase as any).from('simulados_alternativas').insert(newAlts)
          if (aErr) throw aErr
        }
      }

      // Automatically trigger print after slight delay
      setTimeout(() => {
        window.print()
        setSaving(false)
        router.push('/simulados/lista')
      }, 500)

    } catch (e: any) {
      alert('Erro ao salvar adaptação: ' + e.message)
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc' }}>
        <Loader2 className="animate-spin" size={40} color="#3b82f6" style={{ marginBottom: 16 }} />
        <p style={{ color: '#64748b', fontWeight: 600 }}>Carregando estúdio de adaptação...</p>
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
                Dica: Clique no texto das questões e alternativas na área central para editá-los diretamente. Suas edições serão salvas em uma cópia independente.
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
            questoes={questoes.filter(q => selectedIds.has(q.id))}
            columns={columns}
            enunciadoFontSize={fontSize}
            alternativasFontSize={fontSize}
            config={config}
            simulado={simulado}
            onEditEnunciado={handleEditEnunciado}
            onEditAlternativa={handleEditAlternativa}
            onRemoveAlternativa={handleRemoveAlternativa}
            onToggleQuestion={handleToggleQuestion}
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
