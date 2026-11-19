'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Megaphone, Volume2, Square, Plus,
  Search, Star, Bell, RotateCcw, Clock, Trash2, Edit3, Check,
  Copy, Sliders, Radio, Users, Car, Coffee, AlertTriangle,
  X
} from 'lucide-react'
import { useSaida, SchoolAnnouncement, AnnouncementHistoryItem } from '@/lib/saidaContext'
import { useVoice } from '@/lib/hooks/useVoice'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useApp } from '@/lib/context'

// ── Categorias de Anúncios com Cores Vivas e Adaptativas ──────────────────────
type CategoryKey = 'todas' | 'favoritas' | 'portaria' | 'intervalo' | 'comunicado' | 'veiculos' | 'emergencia' | 'geral'

interface CategoryMeta {
  key: CategoryKey
  label: string
  icon: any
  color: string
  bg: string
  border: string
  text: string
}

const CATEGORIES: CategoryMeta[] = [
  { key: 'todas', label: 'Todas as Frases', icon: Radio, color: '#0284c7', bg: 'rgba(2, 132, 199, 0.08)', border: 'rgba(2, 132, 199, 0.25)', text: '#0369a1' },
  { key: 'favoritas', label: 'Favoritas', icon: Star, color: '#d97706', bg: 'rgba(217, 119, 6, 0.08)', border: 'rgba(217, 119, 6, 0.25)', text: '#b45309' },
  { key: 'portaria', label: 'Portaria & Saída', icon: Users, color: '#db2777', bg: 'rgba(219, 39, 119, 0.08)', border: 'rgba(219, 39, 119, 0.25)', text: '#be185d' },
  { key: 'intervalo', label: 'Recreio & Intervalo', icon: Coffee, color: '#059669', bg: 'rgba(5, 150, 105, 0.08)', border: 'rgba(5, 150, 105, 0.25)', text: '#047857' },
  { key: 'comunicado', label: 'Comunicados & Avisos', icon: Megaphone, color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.08)', border: 'rgba(124, 58, 237, 0.25)', text: '#6d28d9' },
  { key: 'veiculos', label: 'Estacionamento & Veículos', icon: Car, color: '#4f46e5', bg: 'rgba(79, 70, 229, 0.08)', border: 'rgba(79, 70, 229, 0.25)', text: '#4338ca' },
  { key: 'emergencia', label: 'Atenção & Silêncio', icon: AlertTriangle, color: '#dc2626', bg: 'rgba(220, 38, 38, 0.08)', border: 'rgba(220, 38, 38, 0.25)', text: '#b91c1c' },
]

const CATEGORIES_BY_KEY: Record<string, CategoryMeta> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c])
)

const ANUNCIAR_STYLES = `
  @keyframes anunciarFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes anunciarToastIn {
    from { opacity: 0; transform: translateY(-14px) scale(0.96); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes anunciarDrawerIn {
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes anunciarModalIn {
    from { opacity: 0; transform: translateY(10px) scale(0.96); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes anunciarEqBounce {
    0%, 100% { transform: scaleY(0.25); }
    50%      { transform: scaleY(1); }
  }
  .anunciar-eq-bar {
    width: 3px;
    height: 18px;
    border-radius: 2px;
    transform-origin: bottom;
    transform: scaleY(0.22);
    transition: transform 0.2s ease, opacity 0.2s ease;
  }
  .anunciar-eq-bar--active {
    animation: anunciarEqBounce 0.65s ease-in-out infinite;
  }
  .anunciar-cta-btn {
    transition: transform 0.15s ease, opacity 0.15s ease;
  }
  .anunciar-cta-btn:not(:disabled):hover {
    transform: scale(1.02);
  }
  .anunciar-cta-btn:not(:disabled):active {
    transform: scale(0.97);
  }
  .anunciar-phrase-card {
    border-radius: 20px;
    background: hsl(var(--bg-surface, 0 0% 100%));
    border: 1px solid hsl(var(--border-subtle, 220 12% 88%));
    padding: 20px 22px;
    display: flex;
    flex-direction: column;
    position: relative;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
    transition: transform 0.2s cubic-bezier(0.2, 1, 0.2, 1), border-color 0.2s ease;
    contain: layout paint;
  }
  .anunciar-phrase-card:hover {
    border-color: var(--card-accent, #0284c7);
    transform: translateY(-2px);
  }
  .anunciar-speak-btn {
    transition: transform 0.12s ease;
  }
  .anunciar-speak-btn:active {
    transform: scale(0.97);
  }
`

