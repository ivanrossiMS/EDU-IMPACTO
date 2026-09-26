import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const DEFAULT_PROVA_INSTRUCOES = `Atenção às orientações:
• Deve ser realizada exclusivamente a caneta azul ou preta. • Preencha corretamente nome completo. • Não é permitido o uso de corretivo, celular ou outros dispositivos. • Respostas ilegíveis ou com rasuras poderão ser desconsideradas.`

export function formatCurrency(value: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value)
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100)
}

export function formatDate(date: string | Date | null | undefined, style: 'short' | 'long' | 'relative' = 'short'): string {
  if (!date) return '—'
  
  let d: Date
  if (typeof date === 'string') {
    if (date.includes('/')) return date; // Already dd/mm/yyyy
    const ds = (date.length === 10 && date.includes('-')) ? `${date}T12:00:00` : date
    d = new Date(ds)
  } else {
    d = date
  }
  if (style === 'relative') {
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 1) return 'agora'
    if (mins < 60) return `${mins}min atrás`
    if (hours < 24) return `${hours}h atrás`
    if (days < 7) return `${days}d atrás`
    return d.toLocaleDateString('pt-BR')
  }
  if (style === 'long') {
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  }
  return d.toLocaleDateString('pt-BR')
}

/**
 * Converte qualquer string de data para o formato brasileiro DD/MM/YYYY.
 * Aceita: YYYY-MM-DD, YYYY-MM-DDTHH:mm:ss (ISO), DD/MM/YYYY (passthrough).
 * Uso seguro para células de tabela sem risco de erro de timezone.
 */
export function fmtIsoDate(v: string | null | undefined): string {
  if (!v) return '—'
  const s = String(v)
  // Já está em DD/MM/YYYY
  if (s.includes('/')) return s.length >= 10 ? s.slice(0, 10) : s
  // ISO: YYYY-MM-DD ou YYYY-MM-DDTHH:mm
  const clean = s.length > 10 ? s.slice(0, 10) : s
  const parts = clean.split('-')
  if (parts.length !== 3) return s
  const [y, m, d] = parts
  return `${d}/${m}/${y}`
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  let d: Date
  if (typeof date === 'string') {
    const ds = (date.length === 10 && date.includes('-')) ? `${date}T12:00:00` : date
    d = new Date(ds)
  } else {
    d = date
  }
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()
}

/**
 * Formata o nome do professor para exibição nos cabeçalhos das provas (Ex: "Ivan R.", "Wennsllen R.").
 * Pega o primeiro nome com o sobrenome abreviado.
 */
export function formatProfessorHeaderName(nome: string): string {
  if (!nome || !nome.trim()) return ''
  if (nome.includes(',')) {
    return nome.split(',').map(n => formatProfessorHeaderName(n)).filter(Boolean).join(', ')
  }

  const parts = nome.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''

  const firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase()

  if (parts.length === 1) return firstName

  const preps = new Set(['de', 'da', 'do', 'dos', 'das', 'e'])
  let lastPart = parts[parts.length - 1]
  for (let i = parts.length - 1; i >= 1; i--) {
    if (!preps.has(parts[i].toLowerCase())) {
      lastPart = parts[i]
      break
    }
  }

  const lastInitial = lastPart.charAt(0).toUpperCase()
  return `${firstName} ${lastInitial}.`
}

/**
 * Retorna apenas o primeiro e segundo nome de uma pessoa.
 * Preserva preposições entre nomes caso o segundo termo seja preposição (ex: "Juliane de Fátima" ou "João da Silva").
 * Exemplo: "Maria Auxiliadora de Araujo Honorio" -> "Maria Auxiliadora"
 */
export function formatFirstAndSecondName(rawName?: string | null): string {
  if (!rawName || typeof rawName !== 'string') return ''
  const trimmed = rawName.trim()
  if (!trimmed) return ''

  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length <= 2) return trimmed

  const prepositions = new Set(['de', 'da', 'do', 'dos', 'das', 'e', "d'"])

  if (prepositions.has(parts[1].toLowerCase()) && parts[2]) {
    return `${parts[0]} ${parts[1]} ${parts[2]}`
  }

  return `${parts[0]} ${parts[1]}`
}

