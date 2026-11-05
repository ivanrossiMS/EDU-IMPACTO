'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  useData,
  newId,
  ConfigCentroCusto,
  CENTROS_CUSTO_DEFAULT,
} from '@/lib/dataContext'
import { formatCurrency } from '@/lib/utils'
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Check,
  Target,
  Download,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Layers,
  GraduationCap,
  Building2,
  Wrench,
  Megaphone,
  Rocket,
  ArrowUpRight,
  RotateCcw,
  Copy,
  Sparkles,
  PieChart,
  TrendingDown,
  TrendingUp,
  SlidersHorizontal,
} from 'lucide-react'
import * as XLSX from 'xlsx'

const TIPO_META: Record<
  ConfigCentroCusto['tipo'],
  { label: string; badgeBg: string; badgeBorder: string; badgeColor: string; icon: string }
> = {
  pedagogico: {
    label: 'Pedagógico / Ensino',
    badgeBg: 'rgba(56, 189, 248, 0.12)',
    badgeBorder: 'rgba(56, 189, 248, 0.28)',
    badgeColor: '#38bdf8',
    icon: '🎓',
  },
  administrativo: {
    label: 'Administrativo & Gestão',
    badgeBg: 'rgba(245, 158, 11, 0.12)',
    badgeBorder: 'rgba(245, 158, 11, 0.28)',
    badgeColor: '#f59e0b',
    icon: '🏢',
  },
  operacional: {
    label: 'Operacional & Infra',
    badgeBg: 'rgba(6, 182, 212, 0.12)',
    badgeBorder: 'rgba(6, 182, 212, 0.28)',
    badgeColor: '#06b6d4',
    icon: '⚙️',
  },
  comercial: {
    label: 'Comercial & Captação',
    badgeBg: 'rgba(244, 63, 94, 0.12)',
    badgeBorder: 'rgba(244, 63, 94, 0.28)',
    badgeColor: '#f43f5e',
    icon: '📣',
  },
  projetos: {
    label: 'Projetos, Eventos & Extra',
    badgeBg: 'rgba(168, 85, 247, 0.12)',
    badgeBorder: 'rgba(168, 85, 247, 0.28)',
    badgeColor: '#a855f7',
    icon: '🚀',
  },
}

const NATUREZA_META: Record<
  ConfigCentroCusto['natureza'],
  { label: string; short: string; color: string; bg: string; border: string }
> = {
  ambos: {
    label: 'Contas a Pagar & Receber',
    short: 'Pagar & Receber',
    color: '#60a5fa',
    bg: 'rgba(59, 130, 246, 0.12)',
    border: 'rgba(59, 130, 246, 0.28)',
  },
  despesa: {
    label: 'Somente Contas a Pagar (Saídas)',
    short: 'Contas a Pagar',
    color: '#f87171',
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.28)',
  },
  receita: {
    label: 'Somente Contas a Receber (Entradas)',
    short: 'Contas a Receber',
    color: '#34d399',
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.28)',
  },
}

const PALETA_CORES = [
  '#ec4899',
  '#38bdf8',
  '#6366f1',
  '#a855f7',
  '#10b981',
  '#f59e0b',
  '#06b6d4',
  '#f43f5e',
  '#84cc16',
  '#f97316',
  '#14b8a6',
  '#3b82f6',
]

const SUGESTOES_ESCOLARES: Array<Omit<ConfigCentroCusto, 'id' | 'codigo' | 'createdAt'>> = [
  {
    sigla: 'BERC',
    nome: 'Berçário & Maternal',
    descricao: 'Primeira Infância — Berçário I/II e Maternal',
    tipo: 'pedagogico',
    natureza: 'ambos',
    cor: '#f472b6',
    responsavel: 'Coordenação Educação Infantil',
    orcamentoMensal: 35000,
    pesoRateioPadrao: 0,
    unidadeId: '',
    situacao: 'ativo',
  },
  {
    sigla: 'ESP',
    nome: 'Esportes, Cultura & Extracurricular',
    descricao: 'Escolinhas Esportivas, Dança, Música, Robótica e Olimpíadas',
    tipo: 'projetos',
    natureza: 'ambos',
    cor: '#f97316',
    responsavel: 'Coordenação de Esportes & Cultura',
    orcamentoMensal: 22000,
    pesoRateioPadrao: 0,
    unidadeId: '',
    situacao: 'ativo',
  },
  {
    sigla: 'CANT',
    nome: 'Cantina, Refeitório & Nutrição',
    descricao: 'Alimentação Escolar, Merenda, Nutrição e Cantina',
    tipo: 'operacional',
    natureza: 'ambos',
    cor: '#84cc16',
    responsavel: 'Nutricionista Responsável',
    orcamentoMensal: 28000,
    pesoRateioPadrao: 0,
    unidadeId: '',
    situacao: 'ativo',
  },
  {
    sigla: 'TI',
    nome: 'Tecnologia & Inovação Educacional',
    descricao: 'Laboratórios de Informática, Rede, Sistemas, ERP e Lousas Digitais',
    tipo: 'operacional',
    natureza: 'despesa',
    cor: '#3b82f6',
    responsavel: 'Coordenação de TI',
    orcamentoMensal: 18000,
    pesoRateioPadrao: 0,
    unidadeId: '',
    situacao: 'ativo',
  },
  {
    sigla: 'BIB',
    nome: 'Biblioteca & Laboratórios de Ciências',
    descricao: 'Acervo Bibliográfico, Laboratórios de Física/Química/Biologia e Maker',
    tipo: 'pedagogico',
    natureza: 'despesa',
    cor: '#14b8a6',
    responsavel: 'Coordenação Pedagógica Geral',
    orcamentoMensal: 12000,
    pesoRateioPadrao: 0,
    unidadeId: '',
    situacao: 'ativo',
  },
  {
    sigla: 'TRANSP',
    nome: 'Transporte Escolar & Excursões',
    descricao: 'Frota Escolar, Fretamento de Ônibus e Estudos do Meio',
    tipo: 'operacional',
    natureza: 'ambos',
    cor: '#eab308',
    responsavel: 'Logística & Operações',
    orcamentoMensal: 15000,
    pesoRateioPadrao: 0,
    unidadeId: '',
    situacao: 'ativo',
  },
]

const EMPTY_FORM: Omit<ConfigCentroCusto, 'id' | 'createdAt'> = {
  codigo: '',
  sigla: '',
  nome: '',
  descricao: '',
  tipo: 'pedagogico',
  natureza: 'ambos',
  cor: '#38bdf8',
  responsavel: '',
  orcamentoMensal: 0,
  pesoRateioPadrao: 0,
  unidadeId: '',
  situacao: 'ativo',
}

