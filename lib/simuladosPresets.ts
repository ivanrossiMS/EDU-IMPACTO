export interface DisciplinaPresetItem {
  busca: string[]
  fallbackNome: string
  rotulo?: string
  area: 'Linguagens' | 'Ciências Humanas' | 'Ciências da Natureza' | 'Matemática'
}

export interface SeriePreset {
  id: 'fund2_8_9' | 'em_1_2' | 'em_3'
  titulo: string
  descricao: string
  seriesCorrespondentes: string[]
  cor: string
  disciplinas: DisciplinaPresetItem[]
}

export const AREA_CONFIG = {
  'Linguagens': {
    label: 'Linguagens',
    cor: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.12)',
    borda: 'rgba(245, 158, 11, 0.3)',
  },
  'Ciências da Natureza': {
    label: 'Ciências da Natureza (CN)',
    cor: '#10b981',
    bg: 'rgba(16, 185, 129, 0.12)',
    borda: 'rgba(16, 185, 129, 0.3)',
  },
  'Ciências Humanas': {
    label: 'Ciências Humanas (CH)',
    cor: '#3b82f6',
    bg: 'rgba(59, 130, 246, 0.12)',
    borda: 'rgba(59, 130, 246, 0.3)',
  },
  'Matemática': {
    label: 'Matemática',
    cor: '#8b5cf6',
    bg: 'rgba(139, 92, 246, 0.12)',
    borda: 'rgba(139, 92, 246, 0.3)',
  }
}

