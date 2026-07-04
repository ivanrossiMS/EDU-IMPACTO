'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Users, Search, AlertCircle, Plus } from 'lucide-react'
import Link from 'next/link'

export default function ProfessoresPage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const refresh = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/configuracoes/usuarios?type=colaboradores&limit=1000')
      if (res.ok) {
        const json = await res.json()
        const profs = (json.data || []).filter((u: any) => u.perfil?.toLowerCase() === 'professor')
        setData(profs)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  const filtered = data?.filter(item => item.nome.toLowerCase().includes(search.toLowerCase())) || []

  return (
    <div className="professores-container" style={{ padding: '40px' }}>
      <style>{`
        @media (max-width: 768px) {
          .professores-container { padding: 16px !important; margin: 0 !important; }
          .responsive-header { flex-direction: column !important; align-items: flex-start !important; gap: 16px !important; }
          .responsive-btn { width: 100% !important; justify-content: center !important; }
          .responsive-header a { width: 100% !important; }
          .responsive-list-item { flex-direction: column !important; align-items: flex-start !important; gap: 12px !important; }
        }
      `}</style>
      <div className="responsive-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, rgba(244,63,94,0.1), rgba(190,18,60,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(244,63,94,0.2)' }}>
            <Users size={24} color="#f43f5e" />
          </div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.02em' }}>Professores</h1>
            <p style={{ color: 'hsl(var(--text-secondary))', margin: '4px 0 0', fontSize: 14 }}>Autores das questões e provas (Sincronizado com Usuários)</p>
          </div>
        </div>
        <Link href="/configuracoes/usuarios" style={{ width: 'auto' }}>
          <button 
            className="responsive-btn"
            style={{ background: 'linear-gradient(135deg, #f43f5e, #be123c)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
          >
            <Plus size={18} /> Cadastrar no Sistema
          </button>
        </Link>
      </div>

      <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '16px 20px', borderRadius: 12, display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 32 }}>
        <AlertCircle size={24} color="#3b82f6" style={{ flexShrink: 0 }} />
        <div>
          <div style={{ color: '#2563eb', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Sincronizado automaticamente</div>
          <div style={{ color: 'hsl(var(--text-secondary))', fontSize: 14, lineHeight: 1.5 }}>
            Os professores agora são carregados diretamente do cadastro global de usuários do sistema (onde o perfil seja "Professor"). Para adicionar ou editar, vá em Configurações &gt; Usuários.
          </div>
        </div>
      </div>

      <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 24, padding: 24 }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={18} color="hsl(var(--text-muted))" style={{ position: 'absolute', left: 16, top: 14 }} />
            <input 
              type="text" 
              placeholder="Buscar professor..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '12px 16px 12px 48px', borderRadius: 12, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15 }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'hsl(var(--text-muted))' }}>Carregando...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(item => (
              <div key={item.id} className="responsive-list-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 20, background: 'hsl(var(--bg-app))', borderRadius: 16, border: '1px solid hsl(var(--border-subtle))' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 20, background: 'rgba(100, 116, 139, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-primary))', fontWeight: 800, fontSize: 18 }}>
                    {item.nome.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{item.nome}</div>
                    <div style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', marginTop: 4 }}>
                      {item.email || 'Sem e-mail cadastrado'} • Status: {item.status}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'hsl(var(--text-muted))' }}>Nenhum professor encontrado.</div>}
          </div>
        )}
      </div>
    </div>
  )
}
