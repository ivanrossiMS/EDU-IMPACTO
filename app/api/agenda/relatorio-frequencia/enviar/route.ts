import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { supabaseServer } from '@/lib/supabaseServer'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 30

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const { 
      colaboradorNome, 
      colaboradorId: providedColabId, 
      mes, 
      ano, 
      summary, 
      customTitulo, 
      customMensagem, 
      imageBase64 
    } = body

    if (!colaboradorNome) {
      return NextResponse.json({ error: 'Nome do colaborador não informado.' }, { status: 400 })
    }

    const supabase = supabaseServer
    const mesNum = parseInt(String(mes || (new Date().getMonth() + 1)), 10)
    const anoNum = parseInt(String(ano || new Date().getFullYear()), 10)
    const mesNome = MONTH_NAMES[mesNum - 1] || 'Mês'

    // 1. Identificar o colaborador no system_users
    let colabUser: any = null
    if (providedColabId) {
      const { data: uById } = await supabase
        .from('system_users')
        .select('id, nome, email, cargo, perfil, dados')
        .or(`id.eq."${providedColabId}",auth_id.eq."${providedColabId}"`)
        .maybeSingle()
      colabUser = uById
    }

    if (!colabUser && colaboradorNome) {
      const cleanSearchName = colaboradorNome.trim()
      const { data: uByName } = await supabase
        .from('system_users')
        .select('id, nome, email, cargo, perfil, dados')
        .ilike('nome', `%${cleanSearchName}%`)
        .limit(1)
        .maybeSingle()
      colabUser = uByName
    }

    const resolvedColabId = colabUser?.id || providedColabId || `colab_${Date.now()}`
    const cleanColabId = String(resolvedColabId).replace(/^f_?/, '')
    const finalColabNome = colabUser?.nome || colaboradorNome
    const finalColabCargo = colabUser?.cargo || colabUser?.perfil || 'Colaborador(a)'

    // 2. Dados Oficiais do Administrador Master (Remetente)
    const masterAdminNome = 'Ivan Rossi'
    const masterAdminCargo = 'Administrador Master'
    const masterAdminId = 'master-dziia1l'
    const masterAdminFoto = 'https://lrpwerkkqrjkcauofhph.supabase.co/storage/v1/object/public/comunicados-midia/avatars/1789438579475_Captura_de_Tela_2026-09-13_a_s_07.57.46.webp'

    // 3. Upload da Imagem do Infográfico (se fornecida via base64)
    let imageUrl: string | null = null
    let imageSize = 0

    if (imageBase64 && typeof imageBase64 === 'string') {
      try {
        const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
        if (matches && matches.length === 3) {
          const buffer = Buffer.from(matches[2], 'base64')
          imageSize = buffer.length
          const fileName = `relatorios-frequencia/relatorio_${anoNum}_${mesNum}_${cleanColabId}_${Date.now()}.png`

          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('comunicados-midia')
            .upload(fileName, buffer, {
              contentType: 'image/png',
              cacheControl: '2592000', // 30 dias
              upsert: true
            })

          if (!uploadErr && uploadData) {
            const { data: pubData } = supabase.storage
              .from('comunicados-midia')
              .getPublicUrl(uploadData.path)
            imageUrl = pubData.publicUrl
          } else {
            console.warn('[enviar-relatorio] Falha ao fazer upload da imagem no storage:', uploadErr)
            imageUrl = imageBase64 // Fallback para data URL
          }
        } else {
          imageUrl = imageBase64
        }
      } catch (uploadException) {
        console.warn('[enviar-relatorio] Exceção ao processar imagem:', uploadException)
        imageUrl = imageBase64
      }
    }

    // 4. Montar Anexos
    const finalAnexos: string[] = []
    if (imageUrl) {
      const anexoNome = `Relatório de Frequência - ${mesNome}_${anoNum}.png`
      finalAnexos.push(`${anexoNome}|${imageUrl}|image/png|${imageSize}`)
    }

    // 5. Título e Conteúdo do Comunicado
    const tituloFinal = customTitulo?.trim() || `📊 Relatório Oficial de Frequência e Envios - ${mesNome}/${anoNum}`

    const totalPubs = summary?.totalGeral ?? 0
    const comsQtd = summary?.totalComunicados ?? 0
    const relsQtd = summary?.totalRelatorios ?? 0
    const momsQtd = summary?.totalMomentos ?? 0
    const diasAtivos = summary?.diasComEnvios ?? 0
    const diasMes = summary?.diasNoMes ?? 30
    const media = summary?.mediaPorDiaAtivo ?? '0'
    const pctAssiduidade = diasMes > 0 ? Math.round((diasAtivos / diasMes) * 100) : 0

    let textoFinal = customMensagem?.trim()
    if (!textoFinal) {
      textoFinal = `
<p>Olá, <strong>${finalColabNome}</strong>! 👋</p>
<p>Esperamos que este comunicado o(a) encontre bem.</p>
<p>A <strong>Direção Geral e Administração Master</strong> preparou e disponibiliza o seu <strong>Relatório Oficial de Frequência e Envios</strong> referente ao período de <strong>${mesNome} de ${anoNum}</strong> na Agenda Digital do Colégio Impacto.</p>

<p>📊 <strong>Resumo de Suas Atividades no Período:</strong></p>
<ul>
  <li><strong>Total de Publicações Realizadas:</strong> ${totalPubs} envios</li>
  <li><strong>📢 Comunicados Gerais:</strong> ${comsQtd}</li>
  <li><strong>📋 Relatórios de Rotina Diária:</strong> ${relsQtd}</li>
  <li><strong>📸 Momentos Fotográficos:</strong> ${momsQtd}</li>
  <li><strong>📅 Dias com Atividade:</strong> ${diasAtivos} de ${diasMes} dias no mês (${pctAssiduidade}% de assiduidade)</li>
</ul>

<p>Pedimos zelo e compromisso com o registro pedagógico dos nossos alunos e na comunicação transparente com as famílias!</p>
<p>Confira em anexo o infográfico detalhado com o seu calendário e métricas consolidadas.</p>

<p>Atenciosamente,<br />
<strong>${masterAdminNome}</strong><br />
<em>${masterAdminCargo} • Diretor Geral</em><br />
<strong>Colégio Impacto</strong></p>
      `.trim()
    }

    // 6. Criar Registro do Comunicado na Tabela comunicados
    const newComId = `AD-COM-FREQ-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    const nowIso = new Date().toISOString()

    const targetFuncs = Array.from(new Set([
      String(resolvedColabId),
      `f_${cleanColabId}`,
      cleanColabId
    ]))

    const rowToInsert = {
      id: newComId,
      titulo: tituloFinal,
      texto: textoFinal,
      autor: masterAdminNome,
      data: nowIso,
      destino: 'selecionados',
      fixado: false,
      dados: {
        id: newComId,
        titulo: tituloFinal,
        conteudo: textoFinal,
        texto: textoFinal,
        autor: masterAdminNome,
        autorCargo: masterAdminCargo,
        autorId: masterAdminId,
        autorFoto: masterAdminFoto,
        status: 'enviado',
        prioridade: 'alta',
        tipo: 'texto',
        dataEnvio: nowIso,
        destino: 'selecionados',
        turmas: [],
        turmasIds: [],
        grupos: [],
        alunosIds: [],
        funcionariosIds: targetFuncs,
        colaboradoresIds: targetFuncs,
        anexos: finalAnexos,
        leituras: {},
        ciencias: {},
        exigeCiencia: false,
        permiteResposta: true,
        isRelatorioFrequencia: true,
        relatorioPeriodo: `${mesNome}/${anoNum}`,
        colaboradorAlvo: {
          id: cleanColabId,
          nome: finalColabNome,
          cargo: finalColabCargo
        }
      }
    }

    const { data: savedCom, error: insertErr } = await supabase
      .from('comunicados')
      .insert(rowToInsert)
      .select()
      .single()

    if (insertErr) {
      console.error('[enviar-relatorio] Erro ao gravar comunicado:', insertErr)
      return NextResponse.json({ error: `Erro ao salvar comunicado: ${insertErr.message}` }, { status: 500 })
    }

    // 7. Disparar Notificação Push para o Colaborador
    try {
      await sendAgendaPushNotification({
        targetUserIds: targetFuncs,
        title: `📊 Relatório de Frequência - ${mesNome}/${anoNum}`,
        message: `${masterAdminNome} enviou o seu relatório oficial de envios e frequência. Confira!`,
        targetUrl: `/agenda-digital/colaborador/comunicados?id=${newComId}`,
        type: 'comunicados',
        itemId: newComId,
        metadata: {
          rota: 'comunicados',
          perfil_destino: 'colaborador',
          item_id: newComId
        }
      })
    } catch (pushErr) {
      console.warn('[enviar-relatorio] Falha ao enviar push para o colaborador:', pushErr)
    }

    return NextResponse.json({
      ok: true,
      comunicadoId: newComId,
      colaborador: {
        id: cleanColabId,
        nome: finalColabNome,
        cargo: finalColabCargo
      },
      imageUrl
    })
  } catch (err: any) {
    console.error('[enviar-relatorio] Erro inesperado:', err)
    return NextResponse.json({ error: err.message || 'Erro interno ao despachar comunicado.' }, { status: 500 })
  }
}
