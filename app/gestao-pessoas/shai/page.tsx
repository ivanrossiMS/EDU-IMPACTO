'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  FileSpreadsheet, Upload, Send, CheckCircle2, Clock, 
  Search, Filter, Sparkles, Copy, Check, Trash2, RefreshCw,
  MessageSquare, User, Smartphone, ShieldCheck, KeyRound, ExternalLink,
  ChevronDown, HelpCircle, FileText, Download, Play, AlertCircle, Building,
  ArrowUpDown, ArrowUp, ArrowDown, Database, Pencil, X
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import * as XLSX from 'xlsx'
import { useApp } from '@/lib/context'
import { toast } from 'sonner'

export interface ColaboradorShai {
  id: string
  unidade: string
  nome: string
  cpf: string
  dataNascimento: string
  whatsapp: string
  codigo: string
  status: 'pendente' | 'enviado'
  enviadoEm?: string | null
}

type SortField = 'unidade' | 'nome' | 'cpf' | 'dataNascimento' | 'whatsapp' | 'codigo' | 'status'
type SortOrder = 'asc' | 'desc'

const DEFAULT_MESSAGE_TEMPLATE = `Olá, colaborador! Esse é seu codigo para acesso a plataforma Shai, as instruções de acesso está na imagem enviada nos grupos.\nCODIGO: {CODIGO}`

const MOCK_DEMO_DATA: Omit<ColaboradorShai, 'id' | 'status' | 'enviadoEm'>[] = [
  { unidade: 'COLEGIO EF', nome: 'Alana Santos da Silva', cpf: '023.212.071-02', dataNascimento: '02/06/1987', whatsapp: '6798126-6568', codigo: 'DFD35855' },
  { unidade: 'COLEGIO EF', nome: 'Ana Lúcia Fernandes Pedrosa', cpf: '143.810.208-98', dataNascimento: '04/06/1976', whatsapp: '6799245-7678', codigo: 'DFD35856' },
  { unidade: 'COLEGIO EF', nome: 'Ana Paula da Silva Bolandine', cpf: '749.479.901-04', dataNascimento: '13/01/1992', whatsapp: '6799227-6915', codigo: 'DFD35857' },
  { unidade: 'COLEGIO EF', nome: 'Anahi Aguirre Gabino Husmann', cpf: '012.244.801-47', dataNascimento: '26/06/1992', whatsapp: '6799263-8916', codigo: 'DFD35858' },
  { unidade: 'COLEGIO EF', nome: 'Andreia da Silva Rodrigues', cpf: '019.720.431-70', dataNascimento: '19/06/1988', whatsapp: '6799654-1919', codigo: 'DFD35859' },
  { unidade: 'COLEGIO EF', nome: 'Aparecida de Jesus Santos', cpf: '309.064.821-00', dataNascimento: '04/02/1963', whatsapp: '6799213-2003', codigo: 'DFD35860' },
  { unidade: 'COLEGIO EF', nome: 'Bruna Rodrigues dos Reis Santos', cpf: '066.675.531-05', dataNascimento: '02/05/1998', whatsapp: '6799236-0358', codigo: 'DFD35861' },
  { unidade: 'COLEGIO EF', nome: 'Cristina Izidora da Silva Brandão', cpf: '973.329.681-34', dataNascimento: '11/12/1980', whatsapp: '6798190-1550', codigo: 'DFD35862' },
]

// Helper function to format Excel serial dates to DD/MM/YYYY
function formatExcelDate(val: any): string {
  if (val === null || val === undefined || val === '') return ''
  if (typeof val === 'number') {
    // Convert Excel serial number (days since 1899-12-30) to Date
    const date = new Date(Math.round((val - 25569) * 86400 * 1000))
    if (!isNaN(date.getTime())) {
      const day = String(date.getUTCDate()).padStart(2, '0')
      const month = String(date.getUTCMonth() + 1).padStart(2, '0')
      const year = date.getUTCFullYear()
      return `${day}/${month}/${year}`
    }
  }
  return String(val).trim()
}

