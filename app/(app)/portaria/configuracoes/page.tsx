'use client'

import { useState, useEffect } from 'react'
import { useApiQuery } from '@/hooks/useApi'
import {
  Settings, Save, RefreshCw, CheckCircle, ToggleLeft, ToggleRight,
  Clock, Shield, Users, Camera, Activity
} from 'lucide-react'

const ACCENT = '#06b6d4'

interface PortariaConfig {
  sync_automatica_novos_alunos: boolean
  remover_inativos_automaticamente: boolean
  reenviar_foto_ao_atualizar: boolean
  modo_somente_entrada: boolean
  intervalo_sync_minutos: number
  fallback_matricula_como_codigo: boolean
}

const DEFAULT_CONFIG: PortariaConfig = {
  sync_automatica_novos_alunos: true,
  remover_inativos_automaticamente: true,
  reenviar_foto_ao_atualizar: true,
  modo_somente_entrada: true,
  intervalo_sync_minutos: 30,
  fallback_matricula_como_codigo: true,
}

export default function PortariaConfigPage() {
  const [config, setConfig] = useState<PortariaConfig>(DEFAULT_CONFIG)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Fetch config from the configuracoes table
  const { data: configRes, isLoading } = useApiQuery<any>(
    ['portaria-config'],
    '/api/configuracoes',
    { chave: 'portaria_config' },
    { staleTime: 60000 }
  )

  useEffect(() => {
    if (configRes) {
      try {
        // The API may return different structures
        const val = configRes.valor || configRes.data?.valor || configRes
        if (val && typeof val === 'object') {
          setConfig({ ...DEFAULT_CONFIG, ...val })
        }
      } catch { /* use default */ }
    }
  }, [configRes])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/configuracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave: 'portaria_config', valor: config }),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      setToast({ msg: 'Configurações salvas com sucesso!', type: 'success' })
    } catch (err: any) {
      setToast({ msg: err.message, type: 'error' })
    }
    setSaving(false)
    setTimeout(() => setToast(null), 4000)
  }

  const Toggle = ({ value, onChange, label, desc, icon }: { value: boolean; onChange: (v: boolean) => void; label: string; desc: string; icon: React.ReactNode }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px',
      background: 'hsl(var(--bg-base))', borderRadius: 14,
      border: `1px solid ${value ? 'rgba(6,182,212,0.2)' : 'hsl(var(--border-subtle))'}`,
      transition: 'all 0.2s',
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 12,
        background: value ? `${ACCENT}12` : 'hsl(var(--bg-elevated))',
        border: `1px solid ${value ? `${ACCENT}30` : 'hsl(var(--border-subtle))'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: value ? ACCENT : 'hsl(var(--text-muted))', flexShrink: 0,
        transition: 'all 0.2s',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', lineHeight: 1.5 }}>{desc}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
          background: value ? ACCENT : 'hsl(var(--border-subtle))',
          position: 'relative', transition: 'background 0.25s',
          flexShrink: 0,
        }}
      >
        <div style={{
          width: 20, height: 20, borderRadius: '50%', background: '#fff',
          position: 'absolute', top: 3,
          left: value ? 25 : 3,
          transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        }} />
      </button>
    </div>
  )

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 10000,
          padding: '12px 20px', borderRadius: 12,
          background: toast.type === 'success' ? '#10b981' : '#f43f5e',
          color: '#fff', fontSize: 13, fontWeight: 700,
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
        }}>
          <CheckCircle size={14} style={{ display: 'inline', marginRight: 8 }} />
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Settings size={22} color={ACCENT} />
            <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 24, margin: 0 }}>Configurações da Portaria</h1>
          </div>
          <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', margin: 0 }}>
            Ajuste o comportamento da integração com o iDFace
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 24px', borderRadius: 12, fontSize: 13, fontWeight: 700,
            background: `linear-gradient(135deg, ${ACCENT}, #0891b2)`,
            border: 'none', color: '#fff', cursor: 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? <Activity size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
          Salvar Configurações
        </button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'hsl(var(--text-muted))' }}>
          <Activity size={24} style={{ margin: '0 auto 8px', animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: 13 }}>Carregando...</div>
        </div>
      ) : (
        <div style={{
          background: 'hsl(var(--bg-elevated))',
          border: '1px solid hsl(var(--border-subtle))',
          borderRadius: 20, padding: 24,
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'hsl(var(--text-primary))', marginBottom: 16, fontFamily: 'Outfit,sans-serif' }}>
            🔧 Sincronização
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            <Toggle
              value={config.sync_automatica_novos_alunos}
              onChange={v => setConfig({ ...config, sync_automatica_novos_alunos: v })}
              label="Sincronização automática de novos alunos"
              desc="Quando um novo aluno for matriculado, enviar automaticamente para o iDFace"
              icon={<Users size={18} />}
            />
            <Toggle
              value={config.remover_inativos_automaticamente}
              onChange={v => setConfig({ ...config, remover_inativos_automaticamente: v })}
              label="Remover alunos inativos automaticamente"
              desc="Ao desativar um aluno, remover automaticamente do dispositivo iDFace"
              icon={<Shield size={18} />}
            />
            <Toggle
              value={config.reenviar_foto_ao_atualizar}
              onChange={v => setConfig({ ...config, reenviar_foto_ao_atualizar: v })}
              label="Reenviar foto ao atualizar imagem"
              desc="Quando a foto do aluno for alterada no ERP, enviar a nova imagem ao iDFace"
              icon={<Camera size={18} />}
            />
          </div>

          <div style={{ fontSize: 13, fontWeight: 800, color: 'hsl(var(--text-primary))', marginBottom: 16, fontFamily: 'Outfit,sans-serif' }}>
            ⚙️ Operação
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            <Toggle
              value={config.modo_somente_entrada}
              onChange={v => setConfig({ ...config, modo_somente_entrada: v })}
              label="Modo somente entrada"
              desc="Registrar apenas eventos de entrada (sem controle de saída pelo iDFace)"
              icon={<CheckCircle size={18} />}
            />
            <Toggle
              value={config.fallback_matricula_como_codigo}
              onChange={v => setConfig({ ...config, fallback_matricula_como_codigo: v })}
              label="Fallback: matrícula como código"
              desc="Se o aluno não tiver campo 'código', usar a matrícula como ID no iDFace"
              icon={<RefreshCw size={18} />}
            />
          </div>

          <div style={{ fontSize: 13, fontWeight: 800, color: 'hsl(var(--text-primary))', marginBottom: 16, fontFamily: 'Outfit,sans-serif' }}>
            ⏱ Intervalos
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px',
            background: 'hsl(var(--bg-base))', borderRadius: 14,
            border: '1px solid hsl(var(--border-subtle))',
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: `${ACCENT}12`, border: `1px solid ${ACCENT}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: ACCENT, flexShrink: 0,
            }}>
              <Clock size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: 3 }}>Intervalo de sincronização</div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Tempo entre sincronizações automáticas (em minutos)</div>
            </div>
            <input
              type="number"
              className="form-input"
              min={5}
              max={1440}
              value={config.intervalo_sync_minutos}
              onChange={e => setConfig({ ...config, intervalo_sync_minutos: parseInt(e.target.value) || 30 })}
              style={{ width: 80, height: 36, borderRadius: 10, fontSize: 14, fontWeight: 700, textAlign: 'center' }}
            />
            <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>min</span>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
