'use client'
import { motion, AnimatePresence } from 'framer-motion';

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Search, Filter, X, ChevronDown, ChevronUp, FileText, FileSpreadsheet, RefreshCw,
  TrendingDown, TrendingUp, Users, DollarSign, BookOpen, AlertCircle, Phone, Mail, UserX, UserCheck, CheckCircle2, Save, Loader2
} from 'lucide-react'
import { exportPDF } from '@/lib/reports/exportPDF'
import { exportXLSX } from '@/lib/reports/exportXLSX'

interface RetencaoRow {
  id: string
  codigo: string
  nome: string
  dataNascimento: string
  idade: number
  foto: string
  turmaAnterior: string
  serieAnterior: string
  nivelAnterior: string
  turnoAnterior: string
  situacaoAnterior: string
  anoAnterior: number
  statusRetencao: 'Rematriculado' | 'Evasão'
  saldoAberto: number
  parcelasAbertas: number
  motivoPrincipal: string
  descricaoLivre: string
  responsavelFinanceiro: string
  responsavelPedagogico: string
  telefonesStr: string
  emailsStr: string
}

const MOTIVOS = [
  { id: 'financeiro', label: 'Conflito Financeiro' },
  { id: 'mudanca_cidade', label: 'Mudança de cidade' },
  { id: 'transporte', label: 'Transporte/Logística' },
  { id: 'mudanca_turno', label: 'Incompatibilidade de turno' },
  { id: 'outra_escola', label: 'Opção por outra escola' },
  { id: 'insatisfacao_pedagogica', label: 'Insatisfação pedagógica' },
  { id: 'insatisfacao_adm', label: 'Insatisfação administrativa' },
  { id: 'disciplinar', label: 'Questão disciplinar' },
  { id: 'inclusao', label: 'Inclusão / Necessidade' },
  { id: 'concluiu_ciclo', label: 'Terminou o ciclo' },
  { id: 'sem_retorno', label: 'Sem retorno / Ghosting' },
  { id: 'outro', label: 'Outro' },
]