export function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

export function getRiskColor(risk: 'alto' | 'medio' | 'baixo' | string): string {
  switch (risk) {
    case 'alto': return '#f87171'
    case 'medio': return '#fbbf24'
    case 'baixo': return '#34d399'
    default: return '#6b7280'
  }
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    'ativo': '#34d399', 'active': '#34d399',
    'inativo': '#6b7280', 'inactive': '#6b7280',
    'pendente': '#fbbf24', 'pending': '#fbbf24',
    'pago': '#34d399', 'paid': '#34d399',
    'atrasado': '#f87171', 'overdue': '#f87171',
    'cancelado': '#ef4444', 'cancelled': '#ef4444',
    'transferido': '#60a5fa',
    'matriculado': '#34d399',
  }
  return map[status.toLowerCase()] || '#6b7280'
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

export function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

export const SERIES_LABELS: Record<string, string> = {
  'EI': 'Educação Infantil',
  'EF1': 'Fundamental I',
  'EF2': 'Fundamental II',
  'EM': 'Ensino Médio',
  'EJA': 'EJA',
}

export function formatPhone(value: string): string {
  if (!value) return ''
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 2) {
    return digits.length > 0 ? `(${digits}` : ''
  }
  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)})${digits.slice(2)}`
  }
  return `(${digits.slice(0, 2)})${digits.slice(2, 7)}-${digits.slice(7, 11)}`
}

export function getDerivedStatus(item: any, type: 'prova' | 'simulado' | 'redacao'): string {
  if (!item) return 'aguardando'
  // Se já foi publicado, esse status prevalece (pode ser forçado pelo coordenador)
  if (item.status === 'publicado') return 'publicado'
  
  const reqs = type === 'prova' ? item.provas_upload_requisicoes 
             : type === 'simulado' ? item.simulados_upload_requisicoes
             : item.redacao_upload_requisicoes;
             
  if (!reqs || reqs.length === 0) return item.status || 'aguardando'
  
  const allQs = Array.isArray(item.questoes_json) ? item.questoes_json : []

  // Verifica se todas as requisições foram concluídas ou aprovadas
  const allApproved = reqs.every((r: any) => r.status === 'aprovado' || r.status === 'concluido' || r.status === 'publicado')
  if (allApproved) return 'aprovado'

  // Verifica se alguma requisição foi expressamente rejeitada
  if (reqs.some((r: any) => r.status === 'rejeitado' || r.status === 'reprovado')) {
    return 'aguardando'
  }

  // Verifica se cada requisição está enviada ou possui questões cadastradas
  const isReqDoneOrUploaded = (r: any) => {
    const hasQs = allQs.length > 0 && allQs.some((q: any) => isQuestionForRequisicao(q, r, reqs, true))
    if (r.status === 'aprovado' || r.status === 'concluido' || r.status === 'publicado') {
      return true
    }
    if (hasQs) {
      return true
    }
    return false
  }

  // Se todas as requisições já enviaram ou possuem questões
  if (reqs.every(isReqDoneOrUploaded)) {
    return 'em_revisao'
  }

  // Se pelo menos uma enviou ou tem questões
  if (reqs.some(isReqDoneOrUploaded)) {
    return 'em_revisao'
  }

  return 'aguardando'
}

/**
 * Determina com precisão e robustez se um item é um texto de apoio.
 * Textos de apoio não são questões reais: não possuem alternativas nem gabarito,
 * não recebem numeração de questão e NÃO devem ser exibidos nem somados como questão nos gabaritos.
 */
export function isTextoApoio(q: any): boolean {
  if (!q) return false
  return Boolean(
    q.tipo_questao === 'texto_apoio' ||
    q.is_texto_apoio ||
    q.isTextoApoio ||
    q.tipo === 'texto_apoio' ||
    q.tipo === 'texto' ||
    q.numero === 0
  )
}

/**
 * Determina com precisão e robustez se uma questão pertence a uma requisição específica.
 * Suporta simulados adaptados/duplicados onde os IDs das requisições mudaram,
 * itens com requisição única, correspondência por professor único, e disciplina.
 */
export function isQuestionForRequisicao(
  q: any,
  req: any,
  allReqs: any[] = [],
  excludeTextoApoio: boolean = false
): boolean {
  if (!q || !req) return false

  // Se solicitado excluir textos de apoio (ex: contagem de questões)
  if (excludeTextoApoio && isTextoApoio(q)) {
    return false
  }

  // 1. Match direto e exato pelo ID da requisição
  if (q.id_requisicao && req.id && q.id_requisicao === req.id) {
    return true
  }

  // 2. Se o simulado/prova possui apenas 1 requisição no total, todas as questões pertencem a ela!
  if (Array.isArray(allReqs) && allReqs.length === 1) {
    if (!req.id || allReqs[0].id === req.id) {
      return true
    }
  }

  // 3. Se q.id_requisicao aponta explicitamente para OUTRA requisição válida deste mesmo item:
  if (
    q.id_requisicao &&
    Array.isArray(allReqs) &&
    allReqs.some((r: any) => r.id === q.id_requisicao && r.id !== req.id)
  ) {
    return false
  }

  const normalizeStr = (s: string) =>
    (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()

  // 4. Correspondência por Disciplina (ID ou Nome normalizado)
  const qDiscId = q.id_disciplina || q.disciplina_id
  const reqDiscId = req.id_disciplina
  const discIdMatch = Boolean(qDiscId && reqDiscId && qDiscId === reqDiscId)

  const qDiscName = normalizeStr(q.disciplina_nome || q.disciplina)
  const reqDiscName = normalizeStr(req.disciplina_nome)

  const discNameMatch = Boolean(
    qDiscName &&
    reqDiscName &&
    (qDiscName === reqDiscName ||
      qDiscName.includes(reqDiscName) ||
      reqDiscName.includes(qDiscName))
  )

  const discMatch = discIdMatch || discNameMatch
  const hasDiscOnQuestion = Boolean(qDiscId || qDiscName)

  // 5. Correspondência por Professor (ID ou Nome normalizado)
  const qProfId = q.id_professor
  const reqProfId = req.id_professor
  const profIdMatch = Boolean(qProfId && reqProfId && qProfId === reqProfId)

  const qProfName = normalizeStr(q.professor_nome)
  const reqProfName = normalizeStr(req.professor_nome)

  const profNameMatch = Boolean(
    qProfName &&
    reqProfName &&
    (qProfName === reqProfName ||
      qProfName.includes(reqProfName) ||
      reqProfName.includes(qProfName))
  )

  const profMatch = profIdMatch || profNameMatch
  const hasProfOnQuestion = Boolean(qProfId || qProfName)

  // Se disciplina e professor batem com precisão
  if (discMatch && profMatch) {
    return true
  }

  // Se a questão possui professor e bate com esta requisição:
  if (profMatch) {
    // Se a questão também possui disciplina explícita que bate com outra requisição deste mesmo simulado:
    if (hasDiscOnQuestion && !discMatch) {
      const matchesAnotherReqDisc = Array.isArray(allReqs) && allReqs.some((r: any) => {
        if (r.id === req.id) return false
        const rDId = r.id_disciplina
        const rDName = normalizeStr(r.disciplina_nome)
        return (qDiscId && rDId && qDiscId === rDId) || (qDiscName && rDName && (qDiscName === rDName || qDiscName.includes(rDName) || rDName.includes(qDiscName)))
      })
      if (matchesAnotherReqDisc) return false
    }

    // Se este professor não possui outra requisição concorrente neste simulado:
    const otherReqsSameProf = Array.isArray(allReqs)
      ? allReqs.filter((r: any) => {
          if (r.id === req.id) return false
          const rPId = r.id_professor
          const rPName = normalizeStr(r.professor_nome)
          return (qProfId && rPId && qProfId === rPId) || (qProfName && rPName && (qProfName === rPName || qProfName.includes(rPName) || rPName.includes(qProfName)))
        })
      : []

    if (otherReqsSameProf.length === 0) {
      return true
    }
  }

  // Se a questão possui disciplina e bate com esta requisição:
  if (discMatch) {
    if (hasProfOnQuestion && !profMatch) {
      const matchesAnotherReqProf = Array.isArray(allReqs) && allReqs.some((r: any) => {
        if (r.id === req.id) return false
        const rPId = r.id_professor
        const rPName = normalizeStr(r.professor_nome)
        return (qProfId && rPId && qProfId === rPId) || (qProfName && rPName && (qProfName === rPName || qProfName.includes(rPName) || rPName.includes(qProfName)))
      })
      if (matchesAnotherReqProf) return false
    }

    const otherReqsSameDisc = Array.isArray(allReqs)
      ? allReqs.filter((r: any) => {
          if (r.id === req.id) return false
          const rDId = r.id_disciplina
          const rDName = normalizeStr(r.disciplina_nome)
          return (reqDiscId && rDId === reqDiscId) || (qDiscName && rDName === qDiscName)
        })
      : []

    if (otherReqsSameDisc.length === 0) {
      return true
    }
  }

  // Se a questão aponta explicitamente para outro professor válido:
  if (qProfId && Array.isArray(allReqs) && allReqs.some((r: any) => r.id !== req.id && r.id_professor === qProfId)) {
    return false
  }

  return false
}

/**
 * Localiza o arquivo original (.docx) associado à requisição ativa,
 * com suporte a requisições únicas e simulados adaptados.
 */
export function isFileForRequisicao(a: any, req: any, allReqs: any[] = []): boolean {
  if (!a || !req) return false
  if (a.id_requisicao && a.id_requisicao === req.id) return true
  if (Array.isArray(allReqs) && allReqs.length === 1) {
    if (!req.id || allReqs[0].id === req.id) return true
  }
  if (
    a.id_requisicao &&
    Array.isArray(allReqs) &&
    allReqs.some((r: any) => r.id === a.id_requisicao && r.id !== req.id)
  ) {
    return false
  }

  const normalizeStr = (s: string) =>
    (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()

  const discMatch =
    (a.id_disciplina && req.id_disciplina && a.id_disciplina === req.id_disciplina) ||
    (normalizeStr(a.disciplina_nome) && normalizeStr(req.disciplina_nome) &&
      normalizeStr(a.disciplina_nome) === normalizeStr(req.disciplina_nome))

  const profMatch = Boolean(
    (!a.id_professor && !a.professor_nome) ||
    (a.id_professor && req.id_professor && a.id_professor === req.id_professor) ||
    (normalizeStr(a.professor_nome) && normalizeStr(req.professor_nome) &&
      normalizeStr(a.professor_nome) === normalizeStr(req.professor_nome))
  )

  if (discMatch && profMatch) return true

  if (a.id_professor && req.id_professor && a.id_professor === req.id_professor) {
    const otherSameProf = Array.isArray(allReqs) && allReqs.some((r: any) => r.id !== req.id && r.id_professor === a.id_professor)
    if (!otherSameProf) return true
  }

  if (discMatch && Array.isArray(allReqs)) {
    const otherSameDisc = allReqs.some((r: any) => r.id !== req.id && ((req.id_disciplina && r.id_disciplina === req.id_disciplina) || normalizeStr(r.disciplina_nome) === normalizeStr(req.disciplina_nome)))
    if (!otherSameDisc) return true
  }

  return false
}

/**
 * Valida se a string fornecida representa uma foto de aluno válida (base64 ou URL real).
 * Rejeita strings vazias, base64 vazios ("data:image/jpeg;base64,"), respostas JSON de erro da catraca e avatares SVG mockados.
 */
export function isValidStudentPhoto(foto: string | null | undefined): boolean {
  if (!foto || typeof foto !== 'string') return false
  const trimmed = foto.trim()
  if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined' || trimmed === '""') return false
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/') || trimmed.startsWith('blob:')) {
    return true
  }
  if (trimmed === 'data:image/jpeg;base64,') return false
  if (trimmed.startsWith('data:image/svg+xml')) return false
  // Rejeita JSONs de erro da catraca codificados em base64 (começam com ey... {"... ou e3... {})
  if (trimmed.startsWith('data:image/jpeg;base64,ey') || trimmed.startsWith('data:image/jpeg;base64,e3')) return false
  if (trimmed.startsWith('data:image/png;base64,ey') || trimmed.startsWith('data:image/png;base64,e3')) return false
  if (trimmed.length < 200) return false
  return true
}

export async function downloadOriginalFile(url: string, filename?: string) {
  if (!url) return
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const blobUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename || 'arquivo_original.docx'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(blobUrl)
  } catch (err) {
    console.error('Erro no download:', err)
    window.open(url, '_blank')
  }
}

/**
 * Normaliza questões onde as alternativas possuem tags [IMAGEM N] ou onde as imagens
 * pertencem às alternativas mas ficaram retidas em q.imagens.
 * Transfere a imagem para alt.imagem_url, limpa o alt.text e remove de q.imagens
 * para evitar que sejam renderizadas no enunciado da questão.
 */
export function normalizeQuestionImages(q: any): any {
  if (!q || !Array.isArray(q.alternativas) || q.alternativas.length === 0) {
    return q
  }

  const imagens = Array.isArray(q.imagens) ? [...q.imagens] : []
  let changed = false
  const usedImageIndices = new Set<number>()

  const updatedAlternativas = q.alternativas.map((alt: any) => {
    let altText = alt.text || ''
    let altImgUrl = alt.imagem_url

    const match = altText.match(/\[IMAGEM\s+(\d+)\]/i)
    if (match) {
      const imgNum = parseInt(match[1], 10)
      const imgIdx = imgNum - 1
      if (imgIdx >= 0 && imgIdx < imagens.length) {
        const rawImg = imagens[imgIdx]
        const src = typeof rawImg === 'string' ? rawImg : rawImg?.src
        if (src) {
          const hashIdx = src.indexOf('#')
          const baseSrc = hashIdx >= 0 ? src.substring(0, hashIdx) : src
          const hashStr = hashIdx >= 0 ? src.substring(hashIdx + 1) : ''
          const params = new URLSearchParams(hashStr)
          if (!params.has('w')) params.set('w', '100')
          if (params.get('a') === 'right') params.delete('a')
          const finalHash = params.toString()
          altImgUrl = finalHash ? `${baseSrc}#${finalHash}` : baseSrc

          altText = altText
            .replace(/\[IMAGEM\s+\d+\]/gi, '')
            .replace(/<\/?(?:b|strong|i|em|span|p|div)\b[^>]*>/gi, '')
            .trim()

          usedImageIndices.add(imgIdx)
          changed = true
        }
      }
    }

    return {
      ...alt,
      text: altText,
      ...(altImgUrl ? { imagem_url: altImgUrl } : {})
    }
  })

  // Fallback: se nenhuma alternativa tinha [IMAGEM N], mas todas têm texto vazio,
  // q.imagens tem a mesma quantidade de alternativas e enunciado não referencia imagens
  if (!changed && usedImageIndices.size === 0 && imagens.length > 0 && imagens.length === q.alternativas.length) {
    const allAltsEmpty = q.alternativas.every((a: any) => !a.text || !a.text.trim())
    const enunciadoHasImages = (q.enunciado || '').includes('[IMAGEM')
    const altsAlreadyHaveImages = q.alternativas.some((a: any) => a.imagem_url)
    if (allAltsEmpty && !enunciadoHasImages && !altsAlreadyHaveImages) {
      const remappedAlts = q.alternativas.map((alt: any, i: number) => {
        const rawImg = imagens[i]
        const src = typeof rawImg === 'string' ? rawImg : rawImg?.src
        const hashIdx = src.indexOf('#')
        const baseSrc = hashIdx >= 0 ? src.substring(0, hashIdx) : src
        const hashStr = hashIdx >= 0 ? src.substring(hashIdx + 1) : ''
        const params = new URLSearchParams(hashStr)
        if (!params.has('w')) params.set('w', '100')
        if (params.get('a') === 'right') params.delete('a')
        const finalHash = params.toString()
        const finalUrl = finalHash ? `${baseSrc}#${finalHash}` : baseSrc

        return {
          ...alt,
          text: '',
          imagem_url: finalUrl
        }
      })
      return {
        ...q,
        imagens: [],
        alternativas: remappedAlts
      }
    }
  }

  if (changed) {
    const oldToNewIndex = new Map<number, number>()
    const newImagens: any[] = []
    imagens.forEach((img, oldIdx) => {
      if (!usedImageIndices.has(oldIdx)) {
        oldToNewIndex.set(oldIdx, newImagens.length)
        newImagens.push(img)
      }
    })

    let newEnunciado = q.enunciado || ''
    if (newImagens.length !== imagens.length) {
      newEnunciado = newEnunciado.replace(/\[IMAGEM\s+(\d+)\]/gi, (match: string, numStr: string) => {
        const oldIdx = parseInt(numStr, 10) - 1
        if (oldToNewIndex.has(oldIdx)) {
          return `[IMAGEM ${oldToNewIndex.get(oldIdx)! + 1}]`
        }
        return match
      })
    }

    return {
      ...q,
      enunciado: newEnunciado,
      imagens: newImagens,
      alternativas: updatedAlternativas
    }
  }

  return q
}

