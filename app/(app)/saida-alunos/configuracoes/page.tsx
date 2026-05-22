'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';

import { useState, useMemo, useEffect } from 'react'
import { useApiQuery } from '@/hooks/useApi'
import { SaidaProvider, useSaida } from '@/lib/saidaContext'
import { DataProvider, useData } from '@/lib/dataContext'
import { useVoice } from '@/lib/hooks/useVoice'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import * as XLSX from 'xlsx'
import {
  Settings, TestTube2, BarChart3, ShieldOff, UserCheck,
  Wifi, WifiOff, Filter, Download, Search, ChevronDown,
  CheckCircle2, XCircle, AlertTriangle, Users, GraduationCap,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// ABA: Configurações (conteúdo original)
// ─────────────────────────────────────────────────────────────────────────────
function TabConfiguracoes() {
  const isMobile = useIsMobile()
  const { config, updateConfig, clearLog } = useSaida()
  const voice = useVoice()

  // ── States for On-Demand Saving & Draft ──
  const [localConfig, setLocalConfig] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  // Sync draft state with global config when config is loaded for the first time
  useEffect(() => {
    if (config) {
      setLocalConfig((prev: any) => {
        if (!prev) return { ...config }
        return prev
      })
    }
  }, [config])

  // Helper to dynamically update fields in local draft without implicit 'any' warnings
  const updateLocalField = (field: string, value: any) => {
    setLocalConfig((prev: any) => (prev ? { ...prev, [field]: value } : prev))
  }

  // Reset or discard local draft changes
  const handleDiscard = () => {
    if (config) {
      setLocalConfig({ ...config })
    }
  }

  // Persist draft changes in Supabase and trigger success modal
  const handleSave = async () => {
    if (!localConfig) return
    setSaving(true)
    try {
      await updateConfig(localConfig)
      setShowSuccessModal(true)
      // Auto-close success modal after 3.5 seconds
      setTimeout(() => {
        setShowSuccessModal(false)
      }, 3500)
    } catch (err) {
      console.error('Error saving configurations:', err)
    } finally {
      setSaving(false)
    }
  }

  // Detect unsaved changes by deep comparison of JSON string representations
  const hasChanges = localConfig && config && JSON.stringify(localConfig) !== JSON.stringify(config)

  const testVoice = () => {
    let t = '3º Ano A - 2026'
    // Use localConfig for testing voice so they hear the draft!
    const targetConfig = localConfig || config
    if (targetConfig?.voiceTruncateTurma && targetConfig?.voiceTruncateChar) {
      t = t.split(targetConfig?.voiceTruncateChar || '-')[0].trim()
    }
    voice.speak(`João Silva, turma ${t}`, {
      rate: targetConfig?.voiceRate ?? 1, 
      pitch: targetConfig?.voicePitch ?? 1,
      volume: targetConfig?.voiceVolume ?? 1, 
      voiceURI: targetConfig?.voiceURI || '',
    })
  }

  // Loading / Skeleton Shimmer State
  if (!localConfig) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 620 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{
            background: 'hsl(var(--bg-elevated))',
            borderRadius: 16,
            border: '1px solid hsl(var(--border-subtle))',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ width: '40%', height: 16, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }} className="skeleton-shimmer" />
            <div style={{ width: '80%', height: 12, borderRadius: 4, background: 'rgba(255,255,255,0.03)' }} className="skeleton-shimmer" />
            <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.03)' }} className="skeleton-shimmer" />
          </div>
        ))}
        <style>{`
          .skeleton-shimmer {
            position: relative;
            overflow: hidden;
          }
          .skeleton-shimmer::after {
            content: "";
            position: absolute;
            top: 0; right: 0; bottom: 0; left: 0;
            transform: translateX(-100%);
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent);
            animation: shimmer 1.6s infinite;
          }
          @keyframes shimmer {
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 620, paddingBottom: hasChanges ? 80 : 0 }}>

      {/* Info card */}
      <div style={{
        padding: '14px 18px', borderRadius: 14,
        background: 'linear-gradient(135deg, rgba(6,182,212,0.07), rgba(99,102,241,0.04))',
        border: '1px solid rgba(6,182,212,0.25)',
        display: 'flex', alignItems: 'flex-start', gap: 12,
      }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>ℹ️</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4, color: '#06b6d4' }}>
            Responsáveis, RFID e vínculos gerenciados na Ficha do Aluno
          </div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', lineHeight: 1.6 }}>
            As pessoas autorizadas a retirar o aluno, os cartões RFID, os dias da semana e os
            bloqueios são configurados diretamente em{' '}
            <strong style={{ color: 'hsl(var(--text-base))' }}>
              Acadêmico → Alunos → Nova Código → Saúde → Autorizados a Retirar
            </strong>.
          </div>
        </div>
      </div>

      {/* ── VOZ ── */}
      <div style={{ background: 'hsl(var(--bg-elevated))', borderRadius: 16, border: '1px solid hsl(var(--border-subtle))', padding: '20px 24px' }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
          🔊 Chamada por Voz
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Anúncio por auto-falante</div>
            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>Falar o nome do aluno ao ser chamado</div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <div style={{ width: 44, height: 24, borderRadius: 12, position: 'relative', background: localConfig.voiceEnabled ? '#06b6d4' : 'hsl(var(--bg-overlay))', transition: 'background 0.2s' }}>
              <div style={{ position: 'absolute', top: 3, left: localConfig.voiceEnabled ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }}/>
            </div>
            <input type="checkbox" checked={localConfig.voiceEnabled ?? false} onChange={e => updateLocalField('voiceEnabled', e.target.checked)} style={{ display: 'none' }}/>
          </label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Ocultar sufixo da turma</div>
            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>Anuncia o nome da turma apenas até o caractere ao lado</div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {localConfig.voiceTruncateTurma && (
              <input
                type="text"
                maxLength={3}
                value={localConfig.voiceTruncateChar ?? '-'}
                onChange={e => updateLocalField('voiceTruncateChar', e.target.value)}
                style={{
                  width: 36, padding: '4px', textAlign: 'center', borderRadius: 8,
                  border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-base))',
                  color: 'hsl(var(--text-base))', fontSize: 12, outline: 'none'
                }}
                title="Caractere de corte (ex: -)"
              />
            )}
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <div style={{ width: 44, height: 24, borderRadius: 12, position: 'relative', background: localConfig.voiceTruncateTurma ? '#06b6d4' : 'hsl(var(--bg-overlay))', transition: 'background 0.2s' }}>
                <div style={{ position: 'absolute', top: 3, left: localConfig.voiceTruncateTurma ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }}/>
              </div>
              <input type="checkbox" checked={localConfig.voiceTruncateTurma ?? false} onChange={e => updateLocalField('voiceTruncateTurma', e.target.checked)} style={{ display: 'none' }}/>
            </label>
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>VOLUME</span><span style={{ color: '#06b6d4' }}>{Math.round((localConfig.voiceVolume ?? 1) * 100)}%</span>
          </label>
          <input type="range" min={0} max={1} step={0.05} value={localConfig.voiceVolume ?? 1}
            onChange={e => updateLocalField('voiceVolume', +e.target.value)}
            style={{ width: '100%', accentColor: '#06b6d4' }}/>
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>VELOCIDADE</span><span style={{ color: '#06b6d4' }}>{localConfig.voiceRate ?? 1}×</span>
          </label>
          <input type="range" min={0.5} max={2} step={0.1} value={localConfig.voiceRate ?? 1}
            onChange={e => updateLocalField('voiceRate', +e.target.value)}
            style={{ width: '100%', accentColor: '#06b6d4' }}/>
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>TOM DE VOZ (PITCH)</span><span style={{ color: '#06b6d4' }}>{localConfig.voicePitch ?? 1}×</span>
          </label>
          <input type="range" min={0.5} max={2} step={0.1} value={localConfig.voicePitch ?? 1}
            onChange={e => updateLocalField('voicePitch', +e.target.value)}
            style={{ width: '100%', accentColor: '#06b6d4' }}/>
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>VOZ / LOCUTOR</span>
          </label>
          <select
            value={localConfig.voiceURI || ''}
            onChange={e => updateLocalField('voiceURI', e.target.value)}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10,
              border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-base))',
              color: 'hsl(var(--text-base))', fontSize: 13, outline: 'none', cursor: 'pointer'
            }}
          >
            <option value="">Automático pelo Navegador (Recomendado)</option>
            {voice.voices
              .filter(v => v.lang.toLowerCase().includes('pt'))
              .sort((a, b) => {
                if (a.localService && !b.localService) return -1
                if (!a.localService && b.localService) return 1
                return a.name.localeCompare(b.name)
              })
              .map(v => {
                const isBR = v.lang.toLowerCase().includes('br')
                const isPT = v.lang.toLowerCase().includes('pt-pt')
                const isGoogle = v.name.toLowerCase().includes('google')
                const label = `${v.name} ${isBR ? '(Brasil 🇧🇷)' : isPT ? '(Portugal 🇵🇹)' : `(${v.lang})`} ${isGoogle ? ' [Nuvem]' : ''}`
                return <option key={v.voiceURI} value={v.voiceURI}>{label}</option>
              })}
          </select>
        </div>
        <button onClick={testVoice} style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px',
          borderRadius: 10, background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)',
          color: '#06b6d4', cursor: 'pointer', fontWeight: 700, fontSize: 12,
        }}>
          <TestTube2 size={13}/> Testar Voz
        </button>
      </div>

      {/* ── RFID ── */}
      <div style={{ background: 'hsl(var(--bg-elevated))', borderRadius: 16, border: '1px solid hsl(var(--border-subtle))', padding: '20px 24px' }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16 }}>📡 Leitura RFID</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Ativar leitor RFID no Painel Tablet</div>
            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>Captura automática de cartões</div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <div style={{ width: 44, height: 24, borderRadius: 12, position: 'relative', background: localConfig.rfidEnabled ? '#06b6d4' : 'hsl(var(--bg-overlay))', transition: 'background 0.2s' }}>
              <div style={{ position: 'absolute', top: 3, left: localConfig.rfidEnabled ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }}/>
            </div>
            <input type="checkbox" checked={localConfig.rfidEnabled ?? true} onChange={e => updateLocalField('rfidEnabled', e.target.checked)} style={{ display: 'none' }}/>
          </label>
        </div>
      </div>

      {/* ── MONITOR TV ── */}
      <div style={{ background: 'hsl(var(--bg-elevated))', borderRadius: 16, border: '1px solid hsl(var(--border-subtle))', padding: '20px 24px' }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16 }}>📺 Monitor TV</div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Quantidade de Repetições Seguidas</div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>Ao chamar, o auto-falante vai repetir após a primeira chamada</div>
            </div>
            <select
              value={localConfig.voiceRepeatCount ?? 0}
              onChange={e => updateLocalField('voiceRepeatCount', +e.target.value)}
              style={{
                padding: '8px 12px', borderRadius: 8,
                border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-base))',
                color: 'hsl(var(--text-base))', fontSize: 12, outline: 'none', fontWeight: 600, cursor: 'pointer'
              }}
            >
              <option value={0}>Não repetir</option>
              <option value={1}>Repetir 1 vez seguidamente</option>
              <option value={2}>Repetir 2 vezes seguidamente</option>
              <option value={3}>Repetir 3 vezes seguidamente</option>
            </select>
          </div>
          <label style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>TEMPO NO MONITOR TV APÓS CONFIRMAR</span>
            <span style={{ color: '#06b6d4' }}>{localConfig.tvDisplayTime ?? 30}s</span>
          </label>
          <input type="range" min={5} max={600} step={5} value={localConfig.tvDisplayTime ?? 30}
            onChange={e => updateLocalField('tvDisplayTime', +e.target.value)}
            style={{ width: '100%', accentColor: '#06b6d4', marginBottom: 16 }}/>

          <label style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>TEMPO PARA STATUS ATRASADO (MINUTOS)</span>
            <span style={{ color: '#06b6d4' }}>{localConfig.tvUrgentTime ?? 5} min</span>
          </label>
          <input type="range" min={1} max={60} step={1} value={localConfig.tvUrgentTime ?? 5}
            onChange={e => updateLocalField('tvUrgentTime', +e.target.value)}
            style={{ width: '100%', accentColor: '#06b6d4' }}/>
        </div>
      </div>

      {/* ── DANGER ── */}
      <div style={{ background: 'rgba(239,68,68,0.04)', borderRadius: 16, border: '1px solid rgba(239,68,68,0.15)', padding: '20px 24px' }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: '#ef4444', marginBottom: 12 }}>⚠️ Zona de Risco</div>
        <button onClick={() => { if (confirm('Limpar todo o log do sistema?')) clearLog() }}
          style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
          🗑 Limpar Log do Sistema
        </button>
      </div>

      {/* ── Floating Action Bar for Unsaved Changes ── */}
      {hasChanges && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 48px)',
          maxWidth: 580,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(6, 182, 212, 0.15)',
          borderRadius: 24,
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          zIndex: 999,
          animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18, animation: 'pulseEmoji 1.5s infinite' }}>⚠️</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Alterações não salvas</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>Salve ou descarte suas alterações</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleDiscard}
              style={{
                padding: '8px 16px',
                borderRadius: 12,
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#e2e8f0',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
              }}
            >
              Descartar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '8px 18px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #06b6d4, #6366f1)',
                border: 'none',
                color: '#fff',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(6, 182, 212, 0.3)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 6px 18px rgba(6, 182, 212, 0.45)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(6, 182, 212, 0.3)'
              }}
            >
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      )}

      {/* ── Ultra Modern Success Modal ── */}
      {showSuccessModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(2, 6, 23, 0.75)',
          backdropFilter: 'blur(12px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          animation: 'modalFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}>
          <div className="glass-card animate-modal" style={{
            width: '100%',
            maxWidth: 420,
            background: 'hsl(var(--bg-elevated))',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.4), 0 0 40px rgba(16, 185, 129, 0.15)',
            borderRadius: 24,
            padding: '32px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}>
            {/* Animated Check Circle */}
            <div className="success-circle" style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '2px dashed rgba(16, 185, 129, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline className="success-checkmark" points="20 6 9 17 4 12" />
              </svg>
            </div>

            <h3 style={{
              fontFamily: 'Outfit, sans-serif',
              fontSize: 20,
              fontWeight: 900,
              color: 'hsl(var(--text-base))',
              margin: '0 0 8px 0',
              letterSpacing: '-0.02em'
            }}>
              Configurações Salvas!
            </h3>
            
            <p style={{
              fontSize: 13,
              color: 'hsl(var(--text-muted))',
              lineHeight: 1.6,
              margin: '0 0 24px 0'
            }}>
              As alterações foram persistidas com sucesso e já estão ativas em todos os monitores e painéis de TV da portaria.
            </p>

            <button
              onClick={() => setShowSuccessModal(false)}
              style={{
                width: '100%',
                padding: '12px 24px',
                borderRadius: 14,
                background: 'linear-gradient(135deg, #10b981, #059669)',
                border: 'none',
                color: '#fff',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 6px 18px rgba(16, 185, 129, 0.4)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.25)'
              }}
            >
              Ok, Entendi
            </button>
          </div>
        </div>
      )}

      {/* ── Keyframe Animations Styling ── */}
      <style>{`
        @keyframes slideUp {
          from { transform: translate(-50%, 40px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        @keyframes pulseEmoji {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalScaleUp {
          from { transform: scale(0.92); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes drawCheckmark {
          to { stroke-dashoffset: 0; }
        }
        @keyframes scaleUpSuccess {
          from { transform: scale(0.8); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-modal {
          animation: modalScaleUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .success-circle {
          animation: scaleUpSuccess 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .success-checkmark {
          stroke-dasharray: 50;
          stroke-dashoffset: 50;
          animation: drawCheckmark 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.15s forwards;
        }
      `}</style>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipos auxiliares
// ─────────────────────────────────────────────────────────────────────────────
type FilterKey =
  | 'todos'
  | 'sem_rfid'
  | 'pode_sair_sozinho'
  | 'bloqueado'
  | 'dia_restrito'
  | 'sem_responsavel'

interface AlunoRow {
  id: string
  nome: string
  turma: string
  turno: string
  foto: string | null
  autorizaSaida: boolean
  autorizados: any[]
  // flags calculadas
  temRFID: boolean
  algumBloqueado: boolean
  algumDiaRestrito: boolean
  semResponsavel: boolean
}

const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

function normalizeDay(day: string): string {
  if (!day) return '';
  return day
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// ABA: Relatórios
// ─────────────────────────────────────────────────────────────────────────────
function TabRelatorios() {
  const [todasTurmas] = useSupabaseArray<any>('turmas');
  const isMobile = useIsMobile()

  const { data: apiResponse } = useApiQuery<any>(
    ['alunos-report'],
    '/api/alunos?limit=1000'
  )
  const alunos = apiResponse?.data || []

  const getTurmaNome = (id: string) => {
    return (todasTurmas || []).find((t: any) => String(t.id) === String(id))?.nome || id
  }

  const [filter, setFilter] = useState<FilterKey>('todos')
  const [search, setSearch] = useState('')
  const [turmaFilter, setTurmaFilter] = useState('todas')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const todayIdx = new Date().getDay() // 0=Dom ... 6=Sáb
  const todayKey = DIAS_SEMANA[todayIdx]

  // ── Build rows ──────────────────────────────────────────────────────────────
  const rows = useMemo<AlunoRow[]>(() => {
    return (alunos || []).map((a: any) => {
      const autorizados: any[] = a.responsaveis || []
      const autorizaSaida: boolean = !!a.autorizadoSairSozinho

      const temRFID = autorizados.some(r => r.rfid && r.rfid.trim().length > 0)
      const algumBloqueado = autorizados.some(r => r.proibido === true)
      const algumDiaRestrito = autorizados.some(r => {
        const dias: string[] = r.diasSemana || r.diasAcesso || r.dias_acesso || []
        if (dias.length === 0) return false
        const normalizedDias = dias.map(d => normalizeDay(d))
        return !normalizedDias.includes(normalizeDay(todayKey))
      })
      const semResponsavel = autorizados.length === 0 && !autorizaSaida

      return {
        id: a.id, nome: a.nome || '(sem nome)', turma: a.turma || '',
        turno: a.turno || '', foto: a.foto || null,
        autorizaSaida, autorizados,
        temRFID, algumBloqueado, algumDiaRestrito, semResponsavel,
      }
    })
  }, [alunos, todayKey])

  // ── Turmas únicas para o select ─────────────────────────────────────────────
  const turmas = useMemo(() => {
    const set = new Set<string>()
    rows.forEach(r => { if (r.turma) set.add(r.turma) })
    return [...set].sort()
  }, [rows])

  // ── Filtros ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = rows

    // Turma
    if (turmaFilter !== 'todas') list = list.filter(r => r.turma === turmaFilter)

    // Busca
    if (search.trim().length >= 2) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        r.nome.toLowerCase().includes(q) || r.turma.toLowerCase().includes(q)
      )
    }

    // Filtro de situação
    switch (filter) {
      case 'sem_rfid':       return list.filter(r => !r.temRFID && !r.autorizaSaida)
      case 'pode_sair_sozinho': return list.filter(r => r.autorizaSaida)
      case 'bloqueado':      return list.filter(r => r.algumBloqueado)
      case 'dia_restrito':   return list.filter(r => r.algumDiaRestrito)
      case 'sem_responsavel':return list.filter(r => r.semResponsavel)
      default:               return list
    }
  }, [rows, filter, turmaFilter, search])

  // ── Contadores para os filtros ──────────────────────────────────────────────
  const counts = useMemo(() => ({
    todos:            rows.length,
    sem_rfid:         rows.filter(r => !r.temRFID && !r.autorizaSaida).length,
    pode_sair_sozinho:rows.filter(r => r.autorizaSaida).length,
    bloqueado:        rows.filter(r => r.algumBloqueado).length,
    dia_restrito:     rows.filter(r => r.algumDiaRestrito).length,
    sem_responsavel:  rows.filter(r => r.semResponsavel).length,
  }), [rows])

  // ── Export Excel ────────────────────────────────────────────────────────────
  const exportExcel = () => {
    const rows = filtered.map(r => {
      const row: any = {
        'ID Aluno':          r.id,
        'Nome':              r.nome,
        'Turma':             getTurmaNome(r.turma),
        'Turno':             r.turno,
        'Pode Sair Sozinho': r.autorizaSaida ? 'Sim' : 'Não',
        'Tem RFID':          r.temRFID ? 'Sim' : 'Não',
        'Qtd Responsáveis':  r.autorizados.length,
      }
      
      // Colunas dinâmicas para cada responsável
      r.autorizados.forEach((resp: any, idx: number) => {
        const num = idx + 1
        row[`Nome Responsável ${num}`] = resp.nome || '—'
        row[`ID Responsável ${num}`] = resp.id || '—'
        row[`RFID Responsável ${num}`] = resp.rfid || '—'
      })
      
      row['Bloqueados'] = r.autorizados.filter((x: any) => x.proibido).length
      row['Restrição Dia'] = r.algumDiaRestrito ? 'Sim' : 'Não'
      
      return row
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório Portaria')
    XLSX.writeFile(wb, `relatorio-portaria-${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  // ── Filter chips ────────────────────────────────────────────────────────────
  const chips: { key: FilterKey; label: string; icon: React.ReactNode; color: string }[] = [
    { key: 'todos',            label: 'Todos',                 icon: <Users size={12}/>,        color: '#06b6d4' },
    { key: 'sem_rfid',         label: 'Sem RFID',              icon: <WifiOff size={12}/>,      color: '#f59e0b' },
    { key: 'pode_sair_sozinho',label: 'Saída Solo',            icon: <UserCheck size={12}/>,    color: '#10b981' },
    { key: 'bloqueado',        label: 'Proibido Retirar',      icon: <ShieldOff size={12}/>,    color: '#ef4444' },
    { key: 'dia_restrito',     label: 'Restrição Dia Hoje',    icon: <AlertTriangle size={12}/>,color: '#f97316' },
    { key: 'sem_responsavel',  label: 'Sem Responsável',       icon: <XCircle size={12}/>,      color: '#8b5cf6' },
  ]

  return (
    <div>
      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 10,
        alignItems: 'center', marginBottom: 20,
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }}/>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar aluno ou turma..."
            style={{
              width: '100%', padding: '9px 12px 9px 34px',
              borderRadius: 10, border: '1px solid hsl(var(--border-subtle))',
              background: 'hsl(var(--bg-elevated))', color: 'hsl(var(--text-base))',
              fontSize: 13, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Turma select */}
        <div style={{ position: 'relative' }}>
          <GraduationCap size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }}/>
          <select
            value={turmaFilter}
            onChange={e => setTurmaFilter(e.target.value)}
            style={{
              padding: '9px 32px 9px 30px', borderRadius: 10,
              border: '1px solid hsl(var(--border-subtle))',
              background: 'hsl(var(--bg-elevated))', color: 'hsl(var(--text-base))',
              fontSize: 13, cursor: 'pointer', appearance: 'none', outline: 'none',
            }}
          >
            <option value="todas">Todas as turmas</option>
            {turmas.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <ChevronDown size={12} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }}/>
        </div>

        {/* Export */}
        <button onClick={exportExcel} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '9px 16px', borderRadius: 10,
          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
          color: '#10b981', cursor: 'pointer', fontWeight: 700, fontSize: 12,
          whiteSpace: 'nowrap',
        }}>
          <Download size={13}/> Exportar Excel
        </button>
      </div>

      {/* ── Filter chips ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {chips.map(chip => {
          const active = filter === chip.key
          return (
            <button
              key={chip.key}
              onClick={() => setFilter(chip.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 100, cursor: 'pointer',
                border: `1px solid ${active ? chip.color : 'hsl(var(--border-subtle))'}`,
                background: active ? `${chip.color}18` : 'hsl(var(--bg-elevated))',
                color: active ? chip.color : 'hsl(var(--text-muted))',
                fontWeight: active ? 800 : 600, fontSize: 12,
                transition: 'all 0.15s',
              }}
            >
              {chip.icon}
              {chip.label}
              <span style={{
                padding: '1px 7px', borderRadius: 100, fontSize: 11, fontWeight: 900,
                background: active ? chip.color : 'hsl(var(--bg-overlay))',
                color: active ? '#fff' : 'hsl(var(--text-muted))',
              }}>
                {counts[chip.key]}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Result count ── */}
      <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 12, fontWeight: 600 }}>
        {filtered.length} aluno{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
        {filter !== 'todos' && ` · filtro: ${chips.find(c => c.key === filter)?.label}`}
        {turmaFilter !== 'todas' && ` · turma: ${turmaFilter}`}
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <div style={{
          padding: '48px', textAlign: 'center', borderRadius: 16,
          border: '1px dashed hsl(var(--border-subtle))',
          color: 'hsl(var(--text-muted))', fontSize: 14,
        }}>
          Nenhum aluno corresponde aos filtros selecionados.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(row => {
            const expanded = expandedId === row.id
            return (
              <div
                key={row.id}
                style={{
                  borderRadius: 14, overflow: 'hidden',
                  border: '1px solid hsl(var(--border-subtle))',
                  background: 'hsl(var(--bg-elevated))',
                  transition: 'box-shadow 0.15s',
                }}
              >
                {/* Row header */}
                <div
                  onClick={() => setExpandedId(expanded ? null : row.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    overflow: 'hidden',
                    background: 'linear-gradient(135deg, #06b6d420, #6366f120)',
                    border: '1px solid hsl(var(--border-subtle))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, fontWeight: 900, color: '#06b6d4',
                  }}>
                    {row.foto
                      ? <img src={row.foto} alt={row.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                      : row.nome.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase()
                    }
                  </div>

                  {/* Name + turma */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: 'hsl(var(--text-base))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.nome}
                    </div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 1 }}>
                      {getTurmaNome(row.turma)}{row.turno ? ` · ${row.turno}` : ''}
                    </div>
                  </div>

                  {/* Status badges */}
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
                    {row.autorizaSaida && (
                      <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 800, background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>
                        ✅ Solo
                      </span>
                    )}
                    {row.temRFID ? (
                      <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 800, background: 'rgba(6,182,212,0.1)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.25)' }}>
                        📡 RFID
                      </span>
                    ) : (
                      <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 800, background: 'rgba(245,158,11,0.08)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                        ⚠ Sem RFID
                      </span>
                    )}
                    {row.algumBloqueado && (
                      <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 800, background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                        🚫 Bloqueado
                      </span>
                    )}
                    {row.algumDiaRestrito && (
                      <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 800, background: 'rgba(249,115,22,0.08)', color: '#f97316', border: '1px solid rgba(249,115,22,0.2)' }}>
                        📅 Restrição hoje
                      </span>
                    )}
                    {row.semResponsavel && (
                      <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 800, background: 'rgba(139,92,246,0.08)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.2)' }}>
                        👤 Sem responsável
                      </span>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', marginLeft: 4 }}>
                      <ChevronDown size={14} color="hsl(var(--text-muted))" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}/>
                    </div>
                  </div>
                </div>

                {/* Expanded: responsáveis table */}
                {expanded && (
                  <div style={{
                    borderTop: '1px solid hsl(var(--border-subtle))',
                    padding: '16px',
                    background: 'hsl(var(--bg-base))',
                  }}>
                    {row.autorizados.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>
                        {row.autorizaSaida
                          ? '✅ Este aluno está autorizado a sair sozinho — não precisa de responsável.'
                          : '⚠ Nenhum responsável cadastrado. Configure em Saúde & Obs do aluno.'}
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ color: 'hsl(var(--text-muted))', fontWeight: 700, textAlign: 'left' }}>
                              {['Nome','Parentesco','Telefone','RFID','Dias Permitidos','Status'].map(h => (
                                <th key={h} style={{ padding: '4px 10px 8px', whiteSpace: 'nowrap', fontWeight: 800, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {row.autorizados.map((resp: any, idx: number) => {
                              const diasSemana: string[] = resp.diasSemana || resp.diasAcesso || resp.dias_acesso || []
                              const normalizedDias = diasSemana.map(d => normalizeDay(d))
                              const diaRestrito = diasSemana.length > 0 && !normalizedDias.includes(normalizeDay(todayKey))
                              const proibido = resp.proibido === true
                              const statusColor = proibido ? '#ef4444' : diaRestrito ? '#f97316' : '#10b981'
                              const statusLabel = proibido ? '🚫 Proibido' : diaRestrito ? `⚠ Não hoje (${todayKey})` : '✅ Liberado'
                              return (
                                <tr key={idx} style={{
                                  borderTop: '1px solid hsl(var(--border-subtle))',
                                  background: proibido ? 'rgba(239,68,68,0.03)' : 'transparent',
                                }}>
                                  <td style={{ padding: '8px 10px', fontWeight: 700, color: 'hsl(var(--text-base))' }}>{resp.nome || '—'}</td>
                                  <td style={{ padding: '8px 10px', color: 'hsl(var(--text-muted))' }}>{resp.parentesco || '—'}</td>
                                  <td style={{ padding: '8px 10px', color: 'hsl(var(--text-muted))', fontFamily: 'monospace' }}>{resp.telefone || '—'}</td>
                                  <td style={{ padding: '8px 10px' }}>
                                    {resp.rfid && resp.rfid.trim()
                                      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 6, background: 'rgba(6,182,212,0.1)', color: '#06b6d4', fontFamily: 'monospace', fontSize: 10, fontWeight: 700 }}>
                                          <Wifi size={9}/> {resp.rfid}
                                        </span>
                                      : <span style={{ color: '#f59e0b', fontSize: 10, fontWeight: 700 }}>
                                          <WifiOff size={9} style={{ display: 'inline', marginRight: 3 }}/>Sem RFID
                                        </span>
                                    }
                                  </td>
                                  <td style={{ padding: '8px 10px' }}>
                                    {diasSemana.length === 0
                                      ? <span style={{ color: '#10b981', fontSize: 11 }}>Todos os dias</span>
                                      : <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                          {DIAS_SEMANA.map(d => {
                                            const hasDay = normalizedDias.includes(normalizeDay(d))
                                            return (
                                              <span key={d} style={{
                                                padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                                                background: hasDay ? 'rgba(6,182,212,0.15)' : 'hsl(var(--bg-overlay))',
                                                color: hasDay ? '#06b6d4' : 'hsl(var(--text-muted))',
                                                border: d === todayKey ? '1px solid #06b6d420' : 'none',
                                                fontStyle: !hasDay ? 'italic' : 'normal',
                                                opacity: hasDay ? 1 : 0.5,
                                              }}>
                                                {d}
                                              </span>
                                            )
                                          })}
                                        </div>
                                    }
                                  </td>
                                  <td style={{ padding: '8px 10px' }}>
                                    <span style={{ fontWeight: 800, fontSize: 11, color: statusColor }}>{statusLabel}</span>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL com abas
// ─────────────────────────────────────────────────────────────────────────────
type Tab = 'config' | 'relatorios'

function ConfigContent() {
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<Tab>('config')

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'config',     label: 'Configurações',  icon: <Settings size={14}/>   },
    { key: 'relatorios', label: 'Relatórios',      icon: <BarChart3 size={14}/>  },
  ]

  return (
    <div>
      {/* Page title */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: isMobile ? 20 : 26, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Settings size={isMobile ? 20 : 26}/> Portaria · Controle de Saída
        </h1>
        <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', margin: 0 }}>
          Configurações do sistema e relatórios de autorização
        </p>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 28,
        borderBottom: '1px solid hsl(var(--border-subtle))',
        paddingBottom: 0,
      }}>
        {tabs.map(t => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '10px 18px', cursor: 'pointer',
                fontWeight: active ? 800 : 600, fontSize: 13,
                color: active ? '#06b6d4' : 'hsl(var(--text-muted))',
                background: 'transparent', border: 'none',
                borderBottom: active ? '2px solid #06b6d4' : '2px solid transparent',
                marginBottom: -1, transition: 'all 0.15s',
              }}
            >
              {t.icon}
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'config'     && <TabConfiguracoes />}
      {tab === 'relatorios' && <TabRelatorios />}
    </div>
  )
}

export default function ConfiguracoesPage() {
  return (
    <DataProvider>
      <SaidaProvider>
        <ConfigContent />
      </SaidaProvider>
    </DataProvider>
  )
}
