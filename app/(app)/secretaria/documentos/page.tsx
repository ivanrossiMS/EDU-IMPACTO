'use client'

import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useData } from '@/lib/dataContext'
import { useState, useEffect, useRef } from 'react'
import { FileText, Search, Plus, Trash2, Printer, Image as ImageIcon, Sparkles, Upload, FileSignature, Save, X, Eye, CheckCircle, Wand2, Settings, Copy } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import dynamic from 'next/dynamic'
import 'react-quill-new/dist/quill.snow.css'

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false })

const quillModules = {
  toolbar: [
    [{ 'size': ['8px', '10px', '12px', false, '16px', '18px', '20px', '24px', '32px'] }],
    [{ 'color': [] }, { 'background': [] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'align': [] }],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'lineheight': [false, '1.0', '1.2', '1.5', '2.0', '2.5', '3.0'] }],
    ['clean']
  ],
  clipboard: {
    matchVisual: false
  }
}

interface ModeloDocumento {
  id: string
  titulo: string
  conteudo: string
  created_at: string
}

interface Timbrado {
  name: string
  url: string
}

export default function SecretariaDocumentosPage() {
  const { logSystemAction } = useData()

  // Tabs: 'emitir' | 'modelos' | 'timbrados'
  const [activeTab, setActiveTab] = useState<'emitir' | 'modelos' | 'timbrados'>('emitir')

  // Timbrados
  const [timbrados, setTimbrados] = useState<{name: string, url: string}[]>([])
  const [loadingTimbrados, setLoadingTimbrados] = useState(true)
  
  // Margens dos Timbrados (armazenadas no localStorage)
  const [timbradosMargens, setTimbradosMargens] = useState<Record<string, { top: number, bottom: number, left: number, right: number }>>({})
  const [margemModalOpen, setMargemModalOpen] = useState(false)
  const [timbradoParaMargem, setTimbradoParaMargem] = useState<{name: string, url: string} | null>(null)
  const [margensTemp, setMargensTemp] = useState({ top: 75, bottom: 30, left: 25, right: 25 })
  
  // Modelos State
  const [modelosDB, setModelosDB] = useState<ModeloDocumento[]>([])
  const [modeloAtual, setModeloAtual] = useState<{titulo: string, conteudo: string, id?: string}>({ titulo: '', conteudo: '' })
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)
  const [promptIA, setPromptIA] = useState('')

  // Emissão State
  const [search, setSearch] = useState('')
  const [isSearchingDB, setIsSearchingDB] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [alunosEncontrados, setAlunosEncontrados] = useState<any[]>([])
  const [alunoSel, setAlunoSel] = useState<any>(null)
  const [modeloSelId, setModeloSelId] = useState<string>('')
  const [timbradoSelUrl, setTimbradoSelUrl] = useState<string>('')
  
  // Revisão e Impressão
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [textoFinalImp, setTextoFinalImp] = useState('')

  // Limpar texto final modificado sempre que as seleções mudarem
  useEffect(() => {
    setTextoFinalImp('')
  }, [alunoSel, modeloSelId])

  // Print Preview
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ReactQuillImport = require('react-quill-new')
      if (ReactQuillImport && ReactQuillImport.Quill) {
        const Size = ReactQuillImport.Quill.import('formats/size')
        if (Size) {
          Size.whitelist = ['8px', '10px', '12px', '14px', '16px', '18px', '20px', '24px', '32px']
          ReactQuillImport.Quill.register(Size, true)
        }
        
        const AlignStyle = ReactQuillImport.Quill.import('attributors/style/align')
        if (AlignStyle) {
          const StyleAttributor = AlignStyle.constructor
          const LineHeightStyle = new StyleAttributor('lineheight', 'line-height', {
            scope: AlignStyle.scope,
            whitelist: ['1.0', '1.2', '1.5', '2.0', '2.5', '3.0']
          })
          ReactQuillImport.Quill.register(LineHeightStyle, true)
        }
      }
    }

    fetchTimbrados()
    fetchModelos()
    
    // Load margins
    try {
      const stored = localStorage.getItem('@EduImpacto:TimbradosMargens')
      if (stored) {
        setTimbradosMargens(JSON.parse(stored))
      }
    } catch (e) {
      console.error('Error loading margins', e)
    }
  }, [])

  const fetchModelos = async () => {
    try {
      const { data, error } = await supabase
        .from('documentos_modelos')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setModelosDB(data || [])
    } catch (err) {
      console.error('Erro ao buscar modelos:', err)
    }
  }

  const handleBuscarAlunos = async () => {
    if (!search.trim()) return
    setIsSearchingDB(true)
    setHasSearched(false)
    try {
      // Usamos a API para contornar restrições de RLS do client-side
      const res = await fetch(`/api/alunos?search=${encodeURIComponent(search.trim())}&limit=100`)
      const result = await res.json()
      
      if (!res.ok) {
        throw new Error(result.error || 'Falha ao buscar alunos na API')
      }
      
      setAlunosEncontrados(result.data || [])
      setHasSearched(true)
    } catch (err: any) {
      console.error('Erro ao buscar alunos', err)
      alert('Erro ao buscar alunos no banco: ' + err.message)
    } finally {
      setIsSearchingDB(false)
    }
  }

  const fetchTimbrados = async () => {
    setLoadingTimbrados(true)
    try {
      const formData = new FormData()
      formData.append('action', 'list')
      
      const res = await fetch('/api/documentos-midia', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar timbrados')
      
      setTimbrados(data.list || [])
    } catch (err) {
      console.error('Erro ao buscar timbrados', err)
    } finally {
      setLoadingTimbrados(false)
    }
  }

  const handleUploadTimbrado = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const formData = new FormData()
    formData.append('action', 'upload')
    formData.append('file', file)
    formData.append('bucket', 'documentos')
    formData.append('path', 'timbrados')
    
    try {
      const res = await fetch('/api/documentos-midia', {
        method: 'POST',
        body: formData
      })
      const result = await res.json()
      
      if (!res.ok) throw new Error(result.error)
      
      alert('Timbrado enviado com sucesso!')
      fetchTimbrados()
    } catch (err: any) {
      alert('Erro ao enviar timbrado: ' + err.message)
    }
  }

  const handleDeleteTimbrado = async (name: string) => {
    if (!confirm('Deseja realmente apagar este timbrado?')) return
    
    const formData = new FormData()
    formData.append('action', 'delete')
    formData.append('fileName', name)
    
    try {
      const res = await fetch('/api/documentos-midia', {
        method: 'POST',
        body: formData
      })
      const result = await res.json()
      
      if (!res.ok) throw new Error(result.error)
        
      fetchTimbrados()
    } catch (err: any) {
      alert('Erro ao deletar timbrado: ' + err.message)
    }
  }

  const variaveisDisponiveis = `
<<aluno>> : Nome do aluno
<<matricula>> : Matrícula do aluno
<<turma>> : Nome da turma atual
<<serie>> : Série atual
<<turno>> : Turno
<<status>> : Situação do aluno
<<unidade>> : Unidade escolar
<<email_aluno>> : Email do aluno
<<telefone_aluno>> : Telefone do aluno
<<data_nascimento>> : Data de nascimento
<<responsavel_nome>> : Nome do responsável principal
<<responsavel_financeiro>> : Responsável Financeiro
<<responsavel_pedagogico>> : Responsável Pedagógico
<<pai>> : Nome do Pai
<<mae>> : Nome da Mãe
<<data_atual_str>> : Data por extenso (Ex: "08 de julho de 2026")
<<data_atual_num>> : Data numérica (Ex: "08/07/2026")
<<hora_atual>> : Hora (Ex: "14:30")
`

  // --- GERADOR DE IA ---
  const handleGerarComIA = async () => {
    if (!promptIA) return
    setIsGeneratingAI(true)
    try {
      const res = await fetch('/api/ai/gerar-modelo-documento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptIA, variaveisDisponiveis })
      })
      const data = await res.json()
      if (res.ok && data.texto) {
        let cont = data.texto;
        if (!cont.includes('<p>') && !cont.includes('<br>')) {
          cont = cont.replace(/<</g, '&lt;&lt;').replace(/>>/g, '&gt;&gt;').split('\n').map((l: string) => l.trim() ? `<p>${l}</p>` : '<p><br></p>').join('')
        } else {
          cont = cont.replace(/<</g, '&lt;&lt;').replace(/>>/g, '&gt;&gt;')
        }
        setModeloAtual(prev => ({ ...prev, conteudo: cont }))
        setPromptIA('')
      } else {
        alert('Erro ao gerar com IA: ' + (data.error || 'Erro desconhecido'))
      }
    } catch (err) {
      console.error(err)
      alert('Falha na comunicação com a IA')
    } finally {
      setIsGeneratingAI(false)
    }
  }

  const handleSaveAsNew = async () => {
    if (!modeloAtual.titulo || !modeloAtual.conteudo) {
      alert('Preencha título e conteúdo')
      return
    }
    
    const newId = crypto.randomUUID()
    
    const { error } = await supabase.from('documentos_modelos').insert({
      id: newId,
      titulo: modeloAtual.titulo,
      conteudo: modeloAtual.conteudo
    } as any)
    
    if (error) {
      alert('Erro ao salvar novo modelo: ' + error.message)
    } else {
      alert('Novo modelo salvo com sucesso!')
      setModeloAtual({ titulo: '', conteudo: '' })
      fetchModelos()
    }
  }

  const handleSaveModelo = async () => {
    if (!modeloAtual.titulo || !modeloAtual.conteudo) {
      alert('Preencha título e conteúdo')
      return
    }
    
    // Como a tabela foi criada manualmente, ela pode não ter um gerador automático de UUID.
    // Então passamos um crypto.randomUUID() caso seja um novo modelo.
    const modeloId = modeloAtual.id || crypto.randomUUID()
    
    const { error } = await supabase.from('documentos_modelos').upsert({
      id: modeloId,
      titulo: modeloAtual.titulo,
      conteudo: modeloAtual.conteudo
    } as any)
    
    if (error) {
      alert('Erro ao salvar modelo: ' + error.message)
    } else {
      alert('Modelo salvo com sucesso!')
      setModeloAtual({ titulo: '', conteudo: '' })
      fetchModelos()
    }
  }

  const handleDeleteModelo = async (id: string) => {
    if (!confirm('Deseja excluir este modelo?')) return
    const { error } = await supabase.from('documentos_modelos').delete().eq('id', id)
    if (error) {
      alert('Erro ao deletar: ' + error.message)
    } else {
      fetchModelos()
    }
  }

  const getConteudoInterpolado = () => {
    const modDb = (modelosDB || []).find(m => m.id === modeloSelId)
    if (!modDb && modeloAtual.id !== modeloSelId) return ''
    
    // Se estiver editando o mesmo modelo selecionado, pega o conteúdo atual com todas as edições, 
    // mesmo que ainda não tenha clicado em salvar.
    let conteudoReal = (modeloAtual.id === modeloSelId && modeloAtual.conteudo) ? modeloAtual.conteudo : (modDb?.conteudo || '')
    
    if (!conteudoReal.includes('<p>') && !conteudoReal.includes('<br>')) {
      conteudoReal = conteudoReal.replace(/<</g, '&lt;&lt;').replace(/>>/g, '&gt;&gt;').split('\n').map((l: string) => l.trim() ? `<p>${l}</p>` : '<p><br></p>').join('')
    }
    
    let texto = conteudoReal.replace(/&nbsp;/g, ' ')
    const dataAtualExtenso = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    const dataAtualNum = new Date().toLocaleDateString('pt-BR')
    const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    const replaceVar = (text: string, varName: string, value: string) => {
      // Aceita <<variavel>> ou &lt;&lt;variavel&gt;&gt; (do Quill editor)
      const regex = new RegExp(`(?:<<|&lt;&lt;)${varName}(?:>>|&gt;&gt;)`, 'g')
      return text.replace(regex, value)
    }

    if (alunoSel) {
      texto = replaceVar(texto, 'aluno', alunoSel.nome || '')
      texto = replaceVar(texto, 'matricula', alunoSel.matricula || '')
      texto = replaceVar(texto, 'turma', alunoSel.turma_nome || alunoSel.turma || '')
      texto = replaceVar(texto, 'serie', alunoSel.serie_nome || alunoSel.serie || '')
      texto = replaceVar(texto, 'turno', alunoSel.turno_nome || alunoSel.turno || '')
      texto = replaceVar(texto, 'status', alunoSel.status || '')
      texto = replaceVar(texto, 'unidade', alunoSel.unidade || '')
      texto = replaceVar(texto, 'email_aluno', alunoSel.email || '')
      texto = replaceVar(texto, 'telefone_aluno', alunoSel.telefone || '')
      texto = replaceVar(texto, 'data_nascimento', alunoSel.data_nascimento ? new Date(alunoSel.data_nascimento).toLocaleDateString('pt-BR') : '')
      texto = replaceVar(texto, 'responsavel_nome', alunoSel.responsavel || '')
      texto = replaceVar(texto, 'responsavel_financeiro', alunoSel.responsavel_financeiro || '')
      texto = replaceVar(texto, 'responsavel_pedagogico', alunoSel.responsavel_pedagogico || '')
      texto = replaceVar(texto, 'pai', alunoSel.nome_pai || alunoSel.pai || alunoSel.dados?.nome_pai || alunoSel.dados?.pai || alunoSel.dados?.nomePai || '')
      texto = replaceVar(texto, 'mae', alunoSel.nome_mae || alunoSel.mae || alunoSel.dados?.nome_mae || alunoSel.dados?.mae || alunoSel.dados?.nomeMae || '')
      texto = replaceVar(texto, 'ano', alunoSel.ano_letivo || new Date().getFullYear().toString())
      texto = replaceVar(texto, 'ano_letivo', alunoSel.ano_letivo || new Date().getFullYear().toString())
    }
    
    texto = replaceVar(texto, 'data_atual_str', dataAtualExtenso)
    texto = replaceVar(texto, 'data_atual_num', dataAtualNum)
    texto = replaceVar(texto, 'hora_atual', horaAtual)
    
    return texto
  }

  const handleAbrirRevisao = () => {
    setTextoFinalImp(getConteudoInterpolado())
    setShowPreviewModal(true)
  }

  const imprimir = () => {
    if (!alunoSel || !timbradoSelUrl || !modeloSelId) {
      return alert('Selecione o Aluno, o Modelo e o Timbrado para imprimir.')
    }
    
    // Registra emissão no banco (pode falhar silenciosamente se a tabela antiga 'documentos_emitidos' for usada)
    fetch('/api/documentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aluno_id: alunoSel.id,
        documento_tipo: (modelosDB || []).find(m => m.id === modeloSelId)?.titulo || 'Documento',
        emitido_por: 'Secretaria'
      })
    }).catch(console.error)

    window.print()
  }

  return (
    <div style={{ padding: '32px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Estilos globais para a impressão */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            transform: none !important;
            background: white !important;
            -webkit-print-color-adjust: exact;
            z-index: 9999 !important;
          }
          @page {
            size: A4;
            margin: 0;
          }
        }
        
        .ql-editor {
          min-height: 250px;
          font-family: inherit;
          font-size: 14px;
          word-break: break-word;
          overflow-wrap: anywhere;
        }
        
        .ql-editor p {
          margin-bottom: 0.5em;
          line-height: 1.0;
        }
        
        .ql-toolbar.ql-snow {
          border: none !important;
          border-bottom: 1px solid #e2e8f0 !important;
          background: #f8fafc;
        }
        
        .ql-container.ql-snow {
          border: none !important;
        }

        /* Quill Custom Sizes Labels */
        .ql-snow .ql-picker.ql-size .ql-picker-label::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item::before { content: '14px'; }
        
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="8px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="8px"]::before { content: '8px'; }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="10px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="10px"]::before { content: '10px'; }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="12px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="12px"]::before { content: '12px'; }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="16px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="16px"]::before { content: '16px'; }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="18px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="18px"]::before { content: '18px'; }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="20px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="20px"]::before { content: '20px'; }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="24px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="24px"]::before { content: '24px'; }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="32px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="32px"]::before { content: '32px'; }

        /* Quill Custom Sizes Classes */
        .ql-editor .ql-size-8px { font-size: 8px; }
        .ql-editor .ql-size-10px { font-size: 10px; }
        .ql-editor .ql-size-12px { font-size: 12px; }
        .ql-editor .ql-size-16px { font-size: 16px; }
        .ql-editor .ql-size-18px { font-size: 18px; }
        .ql-editor .ql-size-20px { font-size: 20px; }
        .ql-editor .ql-size-24px { font-size: 24px; }
        .ql-editor .ql-size-32px { font-size: 32px; }

        /* Quill Custom Line Heights Classes */
        .ql-editor .ql-lineheight-1\\.0 { line-height: 1.0; }
        .ql-editor .ql-lineheight-1\\.2 { line-height: 1.2; }
        .ql-editor .ql-lineheight-1\\.5 { line-height: 1.5; }
        .ql-editor .ql-lineheight-2\\.0 { line-height: 2.0; }
        .ql-editor .ql-lineheight-2\\.5 { line-height: 2.5; }
        .ql-editor .ql-lineheight-3\\.0 { line-height: 3.0; }

        /* Quill Custom Line Heights Picker */
        .ql-snow .ql-picker.ql-lineheight { width: 125px; }
        .ql-snow .ql-picker.ql-lineheight .ql-picker-label::before,
        .ql-snow .ql-picker.ql-lineheight .ql-picker-item::before { content: 'Espaço 1.0'; }
        
        .ql-snow .ql-picker.ql-lineheight .ql-picker-label[data-value="1.0"]::before,
        .ql-snow .ql-picker.ql-lineheight .ql-picker-item[data-value="1.0"]::before { content: 'Espaço 1.0'; }
        .ql-snow .ql-picker.ql-lineheight .ql-picker-label[data-value="1.2"]::before,
        .ql-snow .ql-picker.ql-lineheight .ql-picker-item[data-value="1.2"]::before { content: 'Espaço 1.2'; }
        .ql-snow .ql-picker.ql-lineheight .ql-picker-label[data-value="1.5"]::before,
        .ql-snow .ql-picker.ql-lineheight .ql-picker-item[data-value="1.5"]::before { content: 'Espaço 1.5'; }
        .ql-snow .ql-picker.ql-lineheight .ql-picker-label[data-value="2.0"]::before,
        .ql-snow .ql-picker.ql-lineheight .ql-picker-item[data-value="2.0"]::before { content: 'Espaço 2.0'; }
        .ql-snow .ql-picker.ql-lineheight .ql-picker-label[data-value="2.5"]::before,
        .ql-snow .ql-picker.ql-lineheight .ql-picker-item[data-value="2.5"]::before { content: 'Espaço 2.5'; }
        .ql-snow .ql-picker.ql-lineheight .ql-picker-label[data-value="3.0"]::before,
        .ql-snow .ql-picker.ql-lineheight .ql-picker-item[data-value="3.0"]::before { content: 'Espaço 3.0'; }
      `}} />

      {/* Header */}
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <FileText size={20} style={{ color: '#2563eb' }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '1px' }}>Secretaria</span>
          </div>
          <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 32, color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>Gerador de Documentos</h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: '4px 0 0 0' }}>Crie documentos usando Inteligência Artificial e Papel Timbrado.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => setActiveTab('emitir')} style={{ padding: '10px 16px', background: activeTab === 'emitir' ? '#2563eb' : '#fff', color: activeTab === 'emitir' ? '#fff' : '#64748b', border: activeTab === 'emitir' ? 'none' : '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
            Emitir Documento
          </button>
          <button onClick={() => setActiveTab('modelos')} style={{ padding: '10px 16px', background: activeTab === 'modelos' ? '#2563eb' : '#fff', color: activeTab === 'modelos' ? '#fff' : '#64748b', border: activeTab === 'modelos' ? 'none' : '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
            Gerenciar Modelos (IA)
          </button>
          <button onClick={() => setActiveTab('timbrados')} style={{ padding: '10px 16px', background: activeTab === 'timbrados' ? '#2563eb' : '#fff', color: activeTab === 'timbrados' ? '#fff' : '#64748b', border: activeTab === 'timbrados' ? 'none' : '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
            Papéis Timbrados
          </button>
        </div>
      </div>

      {activeTab === 'timbrados' && (
        <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Gestão de Timbrados (Backgrounds)</h2>
            <label style={{ cursor: 'pointer', padding: '10px 16px', background: '#0f172a', color: '#fff', borderRadius: '8px', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Upload size={16} /> Enviar Novo Fundo
              <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleUploadTimbrado} />
            </label>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
            {loadingTimbrados ? <p>Carregando...</p> : timbrados.length === 0 ? <p>Nenhum timbrado enviado.</p> : timbrados.map(t => (
              <div key={t.name} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: '280px', background: '#f8fafc', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundImage: `url(${t.url})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }}>
                  {/* Preview image */}
                </div>
                <div style={{ padding: '12px', background: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name.substring(14)}</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => {
                      setTimbradoParaMargem(t)
                      setMargensTemp(timbradosMargens[t.name] || { top: 75, bottom: 30, left: 25, right: 25 })
                      setMargemModalOpen(true)
                    }} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }} title="Ajustar Margens">
                      <Settings size={16} />
                    </button>
                    <button onClick={() => handleDeleteTimbrado(t.name)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }} title="Excluir Fundo">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'modelos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Nova Seção de Modelos Salvos no Topo */}
          <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={20} color="#2563eb" /> Modelos Salvos
              </h2>
              <button 
                onClick={() => setModeloAtual({titulo: '', conteudo: ''})} 
                style={{ padding: '8px 16px', background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
              >
                <Plus size={16} /> Criar Novo Modelo
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {(!modelosDB || modelosDB.length === 0) ? (
                <div style={{ gridColumn: '1 / -1', padding: '32px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                  <FileSignature size={32} color="#94a3b8" style={{ margin: '0 auto 12px auto' }} />
                  <p style={{ fontSize: '14px', color: '#64748b', margin: 0, fontWeight: 500 }}>Nenhum modelo salvo ainda.</p>
                </div>
              ) : (
                modelosDB.map(m => (
                  <div key={m.id} style={{ display: 'flex', flexDirection: 'column', padding: '16px', background: modeloAtual.id === m.id ? '#eff6ff' : '#fff', borderRadius: '12px', border: modeloAtual.id === m.id ? '2px solid #2563eb' : '1px solid #e2e8f0', transition: 'all 0.2s', boxShadow: modeloAtual.id === m.id ? '0 4px 12px rgba(37, 99, 235, 0.1)' : '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', flex: 1, lineHeight: '1.4' }}>{m.titulo}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                      <button 
                        onClick={() => {
                          let cont = m.conteudo || ''
                          if (!cont.includes('<p>') && !cont.includes('<br>')) {
                            cont = cont.replace(/<</g, '&lt;&lt;').replace(/>>/g, '&gt;&gt;').split('\n').map(l => l.trim() ? `<p>${l}</p>` : '<p><br></p>').join('')
                          }
                          setModeloAtual({...m, conteudo: cont})
                        }} 
                        style={{ flex: 1, padding: '8px', background: modeloAtual.id === m.id ? '#2563eb' : '#f8fafc', color: modeloAtual.id === m.id ? '#fff' : '#334155', border: modeloAtual.id === m.id ? 'none' : '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
                      >
                        <FileSignature size={14} /> {modeloAtual.id === m.id ? 'Editando...' : 'Editar Modelo'}
                      </button>
                      <button 
                        onClick={() => handleDeleteModelo(m.id)} 
                        style={{ padding: '8px', background: '#fff', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', justifyContent: 'center', alignItems: 'center' }} 
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Area do Editor e Variáveis */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }}>
            <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px 0' }}>{modeloAtual.id ? 'Editar Conteúdo do Modelo' : 'Criar Novo Modelo'}</h2>
              
              <input 
                className="form-input"
              style={{ width: '100%', marginBottom: '16px', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              placeholder="Título do Documento (Ex: Declaração de Matrícula)"
              value={modeloAtual.titulo}
              onChange={e => setModeloAtual({...modeloAtual, titulo: e.target.value})}
            />

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Sparkles size={18} style={{ color: '#8b5cf6' }} />
                <span style={{ fontWeight: 600, color: '#4c1d95' }}>Escrever com Inteligência Artificial</span>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input 
                  className="form-input"
                  style={{ flex: 1, padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  placeholder="Ex: Gere uma declaração de transferência escolar..."
                  value={promptIA}
                  onChange={e => setPromptIA(e.target.value)}
                />
                <button 
                  onClick={handleGerarComIA}
                  disabled={isGeneratingAI}
                  style={{ padding: '10px 20px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: isGeneratingAI ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {isGeneratingAI ? 'Gerando...' : <><Wand2 size={16} /> Gerar Texto</>}
                </button>
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
              <ReactQuill 
                theme="snow"
                modules={quillModules}
                value={modeloAtual.conteudo}
                onChange={(val, delta, source) => {
                  if (source === 'user') {
                    setModeloAtual(prev => ({...prev, conteudo: val}))
                  }
                }}
                placeholder="Conteúdo do documento. Use as variáveis <<aluno>>, <<turma>>, etc..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', gap: '12px' }}>
              <button onClick={() => setModeloAtual({titulo: '', conteudo: ''})} style={{ padding: '10px 20px', background: 'transparent', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                Limpar
              </button>
              {modeloAtual.id && (
                <button onClick={handleSaveAsNew} style={{ padding: '10px 20px', background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Copy size={16} /> Salvar como Novo
                </button>
              )}
              <button onClick={handleSaveModelo} style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Save size={16} /> {modeloAtual.id ? 'Salvar Alterações' : 'Salvar Modelo'}
              </button>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: '350px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileSignature size={18} color="#2563eb" /> Variáveis Disponíveis
              </div>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px', lineHeight: '1.5' }}>
                Copie e cole os códigos abaixo no seu modelo. Eles serão substituídos automaticamente pelos dados reais ao gerar o documento.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', fontFamily: 'monospace', color: '#334155' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                  <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '4px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dados do Aluno</div>
                  <div><span style={{ color: '#2563eb', fontWeight: 600 }}>&lt;&lt;aluno&gt;&gt;</span> : Nome do aluno</div>
                  <div><span style={{ color: '#2563eb', fontWeight: 600 }}>&lt;&lt;matricula&gt;&gt;</span> : Matrícula do aluno</div>
                  <div><span style={{ color: '#2563eb', fontWeight: 600 }}>&lt;&lt;turma&gt;&gt;</span> : Turma atual</div>
                  <div><span style={{ color: '#2563eb', fontWeight: 600 }}>&lt;&lt;serie&gt;&gt;</span> : Série atual</div>
                  <div><span style={{ color: '#2563eb', fontWeight: 600 }}>&lt;&lt;turno&gt;&gt;</span> : Turno de estudo</div>
                  <div><span style={{ color: '#2563eb', fontWeight: 600 }}>&lt;&lt;status&gt;&gt;</span> : Situação acadêmica</div>
                  <div><span style={{ color: '#2563eb', fontWeight: 600 }}>&lt;&lt;data_nascimento&gt;&gt;</span> : Nasc. (Ex: 15/05/2010)</div>
                  <div><span style={{ color: '#2563eb', fontWeight: 600 }}>&lt;&lt;telefone_aluno&gt;&gt;</span> : Telefone principal</div>
                  <div><span style={{ color: '#2563eb', fontWeight: 600 }}>&lt;&lt;email_aluno&gt;&gt;</span> : Email do aluno</div>
                  <div><span style={{ color: '#2563eb', fontWeight: 600 }}>&lt;&lt;unidade&gt;&gt;</span> : Unidade Escolar</div>
                  <div><span style={{ color: '#2563eb', fontWeight: 600 }}>&lt;&lt;ano_letivo&gt;&gt;</span> : Ano letivo do curso</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                  <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '4px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Responsáveis</div>
                  <div><span style={{ color: '#16a34a', fontWeight: 600 }}>&lt;&lt;responsavel_nome&gt;&gt;</span> : Responsável padrão</div>
                  <div><span style={{ color: '#16a34a', fontWeight: 600 }}>&lt;&lt;responsavel_financeiro&gt;&gt;</span> : Resp. Financeiro</div>
                  <div><span style={{ color: '#16a34a', fontWeight: 600 }}>&lt;&lt;responsavel_pedagogico&gt;&gt;</span> : Resp. Pedagógico</div>
                  <div><span style={{ color: '#16a34a', fontWeight: 600 }}>&lt;&lt;pai&gt;&gt;</span> : Nome do Pai</div>
                  <div><span style={{ color: '#16a34a', fontWeight: 600 }}>&lt;&lt;mae&gt;&gt;</span> : Nome da Mãe</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                  <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '4px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sistema & Data</div>
                  <div><span style={{ color: '#8b5cf6', fontWeight: 600 }}>&lt;&lt;data_atual_str&gt;&gt;</span> : "08 de julho de 2026"</div>
                  <div><span style={{ color: '#8b5cf6', fontWeight: 600 }}>&lt;&lt;data_atual_num&gt;&gt;</span> : "08/07/2026"</div>
                  <div><span style={{ color: '#8b5cf6', fontWeight: 600 }}>&lt;&lt;hora_atual&gt;&gt;</span> : "14:30"</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      )}

      {activeTab === 'emitir' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '24px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Bloco 1: Aluno */}
            <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a', marginBottom: '16px' }}>1. Selecione o Aluno</div>
              <div style={{ position: 'relative', marginBottom: '12px', display: 'flex', gap: '8px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input 
                    className="form-input" 
                    style={{ width: '100%', paddingLeft: 36, height: '44px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '14px' }}
                    placeholder="Nome ou matrícula..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); setHasSearched(false); setAlunoSel(null) }}
                    onKeyDown={e => e.key === 'Enter' && search && handleBuscarAlunos()}
                  />
                </div>
                <button 
                  onClick={handleBuscarAlunos}
                  disabled={!search.trim() || isSearchingDB}
                  style={{ height: '44px', padding: '0 16px', background: search.trim() ? '#2563eb' : '#e2e8f0', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: (search.trim() && !isSearchingDB) ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {isSearchingDB ? (
                    <>
                      <div style={{ width: 16, height: 16, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      Buscando...
                    </>
                  ) : (
                    'Buscar no Banco'
                  )}
                </button>
              </div>
              {hasSearched && alunosEncontrados.length > 0 && !alunoSel && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 300, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '4px', background: '#fff' }}>
                  {alunosEncontrados.map(a => (
                    <div key={a.id} onClick={() => { setAlunoSel(a); setSearch(''); setHasSearched(false) }} style={{ padding: '10px', borderRadius: '6px', cursor: 'pointer', background: '#fff' }} onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{a.nome}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>Matrícula: {a.matricula} • Turma: {a.turma}</div>
                    </div>
                  ))}
                </div>
              )}
              {hasSearched && alunosEncontrados.length === 0 && !alunoSel && (
                <div style={{ padding: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '14px', textAlign: 'center' }}>
                  Nenhum aluno encontrado no banco para "{search}".
                </div>
              )}
              {alunoSel && (
                <div style={{ padding: '12px', background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#1e3a8a', fontSize: '14px' }}>{alunoSel.nome}</div>
                    <div style={{ fontSize: '12px', color: '#1e40af' }}>{alunoSel.turma}</div>
                  </div>
                  <button onClick={() => setAlunoSel(null)} style={{ background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer' }}><X size={16} /></button>
                </div>
              )}
            </div>

            {/* Bloco 2: Fundo Timbrado */}
            <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a', marginBottom: '16px' }}>2. Selecione o Timbrado (Fundo)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px' }}>
                {timbrados.map(t => (
                  <div 
                    key={t.name} 
                    onClick={() => setTimbradoSelUrl(t.url)}
                    style={{ 
                      height: '160px', borderRadius: '8px', border: timbradoSelUrl === t.url ? '2px solid #2563eb' : '1px solid #e2e8f0', 
                      backgroundImage: `url(${t.url})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', cursor: 'pointer',
                      position: 'relative', backgroundBlendMode: 'multiply', backgroundColor: '#f8fafc'
                    }}
                  >
                    {timbradoSelUrl === t.url && (
                      <div style={{ position: 'absolute', top: 6, right: 6, background: '#2563eb', color: '#fff', borderRadius: '50%', padding: '4px' }}>
                        <CheckCircle size={12} />
                      </div>
                    )}
                  </div>
                ))}
                {timbrados.length === 0 && (
                  <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>Nenhum timbrado cadastrado.</p>
                )}
              </div>
            </div>

            {/* Bloco 3: Modelo */}
            <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a', marginBottom: '16px' }}>3. Selecione o Modelo</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                {(modelosDB || []).map(m => (
                  <button 
                    key={m.id}
                    onClick={() => setModeloSelId(m.id)}
                    onMouseEnter={(e) => { 
                      if (modeloSelId !== m.id) {
                        e.currentTarget.style.background = '#f8fafc'; 
                        e.currentTarget.style.borderColor = '#cbd5e1';
                      }
                      e.currentTarget.style.transform = 'translateY(-2px)'; 
                      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)';
                    }}
                    onMouseLeave={(e) => { 
                      if (modeloSelId !== m.id) {
                        e.currentTarget.style.background = '#fff'; 
                        e.currentTarget.style.borderColor = '#e2e8f0';
                      }
                      e.currentTarget.style.transform = 'translateY(0)'; 
                      e.currentTarget.style.boxShadow = modeloSelId === m.id ? '0 4px 6px -1px rgba(59,130,246,0.1)' : 'none';
                    }}
                    style={{ 
                      padding: '16px', textAlign: 'left', background: modeloSelId === m.id ? '#eff6ff' : '#fff', 
                      border: modeloSelId === m.id ? '2px solid #2563eb' : '1px solid #e2e8f0', borderRadius: '12px', 
                      cursor: 'pointer', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '16px',
                      transition: 'all 0.2s', outline: 'none',
                      boxShadow: modeloSelId === m.id ? '0 4px 6px -1px rgba(59,130,246,0.1)' : 'none'
                    }}
                  >
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: modeloSelId === m.id ? '#bfdbfe' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.2s' }}>
                      <FileText size={20} color={modeloSelId === m.id ? '#1d4ed8' : '#64748b'} />
                    </div>
                    <div style={{ fontWeight: modeloSelId === m.id ? 700 : 600, fontSize: '14px', lineHeight: '1.3' }}>
                      {m.titulo}
                    </div>
                  </button>
                ))}
                {(!modelosDB || modelosDB.length === 0) && (
                  <div style={{ gridColumn: '1 / -1', padding: '24px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    <FileText size={32} color="#94a3b8" style={{ margin: '0 auto 8px auto' }} />
                    <p style={{ fontSize: '14px', color: '#64748b', margin: 0, fontWeight: 500 }}>Nenhum modelo cadastrado.</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Botão de Emissão Principal */}
            <div style={{ marginTop: '8px' }}>
              <button 
                onClick={handleAbrirRevisao}
                disabled={!alunoSel || !timbradoSelUrl || !modeloSelId}
                style={{ 
                  width: '100%', padding: '16px', 
                  background: (!alunoSel || !timbradoSelUrl || !modeloSelId) ? '#e2e8f0' : '#10b981', 
                  color: (!alunoSel || !timbradoSelUrl || !modeloSelId) ? '#94a3b8' : '#fff', 
                  border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '16px',
                  cursor: (!alunoSel || !timbradoSelUrl || !modeloSelId) ? 'not-allowed' : 'pointer', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                  boxShadow: (!alunoSel || !timbradoSelUrl || !modeloSelId) ? 'none' : '0 4px 6px -1px rgb(16 185 129 / 0.4)'
                }}
              >
                <Printer size={20} /> 
                {(!alunoSel || !timbradoSelUrl || !modeloSelId) ? 'Preencha os passos 1, 2 e 3 acima' : 'Gerar e Revisar Documento'}
              </button>
            </div>
          </div>

          {/* Pré-visualização */}
          <div>
            <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', position: 'sticky', top: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>Pré-visualização (A4)</div>
                <button 
                  onClick={handleAbrirRevisao}
                  disabled={!alunoSel || !timbradoSelUrl || !modeloSelId}
                  style={{ padding: '8px 16px', background: (!alunoSel || !timbradoSelUrl || !modeloSelId) ? '#e2e8f0' : '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: (!alunoSel || !timbradoSelUrl || !modeloSelId) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Printer size={16} /> Gerar e Revisar
                </button>
              </div>

              {/* Área de Impressão (Scale down for UI, but full size on print) */}
              <div style={{ width: '100%', background: '#e2e8f0', padding: '16px', borderRadius: '8px', display: 'flex', justifyContent: 'center', overflow: 'hidden', minHeight: '400px' }}>
                <div style={{ width: '105mm', height: '148.5mm', position: 'relative' }}>
                  <div 
                    id="print-area"
                    style={{
                      width: '210mm',
                      height: '297mm',
                      background: '#fff',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                      transform: 'scale(0.5)',
                      transformOrigin: 'top left'
                    }}
                  >
              {/* Fundo */}
                  {timbradoSelUrl && (
                    <img 
                      src={timbradoSelUrl} 
                      alt="Timbrado" 
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1 }} 
                    />
                  )}
                  
                  {/* Texto */}
                  {(() => {
                    const timbObj = timbrados.find(t => t.url === timbradoSelUrl)
                    const margins = (timbObj && timbradosMargens[timbObj.name]) || { top: 75, bottom: 30, left: 25, right: 25 }
                    return (
                      <div className="quill" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2 }}>
                        <div className="ql-container ql-snow" style={{ border: 'none' }}>
                          <div 
                            className="ql-editor"
                            style={{ 
                              position: 'absolute', 
                              top: `${margins.top}mm`, 
                              left: `${margins.left}mm`, 
                              right: `${margins.right}mm`, 
                              bottom: `${margins.bottom}mm`,
                              color: '#000',
                              textAlign: 'justify',
                              padding: 0,
                              wordBreak: 'normal',
                              wordWrap: 'break-word',
                              overflowWrap: 'break-word',
                              whiteSpace: 'pre-wrap'
                            }}
                            dangerouslySetInnerHTML={{ __html: (textoFinalImp || getConteudoInterpolado()).replace(/&nbsp;/g, ' ').replace(/<(p|h[1-6])([^>]*)>\s*<\/\1>/g, '<$1$2><br></$1>') }}
                          />
                        </div>
                      </div>
                    )
                  })()}
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* Modal de Revisão */}
      {showPreviewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Revisão do Documento</h2>
              <button onClick={() => setShowPreviewModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={20} color="#64748b" /></button>
            </div>
            
            <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
              <p style={{ margin: '0 0 16px 0', color: '#64748b', fontSize: '14px', lineHeight: '1.5' }}>
                O texto abaixo já foi preenchido automaticamente com os dados do aluno. Fique à vontade para digitar, apagar ou adicionar qualquer informação extra antes da impressão final.
              </p>
              <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
                <ReactQuill 
                  theme="snow"
                  modules={quillModules}
                  value={textoFinalImp}
                  onChange={(val, delta, source) => {
                    if (source === 'user') {
                      setTextoFinalImp(val)
                    }
                  }}
                />
              </div>
            </div>

            <div style={{ padding: '20px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#f8fafc' }}>
              <button onClick={() => setShowPreviewModal(false)} style={{ padding: '12px 24px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 600, color: '#64748b', cursor: 'pointer' }}>
                Voltar
              </button>
              <button onClick={() => { setShowPreviewModal(false); imprimir() }} style={{ padding: '12px 24px', background: '#10b981', border: 'none', borderRadius: '8px', fontWeight: 600, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={18} /> Confirmar e Imprimir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE AJUSTE DE MARGENS */}
      {margemModalOpen && timbradoParaMargem && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', width: '900px', maxWidth: '95%', display: 'flex', gap: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            
            {/* Visual Preview Area */}
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f8fafc', borderRadius: '12px', padding: '16px' }}>
              <div style={{ 
                width: '315px', height: '445.5px', /* Proporção exata de A4 (210x297 * 1.5) */
                background: '#fff', position: 'relative', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                backgroundImage: `url(${timbradoParaMargem.url})`, backgroundSize: '100% 100%' 
              }}>
                {/* Overlay Box showing text area */}
                <div style={{
                  position: 'absolute',
                  top: `${(margensTemp.top / 297) * 100}%`,
                  bottom: `${(margensTemp.bottom / 297) * 100}%`,
                  left: `${(margensTemp.left / 210) * 100}%`,
                  right: `${(margensTemp.right / 210) * 100}%`,
                  border: '2px dashed #3b82f6',
                  background: 'rgba(59, 130, 246, 0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <span style={{ color: '#1d4ed8', fontWeight: 600, fontSize: '12px', textAlign: 'center', padding: '8px' }}>Área do Texto</span>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div style={{ width: '300px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Ajustar Margens</h3>
                <button onClick={() => setMargemModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
              </div>
              <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px', lineHeight: '1.5' }}>
                Ajuste os valores em milímetros (mm) para definir onde o texto deve ser impresso em cima deste fundo.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Margem Superior (Topo)</label>
                  <input type="number" value={margensTemp.top} onChange={e => setMargensTemp({...margensTemp, top: Number(e.target.value)})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Esquerda</label>
                    <input type="number" value={margensTemp.left} onChange={e => setMargensTemp({...margensTemp, left: Number(e.target.value)})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Direita</label>
                    <input type="number" value={margensTemp.right} onChange={e => setMargensTemp({...margensTemp, right: Number(e.target.value)})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Margem Inferior (Fundo)</label>
                  <input type="number" value={margensTemp.bottom} onChange={e => setMargensTemp({...margensTemp, bottom: Number(e.target.value)})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                </div>
              </div>

              <div style={{ marginTop: 'auto' }}>
                <button 
                  onClick={() => {
                    const newMap = { ...timbradosMargens, [timbradoParaMargem.name]: margensTemp }
                    setTimbradosMargens(newMap)
                    localStorage.setItem('@EduImpacto:TimbradosMargens', JSON.stringify(newMap))
                    setMargemModalOpen(false)
                  }}
                  style={{ width: '100%', padding: '12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Salvar Margens
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
