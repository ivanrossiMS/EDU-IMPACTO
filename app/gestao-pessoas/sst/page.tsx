'use client'

import React, { useState, useEffect } from 'react'
import { Shield, FileText, HeartPulse, HardHat, AlertTriangle, CheckCircle2, Clock, Trash2, Edit2 } from 'lucide-react'
import { SidePanel } from '@/components/ui/SidePanel'

type Documento = { id: string, tipo: string, titulo: string, revisao: string, medico: string, vigencia: string, status: string }
type Aso = { id: string, colaborador: string, tipo_exame: string, vencimento: string, status: string }

export default function GestaoSST() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pgr' | 'pcmso' | 'aso'>('dashboard')
  
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [asos, setAsos] = useState<Aso[]>([])
  const [loading, setLoading] = useState(true)

  const [isDocPanelOpen, setIsDocPanelOpen] = useState(false)
  const [editDocId, setEditDocId] = useState<string | null>(null)
  const [docForm, setDocForm] = useState({ tipo: 'PGR', titulo: '', revisao: '', medico: '', vigencia: '', status: 'VIGENTE' })

  const [isAsoPanelOpen, setIsAsoPanelOpen] = useState(false)
  const [editAsoId, setEditAsoId] = useState<string | null>(null)
  const [asoForm, setAsoForm] = useState({ colaborador: '', tipo_exame: 'Periódico', vencimento: '', status: 'REGULAR' })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [resDoc, resAso] = await Promise.all([
        fetch('/api/gestao-pessoas/sst/documentos'),
        fetch('/api/gestao-pessoas/sst/asos')
      ])
      if (resDoc.ok) { const d = await resDoc.json(); setDocumentos(Array.isArray(d) ? d : []) }
      if (resAso.ok) { const a = await resAso.json(); setAsos(Array.isArray(a) ? a : []) }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Documentos
  const handleOpenDocPanel = (doc?: Documento, forceTipo?: string) => {
    if (doc) {
      setEditDocId(doc.id)
      setDocForm({ tipo: doc.tipo || 'PGR', titulo: doc.titulo || '', revisao: doc.revisao || '', medico: doc.medico || '', vigencia: doc.vigencia || '', status: doc.status || 'VIGENTE' })
    } else {
      setEditDocId(null)
      setDocForm({ tipo: forceTipo || 'PGR', titulo: '', revisao: '', medico: '', vigencia: '', status: 'VIGENTE' })
    }
    setIsDocPanelOpen(true)
  }

  const handleSaveDoc = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editDocId ? `/api/gestao-pessoas/sst/documentos/${editDocId}` : '/api/gestao-pessoas/sst/documentos'
      const method = editDocId ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(docForm) })
      if (res.ok) { setIsDocPanelOpen(false); fetchData() } else alert('Erro ao salvar')
    } catch (error) { alert('Erro de conexão') }
  }

  const handleDeleteDoc = async (id: string) => {
    if (!confirm('Excluir documento?')) return
    const res = await fetch(`/api/gestao-pessoas/sst/documentos/${id}`, { method: 'DELETE' })
    if (res.ok) fetchData()
  }

  // ASOs
  const handleOpenAsoPanel = (aso?: Aso) => {
    if (aso) {
      setEditAsoId(aso.id)
      setAsoForm({ colaborador: aso.colaborador || '', tipo_exame: aso.tipo_exame || 'Periódico', vencimento: aso.vencimento ? new Date(aso.vencimento).toISOString().split('T')[0] : '', status: aso.status || 'REGULAR' })
    } else {
      setEditAsoId(null)
      setAsoForm({ colaborador: '', tipo_exame: 'Periódico', vencimento: '', status: 'REGULAR' })
    }
    setIsAsoPanelOpen(true)
  }

  const handleSaveAso = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editAsoId ? `/api/gestao-pessoas/sst/asos/${editAsoId}` : '/api/gestao-pessoas/sst/asos'
      const method = editAsoId ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(asoForm) })
      if (res.ok) { setIsAsoPanelOpen(false); fetchData() } else alert('Erro ao salvar')
    } catch (error) { alert('Erro de conexão') }
  }

  const handleDeleteAso = async (id: string) => {
    if (!confirm('Excluir ASO?')) return
    const res = await fetch(`/api/gestao-pessoas/sst/asos/${id}`, { method: 'DELETE' })
    if (res.ok) fetchData()
  }

  const pgrDocs = documentos.filter(d => d.tipo === 'PGR')
  const pcmsoDocs = documentos.filter(d => d.tipo === 'PCMSO')

  const metrics = [
    { label: 'Exames ASO Vencidos', value: asos.filter(a => a.status === 'VENCIDO').length.toString(), icon: HeartPulse, color: '#ef4444' },
    { label: 'PGR Status', value: pgrDocs.length > 0 ? 'Regular' : 'Pendente', icon: FileText, color: '#10b981' },
    { label: 'PCMSO Validade', value: pcmsoDocs.length > 0 ? 'Em Dia' : 'Atenção', icon: FileText, color: '#f59e0b' },
    { label: 'EPIs Vencidos', value: '0', icon: HardHat, color: '#3b82f6' }
  ]

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={24} color="#fff" />
            </div>
            SST e NR-01
          </h1>
          <p style={{ fontSize: 15, color: '#64748b' }}>Gestão Integrada de Saúde e Segurança do Trabalho, PGR e PCMSO.</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32, borderBottom: '1px solid #e2e8f0', paddingBottom: 16 }}>
        {[
          { id: 'dashboard', label: 'Painel Geral' },
          { id: 'pgr', label: 'PGR (NR-01)' },
          { id: 'pcmso', label: 'PCMSO (NR-07)' },
          { id: 'aso', label: 'Controle de ASOs' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '10px 20px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, transition: 'all 0.2s',
              background: activeTab === tab.id ? '#d1fae5' : 'transparent',
              color: activeTab === tab.id ? '#059669' : '#64748b',
            }}
            onMouseEnter={e => { if(activeTab !== tab.id) e.currentTarget.style.color = '#0f172a'; e.currentTarget.style.background = activeTab !== tab.id ? '#f1f5f9' : '#d1fae5' }}
            onMouseLeave={e => { if(activeTab !== tab.id) e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = activeTab !== tab.id ? 'transparent' : '#d1fae5' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24, marginBottom: 40 }}>
            {metrics.map((m, i) => (
              <div key={i} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 24, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: `${m.color}15`, color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <m.icon size={20} />
                  </div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>{m.value}</div>
                <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginTop: 4 }}>{m.label}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {(activeTab === 'pgr' || activeTab === 'pcmso') && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 24, padding: 32, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>Documentos do {activeTab.toUpperCase()}</h2>
            <button onClick={() => handleOpenDocPanel(undefined, activeTab.toUpperCase())} style={{ padding: '10px 20px', background: '#3b82f6', color: '#fff', borderRadius: 12, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              Novo Documento
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: 13, color: '#64748b', fontWeight: 700 }}>TÍTULO</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: 13, color: '#64748b', fontWeight: 700 }}>REVISÃO</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: 13, color: '#64748b', fontWeight: 700 }}>VIGÊNCIA</th>
                <th style={{ padding: '16px', textAlign: 'center', fontSize: 13, color: '#64748b', fontWeight: 700 }}>STATUS</th>
                <th style={{ padding: '16px', textAlign: 'right', fontSize: 13, color: '#64748b', fontWeight: 700 }}>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {(activeTab === 'pgr' ? pgrDocs : pcmsoDocs).length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>Nenhum documento encontrado.</td></tr>
              ) : (
                (activeTab === 'pgr' ? pgrDocs : pcmsoDocs).map(doc => (
                  <tr key={doc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '16px', fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{doc.titulo}</td>
                    <td style={{ padding: '16px', fontSize: 14, color: '#475569' }}>{doc.revisao || '-'}</td>
                    <td style={{ padding: '16px', fontSize: 14, color: '#475569' }}>{doc.vigencia || '-'}</td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <span style={{ padding: '4px 10px', background: doc.status === 'VIGENTE' ? '#d1fae5' : '#fee2e2', color: doc.status === 'VIGENTE' ? '#059669' : '#b91c1c', borderRadius: 100, fontSize: 12, fontWeight: 700 }}>
                        {doc.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => handleOpenDocPanel(doc)} style={{ padding: 6, borderRadius: 8, background: '#eff6ff', color: '#3b82f6', border: 'none', cursor: 'pointer' }}><Edit2 size={16}/></button>
                        <button onClick={() => handleDeleteDoc(doc.id)} style={{ padding: 6, borderRadius: 8, background: '#fef2f2', color: '#ef4444', border: 'none', cursor: 'pointer' }}><Trash2 size={16}/></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'aso' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 24, padding: 32, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>Controle de ASOs</h2>
            <button onClick={() => handleOpenAsoPanel()} style={{ padding: '10px 20px', background: '#3b82f6', color: '#fff', borderRadius: 12, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              Registrar ASO
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: 13, color: '#64748b', fontWeight: 700 }}>COLABORADOR</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: 13, color: '#64748b', fontWeight: 700 }}>TIPO EXAME</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: 13, color: '#64748b', fontWeight: 700 }}>VENCIMENTO</th>
                <th style={{ padding: '16px', textAlign: 'center', fontSize: 13, color: '#64748b', fontWeight: 700 }}>STATUS</th>
                <th style={{ padding: '16px', textAlign: 'right', fontSize: 13, color: '#64748b', fontWeight: 700 }}>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {asos.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>Nenhum ASO registrado.</td></tr>
              ) : (
                asos.map(aso => (
                  <tr key={aso.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '16px', fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{aso.colaborador}</td>
                    <td style={{ padding: '16px', fontSize: 14, color: '#475569' }}>{aso.tipo_exame}</td>
                    <td style={{ padding: '16px', fontSize: 14, color: '#475569' }}>{new Date(aso.vencimento).toLocaleDateString('pt-BR')}</td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <span style={{ padding: '4px 10px', background: aso.status === 'VENCIDO' ? '#fee2e2' : '#d1fae5', color: aso.status === 'VENCIDO' ? '#b91c1c' : '#059669', borderRadius: 100, fontSize: 12, fontWeight: 700 }}>
                        {aso.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => handleOpenAsoPanel(aso)} style={{ padding: 6, borderRadius: 8, background: '#eff6ff', color: '#3b82f6', border: 'none', cursor: 'pointer' }}><Edit2 size={16}/></button>
                        <button onClick={() => handleDeleteAso(aso.id)} style={{ padding: 6, borderRadius: 8, background: '#fef2f2', color: '#ef4444', border: 'none', cursor: 'pointer' }}><Trash2 size={16}/></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* SidePanel Documentos */}
      <SidePanel isOpen={isDocPanelOpen} onClose={() => setIsDocPanelOpen(false)} title={editDocId ? `Editar ${docForm.tipo}` : `Novo ${docForm.tipo}`}>
        <form onSubmit={handleSaveDoc} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Título</label>
            <input required value={docForm.titulo} onChange={e => setDocForm({ ...docForm, titulo: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Revisão</label>
              <input value={docForm.revisao} onChange={e => setDocForm({ ...docForm, revisao: e.target.value })} placeholder="Ex: Rev. 02" style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Vigência</label>
              <input value={docForm.vigencia} onChange={e => setDocForm({ ...docForm, vigencia: e.target.value })} placeholder="Ex: Dez/2026" style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none' }} />
            </div>
          </div>
          {docForm.tipo === 'PCMSO' && (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Médico Coordenador</label>
              <input value={docForm.medico} onChange={e => setDocForm({ ...docForm, medico: e.target.value })} placeholder="Nome e CRM" style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none' }} />
            </div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Status</label>
            <select value={docForm.status} onChange={e => setDocForm({ ...docForm, status: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none' }}>
              <option value="VIGENTE">VIGENTE</option>
              <option value="VENCIDO">VENCIDO</option>
              <option value="EM ATUALIZAÇÃO">EM ATUALIZAÇÃO</option>
            </select>
          </div>
          <button type="submit" style={{ marginTop: 16, padding: '14px', background: '#3b82f6', color: '#fff', borderRadius: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Salvar Documento</button>
        </form>
      </SidePanel>

      {/* SidePanel ASO */}
      <SidePanel isOpen={isAsoPanelOpen} onClose={() => setIsAsoPanelOpen(false)} title={editAsoId ? 'Editar ASO' : 'Registrar ASO'}>
        <form onSubmit={handleSaveAso} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Colaborador</label>
            <input required value={asoForm.colaborador} onChange={e => setAsoForm({ ...asoForm, colaborador: e.target.value })} placeholder="Nome do funcionário" style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Tipo de Exame</label>
            <select value={asoForm.tipo_exame} onChange={e => setAsoForm({ ...asoForm, tipo_exame: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none' }}>
              <option value="Admissional">Admissional</option>
              <option value="Periódico">Periódico</option>
              <option value="Demissional">Demissional</option>
              <option value="Retorno ao Trabalho">Retorno ao Trabalho</option>
              <option value="Mudança de Função">Mudança de Função</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Data de Vencimento</label>
            <input required type="date" value={asoForm.vencimento} onChange={e => setAsoForm({ ...asoForm, vencimento: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Status</label>
            <select value={asoForm.status} onChange={e => setAsoForm({ ...asoForm, status: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none' }}>
              <option value="REGULAR">REGULAR</option>
              <option value="VENCE EM BREVE">VENCE EM BREVE</option>
              <option value="VENCIDO">VENCIDO</option>
            </select>
          </div>
          <button type="submit" style={{ marginTop: 16, padding: '14px', background: '#3b82f6', color: '#fff', borderRadius: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Salvar ASO</button>
        </form>
      </SidePanel>
    </div>
  )
}