export const SIMULADOS_PRESETS: Record<string, SeriePreset> = {
  fund2_8_9: {
    id: 'fund2_8_9',
    titulo: '8º e 9º Ano',
    descricao: 'Ensino Fundamental II (Linguagens, Humanas e Natureza)',
    seriesCorrespondentes: ['8º Ano EF', '9º Ano EF'],
    cor: '#0ea5e9',
    disciplinas: [
      // Linguagens: LP/Inglês/Arte/Redação
      { busca: ['LP', 'Português', 'Língua Portuguesa'], fallbackNome: 'Português', rotulo: 'LP', area: 'Linguagens' },
      { busca: ['Inglês', 'Ingles'], fallbackNome: 'Inglês', rotulo: 'Inglês', area: 'Linguagens' },
      { busca: ['Arte', 'Artes'], fallbackNome: 'Arte', rotulo: 'Arte', area: 'Linguagens' },
      { busca: ['Redação', 'Redacao'], fallbackNome: 'Redação', rotulo: 'Redação', area: 'Linguagens' },
      // Ciências Humanas: História/Geografia
      { busca: ['História', 'Historia'], fallbackNome: 'História', rotulo: 'História', area: 'Ciências Humanas' },
      { busca: ['Geografia', 'Geogragia'], fallbackNome: 'Geografia', rotulo: 'Geografia', area: 'Ciências Humanas' },
      // Ciências da Natureza: Ciências/Ed. Física
      { busca: ['Ciências', 'Ciencias'], fallbackNome: 'Ciências', rotulo: 'Ciências', area: 'Ciências da Natureza' },
      { busca: ['Ed. Física', 'Educação Física', 'Ed Física', 'Educacao Fisica'], fallbackNome: 'Ed. Física', rotulo: 'Ed. Física', area: 'Ciências da Natureza' },
    ]
  },
  em_1_2: {
    id: 'em_1_2',
    titulo: '1ª e 2ª Série EM',
    descricao: 'Ensino Médio (Linguagens, CN, CH e Matemática)',
    seriesCorrespondentes: ['1ª Série EM', '2ª Série EM'],
    cor: '#8b5cf6',
    disciplinas: [
      // Linguagens: LP/Inglês/Literatura/Arte/Redação
      { busca: ['LP', 'Português', 'Língua Portuguesa'], fallbackNome: 'Português', rotulo: 'LP', area: 'Linguagens' },
      { busca: ['Inglês', 'Ingles'], fallbackNome: 'Inglês', rotulo: 'Inglês', area: 'Linguagens' },
      { busca: ['Literatura'], fallbackNome: 'Literatura', rotulo: 'Literatura', area: 'Linguagens' },
      { busca: ['Arte', 'Artes'], fallbackNome: 'Arte', rotulo: 'Arte', area: 'Linguagens' },
      { busca: ['Redação', 'Redacao'], fallbackNome: 'Redação', rotulo: 'Redação', area: 'Linguagens' },
      // CN: Biologia/Química/Física/Ed. Física
      { busca: ['Biologia'], fallbackNome: 'Biologia', rotulo: 'Biologia', area: 'Ciências da Natureza' },
      { busca: ['Química', 'Quimica'], fallbackNome: 'Química', rotulo: 'Química', area: 'Ciências da Natureza' },
      { busca: ['Física', 'Fisica'], fallbackNome: 'Física', rotulo: 'Física', area: 'Ciências da Natureza' },
      { busca: ['Ed. Física', 'Educação Física', 'Ed Física', 'Educacao Fisica'], fallbackNome: 'Ed. Física', rotulo: 'Ed. Física', area: 'Ciências da Natureza' },
      // CH: História/Geografia/Filosofia/Sociologia
      { busca: ['História', 'Historia'], fallbackNome: 'História', rotulo: 'História', area: 'Ciências Humanas' },
      { busca: ['Geografia', 'Geogragia'], fallbackNome: 'Geografia', rotulo: 'Geografia', area: 'Ciências Humanas' },
      { busca: ['Filosofia'], fallbackNome: 'Filosofia', rotulo: 'Filosofia', area: 'Ciências Humanas' },
      { busca: ['Sociologia'], fallbackNome: 'Sociologia', rotulo: 'Sociologia', area: 'Ciências Humanas' },
      // Matemática: Mat I e Mat II
      { busca: ['Matemática I', 'Mat I', 'Mat. I', 'Matematica I'], fallbackNome: 'Matemática I', rotulo: 'Mat I', area: 'Matemática' },
      { busca: ['Matemática II', 'Mat II', 'Mat. II', 'Matematica II'], fallbackNome: 'Matemática II', rotulo: 'Mat II', area: 'Matemática' },
    ]
  },
  em_3: {
    id: 'em_3',
    titulo: '3ª Série EM',
    descricao: 'Ensino Médio (Linguagens, CN com Bio I/II, CH com Humanidades e Matemática com Probabilidade)',
    seriesCorrespondentes: ['3ª Série EM'],
    cor: '#ec4899',
    disciplinas: [
      // Linguagens: LP/Inglês/Literatura/Arte/Redação
      { busca: ['LP', 'Português', 'Língua Portuguesa'], fallbackNome: 'Português', rotulo: 'LP', area: 'Linguagens' },
      { busca: ['Inglês', 'Ingles'], fallbackNome: 'Inglês', rotulo: 'Inglês', area: 'Linguagens' },
      { busca: ['Literatura'], fallbackNome: 'Literatura', rotulo: 'Literatura', area: 'Linguagens' },
      { busca: ['Arte', 'Artes'], fallbackNome: 'Arte', rotulo: 'Arte', area: 'Linguagens' },
      { busca: ['Redação', 'Redacao'], fallbackNome: 'Redação', rotulo: 'Redação', area: 'Linguagens' },
      // CN: Bio I/Bio II/Química/Física/Ed. Física
      { busca: ['Biologia I', 'Bio I', 'Bio. I', 'Biologia 1'], fallbackNome: 'Biologia I', rotulo: 'Bio I', area: 'Ciências da Natureza' },
      { busca: ['Biologia II', 'Bio II', 'Bio. II', 'Biologia 2'], fallbackNome: 'Biologia II', rotulo: 'Bio II', area: 'Ciências da Natureza' },
      { busca: ['Química', 'Quimica'], fallbackNome: 'Química', rotulo: 'Química', area: 'Ciências da Natureza' },
      { busca: ['Física', 'Fisica'], fallbackNome: 'Física', rotulo: 'Física', area: 'Ciências da Natureza' },
      { busca: ['Ed. Física', 'Educação Física', 'Ed Física', 'Educacao Fisica'], fallbackNome: 'Ed. Física', rotulo: 'Ed. Física', area: 'Ciências da Natureza' },
      // CH: História/Geografia/Humanidades
      { busca: ['História', 'Historia'], fallbackNome: 'História', rotulo: 'História', area: 'Ciências Humanas' },
      { busca: ['Geografia', 'Geogragia'], fallbackNome: 'Geografia', rotulo: 'Geografia', area: 'Ciências Humanas' },
      { busca: ['Humanidades'], fallbackNome: 'Humanidades', rotulo: 'Humanidades', area: 'Ciências Humanas' },
      // Matemática: Mat I/Mat II/Probabilidade e estatística
      { busca: ['Matemática I', 'Mat I', 'Mat. I', 'Matematica I'], fallbackNome: 'Matemática I', rotulo: 'Mat I', area: 'Matemática' },
      { busca: ['Matemática II', 'Mat II', 'Mat. II', 'Matematica II'], fallbackNome: 'Matemática II', rotulo: 'Mat II', area: 'Matemática' },
      { busca: ['Probabilidade e Estatística', 'Probabilidade e estatistica', 'Probabilidade', 'Estatística'], fallbackNome: 'Probabilidade e Estatística', rotulo: 'Probabilidade e estatística', area: 'Matemática' },
    ]
  }
}