// ── Card Memoizado da Biblioteca de Frases ────────────────────────────────────
const PhraseCard = React.memo(function PhraseCard({
  item,
  onBroadcast,
  onLoadToComposer,
  onToggleFavorite,
  onEdit,
  onDelete,
}: {
  item: SchoolAnnouncement
  onBroadcast: (text: string, opts: { title?: string; category?: string; chime?: boolean; repeat?: number }) => void
  onLoadToComposer: (item: SchoolAnnouncement) => void
  onToggleFavorite: (id: string, e: React.MouseEvent) => void
  onEdit: (item: SchoolAnnouncement, e: React.MouseEvent) => void
  onDelete: (id: string, e: React.MouseEvent) => void
}) {
  const catMeta = CATEGORIES_BY_KEY[item.category] || CATEGORIES[0]

  return (
    <div
      className="anunciar-phrase-card"
      style={{ '--card-accent': catMeta.color } as React.CSSProperties}
    >
      {/* Top Row: Categoria + Favorito & Ações */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 20,
          background: catMeta.bg, border: `1px solid ${catMeta.border}`,
          fontSize: 10, fontWeight: 800, color: catMeta.text,
          textTransform: 'uppercase', letterSpacing: '0.04em'
        }}>
          {catMeta.label}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={(e) => onToggleFavorite(item.id, e)}
            title={item.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: item.isFavorite ? '#f59e0b' : 'hsl(var(--text-disabled, 220 8% 70%))',
              padding: 4, display: 'flex', alignItems: 'center'
            }}
          >
            <Star size={16} fill={item.isFavorite ? '#f59e0b' : 'none'} />
          </button>

          <button
            onClick={(e) => onEdit(item, e)}
            title="Editar frase"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'hsl(var(--text-muted, 220 10% 50%))', padding: 4, display: 'flex', alignItems: 'center'
            }}
          >
            <Edit3 size={14} />
          </button>

          <button
            onClick={(e) => onDelete(item.id, e)}
            title="Excluir frase"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#ef4444', padding: 4, display: 'flex', alignItems: 'center'
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Título da Frase */}
      <h3 style={{
        fontFamily: 'Outfit, sans-serif',
        fontSize: 16, fontWeight: 800,
        margin: '0 0 8px',
        color: 'hsl(var(--text-primary, 220 25% 10%))',
        letterSpacing: '-0.01em'
      }}>
        {item.title}
      </h3>

      {/* Conteúdo Falado da Frase */}
      <p style={{
        fontSize: 13,
        color: 'hsl(var(--text-secondary, 220 15% 30%))',
        lineHeight: 1.5, margin: '0 0 16px',
        flex: 1,
        background: 'hsl(var(--bg-elevated, 220 18% 96%))',
        padding: '12px 14px', borderRadius: 12,
        border: '1px solid hsl(var(--border-subtle, 220 12% 88%))'
      }}>
        "{item.phrase}"
      </p>

      {/* Badges de Configuração */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 11, color: 'hsl(var(--text-muted, 220 10% 50%))' }}>
        {item.playChime && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#d97706', fontWeight: 600 }}>
            <Bell size={12} /> Sino ativo
          </span>
        )}
        <span>•</span>
        <span>{item.repeatCount ? `${item.repeatCount + 1}x repetições` : '1x repetição'}</span>
      </div>

      {/* Botões de Ação do Card */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto' }}>
        <button
          className="anunciar-speak-btn"
          onClick={() => onBroadcast(item.phrase, {
            title: item.title,
            category: item.category,
            chime: item.playChime ?? true,
            repeat: item.repeatCount ?? 0
          })}
          style={{
            flex: 1,
            padding: '10px 14px', borderRadius: 12,
            background: catMeta.color,
            border: 'none', color: '#ffffff',
            fontSize: 12, fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            cursor: 'pointer',
            boxShadow: `0 4px 12px ${catMeta.color}35`,
          }}
        >
          <Megaphone size={14} /> Falar no Som
        </button>

        <button
          onClick={() => onLoadToComposer(item)}
          title="Carregar frase na mesa de edição acima"
          style={{
            padding: '10px 12px', borderRadius: 12,
            background: 'hsl(var(--bg-elevated, 220 18% 94%))',
            border: '1px solid hsl(var(--border-subtle, 220 12% 88%))',
            color: 'hsl(var(--text-secondary, 220 15% 30%))',
            fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 4,
            cursor: 'pointer',
          }}
        >
          <Copy size={13} /> Editar
        </button>
      </div>
    </div>
  )
})

