'use client'

import { useState, useMemo } from 'react'
import { useApiQuery, useApiMutation } from '@/hooks/useApi'
import {
  UserCheck, RefreshCw, Upload, Trash2, Search, CheckCircle,
  XCircle, AlertTriangle, Scan, Users, Activity, Send
} from 'lucide-react'

const ACCENT = '#06b6d4'

export default function AlunosLiberadosPage() {
  const [busca, setBusca] = useState('')
  const [syncing, setSyncing] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

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

  // Mutation para sincronizar
  const syncMutation = useApiMutation<any>('/api/portaria/sync', 'POST', [['portaria-sync-status']])

  const handleSync = async (alunoId: string, deviceId: string) => {
    setSyncing(alunoId)
    try {
      await syncMutation.mutateAsync({ dispositivo_id: deviceId, aluno_id: alunoId })
      setToast({ msg: 'Aluno sincronizado com sucesso!', type: 'success' })
      refetchSync()
    } catch (err: any) {
      setToast({ msg: err.message || 'Erro ao sincronizar', type: 'error' })
    }
    setSyncing(null)
    setTimeout(() => setToast(null), 4000)
  }

  const handleSyncAll = async (deviceId: string) => {
    setSyncing('all')
    try {
      const result = await syncMutation.mutateAsync({ dispositivo_id: deviceId })
      setToast({ msg: `Sincronização concluída: ${result.sucesso} sucesso, ${result.erros} erros`, type: result.erros > 0 ? 'error' : 'success' })
      refetchSync()
    } catch (err: any) {
      setToast({ msg: err.message || 'Erro ao sincronizar', type: 'error' })
    }
    setSyncing(null)
    setTimeout(() => setToast(null), 6000)
  }

  const filtered = useMemo(() => {
    if (!busca) return alunos
    const q = busca.toLowerCase()
    return alunos.filter((a: any) =>
      (a.nome || '').toLowerCase().includes(q) ||
      (a.codigo || '').includes(q) ||
      (a.matricula || '').includes(q)
    )
  }, [alunos, busca])

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
          animation: 'slideIn 0.3s ease',
        }}>
          {toast.type === 'success' ? <CheckCircle size={14} style={{ display: 'inline', marginRight: 8 }} /> : <XCircle size={14} style={{ display: 'inline', marginRight: 8 }} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <UserCheck size={22} color={ACCENT} />
            <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 24, margin: 0 }}>Alunos Liberados</h1>
          </div>
          <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', margin: 0 }}>
            {alunos.length} alunos ativos · {alunosComFoto} com foto · {alunosSincronizados} sincronizados
          </p>
        </div>
        {dispositivos.length > 0 && (
          <button
            className="btn btn-primary"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700,
              background: `linear-gradient(135deg, ${ACCENT}, #0891b2)`,
              border: 'none', color: '#fff', cursor: 'pointer',
              opacity: syncing ? 0.6 : 1,
            }}
            onClick={() => handleSyncAll(dispositivos[0].id)}
            disabled={!!syncing}
          >
            {syncing === 'all' ? <Activity size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
            Sincronizar Todos
          </button>
        )}
      </div>

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
            style={{ width: '100%', paddingLeft: 36, height: 36, borderRadius: 10, fontSize: 13 }}
          />
        </div>
      </div>

      {/* Tabela */}
      <div style={{
        background: 'hsl(var(--bg-elevated))',
        border: '1px solid hsl(var(--border-subtle))',
        borderRadius: 18, overflow: 'hidden',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '80px 60px 1fr 120px 150px 130px',
          gap: 12, padding: '12px 20px',
          borderBottom: '1px solid hsl(var(--border-subtle))',
        }}>
          {['CÓDIGO', 'FOTO', 'NOME', 'STATUS SYNC', 'ÚLTIMA SYNC', 'AÇÕES'].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</div>
          ))}
        </div>

        {loadingAlunos ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'hsl(var(--text-muted))' }}>
            <Activity size={24} style={{ margin: '0 auto 8px', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: 13 }}>Carregando alunos...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'hsl(var(--text-muted))' }}>
            <Users size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
            <div style={{ fontSize: 13 }}>Nenhum aluno encontrado.</div>
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
                  display: 'grid', gridTemplateColumns: '80px 60px 1fr 120px 150px 130px',
                  gap: 12, padding: '10px 20px', alignItems: 'center',
                  borderBottom: '1px solid hsl(var(--border-subtle))',
                  transition: 'background 0.15s',
                }}
                  onMouseEnter={ev => (ev.currentTarget.style.background = 'hsl(var(--bg-base))')}
                  onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, fontFamily: 'monospace' }}>{codigo}</div>
                  <div>
                    {hasPhoto ? (
                      <img src={a.foto} alt={a.nome} style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover', border: `2px solid ${ACCENT}30` }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <XCircle size={14} color="#f43f5e" />
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nome}</div>
                    <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>{a.turma || '—'} · {a.turno || '—'}</div>
                  </div>
                  <div>
                    {isSynced ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                        <CheckCircle size={10} /> Sincronizado
                      </span>
                    ) : sync?.status === 'erro' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(244,63,94,0.1)', color: '#f43f5e' }}>
                        <AlertTriangle size={10} /> Erro
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(148,163,184,0.1)', color: '#94a3b8' }}>
                        Pendente
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                    {sync?.ultima_sync ? new Date(sync.ultima_sync).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {dispositivos.length > 0 && (
                      <button
                        title="Sincronizar"
                        onClick={() => handleSync(a.id, dispositivos[0].id)}
                        disabled={syncing === a.id}
                        style={{
                          width: 30, height: 30, borderRadius: 8,
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
                        title="Reenviar foto"
                        onClick={() => handleSync(a.id, dispositivos[0].id)}
                        style={{
                          width: 30, height: 30, borderRadius: 8,
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
        @keyframes slideIn { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
    </div>
  )
}