export function normalizeQuestoesList(questoes: any[]): any[] {
  if (!Array.isArray(questoes)) return []
  return questoes.map(q => normalizeQuestionImages(q))
}

/**
 * Extrai a letra da alternativa correta com máxima resiliência:
 * checa alt.correct, alt.eh_correta, alt.correta, alt.is_correta, alt.isCorrect,
 * checa simulados_alternativas e fallback em q.gabarito.
 */
export function getQuestionCorrectAnswer(q: any): string {
  if (!q) return '?'

  // 1. Alternativas em formato array de objetos (questoes_json)
  if (Array.isArray(q.alternativas) && q.alternativas.length > 0) {
    const correctAlt = q.alternativas.find((a: any) =>
      a.correct === true || a.correct === 'true' ||
      a.eh_correta === true || a.eh_correta === 'true' ||
      a.correta === true || a.correta === 'true' ||
      a.is_correta === true || a.is_correta === 'true' ||
      a.isCorrect === true || a.isCorrect === 'true'
    )
    if (correctAlt) {
      const l = correctAlt.letter || correctAlt.letra
      if (l && typeof l === 'string' && l.trim()) {
        return l.trim().toUpperCase()
      }
    }
  }

  // 2. simulados_alternativas (se vier de relacionamento SQL do Supabase)
  if (Array.isArray(q.simulados_alternativas) && q.simulados_alternativas.length > 0) {
    const correctAlt = q.simulados_alternativas.find((a: any) =>
      a.correct === true || a.correct === 'true' ||
      a.eh_correta === true || a.eh_correta === 'true' ||
      a.correta === true || a.correta === 'true'
    )
    if (correctAlt) {
      const l = correctAlt.letra || correctAlt.letter
      if (l && typeof l === 'string' && l.trim()) {
        return l.trim().toUpperCase()
      }
    }
  }

  // 3. Campo gabarito direto na questão
  if (q.gabarito && typeof q.gabarito === 'string' && q.gabarito.trim()) {
    const g = q.gabarito.trim().toUpperCase()
    if (/^[A-Z]$/.test(g)) {
      return g
    }
  }

  // 4. Fallbacks adicionais
  const fallback = q.resposta_correta || q.resposta || q.gabarito_oficial || q.correta
  if (fallback && typeof fallback === 'string' && fallback.trim()) {
    const f = fallback.trim().toUpperCase()
    if (/^[A-Z]$/.test(f)) {
      return f
    }
  }

  return '?'
}

