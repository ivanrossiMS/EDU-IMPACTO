'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';


import { useState } from 'react'
import { useData } from '@/lib/dataContext'
import { HardDrive, Download, CheckCircle, RotateCcw } from 'lucide-react'
import * as XLSX from 'xlsx'

export default function BackupSection() {
  const { leads = [], comunicados = [], tarefas = [], mantenedores = [] } = useData() || {};
  const [_alunos, setAlunos] = useSupabaseArray<any>('alunos');
  const [_funcionarios, setFuncionarios] = useSupabaseArray<any>('rh/funcionarios');
  const [_titulos, setTitulos] = useSupabaseArray<any>('titulos');
  const [_contasPagar, setContasPagar] = useSupabaseArray<any>('contas-pagar');

  const alunos = _alunos || [];
  const funcionarios = _funcionarios || [];
  const titulos = _titulos || [];
  const contasPagar = _contasPagar || [];
  const [downloading, setDownloading] = useState(false)
  const [lastBackup, setLastBackup] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  const doBackup = async (format: 'json' | 'xlsx') => {
    setDownloading(true)
    setProgress(0)
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(r => setTimeout(r, 50))
      setProgress(i)
    }
    const ts = new Date()
    const dp = `${ts.getFullYear()}${String(ts.getMonth()+1).padStart(2,'0')}${String(ts.getDate()).padStart(2,'0')}_${String(ts.getHours()).padStart(2,'0')}${String(ts.getMinutes()).padStart(2,'0')}`

    const payload = {
      exportadoEm: ts.toISOString(),
      versao: '2.0',
      totais: { alunos: alunos.length, funcionarios: funcionarios.length, leads: leads.length, titulos: titulos.length, contasPagar: contasPagar.length, comunicados: comunicados.length, tarefas: tarefas.length, mantenedores: mantenedores.length },
      alunos, funcionarios, leads, titulos, contasPagar, comunicados, tarefas, mantenedores,
    }

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `backup_impacto_edu_${dp}.json`; a.click()
      URL.revokeObjectURL(url)
    } else {
      const wb = XLSX.utils.book_new()
      const addSheet = (data: unknown[], name: string) => {
        if (data.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), name)
        else XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ info: 'Sem dados cadastrados' }]), name)
      }
      addSheet(alunos, 'Alunos')
      addSheet(funcionarios, 'Funcionários')
      addSheet(leads, 'CRM-Leads')
      addSheet(titulos, 'Fin-Receber')
      addSheet(contasPagar, 'Fin-Pagar')
      addSheet(comunicados, 'Comunicados')
      addSheet(tarefas, 'Tarefas')
      addSheet(mantenedores.map(m => ({ ...m, unidades: m.unidades.length })), 'Multi-Unidades')
      XLSX.writeFile(wb, `backup_impacto_edu_${dp}.xlsx`)
    }

    setLastBackup(ts.toLocaleString('pt-BR'))
    setDownloading(false)
    setProgress(0)
  }

  const totalRecords = alunos.length + funcionarios.length + leads.length + titulos.length + contasPagar.length + comunicados.length

  const modules = [
    { icon: '🎓', label: 'Alunos', count: alunos.length },
    { icon: '👥', label: 'Funcionários', count: funcionarios.length },
    { icon: '🎯', label: 'Leads CRM', count: leads.length },
    { icon: '💰', label: 'Contas a Receber', count: titulos.length },
    { icon: '📤', label: 'Contas a Pagar', count: contasPagar.length },
    { icon: '📢', label: 'Comunicados', count: comunicados.length },
    { icon: '✅', label: 'Tarefas', count: tarefas.length },
    { icon: '🏫', label: 'Mantenedores/Unid.', count: mantenedores.length },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <HardDrive size={26} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Backup Completo do Sistema</div>
            <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
              Exporta todos os dados reais cadastrados — <strong style={{ color: '#60a5fa' }}>{totalRecords} registros</strong> no total
            </div>
          </div>
        </div>

        {downloading && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
              <span style={{ color: 'hsl(var(--text-muted))' }}>Coletando dados reais do localStorage...</span>
              <span style={{ fontWeight: 700, color: '#60a5fa' }}>{progress}%</span>
            </div>
            <div style={{ height: 8, background: 'hsl(var(--bg-elevated))', borderRadius: 999 }}>
              <div style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#3b82f6,#8b5cf6)', width: `${progress}%`, transition: 'width 0.1s' }} />
            </div>
          </div>
        )}

        {lastBackup && (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, color: '#34d399' }}>
            <CheckCircle size={14} /> Último backup: {lastBackup}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <button className="btn btn-primary" onClick={() => doBackup('json')} disabled={downloading} style={{ justifyContent: 'center', padding: '14px', fontSize: 14, fontWeight: 700 }}>
            <Download size={16} /> {downloading ? 'Exportando...' : '⬇ Backup JSON completo'}
          </button>
          <button className="btn btn-secondary" onClick={() => doBackup('xlsx')} disabled={downloading} style={{ justifyContent: 'center', padding: '14px', fontSize: 14, fontWeight: 700 }}>
            <Download size={16} /> {downloading ? 'Exportando...' : '⬇ Exportar XLSX (planilha)'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '20px' }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>📦 Dados que serão exportados</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {modules.map(m => (
            <div key={m.label} style={{ padding: '12px', background: 'hsl(var(--bg-elevated))', borderRadius: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{m.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: m.count > 0 ? '#60a5fa' : 'hsl(var(--text-muted))' }}>{m.count}</div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>{m.label}</div>
            </div>
          ))}
        </div>
        {totalRecords === 0 && (
          <div style={{ marginTop: 14, padding: '10px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 8, fontSize: 12, color: '#fbbf24', textAlign: 'center' }}>
            ⚠ Nenhum dado cadastrado. Adicione dados nas páginas ou use a seção Dados de Teste antes de realizar o backup.
          </div>
        )}
      </div>

      <div className="card" style={{ padding: '20px' }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>🕐 Backup Automático Agendado</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div><label className="form-label">Frequência</label>
            <select className="form-input"><option>Diário (meia-noite)</option><option>Semanal</option><option>Mensal</option></select></div>
          <div><label className="form-label">Destino</label>
            <select className="form-input"><option>Google Drive</option><option>S3 / Backblaze</option><option>Download local</option></select></div>
        </div>
        <button className="btn btn-secondary btn-sm" style={{ marginTop: 14 }}><RotateCcw size={13} />Salvar agendamento</button>
      </div>
    </div>
  )
}
