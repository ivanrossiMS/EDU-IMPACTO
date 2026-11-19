'use client'

import React, { useState, useEffect, useMemo, useRef, useId, useCallback } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  FileSpreadsheet,
  FileBadge2,
  CalendarClock,
  UserCheck,
  Printer,
  Copy,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Clock,
  SlidersHorizontal,
  PenTool,
  History,
} from 'lucide-react'
import { apiFetch } from '@/lib/api/apiClient'
import { supabase } from '@/lib/supabase'
import { getInitials } from '@/lib/utils'
import { ESTILOS_CHANCELA, carregarFontesCaligraficas } from '@/lib/contracts/sealUtils'
import { SCHOOL_TIMEZONE, formatDateTimeSchoolBR } from '@/lib/autorizacoes/saidaSozinhoUtils'

interface AdminSaidaRegistro {
  id: string
  protocolo: string
  hashVerificacao: string
  acao: string
  autorizado: boolean
  atualAutorizado: boolean
  isRegistroVigente: boolean
  isHoje: boolean
  dataHoraIso: string
  dataHoraFormatada: string
  alunoId: string
  alunoNome: string
  alunoMatricula: string
  alunoTurma: string
  alunoFoto: string | null
  assinanteId: string
  assinanteNome: string
  assinanteParentesco: string
  assinanteEmail: string
  assinanteCpfMascarado: string
  tipoAssinatura: 'manual' | 'caligrafica' | 'institucional'
  estiloCaligrafico?: string
  assinaturaTexto?: string
  assinaturaSvgPath?: string | null
  assinaturaBase64?: string | null
  observacoes?: string
  termoAceite?: string
  origem: 'agenda_digital' | 'gestao_alunos'
}

function escapeHtml(text?: string | null): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function legacyCopyText(text: string): boolean {
  const field = Object.assign(document.createElement('textarea'), { value: text })
  field.setAttribute('readonly', '')
  field.style.cssText = 'position:fixed;inset-block-start:0;opacity:0'
  document.body.append(field)
  field.select()
  try {
    return document.execCommand('copy')
  } finally {
    field.remove()
  }
}