/**
 * Retorna as questões do simulado ordenadas e numeradas com fidelidade absoluta
 * à impressão oficial do simulado (Estúdio de Edição / PaginationEngine):
 * - Ordena requisições conforme config_estudio.ordem_requisicoes ou ordem_disciplinas.
 * - Mapeia as questões por requisição/disciplina via isQuestionForRequisicao.
 * - Inclui eventuais questões órfãs ao final.
 * - Filtra questões marcadas como excluídas (q.excluida ou config_estudio.questoes_excluidas).
 * - Numera sequencialmente 1..N (textos de apoio recebem numero 0).
 */
export function getSimuladoPrintOrderedQuestoes(
  simuladoData: any,
  rawReqs?: any[]
): any[] {
  if (!simuladoData) return []

  const allQuestions = Array.isArray(simuladoData.questoes_json)
    ? normalizeQuestoesList(simuladoData.questoes_json)
    : []

  if (allQuestions.length === 0) return []

  // 1. Coleta e ordena as requisições de acordo com a configuração salva do estúdio
  let reqs = Array.isArray(rawReqs) && rawReqs.length > 0
    ? [...rawReqs]
    : (Array.isArray(simuladoData.simulados_upload_requisicoes) ? [...simuladoData.simulados_upload_requisicoes] : [])

  const configEstudio = simuladoData.config_estudio || {}
  const savedOrder = Array.isArray(configEstudio.ordem_requisicoes) ? configEstudio.ordem_requisicoes : []
  const savedDiscOrder = Array.isArray(configEstudio.ordem_disciplinas) ? configEstudio.ordem_disciplinas : []

  if (savedOrder.length > 0) {
    reqs.sort((a: any, b: any) => {
      const idxA = savedOrder.indexOf(a.id)
      const idxB = savedOrder.indexOf(b.id)
      if (idxA !== -1 && idxB !== -1) return idxA - idxB
      if (idxA !== -1) return -1
      if (idxB !== -1) return 1
      return 0
    })
  } else if (savedDiscOrder.length > 0) {
    reqs.sort((a: any, b: any) => {
      const idxA = savedDiscOrder.indexOf(a.id_disciplina)
      const idxB = savedDiscOrder.indexOf(b.id_disciplina)
      if (idxA !== -1 && idxB !== -1) return idxA - idxB
      if (idxA !== -1) return -1
      if (idxB !== -1) return 1
      return 0
    })
  }

  // 2. Ordena as questões exatamente como o motor de impressão de simulados
  let orderedQuestions: any[] = []
  const matchedIds = new Set<string>()

  if (reqs.length > 0) {
    orderedQuestions = reqs.flatMap((req: any) => {
      const matching = allQuestions.filter((q: any) => isQuestionForRequisicao(q, req, reqs, false))
      const discName = req.disciplina_nome || req.simulados_disciplinas?.nome || ''
      return matching.map((q: any) => {
        const idKey = q._internalId || q.id || `${q.numero}-${(q.enunciado || '').slice(0, 20)}`
        matchedIds.add(idKey)
        return {
          ...q,
          id_requisicao: req.id,
          id_disciplina: req.id_disciplina || q.id_disciplina,
          disciplina_nome: q.disciplina_nome || discName,
          disciplina: q.disciplina || q.disciplina_nome || discName,
          id_professor: req.id_professor || q.id_professor,
          professor_nome: req.professor_nome || q.professor_nome,
        }
      })
    })

    // Adiciona eventuais questões não associadas a nenhuma requisição
    const unassigned = allQuestions.filter((q: any) => {
      const idKey = q._internalId || q.id || `${q.numero}-${(q.enunciado || '').slice(0, 20)}`
      return !matchedIds.has(idKey)
    })
    orderedQuestions = [...orderedQuestions, ...unassigned]
  } else {
    orderedQuestions = [...allQuestions]
  }

  // 3. Filtra questões excluídas pelo usuário
  const excludedIds = new Set<string>(
    Array.isArray(configEstudio.questoes_excluidas) ? configEstudio.questoes_excluidas : []
  )

  const activeQuestions = orderedQuestions.filter((q: any) => {
    if (q.excluida === true) return false
    const idKey = q._internalId || q.id
    if (idKey && excludedIds.has(String(idKey))) return false
    return true
  })

  // 4. Numera sequencialmente idêntico ao A4 da impressão
  let numCounter = 1
  return activeQuestions.map((q: any) => {
    const isApoio = isTextoApoio(q)
    return {
      ...q,
      numero: isApoio ? 0 : numCounter++
    }
  })
}

