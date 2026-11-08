'use client'

import React, { useMemo, useEffect, useRef, useState } from 'react'
import {
  X,
  Printer,
  Download,
  Mail,
  MessageCircle,
  ShieldCheck,
  Copy,
  Check,
  SlidersHorizontal,
  Scissors,
  FileText,
  Receipt,
  Building2,
  CreditCard,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/lib/dataContext'
import {
  resolveMetodosPagamentoEscolares,
  resolveUnidadesEscolares,
} from '@/app/(app)/financeiro/pagar/types'
import QRCode from 'qrcode'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReceiptParcela {
  num: number
  evento?: string
  competencia?: string
  vencimento: string
  valor: number
  desconto: number
  valorFinal: number
  juros?: number
  multa?: number
  retencao?: number
  dtPagto?: string
  formaPagto?: string
  caixaOrigem?: string
  codBaixa?: string
  comprovante?: string
  documentoFiscal?: string
  centroCusto?: string
  categoria?: string
  obs?: string
  status?: string
  formasPagto?: Array<{ id: string; forma: string; valor: string; cartao?: any }>
}

export interface ReceiptProps {
  parcelas: ReceiptParcela[]
  aluno: {
    id?: string
    nome: string
    codigo?: string
    matricula?: string
    unidade?: string
    responsavelFinanceiro?: string
    emailResponsavelFinanceiro?: string
    telResponsavelFinanceiro?: string
    responsavel?: string
    cpf?: string
    documento?: string
    semVinculoAluno?: boolean
  }
  /** Natureza do recibo: 'receber' (entrada/mensalidade) ou 'pagar' (saída/fornecedor) */
  natureza?: 'receber' | 'pagar'
  /** Unidade da turma do aluno ou unidade do lançamento (para resolver nomeEscola/CNPJ correto) */
  turmaUnidade?: string
  onClose: () => void
  onBack?: () => void
}

export type ReceiptLayoutMode = 'a4_1via' | 'a4_2vias' | 'bobina_80mm'

// ─── Conversor para Recibo de Contas a Pagar ──────────────────────────────────

export function buildContaPagarReceiptData(
  input: any | any[]
): Omit<ReceiptProps, 'onClose' | 'onBack'> {
  const list = (Array.isArray(input) ? input : [input]).filter(Boolean)
  const first = list[0] || {}

  const parcelas: ReceiptParcela[] = list.map((c: any, idx: number) => {
    const valorBruto = Number(c.valorBase ?? c.valor ?? 0)
    const desconto = Number(c.desconto ?? 0) + Number(c.retencaoImpostos ?? 0)
    const juros = Number(c.juros ?? 0)
    const multa = Number(c.multa ?? 0)
    const valorLiquido =
      c.status === 'pago' && Number(c.valorPago) > 0
        ? Number(c.valorPago)
        : Number(c.valor ?? valorBruto)

    return {
      num: Number(c.parcelaAtual || idx + 1),
      evento: c.descricao || c.categoria || 'Despesa Escolar',
      competencia: c.competencia || (c.vencimento || '').slice(0, 7),
      vencimento: c.vencimento || new Date().toISOString().split('T')[0],
      valor: valorBruto,
      desconto,
      juros,
      multa,
      retencao: Number(c.retencaoImpostos ?? 0),
      valorFinal: valorLiquido,
      dtPagto: c.dataPagamento || new Date().toISOString().split('T')[0],
      formaPagto: c.formaPagamento || 'PIX',
      caixaOrigem: c.caixaOrigem || '',
      codBaixa: c.codigo || c.id,
      comprovante: c.comprovanteUrl || c.numeroDocumento || '',
      documentoFiscal: [c.tipoDocumento, c.numeroDocumento].filter(Boolean).join(' '),
      centroCusto: c.centroCusto || '',
      categoria: c.categoria || '',
      obs: c.observacoes || '',
      status: c.status || 'pago',
    }
  })

  return {
    natureza: 'pagar',
    turmaUnidade: first.subcategoria || undefined,
    aluno: {
      id: first.fornecedorId || first.id,
      nome: first.fornecedorNome || first.fornecedor || 'Fornecedor / Credor',
      responsavelFinanceiro: first.fornecedorNome || first.fornecedor || 'Favorecido / Credor',
      cpf: first.fornecedorDocumento || '',
      documento: first.fornecedorDocumento || '',
      codigo: first.codigo || first.id,
      unidade: first.subcategoria || first.centroCusto || '',
    },
    parcelas,
  }
}

// ─── Core Helpers & Valor por Extenso (PT-BR) ─────────────────────────────────

const fmt = (v: number) =>
  (Number(v) || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const fmtDateBR = (dateStr?: string) => {
  if (!dateStr) return new Date().toLocaleDateString('pt-BR')
  const clean = String(dateStr).slice(0, 10)
  const parts = clean.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return dateStr
}

const dateByExt = (dateStr: string) => {
  const meses = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ]
  try {
    const clean = String(dateStr).slice(0, 10)
    const d = new Date(`${clean}T12:00:00`)
    if (isNaN(d.getTime())) return dateStr
    return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`
  } catch {
    return dateStr
  }
}

const today = () => new Date().toLocaleDateString('pt-BR')
const todayISO = () => new Date().toISOString().split('T')[0]

const generateUUID = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16).toUpperCase()
  })

const receiptNumber = (ref: ReceiptParcela) => {
  if (ref.codBaixa) {
    const digits = ref.codBaixa.replace(/\D/g, '')
    if (digits.length >= 3) return digits.slice(-8).padStart(8, '0')
  }
  return String(Date.now()).slice(-8)
}

/**
 * Converte um valor numérico em Reais (R$) para sua representação por extenso em português.
 */
export function valorPorExtenso(valor: number): string {
  const safeVal = Math.max(0, Math.round((Number(valor) || 0) * 100) / 100)
  if (safeVal === 0) return 'zero reais'

  const unidades = [
    '',
    'um',
    'dois',
    'três',
    'quatro',
    'cinco',
    'seis',
    'sete',
    'oito',
    'nove',
    'dez',
    'onze',
    'doze',
    'treze',
    'quatorze',
    'quinze',
    'dezesseis',
    'dezessete',
    'dezoito',
    'dezenove',
  ]
  const dezenas = [
    '',
    '',
    'vinte',
    'trinta',
    'quarenta',
    'cinquenta',
    'sessenta',
    'setenta',
    'oitenta',
    'noventa',
  ]
  const centenas = [
    '',
    'cento',
    'duzentos',
    'trezentos',
    'quatrocentos',
    'quinhentos',
    'seiscentos',
    'setecentos',
    'oitocentos',
    'novecentos',
  ]

  const trioParaExtenso = (n: number): string => {
    if (n === 0) return ''
    if (n === 100) return 'cem'
    const c = Math.floor(n / 100)
    const r = n % 100
    const d = Math.floor(r / 10)
    const u = r % 10

    const partes: string[] = []
    if (c > 0) partes.push(centenas[c])
    if (r > 0) {
      if (r < 20) {
        partes.push(unidades[r])
      } else {
        partes.push(dezenas[d])
        if (u > 0) partes.push(unidades[u])
      }
    }
    return partes.join(' e ')
  }

  const inteiro = Math.floor(safeVal)
  const centavos = Math.round((safeVal - inteiro) * 100)

  const partesInteiro: string[] = []
  if (inteiro > 0) {
    const milhoes = Math.floor(inteiro / 1_000_000)
    const milhares = Math.floor((inteiro % 1_000_000) / 1_000)
    const resto = inteiro % 1_000

    if (milhoes > 0) {
      partesInteiro.push(
        `${trioParaExtenso(milhoes)} ${milhoes === 1 ? 'milhão' : 'milhões'}`
      )
    }
    if (milhares > 0) {
      partesInteiro.push(
        milhares === 1 ? 'mil' : `${trioParaExtenso(milhares)} mil`
      )
    }
    if (resto > 0) {
      partesInteiro.push(trioParaExtenso(resto))
    }
  }

  let resultado = ''
  if (inteiro > 0) {
    const juncoes =
      partesInteiro.length > 1
        ? `${partesInteiro.slice(0, -1).join(', ')} e ${partesInteiro[partesInteiro.length - 1]}`
        : partesInteiro[0]
    resultado = `${juncoes} ${inteiro === 1 ? 'real' : 'reais'}`
  }

  if (centavos > 0) {
    const extCent = `${trioParaExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`
    resultado = resultado ? `${resultado} e ${extCent}` : extCent
  }

  return resultado
}

// ─── Print HTML Generator (A4 1 Via, A4 2 Vias & Bobina Térmica 80mm) ────────

interface PrintRenderOptions {
  natureza: 'receber' | 'pagar'
  layoutMode: ReceiptLayoutMode
  rNum: string
  emissao: string
  nomeEscola: string
  razaoSocial?: string
  cnpjEscola: string
  logo: string | null
  endereco?: string
  cidade: string
  parteNome: string
  parteDocumento: string
  vinculoLabel: string
  formaPagto: string
  caixaOrigem: string
  dtPagtoBR: string
  idFatura: string
  observacao: string
  issuerName: string
  issuerCargo: string
  hash: string
  qrCodeDataUrl: string
  totalBruto: number
  totalDescontos: number
  totalEncargos: number
  totalPago: number
  extensoStr: string
  declaracaoTexto: string
  mostrarCarimbo: boolean
  mostrarExtenso: boolean
  mostrarAssinaturaDupla: boolean
  mostrarQrCode: boolean
  semVinculoAluno?: boolean
}

function buildSingleViaCardHTML(
  parcelas: ReceiptParcela[],
  opts: PrintRenderOptions,
  viaLabel: string,
  compact = false
) {
  const accentPrimary = opts.natureza === 'pagar' ? '#0f172a' : '#0284c7'
  const accentBadgeBg = opts.natureza === 'pagar' ? '#f1f5f9' : '#e0f2fe'
  const accentBadgeColor = opts.natureza === 'pagar' ? '#0f172a' : '#0369a1'
  const tituloRecibo =
    opts.natureza === 'pagar'
      ? 'RECIBO DE PAGAMENTO & QUITAÇÃO'
      : 'RECIBO OFICIAL DE RECEBIMENTO'
  const parteTitulo =
    opts.natureza === 'pagar' ? 'Favorecido / Credor' : 'Pagador / Responsável Financeiro'
  const secundarioTitulo =
    opts.natureza === 'pagar' || opts.semVinculoAluno
      ? 'Classificação / Centro de Custo'
      : 'Aluno / Vínculo Escolar'

  const logoHTML = opts.logo
    ? `<img src="${opts.logo}" alt="${opts.nomeEscola}" style="max-height:${compact ? '42px' : '54px'};max-width:170px;object-fit:contain;" />`
    : `<div style="font-size:${compact ? '17px' : '21px'};font-weight:900;color:#0f172a;letter-spacing:-0.03em;">${opts.nomeEscola}</div>`

  const rowsHtml = parcelas
    .map((p, i) => {
      const enc = (Number(p.juros) || 0) + (Number(p.multa) || 0)
      const desc = Number(p.desconto) || 0
      const liq = Number(p.valorFinal ?? p.valor ?? 0)
      const subMeta = [
        p.competencia ? `Comp: ${p.competencia}` : '',
        p.vencimento ? `Venc: ${fmtDateBR(p.vencimento)}` : '',
        p.documentoFiscal ? `Doc: ${p.documentoFiscal}` : '',
        p.centroCusto ? `CC: ${p.centroCusto}` : '',
      ]
        .filter(Boolean)
        .join(' • ')

      return `
        <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="width:44%;white-space:normal !important;word-break:break-word;overflow-wrap:anywhere;padding:${compact ? '7px 10px' : '10px 12px'};border-bottom:1px solid #e2e8f0;vertical-align:top;">
            <div style="font-weight:700;color:#0f172a;font-size:${compact ? '11px' : '12px'};white-space:normal !important;word-break:break-word;line-height:1.35;">${p.evento || 'Lançamento Financeiro'}</div>
            <div style="font-size:${compact ? '9.5px' : '10.5px'};color:#64748b;margin-top:3px;white-space:normal !important;word-break:break-word;line-height:1.4;">Parc. ${String(p.num || i + 1).padStart(2, '0')}${subMeta ? ` • ${subMeta}` : ''}</div>
          </td>
          <td style="width:15%;white-space:nowrap !important;text-align:right;font-family:monospace;font-size:${compact ? '11px' : '12px'};color:#334155;padding:${compact ? '7px 8px' : '10px 10px'};border-bottom:1px solid #e2e8f0;vertical-align:middle;">R$ ${fmt(p.valor)}</td>
          <td style="width:13%;white-space:nowrap !important;text-align:right;font-family:monospace;font-size:${compact ? '11px' : '12px'};color:${desc > 0 ? '#b45309' : '#94a3b8'};padding:${compact ? '7px 8px' : '10px 10px'};border-bottom:1px solid #e2e8f0;vertical-align:middle;">${desc > 0 ? `- R$ ${fmt(desc)}` : '—'}</td>
          <td style="width:12%;white-space:nowrap !important;text-align:right;font-family:monospace;font-size:${compact ? '11px' : '12px'};color:${enc > 0 ? '#be123c' : '#94a3b8'};padding:${compact ? '7px 8px' : '10px 10px'};border-bottom:1px solid #e2e8f0;vertical-align:middle;">${enc > 0 ? `+ R$ ${fmt(enc)}` : '—'}</td>
          <td style="width:16%;white-space:nowrap !important;text-align:right;font-family:monospace;font-weight:800;font-size:${compact ? '11.5px' : '12.5px'};color:#047857;padding:${compact ? '7px 10px' : '10px 12px'};border-bottom:1px solid #e2e8f0;vertical-align:middle;">R$ ${fmt(liq)}</td>
        </tr>`
    })
    .join('')

  return `
    <div class="via-card" style="background:#ffffff;border:1.5px solid #cbd5e1;border-radius:16px;overflow:hidden;position:relative;">
      <div style="height:6px;background:linear-gradient(90deg,${accentPrimary} 0%,#059669 100%);"></div>
      <div style="padding:${compact ? '18px 22px' : '28px 34px'};">
        <!-- CABEÇALHO -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:${compact ? '12px' : '18px'};border-bottom:1px solid #e2e8f0;margin-bottom:${compact ? '12px' : '18px'};">
          <div>
            ${logoHTML}
            <div style="font-size:11px;color:#475569;margin-top:4px;font-weight:700;">
              ${opts.razaoSocial && opts.razaoSocial.toLowerCase() !== opts.nomeEscola.toLowerCase() ? `${opts.nomeEscola} — ${opts.razaoSocial}` : opts.nomeEscola} ${opts.cnpjEscola && opts.cnpjEscola !== '—' ? `• CNPJ: ${opts.cnpjEscola}` : ''}
            </div>
            ${opts.endereco || opts.cidade ? `<div style="font-size:10.5px;color:#64748b;margin-top:1px;">${[opts.endereco, opts.cidade].filter(Boolean).join(' • ')}</div>` : ''}
            <div style="margin-top:8px;display:inline-flex;align-items:center;gap:6px;">
              <span style="background:${accentBadgeBg};color:${accentBadgeColor};font-size:9.5px;font-weight:800;padding:3px 10px;border-radius:99px;letter-spacing:0.06em;text-transform:uppercase;">${viaLabel}</span>
              ${
                opts.mostrarCarimbo
                  ? `<span style="background:#ecfdf5;color:#047857;border:1px solid #6ee7b7;font-size:9.5px;font-weight:900;padding:3px 10px;border-radius:99px;letter-spacing:0.06em;text-transform:uppercase;">✓ LIQUIDADO / QUITADO</span>`
                  : ''
              }
            </div>
          </div>

          <div style="text-align:right;">
            <div style="font-size:${compact ? '16px' : '20px'};font-weight:900;color:#0f172a;letter-spacing:-0.03em;">${tituloRecibo}</div>
            <div style="font-size:12px;font-weight:700;color:#334155;margin-top:4px;">Nº <span style="font-family:monospace;color:#0f172a;font-size:13px;">#${opts.rNum}</span></div>
            <div style="font-size:10.5px;color:#64748b;margin-top:2px;">Emissão: ${opts.emissao}</div>
            <div style="margin-top:8px;display:inline-block;background:#ecfdf5;border:1.5px solid #10b981;border-radius:10px;padding:${compact ? '5px 12px' : '7px 14px'};">
              <div style="font-size:8.5px;font-weight:800;text-transform:uppercase;color:#047857;letter-spacing:0.06em;">Valor Líquido Quitado</div>
              <div style="font-size:${compact ? '17px' : '21px'};font-weight:900;color:#047857;letter-spacing:-0.03em;">R$ ${fmt(opts.totalPago)}</div>
            </div>
          </div>
        </div>

        <!-- QUADRO DE IDENTIFICAÇÃO -->
        <div style="display:grid;grid-template-columns:1.25fr 1fr;gap:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:${compact ? '10px 14px' : '14px 18px'};margin-bottom:${compact ? '12px' : '16px'};font-size:${compact ? '11px' : '12px'};">
          <div>
            <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#64748b;letter-spacing:0.05em;">${parteTitulo}</div>
            <div style="font-size:${compact ? '12.5px' : '14px'};font-weight:800;color:#0f172a;margin-top:2px;">${opts.parteNome}</div>
            <div style="color:#475569;margin-top:2px;">CPF / CNPJ: <strong>${opts.parteDocumento || 'Não informado'}</strong></div>
            <div style="color:#475569;margin-top:2px;">${secundarioTitulo}: <strong>${opts.vinculoLabel || '—'}</strong></div>
          </div>
          <div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              <div>
                <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#64748b;">Data da Baixa</div>
                <div style="font-weight:800;color:#0f172a;margin-top:2px;">${opts.dtPagtoBR}</div>
              </div>
              <div>
                <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#64748b;">Meio de Pagamento</div>
                <div style="font-weight:800;color:#0369a1;margin-top:2px;">${opts.formaPagto}</div>
              </div>
              <div>
                <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#64748b;">Referência / Cód.</div>
                <div style="font-weight:700;color:#334155;font-family:monospace;margin-top:2px;">${opts.idFatura}</div>
              </div>
              <div>
                <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#64748b;">Conta / Caixa</div>
                <div style="font-weight:700;color:#334155;margin-top:2px;">${opts.caixaOrigem || 'Tesouraria Escolar'}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- DECLARAÇÃO DE QUITAÇÃO POR EXTENSO -->
        ${
          opts.mostrarExtenso
            ? `
        <div style="padding:${compact ? '9px 13px' : '12px 16px'};border-radius:10px;background:#f0fdf4;border:1px solid #bbf7d0;color:#14532d;font-size:${compact ? '11px' : '12px'};line-height:1.5;margin-bottom:${compact ? '12px' : '16px'};">
          ${opts.declaracaoTexto}
          <div style="margin-top:4px;font-size:${compact ? '10px' : '11px'};color:#166534;">
            <strong>Importância por extenso:</strong> <span style="text-transform:uppercase;font-weight:800;">(${opts.extensoStr})</span>
          </div>
        </div>`
            : ''
        }

        <!-- TABELA DE LANÇAMENTOS -->
        <table style="width:100%;table-layout:fixed;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:${compact ? '12px' : '18px'};">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="width:44%;white-space:normal !important;text-align:left;padding:${compact ? '7px 10px' : '10px 12px'};font-size:9.5px;font-weight:800;color:#475569;text-transform:uppercase;border-bottom:1px solid #cbd5e1;">Descrição do Lançamento / Competência</th>
              <th style="width:15%;white-space:nowrap !important;text-align:right;padding:${compact ? '7px 8px' : '10px 10px'};font-size:9.5px;font-weight:800;color:#475569;text-transform:uppercase;border-bottom:1px solid #cbd5e1;">Valor Bruto</th>
              <th style="width:13%;white-space:nowrap !important;text-align:right;padding:${compact ? '7px 8px' : '10px 10px'};font-size:9.5px;font-weight:800;color:#475569;text-transform:uppercase;border-bottom:1px solid #cbd5e1;">Desc./Ret.</th>
              <th style="width:12%;white-space:nowrap !important;text-align:right;padding:${compact ? '7px 8px' : '10px 10px'};font-size:9.5px;font-weight:800;color:#475569;text-transform:uppercase;border-bottom:1px solid #cbd5e1;">Encargos</th>
              <th style="width:16%;white-space:nowrap !important;text-align:right;padding:${compact ? '7px 10px' : '10px 12px'};font-size:9.5px;font-weight:800;color:#475569;text-transform:uppercase;border-bottom:1px solid #cbd5e1;">Líquido Pago</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        ${
          opts.observacao
            ? `<div style="padding:8px 12px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;font-size:11px;color:#334155;margin-bottom:${compact ? '12px' : '16px'};"><strong>Observações / Autenticação:</strong> ${opts.observacao}</div>`
            : ''
        }

        <!-- RODAPÉ DE ASSINATURAS E AUTENTICAÇÃO -->
        <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-top:${compact ? '18px' : '28px'};padding-top:${compact ? '10px' : '14px'};border-top:1px dashed #cbd5e1;">
          <div style="flex:1;display:grid;grid-template-columns:${opts.mostrarAssinaturaDupla ? '1fr 1fr' : '1fr'};gap:20px;">
            <div style="text-align:center;">
              <div style="border-bottom:1px solid #334155;height:${compact ? '22px' : '32px'};margin-bottom:6px;"></div>
              <div style="font-size:11px;font-weight:800;color:#0f172a;">${opts.issuerName}</div>
              <div style="font-size:9.5px;color:#64748b;">${opts.issuerCargo} • ${opts.nomeEscola}</div>
            </div>
            ${
              opts.mostrarAssinaturaDupla
                ? `
            <div style="text-align:center;">
              <div style="border-bottom:1px solid #334155;height:${compact ? '22px' : '32px'};margin-bottom:6px;"></div>
              <div style="font-size:11px;font-weight:800;color:#0f172a;">${opts.parteNome}</div>
              <div style="font-size:9.5px;color:#64748b;">${opts.natureza === 'pagar' ? 'Assinatura do Favorecido / Credor' : 'Assinatura do Responsável / Pagador'}</div>
            </div>`
                : ''
            }
          </div>

          <div style="display:flex;align-items:center;gap:10px;text-align:right;">
            <div>
              <div style="font-size:10.5px;font-weight:700;color:#334155;">${opts.cidade ? `${opts.cidade}, ` : ''}${dateByExt(todayISO())}</div>
              <div style="font-size:8.5px;color:#64748b;font-family:monospace;margin-top:3px;">AUTENTICAÇÃO: ${opts.hash}</div>
            </div>
            ${
              opts.mostrarQrCode && opts.qrCodeDataUrl
                ? `<img src="${opts.qrCodeDataUrl}" width="${compact ? '56' : '68'}" height="${compact ? '56' : '68'}" alt="QR Code de Autenticidade" style="border:1px solid #cbd5e1;border-radius:8px;padding:2px;background:#fff;" />`
                : ''
            }
          </div>
        </div>
      </div>
    </div>
  `
}

function buildReceiptHTML(parcelas: ReceiptParcela[], opts: PrintRenderOptions) {
  if (opts.layoutMode === 'bobina_80mm') {
    const itemsHtml = parcelas
      .map(
        (p, i) => `
        <div style="padding:6px 0;border-bottom:1px dashed #94a3b8;">
          <div style="font-weight:700;font-size:11px;">${i + 1}. ${p.evento || 'Lançamento'}</div>
          <div style="display:flex;justify-content:space-between;font-size:10.5px;color:#334155;margin-top:2px;">
            <span>Venc: ${fmtDateBR(p.vencimento)} (${p.formaPagto || opts.formaPagto})</span>
            <strong>R$ ${fmt(p.valorFinal ?? p.valor ?? 0)}</strong>
          </div>
        </div>`
      )
      .join('')

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Recibo_${opts.rNum}</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Courier New', Courier, monospace; width: 76mm; margin: 0 auto; padding: 8px; color: #000; background: #fff; font-size: 11px; }
    .sep { border-top: 1px dashed #000; margin: 8px 0; }
  </style>
</head>
<body>
  <div style="text-align:center;">
    <div style="font-size:14px;font-weight:900;">${opts.nomeEscola}</div>
    <div style="font-size:10px;">CNPJ: ${opts.cnpjEscola}</div>
    <div class="sep"></div>
    <div style="font-size:12px;font-weight:900;">${opts.natureza === 'pagar' ? 'RECIBO DE PAGAMENTO' : 'RECIBO DE RECEBIMENTO'}</div>
    <div style="font-size:11px;font-weight:700;">Nº #${opts.rNum} • ${opts.emissao}</div>
  </div>
  <div class="sep"></div>
  <div><strong>${opts.natureza === 'pagar' ? 'FAVORECIDO:' : 'PAGADOR:'}</strong> ${opts.parteNome}</div>
  <div><strong>DOC:</strong> ${opts.parteDocumento || '—'}</div>
  <div><strong>VÍNCULO:</strong> ${opts.vinculoLabel || '—'}</div>
  <div><strong>DATA BAIXA:</strong> ${opts.dtPagtoBR}</div>
  <div><strong>MEIO PGTO:</strong> ${opts.formaPagto}</div>
  <div class="sep"></div>
  <div style="font-weight:900;margin-bottom:4px;">ITENS LIQUIDADOS:</div>
  ${itemsHtml}
  <div style="padding:8px 0;font-size:13px;font-weight:900;display:flex;justify-content:space-between;">
    <span>TOTAL QUITADO:</span>
    <span>R$ ${fmt(opts.totalPago)}</span>
  </div>
  <div style="font-size:9.5px;line-height:1.35;">(${opts.extensoStr})</div>
  ${opts.observacao ? `<div class="sep"></div><div style="font-size:10px;">OBS: ${opts.observacao}</div>` : ''}
  <div class="sep"></div>
  <div style="text-align:center;margin-top:16px;">
    <div style="border-top:1px solid #000;padding-top:4px;margin-top:18px;font-weight:700;">${opts.issuerName} (${opts.issuerCargo})</div>
    ${
      opts.mostrarQrCode && opts.qrCodeDataUrl
        ? `<img src="${opts.qrCodeDataUrl}" width="84" height="84" style="margin:10px auto 4px;display:block;" />`
        : ''
    }
    <div style="font-size:8.5px;word-break:break-all;margin-top:4px;">HASH: ${opts.hash}</div>
  </div>
</body>
</html>`
  }

  const is2Vias = opts.layoutMode === 'a4_2vias'
  const via1Title =
    opts.natureza === 'pagar'
      ? '1ª Via — Favorecido / Credor'
      : '1ª Via — Responsável / Pagador'
  const via2Title = '2ª Via — Contabilidade & Arquivo Tesouraria'

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Recibo_${opts.rNum}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif;
      background: #f1f5f9;
      color: #0f172a;
      padding: 20px;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    .sheet { max-width: 820px; margin: 0 auto; }
    .cut-line {
      margin: 14px 0;
      border-top: 1.5px dashed #94a3b8;
      text-align: center;
      position: relative;
      height: 10px;
    }
    .cut-line span {
      background: #f1f5f9;
      padding: 0 10px;
      font-size: 10px;
      color: #64748b;
      position: relative;
      top: -8px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .sheet { max-width: 100%; }
      .cut-line span { background: #ffffff; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    ${buildSingleViaCardHTML(parcelas, opts, via1Title, is2Vias)}
    ${
      is2Vias
        ? `
      <div class="cut-line"><span>✂ Destacar 2ª Via da Tesouraria</span></div>
      ${buildSingleViaCardHTML(parcelas, opts, via2Title, true)}
    `
        : ''
    }
  </div>
</body>
</html>`
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ReceiptModal({
  parcelas: rawParcelas,
  aluno,
  natureza: propNatureza = 'receber',
  turmaUnidade,
  onClose,
}: ReceiptProps) {
  const { mantenedores, cfgMetodosPagamento, cfgCaixas } = useData()
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)

  // Carrega dados reais de Multi-Unidades e Caixas do banco como garantia caso o contexto ainda esteja hidratando
  const [mantenedoresDb, setMantenedoresDb] = useState<any[]>([])
  const [caixasDb, setCaixasDb] = useState<any[]>([])

  useEffect(() => {
    let active = true
    fetch('/api/configuracoes/mantenedores')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!active || !json) return
        const lista = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : []
        if (lista.length > 0) setMantenedoresDb(lista)
      })
      .catch(() => {})

    fetch('/api/configuracoes?chave=cfgCaixas')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!active || !json) return
        const valor = json?.valor ?? json?.data?.valor ?? json?.data ?? json
        if (Array.isArray(valor) && valor.length > 0) setCaixasDb(valor)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [])

  const sourceMantenedores = useMemo(
    () =>
      Array.isArray(mantenedoresDb) && mantenedoresDb.length > 0
        ? mantenedoresDb
        : Array.isArray(mantenedores)
        ? mantenedores
        : [],
    [mantenedoresDb, mantenedores]
  )

  const sourceCaixas = useMemo(
    () =>
      Array.isArray(caixasDb) && caixasDb.length > 0
        ? caixasDb
        : Array.isArray(cfgCaixas)
        ? cfgCaixas
        : [],
    [caixasDb, cfgCaixas]
  )

  const metodosDisponiveis = useMemo(
    () => resolveMetodosPagamentoEscolares(cfgMetodosPagamento, false),
    [cfgMetodosPagamento]
  )

  // ── Flatten e Deduplica Parcelas ──
  const parcelas = useMemo(() => {
    const expanded = rawParcelas.flatMap((p: any) => {
      if (p.parcelasVinculadas && p.parcelasVinculadas.length > 0) return p.parcelasVinculadas
      return [p]
    })
    const seen = new Set<string>()
    return expanded.filter((p: any, idx: number) => {
      const key = `${p.num || idx}-${p.codBaixa || p.evento || idx}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [rawParcelas])

  const ref = rawParcelas[0] || ({} as ReceiptParcela)

  // ── Lista completa de Entidades reais de Multi-Unidades (Matriz + Unidades) ──
  const entidadesMultiUnidades = useMemo(() => {
    const list: Array<{
      id: string
      codigo: string
      tipo: 'Matriz' | 'Unidade'
      nome: string
      nomeEscola: string
      razaoSocial: string
      cnpj: string
      logo: string | null
      endereco: string
      cidade: string
      searchTokens: string[]
    }> = []

    for (const m of sourceMantenedores) {
      if (!m || typeof m !== 'object') continue
      const mantNome = String(m.nome || m.razaoSocial || m.razao_social || '').trim()
      const mantRazao = String(m.razaoSocial || m.razao_social || mantNome).trim()
      const mantCnpj = String(m.cnpj || '').trim()
      const mantLogo: string | null = m.logo || null
      const mantEndereco = [m.endereco, m.numero, m.bairro].filter(Boolean).join(', ')
      const mantCidade = [m.cidade, m.estado].filter(Boolean).join(' - ')

      if (mantNome) {
        const labelMatriz =
          mantRazao && mantRazao.toLowerCase() !== mantNome.toLowerCase()
            ? `MATRIZ - ${mantNome} (${mantRazao})`
            : `MATRIZ - ${mantNome}`

        list.push({
          id: String(m.id || labelMatriz),
          codigo: 'MATRIZ',
          tipo: 'Matriz',
          nome: labelMatriz,
          nomeEscola: mantNome,
          razaoSocial: mantRazao,
          cnpj: mantCnpj,
          logo: mantLogo,
          endereco: mantEndereco,
          cidade: mantCidade,
          searchTokens: [
            String(m.id || ''),
            'MATRIZ',
            mantNome,
            mantRazao,
            labelMatriz,
            `MATRIZ - ${mantNome}`,
          ]
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean),
        })
      }

      const unidades = Array.isArray(m.unidades) ? m.unidades : []
      for (const u of unidades) {
        if (!u || typeof u !== 'object') continue
        const uCodigo = String(u.codigo || '').trim()
        const uFantasia = String(u.nomeFantasia || u.nome || '').trim()
        const uRazao = String(u.razaoSocial || u.razao_social || '').trim()
        const uNomeEscola = uFantasia || uRazao || mantNome
        if (!uNomeEscola) continue

        const labelUnidade = uCodigo
          ? `${uCodigo} - ${uFantasia && uRazao && uFantasia.toLowerCase() !== uRazao.toLowerCase() ? `${uFantasia} (${uRazao})` : uRazao || uFantasia}`
          : uNomeEscola

        const uEndereco = [
          u.endereco || m.endereco,
          u.numero || m.numero,
          u.bairro || m.bairro,
        ]
          .filter(Boolean)
          .join(', ')

        const uCidade = [u.cidade || m.cidade, u.estado || m.estado]
          .filter(Boolean)
          .join(' - ')

        list.push({
          id: String(u.id || labelUnidade),
          codigo: uCodigo,
          tipo: 'Unidade',
          nome: labelUnidade,
          nomeEscola: uNomeEscola,
          razaoSocial: uRazao || uFantasia,
          cnpj: String(u.cnpj || mantCnpj || '').trim(),
          logo: u.cabecalhoLogo || u.logo || mantLogo || null,
          endereco: uEndereco,
          cidade: uCidade,
          searchTokens: [
            String(u.id || ''),
            uCodigo,
            uFantasia,
            uRazao,
            labelUnidade,
            uCodigo && uFantasia ? `${uCodigo} - ${uFantasia}` : '',
            uCodigo && uRazao ? `${uCodigo} - ${uRazao}` : '',
            uCodigo && uFantasia && uRazao ? `${uCodigo} - ${uFantasia} — ${uRazao}` : '',
          ]
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean),
        })
      }
    }

    return list
  }, [sourceMantenedores])

  const unidadesDisponiveis = useMemo(
    () =>
      entidadesMultiUnidades.length > 0
        ? entidadesMultiUnidades.map((e) => ({
            id: e.id,
            nome: e.nome,
            label: e.nome,
            cnpj: e.cnpj || undefined,
            codigo: e.codigo || undefined,
          }))
        : resolveUnidadesEscolares(sourceMantenedores),
    [entidadesMultiUnidades, sourceMantenedores]
  )

  // ── Encontra o Caixa selecionado na baixa (pelo ID, código ou descrição) ──
  const matchedCaixaFromRef = useMemo(() => {
    const rawCaixaRef = String(ref.caixaOrigem || '').trim()
    if (!rawCaixaRef || sourceCaixas.length === 0) return null
    const lowerRef = rawCaixaRef.toLowerCase()

    return (
      sourceCaixas.find((cx: any) => {
        if (!cx || typeof cx !== 'object') return false
        const id = String(cx.id || '').trim().toLowerCase()
        const cod = String(cx.codigo || '').trim().toLowerCase()
        const desc = String(cx.descricao || '').trim().toLowerCase()
        const combo = `${cod} - ${desc}`
        const hashCombo = `#${cod} - ${desc}`
        return (
          id === lowerRef ||
          cod === lowerRef ||
          desc === lowerRef ||
          combo === lowerRef ||
          hashCombo === lowerRef ||
          (cod && desc && (lowerRef.includes(combo) || lowerRef.includes(hashCombo)))
        )
      }) || null
    )
  }, [ref.caixaOrigem, sourceCaixas])

  // Helper para casar uma string de unidadeEmpresa (vinda do caixa ou do lançamento) com Multi-Unidades
  const matchEntidadeByString = (candidateRaw?: string) => {
    const cand = String(candidateRaw || '').trim().toLowerCase()
    if (!cand || entidadesMultiUnidades.length === 0) return null

    // 1. Match exato por qualquer token (código, razão social, nome fantasia, label)
    const exact = entidadesMultiUnidades.find((e) => e.searchTokens.includes(cand))
    if (exact) return exact

    // 2. Match pelo código da unidade (ex: UNI-2026-ZV5C, UNI-2026-1VY4, MATRIZ)
    const byCode = entidadesMultiUnidades.find((e) => {
      const cod = e.codigo.trim().toLowerCase()
      if (!cod) return false
      return (
        cand === cod ||
        cand.startsWith(`${cod} -`) ||
        cand.startsWith(`${cod} —`) ||
        (cod !== 'matriz' && cand.includes(cod))
      )
    })
    if (byCode) return byCode

    // 3. Match parcial pela Razão Social ou Nome Fantasia
    return (
      entidadesMultiUnidades.find((e) => {
        const rs = e.razaoSocial.trim().toLowerCase()
        const nf = e.nomeEscola.trim().toLowerCase()
        return (rs && cand.includes(rs)) || (nf && cand.includes(nf))
      }) || null
    )
  }

  // ── Resolução de Unidade/Matriz Inicial (Prioridade 1: Caixa Selecionado na Baixa!) ──
  const resolvedEntidadeDoCaixa = useMemo(() => {
    // Prioridade 1: Unidade/Empresa vinculada ao Caixa selecionado na baixa
    if (matchedCaixaFromRef) {
      const fromCaixaUnidade =
        matchEntidadeByString(matchedCaixaFromRef.unidadeEmpresa) ||
        matchEntidadeByString(matchedCaixaFromRef.unidadeId)
      if (fromCaixaUnidade) return fromCaixaUnidade
    }
    // Prioridade 2: turmaUnidade ou aluno.unidade passado pelo lançamento
    if (turmaUnidade) {
      const fromTurma = matchEntidadeByString(turmaUnidade)
      if (fromTurma) return fromTurma
    }
    if (aluno.unidade) {
      const fromAluno = matchEntidadeByString(aluno.unidade)
      if (fromAluno) return fromAluno
    }
    // Fallback: primeira entidade cadastrada em Multi-Unidades
    return entidadesMultiUnidades[0] || null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedCaixaFromRef, turmaUnidade, aluno.unidade, entidadesMultiUnidades])

  // ── Emissor Padrão ──
  const defaultIssuer = useMemo(() => {
    if (typeof window === 'undefined') {
      return { nome: 'Tesouraria Escolar', cargo: 'Controladoria Financeira' }
    }
    try {
      const u = JSON.parse(window.localStorage.getItem('edu-current-user') || 'null')
      if (u && u.nome) {
        return {
          nome: u.nome,
          cargo: u.cargo || u.perfil || 'Tesouraria & Controladoria',
        }
      }
    } catch {}
    return { nome: 'Tesouraria Escolar', cargo: 'Controladoria Financeira' }
  }, [])

  // ── Estados Interativos do Gerador de Recibo ──
  const [natureza, setNatureza] = useState<'receber' | 'pagar'>(propNatureza)
  const [layoutMode, setLayoutMode] = useState<ReceiptLayoutMode>('a4_1via')
  const [showCustomize, setShowCustomize] = useState(false)
  const [selectedUnidadeNome, setSelectedUnidadeNome] = useState(
    resolvedEntidadeDoCaixa?.nome || 'Colégio Impacto'
  )

  // Atualiza automaticamente quando os dados de Multi-Unidades e Caixas terminam de carregar do banco
  useEffect(() => {
    if (resolvedEntidadeDoCaixa?.nome) {
      setSelectedUnidadeNome(resolvedEntidadeDoCaixa.nome)
    }
  }, [resolvedEntidadeDoCaixa])

  const [parteNome, setParteNome] = useState(
    aluno.responsavelFinanceiro || aluno.responsavel || aluno.nome || '—'
  )
  const [parteDocumento, setParteDocumento] = useState(
    aluno.documento || (aluno as any).cpfResponsavel || aluno.cpf || (aluno as any).cpfRespFin || ''
  )
  const semVinculoAluno = Boolean(aluno.semVinculoAluno)
  const [vinculoLabel, setVinculoLabel] = useState(
    propNatureza === 'pagar'
      ? [ref.categoria, ref.centroCusto].filter(Boolean).join(' • ') || aluno.unidade || 'Despesa Operacional'
      : semVinculoAluno
        ? [ref.categoria, ref.centroCusto].filter(Boolean).join(' • ') || 'Recebimento (Sem vínculo de aluno)'
        : `${aluno.nome}${aluno.codigo || aluno.matricula ? ` (Matrícula: ${aluno.codigo || aluno.matricula})` : ''}`
  )
  const [formaPagto, setFormaPagto] = useState(
    ref.formaPagto || ref.formasPagto?.map((f: any) => f.forma).join(', ') || 'PIX'
  )
  const [caixaOrigem, setCaixaOrigem] = useState(
    matchedCaixaFromRef
      ? `#${matchedCaixaFromRef.codigo} - ${matchedCaixaFromRef.descricao}`
      : ref.caixaOrigem || 'Tesouraria / Conta Movimento'
  )

  useEffect(() => {
    if (matchedCaixaFromRef) {
      setCaixaOrigem(`#${matchedCaixaFromRef.codigo} - ${matchedCaixaFromRef.descricao}`)
    }
  }, [matchedCaixaFromRef])

  const [dtPagtoISO, setDtPagtoISO] = useState(
    ref.dtPagto ? String(ref.dtPagto).slice(0, 10) : todayISO()
  )
  const [observacao, setObservacao] = useState(
    ref.obs || (ref.comprovante ? `Comprovante/Doc: ${ref.comprovante}` : '')
  )
  const [issuerName, setIssuerName] = useState(defaultIssuer.nome)
  const [issuerCargo, setIssuerCargo] = useState(defaultIssuer.cargo)

  const [mostrarCarimbo, setMostrarCarimbo] = useState(true)
  const [mostrarExtenso, setMostrarExtenso] = useState(true)
  const [mostrarAssinaturaDupla, setMostrarAssinaturaDupla] = useState(true)
  const [mostrarQrCode, setMostrarQrCode] = useState(true)
  const [copiedText, setCopiedText] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')

  // ── Unidade Selecionada e Metadados Reais da Instituição (Multi-Unidades) ──
  const unidadeInfo = useMemo(() => {
    const matched =
      entidadesMultiUnidades.find((e) => e.nome === selectedUnidadeNome) ||
      matchEntidadeByString(selectedUnidadeNome) ||
      resolvedEntidadeDoCaixa ||
      entidadesMultiUnidades[0]

    const mantenedor = sourceMantenedores[0]
    const nomeEscola =
      matched?.nomeEscola ||
      mantenedor?.nome ||
      selectedUnidadeNome ||
      'Colégio Impacto'
    const razaoSocial =
      matched?.razaoSocial ||
      mantenedor?.razaoSocial ||
      mantenedor?.razao_social ||
      ''
    const cnpj = matched?.cnpj || mantenedor?.cnpj || ''
    const logo: string | null = matched?.logo || mantenedor?.logo || null
    const endereco =
      matched?.endereco ||
      [mantenedor?.endereco, mantenedor?.numero, mantenedor?.bairro].filter(Boolean).join(', ') ||
      ''
    const cidade =
      matched?.cidade ||
      [mantenedor?.cidade, mantenedor?.estado].filter(Boolean).join(' - ') ||
      ''

    return { nomeEscola, razaoSocial, cnpj, logo, endereco, cidade }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entidadesMultiUnidades, selectedUnidadeNome, resolvedEntidadeDoCaixa, sourceMantenedores])

  // ── Cálculos de Totais e Extenso ──
  const totais = useMemo(() => {
    let bruto = 0
    let descontos = 0
    let encargos = 0
    let liquido = 0

    for (const p of parcelas) {
      const b = Number(p.valor) || 0
      const d = Number(p.desconto) || 0
      const e = (Number(p.juros) || 0) + (Number(p.multa) || 0)
      const l = Number(p.valorFinal ?? b - d + e) || 0
      bruto += b
      descontos += d
      encargos += e
      liquido += l
    }

    return {
      bruto: Math.round(bruto * 100) / 100,
      descontos: Math.round(descontos * 100) / 100,
      encargos: Math.round(encargos * 100) / 100,
      liquido: Math.round(liquido * 100) / 100,
    }
  }, [parcelas])

  const rNum = useMemo(() => receiptNumber(ref), [ref])
  const emissao = useMemo(() => today(), [])
  const hashVal = useMemo(() => generateUUID(), [])
  const validationUrl = `https://impacto-edu.com/validar/${hashVal}`
  const idFatura = ref.codBaixa || ref.comprovante || `#${rNum}`
  const dtPagtoBR = fmtDateBR(dtPagtoISO)
  const extensoStr = useMemo(() => valorPorExtenso(totais.liquido), [totais.liquido])

  const declaracaoTexto = useMemo(() => {
    const resumoItens = parcelas
      .map((p) => p.evento || 'Lançamento')
      .slice(0, 3)
      .join(', ')
    const maisItens = parcelas.length > 3 ? ` e mais ${parcelas.length - 3} item(ns)` : ''

    if (natureza === 'pagar') {
      return `Declaramos que a instituição <strong>${unidadeInfo.nomeEscola}</strong> (CNPJ ${unidadeInfo.cnpj}) efetuou o pagamento a <strong>${parteNome}</strong>${parteDocumento ? ` (${parteDocumento})` : ''} da importância líquida de <strong>R$ ${fmt(totais.liquido)}</strong> em <strong>${dtPagtoBR}</strong> via <strong>${formaPagto}</strong>, referente a <strong>${resumoItens}${maisItens}</strong>, pelo que o favorecido dá plena, geral e irrevogável quitação.`
    }
    return `Recebemos de <strong>${parteNome}</strong>${parteDocumento ? ` (CPF/CNPJ ${parteDocumento})` : ''} a importância líquida de <strong>R$ ${fmt(totais.liquido)}</strong> em <strong>${dtPagtoBR}</strong> via <strong>${formaPagto}</strong>, referente a <strong>${resumoItens}${maisItens}</strong> (${vinculoLabel}), dando plena, geral e rasa quitação dos valores discriminados neste recibo.`
  }, [
    natureza,
    unidadeInfo,
    parteNome,
    parteDocumento,
    totais.liquido,
    dtPagtoBR,
    formaPagto,
    parcelas,
    vinculoLabel,
  ])

  // ── Gera QR Code local em Canvas + DataURL Base64 (100% funcional offline e na impressão) ──
  useEffect(() => {
    if (qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, validationUrl, {
        width: 80,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      }).catch(() => {})
    }
    QRCode.toDataURL(validationUrl, {
      width: 160,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => {})
  }, [validationUrl])

  // Fecha com tecla Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const printOpts: PrintRenderOptions = {
    natureza,
    layoutMode,
    rNum,
    emissao,
    nomeEscola: unidadeInfo.nomeEscola,
    razaoSocial: unidadeInfo.razaoSocial,
    cnpjEscola: unidadeInfo.cnpj,
    logo: unidadeInfo.logo,
    endereco: unidadeInfo.endereco,
    cidade: unidadeInfo.cidade,
    parteNome,
    parteDocumento,
    vinculoLabel,
    formaPagto,
    caixaOrigem,
    dtPagtoBR,
    idFatura,
    observacao,
    issuerName,
    issuerCargo,
    hash: hashVal,
    qrCodeDataUrl: qrDataUrl,
    totalBruto: totais.bruto,
    totalDescontos: totais.descontos,
    totalEncargos: totais.encargos,
    totalPago: totais.liquido,
    extensoStr,
    declaracaoTexto,
    mostrarCarimbo,
    mostrarExtenso,
    mostrarAssinaturaDupla,
    mostrarQrCode,
    semVinculoAluno,
  }

  // ── Handlers de Impressão, PDF, Cópia, WhatsApp e E-mail ──
  const openPrintWindow = (autoprint = true) => {
    const html = buildReceiptHTML(parcelas, printOpts)
    const win = window.open('', '_blank', 'width=960,height=840,scrollbars=yes')
    if (!win) {
      toast.error('Permita pop-ups no navegador para abrir a impressão do recibo.')
      return
    }
    win.document.open()
    win.document.write(html)
    win.document.close()
    win.document.title = `Recibo_${rNum}_${parteNome.replace(/\s+/g, '_')}`

    if (autoprint) {
      setTimeout(() => {
        win.focus()
        win.print()
      }, 350)
    }
  }

  const buildPlainTextSummary = () => {
    const tipoStr =
      natureza === 'pagar'
        ? 'RECIBO DE PAGAMENTO E QUITAÇÃO'
        : 'RECIBO OFICIAL DE RECEBIMENTO'
    const itensTxt = parcelas
      .map(
        (p, i) =>
          `  ${i + 1}. ${p.evento || 'Lançamento'} (Venc: ${fmtDateBR(p.vencimento)}) — R$ ${fmt(p.valorFinal ?? p.valor ?? 0)}`
      )
      .join('\n')

    return [
      `*${unidadeInfo.nomeEscola}* (CNPJ: ${unidadeInfo.cnpj})`,
      `📄 *${tipoStr} Nº #${rNum}*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👤 *${natureza === 'pagar' ? 'Favorecido' : 'Pagador'}:* ${parteNome}${parteDocumento ? ` (${parteDocumento})` : ''}`,
      `📌 *Referência:* ${vinculoLabel}`,
      `💳 *Meio de Pagamento:* ${formaPagto}`,
      `📅 *Data da Liquidação:* ${dtPagtoBR}`,
      `💰 *Valor Total Quitado:* R$ ${fmt(totais.liquido)} (${extensoStr})`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `*Itens Discriminados:*`,
      itensTxt,
      observacao ? `\n📝 *Obs:* ${observacao}` : '',
      `\n🔐 *Autenticação Digital:* ${hashVal}`,
    ]
      .filter(Boolean)
      .join('\n')
  }

  const handleCopySummary = () => {
    const txt = buildPlainTextSummary()
    navigator.clipboard?.writeText(txt)
    setCopiedText(true)
    toast.success('Resumo completo do recibo copiado para a área de transferência!')
    setTimeout(() => setCopiedText(false), 2200)
  }

  const shareWhatsApp = () => {
    const txt = buildPlainTextSummary()
    navigator.clipboard?.writeText(txt).catch(() => {})
    const telRaw = aluno.telResponsavelFinanceiro || (aluno as any).celular || ''
    const tel = telRaw.replace(/\D/g, '')
    const encoded = encodeURIComponent(txt)
    const url = tel
      ? `https://api.whatsapp.com/send?phone=${tel.startsWith('55') ? tel : `55${tel}`}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`
    window.open(url, '_blank')
  }

  const shareEmail = () => {
    const targetEmail = aluno.emailResponsavelFinanceiro || (aluno as any).email || ''
    const subj = `Recibo #${rNum} — ${unidadeInfo.nomeEscola} (R$ ${fmt(totais.liquido)})`
    const body = buildPlainTextSummary().replace(/\*/g, '')
    window.open(
      `mailto:${targetEmail}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`
    )
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 11px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#0f172a',
    fontSize: 12.5,
    fontWeight: 600,
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 10,
    fontWeight: 800,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 4,
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.68)',
        backdropFilter: 'blur(10px)',
        zIndex: 5500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#f8fafc',
          width: '100%',
          maxWidth: 960,
          maxHeight: '94vh',
          borderRadius: 24,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          boxShadow: '0 32px 90px rgba(15, 23, 42, 0.35)',
          border: '1px solid #cbd5e1',
          overflow: 'hidden',
        }}
      >
        {/* TOP ACCENT BAR */}
        <div
          style={{
            height: 6,
            background:
              natureza === 'pagar'
                ? 'linear-gradient(90deg, #0f172a 0%, #0284c7 50%, #059669 100%)'
                : 'linear-gradient(90deg, #0284c7 0%, #2563eb 50%, #10b981 100%)',
            width: '100%',
          }}
        />

        {/* HEADER BAR + FORMAT CONTROLS */}
        <div
          style={{
            padding: '16px 24px',
            background: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background:
                  natureza === 'pagar'
                    ? 'linear-gradient(135deg, #0f172a, #1e293b)'
                    : 'linear-gradient(135deg, #0284c7, #1d4ed8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 6px 16px rgba(15, 23, 42, 0.15)',
              }}
            >
              <Receipt size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 10,
                    color: natureza === 'pagar' ? '#0f172a' : '#0284c7',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  {natureza === 'pagar'
                    ? 'Central de Recibos • Contas a Pagar'
                    : 'Central de Recibos • Contas a Receber'}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 99,
                    background: '#ecfdf5',
                    color: '#047857',
                    border: '1px solid #a7f3d0',
                    fontWeight: 800,
                  }}
                >
                  #{rNum}
                </span>
              </div>
              <h2
                id="receipt-modal-title"
                style={{
                  margin: '2px 0 0',
                  fontSize: 17,
                  fontWeight: 900,
                  color: '#0f172a',
                  letterSpacing: '-0.02em',
                }}
              >
                {natureza === 'pagar'
                  ? 'Recibo de Pagamento & Quitação de Compromisso'
                  : 'Recibo Oficial de Recebimento Escolar'}
              </h2>
            </div>
          </div>

          {/* SELETOR DE FORMATO + BOTÃO PERSONALIZAR */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'inline-flex',
                background: '#f1f5f9',
                padding: 3,
                borderRadius: 10,
                border: '1px solid #cbd5e1',
              }}
            >
              {[
                { id: 'a4_1via', label: 'A4 (1 Via)', icon: <FileText size={13} /> },
                { id: 'a4_2vias', label: 'A4 (2 Vias c/ Corte)', icon: <Scissors size={13} /> },
                { id: 'bobina_80mm', label: 'Cupom 80mm', icon: <Receipt size={13} /> },
              ].map((fmtOpt) => {
                const active = layoutMode === fmtOpt.id
                return (
                  <button
                    key={fmtOpt.id}
                    type="button"
                    onClick={() => setLayoutMode(fmtOpt.id as ReceiptLayoutMode)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '6px 10px',
                      borderRadius: 7,
                      border: 'none',
                      background: active ? '#0f172a' : 'transparent',
                      color: active ? '#ffffff' : '#475569',
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {fmtOpt.icon}
                    {fmtOpt.label}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowCustomize((v) => !v)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: 9,
                border: showCustomize ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                background: showCustomize ? '#eff6ff' : '#ffffff',
                color: showCustomize ? '#1d4ed8' : '#334155',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <SlidersHorizontal size={14} />
              {showCustomize ? 'Ocultar Ajustes' : 'Personalizar Recibo'}
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar gerador de recibo"
              style={{
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                color: '#475569',
                width: 34,
                height: 34,
                borderRadius: 10,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* PAINEL EXPANSÍVEL DE PERSONALIZAÇÃO DO RECIBO EM TEMPO REAL */}
        {showCustomize && (
          <div
            style={{
              padding: '16px 24px',
              background: '#eff6ff',
              borderBottom: '1px solid #bfdbfe',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <div>
                <label htmlFor="rcp-unidade" style={labelStyle}>
                  <Building2 size={10} style={{ display: 'inline', marginRight: 4 }} />
                  Unidade / Empresa Emitente
                </label>
                <select
                  id="rcp-unidade"
                  value={selectedUnidadeNome}
                  onChange={(e) => setSelectedUnidadeNome(e.target.value)}
                  style={inputStyle}
                >
                  {unidadesDisponiveis.map((u) => (
                    <option key={u.id} value={u.nome}>
                      {u.nome} {u.cnpj ? `(${u.cnpj})` : ''}
                    </option>
                  ))}
                  {!unidadesDisponiveis.some((u) => u.nome === selectedUnidadeNome) && (
                    <option value={selectedUnidadeNome}>{selectedUnidadeNome}</option>
                  )}
                </select>
              </div>

              <div>
                <label htmlFor="rcp-parte-nome" style={labelStyle}>
                  {natureza === 'pagar' ? 'Favorecido / Credor' : 'Pagador / Responsável'}
                </label>
                <input
                  id="rcp-parte-nome"
                  type="text"
                  value={parteNome}
                  onChange={(e) => setParteNome(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label htmlFor="rcp-parte-doc" style={labelStyle}>CPF / CNPJ</label>
                <input
                  id="rcp-parte-doc"
                  type="text"
                  value={parteDocumento}
                  onChange={(e) => setParteDocumento(e.target.value)}
                  placeholder="000.000.000-00 ou CNPJ"
                  style={inputStyle}
                />
              </div>

              <div>
                <label htmlFor="rcp-vinculo" style={labelStyle}>
                  {natureza === 'pagar' || semVinculoAluno ? 'Centro de Custo / Classificação' : 'Aluno / Vínculo'}
                </label>
                <input
                  id="rcp-vinculo"
                  type="text"
                  value={vinculoLabel}
                  onChange={(e) => setVinculoLabel(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr 1fr 1fr 1.2fr', gap: 10 }}>
              <div>
                <label htmlFor="rcp-metodo" style={labelStyle}>
                  <CreditCard size={10} style={{ display: 'inline', marginRight: 4 }} />
                  Método de Pagamento
                </label>
                <select
                  id="rcp-metodo"
                  value={formaPagto}
                  onChange={(e) => setFormaPagto(e.target.value)}
                  style={inputStyle}
                >
                  {metodosDisponiveis.map((m) => (
                    <option key={m.id} value={m.nome}>
                      {m.nome}
                    </option>
                  ))}
                  {formaPagto && !metodosDisponiveis.some((m) => m.nome === formaPagto) && (
                    <option value={formaPagto}>{formaPagto}</option>
                  )}
                </select>
              </div>

              <div>
                <label htmlFor="rcp-dt-pagto" style={labelStyle}>Data da Liquidação</label>
                <input
                  id="rcp-dt-pagto"
                  type="date"
                  value={dtPagtoISO}
                  onChange={(e) => setDtPagtoISO(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label htmlFor="rcp-emissor-nome" style={labelStyle}>Assinado por (Emitente)</label>
                <input
                  id="rcp-emissor-nome"
                  type="text"
                  value={issuerName}
                  onChange={(e) => setIssuerName(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label htmlFor="rcp-emissor-cargo" style={labelStyle}>Cargo / Setor</label>
                <input
                  id="rcp-emissor-cargo"
                  type="text"
                  value={issuerCargo}
                  onChange={(e) => setIssuerCargo(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label htmlFor="rcp-obs" style={labelStyle}>Observação / Nº Autenticação</label>
                <input
                  id="rcp-obs"
                  type="text"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="NSU, ID PIX, Conta bancária..."
                  style={inputStyle}
                />
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
                paddingTop: 4,
              }}
            >
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={mostrarExtenso}
                    onChange={(e) => setMostrarExtenso(e.target.checked)}
                  />
                  Declaração c/ Valor por Extenso
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={mostrarCarimbo}
                    onChange={(e) => setMostrarCarimbo(e.target.checked)}
                  />
                  Selo Digital &ldquo;LIQUIDADO&rdquo;
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={mostrarAssinaturaDupla}
                    onChange={(e) => setMostrarAssinaturaDupla(e.target.checked)}
                  />
                  Assinatura Dupla (Escola + {natureza === 'pagar' ? 'Favorecido' : 'Pagador'})
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={mostrarQrCode}
                    onChange={(e) => setMostrarQrCode(e.target.checked)}
                  />
                  QR Code de Autenticidade
                </label>
              </div>

              <div style={{ display: 'inline-flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setNatureza('receber')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    border: natureza === 'receber' ? '1px solid #0284c7' : '1px solid #cbd5e1',
                    background: natureza === 'receber' ? '#e0f2fe' : '#ffffff',
                    color: natureza === 'receber' ? '#0369a1' : '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  Modelo Recebimento
                </button>
                <button
                  type="button"
                  onClick={() => setNatureza('pagar')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    border: natureza === 'pagar' ? '1px solid #0f172a' : '1px solid #cbd5e1',
                    background: natureza === 'pagar' ? '#e2e8f0' : '#ffffff',
                    color: natureza === 'pagar' ? '#0f172a' : '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  Modelo Pagamento (Fornecedor)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* LIVE DOCUMENT PREVIEW AREA */}
        <div
          style={{
            padding: '24px 28px',
            flex: 1,
            overflowY: 'auto',
            background: '#e2e8f0',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          {/* Canvas oculto de apoio para renderização instantânea */}
          <canvas ref={qrCanvasRef} width={80} height={80} style={{ display: 'none' }} />

          {layoutMode === 'bobina_80mm' ? (
            /* PREVIEW CUPOM TÉRMICO 80MM */
            <div
              style={{
                width: 340,
                background: '#fffef7',
                border: '1px solid #cbd5e1',
                borderRadius: 12,
                padding: '22px 20px',
                boxShadow: '0 16px 36px rgba(15, 23, 42, 0.14)',
                fontFamily: "'Courier New', Courier, monospace",
                color: '#0f172a',
                fontSize: 12,
                alignSelf: 'flex-start',
              }}
            >
              <div style={{ textAlign: 'center', borderBottom: '1px dashed #64748b', paddingBottom: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 900 }}>{unidadeInfo.nomeEscola}</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>CNPJ: {unidadeInfo.cnpj}</div>
                <div style={{ fontSize: 12, fontWeight: 900, marginTop: 8 }}>
                  {natureza === 'pagar' ? 'RECIBO DE PAGAMENTO' : 'RECIBO DE RECEBIMENTO'}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2 }}>
                  Nº #{rNum} • {emissao}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5, borderBottom: '1px dashed #64748b', paddingBottom: 10, marginBottom: 10 }}>
                <div>
                  <strong>{natureza === 'pagar' ? 'FAVORECIDO:' : 'PAGADOR:'}</strong> {parteNome}
                </div>
                <div>
                  <strong>CPF/CNPJ:</strong> {parteDocumento || 'Não informado'}
                </div>
                <div>
                  <strong>VÍNCULO:</strong> {vinculoLabel || '—'}
                </div>
                <div>
                  <strong>DATA BAIXA:</strong> {dtPagtoBR}
                </div>
                <div>
                  <strong>MEIO PGTO:</strong> {formaPagto}
                </div>
              </div>

              <div style={{ fontWeight: 900, marginBottom: 6, fontSize: 11.5 }}>ITENS LIQUIDADOS:</div>
              {parcelas.map((p, i) => (
                <div key={`${p.num}-${i}`} style={{ padding: '6px 0', borderBottom: '1px dashed #cbd5e1' }}>
                  <div style={{ fontWeight: 700, fontSize: 11.5 }}>
                    {i + 1}. {p.evento || 'Lançamento'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 2 }}>
                    <span>Venc: {fmtDateBR(p.vencimento)}</span>
                    <strong>R$ {fmt(p.valorFinal ?? p.valor ?? 0)}</strong>
                  </div>
                </div>
              ))}

              <div
                style={{
                  marginTop: 10,
                  padding: '8px 0',
                  borderTop: '1.5px solid #0f172a',
                  borderBottom: '1.5px solid #0f172a',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 14,
                  fontWeight: 900,
                }}
              >
                <span>TOTAL QUITADO:</span>
                <span>R$ {fmt(totais.liquido)}</span>
              </div>

              {mostrarExtenso && (
                <div style={{ fontSize: 10.5, marginTop: 8, lineHeight: 1.4, color: '#334155' }}>
                  ({extensoStr.toUpperCase()})
                </div>
              )}

              {observacao && (
                <div style={{ fontSize: 10.5, marginTop: 8, padding: 6, background: '#f1f5f9', borderRadius: 4 }}>
                  <strong>OBS:</strong> {observacao}
                </div>
              )}

              <div style={{ textAlign: 'center', marginTop: 22 }}>
                <div style={{ borderTop: '1px solid #0f172a', paddingTop: 5, fontSize: 11, fontWeight: 700 }}>
                  {issuerName} ({issuerCargo})
                </div>
                {mostrarQrCode && qrDataUrl && (
                  <img
                    src={qrDataUrl}
                    width={88}
                    height={88}
                    alt="QR Code de Autenticidade"
                    style={{ margin: '12px auto 6px', display: 'block', borderRadius: 6 }}
                  />
                )}
                <div style={{ fontSize: 9, color: '#64748b', wordBreak: 'break-all' }}>
                  HASH: {hashVal}
                </div>
              </div>
            </div>
          ) : (
            /* PREVIEW FOLHA A4 (1 VIA OU 2 VIAS) */
            <div style={{ width: '100%', maxWidth: 840 }}>
              <div
                dangerouslySetInnerHTML={{
                  __html:
                    buildSingleViaCardHTML(
                      parcelas,
                      printOpts,
                      natureza === 'pagar'
                        ? '1ª Via — Favorecido / Credor'
                        : '1ª Via — Responsável / Pagador',
                      layoutMode === 'a4_2vias'
                    ) +
                    (layoutMode === 'a4_2vias'
                      ? `<div style="margin:14px 0;border-top:2px dashed #94a3b8;text-align:center;"><span style="background:#e2e8f0;padding:2px 12px;font-size:10.5px;font-weight:800;color:#475569;position:relative;top:-10px;border-radius:99px;">✂ LINHA DE CORTE — 2ª VIA ARQUIVO TESOURARIA</span></div>` +
                        buildSingleViaCardHTML(
                          parcelas,
                          printOpts,
                          '2ª Via — Contabilidade & Arquivo Tesouraria',
                          true
                        )
                      : ''),
                }}
              />
            </div>
          )}
        </div>

        {/* BOTTOM ACTION BAR */}
        <div
          style={{
            padding: '16px 24px',
            background: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={shareWhatsApp}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '9px 15px',
                borderRadius: 11,
                background: '#ecfdf5',
                color: '#047857',
                border: '1px solid #a7f3d0',
                fontSize: 12.5,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <MessageCircle size={15} />
              WhatsApp
            </button>

            <button
              type="button"
              onClick={shareEmail}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '9px 15px',
                borderRadius: 11,
                background: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                fontSize: 12.5,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <Mail size={15} />
              E-mail
            </button>

            <button
              type="button"
              onClick={handleCopySummary}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '9px 15px',
                borderRadius: 11,
                background: '#f8fafc',
                color: '#334155',
                border: '1px solid #cbd5e1',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {copiedText ? <Check size={15} color="#059669" /> : <Copy size={15} />}
              {copiedText ? 'Texto Copiado!' : 'Copiar Resumo'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => openPrintWindow(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '9px 16px',
                borderRadius: 11,
                background: '#ffffff',
                color: '#334155',
                border: '1px solid #cbd5e1',
                fontSize: 12.5,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <Download size={15} />
              Salvar PDF
            </button>

            <button
              type="button"
              onClick={() => openPrintWindow(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                borderRadius: 11,
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: '#ffffff',
                border: 'none',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 6px 18px rgba(5, 150, 105, 0.28)',
              }}
            >
              <Printer size={16} />
              Imprimir Recibo ({layoutMode === 'a4_2vias' ? '2 Vias' : layoutMode === 'bobina_80mm' ? '80mm' : 'A4'})
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
