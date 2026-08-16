'use client'

import { useData } from '@/lib/dataContext'
import { useState, useEffect, useRef } from 'react'
import { 
  FileText, Search, Plus, Trash2, Printer, Sparkles, Upload, 
  FileSignature, Save, X, Eye, CheckCircle, Wand2, Settings, 
  Copy, Sliders, Check, RotateCcw, AlertCircle
} from 'lucide-react'
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
    [{ 'lineheight': ['1.0', '1.2', false, '2.0', '2.5', '3.0'] }],
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

interface TimbradoMargens {
  top: number
  bottom: number
  left: number
  right: number
}

const DEFAULT_MARGINS: TimbradoMargens = {
  top: 75,
  bottom: 30,
  left: 25,
  right: 25
}

function normalizeMargins(m?: Partial<TimbradoMargens> | null): TimbradoMargens {
  return {
    top: typeof m?.top === 'number' && !isNaN(m.top) && m.top >= 0 ? m.top : DEFAULT_MARGINS.top,
    bottom: typeof m?.bottom === 'number' && !isNaN(m.bottom) && m.bottom >= 0 ? m.bottom : DEFAULT_MARGINS.bottom,
    left: typeof m?.left === 'number' && !isNaN(m.left) && m.left >= 0 ? m.left : DEFAULT_MARGINS.left,
    right: typeof m?.right === 'number' && !isNaN(m.right) && m.right >= 0 ? m.right : DEFAULT_MARGINS.right,
  }
}

