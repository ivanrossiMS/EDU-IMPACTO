'use client'
import { useState, useMemo } from 'react'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { HardDrive, Download, CheckCircle, RotateCcw, FileJson, FileSpreadsheet, Check } from 'lucide-react'
import * as XLSX from 'xlsx'

const CATEGORIES = [
  {
    id: 'academico',
    title: '🎓 Módulos Acadêmicos',
    color: '#3b82f6',
    items: [
      { id: 'alunos', label: 'Alunos', endpoint: 'alunos', sheetName: 'Alunos' },
      { id: 'turmas', label: 'Turmas', endpoint: 'turmas', sheetName: 'Turmas' },
      { id: 'ocorrencias', label: 'Ocorrências', endpoint: 'ocorrencias', sheetName: 'Ocorrências' },
      { id: 'frequencias', label: 'Frequências', endpoint: 'academico/frequencias', sheetName: 'Frequências' },
      { id: 'notas', label: 'Notas', endpoint: 'academico/notas', sheetName: 'Notas' }
    ]
  },
  {
    id: 'financeiro',
    title: '💰 Módulos Financeiros',
    color: '#10b981',
    items: [
      { id: 'titulos', label: 'Contas a Receber', endpoint: 'titulos', sheetName: 'Fin-Receber' },
      { id: 'contasPagar', label: 'Contas a Pagar', endpoint: 'contas-pagar', sheetName: 'Fin-Pagar' }
    ]
  },
  {
    id: 'rh',
    title: '👤 Recursos Humanos',
    color: '#f59e0b',
    items: [
      { id: 'funcionarios', label: 'Funcionários', endpoint: 'rh/funcionarios', sheetName: 'RH-Funcionários' },
      { id: 'adiantamentos', label: 'Adiantamentos', endpoint: 'rh/adiantamentos', sheetName: 'RH-Adiantamentos' },
      { id: 'advertencias', label: 'Advertências', endpoint: 'rh/advertencias', sheetName: 'RH-Advertências' },
      { id: 'ausencias', label: 'Ausências/Férias', endpoint: 'rh/ausencias', sheetName: 'RH-Ausências' }
    ]
  },
  {
    id: 'crm',
    title: '🎯 CRM & Captação',
    color: '#ec4899',
    items: [
      { id: 'leads', label: 'Leads', endpoint: 'leads', sheetName: 'CRM-Leads' }
    ]
  },
  {
    id: 'comunicacao',
    title: '📅 Agenda & Comunicação',
    color: '#8b5cf6',
    items: [
      { id: 'comunicados', label: 'Comunicados', endpoint: 'comunicados', sheetName: 'Comunicados' },
      { id: 'tarefas', label: 'Tarefas/Compromissos', endpoint: 'tarefas', sheetName: 'Tarefas' },
      { id: 'eventosAgenda', label: 'Eventos da Agenda', endpoint: 'agenda/eventos', sheetName: 'Agenda-Eventos' }
    ]
  },
  {
    id: 'saida',
    title: '🚨 Saída de Alunos & Segurança',
    color: '#06b6d4',
    items: [
      { id: 'guardians', label: 'Responsáveis', endpoint: 'saida/guardians', sheetName: 'Saída-Responsáveis' },
      { id: 'calls', label: 'Chamadas', endpoint: 'saida/calls', sheetName: 'Saída-Chamadas' },
      { id: 'saidaLogs', label: 'Histórico de Saídas', endpoint: 'saida/logs', sheetName: 'Saída-Histórico' }
    ]
  },
  {
    id: 'configuracoes',
    title: '⚙️ Configurações & Auditoria',
    color: '#64748b',
    items: [
      { id: 'mantenedores', label: 'Unidades/Mantenedores', endpoint: 'configuracoes/mantenedores', sheetName: 'Config-Unidades' },
      { id: 'systemLogs', label: 'Logs do Sistema', endpoint: 'system-logs', sheetName: 'Config-Auditoria' }
    ]
  }
];

