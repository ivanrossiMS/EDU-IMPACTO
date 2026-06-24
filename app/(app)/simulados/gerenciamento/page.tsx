'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { PenTool, Plus, FileText, Printer, MoreVertical, Search } from 'lucide-react'
import Link from 'next/link'

export default function GerenciamentoSimuladosPage() {
  const [searchTerm, setSearchTerm] = useState('')

  const [simulados] = useState([
    {
      id: '1',
      titulo: 'Simulado Geral 1º Bimestre',
      dataAplicacao: '2026-07-15',
      status: 'publicado', // rascunho, publicado
      questoesTotais: 90,
      questoesCadastradas: 90,
      series: ['9º Ano', '1ª Série', '2ª Série']
    },
    {
      id: '2',
      titulo: 'Simulado Diagnóstico',
      dataAplicacao: '2026-08-01',
      status: 'rascunho',
      questoesTotais: 50,
      questoesCadastradas: 15,
      series: ['6º Ano', '7º Ano', '8º Ano']
    }
  ])

  const filtered = simulados.filter(s => s.titulo.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <div style={{ padding: '40px', maxWidth: 1200, margin: '0 auto' }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, rgba(244,63,94,0.1), rgba(190,18,60,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(244,63,94,0.2)' }}>
              <PenTool size={24} color="#f43f5e" />
            </div>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.02em' }}>Gerenciar Simulados</h1>
              <p style={{ color: 'hsl(var(--text-secondary))', margin: '4px 0 0', fontSize: 14 }}>Crie, acompanhe e imprima as avaliações</p>
            </div>
          </div>
          
          <Link href="/simulados/gerenciamento/novo" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 12, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', fontWeight: 700, textDecoration: 'none' }}>
            <Plus size={18} /> Novo Simulado
          </Link>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={18} color="hsl(var(--text-muted))" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Buscar simulado..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '12px 16px 12px 44px', borderRadius: 12, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none' }}
            />
          </div>
        </div>

        <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'hsl(var(--bg-surface))', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                <th style={{ padding: '16px 24px', textAlign: 'left', color: 'hsl(var(--text-secondary))', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Título</th>
                <th style={{ padding: '16px 24px', textAlign: 'left', color: 'hsl(var(--text-secondary))', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Séries</th>
                <th style={{ padding: '16px 24px', textAlign: 'center', color: 'hsl(var(--text-secondary))', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Progresso (Questões)</th>
                <th style={{ padding: '16px 24px', textAlign: 'center', color: 'hsl(var(--text-secondary))', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                <th style={{ padding: '16px 24px', textAlign: 'right', color: 'hsl(var(--text-secondary))', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid hsl(var(--border-subtle))', transition: 'background 0.2s' }}>
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ fontWeight: 700, color: 'hsl(var(--text-primary))', fontSize: 15, marginBottom: 4 }}>{s.titulo}</div>
                    <div style={{ color: 'hsl(var(--text-secondary))', fontSize: 13 }}>Aplicação: {s.dataAplicacao}</div>
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {s.series.map(serie => (
                        <span key={serie} style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(100, 116, 139, 0.1)', color: 'hsl(var(--text-secondary))', fontSize: 11, fontWeight: 600 }}>{serie}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{ fontSize: 13, color: 'hsl(var(--text-primary))', fontWeight: 600 }}>{s.questoesCadastradas} / {s.questoesTotais}</div>
                      <div style={{ width: 100, height: 6, background: 'rgba(100, 116, 139, 0.2)', borderRadius: 100, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: s.questoesCadastradas >= s.questoesTotais ? '#10b981' : '#3b82f6', width: `${(s.questoesCadastradas / s.questoesTotais) * 100}%`, borderRadius: 100 }} />
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '20px 24px', textAlign: 'center' }}>
                    {s.status === 'publicado' ? (
                      <span style={{ padding: '6px 12px', borderRadius: 100, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Publicado</span>
                    ) : (
                      <span style={{ padding: '6px 12px', borderRadius: 100, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Rascunho</span>
                    )}
                  </td>
                  <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                      <Link href={`/simulados/imprimir/${s.id}`} target="_blank" style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(100, 116, 139, 0.1)', color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', textDecoration: 'none' }}>
                        <Printer size={16} />
                      </Link>
                      <button style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(100, 116, 139, 0.1)', color: 'hsl(var(--text-primary))', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 15 }}>
                    Nenhum simulado encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </motion.div>
    </div>
  )
}