export default function SecretariaDocumentosPage() {
  const { logSystemAction } = useData()

  // Tabs: 'emitir' | 'modelos' | 'timbrados'
  const [activeTab, setActiveTab] = useState<'emitir' | 'modelos' | 'timbrados'>('emitir')

  // Timbrados
  const [timbrados, setTimbrados] = useState<{name: string, url: string}[]>([])
  const [loadingTimbrados, setLoadingTimbrados] = useState(true)
  
  // Margens dos Timbrados
  const [timbradosMargens, setTimbradosMargens] = useState<Record<string, TimbradoMargens>>({})
  const [margemModalOpen, setMargemModalOpen] = useState(false)
  const [timbradoParaMargem, setTimbradoParaMargem] = useState<{name: string, url: string} | null>(null)
  const [margensTemp, setMargensTemp] = useState<TimbradoMargens>(DEFAULT_MARGINS)
  const [copiedVar, setCopiedVar] = useState<string | null>(null)
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null)
  
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
  const [isPrinting, setIsPrinting] = useState(false)

  // Limpar texto final modificado sempre que as seleções mudarem
  useEffect(() => {
    setTextoFinalImp('')
  }, [alunoSel, modeloSelId])

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

    // Carregar margens do localStorage como cache inicial
    try {
      const stored = localStorage.getItem('@EduImpacto:TimbradosMargens')
      if (stored) {
        const parsed = JSON.parse(stored)
        setTimbradosMargens(parsed)
      }
    } catch (e) {
      console.error('Erro ao ler margens do cache local:', e)
    }

    fetchTimbrados()
    fetchModelos()
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
      
      const list = data.list || []
      setTimbrados(list)

      // Sincroniza margens da nuvem
      if (data.margins && typeof data.margins === 'object') {
        setTimbradosMargens(prev => {
          const merged = { ...prev, ...data.margins }
          try {
            localStorage.setItem('@EduImpacto:TimbradosMargens', JSON.stringify(merged))
          } catch (e) {}
          return merged
        })
      }

      // Se nenhum selecionado e temos timbrados, seleciona o primeiro por padrão
      if (list.length > 0 && !timbradoSelUrl) {
        setTimbradoSelUrl(list[0].url)
      }
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

  const getTimbradoMargensAtual = (nameOrUrl: string): TimbradoMargens => {
    const obj = timbrados.find(t => t.url === nameOrUrl || t.name === nameOrUrl)
    const key = obj ? obj.name : nameOrUrl
    return normalizeMargins(timbradosMargens[key] || timbradosMargens[nameOrUrl])
  }

  const salvarMargens = async () => {
    if (!timbradoParaMargem) return

    const normalized = normalizeMargins(margensTemp)
    const newMap = {
      ...timbradosMargens,
      [timbradoParaMargem.name]: normalized,
      [timbradoParaMargem.url]: normalized
    }

    setTimbradosMargens(newMap)
    
    // 1. Salva localmente
    try {
      localStorage.setItem('@EduImpacto:TimbradosMargens', JSON.stringify(newMap))
    } catch (e) {}

    // 2. Salva na nuvem (Supabase storage)
    try {
      const fd = new FormData()
      fd.append('action', 'save_margins')
      fd.append('margins', JSON.stringify(newMap))
      await fetch('/api/documentos-midia', {
        method: 'POST',
        body: fd
      })
    } catch (e) {
      console.error('Erro ao sincronizar margens na nuvem:', e)
    }

    setSaveSuccessMsg('Margens salvas com sucesso!')
    setTimeout(() => {
      setSaveSuccessMsg(null)
      setMargemModalOpen(false)
    }, 800)
  }

  const variaveisDisponiveis = `
<<aluno>> : Nome do aluno
<<matricula>> : Matrícula ou código do aluno
<<cpf>> : CPF do aluno
<<rg>> : RG do aluno
<<turma>> : Nome da turma atual
<<serie>> : Série ou ano
<<turno>> : Turno de estudo (Matutino/Vespertino/Integral)
<<status>> : Situação do aluno (Matriculado/Ativo)
<<unidade>> : Unidade escolar (Ex: Colégio Impacto)
<<data_nascimento>> : Data de nascimento (Ex: 15/05/2010)
<<nacionalidade>> : Nacionalidade (Ex: Brasileira)
<<naturalidade>> : Naturalidade
<<endereco>> : Endereço completo do aluno
<<bairro>> : Bairro
<<cidade>> : Cidade
<<estado>> : UF / Estado
<<cep>> : CEP
<<email_aluno>> : Email do aluno
<<telefone_aluno>> : Telefone do aluno
<<responsavel_nome>> : Nome do responsável principal
<<responsavel_financeiro>> : Nome do responsável financeiro
<<responsavel_pedagogico>> : Nome do responsável pedagógico
<<cpf_responsavel>> : CPF do responsável
<<pai>> : Nome do Pai
<<mae>> : Nome da Mãe
<<ano_letivo>> : Ano letivo (Ex: 2026)
<<data_atual_str>> : Data por extenso (Ex: "08 de julho de 2026")
<<data_atual_num>> : Data numérica (Ex: "08/07/2026")
<<hora_atual>> : Hora atual (Ex: "14:30")
<<cidade_data>> : Cidade e data (Ex: "Campo Grande - MS, 08 de julho de 2026")
`

  // --- GERADOR DE IA ---
  const handleGerarComIA = async () => {
    if (!promptIA.trim()) return
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
    
    let conteudoReal = (modeloAtual.id === modeloSelId && modeloAtual.conteudo) ? modeloAtual.conteudo : (modDb?.conteudo || '')
    
    if (!conteudoReal.includes('<p>') && !conteudoReal.includes('<br>')) {
      conteudoReal = conteudoReal.replace(/<</g, '&lt;&lt;').replace(/>>/g, '&gt;&gt;').split('\n').map((l: string) => l.trim() ? `<p>${l}</p>` : '<p><br></p>').join('')
    }
    
    let texto = conteudoReal.replace(/&nbsp;/g, ' ')
    const dataAtualExtenso = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    const dataAtualNum = new Date().toLocaleDateString('pt-BR')
    const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    const replaceVar = (text: string, varName: string, value: string) => {
      const regex = new RegExp(`(?:<<|&lt;&lt;)${varName}(?:>>|&gt;&gt;)`, 'gi')
      return text.replace(regex, value || '')
    }

    if (alunoSel) {
      const d = alunoSel.dados || {}
      texto = replaceVar(texto, 'aluno', alunoSel.nome || '')
      texto = replaceVar(texto, 'nome_aluno', alunoSel.nome || '')
      texto = replaceVar(texto, 'matricula', alunoSel.matricula || alunoSel.codigo || alunoSel.id || '')
      texto = replaceVar(texto, 'codigo_aluno', alunoSel.codigo || alunoSel.matricula || alunoSel.id || '')
      texto = replaceVar(texto, 'cpf', alunoSel.cpf || d.cpf || '')
      texto = replaceVar(texto, 'cpf_aluno', alunoSel.cpf || d.cpf || '')
      texto = replaceVar(texto, 'rg', alunoSel.rg || d.rg || '')
      texto = replaceVar(texto, 'rg_aluno', alunoSel.rg || d.rg || '')
      texto = replaceVar(texto, 'turma', alunoSel.turma_nome || alunoSel.turma || '')
      texto = replaceVar(texto, 'serie', alunoSel.serie_nome || alunoSel.serie || alunoSel.turma_segmento || '')
      texto = replaceVar(texto, 'turno', alunoSel.turno_nome || alunoSel.turno || '')
      texto = replaceVar(texto, 'status', alunoSel.status || 'Ativo')
      texto = replaceVar(texto, 'unidade', alunoSel.unidade || 'Colégio Impacto')
      texto = replaceVar(texto, 'email_aluno', alunoSel.email || d.email || '')
      texto = replaceVar(texto, 'telefone_aluno', alunoSel.telefone || alunoSel.celular || d.telefone || '')
      texto = replaceVar(texto, 'data_nascimento', alunoSel.data_nascimento || alunoSel.dataNascimento ? new Date(alunoSel.data_nascimento || alunoSel.dataNascimento).toLocaleDateString('pt-BR') : '')
      texto = replaceVar(texto, 'nacionalidade', alunoSel.nacionalidade || d.nacionalidade || 'Brasileira')
      texto = replaceVar(texto, 'naturalidade', alunoSel.naturalidade || d.naturalidade || '')
      texto = replaceVar(texto, 'endereco', alunoSel.endereco || d.endereco || d.logradouro || '')
      texto = replaceVar(texto, 'bairro', alunoSel.bairro || d.bairro || '')
      texto = replaceVar(texto, 'cidade', alunoSel.cidade || d.cidade || '')
      texto = replaceVar(texto, 'estado', alunoSel.estado || d.estado || d.uf || '')
      texto = replaceVar(texto, 'cep', alunoSel.cep || d.cep || '')
      
      const respNome = alunoSel.responsavel || alunoSel.responsavel_nome || (alunoSel.responsaveis?.[0]?.nome) || ''
      const respFin = alunoSel.responsavel_financeiro || alunoSel.responsavelFinanceiro || alunoSel.responsaveis?.find((r: any) => r.isFinanceiro)?.nome || respNome
      const respPed = alunoSel.responsavel_pedagogico || alunoSel.responsavelPedagogico || alunoSel.responsaveis?.find((r: any) => r.isPedagogico)?.nome || respNome
      const respCpf = alunoSel.cpf_responsavel || alunoSel.cpfResponsavel || d.cpfResponsavel || alunoSel.responsaveis?.find((r: any) => r.isFinanceiro || r.cpf)?.cpf || ''

      texto = replaceVar(texto, 'responsavel_nome', respNome)
      texto = replaceVar(texto, 'responsavel', respNome)
      texto = replaceVar(texto, 'responsavel_financeiro', respFin)
      texto = replaceVar(texto, 'responsavel_pedagogico', respPed)
      texto = replaceVar(texto, 'cpf_responsavel', respCpf)
      
      const paiNome = alunoSel.nome_pai || alunoSel.pai || alunoSel.nomePai || d.nome_pai || d.pai || d.nomePai || alunoSel.responsaveis?.find((r: any) => r.parentesco?.toLowerCase() === 'pai')?.nome || ''
      const maeNome = alunoSel.nome_mae || alunoSel.mae || alunoSel.nomeMae || d.nome_mae || d.mae || d.nomeMae || alunoSel.responsaveis?.find((r: any) => r.parentesco?.toLowerCase() === 'mãe' || r.parentesco?.toLowerCase() === 'mae')?.nome || ''
      
      texto = replaceVar(texto, 'pai', paiNome)
      texto = replaceVar(texto, 'mae', maeNome)
      texto = replaceVar(texto, 'ano', alunoSel.turma_anoLetivo || alunoSel.ano_letivo || alunoSel.anoLetivo || new Date().getFullYear().toString())
      texto = replaceVar(texto, 'ano_letivo', alunoSel.turma_anoLetivo || alunoSel.ano_letivo || alunoSel.anoLetivo || new Date().getFullYear().toString())
    }
    
    texto = replaceVar(texto, 'data_atual_str', dataAtualExtenso)
    texto = replaceVar(texto, 'data_atual_num', dataAtualNum)
    texto = replaceVar(texto, 'hora_atual', horaAtual)
    texto = replaceVar(texto, 'cidade_data', `Campo Grande - MS, ${dataAtualExtenso}`)
    
    return texto
  }

  const handleAbrirRevisao = () => {
    setTextoFinalImp(cleanDocumentHtml(getConteudoInterpolado()))
    setShowPreviewModal(true)
  }

  const cleanDocumentHtml = (rawHtml: string): string => {
    if (!rawHtml) return ''
    return rawHtml
      .replace(/background-color\s*:\s*[^;"]+[;]?/gi, '')
      .replace(/background\s*:\s*[^;"]+[;]?/gi, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/<(p|h[1-6])([^>]*)>\s*<\/\1>/g, '<$1$2><br></$1>')
  }

  // ── MOTOR DE IMPRESSÃO ULTRA-ROBUSTO COM TIMBRADO E MARGENS REAIS ──────────
  const imprimirDocumento = async () => {
    if (!alunoSel || !timbradoSelUrl || !modeloSelId) {
      return alert('Selecione o Aluno, o Modelo e o Timbrado para imprimir.')
    }

    setIsPrinting(true)
    const docTitulo = (modelosDB || []).find(m => m.id === modeloSelId)?.titulo || 'Documento Escolar'
    const textoHTML = cleanDocumentHtml(textoFinalImp || getConteudoInterpolado())
    const margens = getTimbradoMargensAtual(timbradoSelUrl)

    // Registra emissão no backend de forma não bloqueante
    fetch('/api/documentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aluno_id: alunoSel.id,
        documento_tipo: docTitulo,
        emitido_por: 'Secretaria'
      })
    }).catch(console.error)

    try {
      // 1. Pré-carrega a imagem do timbrado na memória do browser para garantir renderização instantânea
      if (timbradoSelUrl) {
        await new Promise<void>((resolve) => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => resolve()
          img.onerror = () => resolve() // Continua mesmo se houver falha de rede
          img.src = timbradoSelUrl
          if (img.complete) resolve()
        })
      }

      // 2. Cria ou recupera iframe isolado para impressão (não sofre impacto de zoom, sidebar, overflow ou layout)
      let iframe = document.getElementById('edu-documentos-print-frame') as HTMLIFrameElement
      if (!iframe) {
        iframe = document.createElement('iframe')
        iframe.id = 'edu-documentos-print-frame'
        iframe.style.position = 'fixed'
        iframe.style.right = '0'
        iframe.style.bottom = '0'
        iframe.style.width = '0'
        iframe.style.height = '0'
        iframe.style.border = 'none'
        iframe.style.zIndex = '-9999'
        document.body.appendChild(iframe)
      }

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
      if (!iframeDoc) throw new Error('Não foi possível inicializar motor de impressão.')

      const printHtml = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <title>${docTitulo} - ${alunoSel.nome || ''}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 0mm !important;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              width: 210mm;
              height: 297mm;
              background: #ffffff !important;
              font-family: 'Times New Roman', Times, 'Liberation Serif', serif, Arial;
              font-size: 14px;
              color: #000000 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .a4-page {
              position: relative;
              width: 210mm;
              height: 297mm;
              max-height: 297mm;
              overflow: hidden;
              background: #ffffff;
              page-break-after: always;
              page-break-inside: avoid;
            }
            .timbrado-background {
              position: absolute;
              top: 0;
              left: 0;
              width: 210mm;
              height: 297mm;
              object-fit: fill;
              z-index: 1;
              display: block !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .texto-documento {
              position: absolute;
              top: ${margens.top}mm;
              bottom: ${margens.bottom}mm;
              left: ${margens.left}mm;
              right: ${margens.right}mm;
              z-index: 2;
              background: transparent !important;
              background-color: transparent !important;
              color: #000000 !important;
              text-align: justify;
              line-height: 1.6;
              overflow: hidden;
              word-break: normal;
              word-wrap: break-word;
              overflow-wrap: break-word;
            }
            .texto-documento *,
            .texto-documento p,
            .texto-documento span,
            .texto-documento div,
            .texto-documento h1,
            .texto-documento h2,
            .texto-documento h3,
            .texto-documento h4,
            .texto-documento strong,
            .texto-documento em {
              background: transparent !important;
              background-color: transparent !important;
            }
            .texto-documento p {
              margin: 0 0 1em 0;
              line-height: 1.6;
              color: #000000 !important;
            }
            .texto-documento p:last-child {
              margin-bottom: 0;
            }
            .texto-documento h1, 
            .texto-documento h2, 
            .texto-documento h3, 
            .texto-documento h4 {
              margin-top: 0;
              margin-bottom: 0.5em;
              font-weight: bold;
              color: #000000 !important;
            }
            .texto-documento .ql-align-center { text-align: center !important; }
            .texto-documento .ql-align-right { text-align: right !important; }
            .texto-documento .ql-align-justify { text-align: justify !important; }
            .texto-documento .ql-size-8px { font-size: 8px !important; }
            .texto-documento .ql-size-10px { font-size: 10px !important; }
            .texto-documento .ql-size-12px { font-size: 12px !important; }
            .texto-documento .ql-size-16px { font-size: 16px !important; }
            .texto-documento .ql-size-18px { font-size: 18px !important; }
            .texto-documento .ql-size-20px { font-size: 20px !important; }
            .texto-documento .ql-size-24px { font-size: 24px !important; }
            .texto-documento .ql-size-32px { font-size: 32px !important; }
            .texto-documento .ql-lineheight-1\\.0 { line-height: 1.0 !important; }
            .texto-documento .ql-lineheight-1\\.2 { line-height: 1.2 !important; }
            .texto-documento .ql-lineheight-1\\.5 { line-height: 1.5 !important; }
            .texto-documento .ql-lineheight-2\\.0 { line-height: 2.0 !important; }
            .texto-documento .ql-lineheight-2\\.5 { line-height: 2.5 !important; }
            .texto-documento .ql-lineheight-3\\.0 { line-height: 3.0 !important; }
          </style>
        </head>
        <body>
          <div class="a4-page">
            ${timbradoSelUrl ? `<img src="${timbradoSelUrl}" class="timbrado-background" alt="Fundo Timbrado" />` : ''}
            <div class="texto-documento">
              ${textoHTML}
            </div>
          </div>
        </body>
        </html>
      `

      iframeDoc.open()
      iframeDoc.write(printHtml)
      iframeDoc.close()

      // Aguarda renderização completa do iframe e abre diálogo nativo
      setTimeout(() => {
        setIsPrinting(false)
        if (iframe.contentWindow) {
          iframe.contentWindow.focus()
          iframe.contentWindow.print()
        }
      }, 350)
    } catch (e: any) {
      console.error('Erro na impressão:', e)
      setIsPrinting(false)
      // Fallback para window.print caso o iframe seja bloqueado
      window.print()
    }
  }

  const copiarVariavel = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedVar(code)
    setTimeout(() => setCopiedVar(null), 1500)
  }

  const margensDoTimbradoSelecionado = getTimbradoMargensAtual(timbradoSelUrl)

  return (
    <div style={{ padding: '32px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Estilos globais e tipografia Quill */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }

        input, input[type="number"], input[type="text"], select, textarea, .form-input {
          color: #0f172a !important;
          background-color: #ffffff !important;
        }
        input::placeholder, textarea::placeholder {
          color: #94a3b8 !important;
        }
        
        .ql-container .ql-editor {
          min-height: 250px;
          font-family: inherit;
          font-size: 14px;
          word-break: break-word;
          overflow-wrap: anywhere;
          color: #000000 !important;
          background: #ffffff !important;
        }

        .documento-texto-overlay,
        .documento-texto-overlay *,
        .documento-texto-overlay p,
        .documento-texto-overlay span,
        .documento-texto-overlay div,
        .documento-texto-overlay h1,
        .documento-texto-overlay h2,
        .documento-texto-overlay h3,
        .documento-texto-overlay h4,
        .documento-texto-overlay h5,
        .documento-texto-overlay h6,
        .documento-texto-overlay strong,
        .documento-texto-overlay em,
        .documento-texto-overlay u,
        .documento-texto-overlay s,
        .documento-texto-overlay li {
          background: transparent !important;
          background-color: transparent !important;
        }

        .documento-texto-overlay p {
          margin: 0 0 0.85em 0;
          line-height: 1.6;
          color: #000000 !important;
        }
        
        .documento-texto-overlay p:last-child {
          margin-bottom: 0;
        }

        .documento-texto-overlay h1, 
        .documento-texto-overlay h2, 
        .documento-texto-overlay h3, 
        .documento-texto-overlay h4 {
          margin-top: 0;
          margin-bottom: 0.6em;
          font-weight: bold;
          color: #000000 !important;
        }

        .documento-texto-overlay .ql-align-center { text-align: center !important; }
        .documento-texto-overlay .ql-align-right { text-align: right !important; }
        .documento-texto-overlay .ql-align-justify { text-align: justify !important; }
        
        .documento-texto-overlay .ql-size-8px { font-size: 8px !important; }
        .documento-texto-overlay .ql-size-10px { font-size: 10px !important; }
        .documento-texto-overlay .ql-size-12px { font-size: 12px !important; }
        .documento-texto-overlay .ql-size-16px { font-size: 16px !important; }
        .documento-texto-overlay .ql-size-18px { font-size: 18px !important; }
        .documento-texto-overlay .ql-size-20px { font-size: 20px !important; }
        .documento-texto-overlay .ql-size-24px { font-size: 24px !important; }
        .documento-texto-overlay .ql-size-32px { font-size: 32px !important; }

        .documento-texto-overlay .ql-lineheight-1\\.0 { line-height: 1.0 !important; }
        .documento-texto-overlay .ql-lineheight-1\\.2 { line-height: 1.2 !important; }
        .documento-texto-overlay .ql-lineheight-1\\.5 { line-height: 1.5 !important; }
        .documento-texto-overlay .ql-lineheight-2\\.0 { line-height: 2.0 !important; }
        .documento-texto-overlay .ql-lineheight-2\\.5 { line-height: 2.5 !important; }
        .documento-texto-overlay .ql-lineheight-3\\.0 { line-height: 3.0 !important; }

        .ql-editor.ql-blank::before {
          color: #94a3b8 !important;
          font-style: italic;
        }
        
        .ql-toolbar.ql-snow {
          border: none !important;
          border-bottom: 1px solid #e2e8f0 !important;
          background: #f8fafc;
          color: #0f172a !important;
        }

        .ql-snow .ql-stroke {
          stroke: #475569 !important;
        }

        .ql-snow .ql-fill {
          fill: #475569 !important;
        }

        .ql-snow .ql-picker {
          color: #334155 !important;
        }

        .ql-snow .ql-picker-options {
          background-color: #ffffff !important;
          color: #0f172a !important;
        }
        
        .ql-container.ql-snow {
          border: none !important;
          background: #ffffff !important;
          color: #000000 !important;
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
        .ql-snow .ql-picker.ql-lineheight .ql-picker-item::before { content: 'Espaço 1.5'; }
        
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
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <FileText size={20} style={{ color: '#2563eb' }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '1px' }}>Secretaria</span>
          </div>
          <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 32, color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>Gerador de Documentos</h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: '4px 0 0 0' }}>Crie documentos usando Inteligência Artificial e Papel Timbrado.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', background: '#fff', padding: '6px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <button 
            onClick={() => setActiveTab('emitir')} 
            style={{ padding: '8px 18px', background: activeTab === 'emitir' ? '#2563eb' : 'transparent', color: activeTab === 'emitir' ? '#fff' : '#64748b', border: 'none', borderRadius: '8px', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
          >
            Emitir Documento
          </button>
          <button 
            onClick={() => setActiveTab('modelos')} 
            style={{ padding: '8px 18px', background: activeTab === 'modelos' ? '#2563eb' : 'transparent', color: activeTab === 'modelos' ? '#fff' : '#64748b', border: 'none', borderRadius: '8px', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
          >
            Gerenciar Modelos (IA)
          </button>
          <button 
            onClick={() => setActiveTab('timbrados')} 
            style={{ padding: '8px 18px', background: activeTab === 'timbrados' ? '#2563eb' : 'transparent', color: activeTab === 'timbrados' ? '#fff' : '#64748b', border: 'none', borderRadius: '8px', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
          >
            Papéis Timbrados
          </button>
        </div>
      </div>

      {/* ── TAB: GESTÃO DE TIMBRADOS ────────────────────────────────────────── */}
      {activeTab === 'timbrados' && (
        <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Gestão de Timbrados (Backgrounds)</h2>
              <p style={{ fontSize: '13.5px', color: '#64748b', margin: '4px 0 0 0' }}>Configure a imagem de fundo A4 e ajuste as margens de impressão para cada modelo.</p>
            </div>
            <label style={{ cursor: 'pointer', padding: '10px 18px', background: '#0f172a', color: '#fff', borderRadius: '10px', fontSize: '13.5px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(15,23,42,0.15)', transition: 'all 0.2s' }}>
              <Upload size={16} /> Enviar Novo Fundo
              <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleUploadTimbrado} />
            </label>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
            {loadingTimbrados ? (
              <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: '#64748b' }}>
                <div style={{ width: 24, height: 24, border: '3px solid #2563eb', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px auto' }} />
                Carregando papéis timbrados...
              </div>
            ) : timbrados.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', padding: '48px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <Upload size={36} color="#94a3b8" style={{ margin: '0 auto 12px auto' }} />
                <p style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a', margin: '0 0 4px 0' }}>Nenhum timbrado cadastrado</p>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Envie a imagem do cabeçalho/rodapé da sua escola em formato A4.</p>
              </div>
            ) : timbrados.map(t => {
              const currentM = getTimbradoMargensAtual(t.name)
              return (
                <div key={t.name} style={{ border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.04)', transition: 'transform 0.2s, box-shadow 0.2s' }}>
                  <div style={{ height: '280px', background: '#f8fafc', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundImage: `url(${t.url})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', borderBottom: '1px solid #f1f5f9', position: 'relative' }}>
                    {/* Badge das margens */}
                    <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(8px)', color: '#fff', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}>
                      Topo: {currentM.top}mm • Fundo: {currentM.bottom}mm
                    </div>
                  </div>
                  <div style={{ padding: '12px 14px', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={t.name}>
                      {t.name.substring(14) || t.name}
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button 
                        onClick={() => {
                          setTimbradoParaMargem(t)
                          setMargensTemp(getTimbradoMargensAtual(t.name))
                          setMargemModalOpen(true)
                        }} 
                        style={{ padding: '6px 10px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }} 
                        title="Ajustar Margens"
                      >
                        <Sliders size={14} /> Margens
                      </button>
                      <button 
                        onClick={() => handleDeleteTimbrado(t.name)} 
                        style={{ padding: '6px 8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', borderRadius: '8px', cursor: 'pointer' }} 
                        title="Excluir Fundo"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── TAB: GERENCIADOR DE MODELOS COM IA ───────────────────────────────── */}
      {activeTab === 'modelos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Seção de Modelos Salvos */}
          <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={20} color="#2563eb" /> Modelos de Documentos Cadastrados
                </h2>
                <p style={{ fontSize: '13.5px', color: '#64748b', margin: '4px 0 0 0' }}>Selecione um modelo abaixo para editar ou crie um novo usando a IA.</p>
              </div>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
            <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px 0', color: '#0f172a' }}>
                {modeloAtual.id ? `Editar Modelo: ${modeloAtual.titulo}` : 'Criar Novo Modelo de Documento'}
              </h2>
              
              <input 
                className="form-input"
                style={{ width: '100%', marginBottom: '16px', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '15px', fontWeight: 600, color: '#0f172a', background: '#ffffff' }}
                placeholder="Título do Documento (Ex: Declaração de Matrícula)"
                value={modeloAtual.titulo}
                onChange={e => setModeloAtual({...modeloAtual, titulo: e.target.value})}
              />

              {/* Bloco de IA */}
              <div style={{ background: '#f5f3ff', padding: '18px', borderRadius: '12px', border: '1px solid #ddd6fe', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Sparkles size={18} style={{ color: '#7c3aed' }} />
                  <span style={{ fontWeight: 700, color: '#5b21b6', fontSize: '14px' }}>Redigir com Inteligência Artificial Gemini</span>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <input 
                    className="form-input"
                    style={{ flex: 1, minWidth: '240px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #c4b5fd', fontSize: '14px', background: '#ffffff', color: '#0f172a', fontWeight: 500 }}
                    placeholder="Ex: Gere uma declaração de transferência com aproveitamento de estudos..."
                    value={promptIA}
                    onChange={e => setPromptIA(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleGerarComIA()}
                  />
                  <button 
                    onClick={handleGerarComIA}
                    disabled={isGeneratingAI || !promptIA.trim()}
                    style={{ padding: '10px 18px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13.5px', cursor: (isGeneratingAI || !promptIA.trim()) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: !promptIA.trim() ? 0.7 : 1 }}
                  >
                    {isGeneratingAI ? (
                      <>
                        <div style={{ width: 16, height: 16, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <Wand2 size={16} /> Gerar Texto
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Editor Quill */}
              <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
                <ReactQuill 
                  theme="snow"
                  modules={quillModules}
                  value={modeloAtual.conteudo}
                  onChange={(val, delta, source) => {
                    if (source === 'user') {
                      setModeloAtual(prev => ({...prev, conteudo: val}))
                    }
                  }}
                  placeholder="Escreva aqui o conteúdo do documento. Clique nas variáveis da coluna à direita para copiar e colar..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '18px', gap: '12px', flexWrap: 'wrap' }}>
                <button onClick={() => setModeloAtual({titulo: '', conteudo: ''})} style={{ padding: '10px 18px', background: 'transparent', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer' }}>
                  Limpar
                </button>
                {modeloAtual.id && (
                  <button onClick={handleSaveAsNew} style={{ padding: '10px 18px', background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Copy size={16} /> Salvar como Novo
                  </button>
                )}
                <button onClick={handleSaveModelo} style={{ padding: '10px 22px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}>
                  <Save size={16} /> {modeloAtual.id ? 'Salvar Alterações' : 'Salvar Modelo'}
                </button>
              </div>
            </div>

            {/* Sidebar de Variáveis */}
            <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileSignature size={18} color="#2563eb" /> Variáveis Inteligentes
              </div>
              <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: '1.5' }}>
                Clique em qualquer variável para copiar para a área de transferência:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', overflowY: 'auto', maxHeight: '600px', paddingRight: '4px' }}>
                
                {/* Grupo Aluno */}
                <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 700, color: '#1e3a8a', marginBottom: '8px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dados do Aluno</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {['<<aluno>>', '<<matricula>>', '<<cpf>>', '<<rg>>', '<<turma>>', '<<serie>>', '<<turno>>', '<<status>>', '<<data_nascimento>>', '<<telefone_aluno>>', '<<email_aluno>>', '<<unidade>>', '<<ano_letivo>>'].map(v => (
                      <button 
                        key={v}
                        onClick={() => copiarVariavel(v)}
                        style={{ padding: '4px 8px', background: copiedVar === v ? '#10b981' : '#eff6ff', color: copiedVar === v ? '#fff' : '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '11.5px', fontFamily: 'monospace', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.15s' }}
                      >
                        {copiedVar === v ? <Check size={12} /> : <Copy size={11} />}
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grupo Responsáveis */}
                <div style={{ padding: '12px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #dcfce7' }}>
                  <div style={{ fontWeight: 700, color: '#14532d', marginBottom: '8px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Família e Responsáveis</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {['<<responsavel_nome>>', '<<responsavel_financeiro>>', '<<responsavel_pedagogico>>', '<<cpf_responsavel>>', '<<pai>>', '<<mae>>'].map(v => (
                      <button 
                        key={v}
                        onClick={() => copiarVariavel(v)}
                        style={{ padding: '4px 8px', background: copiedVar === v ? '#10b981' : '#f0fdf4', color: copiedVar === v ? '#fff' : '#15803d', border: '1px solid #bbf7d0', borderRadius: '6px', fontSize: '11.5px', fontFamily: 'monospace', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.15s' }}
                      >
                        {copiedVar === v ? <Check size={12} /> : <Copy size={11} />}
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grupo Sistema / Data */}
                <div style={{ padding: '12px', background: '#faf5ff', borderRadius: '10px', border: '1px solid #f3e8ff' }}>
                  <div style={{ fontWeight: 700, color: '#581c87', marginBottom: '8px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Datas e Local</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {['<<data_atual_str>>', '<<data_atual_num>>', '<<hora_atual>>', '<<cidade_data>>'].map(v => (
                      <button 
                        key={v}
                        onClick={() => copiarVariavel(v)}
                        style={{ padding: '4px 8px', background: copiedVar === v ? '#10b981' : '#faf5ff', color: copiedVar === v ? '#fff' : '#7e22ce', border: '1px solid #e9d5ff', borderRadius: '6px', fontSize: '11.5px', fontFamily: 'monospace', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.15s' }}
                      >
                        {copiedVar === v ? <Check size={12} /> : <Copy size={11} />}
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: EMISSÃO DE DOCUMENTOS ──────────────────────────────────────── */}
      {activeTab === 'emitir' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.1fr)', gap: '28px' }}>
          
          {/* Coluna da Esquerda: Passos de Seleção */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Bloco 1: Selecionar Aluno */}
            <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>1</span>
                  Selecione o Aluno
                </div>
              </div>

              <div style={{ position: 'relative', marginBottom: '12px', display: 'flex', gap: '8px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input 
                    className="form-input" 
                    style={{ width: '100%', paddingLeft: 36, height: '44px', borderRadius: '10px', background: '#ffffff', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', fontWeight: 500 }}
                    placeholder="Buscar por nome ou matrícula..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); setHasSearched(false); setAlunoSel(null) }}
                    onKeyDown={e => e.key === 'Enter' && search && handleBuscarAlunos()}
                  />
                </div>
                <button 
                  onClick={handleBuscarAlunos}
                  disabled={!search.trim() || isSearchingDB}
                  style={{ height: '44px', padding: '0 18px', background: search.trim() ? '#2563eb' : '#e2e8f0', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: (search.trim() && !isSearchingDB) ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px' }}
                >
                  {isSearchingDB ? (
                    <>
                      <div style={{ width: 16, height: 16, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      Buscando...
                    </>
                  ) : (
                    'Buscar'
                  )}
                </button>
              </div>

              {hasSearched && alunosEncontrados.length > 0 && !alunoSel && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '6px', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                  {alunosEncontrados.map(a => (
                    <div 
                      key={a.id} 
                      onClick={() => { setAlunoSel(a); setSearch(''); setHasSearched(false) }} 
                      style={{ padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.15s' }} 
                      onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'} 
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{a.nome}</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: '2px' }}>Matrícula: {a.matricula || a.id} • Turma: {a.turma || 'Sem turma'}</div>
                      </div>
                      <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600 }}>Selecionar →</span>
                    </div>
                  ))}
                </div>
              )}

              {hasSearched && alunosEncontrados.length === 0 && !alunoSel && (
                <div style={{ padding: '14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#dc2626', fontSize: '13.5px', textAlign: 'center' }}>
                  Nenhum aluno encontrado para "{search}".
                </div>
              )}

              {alunoSel && (
                <div style={{ padding: '14px 16px', background: '#eff6ff', border: '1.5px solid #93c5fd', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 800, color: '#1e3a8a', fontSize: '15px' }}>{alunoSel.nome}</div>
                    <div style={{ fontSize: '12.5px', color: '#2563eb', marginTop: '2px' }}>
                      Matrícula: <strong>{alunoSel.matricula || alunoSel.id}</strong> • Turma: <strong>{alunoSel.turma_nome || alunoSel.turma || 'Não enturmado'}</strong>
                    </div>
                  </div>
                  <button 
                    onClick={() => setAlunoSel(null)} 
                    style={{ background: '#dbeafe', border: 'none', color: '#1d4ed8', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Remover aluno"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Bloco 2: Selecionar Timbrado */}
            <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>2</span>
                  Selecione o Timbrado (Papel de Fundo)
                </div>
                {timbradoSelUrl && (
                  <button
                    onClick={() => {
                      const tObj = timbrados.find(t => t.url === timbradoSelUrl)
                      if (tObj) {
                        setTimbradoParaMargem(tObj)
                        setMargensTemp(getTimbradoMargensAtual(tObj.name))
                        setMargemModalOpen(true)
                      }
                    }}
                    style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Sliders size={14} /> Ajustar Margens
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '14px' }}>
                {timbrados.map(t => {
                  const isSelected = timbradoSelUrl === t.url
                  return (
                    <div 
                      key={t.name} 
                      onClick={() => setTimbradoSelUrl(t.url)}
                      style={{ 
                        height: '170px', borderRadius: '12px', 
                        border: isSelected ? '2.5px solid #2563eb' : '1px solid #cbd5e1', 
                        backgroundImage: `url(${t.url})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', cursor: 'pointer',
                        position: 'relative', backgroundColor: '#f8fafc',
                        boxShadow: isSelected ? '0 4px 12px rgba(37,99,235,0.2)' : 'none',
                        transition: 'all 0.2s'
                      }}
                    >
                      {isSelected && (
                        <div style={{ position: 'absolute', top: 6, right: 6, background: '#2563eb', color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                          <Check size={14} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  )
                })}
                {timbrados.length === 0 && !loadingTimbrados && (
                  <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>Nenhum timbrado cadastrado. Acesse a aba "Papéis Timbrados" para enviar um.</p>
                )}
              </div>
            </div>

            {/* Bloco 3: Selecionar Modelo */}
            <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>3</span>
                Selecione o Modelo de Documento
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                {(modelosDB || []).map(m => {
                  const isSelected = modeloSelId === m.id
                  return (
                    <button 
                      key={m.id}
                      onClick={() => setModeloSelId(m.id)}
                      style={{ 
                        padding: '14px', textAlign: 'left', background: isSelected ? '#eff6ff' : '#fff', 
                        border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0', borderRadius: '12px', 
                        cursor: 'pointer', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '12px',
                        transition: 'all 0.15s', outline: 'none',
                        boxShadow: isSelected ? '0 4px 10px rgba(37,99,235,0.12)' : 'none'
                      }}
                    >
                      <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: isSelected ? '#bfdbfe' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={18} color={isSelected ? '#1d4ed8' : '#64748b'} />
                      </div>
                      <div style={{ fontWeight: isSelected ? 800 : 600, fontSize: '13.5px', lineHeight: '1.3' }}>
                        {m.titulo}
                      </div>
                    </button>
                  )
                })}
                {(!modelosDB || modelosDB.length === 0) && (
                  <div style={{ gridColumn: '1 / -1', padding: '24px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>Nenhum modelo cadastrado. Acesse a aba "Gerenciar Modelos (IA)" para criar um.</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Botão de Ação Principal */}
            <button 
              onClick={handleAbrirRevisao}
              disabled={!alunoSel || !timbradoSelUrl || !modeloSelId}
              style={{ 
                width: '100%', padding: '16px', 
                background: (!alunoSel || !timbradoSelUrl || !modeloSelId) ? '#e2e8f0' : 'linear-gradient(135deg, #10b981, #059669)', 
                color: (!alunoSel || !timbradoSelUrl || !modeloSelId) ? '#94a3b8' : '#fff', 
                border: 'none', borderRadius: '14px', fontWeight: 800, fontSize: '16px',
                cursor: (!alunoSel || !timbradoSelUrl || !modeloSelId) ? 'not-allowed' : 'pointer', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                boxShadow: (!alunoSel || !timbradoSelUrl || !modeloSelId) ? 'none' : '0 8px 20px -4px rgba(16, 185, 129, 0.4)',
                transition: 'all 0.2s'
              }}
            >
              <Printer size={20} /> 
              {(!alunoSel || !timbradoSelUrl || !modeloSelId) ? 'Preencha os 3 passos acima para gerar' : 'Gerar e Revisar Documento'}
            </button>

          </div>

          {/* Coluna da Direita: Pré-visualização A4 em Tempo Real */}
          <div>
            <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', position: 'sticky', top: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>Pré-visualização (A4)</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Margens ativas: Topo {margensDoTimbradoSelecionado.top}mm • Fundo {margensDoTimbradoSelecionado.bottom}mm • Laterais {margensDoTimbradoSelecionado.left}mm
                  </div>
                </div>
                <button 
                  onClick={handleAbrirRevisao}
                  disabled={!alunoSel || !timbradoSelUrl || !modeloSelId}
                  style={{ padding: '8px 16px', background: (!alunoSel || !timbradoSelUrl || !modeloSelId) ? '#e2e8f0' : '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13.5px', cursor: (!alunoSel || !timbradoSelUrl || !modeloSelId) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Printer size={16} /> Gerar e Revisar
                </button>
              </div>

              {/* Área Visual do A4 (Escala 50% para caber perfeitamente na tela) */}
              <div style={{ width: '100%', background: '#e2e8f0', padding: '20px', borderRadius: '12px', display: 'flex', justifyContent: 'center', overflow: 'hidden', minHeight: '520px' }}>
                <div style={{ width: '105mm', height: '148.5mm', position: 'relative', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', background: '#fff' }}>
                  <div 
                    style={{
                      width: '210mm',
                      height: '297mm',
                      background: '#fff',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      transform: 'scale(0.5)',
                      transformOrigin: 'top left',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Imagem de Fundo (Timbrado) */}
                    {timbradoSelUrl && (
                      <img 
                        src={timbradoSelUrl} 
                        alt="Timbrado" 
                        style={{ position: 'absolute', top: 0, left: 0, width: '210mm', height: '297mm', objectFit: 'fill', zIndex: 1 }} 
                      />
                    )}
                    
                    {/* Texto com as Margens Configuradas */}
                    <div 
                      className="documento-texto-overlay"
                      style={{ 
                        position: 'absolute', 
                        top: `${margensDoTimbradoSelecionado.top}mm`, 
                        left: `${margensDoTimbradoSelecionado.left}mm`, 
                        right: `${margensDoTimbradoSelecionado.right}mm`, 
                        bottom: `${margensDoTimbradoSelecionado.bottom}mm`,
                        zIndex: 2,
                        color: '#000000',
                        background: 'transparent',
                        backgroundColor: 'transparent',
                        textAlign: 'justify',
                        padding: 0,
                        wordBreak: 'normal',
                        wordWrap: 'break-word',
                        overflowWrap: 'break-word',
                        fontFamily: "'Times New Roman', Times, 'Liberation Serif', serif"
                      }}
                      dangerouslySetInnerHTML={{ 
                        __html: cleanDocumentHtml(textoFinalImp || getConteudoInterpolado())
                      }}
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* ── MODAL DE REVISÃO FINAL ANTES DA IMPRESSÃO ───────────────────────── */}
      {showPreviewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '850px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#0f172a' }}>Revisão e Ajuste do Documento</h2>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
                  Aluno: <strong>{alunoSel?.nome}</strong> • Matrícula: <strong>{alunoSel?.matricula || alunoSel?.id}</strong>
                </p>
              </div>
              <button onClick={() => setShowPreviewModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}><X size={20} color="#64748b" /></button>
            </div>
            
            <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
              <div style={{ padding: '12px 16px', background: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe', color: '#1e40af', fontSize: '13px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={18} />
                <span>Os dados do aluno já foram preenchidos automaticamente. Você pode alterar qualquer trecho do texto antes de imprimir.</span>
              </div>
              <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
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

            <div style={{ padding: '18px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#f8fafc' }}>
              <button onClick={() => setShowPreviewModal(false)} style={{ padding: '10px 20px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '10px', fontWeight: 600, fontSize: '14px', color: '#64748b', cursor: 'pointer' }}>
                Voltar
              </button>
              <button 
                onClick={() => { 
                  setShowPreviewModal(false)
                  imprimirDocumento()
                }} 
                disabled={isPrinting}
                style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', borderRadius: '10px', fontWeight: 800, fontSize: '14px', color: '#fff', cursor: isPrinting ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}
              >
                {isPrinting ? (
                  <>
                    <div style={{ width: 16, height: 16, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    Preparando Impressão...
                  </>
                ) : (
                  <>
                    <Printer size={18} /> Confirmar e Imprimir
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE AJUSTE DE MARGENS (INTERATIVO & ROBUSTO) ──────────────── */}
      {margemModalOpen && timbradoParaMargem && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', padding: '28px', borderRadius: '20px', width: '920px', maxWidth: '96%', display: 'flex', gap: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)', maxHeight: '94vh', overflowY: 'auto' }}>
            
            {/* Visual Preview Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0' }}>
              <div style={{ 
                width: '280px', height: '395.8px', /* Proporção exata de A4 (1:1.414) */
                background: '#fff', position: 'relative', boxShadow: '0 8px 20px rgba(0, 0, 0, 0.15)',
                backgroundImage: `url(${timbradoParaMargem.url})`, backgroundSize: '100% 100%',
                borderRadius: '4px', overflow: 'hidden'
              }}>
                {/* Overlay Box showing text area with exact percentages */}
                <div style={{
                  position: 'absolute',
                  top: `${Math.min(100, Math.max(0, (normalizeMargins(margensTemp).top / 297) * 100))}%`,
                  bottom: `${Math.min(100, Math.max(0, (normalizeMargins(margensTemp).bottom / 297) * 100))}%`,
                  left: `${Math.min(100, Math.max(0, (normalizeMargins(margensTemp).left / 210) * 100))}%`,
                  right: `${Math.min(100, Math.max(0, (normalizeMargins(margensTemp).right / 210) * 100))}%`,
                  border: '2px dashed #2563eb',
                  background: 'rgba(37, 99, 235, 0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s ease-out'
                }}>
                  <span style={{ color: '#1d4ed8', fontWeight: 800, fontSize: '11px', textAlign: 'center', padding: '4px', background: 'rgba(255,255,255,0.85)', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    Área do Texto
                  </span>
                </div>
              </div>
              <div style={{ marginTop: '12px', fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                Proporção visual A4 em tempo real
              </div>
            </div>

            {/* Controls */}
            <div style={{ width: '340px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#0f172a' }}>Ajustar Margens</h3>
                <button onClick={() => setMargemModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}><X size={20} /></button>
              </div>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px', lineHeight: '1.5' }}>
                Defina em milímetros (mm) o espaçamento onde o texto será impresso neste papel timbrado.
              </p>

              {/* Presets Rápidos */}
              <div style={{ marginBottom: '18px', padding: '12px', background: '#f1f5f9', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>Presets Recomendados:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  <button 
                    onClick={() => setMargensTemp({ top: 75, bottom: 30, left: 25, right: 25 })}
                    style={{ padding: '4px 8px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11.5px', fontWeight: 600, color: '#1e293b', cursor: 'pointer' }}
                  >
                    Padrão (75/30/25/25)
                  </button>
                  <button 
                    onClick={() => setMargensTemp({ top: 85, bottom: 30, left: 25, right: 25 })}
                    style={{ padding: '4px 8px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11.5px', fontWeight: 600, color: '#1e293b', cursor: 'pointer' }}
                  >
                    Cabeçalho Alto (85mm)
                  </button>
                  <button 
                    onClick={() => setMargensTemp({ top: 50, bottom: 20, left: 20, right: 20 })}
                    style={{ padding: '4px 8px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11.5px', fontWeight: 600, color: '#1e293b', cursor: 'pointer' }}
                  >
                    Compacto (50mm)
                  </button>
                </div>
              </div>

              {/* Input Fields com Botões de Ajuste */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Margem Superior (Topo em mm)
                  </label>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input 
                      type="number" 
                      min="0"
                      max="200"
                      value={margensTemp.top} 
                      onChange={e => {
                        const val = e.target.value === '' ? 0 : Number(e.target.value)
                        setMargensTemp(prev => ({ ...prev, top: isNaN(val) ? 0 : val }))
                      }} 
                      style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px', fontWeight: 700, color: '#0f172a', background: '#ffffff' }} 
                    />
                    <button onClick={() => setMargensTemp(p => ({ ...p, top: Math.max(0, p.top - 5) }))} style={{ padding: '8px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>-5</button>
                    <button onClick={() => setMargensTemp(p => ({ ...p, top: Math.min(200, p.top + 5) }))} style={{ padding: '8px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>+5</button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Esquerda (mm)</label>
                    <input 
                      type="number" 
                      min="0"
                      max="100"
                      value={margensTemp.left} 
                      onChange={e => {
                        const val = e.target.value === '' ? 0 : Number(e.target.value)
                        setMargensTemp(prev => ({ ...prev, left: isNaN(val) ? 0 : val }))
                      }} 
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px', fontWeight: 700, color: '#0f172a', background: '#ffffff' }} 
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Direita (mm)</label>
                    <input 
                      type="number" 
                      min="0"
                      max="100"
                      value={margensTemp.right} 
                      onChange={e => {
                        const val = e.target.value === '' ? 0 : Number(e.target.value)
                        setMargensTemp(prev => ({ ...prev, right: isNaN(val) ? 0 : val }))
                      }} 
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px', fontWeight: 700, color: '#0f172a', background: '#ffffff' }} 
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Margem Inferior (Rodapé em mm)
                  </label>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input 
                      type="number" 
                      min="0"
                      max="150"
                      value={margensTemp.bottom} 
                      onChange={e => {
                        const val = e.target.value === '' ? 0 : Number(e.target.value)
                        setMargensTemp(prev => ({ ...prev, bottom: isNaN(val) ? 0 : val }))
                      }} 
                      style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px', fontWeight: 700, color: '#0f172a', background: '#ffffff' }} 
                    />
                    <button onClick={() => setMargensTemp(p => ({ ...p, bottom: Math.max(0, p.bottom - 5) }))} style={{ padding: '8px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>-5</button>
                    <button onClick={() => setMargensTemp(p => ({ ...p, bottom: Math.min(150, p.bottom + 5) }))} style={{ padding: '8px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>+5</button>
                  </div>
                </div>
              </div>

              {saveSuccessMsg && (
                <div style={{ padding: '10px', background: '#dcfce7', border: '1px solid #86efac', borderRadius: '8px', color: '#15803d', fontSize: '13px', fontWeight: 600, textAlign: 'center', marginBottom: '12px' }}>
                  ✓ {saveSuccessMsg}
                </div>
              )}

              <div style={{ marginTop: 'auto' }}>
                <button 
                  onClick={salvarMargens}
                  style={{ width: '100%', padding: '14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.3)', transition: 'all 0.2s' }}
                >
                  Salvar Margens no Sistema
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
