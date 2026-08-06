'use client'

import { useData, newId } from '@/lib/dataContext'
import { useState, useMemo, useCallback, useEffect } from 'react'
import { getInitials } from '@/lib/utils'
import { useApiQuery } from '@/hooks/useApi'
import { useEnsalamento } from '@/lib/useEnsalamento'
import {
  ArrowLeft, Save, Download, CheckCircle, BookOpen, ChevronRight, ChevronDown,
  AlertTriangle, Search, Calendar, BarChart2, Users, Printer, FileText, Check, X, Info,
  Filter, School, TrendingUp, AlertCircle, Shield, Tag, XCircle, MoreHorizontal, Sparkles, RefreshCw, User,
  QrCode, Edit3, Clock, ShieldCheck, Cpu, ScanFace, LogOut, UserCheck, Plus, CheckCircle2
} from 'lucide-react'
import { TableSkeleton } from '@/components/skeletons/TableSkeleton'
import { PresStatus, getTurmaSchedule, calcularFrequenciaDia, getFirstPresentTempoIndex } from '@/lib/frequenciaEngine'
import { isAlunoCursandoTurma } from '@/lib/studentTurmaUtils'
import { SyncAcessosModal } from '@/components/portaria/SyncAcessosModal'

const S_CONFIG: Record<PresStatus, { bg: string; color: string; label: string; border: string; glow: string }> = {
  P: { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0', label: 'P', glow: 'rgba(34, 197, 94, 0.2)' },
  F: { bg: '#fee2e2', color: '#b91c1c', border: '#fecaca', label: 'F', glow: 'rgba(239, 68, 68, 0.2)' },
  J: { bg: '#fef3c7', color: '#b45309', border: '#fde68a', label: 'J', glow: 'rgba(245, 158, 11, 0.2)' },
  A: { bg: '#e5e7eb', color: '#374151', border: '#d1d5db', label: 'A', glow: 'rgba(107, 114, 128, 0.2)' },
  '-': { bg: 'transparent', color: '#94a3b8', border: '1px dashed #cbd5e1', label: '-', glow: 'none' },
}

export interface OrigemBadgeItem {
  tipo: 'catraca' | 'manual' | 'totem' | 'chamadas' | 'sem_registro'
  label: string
  horario?: string
  responsavel?: string
  dispositivo?: string
  detalhes?: string
}

export interface OrigemFrequenciaCompleta {
  entrada: OrigemBadgeItem | null
  saida: OrigemBadgeItem | null
}

function formatTimeFromIso(isoStr?: string): string | undefined {
  if (!isoStr) return undefined
  let str = String(isoStr).trim()
  if (!str) return undefined
  try {
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) {
      const [h, m] = str.split(':').map(Number)
      const dateToday = new Date().toISOString().split('T')[0]
      str = `${dateToday}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-03:00`
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(str)) {
      str += '-03:00'
    }
    const d = new Date(str)
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('pt-BR', { timeZone: 'America/Campo_Grande', hour: '2-digit', minute: '2-digit' })
    }
  } catch {}
  return undefined
}

function getLocalIsoString(dia: string, hora: string): string {
  if (!dia || !hora) return new Date().toISOString()
  try {
    const [yyyy, mm, dd] = dia.split('-').map(Number)
    const [hh, min] = hora.split(':').map(Number)
    const d = new Date(yyyy, mm - 1, dd, hh, min, 0)
    
    const offsetMinutes = d.getTimezoneOffset()
    const sign = offsetMinutes > 0 ? '-' : '+'
    const absMinutes = Math.abs(offsetMinutes)
    const offsetHours = String(Math.floor(absMinutes / 60)).padStart(2, '0')
    const offsetMins = String(absMinutes % 60).padStart(2, '0')
    return `${dia}T${hora.slice(0, 5)}:00${sign}${offsetHours}:${offsetMins}`
  } catch {
    return `${dia}T${hora.slice(0, 5)}:00`
  }
}

function getOrigemFrequenciaCompleta(
  alunoId: string,
  dataStr: string,
  freqRecord?: any,
  portariaEvents?: any[],
  saidaCalls?: any[],
  horarioEntradaState?: string,
  horarioSaidaState?: string,
  responsavelSaidaState?: string
): OrigemFrequenciaCompleta {
  const targetId = String(alunoId).trim()

  // Evento de portaria (Catraca iDFace) para o aluno nesta data
  const portariaEvEntrada = (portariaEvents || []).find((ev: any) => {
    const evAlunoId = String(ev.aluno_id || ev.alunoId || '').trim()
    const evEquipId = String(ev.user_id_equipamento || '').trim()
    const matchesAluno = (evAlunoId && evAlunoId === targetId) || (evEquipId && evEquipId === targetId)
    if (!matchesAluno) return false
    if (ev.status && ev.status !== 'sucesso') return false
    const evDateStr = String(ev.data_hora || ev.created_at || ev.data || '').split('T')[0]
    if (evDateStr !== dataStr) return false
    const sentido = String(ev.sentido || ev.tipo || '').toLowerCase()
    return sentido !== 'saida'
  })

  const portariaEvSaida = (portariaEvents || []).find((ev: any) => {
    const evAlunoId = String(ev.aluno_id || ev.alunoId || '').trim()
    const evEquipId = String(ev.user_id_equipamento || '').trim()
    const matchesAluno = (evAlunoId && evAlunoId === targetId) || (evEquipId && evEquipId === targetId)
    if (!matchesAluno) return false
    if (ev.status && ev.status !== 'sucesso') return false
    const evDateStr = String(ev.data_hora || ev.created_at || ev.data || '').split('T')[0]
    if (evDateStr !== dataStr) return false
    const sentido = String(ev.sentido || ev.tipo || '').toLowerCase()
    return sentido === 'saida'
  })

  let horaCatracaEntrada: string | undefined = undefined
  if (portariaEvEntrada) {
    const rawTime = portariaEvEntrada.data_hora || portariaEvEntrada.created_at || portariaEvEntrada.data
    horaCatracaEntrada = formatTimeFromIso(rawTime) || (rawTime ? String(rawTime).split('T')[1]?.slice(0, 5) : undefined)
  }

  let horaCatracaSaida: string | undefined = undefined
  if (portariaEvSaida) {
    const rawTime = portariaEvSaida.data_hora || portariaEvSaida.created_at || portariaEvSaida.data
    horaCatracaSaida = formatTimeFromIso(rawTime) || (rawTime ? String(rawTime).split('T')[1]?.slice(0, 5) : undefined)
  }

  // --- LOGICA ENTRADA ---
  let entrada: OrigemBadgeItem | null = null

  if (freqRecord) {
    const registradoPor = String(freqRecord.registradoPor || freqRecord.dados?.registradoPor || '')
    const origem = String(freqRecord.origem || freqRecord.dados?.origem || '')
    const isSaidaOnlyRecord = registradoPor.toLowerCase().includes('saída') || registradoPor.toLowerCase().includes('saida')

    const horaEntradaExplicit = horarioEntradaState ||
                                freqRecord.dados?.horaEntrada || 
                                (!isSaidaOnlyRecord && (freqRecord.horaRegistro || freqRecord.dados?.horaRegistro) ? (freqRecord.horaRegistro || freqRecord.dados?.horaRegistro) : null) || 
                                horaCatracaEntrada

    const isCatraca =
      (origem === 'catraca' && !isSaidaOnlyRecord) ||
      (registradoPor.toLowerCase().includes('catraca') && !isSaidaOnlyRecord) ||
      (registradoPor.toLowerCase().includes('idface') && !isSaidaOnlyRecord) ||
      !!portariaEvEntrada

    const isTotem = origem === 'totem' || registradoPor.toLowerCase().includes('totem')

    const hasEntradaExplicit = !!horarioEntradaState ||
                               !!freqRecord.dados?.horaEntrada ||
                               (freqRecord.origem === 'manual' && !isSaidaOnlyRecord && (freqRecord.horaRegistro || freqRecord.presente || (freqRecord.tempos && Object.values(freqRecord.tempos).some(v => v === 'P'))))

    if (isCatraca) {
      entrada = {
        tipo: 'catraca',
        label: 'iDFace',
        horario: horaEntradaExplicit || horaCatracaEntrada || undefined,
        dispositivo: portariaEvEntrada?.dispositivo_nome || 'iDFace',
        detalhes: `Entrada por biometria iDFace (${portariaEvEntrada?.dispositivo_nome || 'Catraca'})`
      }
    } else if (isTotem) {
      entrada = {
        tipo: 'totem',
        label: 'Totem',
        horario: horaEntradaExplicit || undefined,
        detalhes: 'Entrada registrada via Totem'
      }
    } else if (hasEntradaExplicit && horaEntradaExplicit) {
      entrada = {
        tipo: 'manual',
        label: 'Manual',
        horario: horaEntradaExplicit || undefined,
        detalhes: 'Entrada lançada manualmente'
      }
    }
  } else if (portariaEvEntrada) {
    entrada = {
      tipo: 'catraca',
      label: 'iDFace',
      horario: horaCatracaEntrada,
      dispositivo: portariaEvEntrada.dispositivo_nome || 'iDFace',
      detalhes: 'Entrada registrada no equipamento iDFace'
    }
  } else if (horarioEntradaState) {
    entrada = {
      tipo: 'manual',
      label: 'Manual',
      horario: horarioEntradaState,
      detalhes: 'Entrada registrada manualmente'
    }
  }

  // --- LOGICA SAÍDA ---
  let saida: OrigemBadgeItem | null = null

  // 1. Verificar em /chamadas (saidaCalls)
  const chamadaConfirmada = (saidaCalls || []).find((c: any) => {
    const cStudentId = String(c.studentId || c.alunoId || c.aluno_id || '').trim()
    if (cStudentId !== targetId) return false
    const cStatus = String(c.status || '').toLowerCase()
    if (cStatus !== 'confirmed' && cStatus !== 'confirmado' && !c.confirmedAt) return false
    const cDate = String(c.confirmedAt || c.calledAt || c.created_at || '').split('T')[0]
    return cDate === dataStr
  })

  const freqSaidaHorario = freqRecord?.dados?.saidaHorario || freqRecord?.saidaHorario
  const freqSaidaResp = freqRecord?.dados?.saidaResponsavel || freqRecord?.saidaResponsavel
  const freqSaidaOrigem = freqRecord?.dados?.saidaOrigem || freqRecord?.saidaOrigem

  const horaSaidaRaw = horarioSaidaState ||
                       (chamadaConfirmada ? (chamadaConfirmada.confirmedAt || chamadaConfirmada.calledAt) : null) ||
                       freqSaidaHorario ||
                       horaCatracaSaida

  const horaSaidaFormatted = formatTimeFromIso(horaSaidaRaw) || (horaSaidaRaw ? String(horaSaidaRaw).slice(11, 16) : undefined)
  const respSaida = responsavelSaidaState || chamadaConfirmada?.guardianName || chamadaConfirmada?.responsavel || freqSaidaResp

  if (horaSaidaFormatted || chamadaConfirmada || portariaEvSaida || (freqRecord && (freqSaidaHorario || freqSaidaResp))) {
    const isCatracaSaida = !!portariaEvSaida ||
                           freqSaidaOrigem === 'catraca' ||
                           freqSaidaOrigem === 'idface' ||
                           chamadaConfirmada?.source === 'idface' ||
                           chamadaConfirmada?.source === 'catraca'

    if (isCatracaSaida) {
      saida = {
        tipo: 'catraca',
        label: 'iDFace',
        horario: horaSaidaFormatted,
        responsavel: respSaida,
        detalhes: `Saída biométrica iDFace${respSaida ? ` (${respSaida})` : ''}`
      }
    } else {
      saida = {
        tipo: 'manual',
        label: 'Manual',
        horario: horaSaidaFormatted,
        responsavel: respSaida,
        detalhes: `Saída confirmada em /chamadas${respSaida ? ` (Retirado por: ${respSaida})` : ''}`
      }
    }
  }

  return { entrada, saida }
}

function OrigemBadgePair({ infoCompleta, compact = false }: { infoCompleta: OrigemFrequenciaCompleta; compact?: boolean }) {
  if (!infoCompleta) return null
  const { entrada, saida } = infoCompleta
  if (!entrada && !saida) return null

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
      {/* Badge de Entrada */}
      {entrada && (
        <span
          title={entrada.detalhes || `Entrada ${entrada.label}${entrada.horario ? ` às ${entrada.horario}` : ''}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: compact ? '2px 6px' : '3px 8px',
            background: entrada.tipo === 'catraca'
              ? 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)'
              : 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)',
            color: entrada.tipo === 'catraca' ? '#0369a1' : '#6b21a8',
            border: `1px solid ${entrada.tipo === 'catraca' ? '#7dd3fc' : '#c084fc'}`,
            borderRadius: '8px',
            fontSize: compact ? '9px' : '11px',
            fontWeight: 800,
            lineHeight: 1,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            letterSpacing: '0.2px',
            whiteSpace: 'nowrap'
          }}
        >
          {entrada.tipo === 'catraca' ? (
            <ScanFace size={compact ? 11 : 13} style={{ color: '#0284c7' }} />
          ) : (
            <Edit3 size={compact ? 11 : 13} style={{ color: '#7e22ce' }} />
          )}
          <span>Entrada: {entrada.label}</span>
          {entrada.horario && (
            <span style={{ background: entrada.tipo === 'catraca' ? '#0284c7' : '#7e22ce', color: '#fff', padding: '2px 5px', borderRadius: '4px', fontSize: '9px', fontWeight: 900 }}>
              {entrada.horario}h
            </span>
          )}
        </span>
      )}

      {/* Badge de Saída */}
      {saida && (
        <span
          title={saida.detalhes || `Saída ${saida.label}${saida.horario ? ` às ${saida.horario}` : ''}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: compact ? '2px 6px' : '3px 8px',
            background: saida.tipo === 'catraca'
              ? 'linear-gradient(135deg, #ecfdf5 0%, #a7f3d0 100%)'
              : 'linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%)',
            color: saida.tipo === 'catraca' ? '#047857' : '#c026d3',
            border: `1px solid ${saida.tipo === 'catraca' ? '#6ee7b7' : '#f5d0fe'}`,
            borderRadius: '8px',
            fontSize: compact ? '9px' : '11px',
            fontWeight: 800,
            lineHeight: 1,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            letterSpacing: '0.2px',
            whiteSpace: 'nowrap'
          }}
        >
          <LogOut size={compact ? 11 : 13} style={{ color: saida.tipo === 'catraca' ? '#059669' : '#c026d3' }} />
          <span>Saída: {saida.label}</span>
          {saida.horario && (
            <span style={{ background: saida.tipo === 'catraca' ? '#059669' : '#c026d3', color: '#fff', padding: '2px 5px', borderRadius: '4px', fontSize: '9px', fontWeight: 900 }}>
              {saida.horario}h
            </span>
          )}
        </span>
      )}
    </div>
  )
}

function OrigemBadge({ info, infoCompleta, compact = false }: { info?: any; infoCompleta?: OrigemFrequenciaCompleta; compact?: boolean }) {
  if (infoCompleta) {
    return <OrigemBadgePair infoCompleta={infoCompleta} compact={compact} />
  }
  if (!info || info.tipo === 'sem_registro') return null
  return <OrigemBadgePair infoCompleta={{ entrada: info, saida: null }} compact={compact} />
}

