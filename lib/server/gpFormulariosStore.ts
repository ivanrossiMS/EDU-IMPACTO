import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import {
  GPForm,
  GPFormResponse,
  SEED_GP_FORMS,
  DEFAULT_THEME_CONFIG,
  DEFAULT_SETTINGS_CONFIG,
} from '@/lib/gestao-pessoas/formulariosTypes'

const FORMS_CONFIG_KEY = 'gp_formularios_v1'
const RESPONSES_KEY_PREFIX = 'gp_form_respostas_'

export function isHrOrAdminUser(perfil?: string | null, cargo?: string | null): boolean {
  const p = String(perfil || '').trim().toLowerCase()
  const c = String(cargo || '').trim().toLowerCase()

  const nonAdminKeywords = [
    'auxiliar',
    'assistente',
    'estagiário',
    'estagiario',
    'operacional',
    'atendente',
    'recepcionista',
    'secretária',
    'secretaria',
    'professor',
    'professora',
  ]
  if (nonAdminKeywords.some(k => p.includes(k) || c.includes(k))) {
    return false
  }

  return (
    p.includes('admin') ||
    p.includes('master') ||
    p.includes('diret') ||
    p.includes('gestor') ||
    p.includes('rh') ||
    p.includes('recursos humanos') ||
    p.includes('gestao de pessoas') ||
    p.includes('gestão de pessoas') ||
    p.includes('psic') ||
    c.includes('admin') ||
    c.includes('master') ||
    c.includes('diret') ||
    c.includes('rh') ||
    c.includes('recursos humanos') ||
    c.includes('gestao de pessoas') ||
    c.includes('gestão de pessoas')
  )
}

export async function loadAllGPForms(): Promise<GPForm[]> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('configuracoes')
    .select('valor')
    .eq('chave', FORMS_CONFIG_KEY)
    .maybeSingle()

  if (error || !data || !Array.isArray(data.valor)) {
    // Seed initial forms if not yet created
    if (!error && (!data || data.valor === null)) {
      await saveAllGPForms(SEED_GP_FORMS)
    }
    return SEED_GP_FORMS
  }

  return (data.valor as GPForm[]).map(normalizeForm)
}

export async function saveAllGPForms(forms: GPForm[]): Promise<void> {
  const supabase = getAdminClient()
  const normalized = forms.map(normalizeForm)
  const { error } = await supabase
    .from('configuracoes')
    .upsert(
      {
        chave: FORMS_CONFIG_KEY,
        valor: normalized,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'chave' }
    )
  if (error) {
    throw new Error(error.message)
  }
}

export async function loadFormResponses(formId: string): Promise<GPFormResponse[]> {
  const supabase = getAdminClient()
  const key = `${RESPONSES_KEY_PREFIX}${formId}`
  const { data, error } = await supabase
    .from('configuracoes')
    .select('valor')
    .eq('chave', key)
    .maybeSingle()

  if (error || !data || !Array.isArray(data.valor)) {
    return []
  }
  return data.valor as GPFormResponse[]
}

export async function loadMultipleFormResponsesMap(
  formIds: string[]
): Promise<Record<string, GPFormResponse[]>> {
  if (formIds.length === 0) return {}
  const supabase = getAdminClient()
  const keys = formIds.map(id => `${RESPONSES_KEY_PREFIX}${id}`)
  const { data, error } = await supabase
    .from('configuracoes')
    .select('chave, valor')
    .in('chave', keys)

  const result: Record<string, GPFormResponse[]> = {}
  for (const id of formIds) {
    result[id] = []
  }
  if (!error && Array.isArray(data)) {
    for (const row of data) {
      const fId = String(row.chave || '').replace(RESPONSES_KEY_PREFIX, '')
      if (fId && Array.isArray(row.valor)) {
        result[fId] = row.valor as GPFormResponse[]
      }
    }
  }
  return result
}

export async function saveFormResponses(
  formId: string,
  responses: GPFormResponse[]
): Promise<void> {
  const supabase = getAdminClient()
  const key = `${RESPONSES_KEY_PREFIX}${formId}`
  const { error } = await supabase
    .from('configuracoes')
    .upsert(
      {
        chave: key,
        valor: responses,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'chave' }
    )
  if (error) {
    throw new Error(error.message)
  }
}

export function normalizeForm(raw: Partial<GPForm>): GPForm {
  return {
    id: raw.id || `form-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: raw.title || 'Formulário sem título',
    subtitle: raw.subtitle || '',
    description: raw.description || '',
    instructionMedia: Array.isArray(raw.instructionMedia) ? raw.instructionMedia : [],
    category: raw.category || 'Pesquisa Interna',
    status: raw.status || 'ativo',
    sections:
      Array.isArray(raw.sections) && raw.sections.length > 0
        ? raw.sections.map(sec => ({
            ...sec,
            media: Array.isArray(sec.media) ? sec.media : [],
            fields: Array.isArray(sec.fields)
              ? sec.fields.map(f => ({
                  ...f,
                  media: Array.isArray(f.media) ? f.media : [],
                  optionImages: f.optionImages || {},
                }))
              : [],
          }))
        : [
            {
              id: 'sec-1',
              title: 'Seção Principal',
              description: '',
              media: [],
              fields: [],
            },
          ],
    theme: {
      ...DEFAULT_THEME_CONFIG,
      ...(raw.theme || {}),
      headerStyle:
        raw.theme?.headerImageUrl && raw.theme.headerImageUrl.trim()
          ? 'banner_image'
          : raw.theme?.headerStyle || 'gradient',
    },
    settings: {
      ...DEFAULT_SETTINGS_CONFIG,
      ...(raw.settings || {}),
      publicLink: Boolean(raw.settings?.publicLink),
      allowAccessWithoutModule: Boolean(raw.settings?.allowAccessWithoutModule),
    },
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
    createdBy: raw.createdBy || 'Gestão de Pessoas',
    respostasCount: typeof raw.respostasCount === 'number' ? raw.respostasCount : 0,
  }
}

export function computeQuizScore(
  form: GPForm,
  answers: Record<string, any>
): GPFormResponse['quizScore'] | undefined {
  if (!form.settings?.isQuizMode) return undefined

  let totalPoints = 0
  let earnedPoints = 0

  for (const sec of form.sections || []) {
    for (const field of sec.fields || []) {
      const pts = Number(field.quizPoints || 0)
      if (pts <= 0 || field.quizCorrectAnswer === undefined || field.quizCorrectAnswer === '') {
        continue
      }
      totalPoints += pts
      const userAns = answers[field.id]
      if (Array.isArray(field.quizCorrectAnswer)) {
        const expected = field.quizCorrectAnswer.map(s => String(s).trim().toLowerCase()).sort()
        const actual = Array.isArray(userAns)
          ? userAns.map(s => String(s).trim().toLowerCase()).sort()
          : [String(userAns || '').trim().toLowerCase()]
        if (JSON.stringify(expected) === JSON.stringify(actual)) {
          earnedPoints += pts
        }
      } else {
        const expected = String(field.quizCorrectAnswer).trim().toLowerCase()
        const actual = String(userAns ?? '').trim().toLowerCase()
        if (expected && actual === expected) {
          earnedPoints += pts
        }
      }
    }
  }

  if (totalPoints === 0) return undefined
  const percent = Math.round((earnedPoints / totalPoints) * 100)
  const passing = Number(form.settings.passingScorePercent ?? 70)
  return {
    earned: earnedPoints,
    total: totalPoints,
    percent,
    passed: percent >= passing,
  }
}