function normalizeStr(s: string): string {
  if (!s) return ''
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

/**
 * Detecta o preset correspondente a partir das séries selecionadas.
 */
export function detectSeriePattern(series: string[]): 'fund2_8_9' | 'em_1_2' | 'em_3' | null {
  if (!series || series.length === 0) return null

  const has3EM = series.some(s => s.includes('3ª Série') || s.includes('3ª Serie'))
  if (has3EM) return 'em_3'

  const has1or2EM = series.some(s => s.includes('1ª Série') || s.includes('2ª Série') || s.includes('1ª Serie') || s.includes('2ª Serie'))
  if (has1or2EM) return 'em_1_2'

  const has8or9EF = series.some(s => s.includes('8º') || s.includes('9º') || s.includes('8°') || s.includes('9°'))
  if (has8or9EF) return 'fund2_8_9'

  return null
}

export interface PresetAreaGroup {
  area: keyof typeof AREA_CONFIG
  label: string
  cor: string
  bg: string
  borda: string
  disciplinas: DisciplinaPresetItem[]
}

/**
 * Agrupa as disciplinas de um preset por Área do Conhecimento mantendo a ordem natural do preset
 */
export function getPresetGroupsByArea(presetKey: 'fund2_8_9' | 'em_1_2' | 'em_3'): PresetAreaGroup[] {
  const preset = SIMULADOS_PRESETS[presetKey]
  if (!preset) return []

  const groupsMap = new Map<keyof typeof AREA_CONFIG, DisciplinaPresetItem[]>()

  preset.disciplinas.forEach(item => {
    if (!groupsMap.has(item.area)) {
      groupsMap.set(item.area, [])
    }
    groupsMap.get(item.area)!.push(item)
  })

  return Array.from(groupsMap.entries()).map(([area, items]) => ({
    area,
    label: AREA_CONFIG[area]?.label || area,
    cor: AREA_CONFIG[area]?.cor || '#8b5cf6',
    bg: AREA_CONFIG[area]?.bg || 'rgba(139, 92, 246, 0.12)',
    borda: AREA_CONFIG[area]?.borda || 'rgba(139, 92, 246, 0.3)',
    disciplinas: items
  }))
}

/**
 * Retorna todos os nomes fallback de um preset
 */
export function getPresetAllFallbackNomes(presetKey: 'fund2_8_9' | 'em_1_2' | 'em_3'): string[] {
  return SIMULADOS_PRESETS[presetKey]?.disciplinas.map(d => d.fallbackNome) || []
}

/**
 * Resolve e constrói a lista de atribuições com base no preset escolhido e na sub-seleção de disciplinas,
 * buscando no cadastro de disciplinas e associando o professor vinculado.
 */
export function buildAssignmentsFromPreset(
  presetKey: 'fund2_8_9' | 'em_1_2' | 'em_3',
  disciplinasDb: any[],
  professoresDb: any[],
  selectedFallbackNomes?: string[]
) {
  const preset = SIMULADOS_PRESETS[presetKey]
  if (!preset) return []

  const targetList = selectedFallbackNomes !== undefined
    ? preset.disciplinas.filter(d => selectedFallbackNomes.includes(d.fallbackNome))
    : preset.disciplinas

  return targetList.map((item, idx) => {
    // 1. Encontrar a disciplina no banco
    // Prioriza segmento 'Ens. Fund2/Médio' ou não 'Ens. Fundamental I'
    const match = disciplinasDb.find(d => {
      const normName = normalizeStr(d.nome)
      const matchesSearch = item.busca.some(b => normalizeStr(b) === normName)
      return matchesSearch && d.segmento !== 'Ens. Fundamental I'
    }) || disciplinasDb.find(d => {
      const normName = normalizeStr(d.nome)
      return item.busca.some(b => normalizeStr(b) === normName)
    })

    const disciplinaId = match ? match.id : ''
    const disciplinaNome = match ? match.nome : item.fallbackNome
    const qtdQuestoes = match?.quantidade_questoes || 10

    // 2. Encontrar professor vinculado
    let professorId = ''
    let professorNome = ''

    if (match) {
      let allowedProfIds: string[] = []
      if (Array.isArray(match.professores_ids)) {
        allowedProfIds = match.professores_ids
      } else if (typeof match.professores_ids === 'string') {
        try { allowedProfIds = JSON.parse(match.professores_ids) } catch {}
      } else if (match.id_professor) {
        allowedProfIds = [match.id_professor]
      }

      if (allowedProfIds.length > 0) {
        // Encontrar primeiro professor ativo correspondente
        const prof = professoresDb.find(p => allowedProfIds.includes(p.id))
        if (prof) {
          professorId = prof.id
          professorNome = prof.nome
        }
      }
    }

    return {
      id: `${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 6)}`,
      disciplinaId,
      disciplinaNome,
      professorId,
      professorNome,
      qtdQuestoes,
      area: item.area,
    }
  })
}