function renderRegrasModal(isOpen: boolean, onClose: () => void) {
  if (!isOpen) return null;
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.55)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '24px',
        maxWidth: '650px',
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 40px rgba(37, 99, 235, 0.05)',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Header do Modal */}
        <div style={{
          padding: '24px 32px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#2563eb', color: '#fff', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={18} style={{ color: '#fff' }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '18px', color: '#0f172a' }}>
                Regras e Métricas de Frequência
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                Diretrizes oficiais para contabilização de faltas e presença
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo do Modal */}
        <div style={{ padding: '32px', maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Sistema Unificado de Lançamento */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '20px', borderRadius: '16px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#16a34a', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: '#10b981', color: '#fff', width: '22px', height: '22px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 900 }}>1</span>
              Lançamento Unificado de Frequência (1-Clique)
            </h4>
            <ul style={{ margin: '0 0 16px 0', paddingLeft: '20px', fontSize: '13px', color: '#14532d', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>
                <strong>Métrica Diária Simplificada:</strong> A frequência é gerenciada por <strong>dia letivo</strong> utilizando o botão único de 1-Clique para todos os segmentos escolares.
              </li>
              <li>
                <strong>Estados de Frequência:</strong>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                  <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>PRESENTE (P)</span>
                  <span style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>FALTOSO (F)</span>
                  <span style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>JUSTIFICADO (J)</span>
                  <span style={{ background: '#f8fafc', color: '#64748b', border: '1px dashed #cbd5e1', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>DEFINIR FREQUÊNCIA (-)</span>
                </div>
              </li>
              <li>
                <strong>Horário de Entrada:</strong> Quando marcado como <code>PRESENTE</code>, o sistema registra automaticamente o horário de entrada (suportando Biometria iDFace, Totem ou Lançamento Manual) e permite edição manual com clique simples no badge de horário.
              </li>
            </ul>
          </div>

          {/* Sistema de Registro de Saída */}
          <div style={{ background: '#fdf4ff', border: '1px solid #f5d0fe', padding: '20px', borderRadius: '16px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#c026d3', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: '#c026d3', color: '#fff', width: '22px', height: '22px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 900 }}>2</span>
              Registro de Saída e Retirada de Alunos
            </h4>
            <ul style={{ margin: '0 0 0 0', paddingLeft: '20px', fontSize: '13px', color: '#701a75', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>
                <strong>Botão Registrar Saída:</strong> Disponível no Diário de Frequência para todos os alunos que estiverem presentes.
              </li>
              <li>
                <strong>Controle de Responsáveis Autorizados:</strong> Abre o modal interativo com verificação em tempo real dos responsáveis autorizados na ficha do aluno (destacando <code>🟢 PERMITIDO</code> e bloqueando restritos <code>🔴 PROIBIDO RETIRAR</code>).
              </li>
              <li>
                <strong>Sincronização em Tempo Real:</strong> A confirmação da saída dispara eventos em tempo real para o módulo de <strong>/chamadas</strong> e para o monitor de portaria/TV da escola.
              </li>
            </ul>
          </div>

          {/* Ausências Justificadas */}
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '20px', borderRadius: '16px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#d97706', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={16} />
              Ausências Justificadas (J) e Frequência Total (%)
            </h4>
            <p style={{ margin: 0, fontSize: '13px', color: '#78350f', lineHeight: '1.6' }}>
              Qualquer ausência marcada como <strong>Justificada (J)</strong> é abonada, significando que a falta <strong>não penaliza o percentual (%) da Frequência Total</strong> do aluno. Faltas não justificadas (F) reduzem proporcionalmente a frequência global acumulada.
            </p>
          </div>

        </div>

        {/* Footer do Modal */}
        <div style={{
          padding: '20px 32px',
          borderTop: '1px solid #f1f5f9',
          textAlign: 'right',
          background: '#f8fafc'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              background: '#0f172a',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#1e293b'}
            onMouseLeave={e => e.currentTarget.style.background = '#0f172a'}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

function formatHoraCatraca(dataHoraStr: string | null): string | null {
  if (!dataHoraStr) return null;
  const s = String(dataHoraStr).trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) {
    return s.slice(0, 5);
  }
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(d);
    }
  } catch {}
  return s.length >= 5 ? s.slice(0, 5) : null;
}

function getTempoEntrada(horaRegistro: string | null, segment: string, turno: string = 'Matutino'): string | null {
  if (!horaRegistro) return null;
  const parts = horaRegistro.split(':');
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  const arrivalMinutes = hours * 60 + minutes;
  const firstPresentIndex = getFirstPresentTempoIndex(arrivalMinutes, segment, turno);
  return `${firstPresentIndex + 1}º Tempo`;
}

export interface GuardianInfo {
  id: string
  name: string
  role: string
  permitido: boolean
  motivoProibicao?: string
  diasSemana?: string[]
}

function getStudentGuardians(student: any, globalResponsaveisList?: any[]): GuardianInfo[] {
  if (!student) return []
  const list: GuardianInfo[] = []
  const seen = new Set<string>()

  const addGuardian = (nameVal: any, roleVal: string = 'Responsável', isProibido: boolean = false, motivo: string = '', dias: string[] = []) => {
    if (!nameVal) return
    let nameStr = ''
    if (typeof nameVal === 'string') {
      nameStr = nameVal.trim()
    } else if (typeof nameVal === 'object' && nameVal !== null) {
      nameStr = (nameVal.nome || nameVal.name || nameVal.nomeCompleto || nameVal.nome_completo || '').trim()
    }
    if (!nameStr) return
    const key = nameStr.toLowerCase()
    if (['none', 'nenhum', 'n/a', 'null', 'undefined', '-'].includes(key)) return

    if (!seen.has(key)) {
      seen.add(key)
      list.push({
        id: `g-${seen.size}`,
        name: nameStr,
        role: roleVal,
        permitido: !isProibido,
        motivoProibicao: motivo || (isProibido ? 'Restrição cadastrada' : undefined),
        diasSemana: dias
      })
    }
  }

  // 1. Cruzar com a lista global cadastrada no módulo Responsáveis (/academico/responsaveis)
  if (Array.isArray(globalResponsaveisList) && globalResponsaveisList.length > 0) {
    const studentRefs = [
      student.id,
      student.matricula,
      student.codigo,
      student.dados?.codigo,
      student.dados?.id,
      student.dados?.matricula,
      student.nome
    ].filter(Boolean).map(r => String(r).trim().toLowerCase())

    globalResponsaveisList.forEach((rObj: any) => {
      const name = rObj.nome || rObj.name
      if (!name) return

      const vincs = rObj.alunosVinculados || rObj.aluno_responsavel || rObj.dados?.alunosVinculados || []
      const isLinked = Array.isArray(vincs) && vincs.some((v: any) => {
        const vId = String(typeof v === 'object' ? (v.id || v.aluno_id || v.matricula || v.nome) : v).trim().toLowerCase()
        return studentRefs.includes(vId)
      })

      if (isLinked) {
        const vincInfo = Array.isArray(vincs)
          ? vincs.find((v: any) => typeof v === 'object' && studentRefs.includes(String(v.id || v.aluno_id || v.matricula || v.nome).trim().toLowerCase()))
          : null

        const isPed = vincInfo?.isPedagogico || vincInfo?.resp_pedagogico || rObj.isPedagogico
        const isFin = vincInfo?.isFinanceiro || vincInfo?.resp_financeiro || rObj.isFinanceiro
        const isOut = vincInfo?.isOutro || vincInfo?.resp_outro || rObj.isOutro

        let role = vincInfo?.parentesco || rObj.parentesco || ''
        if (isPed) role = 'Resp. Pedagógico'
        else if (isFin) role = 'Resp. Financeiro'
        else if (isOut) role = (role && role.toLowerCase() !== 'outro' && role.toLowerCase() !== 'outros') ? `Outros (${role})` : 'Outros'
        else if (!role) role = 'Responsável'

        const proibido = rObj.proibido === true || vincInfo?.proibido === true
        const dias = rObj.diasAcesso || rObj.dias_acesso || rObj.diasSemana || []
        addGuardian(name, role, proibido, rObj.observacao || rObj.motivo, dias)
      }
    })
  }

  // 2. Responsáveis cadastrados na estrutura do aluno
  const resps: any[] = []
  const pushArray = (arr: any) => {
    if (Array.isArray(arr)) resps.push(...arr)
  }
  pushArray(student.responsaveis)
  pushArray(student.dados?.responsaveis)
  pushArray(student.responsaveis_lista)
  pushArray(student.outrosResponsaveis)
  pushArray(student.dados?.outrosResponsaveis)
  pushArray(student.responsaveisOutros)
  pushArray(student.dados?.responsaveisOutros)
  pushArray(student._responsaveis)
  pushArray(student.dados?._responsaveis)

  resps.forEach((r: any) => {
    const name = r.nome || r.name || r.nomeCompleto || r.nome_completo
    if (!name) return

    let rawRole = r.parentesco || r.role || r.tipo || ''
    const isPed = r.isPedagogico === true || r.respPedagogico === true || rawRole.toLowerCase().includes('pedag')
    const isFin = r.isFinanceiro === true || r.respFinanceiro === true || rawRole.toLowerCase().includes('finan')
    const isOut = r.isOutro === true || r.resp_outro === true || r.respOutro === true || rawRole.toLowerCase() === 'outro' || rawRole.toLowerCase() === 'outros'

    let finalRole = rawRole
    if (isPed) {
      finalRole = 'Resp. Pedagógico'
    } else if (isFin) {
      finalRole = 'Resp. Financeiro'
    } else if (isOut) {
      finalRole = (rawRole && rawRole.toLowerCase() !== 'outro' && rawRole.toLowerCase() !== 'outros')
        ? `Outros (${rawRole})`
        : 'Outros'
    } else if (!finalRole) {
      finalRole = 'Responsável'
    }

    const proibido = r.proibido === true || r.bloqueado === true || r.status === 'proibido' || r.permitido === false
    const dias = r.diasAcesso || r.diasSemana || r.dias_acesso || []
    addGuardian(name, finalRole, proibido, r.motivo || r.observacao || r.obsProibicao, dias)
  })

  // 3. Autorizados do módulo Saúde & Obs / Portaria
  const saude: any = student.saude || student.dados?.saude || {}
  const autorizados: any[] = []
  pushArray(saude.autorizados)
  pushArray(student.autorizados)
  pushArray(student.dados?.autorizados)
  pushArray(student.autorizadosSaida)
  pushArray(student.dados?.autorizadosSaida)

  autorizados.forEach((aut: any) => {
    const name = aut.nome || aut.name || aut.nomeCompleto
    if (!name) return
    const rawRole = aut.parentesco || aut.role || 'Autorizado'
    const proibido = aut.proibido === true || aut.bloqueado === true || aut.status === 'proibido' || aut.permitido === false
    const dias = aut.diasSemana || aut.diasAcesso || []
    addGuardian(name, rawRole, proibido, aut.obsProibicao || aut.motivo, dias)
  })

  // 4. Campos ERP diretos (Responsável Pedagógico, Financeiro, Outros, Mãe, Pai, Responsável Geral)
  const d = student.dados || {}
  addGuardian(student.responsavelPedagogico || student.responsavel_pedagogico || d.responsavelPedagogico || d.responsavel_pedagogico || d.resp_pedagogico, 'Resp. Pedagógico')
  addGuardian(student.responsavelFinanceiro || student.responsavel_financeiro || d.responsavelFinanceiro || d.responsavel_financeiro || d.resp_financeiro, 'Resp. Financeiro')
  addGuardian(student.responsavelOutro || student.responsavel_outro || d.responsavelOutro || d.responsavel_outro || d.resp_outro, 'Outros')
  addGuardian(d.nome_mae || d.mae || d.nomeMae || d.filiacao?.mae || d.filiacao_mae || student.mae || student.nomeMae, 'Mãe')
  addGuardian(d.nome_pai || d.pai || d.nomePai || d.filiacao?.pai || d.filiacao_pai || student.pai || student.nomePai, 'Pai')
  addGuardian(d.nome_responsavel || d.responsavel || d.nomeResponsavel || d.resp_nome || student.responsavel || student.nomeResponsavel, 'Responsável')

  return list
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

const MESES_ANO = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' }
]

export default function FrequenciaPage() {
  const { turmas = [], frequencias: contextFreqs = [], setFrequencias, cfgCalendarioLetivo = [], cfgNiveisEnsino = [] } = useData()
  
  const { data: apiResponse, isLoading: loadingAlunos, isFetching: fetchingAlunos } = useApiQuery<{data: any[], meta: any}>(
    ['alunos-core-frequencia'], 
    '/api/alunos', 
    { lightweight: true, all: true, limit: 2000 },
    { noCache: true }
  )
  const alunos = apiResponse?.data || []

  // Lista global de responsáveis vindos do módulo /academico/responsaveis (/api/responsaveis)
  const { data: allResponsaveisResp } = useApiQuery<any>(
    ['all-responsaveis-frequencia'],
    '/api/responsaveis',
    { all: true, limit: 5000 },
    { noCache: true }
  )

  const allResponsaveisList = useMemo(() => {
    if (!allResponsaveisResp) return []
    if (Array.isArray(allResponsaveisResp)) return allResponsaveisResp
    if (Array.isArray(allResponsaveisResp.data)) return allResponsaveisResp.data
    return []
  }, [allResponsaveisResp])

  const { data: allFreqs, isLoading: loadingAllFreqs, isFetching: fetchingAllFreqs, refetch: refetchAllFreqs } = useApiQuery<any[]>(
    ['all-frequencias'],
    '/api/academico/frequencias',
    { limit: 10000 },
    { noCache: true }
  )

  // Eventos de acesso de portaria (Catraca)
  const { data: portariaEventsResponse } = useApiQuery<any>(
    ['portaria-eventos-relatorio'],
    '/api/portaria/eventos',
    { limit: 5000 },
    { noCache: true }
  )

  const portariaEventsList = useMemo(() => {
    if (!portariaEventsResponse) return []
    if (Array.isArray(portariaEventsResponse)) return portariaEventsResponse
    if (Array.isArray(portariaEventsResponse.data)) return portariaEventsResponse.data
    return []
  }, [portariaEventsResponse])

  // Saídas confirmadas em /chamadas (/api/saida/calls)
  const { data: saidaCallsResponse, refetch: refetchSaidaCalls } = useApiQuery<any>(
    ['saida-calls-frequencia'],
    '/api/saida/calls',
    { limit: 5000 },
    { noCache: true }
  )

  const saidaCallsList = useMemo(() => {
    if (!saidaCallsResponse) return []
    if (Array.isArray(saidaCallsResponse)) return saidaCallsResponse
    if (Array.isArray(saidaCallsResponse.data)) return saidaCallsResponse.data
    return []
  }, [saidaCallsResponse])

  // Mesclar registros do Context com os carregados via API
  const combinedFreqs = useMemo(() => {
    const map = new Map<string, any>()
    ;(contextFreqs || []).forEach(f => {
      const aId = String((f as any).aluno_id || (f as any).alunoId || (f as any).aluno || '')
      const dt = String(f.data || '').slice(0, 10)
      if (aId && dt) map.set(`${aId}_${dt}`, f)
    })
    ;(allFreqs || []).forEach(f => {
      const aId = String((f as any).aluno_id || (f as any).alunoId || (f as any).aluno || '')
      const dt = String(f.data || '').slice(0, 10)
      if (aId && dt) map.set(`${aId}_${dt}`, f)
    })
    return Array.from(map.values())
  }, [contextFreqs, allFreqs])

  const isSameDay = useCallback((fData: any, targetDayStr: string): boolean => {
    if (!fData || !targetDayStr) return false
    const s = String(fData)
    if (s.startsWith(targetDayStr)) return true
    if (s.split('T')[0] === targetDayStr) return true
    if (s.slice(0, 10) === targetDayStr) return true
    try {
      const d = new Date(fData)
      if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear()
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        if (`${yyyy}-${mm}-${dd}` === targetDayStr) return true
      }
    } catch {}
    return false
  }, [])

  const [turmaSel, setTurmaSel] = useState<string|null>(null)
  const [showRegrasModal, setShowRegrasModal] = useState(false)
  const [showRelatorioModal, setShowRelatorioModal] = useState(false)
  const [showAcessosModal, setShowAcessosModal] = useState(false)
  const [buscaRelatorio, setBuscaRelatorio] = useState('')
  const [turmasExpandidas, setTurmasExpandidas] = useState<Record<string, boolean>>({})

  // Filtros avançados do modal de relatório (Modos: por_turma | aluno_individual)
  const [relatorioModo, setRelatorioModo] = useState<'por_turma' | 'aluno_individual'>('por_turma')
  const [relatorioTipoData, setRelatorioTipoData] = useState<'especifica' | 'intervalo'>('intervalo')
  const [relatorioDataInicio, setRelatorioDataInicio] = useState(todayStr())
  const [relatorioDataFim, setRelatorioDataFim] = useState(todayStr())
  const [relatorioAno, setRelatorioAno] = useState('')
  const [relatorioMes, setRelatorioMes] = useState('')
  const [relatorioSegmento, setRelatorioSegmento] = useState('')
  const [relatorioTurno, setRelatorioTurno] = useState('')
  const [relatorioStatus, setRelatorioStatus] = useState('')
  const [relatorioTurmasSel, setRelatorioTurmasSel] = useState<string[]>([])
  const [relatorioTurmaFiltroIndividual, setRelatorioTurmaFiltroIndividual] = useState<string>('')
  const [relatorioAlunoId, setRelatorioAlunoId] = useState<string>('')
  const [buscaAlunoRelatorio, setBuscaAlunoRelatorio] = useState('')
  const [relatorioOrdenacao, setRelatorioOrdenacao] = useState<'nome_asc' | 'nome_desc' | 'turma_asc' | 'frequencia_asc' | 'frequencia_desc' | 'faltas_desc' | 'id_asc'>('nome_asc')
  const [alunosExpandidosRelatorio, setAlunosExpandidosRelatorio] = useState<Record<string, boolean>>({})

  // Modal Registro Manual
  const [showRegistroManualModal, setShowRegistroManualModal] = useState(false)
  const [registroManualAno, setRegistroManualAno] = useState('')
  const [registroManualData, setRegistroManualData] = useState(todayStr())
  const [registroManualTurno, setRegistroManualTurno] = useState('')
  const [buscaRegistroManual, setBuscaRegistroManual] = useState('')
  const [absencesManual, setAbsencesManual] = useState<Record<string, Record<string, PresStatus>>>({})
  const [salvandoManual, setSalvandoManual] = useState(false)

  // Estados específicos para Educação Infantil (Horários de Entrada, Saída e Responsáveis)
  const [horariosEntrada, setHorariosEntrada] = useState<Record<string, Record<string, string>>>({})
  const [horariosSaida, setHorariosSaida] = useState<Record<string, Record<string, string>>>({})
  const [responsaveisSaida, setResponsaveisSaida] = useState<Record<string, Record<string, string>>>({})
  const [saidaModalData, setSaidaModalData] = useState<{ aluno: any; dia: string } | null>(null)
  const [saidaModalHora, setSaidaModalHora] = useState<string>('')
  const [saidaModalResponsavel, setSaidaModalResponsavel] = useState<string>('')
  const [customResponsavel, setCustomResponsavel] = useState<string>('')
  const [salvandoSaida, setSalvandoSaida] = useState<boolean>(false)
  const [editingEntrada, setEditingEntrada] = useState<{ alunoId: string; dia: string } | null>(null)

  // Auto-open sync modal on page load
  useEffect(() => {
    setShowAcessosModal(true)
  }, [])
  
  // Filtros home
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString())
  const [filtroSegmento, setFiltroSegmento] = useState('')
  const [filtroTurno, setFiltroTurno] = useState('')
  const [filtroBusca, setFiltroBusca] = useState('')
  
  const anosDisponiveis = useMemo(() => {
    const fromConfig = (cfgCalendarioLetivo || []).map((c: any) => c.ano.toString())
    const fromTurmas = (turmas || []).map(t => t.ano.toString())
    return [...new Set([...fromConfig, ...fromTurmas])].sort().reverse()
  }, [cfgCalendarioLetivo, turmas])

  // Sincronizar ano vigente inicial
  useEffect(() => {
    const vigente = (cfgCalendarioLetivo || []).find((c: any) => c.isVigente)?.ano?.toString()
    if (vigente) setFiltroAno(vigente)
  }, [cfgCalendarioLetivo])

  // Estado chamada
  const [dataSel, setDataSel] = useState(todayStr())
  const [buscaAluno, setBuscaAluno] = useState('')
  const [salvo, setSalvo] = useState(false)
  const diasPeriodo = useMemo(() => [dataSel], [dataSel])

  const today = todayStr()
  const freqMinima = 75 // Padrão

  const turmaObj = turmaSel ? turmas.find(t => String(t.id) === String(turmaSel)) : null
  const turmaId = turmaObj?.id ? String(turmaObj.id) : ''
  
  const { getNumeroChamada, ordenarPorChamada, formatarNumero } = useEnsalamento(turmaObj)

  // Registros da turma via API
  const { data: freqTurma, refetch: refetchFreq, isLoading: loadingFreqTurma, isFetching: fetchingFreqTurma } = useApiQuery<any[]>(
    ['frequencias-turma', turmaId],
    `/api/academico/frequencias`,
    { turma_id: turmaId },
    { enabled: !!turmaId, noCache: true }
  )

  const alunosDaTurma = useMemo(() => {
    if (!turmaSel) return []
    const targetTurma = turmaObj || turmas.find(t => String(t.id) === String(turmaSel) || String(t.codigo) === String(turmaSel) || String(t.nome) === String(turmaSel)) || turmaSel

    const lista = alunos.filter((a: any) => {
      return isAlunoCursandoTurma(a, targetTurma, undefined, turmas)
    })
    const ordenados = ordenarPorChamada(lista)
    return ordenados.map((aluno: any) => {
      const aId = String(aluno.id);
      const freqRecord = freqTurma?.find(f => String(f.aluno_id) === aId && String(f.data).startsWith(dataSel));
      return {
        ...aluno,
        horaRegistro: freqRecord?.dados?.horaRegistro || freqRecord?.horaRegistro || null
      }
    })
  }, [alunos, turmaSel, turmaObj, turmas, ordenarPorChamada, freqTurma, dataSel])
  
  const alunosFiltrados = useMemo(() => !buscaAluno ? alunosDaTurma : alunosDaTurma.filter((a: any) => a.nome.toLowerCase().includes(buscaAluno.toLowerCase())), [alunosDaTurma, buscaAluno])

  const [absences, setAbsences] = useState<Record<string, Record<string, Record<string, PresStatus>>>>({})

  useEffect(() => {
    if (freqTurma) {
      console.log('Frequências carregadas:', freqTurma.length)
      const newAbsences: Record<string, Record<string, Record<string, PresStatus>>> = {}
      const newHorariosEntrada: Record<string, Record<string, string>> = {}
      const newHorariosSaida: Record<string, Record<string, string>> = {}
      const newResponsaveisSaida: Record<string, Record<string, string>> = {}

      freqTurma.forEach(f => {
        const aId = String(f.aluno_id || f.alunoId)
        if (!newAbsences[aId]) newAbsences[aId] = {}
        const dia = String(f.data).split('T')[0]
        
        if (f.tempos) {
          newAbsences[aId][dia] = { ...f.tempos }
        } else {
          // Mapeia registros antigos/binários para todos os tempos da turma
          const overallStatus: PresStatus = f.justificativa === 'Justificada' ? 'J' : (f.presente ? 'P' : 'F')
          const schedule = getTurmaSchedule(turmaObj)
          const temposMap: Record<string, PresStatus> = {}
          schedule.tempos.forEach(t => {
            temposMap[t.id] = overallStatus
          })
          newAbsences[aId][dia] = temposMap
        }

        const hEntrada = f.dados?.horaEntrada || f.dados?.horaRegistro || f.horaRegistro
        const hSaida = f.dados?.saidaHorario || f.saidaHorario
        const rSaida = f.dados?.saidaResponsavel || f.saidaResponsavel

        if (hEntrada) {
          if (!newHorariosEntrada[aId]) newHorariosEntrada[aId] = {}
          newHorariosEntrada[aId][dia] = hEntrada
        }
        if (hSaida) {
          if (!newHorariosSaida[aId]) newHorariosSaida[aId] = {}
          newHorariosSaida[aId][dia] = formatTimeFromIso(hSaida) || hSaida
        }
        if (rSaida) {
          if (!newResponsaveisSaida[aId]) newResponsaveisSaida[aId] = {}
          newResponsaveisSaida[aId][dia] = rSaida
        }
      })
      setAbsences(newAbsences)
      setHorariosEntrada(newHorariosEntrada)
      setHorariosSaida(newHorariosSaida)
      setResponsaveisSaida(newResponsaveisSaida)
    }
  }, [freqTurma, turmaObj])

  const getStatus = useCallback((alunoId: string, dia: string, tempoId: string): PresStatus => {
    const studentDay = absences[String(alunoId)]?.[dia]
    if (studentDay && studentDay[tempoId]) {
      return studentDay[tempoId]
    }
    
    // O padrão absoluto para qualquer aluno sem registro é '-'
    return '-'
  }, [absences])

  // Salvamento automático em tempo real para cada alteração de frequência
  const autoSaveStudent = useCallback(async (
    alunoId: string,
    dia: string,
    overrideTempos?: Record<string, PresStatus>,
    overrideEntrada?: string,
    overrideSaida?: string,
    overrideRespSaida?: string
  ) => {
    const aId = String(alunoId)
    const aluno = alunos.find(a => String(a.id) === aId)
    if (!aluno) return

    const schedule = getTurmaSchedule(turmaObj)
    const studentDay = overrideTempos || absences[aId]?.[dia] || {}
    const tempos: Record<string, PresStatus> = {}
    schedule.tempos.forEach(t => {
      tempos[t.id] = studentDay[t.id] || '-'
    })

    const calc = calcularFrequenciaDia(tempos, schedule.segmento)
    const existing = freqTurma?.find(f => String(f.aluno_id) === aId && String(f.data).startsWith(dia))

    const targetId = aId.trim()
    const portariaEv = (portariaEventsList || []).find((ev: any) => {
      const evAlunoId = String(ev.aluno_id || ev.alunoId || '').trim()
      const evEquipId = String(ev.user_id_equipamento || '').trim()
      const matchesAluno = (evAlunoId && evAlunoId === targetId) || (evEquipId && evEquipId === targetId)
      if (!matchesAluno) return false
      if (ev.status && ev.status !== 'sucesso') return false
      const evDateStr = String(ev.data_hora || ev.created_at || ev.data || '').split('T')[0]
      return evDateStr === dia
    })

    let horaCatraca: string | undefined = undefined
    if (portariaEv) {
      const rawTime = portariaEv.data_hora || portariaEv.created_at || portariaEv.data
      if (rawTime) {
        try {
          const d = new Date(rawTime)
          if (!isNaN(d.getTime())) {
            const h = String(d.getUTCHours()).padStart(2, '0')
            const m = String(d.getUTCMinutes()).padStart(2, '0')
            horaCatraca = `${h}:${m}`
          }
        } catch {}
      }
    }

    const isCatraca = !!portariaEv || existing?.origem === 'catraca' || String(existing?.registradoPor || '').toLowerCase().includes('catraca')
    const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const customEntrada = overrideEntrada !== undefined ? overrideEntrada : (horariosEntrada[aId]?.[dia] || horaCatraca || existing?.horaRegistro || nowTime)
    const customSaida = overrideSaida !== undefined ? overrideSaida : (horariosSaida[aId]?.[dia] || existing?.dados?.saidaHorario || null)
    const customRespSaida = overrideRespSaida !== undefined ? overrideRespSaida : (responsaveisSaida[aId]?.[dia] || existing?.dados?.saidaResponsavel || null)

    const recordToSave = {
      id: existing?.id,
      alunoId: aluno.id,
      turmaId: turmaId,
      data: dia,
      anoLetivo: filtroAno,
      presente: calc.presente,
      justificativa: calc.justificativa,
      tempos: calc.temposEfetivos,
      registradoPor: isCatraca ? (existing?.registradoPor || 'Catraca iDFace') : 'Manual (Auto)',
      origem: isCatraca ? 'catraca' : 'manual',
      horaRegistro: customEntrada || nowTime,
      dados: {
        ...(existing?.dados || {}),
        horaEntrada: customEntrada || nowTime,
        saidaHorario: customSaida,
        saidaResponsavel: customRespSaida,
      }
    }

    try {
      await fetch('/api/academico/frequencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([recordToSave])
      })
      if (refetchFreq) refetchFreq()
      if (refetchAllFreqs) refetchAllFreqs()
    } catch (err) {
      console.error('Erro no salvamento automático de frequência:', err)
    }
  }, [alunos, turmaObj, absences, freqTurma, portariaEventsList, horariosEntrada, horariosSaida, responsaveisSaida, turmaId, filtroAno, refetchFreq, refetchAllFreqs])

  const setStatus = (alunoId: string, dia: string, tempoId: string, statusNext: PresStatus) => {
    const aId = String(alunoId)
    setAbsences(prev => {
      const studentData = prev[aId] || {}
      const dayData = studentData[dia] || {}
      const updatedDayData = {
        ...dayData,
        [tempoId]: statusNext
      }

      // Dispara salvamento automático instantâneo em tempo real no banco
      autoSaveStudent(aId, dia, updatedDayData)

      return {
        ...prev,
        [aId]: {
          ...studentData,
          [dia]: updatedDayData
        }
      }
    })
  }

  const handleConfirmarSaidaInfantil = async () => {
    if (!saidaModalData) return
    const { aluno, dia } = saidaModalData
    const quemRetirou = (customResponsavel.trim() || saidaModalResponsavel.trim()) || 'Não informado'
    const horaSaida = saidaModalHora || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const aId = String(aluno.id)

    setSalvandoSaida(true)
    try {
      // 1. Atualiza estado local de saída e responsável
      setHorariosSaida(prev => ({
        ...prev,
        [aId]: { ...(prev[aId] || {}), [dia]: horaSaida }
      }))
      setResponsaveisSaida(prev => ({
        ...prev,
        [aId]: { ...(prev[aId] || {}), [dia]: quemRetirou }
      }))

      // 2. Transmite a saída para a API /api/saida/calls (POST) que atualiza /chamadas e dispara Realtime para o Monitor TV
      const nowIso = new Date().toISOString()
      const confirmedAtIso = getLocalIsoString(dia, horaSaida)
      
      await fetch('/api/saida/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `infantil-${aId}-${dia}`,
          studentId: aId,
          studentName: aluno.nome,
          studentClass: aluno.turmaNome || turmaObj?.nome || aluno.turma || '',
          studentPhoto: aluno.foto || aluno.imagem1 || null,
          guardianId: 'manual-infantil',
          guardianName: quemRetirou,
          calledAt: nowIso,
          confirmedAt: confirmedAtIso,
          status: 'confirmed',
          source: 'manual'
        })
      })

      // 3. Salvar o registro de saída na API de frequências sem alterar os tempos nem criar entrada manual fictícia
      const existing = freqTurma?.find(f => String(f.aluno_id) === aId && String(f.data).startsWith(dia))

      const recordsToSave = [{
        id: existing?.id,
        alunoId: aluno.id,
        turmaId: turmaId,
        data: dia,
        anoLetivo: filtroAno,
        presente: existing?.presente ?? true,
        justificativa: existing?.justificativa || '',
        tempos: existing?.tempos || null,
        registradoPor: existing?.registradoPor || null,
        origem: existing?.origem || null,
        horaRegistro: existing?.horaRegistro || null,
        dados: {
          ...(existing?.dados || {}),
          saidaHorario: confirmedAtIso,
          saidaResponsavel: quemRetirou,
          saidaOrigem: 'manual',
          anoLetivo: filtroAno
        }
      }]

      await fetch('/api/academico/frequencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordsToSave)
      })

      if (refetchFreq) refetchFreq()
      if (refetchAllFreqs) refetchAllFreqs()
      if (refetchSaidaCalls) refetchSaidaCalls()

      setSaidaModalData(null)
      setCustomResponsavel('')
      setSaidaModalResponsavel('')
    } catch (err: any) {
      alert('Erro ao registrar saída: ' + (err.message || 'Erro desconhecido'))
    } finally {
      setSalvandoSaida(false)
    }
  }

  const handleCancelarSaidaInfantil = async (aluno: any, dia: string) => {
    const aId = String(aluno.id)
    
    // 1. Limpa o estado local
    setHorariosSaida(prev => {
      const copy = { ...prev }
      if (copy[aId]) delete copy[aId][dia]
      return copy
    })
    setResponsaveisSaida(prev => {
      const copy = { ...prev }
      if (copy[aId]) delete copy[aId][dia]
      return copy
    })

    // 2. Persiste a remoção da saída no banco de dados (/api/academico/frequencias)
    try {
      const existing = freqTurma?.find(f => String(f.aluno_id) === aId && String(f.data).startsWith(dia))
      const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      const currentEntrada = horariosEntrada[aId]?.[dia] || existing?.horaRegistro || nowTime

      const recordToSave = {
        id: existing?.id,
        alunoId: aluno.id,
        turmaId: turmaId,
        data: dia,
        anoLetivo: filtroAno,
        presente: true,
        justificativa: existing?.justificativa || '',
        tempos: existing?.tempos || { '1': 'P', '2': 'P', '3': 'P', '4': 'P' },
        registradoPor: existing?.registradoPor || 'Manual',
        origem: existing?.origem || 'manual',
        horaRegistro: currentEntrada,
        dados: {
          ...(existing?.dados || {}),
          saidaHorario: null,
          saidaResponsavel: null,
        }
      }

      await fetch('/api/academico/frequencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([recordToSave])
      })

      // 3. Atualiza / cancela o registro no painel de chamadas da portaria
      const nowIso = new Date().toISOString()
      await fetch('/api/saida/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `infantil-${aId}-${dia}`,
          studentId: aId,
          studentName: aluno.nome,
          studentClass: turmaObj?.nome || '',
          guardianId: 'manual-infantil',
          guardianName: 'Saída Cancelada',
          calledAt: nowIso,
          confirmedAt: null,
          status: 'cancelled',
          isRevert: true,
          source: 'manual'
        })
      })

      if (refetchFreq) refetchFreq()
      if (refetchAllFreqs) refetchAllFreqs()
      if (refetchSaidaCalls) refetchSaidaCalls()
    } catch (err: any) {
      console.error('Erro ao salvar cancelamento de saída:', err)
    }
  }

  const handleSave = async () => {
    const recordsToSave: any[] = []
    const schedule = getTurmaSchedule(turmaObj)
    
    alunosDaTurma.forEach(a => {
      diasPeriodo.forEach(dia => {
        const studentDay = absences[String(a.id)]?.[dia] || {}
        const tempos: Record<string, PresStatus> = {}
        schedule.tempos.forEach(t => {
          tempos[t.id] = studentDay[t.id] || '-'
        })
        
        // Aplicar as regras específicas do segmento
        const calc = calcularFrequenciaDia(tempos, schedule.segmento)
        
        const existing = freqTurma?.find(f => String(f.aluno_id) === String(a.id) && String(f.data).startsWith(dia))
        
        const targetId = String(a.id).trim()
        const portariaEv = (portariaEventsList || []).find((ev: any) => {
          const evAlunoId = String(ev.aluno_id || ev.alunoId || '').trim()
          const evEquipId = String(ev.user_id_equipamento || '').trim()
          const matchesAluno = (evAlunoId && evAlunoId === targetId) || (evEquipId && evEquipId === targetId)
          if (!matchesAluno) return false
          if (ev.status && ev.status !== 'sucesso') return false
          const evDateStr = String(ev.data_hora || ev.created_at || ev.data || '').split('T')[0]
          return evDateStr === dia
        })

        let horaCatraca: string | undefined = undefined
        if (portariaEv) {
          const rawTime = portariaEv.data_hora || portariaEv.created_at || portariaEv.data
          if (rawTime) {
            try {
              const d = new Date(rawTime)
              if (!isNaN(d.getTime())) {
                const h = String(d.getUTCHours()).padStart(2, '0')
                const m = String(d.getUTCMinutes()).padStart(2, '0')
                horaCatraca = `${h}:${m}`
              }
            } catch {}
          }
        }

        const isCatraca = !!portariaEv || existing?.origem === 'catraca' || String(existing?.registradoPor || '').toLowerCase().includes('catraca') || String(existing?.registradoPor || '').toLowerCase().includes('idface')
        const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        
        const customEntrada = horariosEntrada[String(a.id)]?.[dia]
        const customSaida = horariosSaida[String(a.id)]?.[dia]
        const customRespSaida = responsaveisSaida[String(a.id)]?.[dia]

        recordsToSave.push({
          id: existing?.id,
          alunoId: a.id,
          turmaId: turmaId,
          data: dia,
          anoLetivo: filtroAno,
          presente: calc.presente,
          justificativa: calc.justificativa,
          tempos: calc.temposEfetivos, // Salvamos os tempos efetivos com as regras auto-aplicadas
          registradoPor: isCatraca ? (existing?.registradoPor || 'Catraca iDFace') : 'Manual',
          origem: isCatraca ? 'catraca' : 'manual',
          horaRegistro: customEntrada || horaCatraca || existing?.horaRegistro || nowTime,
          dados: {
            ...(existing?.dados || {}),
            horaEntrada: customEntrada || horaCatraca || existing?.horaRegistro || nowTime,
            saidaHorario: customSaida || existing?.dados?.saidaHorario || null,
            saidaResponsavel: customRespSaida || existing?.dados?.saidaResponsavel || null,
          }
        })
      })
    })

    try {
      const response = await fetch('/api/academico/frequencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordsToSave)
      })

      if (response.ok) {
        setSalvo(true)
        refetchFreq()
        if (refetchAllFreqs) refetchAllFreqs()
        setTimeout(() => {
          setSalvo(false)
        }, 1500)
      } else {
        const err = await response.json()
        alert('Erro ao salvar: ' + (err.error || response.statusText))
      }
    } catch (error: any) {
      alert('Erro na requisição: ' + error.message)
    }
  }

  // Ação de salvar registros manuais do modal global
  const handleSaveManualRegistro = async () => {
    setSalvandoManual(true)
    const recordsToSave: any[] = []
    
    for (const alunoId of Object.keys(absencesManual)) {
      const aluno = alunos.find(a => String(a.id) === String(alunoId))
      if (!aluno) continue
      
      const turmaObj = turmas.find(t => String(t.id) === String(aluno.turma))
      if (!turmaObj) continue

      const schedule = getTurmaSchedule(turmaObj)
      const studentDay = absencesManual[alunoId] || {}
      
      const tempos: Record<string, PresStatus> = {}
      const existingFreq = allFreqs?.find(f => String(f.aluno_id) === String(aluno.id) && String(f.data).startsWith(registroManualData))

      schedule.tempos.forEach(t => {
        if (studentDay[t.id]) {
           tempos[t.id] = studentDay[t.id]
        } else if (existingFreq && existingFreq.tempos) {
           tempos[t.id] = existingFreq.tempos[t.id] || '-'
        } else {
           tempos[t.id] = '-'
        }
      })
      
      const calc = calcularFrequenciaDia(tempos, schedule.segmento)
      
      const targetId = String(aluno.id).trim()
      const portariaEv = (portariaEventsList || []).find((ev: any) => {
        const evAlunoId = String(ev.aluno_id || ev.alunoId || '').trim()
        const evEquipId = String(ev.user_id_equipamento || '').trim()
        const matchesAluno = (evAlunoId && evAlunoId === targetId) || (evEquipId && evEquipId === targetId)
        if (!matchesAluno) return false
        if (ev.status && ev.status !== 'sucesso') return false
        const evDateStr = String(ev.data_hora || ev.created_at || ev.data || '').split('T')[0]
        return evDateStr === registroManualData
      })

      let horaCatraca: string | undefined = undefined
      if (portariaEv) {
        const rawTime = portariaEv.data_hora || portariaEv.created_at || portariaEv.data
        if (rawTime) {
          try {
            const d = new Date(rawTime)
            if (!isNaN(d.getTime())) {
              const h = String(d.getUTCHours()).padStart(2, '0')
              const m = String(d.getUTCMinutes()).padStart(2, '0')
              horaCatraca = `${h}:${m}`
            }
          } catch {}
        }
      }

      const isCatraca = !!portariaEv || existingFreq?.origem === 'catraca' || String(existingFreq?.registradoPor || '').toLowerCase().includes('catraca') || String(existingFreq?.registradoPor || '').toLowerCase().includes('idface')
      const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

      recordsToSave.push({
        id: existingFreq?.id,
        alunoId: aluno.id,
        turmaId: turmaObj.id,
        data: registroManualData,
        anoLetivo: turmaObj.ano || filtroAno,
        presente: calc.presente,
        justificativa: calc.justificativa,
        tempos: calc.temposEfetivos,
        registradoPor: isCatraca ? (existingFreq?.registradoPor || 'Catraca iDFace') : 'Manual',
        origem: isCatraca ? 'catraca' : 'manual',
        horaRegistro: horaCatraca || existingFreq?.horaRegistro || nowTime
      })
    }

    if (recordsToSave.length === 0) {
      setSalvandoManual(false)
      setShowRegistroManualModal(false)
      return
    }

    try {
      const response = await fetch('/api/academico/frequencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordsToSave)
      })

      if (response.ok) {
        if (refetchAllFreqs) refetchAllFreqs()
        setAbsencesManual({})
        setTimeout(() => {
          setSalvandoManual(false)
          setShowRegistroManualModal(false)
        }, 500)
      } else {
        const err = await response.json()
        alert('Erro ao salvar: ' + (err.error || response.statusText))
        setSalvandoManual(false)
      }
    } catch (error: any) {
      alert('Erro na requisição: ' + error.message)
      setSalvandoManual(false)
    }
  }

  // Calc freq geral do aluno na turma (baseado em tempos)
  const calcFreqGeral = useCallback((alunoId: string) => {
    const datasAtivas = new Set<string>()
    Object.values(absences).forEach(studentDays => {
      Object.keys(studentDays).forEach(dia => datasAtivas.add(dia))
    })

    if (datasAtivas.size === 0) return null

    let totalContabilizado = 0
    let faltasContabilizadas = 0
    const schedule = getTurmaSchedule(turmaObj)
    
    datasAtivas.forEach(dia => {
      let tempos: Record<string, PresStatus> = {}
      schedule.tempos.forEach(t => {
        tempos[t.id] = getStatus(alunoId, dia, t.id)
      })
      
      const calc = calcularFrequenciaDia(tempos, schedule.segmento)
      totalContabilizado += calc.totalTemposContabilizados
      faltasContabilizadas += calc.faltasContabilizadas
    })
    
    const presencas = totalContabilizado - faltasContabilizadas
    return totalContabilizado > 0 ? Math.round((presencas / totalContabilizado) * 100) : 100
  }, [absences, turmaObj, getStatus])

  // Obter lista de alunos ausentes no dia (respeitando escopo global ou de turma)
  const getAbsenteesList = useCallback((overrideData?: string) => {
    const targetData = overrideData || dataSel
    const list: any[] = []
    
    // Obter todas as frequências correspondentes à data selecionada
    const freqsNoDia = (allFreqs || []).filter(f => String(f.data).startsWith(targetData))
    
    // Criar um mapeamento rápido de frequência por aluno
    const freqMap = new Map<string, any>()
    freqsNoDia.forEach(f => {
      freqMap.set(String(f.aluno_id), f)
    })

    // Identificar turmas que tiveram chamada lançada no dia (pelo menos um registro na tabela frequencias)
    const turmasComChamada = new Set(freqsNoDia.map(f => String(f.turma_id)))

    // Filtrar alunos baseados na seleção da turma e filtros globais
    const targetAlunos = turmaSel 
      ? alunosDaTurma 
      : alunos.filter((aluno: any) => {
          const tObj = turmas.find(t => String(t.id) === String(aluno.turma))
          if (!tObj) return false
          const matchesSegmento = !filtroSegmento || (tObj as any).dados?.segmento === filtroSegmento
          const matchesBusca = !filtroBusca || tObj.nome.toLowerCase().includes(filtroBusca.toLowerCase())
          return matchesSegmento && matchesBusca
        })

    targetAlunos.forEach((aluno: any) => {
      const tObj = turmas.find(t => String(t.id) === String(aluno.turma))
      if (!tObj) return
      
      const schedule = getTurmaSchedule(tObj)
      const freqRecord = freqMap.get(String(aluno.id))
      
      let tempos: Record<string, PresStatus> = {}
      
      if (freqRecord) {
        // Tem registro no banco para esse dia
        if (freqRecord.tempos) {
          tempos = { ...freqRecord.tempos }
        } else {
          const overallStatus: PresStatus = freqRecord.justificativa === 'Justificada' ? 'J' : (freqRecord.presente ? 'P' : 'F')
          schedule.tempos.forEach(t => {
            tempos[t.id] = overallStatus
          })
        }
      } else {
        // Não tem registro no banco para esse dia.
        const defaultStatus: PresStatus = '-'
        schedule.tempos.forEach(t => {
          tempos[t.id] = defaultStatus
        })
      }

      // Agora calcular se há faltas nos tempos efetivos
      const calc = calcularFrequenciaDia(tempos, schedule.segmento)
      
      const temposFaltosos: string[] = []
      const temposSemRegistro: string[] = []
      schedule.tempos.forEach(t => {
        if (calc.temposEfetivos[t.id] === 'F') {
          temposFaltosos.push(t.id)
        }
        if (calc.temposEfetivos[t.id] === '-') {
          temposSemRegistro.push(t.id)
        }
      })

      // Adicionamos à lista se o aluno tiver alguma Falta Efetiva OU se estiver totalmente Sem Registro
      if (temposFaltosos.length > 0 || temposSemRegistro.length > 0) {
        const totalTempos = schedule.tempos.length
        const isInfantilOuFundI = schedule.segmento === 'Educação Infantil' || schedule.segmento === 'Ensino Fundamental I'
        
        let faltasStr = ''
        const onlySemRegistro = temposSemRegistro.length > 0 && temposFaltosos.length === 0
        
        if (onlySemRegistro) {
          faltasStr = 'Sem Registro'
        } else {
          const isFaltaTotal = isInfantilOuFundI 
            ? !calc.presente 
            : temposFaltosos.length === totalTempos
          faltasStr = isFaltaTotal ? 'Falta Total' : `Parcial (${temposFaltosos.map(i => `${i}ºT`).join(', ')})`
        }

        list.push({
          id: aluno.id,
          nome: aluno.nome,
          turmaId: aluno.turma,
          turmaNome: tObj.nome,
          anoLetivo: String(tObj.ano || ''),
          turno: aluno.turno || tObj.turno || 'N/A',
          segmento: schedule.segmento,
          responsavel_telefone: aluno.responsavel_telefone || aluno.telefone || '',
          faltasStr: faltasStr,
          faltasCount: temposFaltosos.length,
          totalTempos: totalTempos,
          temposFalta: temposFaltosos,
          temposSemRegistro: temposSemRegistro,
          horaRegistro: freqRecord?.dados?.horaRegistro || freqRecord?.horaRegistro || null
        })
      }
    })

    return list
  }, [alunos, turmas, turmaSel, dataSel, filtroSegmento, filtroBusca, allFreqs, alunosDaTurma])

  // Ação de Impressão do Relatório de Faltas
  const handlePrintRelatorio = (overrideList?: any[], overrideData?: string) => {
    const list = overrideList || getAbsenteesList()
    const targetData = overrideData || dataSel
    const scopeName = turmaObj ? `Turma ${turmaObj.nome}` : 'Geral (Toda Escola)'
    
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const formattedDate = new Date(targetData + 'T00:00:00').toLocaleDateString('pt-BR')
    const rowsHtml = list.map(a => {
      const entryTime = a.horaRegistro 
        ? `Entrada: ${a.horaRegistro} (${getTempoEntrada(a.horaRegistro, a.segmento, a.turno) || ''})` 
        : 'Sem Registro'
      return `
        <tr>
          <td style="font-weight: 600;">${a.nome}</td>
          <td>${a.id}</td>
          <td>${a.turmaNome}</td>
          <td>${a.turno}</td>
          <td style="color: #dc2626; font-weight: 700;">${a.faltasStr}</td>
          <td>${entryTime}</td>
        </tr>
      `
    }).join('')

    printWindow.document.write(`
      <html>
        <head>
          <title>Relatório de Ausências - ${formattedDate}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #0f172a; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
            .logo-placeholder { font-weight: 800; font-size: 20px; color: #2563eb; }
            .title { font-size: 24px; font-weight: 800; margin: 0; }
            .meta { font-size: 14px; color: #64748b; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #e2e8f0; padding: 12px 16px; text-align: left; font-size: 13px; }
            th { background-color: #f8fafc; font-weight: 700; color: #475569; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
            .signature-row { display: flex; justify-content: space-between; margin-top: 60px; }
            .signature-box { border-top: 1px solid #cbd5e1; width: 200px; text-align: center; padding-top: 8px; font-size: 12px; color: #475569; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">Relatório de Ausências Diárias</h1>
              <div class="meta">Filtro: ${scopeName} | Data: ${formattedDate}</div>
            </div>
            <div class="logo-placeholder">EDU-IMPACTO App</div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Nome do Aluno</th>
                <th>ID</th>
                <th>Turma</th>
                <th>Turno</th>
                <th>Tempos de Falta</th>
                <th>Registro de Acesso</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 24px;">Nenhuma ausência registrada para este dia.</td></tr>'}
            </tbody>
          </table>

          <div class="signature-row">
            <div class="signature-box">Assinatura do Inspetor</div>
            <div class="signature-box">Assinatura da Direção</div>
          </div>

          <div class="footer">
            Gerado automaticamente em ${new Date().toLocaleString('pt-BR')} pelo ERP EDU-IMPACTO.
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  // Ação de Impressão da Lista de Registro Manual
  const handlePrintRegistroManual = (list: any[], data: string) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const formattedDate = new Date(data + 'T00:00:00').toLocaleDateString('pt-BR')
    
    // Agrupar por turma
    const groupedByTurma = list.reduce((acc: Record<string, any[]>, student) => {
      if (!acc[student.turmaNome]) acc[student.turmaNome] = []
      acc[student.turmaNome].push(student)
      return acc
    }, {})

    let contentHtml = ''

    Object.keys(groupedByTurma).sort().forEach(turmaNome => {
      const turmaStudents = groupedByTurma[turmaNome]
      const tObj = turmas.find(t => t.nome === turmaNome)
      const schedule = tObj ? getTurmaSchedule(tObj) : null
      
      if (!schedule) return

      contentHtml += `
        <div class="turma-section">
          <div class="turma-header">
            <h3>${turmaNome} <span class="badge">${schedule.segmento}</span></h3>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 50%;">Aluno</th>
                <th style="width: 15%;">Matrícula</th>
                ${schedule.tempos.map((t:any) => `<th style="text-align: center;">${t.id}º T</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${turmaStudents.map(a => `
                <tr>
                  <td style="font-weight: 600; font-size: 11px;">${a.nome}</td>
                  <td style="color: #64748b; font-size: 9px;">#${a.id}</td>
                  ${schedule.tempos.map(() => `<td style="text-align: center;"><div class="check-box"></div></td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `
    })

    printWindow.document.write(`
      <html>
        <head>
          <title>Lista de Verificação em Sala - ${formattedDate}</title>
          <style>
            body { font-family: 'Outfit', 'Inter', sans-serif; padding: 20px; color: #0f172a; margin: 0; background: #fff; }
            .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
            .logo-placeholder { font-weight: 900; font-size: 16px; color: #2563eb; letter-spacing: -1px; }
            .title { font-size: 18px; font-weight: 900; margin: 0; letter-spacing: -0.5px; }
            .meta { font-size: 11px; color: #64748b; margin-top: 4px; font-weight: 500; }
            
            .turma-section { margin-bottom: 12px; page-break-inside: avoid; }
            .turma-header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; background: #f8fafc; padding: 6px 10px; border-left: 4px solid #3b82f6; border-radius: 4px; }
            .turma-header h3 { margin: 0; font-size: 13px; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 8px; }
            .badge { font-size: 8px; padding: 2px 6px; background: #e2e8f0; color: #475569; border-radius: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
            
            table { width: 100%; border-collapse: collapse; }
            th, td { border-bottom: 1px solid #f1f5f9; padding: 4px 8px; text-align: left; }
            th { font-weight: 700; color: #64748b; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; background: #fafaf9; }
            tr:nth-child(even) { background-color: #f8fafc; }
            tr:last-child td { border-bottom: none; }
            .check-box { width: 12px; height: 12px; border: 1.5px solid #cbd5e1; border-radius: 2px; display: inline-block; }
            
            .instructions { background: #fef8c4; border: 1px solid #fde047; padding: 10px; border-radius: 6px; margin-bottom: 16px; font-size: 11px; color: #854d0e; display: flex; gap: 10px; align-items: center; }
            .instructions-icon { font-size: 18px; }
            
            .footer { margin-top: 20px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
            .signature-row { display: flex; justify-content: space-around; margin-top: 30px; }
            .signature-box { border-top: 1px solid #cbd5e1; width: 180px; text-align: center; padding-top: 6px; font-size: 10px; color: #475569; font-weight: 600; }
            
            @media print {
              body { padding: 0; }
              @page { margin: 0.8cm; }
              .instructions { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">Lista de Verificação em Sala</h1>
              <div class="meta">Alunos sem identificação na catraca | Data: <strong>${formattedDate}</strong></div>
            </div>
            <div class="logo-placeholder">EDU-IMPACTO</div>
          </div>
          
          <div class="instructions no-print">
            <div class="instructions-icon">📋</div>
            <div>
              <strong>Instruções de Preenchimento:</strong><br>
              Utilize esta folha para verificar a presença física dos alunos listados em sala de aula.<br>
              Assinale <strong>P</strong> (Presença), <strong>F</strong> (Falta) ou <strong>J</strong> (Justificada) nos quadrados correspondentes a cada tempo de aula.
            </div>
          </div>
          
          ${contentHtml}

          <div class="signature-row">
            <div class="signature-box">Assinatura do Inspetor / Monitor</div>
            <div class="signature-box">Assinatura da Coordenação</div>
          </div>
          
          <div class="footer">
            Gerado pelo sistema EDU-IMPACTO em ${new Date().toLocaleString('pt-BR')}
          </div>
          
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  // Ação de Exportar CSV
  const handleExportar = (overrideList?: any[], overrideData?: string) => {
    const list = overrideList || getAbsenteesList()
    const targetData = overrideData || dataSel
    const scopeName = turmaObj ? `Turma ${turmaObj.nome}` : 'Geral (Toda Escola)'
    
    const formattedDate = targetData.replace(/-/g, '')
    const headers = ['Nome', 'ID', 'Turma', 'Turno', 'Tempos com Falta', 'Horário de Entrada', 'Período de Entrada']
    const rows = list.map(a => [
      a.nome,
      a.id,
      a.turmaNome,
      a.turno,
      a.faltasStr,
      a.horaRegistro || 'Sem Registro',
      a.horaRegistro ? (getTempoEntrada(a.horaRegistro, a.segmento, a.turno) || '') : ''
    ])

    let csvContent = '\ufeff' // UTF-8 BOM para Excel em PT-BR
    csvContent += headers.join(';') + '\n'
    rows.forEach(r => {
      csvContent += r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';') + '\n'
    })

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `ausencias_${scopeName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${formattedDate}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Ação de Enviar WhatsApp Notificação
  const handleSendWhatsApp = (aluno: any) => {
    const formattedDate = new Date(dataSel + 'T00:00:00').toLocaleDateString('pt-BR')
    const msg = `Olá! Informamos que o(a) aluno(a) ${aluno.nome} não compareceu à aula no dia ${formattedDate} (${aluno.faltasStr}). Por favor, justifique a ausência. Equipe de Direção EDU-IMPACTO.`
    const phone = aluno.responsavel_telefone || aluno.telefone || ''
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '')
      window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank')
    } else {
      const confirmCopy = window.confirm(`Nenhum telefone cadastrado para o aluno ${aluno.nome}.\n\nDeseja copiar a mensagem de notificação para a área de transferência?\n\n"${msg}"`)
      if (confirmCopy) {
        navigator.clipboard.writeText(msg)
        alert('Mensagem copiada com sucesso!')
      }
    }
  }

  // Helper para gerar intervalo de datas YYYY-MM-DD
  const getDatesInRange = useCallback((startDateStr: string, endDateStr: string): string[] => {
    const dates: string[] = []
    if (!startDateStr || !endDateStr) return [startDateStr || todayStr()]
    let curr = new Date(startDateStr + 'T00:00:00')
    const end = new Date(endDateStr + 'T00:00:00')
    if (isNaN(curr.getTime()) || isNaN(end.getTime())) return [startDateStr]
    if (curr > end) {
      const temp = curr
      curr = end
    }
    while (curr <= end) {
      const yyyy = curr.getFullYear()
      const mm = String(curr.getMonth() + 1).padStart(2, '0')
      const dd = String(curr.getDate()).padStart(2, '0')
      dates.push(`${yyyy}-${mm}-${dd}`)
      curr.setDate(curr.getDate() + 1)
    }
    return dates.length > 0 ? dates : [startDateStr]
  }, [])

  // Helper para obter o dia da semana abreviado em Português
  const getWeekdayName = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00')
      const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
      return days[d.getDay()] || ''
    } catch {
      return ''
    }
  }

  // Cálculo e agregação de relatórios com datas completas
  const reportDataFiltered = useMemo(() => {
    const targetDates = relatorioTipoData === 'intervalo'
      ? getDatesInRange(relatorioDataInicio, relatorioDataFim)
      : [relatorioDataInicio]

    // Alunos filtrados por segmento, ano e turno
    let candidateStudents = alunos.filter((aluno: any) => {
      const tObj = turmas.find(t => String(t.id) === String(aluno.turma) || t.nome === aluno.turma)
      if (!tObj) return false
      
      const matchAno = !relatorioAno || relatorioAno === 'todos' || String(tObj.ano) === relatorioAno
      const matchSegmento = !relatorioSegmento || (tObj as any).dados?.segmento === relatorioSegmento
      const matchTurno = !relatorioTurno || tObj.turno === relatorioTurno
      
      return matchAno && matchSegmento && matchTurno
    })

    // Filtros por Modo
    if (relatorioModo === 'por_turma' && relatorioTurmasSel.length > 0) {
      candidateStudents = candidateStudents.filter((a: any) => 
        relatorioTurmasSel.includes(String(a.turma)) || 
        turmas.some(t => relatorioTurmasSel.includes(String(t.id)) && t.nome === a.turma)
      )
    } else if (relatorioModo === 'aluno_individual') {
      if (relatorioAlunoId) {
        candidateStudents = candidateStudents.filter((a: any) => String(a.id) === String(relatorioAlunoId))
      } else {
        // Se nenhum aluno selecionado ainda no modo individual, pega os primeiros para preview
        candidateStudents = candidateStudents.slice(0, 1)
      }
    }

    // Busca rápida por texto
    if (buscaRelatorio) {
      const term = buscaRelatorio.toLowerCase()
      candidateStudents = candidateStudents.filter((a: any) => 
        a.nome.toLowerCase().includes(term) || 
        String(a.id).toLowerCase().includes(term) ||
        String(a.turma).toLowerCase().includes(term)
      )
    }

    const result: any[] = []

    candidateStudents.forEach((aluno: any) => {
      const tObj = turmas.find(t => String(t.id) === String(aluno.turma) || t.nome === aluno.turma)
      if (!tObj) return
      
      const schedule = getTurmaSchedule(tObj)
      let totalContabilizados = 0
      let faltasContabilizadas = 0
      let justificadasContabilizadas = 0
      let presencasContabilizadas = 0
      let totalFaltasTotais = 0
      let totalFaltasParciais = 0
      let totalSemRegistro = 0

      let diasPresentes = 0
      let diasFaltantes = 0
      let diasJustificados = 0
      let diasComChamada = 0

      const dailyBreakdown: any[] = []

      targetDates.forEach(dia => {
        const freqRecord = combinedFreqs.find(f => 
          String(f.aluno_id || f.alunoId) === String(aluno.id) && isSameDay(f.data, dia)
        )

        let tempos: Record<string, PresStatus> = {}
        const dayOfWeek = new Date(dia + 'T00:00:00').getDay()
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
        const isRealRecordedDay = !!freqRecord

        if (freqRecord) {
          diasComChamada++
          if (freqRecord.tempos) {
            tempos = { ...freqRecord.tempos }
          } else {
            const overallStatus: PresStatus = freqRecord.justificativa === 'Justificada' ? 'J' : (freqRecord.presente ? 'P' : 'F')
            schedule.tempos.forEach(t => tempos[t.id] = overallStatus)
          }
        } else {
          schedule.tempos.forEach(t => tempos[t.id] = '-')
        }

        const calc = calcularFrequenciaDia(tempos, schedule.segmento)
        
        const temposFaltosos: string[] = []
        const temposSemReg: string[] = []
        schedule.tempos.forEach(t => {
          if (calc.temposEfetivos[t.id] === 'F') temposFaltosos.push(t.id)
          if (calc.temposEfetivos[t.id] === '-') temposSemReg.push(t.id)
        })

        const isInfantilOuFundI = schedule.segmento === 'Educação Infantil' || schedule.segmento === 'Ensino Fundamental I'
        let faltasStr = 'Presente'

        if (freqRecord) {
          if (calc.justificativa === 'Justificada') {
            faltasStr = 'Ausência Justificada'
            justificadasContabilizadas += calc.justificadasContabilizadas
            diasJustificados++
          } else if (temposFaltosos.length > 0) {
            const isFaltaTotal = isInfantilOuFundI ? !calc.presente : temposFaltosos.length === schedule.tempos.length
            if (isFaltaTotal) {
              faltasStr = 'Falta Total'
              totalFaltasTotais++
            } else {
              faltasStr = `Falta Parcial (${temposFaltosos.map(i => `${i}ºT`).join(', ')})`
              totalFaltasParciais++
            }
            faltasContabilizadas += calc.faltasContabilizadas
            diasFaltantes++
          } else {
            faltasStr = 'Presente'
            diasPresentes++
          }

          totalContabilizados += calc.totalTemposContabilizados
          presencasContabilizadas += (calc.totalTemposContabilizados - calc.faltasContabilizadas)
        } else {
          totalSemRegistro++
          if (isWeekend) {
            faltasStr = 'Final de Semana'
          } else {
            faltasStr = 'Sem Registro'
          }
        }

        const [y, m, d] = dia.split('-')
        const dataFormatada = `${d}/${m}/${y}`
        const diaSemana = getWeekdayName(dia)
        
        let rawHora = freqRecord?.dados?.horaRegistro || 
                      freqRecord?.horaRegistro || 
                      freqRecord?.dados?.horaCatraca || 
                      freqRecord?.horaCatraca || 
                      freqRecord?.hora || 
                      freqRecord?.dados?.hora || 
                      null

        if (!rawHora && portariaEventsList.length > 0) {
          const ev = portariaEventsList.find((e: any) => 
            String(e.aluno_id || e.alunoId || e.user_id_equipamento || '') === String(aluno.id) &&
            isSameDay(e.data_hora || e.created_at || e.data, dia)
          )
          if (ev) {
            rawHora = ev.data_hora || ev.created_at || ev.data
          }
        }

        const horaRegistro = formatHoraCatraca(rawHora)

        dailyBreakdown.push({
          data: dia,
          dataFormatada: `${dataFormatada} (${diaSemana})`,
          presente: isRealRecordedDay ? calc.presente : false,
          justificativa: calc.justificativa,
          temposEfetivos: calc.temposEfetivos,
          faltasStr,
          temposFaltosos,
          temposSemReg,
          horaRegistro,
          temRegistro: isRealRecordedDay
        })
      })

      const hasChamadas = diasComChamada > 0 && totalContabilizados > 0
      const pctFrequencia = hasChamadas
        ? Math.round((presencasContabilizadas / totalContabilizados) * 100) 
        : null

      const isCritico = pctFrequencia !== null && pctFrequencia < freqMinima
      const hasFaltasInPeriod = (totalFaltasTotais + totalFaltasParciais) > 0

      // Filtro de Status
      if (relatorioStatus === 'faltantes' && !hasFaltasInPeriod) return
      if (relatorioStatus === 'presentes' && hasFaltasInPeriod) return
      if (relatorioStatus === 'justificados' && justificadasContabilizadas === 0) return

      result.push({
        id: aluno.id,
        nome: aluno.nome,
        turmaId: aluno.turma,
        turmaNome: tObj.nome,
        anoLetivo: String(tObj.ano || ''),
        turno: aluno.turno || tObj.turno || 'N/A',
        segmento: schedule.segmento,
        responsavel_telefone: aluno.responsavel_telefone || aluno.telefone || '',
        pctFrequencia,
        hasChamadas,
        diasComChamada,
        diasPresentes,
        diasFaltantes,
        diasJustificados,
        totalContabilizados,
        presencasContabilizadas,
        faltasContabilizadas,
        justificadasContabilizadas,
        totalFaltasTotais,
        totalFaltasParciais,
        totalSemRegistro,
        isCritico,
        dailyBreakdown
      })
    })

    // Ordenação dinâmica
    result.sort((a, b) => {
      if (relatorioOrdenacao === 'nome_desc') {
        return b.nome.localeCompare(a.nome, 'pt-BR')
      }
      if (relatorioOrdenacao === 'turma_asc') {
        const compTurma = a.turmaNome.localeCompare(b.turmaNome, 'pt-BR')
        return compTurma !== 0 ? compTurma : a.nome.localeCompare(b.nome, 'pt-BR')
      }
      if (relatorioOrdenacao === 'frequencia_asc') {
        const compFreq = a.pctFrequencia - b.pctFrequencia
        return compFreq !== 0 ? compFreq : a.nome.localeCompare(b.nome, 'pt-BR')
      }
      if (relatorioOrdenacao === 'frequencia_desc') {
        const compFreq = b.pctFrequencia - a.pctFrequencia
        return compFreq !== 0 ? compFreq : a.nome.localeCompare(b.nome, 'pt-BR')
      }
      if (relatorioOrdenacao === 'faltas_desc') {
        const totalFaltasA = a.totalFaltasTotais + a.totalFaltasParciais
        const totalFaltasB = b.totalFaltasTotais + b.totalFaltasParciais
        const compFaltas = totalFaltasB - totalFaltasA
        return compFaltas !== 0 ? compFaltas : a.nome.localeCompare(b.nome, 'pt-BR')
      }
      if (relatorioOrdenacao === 'id_asc') {
        return String(a.id).localeCompare(String(b.id), 'pt-BR', { numeric: true })
      }
      return a.nome.localeCompare(b.nome, 'pt-BR')
    })

    return result
  }, [
    alunos, turmas, combinedFreqs, portariaEventsList, relatorioTipoData, relatorioDataInicio, relatorioDataFim,
    relatorioAno, relatorioSegmento, relatorioTurno, relatorioStatus, relatorioModo,
    relatorioTurmasSel, relatorioAlunoId, buscaRelatorio, relatorioOrdenacao, freqMinima, getDatesInRange, isSameDay
  ])

  // Estatísticas calculadas do relatório ativo
  const reportStats = useMemo(() => {
    const totalAlunos = reportDataFiltered.length
    if (totalAlunos === 0) return { totalAlunos: 0, mediaPresenca: null, totalFaltas: 0, totalJustificadas: 0, totalTemposFalta: 0 }

    const alunosComChamada = reportDataFiltered.filter(a => a.hasChamadas)
    const somaPct = alunosComChamada.reduce((acc, a) => acc + (a.pctFrequencia || 0), 0)
    const mediaPresenca = alunosComChamada.length > 0 ? Math.round(somaPct / alunosComChamada.length) : null
    const totalFaltas = reportDataFiltered.reduce((acc, a) => acc + (a.totalFaltasTotais + a.totalFaltasParciais), 0)
    const totalTemposFalta = reportDataFiltered.reduce((acc, a) => acc + a.faltasContabilizadas, 0)
    const totalJustificadas = reportDataFiltered.reduce((acc, a) => acc + a.justificadasContabilizadas, 0)

    return { totalAlunos, mediaPresenca, totalFaltas, totalJustificadas, totalTemposFalta }
  }, [reportDataFiltered])

  // Impressão Avançada (PDF) com histórico de datas completas
  const handlePrintRelatorioAvancado = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    const periodoText = relatorioTipoData === 'intervalo'
      ? `Período: ${new Date(relatorioDataInicio + 'T00:00:00').toLocaleDateString('pt-BR')} até ${new Date(relatorioDataFim + 'T00:00:00').toLocaleDateString('pt-BR')}`
      : `Data: ${new Date(relatorioDataInicio + 'T00:00:00').toLocaleDateString('pt-BR')}`

    const tituloModo = relatorioModo === 'aluno_individual'
      ? 'FICHA INDIVIDUAL DE ASSIDUIDADE E FREQUÊNCIA DO ALUNO'
      : 'RELATÓRIO DE FREQUÊNCIA POR TURMA(S)'

    let contentHtml = ''

    if (relatorioModo === 'aluno_individual' && reportDataFiltered.length > 0) {
      const a = reportDataFiltered[0]
      contentHtml = `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
          <div style="font-size: 16px; font-weight: 900; color: #0f172a;">${a.nome}</div>
          <div style="font-size: 12px; color: #475569; margin-top: 4px;">
            <strong>Matrícula:</strong> #${a.id} &nbsp;|&nbsp;
            <strong>Turma:</strong> ${a.turmaNome} &nbsp;|&nbsp;
            <strong>Segmento:</strong> ${a.segmento} &nbsp;|&nbsp;
            <strong>Turno:</strong> ${a.turno}
          </div>
          <div style="margin-top: 8px; font-size: 12px; font-weight: 800; color: #1e293b; background: #fff; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
            <strong>Frequência Acumulada:</strong> ${a.pctFrequencia !== null ? `${a.pctFrequencia}%` : 'Sem chamadas no período'} &nbsp;|&nbsp;
            <span style="color: #15803d;">✓ ${a.diasPresentes} Dias Presentes</span> &nbsp;|&nbsp;
            <span style="color: #b91c1c;">✕ ${a.diasFaltantes} Dias com Falta</span> &nbsp;|&nbsp;
            <span style="color: #b45309;">⏱ ${a.faltasContabilizadas} Tempos de Falta</span>
          </div>
        </div>

        <h3 style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 24px; text-transform: uppercase;">Histórico Completo por Data no Período:</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 140px;">Data</th>
              <th style="width: 140px;">Status no Dia</th>
              <th>Detalhamento dos Tempos de Aula</th>
              <th style="width: 130px; text-align: center;">Horário Entrada</th>
            </tr>
          </thead>
          <tbody>
            ${a.dailyBreakdown.map((d: any) => `
              <tr>
                <td style="font-weight: 700;">${d.dataFormatada}</td>
                <td>
                  <span style="font-weight: 800; color: ${
                    d.faltasStr.includes('Falta Total') ? '#dc2626' :
                    d.faltasStr.includes('Parcial') ? '#d97706' :
                    d.faltasStr.includes('Justificada') ? '#b45309' :
                    d.faltasStr.includes('Sem Registro') ? '#64748b' : '#16a34a'
                  };">
                    ${d.faltasStr}
                  </span>
                </td>
                <td>
                  ${Object.entries(d.temposEfetivos).map(([tId, status]) => `
                    <span style="display: inline-block; padding: 2px 6px; font-size: 10px; font-weight: 800; border-radius: 4px; margin-right: 4px; background: ${
                      status === 'P' ? '#dcfce7; color: #15803d;' :
                      status === 'F' ? '#fee2e2; color: #b91c1c;' :
                      status === 'J' ? '#fef3c7; color: #b45309;' : '#f1f5f9; color: #64748b;'
                    }">
                      ${tId}ºT: ${status}
                    </span>
                  `).join('')}
                </td>
                <td style="text-align: center; font-size: 11px; font-weight: 700; color: #475569;">
                  ${d.horaRegistro ? d.horaRegistro : '—'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `
    } else {
      contentHtml = `
        <table>
          <thead>
            <tr>
              <th>Matrícula</th>
              <th>Nome do Aluno</th>
              <th>Turma</th>
              <th>Frequência</th>
              <th>Dias Presentes</th>
              <th>Dias c/ Falta</th>
              <th>Tempos Falta</th>
              <th>Telefone Responsável</th>
            </tr>
          </thead>
          <tbody>
            ${reportDataFiltered.map((a: any) => `
              <tr>
                <td>#${a.id}</td>
                <td style="font-weight: 700;">${a.nome}</td>
                <td>${a.turmaNome}</td>
                <td style="font-weight: 800; color: ${a.pctFrequencia === null ? '#64748b' : (a.pctFrequencia < 75 ? '#dc2626' : '#16a34a')};">
                  ${a.pctFrequencia !== null ? `${a.pctFrequencia}%` : 'Sem Registro'}
                </td>
                <td style="color: #15803d; font-weight: 700;">${a.diasPresentes}</td>
                <td style="color: ${a.diasFaltantes > 0 ? '#dc2626' : '#64748b'}; font-weight: 700;">${a.diasFaltantes}</td>
                <td style="color: ${a.faltasContabilizadas > 0 ? '#b45309' : '#64748b'}; font-weight: 700;">${a.faltasContabilizadas}</td>
                <td>${a.responsavel_telefone || '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${tituloModo}</title>
          <style>
            body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #0f172a; padding: 20px; font-size: 12px; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
            .title { font-size: 16px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: -0.3px; }
            .meta { font-size: 11px; color: #64748b; margin-top: 4px; }
            .logo { font-size: 16px; font-weight: 900; color: #2563eb; }
            .sublogo { font-size: 10px; font-weight: 700; color: #64748b; }
            
            .stats-bar { display: flex; gap: 12px; margin-bottom: 16px; background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; }
            .stat-card { flex: 1; text-align: center; }
            .stat-val { font-size: 16px; font-weight: 900; }
            .stat-lbl { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; }

            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #f1f5f9; padding: 8px 10px; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #475569; border: 1px solid #e2e8f0; text-align: left; }
            td { padding: 8px 10px; border: 1px solid #e2e8f0; font-size: 11px; }

            .signature-row { display: flex; justify-content: space-between; margin-top: 40px; gap: 20px; page-break-inside: avoid; }
            .signature-box { flex: 1; border-top: 1px solid #94a3b8; text-align: center; padding-top: 6px; font-size: 10px; color: #475569; font-weight: 600; }
            .footer { margin-top: 30px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }

            @media print {
              body { padding: 0; }
              @page { margin: 1cm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">${tituloModo}</h1>
              <div class="meta">${periodoText} | Gerado em ${new Date().toLocaleString('pt-BR')}</div>
            </div>
            <div style="text-align: right;">
              <div class="logo">COLÉGIO IMPACTO</div>
              <div class="sublogo">SISTEMA EDU-IMPACTO</div>
            </div>
          </div>

          <div class="stats-bar">
            <div class="stat-card">
              <div class="stat-val">${reportStats.totalAlunos}</div>
              <div class="stat-lbl">Alunos no Escopo</div>
            </div>
            <div class="stat-card">
              <div class="stat-val" style="color: ${reportStats.mediaPresenca === null ? '#64748b' : (reportStats.mediaPresenca < 75 ? '#dc2626' : '#16a34a')};">
                ${reportStats.mediaPresenca !== null ? `${reportStats.mediaPresenca}%` : 'Sem Registros'}
              </div>
              <div class="stat-lbl">Presença Média</div>
            </div>
            <div class="stat-card">
              <div class="stat-val" style="color: #dc2626;">${reportStats.totalFaltas} dias (${reportStats.totalTemposFalta} tempos)</div>
              <div class="stat-lbl">Total Faltas</div>
            </div>
            <div class="stat-card">
              <div class="stat-val" style="color: #d97706;">${reportStats.totalJustificadas}</div>
              <div class="stat-lbl">Justificadas</div>
            </div>
          </div>

          ${contentHtml || '<div style="text-align: center; padding: 24px; color: #64748b;">Nenhum registro encontrado.</div>'}

          <div class="signature-row">
            <div class="signature-box">Responsável do Aluno</div>
            <div class="signature-box">Coordenação Pedagógica</div>
            <div class="signature-box">Direção Geral</div>
          </div>

          <div class="footer">
            Documento emitido digitalmente pelo ERP EDU-IMPACTO.
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  // Exportação Excel / CSV Avançada com Datas Completas
  const handleExportCSVAvancado = () => {
    const headers = ['Matrícula', 'Nome do Aluno', 'Turma', 'Segmento', 'Turno', 'Data', 'Dia da Semana', 'Status no Dia', 'Tempos de Aula', 'Horário Catraca', 'Dias Presentes', 'Dias com Falta', 'Tempos de Falta', 'Frequência Acumulada (%)', 'Telefone Responsável']
    
    const rows: any[] = []

    reportDataFiltered.forEach(a => {
      a.dailyBreakdown.forEach((d: any) => {
        const temposStr = Object.entries(d.temposEfetivos).map(([tId, st]) => `${tId}ºT:${st}`).join(' ')
        rows.push([
          a.id,
          a.nome,
          a.turmaNome,
          a.segmento,
          a.turno,
          d.data,
          getWeekdayName(d.data),
          d.faltasStr,
          temposStr,
          d.horaRegistro || 'Sem Registro',
          a.diasPresentes,
          a.diasFaltantes,
          a.faltasContabilizadas,
          a.pctFrequencia !== null ? `${a.pctFrequencia}%` : 'Sem Chamadas',
          a.responsavel_telefone || 'Não informado'
        ])
      })
    })

    let csvContent = '\ufeff' // UTF-8 BOM para Excel em PT-BR
    csvContent += headers.join(';') + '\n'
    rows.forEach(r => {
      csvContent += r.map((val: any) => `"${String(val).replace(/"/g, '""')}"`).join(';') + '\n'
    })

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `relatorio_frequencia_${relatorioModo}_${relatorioDataInicio}_completo.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Render do Modal de Relatórios Avançados (Foco: Por Turma e Aluno Individual)
  const renderRelatorioModal = () => {
    if (!showRelatorioModal) return null

    let alunosParaBuscaIndividual = alunos.filter((aluno: any) => {
      const tObj = turmas.find(t => String(t.id) === String(aluno.turma) || t.nome === aluno.turma)
      if (relatorioAno && tObj && String(tObj.ano) !== relatorioAno) return false
      if (relatorioTurmaFiltroIndividual) {
        const isMatchId = String(aluno.turma) === String(relatorioTurmaFiltroIndividual)
        const isMatchNome = tObj && String(tObj.id) === String(relatorioTurmaFiltroIndividual)
        if (!isMatchId && !isMatchNome) return false
      }
      return true
    })

    if (buscaAlunoRelatorio) {
      const term = buscaAlunoRelatorio.toLowerCase()
      alunosParaBuscaIndividual = alunosParaBuscaIndividual.filter((a: any) =>
        a.nome.toLowerCase().includes(term) ||
        String(a.id).toLowerCase().includes(term)
      )
    }

    const alunoSelObj = relatorioAlunoId ? alunos.find((a: any) => String(a.id) === String(relatorioAlunoId)) : null

    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)',
        zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        <div style={{
          background: '#fff', borderRadius: '20px', maxWidth: '1180px', width: '100%', maxHeight: '95vh',
          display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)', overflow: 'hidden'
        }}>
          {/* Header Superior do Modal */}
          <div style={{
            padding: '14px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: 'rgba(37, 99, 235, 0.2)', color: '#60a5fa', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(96, 165, 250, 0.3)' }}>
                <FileText size={18} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontFamily: 'Outfit, sans-serif', fontSize: '18px', fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>
                  Central de Relatórios de Frequência
                </h2>
                <p style={{ margin: '1px 0 0 0', fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>
                  Relatórios detalhados com histórico completo de datas por turma e aluno individual
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowRelatorioModal(false)
                setBuscaRelatorio('')
              }}
              style={{ background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', color: '#cbd5e1', transition: 'all 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            >
              <X size={18} />
            </button>
          </div>

          {/* Abas dos 2 Modos: Por Turma(s) vs Aluno Individual */}
          <div style={{ padding: '8px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setRelatorioModo('por_turma')}
              style={{
                padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s',
                background: relatorioModo === 'por_turma' ? '#2563eb' : '#fff',
                color: relatorioModo === 'por_turma' ? '#fff' : '#64748b',
                boxShadow: relatorioModo === 'por_turma' ? '0 4px 12px rgba(37, 99, 235, 0.25)' : '0 1px 3px rgba(0,0,0,0.05)',
                border: relatorioModo === 'por_turma' ? 'none' : '1px solid #e2e8f0'
              }}
            >
              <BookOpen size={15} />
              <span>Relatório por Turma(s)</span>
            </button>

            <button
              onClick={() => setRelatorioModo('aluno_individual')}
              style={{
                padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s',
                background: relatorioModo === 'aluno_individual' ? '#2563eb' : '#fff',
                color: relatorioModo === 'aluno_individual' ? '#fff' : '#64748b',
                boxShadow: relatorioModo === 'aluno_individual' ? '0 4px 12px rgba(37, 99, 235, 0.25)' : '0 1px 3px rgba(0,0,0,0.05)',
                border: relatorioModo === 'aluno_individual' ? 'none' : '1px solid #e2e8f0'
              }}
            >
              <User size={15} />
              <span>Relatório Individual do Aluno</span>
            </button>
          </div>

          {/* Painel de Filtros e Seleção (Design Enxuto) */}
          <div style={{ padding: '12px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '10px', background: '#fff' }}>
            
            {/* Linha 1: Mês, Ano Letivo, Período e Intervalo de Datas */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              
              {/* Seleção do Mês */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '9px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Mês</span>
                <select
                  className="form-input"
                  style={{ width: '125px', height: '32px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 700, color: '#0f172a' }}
                  value={relatorioMes}
                  onChange={e => {
                    const m = e.target.value
                    setRelatorioMes(m)
                    if (m) {
                      setRelatorioTipoData('intervalo')
                      const yr = relatorioAno || new Date().getFullYear().toString()
                      const lastDay = new Date(parseInt(yr, 10), parseInt(m, 10), 0).getDate()
                      setRelatorioDataInicio(`${yr}-${m}-01`)
                      setRelatorioDataFim(`${yr}-${m}-${String(lastDay).padStart(2, '0')}`)
                    }
                  }}
                >
                  <option value="">Selecione Mês</option>
                  {MESES_ANO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>

              {/* Seleção do Ano Letivo */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '9px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Ano</span>
                <select
                  className="form-input"
                  style={{ width: '95px', height: '32px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 700, color: '#0f172a' }}
                  value={relatorioAno}
                  onChange={e => {
                    const a = e.target.value
                    setRelatorioAno(a)
                    if (relatorioMes && a) {
                      const lastDay = new Date(parseInt(a, 10), parseInt(relatorioMes, 10), 0).getDate()
                      setRelatorioDataInicio(`${a}-${relatorioMes}-01`)
                      setRelatorioDataFim(`${a}-${relatorioMes}-${String(lastDay).padStart(2, '0')}`)
                    }
                  }}
                >
                  <option value="">Ano</option>
                  {anosDisponiveis.map(ano => <option key={ano} value={ano}>{ano}</option>)}
                </select>
              </div>

              {/* Tipo de Período */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '9px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Modo Datas</span>
                <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '6px', padding: '2px', border: '1px solid #e2e8f0', height: '32px', alignItems: 'center' }}>
                  <button
                    onClick={() => {
                      setRelatorioTipoData('especifica')
                      setRelatorioMes('')
                    }}
                    style={{
                      padding: '3px 8px', fontSize: '11px', fontWeight: 700, borderRadius: '4px', border: 'none', cursor: 'pointer',
                      background: relatorioTipoData === 'especifica' ? '#fff' : 'transparent',
                      color: relatorioTipoData === 'especifica' ? '#0f172a' : '#64748b',
                      boxShadow: relatorioTipoData === 'especifica' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
                    }}
                  >
                    Específica
                  </button>
                  <button
                    onClick={() => setRelatorioTipoData('intervalo')}
                    style={{
                      padding: '3px 8px', fontSize: '11px', fontWeight: 700, borderRadius: '4px', border: 'none', cursor: 'pointer',
                      background: relatorioTipoData === 'intervalo' ? '#fff' : 'transparent',
                      color: relatorioTipoData === 'intervalo' ? '#0f172a' : '#64748b',
                      boxShadow: relatorioTipoData === 'intervalo' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
                    }}
                  >
                    Intervalo
                  </button>
                </div>
              </div>

              {/* Inputs de Data */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '9px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Período</span>
                {relatorioTipoData === 'especifica' ? (
                  <input
                    type="date"
                    className="form-input"
                    style={{ width: '130px', height: '32px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 600 }}
                    value={relatorioDataInicio}
                    onChange={e => {
                      setRelatorioDataInicio(e.target.value)
                      setRelatorioDataFim(e.target.value)
                    }}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>De:</span>
                    <input
                      type="date"
                      className="form-input"
                      style={{ width: '125px', height: '32px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '11px', fontWeight: 600 }}
                      value={relatorioDataInicio}
                      onChange={e => {
                        setRelatorioDataInicio(e.target.value)
                        setRelatorioMes('')
                      }}
                    />
                    <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Até:</span>
                    <input
                      type="date"
                      className="form-input"
                      style={{ width: '125px', height: '32px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '11px', fontWeight: 600 }}
                      value={relatorioDataFim}
                      onChange={e => {
                        setRelatorioDataFim(e.target.value)
                        setRelatorioMes('')
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Atalhos Rápidos */}
              <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto', alignSelf: 'flex-end' }}>
                <button
                  onClick={() => {
                    setRelatorioTipoData('especifica')
                    setRelatorioMes('')
                    setRelatorioDataInicio(todayStr())
                    setRelatorioDataFim(todayStr())
                  }}
                  style={{ fontSize: '11px', fontWeight: 700, padding: '4px 8px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '5px', cursor: 'pointer', color: '#475569' }}
                >
                  Hoje
                </button>
                <button
                  onClick={() => {
                    setRelatorioTipoData('intervalo')
                    const now = new Date()
                    const m = String(now.getMonth() + 1).padStart(2, '0')
                    setRelatorioMes(m)
                    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
                    setRelatorioDataInicio(`${firstDay.getFullYear()}-${m}-01`)
                    setRelatorioDataFim(todayStr())
                  }}
                  style={{ fontSize: '11px', fontWeight: 700, padding: '4px 8px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '5px', cursor: 'pointer', color: '#475569' }}
                >
                  Este Mês
                </button>
                <button
                  onClick={() => {
                    setRelatorioTipoData('intervalo')
                    setRelatorioMes('')
                    const now = new Date()
                    const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
                    setRelatorioDataInicio(`${past.getFullYear()}-${String(past.getMonth()+1).padStart(2,'0')}-${String(past.getDate()).padStart(2,'0')}`)
                    setRelatorioDataFim(todayStr())
                  }}
                  style={{ fontSize: '11px', fontWeight: 700, padding: '4px 8px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '5px', cursor: 'pointer', color: '#475569' }}
                >
                  Últimos 30 dias
                </button>
              </div>
            </div>

            {/* Controles do Modo: Relatório por Turma(s) */}
            {relatorioModo === 'por_turma' && (
              <>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    className="form-input"
                    style={{ width: '200px', height: '32px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 700, color: '#0f172a' }}
                    value=""
                    onChange={e => {
                      const val = e.target.value
                      if (val === 'ALL') {
                        setRelatorioTurmasSel(turmas.map(t => String(t.id)))
                      } else if (val === 'NONE') {
                        setRelatorioTurmasSel([])
                      } else if (val) {
                        setRelatorioTurmasSel(prev => prev.includes(val) ? prev.filter(id => id !== val) : [...prev, val])
                      }
                    }}
                  >
                    <option value="">-- Selecionar Turma --</option>
                    <option value="ALL">✅ Selecionar Todas</option>
                    <option value="NONE">❌ Desmarcar Todas</option>
                    {turmas.filter(t => !relatorioAno || String(t.ano) === relatorioAno).map(t => {
                      const isSel = relatorioTurmasSel.includes(String(t.id))
                      return (
                        <option key={t.id} value={String(t.id)}>
                          {isSel ? '✓ ' : ''}{t.nome} ({t.turno})
                        </option>
                      )
                    })}
                  </select>

                  <select
                    className="form-input"
                    style={{ width: '150px', height: '32px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 600 }}
                    value={relatorioSegmento}
                    onChange={e => setRelatorioSegmento(e.target.value)}
                  >
                    <option value="">Todos Segmentos</option>
                    {cfgNiveisEnsino?.map((n: any) => (
                      <option key={n.id} value={n.nome}>{n.nome}</option>
                    ))}
                  </select>

                  <select
                    className="form-input"
                    style={{ width: '120px', height: '32px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 600 }}
                    value={relatorioTurno}
                    onChange={e => setRelatorioTurno(e.target.value)}
                  >
                    <option value="">Todos Turnos</option>
                    <option value="Matutino">Matutino</option>
                    <option value="Vespertino">Vespertino</option>
                    <option value="Noturno">Noturno</option>
                    <option value="Integral">Integral</option>
                  </select>

                  <select
                    className="form-input"
                    style={{ width: '130px', height: '32px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 600 }}
                    value={relatorioStatus}
                    onChange={e => setRelatorioStatus(e.target.value)}
                  >
                    <option value="">Todos os Status</option>
                    <option value="faltantes">Apenas Faltantes</option>
                    <option value="presentes">Apenas Presentes</option>
                    <option value="justificados">Ausências Justificadas</option>
                  </select>

                  <select
                    className="form-input"
                    style={{ width: '160px', height: '32px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '11px', fontWeight: 700, color: '#1e293b' }}
                    value={relatorioOrdenacao}
                    onChange={e => setRelatorioOrdenacao(e.target.value as any)}
                  >
                    <option value="nome_asc">Ordenar: Nome (A - Z)</option>
                    <option value="nome_desc">Ordenar: Nome (Z - A)</option>
                    <option value="turma_asc">Ordenar: Turma (A - Z)</option>
                    <option value="frequencia_asc">Ordenar: % Frequência (Menor)</option>
                    <option value="frequencia_desc">Ordenar: % Frequência (Maior)</option>
                    <option value="faltas_desc">Ordenar: Mais Faltas</option>
                    <option value="id_asc">Ordenar: Matrícula / ID</option>
                  </select>

                  <div style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
                    <Search size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      className="form-input"
                      style={{ paddingLeft: '28px', height: '32px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '11px', width: '100%' }}
                      placeholder="Filtrar aluno ou turma..."
                      value={buscaRelatorio}
                      onChange={e => setBuscaRelatorio(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#334155' }}>Turmas Selecionadas ({relatorioTurmasSel.length === 0 ? 'Todas' : relatorioTurmasSel.length}):</span>
                  <button
                    onClick={() => {
                      if (relatorioTurmasSel.length === turmas.length) {
                        setRelatorioTurmasSel([])
                      } else {
                        setRelatorioTurmasSel(turmas.map(t => String(t.id)))
                      }
                    }}
                    style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    {relatorioTurmasSel.length === turmas.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                  </button>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxHeight: '50px', overflowY: 'auto', flex: 1 }}>
                    {turmas.filter(t => !relatorioAno || String(t.ano) === relatorioAno).map(t => {
                      const isSelected = relatorioTurmasSel.includes(String(t.id))
                      return (
                        <button
                          key={t.id}
                          onClick={() => {
                            const tIdStr = String(t.id)
                            if (isSelected) {
                              setRelatorioTurmasSel(prev => prev.filter(id => id !== tIdStr))
                            } else {
                              setRelatorioTurmasSel(prev => [...prev, tIdStr])
                            }
                          }}
                          style={{
                            fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', cursor: 'pointer',
                            background: isSelected ? '#2563eb' : '#fff',
                            color: isSelected ? '#fff' : '#475569',
                            border: isSelected ? '1px solid #1d4ed8' : '1px solid #cbd5e1'
                          }}
                        >
                          {t.nome}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Controles do Modo: Relatório Individual do Aluno (Design 100% Focado no Aluno e Enxuto) */}
            {relatorioModo === 'aluno_individual' && (
              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: '240px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Buscar por Nome/Matrícula</span>
                  <div style={{ position: 'relative' }}>
                    <Search size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      className="form-input"
                      style={{ paddingLeft: '28px', height: '32px', borderRadius: '6px', background: '#fff', border: '1px solid #cbd5e1', fontSize: '11px', width: '100%' }}
                      placeholder="Nome ou matrícula..."
                      value={buscaAlunoRelatorio}
                      onChange={e => setBuscaAlunoRelatorio(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: '260px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Selecionar Aluno ({alunosParaBuscaIndividual.length})</span>
                  <select
                    className="form-input"
                    style={{ width: '100%', height: '32px', borderRadius: '6px', background: '#fff', border: '1px solid #7dd3fc', fontSize: '12px', fontWeight: 700, color: '#0f172a' }}
                    value={relatorioAlunoId}
                    onChange={e => setRelatorioAlunoId(e.target.value)}
                  >
                    <option value="">-- Selecione o Aluno para a Ficha Individual --</option>
                    {alunosParaBuscaIndividual.slice(0, 300).map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {a.nome} (Matrícula: #{a.id} - Turma: {a.turma})
                      </option>
                    ))}
                  </select>
                </div>

                {alunoSelObj && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', padding: '4px 10px', borderRadius: '6px', border: '1px solid #7dd3fc', alignSelf: 'flex-end', height: '32px' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800 }}>
                      {getInitials(alunoSelObj.nome)}
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#0369a1', lineHeight: '1.2' }}>{alunoSelObj.nome}</div>
                      <div style={{ fontSize: '9px', color: '#64748b', lineHeight: '1' }}>#{alunoSelObj.id} • {alunoSelObj.turma}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Área de Resumo & Conteúdo do Relatório */}
          <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
            
            {/* Cards de Métricas Gerais do Período */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '14px' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: '#e0f2fe', color: '#0369a1', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Alunos no Escopo</div>
                  <div style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>{reportStats.totalAlunos}</div>
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: '#dcfce7', color: '#15803d', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Frequência Média</div>
                  <div style={{ fontSize: '15px', fontWeight: 900, color: reportStats.mediaPresenca === null ? '#64748b' : (reportStats.mediaPresenca < 75 ? '#dc2626' : '#16a34a') }}>
                    {reportStats.mediaPresenca !== null ? `${reportStats.mediaPresenca}%` : 'Sem registros'}
                  </div>
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: '#fee2e2', color: '#b91c1c', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <XCircle size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Faltas (Dias / Tempos)</div>
                  <div style={{ fontSize: '15px', fontWeight: 900, color: '#b91c1c' }}>
                    {reportStats.totalFaltas} dias ({reportStats.totalTemposFalta} tempos)
                  </div>
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: '#fef3c7', color: '#b45309', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Justificativas</div>
                  <div style={{ fontSize: '15px', fontWeight: 900, color: '#b45309' }}>{reportStats.totalJustificadas}</div>
                </div>
              </div>
            </div>

            {reportDataFiltered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748b' }}>
                <Users size={48} style={{ color: '#cbd5e1', marginBottom: '12px' }} />
                <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: '#334155' }}>Nenhum registro encontrado.</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>Selecione um aluno ou ajuste os filtros para visualizar as datas completas.</p>
              </div>
            ) : relatorioModo === 'aluno_individual' ? (
              // VISÃO INDIVIDUAL DO ALUNO COM DATAS COMPLETAS
              <div>
                {reportDataFiltered.map((a: any) => (
                  <div key={a.id} style={{ borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', background: '#fff' }}>
                    {/* Header do Aluno Individual */}
                    <div style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: a.pctFrequencia === null ? '#f1f5f9' : (a.isCritico ? '#fee2e2' : '#dcfce7'), color: a.pctFrequencia === null ? '#64748b' : (a.isCritico ? '#dc2626' : '#15803d'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 900, border: '1px solid rgba(0,0,0,0.05)' }}>
                          {getInitials(a.nome)}
                        </div>
                        <div>
                          <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{a.nome}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            Matrícula: #{a.id} • Turma: <strong>{a.turmaNome}</strong> ({a.segmento} - {a.turno})
                          </div>
                          
                          {/* Badges de Resumo do Período */}
                          <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid #bbf7d0' }}>
                              ✓ {a.diasPresentes} dia{a.diasPresentes !== 1 ? 's' : ''} presente{a.diasPresentes !== 1 ? 's' : ''}
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: 800, background: a.diasFaltantes > 0 ? '#fee2e2' : '#f1f5f9', color: a.diasFaltantes > 0 ? '#b91c1c' : '#64748b', padding: '2px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px', border: a.diasFaltantes > 0 ? '1px solid #fecaca' : '1px solid #e2e8f0' }}>
                              ✕ {a.diasFaltantes} dia{a.diasFaltantes !== 1 ? 's' : ''} com falta
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: 800, background: a.faltasContabilizadas > 0 ? '#fef3c7' : '#f1f5f9', color: a.faltasContabilizadas > 0 ? '#b45309' : '#64748b', padding: '2px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px', border: a.faltasContabilizadas > 0 ? '1px solid #fde68a' : '1px solid #e2e8f0' }}>
                              ⏱ {a.faltasContabilizadas} tempo{a.faltasContabilizadas !== 1 ? 's' : ''} de falta
                            </span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Frequência no Período</div>
                          {a.pctFrequencia !== null ? (
                            <div style={{ fontSize: '22px', fontWeight: 900, color: a.pctFrequencia < 75 ? '#dc2626' : '#16a34a' }}>
                              {a.pctFrequencia}%
                            </div>
                          ) : (
                            <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px', marginTop: '2px', border: '1px solid #e2e8f0' }}>
                              Sem chamadas no período
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleSendWhatsApp(a)}
                          style={{ padding: '8px 14px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          WhatsApp
                        </button>
                      </div>
                    </div>

                    {/* Tabela com as Datas Completas do Período */}
                    <div style={{ padding: '0' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Data & Dia da Semana</th>
                            <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Status do Dia</th>
                            <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Detalhamento por Tempo</th>
                            <th style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Origem & Horário</th>
                          </tr>
                        </thead>
                        <tbody>
                          {a.dailyBreakdown.map((d: any) => {
                            const dFreqRecord = combinedFreqs?.find(f => String(f.aluno_id || f.alunoId) === String(a.id) && isSameDay(f.data, d.data))
                            const dOrigem = getOrigemFrequenciaCompleta(a.id, d.data, dFreqRecord, portariaEventsList, saidaCallsList)

                            return (
                              <tr key={d.data} style={{ borderBottom: '1px solid #f1f5f9', background: '#fff' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                                <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                                  {d.dataFormatada}
                                </td>
                                <td style={{ padding: '12px 14px' }}>
                                  <span style={{
                                    padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 800,
                                    background: d.faltasStr.includes('Falta Total') ? '#fee2e2' :
                                                d.faltasStr.includes('Parcial') ? '#fef3c7' :
                                                d.faltasStr.includes('Justificada') ? '#fde68a' :
                                                d.faltasStr.includes('Sem Registro') ? '#f1f5f9' : '#dcfce7',
                                    color: d.faltasStr.includes('Falta Total') ? '#b91c1c' :
                                           d.faltasStr.includes('Parcial') ? '#b45309' :
                                           d.faltasStr.includes('Justificada') ? '#92400e' :
                                           d.faltasStr.includes('Sem Registro') ? '#64748b' : '#15803d'
                                  }}>
                                    {d.faltasStr}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 14px' }}>
                                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    {Object.entries(d.temposEfetivos).map(([tId, status]) => {
                                      const cfg = S_CONFIG[status as PresStatus] || { bg: '#f1f5f9', color: '#64748b', label: '-' }
                                      return (
                                        <div key={tId} style={{ padding: '2px 8px', borderRadius: '6px', background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border || 'transparent'}`, fontSize: '11px', fontWeight: 800 }}>
                                          {tId}ºT: {cfg.label}
                                        </div>
                                      )
                                    })}
                                  </div>
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                                  <OrigemBadgePair infoCompleta={dOrigem} />
                                  {!dOrigem.entrada && !dOrigem.saida && <span style={{ color: '#94a3b8' }}>—</span>}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // VISÃO POR TURMA(S) COM ACCORDEÃO DE DATAS COMPLETAS
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    Alunos no Período ({reportDataFiltered.length})
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => {
                        const allExp: Record<string, boolean> = {}
                        reportDataFiltered.forEach(a => allExp[a.id] = true)
                        setAlunosExpandidosRelatorio(allExp)
                      }}
                      style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      Expandir Todas as Datas
                    </button>
                    <button
                      onClick={() => setAlunosExpandidosRelatorio({})}
                      style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      Recolher Todas
                    </button>
                  </div>
                </div>

                {reportDataFiltered.map((a: any) => {
                  const isExpanded = !!alunosExpandidosRelatorio[a.id]
                  return (
                    <div key={a.id} style={{ borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', background: '#fff' }}>
                      {/* Linha Resumo do Aluno */}
                      <div
                        onClick={() => setAlunosExpandidosRelatorio(prev => ({ ...prev, [a.id]: !prev[a.id] }))}
                        style={{ padding: '12px 18px', background: isExpanded ? '#f8fafc' : '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', transition: 'background 0.2s' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: a.isCritico ? '#fee2e2' : '#e0f2fe', color: a.isCritico ? '#dc2626' : '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>
                            {getInitials(a.nome)}
                          </div>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{a.nome}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              Matrícula: #{a.id} • Turma: <strong>{a.turmaNome}</strong> ({a.turno})
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', display: 'block' }}>Frequência</span>
                            {a.pctFrequencia !== null ? (
                              <span style={{
                                padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 800,
                                background: a.pctFrequencia < 75 ? '#fee2e2' : '#dcfce7',
                                color: a.pctFrequencia < 75 ? '#b91c1c' : '#15803d'
                              }}>
                                {a.pctFrequencia}%
                              </span>
                            ) : (
                              <span style={{ padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, background: '#f1f5f9', color: '#64748b' }}>
                                Sem Reg.
                              </span>
                            )}
                          </div>

                          <div style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', display: 'block' }}>Presenças</span>
                            <span style={{ fontSize: '12px', fontWeight: 800, color: '#15803d' }}>
                              {a.diasPresentes}d
                            </span>
                          </div>

                          <div style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', display: 'block' }}>Dias Falta</span>
                            <span style={{ fontSize: '12px', fontWeight: 800, color: a.diasFaltantes > 0 ? '#dc2626' : '#64748b' }}>
                              {a.diasFaltantes}d
                            </span>
                          </div>

                          <div style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', display: 'block' }}>Tempos Falta</span>
                            <span style={{ fontSize: '12px', fontWeight: 800, color: a.faltasContabilizadas > 0 ? '#b45309' : '#64748b' }}>
                              {a.faltasContabilizadas}T
                            </span>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setAlunosExpandidosRelatorio(prev => ({ ...prev, [a.id]: !prev[a.id] }))
                            }}
                            style={{ padding: '6px 12px', background: isExpanded ? '#2563eb' : '#f1f5f9', color: isExpanded ? '#fff' : '#3b82f6', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <span>{isExpanded ? 'Ocultar Datas' : `Ver Datas (${a.dailyBreakdown.length})`}</span>
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        </div>
                      </div>

                      {/* Conteúdo Expandido: Tabela de Datas Completas */}
                      {isExpanded && (
                        <div style={{ padding: '12px 18px 16px 18px', borderTop: '1px solid #f1f5f9', background: '#fafafa' }}>
                          <h5 style={{ margin: '0 0 10px 0', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Detalhamento Completo por Data:
                          </h5>
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', background: '#fff', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                            <thead>
                              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ padding: '8px 12px', fontSize: '10px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Data</th>
                                <th style={{ padding: '8px 12px', fontSize: '10px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Status no Dia</th>
                                <th style={{ padding: '8px 12px', fontSize: '10px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Tempos de Aula</th>
                                <th style={{ padding: '8px 12px', fontSize: '10px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Catraca</th>
                              </tr>
                            </thead>
                            <tbody>
                              {a.dailyBreakdown.map((d: any) => (
                                <tr key={d.data} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '8px 12px', fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                                    {d.dataFormatada}
                                  </td>
                                  <td style={{ padding: '8px 12px' }}>
                                    <span style={{
                                      padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800,
                                      background: d.faltasStr.includes('Falta Total') ? '#fee2e2' :
                                                  d.faltasStr.includes('Parcial') ? '#fef3c7' :
                                                  d.faltasStr.includes('Justificada') ? '#fde68a' :
                                                  d.faltasStr.includes('Sem Registro') ? '#f1f5f9' : '#dcfce7',
                                      color: d.faltasStr.includes('Falta Total') ? '#b91c1c' :
                                             d.faltasStr.includes('Parcial') ? '#b45309' :
                                             d.faltasStr.includes('Justificada') ? '#92400e' :
                                             d.faltasStr.includes('Sem Registro') ? '#64748b' : '#15803d'
                                    }}>
                                      {d.faltasStr}
                                    </span>
                                  </td>
                                  <td style={{ padding: '8px 12px' }}>
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                      {Object.entries(d.temposEfetivos).map(([tId, status]) => {
                                        const cfg = S_CONFIG[status as PresStatus] || { bg: '#f1f5f9', color: '#64748b', label: '-' }
                                        return (
                                          <div key={tId} style={{ padding: '1px 6px', borderRadius: '4px', background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border || 'transparent'}`, fontSize: '10px', fontWeight: 800 }}>
                                            {tId}ºT: {cfg.label}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </td>
                                  <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#475569' }}>
                                    {d.horaRegistro || '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer do Modal com Botões de Ação */}
          <div style={{
            padding: '16px 28px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc'
          }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handlePrintRelatorioAvancado}
                style={{
                  padding: '10px 20px', background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '10px',
                  fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                <Printer size={16} />
                <span>Imprimir / PDF</span>
              </button>

              <button
                onClick={handleExportCSVAvancado}
                style={{
                  padding: '10px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '10px',
                  fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                  boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)', transition: 'all 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}
              >
                <Download size={16} />
                <span>Exportar Excel / CSV</span>
              </button>
            </div>

            <button
              onClick={() => {
                setShowRelatorioModal(false)
                setBuscaRelatorio('')
              }}
              style={{
                padding: '10px 24px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '10px',
                fontWeight: 700, fontSize: '13px', cursor: 'pointer'
              }}
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Render do Modal de Confirmação de Saída (Educação Infantil)
  const renderSaidaModal = () => {
    if (!saidaModalData) return null
    const { aluno, dia } = saidaModalData
    const guardias = getStudentGuardians(aluno, allResponsaveisList)
    const isSaiuSozinho = saidaModalResponsavel === 'Saiu Sozinho'

    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)',
        zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        <div style={{
          background: '#fff', borderRadius: '24px', maxWidth: '580px', width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0', overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: '20px 24px', borderBottom: '1px solid #f1f5f9',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#c026d3', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(192, 38, 211, 0.3)' }}>
                <LogOut size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontFamily: 'Outfit, sans-serif', fontSize: '18px', fontWeight: 900, color: '#fff' }}>
                  Confirmar Saída do Aluno
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#cbd5e1' }}>
                  {aluno.nome} ({turmaObj?.nome || ''})
                </p>
              </div>
            </div>
            <button
              onClick={() => setSaidaModalData(null)}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '6px', borderRadius: '8px', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Horário de Saída */}
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                Horário de Saída:
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock size={18} style={{ color: '#c026d3' }} />
                <input
                  type="time"
                  value={saidaModalHora}
                  onChange={e => setSaidaModalHora(e.target.value)}
                  style={{
                    padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1',
                    fontSize: '16px', fontWeight: 900, color: '#0f172a', background: '#fff', width: '130px'
                  }}
                />
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                  (Sincronizado em tempo real com /chamadas)
                </span>
              </div>
            </div>

            {/* Quem Retirou (Responsáveis + Status de Permissão) */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.5px' }}>
                Com quem o aluno saiu? (Selecione o Responsável Autorizado):
              </label>

              {/* Lista de Responsáveis Cadastrados com Status de Permissão */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                {guardias.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', padding: '10px 14px', borderRadius: '10px', background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', fontWeight: 600 }}>
                    ℹ️ Nenhum responsável cadastrado na ficha do aluno. Selecione "Saiu Sozinho" ou digite o nome no campo abaixo:
                  </div>
                )}
                {guardias.map((g, idx) => {
                  const fullLabel = `${g.name} (${g.role})`
                  const isSel = (saidaModalResponsavel === fullLabel || saidaModalResponsavel === g.name) && !customResponsavel

                  if (!g.permitido) {
                    // RESPONSÁVEL BLOQUEADO / PROIBIDO DE RETIRAR
                    return (
                      <div
                        key={idx}
                        onClick={() => alert(`⚠️ ATENÇÃO: ${g.name} NÃO POSSUI PERMISSÃO PARA RETIRAR ${aluno.nome.toUpperCase()}.\n\nMotivo: ${g.motivoProibicao || 'Restrição legal/cadastral'}.`)}
                        style={{
                          padding: '12px 14px', borderRadius: '14px', border: '2px solid #fecaca',
                          background: '#fef2f2', cursor: 'not-allowed', opacity: 0.9,
                          display: 'flex', flexDirection: 'column', gap: '4px', transition: 'all 0.15s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#991b1b' }}>{g.name}</span>
                          <span style={{ fontSize: '10px', fontWeight: 900, background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: '100px', border: '1px solid #fca5a5' }}>
                            🔴 PROIBIDO RETIRAR
                          </span>
                        </div>
                        <span style={{ fontSize: '11px', color: '#991b1b', fontWeight: 600 }}>
                          Parentesco: <strong>{g.role}</strong>
                        </span>
                      </div>
                    )
                  }

                  // RESPONSÁVEL PERMITIDO / AUTORIZADO
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSaidaModalResponsavel(fullLabel)
                        setCustomResponsavel('')
                      }}
                      style={{
                        padding: '12px 14px', borderRadius: '14px', textAlign: 'left',
                        cursor: 'pointer', border: isSel ? '2px solid #c026d3' : '1px solid #e2e8f0',
                        background: isSel ? 'linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%)' : '#fff',
                        color: isSel ? '#c026d3' : '#0f172a',
                        boxShadow: isSel ? '0 4px 12px rgba(192, 38, 211, 0.2)' : '0 1px 3px rgba(0,0,0,0.04)',
                        transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: '4px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <UserCheck size={16} style={{ color: isSel ? '#c026d3' : '#16a34a' }} />
                          <span style={{ fontSize: '13px', fontWeight: 800 }}>{g.name}</span>
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: 800, background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '100px', border: '1px solid #bbf7d0' }}>
                          🟢 PERMITIDO
                        </span>
                      </div>
                      <span style={{ fontSize: '11px', color: isSel ? '#9333ea' : '#64748b', fontWeight: 600 }}>
                        Parentesco: <strong>{g.role}</strong>
                      </span>
                    </button>
                  )
                })}

                {/* Opção Saiu Sozinho */}
                <button
                  type="button"
                  onClick={() => {
                    setSaidaModalResponsavel('Saiu Sozinho')
                    setCustomResponsavel('')
                  }}
                  style={{
                    padding: '12px 14px', borderRadius: '14px', textAlign: 'left',
                    cursor: 'pointer', border: isSaiuSozinho ? '2px solid #10b981' : '1px dashed #cbd5e1',
                    background: isSaiuSozinho ? '#dcfce7' : '#f8fafc',
                    color: isSaiuSozinho ? '#15803d' : '#475569',
                    transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800 }}>🚶‍♂️ Saiu Sozinho</span>
                    <span style={{ fontSize: '10px', fontWeight: 800, background: '#e2e8f0', color: '#475569', padding: '2px 6px', borderRadius: '100px' }}>
                      Sem Acompanhante
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Autorização individual</span>
                </button>
              </div>

              {/* Input para Digitar Novo Responsável */}
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Ou digite o nome de outro responsável/acompanhante..."
                  value={customResponsavel}
                  onChange={e => {
                    setCustomResponsavel(e.target.value)
                    if (e.target.value) setSaidaModalResponsavel('')
                  }}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: '12px',
                    border: customResponsavel ? '2px solid #c026d3' : '1px solid #cbd5e1',
                    fontSize: '13px', fontWeight: 600, background: customResponsavel ? '#fdf4ff' : '#fff'
                  }}
                />
              </div>
            </div>

          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 24px', borderTop: '1px solid #f1f5f9', background: '#f8fafc',
            display: 'flex', justifyContent: 'flex-end', gap: '12px'
          }}>
            <button
              type="button"
              onClick={() => setSaidaModalData(null)}
              style={{ padding: '10px 18px', borderRadius: '10px', background: '#fff', border: '1px solid #cbd5e1', color: '#475569', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={salvandoSaida}
              onClick={handleConfirmarSaidaInfantil}
              style={{
                padding: '10px 24px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #c026d3 0%, #9333ea 100%)',
                color: '#fff', border: 'none', fontWeight: 800, fontSize: '13px', cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(192, 38, 211, 0.3)', display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              <CheckCircle2 size={16} />
              <span>{salvandoSaida ? 'Confirmando...' : 'Confirmar Saída no Sistema'}</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Render do Modal de Registro Manual de Não Identificados
  const renderRegistroManualModal = () => {
    if (!showRegistroManualModal) return null

    const allAbsentees = getAbsenteesList(registroManualData)
    
    // Filtro do próprio modal
    const filteredAbsentees = allAbsentees.filter(a => {
      const matchBusca = a.nome.toLowerCase().includes(buscaRegistroManual.toLowerCase()) ||
                         a.id.toLowerCase().includes(buscaRegistroManual.toLowerCase()) ||
                         a.turmaNome.toLowerCase().includes(buscaRegistroManual.toLowerCase())
      
      const matchAno = !registroManualAno || a.anoLetivo === registroManualAno
      const matchTurno = !registroManualTurno || a.turno === registroManualTurno
      
      return matchBusca && matchAno && matchTurno
    })

    // Agrupar por turma
    const groupedByTurma = filteredAbsentees.reduce((acc: Record<string, any[]>, student) => {
      if (!acc[student.turmaNome]) acc[student.turmaNome] = []
      acc[student.turmaNome].push(student)
      return acc
    }, {})

    // Ordenar turmas alfabeticamente
    const sortedTurmas = Object.keys(groupedByTurma).sort()

    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)',
        zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        <div style={{
          background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '940px', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0', overflow: 'hidden'
        }}>
          {/* Header do Modal */}
          <div style={{
            padding: '24px 32px', borderBottom: '1px solid #f1f5f9',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff', width: '48px', height: '48px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)' }}>
                <Users size={24} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontFamily: 'Outfit, sans-serif', fontSize: '22px', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>
                  Registrar Não Identificados
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#cbd5e1', fontWeight: 500 }}>
                  Lançamento manual de frequência para alunos sem biometria
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowRegistroManualModal(false)}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '10px', color: '#fff', transition: 'all 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            >
              <X size={20} />
            </button>
          </div>

          {/* Barra de Filtros Interna */}
          <div style={{ padding: '14px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', width: '100%', background: '#f8fafc' }}>
            <select
              className="form-input"
              style={{ width: '110px', height: '38px', borderRadius: '10px', background: '#fff', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, padding: '0 10px', color: '#0f172a' }}
              value={registroManualAno}
              onChange={e => setRegistroManualAno(e.target.value)}
            >
              <option value="">Anos</option>
              {anosDisponiveis.map(ano => <option key={ano} value={ano}>{ano}</option>)}
            </select>

            <input
              type="date"
              className="form-input"
              style={{ width: '140px', height: '38px', borderRadius: '10px', background: '#fff', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, padding: '0 10px', color: '#0f172a' }}
              value={registroManualData}
              onChange={e => setRegistroManualData(e.target.value)}
            />

            <select
              className="form-input"
              style={{ width: '130px', height: '38px', borderRadius: '10px', background: '#fff', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, padding: '0 10px', color: '#0f172a' }}
              value={registroManualTurno}
              onChange={e => setRegistroManualTurno(e.target.value)}
            >
              <option value="">Turnos</option>
              <option value="Matutino">Matutino</option>
              <option value="Vespertino">Vespertino</option>
              <option value="Noturno">Noturno</option>
              <option value="Integral">Integral</option>
            </select>

            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                className="form-input"
                style={{ paddingLeft: '36px', height: '38px', borderRadius: '10px', background: '#fff', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, width: '100%', color: '#0f172a' }}
                placeholder="Buscar aluno, ID ou turma..."
                value={buscaRegistroManual}
                onChange={e => setBuscaRegistroManual(e.target.value)}
              />
            </div>
            
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, padding: '6px 12px', background: '#e2e8f0', borderRadius: '20px' }}>
              Exibindo {filteredAbsentees.length} alunos
            </span>
          </div>

          {/* Lista de Alunos em Cards Ultra Modernos */}
          <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', background: '#fff' }}>
            {filteredAbsentees.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
                <Users size={56} style={{ color: '#cbd5e1', marginBottom: '16px' }} />
                <h3 style={{ margin: '0 0 4px', fontWeight: 800, fontSize: '18px', color: '#334155' }}>Nenhum aluno pendente nesta data</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>Todos os alunos possuem registro ou a busca não retornou resultados.</p>
              </div>
            ) : (
              sortedTurmas.map(turmaNome => {
                const turmaStudents = groupedByTurma[turmaNome]
                const tObj = turmas.find(t => t.nome === turmaNome)
                const schedule = tObj ? getTurmaSchedule(tObj) : null

                if (!schedule) return null

                return (
                  <div key={turmaNome} style={{ background: '#f8fafc', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                    {/* Header da Turma com Ações Rápidas */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', fontFamily: 'Outfit, sans-serif' }}>{turmaNome}</span>
                        <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 10px', background: '#2563eb', color: '#fff', borderRadius: '20px', textTransform: 'uppercase' }}>
                          {schedule.segmento}
                        </span>
                        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>({turmaStudents.length} alunos)</span>
                      </div>

                      {/* Botões de Ação em Lote por Turma */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setAbsencesManual(prev => {
                              const copy = { ...prev }
                              turmaStudents.forEach(aluno => {
                                const newStudentTempos: Record<string, PresStatus> = {}
                                schedule.tempos.forEach((t: any) => { newStudentTempos[t.id] = 'P' })
                                copy[aluno.id] = newStudentTempos
                                if (!horariosEntrada[aluno.id]?.[registroManualData]) {
                                  const nowT = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                                  setHorariosEntrada(p => ({
                                    ...p,
                                    [aluno.id]: { ...(p[aluno.id] || {}), [registroManualData]: nowT }
                                  }))
                                }
                              })
                              return copy
                            })
                          }}
                          style={{ padding: '5px 12px', fontSize: '11px', fontWeight: 800, background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#bbf7d0'}
                          onMouseLeave={e => e.currentTarget.style.background = '#dcfce7'}
                        >
                          + Presença Geral (Turma)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAbsencesManual(prev => {
                              const copy = { ...prev }
                              turmaStudents.forEach(aluno => {
                                const newStudentTempos: Record<string, PresStatus> = {}
                                schedule.tempos.forEach((t: any) => { newStudentTempos[t.id] = 'F' })
                                copy[aluno.id] = newStudentTempos
                              })
                              return copy
                            })
                          }}
                          style={{ padding: '5px 12px', fontSize: '11px', fontWeight: 800, background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#fecaca'}
                          onMouseLeave={e => e.currentTarget.style.background = '#fee2e2'}
                        >
                          + Falta Geral (Turma)
                        </button>
                      </div>
                    </div>

                    {/* Cards de Alunos da Turma */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {turmaStudents.map(aluno => {
                        const existingFreq = allFreqs?.find(f => String(f.aluno_id) === String(aluno.id) && String(f.data).startsWith(registroManualData))
                        const infoOrigem = getOrigemFrequenciaCompleta(aluno.id, registroManualData, existingFreq, portariaEventsList, saidaCallsList)
                        
                        let currentStatus: PresStatus = '-'
                        if (absencesManual[aluno.id] && absencesManual[aluno.id]['1']) {
                          currentStatus = absencesManual[aluno.id]['1']
                        } else if (existingFreq && existingFreq.tempos) {
                          currentStatus = existingFreq.tempos['1'] || '-'
                        } else if (existingFreq && !existingFreq.tempos) {
                          currentStatus = existingFreq.justificativa === 'Justificada' ? 'J' : (existingFreq.presente ? 'P' : 'F')
                        }

                        const currentEntrada = horariosEntrada[aluno.id]?.[registroManualData] || (infoOrigem.entrada?.horario ? infoOrigem.entrada.horario : '')
                        const isEditingThisEntrada = editingEntrada?.alunoId === aluno.id && editingEntrada?.dia === registroManualData
                        const hSaida = horariosSaida[aluno.id]?.[registroManualData] || infoOrigem.saida?.horario
                        const rSaida = responsaveisSaida[aluno.id]?.[registroManualData] || infoOrigem.saida?.responsavel

                        return (
                          <div key={aluno.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', gap: '16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                            {/* Dados do Aluno */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '1', minWidth: '220px' }}>
                              <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', color: '#0369a1', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', boxShadow: '0 2px 4px rgba(3, 105, 161, 0.1)' }}>
                                {getInitials(aluno.nome)}
                              </div>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>{aluno.nome}</div>
                                  <OrigemBadgePair infoCompleta={infoOrigem} compact />
                                </div>
                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                  Matrícula: <strong style={{ color: '#0f172a' }}>#{aluno.id}</strong>
                                </div>
                              </div>
                            </div>
                            
                            {/* Controle 1-Clique de Frequência / Entrada */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextStatus: PresStatus = currentStatus === '-' ? 'P' : (currentStatus === 'P' ? 'F' : (currentStatus === 'F' ? 'J' : '-'))
                                    
                                    setAbsencesManual(prev => {
                                      const newStudentTempos: Record<string, PresStatus> = {}
                                      schedule.tempos.forEach((t: any) => { newStudentTempos[t.id] = nextStatus })
                                      return {
                                        ...prev,
                                        [aluno.id]: newStudentTempos
                                      }
                                    })

                                    if (nextStatus === 'P' && !horariosEntrada[aluno.id]?.[registroManualData]) {
                                      const nowT = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                                      setHorariosEntrada(prev => ({
                                        ...prev,
                                        [aluno.id]: { ...(prev[aluno.id] || {}), [registroManualData]: infoOrigem.entrada?.horario || nowT }
                                      }))
                                    }
                                  }}
                                  style={{
                                    padding: '8px 18px', borderRadius: '10px', fontWeight: 900, fontSize: '13px', cursor: 'pointer',
                                    border: currentStatus === 'P' ? '1px solid #bbf7d0' : (currentStatus === 'F' ? '1px solid #fecaca' : (currentStatus === 'J' ? '1px solid #fde68a' : '1px dashed #cbd5e1')),
                                    background: currentStatus === 'P' ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)' : (currentStatus === 'F' ? 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)' : (currentStatus === 'J' ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' : '#f8fafc')),
                                    color: currentStatus === 'P' ? '#15803d' : (currentStatus === 'F' ? '#b91c1c' : (currentStatus === 'J' ? '#b45309' : '#64748b')),
                                    boxShadow: currentStatus === 'P' ? '0 2px 8px rgba(34, 197, 94, 0.2)' : 'none',
                                    transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: '6px'
                                  }}
                                >
                                  {currentStatus === 'P' && <CheckCircle size={16} />}
                                  {currentStatus === 'F' && <XCircle size={16} />}
                                  {currentStatus === 'J' && <AlertTriangle size={16} />}
                                  <span>
                                    {currentStatus === 'P' ? 'PRESENTE' : (currentStatus === 'F' ? 'FALTOSO' : (currentStatus === 'J' ? 'JUSTIFICADO' : 'DEFINIR FREQUÊNCIA'))}
                                  </span>
                                </button>

                                {currentStatus === 'P' && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    {isEditingThisEntrada ? (
                                      <input
                                        type="time"
                                        autoFocus
                                        value={currentEntrada || '07:30'}
                                        onBlur={() => setEditingEntrada(null)}
                                        onChange={e => {
                                          const v = e.target.value
                                          setHorariosEntrada(prev => ({
                                            ...prev,
                                            [aluno.id]: { ...(prev[aluno.id] || {}), [registroManualData]: v }
                                          }))
                                        }}
                                        style={{ padding: '2px 6px', borderRadius: '6px', border: '1px solid #2563eb', fontSize: '11px', fontWeight: 800, width: '90px' }}
                                      />
                                    ) : (
                                      <span
                                        onClick={() => setEditingEntrada({ alunoId: aluno.id, dia: registroManualData })}
                                        title="Clique para editar o horário de entrada"
                                        style={{
                                          cursor: 'pointer', fontSize: '11px', fontWeight: 800, color: '#0369a1',
                                          background: '#e0f2fe', padding: '2px 8px', borderRadius: '6px', border: '1px solid #7dd3fc',
                                          display: 'inline-flex', alignItems: 'center', gap: '4px'
                                        }}
                                      >
                                        <Clock size={12} />
                                        <span>Entrou: {currentEntrada || '07:30'}h</span>
                                        <Edit3 size={10} style={{ opacity: 0.7 }} />
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer do Modal */}
          <div style={{
            padding: '20px 32px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', flexWrap: 'wrap', gap: '12px'
          }}>
            <button
              onClick={() => handlePrintRegistroManual(filteredAbsentees, registroManualData)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 22px', background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '12px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.background = '#f1f5f9'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#fff'; }}
            >
              <Printer size={16} />
              Imprimir Ficha
            </button>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowRegistroManualModal(false)}
                style={{ padding: '11px 24px', background: '#fff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '12px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveManualRegistro}
                disabled={salvandoManual}
                style={{
                  padding: '11px 28px', background: salvandoManual ? '#93c5fd' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '13px',
                  cursor: salvandoManual ? 'not-allowed' : 'pointer', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
                  display: 'flex', alignItems: 'center', gap: '8px', transition: 'transform 0.2s'
                }}
                onMouseEnter={e => { if (!salvandoManual) e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => { if (!salvandoManual) e.currentTarget.style.transform = 'none' }}
              >
                <Save size={16} />
                <span>{salvandoManual ? 'Salvando Registros...' : 'Salvar Registros'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Estatísticas para a visão de Diretor
  const statsGlobal = useMemo(() => {
    const totalTurmas = turmas.length
    const freqs = allFreqs || []
    
    const turmasComChamadaHoje = turmas.filter(t => freqs.some(f => String(f.turma_id) === String(t.id) && String(f.data).startsWith(dataSel))).length
    
    let somaPresenca = 0
    let totalAulas = 0
    
    const grouped = freqs.reduce((acc: any, f) => {
      const key = `${f.data}-${f.turma_id}`
      if (!acc[key]) acc[key] = []
      acc[key].push(f)
      return acc
    }, {})
    
    Object.entries(grouped).forEach(([key, regs]: [string, any]) => {
      const turmaIdStr = key.split('-')[1]
      const tObj = turmas.find(t => String(t.id) === turmaIdStr)
      if (!tObj) return
      
      const schedule = getTurmaSchedule(tObj)
      const totalContabilizadoTurma = 0
      let totalContabilizadoTurmaVal = 0
      let faltasContabilizadasTurma = 0
      
      regs.forEach((r: any) => {
        let tempos: Record<string, PresStatus> = {}
        if (r.tempos) {
          tempos = { ...r.tempos }
        } else {
          const overallStatus: PresStatus = r.justificativa === 'Justificada' ? 'J' : (r.presente ? 'P' : 'F')
          schedule.tempos.forEach(t => {
            tempos[t.id] = overallStatus
          })
        }
        
        const calc = calcularFrequenciaDia(tempos, schedule.segmento)
        totalContabilizadoTurmaVal += calc.totalTemposContabilizados
        faltasContabilizadasTurma += calc.faltasContabilizadas
      })
      
      if (totalContabilizadoTurmaVal > 0) {
        const presencasTurma = totalContabilizadoTurmaVal - faltasContabilizadasTurma
        somaPresenca += (presencasTurma / totalContabilizadoTurmaVal)
        totalAulas++
      }
    })
    
    const mediaPresenca = totalAulas > 0 ? Math.round((somaPresenca / totalAulas) * 100) : 100

    const alunosEmRisco = alunos.filter(a => {
      const tObj = turmas.find(t => t.nome === a.turma || String(t.id) === String(a.turma))
      if (!tObj) return false
      const regs = freqs.filter(f => String(f.turma_id) === String(tObj.id) && String(f.aluno_id) === String(a.id))
      if (!regs.length) return false
      
      const schedule = getTurmaSchedule(tObj)
      let totalContabilizadoT = 0
      let faltasContabilizadasT = 0
      
      regs.forEach((r: any) => {
        let tempos: Record<string, PresStatus> = {}
        if (r.tempos) {
          tempos = { ...r.tempos }
        } else {
          const overallStatus: PresStatus = r.justificativa === 'Justificada' ? 'J' : (r.presente ? 'P' : 'F')
          schedule.tempos.forEach(t => {
            tempos[t.id] = overallStatus
          })
        }
        
        const calc = calcularFrequenciaDia(tempos, schedule.segmento)
        totalContabilizadoT += calc.totalTemposContabilizados
        faltasContabilizadasT += calc.faltasContabilizadas
      })
      
      const presT = totalContabilizadoT - faltasContabilizadasT
      return totalContabilizadoT > 0 ? (Math.round((presT / totalContabilizadoT) * 100) < freqMinima) : false
    }).length

    return { totalTurmas, turmasComChamadaHoje, mediaPresenca, alunosEmRisco }
  }, [turmas, allFreqs, alunos, dataSel])

  // ── HOME (VISÃO DE DIRETOR) ───────────────────────────────────────────────
  if (!turmaSel) {
    const turmasFiltradas = turmas.filter(t =>
      (filtroAno === 'todos' || t.ano.toString() === filtroAno) &&
      (!filtroSegmento || (t as any).dados?.segmento === filtroSegmento) &&
      (!filtroTurno || t.turno === filtroTurno) &&
      (!filtroBusca || t.nome.toLowerCase().includes(filtroBusca.toLowerCase()))
    )

    return (
      <div style={{ padding: '32px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>

        {/* Header Ultra Moderno */}
        <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Sparkles size={20} style={{ color: '#2563eb' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '1px' }}>Dashboard de Gestão</span>
            </div>
            <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 32, color: '#0f172a', margin: 0, letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Frequência Escolar
              {(fetchingAllFreqs || fetchingAlunos) && (
                <span style={{ fontSize: '14px', color: '#3b82f6', fontWeight: 600 }}>• Atualizando...</span>
              )}
            </h1>
            <p style={{ fontSize: 14, color: '#64748b', margin: '4px 0 0 0' }}>Monitore a assiduidade e identifique riscos de evasão em tempo real.</p>
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setShowRelatorioModal(true)}
              style={{
                height: '42px',
                padding: '0 18px',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.35)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.25)'
              }}
            >
              <FileText size={18} />
              <span>Relatórios</span>
            </button>
            <button
              onClick={() => setShowAcessosModal(true)}
              style={{
                height: '42px',
                padding: '0 16px',
                background: 'rgba(6, 182, 212, 0.08)',
                color: '#0891b2',
                border: '1px dashed #06b6d4',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(6, 182, 212, 0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(6, 182, 212, 0.08)'}
            >
              <RefreshCw size={16} />
              <span>Sincronizar Frequência</span>
            </button>
            <button
              onClick={() => setShowRegrasModal(true)}
              style={{
                height: '42px',
                padding: '0 16px',
                background: 'rgba(37, 99, 235, 0.08)',
                color: '#2563eb',
                border: '1px dashed #2563eb',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(37, 99, 235, 0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(37, 99, 235, 0.08)'}
            >
              <Info size={16} />
              <span>Regras de Cálculo</span>
            </button>

            <button 
              onClick={() => {
                setRegistroManualAno(filtroAno)
                setRegistroManualData(dataSel)
                setRegistroManualTurno('')
                setBuscaRegistroManual('')
                setAbsencesManual({})
                setShowRegistroManualModal(true)
              }}
              style={{ height: '42px', padding: '0 20px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(245, 158, 11, 0.2)' }}
            >
              <Users size={16} />
              <span>Registrar Não Identificados</span>
            </button>
          </div>
        </div>

        {/* Cards de Métricas Premium */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
          {/* Card 1 */}
          <div style={{ 
            background: 'linear-gradient(135deg, #fff, rgba(37, 99, 235, 0.02))', 
            padding: '16px 20px', 
            borderRadius: '20px', 
            border: '1px solid #e2e8f0', 
            boxShadow: '0 4px 20px -2px rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            position: 'relative',
            overflow: 'hidden',
            transition: 'transform 0.2s, box-shadow 0.2s',
            cursor: 'pointer'
          }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(37, 99, 235, 0.06)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'none'
              e.currentTarget.style.boxShadow = '0 4px 20px -2px rgba(0,0,0,0.02)'
            }}
          >
            <div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: 0, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total de Turmas</p>
              <h3 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: '4px 0 0 0', fontFamily: 'Outfit,sans-serif', letterSpacing: '-0.02em', lineHeight: 1 }}>{statsGlobal.totalTurmas}</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
              <div style={{ background: 'rgba(37, 99, 235, 0.08)', color: '#2563eb', width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <School size={20} />
              </div>
              <span style={{ fontSize: '9px', fontWeight: 800, color: '#10b981', background: 'rgba(16, 185, 129, 0.08)', padding: '2px 6px', borderRadius: '100px', textTransform: 'uppercase' }}>Ativo</span>
            </div>
          </div>

          {/* Card 2 */}
          <div style={{ 
            background: 'linear-gradient(135deg, #fff, rgba(16, 185, 129, 0.02))', 
            padding: '16px 20px', 
            borderRadius: '20px', 
            border: '1px solid #e2e8f0', 
            boxShadow: '0 4px 20px -2px rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            position: 'relative',
            overflow: 'hidden',
            transition: 'transform 0.2s, box-shadow 0.2s',
            cursor: 'pointer'
          }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(16, 185, 129, 0.06)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'none'
              e.currentTarget.style.boxShadow = '0 4px 20px -2px rgba(0,0,0,0.02)'
            }}
          >
            <div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: 0, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Presença Média</p>
              <h3 style={{ fontSize: '24px', fontWeight: 900, color: '#10b981', margin: '4px 0 0 0', fontFamily: 'Outfit,sans-serif', letterSpacing: '-0.02em', lineHeight: 1 }}>{statsGlobal.mediaPresenca}%</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={20} />
              </div>
              <span style={{ fontSize: '9px', fontWeight: 800, color: '#10b981', background: 'rgba(16, 185, 129, 0.08)', padding: '2px 6px', borderRadius: '100px', textTransform: 'uppercase' }}>Excelente</span>
            </div>
          </div>

          {/* Card 3 */}
          <div style={{ 
            background: 'linear-gradient(135deg, #fff, rgba(245, 158, 11, 0.02))', 
            padding: '16px 20px', 
            borderRadius: '20px', 
            border: '1px solid #e2e8f0', 
            boxShadow: '0 4px 20px -2px rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            position: 'relative',
            overflow: 'hidden',
            transition: 'transform 0.2s, box-shadow 0.2s',
            cursor: 'pointer'
          }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(245, 158, 11, 0.06)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'none'
              e.currentTarget.style.boxShadow = '0 4px 20px -2px rgba(0,0,0,0.02)'
            }}
          >
            <div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: 0, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Chamadas Feitas</p>
              <h3 style={{ fontSize: '24px', fontWeight: 900, color: '#f59e0b', margin: '4px 0 0 0', fontFamily: 'Outfit,sans-serif', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {statsGlobal.turmasComChamadaHoje}
                <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 700 }}>/{statsGlobal.totalTurmas}</span>
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
              <div style={{ background: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b', width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={20} />
              </div>
              <span style={{ fontSize: '9px', fontWeight: 800, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.08)', padding: '2px 6px', borderRadius: '100px', textTransform: 'uppercase' }}>Hoje</span>
            </div>
          </div>

          {/* Card 4 */}
          <div style={{ 
            background: 'linear-gradient(135deg, #fff, rgba(239, 68, 68, 0.02))', 
            padding: '16px 20px', 
            borderRadius: '20px', 
            border: '1px solid #e2e8f0', 
            boxShadow: '0 4px 20px -2px rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            position: 'relative',
            overflow: 'hidden',
            transition: 'transform 0.2s, box-shadow 0.2s',
            cursor: 'pointer'
          }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(239, 68, 68, 0.06)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'none'
              e.currentTarget.style.boxShadow = '0 4px 20px -2px rgba(0,0,0,0.02)'
            }}
          >
            <div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: 0, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Alunos Críticos</p>
              <h3 style={{ fontSize: '24px', fontWeight: 900, color: '#ef4444', margin: '4px 0 0 0', fontFamily: 'Outfit,sans-serif', letterSpacing: '-0.02em', lineHeight: 1 }}>{statsGlobal.alunosEmRisco}</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={20} />
              </div>
              <span style={{ fontSize: '9px', fontWeight: 800, color: '#ef4444', background: 'rgba(239, 68, 68, 0.08)', padding: '2px 6px', borderRadius: '100px', textTransform: 'uppercase' }}>Atenção</span>
            </div>
          </div>
        </div>

        {/* Barra de Ações e Filtros */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '12px', flex: 1 }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
              <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input 
                className="form-input" 
                style={{ paddingLeft: '42px', height: '44px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }} 
                placeholder="Pesquisar turma por nome..." 
                value={filtroBusca} 
                onChange={e => setFiltroBusca(e.target.value)} 
              />
            </div>
            
            <div style={{ width: '160px' }}>
              <select className="form-input" style={{ height: '44px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }} value={filtroAno} onChange={e => setFiltroAno(e.target.value)}>
                <option value="todos">Anos Letivos</option>
                {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

             <div style={{ width: '200px' }}>
               <select className="form-input" style={{ height: '44px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }} value={filtroSegmento} onChange={e => setFiltroSegmento(e.target.value)}>
                 <option value="">Todos Segmentos</option>
                 {cfgNiveisEnsino?.map((n: any) => (
                   <option key={n.id} value={n.nome}>{n.nome}</option>
                 ))}
               </select>
             </div>

             <div style={{ width: '160px' }}>
               <select className="form-input" style={{ height: '44px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }} value={filtroTurno} onChange={e => setFiltroTurno(e.target.value)}>
                 <option value="">Todos os Turnos</option>
                 <option value="Matutino">Matutino</option>
                 <option value="Vespertino">Vespertino</option>
                 <option value="Noturno">Noturno</option>
                 <option value="Integral">Integral</option>
               </select>
             </div>

             <div style={{ width: '160px' }}>
               <input 
                 type="date"
                 className="form-input" 
                 style={{ height: '44px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', fontWeight: 600, fontSize: '13px' }} 
                 value={dataSel} 
                 onChange={e => setDataSel(e.target.value)} 
               />
             </div>
           </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Filtrando: </span>
            <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 700 }}>{turmasFiltradas.length} turmas</span>
          </div>
        </div>

        {/* Grid de Turmas Ultra Moderno */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 4px 6px -2px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Turma</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Segmento</th>
                  <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Alunos</th>
                  <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Frequência</th>
                  <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status na Data</th>
                  <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {loadingAllFreqs || loadingAlunos ? (
                  <TableSkeleton rows={5} cols={6} />
                ) : (
                   turmasFiltradas.map(turma => {
                    const freqs = allFreqs || []
                    const regs = freqs.filter(f => String(f.turma_id) === String(turma.id))
                    const temHoje = regs.some(f => String(f.data).startsWith(dataSel))
                    
                    const schedule = getTurmaSchedule(turma)
                    let totalContabilizadoTurma = 0
                    let faltasContabilizadasTurma = 0
                    
                    regs.forEach((r: any) => {
                      let tempos: Record<string, any> = {}
                      if (r.tempos) {
                        tempos = { ...r.tempos }
                      } else {
                        const overallStatus = r.justificativa === 'Justificada' ? 'J' : (r.presente ? 'P' : 'F')
                        schedule.tempos.forEach((t: any) => {
                          tempos[t.id] = overallStatus
                        })
                      }
                      
                      const calc = calcularFrequenciaDia(tempos, schedule.segmento)
                      totalContabilizadoTurma += calc.totalTemposContabilizados
                      faltasContabilizadasTurma += calc.faltasContabilizadas
                    })
                    
                    const presencasTurma = totalContabilizadoTurma - faltasContabilizadasTurma
                    const pctPresenca = totalContabilizadoTurma > 0 ? Math.round((presencasTurma / totalContabilizadoTurma) * 100) : 100
                    const isLow = pctPresenca < freqMinima

                  const totalAlunosTurma = alunos.filter((a: any) => String(a.turma) === String(turma.id)).length

                  return (
                    <tr key={turma.id} style={{ background: '#fff', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                      <td style={{ padding: '16px', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', borderLeft: '1px solid #f1f5f9', borderTopLeftRadius: '10px', borderBottomLeftRadius: '10px' }}>
                        <div>
                          <p style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', margin: 0 }}>{turma.nome}</p>
                          <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>{turma.serie} • {turma.turno}</p>
                        </div>
                      </td>
                      <td style={{ padding: '12px', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: '13px', color: '#0f172a' }}>{(turma as any).dados?.segmento || '--'}</span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 600 }}>{totalAlunosTurma}</span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                          <span style={{ 
                            fontSize: '13px', 
                            fontWeight: 700, 
                            color: isLow ? '#ef4444' : '#10b981',
                            background: isLow ? '#fee2e2' : '#dcfce7',
                            padding: '4px 8px',
                            borderRadius: '6px'
                          }}>
                            {pctPresenca}%
                          </span>
                          <div style={{ width: '60px', height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${pctPresenca}%`, height: '100%', background: isLow ? '#ef4444' : '#10b981', borderRadius: '3px' }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                        {temHoje ? (
                          <span style={{ padding: '4px 10px', background: '#dcfce7', color: '#15803d', borderRadius: '20px', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={12} strokeWidth={3} /> Realizada
                          </span>
                        ) : (
                          <span style={{ padding: '4px 10px', background: '#fef3c7', color: '#b45309', borderRadius: '20px', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <AlertCircle size={12} strokeWidth={3} /> Pendente
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9', borderTopRightRadius: '10px', borderBottomRightRadius: '10px' }}>
                        <button 
                          onClick={() => setTurmaSel(turma.id)}
                          style={{ background: 'transparent', border: 'none', color: '#2563eb', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          Abrir <ChevronRight size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        {renderRegrasModal(showRegrasModal, () => setShowRegrasModal(false))}
        {renderRelatorioModal()}
        {renderRegistroManualModal()}
        {renderSaidaModal()}
        <SyncAcessosModal 
          isOpen={showAcessosModal} 
          onClose={() => setShowAcessosModal(false)}
          initialStartDate={today}
          initialEndDate={today}
        />
      </div>
    )
  }

  // ── VISTA INTERNA (LANÇAMENTO DE FALTAS) ──────────────────────────────────
  const schedule = getTurmaSchedule(turmaObj)
  const isInfantil = schedule.segmento === 'Educação Infantil' || ((turmaObj as any)?.dados?.segmento === 'Educação Infantil') || (turmaObj?.nome || '').toLowerCase().includes('infantil') || (turmaObj?.nome || '').toLowerCase().includes('maternal') || (turmaObj?.nome || '').toLowerCase().includes('jardim') || (turmaObj?.nome || '').toLowerCase().includes('pré')
  
  const datasAtivasDaTurma = new Set<string>()
  Object.values(absences).forEach(studentDays => {
    Object.keys(studentDays).forEach(dia => datasAtivasDaTurma.add(dia))
  })

  // Calcular número de faltas individuais no dia selecionado e alunos com pelo menos uma falta
  let totalFaltasDia = 0
  let alunosComFalta = 0
  alunosDaTurma.forEach(a => {
    let studentHasFalta = false
    schedule.tempos.forEach(t => {
      const status = getStatus(a.id, dataSel, t.id)
      if (status === 'F') {
        totalFaltasDia++
        studentHasFalta = true
      }
    })
    if (studentHasFalta) alunosComFalta++
  })

  return (
    <div style={{ padding: '32px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>

      {/* Header Ultra Moderno */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button 
            onClick={() => setTurmaSel(null)} 
            style={{ border: '1px solid #e2e8f0', background: '#fff', width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0f172a', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ padding: '4px 8px', background: '#e0f2fe', color: '#0369a1', borderRadius: '6px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Gestão de Classe</span>
              <span style={{ padding: '4px 8px', background: '#2563eb', color: '#fff', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>{turmaSel}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 28, color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>Diário de Frequência</h1>
              <button
                onClick={() => setShowRegrasModal(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(37, 99, 235, 0.08)',
                  color: '#2563eb',
                  border: '1px dashed #2563eb',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  alignSelf: 'center'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(37, 99, 235, 0.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(37, 99, 235, 0.08)'}
              >
                <Info size={14} />
                Regras de Cálculo
              </button>
            </div>
            <p style={{ fontSize: 13, color: '#64748b', margin: '2px 0 0 0', fontWeight: 500 }}>
              Segmento: <strong style={{ color: '#2563eb' }}>{schedule.segmento}</strong>. Lançamento de Frequência 1-Clique com registro de Entrada & Saída do Aluno.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Faltas no Dia</span>
            <p style={{ fontSize: '24px', fontWeight: 900, color: '#ef4444', margin: 0, fontFamily: 'Outfit,sans-serif' }}>
              {totalFaltasDia} <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 700 }}>({alunosComFalta} {alunosComFalta === 1 ? 'aluno' : 'alunos'})</span>
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={handleSave}
              style={{ height: '44px', padding: '0 24px', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)', transition: 'transform 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
            >
              {salvo ? <CheckCircle size={18} /> : <Save size={18} />}
              {salvo ? 'Salvo com Sucesso!' : 'Salvar Registros'}
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar Premium */}
      <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Calendário */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <Calendar size={18} style={{ color: '#64748b' }} />
            <input 
              className="form-input" 
              style={{ background: 'transparent', border: 'none', padding: 0, height: 'auto', fontWeight: 700, fontSize: '14px', color: '#0f172a', outline: 'none' }} 
              type="date" 
              value={dataSel} 
              onChange={e => setDataSel(e.target.value)} 
            />
          </div>

          {/* Busca Aluno */}
          <div style={{ position: 'relative', width: '250px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              className="form-input" 
              style={{ paddingLeft: '40px', height: '42px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }} 
              placeholder="Buscar aluno..." 
              value={buscaAluno} 
              onChange={e => setBuscaAluno(e.target.value)} 
            />
          </div>
        </div>



        {/* Legenda Premium */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', background: '#f8fafc', padding: '10px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Legenda:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '3px' }}></span>
            <span style={{ fontSize: '12px', color: '#0f172a', fontWeight: 600 }}>Presença (P)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '3px' }}></span>
            <span style={{ fontSize: '12px', color: '#0f172a', fontWeight: 600 }}>Falta (F)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', background: '#f59e0b', borderRadius: '3px' }}></span>
            <span style={{ fontSize: '12px', color: '#0f172a', fontWeight: 600 }}>Justificada (J)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px', borderLeft: '1px solid #cbd5e1', paddingLeft: '12px' }}>
            <span style={{ width: '12px', height: '12px', background: 'transparent', border: '1px dashed #cbd5e1', borderRadius: '3px' }}></span>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Sem registro (-)</span>
          </div>
        </div>
      </div>

      {/* Tabela de Grade Ultra Moderna */}
      <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 4px 6px -2px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Aluno</th>
                <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', width: '110px' }}>Freq. Total</th>
                <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', width: '80px' }}>Faltas</th>
                <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', width: '100px' }}>Justificadas</th>
                <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', minWidth: '240px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <span>Entrada / Presença (1-Clique)</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          alunosFiltrados.forEach(aluno => {
                            diasPeriodo.forEach(dia => {
                              const newDayTempos: Record<string, PresStatus> = {}
                              schedule.tempos.forEach(t => { newDayTempos[t.id] = 'P' })
                              let newEntrada = horariosEntrada[aluno.id]?.[dia]
                              if (!newEntrada) {
                                const nowT = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                                newEntrada = nowT
                                setHorariosEntrada(prev => ({
                                  ...prev,
                                  [aluno.id]: { ...(prev[aluno.id] || {}), [dia]: newEntrada! }
                                }))
                              }
                              schedule.tempos.forEach(t => setStatus(aluno.id, dia, t.id, 'P'))
                              autoSaveStudent(aluno.id, dia, newDayTempos, newEntrada)
                            })
                          })
                        }}
                        style={{ padding: '4px 8px', fontSize: '10px', fontWeight: 700, background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#059669'}
                        onMouseLeave={e => e.currentTarget.style.background = '#10b981'}
                      >
                        Presença Geral (Turma)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          alunosFiltrados.forEach(aluno => {
                            diasPeriodo.forEach(dia => {
                              const newDayTempos: Record<string, PresStatus> = {}
                              schedule.tempos.forEach(t => { newDayTempos[t.id] = 'F' })
                              schedule.tempos.forEach(t => setStatus(aluno.id, dia, t.id, 'F'))
                              autoSaveStudent(aluno.id, dia, newDayTempos)
                            })
                          })
                        }}
                        style={{ padding: '4px 8px', fontSize: '10px', fontWeight: 700, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#dc2626'}
                        onMouseLeave={e => e.currentTarget.style.background = '#ef4444'}
                      >
                        Falta Geral (Turma)
                      </button>
                    </div>
                  </div>
                </th>
                <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', minWidth: '260px' }}>
                  Saída do Aluno & Retirada (/chamadas)
                </th>
              </tr>
            </thead>
            <tbody>
              {loadingFreqTurma ? (
                <TableSkeleton rows={5} cols={6} />
              ) : alunosFiltrados.map((aluno: any) => {
                const freqGeral = calcFreqGeral(aluno.id)
                const isLow = freqGeral !== null && freqGeral < freqMinima
                
                // Calcular faltas e justificativas a nível de tempos usando os dias ativos
                let totalFaltas = 0
                let totalJustificadas = 0
                datasAtivasDaTurma.forEach(dia => {
                  let tempos: Record<string, PresStatus> = {}
                  schedule.tempos.forEach(t => {
                    tempos[t.id] = getStatus(aluno.id, dia, t.id)
                  })
                  
                  const calc = calcularFrequenciaDia(tempos, schedule.segmento)
                  totalFaltas += calc.faltasContabilizadas
                  totalJustificadas += calc.justificadasContabilizadas
                })

                const freqRecordDia = combinedFreqs?.find(f => String(f.aluno_id || f.alunoId) === String(aluno.id) && isSameDay(f.data, dataSel))
                const origemInfoCompleta = getOrigemFrequenciaCompleta(
                  aluno.id,
                  dataSel,
                  freqRecordDia,
                  portariaEventsList,
                  saidaCallsList,
                  horariosEntrada[aluno.id]?.[dataSel],
                  horariosSaida[aluno.id]?.[dataSel],
                  responsaveisSaida[aluno.id]?.[dataSel]
                )

                return (
                  <tr key={aluno.id} style={{ background: '#fff', transition: 'all 0.2s' }}>
                    {/* Nome do Aluno */}
                    <td style={{ padding: '16px', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', borderLeft: '1px solid #f1f5f9', borderTopLeftRadius: '10px', borderBottomLeftRadius: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', color: '#0369a1', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px' }}>
                          {getInitials(aluno.nome)}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <p style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', margin: 0 }}>{aluno.nome}</p>
                            <OrigemBadgePair infoCompleta={origemInfoCompleta} />
                          </div>
                          <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>ID: {aluno.id} • {turmaObj?.nome} ({turmaObj?.turno})</p>
                        </div>
                      </div>
                    </td>

                    {/* Freq. Total */}
                    <td style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                      {freqGeral !== null ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                          <span style={{ 
                            fontSize: '13px', 
                            fontWeight: 700, 
                            color: isLow ? '#ef4444' : '#10b981',
                            background: isLow ? '#fee2e2' : '#dcfce7',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}>
                            {freqGeral}%
                          </span>
                          <div style={{ width: '60px', height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${freqGeral}%`, height: '100%', background: isLow ? '#ef4444' : '#10b981', borderRadius: '3px' }} />
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>--</span>
                      )}
                    </td>

                    {/* Faltas */}
                    <td style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: '13px', color: totalFaltas > 5 ? '#ef4444' : '#0f172a', fontWeight: 600 }}>{totalFaltas}</span>
                    </td>

                    {/* Justificadas */}
                    <td style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>{totalJustificadas}</span>
                    </td>

                    {/* Entrada / Frequência (Botão Único 1-Clique) */}
                    <td style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                      {diasPeriodo.map(dia => {
                        const status1 = getStatus(aluno.id, dia, '1')
                        const currentEntrada = horariosEntrada[aluno.id]?.[dia] || (origemInfoCompleta.entrada?.horario ? origemInfoCompleta.entrada.horario : '')
                        const isEditingThisEntrada = editingEntrada?.alunoId === aluno.id && editingEntrada?.dia === dia

                        return (
                          <div key={dia} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                const nextStatus: PresStatus = status1 === '-' ? 'P' : (status1 === 'P' ? 'F' : (status1 === 'F' ? 'J' : '-'))
                                const newDayTempos: Record<string, PresStatus> = {}
                                schedule.tempos.forEach(t => { newDayTempos[t.id] = nextStatus })

                                let newEntrada = horariosEntrada[aluno.id]?.[dia]
                                if (nextStatus === 'P' && !newEntrada) {
                                  const nowT = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                                  newEntrada = origemInfoCompleta.entrada?.horario || nowT
                                  setHorariosEntrada(prev => ({
                                    ...prev,
                                    [aluno.id]: { ...(prev[aluno.id] || {}), [dia]: newEntrada! }
                                  }))
                                }

                                schedule.tempos.forEach(t => setStatus(aluno.id, dia, t.id, nextStatus))
                                autoSaveStudent(aluno.id, dia, newDayTempos, newEntrada)
                              }}
                              style={{
                                padding: '8px 18px', borderRadius: '10px', fontWeight: 900, fontSize: '13px', cursor: 'pointer',
                                border: status1 === 'P' ? '1px solid #bbf7d0' : (status1 === 'F' ? '1px solid #fecaca' : (status1 === 'J' ? '1px solid #fde68a' : '1px dashed #cbd5e1')),
                                background: status1 === 'P' ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)' : (status1 === 'F' ? 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)' : (status1 === 'J' ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' : '#f8fafc')),
                                color: status1 === 'P' ? '#15803d' : (status1 === 'F' ? '#b91c1c' : (status1 === 'J' ? '#b45309' : '#64748b')),
                                boxShadow: status1 === 'P' ? '0 2px 8px rgba(34, 197, 94, 0.2)' : 'none',
                                transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: '6px'
                              }}
                            >
                              {status1 === 'P' && <CheckCircle size={16} />}
                              {status1 === 'F' && <XCircle size={16} />}
                              {status1 === 'J' && <AlertTriangle size={16} />}
                              <span>
                                {status1 === 'P' ? 'PRESENTE' : (status1 === 'F' ? 'FALTOSO' : (status1 === 'J' ? 'JUSTIFICADO' : 'DEFINIR FREQUÊNCIA'))}
                              </span>
                            </button>

                            {status1 === 'P' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {isEditingThisEntrada ? (
                                  <input
                                    type="time"
                                    autoFocus
                                    value={currentEntrada || '07:30'}
                                    onBlur={() => setEditingEntrada(null)}
                                    onChange={e => {
                                      const v = e.target.value
                                      setHorariosEntrada(prev => ({
                                        ...prev,
                                        [aluno.id]: { ...(prev[aluno.id] || {}), [dia]: v }
                                      }))
                                      autoSaveStudent(aluno.id, dia, undefined, v)
                                    }}
                                    style={{ padding: '2px 6px', borderRadius: '6px', border: '1px solid #2563eb', fontSize: '11px', fontWeight: 800, width: '90px' }}
                                  />
                                ) : (
                                  <span
                                    onClick={() => setEditingEntrada({ alunoId: aluno.id, dia })}
                                    title="Clique para editar o horário de entrada"
                                    style={{
                                      cursor: 'pointer', fontSize: '11px', fontWeight: 800, color: '#0369a1',
                                      background: '#e0f2fe', padding: '2px 8px', borderRadius: '6px', border: '1px solid #7dd3fc',
                                      display: 'inline-flex', alignItems: 'center', gap: '4px'
                                    }}
                                  >
                                    <Clock size={12} />
                                    <span>Entrou: {currentEntrada || '07:30'}h</span>
                                    <Edit3 size={10} style={{ opacity: 0.7 }} />
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </td>

                    {/* Saída do Aluno & Retirada (/chamadas) */}
                    <td style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9', borderTopRightRadius: '10px', borderBottomRightRadius: '10px' }}>
                      {diasPeriodo.map(dia => {
                        const status1 = getStatus(aluno.id, dia, '1')
                        const hSaida = horariosSaida[aluno.id]?.[dia]
                        const rSaida = responsaveisSaida[aluno.id]?.[dia]

                        if (status1 !== 'P') {
                          return <span key={dia} style={{ color: '#cbd5e1', fontSize: '12px' }}>—</span>
                        }

                        if (hSaida && rSaida) {
                          return (
                            <div key={dia} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                              <span style={{
                                background: 'linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%)',
                                color: '#c026d3', border: '1px solid #f5d0fe', borderRadius: '10px',
                                padding: '6px 12px', fontSize: '11px', fontWeight: 800,
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                boxShadow: '0 2px 6px rgba(192, 38, 211, 0.12)'
                              }}>
                                <CheckCircle2 size={14} style={{ color: '#c026d3' }} />
                                <span>Saiu às {hSaida}h</span>
                              </span>
                              <span style={{ fontSize: '11px', color: '#475569', fontWeight: 700 }}>
                                Retirado por: <strong style={{ color: '#0f172a' }}>{rSaida}</strong>
                              </span>

                              <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSaidaModalHora(hSaida)
                                    setSaidaModalResponsavel(rSaida)
                                    setSaidaModalData({ aluno, dia })
                                  }}
                                  style={{ fontSize: '10px', fontWeight: 800, background: '#f1f5f9', color: '#2563eb', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '2px 6px', cursor: 'pointer' }}
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`Deseja cancelar o registro de saída de ${aluno.nome}?`)) {
                                      handleCancelarSaidaInfantil(aluno, dia)
                                    }
                                  }}
                                  style={{ fontSize: '10px', fontWeight: 800, background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '6px', padding: '2px 6px', cursor: 'pointer' }}
                                >
                                  Cancelar Saída
                                </button>
                              </div>
                            </div>
                          )
                        }

                        return (
                          <div key={dia} style={{ display: 'flex', justifyContent: 'center' }}>
                            <button
                              type="button"
                              onClick={() => {
                                const nowT = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                                setSaidaModalHora(nowT)
                                const guardias = getStudentGuardians(aluno, allResponsaveisList)
                                setSaidaModalResponsavel(guardias.length > 0 ? `${guardias[0].name} (${guardias[0].role})` : '')
                                setCustomResponsavel('')
                                setSaidaModalData({ aluno, dia })
                              }}
                              style={{
                                padding: '8px 16px', borderRadius: '10px', fontWeight: 800, fontSize: '12px',
                                background: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)', color: '#fff',
                                border: 'none', cursor: 'pointer', boxShadow: '0 3px 10px rgba(147, 51, 234, 0.25)',
                                display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s'
                              }}
                              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                            >
                              <LogOut size={14} />
                              <span>Registrar Saída</span>
                            </button>
                          </div>
                        )
                      })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      {renderRegrasModal(showRegrasModal, () => setShowRegrasModal(false))}
      {renderRelatorioModal()}
      {renderRegistroManualModal()}
      {renderSaidaModal()}
      <SyncAcessosModal 
        isOpen={showAcessosModal} 
        onClose={() => setShowAcessosModal(false)}
        initialStartDate={today}
        initialEndDate={today}
        onSuccess={() => {
          if (refetchAllFreqs) refetchAllFreqs()
          if (turmaSel && refetchFreq) refetchFreq()
          if (refetchSaidaCalls) refetchSaidaCalls()
        }}
      />
    </div>
  )
}
