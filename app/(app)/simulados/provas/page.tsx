'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FileText, Printer, Search, BookOpen, AlertCircle, Calendar } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function ProvasGeradasPage() {
  const [provas, setProvas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchProvas()
  }, [])

  const fetchProvas = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('simulados')
      .select(`
        *,
        simulados_bimestres (nome)
      `)
      .order('created_at', { ascending: false })
    
    if (data) {
      setProvas(data)
    }
    setLoading(false)
  }

  const filtered = provas.filter(p => p.titulo.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <div style={{ padding: '40px', maxWidth: 1200, margin: '0 auto' }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, rgba(244,63,94,0.1), rgba(190,18,60,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(244,63,94,0.2)' }}>
              <FileText size={24} color="#f43f5e" />
            </div>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.02em' }}>Provas Geradas</h1>
              <p style={{ color: 'hsl(var(--text-secondary))', margin: '4px 0 0', fontSize: 14 }}>Visualize e imprima os cadernos de provas</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={18} color="hsl(var(--text-muted))" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Buscar provas..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '12px 16px 12px 44px', borderRadius: 12, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none' }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(244,63,94,0.2)', borderTopColor: '#f43f5e', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            Carregando provas...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', background: 'hsl(var(--bg-surface))', border: '1px dashed hsl(var(--border-subtle))', borderRadius: 20 }}>
            <AlertCircle size={40} color="hsl(var(--text-muted))" style={{ margin: '0 auto 16px' }} />
            <div style={{ color: 'hsl(var(--text-primary))', fontWeight: 600, fontSize: 16 }}>Nenhuma prova encontrada</div>
            <div style={{ color: 'hsl(var(--text-muted))', fontSize: 14, marginTop: 4 }}>As provas geradas no gerenciamento aparecerão aqui.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {filtered.map(prova => (
              <div key={prova.id} style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', transition: 'all 0.2s', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div style={{ padding: '6px 12px', background: prova.status === 'publicado' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: prova.status === 'publicado' ? '#10b981' : '#f59e0b', borderRadius: 8, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                    {prova.status}
                  </div>
                  <div style={{ padding: '6px 12px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: 8, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                    {prova.tipo}
                  </div>
                </div>
                
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'hsl(var(--text-primary))', margin: '0 0 8px 0', lineHeight: 1.3 }}>
                  {prova.titulo}
                </h3>
                
                <div style={{ fontSize: 14, color: 'hsl(var(--text-secondary))', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={14} /> Aplicação: {prova.data_aplicacao ? new Date(prova.data_aplicacao).toLocaleDateString('pt-BR') : 'Não definida'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BookOpen size={14} /> Bimestre: {prova.simulados_bimestres?.nome || 'N/A'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
                  {(prova.series || []).map((serie: string) => (
                    <span key={serie} style={{ padding: '4px 8px', borderRadius: 6, background: 'hsl(var(--bg-app))', color: 'hsl(var(--text-secondary))', fontSize: 11, fontWeight: 600, border: '1px solid hsl(var(--border-subtle))' }}>
                      {serie}
                    </span>
                  ))}
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', gap: 12 }}>
                  <Link href={`/simulados/imprimir/${prova.id}`} style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg, #f43f5e, #be123c)', color: '#fff', textAlign: 'center', borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'opacity 0.2s' }}>
                    <Printer size={16} /> Imprimir Caderno
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
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