function normalizeCentroCustoItem(raw: any, idx: number): ConfigCentroCusto {
  const rawNome = String(raw?.nome || raw?.descricao || raw?.label || raw?.titulo || `Centro ${idx + 1}`).trim()
  const rawDesc = String(raw?.descricao || raw?.label || rawNome).trim()
  const preset = CENTROS_CUSTO_DEFAULT.find(
    d =>
      d.nome.toLowerCase() === rawNome.toLowerCase() ||
      d.descricao.toLowerCase() === rawDesc.toLowerCase() ||
      (raw?.sigla && d.sigla.toLowerCase() === String(raw.sigla).toLowerCase())
  )

  const codigo = String(raw?.codigo || preset?.codigo || `CC${String(idx + 1).padStart(3, '0')}`)
    .trim()
    .toUpperCase()

  const defaultSigla =
    preset?.sigla ||
    rawNome
      .split(/\s+/)
      .filter(Boolean)
      .map(w => w[0])
      .join('')
      .slice(0, 4)
      .toUpperCase() ||
    rawNome.slice(0, 4).toUpperCase() ||
    'CC'

  const sigla = String(raw?.sigla || defaultSigla)
    .trim()
    .toUpperCase()
    .slice(0, 8)

  const rawTipo = String(raw?.tipo || preset?.tipo || 'pedagogico').toLowerCase()
  const tipo: ConfigCentroCusto['tipo'] = (
    ['pedagogico', 'administrativo', 'operacional', 'comercial', 'projetos'].includes(rawTipo)
      ? rawTipo
      : preset?.tipo || 'pedagogico'
  ) as ConfigCentroCusto['tipo']

  const rawNat = String(raw?.natureza || preset?.natureza || 'ambos').toLowerCase()
  const natureza: ConfigCentroCusto['natureza'] = (
    ['ambos', 'despesa', 'receita'].includes(rawNat)
      ? rawNat
      : preset?.natureza || 'ambos'
  ) as ConfigCentroCusto['natureza']

  const cor =
    typeof raw?.cor === 'string' && raw.cor.trim().startsWith('#')
      ? raw.cor.trim()
      : preset?.cor || PALETA_CORES[idx % PALETA_CORES.length]

  const situacao: 'ativo' | 'inativo' =
    String(raw?.situacao || 'ativo').toLowerCase() === 'inativo' ? 'inativo' : 'ativo'

  return {
    id: String(raw?.id || preset?.id || `CC-${idx + 1}`),
    codigo,
    sigla,
    nome: rawNome,
    descricao: rawDesc,
    tipo,
    natureza,
    cor,
    responsavel: String(raw?.responsavel ?? preset?.responsavel ?? '').trim(),
    orcamentoMensal:
      typeof raw?.orcamentoMensal === 'number'
        ? raw.orcamentoMensal
        : Number(raw?.orcamentoMensal ?? preset?.orcamentoMensal ?? 0) || 0,
    pesoRateioPadrao:
      typeof raw?.pesoRateioPadrao === 'number'
        ? raw.pesoRateioPadrao
        : Number(raw?.pesoRateioPadrao ?? preset?.pesoRateioPadrao ?? 0) || 0,
    unidadeId: String(raw?.unidadeId || ''),
    situacao,
    createdAt: String(raw?.createdAt || new Date().toISOString()),
  }
}

