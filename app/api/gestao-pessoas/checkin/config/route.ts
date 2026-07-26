import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const DEFAULT_OPTIONS = ['Nada', 'Pouco', 'Médio', 'Muito', 'Totalmente']

const DEFAULT_CONFIG = {
  id: 'default',
  ativo: true,
  frequencia_dias: 7,
  titulo_modal: 'Check-in de Bem-Estar',
  subtitulo_modal: 'Acompanhamento Semanal',
  pergunta_emocao: 'Como foi essa sua semana no ambiente de trabalho?',
  emocoes: [
    { label: 'Muito bem', emoji: '🙂', color: '#10b981' },
    { label: 'Bem', emoji: '😊', color: '#34d399' },
    { label: 'Regular', emoji: '😐', color: '#fbbf24' },
    { label: 'Cansado', emoji: '😟', color: '#f87171' },
    { label: 'Precisando conversar', emoji: '😞', color: '#ef4444' }
  ],
  motivos: ['Sobrecarga', 'Conflitos', 'Problemas pessoais', 'Dificuldade com equipe', 'Outro'],
  perguntas_burnout: [
    { id: 'q1', pergunta: 'Estou dormindo bem?', invertida: false, opcoes: DEFAULT_OPTIONS },
    { id: 'q2', pergunta: 'Tenho energia para trabalhar?', invertida: false, opcoes: DEFAULT_OPTIONS },
    { id: 'q3', pergunta: 'Tenho sentido ansiedade?', invertida: true, opcoes: DEFAULT_OPTIONS },
    { id: 'q4', pergunta: 'Estou sobrecarregado?', invertida: true, opcoes: DEFAULT_OPTIONS },
    { id: 'q5', pergunta: 'Consigo descansar?', invertida: false, opcoes: DEFAULT_OPTIONS }
  ]
}

export async function GET() {
  const supabase = getAdminClient()
  try {
    const { data, error } = await supabase
      .from('gp_checkin_config')
      .select('*')
      .eq('id', 'default')
      .maybeSingle()

    if (error) {
      console.warn('[Checkin Config API] Tabela ou campo ausente no schema cache:', error.message)
      return NextResponse.json(DEFAULT_CONFIG)
    }

    if (!data) {
      return NextResponse.json(DEFAULT_CONFIG)
    }

    // Garantir que cada pergunta tenha opcoes válidas de resposta
    if (Array.isArray(data.perguntas_burnout)) {
      data.perguntas_burnout = data.perguntas_burnout.map((q: any) => ({
        ...q,
        opcoes: Array.isArray(q.opcoes) && q.opcoes.length === 5 ? q.opcoes : DEFAULT_OPTIONS
      }))
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[Checkin Config API] Exceção de rede ou schema:', err)
    return NextResponse.json(DEFAULT_CONFIG)
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = getAdminClient()
  try {
    const body = await request.json()
    const {
      ativo,
      frequencia_dias,
      titulo_modal,
      subtitulo_modal,
      pergunta_emocao,
      emocoes,
      motivos,
      perguntas_burnout
    } = body

    const formattedBurnout = Array.isArray(perguntas_burnout)
      ? perguntas_burnout.map((q: any) => ({
          id: q.id || `bq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          pergunta: q.pergunta || 'Pergunta de autoavaliação',
          invertida: Boolean(q.invertida),
          opcoes: Array.isArray(q.opcoes) && q.opcoes.length === 5 ? q.opcoes : DEFAULT_OPTIONS
        }))
      : DEFAULT_CONFIG.perguntas_burnout

    const configData = {
      id: 'default',
      ativo: typeof ativo === 'boolean' ? ativo : true,
      frequencia_dias: Math.max(1, parseInt(frequencia_dias || '7', 10)),
      titulo_modal: titulo_modal || DEFAULT_CONFIG.titulo_modal,
      subtitulo_modal: subtitulo_modal || DEFAULT_CONFIG.subtitulo_modal,
      pergunta_emocao: pergunta_emocao || DEFAULT_CONFIG.pergunta_emocao,
      emocoes: Array.isArray(emocoes) ? emocoes : DEFAULT_CONFIG.emocoes,
      motivos: Array.isArray(motivos) ? motivos : DEFAULT_CONFIG.motivos,
      perguntas_burnout: formattedBurnout,
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('gp_checkin_config')
      .upsert(configData)
      .select()
      .single()

    if (error) {
      const isMissingTable =
        error.code === '42P01' ||
        error.code === 'PGRST205' ||
        error.message?.includes('schema cache') ||
        error.message?.includes('Could not find the table') ||
        error.message?.includes('gp_checkin_config')

      if (isMissingTable) {
        return NextResponse.json(
          {
            error: 'A tabela "public.gp_checkin_config" ainda não existe no seu banco de dados Supabase. Execute o script de migração fornecido.',
            sql_required: true,
            script_file: 'supabase-checkin-config.sql'
          },
          { status: 400 }
        )
      }
      throw error
    }

    return NextResponse.json({ success: true, config: data })
  } catch (err: any) {
    console.error('[Checkin Config API] Save error:', err)
    return NextResponse.json({ error: err.message || 'Erro ao salvar configurações do Check-in.' }, { status: 500 })
  }
}
