'use client'

import React, { useState } from 'react'
import { Shield, FileText, HeartPulse, HardHat, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'

export default function GestaoSST() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pgr' | 'pcmso' | 'aso'>('dashboard')

  const metrics = [
    { label: 'Exames ASO Vencidos', value: '2', icon: HeartPulse, color: '#ef4444' },
    { label: 'PGR Status', value: 'Regular', icon: FileText, color: '#10b981' },
    { label: 'PCMSO Validade', value: '4 meses', icon: FileText, color: '#f59e0b' },
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
          <p style={{ fontSize: 15, color: '#64748b' }}>
            Gestão Integrada de Saúde e Segurança do Trabalho, PGR e PCMSO.
          </p>
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
          {/* Metrics */}
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Compliance Legal */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 24, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 20, fontFamily: "'Outfit', sans-serif" }}>Documentação Legal</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { doc: 'Programa de Gerenciamento de Riscos (PGR)', status: 'Válido até Dez/2026', type: 'success' },
                  { doc: 'Programa de Controle Médico (PCMSO)', status: 'Válido até Out/2026', type: 'success' },
                  { doc: 'Laudo Técnico (LTCAT)', status: 'Atualização Necessária', type: 'warning' }
                ].map((d, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#f8fafc', borderRadius: 12, border: '1px solid #f1f5f9' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{d.doc}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{d.status}</div>
                    </div>
                    {d.type === 'success' ? <CheckCircle2 size={20} color="#10b981" /> : <AlertTriangle size={20} color="#f59e0b" />}
                  </div>
                ))}
              </div>
            </div>

            {/* ASOs Próximos do Vencimento */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 24, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 20, fontFamily: "'Outfit', sans-serif" }}>Alertas Médicos (ASO)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { name: 'João Silva', cargo: 'Professor', vencimento: 'Vencido há 5 dias', alert: true },
                  { name: 'Maria Souza', cargo: 'Auxiliar de Limpeza', vencimento: 'Vence em 15 dias', alert: true },
                  { name: 'Carlos Santos', cargo: 'Coordenador', vencimento: 'Vence em 30 dias', alert: false }
                ].map((a, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: a.alert ? '#fff1f2' : '#fffbeb', borderRadius: 12, borderLeft: a.alert ? '3px solid #ef4444' : '3px solid #f59e0b', borderRight: '1px solid #e2e8f0', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{a.name}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{a.cargo}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: a.alert ? '#e11d48' : '#d97706', background: a.alert ? '#ffe4e6' : '#fef3c7', padding: '4px 10px', borderRadius: 100 }}>
                      <Clock size={12} />
                      {a.vencimento}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'pgr' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 24, padding: 32, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>Documentos do PGR (NR-01)</h2>
            <button style={{ padding: '10px 20px', background: '#3b82f6', color: '#fff', borderRadius: 12, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              Novo Documento
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: 13, color: '#64748b', fontWeight: 700 }}>TIPO</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: 13, color: '#64748b', fontWeight: 700 }}>REVISÃO</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: 13, color: '#64748b', fontWeight: 700 }}>VIGÊNCIA</th>
                <th style={{ padding: '16px', textAlign: 'center', fontSize: 13, color: '#64748b', fontWeight: 700 }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '16px', fontSize: 14, fontWeight: 600, color: '#0f172a' }}>PGR Completo 2024</td>
                <td style={{ padding: '16px', fontSize: 14, color: '#475569' }}>Rev. 02</td>
                <td style={{ padding: '16px', fontSize: 14, color: '#475569' }}>Dez/2026</td>
                <td style={{ padding: '16px', textAlign: 'center' }}><span style={{ padding: '4px 10px', background: '#d1fae5', color: '#059669', borderRadius: 100, fontSize: 12, fontWeight: 700 }}>VIGENTE</span></td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '16px', fontSize: 14, fontWeight: 600, color: '#0f172a' }}>Plano de Ação - NR-01</td>
                <td style={{ padding: '16px', fontSize: 14, color: '#475569' }}>Rev. 04</td>
                <td style={{ padding: '16px', fontSize: 14, color: '#475569' }}>Nov/2025</td>
                <td style={{ padding: '16px', textAlign: 'center' }}><span style={{ padding: '4px 10px', background: '#d1fae5', color: '#059669', borderRadius: 100, fontSize: 12, fontWeight: 700 }}>VIGENTE</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'pcmso' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 24, padding: 32, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>Documentos do PCMSO (NR-07)</h2>
            <button style={{ padding: '10px 20px', background: '#3b82f6', color: '#fff', borderRadius: 12, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              Novo Documento
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: 13, color: '#64748b', fontWeight: 700 }}>TIPO</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: 13, color: '#64748b', fontWeight: 700 }}>MÉDICO COORDENADOR</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: 13, color: '#64748b', fontWeight: 700 }}>VIGÊNCIA</th>
                <th style={{ padding: '16px', textAlign: 'center', fontSize: 13, color: '#64748b', fontWeight: 700 }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '16px', fontSize: 14, fontWeight: 600, color: '#0f172a' }}>PCMSO Base 2024</td>
                <td style={{ padding: '16px', fontSize: 14, color: '#475569' }}>Dra. Ana Luiza (CRM: 12345)</td>
                <td style={{ padding: '16px', fontSize: 14, color: '#475569' }}>Out/2026</td>
                <td style={{ padding: '16px', textAlign: 'center' }}><span style={{ padding: '4px 10px', background: '#fef3c7', color: '#d97706', borderRadius: 100, fontSize: 12, fontWeight: 700 }}>ATENÇÃO</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'aso' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 24, padding: 32, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>Controle de ASOs</h2>
            <button style={{ padding: '10px 20px', background: '#3b82f6', color: '#fff', borderRadius: 12, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
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
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '16px', fontSize: 14, fontWeight: 600, color: '#0f172a' }}>João Silva</td>
                <td style={{ padding: '16px', fontSize: 14, color: '#475569' }}>Periódico</td>
                <td style={{ padding: '16px', fontSize: 14, color: '#ef4444', fontWeight: 600 }}>12/06/2024</td>
                <td style={{ padding: '16px', textAlign: 'center' }}><span style={{ padding: '4px 10px', background: '#fee2e2', color: '#b91c1c', borderRadius: 100, fontSize: 12, fontWeight: 700 }}>VENCIDO</span></td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '16px', fontSize: 14, fontWeight: 600, color: '#0f172a' }}>Maria Souza</td>
                <td style={{ padding: '16px', fontSize: 14, color: '#475569' }}>Admissional</td>
                <td style={{ padding: '16px', fontSize: 14, color: '#d97706', fontWeight: 600 }}>02/07/2024</td>
                <td style={{ padding: '16px', textAlign: 'center' }}><span style={{ padding: '4px 10px', background: '#fef3c7', color: '#d97706', borderRadius: 100, fontSize: 12, fontWeight: 700 }}>VENCE EM BREVE</span></td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '16px', fontSize: 14, fontWeight: 600, color: '#0f172a' }}>Carlos Santos</td>
                <td style={{ padding: '16px', fontSize: 14, color: '#475569' }}>Periódico</td>
                <td style={{ padding: '16px', fontSize: 14, color: '#059669' }}>15/08/2024</td>
                <td style={{ padding: '16px', textAlign: 'center' }}><span style={{ padding: '4px 10px', background: '#d1fae5', color: '#059669', borderRadius: 100, fontSize: 12, fontWeight: 700 }}>REGULAR</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Disclaimer NR-01 */}
      <div style={{ marginTop: 40, padding: 20, background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 16, display: 'flex', gap: 16 }}>
        <AlertTriangle size={24} color="#d97706" style={{ flexShrink: 0 }} />
        <div>
          <h4 style={{ fontSize: 14, fontWeight: 800, color: '#b45309', marginBottom: 4 }}>Aviso Legal (NR-01)</h4>
          <p style={{ fontSize: 13, color: '#92400e', lineHeight: 1.5, fontWeight: 500 }}>
            Este sistema atua como ferramenta facilitadora para a documentação e gestão das normas regulamentadoras vigentes. O uso do software não substitui a necessidade de laudos técnicos assinados por profissionais habilitados (Engenheiros de Segurança do Trabalho e Médicos do Trabalho) conforme prevê a legislação.
          </p>
        </div>
      </div>

    </div>
  )
}