export default function ADAdminAutorizacoesPage() {
  const [viewMode, setViewMode] = useState<'registros' | 'alunos'>('registros')
  const [decisaoFiltro, setDecisaoFiltro] = useState<'todos' | 'autorizado' | 'desautorizado'>('todos')
  const [turmaFiltro, setTurmaFiltro] = useState<string>('todas')
  const [periodoFiltro, setPeriodoFiltro] = useState<'todos' | 'hoje' | '7d' | '30d'>('todos')
  const [incluirSecretaria, setIncluirSecretaria] = useState<boolean>(false)
  const [busca, setBusca] = useState<string>('')
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(20)

  const [selectedRegistro, setSelectedRegistro] = useState<AdminSaidaRegistro | null>(null)
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const dialogTitleId = useId()
  const searchInputId = useId()
  const turmaSelectId = useId()
  const periodoSelectId = useId()

  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [copyStatusMsg, setCopyStatusMsg] = useState('')
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastAnnouncementRef = useRef<string>('')

  useEffect(() => {
    carregarFontesCaligraficas()
  }, [])

  const { data, isLoading, isFetching, refetch } = useQuery<{
    registros: AdminSaidaRegistro[]
    alunosStatus: AdminSaidaRegistro[]
    turmas: string[]
    stats: {
      totalRegistros: number
      totalAutorizacoes: number
      totalDesautorizacoes: number
      vigentesAutorizados: number
      vigentesDesautorizados: number
      registrosHoje: number
      alunosComRegistro: number
    }
  }>({
    queryKey: ['agenda', 'admin', 'autorizacoes-saida', incluirSecretaria],
    queryFn: async () => {
      const res = await apiFetch(
        `/api/agenda/autorizacao-saida/admin?incluir_secretaria=${incluirSecretaria ? 'true' : 'false'}`
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao carregar autorizações')
      }
      return res.json()
    },
    staleTime: 20_000,
  })

  // Atualização em tempo real quando qualquer responsável assina na Agenda Digital
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const triggerRefresh = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        refetch()
      }, 600)
    }

    const channel = supabase
      .channel('ad_admin_autorizacoes_realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'alunos' }, triggerRefresh)
      .subscribe()

    const onPullRefresh = () => {
      refetch()
    }
    window.addEventListener('ad:pull-to-refresh', onPullRefresh)

    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener('ad:pull-to-refresh', onPullRefresh)
      supabase.removeChannel(channel)
    }
  }, [refetch])

  // Reseta paginação quando filtros mudarem
  useEffect(() => {
    setPage(1)
  }, [viewMode, decisaoFiltro, turmaFiltro, periodoFiltro, busca, incluirSecretaria])

  const stats = data?.stats || {
    totalRegistros: 0,
    totalAutorizacoes: 0,
    totalDesautorizacoes: 0,
    vigentesAutorizados: 0,
    vigentesDesautorizados: 0,
    registrosHoje: 0,
    alunosComRegistro: 0,
  }

  const turmasDisponiveis = data?.turmas || []

  const activeSourceList = useMemo(() => {
    return viewMode === 'alunos' ? (data?.alunosStatus || []) : (data?.registros || [])
  }, [viewMode, data?.alunosStatus, data?.registros])

  const filteredList = useMemo(() => {
    const nowMs = Date.now()
    const q = busca.trim().toLowerCase()

    return activeSourceList.filter((item) => {
      const targetAut = viewMode === 'alunos' ? item.atualAutorizado : item.autorizado
      if (decisaoFiltro === 'autorizado' && !targetAut) return false
      if (decisaoFiltro === 'desautorizado' && targetAut) return false

      if (turmaFiltro !== 'todas' && item.alunoTurma !== turmaFiltro) return false

      if (periodoFiltro === 'hoje' && !item.isHoje) return false
      if (periodoFiltro === '7d' || periodoFiltro === '30d') {
        const ts = new Date(item.dataHoraIso || 0).getTime()
        const maxAgeMs = (periodoFiltro === '7d' ? 7 : 30) * 24 * 60 * 60 * 1000
        if (!ts || nowMs - ts > maxAgeMs) return false
      }

      if (q) {
        const haystack = [
          item.alunoNome,
          item.alunoMatricula,
          item.alunoTurma,
          item.assinanteNome,
          item.protocolo,
          item.observacoes,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }

      return true
    })
  }, [activeSourceList, viewMode, decisaoFiltro, turmaFiltro, periodoFiltro, busca])

  const totalPages = Math.max(1, Math.ceil(filteredList.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginatedList = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filteredList.slice(start, start + pageSize)
  }, [filteredList, safePage, pageSize])

  // Dialog nativo (<dialog>)
  const openComprovanteDialog = (item: AdminSaidaRegistro) => {
    setSelectedRegistro(item)
    setCopyState('idle')
    setCopyStatusMsg('')
    const dialog = dialogRef.current
    if (dialog && !dialog.open) {
      dialog.showModal()
    }
  }

  const closeComprovanteDialog = useCallback(() => {
    const dialog = dialogRef.current
    if (dialog && dialog.open) {
      dialog.close('')
    }
    setSelectedRegistro(null)
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleClose = () => {
      dialog.returnValue = ''
      setSelectedRegistro(null)
    }

    dialog.addEventListener('close', handleClose)

    let removeFallback: (() => void) | undefined
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      let pressedOutside = false
      const isOutside = (e: PointerEvent) => {
        const r = dialog.getBoundingClientRect()
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
      }
      const onPointerDown = (e: PointerEvent) => {
        if (dialog.open) pressedOutside = isOutside(e)
      }
      const onPointerUp = (e: PointerEvent) => {
        if (dialog.open && pressedOutside && isOutside(e)) {
          dialog.close('')
        }
        pressedOutside = false
      }
      dialog.addEventListener('pointerdown', onPointerDown)
      dialog.addEventListener('pointerup', onPointerUp)
      removeFallback = () => {
        dialog.removeEventListener('pointerdown', onPointerDown)
        dialog.removeEventListener('pointerup', onPointerUp)
      }
    }

    return () => {
      dialog.removeEventListener('close', handleClose)
      removeFallback?.()
    }
  }, [])

  const handleCopyProtocolo = async (text: string) => {
    if (!text) return
    clearTimeout(copyTimerRef.current ?? undefined)

    let ok = false
    try {
      await navigator.clipboard.writeText(text)
      ok = true
    } catch {
      ok = legacyCopyText(text)
    }

    let msg = ok ? 'Protocolo copiado' : 'Falha ao copiar'
    if (msg === lastAnnouncementRef.current) msg += '\u00A0'
    lastAnnouncementRef.current = msg

    setCopyState(ok ? 'copied' : 'failed')
    setCopyStatusMsg('')
    requestAnimationFrame(() => setCopyStatusMsg(msg))

    copyTimerRef.current = setTimeout(() => {
      setCopyState('idle')
      setCopyStatusMsg('')
    }, 2200)
  }

  const handleExportExcel = () => {
    if (filteredList.length === 0) {
      toast.info('Nenhum registro encontrado para exportar.')
      return
    }
    const rows = filteredList.map((r) => ({
      Protocolo: r.protocolo,
      DataHora: r.dataHoraFormatada,
      Aluno: r.alunoNome,
      Matricula: r.alunoMatricula,
      Turma: r.alunoTurma,
      Decisao: r.autorizado ? 'Autorizado a sair sozinho' : 'Desautorizado (requer acompanhante)',
      StatusAtualNaEscola: r.atualAutorizado ? 'Pode sair sozinho' : 'Saída restrita',
      ResponsavelSignatario: r.assinanteNome,
      Parentesco: r.assinanteParentesco,
      CPFMascarado: r.assinanteCpfMascarado || '-',
      Origem: r.origem === 'agenda_digital' ? 'Agenda Digital (Responsável)' : 'Secretaria / Gestão',
      Observacao: r.observacoes || '',
      HashVerificacao: r.hashVerificacao,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'AutorizacoesSaida')
    const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: SCHOOL_TIMEZONE }).format(new Date())
    XLSX.writeFile(wb, `autorizacoes_saida_sozinho_${ymd}.xlsx`)
    toast.success('Planilha exportada com sucesso!')
  }

  const handlePrintComprovante = (item: AdminSaidaRegistro) => {
    if (typeof window === 'undefined') return
    const sigHtml =
      item.tipoAssinatura === 'manual' && item.assinaturaSvgPath
        ? `<svg viewBox="0 0 500 140" style="width:260px;height:74px;display:block;margin:0 auto;"><path d="${escapeHtml(
            item.assinaturaSvgPath
          )}" fill="none" stroke="#0f2757" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" /></svg>`
        : item.assinaturaBase64
          ? `<img src="${escapeHtml(item.assinaturaBase64)}" alt="Assinatura" style="max-height:74px;max-width:260px;display:block;margin:0 auto;object-fit:contain;" />`
          : `<div style="font-family:${
              item.estiloCaligrafico === 'formal' ? 'Georgia, serif' : "'Dancing Script', cursive, serif"
            };font-size:28px;font-style:italic;color:#0f2757;padding:12px 0;">${escapeHtml(
              item.assinaturaTexto || item.assinanteNome
            )}</div>`

    const statusColor = item.autorizado ? '#047857' : '#be123c'
    const statusBg = item.autorizado ? '#ecfdf5' : '#fff1f2'
    const statusLabel = item.autorizado
      ? 'AUTORIZADO A SAIR SOZINHO'
      : 'SAÍDA RESTRITA (DESAUTORIZADO)'

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Comprovante ${escapeHtml(item.protocolo)} - Colégio Impacto</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Inter:wght@400;600;700;800&display=swap" />
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; color: #0f172a; margin: 0; padding: 32px; background: #fff; }
    .sheet { max-width: 720px; margin: 0 auto; border: 1.5px solid #cbd5e1; border-radius: 16px; overflow: hidden; }
    .top { background: linear-gradient(135deg, #312e81 0%, #4f46e5 100%); color: #fff; padding: 22px 26px; display: flex; justify-content: space-between; align-items: center; }
    .top h1 { margin: 0; font-size: 18px; font-weight: 800; }
    .top p { margin: 4px 0 0; font-size: 12px; opacity: 0.9; }
    .proto { font-family: monospace; font-size: 12px; background: rgba(255,255,255,0.16); padding: 6px 10px; border-radius: 8px; }
    .body { padding: 24px 26px; }
    .badge { display: inline-block; padding: 7px 14px; border-radius: 999px; font-size: 12px; font-weight: 800; color: ${statusColor}; background: ${statusBg}; border: 1px solid ${statusColor}33; margin-bottom: 18px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; }
    .cell { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px; }
    .lbl { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; }
    .val { font-size: 13.5px; font-weight: 700; color: #0f172a; margin-top: 3px; }
    .term { font-size: 12.5px; line-height: 1.55; color: #334155; background: #f8fafc; border-left: 3px solid #4f46e5; padding: 12px 14px; border-radius: 6px; margin-bottom: 22px; }
    .sig-box { border: 1px dashed #94a3b8; border-radius: 12px; padding: 16px; text-align: center; background: #fff; }
    .sig-line { border-top: 1px solid #cbd5e1; max-width: 320px; margin: 10px auto 0; padding-top: 6px; font-size: 12px; font-weight: 700; color: #334155; }
    .foot { font-size: 10.5px; color: #64748b; margin-top: 18px; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 12px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="top">
      <div>
        <h1>Colégio Impacto — Comprovante Oficial de Saída</h1>
        <p>Registro eletrônico assinado na Agenda Digital</p>
      </div>
      <div class="proto">${escapeHtml(item.protocolo)}</div>
    </div>
    <div class="body">
      <div class="badge">${statusLabel}</div>
      <div class="grid">
        <div class="cell"><div class="lbl">Aluno(a)</div><div class="val">${escapeHtml(item.alunoNome)} (${escapeHtml(item.alunoTurma)})</div></div>
        <div class="cell"><div class="lbl">Matrícula</div><div class="val">#${escapeHtml(item.alunoMatricula)}</div></div>
        <div class="cell"><div class="lbl">Responsável Signatário</div><div class="val">${escapeHtml(item.assinanteNome)} ${item.assinanteCpfMascarado ? `• CPF ${escapeHtml(item.assinanteCpfMascarado)}` : ''}</div></div>
        <div class="cell"><div class="lbl">Data e Hora (MS)</div><div class="val">${escapeHtml(item.dataHoraFormatada)}</div></div>
      </div>
      ${item.termoAceite ? `<div class="term">${escapeHtml(item.termoAceite)}</div>` : ''}
      ${item.observacoes ? `<div class="cell" style="margin-bottom:18px;"><div class="lbl">Observação</div><div class="val" style="font-weight:600;">${escapeHtml(item.observacoes)}</div></div>` : ''}
      <div class="sig-box">
        ${sigHtml}
        <div class="sig-line">${escapeHtml(item.assinanteNome)} (${escapeHtml(item.assinanteParentesco)})</div>
      </div>
      <div class="foot">
        <span>Hash SHA-256: <strong>${escapeHtml(item.hashVerificacao)}</strong></span>
        <span>Impresso em ${escapeHtml(formatDateTimeSchoolBR(new Date().toISOString()))}</span>
      </div>
    </div>
  </div>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };</script>
</body>
</html>`

    const win = window.open('', '_blank', 'width=820,height=720')
    if (win) {
      win.document.open()
      win.document.write(html)
      win.document.close()
    } else {
      toast.error('Permita pop-ups para imprimir ou salvar o comprovante em PDF.')
    }
  }

  const renderSignaturePreview = (item: AdminSaidaRegistro) => {
    if (item.tipoAssinatura === 'manual' && item.assinaturaSvgPath) {
      return (
        <svg
          viewBox="0 0 500 140"
          role="img"
          aria-label={`Assinatura manuscrita de ${item.assinanteNome}`}
          style={{ width: '100%', maxWidth: 280, height: 76, display: 'block', margin: '0 auto' }}
        >
          <path
            d={item.assinaturaSvgPath}
            fill="none"
            stroke="#0f2757"
            strokeWidth={3.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    }
    if (item.assinaturaBase64) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.assinaturaBase64}
          alt={`Assinatura digital de ${item.assinanteNome}`}
          style={{ maxHeight: 76, maxWidth: 280, display: 'block', margin: '0 auto', objectFit: 'contain' }}
        />
      )
    }
    if (item.tipoAssinatura === 'caligrafica') {
      const cfg = ESTILOS_CHANCELA.find((e) => e.id === item.estiloCaligrafico) || ESTILOS_CHANCELA[0]
      return (
        <div
          style={{
            fontFamily: cfg.font,
            fontSize: 'clamp(22px, 4vw, 28px)',
            fontStyle: 'italic',
            fontWeight: 700,
            color: '#0f2757',
            padding: '10px 8px',
            textAlign: 'center',
          }}
        >
          {item.assinaturaTexto || item.assinanteNome}
        </div>
      )
    }
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px',
          borderRadius: 10,
          background: '#eef2ff',
          border: '1px solid #c7d2fe',
          color: '#3730a3',
          fontSize: 12.5,
          fontWeight: 800,
        }}
      >
        <ShieldCheck size={16} aria-hidden="true" />
        <span>Alteração via Gestão Escolar — {item.assinanteNome}</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontFamily: 'Outfit, Inter, sans-serif' }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .ad-aut-kpis {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 12px;
            }
            .ad-aut-filters {
              display: flex;
              flex-wrap: wrap;
              align-items: center;
              gap: 10px;
            }
            .ad-aut-dialog {
              margin: auto;
              padding: 0;
              border: none;
              border-radius: 24px;
              width: min(580px, calc(100vw - 24px));
              max-height: 90dvh;
              background: #ffffff;
              box-shadow: 0 28px 65px -16px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(15, 23, 42, 0.08);
              overflow: hidden;
              font-family: 'Outfit', Inter, system-ui, sans-serif;
            }
            .ad-aut-dialog[open] {
              display: flex;
              flex-direction: column;
            }
            .ad-aut-dialog:modal {
              overscroll-behavior: contain;
            }
            .ad-aut-dialog::backdrop {
              overflow: hidden;
              overscroll-behavior: contain;
              background: rgba(15, 23, 42, 0.65);
              backdrop-filter: blur(6px);
              -webkit-backdrop-filter: blur(6px);
            }
            .ad-aut-focusable:focus-visible {
              outline: 3px solid #4f46e5;
              outline-offset: 2px;
            }
            .ad-aut-copy-btn {
              min-inline-size: 28px;
              min-block-size: 28px;
              padding: 4px 10px;
              border-radius: 8px;
              border: 1px solid #cbd5e1;
              background: #ffffff;
              color: #334155;
              font-size: 11px;
              font-weight: 700;
              cursor: pointer;
              display: inline-flex;
              align-items: center;
              gap: 5px;
            }
            .ad-aut-copy-btn[data-copied] {
              background: #ecfdf5;
              border-color: #6ee7b7;
              color: #047857;
            }
            .ad-aut-copy-btn[data-failed] {
              background: #fef2f2;
              border-color: #fca5a5;
              color: #b91c1c;
            }
            .ad-aut-copy-tip {
              font-size: 11px;
              font-weight: 700;
              color: #047857;
              opacity: 0;
              transition: opacity 0.15s ease;
              white-space: nowrap;
            }
            .ad-aut-copy-tip.visible { opacity: 1; }
            .ad-aut-copy-tip.failed { color: #b91c1c; }
            @media (max-width: 960px) {
              .ad-aut-kpis {
                grid-template-columns: repeat(2, minmax(0, 1fr));
              }
            }
            @media (max-width: 600px) {
              .ad-aut-kpis {
                grid-template-columns: 1fr 1fr;
                gap: 10px;
              }
              .ad-aut-card-row {
                flex-direction: column;
                align-items: flex-start !important;
              }
              .ad-aut-card-actions {
                width: 100%;
                justify-content: space-between !important;
              }
            }
          `,
        }}
      />

      {/* Cabeçalho Principal */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 20,
          padding: '18px 22px',
          boxShadow: '0 4px 18px -6px rgba(15, 23, 42, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 15,
              background: 'linear-gradient(135deg, #4f46e5 0%, #10b981 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 18px -4px rgba(79, 70, 229, 0.3)',
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={22} strokeWidth={2.3} aria-hidden="true" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: 19, fontWeight: 900, color: '#0f172a', lineHeight: 1.2 }}>
                Autorizações de Saída Sozinho
              </h1>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: 999,
                  background: '#eef2ff',
                  color: '#4338ca',
                  border: '1px solid #e0e7ff',
                }}
              >
                {filteredList.length} {filteredList.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: 12.5, color: '#64748b', fontWeight: 500 }}>
              Autorizações e desautorizações assinadas digitalmente pelos responsáveis na Agenda Digital.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleExportExcel}
            className="ad-aut-focusable"
            style={{
              minHeight: 38,
              padding: '0 14px',
              borderRadius: 11,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <FileSpreadsheet size={15} color="#059669" aria-hidden="true" />
            <span>Exportar Excel</span>
          </button>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="ad-aut-focusable"
            style={{
              minHeight: 38,
              padding: '0 14px',
              borderRadius: 11,
              border: 'none',
              background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
              color: '#ffffff',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: isFetching ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 6px 14px -4px rgba(79, 70, 229, 0.35)',
            }}
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} aria-hidden="true" />
            <span>{isFetching ? 'Atualizando...' : 'Atualizar'}</span>
          </button>
        </div>
      </div>

      {/* KPIs Leves */}
      <div className="ad-aut-kpis">
        {[
          {
            label: 'Total na Agenda Digital',
            value: stats.totalRegistros,
            sub: `${stats.totalAutorizacoes} aut. • ${stats.totalDesautorizacoes} desaut.`,
            color: '#4f46e5',
            bg: '#eef2ff',
            icon: <History size={17} aria-hidden="true" />,
          },
          {
            label: 'Autorizados Vigentes',
            value: stats.vigentesAutorizados,
            sub: 'Podem sair sozinhos atualmente',
            color: '#059669',
            bg: '#ecfdf5',
            icon: <CheckCircle2 size={17} aria-hidden="true" />,
          },
          {
            label: 'Desautorizados Vigentes',
            value: stats.vigentesDesautorizados,
            sub: 'Requerem acompanhante na saída',
            color: '#e11d48',
            bg: '#fff1f2',
            icon: <XCircle size={17} aria-hidden="true" />,
          },
          {
            label: 'Assinaturas Hoje',
            value: stats.registrosHoje,
            sub: 'Movimentações registradas hoje',
            color: '#0284c7',
            bg: '#e0f2fe',
            icon: <CalendarClock size={17} aria-hidden="true" />,
          },
        ].map((kpi, idx) => (
          <div
            key={idx}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 16,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              boxShadow: '0 2px 10px -4px rgba(15, 23, 42, 0.04)',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: '#64748b',
                }}
              >
                {kpi.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: kpi.color, lineHeight: 1.15, marginTop: 4 }}>
                {kpi.value}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginTop: 2 }}>
                {kpi.sub}
              </div>
            </div>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: kpi.bg,
                color: kpi.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {kpi.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Barra de Filtros e Modos */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 18,
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          boxShadow: '0 2px 10px -4px rgba(15, 23, 42, 0.04)',
        }}
      >
        {/* Linha 1: Abas de Visão + Toggle Secretaria + Paginação */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div
            role="tablist"
            aria-label="Modo de visualização"
            style={{
              display: 'inline-flex',
              background: '#f1f5f9',
              padding: 4,
              borderRadius: 12,
              gap: 4,
            }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'registros'}
              onClick={() => setViewMode('registros')}
              className="ad-aut-focusable"
              style={{
                padding: '7px 14px',
                borderRadius: 9,
                border: 'none',
                background: viewMode === 'registros' ? '#ffffff' : 'transparent',
                color: viewMode === 'registros' ? '#0f172a' : '#64748b',
                fontSize: 12.5,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: viewMode === 'registros' ? '0 2px 6px rgba(15,23,42,0.08)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <History size={14} aria-hidden="true" />
              <span>Movimentações ({data?.registros?.length || 0})</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'alunos'}
              onClick={() => setViewMode('alunos')}
              className="ad-aut-focusable"
              style={{
                padding: '7px 14px',
                borderRadius: 9,
                border: 'none',
                background: viewMode === 'alunos' ? '#ffffff' : 'transparent',
                color: viewMode === 'alunos' ? '#0f172a' : '#64748b',
                fontSize: 12.5,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: viewMode === 'alunos' ? '0 2px 6px rgba(15,23,42,0.08)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <UserCheck size={14} aria-hidden="true" />
              <span>Por Aluno ({data?.alunosStatus?.length || 0})</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 12,
                fontWeight: 700,
                color: '#475569',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={incluirSecretaria}
                onChange={(e) => setIncluirSecretaria(e.target.checked)}
                style={{ width: 15, height: 15, accentColor: '#4f46e5', cursor: 'pointer' }}
              />
              <span>Incluir alterações da Secretaria</span>
            </label>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {[10, 20, 50].map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setPageSize(sz)}
                  className="ad-aut-focusable"
                  style={{
                    padding: '4px 9px',
                    borderRadius: 8,
                    border: '1px solid',
                    borderColor: pageSize === sz ? '#4f46e5' : '#e2e8f0',
                    background: pageSize === sz ? '#eef2ff' : '#ffffff',
                    color: pageSize === sz ? '#4338ca' : '#64748b',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {sz}
                </button>
              ))}
              <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginLeft: 2 }}>/ pág</span>
            </div>
          </div>
        </div>

        {/* Linha 2: Chips de Decisão + Turma + Período + Busca */}
        <div className="ad-aut-filters">
          <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { id: 'todos' as const, label: 'Todas', color: '#334155', bg: '#f1f5f9', border: '#cbd5e1' },
              { id: 'autorizado' as const, label: 'Autorizados', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
              { id: 'desautorizado' as const, label: 'Desautorizados', color: '#be123c', bg: '#fff1f2', border: '#fecdd3' },
            ].map((pill) => {
              const active = decisaoFiltro === pill.id
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setDecisaoFiltro(pill.id)}
                  className="ad-aut-focusable"
                  style={{
                    minHeight: 36,
                    padding: '0 12px',
                    borderRadius: 10,
                    border: `1.5px solid ${active ? pill.border : '#e2e8f0'}`,
                    background: active ? pill.bg : '#ffffff',
                    color: active ? pill.color : '#64748b',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  {pill.id === 'autorizado' && <CheckCircle2 size={13} color="#10b981" aria-hidden="true" />}
                  {pill.id === 'desautorizado' && <XCircle size={13} color="#ef4444" aria-hidden="true" />}
                  <span>{pill.label}</span>
                </button>
              )
            })}
          </div>

          <select
            id={turmaSelectId}
            aria-label="Filtrar por turma"
            value={turmaFiltro}
            onChange={(e) => setTurmaFiltro(e.target.value)}
            className="ad-aut-focusable"
            style={{
              minHeight: 36,
              padding: '0 12px',
              borderRadius: 10,
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: '#0f172a',
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            <option value="todas">Todas as Turmas</option>
            {turmasDisponiveis.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            id={periodoSelectId}
            aria-label="Filtrar por período"
            value={periodoFiltro}
            onChange={(e) => setPeriodoFiltro(e.target.value as any)}
            className="ad-aut-focusable"
            style={{
              minHeight: 36,
              padding: '0 12px',
              borderRadius: 10,
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: '#0f172a',
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            <option value="todos">Todo o período</option>
            <option value="hoje">Somente hoje</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
          </select>

          <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
            <label htmlFor={searchInputId} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>
              Buscar por aluno, matrícula, responsável ou protocolo
            </label>
            <Search
              size={15}
              color="#94a3b8"
              aria-hidden="true"
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            />
            <input
              id={searchInputId}
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar aluno, matrícula, responsável ou protocolo..."
              className="ad-aut-focusable"
              style={{
                width: '100%',
                minHeight: 36,
                padding: '0 12px 0 36px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#0f172a',
                fontSize: 12.5,
                fontWeight: 600,
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      </div>

      {/* Lista de Autorizações & Desautorizações */}
      {isLoading ? (
        <div
          style={{
            background: '#ffffff',
            borderRadius: 20,
            border: '1px solid #e2e8f0',
            padding: 48,
            textAlign: 'center',
            color: '#64748b',
            fontSize: 13.5,
            fontWeight: 600,
          }}
        >
          Carregando autorizações assinadas pelos responsáveis...
        </div>
      ) : paginatedList.length === 0 ? (
        <div
          style={{
            background: '#ffffff',
            borderRadius: 20,
            border: '1px dashed #cbd5e1',
            padding: '48px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: '#f1f5f9',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SlidersHorizontal size={22} aria-hidden="true" />
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
            Nenhuma autorização encontrada com estes filtros
          </div>
          <div style={{ fontSize: 12.5, color: '#64748b', maxWidth: 420 }}>
            Quando os responsáveis autorizarem ou desautorizarem a saída sozinho pelo perfil na Agenda Digital, todos os registros com assinatura aparecerão aqui automaticamente.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {paginatedList.map((item) => {
            const isAut = viewMode === 'alunos' ? item.atualAutorizado : item.autorizado
            return (
              <div
                key={item.id}
                className="ad-aut-card-row"
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderLeft: `4px solid ${isAut ? '#10b981' : '#ef4444'}`,
                  borderRadius: 18,
                  padding: '14px 18px',
                  boxShadow: '0 2px 12px -6px rgba(15, 23, 42, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
              >
                {/* Esquerda: Avatar + Dados do Aluno + Assinante */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 15,
                      background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
                      color: '#4338ca',
                      fontWeight: 900,
                      fontSize: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0,
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    {item.alunoFoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.alunoFoto}
                        alt={item.alunoNome}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      getInitials(item.alunoNome)
                    )}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    {/* Linha 1: Nome do aluno + Turma + Pill da decisão */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14.5, fontWeight: 800, color: '#0f172a' }}>
                        {item.alunoNome}
                      </span>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: '#64748b',
                          background: '#f1f5f9',
                          padding: '2px 7px',
                          borderRadius: 6,
                        }}
                      >
                        #{item.alunoMatricula}
                      </span>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 800,
                          color: '#4338ca',
                          background: '#eef2ff',
                          padding: '2px 8px',
                          borderRadius: 6,
                        }}
                      >
                        {item.alunoTurma}
                      </span>

                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 9px',
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 800,
                          background: isAut ? '#ecfdf5' : '#fff1f2',
                          color: isAut ? '#047857' : '#be123c',
                          border: `1px solid ${isAut ? '#a7f3d0' : '#fecdd3'}`,
                        }}
                      >
                        {isAut ? (
                          <CheckCircle2 size={12} color="#10b981" aria-hidden="true" />
                        ) : (
                          <XCircle size={12} color="#ef4444" aria-hidden="true" />
                        )}
                        <span>{isAut ? 'Autorizado a Sair Sozinho' : 'Desautorizado (Saída Restrita)'}</span>
                      </span>

                      {viewMode === 'registros' && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: 6,
                            background: item.isRegistroVigente ? '#f0fdfa' : '#f8fafc',
                            color: item.isRegistroVigente ? '#0f766e' : '#94a3b8',
                            border: `1px solid ${item.isRegistroVigente ? '#99f6e4' : '#e2e8f0'}`,
                          }}
                        >
                          {item.isRegistroVigente ? 'VIGENTE' : 'HISTÓRICO'}
                        </span>
                      )}

                      {item.origem === 'gestao_alunos' && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: 6,
                            background: '#fffbeb',
                            color: '#b45309',
                            border: '1px solid #fde68a',
                          }}
                        >
                          Secretaria
                        </span>
                      )}
                    </div>

                    {/* Linha 2: Signatário + Data/Hora + CPF */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        flexWrap: 'wrap',
                        marginTop: 6,
                        fontSize: 12,
                        color: '#475569',
                        fontWeight: 500,
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <PenTool size={13} color="#6366f1" aria-hidden="true" />
                        <span>
                          Por <strong style={{ color: '#0f172a' }}>{item.assinanteNome}</strong> ({item.assinanteParentesco})
                        </span>
                      </span>

                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <Clock size={13} color="#64748b" aria-hidden="true" />
                        <span>{item.dataHoraFormatada}</span>
                      </span>

                      {item.assinanteCpfMascarado && (
                        <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>
                          CPF {item.assinanteCpfMascarado}
                        </span>
                      )}
                    </div>

                    {item.observacoes && (
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 11.5,
                          color: '#92400e',
                          background: '#fffbeb',
                          border: '1px solid #fde68a',
                          borderRadius: 8,
                          padding: '4px 9px',
                          display: 'inline-block',
                        }}
                      >
                        <strong>Obs.:</strong> {item.observacoes}
                      </div>
                    )}
                  </div>
                </div>

                {/* Direita: Protocolo + Botão Ver Comprovante */}
                <div
                  className="ad-aut-card-actions"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}
                >
                  <span
                    style={{
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#475569',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      padding: '5px 9px',
                      borderRadius: 8,
                    }}
                  >
                    {item.protocolo}
                  </span>

                  <button
                    type="button"
                    onClick={() => openComprovanteDialog(item)}
                    className="ad-aut-focusable"
                    style={{
                      minHeight: 36,
                      padding: '0 13px',
                      borderRadius: 10,
                      border: '1px solid #c7d2fe',
                      background: '#eef2ff',
                      color: '#3730a3',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <FileBadge2 size={14} aria-hidden="true" />
                    <span>Ver Comprovante</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: '10px 16px',
            fontSize: 12.5,
            fontWeight: 600,
            color: '#475569',
          }}
        >
          <span>
            Página <strong>{safePage}</strong> de <strong>{totalPages}</strong> ({filteredList.length} registros)
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="ad-aut-focusable"
              style={{
                minHeight: 32,
                padding: '0 10px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
                opacity: safePage <= 1 ? 0.5 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <ChevronLeft size={14} aria-hidden="true" /> Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="ad-aut-focusable"
              style={{
                minHeight: 32,
                padding: '0 10px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
                opacity: safePage >= totalPages ? 0.5 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              Próxima <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Modal Nativo <dialog> do Comprovante Completo */}
      <dialog
        ref={dialogRef}
        className="ad-aut-dialog"
        aria-labelledby={dialogTitleId}
        {...({ closedby: 'any' } as any)}
      >
        {selectedRegistro && (
          <>
            <div
              style={{
                padding: '18px 22px',
                borderBottom: '1px solid #f1f5f9',
                background: selectedRegistro.autorizado
                  ? 'linear-gradient(135deg, #ecfdf5 0%, #f0fdfa 100%)'
                  : 'linear-gradient(135deg, #fff1f2 0%, #fef2f2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FileBadge2
                  size={22}
                  color={selectedRegistro.autorizado ? '#059669' : '#e11d48'}
                  aria-hidden="true"
                />
                <div>
                  <h2
                    id={dialogTitleId}
                    style={{ margin: 0, fontSize: 16.5, fontWeight: 900, color: '#0f172a' }}
                  >
                    Comprovante de {selectedRegistro.autorizado ? 'Autorização' : 'Desautorização'}
                  </h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                    {selectedRegistro.alunoNome} • #{selectedRegistro.alunoMatricula} • {selectedRegistro.alunoTurma}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeComprovanteDialog}
                aria-label="Fechar comprovante"
                className="ad-aut-focusable"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: '#64748b',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>

            <div style={{ padding: '18px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Protocolo + Copiar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  flexWrap: 'wrap',
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    Protocolo:
                  </span>
                  <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, fontWeight: 800, color: '#0f172a' }}>
                    {selectedRegistro.protocolo}
                  </span>
                </div>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => handleCopyProtocolo(selectedRegistro.protocolo)}
                    aria-label={`Copiar protocolo ${selectedRegistro.protocolo}`}
                    className="ad-aut-copy-btn ad-aut-focusable"
                    data-copied={copyState === 'copied' ? '' : undefined}
                    data-failed={copyState === 'failed' ? '' : undefined}
                  >
                    {copyState === 'copied' ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                    <span>{copyState === 'copied' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                  <span
                    className={`ad-aut-copy-tip ${copyStatusMsg ? 'visible' : ''} ${copyState === 'failed' ? 'failed' : ''}`}
                    role="status"
                  >
                    {copyStatusMsg}
                  </span>
                </div>
              </div>

              {/* Grid de Metadados */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                <div style={{ padding: '10px 12px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>
                    Data e Hora (MS)
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginTop: 3 }}>
                    {selectedRegistro.dataHoraFormatada}
                  </div>
                </div>

                <div style={{ padding: '10px 12px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>
                    Responsável Signatário
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginTop: 3 }}>
                    {selectedRegistro.assinanteNome} ({selectedRegistro.assinanteParentesco})
                  </div>
                </div>

                <div style={{ padding: '10px 12px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>
                    Decisão Registrada
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: selectedRegistro.autorizado ? '#047857' : '#be123c',
                      marginTop: 3,
                    }}
                  >
                    {selectedRegistro.autorizado ? 'Autorizado a sair sozinho' : 'Desautorizado (saída restrita)'}
                  </div>
                </div>

                <div style={{ padding: '10px 12px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>
                    Autenticidade (SHA-256)
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11.5, fontWeight: 700, color: '#334155', marginTop: 3, wordBreak: 'break-all' }}>
                    {selectedRegistro.hashVerificacao || 'N/D'}
                    {selectedRegistro.assinanteCpfMascarado ? ` • CPF ${selectedRegistro.assinanteCpfMascarado}` : ''}
                  </div>
                </div>
              </div>

              {selectedRegistro.termoAceite && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: '#f8fafc',
                    borderLeft: '3px solid #4f46e5',
                    fontSize: 12,
                    color: '#334155',
                    lineHeight: 1.5,
                  }}
                >
                  {selectedRegistro.termoAceite}
                </div>
              )}

              {selectedRegistro.observacoes && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#92400e',
                  }}
                >
                  <strong>Observação:</strong> {selectedRegistro.observacoes}
                </div>
              )}

              {/* Assinatura */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 16,
                  border: '1px dashed #cbd5e1',
                  background: '#ffffff',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginBottom: 8 }}>
                  Assinatura Digital
                </div>
                <div style={{ minHeight: 76, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {renderSignaturePreview(selectedRegistro)}
                </div>
                <div style={{ borderTop: '1px solid #cbd5e1', maxWidth: 300, margin: '8px auto 0', paddingTop: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                  {selectedRegistro.assinanteNome}
                </div>
              </div>
            </div>

            <div
              style={{
                padding: '14px 22px',
                borderTop: '1px solid #f1f5f9',
                background: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <Link
                href={`/agenda-digital/admin/pessoas/${encodeURIComponent(selectedRegistro.alunoId)}`}
                className="ad-aut-focusable"
                style={{
                  minHeight: 38,
                  padding: '0 14px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: 12.5,
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <ExternalLink size={14} aria-hidden="true" />
                <span>Ver Perfil do Aluno</span>
              </Link>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => handlePrintComprovante(selectedRegistro)}
                  className="ad-aut-focusable"
                  style={{
                    minHeight: 38,
                    padding: '0 14px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                    color: '#ffffff',
                    fontSize: 12.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Printer size={14} aria-hidden="true" />
                  <span>Imprimir / PDF</span>
                </button>

                <button
                  type="button"
                  onClick={closeComprovanteDialog}
                  className="ad-aut-focusable"
                  style={{
                    minHeight: 38,
                    padding: '0 14px',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </>
        )}
      </dialog>
    </div>
  )
}
