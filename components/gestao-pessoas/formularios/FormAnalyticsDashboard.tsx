'use client'

import React, { useState, useMemo, useRef } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import * as XLSX from 'xlsx'
import {
  BarChart3,
  PieChart as PieChartIcon,
  Users,
  FileSpreadsheet,
  Download,
  Upload,
  Plus,
  Search,
  Trash2,
  Edit3,
  Printer,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  HelpCircle,
  UserCheck,
  UserPlus,
  Sparkles,
  Copy,
  Check,
  Filter,
  Award,
  TrendingUp,
  MessageSquare,
  ListOrdered,
} from 'lucide-react'
import {
  GPForm,
  GPFormResponse,
  FormField,
} from '@/lib/gestao-pessoas/formulariosTypes'

const CHART_COLORS = [
  '#4f46e5',
  '#10b981',
  '#0ea5e9',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#14b8a6',
  '#f43f5e',
  '#6366f1',
  '#84cc16',
]

interface ColaboradorItem {
  id: string
  nome: string
  cargo?: string
  departamento?: string
  unidade?: string
  email?: string
}

interface FormAnalyticsDashboardProps {
  form: GPForm
  responses: GPFormResponse[]
  colaboradoresList: ColaboradorItem[]
  onAddManualResponse: (prefillColaborador?: ColaboradorItem) => void
  onEditResponse: (response: GPFormResponse) => void
  onDeleteResponse: (responseId: string) => Promise<void>
  onBulkImportSuccess: (updatedResponses: GPFormResponse[]) => void
}

export function formatAnswerValue(field: FormField, answers: Record<string, any>): string {
  const raw = answers?.[field.id]
  if (raw === undefined || raw === null || raw === '') return '—'

  if (field.type === 'grade_multipla' || field.type === 'grade_caixas') {
    if (typeof raw !== 'object') return String(raw)
    return Object.entries(raw)
      .map(([row, col]) => `${row}: ${Array.isArray(col) ? col.join(', ') : col}`)
      .join(' | ')
  }

  if (field.type === 'ranking' && Array.isArray(raw)) {
    return raw.map((item, idx) => `${idx + 1}º ${item}`).join(' → ')
  }

  if (Array.isArray(raw)) {
    const mapped = raw.map(v =>
      v === '__other__' ? `Outro (${answers[`${field.id}__other`] || ''})` : v
    )
    return mapped.join(', ')
  }

  if (raw === '__other__') {
    return `Outro: ${answers[`${field.id}__other`] || ''}`
  }

  if (field.type === 'assinatura_digital' && String(raw).startsWith('data:image')) {
    return '[Assinatura Digital Capturada]'
  }

  if (field.type === 'numero_moeda') {
    if (field.numberFormat === 'moeda_brl') {
      return Number(raw).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    }
    if (field.numberFormat === 'percentual') {
      return `${raw}%`
    }
  }

  return String(raw)
}

