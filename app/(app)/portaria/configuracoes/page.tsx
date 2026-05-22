'use client'

import { useState, useEffect } from 'react'
import { useApiQuery } from '@/hooks/useApi'
import {
  Settings, Save, RefreshCw, CheckCircle, XCircle, Clock, Shield, Users,
  Camera, Activity, Lock, Key, CalendarRange, ShieldAlert, Check
} from 'lucide-react'

const ACCENT = '#06b6d4'

interface PortariaConfig {
  sync_automatica_novos_alunos: boolean
  remover_inativos_automaticamente: boolean
  reenviar_foto_ao_atualizar: boolean
  modo_somente_entrada: boolean
  intervalo_sync_minutos: number
  fallback_matricula_como_codigo: boolean
  token_seguranca_webhook: string
  horario_entrada_inicio: string
  horario_entrada_fim: string
}

const DEFAULT_CONFIG: PortariaConfig = {
  sync_automatica_novos_alunos: true,
  remover_inativos_automaticamente: true,
  reenviar_foto_ao_atualizar: true,
  modo_somente_entrada: true,
  intervalo_sync_minutos: 30,
  fallback_matricula_como_codigo: true,
  token_seguranca_webhook: '',
  horario_entrada_inicio: '06:00',
  horario_entrada_fim: '22:00',
}

