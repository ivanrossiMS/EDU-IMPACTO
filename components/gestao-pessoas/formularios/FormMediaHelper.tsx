'use client'

import React, { useRef, useState } from 'react'
import {
  Image as ImageIcon,
  Upload,
  Link2,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Maximize2,
  X,
  Sparkles,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import {
  FormMediaItem,
  FormThemeConfig,
  HEADER_BANNER_PRESETS,
} from '@/lib/gestao-pessoas/formulariosTypes'

/**
 * Uploads an image file to Supabase Storage (/api/upload-midia) so it gets a permanent CDN URL.
 * Falls back to optimized client-side compressed dataUrl if storage is unreachable.
 */
export async function uploadFormImageFile(
  file: File,
  maxWidth = 1400,
  quality = 0.84
): Promise<string> {
  // 1. Try uploading to Supabase Storage first for permanent CDN URL
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('bucket', 'comunicados-midia')
    formData.append('folder', 'formularios')
    const res = await fetch('/api/upload-midia', {
      method: 'POST',
      body: formData,
    })
    if (res.ok) {
      const data = await res.json()
      if (data?.url) {
        return data.url
      }
    }
  } catch (err) {
    console.warn(
      '[uploadFormImageFile] Storage upload failed, falling back to compressed dataUrl',
      err
    )
  }

  // 2. High-efficiency client-side compressed dataUrl fallback
  return await compressImageFileToDataUrl(file, maxWidth, quality)
}

/**
 * Compresses and converts an uploaded image File into an optimized Data URL
 * so it can be stored cleanly in Supabase JSONB without large payload issues.
 */
export async function compressImageFileToDataUrl(
  file: File,
  maxWidth = 1200,
  quality = 0.84
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('O arquivo selecionado não é uma imagem válida.'))
      return
    }

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo de imagem.'))
    reader.onload = () => {
      const result = String(reader.result || '')
      // Keep SVG or GIF as-is
      if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
        resolve(result)
        return
      }

      const img = new window.Image()
      img.onerror = () => resolve(result)
      img.onload = () => {
        let targetW = img.width
        let targetH = img.height
        if (targetW > maxWidth) {
          const ratio = maxWidth / targetW
          targetW = Math.round(targetW * ratio)
          targetH = Math.round(targetH * ratio)
        }

        const canvas = document.createElement('canvas')
        canvas.width = targetW
        canvas.height = targetH
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(result)
          return
        }
        ctx.drawImage(img, 0, 0, targetW, targetH)
        const mime = file.type === 'image/png' ? 'image/png' : 'image/webp'
        try {
          const compressed = canvas.toDataURL(mime, quality)
          resolve(compressed)
        } catch {
          resolve(result)
        }
      }
      img.src = result
    }
    reader.readAsDataURL(file)
  })
}

// ============================================================================
// HEADER BANNER & LOGO EDITOR (USED IN HEADER CARD & LAYOUT TAB)
// ============================================================================
interface HeaderBannerAndLogoEditorProps {
  theme: FormThemeConfig
  primaryColor: string
  onChangeTheme: (patch: Partial<FormThemeConfig>) => void
}