// ── Seção Isolada da Biblioteca (busca e filtro não re-renderizam o compositor) ──
const PhraseLibrarySection = React.memo(function PhraseLibrarySection({
  savedAnnouncements,
  isLoadingAnnouncements,
  onNewPhrase,
  onBroadcast,
  onLoadToComposer,
  onToggleFavorite,
  onEdit,
  onDelete,
}: {
  savedAnnouncements: SchoolAnnouncement[]
  isLoadingAnnouncements: boolean
  onNewPhrase: () => void
  onBroadcast: (text: string, opts: { title?: string; category?: string; chime?: boolean; repeat?: number }) => void
  onLoadToComposer: (item: SchoolAnnouncement) => void
  onToggleFavorite: (id: string, e: React.MouseEvent) => void
  onEdit: (item: SchoolAnnouncement, e: React.MouseEvent) => void
  onDelete: (id: string, e: React.MouseEvent) => void
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<CategoryKey>('todas')

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { todas: 0, favoritas: 0 }
    const list = savedAnnouncements || []
    counts.todas = list.length
    for (let i = 0; i < list.length; i++) {
      const item = list[i]
      if (item.isFavorite) counts.favoritas = (counts.favoritas || 0) + 1
      if (item.category) {
        counts[item.category] = (counts[item.category] || 0) + 1
      }
    }
    return counts
  }, [savedAnnouncements])

  const filteredPhrases = useMemo(() => {
    let list = savedAnnouncements || []

    if (selectedCategoryTab === 'favoritas') {
      list = list.filter((x) => x.isFavorite)
    } else if (selectedCategoryTab !== 'todas') {
      list = list.filter((x) => x.category === selectedCategoryTab)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        (x) =>
          x.title.toLowerCase().includes(q) ||
          x.phrase.toLowerCase().includes(q) ||
          (x.tags && x.tags.some((t) => t.toLowerCase().includes(q)))
      )
    }
    return list
  }, [savedAnnouncements, selectedCategoryTab, searchQuery])

  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h2 style={{
            fontFamily: 'Outfit, sans-serif',
            fontSize: 20, fontWeight: 800,
            margin: '0 0 4px',
            color: 'hsl(var(--text-primary, 220 25% 10%))'
          }}>
            Biblioteca de Frases & Modelos Salvos
          </h2>
          <p style={{
            fontSize: 12,
            color: 'hsl(var(--text-muted, 220 10% 50%))',
            margin: 0
          }}>
            Selecione uma frase pronta para disparar no som em 1 clique ou crie novos modelos
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'hsl(var(--bg-surface, 0 0% 100%))',
            border: '1px solid hsl(var(--border-subtle, 220 12% 88%))',
            borderRadius: 12, padding: '8px 14px', width: 240,
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)'
          }}>
            <Search size={14} color="hsl(var(--text-muted, 220 10% 50%))" />
            <input
              type="text"
              placeholder="Buscar frase ou título..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'none', border: 'none',
                color: 'hsl(var(--text-primary, 220 25% 10%))',
                fontSize: 12, outline: 'none', width: '100%'
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: 'hsl(var(--text-muted, 220 10% 50%))', cursor: 'pointer' }}>
                <X size={12} />
              </button>
            )}
          </div>

          <button
            onClick={onNewPhrase}
            style={{
              padding: '10px 18px', borderRadius: 12,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none', color: '#fff',
              fontSize: 12, fontWeight: 800,
              display: 'flex', alignItems: 'center', gap: 6,
              cursor: 'pointer', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.25)'
            }}
          >
            <Plus size={15} /> Criar Nova Frase
          </button>
        </div>
      </div>

      {/* Barra de Filtro de Categorias */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 8,
          marginBottom: 16,
          scrollbarWidth: 'none',
        }}
      >
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategoryTab === cat.key
          const count = categoryCounts[cat.key] || 0
          const CatIcon = cat.icon

          return (
            <button
              key={cat.key}
              onClick={() => setSelectedCategoryTab(cat.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 13px',
                borderRadius: 12,
                background: isSelected ? cat.color : 'hsl(var(--bg-surface, 0 0% 100%))',
                border: `1px solid ${isSelected ? cat.color : 'hsl(var(--border-subtle, 220 12% 88%))'}`,
                color: isSelected ? '#ffffff' : 'hsl(var(--text-secondary, 220 15% 30%))',
                fontSize: 12,
                fontWeight: isSelected ? 800 : 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease',
                boxShadow: isSelected ? `0 4px 12px ${cat.color}35` : 'none',
              }}
            >
              <CatIcon size={13} color={isSelected ? '#ffffff' : cat.color} />
              <span>{cat.label}</span>
              {count > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: 10,
                    background: isSelected ? 'rgba(255, 255, 255, 0.25)' : 'hsl(var(--bg-elevated, 220 18% 94%))',
                    color: isSelected ? '#ffffff' : 'hsl(var(--text-muted, 220 10% 50%))',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Grid de Cards ou Skeletons */}
      {isLoadingAnnouncements && (!savedAnnouncements || savedAnnouncements.length === 0) ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                borderRadius: 20,
                background: 'hsl(var(--bg-surface, 0 0% 100%))',
                border: '1px solid hsl(var(--border-subtle, 220 12% 88%))',
                padding: '20px 22px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                opacity: 0.7,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ width: 90, height: 20, background: 'hsl(var(--bg-elevated, 220 18% 94%))', borderRadius: 10 }} />
                <div style={{ width: 40, height: 20, background: 'hsl(var(--bg-elevated, 220 18% 94%))', borderRadius: 6 }} />
              </div>
              <div style={{ width: '70%', height: 18, background: 'hsl(var(--bg-elevated, 220 18% 94%))', borderRadius: 8 }} />
              <div style={{ width: '100%', height: 54, background: 'hsl(var(--bg-elevated, 220 18% 96%))', borderRadius: 12 }} />
              <div style={{ width: '100%', height: 38, background: 'hsl(var(--bg-elevated, 220 18% 94%))', borderRadius: 12, marginTop: 6 }} />
            </div>
          ))}
        </div>
      ) : filteredPhrases.length === 0 ? (
        <div style={{
          padding: '48px 24px', borderRadius: 20,
          background: 'hsl(var(--bg-surface, 0 0% 100%))',
          border: '1px dashed hsl(var(--border-default, 220 12% 80%))',
          textAlign: 'center'
        }}>
          <Radio size={36} color="hsl(var(--text-muted, 220 10% 50%))" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: 'hsl(var(--text-primary, 220 25% 10%))', marginBottom: 4 }}>
            {searchQuery.trim() || selectedCategoryTab !== 'todas' ? 'Nenhuma frase encontrada para este filtro' : 'Nenhuma frase cadastrada'}
          </div>
          <p style={{ fontSize: 12, color: 'hsl(var(--text-muted, 220 10% 50%))', margin: '0 0 16px' }}>
            {searchQuery.trim() || selectedCategoryTab !== 'todas'
              ? 'Tente limpar a busca ou selecionar outra categoria.'
              : 'Crie uma nova frase personalizada clicando no botão abaixo'}
          </p>
          {searchQuery.trim() || selectedCategoryTab !== 'todas' ? (
            <button
              onClick={() => {
                setSearchQuery('')
                setSelectedCategoryTab('todas')
              }}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                background: 'hsl(var(--bg-elevated, 220 18% 94%))',
                border: '1px solid hsl(var(--border-subtle, 220 12% 88%))',
                color: 'hsl(var(--text-primary, 220 25% 10%))',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Limpar Filtros
            </button>
          ) : (
            <button
              onClick={onNewPhrase}
              style={{
                padding: '8px 16px', borderRadius: 10,
                background: 'hsl(var(--bg-elevated, 220 18% 94%))',
                border: '1px solid hsl(var(--border-subtle, 220 12% 88%))',
                color: 'hsl(var(--text-primary, 220 25% 10%))',
                fontSize: 12, fontWeight: 700, cursor: 'pointer'
              }}
            >
              + Criar Primeira Frase
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filteredPhrases.map((item) => (
            <PhraseCard
              key={item.id}
              item={item}
              onBroadcast={onBroadcast}
              onLoadToComposer={onLoadToComposer}
              onToggleFavorite={onToggleFavorite}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
})

// ── Seção Isolada de Histórico ────────────────────────────────────────────────
const HistorySection = React.memo(function HistorySection({
  history,
  onClearHistory,
  onBroadcast,
}: {
  history: AnnouncementHistoryItem[]
  onClearHistory: () => void
  onBroadcast: (text: string, opts: { title?: string; category?: string; chime?: boolean; repeat?: number }) => void
}) {
  if (!history || history.length === 0) return null

  return (
    <div style={{
      background: 'hsl(var(--bg-surface, 0 0% 100%))',
      borderRadius: 22,
      border: '1px solid hsl(var(--border-subtle, 220 12% 88%))',
      padding: '20px 24px',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={16} color="#0284c7" />
          <h3 style={{
            fontFamily: 'Outfit, sans-serif',
            fontSize: 16, fontWeight: 800,
            margin: 0,
            color: 'hsl(var(--text-primary, 220 25% 10%))'
          }}>
            Histórico Recente de Locuções
          </h3>
        </div>

        <button
          onClick={onClearHistory}
          style={{
            background: 'none', border: 'none',
            color: 'hsl(var(--text-muted, 220 10% 50%))',
            fontSize: 11, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
          }}
        >
          <Trash2 size={12} /> Limpar Histórico
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {history.slice(0, 5).map((hist) => {
          const playedDate = new Date(hist.playedAt)
          const timeStr = isNaN(playedDate.getTime()) ? '' : playedDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

          return (
            <div
              key={hist.id}
              style={{
                padding: '12px 16px', borderRadius: 12,
                background: 'hsl(var(--bg-elevated, 220 18% 96%))',
                border: '1px solid hsl(var(--border-subtle, 220 12% 88%))',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 16
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                <div style={{
                  padding: '4px 8px', borderRadius: 8,
                  background: 'rgba(2, 132, 199, 0.1)',
                  color: '#0284c7', fontSize: 11, fontWeight: 800
                }}>
                  {timeStr}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700,
                    color: 'hsl(var(--text-primary, 220 25% 10%))',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                  }}>
                    {hist.phrase}
                  </div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted, 220 10% 50%))' }}>
                    Operador: {hist.operatorName || 'Portaria'} {hist.repeatCount ? `• ${hist.repeatCount + 1}x` : ''}
                  </div>
                </div>
              </div>

              <button
                onClick={() => onBroadcast(hist.phrase, {
                  title: hist.title,
                  category: hist.category,
                  chime: hist.withChime ?? true,
                  repeat: hist.repeatCount ?? 0
                })}
                title="Repetir este anúncio no som"
                style={{
                  padding: '6px 12px', borderRadius: 8,
                  background: 'hsl(var(--bg-surface, 0 0% 100%))',
                  border: '1px solid hsl(var(--border-default, 220 12% 80%))',
                  color: 'hsl(var(--text-primary, 220 25% 10%))',
                  fontSize: 11, fontWeight: 800,
                  display: 'flex', alignItems: 'center', gap: 4,
                  cursor: 'pointer', flexShrink: 0
                }}
              >
                <RotateCcw size={12} /> Repetir
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
})

// ── Síntese de Sino Escolar Harmônico com AudioContext Compartilhado ──────────
let sharedAudioCtx: AudioContext | null = null
function getSharedAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
  if (!AudioContextClass) return null
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioContextClass()
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {})
  }
  return sharedAudioCtx
}

function playHarmonicChime(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const ctx = getSharedAudioCtx()
      if (!ctx) return resolve()

      const now = ctx.currentTime
      // C5 (523.25Hz) -> E5 (659.25Hz) -> G5 (783.99Hz)
      const notes = [523.25, 659.25, 783.99]

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now + i * 0.16)
        gain.gain.setValueAtTime(0.001, now + i * 0.16)
        gain.gain.exponentialRampToValueAtTime(0.24, now + i * 0.16 + 0.04)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.5)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + i * 0.16)
        osc.stop(now + i * 0.16 + 0.55)
      })

      setTimeout(resolve, 620)
    } catch {
      resolve()
    }
  })
}