export function FormAnalyticsDashboard({
  form,
  responses,
  colaboradoresList,
  onAddManualResponse,
  onEditResponse,
  onDeleteResponse,
  onBulkImportSuccess,
}: FormAnalyticsDashboardProps) {
  const [activeSubTab, setActiveSubTab] = useState<
    'resumo' | 'pergunta' | 'individual' | 'planilha' | 'adesao'
  >('resumo')

  // Chart visualization mode per field: 'bars' | 'vertical' | 'pie'
  const [chartTypeMap, setChartTypeMap] = useState<
    Record<string, 'bars' | 'vertical' | 'pie'>
  >({})

  // Question tab state
  const allInteractiveFields = useMemo(() => {
    const list: FormField[] = []
    for (const sec of form.sections || []) {
      for (const f of sec.fields || []) {
        if (f.type !== 'bloco_informativo' && f.type !== 'bloco_imagem') list.push(f)
      }
    }
    return list
  }, [form.sections])

  const [selectedQuestionIdx, setSelectedQuestionIdx] = useState(0)
  const [textFilterMap, setTextFilterMap] = useState<Record<string, string>>({})

  // Individual tab state
  const [individualIdx, setIndividualIdx] = useState(0)
  const [individualSearch, setIndividualSearch] = useState('')

  // Spreadsheet tab state
  const [sheetSearch, setSheetSearch] = useState('')
  const [sheetSourceFilter, setSheetSourceFilter] = useState('all')
  const [sheetRoleFilter, setSheetRoleFilter] = useState('all')

  // Adhesion tab state
  const [adesaoSearch, setAdesaoSearch] = useState('')
  const [copiedPendentes, setCopiedPendentes] = useState(false)

  // File input for Excel/CSV import
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [importing, setImporting] = useState(false)

  const primaryColor = form.theme?.primaryColor || '#4f46e5'

  // ---------------------------------------------------------------------------
  // SUMMARY KPIS
  // ---------------------------------------------------------------------------
  const kpis = useMemo(() => {
    const total = responses.length
    const totalColabs = colaboradoresList.length || 1
    const uniqueRespondents = new Set(
      responses.map(r => (r.respondentEmail || r.respondentName || r.id).toLowerCase().trim())
    ).size
    const adesaoPercent =
      colaboradoresList.length > 0
        ? Math.min(100, Math.round((uniqueRespondents / totalColabs) * 100))
        : 0

    const manualCount = responses.filter(r => r.source !== 'colaborador_logado').length
    const loggedCount = total - manualCount

    // Calculate overall eNPS if any NPS field exists
    const npsField = allInteractiveFields.find(f => f.type === 'nps')
    let npsScore: number | null = null
    if (npsField && total > 0) {
      const vals = responses
        .map(r => Number(r.answers?.[npsField.id]))
        .filter(n => !isNaN(n))
      if (vals.length > 0) {
        const promoters = vals.filter(n => n >= 9).length
        const detractors = vals.filter(n => n <= 6).length
        npsScore = Math.round(((promoters - detractors) / vals.length) * 100)
      }
    }

    const avgSeconds = (() => {
      const times = responses
        .map(r => Number(r.completionTimeSeconds || 0))
        .filter(t => t > 0 && t < 7200)
      if (times.length === 0) return null
      return Math.round(times.reduce((a, b) => a + b, 0) / times.length)
    })()

    return {
      total,
      uniqueRespondents,
      adesaoPercent,
      manualCount,
      loggedCount,
      npsScore,
      avgSeconds,
    }
  }, [responses, colaboradoresList, allInteractiveFields])

  // ---------------------------------------------------------------------------
  // ADHESION CROSS-CHECK (QUEM RESPONDEU VS QUEM FALTA)
  // ---------------------------------------------------------------------------
  const adesaoData = useMemo(() => {
    const respondedEmails = new Set(
      responses
        .map(r => String(r.respondentEmail || '').trim().toLowerCase())
        .filter(Boolean)
    )
    const respondedNames = new Set(
      responses
        .map(r => String(r.respondentName || '').trim().toLowerCase())
        .filter(Boolean)
    )
    const respondedIds = new Set(
      responses.map(r => String(r.respondentId || '').trim()).filter(Boolean)
    )

    const responderam: ColaboradorItem[] = []
    const pendentes: ColaboradorItem[] = []

    for (const colab of colaboradoresList) {
      const cEmail = String(colab.email || '').trim().toLowerCase()
      const cName = String(colab.nome || '').trim().toLowerCase()
      const hasAnswered =
        respondedIds.has(colab.id) ||
        (cEmail && respondedEmails.has(cEmail)) ||
        (cName && respondedNames.has(cName))

      if (hasAnswered) {
        responderam.push(colab)
      } else {
        pendentes.push(colab)
      }
    }

    return { responderam, pendentes }
  }, [responses, colaboradoresList])

  // ---------------------------------------------------------------------------
  // EXPORT TO EXCEL (.XLSX) & CSV
  // ---------------------------------------------------------------------------
  const handleExportExcel = () => {
    const rows = responses.map(r => {
      const base: Record<string, any> = {
        Protocolo: r.protocol,
        'Data e Hora': new Date(r.submittedAt).toLocaleString('pt-BR'),
        Colaborador: form.settings?.confidentialMode ? 'Confidencial' : r.respondentName,
        'E-mail': form.settings?.confidentialMode ? '—' : r.respondentEmail || '',
        Cargo: r.respondentRole || '',
        'Setor / Departamento': r.respondentDepartment || '',
        Origem:
          r.source === 'colaborador_logado'
            ? 'Colaborador Logado'
            : r.source === 'link_publico'
            ? 'Link Público'
            : r.source === 'inserido_pelo_gestor'
            ? `Lançado pelo Gestor (${r.insertedByAdminName || 'RH'})`
            : 'Importado via Planilha',
        'Observação RH': r.adminNotes || '',
      }
      if (form.settings?.isQuizMode && r.quizScore) {
        base['Nota Quiz (%)'] = `${r.quizScore.percent}% (${r.quizScore.earned}/${r.quizScore.total})`
      }
      for (const f of allInteractiveFields) {
        base[f.title] = formatAnswerValue(f, r.answers)
      }
      return base
    })

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Aviso: 'Sem respostas' }])
    XLSX.utils.book_append_sheet(wb, ws, 'Respostas')

    // Sheet 2: Adhesion summary
    if (colaboradoresList.length > 0) {
      const adesaoRows = [
        ...adesaoData.responderam.map(c => ({
          Colaborador: c.nome,
          Cargo: c.cargo || '',
          Departamento: c.departamento || '',
          Email: c.email || '',
          Status: 'JÁ RESPONDEU',
        })),
        ...adesaoData.pendentes.map(c => ({
          Colaborador: c.nome,
          Cargo: c.cargo || '',
          Departamento: c.departamento || '',
          Email: c.email || '',
          Status: 'PENDENTE',
        })),
      ]
      const wsAdesao = XLSX.utils.json_to_sheet(adesaoRows)
      XLSX.utils.book_append_sheet(wb, wsAdesao, 'Controle de Adesao RH')
    }

    const safeTitle = form.title
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40)
    XLSX.writeFile(wb, `Relatorio_${safeTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const handleExportCSV = () => {
    const headers = [
      'Protocolo',
      'Data e Hora',
      'Colaborador',
      'Cargo',
      'Setor',
      'Origem',
      ...allInteractiveFields.map(f => f.title),
    ]
    const csvRows = responses.map(r => {
      const cols = [
        r.protocol,
        new Date(r.submittedAt).toLocaleString('pt-BR'),
        form.settings?.confidentialMode ? 'Confidencial' : r.respondentName,
        r.respondentRole || '',
        r.respondentDepartment || '',
        r.source === 'colaborador_logado' ? 'Colaborador Logado' : 'Lançado pelo Gestor',
        ...allInteractiveFields.map(f => formatAnswerValue(f, r.answers)),
      ]
      return cols.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')
    })

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.map(h => `"${h.replace(/"/g, '""')}"`).join(';'), ...csvRows].join('\n')
    const link = document.createElement('a')
    link.href = encodeURI(csvContent)
    link.download = `Respostas_${form.id}_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // ---------------------------------------------------------------------------
  // IMPORT FROM EXCEL / CSV
  // ---------------------------------------------------------------------------
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const firstSheet = wb.Sheets[wb.SheetNames[0]]
      const jsonRows: Record<string, any>[] = XLSX.utils.sheet_to_json(firstSheet)

      if (!jsonRows.length) {
        alert('A planilha selecionada está vazia.')
        setImporting(false)
        return
      }

      const bulkRows = jsonRows.map(row => {
        const mappedAnswers: Record<string, any> = {}
        for (const f of allInteractiveFields) {
          const matchingKey = Object.keys(row).find(
            k => k.trim().toLowerCase() === f.title.trim().toLowerCase()
          )
          if (matchingKey !== undefined && row[matchingKey] !== undefined) {
            const cellVal = row[matchingKey]
            if (f.type === 'caixas_selecao') {
              mappedAnswers[f.id] = String(cellVal)
                .split(',')
                .map(s => s.trim())
                .filter(Boolean)
            } else {
              mappedAnswers[f.id] = cellVal
            }
          }
        }
        return {
          respondentName:
            row['Colaborador'] ||
            row['Nome'] ||
            row['Respondente'] ||
            'Colaborador Importado',
          respondentEmail: row['E-mail'] || row['Email'] || '',
          respondentRole: row['Cargo'] || row['Função'] || 'Colaborador',
          respondentDepartment: row['Setor'] || row['Setor / Departamento'] || row['Departamento'] || '',
          answers: mappedAnswers,
        }
      })

      const res = await fetch(`/api/gestao-pessoas/formularios/${form.id}/respostas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'bulk_import',
          bulkRows,
        }),
      })
      const data = await res.json()
      if (res.ok && Array.isArray(data.responses)) {
        onBulkImportSuccess(data.responses)
      } else {
        alert(data.error || 'Erro ao importar planilha.')
      }
    } catch (err: any) {
      alert('Falha ao ler arquivo: ' + (err?.message || 'Formato inválido'))
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ---------------------------------------------------------------------------
  // RENDER FIELD ANALYTICS CARD (IN SUMMARY TAB)
  // ---------------------------------------------------------------------------
  const renderFieldAnalyticsCard = (field: FormField, qIndex: number) => {
    const chartMode = chartTypeMap[field.id] || 'bars'

    // 1. Choice / Mood / Sim-Nao / Dropdown
    if (
      field.type === 'multipla_escolha' ||
      field.type === 'caixas_selecao' ||
      field.type === 'lista_suspensa' ||
      field.type === 'sim_nao' ||
      field.type === 'termometro_humor'
    ) {
      const counts: Record<string, number> = {}
      const baseOptions =
        field.type === 'sim_nao'
          ? ['Sim', 'Não']
          : field.type === 'termometro_humor'
          ? ['Muito Insatisfeito', 'Insatisfeito', 'Neutro / Regular', 'Satisfeito', 'Excelente / Encantado']
          : field.options || []

      for (const opt of baseOptions) counts[opt] = 0
      if (field.allowOther) counts['Outro'] = 0

      let validRespondents = 0
      for (const r of responses) {
        const v = r.answers?.[field.id]
        if (v === undefined || v === null || v === '') continue
        validRespondents++
        if (Array.isArray(v)) {
          for (const item of v) {
            const label = item === '__other__' ? 'Outro' : String(item)
            counts[label] = (counts[label] || 0) + 1
          }
        } else {
          const label = v === '__other__' ? 'Outro' : String(v)
          counts[label] = (counts[label] || 0) + 1
        }
      }

      const dataPoints = Object.entries(counts).map(([name, value]) => ({
        name,
        value,
        percent: validRespondents > 0 ? Math.round((value / validRespondents) * 100) : 0,
      }))

      return (
        <div
          key={field.id}
          style={{
            background: '#ffffff',
            borderRadius: 20,
            border: '1px solid #e2e8f0',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 800, color: primaryColor }}>
                QUESTÃO {qIndex + 1} • {validRespondents} respostas
              </span>
              <h4 style={{ margin: '4px 0 0', fontSize: 16.5, fontWeight: 800, color: '#0f172a' }}>
                {field.title}
              </h4>
            </div>

            <div style={{ display: 'flex', background: '#f1f5f9', padding: 3, borderRadius: 10, gap: 2 }}>
              {[
                { id: 'bars', label: 'Barras' },
                { id: 'vertical', label: 'Colunas' },
                { id: 'pie', label: 'Pizza' },
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() =>
                    setChartTypeMap(prev => ({ ...prev, [field.id]: t.id as any }))
                  }
                  style={{
                    padding: '5px 10px',
                    borderRadius: 7,
                    border: 'none',
                    background: chartMode === t.id ? '#ffffff' : 'transparent',
                    color: chartMode === t.id ? '#0f172a' : '#64748b',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {chartMode === 'bars' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dataPoints.map((dp, idx) => (
                <div key={dp.name} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, fontWeight: 600, color: '#1e293b' }}>
                    <span>{dp.name}</span>
                    <span>
                      <strong>{dp.value}</strong> ({dp.percent}%)
                    </span>
                  </div>
                  <div style={{ height: 10, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${dp.percent}%`,
                        height: '100%',
                        background: CHART_COLORS[idx % CHART_COLORS.length],
                        borderRadius: 99,
                        transition: 'width 0.3s',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {chartMode === 'vertical' && (
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataPoints}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Respostas" fill={primaryColor} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {chartMode === 'pie' && (
            <div style={{ width: '100%', height: 250, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 240px', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dataPoints.filter(d => d.value > 0)}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={3}
                    >
                      {dataPoints
                        .filter(d => d.value > 0)
                        .map((_, idx) => (
                          <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {dataPoints.map((dp, idx) => (
                  <div key={dp.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: CHART_COLORS[idx % CHART_COLORS.length],
                      }}
                    />
                    <span style={{ flex: 1, color: '#334155', fontWeight: 600 }}>{dp.name}</span>
                    <span style={{ fontWeight: 800, color: '#0f172a' }}>
                      {dp.value} ({dp.percent}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    }

    // 2. Scale / Stars / NPS / Numeric
    if (
      field.type === 'escala_linear' ||
      field.type === 'nps' ||
      field.type === 'avaliacao_estrelas' ||
      field.type === 'numero_moeda'
    ) {
      const nums = responses
        .map(r => r.answers?.[field.id])
        .filter(v => v !== undefined && v !== null && String(v).trim() !== '' && !isNaN(Number(v)))
        .map(v => Number(v))
      const count = nums.length
      const sum = nums.reduce((a, b) => a + b, 0)
      const avg = count > 0 ? (sum / count).toFixed(2) : '0.00'
      const sorted = [...nums].sort((a, b) => a - b)
      const min = count > 0 ? sorted[0] : 0
      const max = count > 0 ? sorted[sorted.length - 1] : 0
      const median =
        count > 0
          ? count % 2 === 1
            ? sorted[Math.floor(count / 2)]
            : Number(((sorted[count / 2 - 1] + sorted[count / 2]) / 2).toFixed(1))
          : 0

      // Frequency distribution
      const freqMap: Record<string, number> = {}
      if (field.type === 'nps') {
        for (let i = 0; i <= 10; i++) freqMap[String(i)] = 0
      } else if (field.type === 'avaliacao_estrelas') {
        for (let i = 1; i <= (field.starCount || 5); i++) freqMap[String(i)] = 0
      } else if (field.type === 'escala_linear') {
        for (let i = field.scaleMin ?? 1; i <= (field.scaleMax ?? 5); i++) {
          freqMap[String(i)] = 0
        }
      }
      for (const n of nums) {
        freqMap[String(n)] = (freqMap[String(n)] || 0) + 1
      }
      const distData = Object.entries(freqMap).map(([label, value]) => ({
        name: label,
        value,
      }))

      // NPS Specific Breakdown
      let npsStats = null
      if (field.type === 'nps' && count > 0) {
        const promoters = nums.filter(n => n >= 9).length
        const passives = nums.filter(n => n === 7 || n === 8).length
        const detractors = nums.filter(n => n <= 6).length
        const score = Math.round(((promoters - detractors) / count) * 100)
        const zone =
          score >= 75
            ? { label: 'Zona de Excelência', color: '#059669', bg: '#ecfdf5' }
            : score >= 50
            ? { label: 'Zona de Qualidade', color: '#10b981', bg: '#f0fdf4' }
            : score >= 0
            ? { label: 'Zona de Aperfeiçoamento', color: '#d97706', bg: '#fffbeb' }
            : { label: 'Zona Crítica', color: '#dc2626', bg: '#fef2f2' }
        npsStats = { promoters, passives, detractors, score, zone }
      }

      return (
        <div
          key={field.id}
          style={{
            background: '#ffffff',
            borderRadius: 20,
            border: '1px solid #e2e8f0',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <div>
            <span style={{ fontSize: 12, fontWeight: 800, color: primaryColor }}>
              QUESTÃO {qIndex + 1} • {count} avaliações numéricas
            </span>
            <h4 style={{ margin: '4px 0 0', fontSize: 16.5, fontWeight: 800, color: '#0f172a' }}>
              {field.title}
            </h4>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: 12,
            }}
          >
            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 14, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>MÉDIA GERAL</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: primaryColor, marginTop: 2 }}>
                {avg}
              </div>
            </div>
            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 14, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>MEDIANA</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>
                {median}
              </div>
            </div>
            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 14, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>MÍNIMO / MÁXIMO</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#334155', marginTop: 4 }}>
                {min} — {max}
              </div>
            </div>

            {npsStats && (
              <div
                style={{
                  background: npsStats.zone.bg,
                  padding: 14,
                  borderRadius: 14,
                  border: `1px solid ${npsStats.zone.color}40`,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: npsStats.zone.color }}>
                  SCORE eNPS ({npsStats.zone.label})
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: npsStats.zone.color, marginTop: 2 }}>
                  {npsStats.score > 0 ? `+${npsStats.score}` : npsStats.score}
                </div>
              </div>
            )}
          </div>

          {distData.length > 0 && distData.length <= 15 && (
            <div style={{ width: '100%', height: 190 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distData}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Quantidade" fill={primaryColor} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )
    }

    // 3. Matrix Grid Heatmap (grade_multipla / grade_caixas)
    if (field.type === 'grade_multipla' || field.type === 'grade_caixas') {
      const rows = field.gridRows || []
      const cols = field.gridCols || []

      return (
        <div
          key={field.id}
          style={{
            background: '#ffffff',
            borderRadius: 20,
            border: '1px solid #e2e8f0',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div>
            <span style={{ fontSize: 12, fontWeight: 800, color: primaryColor }}>
              QUESTÃO {qIndex + 1} • MATRIZ DE CALOR (HEATMAP)
            </span>
            <h4 style={{ margin: '4px 0 0', fontSize: 16.5, fontWeight: 800, color: '#0f172a' }}>
              {field.title}
            </h4>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: 14, border: '1px solid #e2e8f0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ textAlign: 'left', padding: '12px 14px', color: '#334155' }}>
                    Item Avaliado
                  </th>
                  {cols.map(c => (
                    <th key={c} style={{ textAlign: 'center', padding: '12px 10px', color: '#334155' }}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(rLabel => {
                  const rowCounts: Record<string, number> = {}
                  let rowTotal = 0
                  for (const c of cols) rowCounts[c] = 0

                  for (const resp of responses) {
                    const gridVal = resp.answers?.[field.id]?.[rLabel]
                    if (!gridVal) continue
                    if (Array.isArray(gridVal)) {
                      rowTotal++
                      for (const item of gridVal) {
                        rowCounts[item] = (rowCounts[item] || 0) + 1
                      }
                    } else {
                      rowTotal++
                      rowCounts[gridVal] = (rowCounts[gridVal] || 0) + 1
                    }
                  }

                  return (
                    <tr key={rLabel} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#1e293b' }}>
                        {rLabel}
                      </td>
                      {cols.map(c => {
                        const cnt = rowCounts[c] || 0
                        const pct = rowTotal > 0 ? Math.round((cnt / rowTotal) * 100) : 0
                        const alpha = pct > 0 ? Math.max(0.1, pct / 100) : 0
                        return (
                          <td
                            key={c}
                            style={{
                              textAlign: 'center',
                              padding: '10px',
                              background:
                                cnt > 0 ? `rgba(79, 70, 229, ${alpha * 0.28})` : 'transparent',
                              fontWeight: cnt > 0 ? 800 : 500,
                              color: cnt > 0 ? '#1e1b4b' : '#94a3b8',
                            }}
                          >
                            {cnt} <span style={{ fontSize: 11 }}>({pct}%)</span>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    // 4. Ranking Podium
    if (field.type === 'ranking') {
      const options = field.options || []
      const rankScores: Record<string, { sumPos: number; count: number; firstPlaceCount: number }> = {}
      for (const opt of options) {
        rankScores[opt] = { sumPos: 0, count: 0, firstPlaceCount: 0 }
      }

      for (const resp of responses) {
        const arr = resp.answers?.[field.id]
        if (!Array.isArray(arr)) continue
        arr.forEach((item: string, idx: number) => {
          if (!rankScores[item]) {
            rankScores[item] = { sumPos: 0, count: 0, firstPlaceCount: 0 }
          }
          rankScores[item].sumPos += idx + 1
          rankScores[item].count += 1
          if (idx === 0) rankScores[item].firstPlaceCount += 1
        })
      }

      const sortedRanking = Object.entries(rankScores)
        .map(([item, st]) => ({
          item,
          avgPosition: st.count > 0 ? st.sumPos / st.count : 99,
          firstPlaceCount: st.firstPlaceCount,
          count: st.count,
        }))
        .sort((a, b) => a.avgPosition - b.avgPosition)

      return (
        <div
          key={field.id}
          style={{
            background: '#ffffff',
            borderRadius: 20,
            border: '1px solid #e2e8f0',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div>
            <span style={{ fontSize: 12, fontWeight: 800, color: primaryColor }}>
              QUESTÃO {qIndex + 1} • RANKING DE PRIORIDADE DA EQUIPE
            </span>
            <h4 style={{ margin: '4px 0 0', fontSize: 16.5, fontWeight: 800, color: '#0f172a' }}>
              {field.title}
            </h4>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sortedRanking.map((r, idx) => (
              <div
                key={r.item}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderRadius: 14,
                  background: idx === 0 ? '#eef2ff' : '#f8fafc',
                  border: idx === 0 ? `1.5px solid ${primaryColor}` : '1px solid #e2e8f0',
                }}
              >
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: idx === 0 ? primaryColor : '#cbd5e1',
                    color: idx === 0 ? '#ffffff' : '#1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: 13,
                  }}
                >
                  {idx + 1}º
                </span>
                <span style={{ flex: 1, fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
                  {r.item}
                </span>
                <span style={{ fontSize: 12.5, color: '#475569', fontWeight: 600 }}>
                  {r.firstPlaceCount}x em 1º lugar • Posição média:{' '}
                  <strong>{r.count > 0 ? r.avgPosition.toFixed(1) : '—'}º</strong>
                </span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    // 5. Open Text / Date / Time / Signature
    const textEntries = responses
      .map(r => ({
        id: r.id,
        respondent: form.settings?.confidentialMode ? 'Colaborador Confidencial' : r.respondentName,
        role: r.respondentRole || '',
        date: r.submittedAt,
        value: r.answers?.[field.id],
      }))
      .filter(item => item.value !== undefined && item.value !== null && String(item.value).trim() !== '')

    // Extract top keywords for text fields
    const wordFreq: [string, number][] = (() => {
      if (field.type !== 'texto_curto' && field.type !== 'paragrafo' && field.type !== 'usuario_logado') return []
      const stopWords = new Set([
        'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos', 'para', 'por',
        'com', 'sem', 'que', 'um', 'uma', 'os', 'as', 'ao', 'aos', 'mais', 'muito',
        'como', 'mas', 'ou', 'se', 'foi', 'ser', 'ter', 'está', 'estão', 'meu', 'minha',
        'nosso', 'nossa', 'sobre', 'pelo', 'pela', 'isso', 'este', 'esta', 'não', 'sim',
      ])
      const map: Record<string, number> = {}
      for (const entry of textEntries) {
        const words = String(entry.value)
          .toLowerCase()
          .replace(/[^\p{L}\s]/gu, ' ')
          .split(/\s+/)
          .filter(w => w.length >= 4 && !stopWords.has(w))
        for (const w of words) {
          map[w] = (map[w] || 0) + 1
        }
      }
      return Object.entries(map)
        .filter(([, cnt]) => cnt >= 1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
    })()

    const qFilter = (textFilterMap[field.id] || '').toLowerCase()
    const filteredTextEntries = qFilter
      ? textEntries.filter(
          t =>
            String(t.value).toLowerCase().includes(qFilter) ||
            t.respondent.toLowerCase().includes(qFilter)
        )
      : textEntries

    return (
      <div
        key={field.id}
        style={{
          background: '#ffffff',
          borderRadius: 20,
          border: '1px solid #e2e8f0',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <span style={{ fontSize: 12, fontWeight: 800, color: primaryColor }}>
              QUESTÃO {qIndex + 1} • {textEntries.length} respostas registradas
            </span>
            <h4 style={{ margin: '4px 0 0', fontSize: 16.5, fontWeight: 800, color: '#0f172a' }}>
              {field.title}
            </h4>
          </div>

          {textEntries.length > 3 && (
            <input
              type="text"
              placeholder="Filtrar respostas..."
              value={textFilterMap[field.id] || ''}
              onChange={e =>
                setTextFilterMap(prev => ({ ...prev, [field.id]: e.target.value }))
              }
              style={{
                padding: '7px 12px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                fontSize: 13,
              }}
            />
          )}
        </div>

        {wordFreq.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b' }}>
              Termos mais citados:
            </span>
            {wordFreq.map(([word, cnt]) => (
              <button
                key={word}
                type="button"
                onClick={() =>
                  setTextFilterMap(prev => ({
                    ...prev,
                    [field.id]: prev[field.id] === word ? '' : word,
                  }))
                }
                style={{
                  padding: '3px 10px',
                  borderRadius: 99,
                  border: '1px solid #cbd5e1',
                  background: textFilterMap[field.id] === word ? primaryColor : '#f8fafc',
                  color: textFilterMap[field.id] === word ? '#ffffff' : '#334155',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {word} ({cnt})
              </button>
            ))}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {filteredTextEntries.length === 0 ? (
            <div style={{ padding: 16, color: '#94a3b8', fontSize: 13.5, fontStyle: 'italic' }}>
              Nenhuma resposta encontrada para este campo.
            </div>
          ) : (
            filteredTextEntries.map(entry => (
              <div
                key={entry.id}
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                {field.type === 'assinatura_digital' &&
                String(entry.value).startsWith('data:image') ? (
                  <img
                    src={String(entry.value)}
                    alt="Assinatura"
                    style={{ maxHeight: 70, objectFit: 'contain', alignSelf: 'flex-start' }}
                  />
                ) : (
                  <div style={{ fontSize: 14, color: '#0f172a', lineHeight: 1.5 }}>
                    {String(entry.value)}
                  </div>
                )}
                <div style={{ fontSize: 11.5, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                  <span>
                    <strong>{entry.respondent}</strong> {entry.role ? `• ${entry.role}` : ''}
                  </span>
                  <span>{new Date(entry.date).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  // Filtered responses for Spreadsheet and Individual tabs
  const filteredSheetResponses = useMemo(() => {
    return responses.filter(r => {
      if (sheetSourceFilter !== 'all' && r.source !== sheetSourceFilter) return false
      if (sheetRoleFilter !== 'all' && r.respondentRole !== sheetRoleFilter) return false
      if (sheetSearch.trim()) {
        const q = sheetSearch.toLowerCase()
        const inMeta =
          r.respondentName?.toLowerCase().includes(q) ||
          r.respondentRole?.toLowerCase().includes(q) ||
          r.respondentDepartment?.toLowerCase().includes(q) ||
          r.protocol?.toLowerCase().includes(q)
        const inAnswers = allInteractiveFields.some(f =>
          formatAnswerValue(f, r.answers).toLowerCase().includes(q)
        )
        return inMeta || inAnswers
      }
      return true
    })
  }, [responses, sheetSourceFilter, sheetRoleFilter, sheetSearch, allInteractiveFields])

  const uniqueRoles = useMemo(() => {
    const s = new Set<string>()
    for (const r of responses) {
      if (r.respondentRole) s.add(r.respondentRole)
    }
    return Array.from(s)
  }, [responses])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* TOP TOOLBAR: ADD MANUAL RESPONSE, IMPORT, EXPORT */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 20,
          border: '1px solid #e2e8f0',
          padding: '18px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 14,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
            Central de Respostas e Inteligência de Dados
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: 13.5, color: '#64748b' }}>
            Acompanhe estatísticas em tempo real, filtre por colaborador, adicione respostas manuais ou exporte planilhas.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileImport}
            style={{ display: 'none' }}
          />

          <button
            type="button"
            onClick={() => onAddManualResponse()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              borderRadius: 12,
              border: 'none',
              background: '#059669',
              color: '#ffffff',
              fontSize: 13.5,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)',
            }}
          >
            <UserPlus size={17} /> + Adicionar Resposta Manual
          </button>

          <button
            type="button"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '10px 16px',
              borderRadius: 12,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Upload size={16} />
            {importing ? 'Importando...' : 'Importar Planilha'}
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '10px 16px',
              borderRadius: 12,
              border: '1px solid #a7f3d0',
              background: '#ecfdf5',
              color: '#065f46',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            <FileSpreadsheet size={16} /> Exportar Excel (.xlsx)
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: '#475569',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Download size={16} /> CSV
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: '#475569',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Printer size={16} /> Imprimir
          </button>
        </div>
      </div>

      {/* KPI SUMMARY CARDS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
        }}
      >
        <div
          style={{
            background: '#ffffff',
            padding: 20,
            borderRadius: 18,
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>TOTAL DE RESPOSTAS</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', marginTop: 4 }}>
            {kpis.total}
          </div>
          <div style={{ fontSize: 12, color: '#10b981', fontWeight: 600, marginTop: 4 }}>
            {kpis.uniqueRespondents} colaboradores distintos
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            padding: 20,
            borderRadius: 18,
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>TAXA DE ADESÃO RH</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: primaryColor, marginTop: 4 }}>
            {kpis.adesaoPercent}%
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            {adesaoData.responderam.length} de {colaboradoresList.length} colaboradores ativos
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            padding: 20,
            borderRadius: 18,
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>ORIGEM DOS REGISTROS</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', marginTop: 8 }}>
            {kpis.loggedCount} Login • {kpis.manualCount} Gestor
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
            Autenticados no sistema vs Lançamento manual
          </div>
        </div>

        {kpis.npsScore !== null ? (
          <div
            style={{
              background: '#ffffff',
              padding: 20,
              borderRadius: 18,
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>ÍNDICE eNPS</div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 900,
                color: kpis.npsScore >= 50 ? '#10b981' : kpis.npsScore >= 0 ? '#f59e0b' : '#ef4444',
                marginTop: 4,
              }}
            >
              {kpis.npsScore > 0 ? `+${kpis.npsScore}` : kpis.npsScore}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
              Escala de -100 a +100
            </div>
          </div>
        ) : (
          <div
            style={{
              background: '#ffffff',
              padding: 20,
              borderRadius: 18,
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>TEMPO MÉDIO</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', marginTop: 4 }}>
              {kpis.avgSeconds
                ? kpis.avgSeconds >= 60
                  ? `${Math.floor(kpis.avgSeconds / 60)}m ${kpis.avgSeconds % 60}s`
                  : `${kpis.avgSeconds}s`
                : '—'}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
              Tempo médio de resposta
            </div>
          </div>
        )}
      </div>

      {/* SUB-TABS NAVIGATION (SUPERIOR TO GOOGLE FORMS) */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          background: '#ffffff',
          padding: 8,
          borderRadius: 16,
          border: '1px solid #e2e8f0',
          overflowX: 'auto',
        }}
      >
        {[
          { id: 'resumo', label: '📊 Resumo & Gráficos' },
          { id: 'pergunta', label: '❓ Por Pergunta' },
          { id: 'individual', label: `👤 Individual (${responses.length})` },
          { id: 'planilha', label: '📋 Planilha de Dados' },
          {
            id: 'adesao',
            label: `👥 Controle de Adesão (${adesaoData.pendentes.length} pendentes)`,
          },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSubTab(tab.id as any)}
            style={{
              padding: '10px 18px',
              borderRadius: 12,
              border: 'none',
              background: activeSubTab === tab.id ? primaryColor : 'transparent',
              color: activeSubTab === tab.id ? '#ffffff' : '#475569',
              fontSize: 13.5,
              fontWeight: 800,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===================================================================== */}
      {/* SUB-TAB 1: RESUMO & GRÁFICOS                                          */}
      {/* ===================================================================== */}
      {activeSubTab === 'resumo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {responses.length === 0 ? (
            <div
              style={{
                background: '#ffffff',
                borderRadius: 24,
                padding: 48,
                textAlign: 'center',
                border: '1px dashed #cbd5e1',
              }}
            >
              <BarChart3 size={44} color="#94a3b8" style={{ marginBottom: 12 }} />
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                Ainda não há respostas registradas
              </h3>
              <p style={{ margin: '8px auto 20px', maxWidth: 460, fontSize: 14, color: '#64748b' }}>
                Compartilhe o link com os colaboradores ou clique no botão abaixo para lançar a primeira resposta manualmente.
              </p>
              <button
                type="button"
                onClick={() => onAddManualResponse()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 22px',
                  borderRadius: 12,
                  border: 'none',
                  background: '#059669',
                  color: '#ffffff',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                <UserPlus size={18} /> Lançar Primeira Resposta Agora
              </button>
            </div>
          ) : (
            allInteractiveFields.map((field, idx) => renderFieldAnalyticsCard(field, idx))
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 2: POR PERGUNTA                                               */}
      {/* ===================================================================== */}
      {activeSubTab === 'pergunta' && allInteractiveFields.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              background: '#ffffff',
              padding: 18,
              borderRadius: 18,
              border: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <select
              aria-label="Selecionar pergunta para análise"
              value={selectedQuestionIdx}
              onChange={e => setSelectedQuestionIdx(Number(e.target.value))}
              style={{
                flex: 1,
                minWidth: 260,
                padding: '10px 14px',
                borderRadius: 12,
                border: '1px solid #cbd5e1',
                fontSize: 14,
                fontWeight: 700,
                color: '#0f172a',
              }}
            >
              {allInteractiveFields.map((f, idx) => (
                <option key={f.id} value={idx}>
                  {idx + 1}. {f.title}
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                disabled={selectedQuestionIdx === 0}
                onClick={() => setSelectedQuestionIdx(prev => Math.max(0, prev - 1))}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  cursor: selectedQuestionIdx === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                }}
              >
                ← Anterior
              </button>
              <button
                type="button"
                disabled={selectedQuestionIdx >= allInteractiveFields.length - 1}
                onClick={() =>
                  setSelectedQuestionIdx(prev =>
                    Math.min(allInteractiveFields.length - 1, prev + 1)
                  )
                }
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  cursor:
                    selectedQuestionIdx >= allInteractiveFields.length - 1
                      ? 'not-allowed'
                      : 'pointer',
                  fontWeight: 700,
                }}
              >
                Próxima →
              </button>
            </div>
          </div>

          {(() => {
            const field = allInteractiveFields[selectedQuestionIdx] || allInteractiveFields[0]
            return (
              <>
                {renderFieldAnalyticsCard(field, selectedQuestionIdx)}
                <div
                  style={{
                    background: '#ffffff',
                    borderRadius: 20,
                    border: '1px solid #e2e8f0',
                    padding: 24,
                  }}
                >
                  <h4 style={{ margin: '0 0 16px 0', fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                    Detalhamento Nominal por Colaborador nesta Questão
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {responses.map(r => (
                      <div
                        key={r.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 16px',
                          borderRadius: 12,
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          gap: 12,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                            {form.settings?.confidentialMode
                              ? `Respondente #${r.protocol}`
                              : r.respondentName}
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            {r.respondentRole || 'Colaborador'} •{' '}
                            {new Date(r.submittedAt).toLocaleString('pt-BR')}
                          </div>
                        </div>
                        <div
                          style={{
                            padding: '6px 14px',
                            borderRadius: 10,
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            fontSize: 13.5,
                            fontWeight: 700,
                            color: '#1e293b',
                          }}
                        >
                          {formatAnswerValue(field, r.answers)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )
          })()}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 3: INDIVIDUAL (FICHAS COMPLETAS)                              */}
      {/* ===================================================================== */}
      {activeSubTab === 'individual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {responses.length === 0 ? (
            <div style={{ background: '#fff', padding: 40, borderRadius: 20, textAlign: 'center', color: '#64748b' }}>
              Nenhuma ficha individual disponível ainda.
            </div>
          ) : (
            (() => {
              const safeIdx = Math.min(individualIdx, responses.length - 1)
              const currentResp = responses[safeIdx]
              return (
                <>
                  {/* Navigator */}
                  <div
                    style={{
                      background: '#ffffff',
                      padding: '14px 20px',
                      borderRadius: 18,
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                      <select
                        aria-label="Escolher resposta individual"
                        value={safeIdx}
                        onChange={e => setIndividualIdx(Number(e.target.value))}
                        style={{
                          padding: '9px 14px',
                          borderRadius: 10,
                          border: '1px solid #cbd5e1',
                          fontSize: 13.5,
                          fontWeight: 700,
                          minWidth: 260,
                        }}
                      >
                        {responses.map((r, i) => (
                          <option key={r.id} value={i}>
                            {i + 1} de {responses.length} —{' '}
                            {form.settings?.confidentialMode
                              ? `Protocolo #${r.protocol}`
                              : r.respondentName}{' '}
                            ({new Date(r.submittedAt).toLocaleDateString('pt-BR')})
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        disabled={safeIdx === 0}
                        onClick={() => setIndividualIdx(Math.max(0, safeIdx - 1))}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 10,
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          cursor: safeIdx === 0 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>
                        {safeIdx + 1} / {responses.length}
                      </span>
                      <button
                        type="button"
                        disabled={safeIdx >= responses.length - 1}
                        onClick={() =>
                          setIndividualIdx(Math.min(responses.length - 1, safeIdx + 1))
                        }
                        style={{
                          padding: '8px 12px',
                          borderRadius: 10,
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          cursor: safeIdx >= responses.length - 1 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => onEditResponse(currentResp)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '8px 14px',
                          borderRadius: 10,
                          border: '1px solid #cbd5e1',
                          background: '#f8fafc',
                          color: '#0f172a',
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <Edit3 size={15} /> Editar Resposta
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteResponse(currentResp.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '8px 14px',
                          borderRadius: 10,
                          border: '1px solid #fecaca',
                          background: '#fef2f2',
                          color: '#dc2626',
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={15} /> Excluir
                      </button>
                    </div>
                  </div>

                  {/* Ficha Card */}
                  <div
                    style={{
                      background: '#ffffff',
                      borderRadius: 22,
                      border: '1px solid #e2e8f0',
                      padding: 28,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 20,
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: 14,
                        padding: 18,
                        borderRadius: 16,
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>
                          COLABORADOR
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                          {form.settings?.confidentialMode
                            ? 'Anônimo / Confidencial'
                            : currentResp.respondentName}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                          {currentResp.respondentEmail || ''}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>
                          CARGO / SETOR
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginTop: 2 }}>
                          {currentResp.respondentRole || 'Colaborador'}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                          {currentResp.respondentDepartment || 'Geral'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>
                          ORIGEM DO REGISTRO
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: primaryColor, marginTop: 2 }}>
                          {currentResp.source === 'colaborador_logado'
                            ? '✓ Respondido via Login do Colaborador'
                            : `Lançado pelo Gestor (${currentResp.insertedByAdminName || 'RH'})`}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>
                          PROTOCOLO & DATA
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                          #{currentResp.protocol}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                          {new Date(currentResp.submittedAt).toLocaleString('pt-BR')}
                        </div>
                      </div>
                    </div>

                    {currentResp.adminNotes && (
                      <div
                        style={{
                          padding: '12px 16px',
                          borderRadius: 12,
                          background: '#fffbeb',
                          border: '1px solid #fde68a',
                          fontSize: 13,
                          color: '#92400e',
                        }}
                      >
                        <strong>Observação Interna do RH:</strong> {currentResp.adminNotes}
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {allInteractiveFields.map((f, idx) => {
                        const rawVal = currentResp.answers?.[f.id]
                        return (
                          <div
                            key={f.id}
                            style={{
                              padding: '16px 20px',
                              borderRadius: 14,
                              border: '1px solid #e2e8f0',
                              background: '#ffffff',
                            }}
                          >
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                              {idx + 1}. {f.title}
                            </div>
                            {f.type === 'assinatura_digital' &&
                            String(rawVal || '').startsWith('data:image') ? (
                              <img
                                src={String(rawVal)}
                                alt="Assinatura do colaborador"
                                style={{
                                  maxHeight: 90,
                                  border: '1px dashed #cbd5e1',
                                  borderRadius: 10,
                                  padding: 6,
                                }}
                              />
                            ) : (
                              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                                {formatAnswerValue(f, currentResp.answers)}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              )
            })()
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 4: PLANILHA DE DADOS AO VIVO                                  */}
      {/* ===================================================================== */}
      {activeSubTab === 'planilha' && (
        <div
          style={{
            background: '#ffffff',
            borderRadius: 20,
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: 18,
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flex: 1 }}>
              <div style={{ position: 'relative', minWidth: 240, flex: 1 }}>
                <Search
                  size={16}
                  color="#94a3b8"
                  style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="text"
                  placeholder="Buscar em qualquer coluna ou resposta..."
                  value={sheetSearch}
                  onChange={e => setSheetSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    fontSize: 13.5,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <select
                aria-label="Filtrar por origem"
                value={sheetSourceFilter}
                onChange={e => setSheetSourceFilter(e.target.value)}
                style={{
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <option value="all">Todas as origens</option>
                <option value="colaborador_logado">Colaborador Logado</option>
                <option value="inserido_pelo_gestor">Lançado pelo Gestor</option>
                <option value="importado_planilha">Importado via Planilha</option>
              </select>

              <select
                aria-label="Filtrar por cargo"
                value={sheetRoleFilter}
                onChange={e => setSheetRoleFilter(e.target.value)}
                style={{
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <option value="all">Todos os cargos</option>
                {uniqueRoles.map(role => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => onAddManualResponse()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 16px',
                borderRadius: 10,
                border: 'none',
                background: primaryColor,
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <Plus size={16} /> Nova Linha
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 14px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                    Data/Hora
                  </th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                    Colaborador
                  </th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                    Cargo
                  </th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                    Origem
                  </th>
                  {allInteractiveFields.map(f => (
                    <th
                      key={f.id}
                      style={{
                        padding: '12px 14px',
                        textAlign: 'left',
                        minWidth: 180,
                        maxWidth: 260,
                      }}
                    >
                      {f.title}
                    </th>
                  ))}
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredSheetResponses.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5 + allInteractiveFields.length}
                      style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}
                    >
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredSheetResponses.map((r, rIdx) => (
                    <tr
                      key={r.id}
                      style={{
                        background: rIdx % 2 === 0 ? '#ffffff' : '#f8fafc',
                        borderBottom: '1px solid #f1f5f9',
                      }}
                    >
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: '#64748b' }}>
                        {new Date(r.submittedAt).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {form.settings?.confidentialMode ? `Confidencial #${r.protocol}` : r.respondentName}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#475569', whiteSpace: 'nowrap' }}>
                        {r.respondentRole || '—'}
                      </td>
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 99,
                            fontSize: 11,
                            fontWeight: 700,
                            background:
                              r.source === 'colaborador_logado'
                                ? '#eef2ff'
                                : r.source === 'link_publico'
                                ? '#f1f5f9'
                                : '#ecfdf5',
                            color:
                              r.source === 'colaborador_logado'
                                ? '#4f46e5'
                                : r.source === 'link_publico'
                                ? '#475569'
                                : '#059669',
                          }}
                        >
                          {r.source === 'colaborador_logado'
                            ? 'Sistema'
                            : r.source === 'link_publico'
                            ? 'Público'
                            : 'Gestor'}
                        </span>
                      </td>
                      {allInteractiveFields.map(f => (
                        <td
                          key={f.id}
                          style={{
                            padding: '12px 14px',
                            color: '#1e293b',
                            maxWidth: 260,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={formatAnswerValue(f, r.answers)}
                        >
                          {formatAnswerValue(f, r.answers)}
                        </td>
                      ))}
                      <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => onEditResponse(r)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#4f46e5',
                            cursor: 'pointer',
                            marginRight: 8,
                            fontWeight: 700,
                          }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteResponse(r.id)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#dc2626',
                            cursor: 'pointer',
                            fontWeight: 700,
                          }}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 5: CONTROLE DE ADESÃO RH (QUEM RESPONDEU VS QUEM FALTA)       */}
      {/* ===================================================================== */}
      {activeSubTab === 'adesao' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              background: '#ffffff',
              padding: 18,
              borderRadius: 18,
              border: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <input
              type="text"
              placeholder="Buscar colaborador por nome ou cargo..."
              value={adesaoSearch}
              onChange={e => setAdesaoSearch(e.target.value)}
              style={{
                flex: 1,
                minWidth: 240,
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                fontSize: 13.5,
              }}
            />

            <button
              type="button"
              onClick={() => {
                const listText = adesaoData.pendentes
                  .map(c => `• ${c.nome} (${c.cargo || 'Colaborador'})`)
                  .join('\n')
                navigator.clipboard.writeText(listText)
                setCopiedPendentes(true)
                setTimeout(() => setCopiedPendentes(false), 2500)
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 12,
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#0f172a',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {copiedPendentes ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
              {copiedPendentes ? 'Lista Copiada!' : 'Copiar Lista de Pendentes'}
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 18,
            }}
          >
            {/* Coluna Pendentes */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: 20,
                border: '1px solid #fed7aa',
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#c2410c' }}>
                  ⏳ Pendentes de Resposta ({adesaoData.pendentes.length})
                </h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
                {adesaoData.pendentes
                  .filter(
                    c =>
                      !adesaoSearch ||
                      c.nome.toLowerCase().includes(adesaoSearch.toLowerCase()) ||
                      (c.cargo || '').toLowerCase().includes(adesaoSearch.toLowerCase())
                  )
                  .map(colab => (
                    <div
                      key={colab.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 14px',
                        borderRadius: 12,
                        background: '#fff7ed',
                        border: '1px solid #ffedd5',
                        gap: 8,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>
                          {colab.nome}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#64748b' }}>
                          {colab.cargo || 'Colaborador'} {colab.departamento ? `• ${colab.departamento}` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onAddManualResponse(colab)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 8,
                          border: 'none',
                          background: '#ea580c',
                          color: '#ffffff',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        + Lançar Resposta
                      </button>
                    </div>
                  ))}
              </div>
            </div>

            {/* Coluna Já Responderam */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: 20,
                border: '1px solid #a7f3d0',
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#047857' }}>
                ✅ Já Responderam ({adesaoData.responderam.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
                {adesaoData.responderam
                  .filter(
                    c =>
                      !adesaoSearch ||
                      c.nome.toLowerCase().includes(adesaoSearch.toLowerCase()) ||
                      (c.cargo || '').toLowerCase().includes(adesaoSearch.toLowerCase())
                  )
                  .map(colab => (
                    <div
                      key={colab.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 14px',
                        borderRadius: 12,
                        background: '#ecfdf5',
                        border: '1px solid #d1fae5',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#065f46' }}>
                          {colab.nome}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#047857' }}>
                          {colab.cargo || 'Colaborador'}
                        </div>
                      </div>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: 99,
                          background: '#10b981',
                          color: '#ffffff',
                          fontSize: 11,
                          fontWeight: 800,
                        }}
                      >
                        Respondido ✓
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
