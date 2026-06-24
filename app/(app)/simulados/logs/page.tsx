'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CheckSquare, Search, AlertCircle, Clock, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function LogsSimuladosPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('simulados_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    
    if (data) setLogs(data)
    setLoading(false)
  }

  const filtered = logs.filter(l => 
    (l.acao || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.usuario || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.descricao || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div style={{ padding: '40px', maxWidth: 1200, margin: '0 auto' }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, rgba(244,63,94,0.1), rgba(190,18,60,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(244,63,94,0.2)' }}>
              <CheckSquare size={24} color="#f43f5e" />
            </div>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.02em' }}>Logs & Auditoria</h1>
              <p style={{ color: 'hsl(var(--text-secondary))', margin: '4px 0 0', fontSize: 14 }}>Acompanhe todas as ações realizadas no módulo de Simulados</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={18} color="hsl(var(--text-muted))" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Pesquisar logs por ação, usuário ou descrição..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '12px 16px 12px 44px', borderRadius: 12, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none' }}
            />
          </div>
        </div>

        <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(244,63,94,0.2)', borderTopColor: '#f43f5e', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
              Carregando logs...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <AlertCircle size={40} color="hsl(var(--text-muted))" style={{ margin: '0 auto 16px' }} />
              <div style={{ color: 'hsl(var(--text-primary))', fontWeight: 600, fontSize: 16 }}>Nenhum log encontrado</div>
              <div style={{ color: 'hsl(var(--text-muted))', fontSize: 14, marginTop: 4 }}>As atividades dos usuários aparecerão aqui.</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'hsl(var(--bg-surface))', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                  <th style={{ padding: '16px 24px', textAlign: 'left', color: 'hsl(var(--text-secondary))', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ação / Data</th>
                  <th style={{ padding: '16px 24px', textAlign: 'left', color: 'hsl(var(--text-secondary))', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Descrição</th>
                  <th style={{ padding: '16px 24px', textAlign: 'right', color: 'hsl(var(--text-secondary))', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Usuário</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid hsl(var(--border-subtle))', transition: 'background 0.2s' }}>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ fontWeight: 700, color: 'hsl(var(--text-primary))', fontSize: 14, marginBottom: 4 }}>{log.acao}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'hsl(var(--text-secondary))', fontSize: 12 }}>
                        <Clock size={12} /> {new Date(log.created_at).toLocaleString('pt-BR')}
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ color: 'hsl(var(--text-secondary))', fontSize: 14, maxWidth: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.descricao || '-'}
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: 100, fontSize: 12, fontWeight: 600 }}>
                        <User size={12} /> {log.usuario || 'Sistema'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}} />
    </div>
  )
}