export function HeaderBannerAndLogoEditor({
  theme,
  primaryColor,
  onChangeTheme,
}: HeaderBannerAndLogoEditorProps) {
  const bannerInputRef = useRef<HTMLInputElement | null>(null)
  const logoInputRef = useRef<HTMLInputElement | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [showUrlField, setShowUrlField] = useState(false)
  const [uploading, setUploading] = useState(false)

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const imageUrl = await uploadFormImageFile(file, 1600, 0.85)
      onChangeTheme({
        headerStyle: 'banner_image',
        headerImageUrl: imageUrl,
        headerBannerMode: theme.headerBannerMode || 'top_banner',
        headerBannerHeight: theme.headerBannerHeight || 200,
      })
    } catch (err: any) {
      alert(err?.message || 'Erro ao carregar imagem.')
    } finally {
      setUploading(false)
      if (bannerInputRef.current) bannerInputRef.current.value = ''
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const imageUrl = await uploadFormImageFile(file, 480, 0.88)
      onChangeTheme({
        headerLogoUrl: imageUrl,
      })
    } catch (err: any) {
      alert(err?.message || 'Erro ao carregar logo.')
    } finally {
      setUploading(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  return (
    <div
      style={{
        background: '#f8fafc',
        borderRadius: 16,
        border: '1px solid #e2e8f0',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ImageIcon size={17} color={primaryColor} />
          <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
            Imagens do Cabeçalho (Capa / Banner e Logo Institucional)
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            onChange={handleBannerUpload}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => bannerInputRef.current?.click()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px',
              borderRadius: 9,
              border: `1px solid ${primaryColor}`,
              background: '#ffffff',
              color: primaryColor,
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            <Upload size={14} /> {uploading ? 'Processando...' : 'Enviar Imagem de Capa'}
          </button>

          <button
            type="button"
            onClick={() => setShowUrlField(prev => !prev)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px',
              borderRadius: 9,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Link2 size={14} /> Colar URL da Capa
          </button>

          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => logoInputRef.current?.click()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px',
              borderRadius: 9,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Sparkles size={14} /> {theme.headerLogoUrl ? 'Trocar Logo' : '+ Inserir Logo no Cabeçalho'}
          </button>
        </div>
      </div>

      {/* URL Input Bar */}
      {showUrlField && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="url"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder="Cole o link da imagem (https://...)"
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 9,
              border: '1px solid #cbd5e1',
              fontSize: 13,
              background: '#ffffff',
            }}
          />
          <button
            type="button"
            onClick={() => {
              if (!urlInput.trim()) return
              onChangeTheme({
                headerStyle: 'banner_image',
                headerImageUrl: urlInput.trim(),
                headerBannerMode: theme.headerBannerMode || 'top_banner',
                headerBannerHeight: theme.headerBannerHeight || 200,
              })
              setUrlInput('')
              setShowUrlField(false)
            }}
            style={{
              padding: '8px 16px',
              borderRadius: 9,
              border: 'none',
              background: primaryColor,
              color: '#ffffff',
              fontSize: 12.5,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Aplicar Capa
          </button>
        </div>
      )}

      {/* Preset Banners Quick Picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b' }}>
          Capas prontas:
        </span>
        {HEADER_BANNER_PRESETS.map(preset => (
          <button
            key={preset.id}
            type="button"
            onClick={() =>
              onChangeTheme({
                headerStyle: 'banner_image',
                headerImageUrl: preset.url,
                headerBannerMode: theme.headerBannerMode || 'top_banner',
                headerBannerHeight: theme.headerBannerHeight || 190,
              })
            }
            style={{
              padding: '4px 10px',
              borderRadius: 99,
              border:
                theme.headerImageUrl === preset.url
                  ? `1.5px solid ${primaryColor}`
                  : '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Active Banner Preview & Controls */}
      {theme.headerImageUrl && (
        <div
          style={{
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid #cbd5e1',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div
            style={{
              position: 'relative',
              height: theme.headerBannerHeight || 180,
              borderRadius: 10,
              overflow: 'hidden',
              background: '#0f172a',
            }}
          >
            <img
              src={theme.headerImageUrl}
              alt="Capa do cabeçalho"
              style={{
                width: '100%',
                height: '100%',
                objectFit: theme.headerBannerFit || 'cover',
                display: 'block',
              }}
            />
            {theme.headerBannerMode === 'overlay' && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(180deg, rgba(15,23,42,0.45) 0%, rgba(15,23,42,0.85) 100%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 16,
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    color: theme.headerTitleColor || '#ffffff',
                    textShadow: '0 2px 4px rgba(0,0,0,0.6)',
                    textAlign: 'center',
                  }}
                >
                  Título do Formulário
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: theme.headerSubtitleColor || theme.headerTitleColor || '#ffffff',
                    opacity: 0.92,
                    marginTop: 4,
                  }}
                >
                  Fundo Integrado ao Título (Ativo)
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() =>
                onChangeTheme({
                  headerImageUrl: undefined,
                  headerStyle: 'gradient',
                })
              }
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 10px',
                borderRadius: 8,
                border: 'none',
                background: 'rgba(220, 38, 38, 0.92)',
                color: '#ffffff',
                fontSize: 11.5,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <Trash2 size={13} /> Remover Capa
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 10,
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                Posição da Imagem no Cabeçalho
              </label>
              <select
                value={theme.headerBannerMode || 'top_banner'}
                onChange={e =>
                  onChangeTheme({ headerBannerMode: e.target.value as any })
                }
                style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12.5, fontWeight: 600 }}
              >
                <option value="top_banner">Faixa Superior (Acima do Título)</option>
                <option value="overlay">Fundo Integrado ao Título</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                Altura da Capa
              </label>
              <select
                value={theme.headerBannerHeight || 200}
                onChange={e =>
                  onChangeTheme({ headerBannerHeight: Number(e.target.value) })
                }
                style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12.5, fontWeight: 600 }}
              >
                <option value={140}>Compacta (140px)</option>
                <option value={200}>Média Padrão (200px)</option>
                <option value={260}>Grande Destaque (260px)</option>
                <option value={320}>Extra Grande (320px)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                Encaixe da Imagem
              </label>
              <select
                value={theme.headerBannerFit || 'cover'}
                onChange={e =>
                  onChangeTheme({ headerBannerFit: e.target.value as any })
                }
                style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12.5, fontWeight: 600 }}
              >
                <option value="cover">Preencher Largura (Cover)</option>
                <option value="contain">Mostrar Inteira sem Cortar (Contain)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                Cor da Fonte do Título Principal
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="color"
                  value={theme.headerTitleColor || '#ffffff'}
                  onChange={e =>
                    onChangeTheme({
                      headerTitleColor: e.target.value,
                      headerSubtitleColor: e.target.value,
                    })
                  }
                  title="Personalizar cor da fonte do título"
                  style={{
                    width: 32,
                    height: 28,
                    padding: 0,
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: '#ffffff',
                  }}
                />
                <select
                  value={theme.headerTitleColor || '#ffffff'}
                  onChange={e =>
                    onChangeTheme({
                      headerTitleColor: e.target.value,
                      headerSubtitleColor: e.target.value,
                    })
                  }
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  <option value="#ffffff">⚪ Branco (Padrão)</option>
                  <option value="#0f172a">⚫ Escuro / Grafite</option>
                  <option value="#fef08a">🟡 Amarelo Dourado</option>
                  <option value="#93c5fd">🔵 Azul Claro</option>
                  <option value="#86efac">🟢 Verde Claro</option>
                  <option value="#e9d5ff">🟣 Violeta Claro</option>
                  <option value="#fed7aa">🟠 Laranja Suave</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Header Logo Preview */}
      {theme.headerLogoUrl && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff',
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid #cbd5e1',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img
              src={theme.headerLogoUrl}
              alt="Logo do formulário"
              style={{
                width: 48,
                height: 48,
                objectFit: 'contain',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                padding: 4,
              }}
            />
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0f172a' }}>
                Logo / Emblema do Cabeçalho Ativa
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b' }}>
                Exibida ao lado do título principal do formulário
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onChangeTheme({ headerLogoUrl: undefined })}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid #fecaca',
              background: '#fef2f2',
              color: '#dc2626',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Remover Logo
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// REUSABLE MEDIA COLLECTION EDITOR (FOR INSTRUCTIONS, SECTIONS & QUESTIONS)
// ============================================================================
interface MediaCollectionEditorProps {
  media: FormMediaItem[] | undefined
  onChange: (nextMedia: FormMediaItem[]) => void
  primaryColor: string
  buttonLabel?: string
  defaultPosition?: 'above' | 'below'
  showPositionToggle?: boolean
}

