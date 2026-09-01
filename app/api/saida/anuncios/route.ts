import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const DEFAULT_ANNOUNCEMENTS = [
  {
    id: 'ann-1',
    title: 'Van Escolar no Portão',
    phrase: 'Atenção alunos que utilizam transporte escolar, as vans já estão aguardando no portão principal.',
    category: 'portaria',
    isFavorite: true,
    playChime: true,
    repeatCount: 1,
    createdAt: new Date().toISOString(),
    tags: ['transporte', 'vans', 'saída']
  },
  {
    id: 'ann-2',
    title: 'Fim do Intervalo / Retorno às Salas',
    phrase: 'Atenção alunos e professores, encerramento do intervalo. Todos devem retornar imediatamente às salas de aula.',
    category: 'intervalo',
    isFavorite: true,
    playChime: true,
    repeatCount: 1,
    createdAt: new Date().toISOString(),
    tags: ['recreio', 'salas', 'sinal']
  },
  {
    id: 'ann-3',
    title: 'Chamada de Professores à Coordenação',
    phrase: 'Atenção professores, favor comparecer à sala da coordenação pedagógica.',
    category: 'comunicado',
    isFavorite: false,
    playChime: true,
    repeatCount: 1,
    createdAt: new Date().toISOString(),
    tags: ['professores', 'coordenação']
  },
  {
    id: 'ann-4',
    title: 'Veículo Bloqueando Portão',
    phrase: 'Atenção, solicitamos ao proprietário do veículo estacionado em frente ao portão de saída que compareça para remanejamento.',
    category: 'veiculos',
    isFavorite: false,
    playChime: true,
    repeatCount: 1,
    createdAt: new Date().toISOString(),
    tags: ['estacionamento', 'carro']
  },
  {
    id: 'ann-5',
    title: 'Silêncio no Corredor (Simulado / Provas)',
    phrase: 'Atenção, solicitamos silêncio nos corredores. Alunos em período de avaliação e provas.',
    category: 'emergencia',
    isFavorite: true,
    playChime: true,
    repeatCount: 0,
    createdAt: new Date().toISOString(),
    tags: ['silêncio', 'provas', 'simulados']
  },
  {
    id: 'ann-6',
    title: 'Aviso de Pais no Portão',
    phrase: 'Atenção alunos do Ensino Médio, liberação autorizada para a saída.',
    category: 'portaria',
    isFavorite: false,
    playChime: true,
    repeatCount: 0,
    createdAt: new Date().toISOString(),
    tags: ['ensino médio', 'saída']
  },
  {
    id: 'ann-7',
    title: 'Início do Intervalo / Recreio',
    phrase: 'Sinal de intervalo. Bom recreio a todos os alunos e colaboradores.',
    category: 'intervalo',
    isFavorite: false,
    playChime: true,
    repeatCount: 0,
    createdAt: new Date().toISOString(),
    tags: ['início', 'recreio']
  }
]

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const supabase = getAdminClient()

    // 1. Buscar frases salvas em configuracoes
    const { data, error } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'saida_anuncios')
      .maybeSingle()

    if (error) {
      console.error('[saida_anuncios GET] Erro ao buscar:', error)
      return NextResponse.json(DEFAULT_ANNOUNCEMENTS)
    }

    // Se o registro já existe no banco de dados, retorna o valor gravado exatamente (mesmo que seja um array com menos itens ou vazio)
    if (data && data.valor !== undefined && data.valor !== null && Array.isArray(data.valor)) {
      return NextResponse.json(data.valor, {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'Pragma': 'no-cache'
        }
      })
    }

    // Se ainda não existir registro no banco pela primeira vez, inicializa com os padrões
    await supabase.from('configuracoes').upsert({
      chave: 'saida_anuncios',
      valor: DEFAULT_ANNOUNCEMENTS,
      updated_at: new Date().toISOString()
    })

    return NextResponse.json(DEFAULT_ANNOUNCEMENTS, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Pragma': 'no-cache'
      }
    })
  } catch (err: any) {
    console.error('[saida_anuncios GET] Exceção:', err)
    return NextResponse.json(DEFAULT_ANNOUNCEMENTS)
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const supabase = getAdminClient()

    const listToSave = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [body]

    const { data, error } = await supabase
      .from('configuracoes')
      .upsert({
        chave: 'saida_anuncios',
        valor: listToSave,
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('[saida_anuncios POST] Erro ao salvar no banco:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(listToSave, { status: 200 })
  } catch (err: any) {
    console.error('[saida_anuncios POST] Exceção:', err)
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