export default function PortariaConfigPage() {
  const [config, setConfig] = useState<PortariaConfig>(DEFAULT_CONFIG)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [syncingPhotos, setSyncingPhotos] = useState(false)
  const [syncingAcessos, setSyncingAcessos] = useState(false)
  const [showAcessosModal, setShowAcessosModal] = useState(false)
  const [acessosStartDate, setAcessosStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 3)
    return d.toISOString().split('T')[0]
  })
  const [acessosEndDate, setAcessosEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [acessosSyncStep, setAcessosSyncStep] = useState<'form' | 'syncing' | 'completed' | 'error'>('form')
  const [acessosSyncProcessed, setAcessosSyncProcessed] = useState(0)
  const [acessosSyncTotal, setAcessosSyncTotal] = useState(0)
  const [acessosSyncAlreadyExisting, setAcessosSyncAlreadyExisting] = useState(0)
  const [acessosSyncNewInserted, setAcessosSyncNewInserted] = useState(0)
  const [acessosSyncToInsert, setAcessosSyncToInsert] = useState(0)
  const [acessosSyncError, setAcessosSyncError] = useState('')
  const [acessosSyncPhase, setAcessosSyncPhase] = useState<'fetching' | 'checking' | 'inserting'>('fetching')

  const [showSyncModal, setShowSyncModal] = useState(false)
  const [affectedCount, setAffectedCount] = useState(0)
  const [syncStep, setSyncStep] = useState<'preview' | 'syncing' | 'completed' | 'error'>('preview')
  const [syncProcessed, setSyncProcessed] = useState(0)
  const [syncTotal, setSyncTotal] = useState(0)
  const [syncMode, setSyncMode] = useState<'only_missing' | 'all'>('only_missing')
  const [syncPreviewAll, setSyncPreviewAll] = useState(0)
  const [syncPreviewMissing, setSyncPreviewMissing] = useState(0)

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
        const val = configRes.valor || configRes.data?.valor || configRes
        if (val && typeof val === 'object') {
          setConfig({ ...DEFAULT_CONFIG, ...val })
        }
      } catch { /* use default */ }
    }
  }, [configRes])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSyncModal && syncStep === 'syncing') {
          e.preventDefault()
          e.stopPropagation()
        } else if (showSyncModal) {
          setShowSyncModal(false)
        }

        if (showAcessosModal && acessosSyncStep === 'syncing') {
          e.preventDefault()
          e.stopPropagation()
        } else if (showAcessosModal && acessosSyncStep !== 'syncing') {
          setShowAcessosModal(false)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showSyncModal, syncStep, showAcessosModal, acessosSyncStep])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/configuracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave: 'portaria_config', valor: config }),
      })
      if (!res.ok) throw new Error('Erro ao salvar configurações')
      setToast({ msg: 'Configurações salvas com sucesso!', type: 'success' })
    } catch (err: any) {
      setToast({ msg: err.message, type: 'error' })
    }
    setSaving(false)
    setTimeout(() => setToast(null), 4000)
  }

  const handleRequestSyncPhotos = async () => {
    setSyncingPhotos(true)
    try {
      const res = await fetch('/api/portaria/sync-fotos?preview=true', {
        method: 'POST'
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao calcular preview')
      
      const missing = data.countMissing ?? data.count ?? 0
      const totalAll = data.countAll ?? missing
      
      setSyncPreviewAll(totalAll)
      setSyncPreviewMissing(missing)
      setAffectedCount(missing)
      setSyncMode('only_missing')
      setSyncStep('preview')
      setShowSyncModal(true)
    } catch (err: any) {
      setToast({ msg: err.message, type: 'error' })
      setTimeout(() => setToast(null), 4000)
    } finally {
      setSyncingPhotos(false)
    }
  }

  const handleSyncAcessos = async () => {
    if (!acessosStartDate || !acessosEndDate) {
      setToast({ msg: 'Por favor, selecione as datas de início e fim.', type: 'error' })
      return
    }
    
    setSyncingAcessos(true)
    setAcessosSyncStep('syncing')
    setAcessosSyncProcessed(0)
    setAcessosSyncTotal(0)
    setAcessosSyncAlreadyExisting(0)
    setAcessosSyncNewInserted(0)
    setAcessosSyncToInsert(0)
    setAcessosSyncError('')
    setAcessosSyncPhase('fetching')
    
    try {
      const res = await fetch('/api/portaria/dispositivos/sync-acessos', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: acessosStartDate, endDate: acessosEndDate })
      })

      if (!res.body) throw new Error('Não foi possível iniciar o stream de sincronização')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' 

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const data = JSON.parse(line)
            
            if (data.status === 'fetching') {
              setAcessosSyncPhase('fetching')
            } else if (data.status === 'checking') {
              setAcessosSyncPhase('checking')
              setAcessosSyncTotal(data.total || 0)
            } else if (data.status === 'started') {
              setAcessosSyncPhase('inserting')
              setAcessosSyncTotal(data.total || 0)
              setAcessosSyncAlreadyExisting(data.alreadyExisting || 0)
              setAcessosSyncToInsert(data.toInsert || 0)
            } else if (data.status === 'progress') {
              setAcessosSyncPhase('inserting')
              setAcessosSyncTotal(data.total || 0)
              setAcessosSyncAlreadyExisting(data.alreadyExisting || 0)
              setAcessosSyncToInsert(data.toInsert || 0)
              setAcessosSyncProcessed(data.processed || 0)
            } else if (data.status === 'completed') {
              setAcessosSyncTotal(data.total || 0)
              setAcessosSyncAlreadyExisting(data.alreadyExisting || 0)
              setAcessosSyncNewInserted(data.newInserted || 0)
              setAcessosSyncStep('completed')
            } else if (data.status === 'error') {
              setAcessosSyncStep('error')
              setAcessosSyncError(data.error)
            }
          } catch (e) {
            console.error('JSON parse error on stream:', e)
          }
        }
      }
    } catch (err: any) {
      setAcessosSyncStep('error')
      setAcessosSyncError(err.message)
    } finally {
      setSyncingAcessos(false)
    }
  }

  const handleExecuteSyncPhotos = async () => {
    setSyncStep('syncing')
    setSyncProcessed(0)
    const currentTotal = syncMode === 'all' ? syncPreviewAll : syncPreviewMissing
    setSyncTotal(currentTotal)
    
    try {
      const res = await fetch(`/api/portaria/sync-fotos?preview=false&mode=${syncMode}`, {
        method: 'POST'
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao iniciar sincronização')
      
      // Monitoramento em tempo real do progresso via polling (800ms)
      const interval = setInterval(async () => {
        try {
          const progRes = await fetch('/api/portaria/sync-fotos')
          if (!progRes.ok) return
          const progData = await progRes.json()
          
          setSyncProcessed(progData.processed || 0)
          setSyncTotal(progData.total || currentTotal)
          
          if (progData.status === 'error') {
            clearInterval(interval)
            setToast({ msg: progData.error || 'Erro desconhecido na sincronização.', type: 'error' })
            setSyncStep('error')
            return
          }

          const isDone = progData.status === 'completed' || 
                         (progData.total > 0 && progData.processed >= progData.total)
          
          if (isDone) {
            clearInterval(interval)
            setSyncStep('completed')
          }
        } catch { /* ignorar erro de rede pontual no pooling */ }
      }, 800)
    } catch (err: any) {
      setToast({ msg: err.message, type: 'error' })
      setSyncStep('error')
      setTimeout(() => setToast(null), 4000)
    }
  }

  const Toggle = ({ value, onChange, label, desc, icon }: { value: boolean; onChange: (v: boolean) => void; label: string; desc: string; icon: React.ReactNode }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px',
      background: 'hsl(var(--bg-base))', borderRadius: 14,
      border: `1px solid ${value ? 'rgba(6,182,212,0.25)' : 'hsl(var(--border-subtle))'}`,
      transition: 'all 0.2s',
      boxShadow: value ? '0 4px 15px rgba(6,182,212,0.02)' : 'none'
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
        <div style={{ fontSize: 13.5, fontWeight: 800, color: 'hsl(var(--text-primary))', marginBottom: 3 }}>{label}</div>
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
          display: 'flex', alignItems: 'center', gap: 8,
          animation: 'slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          {toast.type === 'success' ? <CheckCircle size={15} /> : <XCircle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: `linear-gradient(135deg, ${ACCENT}, #0891b2)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 15px ${ACCENT}30`
            }}>
              <Settings size={20} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 24, margin: 0, letterSpacing: '-0.02em' }}>Configurações da Portaria</h1>
              <p style={{ fontSize: 12.5, color: 'hsl(var(--text-muted))', margin: 0 }}>
                Ajuste os parâmetros de sincronização, regras de horários e chaves de segurança da portaria inteligente
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 24px', borderRadius: 12, fontSize: 13, fontWeight: 700,
            background: `linear-gradient(135deg, ${ACCENT}, #0891b2)`,
            border: 'none', color: '#fff', cursor: 'pointer',
            boxShadow: `0 4px 15px ${ACCENT}20`,
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? <Activity size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
          Salvar Configurações
        </button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 64, color: 'hsl(var(--text-muted))' }}>
          <Activity size={24} style={{ margin: '0 auto 8px', animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: 13, fontWeight: 600 }}>Buscando configurações no servidor...</div>
        </div>
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16
        }}>
          {/* Lado Esquerdo: Toggles */}
          <div style={{
            background: 'hsl(var(--bg-elevated))',
            border: '1px solid hsl(var(--border-subtle))',
            borderRadius: 22, padding: 24,
            display: 'flex', flexDirection: 'column', gap: 20
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 }}>🔄 Regras de Sincronização Automática</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Toggle
                  value={config.sync_automatica_novos_alunos}
                  onChange={v => setConfig({ ...config, sync_automatica_novos_alunos: v })}
                  label="Sincronização automática de matriculados"
                  desc="Ao matricular um aluno no ERP, cadastrá-lo de forma automática na fila do iDFace"
                  icon={<Users size={18} />}
                />
                <Toggle
                  value={config.remover_inativos_automaticamente}
                  onChange={v => setConfig({ ...config, remover_inativos_automaticamente: v })}
                  label="Expurgar alunos inativos automaticamente"
                  desc="Ao remover ou desativar um aluno no ERP, exclui sua face da memória flash do leitor"
                  icon={<Shield size={18} />}
                />
                <Toggle
                  value={config.reenviar_foto_ao_atualizar}
                  onChange={v => setConfig({ ...config, reenviar_foto_ao_atualizar: v })}
                  label="Atualizar fotos automaticamente no hardware"
                  desc="Ao substituir a imagem de cadastro de um aluno, transmite o novo arquivo ao iDFace"
                  icon={<Camera size={18} />}
                />
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 }}>⚙️ Modo Operacional da Catraca</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Toggle
                  value={config.modo_somente_entrada}
                  onChange={v => setConfig({ ...config, modo_somente_entrada: v })}
                  label="Modo portaria de entrada dedicada"
                  desc="Bloqueia registros e contadores de saídas neste dispositivo, focando estritamente na entrada"
                  icon={<CheckCircle size={18} />}
                />
                <Toggle
                  value={config.fallback_matricula_como_codigo}
                  onChange={v => setConfig({ ...config, fallback_matricula_como_codigo: v })}
                  label="Matrícula como ID numérico alternativo"
                  desc="Se o código único do aluno estiver ausente, utiliza a matrícula numérica para cadastro no leitor"
                  icon={<RefreshCw size={18} />}
                />
              </div>
            </div>

            <div style={{
              borderTop: '1px solid hsl(var(--border-subtle))',
              paddingTop: 20,
              marginTop: 4,
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 1 }}>📥 Sincronização Unidirecional (Catraca ➔ ERP)</div>
              <p style={{ fontSize: 11, color: 'hsl(var(--text-muted))', margin: 0, lineHeight: 1.5 }}>
                Baixa as fotos faciais cadastradas diretamente na memória física da catraca iDFace e as salva no cadastro dos respectivos alunos no ERP.
              </p>
              <button
                onClick={handleRequestSyncPhotos}
                disabled={syncingPhotos}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                  background: 'hsl(var(--bg-elevated))',
                  border: `1px solid ${ACCENT}`,
                  color: ACCENT, cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 10px rgba(6,182,212,0.05)',
                  opacity: syncingPhotos ? 0.6 : 1,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${ACCENT}10` }}
                onMouseLeave={e => { e.currentTarget.style.background = 'hsl(var(--bg-elevated))' }}
              >
                {syncingPhotos ? (
                  <Activity size={15} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Camera size={15} />
                )}
                Sincronizar Fotos do iDFace agora
              </button>
              
              <div style={{ height: 1, background: 'hsl(var(--border-subtle))', margin: '8px 0' }} />
              
              <p style={{ fontSize: 11, color: 'hsl(var(--text-muted))', margin: 0, lineHeight: 1.5 }}>
                Busca o histórico de acessos de um período específico e reprocessa a frequência escolar dos alunos.
              </p>
              <button
                onClick={() => {
                  setAcessosSyncStep('form')
                  setShowAcessosModal(true)
                }}
                disabled={syncingAcessos}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                  background: 'hsl(var(--bg-elevated))',
                  border: `1px solid ${ACCENT}`,
                  color: ACCENT, cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 10px rgba(6,182,212,0.05)',
                  opacity: syncingAcessos ? 0.6 : 1,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${ACCENT}10` }}
                onMouseLeave={e => { e.currentTarget.style.background = 'hsl(var(--bg-elevated))' }}
              >
                {syncingAcessos ? (
                  <Activity size={15} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <RefreshCw size={15} />
                )}
                Sincronizar Acessos Antigos
              </button>
            </div>
          </div>

          {/* Lado Direito: Inputs de Intervalos, Horários e Segurança */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            {/* Bloco de Horários Permitidos */}
            <div style={{
              background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))',
              borderRadius: 22, padding: 24, display: 'flex', flexDirection: 'column', gap: 14
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CalendarRange size={14} color={ACCENT} /> Tolerância de Horários de Entrada
              </div>
              <p style={{ fontSize: 11, color: 'hsl(var(--text-muted))', margin: 0, lineHeight: 1.5 }}>
                Acessos detectados na catraca fora destas janelas de horários serão classificados como inconsistências e não acionarão a liberação do relé.
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 6 }}>Horário Início</label>
                  <input
                    type="time"
                    className="form-input"
                    value={config.horario_entrada_inicio || '06:00'}
                    onChange={e => setConfig({ ...config, horario_entrada_inicio: e.target.value })}
                    style={{ width: '100%', height: 38, borderRadius: 10, fontSize: 13, fontWeight: 700, textAlign: 'center' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 6 }}>Horário Fim</label>
                  <input
                    type="time"
                    className="form-input"
                    value={config.horario_entrada_fim || '22:00'}
                    onChange={e => setConfig({ ...config, horario_entrada_fim: e.target.value })}
                    style={{ width: '100%', height: 38, borderRadius: 10, fontSize: 13, fontWeight: 700, textAlign: 'center' }}
                  />
                </div>
              </div>
            </div>

            {/* Bloco de Segurança Token */}
            <div style={{
              background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))',
              borderRadius: 22, padding: 24, display: 'flex', flexDirection: 'column', gap: 14
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Lock size={14} color="#f59e0b" /> Segurança e Token de Validação
              </div>
              <p style={{ fontSize: 11, color: 'hsl(var(--text-muted))', margin: 0, lineHeight: 1.5 }}>
                Chave de segurança secreta para autenticar requisições de webhook enviadas por seus leitores ControliD iDFace locais.
              </p>
              
              <div style={{ position: 'relative' }}>
                <Key size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: idface_secure_secret_token_123"
                  value={config.token_seguranca_webhook || ''}
                  onChange={e => setConfig({ ...config, token_seguranca_webhook: e.target.value })}
                  style={{ width: '100%', paddingLeft: 36, height: 38, borderRadius: 10, fontSize: 12.5, fontWeight: 700 }}
                />
              </div>
            </div>

            {/* Intervalo de Pooling e Sync */}
            <div style={{
              background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))',
              borderRadius: 22, padding: 24, display: 'flex', flexDirection: 'column', gap: 14
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={14} color="#10b981" /> Frequência de Sincronização Lote
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <input
                  type="number"
                  className="form-input"
                  min={5}
                  max={1440}
                  value={config.intervalo_sync_minutos}
                  onChange={e => setConfig({ ...config, intervalo_sync_minutos: parseInt(e.target.value) || 30 })}
                  style={{ width: 80, height: 38, borderRadius: 10, fontSize: 14, fontWeight: 800, textAlign: 'center' }}
                />
                <span style={{ fontSize: 12.5, color: 'hsl(var(--text-muted))', fontWeight: 700 }}>Minutos por ciclo de varredura</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Modal de Confirmação da Sincronização de Fotos */}
      {showSyncModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999, animation: 'fadeIn 0.25s ease-out'
        }}>
          <div style={{
            background: 'hsl(var(--bg-elevated))',
            border: '1px solid hsl(var(--border-subtle))',
            borderRadius: 24, width: '100%', maxWidth: 440,
            padding: 32, boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
            animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            textAlign: 'center'
          }}>
            {syncStep === 'preview' && (
              <>
                <div style={{
                  width: 56, height: 56, borderRadius: 18,
                  background: `${ACCENT}15`, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: ACCENT, margin: '0 auto 20px'
                }}>
                  <Camera size={26} />
                </div>
                <h3 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 900, fontFamily: 'Outfit, sans-serif' }}>
                  Sincronizar Fotos da Catraca
                </h3>
                <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', lineHeight: 1.6, margin: '0 0 20px' }}>
                  Identificamos alunos cadastrados na catraca física correspondentes a alunos ativos no ERP.
                </p>

                {/* Seletor de Modo Premium */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24, textAlign: 'left' }}>
                  <label style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Modo de Importação
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {/* Opção Apenas sem Foto */}
                    <div
                      onClick={() => {
                        setSyncMode('only_missing')
                        setAffectedCount(syncPreviewMissing)
                      }}
                      style={{
                        padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                        background: 'hsl(var(--bg-base))',
                        border: `1.5px solid ${syncMode === 'only_missing' ? ACCENT : 'hsl(var(--border-subtle))'}`,
                        boxShadow: syncMode === 'only_missing' ? `0 4px 15px ${ACCENT}12` : 'none',
                        transition: 'all 0.2s',
                        display: 'flex', flexDirection: 'column', gap: 4
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 900, color: syncMode === 'only_missing' ? ACCENT : 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>Apenas sem foto</span>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: syncMode === 'only_missing' ? ACCENT : 'transparent',
                          border: `1.5px solid ${syncMode === 'only_missing' ? 'transparent' : 'hsl(var(--text-muted))'}`
                        }} />
                      </div>
                      <div style={{ fontSize: 9.5, color: 'hsl(var(--text-muted))', lineHeight: 1.3 }}>
                        Importa apenas para quem não tem imagem.
                      </div>
                      <div style={{ marginTop: 8, fontSize: 13, fontWeight: 900, color: syncMode === 'only_missing' ? ACCENT : 'hsl(var(--text-muted))', display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        <span style={{ fontSize: 16 }}>{syncPreviewMissing}</span>
                        <span style={{ fontSize: 10, fontWeight: 700 }}>aluno(s)</span>
                      </div>
                    </div>

                    {/* Opção Substituir Todas */}
                    <div
                      onClick={() => {
                        setSyncMode('all')
                        setAffectedCount(syncPreviewAll)
                      }}
                      style={{
                        padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                        background: 'hsl(var(--bg-base))',
                        border: `1.5px solid ${syncMode === 'all' ? ACCENT : 'hsl(var(--border-subtle))'}`,
                        boxShadow: syncMode === 'all' ? `0 4px 15px ${ACCENT}12` : 'none',
                        transition: 'all 0.2s',
                        display: 'flex', flexDirection: 'column', gap: 4
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 900, color: syncMode === 'all' ? ACCENT : 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>Substituir todas</span>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: syncMode === 'all' ? ACCENT : 'transparent',
                          border: `1.5px solid ${syncMode === 'all' ? 'transparent' : 'hsl(var(--text-muted))'}`
                        }} />
                      </div>
                      <div style={{ fontSize: 9.5, color: 'hsl(var(--text-muted))', lineHeight: 1.3 }}>
                        Substitui e atualiza todos os alunos no ERP.
                      </div>
                      <div style={{ marginTop: 8, fontSize: 13, fontWeight: 900, color: syncMode === 'all' ? ACCENT : 'hsl(var(--text-muted))', display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        <span style={{ fontSize: 16 }}>{syncPreviewAll}</span>
                        <span style={{ fontSize: 10, fontWeight: 700 }}>aluno(s)</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {affectedCount === 0 ? (
                  <button
                    onClick={() => setShowSyncModal(false)}
                    style={{
                      width: '100%', padding: '12px', borderRadius: 12,
                      background: 'hsl(var(--bg-base))', border: '1px solid hsl(var(--border-subtle))',
                      color: 'hsl(var(--text-primary))', fontWeight: 700, cursor: 'pointer',
                      fontSize: 13
                    }}
                  >
                    Fechar
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      onClick={() => setShowSyncModal(false)}
                      style={{
                        flex: 1, padding: '12px', borderRadius: 12,
                        background: 'hsl(var(--bg-base))', border: '1px solid hsl(var(--border-subtle))',
                        color: 'hsl(var(--text-primary))', fontWeight: 700, cursor: 'pointer',
                        fontSize: 13
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleExecuteSyncPhotos}
                      style={{
                        flex: 1, padding: '12px', borderRadius: 12,
                        background: `linear-gradient(135deg, ${ACCENT}, #0891b2)`,
                        border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer',
                        fontSize: 13, boxShadow: `0 4px 15px ${ACCENT}25`
                      }}
                    >
                      Sincronizar Agora
                    </button>
                  </div>
                )}
              </>
            )}

            {syncStep === 'syncing' && (() => {
              const percent = syncTotal > 0 ? Math.round((syncProcessed / syncTotal) * 100) : 0
              return (
                <>
                  <div style={{
                    width: 64, height: 64, borderRadius: 20,
                    background: 'rgba(6,182,212,0.12)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    color: ACCENT, margin: '0 auto 20px',
                    boxShadow: '0 0 20px rgba(6,182,212,0.15)'
                  }}>
                    <RefreshCw size={26} style={{ animation: 'spin 2s linear infinite' }} />
                  </div>
                  <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 900, fontFamily: 'Outfit, sans-serif' }}>
                    Sincronizando Fotos iDFace
                  </h3>
                  
                  {/* Progresso Texto & Percentual */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 8, padding: '0 4px' }}>
                    <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 700 }}>
                      Processando Alunos
                    </span>
                    <span style={{ fontSize: 14, color: ACCENT, fontWeight: 900, fontFamily: 'monospace' }}>
                      {percent}%
                    </span>
                  </div>

                  {/* Barra de Progresso Trilha e Preenchimento */}
                  <div style={{
                    width: '100%', height: 10, background: 'hsl(var(--bg-base))', 
                    borderRadius: 5, overflow: 'hidden', marginBottom: 14,
                    border: '1px solid hsl(var(--border-subtle))', position: 'relative'
                  }}>
                    <div style={{
                      width: `${percent}%`, height: '100%', 
                      background: `linear-gradient(90deg, ${ACCENT}, #0891b2)`,
                      borderRadius: 5, transition: 'width 0.4s ease-out',
                      boxShadow: `0 0 10px ${ACCENT}80`
                    }} />
                  </div>

                  {/* Contador Textual */}
                  <p style={{ fontSize: 12.5, color: 'hsl(var(--text-muted))', margin: '0 0 20px', fontWeight: 600 }}>
                    Sincronizados <strong style={{ color: 'hsl(var(--text-primary))' }}>{syncProcessed}</strong> de <strong style={{ color: 'hsl(var(--text-primary))' }}>{syncTotal}</strong> alunos
                  </p>

                  <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, background: 'rgba(245,158,11,0.06)', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(245,158,11,0.15)' }}>
                    Por favor, não feche esta janela enquanto a sincronização ocorre.
                  </div>
                </>
              )
            })()}

            {syncStep === 'completed' && (
              <>
                <div style={{
                  width: 56, height: 56, borderRadius: 18,
                  background: 'rgba(16,185,129,0.15)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: '#10b981', margin: '0 auto 20px'
                }}>
                  <Check size={28} />
                </div>
                <h3 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 900, fontFamily: 'Outfit, sans-serif' }}>
                  Sincronização Concluída!
                </h3>
                <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', lineHeight: 1.6, margin: '0 0 24px' }}>
                  A importação das fotos faciais das catracas foi finalizada com sucesso!
                  <br />
                  As fotos de <strong>{affectedCount} aluno(s)</strong> foram salvas e atualizadas de forma segura no ERP.
                </p>
                <button
                  onClick={() => setShowSyncModal(false)}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 12,
                    background: `linear-gradient(135deg, ${ACCENT}, #0891b2)`,
                    border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer',
                    fontSize: 13, boxShadow: `0 4px 15px ${ACCENT}25`
                  }}
                >
                  Concluir
                </button>
              </>
            )}

            {syncStep === 'error' && (
              <>
                <div style={{
                  width: 56, height: 56, borderRadius: 18,
                  background: 'rgba(239,68,68,0.15)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: '#ef4444', margin: '0 auto 20px'
                }}>
                  <XCircle size={28} />
                </div>
                <h3 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 900, fontFamily: 'Outfit, sans-serif' }}>
                  Falha na Sincronização
                </h3>
                <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', lineHeight: 1.6, margin: '0 0 24px' }}>
                  Ocorreu uma inconsistência ao importar os dados das catracas.
                  <br />
                  <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>
                    {toast?.msg || 'Conexão interrompida com o dispositivo.'}
                  </span>
                </p>
                <button
                  onClick={() => setShowSyncModal(false)}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 12,
                    background: 'hsl(var(--bg-base))', border: '1px solid hsl(var(--border-subtle))',
                    color: 'hsl(var(--text-primary))', fontWeight: 700, cursor: 'pointer',
                    fontSize: 13
                  }}
                >
                  Fechar
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal de Sincronização de Acessos Antigos */}
      {showAcessosModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999, animation: 'fadeIn 0.25s ease-out'
        }}>
          <div style={{
            background: 'hsl(var(--bg-elevated))',
            border: '1px solid hsl(var(--border-subtle))',
            borderRadius: 24, width: '100%', maxWidth: 440,
            padding: 32, boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
            animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            textAlign: 'center'
          }}>
            {acessosSyncStep === 'form' && (
              <>
                <div style={{
                  width: 56, height: 56, borderRadius: 18,
                  background: `${ACCENT}15`, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: ACCENT, margin: '0 auto 20px'
                }}>
                  <CalendarRange size={26} />
                </div>
                <h3 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 900, fontFamily: 'Outfit, sans-serif' }}>
                  Sincronizar Acessos Antigos
                </h3>
                <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', lineHeight: 1.6, margin: '0 0 20px' }}>
                  Selecione o período que deseja reprocessar. Todos os acessos encontrados nesse intervalo serão baixados da memória da catraca e processados no diário escolar.
                </p>

                <div style={{ display: 'flex', gap: 16, marginBottom: 24, textAlign: 'left' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 6 }}>Data Inicial</label>
                    <input
                      type="date"
                      className="form-input"
                      value={acessosStartDate}
                      onChange={e => setAcessosStartDate(e.target.value)}
                      style={{ width: '100%', height: 42, borderRadius: 10, fontSize: 13, fontWeight: 700, padding: '0 12px' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 6 }}>Data Final</label>
                    <input
                      type="date"
                      className="form-input"
                      value={acessosEndDate}
                      onChange={e => setAcessosEndDate(e.target.value)}
                      style={{ width: '100%', height: 42, borderRadius: 10, fontSize: 13, fontWeight: 700, padding: '0 12px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={() => setShowAcessosModal(false)}
                    style={{
                      flex: 1, padding: '12px', borderRadius: 12,
                      background: 'hsl(var(--bg-base))', border: '1px solid hsl(var(--border-subtle))',
                      color: 'hsl(var(--text-primary))', fontWeight: 700, cursor: 'pointer',
                      fontSize: 13
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSyncAcessos}
                    style={{
                      flex: 1, padding: '12px', borderRadius: 12,
                      background: `linear-gradient(135deg, ${ACCENT}, #0891b2)`,
                      border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer',
                      fontSize: 13, boxShadow: `0 4px 15px ${ACCENT}25`
                    }}
                  >
                    Sincronizar
                  </button>
                </div>
              </>
            )}

            {acessosSyncStep === 'syncing' && (() => {
              const isInserting = acessosSyncPhase === 'inserting'
              const percent = isInserting && acessosSyncToInsert > 0
                ? Math.round((acessosSyncProcessed / acessosSyncToInsert) * 100)
                : 0
              return (
                <>
                  <div style={{
                    width: 64, height: 64, borderRadius: 20,
                    background: 'rgba(6,182,212,0.12)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    color: ACCENT, margin: '0 auto 20px',
                    boxShadow: '0 0 20px rgba(6,182,212,0.15)'
                  }}>
                    <RefreshCw size={26} style={{ animation: 'spin 2s linear infinite' }} />
                  </div>
                  <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 900, fontFamily: 'Outfit, sans-serif' }}>
                    Sincronizando Acessos
                  </h3>

                  {/* Phase indicators */}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
                    {(['fetching', 'checking', 'inserting'] as const).map((phase, idx) => {
                      const labels = ['Buscando', 'Verificando', 'Inserindo']
                      const phaseOrder = { fetching: 0, checking: 1, inserting: 2 }
                      const currentIdx = phaseOrder[acessosSyncPhase]
                      const isDone = idx < currentIdx
                      const isActive = idx === currentIdx
                      return (
                        <div key={phase} style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '4px 10px', borderRadius: 20,
                          background: isDone ? 'rgba(16,185,129,0.12)' : isActive ? `${ACCENT}15` : 'hsl(var(--bg-base))',
                          border: `1px solid ${isDone ? 'rgba(16,185,129,0.3)' : isActive ? `${ACCENT}50` : 'hsl(var(--border-subtle))'}`,
                          fontSize: 10, fontWeight: 700,
                          color: isDone ? '#10b981' : isActive ? ACCENT : 'hsl(var(--text-muted))'
                        }}>
                          {isDone ? <Check size={10} /> : isActive ? <Activity size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <span style={{ width: 10 }} />}
                          {labels[idx]}
                        </div>
                      )
                    })}
                  </div>

                  {/* Stats cards */}
                  {acessosSyncTotal > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                      <div style={{ padding: '10px 12px', borderRadius: 10, background: 'hsl(var(--bg-base))', border: '1px solid hsl(var(--border-subtle))', textAlign: 'left' }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 4 }}>Na Catraca</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: 'hsl(var(--text-primary))' }}>{acessosSyncTotal}</div>
                      </div>
                      <div style={{ padding: '10px 12px', borderRadius: 10, background: 'hsl(var(--bg-base))', border: '1px solid hsl(var(--border-subtle))', textAlign: 'left' }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 4 }}>Já Existentes</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: 'hsl(var(--text-muted))' }}>{acessosSyncAlreadyExisting}</div>
                      </div>
                    </div>
                  )}

                  {isInserting && acessosSyncToInsert > 0 ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 8, padding: '0 4px' }}>
                        <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 700 }}>
                          Inserindo novos registros
                        </span>
                        <span style={{ fontSize: 14, color: ACCENT, fontWeight: 900, fontFamily: 'monospace' }}>
                          {percent}%
                        </span>
                      </div>
                      <div style={{
                        width: '100%', height: 10, background: 'hsl(var(--bg-base))', 
                        borderRadius: 5, overflow: 'hidden', marginBottom: 10,
                        border: '1px solid hsl(var(--border-subtle))', position: 'relative'
                      }}>
                        <div style={{
                          width: `${percent}%`, height: '100%', 
                          background: `linear-gradient(90deg, ${ACCENT}, #0891b2)`,
                          borderRadius: 5, transition: 'width 0.4s ease-out',
                          boxShadow: `0 0 10px ${ACCENT}80`
                        }} />
                      </div>
                      <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', margin: '0 0 16px', fontWeight: 600 }}>
                        <strong style={{ color: ACCENT }}>{acessosSyncProcessed}</strong> de <strong style={{ color: 'hsl(var(--text-primary))' }}>{acessosSyncToInsert}</strong> novos registros
                      </p>
                    </>
                  ) : (
                    <div style={{ padding: '12px 0 16px', fontSize: 13, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>
                      {acessosSyncPhase === 'fetching' ? 'Consultando a memória da catraca...' :
                       acessosSyncPhase === 'checking' ? `Verificando ${acessosSyncTotal} registros no sistema...` :
                       'Preparando inserção...'}
                    </div>
                  )}

                  <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, background: 'rgba(245,158,11,0.06)', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(245,158,11,0.15)' }}>
                    Por favor, não feche esta janela ou recarregue a página até a conclusão.
                  </div>
                </>
              )
            })()}

            {acessosSyncStep === 'completed' && (
              <>
                <div style={{
                  width: 56, height: 56, borderRadius: 18,
                  background: 'rgba(16,185,129,0.15)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: '#10b981', margin: '0 auto 20px'
                }}>
                  <Check size={28} />
                </div>
                <h3 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 900, fontFamily: 'Outfit, sans-serif' }}>
                  Sincronização Concluída!
                </h3>

                {/* Summary breakdown cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
                  <div style={{
                    padding: '12px 10px', borderRadius: 12,
                    background: 'hsl(var(--bg-base))',
                    border: '1px solid hsl(var(--border-subtle))',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 6 }}>Na Catraca</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: 'hsl(var(--text-primary))' }}>{acessosSyncTotal}</div>
                    <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', marginTop: 2 }}>total do período</div>
                  </div>
                  <div style={{
                    padding: '12px 10px', borderRadius: 12,
                    background: 'hsl(var(--bg-base))',
                    border: '1px solid rgba(100,116,139,0.2)',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 6 }}>Já Existiam</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: 'hsl(var(--text-muted))' }}>{acessosSyncAlreadyExisting}</div>
                    <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', marginTop: 2 }}>ignorados</div>
                  </div>
                  <div style={{
                    padding: '12px 10px', borderRadius: 12,
                    background: 'rgba(16,185,129,0.08)',
                    border: '1px solid rgba(16,185,129,0.25)',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', marginBottom: 6 }}>Inseridos</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#10b981' }}>{acessosSyncNewInserted}</div>
                    <div style={{ fontSize: 9, color: '#10b981', marginTop: 2 }}>novos registros</div>
                  </div>
                </div>

                <p style={{ fontSize: 12.5, color: 'hsl(var(--text-muted))', lineHeight: 1.6, margin: '0 0 20px' }}>
                  {acessosSyncNewInserted === 0
                    ? 'Todos os registros do período já estavam no sistema. Nenhum dado duplicado foi inserido.'
                    : `✅ ${acessosSyncNewInserted} novo${acessosSyncNewInserted !== 1 ? 's' : ''} registro${acessosSyncNewInserted !== 1 ? 's' : ''} inserido${acessosSyncNewInserted !== 1 ? 's' : ''} com sucesso. Os ${acessosSyncAlreadyExisting} restantes já existiam e foram ignorados.`
                  }
                </p>
                <button
                  onClick={() => setShowAcessosModal(false)}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 12,
                    background: `linear-gradient(135deg, ${ACCENT}, #0891b2)`,
                    border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer',
                    fontSize: 13, boxShadow: `0 4px 15px ${ACCENT}25`
                  }}
                >
                  Concluir
                </button>
              </>
            )}

            {acessosSyncStep === 'error' && (
              <>
                <div style={{
                  width: 56, height: 56, borderRadius: 18,
                  background: 'rgba(239,68,68,0.15)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: '#ef4444', margin: '0 auto 20px'
                }}>
                  <XCircle size={28} />
                </div>
                <h3 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 900, fontFamily: 'Outfit, sans-serif' }}>
                  Falha na Sincronização
                </h3>
                <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', lineHeight: 1.6, margin: '0 0 24px' }}>
                  Ocorreu um erro ao baixar os logs da catraca:
                  <br />
                  <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>
                    {acessosSyncError || 'Desconhecido'}
                  </span>
                </p>
                <button
                  onClick={() => setShowAcessosModal(false)}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 12,
                    background: 'hsl(var(--bg-base))', border: '1px solid hsl(var(--border-subtle))',
                    color: 'hsl(var(--text-primary))', fontWeight: 700, cursor: 'pointer',
                    fontSize: 13
                  }}
                >
                  Fechar
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes slideIn { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  )
}
