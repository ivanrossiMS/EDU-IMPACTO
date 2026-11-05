'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useConfigDb } from '@/lib/useConfigDb'
import { useApiQuery } from '@/hooks/useApi'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import { useData, newId } from '@/lib/dataContext'
import {
  RefreshCw, Plus, X, Trash2, FileText, CheckCircle, Search,
  Filter, TrendingDown, Printer, MessageCircle, FileSpreadsheet,
  Calendar, Calculator, AlertTriangle, Check, UserCheck
} from 'lucide-react'

export interface AcordoRenegociacao {
  id: string
  alunoNome: string
  responsavel: string
  telefoneResponsavel?: string
  turma?: string
  valorPrincipal?: number
  valorEncargos?: number
  valorOriginal: number
  valorEntrada?: number
  valorNegociado: number
  desconto: number
  parcelas: number
  formaPagamento?: string
  primeiroVencimento?: string
  data: string
  status: 'ativo' | 'quitado' | 'inadimplente'
  obs: string
  motivoInadimpl?: string
  titulosOriginaisIds?: string[]
}

function getToday() {
  return new Date().toISOString().slice(0, 10)
}

function fmt(d?: string) {
  if (!d) return '—'
  const [y, m, dia] = d.slice(0, 10).split('-')
  if (!y || !m || !dia) return d
  return `${dia}/${m}/${y}`
}

const fmtCur = (v: number) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function diasAtraso(vencimento?: string) {
  if (!vencimento) return 0
  const d = Math.floor(
    (new Date(getToday() + 'T12:00:00').getTime() - new Date(vencimento.slice(0, 10) + 'T12:00:00').getTime()) /
      86400000
  )
  return Math.max(0, d)
}

function calcularMultaJuros(valor: number, dias: number) {
  if (dias <= 0 || valor <= 0) return { multa: 0, juros: 0, totalEncargos: 0 }
  const multa = Math.round(valor * 0.02 * 100) / 100
  const juros = Math.round(valor * (0.01 / 30) * dias * 100) / 100
  return { multa, juros, totalEncargos: Math.round((multa + juros) * 100) / 100 }
}

const MOTIVOS = [
  'Dificuldade financeira',
  'Desemprego',
  'Doença na família',
  'Esquecimento / Divergência de boleto',
  'Mudança de cidade / Transferência',
  'Outros',
]

const FORMAS_PAGAMENTO = ['PIX', 'Boleto', 'Cartão de Crédito', 'Cartão de Débito', 'Transferência', 'Dinheiro']

const STATUS_BADGE = {
  ativo: { bg: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.3)', cor: '#0891b2', label: '● Acordo Ativo' },
  quitado: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', cor: '#059669', label: '✓ Quitado' },
  inadimplente: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', cor: '#dc2626', label: '⚠ Quebra / Atraso' },
}

