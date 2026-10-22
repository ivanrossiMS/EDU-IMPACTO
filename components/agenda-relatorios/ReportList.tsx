'use client'

import React, { useState } from 'react'
import { useRelatorios, ReportTemplate } from '@/lib/relatoriosContext'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import {
  Search,
  Plus,
  Copy,
  Archive,
  FileText,
  Edit3,
  Play,
  Layers,
  X,
  RotateCcw,
  Trash2
} from 'lucide-react'

type Props = {
  onNavigate: (view: 'list' | 'builder' | 'records' | 'filler', id?: string | null) => void
}

export function ReportList({ onNavigate }: Props) {
  const { templates, setTemplates, addLog } = useRelatorios()
  const { adConfirm } = useAgendaDigital()
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'ativos' | 'arquivados'>('ativos')

  const ativosCount = templates.filter(t => t.status !== 'arquivado').length
  const arquivadosCount = templates.filter(t => t.status === 'arquivado').length

  const filtered = templates.filter(t => {
    if (activeTab === 'ativos' && t.status === 'arquivado') return false
    if (activeTab === 'arquivados' && t.status !== 'arquivado') return false
    if (search) {
      const q = search.toLowerCase()
      const matchName = t.name.toLowerCase().includes(q)
      const matchCat = (t.category || '').toLowerCase().includes(q)
      if (!matchName && !matchCat) return false
    }
    return true
  })

  const duplicar = (t: ReportTemplate) => {
    adConfirm('Deseja criar uma cópia deste modelo de relatório?', 'Duplicar Relatório', () => {
      const novo: ReportTemplate = {
        ...t,
        id: `TPL-${Date.now()}`,
        name: `${t.name} (Cópia)`,
        status: 'rascunho',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      setTemplates(prev => [novo, ...prev])
      addLog('Duplicação', `Modelo duplicado a partir de ${t.name}`)
    })
  }

  const arquivar = (t: ReportTemplate) => {
    const isArchived = t.status === 'arquivado'
    adConfirm(
      isArchived
        ? 'Deseja reativar este modelo de relatório?'
        : 'Deseja arquivar este modelo? Ele ficará oculto para novos envios até ser reativado.',
      isArchived ? 'Reativar Relatório' : 'Arquivar Relatório',
      () => {
        setTemplates(prev =>
          prev.map(x => (x.id === t.id ? { ...x, status: isArchived ? 'ativo' : 'arquivado' } : x))
        )
        addLog(isArchived ? 'Desarquivamento' : 'Arquivamento', `Modelo: ${t.name}`)
      }
    )
  }

  const excluir = (t: ReportTemplate) => {
    adConfirm(
      `Deseja excluir permanentemente o modelo "${t.name}"? Esta ação não pode ser desfeita.`,
      'Excluir Relatório',
      () => {
        setTemplates(prev => prev.filter(x => x.id !== t.id))
        addLog('Exclusão', `Modelo excluído: ${t.name}`)
      }
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style dangerouslySetInnerHTML={{__html: `
        .ad-rlist-row {
          transition: background 0.15s ease;
        }
        .ad-rlist-row:hover {
          background: #f8fafc !important;
        }
        .ad-rlist-icon-btn {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #475569;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .ad-rlist-icon-btn:hover {
          background: #f1f5f9;
          color: #0f172a;
          border-color: #cbd5e1;
        }
        .ad-rlist-icon-btn.danger:hover {
          background: #fef2f2;
          color: #ef4444;
          border-color: #fecaca;
        }
        @media (max-width: 768px) {
          .ad-rlist-topbar {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 14px !important;
          }
          .ad-rlist-controls {
            flex-direction: column !important;
            width: 100% !important;
          }
          .ad-rlist-search {
            width: 100% !important;
          }
          .ad-rlist-desktop {
            display: none !important;
          }
          .ad-rlist-mobile {
            display: flex !important;
            flex-direction: column !important;
            gap: 12px !important;
          }
        }
        @media (min-width: 769px) {
          .ad-rlist-mobile {
            display: none !important;
          }
        }
      `}} />

      {/* Top Header & Controls */}
      <div
        className="ad-rlist-topbar"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 18,
          padding: '20px 24px',
          boxShadow: '0 4px 20px -4px rgba(15, 23, 42, 0.04)'
        }}
      >
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: '#0f172a', margin: 0 }}>
            Modelos de Relatórios
          </h2>
          <p style={{ color: '#64748b', fontSize: 13.5, margin: '4px 0 0 0' }}>
            Crie e organize modelos personalizados para rotinas, acompanhamentos e avaliações.
          </p>
        </div>

        <div className="ad-rlist-controls" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="ad-rlist-search" style={{ position: 'relative', width: 260 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
            <input
              className="form-input"
              placeholder="Buscar relatório..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                paddingLeft: 36,
                paddingRight: search ? 32 : 12,
                width: '100%',
                height: 40,
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                fontSize: 13.5
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 'none',
                  background: 'transparent',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex'
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigate('builder', null)}
            style={{
              height: 40,
              padding: '0 18px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: 13.5,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
              boxShadow: '0 6px 16px -4px rgba(79, 70, 229, 0.4)',
              whiteSpace: 'nowrap'
            }}
          >
            <Plus size={17} strokeWidth={2.5} />
            Criar Relatório
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div
          style={{
            display: 'inline-flex',
            background: '#f1f5f9',
            padding: 4,
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            gap: 4
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('ativos')}
            style={{
              padding: '7px 14px',
              borderRadius: 9,
              border: 'none',
              background: activeTab === 'ativos' ? '#ffffff' : 'transparent',
              color: activeTab === 'ativos' ? '#0f172a' : '#64748b',
              fontWeight: activeTab === 'ativos' ? 700 : 600,
              fontSize: 13,
              cursor: 'pointer',
              boxShadow: activeTab === 'ativos' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease'
            }}
          >
            <span>Ativos & Rascunhos</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '1px 7px',
                borderRadius: 999,
                background: activeTab === 'ativos' ? '#eef2ff' : '#e2e8f0',
                color: activeTab === 'ativos' ? '#4f46e5' : '#64748b'
              }}
            >
              {ativosCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('arquivados')}
            style={{
              padding: '7px 14px',
              borderRadius: 9,
              border: 'none',
              background: activeTab === 'arquivados' ? '#ffffff' : 'transparent',
              color: activeTab === 'arquivados' ? '#0f172a' : '#64748b',
              fontWeight: activeTab === 'arquivados' ? 700 : 600,
              fontSize: 13,
              cursor: 'pointer',
              boxShadow: activeTab === 'arquivados' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease'
            }}
          >
            <span>Arquivados</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '1px 7px',
                borderRadius: 999,
                background: activeTab === 'arquivados' ? '#eef2ff' : '#e2e8f0',
                color: activeTab === 'arquivados' ? '#4f46e5' : '#64748b'
              }}
            >
              {arquivadosCount}
            </span>
          </button>
        </div>

        <div style={{ fontSize: 12.5, color: '#64748b', fontWeight: 500 }}>
          Exibindo <strong>{filtered.length}</strong> {filtered.length === 1 ? 'modelo' : 'modelos'}
        </div>
      </div>

      {/* Desktop Table */}
      <div
        className="ad-rlist-desktop"
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: '0 4px 20px -4px rgba(15, 23, 42, 0.04)'
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '14px 20px', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: '#64748b' }}>
                Modelo de Relatório
              </th>
              <th style={{ padding: '14px 16px', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: '#64748b' }}>
                Categoria
              </th>
              <th style={{ padding: '14px 16px', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: '#64748b', textAlign: 'center' }}>
                Estrutura
              </th>
              <th style={{ padding: '14px 16px', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: '#64748b', textAlign: 'center' }}>
                Status
              </th>
              <th style={{ padding: '14px 20px', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: '#64748b', textAlign: 'right' }}>
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '56px 24px', color: '#64748b' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                      <FileText size={22} />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#334155' }}>Nenhum modelo encontrado</div>
                    <div style={{ fontSize: 13, color: '#94a3b8' }}>
                      {search ? 'Tente buscar com outros termos.' : 'Clique em "Criar Relatório" para começar.'}
                    </div>
                  </div>
                </td>
              </tr>
            )}
            {filtered.map(t => {
              const fieldsCount = t.sections.reduce((acc, sec) => acc + sec.fields.length, 0)
              const accent = t.color || '#4f46e5'
              return (
                <tr
                  key={t.id}
                  className="ad-rlist-row"
                  style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: '#ffffff' }}
                  onClick={() => onNavigate('builder', t.id)}
                >
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 12,
                          background: `${accent}15`,
                          color: accent,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          border: `1px solid ${accent}30`
                        }}
                      >
                        <FileText size={19} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 14.5, color: '#0f172a' }}>{t.name}</span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: '#64748b',
                              background: '#f1f5f9',
                              padding: '1px 7px',
                              borderRadius: 6
                            }}
                          >
                            v{t.version}
                          </span>
                        </div>
                        {t.description && t.description.trim() !== '' && (
                          <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 380 }}>
                            {t.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: '16px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 10px',
                        borderRadius: 8,
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: '#475569'
                      }}
                    >
                      {t.category || 'Geral'}
                    </span>
                  </td>

                  <td style={{ padding: '16px', textAlign: 'center' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 11px',
                        borderRadius: 999,
                        background: '#eef2ff',
                        color: '#4f46e5',
                        fontSize: 12,
                        fontWeight: 700
                      }}
                    >
                      <Layers size={13} />
                      {fieldsCount} {fieldsCount === 1 ? 'campo' : 'campos'}
                    </span>
                  </td>

                  <td style={{ padding: '16px', textAlign: 'center' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontSize: 11.5,
                        fontWeight: 700,
                        background:
                          t.status === 'ativo'
                            ? '#ecfdf5'
                            : t.status === 'rascunho'
                              ? '#fffbeb'
                              : '#f1f5f9',
                        color:
                          t.status === 'ativo'
                            ? '#059669'
                            : t.status === 'rascunho'
                              ? '#d97706'
                              : '#64748b',
                        border: `1px solid ${
                          t.status === 'ativo'
                            ? '#a7f3d0'
                            : t.status === 'rascunho'
                              ? '#fde68a'
                              : '#e2e8f0'
                        }`
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background:
                            t.status === 'ativo'
                              ? '#10b981'
                              : t.status === 'rascunho'
                                ? '#f59e0b'
                                : '#94a3b8'
                        }}
                      />
                      {t.status.toUpperCase()}
                    </span>
                  </td>

                  <td style={{ padding: '16px 20px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="ad-rlist-icon-btn"
                        onClick={() => onNavigate('filler', t.id)}
                        title="Simular preenchimento"
                      >
                        <Play size={15} />
                      </button>
                      <button
                        type="button"
                        className="ad-rlist-icon-btn"
                        onClick={() => duplicar(t)}
                        title="Duplicar modelo"
                      >
                        <Copy size={15} />
                      </button>
                      <button
                        type="button"
                        className="ad-rlist-icon-btn"
                        onClick={() => arquivar(t)}
                        title={t.status === 'arquivado' ? 'Reativar modelo' : 'Arquivar modelo'}
                      >
                        {t.status === 'arquivado' ? <RotateCcw size={15} /> : <Archive size={15} />}
                      </button>
                      {t.status === 'arquivado' && (
                        <button
                          type="button"
                          className="ad-rlist-icon-btn danger"
                          onClick={() => excluir(t)}
                          title="Excluir permanentemente"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onNavigate('builder', t.id)}
                        style={{
                          height: 34,
                          padding: '0 14px',
                          borderRadius: 10,
                          border: '1px solid #e2e8f0',
                          background: '#f8fafc',
                          color: '#0f172a',
                          fontSize: 13,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = '#4f46e5'
                          e.currentTarget.style.color = '#ffffff'
                          e.currentTarget.style.borderColor = '#4f46e5'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = '#f8fafc'
                          e.currentTarget.style.color = '#0f172a'
                          e.currentTarget.style.borderColor = '#e2e8f0'
                        }}
                      >
                        <Edit3 size={14} />
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="ad-rlist-mobile">
        {filtered.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 20px',
              background: '#ffffff',
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              color: '#64748b'
            }}
          >
            Nenhum modelo encontrado.
          </div>
        )}
        {filtered.map(t => {
          const fieldsCount = t.sections.reduce((acc, sec) => acc + sec.fields.length, 0)
          const accent = t.color || '#4f46e5'
          return (
            <div
              key={t.id}
              onClick={() => onNavigate('builder', t.id)}
              style={{
                background: '#ffffff',
                borderRadius: 16,
                border: '1px solid #e2e8f0',
                padding: '16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 11,
                      background: `${accent}15`,
                      color: accent,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <FileText size={18} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14.5, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>
                      v{t.version} • {t.category || 'Geral'}
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    background:
                      t.status === 'ativo'
                        ? '#ecfdf5'
                        : t.status === 'rascunho'
                          ? '#fffbeb'
                          : '#f1f5f9',
                    color:
                      t.status === 'ativo'
                        ? '#059669'
                        : t.status === 'rascunho'
                          ? '#d97706'
                          : '#64748b',
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 999,
                    flexShrink: 0
                  }}
                >
                  {t.status.toUpperCase()}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid #f1f5f9',
                  paddingTop: 12
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 12,
                    color: '#4f46e5',
                    background: '#eef2ff',
                    padding: '3px 10px',
                    borderRadius: 999,
                    fontWeight: 700
                  }}
                >
                  <Layers size={12} />
                  {fieldsCount} {fieldsCount === 1 ? 'campo' : 'campos'}
                </span>

                <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                  <button
                    type="button"
                    className="ad-rlist-icon-btn"
                    onClick={() => duplicar(t)}
                    title="Duplicar"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    type="button"
                    className="ad-rlist-icon-btn"
                    onClick={() => arquivar(t)}
                    title={t.status === 'arquivado' ? 'Reativar' : 'Arquivar'}
                  >
                    {t.status === 'arquivado' ? <RotateCcw size={14} /> : <Archive size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('builder', t.id)}
                    style={{
                      height: 34,
                      padding: '0 12px',
                      borderRadius: 10,
                      border: 'none',
                      background: '#4f46e5',
                      color: '#ffffff',
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      cursor: 'pointer'
                    }}
                  >
                    <Edit3 size={13} />
                    Editar
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
