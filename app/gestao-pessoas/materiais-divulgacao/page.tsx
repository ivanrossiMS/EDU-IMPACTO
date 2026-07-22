'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import {
  Megaphone,
  Eye,
  ExternalLink,
  Plus,
  Search,
  Copy,
  Layers,
  Award,
  Check,
  X,
  Edit3,
  Trash2,
  AlertTriangle
} from 'lucide-react'

interface MaterialItem {
  id: string
  titulo: string
  descricao: string
  categoria: string
  link: string
  imagem_url?: string | null
  contador_visitas: number
  tags: string[]
  autor: string
  data_publicacao: string
  destaque?: boolean
}

export default function MateriaisDivulgacaoPage() {
  const [materiais, setMateriais] = useState<MaterialItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCategoria, setSelectedCategoria] = useState<string>('Todas')
  const [sortBy, setSortBy] = useState<'visitas' | 'recentes' | 'titulo'>('visitas')
  
  // Modals state
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<MaterialItem | null>(null)
  const [deletingItem, setDeletingItem] = useState<MaterialItem | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Form State
  const [formTitulo, setFormTitulo] = useState('')
  const [formDescricao, setFormDescricao] = useState('')
  const [formCategoria, setFormCategoria] = useState('Guias & E-books')
  const [formLink, setFormLink] = useState('')
  const [formImagemUrl, setFormImagemUrl] = useState('')
  const [formAutor, setFormAutor] = useState('Equipe Pedagógica')
  const [formTags, setFormTags] = useState('Divulgação, Escola')

  // Fetch materials with localStorage persistence fallback
  const loadMateriais = async () => {
    try {
      setLoading(true)
      let localVisits: Record<string, number> = {}
      try {
        const saved = localStorage.getItem('impacto_materiais_visitas')
        if (saved) localVisits = JSON.parse(saved)
      } catch (e) {}

      const res = await fetch('/api/gestao-pessoas/materiais-divulgacao')
      const json = await res.json()
      if (json.success && json.data) {
        const merged = json.data.map((item: MaterialItem) => {
          const lCount = localVisits[item.id] || 0
          const apiCount = item.contador_visitas || 0
          return {
            ...item,
            contador_visitas: Math.max(apiCount, lCount)
          }
        })
        setMateriais(merged)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMateriais()
  }, [])

  // Handle visit increment and navigate to link
  const handleOpenMaterial = async (item: MaterialItem) => {
    const newCount = (item.contador_visitas || 0) + 1

    setMateriais(prev =>
      prev.map(m => (m.id === item.id ? { ...m, contador_visitas: newCount } : m))
    )

    try {
      const saved = localStorage.getItem('impacto_materiais_visitas')
      const localVisits = saved ? JSON.parse(saved) : {}
      localVisits[item.id] = newCount
      localStorage.setItem('impacto_materiais_visitas', JSON.stringify(localVisits))
    } catch (e) {}

    try {
      fetch('/api/gestao-pessoas/materiais-divulgacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'increment_visit', id: item.id })
      }).catch(() => {})
    } catch (e) {
      console.error(e)
    }

    if (item.link.startsWith('/')) {
      window.open(item.link, '_blank')
    } else {
      window.open(item.link.startsWith('http') ? item.link : `https://${item.link}`, '_blank')
    }
  }

  // Copy material link
  const handleCopyLink = (item: MaterialItem) => {
    const fullUrl = item.link.startsWith('/')
      ? `${window.location.origin}${item.link}`
      : item.link
    navigator.clipboard.writeText(fullUrl)
    setCopiedId(item.id)
    setTimeout(() => setCopiedId(null), 2500)
  }

  // Open modal for new item
  const handleOpenNewModal = () => {
    setEditingItem(null)
    setFormTitulo('')
    setFormDescricao('')
    setFormCategoria('Guias & E-books')
    setFormLink('')
    setFormImagemUrl('')
    setFormAutor('Equipe Pedagógica')
    setFormTags('Divulgação, Escola')
    setShowModal(true)
  }

  // Open modal for editing existing item
  const handleOpenEditModal = (item: MaterialItem) => {
    setEditingItem(item)
    setFormTitulo(item.titulo)
    setFormDescricao(item.descricao)
    setFormCategoria(item.categoria)
    setFormLink(item.link)
    setFormImagemUrl(item.imagem_url || '')
    setFormAutor(item.autor)
    setFormTags(item.tags ? item.tags.join(', ') : '')
    setShowModal(true)
  }

  // Save (Create or Update)
  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTitulo || !formLink) return

    const tagsArray = formTags.split(',').map(t => t.trim()).filter(Boolean)

    if (editingItem) {
      // UPDATE EXISTING
      const payload = {
        action: 'update',
        id: editingItem.id,
        titulo: formTitulo,
        descricao: formDescricao,
        categoria: formCategoria,
        link: formLink,
        imagem_url: formImagemUrl || null,
        autor: formAutor,
        tags: tagsArray.length > 0 ? tagsArray : ['Divulgação']
      }

      setMateriais(prev =>
        prev.map(m => (m.id === editingItem.id ? { ...m, ...payload } : m))
      )

      try {
        await fetch('/api/gestao-pessoas/materiais-divulgacao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } catch (e) {
        console.error(e)
      }
    } else {
      // CREATE NEW
      const payload = {
        action: 'create',
        titulo: formTitulo,
        descricao: formDescricao,
        categoria: formCategoria,
        link: formLink,
        imagem_url: formImagemUrl || null,
        autor: formAutor,
        tags: tagsArray.length > 0 ? tagsArray : ['Divulgação']
      }

      try {
        const res = await fetch('/api/gestao-pessoas/materiais-divulgacao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        const json = await res.json()
        if (json.success && json.newItem) {
          setMateriais(prev => [json.newItem, ...prev])
        }
      } catch (e) {
        console.error(e)
      }
    }

    setShowModal(false)
  }

  // Delete Material
  const handleConfirmDelete = async () => {
    if (!deletingItem) return

    const targetId = deletingItem.id

    // Update local state immediately
    setMateriais(prev => prev.filter(m => m.id !== targetId))

    // Remove from localStorage cache
    try {
      const saved = localStorage.getItem('impacto_materiais_visitas')
      if (saved) {
        const localVisits = JSON.parse(saved)
        delete localVisits[targetId]
        localStorage.setItem('impacto_materiais_visitas', JSON.stringify(localVisits))
      }
    } catch (e) {}

    // Call API to delete from Supabase
    try {
      await fetch('/api/gestao-pessoas/materiais-divulgacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: targetId })
      })
    } catch (e) {
      console.error(e)
    }

    setDeletingItem(null)
  }

  const categorias = ['Todas', 'Guias & E-books', 'Manuais & Tutoriais', 'Campanhas & Folders', 'Formulários & Pesquisas']

  // Filter & Sort
  const filteredMateriais = materiais
    .filter(m => {
      const matchesSearch =
        m.titulo.toLowerCase().includes(search.toLowerCase()) ||
        m.descricao.toLowerCase().includes(search.toLowerCase()) ||
        m.tags.some(t => t.toLowerCase().includes(search.toLowerCase())) ||
        m.autor.toLowerCase().includes(search.toLowerCase())
      const matchesCat = selectedCategoria === 'Todas' || m.categoria === selectedCategoria
      return matchesSearch && matchesCat
    })
    .sort((a, b) => {
      if (sortBy === 'visitas') return (b.contador_visitas || 0) - (a.contador_visitas || 0)
      if (sortBy === 'recentes') return new Date(b.data_publicacao).getTime() - new Date(a.data_publicacao).getTime()
      return a.titulo.localeCompare(b.titulo)
    })

  const totalVisitas = materiais.reduce((acc, curr) => acc + (curr.contador_visitas || 0), 0)
  const maisVisitado = [...materiais].sort((a, b) => (b.contador_visitas || 0) - (a.contador_visitas || 0))[0]

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      color: '#0f172a',
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: '36px 32px 80px',
      maxWidth: 1400,
      margin: '0 auto'
    }}>
      
      {/* ──────────────── HEADER DA PÁGINA ──────────────── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20,
        marginBottom: 32,
        paddingBottom: 24,
        borderBottom: '1px solid #e2e8f0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            backgroundColor: '#0047ab',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(0, 71, 171, 0.2)'
          }}>
            <Megaphone size={26} />
          </div>
          <div>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#0047ab' }}>
              Gestão de Pessoas & Comunicação
            </span>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', margin: '2px 0 0 0', letterSpacing: '-0.02em' }}>
              Materiais de Divulgação
            </h1>
            <p style={{ fontSize: 14, color: '#64748b', margin: '2px 0 0 0' }}>
              Central de guias e e-books oficiais do Colégio Impacto com rastreamento real de acessos.
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenNewModal}
          style={{
            padding: '12px 24px',
            borderRadius: 14,
            border: 'none',
            backgroundColor: '#0047ab',
            color: '#ffffff',
            fontSize: 14,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 6px 18px rgba(0, 71, 171, 0.25)',
            transition: 'all 0.2s'
          }}
        >
          <Plus size={18} />
          <span>+ Novo Material</span>
        </button>
      </div>


      {/* ──────────────── CARDS DE MÉTRICAS ──────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 20,
        marginBottom: 32
      }}>
        
        <div style={{
          backgroundColor: '#ffffff',
          padding: 24,
          borderRadius: 20,
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
          display: 'flex',
          alignItems: 'center',
          gap: 16
        }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: '#eff6ff', color: '#0047ab', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={24} />
          </div>
          <div>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Materiais Cadastrados</span>
            <p style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', margin: 0 }}>
              {materiais.length} <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>reais</span>
            </p>
          </div>
        </div>

        <div style={{
          backgroundColor: '#ffffff',
          padding: 24,
          borderRadius: 20,
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
          display: 'flex',
          alignItems: 'center',
          gap: 16
        }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Eye size={24} />
          </div>
          <div>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Total de Visitas Registradas</span>
            <p style={{ fontSize: 24, fontWeight: 900, color: '#059669', margin: 0 }}>
              {totalVisitas} <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>acessos</span>
            </p>
          </div>
        </div>

        <div style={{
          backgroundColor: '#ffffff',
          padding: 24,
          borderRadius: 20,
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
          display: 'flex',
          alignItems: 'center',
          gap: 16
        }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Award size={24} />
          </div>
          <div style={{ overflow: 'hidden' }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Mais Acessado</span>
            <p style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {maisVisitado ? maisVisitado.titulo : 'Nenhum'}
            </p>
            {maisVisitado && (
              <span style={{ fontSize: 12, color: '#d97706', fontWeight: 700 }}>
                🔥 {maisVisitado.contador_visitas || 0} acessos
              </span>
            )}
          </div>
        </div>

      </div>


      {/* ──────────────── BANNER EM DESTAQUE ──────────────── */}
      {maisVisitado && (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 24,
          border: '1px solid #bfdbfe',
          padding: '32px 28px',
          marginBottom: 36,
          background: 'linear-gradient(135deg, #ffffff 0%, #f0f6ff 100%)',
          boxShadow: '0 8px 28px rgba(0, 71, 171, 0.06)',
          position: 'relative'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 28,
            alignItems: 'center'
          }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ backgroundColor: '#0047ab', color: '#ffffff', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 12px', borderRadius: 20 }}>
                    ⭐ Material em Destaque
                  </span>
                  <span style={{ backgroundColor: '#ecfdf5', color: '#047857', fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 20, border: '1px solid #a7f3d0' }}>
                    👁️ {maisVisitado.contador_visitas || 0} Acessos Registrados
                  </span>
                </div>

                {/* Edit / Delete Action Buttons for Featured */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    onClick={() => handleOpenEditModal(maisVisitado)}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}
                    title="Editar Material"
                  >
                    <Edit3 size={14} color="#0047ab" />
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => setDeletingItem(maisVisitado)}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #fca5a5', backgroundColor: '#fef2f2', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}
                    title="Excluir Material"
                  >
                    <Trash2 size={14} />
                    <span>Excluir</span>
                  </button>
                </div>
              </div>

              <h2 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', margin: 0, lineHeight: 1.2 }}>
                {maisVisitado.titulo}
              </h2>

              <p style={{ fontSize: 14, color: '#475569', margin: 0, lineHeight: 1.6 }}>
                {maisVisitado.descricao}
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, paddingTop: 6 }}>
                <button
                  onClick={() => handleOpenMaterial(maisVisitado)}
                  style={{
                    padding: '12px 24px',
                    borderRadius: 14,
                    border: 'none',
                    backgroundColor: '#0047ab',
                    color: '#ffffff',
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 4px 14px rgba(0, 71, 171, 0.3)'
                  }}
                >
                  <ExternalLink size={16} />
                  <span>Acessar Material Clicável</span>
                </button>

                <button
                  onClick={() => handleCopyLink(maisVisitado)}
                  style={{
                    padding: '12px 20px',
                    borderRadius: 14,
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  {copiedId === maisVisitado.id ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                  <span>{copiedId === maisVisitado.id ? 'Link Copiado!' : 'Copiar Link Público'}</span>
                </button>
              </div>
            </div>

            {maisVisitado.imagem_url && (
              <div style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 8px 20px rgba(0,0,0,0.06)' }}>
                <Image
                  src={maisVisitado.imagem_url}
                  alt={maisVisitado.titulo}
                  width={600}
                  height={320}
                  style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover' }}
                />
              </div>
            )}

          </div>
        </div>
      )}


      {/* ──────────────── BARRA DE FERRAMENTAS & FILTROS ──────────────── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 28,
        backgroundColor: '#ffffff',
        padding: 16,
        borderRadius: 20,
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
      }}>
        
        <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
          <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por título, tag ou autor..."
            style={{
              width: '100%',
              padding: '10px 14px 10px 42px',
              borderRadius: 12,
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#0f172a',
              fontSize: 13,
              outline: 'none'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {categorias.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategoria(cat)}
              style={{
                padding: '7px 14px',
                borderRadius: 10,
                border: 'none',
                backgroundColor: selectedCategoria === cat ? '#0047ab' : '#f1f5f9',
                color: selectedCategoria === cat ? '#ffffff' : '#475569',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Ordenar:</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#0f172a',
              fontSize: 12,
              fontWeight: 700,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="visitas">🔥 Mais Visitados</option>
            <option value="recentes">📅 Mais Recentes</option>
            <option value="titulo">🔤 Título (A-Z)</option>
          </select>
        </div>

      </div>


      {/* ──────────────── GRID DE CARDS DE MATERIAIS ──────────────── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
          <div style={{ width: 36, height: 36, border: '3px solid #cbd5e1', borderTopColor: '#0047ab', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
          <p style={{ fontSize: 14, margin: 0 }}>Carregando materiais de divulgação...</p>
        </div>
      ) : filteredMateriais.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', backgroundColor: '#ffffff', borderRadius: 24, border: '1px solid #e2e8f0' }}>
          <Megaphone size={40} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>Nenhum material encontrado</p>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0 0' }}>Tente ajustar a busca ou clicar em "+ Novo Material".</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 24
        }}>
          {filteredMateriais.map((item) => (
            <div
              key={item.id}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 20,
                border: '1px solid #e2e8f0',
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 16,
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
                transition: 'all 0.2s',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                
                {/* Category, Visits Counter & Edit/Delete Action Icons */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{
                    backgroundColor: '#eff6ff',
                    color: '#0047ab',
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: 12,
                    border: '1px solid #bfdbfe'
                  }}>
                    {item.categoria}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: '#ecfdf5',
                      color: '#047857',
                      fontSize: 12,
                      fontWeight: 800,
                      padding: '4px 10px',
                      borderRadius: 12,
                      border: '1px solid #a7f3d0'
                    }}>
                      <Eye size={14} />
                      <span>{item.contador_visitas || 0} acessos</span>
                    </div>

                    {/* Edit Icon */}
                    <button
                      onClick={() => handleOpenEditModal(item)}
                      style={{
                        padding: '6px',
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#0047ab',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Editar Material"
                    >
                      <Edit3 size={14} />
                    </button>

                    {/* Delete Icon */}
                    <button
                      onClick={() => setDeletingItem(item)}
                      style={{
                        padding: '6px',
                        borderRadius: 8,
                        border: '1px solid #fca5a5',
                        backgroundColor: '#fef2f2',
                        color: '#dc2626',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Excluir Material"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Title */}
                <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: 0, lineHeight: 1.3 }}>
                  {item.titulo}
                </h3>

                {/* Description */}
                <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {item.descricao}
                </p>

                {/* Tags */}
                {item.tags && item.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 4 }}>
                    {item.tags.map(t => (
                      <span key={t} style={{ fontSize: 10, fontWeight: 700, backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 8 }}>
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Card Footer: Action Buttons */}
              <div style={{ paddingTop: 16, borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
                
                {/* Clickable Link Button */}
                <button
                  onClick={() => handleOpenMaterial(item)}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: 12,
                    border: 'none',
                    backgroundColor: '#0047ab',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    boxShadow: '0 4px 12px rgba(0, 71, 171, 0.2)'
                  }}
                >
                  <ExternalLink size={14} />
                  <span>Acessar Material</span>
                </button>

                {/* Copy Link Button */}
                <button
                  onClick={() => handleCopyLink(item)}
                  style={{
                    padding: '10px',
                    borderRadius: 12,
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Copiar Link de Divulgação"
                >
                  {copiedId === item.id ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                </button>

              </div>

            </div>
          ))}
        </div>
      )}


      {/* ──────────────── MODAL: CADASTRAR OU EDITAR MATERIAL ──────────────── */}
      {showModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 24,
            padding: 32,
            width: '100%',
            maxWidth: 540,
            boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: 20
          }}>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', margin: 0 }}>
                {editingItem ? '✏️ Editar Material' : '+ Cadastrar Novo Material'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveMaterial} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
                  Título do Material *
                </label>
                <input
                  type="text"
                  required
                  value={formTitulo}
                  onChange={e => setFormTitulo(e.target.value)}
                  placeholder="Ex: Guia de Segurança Digital"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', fontSize: 13, outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
                  Link Clicável (URL pública ou rota interna) *
                </label>
                <input
                  type="text"
                  required
                  value={formLink}
                  onChange={e => setFormLink(e.target.value)}
                  placeholder="Ex: /guia-seguranca"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', fontSize: 13, outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
                  Categoria
                </label>
                <select
                  value={formCategoria}
                  onChange={e => setFormCategoria(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', fontSize: 13, outline: 'none' }}
                >
                  <option value="Guias & E-books">Guias & E-books</option>
                  <option value="Manuais & Tutoriais">Manuais & Tutoriais</option>
                  <option value="Campanhas & Folders">Campanhas & Folders</option>
                  <option value="Formulários & Pesquisas">Formulários & Pesquisas</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
                  Descrição Curta
                </label>
                <textarea
                  rows={3}
                  value={formDescricao}
                  onChange={e => setFormDescricao(e.target.value)}
                  placeholder="Resumo sobre o objetivo e público do material..."
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', fontSize: 13, outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
                  Tags (separadas por vírgula)
                </label>
                <input
                  type="text"
                  value={formTags}
                  onChange={e => setFormTags(e.target.value)}
                  placeholder="Segurança, Família, E-book"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', fontSize: 13, outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid #cbd5e1', backgroundColor: 'transparent', color: '#64748b', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 20px', borderRadius: 10, border: 'none', backgroundColor: '#0047ab', color: '#ffffff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
                >
                  {editingItem ? 'Salvar Alterações' : 'Salvar Material'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}


      {/* ──────────────── MODAL: CONFIRMAÇÃO DE EXCLUSÃO ──────────────── */}
      {deletingItem && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          backgroundColor: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #fee2e2',
            borderRadius: 24,
            padding: 32,
            width: '100%',
            maxWidth: 460,
            boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 16
          }}>
            
            <div style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={28} />
            </div>

            <h3 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', margin: 0 }}>
              Excluir Material?
            </h3>

            <p style={{ fontSize: 14, color: '#475569', margin: 0, lineHeight: 1.5 }}>
              Tem certeza que deseja excluir o material <strong>&quot;{deletingItem.titulo}&quot;</strong>? Esta ação removerá o item da lista e não poderá ser desfeita.
            </p>

            <div style={{ display: 'flex', gap: 12, width: '100%', paddingTop: 12 }}>
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#64748b', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', backgroundColor: '#dc2626', color: '#ffffff', fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)' }}
              >
                Sim, Excluir
              </button>
            </div>

          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>

    </div>
  )
}