export default function BackupSection() {
  const [downloading, setDownloading] = useState(false)
  const [lastBackup, setLastBackup] = useLocalStorage<string | null>('edu-last-backup-ts', null)
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('Iniciando...')
  const [activeTab, setActiveTab] = useState<'all' | 'academico' | 'financeiro' | 'rh' | 'crm' | 'comunicacao' | 'saida'>('all')

  const [autoFrequency, setAutoFrequency] = useLocalStorage<string>('edu-backup-frequency', 'Diário (meia-noite)')
  const [autoDestiny, setAutoDestiny] = useLocalStorage<string>('edu-backup-destiny', 'Google Drive')
  const [autoEmail, setAutoEmail] = useLocalStorage<string>('edu-backup-email', 'admin@impactoedu.com.br')
  const [autoSaved, setAutoSaved] = useState(false)

  const saveScheduling = () => {
    setAutoSaved(true)
    setTimeout(() => setAutoSaved(false), 2000)
  }

  const fetchTableData = async (endpoint: string) => {
    try {
      const res = await fetch(`/api/${endpoint}?limit=5000`)
      if (!res.ok) return []
      return await res.json()
    } catch {
      return []
    }
  }

  const doBackup = async (format: 'json' | 'xlsx') => {
    setDownloading(true)
    setProgress(0)
    setStatusText('Preparando...')
    
    const allItems = CATEGORIES.flatMap(cat => cat.items)
    const totalItems = allItems.length
    const payload: any = { tabelas: {} }
    let totalRecordsLoaded = 0

    for (let i = 0; i < totalItems; i++) {
      const item = allItems[i]
      setStatusText(`Baixando ${item.label}...`)
      const data = await fetchTableData(item.endpoint)
      
      payload.tabelas[item.sheetName] = {
        label: item.label,
        total: data.length,
        registros: data
      }
      totalRecordsLoaded += data.length
      setProgress(Math.round(((i + 1) / totalItems) * 100))
    }

    setStatusText('Processando arquivo final...')
    const ts = new Date()
    const dp = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}_${String(ts.getHours()).padStart(2, '0')}${String(ts.getMinutes()).padStart(2, '0')}`

    payload.exportadoEm = ts.toISOString()
    payload.versao = '3.0 (Enterprise)'
    payload.totalRegistros = totalRecordsLoaded

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `backup_completo_impacto_edu_${dp}.json`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      const sanitizeForExcel = (data: any[]) => {
        if (!Array.isArray(data)) return data
        return data.map(row => {
          if (!row || typeof row !== 'object') return row
          const cleanRow: any = {}
          Object.keys(row).forEach(key => {
            const val = row[key]
            if (typeof val === 'string' && val.length > 30000) {
              cleanRow[key] = `[Dado longo truncado - Use JSON]`
            } else if (val && typeof val === 'object') {
              cleanRow[key] = `[Objeto complexo - Use JSON]`
            } else {
              cleanRow[key] = val
            }
          })
          return cleanRow
        })
      }

      const wb = XLSX.utils.book_new()
      const resumoData = [
        { Propriedade: 'Sistema', Valor: 'IMPACTO EDU' },
        { Propriedade: 'Data de Exportação', Valor: ts.toLocaleString('pt-BR') },
        { Propriedade: 'Total de Registros', Valor: totalRecordsLoaded }
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoData), 'Resumo Backup')

      Object.entries(payload.tabelas).forEach(([sheetName, tb]: any) => {
        const sheetData = tb.registros.length > 0 ? sanitizeForExcel(tb.registros) : [{ info: 'Sem dados' }]
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetData), sheetName)
      })
      XLSX.writeFile(wb, `backup_completo_impacto_edu_${dp}.xlsx`)
    }

    setLastBackup(ts.toLocaleString('pt-BR'))
    setDownloading(false)
    setProgress(0)
  }

  const downloadSingleTable = async (item: any) => {
    setDownloading(true)
    setStatusText(`Baixando ${item.label}...`)
    setProgress(50)
    const data = await fetchTableData(item.endpoint)
    
    const ts = new Date()
    const dp = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}`
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tabela_${item.label.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${dp}.json`
    a.click()
    URL.revokeObjectURL(url)
    
    setDownloading(false)
    setProgress(0)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <HardDrive size={26} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Backup Completo do Sistema (Enterprise v3.0)</div>
            <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
              Exportação sob demanda. Os dados só são baixados quando você clica em Exportar, economizando memória.
            </div>
          </div>
        </div>

        {downloading && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
              <span style={{ color: 'hsl(var(--text-muted))' }}>{statusText}</span>
              <span style={{ fontWeight: 700, color: '#3b82f6' }}>{progress}%</span>
            </div>
            <div style={{ height: 8, background: 'hsl(var(--bg-elevated))', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#3b82f6,#8b5cf6)', width: `${progress}%`, transition: 'width 0.1s' }} />
            </div>
          </div>
        )}

        {lastBackup && !downloading && (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, color: '#34d399' }}>
            <CheckCircle size={14} /> Último backup gerado com sucesso em: {lastBackup}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <button className="btn btn-primary" onClick={() => doBackup('json')} disabled={downloading} style={{ justifyContent: 'center', padding: '14px', fontSize: 14, fontWeight: 700 }}>
            <FileJson size={16} style={{ marginRight: 6 }} /> {downloading ? 'Processando...' : 'Exportar JSON Completo'}
          </button>
          <button className="btn btn-secondary" onClick={() => doBackup('xlsx')} disabled={downloading} style={{ justifyContent: 'center', padding: '14px', fontSize: 14, fontWeight: 700 }}>
            <FileSpreadsheet size={16} style={{ marginRight: 6 }} /> {downloading ? 'Processando...' : 'Exportar Planilha Excel'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>📦 Mapeamento de Tabelas ({CATEGORIES.length} Categorias)</div>
          
          <div className="tab-list" style={{ gap: 4 }}>
            {[
              { id: 'all', label: 'Todas' },
              { id: 'academico', label: 'Acadêmico' },
              { id: 'financeiro', label: 'Financeiro' },
              { id: 'rh', label: 'RH' },
              { id: 'comunicacao', label: 'Agenda' }
            ].map(t => (
              <button key={t.id} className={`tab-trigger ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id as any)} style={{ padding: '4px 10px', fontSize: 11 }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {CATEGORIES
            .filter(cat => activeTab === 'all' || cat.id === activeTab)
            .map(cat => (
              <div key={cat.title} style={{ borderBottom: '1px solid hsl(var(--border-subtle))', paddingBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: cat.color, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {cat.title}
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {cat.items.map(item => (
                    <div key={item.label} style={{ 
                      padding: '12px 14px', 
                      background: 'hsl(var(--bg-elevated))', 
                      borderRadius: 12, 
                      border: '1px solid hsl(var(--border-subtle))',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>{item.label}</div>
                        <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 2 }}>{item.endpoint}</div>
                      </div>
                      <button 
                        onClick={() => downloadSingleTable(item)}
                        className="btn btn-ghost btn-sm btn-icon"
                        style={{ color: cat.color, width: 32, height: 32 }}
                        title={`Baixar JSON de ${item.label}`}
                        disabled={downloading}
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
          <div style={{ fontWeight: 700, fontSize: 14 }}>🕐 Backup Automático Agendado (Cloud Sync)</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <div>
            <label className="form-label">Frequência</label>
            <select className="form-input" value={autoFrequency} onChange={e => setAutoFrequency(e.target.value)}>
              <option value="Diário (meia-noite)">Diário (meia-noite)</option>
              <option value="Semanal (Domingo)">Semanal (Domingo)</option>
              <option value="Mensal (dia 1)">Mensal (dia 1)</option>
            </select>
          </div>
          <div>
            <label className="form-label">Destino do Backup</label>
            <select className="form-input" value={autoDestiny} onChange={e => setAutoDestiny(e.target.value)}>
              <option value="Google Drive">Google Drive</option>
              <option value="S3 / Backblaze">S3 / Backblaze Cloud</option>
              <option value="Servidor Local">Servidor SFTP Próprio</option>
            </select>
          </div>
          <div>
            <label className="form-label">E-mail para Alertas/Logs</label>
            <input className="form-input" value={autoEmail} onChange={e => setAutoEmail(e.target.value)} type="email" placeholder="admin@escola.com" />
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" style={{ marginTop: 14 }} onClick={saveScheduling}>
          {autoSaved ? <><Check size={13} style={{ color: '#10b981' }} /> Salvo!</> : <><RotateCcw size={13} /> Salvar Agendamento</>}
        </button>
      </div>
    </div>
  )
}
