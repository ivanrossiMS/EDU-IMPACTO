'use client'

import { useState } from 'react'
import { useApiQuery, useApiMutation } from '@/hooks/useApi'
import {
  Monitor, Plus, Wifi, WifiOff, Trash2, Settings, RefreshCw,
  CheckCircle, XCircle, Activity, X, Save, Zap, HelpCircle,
  Hammer, Clock, Power, ShieldAlert, Cpu, Network, Terminal, Check
} from 'lucide-react'

const ACCENT = '#06b6d4'

export default function DispositivosPage() {
  const [showModal, setShowModal] = useState(false)
  const [showDiagnostics, setShowDiagnostics] = useState<any>(null)
  const [showManual, setShowManual] = useState(false)
  const [editDevice, setEditDevice] = useState<any>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  
  const [executingAction, setExecutingAction] = useState<string | null>(null)
  const [diagnosticsLog, setDiagnosticsLog] = useState<string[]>([])
  const [customWebhookUrl, setCustomWebhookUrl] = useState('')

  const { data: dispRes, isLoading, refetch } = useApiQuery<{ data: any[] }>(
    ['portaria-dispositivos'],
    '/api/portaria/dispositivos',
    undefined,
    { staleTime: 10000 }
  )
  const dispositivos = dispRes?.data || []

  const saveMutation = useApiMutation<any>('/api/portaria/dispositivos', 'POST', [['portaria-dispositivos']])
  const deleteMutation = useApiMutation<any>('/api/portaria/dispositivos', 'DELETE', [['portaria-dispositivos']])

  const openNew = () => {
    setEditDevice({ nome: 'Portaria Rua das Garças', ip: '', porta: 443, unidade: '', modelo: 'iDFace', configuracao: { login: 'admin', password: 'admin' } })
    setShowModal(true)
  }

  const openEdit = (d: any) => {
    setEditDevice({
      ...d,
      configuracao: {
        login: d.configuracao?.login || 'admin',
        password: d.configuracao?.password || 'admin'
      }
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync(editDevice)
      setToast({ msg: 'Dispositivo salvo com sucesso!', type: 'success' })
      setShowModal(false)
      refetch()
    } catch (err: any) {
      setToast({ msg: err.message, type: 'error' })
    }
    setTimeout(() => setToast(null), 4000)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este dispositivo?')) return
    try {
      await deleteMutation.mutateAsync({ id } as any)
      setToast({ msg: 'Dispositivo removido', type: 'success' })
      refetch()
    } catch (err: any) {
      setToast({ msg: err.message, type: 'error' })
    }
    setTimeout(() => setToast(null), 4000)
  }

  // Testar conexão executando o ping real no hardware
  const handleTestConnection = async (d: any) => {
    setTesting(d.id)
    try {
      const res = await fetch('/api/portaria/dispositivos/comando', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispositivo_id: d.id, comando: 'ping' })
      })
      const data = await res.json()
      if (res.ok && data.success && data.result?.online) {
        const serialStr = data.result.info?.serial ? ` (Serial: ${data.result.info.serial})` : ''
        setToast({ msg: `iDFace Conectado com Sucesso!${serialStr}`, type: 'success' })
        refetch()
      } else {
        throw new Error(data.error || 'Dispositivo inacessível')
      }
    } catch (err: any) {
      setToast({ msg: `Falha na conexão: ${err.message}`, type: 'error' })
    }
    setTesting(null)
    setTimeout(() => setToast(null), 4000)
  }

  // Executar comandos remotos específicos (abrir porta, reboot, sync relógio, configurar webhook)
  const handleExecuteCommand = async (deviceId: string, cmd: string) => {
    setExecutingAction(cmd)
    const logs = [...diagnosticsLog, `[${new Date().toLocaleTimeString()}] Executando: '${cmd}'...`]
    setDiagnosticsLog(logs)

    try {
      const res = await fetch('/api/portaria/dispositivos/comando', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dispositivo_id: deviceId,
          comando: cmd,
          webhookUrl: cmd === 'config_webhook' && customWebhookUrl ? customWebhookUrl : undefined
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar comando')

      let msgResult = ''
      if (cmd === 'abrir_catraca') {
        msgResult = '🔓 Sinal enviado! O relé integrado foi acionado por 3 segundos.'
      } else if (cmd === 'reiniciar') {
        msgResult = '🔄 Comando aceito. O hardware está reiniciando e voltará online em breve.'
      } else if (cmd === 'sync_relogio') {
        msgResult = '📅 Relógio do iDFace sincronizado com o servidor ERP com sucesso.'
      } else if (cmd === 'config_webhook') {
        msgResult = `⚡ Webhook push do ERP registrado de forma automática no iDFace!`
      }

      setDiagnosticsLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✅ ${msgResult}`])
      setToast({ msg: 'Comando executado com sucesso!', type: 'success' })
      refetch()
    } catch (err: any) {
      setDiagnosticsLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Erro: ${err.message}`])
      setToast({ msg: err.message, type: 'error' })
    } finally {
      setExecutingAction(null)
    }
    setTimeout(() => setToast(null), 4000)
  }

  const openDiagnostics = (d: any) => {
    setDiagnosticsDevice(d)
    setDiagnosticsLog([
      `[${new Date().toLocaleTimeString()}] Painel de Diagnóstico Iniciado.`,
      `📡 IP do Equipamento: ${d.ip}:${d.porta}`,
      `⚙️ Modelo Configurado: ${d.modelo}`
    ])
    setShowDiagnostics(true)
  }

  const [diagnosticsDevice, setDiagnosticsDevice] = useState<any>(null)

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
          {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
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
              <Monitor size={20} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 24, margin: 0, letterSpacing: '-0.02em' }}>
                Dispositivos iDFace
              </h1>
              <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', margin: 0 }}>
                Cadastro, status e controle remoto de catracas e leitores faciais ControliD
              </p>
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setShowManual(!showManual)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', borderRadius: 12, fontSize: 13, fontWeight: 700,
              background: showManual ? `${ACCENT}20` : 'hsl(var(--bg-elevated))',
              border: `1px solid ${showManual ? ACCENT : 'hsl(var(--border-subtle))'}`,
              color: showManual ? ACCENT : 'hsl(var(--text-primary))',
              cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            <HelpCircle size={14} /> Manual de Fiação
          </button>
          
          <button
            onClick={openNew}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700,
              background: `linear-gradient(135deg, ${ACCENT}, #0891b2)`,
              border: 'none', color: '#fff', cursor: 'pointer',
              boxShadow: `0 4px 15px ${ACCENT}20`
            }}
          >
            <Plus size={14} /> Novo Dispositivo
          </button>
        </div>
      </div>

      {/* Manual Físico de Instalação e Cabeamento */}
      {showManual && (
        <div style={{
          background: 'hsl(var(--bg-elevated))',
          border: `1px solid ${ACCENT}40`,
          borderRadius: 20, padding: 24, marginBottom: 24,
          boxShadow: `0 10px 30px ${ACCENT}08`,
          animation: 'expandDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Hammer size={18} color={ACCENT} />
              <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 800, fontSize: 16, margin: 0 }}>
                Manual Técnico: Instalação e Fiação da Catraca iDFace
              </h2>
            </div>
            <button onClick={() => setShowManual(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}>
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {[
              {
                title: '📐 1. Altura & Posicionamento',
                desc: 'Instale o iDFace a uma altura de exatamente 1.40 metros em relação ao piso acabado (medidos da base do leitor). Mantenha uma angulação vertical neutra. Evite incidência direta de luz solar direta nas câmeras para garantir 100% de leitura de face.'
              },
              {
                title: '⚡ 2. Elétrica e Alimentação',
                desc: 'Utilize uma fonte chaveada estabilizada de 12V 2A DC dedicada apenas para o leitor. Nunca compartilhe a alimentação do iDFace com o motor ou relé solenóide da catraca física, pois as oscilações de alta amperagem provocam travamento do sistema facial.'
              },
              {
                title: '🔌 3. Cabeamento do Relé de Entrada',
                desc: 'Ligue o borne C (Comum) e NO (Normalmente Aberto) do relé principal do iDFace nos pinos de Botoeira / Entrada de Abertura da placa da catraca (comumente marcados como GND e BOT / TEM). Quando o iDFace autoriza a face, o relé fecha por 3s liberando os braços da catraca.'
              },
              {
                title: '📡 4. Rede & Auto-Configuração',
                desc: 'Conecte o cabo Ethernet e fixe o IP no menu do display do leitor. Após salvar o IP no ERP nesta tela de dispositivos, use o recurso "Auto-Configurar Webhook" para que o ERP injete de forma automática a URL push no dispositivo para transmissões instantâneas.'
              }
            ].map((step, idx) => (
              <div key={idx} style={{
                background: 'hsl(var(--bg-base))', border: '1px solid hsl(var(--border-subtle))',
                borderRadius: 14, padding: 16
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'hsl(var(--text-primary))', marginBottom: 8, fontFamily: 'Outfit,sans-serif' }}>
                  {step.title}
                </div>
                <div style={{ fontSize: 11.5, color: 'hsl(var(--text-muted))', lineHeight: 1.6 }}>
                  {step.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid de Devices */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 64, color: 'hsl(var(--text-muted))' }}>
          <Activity size={28} style={{ margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>Varrendo rede e carregando leitores...</div>
        </div>
      ) : dispositivos.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 80,
          background: 'hsl(var(--bg-elevated))', borderRadius: 20,
          border: '1px solid hsl(var(--border-subtle))'
        }}>
          <Monitor size={48} style={{ margin: '0 auto 16px', opacity: 0.3, color: 'hsl(var(--text-muted))' }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: 8 }}>Nenhum dispositivo cadastrado</div>
          <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 20 }}>Cadastre o primeiro leitor facial iDFace para começar a operar a portaria de entrada.</div>
          <button onClick={openNew} style={{
            padding: '10px 24px', borderRadius: 12, fontSize: 13, fontWeight: 700,
            background: `linear-gradient(135deg, ${ACCENT}, #0891b2)`,
            border: 'none', color: '#fff', cursor: 'pointer'
          }}>
            <Plus size={14} style={{ display: 'inline', marginRight: 6 }} />
            Cadastrar Dispositivo
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 16 }}>
          {dispositivos.map((d: any) => {
            const isOnline = d.status === 'online'
            return (
              <div key={d.id} style={{
                background: 'hsl(var(--bg-elevated))',
                border: `1px solid ${isOnline ? 'rgba(16,185,129,0.25)' : 'rgba(148,163,184,0.15)'}`,
                borderRadius: 20, padding: '24px',
                boxShadow: isOnline ? '0 8px 30px rgba(16,185,129,0.06)' : '0 8px 30px rgba(0,0,0,0.02)',
                transition: 'all 0.25s', position: 'relative', overflow: 'hidden'
              }}>
                {/* Glow decorativo de online */}
                {isOnline && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                    background: 'linear-gradient(90deg, #10b981, #34d399)'
                  }} />
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                  <div style={{
                    width: 50, height: 50, borderRadius: 16,
                    background: isOnline ? 'rgba(16,185,129,0.06)' : 'rgba(148,163,184,0.06)',
                    border: `1px solid ${isOnline ? 'rgba(16,185,129,0.2)' : 'rgba(148,163,184,0.15)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: isOnline ? '#10b981' : '#94a3b8'
                  }}>
                    {isOnline ? <Wifi size={22} /> : <WifiOff size={22} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Outfit,sans-serif', color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.nome}
                    </div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                      {d.modelo} · {d.unidade || 'Sem unidade'}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 9.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em',
                    padding: '4px 10px', borderRadius: 8,
                    background: isOnline ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.08)',
                    color: isOnline ? '#10b981' : '#f43f5e'
                  }}>
                    {isOnline ? '● ONLINE' : '● OFFLINE'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20, background: 'hsl(var(--bg-base))', padding: 14, borderRadius: 14, border: '1px solid hsl(var(--border-subtle))' }}>
                  {[
                    ['IP / Porta', `${d.ip || 'Não configurado'}:${d.porta}`],
                    ['Modelo', d.modelo || 'iDFace'],
                    ['Protocolo SSL', d.porta === 443 ? 'HTTPS Seguro' : 'HTTP Comum'],
                    ['Último Ping', d.ultima_comunicacao ? new Date(d.ultima_comunicacao).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Nunca'],
                  ].map(([label, val]) => (
                    <div key={label as string}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'hsl(var(--text-primary))', fontFamily: label === 'IP / Porta' ? 'monospace' : 'inherit' }}>{val}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8, borderTop: '1px solid hsl(var(--border-subtle))', paddingTop: 16 }}>
                  <button
                    onClick={() => handleTestConnection(d)}
                    disabled={testing === d.id}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '8px 0', borderRadius: 10, fontSize: 11, fontWeight: 700,
                      background: `${ACCENT}12`, color: ACCENT, border: `1px solid ${ACCENT}25`,
                      cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    {testing === d.id ? <Activity size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={12} />}
                    Ping Test
                  </button>
                  <button
                    onClick={() => openDiagnostics(d)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '8px 0', borderRadius: 10, fontSize: 11, fontWeight: 700,
                      background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)',
                      cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    <Settings size={12} /> Diagnósticos
                  </button>
                  <button
                    onClick={() => openEdit(d)}
                    style={{
                      width: 34, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 10, fontSize: 11, fontWeight: 700,
                      background: 'rgba(245,158,11,0.08)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.15)',
                      cursor: 'pointer', transition: 'all 0.2s'
                    }}
                    title="Editar Cadastro"
                  >
                    <Settings size={12} />
                  </button>
                  <button
                    onClick={() => handleDelete(d.id)}
                    style={{
                      width: 34, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 10, fontSize: 11, fontWeight: 700,
                      background: 'rgba(244,63,94,0.08)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.15)',
                      cursor: 'pointer', transition: 'all 0.2s'
                    }}
                    title="Remover"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Drawer Lateral de Diagnósticos e Ações Remotas */}
      {showDiagnostics && diagnosticsDevice && (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', justifyContent: 'flex-end',
          background: 'rgba(0,0,0,0.5)', zIndex: 9999, backdropFilter: 'blur(3px)',
          animation: 'fadeIn 0.2s'
        }} onClick={() => setShowDiagnostics(null)}>
          <div
            style={{
              background: 'hsl(var(--bg-elevated))', width: '90%', maxWidth: 460, height: '100%',
              borderLeft: '1px solid hsl(var(--border-subtle))', padding: 28, display: 'flex',
              flexDirection: 'column', gap: 24, boxShadow: '-10px 0 40px rgba(0,0,0,0.2)',
              animation: 'slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Cpu size={20} color={ACCENT} />
                <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 18, margin: 0 }}>
                  Ações e Diagnósticos
                </h2>
              </div>
              <button onClick={() => setShowDiagnostics(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ background: 'hsl(var(--bg-base))', padding: 18, borderRadius: 16, border: '1px solid hsl(var(--border-subtle))' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'hsl(var(--text-primary))', marginBottom: 2 }}>{diagnosticsDevice.nome}</div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontFamily: 'monospace' }}>IP: {diagnosticsDevice.ip}:{diagnosticsDevice.porta}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: diagnosticsDevice.status === 'online' ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)', color: diagnosticsDevice.status === 'online' ? '#10b981' : '#f43f5e' }}>
                  {diagnosticsDevice.status?.toUpperCase()}
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(6,182,212,0.1)', color: ACCENT }}>
                  {diagnosticsDevice.modelo}
                </span>
              </div>
            </div>

            {/* Campo para Webhook Personalizado */}
            <div style={{ background: 'hsl(var(--bg-base))', border: '1px solid hsl(var(--border-subtle))', padding: 16, borderRadius: 16 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>
                🔗 URL do Webhook Personalizada (Opcional)
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: http://192.168.1.104:3000"
                value={customWebhookUrl}
                onChange={e => setCustomWebhookUrl(e.target.value)}
                style={{ width: '100%', height: 36, borderRadius: 10, fontSize: 12, fontWeight: 700, paddingLeft: 10 }}
              />
              <p style={{ fontSize: 10, color: 'hsl(var(--text-muted))', margin: '6px 0 0 0', lineHeight: 1.4 }}>
                Necessário para catracas físicas na rede local. Informe o IP local do seu Mac (ex: <code>http://192.168.1.104:3000</code>) para direcionar as leituras ao ERP.
              </p>
            </div>

            {/* Painel de Comandos e Acionamento */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 }}>⚡ Comandos de Controle Físico</div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  {
                    title: '🔓 Liberar Catraca',
                    cmd: 'abrir_catraca',
                    desc: 'Aciona o relé por 3 segundos',
                    color: '#10b981',
                    bg: 'rgba(16,185,129,0.06)',
                    bd: 'rgba(16,185,129,0.2)'
                  },
                  {
                    title: '⚡ Auto-Webhook',
                    cmd: 'config_webhook',
                    desc: 'Injeta as rotas do ERP',
                    color: '#06b6d4',
                    bg: 'rgba(6,182,212,0.06)',
                    bd: 'rgba(6,182,212,0.2)'
                  },
                  {
                    title: '📅 Sync Relógio',
                    cmd: 'sync_relogio',
                    desc: 'Ajusta horário do iDFace',
                    color: '#f59e0b',
                    bg: 'rgba(245,158,11,0.06)',
                    bd: 'rgba(245,158,11,0.2)'
                  },
                  {
                    title: '🔄 Reiniciar hardware',
                    cmd: 'reiniciar',
                    desc: 'Reboot do microprocessador',
                    color: '#f43f5e',
                    bg: 'rgba(244,63,94,0.06)',
                    bd: 'rgba(244,63,94,0.2)'
                  }
                ].map(action => (
                  <button
                    key={action.cmd}
                    onClick={() => handleExecuteCommand(diagnosticsDevice.id, action.cmd)}
                    disabled={executingAction !== null}
                    style={{
                      textAlign: 'left', padding: 14, borderRadius: 14,
                      background: action.bg, border: `1px solid ${action.bd}`,
                      cursor: executingAction !== null ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => {
                      if (executingAction === null) e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'none'
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 800, color: action.color, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      {executingAction === action.cmd ? <Activity size={12} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                      {action.title}
                    </div>
                    <div style={{ fontSize: 9.5, color: 'hsl(var(--text-muted))', lineHeight: 1.3 }}>{action.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Console de Resposta do Diagnóstico */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 180 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Terminal size={12} /> Console de Auditoria de Resposta
              </div>
              <div style={{
                flex: 1, background: '#090d16', border: '1px solid #111b2d',
                borderRadius: 16, padding: 16, overflow: 'auto',
                fontFamily: 'monospace', fontSize: 11, color: '#00ffcc',
                lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 6
              }}>
                {diagnosticsLog.map((log, index) => (
                  <div key={index} style={{
                    color: log.includes('❌') ? '#f43f5e' : log.includes('✅') ? '#10b981' : '#00ffcc',
                    borderLeft: log.startsWith('[') ? 'none' : '2px solid #1e293b',
                    paddingLeft: log.startsWith('[') ? 0 : 8
                  }}>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo/Editar */}
      {showModal && editDevice && (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', zIndex: 9999, backdropFilter: 'blur(4px)',
        }} onClick={() => setShowModal(false)}>
          <div
            style={{
              background: 'hsl(var(--bg-elevated))', borderRadius: 20, padding: 28,
              width: '90%', maxWidth: 480,
              border: '1px solid hsl(var(--border-subtle))',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 800, fontSize: 18, margin: 0 }}>
                {editDevice.id ? '✏️ Editar Dispositivo' : '➕ Novo iDFace'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Nome de Identificação', key: 'nome', placeholder: 'Ex: Entrada Portaria Principal' },
                { label: 'IP do iDFace na Rede Local', key: 'ip', placeholder: 'Ex: 192.168.1.201' },
                { label: 'Porta de Conexão', key: 'porta', placeholder: '443 (HTTPS seguro) ou 80 (HTTP)', type: 'number' },
                { label: 'Unidade Escolar', key: 'unidade', placeholder: 'Ex: Unidade Sede' },
                { label: 'Modelo do Leitor', key: 'modelo', placeholder: 'iDFace' },
              ].map(field => (
                <div key={field.key}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 6 }}>{field.label}</label>
                  <input
                    className="form-input"
                    type={field.type || 'text'}
                    placeholder={field.placeholder}
                    value={field.key === 'login' || field.key === 'password' ? editDevice.configuracao?.[field.key] : editDevice[field.key] || ''}
                    onChange={e => setEditDevice({ ...editDevice, [field.key]: field.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value })}
                    style={{ width: '100%', height: 40, borderRadius: 10, fontSize: 13 }}
                  />
                </div>
              ))}
              
              {/* Login / Password do iDFace */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 6 }}>Usuário API</label>
                  <input
                    className="form-input"
                    type="text"
                    value={editDevice.configuracao?.login || 'admin'}
                    onChange={e => setEditDevice({ ...editDevice, configuracao: { ...editDevice.configuracao, login: e.target.value } })}
                    style={{ width: '100%', height: 40, borderRadius: 10, fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: 6 }}>Senha API</label>
                  <input
                    className="form-input"
                    type="password"
                    value={editDevice.configuracao?.password || 'admin'}
                    onChange={e => setEditDevice({ ...editDevice, configuracao: { ...editDevice.configuracao, password: e.target.value } })}
                    style={{ width: '100%', height: 40, borderRadius: 10, fontSize: 13 }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  flex: 1, padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: 'hsl(var(--bg-base))', color: 'hsl(var(--text-muted))',
                  border: '1px solid hsl(var(--border-subtle))', cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: `linear-gradient(135deg, ${ACCENT}, #0891b2)`,
                  border: 'none', color: '#fff', cursor: 'pointer',
                }}
              >
                <Save size={14} /> Gravar Configuração
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes slideIn { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideLeft { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes expandDown { from { height: 0; opacity: 0; overflow: hidden; } to { height: auto; opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  )
}