export default function ShaiPage() {
  const { currentUser } = useApp()
  const [colaboradores, setColaboradores] = useState<ColaboradorShai[]>([])
  const [messageTemplate, setMessageTemplate] = useState<string>(DEFAULT_MESSAGE_TEMPLATE)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'todos' | 'pendente' | 'enviado'>('todos')
  const [dbSynced, setDbSynced] = useState<boolean>(false)
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('nome')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingCode, setEditingCode] = useState<string>('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedColab, setSelectedColab] = useState<ColaboradorShai | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load state from local storage first, then sync with Supabase database API
  useEffect(() => {
    let localData: ColaboradorShai[] = []
    
    // 1. Instant load from localStorage
    try {
      const savedData = localStorage.getItem('impacto_shai_colaboradores')
      if (savedData) {
        const parsed = JSON.parse(savedData)
        if (Array.isArray(parsed) && parsed.length > 0) {
          localData = parsed
          setColaboradores(parsed)
        }
      }
      const savedTpl = localStorage.getItem('impacto_shai_mensagem_template')
      if (savedTpl) setMessageTemplate(savedTpl)
    } catch (e) {}

    // 2. Sync with Supabase Database API
    fetch('/api/gestao-pessoas/shai')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setDbSynced(true)
          if (data.colaboradores && data.colaboradores.length > 0) {
            setColaboradores(data.colaboradores)
            try {
              localStorage.setItem('impacto_shai_colaboradores', JSON.stringify(data.colaboradores))
            } catch (e) {}
          } else if (localData.length > 0) {
            // Push local data to Database API if DB is currently empty
            fetch('/api/gestao-pessoas/shai', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ colaboradores: localData })
            })
          }

          if (data.template) {
            setMessageTemplate(data.template)
            try {
              localStorage.setItem('impacto_shai_mensagem_template', data.template)
            } catch (e) {}
          }
        }
      })
      .catch(e => console.error('API Sync Error:', e))
  }, [])

  // Persist colaboradores to both localStorage and Supabase API
  const updateColaboradores = async (newData: ColaboradorShai[]) => {
    setColaboradores(newData)
    try {
      localStorage.setItem('impacto_shai_colaboradores', JSON.stringify(newData))
    } catch (e) {
      console.error('Erro ao salvar no localStorage:', e)
    }

    // Post to API for permanent Supabase storage
    try {
      const res = await fetch('/api/gestao-pessoas/shai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colaboradores: newData })
      })
      const data = await res.json()
      if (data.error) {
        console.error('Erro ao salvar no Supabase:', data.error)
      }
      return data
    } catch (e) {
      console.error('Erro ao sincronizar com banco de dados:', e)
      return { error: e }
    }
  }

  // Save template update to localStorage and Supabase API
  const handleTemplateChange = (tpl: string) => {
    setMessageTemplate(tpl)
    try {
      localStorage.setItem('impacto_shai_mensagem_template', tpl)
    } catch (e) {
      console.error('Erro ao salvar modelo:', e)
    }

    fetch('/api/gestao-pessoas/shai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_template', template: tpl })
    }).catch(e => console.error('Erro ao sincronizar modelo no banco:', e))
  }

  // Handle Sort Clicking
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  // Clean phone number for WhatsApp URL (+55 format)
  const formatPhoneForWhatsapp = (phone: string): string => {
    let clean = (phone || '').replace(/\D/g, '')
    if (!clean) return ''
    if (clean.length === 10 || clean.length === 11) {
      clean = '55' + clean
    }
    return clean
  }

  // Format message text with variables
  const getFormattedMessage = (colab: ColaboradorShai): string => {
    let msg = messageTemplate || DEFAULT_MESSAGE_TEMPLATE
    msg = msg.replace(/\{NOME\}/gi, colab.nome || '')
    msg = msg.replace(/\{CODIGO\}/gi, colab.codigo || '')
    msg = msg.replace(/\{CPF\}/gi, colab.cpf || '')
    msg = msg.replace(/\{UNIDADE\}/gi, colab.unidade || '')
    msg = msg.replace(/\{DATA_NASCIMENTO\}/gi, colab.dataNascimento || '')
    return msg
  }

  // Open WhatsApp link for a collaborator
  const handleSendWhatsapp = (colab: ColaboradorShai) => {
    const rawPhone = colab.whatsapp
    const cleanPhone = formatPhoneForWhatsapp(rawPhone)

    if (!cleanPhone) {
      toast.error(`O colaborador ${colab.nome} não possui um número de WhatsApp válido!`)
      return
    }

    const text = getFormattedMessage(colab)
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`
    
    // Open in new tab
    window.open(url, '_blank')

    // Mark as sent
    const updated = colaboradores.map(item => {
      if (item.id === colab.id) {
        return {
          ...item,
          status: 'enviado' as const,
          enviadoEm: new Date().toLocaleString('pt-BR')
        }
      }
      return item
    })

    updateColaboradores(updated)
    toast.success(`Abrindo WhatsApp para ${colab.nome}... Status salvo permanentemente!`)
  }

  // Toggle status manually
  const handleToggleStatus = (id: string) => {
    const updated = colaboradores.map(item => {
      if (item.id === id) {
        const nextStatus: 'pendente' | 'enviado' = item.status === 'enviado' ? 'pendente' : 'enviado'
        return {
          ...item,
          status: nextStatus,
          enviadoEm: nextStatus === 'enviado' ? new Date().toLocaleString('pt-BR') : null
        }
      }
      return item
    })
    updateColaboradores(updated)
  }

  // Send next pending collaborator
  const handleSendNextPending = () => {
    const nextPending = colaboradores.find(c => c.status === 'pendente')
    if (!nextPending) {
      toast.info('Parabéns! Todos os colaboradores já receberam a mensagem.')
      return
    }
    handleSendWhatsapp(nextPending)
  }

  // Copy Code to Clipboard
  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedId(id)
    toast.success('Código copiado para a área de transferência!')
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Start Inline Code Editing
  const startEditingCode = (colab: ColaboradorShai) => {
    setEditingId(colab.id)
    setEditingCode(colab.codigo || '')
  }

  // Save Inline Code Editing
  const handleSaveEditedCode = async (id: string) => {
    const newCode = editingCode.trim()
    const updated = colaboradores.map(c => {
      if (c.id === id) {
        return { ...c, codigo: newCode }
      }
      return c
    })
    setEditingId(null)
    setEditingCode('')

    const apiResult = await updateColaboradores(updated)
    if (apiResult?.error) {
      toast.error('Código atualizado localmente, mas houve um aviso ao salvar no banco de dados.')
    } else {
      toast.success('Código SHAI substituído e salvo com sucesso no banco de dados!')
    }
  }

  // Cancel Inline Code Editing
  const handleCancelEditCode = () => {
    setEditingId(null)
    setEditingCode('')
  }

  // Copy Full Message to Clipboard
  const handleCopyMessage = (colab: ColaboradorShai) => {
    const text = getFormattedMessage(colab)
    navigator.clipboard.writeText(text)
    setCopiedMsgId(colab.id)
    toast.success('Mensagem completa copiada!')
    setTimeout(() => setCopiedMsgId(null), 2000)
  }

  // Parse uploaded spreadsheet file
  const processExcelFile = (file: File) => {
    setIsProcessing(true)
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]

        // Convert to array of arrays
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

        if (!rows || rows.length === 0) {
          toast.error('A planilha fornecida está vazia.')
          setIsProcessing(false)
          return
        }

        // Determine if row 0 is header
        let startIndex = 0
        const firstRow = rows[0] || []
        const hasHeader = firstRow.some((val: any) => 
          typeof val === 'string' && (
            val.toUpperCase().includes('NOME') || 
            val.toUpperCase().includes('CPF') || 
            val.toUpperCase().includes('WHATSAPP') || 
            val.toUpperCase().includes('CÓDIGO') || 
            val.toUpperCase().includes('CODIGO')
          )
        )

        if (hasHeader) {
          startIndex = 1
        }

        const newColabs: ColaboradorShai[] = []

        for (let i = startIndex; i < rows.length; i++) {
          const row = rows[i]
          if (!row || row.length === 0) continue

          // Col A: Unidade, Col B: Nome, Col C: CPF, Col D: Data Nasc, Col E: WhatsApp, Col F: Código
          const unidade = String(row[0] || '').trim()
          const nome = String(row[1] || '').trim()
          const cpf = String(row[2] || '').trim()
          const dataNascimento = formatExcelDate(row[3])
          const whatsapp = String(row[4] || '').trim()
          const codigo = String(row[5] || '').trim()

          // Skip completely empty rows
          if (!nome && !cpf && !codigo && !whatsapp) continue

          newColabs.push({
            id: `shai_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
            unidade: unidade || 'COLEGIO EF',
            nome: nome || `Colaborador ${i}`,
            cpf: cpf,
            dataNascimento: dataNascimento,
            whatsapp: whatsapp,
            codigo: codigo,
            status: 'pendente',
            enviadoEm: null
          })
        }

        if (newColabs.length === 0) {
          toast.warning('Nenhum colaborador válido foi encontrado na planilha.')
        } else {
          updateColaboradores(newColabs)
          toast.success(`${newColabs.length} colaboradores importados e salvos permanentemente!`)
        }
      } catch (err) {
        console.error('Erro ao ler planilha:', err)
        toast.error('Ocorreu um erro ao processar o arquivo. Verifique se é um arquivo Excel (.xlsx, .xls) ou CSV válido.')
      } finally {
        setIsProcessing(false)
      }
    }

    reader.onerror = () => {
      toast.error('Erro de leitura do arquivo.')
      setIsProcessing(false)
    }

    reader.readAsArrayBuffer(file)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processExcelFile(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processExcelFile(file)
  }

  // Load demo data
  const handleLoadDemoData = () => {
    const demoList: ColaboradorShai[] = MOCK_DEMO_DATA.map((item, idx) => ({
      ...item,
      id: `demo_${Date.now()}_${idx}`,
      status: 'pendente',
      enviadoEm: null
    }))
    updateColaboradores(demoList)
    toast.success('Planilha de demonstração carregada e salva permanentemente!')
  }

  // Clear list
  const handleClearList = () => {
    if (colaboradores.length === 0) return
    if (window.confirm('Tem certeza de que deseja limpar a lista atual de colaboradores?')) {
      setColaboradores([])
      try {
        localStorage.removeItem('impacto_shai_colaboradores')
      } catch (e) {}

      fetch('/api/gestao-pessoas/shai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_all' })
      }).catch(e => console.error('Erro ao limpar banco:', e))

      toast.info('Lista de colaboradores zerada.')
    }
  }

  // Export current status to CSV/Excel
  const handleExportStatus = () => {
    if (colaboradores.length === 0) {
      toast.info('Não há dados para exportar.')
      return
    }

    const dataToExport = colaboradores.map(c => ({
      'UNIDADE': c.unidade,
      'NOME COMPLETO': c.nome,
      'CPF': c.cpf,
      'DATA NASCIMENTO': c.dataNascimento,
      'WHATSAPP': c.whatsapp,
      'CÓDIGO SHAI': c.codigo,
      'STATUS ENVIO': c.status.toUpperCase(),
      'ENVIADO EM': c.enviadoEm || '-'
    }))

    const worksheet = XLSX.utils.json_to_sheet(dataToExport)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'SHAI_Relatorio')
    XLSX.writeFile(workbook, `SHAI_Relatorio_Envios_${new Date().toISOString().slice(0,10)}.xlsx`)
    toast.success('Relatório exportado com sucesso!')
  }

  // Insert tag into message template at cursor position
  const insertTag = (tag: string) => {
    setMessageTemplate(prev => prev + ' ' + tag)
  }

  // Filtered colaboradores list
  const filteredColaboradores = colaboradores.filter(colab => {
    const matchesSearch = 
      colab.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      colab.cpf.includes(searchTerm) ||
      colab.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      colab.unidade.toLowerCase().includes(searchTerm.toLowerCase()) ||
      colab.whatsapp.includes(searchTerm)

    if (filterStatus === 'todos') return matchesSearch
    return matchesSearch && colab.status === filterStatus
  })

  // Sorted list
  const sortedColaboradores = [...filteredColaboradores].sort((a, b) => {
    let valA = String(a[sortField] || '').toLowerCase()
    let valB = String(b[sortField] || '').toLowerCase()

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1
    return 0
  })

  // Stats calculation
  const totalCount = colaboradores.length
  const enviadosCount = colaboradores.filter(c => c.status === 'enviado').length
  const pendentesCount = colaboradores.filter(c => c.status === 'pendente').length
  const comWhatsappCount = colaboradores.filter(c => !!formatPhoneForWhatsapp(c.whatsapp)).length

  const previewColab = selectedColab || colaboradores[0] || MOCK_DEMO_DATA[0]

  // Render Table Header with Sorting
  const renderSortHeader = (label: string, field: SortField, alignRight = false) => {
    const isSorted = sortField === field
    return (
      <th
        onClick={() => handleSort(field)}
        style={{
          padding: '12px 10px',
          cursor: 'pointer',
          userSelect: 'none',
          textAlign: alignRight ? 'right' : 'left',
          transition: 'color 0.2s',
        }}
        className="hover:text-indigo-600"
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: alignRight ? 'flex-end' : 'flex-start' }}>
          <span>{label}</span>
          {isSorted ? (
            sortOrder === 'asc' ? <ArrowUp size={13} color="#4f46e5" /> : <ArrowDown size={13} color="#4f46e5" />
          ) : (
            <ArrowUpDown size={11} color="#94a3b8" style={{ opacity: 0.6 }} />
          )}
        </div>
      </th>
    )
  }

  return (
    <div style={{
      padding: '24px 28px',
      maxWidth: '100%',
      margin: '0 auto',
      minHeight: '100%',
      background: '#f8fafc',
      fontFamily: "'Inter', sans-serif",
      position: 'relative',
      boxSizing: 'border-box'
    }}>
      
      {/* Dynamic Background Glows */}
      <div style={{ position: 'absolute', top: -150, right: -100, width: 450, height: 450, background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 65%)', filter: 'blur(50px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -150, left: -100, width: 450, height: 450, background: 'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 65%)', filter: 'blur(50px)', pointerEvents: 'none' }} />

      {/* HEADER SECTION */}
      <motion.div 
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg, #ede9fe 0%, #e0e7ff 100%)', color: '#6366f1', padding: '4px 12px', borderRadius: 100, fontSize: 12, fontWeight: 700, border: '1px solid rgba(99,102,241,0.2)' }}>
              <KeyRound size={14} /> Módulo Especial SHAI
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#ecfdf5', color: '#059669', padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, border: '1px solid #a7f3d0' }}>
              <Database size={13} /> Dados Persistentes (Banco & Cache)
            </div>
          </div>

          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', margin: 0, lineHeight: 1.1 }}>
            Plataforma SHAI
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', maxWidth: 650, marginTop: 4, lineHeight: 1.4 }}>
            Importe a planilha com os códigos de acesso dos colaboradores e faça o disparo prático e seguro das mensagens via WhatsApp.
          </p>
        </div>

        {/* Action Buttons Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {colaboradores.length > 0 && (
            <>
              <button
                onClick={handleSendNextPending}
                disabled={pendentesCount === 0}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 16px',
                  borderRadius: 12,
                  background: pendentesCount > 0 ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#cbd5e1',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: 13,
                  border: 'none',
                  cursor: pendentesCount > 0 ? 'pointer' : 'not-allowed',
                  boxShadow: pendentesCount > 0 ? '0 4px 14px rgba(16,185,129,0.25)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                <Play size={16} fill="#ffffff" />
                Disparar Próximo ({pendentesCount})
              </button>

              <button
                onClick={handleExportStatus}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: '#ffffff',
                  color: '#334155',
                  fontWeight: 600,
                  fontSize: 13,
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                }}
              >
                <Download size={16} color="#64748b" />
                Exportar Excel
              </button>
            </>
          )}

          <button
            onClick={() => setShowConfig(!showConfig)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 14px',
              borderRadius: 12,
              background: showConfig ? '#e0e7ff' : '#ffffff',
              color: showConfig ? '#4f46e5' : '#475569',
              fontWeight: 700,
              fontSize: 13,
              border: '1px solid #cbd5e1',
              cursor: 'pointer'
            }}
          >
            <MessageSquare size={16} color={showConfig ? '#4f46e5' : '#64748b'} />
            {showConfig ? 'Ocultar Modelo' : 'Editar Modelo WhatsApp'}
          </button>
        </div>
      </motion.div>

      {/* KPI METRICS CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Carregados', value: totalCount, icon: FileSpreadsheet, color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
          { label: 'Com WhatsApp Válido', value: comWhatsappCount, icon: Smartphone, color: '#8b5cf6', bg: '#f3e8ff', border: '#ddd6fe' },
          { label: 'Mensagens Enviadas', value: enviadosCount, icon: CheckCircle2, color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' },
          { label: 'Pendentes de Envio', value: pendentesCount, icon: Clock, color: '#f59e0b', bg: '#fef3c7', border: '#fde68a' }
        ].map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            style={{
              background: '#ffffff',
              borderRadius: 16,
              padding: '16px 20px',
              border: `1px solid ${card.border}`,
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 2 }}>
                {card.label}
              </span>
              <span style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>
                {card.value}
              </span>
            </div>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: card.bg, color: card.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <card.icon size={20} strokeWidth={2.2} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* MESSAGE TEMPLATE CUSTOMIZER & LIVE PREVIEW */}
      <AnimatePresence>
        {showConfig && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.3 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              background: '#ffffff',
              borderRadius: 20,
              padding: 24,
              border: '1px solid #e2e8f0',
              boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
              display: 'grid',
              gridTemplateColumns: '1fr 340px',
              gap: 24,
              alignItems: 'start'
            }}>
              {/* Left Column: Template Text Editor */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MessageSquare size={18} color="#6366f1" /> Modelo da Mensagem de Envio
                  </h3>
                  <button
                    onClick={() => handleTemplateChange(DEFAULT_MESSAGE_TEMPLATE)}
                    style={{ background: 'transparent', border: 'none', color: '#6366f1', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <RefreshCw size={13} /> Restaurar Padrão
                  </button>
                </div>

                <p style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
                  Insira abaixo o modelo da mensagem que será disparada via WhatsApp. Clique nas variáveis para inseri-las dinamicamente:
                </p>

                {/* Variable Tag Badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {[
                    { label: '+ {CODIGO}', tag: '{CODIGO}', desc: 'Código SHAI' },
                    { label: '+ {NOME}', tag: '{NOME}', desc: 'Nome Completo' },
                    { label: '+ {CPF}', tag: '{CPF}', desc: 'CPF' },
                    { label: '+ {UNIDADE}', tag: '{UNIDADE}', desc: 'Unidade/Escola' },
                    { label: '+ {DATA_NASCIMENTO}', tag: '{DATA_NASCIMENTO}', desc: 'Data de Nasc.' }
                  ].map((t, idx) => (
                    <button
                      key={idx}
                      onClick={() => insertTag(t.tag)}
                      title={`Inserir ${t.desc}`}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        color: '#334155',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                      onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={messageTemplate}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#0f172a',
                    fontSize: 13,
                    lineHeight: 1.5,
                    fontFamily: 'inherit',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                  placeholder="Digite a mensagem..."
                />
              </div>

              {/* Right Column: Live WhatsApp iPhone Chat Bubble Mockup */}
              <div style={{
                background: '#ece5dd',
                backgroundImage: 'radial-gradient(#d6cece 1px, transparent 1px)',
                backgroundSize: '14px 14px',
                borderRadius: 16,
                padding: 14,
                border: '1px solid #cbd5e1'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10, borderBottom: '1px solid rgba(0,0,0,0.08)', marginBottom: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#25d366', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                    WA
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#111b21' }}>Pré-visualização WhatsApp</div>
                    <div style={{ fontSize: 10, color: '#667781' }}>Disparo direto via link API</div>
                  </div>
                </div>

                {/* WhatsApp Chat Bubble */}
                <div style={{
                  background: '#dcf8c6',
                  borderRadius: '10px 10px 0px 10px',
                  padding: 10,
                  color: '#111b21',
                  fontSize: 12,
                  lineHeight: 1.4,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {getFormattedMessage(previewColab as ColaboradorShai)}
                  <div style={{ textAlign: 'right', fontSize: 9, color: '#667781', marginTop: 4 }}>
                    12:00 ✓✓
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SPREADSHEET UPLOAD & DEMO DATA SECTION */}
      <div style={{ marginBottom: 24 }}>
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            background: isDragOver ? '#f0f9ff' : '#ffffff',
            border: `2px dashed ${isDragOver ? '#0284c7' : '#cbd5e1'}`,
            borderRadius: 20,
            padding: '24px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
          }}
          onMouseEnter={e => {
            if (!isDragOver) e.currentTarget.style.borderColor = '#94a3b8'
          }}
          onMouseLeave={e => {
            if (!isDragOver) e.currentTarget.style.borderColor = '#cbd5e1'
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />

          <div style={{ width: 48, height: 48, borderRadius: 16, background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
            <FileSpreadsheet size={24} strokeWidth={2} />
          </div>

          <h3 style={{ margin: '0 0 4px 0', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
            {isProcessing ? 'Processando planilha...' : 'Clique para selecionar ou arraste sua planilha Excel aqui'}
          </h3>
          
          <p style={{ margin: '0 auto 14px auto', fontSize: 13, color: '#64748b', maxWidth: 550, lineHeight: 1.4 }}>
            Suporta <strong>.XLSX</strong>, <strong>.XLS</strong> e <strong>.CSV</strong>. Mapeamento automático (Col A: Unidade | Col B: Nome | Col C: CPF | Col D: Nasc. | Col E: WhatsApp | Col F: Código).
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                background: '#3b82f6',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: 12,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Upload size={14} /> Selecionar Arquivo
            </button>

            <button
              onClick={handleLoadDemoData}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                background: '#f1f5f9',
                color: '#334155',
                fontWeight: 600,
                fontSize: 12,
                border: '1px solid #cbd5e1',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Sparkles size={14} color="#8b5cf6" /> Carregar Dados de Exemplo (8 Colaboradores)
            </button>
          </div>
        </div>
      </div>

      {/* DATA TABLE SECTION - Optimized to fit screen width without horizontal scroll */}
      <div style={{ background: '#ffffff', borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
        
        {/* Table Toolbar / Controls */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          
          {/* Search Input */}
          <div style={{ position: 'relative', width: 300, maxWidth: '100%' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Buscar por Nome, CPF, Código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                fontSize: 13,
                color: '#0f172a',
                outline: 'none'
              }}
            />
          </div>

          {/* Filter Status Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f1f5f9', padding: 3, borderRadius: 10 }}>
            {[
              { id: 'todos', label: `Todos (${totalCount})` },
              { id: 'pendente', label: `Pendentes (${pendentesCount})` },
              { id: 'enviado', label: `Enviados (${enviadosCount})` }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id as any)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: filterStatus === tab.id ? '#ffffff' : 'transparent',
                  color: filterStatus === tab.id ? '#0f172a' : '#64748b',
                  fontWeight: filterStatus === tab.id ? 700 : 500,
                  fontSize: 12,
                  cursor: 'pointer',
                  boxShadow: filterStatus === tab.id ? '0 1px 4px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Actions */}
          {colaboradores.length > 0 && (
            <button
              onClick={handleClearList}
              style={{
                background: '#fff1f2',
                border: '1px solid #fecdd3',
                color: '#e11d48',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <Trash2 size={14} /> Limpar Lista
            </button>
          )}
        </div>

        {/* Table Body with Fit Layout (No horizontal scrolling required!) */}
        {sortedColaboradores.length > 0 ? (
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'auto' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {renderSortHeader('UNIDADE', 'unidade')}
                  {renderSortHeader('COLABORADOR', 'nome')}
                  {renderSortHeader('CPF / DATA NASC.', 'cpf')}
                  {renderSortHeader('WHATSAPP', 'whatsapp')}
                  {renderSortHeader('CÓDIGO SHAI', 'codigo')}
                  {renderSortHeader('STATUS ENVIO', 'status')}
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>AÇÕES</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: 13, color: '#1e293b' }}>
                {sortedColaboradores.map((colab) => {
                  const hasValidPhone = !!formatPhoneForWhatsapp(colab.whatsapp)
                  const isSent = colab.status === 'enviado'

                  return (
                    <tr
                      key={colab.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.15s',
                        background: isSent ? '#f8fafc' : '#ffffff'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                      onMouseLeave={e => e.currentTarget.style.background = isSent ? '#f8fafc' : '#ffffff'}
                    >
                      {/* Unidade */}
                      <td style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: '#f1f5f9', color: '#475569', fontSize: 11, fontWeight: 700 }}>
                          <Building size={12} color="#64748b" /> {colab.unidade}
                        </span>
                      </td>

                      {/* Nome Colaborador */}
                      <td style={{ padding: '12px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #3b82f6)', color: '#ffffff', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {colab.nome.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, lineHeight: 1.2 }}>{colab.nome}</div>
                          </div>
                        </div>
                      </td>

                      {/* CPF / Data Nasc */}
                      <td style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: '#334155', fontFamily: 'monospace', fontSize: 12 }}>{colab.cpf || '-'}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{colab.dataNascimento || '-'}</div>
                      </td>

                      {/* WhatsApp */}
                      <td style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Smartphone size={14} color={hasValidPhone ? '#10b981' : '#94a3b8'} />
                          <span style={{ fontWeight: 600, fontSize: 12, color: hasValidPhone ? '#0f172a' : '#94a3b8' }}>
                            {colab.whatsapp || 'Não informado'}
                          </span>
                        </div>
                      </td>

                      {/* Código SHAI */}
                      <td style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}>
                        {editingId === colab.id ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <input
                              type="text"
                              value={editingCode}
                              onChange={(e) => setEditingCode(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEditedCode(colab.id)
                                if (e.key === 'Escape') handleCancelEditCode()
                              }}
                              autoFocus
                              placeholder="Código"
                              style={{
                                padding: '4px 8px',
                                borderRadius: 8,
                                background: '#ffffff',
                                color: '#4c1d95',
                                fontFamily: 'monospace',
                                fontSize: 13,
                                fontWeight: 900,
                                letterSpacing: '0.04em',
                                border: '2px solid #7c3aed',
                                outline: 'none',
                                width: 110,
                                boxShadow: '0 0 0 3px rgba(124, 58, 237, 0.15)'
                              }}
                            />
                            <button
                              onClick={() => handleSaveEditedCode(colab.id)}
                              title="Salvar"
                              style={{
                                background: '#10b981',
                                border: 'none',
                                color: '#ffffff',
                                borderRadius: 6,
                                padding: '4px 6px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={handleCancelEditCode}
                              title="Cancelar"
                              style={{
                                background: '#ef4444',
                                border: 'none',
                                color: '#ffffff',
                                borderRadius: 6,
                                padding: '4px 6px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <span
                              onClick={() => startEditingCode(colab)}
                              title="Clique para editar o Código SHAI"
                              style={{
                                padding: '4px 8px',
                                borderRadius: 8,
                                background: colab.codigo ? '#ede9fe' : '#f1f5f9',
                                color: colab.codigo ? '#6d28d9' : '#64748b',
                                fontFamily: 'monospace',
                                fontSize: 13,
                                fontWeight: 900,
                                letterSpacing: '0.04em',
                                border: colab.codigo ? '1px solid #ddd6fe' : '1px dashed #cbd5e1',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = '#7c3aed'
                                e.currentTarget.style.background = '#ddd6fe'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = colab.codigo ? '#ddd6fe' : '#cbd5e1'
                                e.currentTarget.style.background = colab.codigo ? '#ede9fe' : '#f1f5f9'
                              }}
                            >
                              {colab.codigo || 'SEM CÓDIGO'}
                              <Pencil size={11} style={{ opacity: 0.6, marginLeft: 2 }} />
                            </span>
                            <button
                              onClick={() => handleCopyCode(colab.id, colab.codigo)}
                              title="Copiar Código"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: copiedId === colab.id ? '#10b981' : '#64748b',
                                cursor: 'pointer',
                                padding: 2
                              }}
                            >
                              {copiedId === colab.id ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Status Envio */}
                      <td style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => handleToggleStatus(colab.id)}
                          title="Clique para alternar status"
                          style={{
                            border: 'none',
                            background: isSent ? '#ecfdf5' : '#fef3c7',
                            color: isSent ? '#059669' : '#d97706',
                            padding: '4px 10px',
                            borderRadius: 100,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          {isSent ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                          {isSent ? 'Enviado' : 'Pendente'}
                        </button>
                      </td>

                      {/* Action WhatsApp Button - Compact layout */}
                      <td style={{ padding: '12px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            onClick={() => handleCopyMessage(colab)}
                            title="Copiar mensagem completa"
                            style={{
                              padding: '6px 8px',
                              borderRadius: 8,
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              color: copiedMsgId === colab.id ? '#10b981' : '#475569',
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3
                            }}
                          >
                            {copiedMsgId === colab.id ? <Check size={13} /> : <Copy size={13} />}
                            Copiar
                          </button>

                          <button
                            onClick={() => handleSendWhatsapp(colab)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 8,
                              background: isSent 
                                ? '#ffffff' 
                                : 'linear-gradient(135deg, #25d366 0%, #128c7e 100%)',
                              color: isSent ? '#059669' : '#ffffff',
                              border: isSent ? '1px solid #a7f3d0' : 'none',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              boxShadow: isSent ? 'none' : '0 2px 8px rgba(37,211,102,0.25)',
                              transition: 'all 0.2s'
                            }}
                          >
                            <Send size={13} />
                            {isSent ? 'Reenviar' : 'Enviar WA'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
            <FileSpreadsheet size={40} color="#cbd5e1" style={{ marginBottom: 12 }} />
            <h4 style={{ margin: '0 0 6px 0', fontSize: 16, color: '#0f172a', fontWeight: 800 }}>Nenhum colaborador encontrado</h4>
            <p style={{ margin: 0, fontSize: 13 }}>
              {colaboradores.length === 0 
                ? 'Faça o upload de uma planilha Excel acima ou clique em "Carregar Dados de Exemplo".'
                : 'Nenhum resultado corresponde à sua busca ou filtro.'}
            </p>
          </div>
        )}
      </div>

    </div>
  )
}