export default function RenegociacaoPage() {
  const queryClient = useQueryClient()
  const [alunos, , { loading: l1 }] = useSupabaseArray<any>('alunos')
  const [ctxTitulos] = useSupabaseArray<any>('titulos')
  const { data: apiTitulosRes, isLoading: l2 } = useApiQuery<{ data?: any[] } | any[]>(
    ['titulos-receber'],
    '/api/titulos',
    { limit: 2500 },
    { staleTime: 25_000, gcTime: 300_000 }
  )
  const { data: acordosRaw, setData: setAcordos } = useConfigDb<AcordoRenegociacao>('fin_acordos_renegociacao', [])
  const acordos = useMemo(() => (Array.isArray(acordosRaw) ? acordosRaw : []), [acordosRaw])
  const { logSystemAction } = useData()
  const escolaNome = 'Colégio Impacto'

  useEffect(() => {
    fetch('/api/configuracoes?chave=fin_acordos_renegociacao')
      .then((r) => (r.ok ? r.json() : null))
      .then((val) => {
        if (Array.isArray(val) && val.length > 0 && acordos.length === 0) {
          setAcordos(val)
        }
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const hoje = useMemo(() => getToday(), [])

  // Normaliza títulos de contas a receber para detectar atrasos reais
  const titulosNormalizados = useMemo(() => {
    const listaBruta: any[] = Array.isArray(apiTitulosRes)
      ? apiTitulosRes
      : Array.isArray(apiTitulosRes?.data)
        ? apiTitulosRes.data
        : Array.isArray(ctxTitulos)
          ? ctxTitulos
          : []

    return listaBruta
      .filter((t: any) => t && t.status !== 'excluido' && t.status !== 'cancelado')
      .map((t: any) => {
        const venc = String(t.vencimento || '').slice(0, 10)
        const isVencido = (t.status === 'pendente' || t.status === 'atrasado' || t.status === 'vencido') && venc && venc < hoje
        return {
          ...t,
          valor: Number(t.valor) || 0,
          statusEfetivo: t.status === 'pago' ? 'pago' : t.status === 'renegociado' ? 'renegociado' : isVencido ? 'atrasado' : t.status,
          diasEmAtraso: isVencido ? diasAtraso(venc) : 0,
        }
      })
  }, [apiTitulosRes, ctxTitulos, hoje])

  const titulosAtrasados = useMemo(
    () => titulosNormalizados.filter((t) => t.statusEfetivo === 'atrasado'),
    [titulosNormalizados]
  )

  // Agrupamento de inadimplência por aluno (combina títulos vencidos + flag aluno.inadimplente)
  const radarInadimplencia = useMemo(() => {
    const map = new Map<
      string,
      {
        alunoNome: string
        responsavel: string
        telefone: string
        turma: string
        qtdTitulos: number
        valorPrincipal: number
        valorEncargos: number
        maiorAtraso: number
        titulosIds: string[]
      }
    >()

    for (const t of titulosAtrasados) {
      const nome = (t.aluno || '').trim()
      if (!nome) continue
      const alunoCad = (alunos || []).find((a: any) => a.nome === nome)
      const enc = calcularMultaJuros(t.valor, t.diasEmAtraso)
      const prev = map.get(nome) || {
        alunoNome: nome,
        responsavel: t.responsavel || alunoCad?.responsavel || '',
        telefone: alunoCad?.telResponsavel || alunoCad?.telefone || '',
        turma: alunoCad?.turma || t.turma || '',
        qtdTitulos: 0,
        valorPrincipal: 0,
        valorEncargos: 0,
        maiorAtraso: 0,
        titulosIds: [] as string[],
      }
      prev.qtdTitulos += 1
      prev.valorPrincipal = Math.round((prev.valorPrincipal + t.valor) * 100) / 100
      prev.valorEncargos = Math.round((prev.valorEncargos + enc.totalEncargos) * 100) / 100
      prev.maiorAtraso = Math.max(prev.maiorAtraso, t.diasEmAtraso)
      prev.titulosIds.push(t.id)
      map.set(nome, prev)
    }

    for (const a of alunos || []) {
      if (a?.inadimplente && a?.nome && !map.has(a.nome)) {
        map.set(a.nome, {
          alunoNome: a.nome,
          responsavel: a.responsavel || '',
          telefone: a.telResponsavel || a.telefone || '',
          turma: a.turma || '',
          qtdTitulos: 0,
          valorPrincipal: Number(a.mensalidade || 0),
          valorEncargos: 0,
          maiorAtraso: 30,
          titulosIds: [],
        })
      }
    }

    return Array.from(map.values()).sort((a, b) => b.valorPrincipal - a.valorPrincipal)
  }, [titulosAtrasados, alunos])

  // Estados de UI e Filtros
  const [showModal, setShowModal] = useState(false)
  const [showRadar, setShowRadar] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativo' | 'quitado' | 'inadimplente'>('todos')
  const [search, setSearch] = useState('')
  const [filtroMotivo, setFiltroMotivo] = useState('Todos')
  const [showFilters, setShowFilters] = useState(false)
  const [confirmDeleteAcordo, setConfirmDeleteAcordo] = useState<AcordoRenegociacao | null>(null)
  const [restaurarTitulosAoExcluir, setRestaurarTitulosAoExcluir] = useState(true)
  const [saving, setSaving] = useState(false)

  // Estados do Modal de Novo Acordo
  const [buscaAluno, setBuscaAluno] = useState('')
  const [showAlunoDropdown, setShowAlunoDropdown] = useState(false)
  const [selectedTituloIds, setSelectedTituloIds] = useState<string[]>([])
  const [incluirEncargos, setIncluirEncargos] = useState(true)

  const [form, setForm] = useState({
    alunoNome: '',
    responsavel: '',
    telefoneResponsavel: '',
    turma: '',
    valorOriginal: '',
    valorNegociado: '',
    valorEntrada: '0',
    desconto: '0',
    parcelas: '3',
    formaPagamento: 'PIX',
    primeiroVencimento: getToday(),
    data: getToday(),
    status: 'ativo' as AcordoRenegociacao['status'],
    obs: '',
    motivoInadimpl: 'Dificuldade financeira',
  })

  // Títulos em aberto/vencidos do aluno selecionado no modal
  const titulosDoAlunoNoModal = useMemo(() => {
    if (!form.alunoNome) return []
    return titulosNormalizados.filter(
      (t) =>
        t.aluno === form.alunoNome &&
        (t.statusEfetivo === 'atrasado' || t.statusEfetivo === 'pendente') &&
        !String(t.descricao || '').startsWith('Acordo Renegociação')
    )
  }, [titulosNormalizados, form.alunoNome])

  // Recalcula valor original + encargos quando muda seleção de títulos ou toggle de encargos
  const resumoCalculoTitulos = useMemo(() => {
    const selecionados = titulosDoAlunoNoModal.filter((t) => selectedTituloIds.includes(t.id))
    let principal = 0
    let encargos = 0
    for (const t of selecionados) {
      principal += Number(t.valor) || 0
      const enc = calcularMultaJuros(Number(t.valor) || 0, t.diasEmAtraso)
      encargos += enc.totalEncargos
    }
    principal = Math.round(principal * 100) / 100
    encargos = Math.round(encargos * 100) / 100
    const baseAtualizada = Math.round((principal + (incluirEncargos ? encargos : 0)) * 100) / 100
    return { principal, encargos, baseAtualizada }
  }, [titulosDoAlunoNoModal, selectedTituloIds, incluirEncargos])

  const aplicarCalculoBase = useCallback(
    (novaBase: number, descPctStr: string) => {
      const descNum = Math.min(100, Math.max(0, parseFloat(descPctStr) || 0))
      const neg = Math.round(novaBase * (1 - descNum / 100) * 100) / 100
      setForm((f) => ({
        ...f,
        valorOriginal: novaBase > 0 ? novaBase.toFixed(2) : f.valorOriginal,
        valorNegociado: novaBase > 0 ? neg.toFixed(2) : f.valorNegociado,
      }))
    },
    []
  )

  useEffect(() => {
    if (selectedTituloIds.length > 0) {
      aplicarCalculoBase(resumoCalculoTitulos.baseAtualizada, form.desconto)
    }
  }, [resumoCalculoTitulos.baseAtualizada, selectedTituloIds.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectAluno = useCallback(
    (nome: string) => {
      const aluno = (alunos || []).find((a: any) => a.nome === nome)
      const tits = titulosNormalizados.filter(
        (t) =>
          t.aluno === nome &&
          (t.statusEfetivo === 'atrasado' || t.statusEfetivo === 'pendente') &&
          !String(t.descricao || '').startsWith('Acordo Renegociação')
      )
      const atrasadosIds = tits.filter((t) => t.statusEfetivo === 'atrasado').map((t) => t.id)
      const initialIds = atrasadosIds.length > 0 ? atrasadosIds : tits.map((t) => t.id)
      setSelectedTituloIds(initialIds)

      let principal = 0
      let encargos = 0
      for (const t of tits.filter((x) => initialIds.includes(x.id))) {
        principal += Number(t.valor) || 0
        encargos += calcularMultaJuros(Number(t.valor) || 0, t.diasEmAtraso).totalEncargos
      }
      if (principal === 0 && aluno?.mensalidade) {
        principal = Number(aluno.mensalidade) || 0
      }

      const base = Math.round((principal + (incluirEncargos ? encargos : 0)) * 100) / 100
      const descDefault = base > 0 ? '10' : '0'
      const negDefault = Math.round(base * 0.9 * 100) / 100

      setForm((f) => ({
        ...f,
        alunoNome: nome,
        responsavel: aluno?.responsavel || tits[0]?.responsavel || '',
        telefoneResponsavel: aluno?.telResponsavel || aluno?.telefone || '',
        turma: aluno?.turma || tits[0]?.turma || '',
        valorOriginal: base > 0 ? base.toFixed(2) : '',
        valorNegociado: base > 0 ? negDefault.toFixed(2) : '',
        desconto: descDefault,
        valorEntrada: '0',
      }))
      setBuscaAluno(nome)
      setShowAlunoDropdown(false)
    },
    [alunos, titulosNormalizados, incluirEncargos]
  )

  const handleDescontoChange = (desc: string) => {
    const orig = parseFloat(form.valorOriginal) || 0
    const descNum = Math.min(100, Math.max(0, parseFloat(desc) || 0))
    setForm((f) => ({
      ...f,
      desconto: desc,
      valorNegociado: orig > 0 ? (orig * (1 - descNum / 100)).toFixed(2) : f.valorNegociado,
    }))
  }

  const handleValorNegChange = (val: string) => {
    const orig = parseFloat(form.valorOriginal) || 0
    const negNum = Math.max(0, parseFloat(val) || 0)
    const desc = orig > 0 ? Math.max(0, (1 - negNum / orig) * 100).toFixed(1) : '0'
    setForm((f) => ({ ...f, valorNegociado: val, desconto: desc }))
  }

  // Cronograma de parcelas simulado no modal
  const cronogramaSimulado = useMemo(() => {
    const totalNeg = Math.max(0, parseFloat(form.valorNegociado) || 0)
    const entrada = Math.min(totalNeg, Math.max(0, parseFloat(form.valorEntrada) || 0))
    const nParcelas = Math.max(1, parseInt(form.parcelas) || 1)
    const saldoParcelar = Math.max(0, Math.round((totalNeg - entrada) * 100) / 100)
    const baseData = new Date((form.primeiroVencimento || hoje) + 'T12:00:00')

    const items: Array<{ numero: string; vencimento: string; valor: number; tipo: 'entrada' | 'parcela' }> = []

    if (entrada > 0) {
      items.push({
        numero: 'Entrada',
        vencimento: form.data || hoje,
        valor: entrada,
        tipo: 'entrada',
      })
    }

    if (saldoParcelar > 0) {
      const valorParcelaBase = Math.floor((saldoParcelar / nParcelas) * 100) / 100
      for (let idx = 0; idx < nParcelas; idx++) {
        const vencDate = new Date(baseData)
        vencDate.setMonth(vencDate.getMonth() + idx)
        const isUltima = idx === nParcelas - 1
        const valParc = isUltima
          ? Number((saldoParcelar - valorParcelaBase * (nParcelas - 1)).toFixed(2))
          : valorParcelaBase
        items.push({
          numero: `${idx + 1}/${nParcelas}`,
          vencimento: vencDate.toISOString().slice(0, 10),
          valor: valParc,
          tipo: 'parcela',
        })
      }
    }

    return { totalNeg, entrada, saldoParcelar, nParcelas, items }
  }, [form.valorNegociado, form.valorEntrada, form.parcelas, form.primeiroVencimento, form.data, hoje])

  async function handleSave() {
    if (!form.alunoNome.trim()) {
      toast.error('Selecione um aluno para formalizar o acordo.')
      return
    }
    const valorNegNum = parseFloat(form.valorNegociado) || 0
    if (valorNegNum <= 0) {
      toast.error('Informe um valor negociado maior que zero.')
      return
    }

    setSaving(true)
    try {
      const nParcelas = Math.max(1, parseInt(form.parcelas) || 1)
      const acordoId = newId('RNG')
      const novo: AcordoRenegociacao = {
        id: acordoId,
        alunoNome: form.alunoNome.trim(),
        responsavel: form.responsavel.trim(),
        telefoneResponsavel: form.telefoneResponsavel.trim(),
        turma: form.turma,
        valorPrincipal: resumoCalculoTitulos.principal || parseFloat(form.valorOriginal) || 0,
        valorEncargos: incluirEncargos ? resumoCalculoTitulos.encargos : 0,
        valorOriginal: parseFloat(form.valorOriginal) || valorNegNum,
        valorEntrada: parseFloat(form.valorEntrada) || 0,
        valorNegociado: valorNegNum,
        desconto: parseFloat(form.desconto) || 0,
        parcelas: nParcelas,
        formaPagamento: form.formaPagamento,
        primeiroVencimento: form.primeiroVencimento || hoje,
        data: form.data || hoje,
        status: 'ativo',
        obs: form.obs.trim(),
        motivoInadimpl: form.motivoInadimpl,
        titulosOriginaisIds: selectedTituloIds,
      }

      setAcordos((prev) => [novo, ...(prev || [])])

      logSystemAction(
        'Financeiro (Renegociação)',
        'Cadastro',
        `Novo acordo de renegociação ${novo.id} para ${novo.alunoNome}`,
        { registroId: novo.id, detalhesDepois: novo }
      )

      const titsParaRenegociar = titulosDoAlunoNoModal.filter((t) => selectedTituloIds.includes(t.id))
      const novasParcelas = cronogramaSimulado.items.map((item, idx) => {
        const suf = item.tipo === 'entrada' ? 'ENT' : `P${String(idx + 1).padStart(2, '0')}`
        return {
          id: `${novo.id}-${suf}`,
          codigo: `${novo.id}-${suf}`,
          aluno: novo.alunoNome,
          responsavel: novo.responsavel,
          descricao:
            item.tipo === 'entrada'
              ? `Entrada Acordo ${novo.id}`
              : `Acordo Renegociação ${novo.id} (${item.numero})`,
          valor: item.valor,
          vencimento: item.vencimento,
          pagamento: null,
          status: 'pendente',
          metodo: novo.formaPagamento || null,
          parcela: item.numero,
          origemLanca: 'renegociacao',
          acordoId: novo.id,
        }
      })

      await Promise.all(
        titsParaRenegociar.map((t) =>
          fetch(`/api/titulos/${t.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...t,
              status: 'renegociado',
              descricao: `${t.descricao} [Reneg. ${novo.id}]`,
              acordoId: novo.id,
            }),
          })
        )
      )

      if (novasParcelas.length > 0) {
        await fetch('/api/titulos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(novasParcelas),
        })
      }

      await queryClient.invalidateQueries({ queryKey: ['titulos-receber'] })
      toast.success(`Acordo ${novo.id} formalizado e ${novasParcelas.length} título(s) gerado(s) no Contas a Receber!`)

      setBuscaAluno('')
      setSelectedTituloIds([])
      setShowModal(false)
      setForm({
        alunoNome: '',
        responsavel: '',
        telefoneResponsavel: '',
        turma: '',
        valorOriginal: '',
        valorNegociado: '',
        valorEntrada: '0',
        desconto: '0',
        parcelas: '3',
        formaPagamento: 'PIX',
        primeiroVencimento: getToday(),
        data: getToday(),
        status: 'ativo',
        obs: '',
        motivoInadimpl: 'Dificuldade financeira',
      })
    } catch (err) {
      console.error('Erro ao persistir renegociação:', err)
      toast.error('Erro ao salvar títulos do acordo.')
    } finally {
      setSaving(false)
    }
  }

  // Progresso real de cada acordo baseado nos títulos gerados em Contas a Receber
  const progressoPorAcordo = useMemo(() => {
    const map = new Map<
      string,
      { totalParcelas: number; pagas: number; atrasadas: number; valorRecebido: number }
    >()
    for (const a of acordos || []) {
      const parcelasTitulos = titulosNormalizados.filter(
        (t) => t.acordoId === a.id || String(t.codigo || '').startsWith(`${a.id}-`) || String(t.id || '').startsWith(`${a.id}-`)
      )
      if (parcelasTitulos.length === 0) {
        map.set(a.id, {
          totalParcelas: a.parcelas,
          pagas: a.status === 'quitado' ? a.parcelas : 0,
          atrasadas: a.status === 'inadimplente' ? 1 : 0,
          valorRecebido: a.status === 'quitado' ? a.valorNegociado : 0,
        })
        continue
      }
      const pagas = parcelasTitulos.filter((t) => t.statusEfetivo === 'pago').length
      const atrasadas = parcelasTitulos.filter((t) => t.statusEfetivo === 'atrasado').length
      const valorRecebido = parcelasTitulos
        .filter((t) => t.statusEfetivo === 'pago')
        .reduce((acc, t) => acc + (Number(t.valor) || 0), 0)
      map.set(a.id, {
        totalParcelas: parcelasTitulos.length,
        pagas,
        atrasadas,
        valorRecebido: Math.round(valorRecebido * 100) / 100,
      })
    }
    return map
  }, [acordos, titulosNormalizados])

  // Filtro corrigido (funciona desde o 1º caractere digitado!)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (acordos || []).filter((a) => {
      const matchStatus = filtroStatus === 'todos' || a.status === filtroStatus
      const matchSearch =
        !q ||
        (a.alunoNome || '').toLowerCase().includes(q) ||
        (a.responsavel || '').toLowerCase().includes(q) ||
        (a.id || '').toLowerCase().includes(q)
      const matchMotivo = filtroMotivo === 'Todos' || a.motivoInadimpl === filtroMotivo
      return matchStatus && matchSearch && matchMotivo
    })
  }, [acordos, filtroStatus, search, filtroMotivo])

  const totalNegociado = useMemo(
    () => (acordos || []).reduce((s, a) => s + (Number(a.valorNegociado) || 0), 0),
    [acordos]
  )
  const totalOriginal = useMemo(
    () => (acordos || []).reduce((s, a) => s + (Number(a.valorOriginal) || 0), 0),
    [acordos]
  )
  const totalDesconto = Math.max(0, totalOriginal - totalNegociado)
  const taxaQuitacao =
    (acordos || []).length > 0
      ? (((acordos || []).filter((a) => a.status === 'quitado').length / (acordos || []).length) * 100).toFixed(0)
      : '0'

  const activeFilters = [filtroStatus !== 'todos', filtroMotivo !== 'Todos'].filter(Boolean).length
  const clearFilters = () => {
    setFiltroStatus('todos')
    setFiltroMotivo('Todos')
    setSearch('')
  }

  // Impressão do Termo de Confissão e Renegociação de Dívida
  const handlePrintTermoAcordo = (a: AcordoRenegociacao) => {
    const win = window.open('', '_blank', 'width=920,height=780')
    if (!win) {
      toast.error('Permita pop-ups para imprimir o Termo de Acordo.')
      return
    }
    const parcV = a.valorNegociado / Math.max(1, a.parcelas)
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Termo de Confissão e Renegociação de Dívida — ${a.id}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 36px; line-height: 1.55; font-size: 13px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 22px; }
    .title { font-size: 18px; font-weight: 800; text-transform: uppercase; }
    .subtitle { font-size: 12px; color: #475569; }
    .box { border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; background: #f8fafc; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; }
    .val { font-size: 14px; font-weight: 800; color: #0f172a; }
    .clause { margin-bottom: 12px; text-align: justify; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 56px; text-align: center; }
    .sig-line { border-top: 1px solid #334155; padding-top: 8px; font-weight: 700; }
    @media print { .no-print { display: none; } body { margin: 20px; } }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:16px;text-align:right;">
    <button onclick="window.print()" style="padding:8px 16px;background:#0f172a;color:#fff;border:none;border-radius:6px;font-weight:700;cursor:pointer;">Imprimir / Salvar PDF</button>
  </div>
  <div class="header">
    <div>
      <div class="title">${escolaNome || 'Colégio Impacto'}</div>
      <div class="subtitle">TERMO DE CONFISSÃO E RENEGOCIAÇÃO DE DÍVIDA ESCOLAR</div>
    </div>
    <div style="text-align:right">
      <div style="font-weight:800;font-size:14px;">ACORDO Nº ${a.id}</div>
      <div class="subtitle">Data de Emissão: ${fmt(a.data)}</div>
    </div>
  </div>

  <div class="box">
    <div class="grid">
      <div><div class="label">Aluno(a) Beneficiário(a)</div><div class="val">${a.alunoNome}</div></div>
      <div><div class="label">Responsável Financeiro</div><div class="val">${a.responsavel || 'Não informado'}</div></div>
      <div><div class="label">Forma de Pagamento</div><div class="val">${a.formaPagamento || 'PIX / Boleto'}</div></div>
    </div>
  </div>

  <div class="box">
    <div class="grid">
      <div><div class="label">Dívida Consolidada Original</div><div class="val" style="color:#dc2626">${fmtCur(a.valorOriginal)}</div></div>
      <div><div class="label">Desconto Concedido</div><div class="val" style="color:#059669">${a.desconto}% (${fmtCur(Math.max(0, a.valorOriginal - a.valorNegociado))})</div></div>
      <div><div class="label">Valor Final Confessado e Negociado</div><div class="val" style="color:#0284c7">${fmtCur(a.valorNegociado)}</div></div>
    </div>
    <div style="margin-top:10px;padding-top:10px;border-top:1px dashed #cbd5e1;display:flex;justify-content:space-between;">
      <span><strong>Condição de Parcelamento:</strong> ${a.parcelas}x de ${fmtCur(parcV)}</span>
      <span><strong>1º Vencimento:</strong> ${fmt(a.primeiroVencimento || a.data)}</span>
    </div>
  </div>

  <div class="clause">
    <strong>CLÁUSULA 1ª (DO OBJETO E CONFISSÃO):</strong> Pelo presente instrumento particular, o(a) RESPONSÁVEL FINANCEIRO acima qualificado(a) reconhece e confessa dever à instituição de ensino a importância líquida e certa de <strong>${fmtCur(a.valorNegociado)}</strong>, referente às obrigações financeiras escolares em atraso do(a) aluno(a) <strong>${a.alunoNome}</strong>.
  </div>
  <div class="clause">
    <strong>CLÁUSULA 2ª (DA FORMA DE PAGAMENTO):</strong> Para quitação do débito ora confessado, a instituição concede desconto condicional de <strong>${a.desconto}%</strong>, comprometendo-se o(a) RESPONSÁVEL FINANCEIRO a liquidar o saldo em <strong>${a.parcelas} parcela(s) mensais e consecutivas</strong> via <strong>${a.formaPagamento || 'PIX / Boleto'}</strong>.
  </div>
  <div class="clause">
    <strong>CLÁUSULA 3ª (DO INADIMPLEMENTO E QUEBRA DE ACORDO):</strong> O atraso superior a 15 (quinze) dias no pagamento de qualquer parcela implicará no vencimento antecipado do saldo devedor e na perda do desconto condicional concedido, retornando o débito ao seu valor original acrescido de multa contratual de 2% e juros de mora de 1% ao mês.
  </div>
  ${a.obs ? `<div class="clause"><strong>OBSERVAÇÕES ESPECIAIS:</strong> ${a.obs}</div>` : ''}

  <div class="signatures">
    <div class="sig-line">
      ${escolaNome || 'Colégio Impacto'}<br/>
      <span style="font-size:11px;font-weight:400;color:#64748b">Tesouraria / Diretoria Financeira</span>
    </div>
    <div class="sig-line">
      ${a.responsavel || 'Responsável Financeiro'}<br/>
      <span style="font-size:11px;font-weight:400;color:#64748b">Devedor(a) / Responsável Legal</span>
    </div>
  </div>
</body>
</html>`
    win.document.write(html)
    win.document.close()
  }

  // Envio de Resumo do Acordo via WhatsApp
  const handleWhatsAppAcordo = (a: AcordoRenegociacao) => {
    const parcV = a.valorNegociado / Math.max(1, a.parcelas)
    const msg =
      `Olá, *${a.responsavel || 'Responsável'}*! Segue o resumo do *Acordo de Renegociação (${a.id})* referente ao(à) aluno(a) *${a.alunoNome}*:\n\n` +
      `• *Valor Original:* ${fmtCur(a.valorOriginal)}\n` +
      `• *Desconto Concedido:* ${a.desconto}%\n` +
      `• *Valor Negociado:* *${fmtCur(a.valorNegociado)}*\n` +
      `• *Parcelamento:* ${a.parcelas}x de *${fmtCur(parcV)}* (${a.formaPagamento || 'PIX/Boleto'})\n` +
      `• *Data do Acordo:* ${fmt(a.data)}\n\n` +
      `Qualquer dúvida, estamos à disposição na Secretaria Financeira!`
    const fone = (a.telefoneResponsavel || '').replace(/\D/g, '')
    const url = fone
      ? `https://wa.me/55${fone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // Exportar Acordos para Excel (.xlsx)
  const handleExportExcel = () => {
    const rows = filtered.map((a) => {
      const prog = progressoPorAcordo.get(a.id)
      return {
        'Código Acordo': a.id,
        Aluno: a.alunoNome,
        Responsável: a.responsavel,
        Motivo: a.motivoInadimpl || '',
        'Data Acordo': fmt(a.data),
        'Valor Original (R$)': a.valorOriginal,
        'Desconto (%)': a.desconto,
        'Valor Negociado (R$)': a.valorNegociado,
        Parcelas: a.parcelas,
        'Parcelas Pagas': prog ? `${prog.pagas}/${prog.totalParcelas}` : `0/${a.parcelas}`,
        'Valor Já Recebido (R$)': prog?.valorRecebido || 0,
        Status: a.status.toUpperCase(),
        Observações: a.obs || '',
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Acordos_Renegociacao')
    XLSX.writeFile(wb, `Renegociacoes_Impacto_${hoje}.xlsx`)
  }

  // Excluir Acordo com confirmação e restauração opcional dos títulos originais
  const handleConfirmDeleteAcordo = async () => {
    if (!confirmDeleteAcordo) return
    const alvo = confirmDeleteAcordo
    setConfirmDeleteAcordo(null)

    setAcordos((prev) => (prev || []).filter((x) => x.id !== alvo.id))
    logSystemAction(
      'Financeiro (Renegociação)',
      'Exclusão',
      `Exclusão do acordo de renegociação ${alvo.id} de ${alvo.alunoNome}`,
      { registroId: alvo.id, detalhesAntes: alvo }
    )

    try {
      // Remove parcelas em aberto geradas pelo acordo
      const parcelasDoAcordo = titulosNormalizados.filter(
        (t) =>
          (t.acordoId === alvo.id || String(t.id || '').startsWith(`${alvo.id}-`)) &&
          t.statusEfetivo !== 'pago'
      )
      if (parcelasDoAcordo.length > 0) {
        await fetch('/api/titulos', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: parcelasDoAcordo.map((p) => p.id) }),
        })
      }

      // Restaura títulos originais que estavam marcados como 'renegociado'
      if (restaurarTitulosAoExcluir) {
        const originais = titulosNormalizados.filter(
          (t) =>
            t.status === 'renegociado' &&
            (t.acordoId === alvo.id || String(t.descricao || '').includes(`[Reneg. ${alvo.id}]`))
        )
        await Promise.all(
          originais.map((t) =>
            fetch(`/api/titulos/${t.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...t,
                status: 'atrasado',
                descricao: String(t.descricao || '').replace(` [Reneg. ${alvo.id}]`, ''),
                acordoId: null,
              }),
            })
          )
        )
      }

      await queryClient.invalidateQueries({ queryKey: ['titulos-receber'] })
      toast.success(`Acordo ${alvo.id} removido com sucesso.`)
    } catch {
      toast.error('Acordo removido localmente, mas houve falha ao atualizar títulos vinculados.')
    }
  }

  if (l1 || l2) return <PageSkeleton />

  const valorOrig = parseFloat(form.valorOriginal) || 0

  return (
    <div>
      {/* ── CABEÇALHO ────────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Renegociação de Dívidas</h1>
          <p className="page-subtitle">
            Central de acordos, confissão de dívida e parcelamento integrado ao Contas a Receber
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {radarInadimplencia.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowRadar((p) => !p)}
              style={{
                borderColor: 'rgba(239,68,68,0.35)',
                color: '#dc2626',
                background: showRadar ? 'rgba(239,68,68,0.1)' : undefined,
              }}
            >
              <AlertTriangle size={13} />
              Radar Inadimplentes ({radarInadimplencia.length})
            </button>
          )}
          {(acordos || []).length > 0 && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleExportExcel}>
              <FileSpreadsheet size={13} />
              Exportar Excel
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowFilters((p) => !p)}>
            <Filter size={13} />
            Filtros {activeFilters > 0 && `(${activeFilters})`}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setShowModal(true)
            }}
          >
            <Plus size={13} />
            Novo Acordo
          </button>
        </div>
      </div>

      {/* ── 5 KPIs EXECUTIVOS ────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 12,
          marginBottom: 18,
        }}
      >
        {[
          {
            label: 'Acordos Ativos',
            value: (acordos || []).filter((a) => a.status === 'ativo').length,
            color: '#0891b2',
            icon: '📋',
            sub: `${(acordos || []).length} acordo(s) no total`,
          },
          {
            label: 'Quitados',
            value: (acordos || []).filter((a) => a.status === 'quitado').length,
            color: '#10b981',
            icon: '✅',
            sub: `Taxa de quitação: ${taxaQuitacao}%`,
          },
          {
            label: 'Inadimpl. Base',
            value: radarInadimplencia.length,
            color: '#ef4444',
            icon: '⚠️',
            sub: `${titulosAtrasados.length} título(s) vencido(s)`,
          },
          {
            label: 'Total Negociado',
            value: fmtCur(totalNegociado),
            color: '#f59e0b',
            icon: '💰',
            sub: `Original: ${fmtCur(totalOriginal)}`,
          },
          {
            label: 'Desconto Concedido',
            value: fmtCur(totalDesconto),
            color: '#8b5cf6',
            icon: '🎯',
            sub: `Taxa quitação ${taxaQuitacao}%`,
          },
        ].map((k) => (
          <div key={k.label} className="kpi-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 16 }}>{k.icon}</span>
              <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>{k.label}</span>
            </div>
            <div
              style={{
                fontSize: typeof k.value === 'string' ? 17 : 22,
                fontWeight: 800,
                color: k.color,
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              {k.value}
            </div>
            {k.sub && <div style={{ fontSize: 10.5, color: 'hsl(var(--text-muted))', marginTop: 4 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── RADAR DE ALUNOS COM PENDÊNCIAS VENCIDAS (1-CLICK ACORDO) ─────────── */}
      {(showRadar || (radarInadimplencia.length > 0 && (acordos || []).length === 0)) &&
        radarInadimplencia.length > 0 && (
          <div
            className="card"
            style={{
              padding: '16px 20px',
              marginBottom: 18,
              border: '1px solid rgba(245, 158, 11, 0.35)',
              background: 'rgba(245, 158, 11, 0.04)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <TrendingDown size={18} color="#d97706" />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 800 }}>
                    Radar de Alunos com Pendências Vencidas ({radarInadimplencia.length})
                  </div>
                  <div style={{ fontSize: 11.5, color: 'hsl(var(--text-muted))' }}>
                    Clique em &ldquo;Iniciar Acordo&rdquo; para carregar automaticamente os títulos em atraso e calcular encargos
                  </div>
                </div>
              </div>
              {showRadar && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowRadar(false)}
                >
                  <X size={14} /> Fechar Radar
                </button>
              )}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                gap: 10,
              }}
            >
              {radarInadimplencia.slice(0, 9).map((item) => (
                <div
                  key={item.alunoNome}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: 'hsl(var(--bg-elevated))',
                    border: '1px solid hsl(var(--border-subtle))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.alunoNome}
                    </div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                      {item.qtdTitulos > 0 ? `${item.qtdTitulos} título(s) • até ${item.maiorAtraso}d atraso` : 'Inadimplência cadastral'}
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: '#ef4444', marginTop: 3 }}>
                      {fmtCur(item.valorPrincipal)}
                      {item.valorEncargos > 0 && (
                        <span style={{ fontSize: 10.5, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>
                          {' '}
                          (+{fmtCur(item.valorEncargos)} encargos)
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ flexShrink: 0, fontSize: 11.5 }}
                    onClick={() => {
                      handleSelectAluno(item.alunoNome)
                      setShowModal(true)
                    }}
                  >
                    Iniciar Acordo
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* ── BARRA DE BUSCA E ABAS DE STATUS ──────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="tab-list">
          {(
            [
              ['todos', 'Todos'],
              ['ativo', 'Ativos'],
              ['quitado', 'Quitados'],
              ['inadimplente', 'Inadimp.'],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              className={`tab-trigger ${filtroStatus === v ? 'active' : ''}`}
              onClick={() => setFiltroStatus(v)}
            >
              {l}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'hsl(var(--text-muted))',
            }}
          />
          <input
            type="text"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="form-input"
            style={{ paddingLeft: 36 }}
            placeholder="Buscar aluno, responsável ou código do acordo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {(activeFilters > 0 || search) && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ color: '#ef4444' }}
            onClick={clearFilters}
          >
            <X size={13} />
            Limpar
          </button>
        )}
      </div>

      {showFilters && (
        <div
          style={{
            display: 'flex',
            gap: 12,
            marginBottom: 14,
            padding: 14,
            background: 'hsl(var(--bg-elevated))',
            borderRadius: 12,
            flexWrap: 'wrap',
            border: '1px solid hsl(var(--border-subtle))',
          }}
        >
          <div>
            <label className="form-label" style={{ fontSize: 10.5 }}>
              Motivo da Inadimplência
            </label>
            <select
              className="form-input"
              style={{ minWidth: 210, fontSize: 12.5 }}
              value={filtroMotivo}
              onChange={(e) => setFiltroMotivo(e.target.value)}
            >
              <option value="Todos">Todos os motivos</option>
              {MOTIVOS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ── LISTA DE ACORDOS OU EMPTY STATE CENTRALIZADO ─────────────────────── */}
      {(acordos || []).length === 0 ? (
        <div
          className="card"
          style={{
            padding: '56px 32px',
            textAlign: 'center',
            color: 'hsl(var(--text-muted))',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: 20,
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#6366f1',
            }}
          >
            <RefreshCw size={32} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'hsl(var(--text-primary))', marginBottom: 6 }}>
            Nenhum acordo cadastrado
          </div>
          <div style={{ fontSize: 13, maxWidth: 440, margin: '0 auto 22px', lineHeight: 1.5 }}>
            Registre acordos de renegociação com responsáveis inadimplentes, gere parcelas automaticamente no Contas a
            Receber e emita o Termo de Confissão de Dívida.
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={15} />
            Novo Acordo
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((a) => {
            const badge = STATUS_BADGE[a.status] || STATUS_BADGE.ativo
            const parcV = a.valorNegociado / Math.max(1, a.parcelas)
            const prog = progressoPorAcordo.get(a.id) || {
              totalParcelas: a.parcelas,
              pagas: 0,
              atrasadas: 0,
              valorRecebido: 0,
            }
            const pctPago =
              prog.totalParcelas > 0 ? Math.min(100, Math.round((prog.pagas / prog.totalParcelas) * 100)) : 0

            return (
              <div
                key={a.id}
                className="card"
                style={{
                  padding: '18px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: 1, minWidth: 260 }}>
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 12,
                      background: 'rgba(245, 158, 11, 0.12)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <FileText size={21} color="#d97706" />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 800,
                          padding: '2px 7px',
                          borderRadius: 6,
                          background: 'rgba(99, 102, 241, 0.1)',
                          color: '#6366f1',
                        }}
                      >
                        {a.id}
                      </span>
                      <span style={{ fontWeight: 800, fontSize: 14.5 }}>{a.alunoNome}</span>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 700,
                          background: badge.bg,
                          border: `1px solid ${badge.border}`,
                          color: badge.cor,
                        }}
                      >
                        {badge.label}
                      </span>
                      {a.motivoInadimpl && (
                        <span style={{ fontSize: 11.5, color: 'hsl(var(--text-muted))' }}>• {a.motivoInadimpl}</span>
                      )}
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        color: 'hsl(var(--text-muted))',
                        marginTop: 6,
                        display: 'flex',
                        gap: 14,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span>👤 {a.responsavel || '—'}</span>
                      <span>📅 Acordo: {fmt(a.data)}</span>
                      <span>
                        📋 {a.parcelas}x de <strong>{fmtCur(parcV)}</strong> ({a.formaPagamento || 'PIX'})
                      </span>
                      {a.desconto > 0 && (
                        <span style={{ color: '#059669', fontWeight: 700 }}>🎯 {a.desconto}% desconto</span>
                      )}
                    </div>

                    {/* Barra de progresso real das parcelas no Contas a Receber */}
                    <div style={{ marginTop: 10, maxWidth: 420 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 11,
                          marginBottom: 4,
                          color: 'hsl(var(--text-muted))',
                        }}
                      >
                        <span>
                          Progresso de Recebimento: <strong>{prog.pagas}</strong> de{' '}
                          <strong>{prog.totalParcelas}</strong> parcela(s) paga(s)
                        </span>
                        <span style={{ fontWeight: 700, color: '#059669' }}>
                          {fmtCur(prog.valorRecebido)} ({pctPago}%)
                        </span>
                      </div>
                      <div
                        style={{
                          height: 6,
                          borderRadius: 99,
                          background: 'rgba(148, 163, 184, 0.2)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${pctPago}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #10b981, #06b6d4)',
                            borderRadius: 99,
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>

                    {a.obs && (
                      <div
                        style={{
                          fontSize: 11.5,
                          color: 'hsl(var(--text-muted))',
                          marginTop: 6,
                          fontStyle: 'italic',
                        }}
                      >
                        Obs: {a.obs}
                      </div>
                    )}
                  </div>
                </div>

                {/* Valores e Botões de Ação */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#059669' }}>{fmtCur(a.valorNegociado)}</div>
                    {a.valorOriginal > a.valorNegociado && (
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', textDecoration: 'line-through' }}>
                        Original: {fmtCur(a.valorOriginal)}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      title="Imprimir Termo de Confissão de Dívida"
                      onClick={() => handlePrintTermoAcordo(a)}
                      style={{ fontSize: 11.5 }}
                    >
                      <Printer size={13} />
                      Termo
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      title="Enviar resumo do acordo por WhatsApp"
                      onClick={() => handleWhatsAppAcordo(a)}
                      style={{ fontSize: 11.5, color: '#059669' }}
                    >
                      <MessageCircle size={13} />
                      WhatsApp
                    </button>

                    {a.status === 'ativo' && (
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        style={{ fontSize: 11.5 }}
                        onClick={() => {
                          setAcordos((prev) =>
                            (prev || []).map((x) => (x.id === a.id ? { ...x, status: 'quitado' } : x))
                          )
                          logSystemAction(
                            'Financeiro (Renegociação)',
                            'Edição',
                            `Acordo de renegociação ${a.id} de ${a.alunoNome} marcado como quitado`,
                            { registroId: a.id, detalhesDepois: { ...a, status: 'quitado' } }
                          )
                          toast.success(`Acordo ${a.id} marcado como quitado!`)
                        }}
                      >
                        <CheckCircle size={12} />
                        Quitar
                      </button>
                    )}

                    <button
                      type="button"
                      title="Excluir / Estornar Acordo"
                      onClick={() => setConfirmDeleteAcordo(a)}
                      className="btn btn-ghost btn-icon btn-sm"
                      style={{ color: '#ef4444' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}

          {filtered.length === 0 && (acordos || []).length > 0 && (
            <div
              className="card"
              style={{ padding: 32, textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}
            >
              Nenhum acordo encontrado para os filtros aplicados.
            </div>
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════
          MODAL: NOVO ACORDO DE RENEGOCIAÇÃO (COM SIMULADOR DE PARCELAS E ENCARGOS)
         ═════════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              backdropFilter: 'blur(6px)',
              padding: 20,
            }}
            onClick={() => setShowModal(false)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.96, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 16 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              style={{
                background: 'hsl(var(--bg-elevated))',
                border: '1px solid hsl(var(--border-subtle))',
                borderRadius: 20,
                padding: '24px 26px',
                width: '100%',
                maxWidth: 650,
                boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
                maxHeight: '92vh',
                overflowY: 'auto',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 18,
                  paddingBottom: 12,
                  borderBottom: '1px solid hsl(var(--border-subtle))',
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 17.5 }}>Novo Acordo de Renegociação</div>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                    Selecione o aluno, consolide títulos vencidos e gere o novo parcelamento
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'hsl(var(--text-muted))',
                    padding: 4,
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Seleção de Aluno + Responsável */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 12, alignItems: 'end' }}>
                  <div style={{ position: 'relative' }}>
                    <label className="form-label">Aluno *</label>
                    <div style={{ position: 'relative' }}>
                      <Search
                        size={13}
                        style={{
                          position: 'absolute',
                          left: 11,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: 'hsl(var(--text-muted))',
                          pointerEvents: 'none',
                        }}
                      />
                      <input
                        className="form-input"
                        style={{ paddingLeft: 34 }}
                        placeholder="Buscar aluno pelo nome..."
                        value={buscaAluno}
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        onChange={(e) => {
                          setBuscaAluno(e.target.value)
                          setShowAlunoDropdown(true)
                          if (!e.target.value) {
                            setForm((f) => ({ ...f, alunoNome: '', responsavel: '', telefoneResponsavel: '' }))
                            setSelectedTituloIds([])
                          }
                        }}
                        onFocus={() => setShowAlunoDropdown(true)}
                        autoComplete="off"
                      />
                      {form.alunoNome && (
                        <button
                          type="button"
                          onClick={() => {
                            setBuscaAluno('')
                            setForm((f) => ({ ...f, alunoNome: '', responsavel: '', telefoneResponsavel: '' }))
                            setSelectedTituloIds([])
                            setShowAlunoDropdown(false)
                          }}
                          style={{
                            position: 'absolute',
                            right: 10,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'hsl(var(--text-muted))',
                            padding: 2,
                          }}
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>

                    {showAlunoDropdown &&
                      buscaAluno.length >= 1 &&
                      (() => {
                        const matches = (alunos || [])
                          .filter((a: any) => (a.nome || '').toLowerCase().includes(buscaAluno.toLowerCase()))
                          .slice(0, 8)
                        if (matches.length === 0)
                          return (
                            <div
                              style={{
                                position: 'absolute',
                                zIndex: 50,
                                width: '100%',
                                background: 'hsl(var(--bg-elevated))',
                                border: '1px solid hsl(var(--border-subtle))',
                                borderRadius: 8,
                                padding: '10px 14px',
                                fontSize: 12,
                                color: 'hsl(var(--text-muted))',
                                marginTop: 3,
                                boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                              }}
                            >
                              Nenhum aluno encontrado
                            </div>
                          )
                        return (
                          <div
                            style={{
                              position: 'absolute',
                              zIndex: 50,
                              width: '100%',
                              background: 'hsl(var(--bg-elevated))',
                              border: '1px solid hsl(var(--border-subtle))',
                              borderRadius: 10,
                              overflow: 'hidden',
                              marginTop: 3,
                              boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
                            }}
                          >
                            {matches.map((a: any) => {
                              const temAtraso = radarInadimplencia.some((r) => r.alunoNome === a.nome)
                              return (
                                <button
                                  key={a.id}
                                  type="button"
                                  onMouseDown={() => handleSelectAluno(a.nome)}
                                  style={{
                                    width: '100%',
                                    padding: '9px 14px',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                  }}
                                >
                                  <div
                                    style={{
                                      width: 30,
                                      height: 30,
                                      borderRadius: '50%',
                                      background:
                                        a.inadimplente || temAtraso
                                          ? 'rgba(239,68,68,0.15)'
                                          : 'rgba(99,102,241,0.15)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: 11,
                                      fontWeight: 800,
                                      color: a.inadimplente || temAtraso ? '#ef4444' : '#6366f1',
                                      flexShrink: 0,
                                    }}
                                  >
                                    {(a.nome || 'A').charAt(0).toUpperCase()}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                      style={{
                                        fontSize: 13,
                                        fontWeight: 700,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                      }}
                                    >
                                      {a.nome}
                                      {(a.inadimplente || temAtraso) && (
                                        <span
                                          style={{
                                            fontSize: 9,
                                            padding: '1px 5px',
                                            borderRadius: 4,
                                            background: 'rgba(239,68,68,0.15)',
                                            color: '#ef4444',
                                            fontWeight: 800,
                                          }}
                                        >
                                          PENDÊNCIA
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: 10.5, color: 'hsl(var(--text-muted))' }}>
                                      {a.turma || 'Sem turma'} • {a.responsavel || 'Sem responsável'}
                                    </div>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        )
                      })()}
                  </div>

                  <div>
                    <label className="form-label">Responsável Financeiro</label>
                    <input
                      value={form.responsavel}
                      onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))}
                      placeholder="Preenchido ao selecionar aluno"
                      className="form-input"
                    />
                  </div>
                </div>

                {/* Lista de Títulos do Aluno para Consolidar no Acordo */}
                {form.alunoNome && titulosDoAlunoNoModal.length > 0 && (
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: '1px solid hsl(var(--border-subtle))',
                      background: 'rgba(148, 163, 184, 0.05)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 8,
                        flexWrap: 'wrap',
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 11.5, fontWeight: 800 }}>
                        Títulos em Aberto / Vencidos de {form.alunoNome} ({selectedTituloIds.length} selecionado(s))
                      </span>
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          color: '#d97706',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={incluirEncargos}
                          onChange={(e) => setIncluirEncargos(e.target.checked)}
                        />
                        Incluir Multa (2%) + Mora (1% a.m.)
                      </label>
                    </div>

                    <div style={{ maxHeight: 135, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {titulosDoAlunoNoModal.map((t) => {
                        const checked = selectedTituloIds.includes(t.id)
                        const enc = calcularMultaJuros(t.valor, t.diasEmAtraso)
                        return (
                          <label
                            key={t.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 10px',
                              borderRadius: 8,
                              background: checked ? 'rgba(99, 102, 241, 0.08)' : 'hsl(var(--bg-elevated))',
                              border: checked
                                ? '1px solid rgba(99, 102, 241, 0.35)'
                                : '1px solid hsl(var(--border-subtle))',
                              fontSize: 11.5,
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedTituloIds((prev) => [...prev, t.id])
                                  } else {
                                    setSelectedTituloIds((prev) => prev.filter((id) => id !== t.id))
                                  }
                                }}
                              />
                              <div>
                                <div style={{ fontWeight: 700 }}>{t.descricao}</div>
                                <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>
                                  Venc: {fmt(t.vencimento)}{' '}
                                  {t.diasEmAtraso > 0 ? `• ${t.diasEmAtraso}d em atraso` : '• A vencer'}
                                </div>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 800, color: t.diasEmAtraso > 0 ? '#ef4444' : undefined }}>
                                {fmtCur(t.valor)}
                              </div>
                              {incluirEncargos && enc.totalEncargos > 0 && (
                                <div style={{ fontSize: 9.5, color: '#d97706', fontWeight: 700 }}>
                                  +{fmtCur(enc.totalEncargos)} encargos
                                </div>
                              )}
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Motivo + Forma de Pagamento */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end' }}>
                  <div>
                    <label className="form-label">Motivo da Inadimplência</label>
                    <select
                      className="form-input"
                      value={form.motivoInadimpl}
                      onChange={(e) => setForm((f) => ({ ...f, motivoInadimpl: e.target.value }))}
                    >
                      {MOTIVOS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Forma de Pagamento do Acordo</label>
                    <select
                      className="form-input"
                      value={form.formaPagamento}
                      onChange={(e) => setForm((f) => ({ ...f, formaPagamento: e.target.value }))}
                    >
                      {FORMAS_PAGAMENTO.map((fp) => (
                        <option key={fp} value={fp}>
                          {fp}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Linha de Valores Alinhada Perfeitamente (Sem quebra de label!) */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 12,
                    alignItems: 'end',
                  }}
                >
                  <div>
                    <label className="form-label" style={{ whiteSpace: 'nowrap' }}>
                      Valor Original (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.valorOriginal}
                      onChange={(e) => {
                        const vOrig = parseFloat(e.target.value) || 0
                        const vn = (vOrig * (1 - (parseFloat(form.desconto) || 0) / 100)).toFixed(2)
                        setForm((f) => ({ ...f, valorOriginal: e.target.value, valorNegociado: vn }))
                      }}
                      placeholder="0.00"
                      className="form-input"
                      style={{ color: '#ef4444', fontWeight: 800 }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ whiteSpace: 'nowrap' }}>
                      Desconto (%)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min={0}
                      max={100}
                      value={form.desconto}
                      onChange={(e) => handleDescontoChange(e.target.value)}
                      placeholder="0"
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ whiteSpace: 'nowrap' }}>
                      Valor Negociado (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.valorNegociado}
                      onChange={(e) => handleValorNegChange(e.target.value)}
                      placeholder="0.00"
                      className="form-input"
                      style={{ color: '#059669', fontWeight: 800 }}
                    />
                  </div>
                </div>

                {/* Entrada + Nº de Parcelas + 1º Vencimento */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 12,
                    alignItems: 'end',
                  }}
                >
                  <div>
                    <label className="form-label" style={{ whiteSpace: 'nowrap' }}>
                      Sinal / Entrada (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={form.valorEntrada}
                      onChange={(e) => setForm((f) => ({ ...f, valorEntrada: e.target.value }))}
                      placeholder="0.00"
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ whiteSpace: 'nowrap' }}>
                      Nº de Parcelas
                    </label>
                    <select
                      className="form-input"
                      value={form.parcelas}
                      onChange={(e) => setForm((f) => ({ ...f, parcelas: e.target.value }))}
                    >
                      <option value="1">À vista (1x)</option>
                      <option value="2">2x mensais</option>
                      <option value="3">3x mensais</option>
                      <option value="4">4x mensais</option>
                      <option value="5">5x mensais</option>
                      <option value="6">6x mensais</option>
                      <option value="8">8x mensais</option>
                      <option value="10">10x mensais</option>
                      <option value="12">12x mensais</option>
                      <option value="18">18x mensais</option>
                      <option value="24">24x mensais</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label" style={{ whiteSpace: 'nowrap' }}>
                      1º Vencimento
                    </label>
                    <input
                      type="date"
                      value={form.primeiroVencimento}
                      onChange={(e) => setForm((f) => ({ ...f, primeiroVencimento: e.target.value }))}
                      className="form-input"
                    />
                  </div>
                </div>

                {/* Preview do Acordo + Cronograma de Parcelas */}
                {(valorOrig > 0 || cronogramaSimulado.totalNeg > 0) && (
                  <div
                    style={{
                      padding: '12px 16px',
                      background: 'rgba(16, 185, 129, 0.07)',
                      borderRadius: 12,
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 8,
                      }}
                    >
                      <span style={{ fontWeight: 800, fontSize: 12, color: '#059669' }}>
                        Resumo & Cronograma das Parcelas que Serão Geradas
                      </span>
                      <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                        Economia: <strong style={{ color: '#059669' }}>{fmtCur(Math.max(0, valorOrig - cronogramaSimulado.totalNeg))}</strong>
                      </span>
                    </div>

                    <div
                      style={{
                        maxHeight: 120,
                        overflowY: 'auto',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
                        gap: 6,
                      }}
                    >
                      {cronogramaSimulado.items.map((it) => (
                        <div
                          key={it.numero}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 8,
                            background: 'hsl(var(--bg-elevated))',
                            border: '1px solid hsl(var(--border-subtle))',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: 11,
                          }}
                        >
                          <span>
                            <strong>{it.numero}</strong> • {fmt(it.vencimento)}
                          </span>
                          <strong style={{ color: '#059669' }}>{fmtCur(it.valor)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="form-label">Condições Especiais e Observações</label>
                  <textarea
                    value={form.obs}
                    onChange={(e) => setForm((f) => ({ ...f, obs: e.target.value }))}
                    placeholder="Descreva as condições acordadas, garantias ou observações para constar no Termo de Confissão..."
                    className="form-input"
                    rows={2}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!form.alunoNome || saving}
                  className="btn btn-primary"
                  style={{ flex: 2 }}
                >
                  {saving ? 'Gerando Acordo e Parcelas...' : '✓ Formalizar Acordo e Gerar Parcelas'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL DE CONFIRMAÇÃO DE EXCLUSÃO / ESTORNO DO ACORDO ─────────────── */}
      {confirmDeleteAcordo && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 20,
          }}
          onClick={() => setConfirmDeleteAcordo(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{
              maxWidth: 440,
              width: '100%',
              padding: 24,
              borderRadius: 18,
              border: '1px solid rgba(239, 68, 68, 0.35)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Trash2 size={20} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Cancelar / Excluir Acordo {confirmDeleteAcordo.id}</div>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                  Aluno(a): <strong>{confirmDeleteAcordo.alunoNome}</strong>
                </div>
              </div>
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 10,
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                fontSize: 12,
                cursor: 'pointer',
                marginTop: 10,
              }}
            >
              <input
                type="checkbox"
                checked={restaurarTitulosAoExcluir}
                onChange={(e) => setRestaurarTitulosAoExcluir(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span>
                Restaurar os títulos originais para o status <strong>Em Atraso</strong> e remover as parcelas em aberto
                deste acordo no Contas a Receber
              </span>
            </label>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setConfirmDeleteAcordo(null)}
              >
                Voltar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1, background: '#dc2626', borderColor: '#dc2626' }}
                onClick={handleConfirmDeleteAcordo}
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