export function MediaCollectionEditor({
  media = [],
  onChange,
  primaryColor,
  buttonLabel = '+ Inserir Imagem',
  defaultPosition = 'below',
  showPositionToggle = true,
}: MediaCollectionEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isAddingUrl, setIsAddingUrl] = useState(false)
  const [urlText, setUrlText] = useState('')
  const [uploading, setUploading] = useState(false)

  const addMediaUrl = (url: string, caption = '') => {
    const newItem: FormMediaItem = {
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      url,
      caption,
      width: '100%',
      align: 'center',
      position: defaultPosition,
    }
    onChange([...media, newItem])
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setUploading(true)
    try {
      const uploadedItems: FormMediaItem[] = []
      for (const file of files) {
        const imageUrl = await uploadFormImageFile(file, 1400, 0.84)
        uploadedItems.push({
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          url: imageUrl,
          caption: '',
          alt: file.name.replace(/\.[^.]+$/, ''),
          width: '100%',
          align: 'center',
          position: defaultPosition,
        })
      }
      onChange([...media, ...uploadedItems])
    } catch (err: any) {
      alert(err?.message || 'Erro ao enviar imagem.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const updateItem = (id: string, patch: Partial<FormMediaItem>) => {
    onChange(media.map(m => (m.id === id ? { ...m, ...patch } : m)))
  }

  const removeItem = (id: string) => {
    onChange(media.filter(m => m.id !== id))
  }

  const moveItem = (index: number, dir: 'up' | 'down') => {
    const target = dir === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= media.length) return
    const next = [...media]
    const tmp = next[index]
    next[index] = next[target]
    next[target] = tmp
    onChange(next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Action Bar to Add Image */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 9,
            border: `1px dashed ${primaryColor}`,
            background: `${primaryColor}0d`,
            color: primaryColor,
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          <ImageIcon size={14} /> {uploading ? 'Carregando imagem...' : buttonLabel}
        </button>

        <button
          type="button"
          onClick={() => setIsAddingUrl(prev => !prev)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 10px',
            borderRadius: 9,
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#475569',
            fontSize: 11.5,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Link2 size={13} /> Por Link/URL
        </button>
      </div>

      {isAddingUrl && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="url"
            value={urlText}
            onChange={e => setUrlText(e.target.value)}
            placeholder="Cole a URL da imagem (https://...)"
            style={{
              flex: 1,
              padding: '7px 12px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              fontSize: 12.5,
            }}
          />
          <button
            type="button"
            onClick={() => {
              if (!urlText.trim()) return
              addMediaUrl(urlText.trim())
              setUrlText('')
              setIsAddingUrl(false)
            }}
            style={{
              padding: '7px 14px',
              borderRadius: 8,
              border: 'none',
              background: primaryColor,
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Inserir
          </button>
        </div>
      )}

      {/* List of Attached Images */}
      {media.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {media.map((item, idx) => (
            <div
              key={item.id}
              style={{
                background: '#f8fafc',
                borderRadius: 14,
                border: '1px solid #cbd5e1',
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 11.5, fontWeight: 800, color: '#334155' }}>
                  🖼️ Imagem Anexada #{idx + 1}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {/* Width selector */}
                  <div
                    style={{
                      display: 'inline-flex',
                      background: '#e2e8f0',
                      padding: 2,
                      borderRadius: 7,
                      gap: 2,
                    }}
                    title="Largura da imagem"
                  >
                    {(['25%', '50%', '75%', '100%'] as const).map(w => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => updateItem(item.id, { width: w })}
                        style={{
                          padding: '3px 7px',
                          borderRadius: 5,
                          border: 'none',
                          background: (item.width || '100%') === w ? '#ffffff' : 'transparent',
                          color: (item.width || '100%') === w ? '#0f172a' : '#475569',
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        {w}
                      </button>
                    ))}
                  </div>

                  {/* Alignment selector */}
                  <div
                    style={{
                      display: 'inline-flex',
                      background: '#e2e8f0',
                      padding: 2,
                      borderRadius: 7,
                      gap: 2,
                    }}
                    title="Alinhamento"
                  >
                    {[
                      { id: 'left', icon: AlignLeft, label: 'Esquerda' },
                      { id: 'center', icon: AlignCenter, label: 'Centro' },
                      { id: 'right', icon: AlignRight, label: 'Direita' },
                    ].map(al => {
                      const Icon = al.icon
                      const active = (item.align || 'center') === al.id
                      return (
                        <button
                          key={al.id}
                          type="button"
                          onClick={() => updateItem(item.id, { align: al.id as any })}
                          title={al.label}
                          style={{
                            padding: '4px 6px',
                            borderRadius: 5,
                            border: 'none',
                            background: active ? '#ffffff' : 'transparent',
                            color: active ? '#0f172a' : '#475569',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Icon size={13} />
                        </button>
                      )
                    })}
                  </div>

                  {/* Position relative to instruction text */}
                  {showPositionToggle && (
                    <select
                      aria-label="Posição da imagem em relação ao texto"
                      value={item.position || defaultPosition}
                      onChange={e =>
                        updateItem(item.id, { position: e.target.value as any })
                      }
                      style={{
                        padding: '4px 8px',
                        borderRadius: 7,
                        border: '1px solid #cbd5e1',
                        fontSize: 11,
                        fontWeight: 700,
                        background: '#ffffff',
                      }}
                    >
                      <option value="above">Acima do texto</option>
                      <option value="below">Abaixo do texto</option>
                    </select>
                  )}

                  {media.length > 1 && (
                    <>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveItem(idx, 'up')}
                        style={{
                          padding: 4,
                          borderRadius: 6,
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          cursor: idx === 0 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === media.length - 1}
                        onClick={() => moveItem(idx, 'down')}
                        style={{
                          padding: 4,
                          borderRadius: 6,
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          cursor: idx === media.length - 1 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <ArrowDown size={12} />
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    title="Remover imagem"
                    style={{
                      padding: '4px 8px',
                      borderRadius: 7,
                      border: '1px solid #fecaca',
                      background: '#fef2f2',
                      color: '#dc2626',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Trash2 size={12} /> Excluir
                  </button>
                </div>
              </div>

              {/* Image Preview */}
              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    item.align === 'left'
                      ? 'flex-start'
                      : item.align === 'right'
                      ? 'flex-end'
                      : 'center',
                  background: '#ffffff',
                  padding: 10,
                  borderRadius: 10,
                  border: '1px solid #e2e8f0',
                }}
              >
                <img
                  src={item.url}
                  alt={item.caption || item.alt || 'Imagem ilustrativa'}
                  style={{
                    width: item.width || '100%',
                    maxWidth: '100%',
                    maxHeight: 320,
                    objectFit: 'contain',
                    borderRadius: 8,
                    display: 'block',
                  }}
                />
              </div>

              {/* Caption Input */}
              <input
                type="text"
                value={item.caption || ''}
                onChange={e => updateItem(item.id, { caption: e.target.value })}
                placeholder="Legenda ou texto explicativo abaixo da imagem (opcional)..."
                style={{
                  width: '100%',
                  padding: '7px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 12.5,
                  background: '#ffffff',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// RENDER MEDIA ITEMS IN FORM RESPONDENT VIEW (WITH LIGHTBOX ZOOM)
// ============================================================================
export function RenderMediaCollection({
  media,
  filterPosition,
}: {
  media?: FormMediaItem[]
  filterPosition?: 'above' | 'below'
}) {
  const [zoomedItem, setZoomedItem] = useState<FormMediaItem | null>(null)

  if (!media || media.length === 0) return null

  const filtered = filterPosition
    ? media.filter(m => (m.position || 'below') === filterPosition)
    : media

  if (filtered.length === 0) return null

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '8px 0' }}>
        {filtered.map(item => (
          <figure
            key={item.id}
            style={{
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems:
                item.align === 'left'
                  ? 'flex-start'
                  : item.align === 'right'
                  ? 'flex-end'
                  : 'center',
              gap: 6,
            }}
          >
            <div
              onClick={() => setZoomedItem(item)}
              title="Clique para ampliar a imagem"
              style={{
                width: item.width || '100%',
                maxWidth: '100%',
                position: 'relative',
                cursor: 'zoom-in',
                borderRadius: item.borderRadius ?? 14,
                overflow: 'hidden',
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
              }}
            >
              <img
                src={item.url}
                alt={item.caption || item.alt || 'Imagem ilustrativa do formulário'}
                loading="lazy"
                decoding="async"
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: 540,
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  bottom: 8,
                  right: 8,
                  background: 'rgba(15, 23, 42, 0.65)',
                  color: '#ffffff',
                  padding: '4px 8px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  backdropFilter: 'blur(4px)',
                }}
              >
                <Maximize2 size={11} /> Ampliar
              </span>
            </div>
            {item.caption && (
              <figcaption
                style={{
                  fontSize: 12.5,
                  color: '#64748b',
                  fontWeight: 600,
                  textAlign: item.align || 'center',
                  maxWidth: item.width || '100%',
                }}
              >
                {item.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>

      {/* Lightbox Modal when user clicks an image */}
      {zoomedItem && (
        <div
          onClick={() => setZoomedItem(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.86)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            cursor: 'zoom-out',
          }}
        >
          <button
            type="button"
            onClick={() => setZoomedItem(null)}
            aria-label="Fechar visualização da imagem"
            style={{
              position: 'absolute',
              top: 20,
              right: 20,
              width: 42,
              height: 42,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.12)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={22} />
          </button>
          <img
            src={zoomedItem.url}
            alt={zoomedItem.caption || zoomedItem.alt || 'Imagem ampliada'}
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '92vw',
              maxHeight: '82vh',
              objectFit: 'contain',
              borderRadius: 14,
              boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
              background: '#ffffff',
            }}
          />
          {zoomedItem.caption && (
            <div
              style={{
                marginTop: 14,
                color: '#f8fafc',
                fontSize: 14.5,
                fontWeight: 600,
                textAlign: 'center',
                maxWidth: 720,
              }}
            >
              {zoomedItem.caption}
            </div>
          )}
        </div>
      )}
    </>
  )
}
