'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Search, Loader2, User, Users, Plus, Trash2, ShieldCheck,
  Sparkles, Calculator, CreditCard, BookOpen, Handshake, Check,
  Phone, Calendar, Percent
} from 'lucide-react'
import {
  NegociacaoMatriculaRecord,
  NegociacaoAlunoItem,
  ResponsavelOption,
  StudentSearchResult,
  SERIES_2027,
  MATERIAIS_2027,
  MODALIDADE_ISAAC_CONFIG,
  STATUS_NEGOCIACAO_CONFIG,
  FORMAS_PAGAMENTO,
  CONDICOES_MENSALIDADE,
  MEIOS_AUTORIZACAO,
  fmtCurrency,
  formatPhoneNumber,
  formatCpf,
  detectSerieIdFromTurma,
} from '../types'

interface NegociacaoFormModalProps {
  isOpen: boolean
  editingItem: NegociacaoMatriculaRecord | null
  anoLetivoDefault: string
  turmasMap: Record<string, string>
  currentUserName: string
  onClose: () => void
  onSave: (payload: Partial<NegociacaoMatriculaRecord> & { usuarioAcao?: string }) => Promise<void>
}

export function NegociacaoFormModal({
  isOpen,
  editingItem,
  anoLetivoDefault,
  turmasMap,
  currentUserName,
  onClose,
  onSave,
}: NegociacaoFormModalProps) {
  const todayStr = new Date().toISOString().slice(0, 10)

  // --- Estados do Formulário ---
  const [anoLetivo, setAnoLetivo] = useState(anoLetivoDefault || '2027')
  const [alunos, setAlunos] = useState<NegociacaoAlunoItem[]>([
    { nome: '', serieTurma: '6º ao 9º ano (Fundamental II)', segmentoId: 'fund-2', tipoAluno: 'veterano', vinculadoErp: false },
  ])
  const [vinculadoErp, setVinculadoErp] = useState(false)
  const [alunoIdErp, setAlunoIdErp] = useState('')

  const [responsavelNome, setResponsavelNome] = useState('')
  const [responsavelParentesco, setResponsavelParentesco] = useState('Responsável Financeiro')
  const [responsavelTelefone, setResponsavelTelefone] = useState('')
  const [responsavelCpf, setResponsavelCpf] = useState('')
  const [responsavelIdErp, setResponsavelIdErp] = useState('')
  const [availableResponsaveis, setAvailableResponsaveis] = useState<ResponsavelOption[]>([])

  // Ambiente Principal
  const [modalidadeIsaac, setModalidadeIsaac] = useState<'no_isaac' | 'fora_isaac' | 'hibrido'>('no_isaac')
  const [selectedSerieId, setSelectedSerieId] = useState<string>('fund-2')

  // Bloco 1: Matrícula
  const [temMatricula, setTemMatricula] = useState(true)
  const [valorTabelaMatricula, setValorTabelaMatricula] = useState<string>('1330')
  const [descontoMatriculaPct, setDescontoMatriculaPct] = useState<string>('15')
  const [valorAutorizadoMatricula, setValorAutorizadoMatricula] = useState<string>('1130.50')
  const [formaPagamentoMatricula, setFormaPagamentoMatricula] = useState('Cartão de Crédito')
  const [parcelasMatricula, setParcelasMatricula] = useState<number>(5)
  const [canalMatricula, setCanalMatricula] = useState<'no_isaac' | 'fora_isaac'>('fora_isaac')
  const [detalheMatricula, setDetalheMatricula] = useState('')

  // Bloco 2: Mensalidade
  const [temMensalidade, setTemMensalidade] = useState(true)
  const [valorTabelaMensalidade, setValorTabelaMensalidade] = useState<string>('1330')
  const [descontoMensalidadePct, setDescontoMensalidadePct] = useState<string>('15')
  const [valorAutorizadoMensalidade, setValorAutorizadoMensalidade] = useState<string>('1130.50')
  const [qtdParcelasMensalidade, setQtdParcelasMensalidade] = useState<number>(12)
  const [diaVencimentoMensalidade, setDiaVencimentoMensalidade] = useState<number>(10)
  const [condicaoMensalidade, setCondicaoMensalidade] = useState(CONDICOES_MENSALIDADE[0])
  const [canalMensalidade, setCanalMensalidade] = useState<'no_isaac' | 'fora_isaac'>('no_isaac')

  // Bloco 3: Parcelamento Especial
  const [temParcelamentoEspecial, setTemParcelamentoEspecial] = useState(false)
  const [descricaoParcelamento, setDescricaoParcelamento] = useState('')
  const [valorOriginalParcelamento, setValorOriginalParcelamento] = useState<string>('0')
  const [descontoParcelamentoPct, setDescontoParcelamentoPct] = useState<string>('0')
  const [valorAutorizadoParcelamento, setValorAutorizadoParcelamento] = useState<string>('0')
  const [entradaParcelamento, setEntradaParcelamento] = useState<string>('0')
  const [qtdParcelasEspecial, setQtdParcelasEspecial] = useState<number>(6)
  const [formaPagamentoParcelamento, setFormaPagamentoParcelamento] = useState('Cartão de Crédito')
  const [canalParcelamento, setCanalParcelamento] = useState<'no_isaac' | 'fora_isaac'>('fora_isaac')

  // Bloco 4: Material Didático
  const [temMaterial, setTemMaterial] = useState(false)
  const [descricaoMaterial, setDescricaoMaterial] = useState(MATERIAIS_2027[4].nome)
  const [valorTabelaMaterial, setValorTabelaMaterial] = useState<string>('1985')
  const [descontoMaterialPct, setDescontoMaterialPct] = useState<string>('0')
  const [valorAutorizadoMaterial, setValorAutorizadoMaterial] = useState<string>('1985')
  const [parcelasMaterial, setParcelasMaterial] = useState<number>(6)
  const [formaPagamentoMaterial, setFormaPagamentoMaterial] = useState('Cartão de Crédito')
  const [canalMaterial, setCanalMaterial] = useState<'no_isaac' | 'fora_isaac'>('fora_isaac')

  // Governança e Autorização
  const [autorizadoPor, setAutorizadoPor] = useState('Diretor Geral')
  const [meioAutorizacao, setMeioAutorizacao] = useState(MEIOS_AUTORIZACAO[0])
  const [dataAutorizacao, setDataAutorizacao] = useState(todayStr)
  const [validadeNegociacao, setValidadeNegociacao] = useState('')
  const [status, setStatus] = useState<'autorizado' | 'lancado' | 'concluido' | 'cancelado'>('autorizado')
  const [observacoesDirecao, setObservacoesDirecao] = useState('')
  const [observacoesOperacionais, setObservacoesOperacionais] = useState('')

  // Busca no ERP
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [searchResults, setSearchResults] = useState<StudentSearchResult[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const searchBoxRef = useRef<HTMLDivElement>(null)

  // Inicializa dados quando abre para editar ou criar novo
  useEffect(() => {
    if (!isOpen) return
    setFormError(null)
    setSearchQuery('')
    setSearchResults([])
    setIsDropdownOpen(false)

    if (editingItem) {
      setAnoLetivo(editingItem.anoLetivo || '2027')
      setAlunos(
        Array.isArray(editingItem.alunos) && editingItem.alunos.length > 0
          ? editingItem.alunos
          : [
              {
                nome: editingItem.alunoNome || '',
                serieTurma: editingItem.serieTurma || '',
                segmentoId: editingItem.segmentoId || 'fund-2',
                tipoAluno: editingItem.tipoAluno || 'veterano',
                vinculadoErp: editingItem.vinculadoErp,
              },
            ]
      )
      setVinculadoErp(Boolean(editingItem.vinculadoErp))
      setAlunoIdErp(editingItem.alunoIdErp || '')
      setResponsavelNome(editingItem.responsavelNome || '')
      setResponsavelParentesco(editingItem.responsavelParentesco || 'Responsável Financeiro')
      setResponsavelTelefone(editingItem.responsavelTelefone || '')
      setResponsavelCpf(editingItem.responsavelCpf || '')
      setResponsavelIdErp(editingItem.responsavelIdErp || '')
      setModalidadeIsaac(editingItem.modalidadeIsaac || 'no_isaac')
      setSelectedSerieId(editingItem.segmentoId || 'fund-2')

      setTemMatricula(Boolean(editingItem.temMatricula))
      setValorTabelaMatricula(String(editingItem.valorTabelaMatricula ?? 1330))
      setDescontoMatriculaPct(String(editingItem.descontoMatriculaPct ?? 0))
      setValorAutorizadoMatricula(String(editingItem.valorAutorizadoMatricula ?? 1330))
      setFormaPagamentoMatricula(editingItem.formaPagamentoMatricula || 'Cartão de Crédito')
      setParcelasMatricula(editingItem.parcelasMatricula || 1)
      setCanalMatricula(editingItem.canalMatricula || 'fora_isaac')
      setDetalheMatricula(editingItem.detalheMatricula || '')

      setTemMensalidade(Boolean(editingItem.temMensalidade))
      setValorTabelaMensalidade(String(editingItem.valorTabelaMensalidade ?? 1330))
      setDescontoMensalidadePct(String(editingItem.descontoMensalidadePct ?? 0))
      setValorAutorizadoMensalidade(String(editingItem.valorAutorizadoMensalidade ?? 1330))
      setQtdParcelasMensalidade(editingItem.qtdParcelasMensalidade || 12)
      setDiaVencimentoMensalidade(editingItem.diaVencimentoMensalidade || 10)
      setCondicaoMensalidade(editingItem.condicaoMensalidade || CONDICOES_MENSALIDADE[0])
      setCanalMensalidade(editingItem.canalMensalidade || 'no_isaac')

      setTemParcelamentoEspecial(Boolean(editingItem.temParcelamentoEspecial))
      setDescricaoParcelamento(editingItem.descricaoParcelamento || '')
      setValorOriginalParcelamento(String(editingItem.valorOriginalParcelamento ?? 0))
      setDescontoParcelamentoPct(String(editingItem.descontoParcelamentoPct ?? 0))
      setValorAutorizadoParcelamento(String(editingItem.valorAutorizadoParcelamento ?? 0))
      setEntradaParcelamento(String(editingItem.entradaParcelamento ?? 0))
      setQtdParcelasEspecial(editingItem.qtdParcelasEspecial || 6)
      setFormaPagamentoParcelamento(editingItem.formaPagamentoParcelamento || 'Cartão de Crédito')
      setCanalParcelamento(editingItem.canalParcelamento || 'fora_isaac')

      setTemMaterial(Boolean(editingItem.temMaterial))
      setDescricaoMaterial(editingItem.descricaoMaterial || MATERIAIS_2027[4].nome)
      setValorTabelaMaterial(String(editingItem.valorTabelaMaterial ?? 1985))
      setDescontoMaterialPct(String(editingItem.descontoMaterialPct ?? 0))
      setValorAutorizadoMaterial(String(editingItem.valorAutorizadoMaterial ?? 1985))
      setParcelasMaterial(editingItem.parcelasMaterial || 6)
      setFormaPagamentoMaterial(editingItem.formaPagamentoMaterial || 'Cartão de Crédito')
      setCanalMaterial(editingItem.canalMaterial || 'fora_isaac')

      setAutorizadoPor(editingItem.autorizadoPor || 'Diretor Geral')
      setMeioAutorizacao(editingItem.meioAutorizacao || MEIOS_AUTORIZACAO[0])
      setDataAutorizacao(editingItem.dataAutorizacao || todayStr)
      setValidadeNegociacao(editingItem.validadeNegociacao || '')
      setStatus(editingItem.status || 'autorizado')
      setObservacoesDirecao(editingItem.observacoesDirecao || '')
      setObservacoesOperacionais(editingItem.observacoesOperacionais || '')
      setAvailableResponsaveis([])
    } else {
      setAnoLetivo(anoLetivoDefault || '2027')
      setAlunos([
        { nome: '', serieTurma: '6º ao 9º ano (Fundamental II)', segmentoId: 'fund-2', tipoAluno: 'veterano', vinculadoErp: false },
      ])
      setVinculadoErp(false)
      setAlunoIdErp('')
      setResponsavelNome('')
      setResponsavelParentesco('Responsável Financeiro')
      setResponsavelTelefone('')
      setResponsavelCpf('')
      setResponsavelIdErp('')
      setAvailableResponsaveis([])
      setModalidadeIsaac('hibrido')
      setSelectedSerieId('fund-2')

      setTemMatricula(true)
      setValorTabelaMatricula('1330.00')
      setDescontoMatriculaPct('15')
      setValorAutorizadoMatricula('1130.50')
      setFormaPagamentoMatricula('Cartão de Crédito')
      setParcelasMatricula(5)
      setCanalMatricula('fora_isaac')
      setDetalheMatricula('')

      setTemMensalidade(true)
      setValorTabelaMensalidade('1330.00')
      setDescontoMensalidadePct('15')
      setValorAutorizadoMensalidade('1130.50')
      setQtdParcelasMensalidade(12)
      setDiaVencimentoMensalidade(10)
      setCondicaoMensalidade(CONDICOES_MENSALIDADE[0])
      setCanalMensalidade('no_isaac')

      setTemParcelamentoEspecial(false)
      setDescricaoParcelamento('')
      setValorOriginalParcelamento('0')
      setDescontoParcelamentoPct('0')
      setValorAutorizadoParcelamento('0')
      setEntradaParcelamento('0')
      setQtdParcelasEspecial(6)
      setFormaPagamentoParcelamento('Cartão de Crédito')
      setCanalParcelamento('fora_isaac')

      setTemMaterial(false)
      setDescricaoMaterial(MATERIAIS_2027[4].nome)
      setValorTabelaMaterial('1985.00')
      setDescontoMaterialPct('0')
      setValorAutorizadoMaterial('1985.00')
      setParcelasMaterial(6)
      setFormaPagamentoMaterial('Cartão de Crédito')
      setCanalMaterial('fora_isaac')

      setAutorizadoPor('Diretor Geral')
      setMeioAutorizacao(MEIOS_AUTORIZACAO[0])
      setDataAutorizacao(todayStr)
      setValidadeNegociacao('')
      setStatus('autorizado')
      setObservacoesDirecao('')
      setObservacoesOperacionais('')
    }
  }, [isOpen, editingItem, anoLetivoDefault, todayStr])

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Extrator de responsáveis de um registro de aluno do ERP
  const extractResponsaveis = (a: any): ResponsavelOption[] => {
    const list: ResponsavelOption[] = []
    const addOrMerge = (tipo: string, nome: any, tel: any, cpf?: any, id?: string) => {
      if (!nome || typeof nome !== 'string') return
      const cleanNome = nome.trim()
      if (cleanNome.length < 2) return
      const cleanTel = tel ? formatPhoneNumber(String(tel).trim()) : ''
      const cleanCpf = cpf ? formatCpf(String(cpf).trim()) : ''

      const existing = list.find(r => r.nome.toLowerCase() === cleanNome.toLowerCase())
      if (existing) {
        if (!existing.telefone && cleanTel) existing.telefone = cleanTel
        if (!existing.cpf && cleanCpf) existing.cpf = cleanCpf
        if (existing.tipo === 'Responsável' && tipo !== 'Responsável') existing.tipo = tipo
        return
      }
      list.push({
        id: id || `resp-${list.length + 1}-${Math.random().toString(36).slice(2, 6)}`,
        tipo,
        nome: cleanNome,
        telefone: cleanTel,
        cpf: cleanCpf,
      })
    }

    if (Array.isArray(a.responsaveis)) {
      for (const r of a.responsaveis) {
        if (r && r.nome) {
          let tipo = 'Responsável'
          if (r.isFinanceiro || r.resp_financeiro || r.respFinanceiro) tipo = 'Resp. Financeiro'
          else if (r.isPedagogico || r.resp_pedagogico || r.respPedagogico) tipo = 'Resp. Pedagógico'
          else if (r.parentesco) tipo = r.parentesco.charAt(0).toUpperCase() + r.parentesco.slice(1)
          addOrMerge(tipo, r.nome, r.telefone || r.celular || r.tel, r.cpf, r.id)
        }
      }
    }

    const rfNome = a.responsavel_financeiro || a.dados?.responsavel_financeiro?.nome || a.dados?.responsavelFinanceiro?.nome
    const rfTel =
      a.tel_responsavel_financeiro ||
      a.dados?.responsavel_financeiro?.celular ||
      a.dados?.responsavel_financeiro?.telefone
    const rfCpf = a.cpf_responsavel_financeiro || a.dados?.responsavel_financeiro?.cpf
    if (rfNome) addOrMerge('Resp. Financeiro', rfNome, rfTel, rfCpf)

    const maeNome = a.dados?.mae?.nome || a.dados?.filiacao1?.nome
    const maeTel = a.dados?.mae?.celular || a.dados?.mae?.telefone || a.dados?.filiacao1?.celular
    const maeCpf = a.dados?.mae?.cpf || a.dados?.filiacao1?.cpf
    if (maeNome) addOrMerge('Mãe', maeNome, maeTel, maeCpf)

    const paiNome = a.dados?.pai?.nome || a.dados?.filiacao2?.nome
    const paiTel = a.dados?.pai?.celular || a.dados?.pai?.telefone || a.dados?.filiacao2?.celular
    const paiCpf = a.dados?.pai?.cpf || a.dados?.filiacao2?.cpf
    if (paiNome) addOrMerge('Pai', paiNome, paiTel, paiCpf)

    if (a.responsavel) addOrMerge('Responsável', a.responsavel, a.telefone || a.tel_responsavel, a.cpf_responsavel)

    return list
  }

  // Busca em tempo real de Alunos e Responsáveis no ERP
  useEffect(() => {
    const q = searchQuery.trim()
    if (q.length < 2) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    const timer = setTimeout(async () => {
      try {
        const [alunosRes, respRes] = await Promise.allSettled([
          fetch(`/api/alunos?search=${encodeURIComponent(q)}&limit=10`),
          fetch(`/api/responsaveis?search=${encodeURIComponent(q)}&limit=10`),
        ])

        const combined: StudentSearchResult[] = []

        if (alunosRes.status === 'fulfilled' && alunosRes.value.ok) {
          const json = await alunosRes.value.json()
          const list = Array.isArray(json) ? json : json.data || []
          for (const a of list) {
            const responsaveis = extractResponsaveis(a)
            const turmaNome =
              a.turma_nome ||
              turmasMap[String(a.turma)] ||
              turmasMap[String(a.dados?.turma)] ||
              a.turma ||
              a.serie ||
              ''
            combined.push({
              id: `aluno-${a.id}`,
              rawId: String(a.id),
              nomeAluno: a.nome || '',
              turma: turmaNome,
              origem: 'aluno',
              responsaveis,
            })
          }
        }

        if (respRes.status === 'fulfilled' && respRes.value.ok) {
          const json = await respRes.value.json()
          const list = Array.isArray(json) ? json : json.data || []
          for (const r of list) {
            const tel = r.telefone || r.celular || ''
            const respNome = r.nome || ''
            const respCpf = r.cpf || ''
            const respOpt: ResponsavelOption = {
              id: `resp-db-${r.id}`,
              tipo: 'Responsável Financeiro',
              nome: respNome,
              telefone: formatPhoneNumber(tel),
              cpf: formatCpf(respCpf),
            }

            if (Array.isArray(r.alunos) && r.alunos.length > 0) {
              const allSiblings = r.alunos.map((al: any) => ({
                id: String(al.id || ''),
                nome: al.nome || '',
                turma:
                  al.turma_nome ||
                  turmasMap[String(al.turma)] ||
                  turmasMap[String(al.dados?.turma)] ||
                  al.turma ||
                  al.serie ||
                  '',
              }))

              for (const a of r.alunos) {
                const turmaNome =
                  a.turma_nome ||
                  turmasMap[String(a.turma)] ||
                  turmasMap[String(a.dados?.turma)] ||
                  a.turma ||
                  a.serie ||
                  ''
                const existing = combined.find(c => c.nomeAluno.toLowerCase() === (a.nome || '').toLowerCase())
                if (existing) {
                  if (!existing.turma && turmaNome) existing.turma = turmaNome
                  existing.irmaos = allSiblings.filter((s: any) => s.nome !== existing.nomeAluno)
                  const match = existing.responsaveis.find(res => res.nome.toLowerCase() === respNome.toLowerCase())
                  if (match) {
                    if (tel && !match.telefone) match.telefone = formatPhoneNumber(tel)
                    if (respCpf && !match.cpf) match.cpf = formatCpf(respCpf)
                  } else {
                    existing.responsaveis.push(respOpt)
                  }
                } else {
                  combined.push({
                    id: `resp-${r.id}-${a.id || Math.random()}`,
                    rawId: String(a.id || ''),
                    nomeAluno: a.nome || '',
                    turma: turmaNome,
                    origem: 'responsavel',
                    responsaveis: [respOpt],
                    irmaos: allSiblings.filter((s: any) => s.nome !== (a.nome || '')),
                  })
                }
              }
            } else {
              combined.push({
                id: `resp-only-${r.id}`,
                nomeAluno: '',
                turma: '',
                origem: 'responsavel',
                responsaveis: [respOpt],
              })
            }
          }
        }

        setSearchResults(combined.slice(0, 12))
        setIsDropdownOpen(true)
      } catch (err) {
        console.error('Erro na busca ERP:', err)
      } finally {
        setIsSearching(false)
      }
    }, 240)

    return () => clearTimeout(timer)
  }, [searchQuery, turmasMap])

  // Aplicar série 2027 e atualizar valores base automaticamente
  const handleSelectSerie2027 = (serieId: string) => {
    setSelectedSerieId(serieId)
    const serieObj = SERIES_2027.find(s => s.id === serieId)
    if (!serieObj) return

    // Atualiza série do primeiro aluno se estiver só com 1 aluno
    setAlunos(prev =>
      prev.map((al, i) => (i === 0 ? { ...al, serieTurma: serieObj.nome, segmentoId: serieObj.id } : al))
    )

    const base = serieObj.mensalidadeBase
    const descMat = parseFloat(descontoMatriculaPct) || 0
    const descMen = parseFloat(descontoMensalidadePct) || 0

    setValorTabelaMatricula(base.toFixed(2))
    setValorAutorizadoMatricula((base * (1 - descMat / 100)).toFixed(2))

    setValorTabelaMensalidade(base.toFixed(2))
    setValorAutorizadoMensalidade((base * (1 - descMen / 100)).toFixed(2))

    setDescricaoMaterial(serieObj.taxaMaterialDesc)
    setValorTabelaMaterial(serieObj.taxaMaterial.toFixed(2))
    const descMatDid = parseFloat(descontoMaterialPct) || 0
    setValorAutorizadoMaterial((serieObj.taxaMaterial * (1 - descMatDid / 100)).toFixed(2))
  }

  // Selecionar resultado da busca do ERP
  const handleSelectSearchResult = (res: StudentSearchResult) => {
    const detectedId = detectSerieIdFromTurma(res.turma) || 'fund-2'
    const serieObj = SERIES_2027.find(s => s.id === detectedId)

    if (res.nomeAluno) {
      setAlunos([
        {
          id: res.rawId,
          nome: res.nomeAluno,
          serieTurma: res.turma || serieObj?.nome || '',
          segmentoId: detectedId,
          tipoAluno: 'veterano',
          vinculadoErp: true,
        },
      ])
      setVinculadoErp(true)
      setAlunoIdErp(res.rawId || '')
    }

    if (serieObj) {
      setSelectedSerieId(serieObj.id)
      const base = serieObj.mensalidadeBase
      const descMat = parseFloat(descontoMatriculaPct) || 0
      const descMen = parseFloat(descontoMensalidadePct) || 0
      setValorTabelaMatricula(base.toFixed(2))
      setValorAutorizadoMatricula((base * (1 - descMat / 100)).toFixed(2))
      setValorTabelaMensalidade(base.toFixed(2))
      setValorAutorizadoMensalidade((base * (1 - descMen / 100)).toFixed(2))
    }

    setAvailableResponsaveis(res.responsaveis || [])
    const targetResp = res.responsaveis.find(r => !!r.telefone) || res.responsaveis[0]
    if (targetResp) {
      setResponsavelNome(targetResp.nome)
      setResponsavelParentesco(targetResp.tipo || 'Responsável Financeiro')
      setResponsavelTelefone(formatPhoneNumber(targetResp.telefone))
      if (targetResp.cpf) setResponsavelCpf(formatCpf(targetResp.cpf))
      setResponsavelIdErp(targetResp.id)
    }

    setSearchQuery('')
    setIsDropdownOpen(false)

    // Busca detalhes adicionais do aluno para enriquecer responsáveis (CPF/Telefone)
    if (res.rawId) {
      fetch(`/api/alunos/${encodeURIComponent(res.rawId)}`)
        .then(r => (r.ok ? r.json() : null))
        .then(detail => {
          if (detail && Array.isArray(detail.responsaveis) && detail.responsaveis.length > 0) {
            const enriched: ResponsavelOption[] = detail.responsaveis
              .map((r: any, idx: number) => {
                let tipo = 'Responsável'
                if (r.isFinanceiro || r.resp_financeiro || r.respFinanceiro) tipo = 'Resp. Financeiro'
                else if (r.isPedagogico || r.resp_pedagogico || r.respPedagogico) tipo = 'Resp. Pedagógico'
                else if (r.parentesco) tipo = r.parentesco.charAt(0).toUpperCase() + r.parentesco.slice(1)
                return {
                  id: r.id || `resp-det-${idx}`,
                  tipo,
                  nome: r.nome || '',
                  telefone: formatPhoneNumber(r.telefone || r.celular || r.tel || ''),
                  cpf: formatCpf(r.cpf || ''),
                }
              })
              .filter((r: ResponsavelOption) => r.nome && r.nome.length > 1)

            if (enriched.length > 0) {
              setAvailableResponsaveis(enriched)
              const primary = enriched.find(r => r.tipo === 'Resp. Financeiro') || enriched[0]
              if (primary) {
                setResponsavelNome(primary.nome)
                setResponsavelParentesco(primary.tipo)
                if (primary.telefone) setResponsavelTelefone(primary.telefone)
                if (primary.cpf) setResponsavelCpf(primary.cpf)
              }
            }
          }
        })
        .catch(() => {})
    }
  }

  // Trocar Modalidade Principal (Isaac vs Fora do Isaac vs Híbrido)
  const handleSelectModalidadeIsaac = (mod: 'no_isaac' | 'fora_isaac' | 'hibrido') => {
    setModalidadeIsaac(mod)
    if (mod === 'no_isaac') {
      setCanalMatricula('no_isaac')
      setCanalMensalidade('no_isaac')
      setCanalParcelamento('no_isaac')
      setCanalMaterial('no_isaac')
    } else if (mod === 'fora_isaac') {
      setCanalMatricula('fora_isaac')
      setCanalMensalidade('fora_isaac')
      setCanalParcelamento('fora_isaac')
      setCanalMaterial('fora_isaac')
    } else {
      // Híbrido clássico escolar: Matrícula paga na escola (Fora do isaac) e Mensalidade no isaac
      setCanalMatricula('fora_isaac')
      setCanalMensalidade('no_isaac')
    }
  }

  // Cálculos Bidirecionais — Matrícula
  const onMatriculaTabelaChange = (val: string) => {
    setValorTabelaMatricula(val)
    const tab = parseFloat(val) || 0
    const desc = parseFloat(descontoMatriculaPct) || 0
    setValorAutorizadoMatricula((tab * (1 - desc / 100)).toFixed(2))
  }
  const onMatriculaDescontoChange = (descStr: string) => {
    setDescontoMatriculaPct(descStr)
    const tab = parseFloat(valorTabelaMatricula) || 0
    const desc = Math.min(100, Math.max(0, parseFloat(descStr) || 0))
    setValorAutorizadoMatricula((tab * (1 - desc / 100)).toFixed(2))
  }
  const onMatriculaAutorizadoChange = (autStr: string) => {
    setValorAutorizadoMatricula(autStr)
    const tab = parseFloat(valorTabelaMatricula) || 0
    const aut = parseFloat(autStr) || 0
    if (tab > 0) {
      const desc = Math.max(0, ((1 - aut / tab) * 100))
      setDescontoMatriculaPct(desc.toFixed(1))
    }
  }

  // Cálculos Bidirecionais — Mensalidade
  const onMensalidadeTabelaChange = (val: string) => {
    setValorTabelaMensalidade(val)
    const tab = parseFloat(val) || 0
    const desc = parseFloat(descontoMensalidadePct) || 0
    setValorAutorizadoMensalidade((tab * (1 - desc / 100)).toFixed(2))
  }
  const onMensalidadeDescontoChange = (descStr: string) => {
    setDescontoMensalidadePct(descStr)
    const tab = parseFloat(valorTabelaMensalidade) || 0
    const desc = Math.min(100, Math.max(0, parseFloat(descStr) || 0))
    setValorAutorizadoMensalidade((tab * (1 - desc / 100)).toFixed(2))
  }
  const onMensalidadeAutorizadoChange = (autStr: string) => {
    setValorAutorizadoMensalidade(autStr)
    const tab = parseFloat(valorTabelaMensalidade) || 0
    const aut = parseFloat(autStr) || 0
    if (tab > 0) {
      const desc = Math.max(0, ((1 - aut / tab) * 100))
      setDescontoMensalidadePct(desc.toFixed(1))
    }
  }

  // Cálculos Bidirecionais — Parcelamento Especial
  const onParcelamentoOriginalChange = (val: string) => {
    setValorOriginalParcelamento(val)
    const orig = parseFloat(val) || 0
    const desc = parseFloat(descontoParcelamentoPct) || 0
    setValorAutorizadoParcelamento((orig * (1 - desc / 100)).toFixed(2))
  }
  const onParcelamentoDescontoChange = (descStr: string) => {
    setDescontoParcelamentoPct(descStr)
    const orig = parseFloat(valorOriginalParcelamento) || 0
    const desc = Math.min(100, Math.max(0, parseFloat(descStr) || 0))
    setValorAutorizadoParcelamento((orig * (1 - desc / 100)).toFixed(2))
  }
  const onParcelamentoAutorizadoChange = (autStr: string) => {
    setValorAutorizadoParcelamento(autStr)
    const orig = parseFloat(valorOriginalParcelamento) || 0
    const aut = parseFloat(autStr) || 0
    if (orig > 0) {
      const desc = Math.max(0, ((1 - aut / orig) * 100))
      setDescontoParcelamentoPct(desc.toFixed(1))
    }
  }

  // Submissão
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validAlunos = alunos.filter(a => a.nome.trim().length > 0)
    if (validAlunos.length === 0 && !responsavelNome.trim()) {
      setFormError('Informe pelo menos o nome do aluno ou do responsável.')
      return
    }
    if (!temMatricula && !temMensalidade && !temParcelamentoEspecial && !temMaterial) {
      setFormError('Selecione pelo menos um item negociado (Matrícula, Mensalidade, Parcelamento ou Material).')
      return
    }

    setIsSubmitting(true)
    setFormError(null)
    try {
      const vAutMat = parseFloat(valorAutorizadoMatricula) || 0
      const nParcMat = Math.max(1, Number(parcelasMatricula) || 1)

      const vAutParc = parseFloat(valorAutorizadoParcelamento) || 0
      const vEntParc = parseFloat(entradaParcelamento) || 0
      const nParcEsp = Math.max(1, Number(qtdParcelasEspecial) || 1)

      await onSave({
        id: editingItem?.id,
        protocolo: editingItem?.protocolo,
        anoLetivo,
        alunos: validAlunos.length > 0 ? validAlunos : [{ nome: 'Aluno a definir', serieTurma: '', tipoAluno: 'novo' }],
        alunoNome: validAlunos.map(a => a.nome.trim()).join(' / ') || 'Aluno a definir',
        serieTurma: validAlunos[0]?.serieTurma || '',
        segmentoId: selectedSerieId,
        tipoAluno: validAlunos[0]?.tipoAluno || 'veterano',
        vinculadoErp,
        alunoIdErp,

        responsavelNome: responsavelNome.trim() || 'Responsável a definir',
        responsavelParentesco,
        responsavelTelefone: responsavelTelefone.trim(),
        responsavelCpf: responsavelCpf.trim(),
        responsavelIdErp,

        modalidadeIsaac,

        temMatricula,
        valorTabelaMatricula: parseFloat(valorTabelaMatricula) || 0,
        descontoMatriculaPct: parseFloat(descontoMatriculaPct) || 0,
        valorAutorizadoMatricula: vAutMat,
        formaPagamentoMatricula,
        parcelasMatricula: nParcMat,
        valorParcelaMatricula: Number((vAutMat / nParcMat).toFixed(2)),
        canalMatricula,
        detalheMatricula: detalheMatricula.trim(),

        temMensalidade,
        valorTabelaMensalidade: parseFloat(valorTabelaMensalidade) || 0,
        descontoMensalidadePct: parseFloat(descontoMensalidadePct) || 0,
        valorAutorizadoMensalidade: parseFloat(valorAutorizadoMensalidade) || 0,
        qtdParcelasMensalidade: Math.max(1, Number(qtdParcelasMensalidade) || 12),
        diaVencimentoMensalidade: Number(diaVencimentoMensalidade) || 10,
        condicaoMensalidade,
        canalMensalidade,

        temParcelamentoEspecial,
        descricaoParcelamento: descricaoParcelamento.trim(),
        valorOriginalParcelamento: parseFloat(valorOriginalParcelamento) || 0,
        descontoParcelamentoPct: parseFloat(descontoParcelamentoPct) || 0,
        valorAutorizadoParcelamento: vAutParc,
        entradaParcelamento: vEntParc,
        qtdParcelasEspecial: nParcEsp,
        valorParcelaEspecial: Number((Math.max(0, vAutParc - vEntParc) / nParcEsp).toFixed(2)),
        formaPagamentoParcelamento,
        canalParcelamento,

        temMaterial,
        descricaoMaterial,
        valorTabelaMaterial: parseFloat(valorTabelaMaterial) || 0,
        descontoMaterialPct: parseFloat(descontoMaterialPct) || 0,
        valorAutorizadoMaterial: parseFloat(valorAutorizadoMaterial) || 0,
        parcelasMaterial: Math.max(1, Number(parcelasMaterial) || 1),
        formaPagamentoMaterial,
        canalMaterial,

        autorizadoPor: autorizadoPor.trim() || 'Diretor Geral',
        meioAutorizacao,
        dataAutorizacao,
        validadeNegociacao,
        status,
        observacoesDirecao: observacoesDirecao.trim(),
        observacoesOperacionais: observacoesOperacionais.trim(),
        usuarioAcao: currentUserName,
      })
      onClose()
    } catch (err: any) {
      setFormError(err.message || 'Erro ao salvar negociação.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9990,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          overflowY: 'auto',
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 960,
            maxHeight: '93vh',
            background: '#ffffff',
            borderRadius: 24,
            border: '1px solid #cbd5e1',
            boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.4)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            color: '#0f172a',
          }}
        >
          {/* Header do Modal */}
          <div
            style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #1e3a8a 100%)',
              padding: '20px 28px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
              borderBottom: '1px solid #1e293b',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span
                  style={{
                    background: '#10b981',
                    color: '#ffffff',
                    fontSize: 10,
                    fontWeight: 900,
                    padding: '3px 9px',
                    borderRadius: 6,
                    letterSpacing: '0.04em',
                  }}
                >
                  CAMPANHA {anoLetivo}
                </span>
                <span
                  style={{
                    background: 'rgba(255,255,255,0.12)',
                    color: '#93c5fd',
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '3px 9px',
                    borderRadius: 6,
                  }}
                >
                  AUTORIZAÇÃO DA DIREÇÃO
                </span>
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: '#ffffff', margin: 0 }}>
                {editingItem ? `Editar Negociação · ${editingItem.protocolo}` : 'Registrar Nova Negociação Autorizada'}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Corpo com Scroll */}
          <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 22 }}>
            {formError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  padding: '12px 16px',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                ⚠️ {formError}
              </div>
            )}

            {/* SEÇÃO 1: BUSCA NO ERP OU DIGITAÇÃO MANUAL */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: 18,
                padding: 20,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <User size={18} color="#2563eb" />
                  <span style={{ fontSize: 14, fontWeight: 900, color: '#0f172a' }}>
                    1. Identificação do Aluno e Responsável (Busca no Sistema ou Digitado)
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: 8,
                    background: vinculadoErp ? '#dbeafe' : '#f1f5f9',
                    color: vinculadoErp ? '#1d4ed8' : '#475569',
                  }}
                >
                  {vinculadoErp ? '✓ Vinculado ao Cadastro do ERP' : '✎ Modo Digitação Livre / Aluno Novo'}
                </span>
              </div>

              {/* Barra de Busca Rápida ERP */}
              <div ref={searchBoxRef} style={{ position: 'relative', marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#1e40af', marginBottom: 6 }}>
                  🔍 Buscar Aluno ou Responsável já cadastrado no ERP (ou digite manualmente nos campos abaixo):
                </label>
                <div style={{ position: 'relative' }}>
                  <Search size={16} color="#2563eb" style={{ position: 'absolute', left: 14, top: 12 }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value)
                      setIsDropdownOpen(true)
                    }}
                    onFocus={() => {
                      if (searchResults.length > 0) setIsDropdownOpen(true)
                    }}
                    placeholder="Digite o nome do aluno ou responsável para puxar dados automaticamente..."
                    style={{
                      width: '100%',
                      padding: '10px 38px 10px 40px',
                      borderRadius: 12,
                      border: '2px solid #93c5fd',
                      background: '#ffffff',
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  {isSearching ? (
                    <Loader2 size={16} color="#2563eb" className="animate-spin" style={{ position: 'absolute', right: 14, top: 12 }} />
                  ) : searchQuery ? (
                    <X
                      size={16}
                      color="#94a3b8"
                      onClick={() => setSearchQuery('')}
                      style={{ position: 'absolute', right: 14, top: 12, cursor: 'pointer' }}
                    />
                  ) : null}
                </div>

                {/* Dropdown de resultados */}
                {isDropdownOpen && searchResults.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 100,
                      marginTop: 6,
                      background: '#ffffff',
                      borderRadius: 14,
                      border: '1px solid #cbd5e1',
                      boxShadow: '0 16px 40px rgba(15, 23, 42, 0.2)',
                      maxHeight: 260,
                      overflowY: 'auto',
                    }}
                  >
                    {searchResults.map(res => (
                      <div
                        key={res.id}
                        onClick={() => handleSelectSearchResult(res)}
                        style={{
                          padding: '10px 16px',
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 10,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#ffffff')}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
                            {res.nomeAluno || res.responsaveis[0]?.nome || 'Registro'}
                            {res.turma && (
                              <span
                                style={{
                                  marginLeft: 8,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background: '#dbeafe',
                                  color: '#1e40af',
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                }}
                              >
                                {res.turma}
                              </span>
                            )}
                          </div>
                          {res.responsaveis.length > 0 && (
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                              Resp.: {res.responsaveis.map(r => `${r.nome}${r.telefone ? ` (${r.telefone})` : ''}`).join(' · ')}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#2563eb' }}>Selecionar →</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Lista de Alunos da Negociação (Suporta 1 ou mais irmãos) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#334155', textTransform: 'uppercase' }}>
                    Aluno(s) Contemplado(s) na Negociação
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setAlunos(prev => [
                        ...prev,
                        { nome: '', serieTurma: SERIES_2027[5].nome, segmentoId: 'fund-2', tipoAluno: 'veterano', vinculadoErp: false },
                      ])
                    }
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 800,
                      color: '#2563eb',
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      padding: '4px 10px',
                      borderRadius: 8,
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={12} />
                    Adicionar Irmão / Outro Aluno
                  </button>
                </div>

                {alunos.map((al, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.6fr 1.2fr auto auto',
                      gap: 10,
                      alignItems: 'center',
                      background: '#ffffff',
                      padding: 10,
                      borderRadius: 12,
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: '#64748b', marginBottom: 3 }}>
                        Nome do Aluno {alunos.length > 1 ? `#${idx + 1}` : ''} *
                      </label>
                      <input
                        type="text"
                        value={al.nome}
                        onChange={e => {
                          const v = e.target.value
                          setAlunos(prev => prev.map((item, i) => (i === idx ? { ...item, nome: v } : item)))
                        }}
                        placeholder="Digite o nome completo do aluno..."
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          fontSize: 13,
                          fontWeight: 700,
                          color: '#0f172a',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: '#64748b', marginBottom: 3 }}>
                        Série / Turma Pretendida ({anoLetivo})
                      </label>
                      <input
                        type="text"
                        value={al.serieTurma}
                        onChange={e => {
                          const v = e.target.value
                          setAlunos(prev => prev.map((item, i) => (i === idx ? { ...item, serieTurma: v } : item)))
                        }}
                        placeholder="Ex: 6º Ano A, Nível 4, Integral..."
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          fontSize: 13,
                          fontWeight: 600,
                          color: '#0f172a',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: '#64748b', marginBottom: 3 }}>
                        Perfil
                      </label>
                      <select
                        value={al.tipoAluno || 'veterano'}
                        onChange={e => {
                          const v = e.target.value as 'veterano' | 'novo'
                          setAlunos(prev => prev.map((item, i) => (i === idx ? { ...item, tipoAluno: v } : item)))
                        }}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#0f172a',
                          background: '#f8fafc',
                        }}
                      >
                        <option value="veterano">Veterano (Rematrícula)</option>
                        <option value="novo">Aluno Novo</option>
                      </select>
                    </div>

                    {alunos.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setAlunos(prev => prev.filter((_, i) => i !== idx))}
                        style={{
                          marginTop: 16,
                          padding: 8,
                          borderRadius: 8,
                          border: '1px solid #fecaca',
                          background: '#fef2f2',
                          color: '#ef4444',
                          cursor: 'pointer',
                        }}
                        title="Remover aluno"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Pills de Responsáveis Encontrados no ERP */}
              {availableResponsaveis.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <span style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#047857', marginBottom: 6 }}>
                    👥 Responsáveis vinculados encontrados no ERP (clique para alternar):
                  </span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {availableResponsaveis.map(resp => {
                      const isSel = responsavelNome.toLowerCase() === resp.nome.toLowerCase()
                      return (
                        <button
                          key={resp.id}
                          type="button"
                          onClick={() => {
                            setResponsavelNome(resp.nome)
                            setResponsavelParentesco(resp.tipo || 'Responsável Financeiro')
                            if (resp.telefone) setResponsavelTelefone(resp.telefone)
                            if (resp.cpf) setResponsavelCpf(resp.cpf)
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: 'pointer',
                            background: isSel ? '#059669' : '#ffffff',
                            color: isSel ? '#ffffff' : '#065f46',
                            border: `1px solid ${isSel ? '#059669' : '#a7f3d0'}`,
                          }}
                        >
                          {resp.tipo}: {resp.nome} {resp.telefone ? `(${resp.telefone})` : ''}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Campos do Responsável */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#334155', marginBottom: 4 }}>
                    Nome do Responsável *
                  </label>
                  <input
                    type="text"
                    value={responsavelNome}
                    onChange={e => setResponsavelNome(e.target.value)}
                    placeholder="Nome da mãe, pai ou resp. financeiro"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 10,
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#0f172a',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#334155', marginBottom: 4 }}>
                    Vínculo / Parentesco
                  </label>
                  <select
                    value={responsavelParentesco}
                    onChange={e => setResponsavelParentesco(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 10,
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#0f172a',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="Responsável Financeiro">Responsável Financeiro</option>
                    <option value="Mãe">Mãe</option>
                    <option value="Pai">Pai</option>
                    <option value="Responsável Pedagógico">Responsável Pedagógico</option>
                    <option value="Avô / Avó / Tutor">Avô / Avó / Tutor</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#334155', marginBottom: 4 }}>
                    WhatsApp / Telefone
                  </label>
                  <input
                    type="text"
                    value={responsavelTelefone}
                    onChange={e => setResponsavelTelefone(formatPhoneNumber(e.target.value))}
                    placeholder="(00) 90000-0000"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 10,
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#0f172a',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#334155', marginBottom: 4 }}>
                    CPF do Responsável (Opcional)
                  </label>
                  <input
                    type="text"
                    value={responsavelCpf}
                    onChange={e => setResponsavelCpf(formatCpf(e.target.value))}
                    placeholder="000.000.000-00"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 10,
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#0f172a',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO 2: CLASSIFICAÇÃO NO ISAAC vs FORA DO ISAAC */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 18,
                padding: 20,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 900, color: '#0f172a', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CreditCard size={18} color="#7c3aed" />
                2. Onde esta negociação será processada? (No isaac vs Fora do isaac)
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                {(['no_isaac', 'fora_isaac', 'hibrido'] as const).map(modKey => {
                  const cfg = MODALIDADE_ISAAC_CONFIG[modKey]
                  const isSel = modalidadeIsaac === modKey
                  return (
                    <button
                      key={modKey}
                      type="button"
                      onClick={() => handleSelectModalidadeIsaac(modKey)}
                      style={{
                        textAlign: 'left',
                        padding: '14px 16px',
                        borderRadius: 14,
                        border: isSel ? `2px solid ${cfg.dotColor}` : '1px solid #e2e8f0',
                        background: isSel ? cfg.bg : '#f8fafc',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 900, color: isSel ? cfg.color : '#0f172a' }}>
                          ● {cfg.label}
                        </span>
                        {isSel && <Check size={16} color={cfg.color} />}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>{cfg.desc}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* SEÇÃO 3: SELETOR RÁPIDO DE SÉRIE 2027 & BLOCOS FINANCEIROS */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: 18,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#0f172a', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calculator size={18} color="#059669" />
                  3. Valores e Condições Autorizadas pelo Diretor (Tabela Base 2027)
                </div>
                <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 10px' }}>
                  Clique em uma série abaixo para carregar automaticamente o valor de tabela 2027 ou digite qualquer valor personalizado:
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {SERIES_2027.map(s => {
                    const active = selectedSerieId === s.id
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleSelectSerie2027(s.id)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: 'pointer',
                          border: active ? '1px solid #2563eb' : '1px solid #cbd5e1',
                          background: active ? '#2563eb' : '#ffffff',
                          color: active ? '#ffffff' : '#334155',
                        }}
                      >
                        {s.nome} ({fmtCurrency(s.mensalidadeBase)})
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* BLOCO A: MATRÍCULA / REMATRÍCULA */}
              <div
                style={{
                  background: '#ffffff',
                  border: temMatricula ? '2px solid #93c5fd' : '1px solid #e2e8f0',
                  borderRadius: 16,
                  padding: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, fontWeight: 900, color: '#1e3a8a' }}>
                    <input
                      type="checkbox"
                      checked={temMatricula}
                      onChange={e => setTemMatricula(e.target.checked)}
                      style={{ width: 18, height: 18, accentColor: '#2563eb' }}
                    />
                    🎒 Negociação de Matrícula / Rematrícula ({anoLetivo})
                  </label>

                  {temMatricula && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['fora_isaac', 'no_isaac'] as const).map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCanalMatricula(c)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 8,
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: 'pointer',
                            background: canalMatricula === c ? (c === 'no_isaac' ? '#7c3aed' : '#10b981') : '#f1f5f9',
                            color: canalMatricula === c ? '#ffffff' : '#475569',
                            border: 'none',
                          }}
                        >
                          {c === 'no_isaac' ? '🟣 Matrícula No isaac' : '🟢 Matrícula Fora do isaac (Escola)'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {temMatricula && (
                  <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b' }}>Atalhos Desconto Matrícula:</span>
                      {[0, 5, 10, 15, 20, 25, 30, 50, 100].map(pct => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => onMatriculaDescontoChange(String(pct))}
                          style={{
                            padding: '3px 9px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: 'pointer',
                            background: Number(descontoMatriculaPct) === pct ? '#1e40af' : '#eff6ff',
                            color: Number(descontoMatriculaPct) === pct ? '#ffffff' : '#1e40af',
                            border: '1px solid #bfdbfe',
                          }}
                        >
                          {pct === 100 ? 'Isento (100%)' : `${pct}%`}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                          Valor Tabela (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={valorTabelaMatricula}
                          onChange={e => onMatriculaTabelaChange(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700, boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                          Desconto (%)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={descontoMatriculaPct}
                          onChange={e => onMatriculaDescontoChange(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700, boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 900, color: '#15803d', marginBottom: 4 }}>
                          Valor Autorizado (R$) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={valorAutorizadoMatricula}
                          onChange={e => onMatriculaAutorizadoChange(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '2px solid #86efac', background: '#f0fdf4', fontSize: 14, fontWeight: 900, color: '#065f46', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                          Forma de Pagamento
                        </label>
                        <select
                          value={formaPagamentoMatricula}
                          onChange={e => setFormaPagamentoMatricula(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 700, background: '#ffffff', boxSizing: 'border-box' }}
                        >
                          {FORMAS_PAGAMENTO.map(fp => (
                            <option key={fp} value={fp}>{fp}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                          Parcelas Matrícula
                        </label>
                        <select
                          value={parcelasMatricula}
                          onChange={e => setParcelasMatricula(Number(e.target.value))}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 700, background: '#ffffff', boxSizing: 'border-box' }}
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12].map(n => (
                            <option key={n} value={n}>
                              {n}x de {fmtCurrency((parseFloat(valorAutorizadoMatricula) || 0) / n)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <input
                        type="text"
                        value={detalheMatricula}
                        onChange={e => setDetalheMatricula(e.target.value)}
                        placeholder="Detalhe opcional da matrícula (ex: 1ª parcela no PIX em 10/11 e restante em 4x no cartão na secretaria)..."
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 600, boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* BLOCO B: MENSALIDADES / ANUIDADE */}
              <div
                style={{
                  background: '#ffffff',
                  border: temMensalidade ? '2px solid #6ee7b7' : '1px solid #e2e8f0',
                  borderRadius: 16,
                  padding: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, fontWeight: 900, color: '#065f46' }}>
                    <input
                      type="checkbox"
                      checked={temMensalidade}
                      onChange={e => setTemMensalidade(e.target.checked)}
                      style={{ width: 18, height: 18, accentColor: '#059669' }}
                    />
                    📅 Negociação de Mensalidades / Anuidade ({anoLetivo})
                  </label>

                  {temMensalidade && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['no_isaac', 'fora_isaac'] as const).map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCanalMensalidade(c)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 8,
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: 'pointer',
                            background: canalMensalidade === c ? (c === 'no_isaac' ? '#7c3aed' : '#10b981') : '#f1f5f9',
                            color: canalMensalidade === c ? '#ffffff' : '#475569',
                            border: 'none',
                          }}
                        >
                          {c === 'no_isaac' ? '🟣 Mensalidade No isaac' : '🟢 Mensalidade Fora do isaac'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {temMensalidade && (
                  <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b' }}>Atalhos Desconto Mensalidade:</span>
                      {[0, 5, 10, 11, 15, 20, 25, 30, 40, 50].map(pct => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => onMensalidadeDescontoChange(String(pct))}
                          style={{
                            padding: '3px 9px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: 'pointer',
                            background: Number(descontoMensalidadePct) === pct ? '#047857' : '#ecfdf5',
                            color: Number(descontoMensalidadePct) === pct ? '#ffffff' : '#047857',
                            border: '1px solid #a7f3d0',
                          }}
                        >
                          {pct === 11 ? '11% (Convênio)' : `${pct}%`}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                          Mensalidade Tabela (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={valorTabelaMensalidade}
                          onChange={e => onMensalidadeTabelaChange(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700, boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                          Desconto (%)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={descontoMensalidadePct}
                          onChange={e => onMensalidadeDescontoChange(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700, boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 900, color: '#15803d', marginBottom: 4 }}>
                          Mensalidade Autorizada (R$) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={valorAutorizadoMensalidade}
                          onChange={e => onMensalidadeAutorizadoChange(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '2px solid #86efac', background: '#f0fdf4', fontSize: 14, fontWeight: 900, color: '#065f46', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                          Nº Parcelas Anuidade
                        </label>
                        <select
                          value={qtdParcelasMensalidade}
                          onChange={e => setQtdParcelasMensalidade(Number(e.target.value))}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 700, background: '#ffffff', boxSizing: 'border-box' }}
                        >
                          {[12, 11, 10, 9, 8, 6, 1].map(n => (
                            <option key={n} value={n}>{n}x parcelas</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                          Dia Vencimento
                        </label>
                        <select
                          value={diaVencimentoMensalidade}
                          onChange={e => setDiaVencimentoMensalidade(Number(e.target.value))}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 700, background: '#ffffff', boxSizing: 'border-box' }}
                        >
                          {[5, 10, 15, 20, 25, 30].map(d => (
                            <option key={d} value={d}>Todo dia {d}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                        Condição / Regra do Desconto da Mensalidade
                      </label>
                      <select
                        value={condicaoMensalidade}
                        onChange={e => setCondicaoMensalidade(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 700, background: '#ffffff', boxSizing: 'border-box' }}
                      >
                        {CONDICOES_MENSALIDADE.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* BLOCO C: PARCELAMENTO ESPECIAL / ACORDO */}
              <div
                style={{
                  background: '#ffffff',
                  border: temParcelamentoEspecial ? '2px solid #c4b5fd' : '1px solid #e2e8f0',
                  borderRadius: 16,
                  padding: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, fontWeight: 900, color: '#5b21b6' }}>
                    <input
                      type="checkbox"
                      checked={temParcelamentoEspecial}
                      onChange={e => setTemParcelamentoEspecial(e.target.checked)}
                      style={{ width: 18, height: 18, accentColor: '#7c3aed' }}
                    />
                    💳 Parcelamento Especial / Acordo Financeiro Autorizado
                  </label>

                  {temParcelamentoEspecial && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['fora_isaac', 'no_isaac'] as const).map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCanalParcelamento(c)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 8,
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: 'pointer',
                            background: canalParcelamento === c ? (c === 'no_isaac' ? '#7c3aed' : '#10b981') : '#f1f5f9',
                            color: canalParcelamento === c ? '#ffffff' : '#475569',
                            border: 'none',
                          }}
                        >
                          {c === 'no_isaac' ? '🟣 Acordo No isaac' : '🟢 Acordo Fora do isaac (Escola)'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {temParcelamentoEspecial && (
                  <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                        Descrição do que está sendo parcelado / negociado
                      </label>
                      <input
                        type="text"
                        value={descricaoParcelamento}
                        onChange={e => setDescricaoParcelamento(e.target.value)}
                        placeholder="Ex: Parcelamento de saldo 2026 + Rematrícula 2027 autorizado pela Direção..."
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 600, boxSizing: 'border-box' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                          Valor Original (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={valorOriginalParcelamento}
                          onChange={e => onParcelamentoOriginalChange(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700, boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                          Desconto (%)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={descontoParcelamentoPct}
                          onChange={e => onParcelamentoDescontoChange(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700, boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 900, color: '#5b21b6', marginBottom: 4 }}>
                          Total Autorizado (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={valorAutorizadoParcelamento}
                          onChange={e => onParcelamentoAutorizadoChange(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '2px solid #c4b5fd', background: '#f5f3ff', fontSize: 14, fontWeight: 900, color: '#5b21b6', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                          Valor Entrada (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={entradaParcelamento}
                          onChange={e => setEntradaParcelamento(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700, boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                          Nº de Parcelas
                        </label>
                        <select
                          value={qtdParcelasEspecial}
                          onChange={e => setQtdParcelasEspecial(Number(e.target.value))}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 700, background: '#ffffff', boxSizing: 'border-box' }}
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18, 24].map(n => (
                            <option key={n} value={n}>{n}x parcelas</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                          Meio de Pagamento
                        </label>
                        <select
                          value={formaPagamentoParcelamento}
                          onChange={e => setFormaPagamentoParcelamento(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 700, background: '#ffffff', boxSizing: 'border-box' }}
                        >
                          {FORMAS_PAGAMENTO.map(fp => (
                            <option key={fp} value={fp}>{fp}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* BLOCO D: MATERIAL DIDÁTICO / APOSTILAS */}
              <div
                style={{
                  background: '#ffffff',
                  border: temMaterial ? '2px solid #fde68a' : '1px solid #e2e8f0',
                  borderRadius: 16,
                  padding: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, fontWeight: 900, color: '#92400e' }}>
                    <input
                      type="checkbox"
                      checked={temMaterial}
                      onChange={e => setTemMaterial(e.target.checked)}
                      style={{ width: 18, height: 18, accentColor: '#d97706' }}
                    />
                    📚 Material Didático / Apostilas / Taxas Extras
                  </label>

                  {temMaterial && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['fora_isaac', 'no_isaac'] as const).map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCanalMaterial(c)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 8,
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: 'pointer',
                            background: canalMaterial === c ? (c === 'no_isaac' ? '#7c3aed' : '#10b981') : '#f1f5f9',
                            color: canalMaterial === c ? '#ffffff' : '#475569',
                            border: 'none',
                          }}
                        >
                          {c === 'no_isaac' ? '🟣 Material No isaac' : '🟢 Material Fora do isaac (Escola)'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {temMaterial && (
                  <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                        Material / Apostila 2027
                      </label>
                      <select
                        value={descricaoMaterial}
                        onChange={e => {
                          const found = MATERIAIS_2027.find(m => m.nome === e.target.value)
                          setDescricaoMaterial(e.target.value)
                          if (found) {
                            setValorTabelaMaterial(found.valor.toFixed(2))
                            setValorAutorizadoMaterial(found.valor.toFixed(2))
                          }
                        }}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 700, background: '#ffffff', boxSizing: 'border-box' }}
                      >
                        {MATERIAIS_2027.map(m => (
                          <option key={m.id} value={m.nome}>{m.nome} ({fmtCurrency(m.valor)})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                        Valor Tabela (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={valorTabelaMaterial}
                        onChange={e => setValorTabelaMaterial(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700, boxSizing: 'border-box' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 900, color: '#92400e', marginBottom: 4 }}>
                        Valor Autorizado (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={valorAutorizadoMaterial}
                        onChange={e => setValorAutorizadoMaterial(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '2px solid #fde68a', background: '#fffbeb', fontSize: 13, fontWeight: 900, boxSizing: 'border-box' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                        Parcelas (até 10x)
                      </label>
                      <select
                        value={parcelasMaterial}
                        onChange={e => setParcelasMaterial(Number(e.target.value))}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 700, background: '#ffffff', boxSizing: 'border-box' }}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                          <option key={n} value={n}>{n}x parcelas</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* SEÇÃO 4: GOVERNANÇA, DIRETOR AUTORIZADOR E OBSERVAÇÕES */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 18,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={18} color="#2563eb" />
                4. Autorização da Direção, Status e Orientações para os Colaboradores
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#334155', marginBottom: 4 }}>
                    Autorizado por *
                  </label>
                  <input
                    type="text"
                    value={autorizadoPor}
                    onChange={e => setAutorizadoPor(e.target.value)}
                    placeholder="Ex: Diretor Geral"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 800, color: '#0f172a', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                    {['Diretor Geral', 'Direção Executiva', 'Direção Pedagógica'].map(dir => (
                      <button
                        key={dir}
                        type="button"
                        onClick={() => setAutorizadoPor(dir)}
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 6,
                          border: '1px solid #cbd5e1',
                          background: autorizadoPor === dir ? '#0f172a' : '#f8fafc',
                          color: autorizadoPor === dir ? '#ffffff' : '#475569',
                          cursor: 'pointer',
                        }}
                      >
                        {dir}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#334155', marginBottom: 4 }}>
                    Como foi autorizado
                  </label>
                  <select
                    value={meioAutorizacao}
                    onChange={e => setMeioAutorizacao(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 700, background: '#ffffff', boxSizing: 'border-box' }}
                  >
                    {MEIOS_AUTORIZACAO.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#334155', marginBottom: 4 }}>
                    Data da Autorização
                  </label>
                  <input
                    type="date"
                    value={dataAutorizacao}
                    onChange={e => setDataAutorizacao(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700, boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#334155', marginBottom: 4 }}>
                    Status Operacional
                  </label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as any)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 800, background: '#ffffff', boxSizing: 'border-box' }}
                  >
                    <option value="autorizado">⏳ Autorizado · Aguardando Lançamento</option>
                    <option value="lancado">🟣 Lançado no isaac / Sistema</option>
                    <option value="concluido">✅ Concluído · Matrícula Efetivada</option>
                    <option value="cancelado">❌ Cancelado / Expirado</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#334155', marginBottom: 4 }}>
                  📌 Observações e Orientações da Direção (visível em destaque para Secretaria e Financeiro)
                </label>
                <textarea
                  rows={3}
                  value={observacoesDirecao}
                  onChange={e => setObservacoesDirecao(e.target.value)}
                  placeholder="Ex: Diretor autorizou manter a mensalidade com 18% de desconto no isaac e parcelar a matrícula em 5x no cartão na secretaria até o dia 15/11..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#0f172a',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Rodapé de Ações */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 4 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '12px 22px',
                  borderRadius: 12,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 28px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: '#ffffff',
                  fontSize: 14,
                  fontWeight: 900,
                  cursor: isSubmitting ? 'wait' : 'pointer',
                  boxShadow: '0 8px 20px -4px rgba(37, 99, 235, 0.45)',
                }}
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={18} />}
                {isSubmitting ? 'Salvando no Sistema...' : editingItem ? 'Salvar Alterações da Negociação' : 'Confirmar & Publicar Negociação'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
