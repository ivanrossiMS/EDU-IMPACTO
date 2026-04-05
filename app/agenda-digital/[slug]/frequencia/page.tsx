'use client'

import React, { useState, use } from 'react'
import { Upload, CheckCircle2, AlertTriangle, FileText, Activity } from 'lucide-react'
import { useData } from '@/lib/dataContext'

export default function ADFrequenciaPage({ params }: { params: Promise<{ slug: string }>}) {
  const { alunos } = useData()
  const resolvedParams = use(params as Promise<{ slug: string }>)
  const aluno = alunos.find(a => a.id === resolvedParams.slug)
  
  const [atestadoModal, setAtestadoModal] = useState(false)
  const [atestadoSent, setAtestadoSent] = useState(false)

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault()
    setAtestadoSent(true)
    setTimeout(() => {
      setAtestadoModal(false)
      setAtestadoSent(false)
    }, 2000)
  }

  return (
    <div>
      <div className="ad-frequencia-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Frequência Escolar</h2>
        <button onClick={() => setAtestadoModal(true)} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Upload size={16} /> Enviar Atestado
        </button>
      </div>

      {/* Resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 32 }}>
        <div className="card ad-freq-card" style={{ padding: 24, background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(99,102,241,0.02))', border: '1px solid rgba(99,102,241,0.2)', position: 'relative', overflow: 'hidden' }}>
          <Activity size={120} style={{ position: 'absolute', right: -20, bottom: -20, opacity: 0.05, color: 'hsl(var(--primary))' }} />
          <div className="ad-freq-label" style={{ fontSize: 13, color: 'hsl(var(--primary))', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}>Presença Atual</div>
          <div className="ad-freq-number" style={{ fontSize: 48, fontWeight: 800, color: 'hsl(var(--text-main))', fontFamily: 'Outfit, sans-serif' }}>{aluno ? aluno.frequencia : 94}%</div>
          <div className="ad-freq-desc" style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Do total de dias letivos cursados</div>
        </div>
        <div className="card ad-freq-card" style={{ padding: 24 }}>
          <div className="ad-freq-label" style={{ fontSize: 13, color: 'hsl(var(--text-muted))', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}>Faltas Injustificadas</div>
          <div className="ad-freq-number" style={{ fontSize: 36, fontWeight: 800, color: 'hsl(var(--text-main))', fontFamily: 'Outfit, sans-serif' }}>{aluno ? Math.floor(Math.random() * 3) : 3}</div>
          <div className="ad-freq-desc" style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Neste bimestre</div>
        </div>
        <div className="card ad-freq-card" style={{ padding: 24 }}>
          <div className="ad-freq-label" style={{ fontSize: 13, color: 'hsl(var(--text-muted))', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}>Ausências Justificadas</div>
          <div className="ad-freq-number" style={{ fontSize: 36, fontWeight: 800, color: 'hsl(var(--text-main))', fontFamily: 'Outfit, sans-serif' }}>{aluno ? Math.floor(Math.random() * 2) : 2}</div>
          <div className="ad-freq-desc" style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Com atestado médico aprovado</div>
        </div>
      </div>

      {/* Gráfico Simulado */}
      <div className="card ad-freq-chart-card" style={{ padding: 24, marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 24 }}>Distribuição Mensal</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5%', height: 160, paddingBottom: 8, borderBottom: '1px solid hsl(var(--border-subtle))' }}>
          {[
             { m: 'Fev', p: 100 },
             { m: 'Mar', p: 90 },
             { m: 'Abr', p: 95 },
             { m: 'Mai', p: 100 },
             { m: 'Jun', p: null },
          ].map((item, i) => (
             <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%' }}>
               {item.p !== null ? (
                 <div style={{ 
                   width: '100%', 
                   maxWidth: 48, 
                   background: item.p >= 95 ? 'hsl(var(--primary))' : '#f59e0b',
                   height: `${item.p}%`, 
                   borderRadius: '6px 6px 0 0',
                   transition: 'height 1s',
                   marginTop: 'auto'
                 }}></div>
               ) : (
                 <div style={{ marginTop: 'auto', fontSize: 12, color: 'hsl(var(--text-muted))' }}>--</div>
               )}
               <div style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--text-muted))', marginTop: 8 }}>{item.m}</div>
             </div>
          ))}
        </div>
      </div>

      {/* Histórico Recente */}
      <div className="card ad-freq-hist-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="ad-freq-hist-header" style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-surface-alt))' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Histórico Recente</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="ad-freq-hist-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
               <div className="avatar" style={{ background: '#fef2f2', color: '#ef4444', padding: 8, borderRadius: 8 }}>
                 <AlertTriangle size={20} />
               </div>
               <div>
                 <div className="ad-freq-hist-title" style={{ fontWeight: 600 }}>Falta Integral</div>
                 <div className="ad-freq-hist-desc" style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>Terça-feira, 31 de Março</div>
               </div>
            </div>
            <div className="badge badge-error">Injustificada</div>
          </div>
          <div className="ad-freq-hist-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
               <div className="avatar" style={{ background: '#f0fdf4', color: '#16a34a', padding: 8, borderRadius: 8 }}>
                 <CheckCircle2 size={20} />
               </div>
               <div>
                 <div className="ad-freq-hist-title" style={{ fontWeight: 600 }}>Ausência Justificada</div>
                 <div className="ad-freq-hist-desc" style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>Quarta-feira, 15 de Março</div>
               </div>
            </div>
            <div className="badge badge-primary">Atestado Válido</div>
          </div>
        </div>
      </div>

      {/* Modal Atestado */}
      {atestadoModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setAtestadoModal(false)}>
          <div style={{ background: 'hsl(var(--bg-surface))', padding: 32, borderRadius: 24, width: '100%', maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>Enviar Atestado Médico</h3>
            {!atestadoSent ? (
              <form onSubmit={handleUpload}>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label>Data da Falta</label>
                  <input type="date" className="form-input" required />
                </div>
                <div className="form-group" style={{ marginBottom: 24 }}>
                  <label>Anexar Documento</label>
                  <div style={{ border: '2px dashed hsl(var(--border-subtle))', padding: 32, borderRadius: 12, textAlign: 'center', cursor: 'pointer', background: 'hsl(var(--bg-surface-alt))' }}>
                    <FileText size={32} style={{ margin: '0 auto 8px', color: 'hsl(var(--primary))' }} />
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Clique para selecionar</div>
                    <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>JPG, PNG ou PDF</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setAtestadoModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Enviar via APP</button>
                </div>
              </form>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <CheckCircle2 size={64} color="#10b981" style={{ margin: '0 auto 16px' }} />
                <h4 style={{ fontSize: 18, fontWeight: 700 }}>Atestado Enviado!</h4>
                <p style={{ fontSize: 14, color: 'hsl(var(--text-muted))', marginTop: 8 }}>A nossa secretaria irá analisar o documento em breve.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