export default function AnunciarPage() {
  const { currentUser } = useApp()
  const { config, realtimeStatus, broadcastAnnouncement, cancelAnnouncement } = useSaida()

  // Persistência das Frases Salvas e Histórico (inicializado sempre com [] para não recriar itens apagados)
  const [savedAnnouncements, setSavedAnnouncements, { loading: isLoadingAnnouncements }] = useSupabaseArray<SchoolAnnouncement>(
    'saida/anuncios',
    [],
    { mergeLocal: false }
  )
  const [history, setHistory] = useSupabaseArray<AnnouncementHistoryItem>(
    'saida/anuncios_historico',
    [],
    { mergeLocal: false }
  )

  // Hook de Voz Local para Prévia e Execução
  const voice = useVoice({
    rate: config?.voiceRate ?? 0.9,
    pitch: config?.voicePitch ?? 1.0,
    volume: config?.voiceVolume ?? 1.0,
    voiceURI: config?.voiceURI || '',
  })

  // Estados de Controle da Mesa de Locução
  const [currentText, setCurrentText] = useState('')
  const [currentTitle, setCurrentTitle] = useState('')
  const [currentCategory, setCurrentCategory] = useState<SchoolAnnouncement['category']>('portaria')
  const [playChime, setPlayChime] = useState(true)
  const [repeatCount, setRepeatCount] = useState<number>(0) // 0 = 1x, 1 = 2x, 2 = 3x
  const [selectedVoiceURI, setSelectedVoiceURI] = useState(config?.voiceURI || '')
  const [voiceRate, setVoiceRate] = useState<number>(config?.voiceRate ?? 0.9)
  const [voicePitch, setVoicePitch] = useState<number>(config?.voicePitch ?? 1.0)
  const [voiceVolume, setVoiceVolume] = useState<number>(config?.voiceVolume ?? 1.0)

  const [isBroadcasting, setIsBroadcasting] = useState(false)
  const [broadcastProgress, setBroadcastProgress] = useState('')
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false)

  // Estado do Modal de Edição / Criação
  const [editingItem, setEditingItem] = useState<Partial<SchoolAnnouncement> | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }, [])

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sincronizar voz com vozes disponíveis no navegador
  useEffect(() => {
    if (voice.voices.length > 0 && !selectedVoiceURI) {
      const ptVoice = voice.voices.find(v => v.lang.startsWith('pt') && v.localService) || voice.voices.find(v => v.lang.startsWith('pt'))
      if (ptVoice) setSelectedVoiceURI(ptVoice.voiceURI)
    }
  }, [voice.voices, selectedVoiceURI])

  // Estimativa de tempo de fala
  const estimatedSeconds = useMemo(() => {
    if (!currentText.trim()) return 0
    const words = currentText.trim().split(/\s+/).length
    const duration = Math.max(1, Math.round((words / 2.8) / voiceRate))
    return duration * (repeatCount + 1) + (playChime ? 1 : 0)
  }, [currentText, voiceRate, repeatCount, playChime])

  const broadcastDefaultsRef = useRef({
    currentTitle,
    currentCategory,
    playChime,
    repeatCount,
    voiceRate,
    voicePitch,
    estimatedSeconds,
  })
  broadcastDefaultsRef.current = {
    currentTitle,
    currentCategory,
    playChime,
    repeatCount,
    voiceRate,
    voicePitch,
    estimatedSeconds,
  }

  // Disparar Anúncio no Som da Escola
  const handleBroadcast = useCallback(async (textToSpeak: string, customOptions?: { title?: string; category?: string; chime?: boolean; repeat?: number }) => {
    const text = textToSpeak.trim()
    if (!text) return

    const defaults = broadcastDefaultsRef.current
    setIsBroadcasting(true)
    setBroadcastProgress('Transmitindo no som da escola...')

    const chimeActive = customOptions?.chime !== undefined ? customOptions.chime : defaults.playChime
    const reps = customOptions?.repeat !== undefined ? customOptions.repeat : defaults.repeatCount

    // 1. Transmitir via Realtime para o Monitor TV / Som da Escola
    broadcastAnnouncement(text, {
      title: customOptions?.title || defaults.currentTitle || 'Aviso no Som',
      chime: chimeActive,
      repeat: reps,
      operatorName: currentUser?.nome || 'Portaria',
      rate: defaults.voiceRate,
      pitch: defaults.voicePitch,
    })

    setBroadcastProgress('Transmitido para o Monitor TV / Som da Escola...')

    // 2. Registrar no Histórico (Máximo 5 itens)
    const historyEntry: AnnouncementHistoryItem = {
      id: 'hist-' + Date.now(),
      phrase: text,
      title: customOptions?.title || defaults.currentTitle || 'Locução Avulsa',
      category: customOptions?.category || defaults.currentCategory,
      playedAt: new Date().toISOString(),
      operatorName: currentUser?.nome || 'Portaria',
      repeatCount: reps,
      withChime: chimeActive,
    }

    setHistory((prev) => [historyEntry, ...(prev || []).slice(0, 4)])

    const words = text.split(/\s+/).length
    const estDuration = Math.max(1, Math.round((words / 2.8) / (defaults.voiceRate || 0.9))) * (reps + 1) + (chimeActive ? 1 : 0)
    // Reset indicator after reasonable delay
    setTimeout(() => {
      setIsBroadcasting(false)
      setBroadcastProgress('')
    }, (estDuration || 4) * 1000)
  }, [broadcastAnnouncement, currentUser?.nome, setHistory])

  // Prévia Local Apenas (fone/caixa do operador sem broadcast)
  const handleLocalPreview = useCallback(async () => {
    if (!currentText.trim()) return
    setIsBroadcasting(true)
    setBroadcastProgress('Ouvindo prévia local...')

    if (playChime) {
      await playHarmonicChime()
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.paused) {
      window.speechSynthesis.resume()
    }

    voice.speak(currentText.trim(), {
      voiceURI: selectedVoiceURI,
      rate: voiceRate,
      pitch: voicePitch,
      volume: voiceVolume,
      repeatCount: 0,
    })

    setTimeout(() => {
      setIsBroadcasting(false)
      setBroadcastProgress('')
    }, 3000)
  }, [currentText, playChime, selectedVoiceURI, voiceRate, voicePitch, voiceVolume, voice])

  // Parar qualquer emissão
  const handleStopAll = useCallback(() => {
    voice.cancel()
    cancelAnnouncement()
    setIsBroadcasting(false)
    setBroadcastProgress('')
  }, [voice, cancelAnnouncement])

  // Salvar / Adicionar Frase no Banco de Dados
  const handleSaveModalSubmit = async () => {
    if (!editingItem?.phrase?.trim()) return

    const itemToSave: SchoolAnnouncement = {
      id: editingItem.id || 'ann-' + Date.now(),
      title: editingItem.title?.trim() || 'Aviso Personalizado',
      phrase: editingItem.phrase.trim(),
      category: editingItem.category || 'geral',
      isFavorite: editingItem.isFavorite || false,
      playChime: editingItem.playChime ?? true,
      repeatCount: editingItem.repeatCount ?? 0,
      createdAt: editingItem.createdAt || new Date().toISOString(),
      lastUsedAt: editingItem.lastUsedAt,
      tags: editingItem.tags || [],
    }

    try {
      await setSavedAnnouncements((prev) => {
        const arr = prev || []
        const idx = arr.findIndex((x) => x.id === itemToSave.id)
        if (idx >= 0) {
          const copy = [...arr]
          copy[idx] = itemToSave
          return copy
        }
        return [itemToSave, ...arr]
      })

      showToast(editingItem.id ? 'Frase atualizada e salva no banco de dados!' : 'Nova frase criada e salva no banco de dados!')
    } catch (e) {
      console.error('Erro ao salvar frase no banco:', e)
      showToast('Frase salva localmente e enviada ao banco de dados.')
    }

    setIsModalOpen(false)
    setEditingItem(null)
  }

  // Deletar Frase
  const handleDeletePhrase = useCallback(async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (confirm('Tem certeza que deseja excluir esta frase salva do banco de dados?')) {
      try {
        await setSavedAnnouncements((prev) => (prev || []).filter((x) => x.id !== id))
        showToast('Frase removida do banco de dados.')
      } catch (err) {
        console.error('Erro ao deletar frase:', err)
      }
    }
  }, [setSavedAnnouncements, showToast])

  // Toggle Favorito
  const handleToggleFavorite = useCallback(async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      await setSavedAnnouncements((prev) =>
        (prev || []).map((item) => (item.id === id ? { ...item, isFavorite: !item.isFavorite } : item))
      )
    } catch (err) {
      console.error('Erro ao alternar favorito:', err)
    }
  }, [setSavedAnnouncements])

  // Copiar Frase para a Mesa de Locução
  const handleLoadToComposer = useCallback((item: SchoolAnnouncement) => {
    setCurrentText(item.phrase)
    setCurrentTitle(item.title)
    setCurrentCategory(item.category)
    setPlayChime(item.playChime ?? true)
    setRepeatCount(item.repeatCount ?? 0)
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [])

  const handleOpenNewModal = useCallback(() => {
    setEditingItem({
      title: '',
      phrase: '',
      category: 'portaria',
      playChime: true,
      repeatCount: 0,
      isFavorite: false
    })
    setIsModalOpen(true)
  }, [])

  const handleOpenEditModal = useCallback((item: SchoolAnnouncement, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingItem(item)
    setIsModalOpen(true)
  }, [])

  const handleClearHistory = useCallback(() => {
    setHistory([])
  }, [setHistory])

  // Atalho de Teclado Ctrl + Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleBroadcast(currentText)
    }
  }

  return (
    <div style={{ minHeight: '100%', paddingBottom: 60, position: 'relative' }}>
      <style dangerouslySetInnerHTML={{ __html: ANUNCIAR_STYLES }} />
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            zIndex: 99999,
            background: '#0f172a',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: 14,
            border: '1px solid rgba(16, 185, 129, 0.4)',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            fontWeight: 700,
            animation: 'anunciarToastIn 0.2s ease'
          }}
        >
          <div style={{
            width: 22, height: 22, borderRadius: '50%',
            background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Check size={14} color="#fff" />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── HEADER DA PÁGINA ────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 14,
              background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(236, 72, 153, 0.35)',
              color: '#fff'
            }}>
              <Megaphone size={22} />
            </div>
            <div>
              <h1 style={{
                fontFamily: 'Outfit, sans-serif',
                fontSize: 26, fontWeight: 900,
                letterSpacing: '-0.02em', margin: 0,
                color: 'hsl(var(--text-primary, 220 25% 10%))'
              }}>
                Locução & Anúncios de Som
              </h1>
              <p style={{
                fontSize: 13,
                color: 'hsl(var(--text-muted, 220 10% 50%))',
                margin: '2px 0 0'
              }}>
                Transmita frases por voz falada no som da escola em tempo real — sem interferir na tela visual da TV ou Tablet
              </p>
            </div>
          </div>
        </div>

        {/* Status Badge & Ações Rápidas de Configuração */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Status Realtime */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 50,
            background: realtimeStatus === 'online' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
            border: `1px solid ${realtimeStatus === 'online' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: realtimeStatus === 'online' ? '#10b981' : '#f59e0b',
              boxShadow: realtimeStatus === 'online' ? '0 0 8px #10b981' : 'none'
            }} />
            <span style={{
              fontSize: 11, fontWeight: 800,
              color: realtimeStatus === 'online' ? '#059669' : '#d97706',
              letterSpacing: '0.04em'
            }}>
              {realtimeStatus === 'online' ? 'SOM SINCRONIZADO' : 'CONECTANDO AO SOM'}
            </span>
          </div>

          {/* Testar Sino */}
          <button
            onClick={() => playHarmonicChime()}
            title="Tocar sino de chamada para testar acústica"
            style={{
              padding: '9px 15px', borderRadius: 12,
              background: 'hsl(var(--bg-surface, 0 0% 100%))',
              border: '1px solid hsl(var(--border-subtle, 220 12% 88%))',
              color: 'hsl(var(--text-secondary, 220 15% 30%))',
              fontSize: 12, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 6,
              cursor: 'pointer', transition: 'all 0.2s',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'hsl(var(--bg-hover, 220 14% 86%))' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'hsl(var(--bg-surface, 0 0% 100%))' }}
          >
            <Bell size={15} color="#d97706" /> Testar Sino
          </button>

          {/* Botão de Ajustes de Voz */}
          <button
            onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
            style={{
              padding: '9px 15px', borderRadius: 12,
              background: showSettingsDrawer ? 'rgba(147, 51, 234, 0.12)' : 'hsl(var(--bg-surface, 0 0% 100%))',
              border: `1px solid ${showSettingsDrawer ? '#9333ea' : 'hsl(var(--border-subtle, 220 12% 88%))'}`,
              color: showSettingsDrawer ? '#7e22ce' : 'hsl(var(--text-secondary, 220 15% 30%))',
              fontSize: 12, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 6,
              cursor: 'pointer', transition: 'all 0.2s',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)'
            }}
          >
            <Sliders size={15} /> Ajustes de Voz
          </button>
        </div>
      </div>

      {/* ── PAINEL DESLIZANTE DE AJUSTES DE VOZ ──────────────────────── */}
      {showSettingsDrawer && (
        <div
          style={{
            marginBottom: 24, padding: '22px', borderRadius: 20,
            background: 'hsl(var(--bg-surface, 0 0% 100%))',
            border: '1px solid rgba(147, 51, 234, 0.3)',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.06)',
            overflow: 'hidden',
            animation: 'anunciarDrawerIn 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: '#7e22ce' }}>
              <Sliders size={16} /> Ajustes Finos de Locução e Sintetizador
            </div>
            <button
              onClick={() => setShowSettingsDrawer(false)}
              style={{ background: 'none', border: 'none', color: 'hsl(var(--text-muted, 220 10% 50%))', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {/* Voz do Sistema */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted, 220 10% 50%))', textTransform: 'uppercase', marginBottom: 6 }}>
                Voz do Navegador (PT-BR)
              </label>
              <select
                value={selectedVoiceURI}
                onChange={(e) => setSelectedVoiceURI(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 10,
                  background: 'hsl(var(--bg-elevated, 220 18% 94%))',
                  border: '1px solid hsl(var(--border-subtle, 220 12% 88%))',
                  color: 'hsl(var(--text-primary, 220 25% 10%))',
                  fontSize: 13, outline: 'none'
                }}
              >
                {voice.voices.filter(v => v.lang.startsWith('pt')).map(v => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
                {voice.voices.filter(v => !v.lang.startsWith('pt')).map(v => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>

            {/* Velocidade */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted, 220 10% 50%))', textTransform: 'uppercase' }}>
                  Velocidade da Fala
                </label>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#0284c7' }}>{voiceRate.toFixed(1)}x</span>
              </div>
              <input
                type="range" min="0.6" max="1.5" step="0.1"
                value={voiceRate}
                onChange={(e) => setVoiceRate(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#0284c7', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'hsl(var(--text-muted, 220 10% 50%))', marginTop: 4 }}>
                <span>0.6x (Lenta)</span>
                <span>1.0x (Padrão)</span>
                <span>1.5x (Rápida)</span>
              </div>
            </div>

            {/* Tom / Pitch */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted, 220 10% 50%))', textTransform: 'uppercase' }}>
                  Tom da Voz (Pitch)
                </label>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#db2777' }}>{voicePitch.toFixed(1)}</span>
              </div>
              <input
                type="range" min="0.6" max="1.4" step="0.1"
                value={voicePitch}
                onChange={(e) => setVoicePitch(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#db2777', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'hsl(var(--text-muted, 220 10% 50%))', marginTop: 4 }}>
                <span>Grave</span>
                <span>Natural</span>
                <span>Agudo</span>
              </div>
            </div>

            {/* Volume */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted, 220 10% 50%))', textTransform: 'uppercase' }}>
                  Volume Geral
                </label>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#059669' }}>{Math.round(voiceVolume * 100)}%</span>
              </div>
              <input
                type="range" min="0.1" max="1.0" step="0.05"
                value={voiceVolume}
                onChange={(e) => setVoiceVolume(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#059669', cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── MESA DE LOCUÇÃO AVULSA (HERO COMPOSER) ───────────────────── */}
      <div style={{
        background: 'hsl(var(--bg-surface, 0 0% 100%))',
        borderRadius: 24,
        border: '1px solid hsl(var(--border-subtle, 220 12% 88%))',
        padding: '24px 28px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.05)',
        position: 'relative',
        overflow: 'hidden',
        marginBottom: 32
      }}>
        {/* Glow accent bar at top */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 4,
          background: 'linear-gradient(90deg, #ec4899, #8b5cf6, #3b82f6)'
        }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 11, fontWeight: 900, color: '#db2777', letterSpacing: '0.08em',
              textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(219, 39, 119, 0.08)', padding: '4px 10px', borderRadius: 8
            }}>
              <Radio size={14} className="animate-pulse" /> Mesa de Locução Ao Vivo
            </span>
          </div>

          {/* Equalizer Visualizer quando transmitindo (GPU scaleY CSS) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 20 }}>
            {[0, 0.12, 0.24, 0.08, 0.18, 0.3].map((delay, idx) => (
              <div
                key={idx}
                className={isBroadcasting ? 'anunciar-eq-bar anunciar-eq-bar--active' : 'anunciar-eq-bar'}
                style={{
                  background: isBroadcasting ? 'linear-gradient(to top, #ec4899, #3b82f6)' : 'hsl(var(--border-strong, 220 12% 80%))',
                  animationDelay: `${delay}s`,
                  animationDuration: `${0.55 + (idx % 3) * 0.12}s`,
                }}
              />
            ))}
            {isBroadcasting && (
              <span style={{ fontSize: 11, fontWeight: 800, color: '#db2777', marginLeft: 8 }}>
                {broadcastProgress || 'EMITINDO SOM...'}
              </span>
            )}
          </div>
        </div>

        {/* Textarea de Locução */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <textarea
            ref={textareaRef}
            rows={3}
            value={currentText}
            onChange={(e) => setCurrentText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite a frase para ser anunciada no som da escola... (Ex: 'Atenção alunos do 5º ano, van escolar no portão 2')"
            style={{
              width: '100%',
              padding: '16px 20px',
              borderRadius: 16,
              background: 'hsl(var(--bg-elevated, 220 18% 96%))',
              border: '1.5px solid hsl(var(--border-subtle, 220 12% 88%))',
              color: 'hsl(var(--text-primary, 220 25% 10%))',
              fontSize: 15,
              fontWeight: 500,
              lineHeight: 1.5,
              outline: 'none',
              resize: 'none',
              fontFamily: 'Outfit, sans-serif',
              transition: 'all 0.2s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#db2777'
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(219, 39, 119, 0.1)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'hsl(var(--border-subtle, 220 12% 88%))'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />

          {/* Quick Clear Button */}
          {currentText && (
            <button
              onClick={() => setCurrentText('')}
              style={{
                position: 'absolute', top: 12, right: 12,
                background: 'rgba(0, 0, 0, 0.06)', border: 'none',
                borderRadius: '50%', width: 26, height: 26,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'hsl(var(--text-muted, 220 10% 50%))', cursor: 'pointer'
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Barra de Controles e Botões de Disparo */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 14, paddingTop: 14,
          borderTop: '1px solid hsl(var(--border-subtle, 220 12% 88%))'
        }}>
          {/* Opções de Transmissão */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {/* Toggle Sino */}
            <button
              onClick={() => setPlayChime(!playChime)}
              style={{
                padding: '8px 14px', borderRadius: 10,
                background: playChime ? 'rgba(217, 119, 6, 0.1)' : 'hsl(var(--bg-elevated, 220 18% 94%))',
                border: `1px solid ${playChime ? 'rgba(217, 119, 6, 0.3)' : 'hsl(var(--border-subtle, 220 12% 88%))'}`,
                color: playChime ? '#b45309' : 'hsl(var(--text-muted, 220 10% 50%))',
                fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 6,
                cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              <Bell size={14} color={playChime ? '#d97706' : 'currentColor'} /> Sino de Chamada {playChime ? 'Ativo' : 'Desligado'}
            </button>

            {/* Seletor de Repetição */}
            <div style={{
              display: 'flex', alignItems: 'center',
              background: 'hsl(var(--bg-elevated, 220 18% 94%))',
              border: '1px solid hsl(var(--border-subtle, 220 12% 88%))',
              borderRadius: 10, padding: 2
            }}>
              {[
                { val: 0, label: '1x' },
                { val: 1, label: '2x' },
                { val: 2, label: '3x' }
              ].map((r) => (
                <button
                  key={r.val}
                  onClick={() => setRepeatCount(r.val)}
                  style={{
                    padding: '6px 12px', borderRadius: 8,
                    background: repeatCount === r.val ? 'rgba(219, 39, 119, 0.15)' : 'transparent',
                    border: repeatCount === r.val ? '1px solid #db2777' : 'none',
                    color: repeatCount === r.val ? '#db2777' : 'hsl(var(--text-muted, 220 10% 50%))',
                    fontSize: 11, fontWeight: 800,
                    cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Duração Estimada */}
            {currentText.trim() && (
              <span style={{ fontSize: 11, color: 'hsl(var(--text-muted, 220 10% 50%))', fontWeight: 600 }}>
                ~ {estimatedSeconds}s de locução
              </span>
            )}
          </div>

          {/* Ações Primárias */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Salvar como Frase Nova */}
            <button
              onClick={() => {
                if (!currentText.trim()) return
                setEditingItem({
                  title: currentTitle || 'Novo Aviso',
                  phrase: currentText,
                  category: currentCategory,
                  playChime,
                  repeatCount,
                  isFavorite: false
                })
                setIsModalOpen(true)
              }}
              disabled={!currentText.trim()}
              style={{
                padding: '10px 16px', borderRadius: 12,
                background: 'hsl(var(--bg-surface, 0 0% 100%))',
                border: '1px solid hsl(var(--border-default, 220 12% 80%))',
                color: 'hsl(var(--text-primary, 220 25% 10%))',
                fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 6,
                cursor: currentText.trim() ? 'pointer' : 'not-allowed',
                opacity: currentText.trim() ? 1 : 0.4,
                transition: 'all 0.2s',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)'
              }}
            >
              <Plus size={14} /> Salvar nos Modelos
            </button>

            {/* Prévia Local */}
            <button
              onClick={handleLocalPreview}
              disabled={!currentText.trim()}
              title="Ouvir no fone do operador antes de disparar no som"
              style={{
                padding: '10px 16px', borderRadius: 12,
                background: 'rgba(2, 132, 199, 0.08)',
                border: '1px solid rgba(2, 132, 199, 0.3)',
                color: '#0284c7', fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 6,
                cursor: currentText.trim() ? 'pointer' : 'not-allowed',
                opacity: currentText.trim() ? 1 : 0.4,
                transition: 'all 0.2s'
              }}
            >
              <Volume2 size={14} /> Ouvir Prévia
            </button>

            {/* Parar Áudio (se tocando) */}
            {isBroadcasting && (
              <button
                onClick={handleStopAll}
                style={{
                  padding: '10px 16px', borderRadius: 12,
                  background: 'rgba(220, 38, 38, 0.1)',
                  border: '1px solid #dc2626',
                  color: '#dc2626', fontSize: 12, fontWeight: 800,
                  display: 'flex', alignItems: 'center', gap: 6,
                  cursor: 'pointer'
                }}
              >
                <Square size={14} fill="#dc2626" /> Parar Fala
              </button>
            )}

            {/* BOTÃO PRINCIPAL: FALAR NO SOM DA ESCOLA */}
            <button
              className="anunciar-cta-btn"
              onClick={() => handleBroadcast(currentText)}
              disabled={!currentText.trim()}
              style={{
                padding: '12px 24px', borderRadius: 14,
                background: currentText.trim() ? 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)' : 'hsl(var(--bg-elevated, 220 18% 94%))',
                border: 'none',
                color: currentText.trim() ? '#ffffff' : 'hsl(var(--text-muted, 220 10% 50%))',
                fontSize: 13, fontWeight: 900,
                letterSpacing: '0.02em',
                display: 'flex', alignItems: 'center', gap: 8,
                cursor: currentText.trim() ? 'pointer' : 'not-allowed',
                boxShadow: currentText.trim() ? '0 8px 24px rgba(236, 72, 153, 0.35)' : 'none',
                opacity: currentText.trim() ? 1 : 0.5,
              }}
            >
              <Megaphone size={16} />
              FALAR NO SOM DA ESCOLA
              <span style={{
                fontSize: 10, fontWeight: 800,
                background: 'rgba(0, 0, 0, 0.2)',
                padding: '2px 6px', borderRadius: 6, marginLeft: 4,
                color: '#fff'
              }}>
                Ctrl + ↵
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ── BANCO DE FRASES E CATEGORIAS ────────────────────────────── */}
      <PhraseLibrarySection
        savedAnnouncements={savedAnnouncements || []}
        isLoadingAnnouncements={isLoadingAnnouncements}
        onNewPhrase={handleOpenNewModal}
        onBroadcast={handleBroadcast}
        onLoadToComposer={handleLoadToComposer}
        onToggleFavorite={handleToggleFavorite}
        onEdit={handleOpenEditModal}
        onDelete={handleDeletePhrase}
      />

      {/* ── HISTÓRICO DE TRANSMISSÕES RECENTES ──────────────────────── */}
      <HistorySection
        history={history || []}
        onClearHistory={handleClearHistory}
        onBroadcast={handleBroadcast}
      />

      {/* ── MODAL DE CRIAÇÃO / EDIÇÃO DE FRASE ──────────────────────── */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(2, 6, 23, 0.68)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          animation: 'anunciarFadeIn 0.15s ease'
        }}>
          <div
            style={{
              width: '100%', maxWidth: 520,
              background: 'hsl(var(--bg-surface, 0 0% 100%))',
              borderRadius: 24,
              border: '1px solid hsl(var(--border-subtle, 220 12% 88%))',
              padding: '28px',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.25)',
              display: 'flex', flexDirection: 'column', gap: 18,
              animation: 'anunciarModalIn 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)'
            }}
          >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'rgba(219, 39, 119, 0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#db2777'
                  }}>
                    <Megaphone size={18} />
                  </div>
                  <h2 style={{
                    fontFamily: 'Outfit, sans-serif',
                    fontSize: 20, fontWeight: 900,
                    color: 'hsl(var(--text-primary, 220 25% 10%))',
                    margin: 0
                  }}>
                    {editingItem?.id ? 'Editar Frase do Som' : 'Nova Frase para o Som'}
                  </h2>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  style={{ background: 'none', border: 'none', color: 'hsl(var(--text-muted, 220 10% 50%))', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Título do Modelo */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted, 220 10% 50%))', textTransform: 'uppercase', marginBottom: 6 }}>
                  Título Identificador
                </label>
                <input
                  type="text"
                  placeholder="Ex: Van Escolar Portão 2"
                  value={editingItem?.title || ''}
                  onChange={(e) => setEditingItem((prev) => ({ ...(prev || {}), title: e.target.value }))}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 12,
                    background: 'hsl(var(--bg-elevated, 220 18% 96%))',
                    border: '1px solid hsl(var(--border-subtle, 220 12% 88%))',
                    color: 'hsl(var(--text-primary, 220 25% 10%))',
                    fontSize: 14, outline: 'none'
                  }}
                />
              </div>

              {/* Categoria */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted, 220 10% 50%))', textTransform: 'uppercase', marginBottom: 6 }}>
                  Categoria do Aviso
                </label>
                <select
                  value={editingItem?.category || 'portaria'}
                  onChange={(e) => setEditingItem((prev) => ({ ...(prev || {}), category: e.target.value as any }))}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 12,
                    background: 'hsl(var(--bg-elevated, 220 18% 96%))',
                    border: '1px solid hsl(var(--border-subtle, 220 12% 88%))',
                    color: 'hsl(var(--text-primary, 220 25% 10%))',
                    fontSize: 13, outline: 'none'
                  }}
                >
                  <option value="portaria">Portaria & Saída de Alunos</option>
                  <option value="intervalo">Recreio & Intervalo</option>
                  <option value="comunicado">Comunicados & Professores</option>
                  <option value="veiculos">Estacionamento & Veículos</option>
                  <option value="emergencia">Atenção & Silêncio</option>
                  <option value="geral">Avisos Gerais</option>
                </select>
              </div>

              {/* Texto Falado */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted, 220 10% 50%))', textTransform: 'uppercase', marginBottom: 6 }}>
                  Texto que a Voz Falada Irá Anunciar
                </label>
                <textarea
                  rows={4}
                  placeholder="Digite exatamente o texto que deseja que seja falado nos alto-falantes..."
                  value={editingItem?.phrase || ''}
                  onChange={(e) => setEditingItem((prev) => ({ ...(prev || {}), phrase: e.target.value }))}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 12,
                    background: 'hsl(var(--bg-elevated, 220 18% 96%))',
                    border: '1px solid hsl(var(--border-subtle, 220 12% 88%))',
                    color: 'hsl(var(--text-primary, 220 25% 10%))',
                    fontSize: 14, outline: 'none', resize: 'none', lineHeight: 1.5
                  }}
                />
              </div>

              {/* Configurações do Anúncio */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderRadius: 12,
                background: 'hsl(var(--bg-elevated, 220 18% 96%))',
                border: '1px solid hsl(var(--border-subtle, 220 12% 88%))'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Bell size={16} color="#d97706" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary, 220 25% 10%))' }}>
                    Tocar Sino de Chamada antes da fala
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={editingItem?.playChime ?? true}
                  onChange={(e) => setEditingItem((prev) => ({ ...(prev || {}), playChime: e.target.checked }))}
                  style={{ width: 18, height: 18, accentColor: '#db2777', cursor: 'pointer' }}
                />
              </div>

              {/* Botões do Modal */}
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 12,
                    background: 'hsl(var(--bg-elevated, 220 18% 94%))',
                    border: '1px solid hsl(var(--border-subtle, 220 12% 88%))',
                    color: 'hsl(var(--text-secondary, 220 15% 30%))',
                    fontSize: 13, fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveModalSubmit}
                  disabled={!editingItem?.phrase?.trim()}
                  style={{
                    flex: 2, padding: '12px', borderRadius: 12,
                    background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                    border: 'none', color: '#fff',
                    fontSize: 13, fontWeight: 900,
                    cursor: editingItem?.phrase?.trim() ? 'pointer' : 'not-allowed',
                    opacity: editingItem?.phrase?.trim() ? 1 : 0.4,
                    boxShadow: '0 8px 20px rgba(236, 72, 153, 0.3)'
                  }}
                >
                  Salvar Frase
                </button>
              </div>
            </div>
          </div>
      )}
    </div>
  )
}
