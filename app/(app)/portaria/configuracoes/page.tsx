'use client'

import { useState, useEffect } from 'react'
import { useApiQuery } from '@/hooks/useApi'
import {
  Settings, Save, RefreshCw, CheckCircle, XCircle, Clock, Shield, Users,
  Camera, Activity, Lock, Key, CalendarRange, ShieldAlert, Check
} from 'lucide-react'
import { SyncAcessosModal } from '@/components/portaria/SyncAcessosModal'

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
  const [showAcessosModal, setShowAcessosModal] = useState(false)

  const [showSyncModal, setShowSyncModal] = useState(false)
  const [affectedCount, setAffectedCount] = useState(0)
  const [syncStep, setSyncStep] = useState<'preview' | 'syncing' | 'completed' | 'error'>('preview')
  const [syncProcessed, setSyncProcessed] = useState(0)
  const [syncTotal, setSyncTotal] = useState(0)
  const [syncMode, setSyncMode] = useState<'only_missing' | 'all'>('only_missing')
  const [syncPreviewAll, setSyncPreviewAll] = useState(0)
  const [syncPreviewMissing, setSyncPreviewMissing] = useState(0)
  const [syncPreviewAllList, setSyncPreviewAllList] = useState<any[]>([])
  const [syncPreviewMissingList, setSyncPreviewMissingList] = useState<any[]>([])

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
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showSyncModal, syncStep])

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
      setSyncPreviewAllList(data.studentsAll || [])
      setSyncPreviewMissingList(data.studentsMissing || [])
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
                onClick={() => setShowAcessosModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                  background: 'hsl(var(--bg-elevated))',
                  border: `1px solid ${ACCENT}`,
                  color: ACCENT, cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 10px rgba(6,182,212,0.05)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${ACCENT}10` }}
                onMouseLeave={e => { e.currentTarget.style.background = 'hsl(var(--bg-elevated))' }}
              >
                <RefreshCw size={15} />
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
                
                {/* Lista de Alunos a serem sincronizados */}
                <div style={{
                  maxHeight: 180, overflowY: 'auto', marginBottom: 24,
                  background: 'hsl(var(--bg-base))', border: '1px solid hsl(var(--border-subtle))',
                  borderRadius: 12, padding: '8px 0', textAlign: 'left'
                }}>
                  <div style={{ padding: '0 16px 8px', fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', borderBottom: '1px solid hsl(var(--border-subtle))', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Alunos a serem sincronizados
                  </div>
                  {(syncMode === 'only_missing' ? syncPreviewMissingList : syncPreviewAllList).length === 0 ? (
                    <div style={{ padding: '16px', fontSize: 12, color: 'hsl(var(--text-muted))', textAlign: 'center' }}>
                      Nenhum aluno para sincronizar.
                    </div>
                  ) : (
                    (syncMode === 'only_missing' ? syncPreviewMissingList : syncPreviewAllList).map((student, idx) => (
                      <div key={idx} style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'hsl(var(--bg-elevated))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: ACCENT }}>
                            {student.nome.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{student.nome}</div>
                            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>ID: {student.matricula}</div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
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

      <SyncAcessosModal isOpen={showAcessosModal} onClose={() => setShowAcessosModal(false)} />

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes slideIn { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  )
}
