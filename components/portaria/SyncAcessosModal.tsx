'use client'

import { useState, useEffect } from 'react'
import { CalendarRange, RefreshCw, Check, Activity, XCircle } from 'lucide-react'

const ACCENT = '#06b6d4'

interface SyncAcessosModalProps {
  isOpen: boolean
  onClose: () => void
  initialStartDate?: string
  initialEndDate?: string
  onSuccess?: () => void
}

export function SyncAcessosModal({ isOpen, onClose, initialStartDate, initialEndDate, onSuccess }: SyncAcessosModalProps) {
  const [acessosStartDate, setAcessosStartDate] = useState(() => {
    if (initialStartDate) return initialStartDate
    const d = new Date()
    d.setDate(d.getDate() - 3)
    return d.toISOString().split('T')[0]
  })
  const [acessosEndDate, setAcessosEndDate] = useState(() => {
    if (initialEndDate) return initialEndDate
    return new Date().toISOString().split('T')[0]
  })
  
  const [acessosSyncStep, setAcessosSyncStep] = useState<'form' | 'syncing' | 'completed' | 'error'>('form')
  const [syncingAcessos, setSyncingAcessos] = useState(false)
  const [acessosSyncProcessed, setAcessosSyncProcessed] = useState(0)
  const [acessosSyncTotal, setAcessosSyncTotal] = useState(0)
  const [acessosSyncAlreadyExisting, setAcessosSyncAlreadyExisting] = useState(0)
  const [acessosSyncNewInserted, setAcessosSyncNewInserted] = useState(0)
  const [acessosSyncToInsert, setAcessosSyncToInsert] = useState(0)
  const [acessosSyncError, setAcessosSyncError] = useState('')
  const [acessosSyncPhase, setAcessosSyncPhase] = useState<'fetching' | 'checking' | 'inserting'>('fetching')
  const [forceLocal, setForceLocal] = useState(false)

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setAcessosSyncStep('form')
      setSyncingAcessos(false)
      setAcessosSyncProcessed(0)
      setAcessosSyncTotal(0)
      setAcessosSyncAlreadyExisting(0)
      setAcessosSyncNewInserted(0)
      setAcessosSyncToInsert(0)
      setAcessosSyncError('')
      setAcessosSyncPhase('fetching')
      setForceLocal(false)
      if (initialStartDate) setAcessosStartDate(initialStartDate)
      if (initialEndDate) setAcessosEndDate(initialEndDate)
    }
  }, [isOpen, initialStartDate, initialEndDate])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (acessosSyncStep === 'syncing') {
          e.preventDefault()
          e.stopPropagation()
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, acessosSyncStep, onClose])

  if (!isOpen) return null

  const handleSyncAcessos = async () => {
    if (!acessosStartDate || !acessosEndDate) {
      alert('Por favor, selecione as datas de início e fim.')
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
        body: JSON.stringify({ startDate: acessosStartDate, endDate: acessosEndDate, forceLocal })
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
              if (onSuccess) onSuccess()
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

  const isInserting = acessosSyncPhase === 'inserting'
  const percent = isInserting && acessosSyncToInsert > 0
    ? Math.round((acessosSyncProcessed / acessosSyncToInsert) * 100)
    : 0

  return (
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

            <div style={{ display: 'flex', gap: 16, marginBottom: 20, textAlign: 'left' }}>
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

            <div style={{ marginBottom: 24, textAlign: 'left' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={forceLocal}
                  onChange={e => setForceLocal(e.target.checked)}
                  style={{ marginTop: 2, accentColor: '#f59e0b', width: 16, height: 16 }}
                />
                <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))', lineHeight: 1.5 }}>
                  <strong style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    Estou na mesma rede local da catraca
                  </strong>
                  Marque esta opção apenas se o sistema estiver rodando no servidor local da escola, permitindo que a sincronização acesse IPs privados.
                </span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={onClose}
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
                disabled={syncingAcessos}
                style={{
                  flex: 1, padding: '12px', borderRadius: 12,
                  background: `linear-gradient(135deg, ${ACCENT}, #0891b2)`,
                  border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer',
                  fontSize: 13, boxShadow: `0 4px 15px ${ACCENT}25`,
                  opacity: syncingAcessos ? 0.7 : 1
                }}
              >
                Sincronizar
              </button>
            </div>
          </>
        )}

        {acessosSyncStep === 'syncing' && (
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
        )}

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
              onClick={onClose}
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
              onClick={onClose}
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
  )
}