export default function CentroCustoPage() {
  const {
    cfgCentrosCusto,
    setCfgCentrosCusto,
    mantenedores,
    logSystemAction,
  } = useData()

  const centrosCusto: ConfigCentroCusto[] = useMemo(() => {
    if (Array.isArray(cfgCentrosCusto) && cfgCentrosCusto.length > 0) {
      return cfgCentrosCusto
        .filter(Boolean)
        .map((item, idx) => normalizeCentroCustoItem(item, idx))
    }
    return CENTROS_CUSTO_DEFAULT
  }, [cfgCentrosCusto])

  // Normaliza automaticamente registros legados que não possuíam campo `nome` ou `sigla`
  useEffect(() => {
    if (
      Array.isArray(cfgCentrosCusto) &&
      cfgCentrosCusto.length > 0 &&
      cfgCentrosCusto.some((c: any) => !c || typeof c.nome !== 'string' || !c.nome.trim() || !c.sigla)
    ) {
      setCfgCentrosCusto(
        cfgCentrosCusto.filter(Boolean).map((item, idx) => normalizeCentroCustoItem(item, idx))
      )
    }
  }, [cfgCentrosCusto, setCfgCentrosCusto])

  // Unidades disponíveis
  const todasUnidades = useMemo(() => {
    const list: { id: string; nome: string }[] = []
    ;(mantenedores || []).forEach(m => {
      ;(m.unidades || []).forEach(u => {
        list.push({ id: u.id, nome: u.nomeFantasia || u.razaoSocial || u.codigo })
      })
    })
    return list
  }, [mantenedores])

  // Estatísticas reais de uso em Contas a Pagar e Contas a Receber
  const [usoFinanceiro, setUsoFinanceiro] = useState<
    Record<string, { qtdPagar: number; valorPagar: number; qtdReceber: number; valorReceber: number }>
  >({})

  useEffect(() => {
    let active = true
    async function loadUsage() {
      try {
        const [resPagar, resReceber] = await Promise.all([
          fetch('/api/contas-pagar').then(r => (r.ok ? r.json() : null)).catch(() => null),
          fetch('/api/titulos').then(r => (r.ok ? r.json() : null)).catch(() => null),
        ])
        if (!active) return

        const map: Record<
          string,
          { qtdPagar: number; valorPagar: number; qtdReceber: number; valorReceber: number }
        > = {}

        const ensure = (key: string) => {
          if (!map[key]) {
            map[key] = { qtdPagar: 0, valorPagar: 0, qtdReceber: 0, valorReceber: 0 }
          }
          return map[key]
        }

        const contasList = Array.isArray(resPagar?.contas)
          ? resPagar.contas
          : Array.isArray(resPagar)
          ? resPagar
          : []

        contasList.forEach((c: any) => {
          if (c.status === 'cancelado') return
          if (Array.isArray(c.rateio) && c.rateio.length > 0) {
            c.rateio.forEach((r: any) => {
              if (!r.centroCusto) return
              const bucket = ensure(r.centroCusto)
              bucket.qtdPagar += 1
              bucket.valorPagar += Number(r.valor) || (Number(c.valor || 0) * Number(r.percentual || 0)) / 100
            })
          } else if (c.centroCusto) {
            const bucket = ensure(c.centroCusto)
            bucket.qtdPagar += 1
            bucket.valorPagar += Number(c.valor || 0)
          }
        })

        const titulosList = Array.isArray(resReceber) ? resReceber : []
        titulosList.forEach((t: any) => {
          if (!t.centroCusto) return
          const bucket = ensure(t.centroCusto)
          bucket.qtdReceber += 1
          bucket.valorReceber += Number(t.valor || 0)
        })

        setUsoFinanceiro(map)
      } catch {
        // Silencioso se offline
      }
    }
    loadUsage()
    return () => {
      active = false
    }
  }, [])

  // Filtros
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | ConfigCentroCusto['tipo']>('todos')
  const [filtroNatureza, setFiltroNatureza] = useState<'todos' | ConfigCentroCusto['natureza']>('todos')
  const [filtroSituacao, setFiltroSituacao] = useState<'todos' | 'ativo' | 'inativo'>('todos')

  // Modal Criar / Editar
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<ConfigCentroCusto, 'id' | 'createdAt'>>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)

  // Modal de Exclusão
  const [deleteTarget, setDeleteTarget] = useState<ConfigCentroCusto | null>(null)

  // Modal de Rateio Pedagógico
  const [showRateioConfig, setShowRateioConfig] = useState(false)

  // Feedback Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  // Importação XLSX
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importFeedback, setImportFeedback] = useState<{
    type: 'success' | 'error'
    message: string
    details?: string[]
  } | null>(null)

  const getNextCode = (list = centrosCusto) => {
    const nums = list
      .map(c => parseInt((c.codigo || '').replace(/\D/g, ''), 10))
      .filter(n => !isNaN(n))
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
    return `CC${String(next).padStart(3, '0')}`
  }

  const openNew = () => {
    setEditId(null)
    setFormError(null)
    setForm({
      ...EMPTY_FORM,
      codigo: getNextCode(),
      cor: PALETA_CORES[centrosCusto.length % PALETA_CORES.length],
    })
    setShowModal(true)
  }

  const openEdit = (cc: ConfigCentroCusto) => {
    setEditId(cc.id)
    setFormError(null)
    setForm({
      codigo: cc.codigo || getNextCode(),
      sigla: cc.sigla || '',
      nome: cc.nome || '',
      descricao: cc.descricao || '',
      tipo: cc.tipo || 'pedagogico',
      natureza: cc.natureza || 'ambos',
      cor: cc.cor || '#38bdf8',
      responsavel: cc.responsavel || '',
      orcamentoMensal: Number(cc.orcamentoMensal || 0),
      pesoRateioPadrao: Number(cc.pesoRateioPadrao || 0),
      unidadeId: cc.unidadeId || '',
      situacao: cc.situacao || 'ativo',
    })
    setShowModal(true)
  }

  const handleDuplicate = (cc: ConfigCentroCusto) => {
    const novoCodigo = getNextCode()
    const novo: ConfigCentroCusto = {
      ...cc,
      id: newId('CC'),
      codigo: novoCodigo,
      sigla: `${cc.sigla}2`.slice(0, 6),
      nome: `${cc.nome} (Cópia)`,
      pesoRateioPadrao: 0,
      createdAt: new Date().toISOString(),
    }
    setCfgCentrosCusto(prev => [...(prev.length > 0 ? prev : CENTROS_CUSTO_DEFAULT), novo])
    showToast('success', `Centro de Custo "${novo.nome}" duplicado com sucesso!`)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const nomeTrim = form.nome.trim()
    const siglaTrim = (form.sigla.trim() || nomeTrim.slice(0, 4)).toUpperCase()
    const codigoTrim = (form.codigo.trim() || getNextCode()).toUpperCase()

    if (!nomeTrim) {
      setFormError('Informe o nome principal do Centro de Custo.')
      return
    }

    const duplicadoNome = centrosCusto.find(
      c => c.id !== editId && (c.nome || '').trim().toLowerCase() === nomeTrim.toLowerCase()
    )
    if (duplicadoNome) {
      setFormError(`Já existe um Centro de Custo cadastrado com o nome "${duplicadoNome.nome}".`)
      return
    }

    const duplicadoCodigo = centrosCusto.find(
      c => c.id !== editId && (c.codigo || '').trim().toLowerCase() === codigoTrim.toLowerCase()
    )
    if (duplicadoCodigo) {
      setFormError(`O código "${codigoTrim}" já está em uso pelo centro "${duplicadoCodigo.nome}".`)
      return
    }

    const payload: Omit<ConfigCentroCusto, 'id' | 'createdAt'> = {
      ...form,
      codigo: codigoTrim,
      sigla: siglaTrim,
      nome: nomeTrim,
      descricao: form.descricao.trim() || nomeTrim,
      responsavel: form.responsavel?.trim() || '',
      orcamentoMensal: Math.max(0, Number(form.orcamentoMensal || 0)),
      pesoRateioPadrao: Math.min(100, Math.max(0, Number(form.pesoRateioPadrao || 0))),
    }

    if (editId) {
      setCfgCentrosCusto(prev => {
        const base = prev.length > 0 ? prev : CENTROS_CUSTO_DEFAULT
        return base.map(c => (c.id === editId ? { ...c, ...payload } : c))
      })
      logSystemAction?.(
        'Config. Financeiro',
        'Edição Centro de Custo',
        `Centro de Custo atualizado: ${payload.codigo} - ${payload.nome}`
      )
      showToast('success', `Centro de Custo "${payload.nome}" atualizado com sucesso!`)
    } else {
      const novo: ConfigCentroCusto = {
        id: newId('CC'),
        ...payload,
        createdAt: new Date().toISOString(),
      }
      setCfgCentrosCusto(prev => {
        const base = prev.length > 0 ? prev : CENTROS_CUSTO_DEFAULT
        return [...base, novo]
      })
      logSystemAction?.(
        'Config. Financeiro',
        'Novo Centro de Custo',
        `Centro de Custo criado: ${novo.codigo} - ${novo.nome}`
      )
      showToast('success', `Centro de Custo "${novo.nome}" criado e liberado para Contas a Pagar e Receber!`)
    }

    setShowModal(false)
    setEditId(null)
  }

  const handleToggleSituacao = (cc: ConfigCentroCusto) => {
    const novaSituacao = cc.situacao === 'ativo' ? 'inativo' : 'ativo'
    setCfgCentrosCusto(prev => {
      const base = prev.length > 0 ? prev : CENTROS_CUSTO_DEFAULT
      return base.map(c => (c.id === cc.id ? { ...c, situacao: novaSituacao } : c))
    })
    showToast(
      'success',
      `Centro de Custo "${cc.nome}" marcado como ${novaSituacao === 'ativo' ? 'Ativo' : 'Inativo'}.`
    )
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    setCfgCentrosCusto(prev => {
      const base = prev.length > 0 ? prev : CENTROS_CUSTO_DEFAULT
      return base.filter(c => c.id !== deleteTarget.id)
    })
    logSystemAction?.(
      'Config. Financeiro',
      'Exclusão Centro de Custo',
      `Centro de Custo removido: ${deleteTarget.codigo} - ${deleteTarget.nome}`
    )
    showToast('success', `Centro de Custo "${deleteTarget.nome}" removido.`)
    setDeleteTarget(null)
  }

  const handleAddSugestao = (sug: Omit<ConfigCentroCusto, 'id' | 'codigo' | 'createdAt'>) => {
    const jaExiste = centrosCusto.some(
      c => (c.nome || '').trim().toLowerCase() === (sug.nome || '').trim().toLowerCase()
    )
    if (jaExiste) {
      showToast('error', `O centro "${sug.nome}" já está cadastrado na lista.`)
      return
    }
    const novo: ConfigCentroCusto = {
      ...sug,
      id: newId('CC'),
      codigo: getNextCode(),
      createdAt: new Date().toISOString(),
    }
    setCfgCentrosCusto(prev => {
      const base = (prev.length > 0 ? prev : CENTROS_CUSTO_DEFAULT).map((item, idx) =>
        normalizeCentroCustoItem(item, idx)
      )
      return [...base, novo]
    })
    showToast('success', `Centro de Custo "${novo.nome}" adicionado com 1 clique!`)
  }

  const handleRestaurarPadroes = () => {
    setCfgCentrosCusto(prev => {
      const base = (prev.length > 0 ? prev : []).map((item, idx) =>
        normalizeCentroCustoItem(item, idx)
      )
      const mapExistentes = new Set(base.map(c => (c.nome || '').trim().toLowerCase()))
      const faltantes = CENTROS_CUSTO_DEFAULT.filter(
        d => !mapExistentes.has((d.nome || '').trim().toLowerCase())
      )
      if (faltantes.length === 0) return base.length > 0 ? base : CENTROS_CUSTO_DEFAULT
      return [...base, ...faltantes]
    })
    showToast('success', 'Centros de Custo padrão escolares verificados e restaurados!')
  }

  const handleUpdatePesoRateio = (id: string, novoPeso: number) => {
    const val = Math.min(100, Math.max(0, Number(novoPeso) || 0))
    setCfgCentrosCusto(prev => {
      const base = prev.length > 0 ? prev : CENTROS_CUSTO_DEFAULT
      return base.map(c => (c.id === id ? { ...c, pesoRateioPadrao: val } : c))
    })
  }

  const handleNormalizarRateio100 = () => {
    setCfgCentrosCusto(prev => {
      const base = prev.length > 0 ? prev : CENTROS_CUSTO_DEFAULT
      const comPeso = base.filter(c => c.situacao === 'ativo' && (c.pesoRateioPadrao || 0) > 0)
      if (comPeso.length === 0) {
        // Aplica nos 4 segmentos pedagógicos clássicos
        return base.map(c => {
          if (c.sigla === 'INF') return { ...c, pesoRateioPadrao: 20 }
          if (c.sigla === 'EF1') return { ...c, pesoRateioPadrao: 30 }
          if (c.sigla === 'EF2') return { ...c, pesoRateioPadrao: 30 }
          if (c.sigla === 'EM') return { ...c, pesoRateioPadrao: 20 }
          return c
        })
      }
      const soma = comPeso.reduce((acc, c) => acc + (c.pesoRateioPadrao || 0), 0)
      if (soma === 0) return base
      let acumulado = 0
      return base.map((c, idx) => {
        if (c.situacao !== 'ativo' || !(c.pesoRateioPadrao && c.pesoRateioPadrao > 0)) return c
        const isLast = c.id === comPeso[comPeso.length - 1].id
        if (isLast) {
          const rest = Math.max(0, Math.round((100 - acumulado) * 10) / 10)
          return { ...c, pesoRateioPadrao: rest }
        }
        const norm = Math.round(((c.pesoRateioPadrao || 0) / soma) * 1000) / 10
        acumulado += norm
        return { ...c, pesoRateioPadrao: norm }
      })
    })
    showToast('success', 'Pesos do Rateio Pedagógico Automático ajustados para fechar em 100%!')
  }

  // Sugestões ainda não adicionadas
  const sugestoesDisponiveis = useMemo(() => {
    const nomes = new Set(centrosCusto.map(c => (c.nome || c.descricao || '').trim().toLowerCase()))
    return SUGESTOES_ESCOLARES.filter(s => !nomes.has((s.nome || '').trim().toLowerCase()))
  }, [centrosCusto])

  // Filtragem
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return centrosCusto.filter(c => {
      if (filtroTipo !== 'todos' && c.tipo !== filtroTipo) return false
      if (filtroNatureza !== 'todos' && c.natureza !== filtroNatureza) return false
      if (filtroSituacao !== 'todos' && c.situacao !== filtroSituacao) return false
      if (q) {
        const match =
          (c.codigo || '').toLowerCase().includes(q) ||
          (c.sigla || '').toLowerCase().includes(q) ||
          (c.nome || '').toLowerCase().includes(q) ||
          (c.descricao || '').toLowerCase().includes(q) ||
          (c.responsavel || '').toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })
  }, [centrosCusto, search, filtroTipo, filtroNatureza, filtroSituacao])

  // KPIs Executivos
  const kpis = useMemo(() => {
    const ativos = centrosCusto.filter(c => c.situacao === 'ativo')
    const pedagogicos = ativos.filter(c => c.tipo === 'pedagogico')
    const orcamentoTotal = ativos.reduce((acc, c) => acc + Number(c.orcamentoMensal || 0), 0)
    const somaRateio = Math.round(
      ativos.reduce((acc, c) => acc + Number(c.pesoRateioPadrao || 0), 0) * 10
    ) / 10

    let totalLancamentos = 0
    let volumeMovimentado = 0
    Object.values(usoFinanceiro).forEach(u => {
      totalLancamentos += u.qtdPagar + u.qtdReceber
      volumeMovimentado += u.valorPagar + u.valorReceber
    })

    return {
      total: centrosCusto.length,
      ativos: ativos.length,
      inativos: centrosCusto.length - ativos.length,
      pedagogicos: pedagogicos.length,
      naoPedagogicos: ativos.length - pedagogicos.length,
      orcamentoTotal,
      somaRateio,
      totalLancamentos,
      volumeMovimentado,
    }
  }, [centrosCusto, usoFinanceiro])

  // ─── XLSX Export / Template / Import ─────────────────────────────
  const handleDownloadTemplate = () => {
    const rows = [
      {
        CODIGO: 'CC009',
        SIGLA: 'BERC',
        NOME: 'Berçário & Maternal',
        DESCRICAO: 'Primeira Infância — Berçário I/II e Maternal',
        TIPO: 'pedagogico',
        APLICABILIDADE: 'ambos',
        RESPONSAVEL: 'Coordenação Educação Infantil',
        ORCAMENTO_MENSAL: 35000,
        PESO_RATEIO_PADRAO: 0,
        COR_HEX: '#f472b6',
        SITUACAO: 'ativo',
      },
      {
        CODIGO: 'CC010',
        SIGLA: 'TI',
        NOME: 'Tecnologia & Inovação Educacional',
        DESCRICAO: 'Infraestrutura de TI, Sistemas e Laboratórios',
        TIPO: 'operacional',
        APLICABILIDADE: 'despesa',
        RESPONSAVEL: 'Coordenação de TI',
        ORCAMENTO_MENSAL: 18000,
        PESO_RATEIO_PADRAO: 0,
        COR_HEX: '#3b82f6',
        SITUACAO: 'ativo',
      },
    ]
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 12 },
      { wch: 10 },
      { wch: 34 },
      { wch: 44 },
      { wch: 16 },
      { wch: 16 },
      { wch: 28 },
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
      { wch: 12 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Centros_Custo')
    XLSX.writeFile(wb, 'template_centros_de_custo.xlsx')
  }

  const handleExportExcel = () => {
    if (centrosCusto.length === 0) return
    const rows = centrosCusto.map(c => {
      const uso = usoFinanceiro[c.nome] || { qtdPagar: 0, valorPagar: 0, qtdReceber: 0, valorReceber: 0 }
      return {
        CODIGO: c.codigo,
        SIGLA: c.sigla,
        NOME: c.nome,
        DESCRICAO: c.descricao,
        TIPO: c.tipo,
        APLICABILIDADE: c.natureza,
        RESPONSAVEL: c.responsavel || '',
        ORCAMENTO_MENSAL: c.orcamentoMensal || 0,
        PESO_RATEIO_PADRAO: c.pesoRateioPadrao || 0,
        QTD_CONTAS_PAGAR: uso.qtdPagar,
        TOTAL_CONTAS_PAGAR: uso.valorPagar,
        QTD_CONTAS_RECEBER: uso.qtdReceber,
        TOTAL_CONTAS_RECEBER: uso.valorReceber,
        COR_HEX: c.cor,
        SITUACAO: c.situacao,
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 12 },
      { wch: 10 },
      { wch: 34 },
      { wch: 44 },
      { wch: 16 },
      { wch: 16 },
      { wch: 28 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
      { wch: 12 },
      { wch: 12 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Centros_de_Custo')
    XLSX.writeFile(wb, `centros_de_custo_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const reader = new FileReader()
    reader.onload = evt => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' })

        if (rawRows.length === 0) {
          setImportFeedback({ type: 'error', message: 'A planilha enviada está vazia.' })
          return
        }

        const novos: ConfigCentroCusto[] = []
        const erros: string[] = []
        const nomesExistentes = new Set(centrosCusto.map(c => (c.nome || '').trim().toLowerCase()))

        rawRows.forEach((r, idx) => {
          const lineNum = idx + 2
          const norm: Record<string, any> = {}
          Object.keys(r).forEach(k => {
            norm[
              k
                .trim()
                .toUpperCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
            ] = r[k]
          })

          const nome = String(norm['NOME'] || '').trim()
          if (!nome) {
            erros.push(`Linha ${lineNum}: Coluna NOME está vazia.`)
            return
          }
          if (nomesExistentes.has(nome.toLowerCase())) {
            erros.push(`Linha ${lineNum}: Centro de Custo "${nome}" já existe (ignorado).`)
            return
          }

          const codigo =
            String(norm['CODIGO'] || '').trim().toUpperCase() ||
            `CC${String(centrosCusto.length + novos.length + 1).padStart(3, '0')}`
          const sigla =
            String(norm['SIGLA'] || nome.slice(0, 4))
              .trim()
              .toUpperCase()
              .slice(0, 8)
          const descricao = String(norm['DESCRICAO'] || nome).trim()
          const rawTipo = String(norm['TIPO'] || 'pedagogico').trim().toLowerCase()
          const tipo: ConfigCentroCusto['tipo'] = (
            ['pedagogico', 'administrativo', 'operacional', 'comercial', 'projetos'].includes(rawTipo)
              ? rawTipo
              : 'pedagogico'
          ) as ConfigCentroCusto['tipo']

          const rawNat = String(norm['APLICABILIDADE'] || norm['NATUREZA'] || 'ambos')
            .trim()
            .toLowerCase()
          const natureza: ConfigCentroCusto['natureza'] = (
            ['ambos', 'despesa', 'receita'].includes(rawNat) ? rawNat : 'ambos'
          ) as ConfigCentroCusto['natureza']

          const cor = String(norm['COR_HEX'] || norm['COR'] || '#38bdf8').trim()
          const situacao: 'ativo' | 'inativo' =
            String(norm['SITUACAO'] || 'ativo').trim().toLowerCase() === 'inativo'
              ? 'inativo'
              : 'ativo'

          novos.push({
            id: newId('CC'),
            codigo,
            sigla,
            nome,
            descricao,
            tipo,
            natureza,
            cor: cor.startsWith('#') ? cor : '#38bdf8',
            responsavel: String(norm['RESPONSAVEL'] || '').trim(),
            orcamentoMensal: Math.max(0, Number(norm['ORCAMENTO_MENSAL'] || 0)),
            pesoRateioPadrao: Math.min(100, Math.max(0, Number(norm['PESO_RATEIO_PADRAO'] || 0))),
            unidadeId: '',
            situacao,
            createdAt: new Date().toISOString(),
          })
          nomesExistentes.add(nome.toLowerCase())
        })

        if (novos.length > 0) {
          setCfgCentrosCusto(prev => [...(prev.length > 0 ? prev : CENTROS_CUSTO_DEFAULT), ...novos])
          setImportFeedback({
            type: 'success',
            message: `${novos.length} Centro(s) de Custo importado(s) com sucesso!`,
            details: erros.length > 0 ? erros : undefined,
          })
        } else {
          setImportFeedback({
            type: 'error',
            message: 'Nenhum registro novo pôde ser importado.',
            details: erros,
          })
        }
      } catch {
        setImportFeedback({
          type: 'error',
          message: 'Erro ao processar arquivo XLSX. Verifique se utilizou o Template padrão.',
        })
      }
    }
    reader.readAsArrayBuffer(file)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 18px',
            borderRadius: 12,
            background: toast.type === 'success' ? 'rgba(6, 78, 59, 0.96)' : 'rgba(127, 29, 29, 0.96)',
            border: `1px solid ${
              toast.type === 'success' ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.45)'
            }`,
            color: '#fff',
            boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
            fontSize: '0.84rem',
            fontWeight: 600,
          }}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={18} color="#34d399" />
          ) : (
            <AlertCircle size={18} color="#f87171" />
          )}
          <span>{toast.text}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Fechar aviso"
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              padding: 2,
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Cabeçalho Principal */}
      <div
        className="card"
        style={{
          padding: '22px 24px',
          background:
            'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.85) 100%)',
          border: '1px solid rgba(56, 189, 248, 0.18)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: 'linear-gradient(135deg, rgba(56,189,248,0.2), rgba(99,102,241,0.2))',
                border: '1px solid rgba(56,189,248,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
                flexShrink: 0,
              }}
            >
              <Target size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    padding: '3px 9px',
                    borderRadius: 999,
                    background: 'rgba(56, 189, 248, 0.14)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                  }}
                >
                  Config. Financeiro • Contabilidade Gerencial
                </span>
                <Link
                  href="/financeiro/pagar"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 999,
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    textDecoration: 'none',
                  }}
                >
                  <TrendingDown size={12} /> Contas a Pagar <ArrowUpRight size={11} />
                </Link>
                <Link
                  href="/financeiro/receber"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 999,
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    textDecoration: 'none',
                  }}
                >
                  <TrendingUp size={12} /> Contas a Receber <ArrowUpRight size={11} />
                </Link>
              </div>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: 6, marginBottom: 4 }}>
                Centros de Custo & Unidades de Negócio Escolares
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.83rem', maxWidth: 760, margin: 0 }}>
                Estruture segmentos pedagógicos, departamentos administrativos, infraestrutura e projetos
                para classificar despesas, receitas, orçamentos mensais e rateios multicentro em{' '}
                <strong style={{ color: 'var(--text-secondary)' }}>Contas a Pagar</strong> e{' '}
                <strong style={{ color: 'var(--text-secondary)' }}>Contas a Receber</strong>.
              </p>
            </div>
          </div>

          {/* Botões de Ação */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportFile}
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowRateioConfig(v => !v)}
              title="Configurar percentuais do Rateio Pedagógico Automático"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                borderColor: showRateioConfig ? 'rgba(168,85,247,0.5)' : undefined,
                background: showRateioConfig ? 'rgba(168,85,247,0.14)' : undefined,
                color: showRateioConfig ? '#c084fc' : undefined,
              }}
            >
              <PieChart size={14} /> Rateio Padrão ({kpis.somaRateio}%)
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleDownloadTemplate}
              title="Baixar planilha modelo XLSX"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <FileSpreadsheet size={14} /> Template
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => fileInputRef.current?.click()}
              title="Importar Centros de Custo via Excel"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Upload size={14} /> Importar
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleExportExcel}
              title="Exportar lista para Excel"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Download size={14} /> Exportar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={openNew}
              style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700 }}
            >
              <Plus size={16} /> Novo Centro de Custo
            </button>
          </div>
        </div>
      </div>

      {/* Feedback de Importação */}
      {importFeedback && (
        <div
          className="card"
          style={{
            padding: '14px 18px',
            background:
              importFeedback.type === 'success'
                ? 'rgba(16, 185, 129, 0.08)'
                : 'rgba(239, 68, 68, 0.08)',
            border: `1px solid ${
              importFeedback.type === 'success'
                ? 'rgba(16, 185, 129, 0.3)'
                : 'rgba(239, 68, 68, 0.3)'
            }`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {importFeedback.type === 'success' ? (
                <CheckCircle2 size={18} color="#10b981" />
              ) : (
                <AlertCircle size={18} color="#ef4444" />
              )}
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.86rem' }}>{importFeedback.message}</div>
                {importFeedback.details && importFeedback.details.length > 0 && (
                  <ul
                    style={{
                      margin: '6px 0 0',
                      paddingLeft: 18,
                      fontSize: '0.76rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {importFeedback.details.slice(0, 6).map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setImportFeedback(null)}
              aria-label="Fechar aviso de importação"
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Cards de Indicadores (KPIs) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 14,
        }}
      >
        <div className="card" style={{ padding: '16px 18px' }}>
          <div
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-muted)',
            }}
          >
            Total Cadastrados
          </div>
          <div style={{ fontSize: '1.55rem', fontWeight: 800, marginTop: 6 }}>
            {kpis.total}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            <span style={{ color: '#10b981', fontWeight: 700 }}>{kpis.ativos} ativos</span> •{' '}
            {kpis.inativos} inativos
          </div>
        </div>

        <div className="card" style={{ padding: '16px 18px' }}>
          <div
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#38bdf8',
            }}
          >
            Estrutura Escolar
          </div>
          <div style={{ fontSize: '1.55rem', fontWeight: 800, marginTop: 6, color: '#38bdf8' }}>
            {kpis.pedagogicos} Pedagógicos
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            +{kpis.naoPedagogicos} centros adm / infra / comercial
          </div>
        </div>

        <div className="card" style={{ padding: '16px 18px' }}>
          <div
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#f59e0b',
            }}
          >
            Orçamento Mensal Previsto
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, marginTop: 6, color: '#f59e0b' }}>
            {formatCurrency(kpis.orcamentoTotal)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Soma das metas dos centros ativos
          </div>
        </div>

        <div className="card" style={{ padding: '16px 18px' }}>
          <div
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: kpis.somaRateio === 100 ? '#10b981' : '#a855f7',
            }}
          >
            Rateio Pedagógico Padrão
          </div>
          <div
            style={{
              fontSize: '1.55rem',
              fontWeight: 800,
              marginTop: 6,
              color: kpis.somaRateio === 100 ? '#10b981' : '#a855f7',
            }}
          >
            {kpis.somaRateio}%
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            {kpis.somaRateio === 100
              ? '100% calibrado para Contas a Pagar'
              : 'Clique em "Rateio Padrão" para calibrar'}
          </div>
        </div>

        <div className="card" style={{ padding: '16px 18px' }}>
          <div
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#10b981',
            }}
          >
            Títulos Classificados
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, marginTop: 6, color: '#10b981' }}>
            {kpis.totalLancamentos} registros
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Volume: {formatCurrency(kpis.volumeMovimentado)}
          </div>
        </div>
      </div>

      {/* Painel Expansível: Configurador do Rateio Pedagógico Padrão */}
      {showRateioConfig && (
        <div
          className="card"
          style={{
            padding: 20,
            border: '1px solid rgba(168, 85, 247, 0.35)',
            background: 'rgba(168, 85, 247, 0.04)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PieChart size={18} color="#c084fc" />
                <h2 style={{ fontSize: '0.96rem', fontWeight: 800, margin: 0 }}>
                  Matriz de Rateio Pedagógico Automático (Contas a Pagar)
                </h2>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                Defina o percentual padrão de cada segmento ao clicar em{' '}
                <strong>&ldquo;Aplicar Rateio Pedagógico&rdquo;</strong> no lançamento de Contas a Pagar.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  padding: '5px 12px',
                  borderRadius: 999,
                  background:
                    kpis.somaRateio === 100
                      ? 'rgba(16, 185, 129, 0.15)'
                      : 'rgba(245, 158, 11, 0.15)',
                  color: kpis.somaRateio === 100 ? '#34d399' : '#fbbf24',
                  border: `1px solid ${
                    kpis.somaRateio === 100
                      ? 'rgba(16, 185, 129, 0.35)'
                      : 'rgba(245, 158, 11, 0.35)'
                  }`,
                }}
              >
                Soma Atual: {kpis.somaRateio}%
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleNormalizarRateio100}
              >
                Calibrar para 100%
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 10,
            }}
          >
            {centrosCusto
              .filter(c => c.situacao === 'ativo' && (c.natureza === 'ambos' || c.natureza === 'despesa'))
              .map(c => (
                <div
                  key={c.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'rgba(15, 23, 42, 0.65)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: c.cor,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {c.sigla} • {c.nome}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {TIPO_META[c.tipo]?.label || c.tipo}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <input
                      id={`rateio-peso-${c.id}`}
                      aria-label={`Peso de rateio para ${c.nome}`}
                      type="number"
                      min={0}
                      max={100}
                      step="1"
                      value={c.pesoRateioPadrao || 0}
                      onChange={e => handleUpdatePesoRateio(c.id, parseFloat(e.target.value) || 0)}
                      className="form-input"
                      style={{ width: 68, padding: '4px 8px', textAlign: 'right', fontSize: '0.8rem' }}
                    />
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                      %
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Barra de Sugestões Rápidas Escolares */}
      {sugestoesDisponiveis.length > 0 && (
        <div
          className="card"
          style={{
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            background: 'rgba(30, 41, 59, 0.45)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: '0.74rem',
                fontWeight: 700,
                color: '#38bdf8',
              }}
            >
              <Sparkles size={14} /> Adicionar Sugestão Escolar (1 clique):
            </span>
            {sugestoesDisponiveis.map(sug => (
              <button
                key={sug.sigla}
                type="button"
                onClick={() => handleAddSugestao(sug)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 999,
                  fontSize: '0.73rem',
                  fontWeight: 600,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: sug.cor,
                  }}
                />
                + {sug.sigla} • {sug.nome}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleRestaurarPadroes}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <RotateCcw size={12} /> Restaurar Padrões
          </button>
        </div>
      )}

      {/* Filtros e Pesquisa */}
      <div className="card" style={{ padding: 16 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(240px, 1.6fr) repeat(3, minmax(160px, 1fr))',
            gap: 12,
            alignItems: 'end',
          }}
        >
          <div>
            <label
              htmlFor="cc-search-input"
              style={{
                display: 'block',
                fontSize: '0.7rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                marginBottom: 6,
              }}
            >
              Pesquisar Centro de Custo
            </label>
            <div style={{ position: 'relative' }}>
              <Search
                size={15}
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                id="cc-search-input"
                type="search"
                className="form-input"
                placeholder="Buscar por código, sigla, nome, descrição ou gestor..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                style={{ paddingLeft: 36 }}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="cc-filter-tipo"
              style={{
                display: 'block',
                fontSize: '0.7rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                marginBottom: 6,
              }}
            >
              Classificação / Área
            </label>
            <select
              id="cc-filter-tipo"
              className="form-input"
              value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value as any)}
            >
              <option value="todos">Todas as Áreas</option>
              <option value="pedagogico">🎓 Pedagógico / Ensino</option>
              <option value="administrativo">🏢 Administrativo & Gestão</option>
              <option value="operacional">⚙️ Operacional & Infra</option>
              <option value="comercial">📣 Comercial & Captação</option>
              <option value="projetos">🚀 Projetos, Eventos & Extra</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="cc-filter-natureza"
              style={{
                display: 'block',
                fontSize: '0.7rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                marginBottom: 6,
              }}
            >
              Uso (Pagar / Receber)
            </label>
            <select
              id="cc-filter-natureza"
              className="form-input"
              value={filtroNatureza}
              onChange={e => setFiltroNatureza(e.target.value as any)}
            >
              <option value="todos">Todos (Pagar e Receber)</option>
              <option value="ambos">Ambos (Pagar & Receber)</option>
              <option value="despesa">Somente Contas a Pagar</option>
              <option value="receita">Somente Contas a Receber</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="cc-filter-situacao"
              style={{
                display: 'block',
                fontSize: '0.7rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                marginBottom: 6,
              }}
            >
              Situação
            </label>
            <select
              id="cc-filter-situacao"
              className="form-input"
              value={filtroSituacao}
              onChange={e => setFiltroSituacao(e.target.value as any)}
            >
              <option value="todos">Todos os Status</option>
              <option value="ativo">Somente Ativos</option>
              <option value="inativo">Somente Inativos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela Responsiva de Centros de Custo */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            Relação de Centros de Custo ({filtered.length} registro{filtered.length !== 1 ? 's' : ''})
          </div>
          {(search || filtroTipo !== 'todos' || filtroNatureza !== 'todos' || filtroSituacao !== 'todos') && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setSearch('')
                setFiltroTipo('todos')
                setFiltroNatureza('todos')
                setFiltroSituacao('todos')
              }}
            >
              Limpar Filtros
            </button>
          )}
        </div>

        <div
          tabIndex={0}
          role="region"
          aria-labelledby="cc-table-caption"
          style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
        >
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <caption
              id="cc-table-caption"
              style={{
                position: 'absolute',
                width: 1,
                height: 1,
                padding: 0,
                margin: -1,
                overflow: 'hidden',
                clip: 'rect(0, 0, 0, 0)',
                whiteSpace: 'nowrap',
                border: 0,
              }}
            >
              Tabela de Centros de Custo configurados para Contas a Pagar e Contas a Receber
            </caption>
            <thead>
              <tr>
                <th scope="col" style={{ width: 90 }}>Código</th>
                <th scope="col">Centro de Custo / Identificação</th>
                <th scope="col">Classificação & Gestor</th>
                <th scope="col">Uso no Financeiro</th>
                <th scope="col" style={{ textAlign: 'right' }}>Orçamento & Rateio</th>
                <th scope="col" style={{ textAlign: 'right' }}>Movimentação Atual</th>
                <th scope="col" style={{ textAlign: 'center', width: 100 }}>Status</th>
                <th scope="col" style={{ textAlign: 'right', width: 120 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '42px 20px', color: 'var(--text-muted)' }}>
                    Nenhum Centro de Custo encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filtered.map(cc => {
                  const tipoInfo = TIPO_META[cc.tipo] || TIPO_META.pedagogico
                  const natInfo = NATUREZA_META[cc.natureza] || NATUREZA_META.ambos
                  const uso = usoFinanceiro[cc.nome] || {
                    qtdPagar: 0,
                    valorPagar: 0,
                    qtdReceber: 0,
                    valorReceber: 0,
                  }
                  const unidadeNome = cc.unidadeId
                    ? todasUnidades.find(u => u.id === cc.unidadeId)?.nome || 'Unidade específica'
                    : 'Todas as Unidades'

                  return (
                    <tr
                      key={cc.id}
                      style={{
                        opacity: cc.situacao === 'inativo' ? 0.58 : 1,
                      }}
                    >
                      <td>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.09)',
                          }}
                        >
                          {cc.codigo}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: 46,
                              padding: '4px 8px',
                              borderRadius: 8,
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              background: `${cc.cor}22`,
                              color: cc.cor,
                              border: `1px solid ${cc.cor}55`,
                              letterSpacing: '0.04em',
                            }}
                          >
                            {cc.sigla}
                          </span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                              {cc.nome}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                              {cc.descricao}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '2px 9px',
                              borderRadius: 999,
                              background: tipoInfo.badgeBg,
                              color: tipoInfo.badgeColor,
                              border: `1px solid ${tipoInfo.badgeBorder}`,
                            }}
                          >
                            <span>{tipoInfo.icon}</span> {tipoInfo.label}
                          </span>
                          <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                            {cc.responsavel ? `👤 ${cc.responsavel}` : `🏫 ${unidadeNome}`}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: '0.73rem',
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: 8,
                            background: natInfo.bg,
                            color: natInfo.color,
                            border: `1px solid ${natInfo.border}`,
                          }}
                        >
                          {natInfo.short}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>
                          {cc.orcamentoMensal && cc.orcamentoMensal > 0
                            ? `${formatCurrency(cc.orcamentoMensal)}/mês`
                            : 'Sem teto fixo'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {cc.pesoRateioPadrao && cc.pesoRateioPadrao > 0 ? (
                            <span style={{ color: '#c084fc', fontWeight: 600 }}>
                              Rateio padrão: {cc.pesoRateioPadrao}%
                            </span>
                          ) : (
                            'Alocação direta'
                          )}
                        </div>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
                          <span style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 600 }}>
                            Saídas ({uso.qtdPagar}): {formatCurrency(uso.valorPagar)}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 600 }}>
                            Entradas ({uso.qtdReceber}): {formatCurrency(uso.valorReceber)}
                          </span>
                        </div>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleSituacao(cc)}
                          title="Clique para alternar entre Ativo e Inativo"
                          style={{
                            cursor: 'pointer',
                            padding: '4px 10px',
                            borderRadius: 999,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            border:
                              cc.situacao === 'ativo'
                                ? '1px solid rgba(16, 185, 129, 0.35)'
                                : '1px solid rgba(148, 163, 184, 0.3)',
                            background:
                              cc.situacao === 'ativo'
                                ? 'rgba(16, 185, 129, 0.14)'
                                : 'rgba(148, 163, 184, 0.12)',
                            color: cc.situacao === 'ativo' ? '#34d399' : '#94a3b8',
                          }}
                        >
                          {cc.situacao === 'ativo' ? 'Ativo' : 'Inativo'}
                        </button>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEdit(cc)}
                            title={`Editar ${cc.nome}`}
                            aria-label={`Editar ${cc.nome}`}
                            style={{ padding: '5px 8px' }}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleDuplicate(cc)}
                            title={`Duplicar ${cc.nome}`}
                            aria-label={`Duplicar ${cc.nome}`}
                            style={{ padding: '5px 8px' }}
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setDeleteTarget(cc)}
                            title={`Excluir ${cc.nome}`}
                            aria-label={`Excluir ${cc.nome}`}
                            style={{ padding: '5px 8px', color: '#f87171' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Criação / Edição */}
      {showModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(2, 6, 23, 0.78)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            className="card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-cc-title"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 680,
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: 24,
              border: '1px solid rgba(56, 189, 248, 0.28)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: 14,
                borderBottom: '1px solid var(--border)',
                marginBottom: 18,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: `${form.cor}22`,
                    border: `1px solid ${form.cor}55`,
                    color: form.cor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Target size={18} />
                </div>
                <div>
                  <h2 id="modal-cc-title" style={{ fontSize: '1.08rem', fontWeight: 800, margin: 0 }}>
                    {editId ? 'Editar Centro de Custo' : 'Novo Centro de Custo'}
                  </h2>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: 0 }}>
                    Disponível imediatamente em Contas a Pagar e Contas a Receber
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Fechar modal"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div
                role="alert"
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#fca5a5',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 130px 1fr',
                  gap: 12,
                }}
              >
                <div>
                  <label
                    htmlFor="cc-form-codigo"
                    style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, marginBottom: 5 }}
                  >
                    Código *
                  </label>
                  <input
                    id="cc-form-codigo"
                    type="text"
                    className="form-input"
                    value={form.codigo}
                    onChange={e => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
                    autoCorrect="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="cc-form-sigla"
                    style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, marginBottom: 5 }}
                  >
                    Sigla Curta *
                  </label>
                  <input
                    id="cc-form-sigla"
                    type="text"
                    maxLength={8}
                    placeholder="Ex: INF, ADM"
                    className="form-input"
                    value={form.sigla}
                    onChange={e => setForm({ ...form, sigla: e.target.value.toUpperCase() })}
                    autoCorrect="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="cc-form-nome"
                    style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, marginBottom: 5 }}
                  >
                    Nome do Centro de Custo *
                  </label>
                  <input
                    id="cc-form-nome"
                    type="text"
                    placeholder="Ex: Educação Infantil, Transporte Escolar..."
                    className="form-input"
                    value={form.nome}
                    onChange={e => setForm({ ...form, nome: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="cc-form-descricao"
                  style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, marginBottom: 5 }}
                >
                  Descrição Detalhada / Subtítulo
                </label>
                <input
                  id="cc-form-descricao"
                  type="text"
                  placeholder="Ex: Educação Infantil (Berçário ao Pré) ou Infraestrutura, Campus & Facilities"
                  className="form-input"
                  value={form.descricao}
                  onChange={e => setForm({ ...form, descricao: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label
                    htmlFor="cc-form-tipo"
                    style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, marginBottom: 5 }}
                  >
                    Classificação / Área *
                  </label>
                  <select
                    id="cc-form-tipo"
                    className="form-input"
                    value={form.tipo}
                    onChange={e => setForm({ ...form, tipo: e.target.value as any })}
                  >
                    <option value="pedagogico">🎓 Pedagógico / Segmento de Ensino</option>
                    <option value="administrativo">🏢 Administrativo, Secretaria & Diretoria</option>
                    <option value="operacional">⚙️ Operacional, Infraestrutura & Apoio</option>
                    <option value="comercial">📣 Comercial, Marketing & Matrículas</option>
                    <option value="projetos">🚀 Projetos, Eventos & Extracurricular</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="cc-form-natureza"
                    style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, marginBottom: 5 }}
                  >
                    Onde será utilizado? (Aplicabilidade) *
                  </label>
                  <select
                    id="cc-form-natureza"
                    className="form-input"
                    value={form.natureza}
                    onChange={e => setForm({ ...form, natureza: e.target.value as any })}
                  >
                    <option value="ambos">🔄 Ambos (Contas a Pagar e Contas a Receber)</option>
                    <option value="despesa">📉 Somente em Contas a Pagar (Despesas)</option>
                    <option value="receita">📈 Somente em Contas a Receber (Receitas)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label
                    htmlFor="cc-form-responsavel"
                    style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, marginBottom: 5 }}
                  >
                    Gestor / Coordenador Responsável
                  </label>
                  <input
                    id="cc-form-responsavel"
                    type="text"
                    placeholder="Ex: Coordenação Fundamental I"
                    className="form-input"
                    value={form.responsavel || ''}
                    onChange={e => setForm({ ...form, responsavel: e.target.value })}
                  />
                </div>

                <div>
                  <label
                    htmlFor="cc-form-unidade"
                    style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, marginBottom: 5 }}
                  >
                    Unidade Escolar Vinculada
                  </label>
                  <select
                    id="cc-form-unidade"
                    className="form-input"
                    value={form.unidadeId || ''}
                    onChange={e => setForm({ ...form, unidadeId: e.target.value })}
                  >
                    <option value="">Todas as Unidades (Global)</option>
                    {todasUnidades.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px', gap: 12 }}>
                <div>
                  <label
                    htmlFor="cc-form-orcamento"
                    style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, marginBottom: 5 }}
                  >
                    Meta / Teto Orçamento Mensal (R$)
                  </label>
                  <input
                    id="cc-form-orcamento"
                    type="number"
                    min={0}
                    step="100"
                    placeholder="0,00"
                    className="form-input"
                    value={form.orcamentoMensal || ''}
                    onChange={e =>
                      setForm({ ...form, orcamentoMensal: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>

                <div>
                  <label
                    htmlFor="cc-form-rateio"
                    style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, marginBottom: 5 }}
                  >
                    Peso no Rateio Automático (%)
                  </label>
                  <input
                    id="cc-form-rateio"
                    type="number"
                    min={0}
                    max={100}
                    step="1"
                    placeholder="0%"
                    className="form-input"
                    value={form.pesoRateioPadrao || ''}
                    onChange={e =>
                      setForm({ ...form, pesoRateioPadrao: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>

                <div>
                  <label
                    htmlFor="cc-form-situacao"
                    style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, marginBottom: 5 }}
                  >
                    Status
                  </label>
                  <select
                    id="cc-form-situacao"
                    className="form-input"
                    value={form.situacao}
                    onChange={e => setForm({ ...form, situacao: e.target.value as any })}
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
              </div>

              {/* Cor e Preview do Badge */}
              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: 'rgba(15, 23, 42, 0.65)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Cor de Identificação nos Relatórios e Tabelas:
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Preview:</span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 10px',
                        borderRadius: 8,
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        background: `${form.cor}22`,
                        color: form.cor,
                        border: `1px solid ${form.cor}55`,
                      }}
                    >
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          background: form.cor,
                        }}
                      />
                      {form.sigla || 'SIGLA'} • {form.nome || 'Nome do Centro'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {PALETA_CORES.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, cor: c })}
                      aria-label={`Selecionar cor ${c}`}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 8,
                        background: c,
                        border: form.cor === c ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                        cursor: 'pointer',
                        transform: form.cor === c ? 'scale(1.12)' : 'scale(1)',
                        transition: 'all 0.15s ease',
                      }}
                    />
                  ))}
                  <input
                    id="cc-form-cor-custom"
                    aria-label="Cor personalizada"
                    type="color"
                    value={form.cor}
                    onChange={e => setForm({ ...form, cor: e.target.value })}
                    style={{
                      width: 32,
                      height: 28,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  paddingTop: 12,
                  borderTop: '1px solid var(--border)',
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                >
                  <Check size={16} />
                  {editId ? 'Salvar Alterações' : 'Criar Centro de Custo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deleteTarget && (
        <div
          className="modal-overlay"
          onClick={() => setDeleteTarget(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(2, 6, 23, 0.78)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            className="card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-cc-title"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 460,
              padding: 24,
              border: '1px solid rgba(239, 68, 68, 0.35)',
            }}
          >
            <h3 id="delete-cc-title" style={{ fontSize: '1.02rem', fontWeight: 800, marginTop: 0 }}>
              Confirmar Exclusão
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Deseja realmente remover o Centro de Custo{' '}
              <strong>
                {deleteTarget.sigla} — {deleteTarget.nome}
              </strong>
              ?
            </p>
            {(usoFinanceiro[deleteTarget.nome]?.qtdPagar > 0 ||
              usoFinanceiro[deleteTarget.nome]?.qtdReceber > 0) && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  color: '#fbbf24',
                  fontSize: '0.76rem',
                  marginBottom: 14,
                }}
              >
                ⚠️ Este centro possui lançamentos históricos vinculados. Caso queira apenas ocultá-lo de
                novos lançamentos mantendo o histórico nos filtros, recomendamos apenas alternar o status
                para <strong>Inativo</strong>.
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteTarget(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  handleToggleSituacao(deleteTarget)
                  setDeleteTarget(null)
                }}
              >
                Apenas Inativar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmDelete}
                style={{ background: '#ef4444', borderColor: '#ef4444' }}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