export default function NaoRematriculadosPage() {
  const router = useRouter()

  const ATUAL = new Date().getFullYear()
  const ANTERIOR = ATUAL - 1

  const [anoBase, setAnoBase] = useState(String(ANTERIOR))
  const [anoAlvo, setAnoAlvo] = useState(String(ATUAL))

  const [data, setData] = useState<RetencaoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')

  const [selectedAluno, setSelectedAluno] = useState<RetencaoRow | null>(null)
  
  // Evasao Form
  const [formMotivo, setFormMotivo] = useState('')
  const [formDescricao, setFormDescricao] = useState('')
  const [savingForm, setSavingForm] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/relatorios/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          source: 'retencao_alunos', 
          filters: { anoBase, anoAlvo }
        })
      })
      const json = await res.json()
      setData(json.data || [])
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [anoBase, anoAlvo])

  useEffect(() => { fetchData() }, [fetchData])

  const stats = useMemo(() => {
    const elegiveis = data.length
    const rematriculados = data.filter(d => d.statusRetencao === 'Rematriculado').length
    const evasao = data.filter(d => d.statusRetencao === 'Evasão').length
    const pctRematricula = elegiveis > 0 ? ((rematriculados / elegiveis) * 100).toFixed(1) : '0'
    const pctEvasao = elegiveis > 0 ? ((evasao / elegiveis) * 100).toFixed(1) : '0'
    return { elegiveis, rematriculados, evasao, pctRematricula, pctEvasao }
  }, [data])

  const tableData = useMemo(() => {
    let base = data.filter(d => d.statusRetencao === 'Evasão')
    if (busca) {
      const b = busca.toLowerCase()
      base = base.filter(d => d.nome.toLowerCase().includes(b) || d.codigo.includes(b))
    }
    // Ordenar primeiramente por quem tem pendência financeira
    return base.sort((a,b) => b.saldoAberto - a.saldoAberto)
  }, [data, busca])

  const handleSaveEvasao = async () => {
    if (!selectedAluno) return
    setSavingForm(true)
    try {
      await fetch(`/api/alunos/${selectedAluno.id}/evasao`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anoReferencia: Number(anoAlvo),
          motivoPrincipal: formMotivo,
          descricaoLivre: formDescricao
        })
      })
      // Updates table data optimistically
      setData(prev => prev.map(p => {
        if (p.id === selectedAluno.id) {
          return { ...p, motivoPrincipal: formMotivo, descricaoLivre: formDescricao }
        }
        return p
      }))
      setSelectedAluno(null)
    } catch (e) {
      alert('Erro ao salvar motivo')
    } finally {
      setSavingForm(false)
    }
  }

  // Exports
  const handleExportExcel = () => {
    const list = tableData.map(d => ({
      Nome: d.nome,
      Matricula: d.codigo,
      'Série Anterior': d.serieAnterior || '—',
      'Turma Anterior': d.turmaAnterior || '—',
      'Sit. Anterior': d.situacaoAnterior || '—',
      'Dívida R$': d.saldoAberto,
      'Resp. Fin': d.responsavelFinanceiro,
      'Resp. Ped': d.responsavelPedagogico,
      'Contato': d.telefonesStr,
      'Motivo': getMotivoName(d.motivoPrincipal)
    }))
    exportXLSX({ title: 'Alunos Não Rematriculados', data: list, columns: [
      { key: 'Nome', label: 'Nome', type: 'text' },
      { key: 'Matricula', label: 'MA', type: 'text' },
      { key: 'Série Anterior', label: 'Série Anterior', type: 'text' },
      { key: 'Turma Anterior', label: 'Turma Anterior', type: 'text' },
      { key: 'Sit. Anterior', label: 'Situação', type: 'text' },
      { key: 'Dívida R$', label: 'Dívida', type: 'number' },
      { key: 'Resp. Fin', label: 'Resp. Fin.', type: 'text' },
      { key: 'Contato', label: 'Contato', type: 'text' },
      { key: 'Motivo', label: 'Motivo', type: 'text' }
    ] })
  }

  function getMotivoName(id: string) {
    if (id === 'financeiro_auto') return '⚠️ Pendência Financeira (Auto)'
    const f = MOTIVOS.find(m => m.id === id)
    return f ? f.label : (id || '—')
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 0 80px' }}>

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => router.push('/relatorios')} className="btn btn-secondary btn-icon"><ArrowLeft size={15} /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: 'linear-gradient(135deg, #ef4444, #b91c1c)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(239,68,68,0.35)' }}>
              <UserX size={22} color="#fff" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 21, fontWeight: 900, fontFamily: 'Outfit,sans-serif', color: 'hsl(var(--text-primary))' }}>Retenção e Evasão</h1>
              <p style={{ margin: 0, fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 2 }}>Controle de alunos elegíveis sem matrícula no ano alvo</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={fetchData} className="btn btn-secondary btn-sm" style={{ gap: 5 }}><RefreshCw size={11} /> Atualizar</button>
          <div style={{ height: 16, width: 1, background: 'hsl(var(--border-subtle))' }} />
          <button onClick={handleExportExcel} className="btn btn-sm" style={{ gap: 5, padding: '0 14px', background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.25)', fontFamily: 'inherit' }}>
            <FileSpreadsheet size={12} /> Excel
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 16 }}>
        <KPICard icon={<Users />} label={`Elegíveis em ${anoBase}`} value={stats.elegiveis} color="#6366f1" />
        <KPICard icon={<UserCheck />} label={`Rematriculados ${anoAlvo}`} value={stats.rematriculados} color="#10b981" />
        <KPICard icon={<UserX />} label={`Evasão / Pendentes`} value={stats.evasao} color="#ef4444" />
        <KPICard icon={<TrendingUp />} label="Taxa Retenção" value={`${stats.pctRematricula}%`} color="#3b82f6" />
        <KPICard icon={<TrendingDown />} label="Evasão Parcial" value={`${stats.pctEvasao}%`} color="#f59e0b" />
      </div>

      {/* FILTER */}
      <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20, padding: '16px 20px', borderRadius: 16, border: '1px solid hsl(var(--border-subtle))' }}>
        <div>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 5 }}>Ano Base (Origem)</label>
          <select value={anoBase} onChange={e => setAnoBase(e.target.value)} className="form-input" style={{ width: 120, fontSize: 13, fontWeight: 700 }}>
            {[ATUAL, ATUAL-1, ATUAL-2].map(x => <option key={x} value={String(x)}>{x}</option>)}
          </select>
        </div>
        <ArrowLeft size={16} color="hsl(var(--text-disabled))" style={{ transform: 'rotate(180deg)', marginTop: 15 }} />
        <div>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 5 }}>Ano Alvo (Destino)</label>
          <select value={anoAlvo} onChange={e => setAnoAlvo(e.target.value)} className="form-input" style={{ width: 120, fontSize: 13, fontWeight: 700 }}>
            {[ATUAL+1, ATUAL, ATUAL-1].map(x => <option key={x} value={String(x)}>{x}</option>)}
          </select>
        </div>

        <div style={{ width: 1, height: 30, background: 'hsl(var(--border-subtle))', margin: '0 10px', marginTop: 15 }} />

        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 5 }}>Buscar Aluno Evadido</label>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome ou matrícula..." className="form-input" style={{ paddingLeft: 34, fontSize: 13, width: '100%', maxWidth: 300 }} />
          </div>
        </div>
      </div>

      {/* THE LIST */}
      <h3 style={{ fontSize: 13, fontWeight: 800, color: 'hsl(var(--text-primary))', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Alunos Não Rematriculados ({tableData.length})
      </h3>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 14 }}>
          <Loader2 size={32} style={{ animation: 'spin 0.8s linear infinite', color: '#ef4444' }} />
          <div style={{ fontSize: 14, color: 'hsl(var(--text-muted))' }}>Analisando matriz de anos letivos...</div>
        </div>
      ) : tableData.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, border: '1px dashed hsl(var(--border-subtle))', borderRadius: 16 }}>
          <CheckCircle2 size={40} style={{ color: '#10b981', marginBottom: 16 }} />
          <p style={{ fontWeight: 700, color: 'hsl(var(--text-primary))', fontSize: 16 }}>Todos os alunos elegíveis foram rematriculados!</p>
          <p style={{ color: 'hsl(var(--text-muted))', fontSize: 13 }}>Não há evasões identificadas entre {anoBase} e {anoAlvo}.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, borderRadius: 16, border: '1px solid hsl(var(--border-subtle))', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'hsl(var(--bg-elevated))' }}>
                {['Aluno', 'Acadêmico Anterior', 'Motivo da Evasão', 'Pendência Fin.', 'Ação'].map((h, i) => (
                  <th key={i} style={{ padding: '12px 16px', textAlign: i >= 3 ? 'center' : 'left', fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid hsl(var(--border-subtle))', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((d, idx) => (
                <tr key={d.id} style={{ borderBottom: '1px solid hsl(var(--border-subtle))', background: idx % 2 === 1 ? 'hsl(var(--bg-elevated))' : '' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>
                        {d.nome.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{d.nome}</div>
                        <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>MA: {d.codigo}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>{d.turmaAnterior || d.serieAnterior || '—'}</div>
                    <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>Sit: {d.situacaoAnterior}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {d.motivoPrincipal === 'financeiro_auto' ? (
                      <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '3px 8px', borderRadius: 8 }}>⚠️ Pendência Auto</span>
                    ) : d.motivoPrincipal ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6' }}>{getMotivoName(d.motivoPrincipal)}</span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'hsl(var(--text-disabled))' }}>Não informado</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {d.saldoAberto > 0 ? (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#ef4444' }}>
                          R$ {d.saldoAberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: 10, color: '#ef4444' }}>{d.parcelasAbertas} parc.</div>
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>Sem pendências</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button onClick={() => {
                      setSelectedAluno(d)
                      const mot = d.motivoPrincipal === 'financeiro_auto' ? 'financeiro' : d.motivoPrincipal
                      setFormMotivo(mot || '')
                      setFormDescricao(d.descricaoLivre || '')
                    }} className="btn btn-sm" style={{ background: '#ef4444', color: '#fff', border: 'none' }}>
                      Agir / Contatar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
{/* MODAL DETALHES ULTRA PREMIUM */}
      {selectedAluno && (
<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setSelectedAluno(null)}>
          <motion.div initial={{scale:0.95, opacity:0, y:20}} animate={{scale:1, opacity:1, y:0}} exit={{scale:0.95, opacity:0, y:20}} transition={{ type: "spring", stiffness: 300, damping: 25 }} style={{ background: 'hsl(var(--bg-surface))', borderRadius: 24, width: '100%', maxWidth: 700, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div style={{ padding: '24px 30px', background: 'linear-gradient(135deg, rgba(239,68,68,0.05), rgba(185,28,28,0.05))', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
               <div style={{ display: 'flex', gap: 16 }}>
                 <div style={{ width: 56, height: 56, borderRadius: 16, background: '#ef4444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 900 }}>
                   {selectedAluno.nome.charAt(0)}
                 </div>
                 <div>
                   <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: 'hsl(var(--text-primary))' }}>{selectedAluno.nome}</h2>
                   <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 13, color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>
                     <span>MA: {selectedAluno.codigo}</span>
                     <span>Idade: {selectedAluno.idade || '?'} anos</span>
                   </div>
                 </div>
               </div>
               <button onClick={() => setSelectedAluno(null)} className="btn btn-icon"><X /></button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '30px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Historico */}
                <div style={{ background: 'hsl(var(--bg-elevated))', borderRadius: 16, padding: '16px', border: '1px solid hsl(var(--border-subtle))' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><BookOpen size={16} color="#6366f1" /> <h4 style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase' }}>Acadêmico em {selectedAluno.anoAnterior}</h4></div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{selectedAluno.turmaAnterior || selectedAluno.serieAnterior || '—'}</div>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', marginTop: 4 }}>Situação: <strong style={{ color: 'hsl(var(--text-primary))' }}>{selectedAluno.situacaoAnterior}</strong></div>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', marginTop: 2 }}>Nível: {selectedAluno.nivelAnterior || '—'}</div>
                </div>

                {/* Financeiro */}
                <div style={{ background: 'hsl(var(--bg-elevated))', borderRadius: 16, padding: '16px', border: '1px solid hsl(var(--border-subtle))' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><DollarSign size={16} color="#ef4444" /> <h4 style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase' }}>Status Financeiro</h4></div>
                  {selectedAluno.saldoAberto > 0 ? (
                    <div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: '#ef4444', fontFamily: 'Outfit,sans-serif' }}>R$ {selectedAluno.saldoAberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                      <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, marginTop: 2 }}>{selectedAluno.parcelasAbertas} parcelas em aberto/atraso</div>
                    </div>
                  ) : <div style={{ fontSize: 15, fontWeight: 700, color: '#10b981' }}>Sem pendências financeiras.</div>}
                </div>
              </div>

              {/* CRM / Responsaveis */}
              <div style={{ background: 'hsl(var(--bg-elevated))', borderRadius: 16, padding: '16px', border: '1px solid hsl(var(--border-subtle))' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><Phone size={16} color="#10b981" /> <h4 style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#10b981', textTransform: 'uppercase' }}>Contatos dos Responsáveis</h4></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', fontWeight: 800 }}>Financeiro</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{selectedAluno.responsavelFinanceiro || 'Não inf.'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', fontWeight: 800 }}>Telefones Encontrados</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>{selectedAluno.telefonesStr || 'Nenhum telefone'}</div>
                  </div>
                </div>
              </div>

              {/* Form Motivo */}
              <div>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 16px 0', fontSize: 13, fontWeight: 800, color: 'hsl(var(--text-primary))', textTransform: 'uppercase' }}><AlertCircle size={16} color="#f59e0b" /> Registrar Acompanhamento / Evasão</h4>
                
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 6 }}>Motivo Principal {selectedAluno.motivoPrincipal === 'financeiro_auto' && '(Detectado pelo ERP)'}</label>
                <select value={formMotivo} onChange={e => setFormMotivo(e.target.value)} className="form-input" style={{ width: '100%', marginBottom: 16, padding: '12px 16px', fontSize: 14 }}>
                  <option value="">Selecione um motivo formal...</option>
                  {MOTIVOS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>

                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 6 }}>Anotações da Diretoria (Comunicação com a família)</label>
                <textarea 
                  value={formDescricao} onChange={e => setFormDescricao(e.target.value)}
                  className="form-input" placeholder="Anote aqui os resultados da ligação, acordo ou contexto da saída..."
                  style={{ width: '100%', minHeight: 100, padding: 16, fontSize: 13, resize: 'vertical' }}
                />
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{ padding: '20px 30px', background: 'hsl(var(--bg-elevated))', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button onClick={() => setSelectedAluno(null)} className="btn btn-secondary">Cancelar</button>
              <button disabled={savingForm} onClick={handleSaveEvasao} className="btn btn-primary" style={{ gap: 8, background: '#ef4444', border: 'none' }}>
                {savingForm ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
                Salvar Histórico
              </button>
            </div>

          </motion.div>
        
</motion.div>
)}</AnimatePresence>

      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function KPICard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: string|number, color: string }) {
  return (
    <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, padding: '16px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'Outfit,sans-serif', color: 'hsl(var(--text-primary))', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>{label}</div>
      </div>
    </div>
  )
}
