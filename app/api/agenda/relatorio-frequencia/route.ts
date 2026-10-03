import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 30

function isRelatorio(row: any): boolean {
  const id = String(row.id || '');
  if (id.startsWith('AD-COM-REL-')) return true;
  const dados = row.dados || {};
  if (dados.tipo === 'relatorio' || row.tipo === 'relatorio') return true;
  if (dados.tipoRelatorio) return true;
  const anexos = Array.isArray(dados.anexos) ? dados.anexos : (Array.isArray(row.anexos) ? row.anexos : []);
  const hasRelAnexo = anexos.some((a: any) => {
    if (typeof a === 'string') return a.startsWith('Relatório:') || a.endsWith('|report-payload');
    return a?.mimeType === 'report-payload' || (a?.nome && a.nome.startsWith('Relatório:'));
  });
  if (hasRelAnexo) return true;
  const t = (row.titulo || dados.titulo || '').toLowerCase();
  if (t.startsWith('rotina') || t.includes('relatório') || t.includes('relatorio')) return true;
  return false;
}

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const now = new Date()
    
    // Parse mes (1..12) e ano (YYYY)
    const mesParam = searchParams.get('mes') || searchParams.get('month')
    const anoParam = searchParams.get('ano') || searchParams.get('year')
    const autorParam = (searchParams.get('autor') || '').trim()
    const autorIdParam = (searchParams.get('autor_id') || '').trim()
    const tipoFiltro = searchParams.get('tipo') || 'todos'
    const anexoFiltro = searchParams.get('anexo') || 'todos'

    const mes = mesParam ? parseInt(mesParam, 10) : (now.getMonth() + 1)
    const ano = anoParam ? parseInt(anoParam, 10) : now.getFullYear()

    if (isNaN(mes) || mes < 1 || mes > 12 || isNaN(ano) || ano < 2000 || ano > 2100) {
      return NextResponse.json({ error: 'Parâmetros de data inválidos.' }, { status: 400 })
    }

    const daysInMonth = new Date(ano, mes, 0).getDate()

    // Margem de segurança de 24 horas antes e depois para cobrir variações de fuso horário UTC vs Brasil (UTC-3)
    const startRange = new Date(Date.UTC(ano, mes - 1, 1, 0, 0, 0))
    startRange.setUTCDate(startRange.getUTCDate() - 1)
    const endRange = new Date(Date.UTC(ano, mes, 0, 23, 59, 59))
    endRange.setUTCDate(endRange.getUTCDate() + 2)

    const supabase = supabaseServer

    // 1. Buscar comunicados e relatórios (excluindo cópias individuais de alunos para não inflar contagens)
    let comQuery = supabase
      .from('comunicados')
      .select('id, titulo, texto, autor, data, created_at, destino, dados')
      .gte('created_at', startRange.toISOString())
      .lte('created_at', endRange.toISOString())
      .not('id', 'like', 'AD-COM-REL-STU-%')

    if (autorIdParam) {
      comQuery = comQuery.or(`dados->>autorId.eq."${autorIdParam}",dados->>autorId.eq."f_${autorIdParam}"`)
    } else if (autorParam && autorParam !== 'todos') {
      comQuery = comQuery.or(`autor.ilike."%${autorParam}%",dados->>autor.ilike."%${autorParam}%"`)
    }

    // 2. Buscar momentos
    let momQuery = supabase
      .from('momentos')
      .select('id, created_at, dados')
      .gte('created_at', startRange.toISOString())
      .lte('created_at', endRange.toISOString())

    if (autorIdParam) {
      momQuery = momQuery.or(`dados->>authorId.eq."${autorIdParam}",dados->>authorId.eq."f_${autorIdParam}"`)
    } else if (autorParam && autorParam !== 'todos') {
      momQuery = momQuery.or(`dados->>author.ilike."%${autorParam}%"`)
    }

    const [comsRes, momsRes] = await Promise.all([comQuery, momQuery])

    if (comsRes.error) {
      console.error('[relatorio-frequencia] Erro ao buscar comunicados:', comsRes.error)
    }
    if (momsRes.error) {
      console.error('[relatorio-frequencia] Erro ao buscar momentos:', momsRes.error)
    }

    const rawComs = comsRes.data || []
    const rawMoms = momsRes.data || []

    // Preparar estrutura diária
    type ItemReport = {
      id: string | number
      tipo: 'comunicado' | 'relatorio' | 'momento'
      titulo: string
      conteudo: string
      autor: string
      autorCargo: string
      autorFoto: string | null
      dataEnvio: string
      horario: string
      dia: number
      turmas: string[]
      grupos: string[]
      anexosCount: number
      midiasCount: number
      raw: any
    }

    const diasMap: Record<number, {
      total: number
      comunicados: number
      relatorios: number
      momentos: number
      itens: ItemReport[]
    }> = {}

    for (let d = 1; d <= daysInMonth; d++) {
      diasMap[d] = {
        total: 0,
        comunicados: 0,
        relatorios: 0,
        momentos: 0,
        itens: []
      }
    }

    const autoresMap: Record<string, {
      nome: string
      cargo: string
      foto: string | null
      total: number
      comunicados: number
      relatorios: number
      momentos: number
      diasComEnvios: number
      dias: Record<number, {
        total: number
        comunicados: number
        relatorios: number
        momentos: number
      }>
    }> = {}

    // Processar Comunicados e Relatórios
    rawComs.forEach(c => {
      const rawDateStr = c.data || c.dados?.dataEnvio || c.created_at
      if (!rawDateStr) return
      const dateObj = new Date(rawDateStr)
      if (isNaN(dateObj.getTime())) return

      // Validação do mês e ano no horário local de Brasília (UTC-3)
      // Ajuste defensivo: calcular data local no fuso horário do Brasil
      const brTime = new Date(dateObj.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
      if (brTime.getFullYear() !== ano || (brTime.getMonth() + 1) !== mes) return

      const day = brTime.getDate()
      const tipoItem: 'relatorio' | 'comunicado' = isRelatorio(c) ? 'relatorio' : 'comunicado'

      // Filtro de tipo
      if (tipoFiltro !== 'todos' && tipoFiltro !== tipoItem) return

      // Filtro de anexo
      const anexosList = c.dados?.anexos || (c as any).anexos || []
      const hasAnyAnexo = anexosList.length > 0
      if (anexoFiltro === 'nenhum' && hasAnyAnexo) return
      if (anexoFiltro === 'qualquer' && !hasAnyAnexo) return
      if (anexoFiltro !== 'todos' && anexoFiltro !== 'nenhum' && anexoFiltro !== 'qualquer') {
        const matchesAnexo = anexosList.some((anexo: any) => {
          let name = ''
          let mime = ''
          if (typeof anexo === 'string') {
            const parts = anexo.split('|')
            name = parts[0] || ''
            mime = parts[2] || ''
          } else if (anexo && typeof anexo === 'object') {
            name = anexo.nome || anexo.name || ''
            mime = anexo.type || anexo.mimeType || ''
          }
          if (anexoFiltro === 'relatorio' && (name.startsWith('Relatório:') || mime === 'report-payload')) return true
          if (anexoFiltro === 'formulario' && name.startsWith('Formulário:')) return true
          if (anexoFiltro === 'enquete' && (name.startsWith('Enquete:') || mime === 'enquete')) return true
          if (anexoFiltro === 'autorizacao' && (name.startsWith('Autorização:') || mime === 'autorizacao')) return true
          if (anexoFiltro === 'cobranca' && (name.startsWith('Cobrança:') || mime === 'cobranca')) return true
          if (anexoFiltro === 'imagem' && (mime.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(name))) return true
          if (anexoFiltro === 'video' && (mime.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(name))) return true
          return false
        })
        if (!matchesAnexo) return
      }

      const autorNome = (c.autor || c.dados?.autor || 'Colaborador').trim()
      const autorCargo = c.dados?.autorCargo || c.dados?.cargo || c.dados?.perfil || 'Colaborador'
      const autorFoto = c.dados?.autorFoto || c.dados?.foto || null
      const horario = brTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

      const item: ItemReport = {
        id: c.id,
        tipo: tipoItem,
        titulo: c.titulo || c.dados?.titulo || (tipoItem === 'relatorio' ? 'Relatório Pedagógico' : 'Comunicado'),
        conteudo: (c.texto || c.dados?.conteudo || c.dados?.texto || '').replace(/<[^>]*>/g, '').trim(),
        autor: autorNome,
        autorCargo,
        autorFoto,
        dataEnvio: dateObj.toISOString(),
        horario,
        dia: day,
        turmas: Array.isArray(c.dados?.turmas) ? c.dados.turmas : (Array.isArray((c as any).turmas) ? (c as any).turmas : []),
        grupos: Array.isArray(c.dados?.grupos) ? c.dados.grupos : [],
        anexosCount: anexosList.length,
        midiasCount: 0,
        raw: {
          ...c,
          ...(c.dados || {}),
          id: c.id,
          titulo: c.titulo || c.dados?.titulo,
          conteudo: c.texto || c.dados?.conteudo || c.dados?.texto,
          autor: autorNome,
          autorCargo,
          anexos: anexosList,
          dataEnvio: c.data || c.dados?.dataEnvio || c.created_at
        }
      }

      if (diasMap[day]) {
        diasMap[day].itens.push(item)
        diasMap[day].total++
        if (tipoItem === 'relatorio') {
          diasMap[day].relatorios++
        } else {
          diasMap[day].comunicados++
        }
      }

      // Autores Map
      if (!autoresMap[autorNome]) {
        const authorDias: Record<number, { total: number; comunicados: number; relatorios: number; momentos: number }> = {}
        for (let d = 1; d <= daysInMonth; d++) {
          authorDias[d] = { total: 0, comunicados: 0, relatorios: 0, momentos: 0 }
        }
        autoresMap[autorNome] = {
          nome: autorNome,
          cargo: autorCargo,
          foto: autorFoto,
          total: 0,
          comunicados: 0,
          relatorios: 0,
          momentos: 0,
          diasComEnvios: 0,
          dias: authorDias
        }
      }
      const a = autoresMap[autorNome]
      a.total++
      if (tipoItem === 'relatorio') {
        a.relatorios++
        if (a.dias[day]) a.dias[day].relatorios++
      } else {
        a.comunicados++
        if (a.dias[day]) a.dias[day].comunicados++
      }
      if (a.dias[day]) a.dias[day].total++
    })

    // Processar Momentos
    if (tipoFiltro === 'todos' || tipoFiltro === 'momento') {
      rawMoms.forEach(m => {
        const rawDateStr = m.dados?.date || m.created_at
        if (!rawDateStr) return
        const dateObj = new Date(rawDateStr)
        if (isNaN(dateObj.getTime())) return

        const brTime = new Date(dateObj.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
        if (brTime.getFullYear() !== ano || (brTime.getMonth() + 1) !== mes) return

        const day = brTime.getDate()
        const autorNome = (m.dados?.author || 'Colaborador').trim()
        const autorCargo = m.dados?.authorRole || 'Professor(a)'
        const autorFoto = m.dados?.authorPhoto || null
        const horario = brTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        const mediaList = Array.isArray(m.dados?.media) ? m.dados.media : (Array.isArray(m.dados?.midias) ? m.dados.midias : [])

        // Filtro de anexo para momentos
        if (anexoFiltro === 'nenhum' && mediaList.length > 0) return
        if (anexoFiltro === 'relatorio' || anexoFiltro === 'formulario' || anexoFiltro === 'enquete' || anexoFiltro === 'autorizacao' || anexoFiltro === 'cobranca') return
        if (anexoFiltro === 'imagem') {
          const hasImg = mediaList.some((med: any) => med.type === 'image' || (!med.type && String(med.url).match(/\.(webp|jpg|jpeg|png)$/i)))
          if (!hasImg) return
        }
        if (anexoFiltro === 'video') {
          const hasVid = mediaList.some((med: any) => med.type === 'video' || String(med.url).match(/\.(mp4|webm|mov)$/i))
          if (!hasVid) return
        }

        const item: ItemReport = {
          id: m.id,
          tipo: 'momento',
          titulo: m.dados?.desc ? (m.dados.desc.length > 50 ? m.dados.desc.substring(0, 50) + '...' : m.dados.desc) : 'Momento Publicado',
          conteudo: m.dados?.desc || '',
          autor: autorNome,
          autorCargo,
          autorFoto,
          dataEnvio: dateObj.toISOString(),
          horario,
          dia: day,
          turmas: Array.isArray(m.dados?.targetClasses) ? m.dados.targetClasses : [],
          grupos: Array.isArray(m.dados?.targetGrupos) ? m.dados.targetGrupos : [],
          anexosCount: 0,
          midiasCount: mediaList.length,
          raw: {
            ...m,
            ...(m.dados || {}),
            id: m.id,
            author: autorNome,
            media: mediaList,
            desc: m.dados?.desc || ''
          }
        }

        if (diasMap[day]) {
          diasMap[day].itens.push(item)
          diasMap[day].total++
          diasMap[day].momentos++
        }

        if (!autoresMap[autorNome]) {
          const authorDias: Record<number, { total: number; comunicados: number; relatorios: number; momentos: number }> = {}
          for (let d = 1; d <= daysInMonth; d++) {
            authorDias[d] = { total: 0, comunicados: 0, relatorios: 0, momentos: 0 }
          }
          autoresMap[autorNome] = {
            nome: autorNome,
            cargo: autorCargo,
            foto: autorFoto,
            total: 0,
            comunicados: 0,
            relatorios: 0,
            momentos: 0,
            diasComEnvios: 0,
            dias: authorDias
          }
        }
        const a = autoresMap[autorNome]
        a.total++
        a.momentos++
        if (a.dias[day]) {
          a.dias[day].momentos++
          a.dias[day].total++
        }
      })
    }

    // Calcular diasComEnvios para cada autor
    Object.values(autoresMap).forEach(a => {
      let activeDays = 0
      Object.values(a.dias).forEach(d => {
        if (d.total > 0) activeDays++
      })
      a.diasComEnvios = activeDays
    })

    // Totais Consolidados
    let totalComunicados = 0
    let totalRelatorios = 0
    let totalMomentos = 0
    let diasComEnvios = 0

    Object.values(diasMap).forEach(d => {
      totalComunicados += d.comunicados
      totalRelatorios += d.relatorios
      totalMomentos += d.momentos
      if (d.total > 0) diasComEnvios++
      // Ordenar itens do dia por horário mais recente
      d.itens.sort((a, b) => new Date(b.dataEnvio).getTime() - new Date(a.dataEnvio).getTime())
    })

    const totalGeral = totalComunicados + totalRelatorios + totalMomentos

    const autoresArray = Object.values(autoresMap).sort((a, b) => b.total - a.total)

    return NextResponse.json({
      ano,
      mes,
      diasNoMes: daysInMonth,
      startDayOfWeek: new Date(ano, mes - 1, 1).getDay(), // 0 = Dom, 1 = Seg...
      summary: {
        totalGeral,
        totalComunicados,
        totalRelatorios,
        totalMomentos,
        diasComEnvios,
        diasNoMes: daysInMonth,
        mediaPorDiaAtivo: diasComEnvios > 0 ? (totalGeral / diasComEnvios).toFixed(1) : '0'
      },
      dias: diasMap,
      autores: autoresArray
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    })
  } catch (error: any) {
    console.error('[relatorio-frequencia] Erro crítico:', error)
    return NextResponse.json({ error: error.message || 'Erro ao gerar relatório de frequência.' }, { status: 500 })
  }
}
