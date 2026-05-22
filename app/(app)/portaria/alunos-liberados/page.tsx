'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useApiQuery, useApiMutation } from '@/hooks/useApi'
import {
  UserCheck, RefreshCw, Upload, Trash2, Search, CheckCircle,
  XCircle, AlertTriangle, Scan, Users, Activity, Send, Terminal, Play, X
} from 'lucide-react'

const ACCENT = '#06b6d4'

export default function AlunosLiberadosPage() {
  const [busca, setBusca] = useState('')
  const [syncing, setSyncing] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Estado para progresso em lote progressivo
  const [syncProgress, setSyncProgress] = useState<any>({
    active: false,
    current: 0,
    total: 0,
    logs: [] as string[],
    successes: 0,
    errors: 0
  })

  const consoleEndRef = useRef<HTMLDivElement>(null)

  // Scrollar terminal de progresso automaticamente
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [syncProgress.logs])

  // Buscar alunos ativos
  const { data: alunosRes, isLoading: loadingAlunos } = useApiQuery<any>(
    ['portaria-alunos'],
    '/api/alunos',
    undefined,
    { staleTime: 30000 }
  )
  const alunosRaw = Array.isArray(alunosRes) ? alunosRes : (alunosRes?.data || [])
  const alunos = alunosRaw.filter((a: any) => {
    const st = (a.status || '').toLowerCase()
    return ['matriculado', 'cursando', 'ativo'].includes(st)
  })

  // Buscar dispositivos
  const { data: dispRes } = useApiQuery<{ data: any[] }>(
    ['portaria-disp-sync'],
    '/api/portaria/dispositivos',
    undefined,
    { staleTime: 30000 }
  )
  const dispositivos = dispRes?.data || []

  // Buscar status de sync
  const { data: syncRes, refetch: refetchSync } = useApiQuery<{ data: any[] }>(
    ['portaria-sync-status'],
    '/api/portaria/sync',
    undefined,
    { staleTime: 10000 }
  )
  const syncData = syncRes?.data || []
  const syncMap = useMemo(() => {
    const m: Record<string, any> = {}
    syncData.forEach(s => { m[s.aluno_id] = s })
    return m
  }, [syncData])

  const filtered = useMemo(() => {
    if (!busca) return alunos
    const q = busca.toLowerCase()
    return alunos.filter((a: any) =>
      (a.nome || '').toLowerCase().includes(q) ||
      (a.codigo || '').includes(q) ||
      (a.matricula || '').includes(q)
    )
  }, [alunos, busca])

  // Sincronizar aluno individualmente
  const handleSync = async (alunoId: string, deviceId: string) => {
    setSyncing(alunoId)
    try {
      const res = await fetch('/api/portaria/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispositivo_id: deviceId, aluno_id: alunoId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao sincronizar')
      
      const itemRes = data.resultados?.[0]
      if (itemRes?.status === 'erro') throw new Error(itemRes.erro || 'Erro no leitor')

      setToast({ msg: `Sincronizado: ${itemRes?.nome || 'Sucesso'}!`, type: 'success' })
      refetchSync()
    } catch (err: any) {
      setToast({ msg: err.message || 'Erro ao sincronizar', type: 'error' })
    }
    setSyncing(null)
    setTimeout(() => setToast(null), 4000)
  }

  // Sincronização Progressiva em Lote para evitar timeout no Vercel/Gateways
  const handleSyncAllProgressive = async (deviceId: string) => {
    const listToSync = [...filtered]
    if (listToSync.length === 0) return

    setSyncProgress({
      active: true,
      current: 0,
      total: listToSync.length,
      logs: [`[${new Date().toLocaleTimeString()}] 🚀 Iniciando sincronização em lote de ${listToSync.length} alunos no leitor...`],
      successes: 0,
      errors: 0
    })

    let success = 0
    let errs = 0

    for (let i = 0; i < listToSync.length; i++) {
      const a = listToSync[i]
      
      setSyncProgress((p: any) => ({
        ...p,
        current: i + 1,
        logs: [...p.logs, `[${new Date().toLocaleTimeString()}] 🔄 (${i + 1}/${listToSync.length}) Enviando: ${a.nome}...`]
      }))

      try {
        const res = await fetch('/api/portaria/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dispositivo_id: deviceId, aluno_id: a.id })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro de conexão')

        const itemRes = data.resultados?.[0]
        if (itemRes?.status === 'erro') throw new Error(itemRes.erro || 'Hardware offline')

        success++
        const hasF = itemRes?.foto ? ' com Foto' : ' sem Foto'
        
        setSyncProgress((p: any) => ({
          ...p,
          successes: success,
          logs: [...p.logs, `[${new Date().toLocaleTimeString()}]   ✅ ${a.nome}: Cadastrado${hasF} no iDFace.`]
        }))
      } catch (err: any) {
        errs++
        
        setSyncProgress((p: any) => ({
          ...p,
          errors: errs,
          logs: [...p.logs, `[${new Date().toLocaleTimeString()}]   ❌ ${a.nome}: Erro (${err.message})`]
        }))
      }
    }

    setSyncProgress((p: any) => ({
      ...p,
      logs: [...p.logs, `[${new Date().toLocaleTimeString()}] 🏁 Lote concluído! Sincronizados: ${success}, Falhas: ${errs}`]
    }))
    refetchSync()
  }

  const alunosComFoto = alunos.filter((a: any) => a.foto && a.foto.length > 50).length
  const alunosSincronizados = syncData.filter(s => s.status === 'sincronizado').length

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
          animation: 'slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          {toast.type === 'success' ? <CheckCircle size={15} /> : <XCircle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: `linear-gradient(135deg, ${ACCENT}, #0891b2)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 15px ${ACCENT}30`
            }}>
              <UserCheck size={20} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 24, margin: 0, letterSpacing: '-0.02em' }}>Alunos Liberados</h1>
              <p style={{ fontSize: 12.5, color: 'hsl(var(--text-muted))', margin: 0 }}>
                {alunos.length} alunos ativos · {alunosComFoto} com foto · {alunosSincronizados} sincronizados no iDFace
              </p>
            </div>
          </div>
        </div>
        
        {dispositivos.length > 0 && !syncProgress.active && (
          <button
            onClick={() => handleSyncAllProgressive(dispositivos[0].id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700,
              background: `linear-gradient(135deg, ${ACCENT}, #0891b2)`,
              border: 'none', color: '#fff', cursor: 'pointer',
              boxShadow: `0 4px 15px ${ACCENT}20`,
              transition: 'all 0.2s'
            }}
          >
            <Send size={14} />
            Sincronizar Todos ({filtered.length})
          </button>
        )}
      </div>

      {/* Painel Progressivo de Sincronização em Lote */}
      {syncProgress.active && (
        <div style={{
          background: 'hsl(var(--bg-elevated))', border: `1px solid ${ACCENT}30`,
          borderRadius: 22, padding: 24, marginBottom: 20,
          boxShadow: '0 10px 40px rgba(0,0,0,0.06)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, fontFamily: 'Outfit,sans-serif', color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={16} color={ACCENT} style={{ animation: 'spin 1.5s linear infinite' }} />
                Sincronizando Banco de Dados com iDFace
              </div>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                Progresso: {syncProgress.current} de {syncProgress.total} alunos processados
              </div>
            </div>
            <button
              onClick={() => setSyncProgress((p: any) => ({ ...p, active: false }))}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 800,
                background: 'hsl(var(--bg-base))', border: '1px solid hsl(var(--border-subtle))',
                cursor: 'pointer', color: 'hsl(var(--text-muted))'
              }}
            >
              <X size={12} /> Fechar Painel
            </button>
          </div>

          {/* Barra de Progresso Segregada */}
          <div style={{ height: 8, borderRadius: 4, background: 'hsl(var(--bg-base))', overflow: 'hidden', display: 'flex', marginBottom: 16 }}>
            <div style={{
              width: `${(syncProgress.successes / syncProgress.total) * 100}%`,
              background: '#10b981', transition: 'width 0.3s'
            }} />
            <div style={{
              width: `${(syncProgress.errors / syncProgress.total) * 100}%`,
              background: '#f43f5e', transition: 'width 0.3s'
            }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
            {[
              ['Sucessos', syncProgress.successes, '#10b981', 'rgba(16,185,129,0.06)'],
              ['Falhas', syncProgress.errors, '#f43f5e', 'rgba(244,63,94,0.06)'],
              ['Percentual', `${Math.round(((syncProgress.successes + syncProgress.errors) / syncProgress.total) * 100)}%`, ACCENT, `${ACCENT}08`],
            ].map(([label, val, col, bg]) => (
              <div key={label as string} style={{ background: bg as string, border: `1px solid ${col as string}25`, borderRadius: 12, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: col as string, fontFamily: 'Outfit,sans-serif' }}>{val}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Terminal de Logs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 8 }}>
            <Terminal size={12} /> Log de Transmissão de Templates Faciais
          </div>
          <div style={{
            height: 150, background: '#090d16', border: '1px solid #111b2d',
            borderRadius: 16, padding: 16, overflow: 'auto',
            fontFamily: 'monospace', fontSize: 11, color: '#00ffcc',
            lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: 4
          }}>
            {syncProgress.logs.map((log: string, idx: number) => (
              <div key={idx} style={{
                color: log.includes('❌') ? '#f43f5e' : log.includes('✅') ? '#10b981' : '#00ffcc'
              }}>
                {log}
              </div>
            ))}
            <div ref={consoleEndRef} />
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 16,
        padding: '10px 16px', borderRadius: 14,
        background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))',
      }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
          <input
            className="form-input"
            placeholder="Buscar aluno por nome, código ou matrícula..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{ width: '100%', paddingLeft: 36, height: 38, borderRadius: 10, fontSize: 13 }}
          />
        </div>
      </div>

      {/* Tabela de Alunos */}
      <div style={{
        background: 'hsl(var(--bg-elevated))',
        border: '1px solid hsl(var(--border-subtle))',
        borderRadius: 18, overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.01)'
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '90px 60px 1fr 140px 150px 110px',
          gap: 12, padding: '14px 20px',
          borderBottom: '1px solid hsl(var(--border-subtle))',
          background: 'hsl(var(--bg-base))'
        }}>
          {['CÓDIGO', 'FOTO', 'NOME', 'STATUS SYNC', 'ÚLTIMA SYNC', 'AÇÕES'].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</div>
          ))}
        </div>

        {loadingAlunos ? (
          <div style={{ textAlign: 'center', padding: 64, color: 'hsl(var(--text-muted))' }}>
            <Activity size={24} style={{ margin: '0 auto 8px', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: 13, fontWeight: 600 }}>Carregando dados dos alunos...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 64, color: 'hsl(var(--text-muted))' }}>
            <Users size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
            <div style={{ fontSize: 13 }}>Nenhum aluno encontrado correspondente ao filtro.</div>
          </div>
        ) : (
          <div style={{ maxHeight: 520, overflow: 'auto' }}>
            {filtered.map((a: any) => {
              const sync = syncMap[a.id]
              const isSynced = sync?.status === 'sincronizado'
              const hasPhoto = a.foto && a.foto.length > 50
              const codigo = a.codigo || a.matricula || '—'

              return (
                <div key={a.id} style={{
                  display: 'grid', gridTemplateColumns: '90px 60px 1fr 140px 150px 110px',
                  gap: 12, padding: '11px 20px', alignItems: 'center',
                  borderBottom: '1px solid hsl(var(--border-subtle))',
                  transition: 'background 0.15s',
                }}
                  onMouseEnter={ev => (ev.currentTarget.style.background = 'hsl(var(--bg-base))')}
                  onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, fontFamily: 'monospace' }}>{codigo}</div>
                  
                  <div>
                    {hasPhoto ? (
                      <div style={{ width: 38, height: 38, borderRadius: 10, overflow: 'hidden', border: `2px solid ${ACCENT}30` }}>
                        <img src={a.foto} alt={a.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ) : (
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <XCircle size={14} color="#f43f5e" />
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nome}</div>
                    <div style={{ fontSize: 10.5, color: 'hsl(var(--text-muted))', marginTop: 2 }}>{a.turma || 'Sem turma'} · {a.turno || 'Sem Turno'}</div>
                  </div>

                  <div>
                    {isSynced ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                        <CheckCircle size={10} /> Sincronizado
                      </span>
                    ) : sync?.status === 'erro' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: 'rgba(244,63,94,0.1)', color: '#f43f5e' }} title={sync.erro_detalhe}>
                        <AlertTriangle size={10} /> Erro de Envio
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: 'rgba(148,163,184,0.1)', color: '#94a3b8' }}>
                        Pendente
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>
                    {sync?.ultima_sync ? new Date(sync.ultima_sync).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    {dispositivos.length > 0 && (
                      <button
                        title="Enviar para catraca"
                        onClick={() => handleSync(a.id, dispositivos[0].id)}
                        disabled={syncing === a.id}
                        style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: `${ACCENT}12`, border: `1px solid ${ACCENT}30`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', color: ACCENT, transition: 'all 0.15s',
                        }}
                      >
                        {syncing === a.id ? <Activity size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={12} />}
                      </button>
                    )}
                    {dispositivos.length > 0 && hasPhoto && (
                      <button
                        title="Reenviar Foto"
                        onClick={() => handleSync(a.id, dispositivos[0].id)}
                        style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', color: '#f59e0b',
                        }}
                      >
                        <Upload size={12} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes slideIn { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  )
}
