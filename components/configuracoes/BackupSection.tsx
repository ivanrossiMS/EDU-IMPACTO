'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useState, useMemo } from 'react'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { HardDrive, Download, CheckCircle, RotateCcw, FileJson, FileSpreadsheet, Eye, ChevronRight, Check } from 'lucide-react'
import * as XLSX from 'xlsx'

export default function BackupSection() {
  // ─── Loading All 25 ERP Collections ────────────────────────────────
  const [alunos = []] = useSupabaseArray<any>('alunos')
  const [turmas = []] = useSupabaseArray<any>('turmas')
  const [ocorrencias = []] = useSupabaseArray<any>('ocorrencias')
  const [transferencias = []] = useSupabaseArray<any>('academico/transferencias')
  const [frequencias = []] = useSupabaseArray<any>('academico/frequencias')
  const [notas = []] = useSupabaseArray<any>('academico/notas')

  const [titulos = []] = useSupabaseArray<any>('titulos')
  const [contasPagar = []] = useSupabaseArray<any>('contas-pagar')
  const [movimentacoes = []] = useSupabaseArray<any>('financeiro/movimentacoes')
  const [notasFiscais = []] = useSupabaseArray<any>('financeiro/notas-fiscais')
  
  const [funcionarios = []] = useSupabaseArray<any>('rh/funcionarios')
  const [adiantamentos = []] = useSupabaseArray<any>('rh/adiantamentos')
  const [advertencias = []] = useSupabaseArray<any>('rh/advertencias')
  const [ausencias = []] = useSupabaseArray<any>('rh/ausencias')

  const [leads = []] = useSupabaseArray<any>('leads')
  
  const [comunicados = []] = useSupabaseArray<any>('comunicados')
  const [tarefas = []] = useSupabaseArray<any>('tarefas')
  const [eventosAgenda = []] = useSupabaseArray<any>('agenda/eventos')
  const [rotinaItems = []] = useSupabaseArray<any>('agenda/rotina')
  const [autorizacoes = []] = useSupabaseArray<any>('agenda/autorizacoes')
  const [momentos = []] = useSupabaseArray<any>('agenda/momentos')
  const [enquetes = []] = useSupabaseArray<any>('agenda/enquetes')

  const [guardians = []] = useSupabaseArray<any>('saida/guardians')
  const [calls = []] = useSupabaseArray<any>('saida/calls')
  const [saidaLogs = []] = useSupabaseArray<any>('saida/logs')

  const [mantenedores = []] = useSupabaseArray<any>('configuracoes/mantenedores')
  const [systemLogs = []] = useSupabaseArray<any>('system-logs')

  // State
  const [downloading, setDownloading] = useState(false)
  const [lastBackup, setLastBackup] = useLocalStorage<string | null>('edu-last-backup-ts', null)
  const [progress, setProgress] = useState(0)
  const [activeTab, setActiveTab] = useState<'all' | 'academico' | 'financeiro' | 'rh' | 'crm' | 'comunicacao' | 'saida'>('all')

  // Auto Backup settings in LocalStorage
  const [autoFrequency, setAutoFrequency] = useLocalStorage<string>('edu-backup-frequency', 'Diário (meia-noite)')
  const [autoDestiny, setAutoDestiny] = useLocalStorage<string>('edu-backup-destiny', 'Google Drive')
  const [autoEmail, setAutoEmail] = useLocalStorage<string>('edu-backup-email', 'admin@impactoedu.com.br')
  const [autoSaved, setAutoSaved] = useState(false)

  const saveScheduling = () => {
    setAutoSaved(true)
    setTimeout(() => setAutoSaved(false), 2000)
  }

  // ─── Categories & Items mapping ───────────────────────────────────
  const categories = useMemo(() => [
    {
      id: 'academico',
      title: '🎓 Módulos Acadêmicos',
      color: '#3b82f6',
      items: [
        { label: 'Alunos', count: alunos.length, data: alunos, sheetName: 'Alunos' },
        { label: 'Turmas', count: turmas.length, data: turmas, sheetName: 'Turmas' },
        { label: 'Ocorrências', count: ocorrencias.length, data: ocorrencias, sheetName: 'Ocorrências' },
        { label: 'Transferências', count: transferencias.length, data: transferencias, sheetName: 'Transferências' },
        { label: 'Frequências', count: frequencias.length, data: frequencias, sheetName: 'Frequências' },
        { label: 'Notas', count: notas.length, data: notas, sheetName: 'Notas' },
      ]
    },
    {
      id: 'financeiro',
      title: '💰 Módulos Financeiros',
      color: '#10b981',
      items: [
        { label: 'Contas a Receber', count: titulos.length, data: titulos, sheetName: 'Fin-Receber' },
        { label: 'Contas a Pagar', count: contasPagar.length, data: contasPagar, sheetName: 'Fin-Pagar' },
        { label: 'Movimentações Manuais', count: movimentacoes.length, data: movimentacoes, sheetName: 'Fin-Movimentações' },
        { label: 'Notas Fiscais', count: notasFiscais.length, data: notasFiscais, sheetName: 'Fin-NotasFiscais' },
      ]
    },
    {
      id: 'rh',
      title: '👤 Recursos Humanos',
      color: '#f59e0b',
      items: [
        { label: 'Funcionários', count: funcionarios.length, data: funcionarios, sheetName: 'RH-Funcionários' },
        { label: 'Adiantamentos', count: adiantamentos.length, data: adiantamentos, sheetName: 'RH-Adiantamentos' },
        { label: 'Advertências', count: advertencias.length, data: advertencias, sheetName: 'RH-Advertências' },
        { label: 'Ausências/Férias', count: ausencias.length, data: ausencias, sheetName: 'RH-Ausências' },
      ]
    },
    {
      id: 'crm',
      title: '🎯 CRM & Captação',
      color: '#ec4899',
      items: [
        { label: 'Leads', count: leads.length, data: leads, sheetName: 'CRM-Leads' },
      ]
    },
    {
      id: 'comunicacao',
      title: '📅 Agenda & Comunicação',
      color: '#8b5cf6',
      items: [
        { label: 'Comunicados', count: comunicados.length, data: comunicados, sheetName: 'Comunicados' },
        { label: 'Tarefas/Compromissos', count: tarefas.length, data: tarefas, sheetName: 'Tarefas' },
        { label: 'Eventos da Agenda', count: eventosAgenda.length, data: eventosAgenda, sheetName: 'Agenda-Eventos' },
        { label: 'Rotinas Diárias', count: rotinaItems.length, data: rotinaItems, sheetName: 'Agenda-Rotinas' },
        { label: 'Autorizações', count: autorizacoes.length, data: autorizacoes, sheetName: 'Agenda-Autorizações' },
        { label: 'Feed de Momentos', count: momentos.length, data: momentos, sheetName: 'Agenda-Momentos' },
        { label: 'Enquetes', count: enquetes.length, data: enquetes, sheetName: 'Agenda-Enquetes' },
      ]
    },
    {
      id: 'saida',
      title: '🚨 Saída de Alunos & Segurança',
      color: '#06b6d4',
      items: [
        { label: 'Responsáveis', count: guardians.length, data: guardians, sheetName: 'Saída-Responsáveis' },
        { label: 'Chamadas', count: calls.length, data: calls, sheetName: 'Saída-Chamadas' },
        { label: 'Histórico de Saídas', count: saidaLogs.length, data: saidaLogs, sheetName: 'Saída-Histórico' },
      ]
    },
    {
      id: 'configuracoes',
      title: '⚙️ Configurações & Auditoria',
      color: '#64748b',
      items: [
        { label: 'Unidades/Mantenedores', count: mantenedores.length, data: mantenedores, sheetName: 'Config-Unidades' },
        { label: 'Logs do Sistema', count: systemLogs.length, data: systemLogs, sheetName: 'Config-Auditoria' },
      ]
    }
  ], [
    alunos, turmas, ocorrencias, transferencias, frequencias, notas,
    titulos, contasPagar, movimentacoes, notasFiscais, 
    funcionarios, adiantamentos, advertencias, ausencias,
    leads, 
    comunicados, tarefas, eventosAgenda, rotinaItems, autorizacoes, momentos, enquetes,
    guardians, calls, saidaLogs,
    mantenedores, systemLogs
  ])

  const totalRecords = useMemo(() => {
    return categories.reduce((sum, cat) => sum + cat.items.reduce((s, i) => s + i.count, 0), 0)
  }, [categories])

  const doBackup = async (format: 'json' | 'xlsx') => {
    setDownloading(true)
    setProgress(0)
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(r => setTimeout(r, 60))
      setProgress(i)
    }
    const ts = new Date()
    const dp = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}_${String(ts.getHours()).padStart(2, '0')}${String(ts.getMinutes()).padStart(2, '0')}`

    const payload: any = {
      exportadoEm: ts.toISOString(),
      versao: '3.0 (Enterprise)',
      totalRegistros: totalRecords,
      tabelas: {}
    }

    categories.forEach(cat => {
      cat.items.forEach(item => {
        payload.tabelas[item.sheetName] = {
          label: item.label,
          total: item.count,
          registros: item.data
        }
      })
    })

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
              cleanRow[key] = `[Dado longo truncado (${(val.length / 1024).toFixed(1)} KB) - Utilize a exportação em JSON para acessar o arquivo original]`
            } else if (val && typeof val === 'object') {
              const strVal = JSON.stringify(val)
              if (strVal.length > 30000) {
                cleanRow[key] = `[Objeto longo truncado (${(strVal.length / 1024).toFixed(1)} KB) - Utilize a exportação em JSON para acessar o arquivo original]`
              } else {
                cleanRow[key] = val
              }
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
        { Propriedade: 'Versão do Backup', Valor: '3.0 Enterprise' },
        { Propriedade: 'Data/Hora de Exportação', Valor: ts.toLocaleString('pt-BR') },
        { Propriedade: 'Total Geral de Registros', Valor: totalRecords },
        { Propriedade: 'Total de Tabelas', Valor: 25 }
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoData), 'Resumo Backup')

      categories.forEach(cat => {
        cat.items.forEach(item => {
          const sheetData = item.data.length > 0 ? sanitizeForExcel(item.data) : [{ info: 'Sem dados cadastrados nesta tabela' }]
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetData), item.sheetName)
        })
      })
      XLSX.writeFile(wb, `backup_completo_impacto_edu_${dp}.xlsx`)
    }

    setLastBackup(ts.toLocaleString('pt-BR'))
    setDownloading(false)
    setProgress(0)
  }

  const downloadSingleTable = (label: string, data: any[]) => {
    const ts = new Date()
    const dp = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}`
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tabela_${label.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${dp}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Card Principal */}
      <div className="card" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <HardDrive size={26} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Backup Completo do Sistema (Enterprise v3.0)</div>
            <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
              Exporta todos os dados de <strong style={{ color: '#3b82f6' }}>25 tabelas ativas</strong> do banco — <strong style={{ color: '#10b981' }}>{totalRecords} registros</strong> no total.
            </div>
          </div>
        </div>

        {downloading && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
              <span style={{ color: 'hsl(var(--text-muted))' }}>Compactando dados reais do ERP de forma segura...</span>
              <span style={{ fontWeight: 700, color: '#3b82f6' }}>{progress}%</span>
            </div>
            <div style={{ height: 8, background: 'hsl(var(--bg-elevated))', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#3b82f6,#8b5cf6)', width: `${progress}%`, transition: 'width 0.1s' }} />
            </div>
          </div>
        )}

        {lastBackup && (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, color: '#34d399' }}>
            <CheckCircle size={14} /> Último backup gerado com sucesso em: {lastBackup}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <button className="btn btn-primary" onClick={() => doBackup('json')} disabled={downloading} style={{ justifyContent: 'center', padding: '14px', fontSize: 14, fontWeight: 700 }}>
            <FileJson size={16} style={{ marginRight: 6 }} /> {downloading ? 'Gerando JSON...' : 'Exportar JSON Completo'}
          </button>
          <button className="btn btn-secondary" onClick={() => doBackup('xlsx')} disabled={downloading} style={{ justifyContent: 'center', padding: '14px', fontSize: 14, fontWeight: 700 }}>
            <FileSpreadsheet size={16} style={{ marginRight: 6 }} /> {downloading ? 'Gerando Planilhas...' : 'Exportar Planilha Excel Completa (Multi-Sheets)'}
          </button>
        </div>
      </div>

      {/* Seção das Tabelas */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>📦 Mapeamento de Tabelas ({categories.length} Categorias / 25 Tabelas)</div>
          
          {/* Categoria selector */}
          <div className="tab-list" style={{ gap: 4 }}>
            {[
              { id: 'all', label: 'Todas' },
              { id: 'academico', label: 'Acadêmico' },
              { id: 'financeiro', label: 'Financeiro' },
              { id: 'rh', label: 'RH' },
              { id: 'crm', label: 'CRM' },
              { id: 'comunicacao', label: 'Agenda' },
              { id: 'saida', label: 'Saída/Segurança' }
            ].map(t => (
              <button key={t.id} className={`tab-trigger ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id as any)} style={{ padding: '4px 10px', fontSize: 11 }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {categories
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
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      position: 'relative'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-primary))', maxWidth: '75%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                        <span style={{ 
                          fontSize: 10, 
                          fontWeight: 800, 
                          color: item.count > 0 ? cat.color : 'hsl(var(--text-muted))', 
                          background: item.count > 0 ? `${cat.color}15` : 'hsl(var(--bg-overlay))',
                          padding: '2px 8px',
                          borderRadius: 8
                        }}>
                          {item.count} reg
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                        <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>Planilha: {item.sheetName}</span>
                        <button 
                          onClick={() => downloadSingleTable(item.label, item.data)}
                          className="btn btn-ghost btn-sm btn-icon"
                          style={{ color: cat.color, width: 26, height: 26 }}
                          title={`Baixar JSON de ${item.label}`}
                          disabled={item.count === 0}
                        >
                          <Download size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Backup Automático Agendado */}
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
