import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

function normalize(v: string | null | undefined): string {
  if (!v) return ''
  return v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function normDate(v: string | null | undefined): string | null {
  if (!v) return null
  const s = v.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return null
}

export async function POST(request: Request) {
  try {
    const supabase = await createProtectedClient()
    const body = await request.json()
    const { rows, mapping, config, tipoResponsavelConfig, tipoTurmaConfig, hasHeaders, headers, step, inativarAusentes, accumulatedIds } = body as { 
      rows: any[][]; 
      mapping: Record<string, string>; 
      config: string;
      tipoResponsavelConfig?: 'acrescentar' | 'substituir';
      tipoTurmaConfig?: 'acrescentar' | 'substituir';
      hasHeaders: boolean;
      headers: any[] | null;
      step?: number;
      inativarAusentes?: boolean;
      accumulatedIds?: string[];
    }

    const stringHeaders = headers ? headers.map(h => String(h ?? '').trim()) : null

    if (!Array.isArray(rows) || !mapping) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    let inseridos = 0
    let atualizados = 0
    let erros = 0
    const erroDetails: { linha: number; msg: string }[] = []
    const processedAlunoIds: string[] = [...(accumulatedIds || [])]
    
    // Carregar todas as turmas em memória para vinculação flexível (Insensível a acentos/caixa)
    const { data: allTurmas } = await supabase.from('turmas').select('id, nome, dados')
    const turmasMap = new Map<string, { id: string, segmento?: string }>()
    allTurmas?.forEach(t => {
      turmasMap.set(normalize(t.nome), { 
        id: t.id, 
        segmento: t.dados?.segmento 
      })
    })

    for (const [index, row] of rows.entries()) {
      try {
        // 1. Extrair dados baseados no mapeamento
        const alunoData: any = {}
        const respData: any = {}

        Object.entries(mapping).forEach(([column, target]) => {
          if (!target) return // Ignora colunas não mapeadas
          let value;
          if (hasHeaders && stringHeaders) {
            const colIdx = stringHeaders.indexOf(column)
            if (colIdx !== -1) value = row[colIdx]
          } else {
            const colIdx = parseInt(column)
            if (!isNaN(colIdx)) value = row[colIdx]
          }

          if (value === undefined || value === null || value === '') return

          if (target.startsWith('aluno_')) {
            const field = target.replace('aluno_', '')
            alunoData[field] = value
          } else if (target.startsWith('resp_')) {
            const field = target.replace('resp_', '')
            respData[field] = value
          }
        })

        if (index === 0) {
          console.log(`[Import] mapping:`, mapping)
          console.log(`[Import] headers:`, headers)
        }
        console.log(`[Import] Linha ${index + 2} respData extraído:`, respData)

        const isOnlyRespUpdate = (step === 3 || step === 4) && !alunoData.nome && !alunoData.codigo && respData.nome && respData.rfid !== undefined;

        if (!alunoData.nome && !alunoData.codigo && !isOnlyRespUpdate) {
          console.log('[Import] Linha', index, 'Nome e Código do aluno vazios ou não mapeados')
          erros++
          erroDetails.push({ linha: index + 2, msg: 'Nome ou Código do aluno deve ser mapeado' })
          continue
        }

        if (isOnlyRespUpdate) {
          const { data: foundResps } = await supabase.from('responsaveis').select('*').ilike('nome', `%${respData.nome.trim()}%`);
          let targetResp = null;
          if (foundResps && foundResps.length > 0) {
            targetResp = foundResps.find((r:any) => normalize(r.nome) === normalize(respData.nome));
            if (!targetResp) targetResp = foundResps[0];
          }

          if (targetResp) {
            const { error: updateError } = await supabase.from('responsaveis').update({ rfid: String(respData.rfid) }).eq('id', targetResp.id);
            if (updateError) {
              erros++
              erroDetails.push({ linha: index + 2, msg: `Erro ao atualizar RFID de ${respData.nome}: ${updateError.message}` })
            } else {
              atualizados++
            }
          } else {
            erros++
            erroDetails.push({ linha: index + 2, msg: `Responsável não encontrado: ${respData.nome}.` })
          }
          continue;
        }

        // Normalizar datas
        if (alunoData.data_nascimento) alunoData.data_nascimento = normDate(String(alunoData.data_nascimento))
        if (respData.data_nasc) respData.data_nasc = normDate(String(respData.data_nasc))
        // Filtrar campos válidos do aluno e jogar o resto em 'dados' (JSONB)
        const validAlunoColumns = [
          'id', 'nome', 'matricula', 'turma', 'serie', 'turno', 'status', 'email', 
          'data_nascimento', 'responsavel', 'responsavel_financeiro', 'responsavel_pedagogico', 
          'telefone', 'inadimplente', 'risco_evasao', 'media', 'frequencia', 'obs', 'unidade', 'foto', 'dados', 'updated_at'
        ]

        const filteredAlunoData: any = {}
        const extraData: any = {}

        Object.entries(alunoData).forEach(([key, val]) => {
          if (validAlunoColumns.includes(key)) {
            filteredAlunoData[key] = val
          } else if (key !== 'codigo') {
            extraData[key] = val
          }
        })

        if (Object.keys(extraData).length > 0) {
          filteredAlunoData.dados = extraData
        }

        // Resolver nome da turma para ID (Normalizado)
        let resolvedTurmaId = ''
        let resolvedSegmento = ''
        if (alunoData.turma) {
          const found = turmasMap.get(normalize(alunoData.turma))
          if (found) {
            resolvedTurmaId = found.id
            resolvedSegmento = found.segmento || ''
            filteredAlunoData.turma = found.id
            if (found.segmento) {
              if (!filteredAlunoData.dados) filteredAlunoData.dados = {}
              filteredAlunoData.dados.segmento = found.segmento
            }
          }
        }

        const identifier = alunoData.codigo
        if (identifier && !filteredAlunoData.matricula) {
          filteredAlunoData.matricula = identifier
        }

        // 2. Buscar aluno existente
        let existingAluno: any = null

        if (identifier) {
          const { data } = await supabase
            .from('alunos')
            .select('*')
            .eq('id', identifier)
            .maybeSingle()
          existingAluno = data

          if (!existingAluno) {
            const { data: byMatricula } = await supabase
              .from('alunos')
              .select('*')
              .eq('matricula', identifier)
              .maybeSingle()
            existingAluno = byMatricula
          }
        }

        if (!existingAluno && alunoData.nome) {
          const { data } = await supabase
            .from('alunos')
            .select('*')
            .eq('nome', alunoData.nome)
            .maybeSingle()
          existingAluno = data
        }

        if (!existingAluno && (step === 3 || step === 4)) {
          throw new Error(`Aluno com ID/Matrícula ou Nome "${identifier || alunoData.nome || ''}" não encontrado. Cadastre o aluno primeiro no Passo 1.`)
        }

        // 3. Aplicar lógica de Merge
        const defaults = {
          turma: '',
          serie: '',
          turno: '',
          status: 'matriculado',
          inadimplente: false,
          risco_evasao: 'baixo',
          frequencia: 100,
          unidade: 'Unidade Centro',
          updated_at: new Date().toISOString()
        }

        let finalAlunoData = { ...filteredAlunoData }
        let isUpdate = false

        if (existingAluno) {
          isUpdate = true
          if (config === 'manter') {
            Object.keys(filteredAlunoData).forEach(key => {
              if (existingAluno[key] !== null && existingAluno[key] !== undefined && existingAluno[key] !== '') {
                delete finalAlunoData[key]
              }
            })
            finalAlunoData = { ...existingAluno, ...finalAlunoData }
          } else {
            finalAlunoData = { ...existingAluno, ...filteredAlunoData }
          }
        } else {
          const identifier = alunoData.codigo
          finalAlunoData.id = identifier || `AL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
          finalAlunoData = { ...defaults, ...finalAlunoData }
        }

        if (alunoData.ativo !== undefined) {
          finalAlunoData.status = String(alunoData.ativo).toLowerCase() === 'sim' || alunoData.ativo === true ? 'matriculado' : 'inativo'
        }

        if (alunoData.autorizadoSairSozinho !== undefined) {
          if (!finalAlunoData.dados) finalAlunoData.dados = {}
          finalAlunoData.dados.autorizadoSairSozinho = String(alunoData.autorizadoSairSozinho).toLowerCase() === 'sim' || alunoData.autorizadoSairSozinho === true
        }

        // Processar Histórico de Turmas
        if (alunoData.turma && resolvedTurmaId) {
          const novoVinculo = {
            id: `HIST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            anoLetivo: alunoData.ano_letivo || new Date().getFullYear().toString(),
            segmento: resolvedSegmento,
            serieTurma: resolvedTurmaId
          }
          
          if (!finalAlunoData.dados) finalAlunoData.dados = {}
          const historicoAnterior = Array.isArray(existingAluno?.dados?.historicoTurmas) ? existingAluno.dados.historicoTurmas : []
          
          if (tipoTurmaConfig === 'substituir') {
            finalAlunoData.dados.historicoTurmas = [novoVinculo]
          } else {
            // Evita duplicar se já existir exatamente a mesma turma e ano letivo
            const jaExiste = historicoAnterior.some((h: any) => h.serieTurma === resolvedTurmaId && String(h.anoLetivo) === String(novoVinculo.anoLetivo))
            
            if (!jaExiste) {
              finalAlunoData.dados.historicoTurmas = [...historicoAnterior, novoVinculo]
            }
          }
          
          // Sempre define a turma recém importada como a turma atual
          finalAlunoData.turma = resolvedTurmaId
        }

        // Salvar Aluno
        const { error: studentError } = await supabase
          .from('alunos')
          .upsert(finalAlunoData)

        if (studentError) {
          console.error('[Import] Linha', index, 'Erro Supabase:', studentError)
          throw new Error(`Erro ao salvar aluno: ${studentError.message}`)
        }

        if (isUpdate) atualizados++
        else inseridos++
        
        if (finalAlunoData.id) {
          processedAlunoIds.push(finalAlunoData.id)
        }

        // 4. Processar Responsáveis
        const processResp = async (respData: any) => {
          if (!respData.nome && !respData.id) return null

          let existingResp: any = null
          if (respData.id) {
            const { data } = await supabase
              .from('responsaveis')
              .select('*')
              .eq('id', respData.id)
              .maybeSingle()
            existingResp = data
          }

          let finalRespData = { ...respData }
          
          if (existingResp) {
            if (config === 'manter') {
              Object.keys(respData).forEach(key => {
                if (existingResp[key] !== null && existingResp[key] !== undefined && existingResp[key] !== '') {
                  delete finalRespData[key]
                }
              })
              finalRespData = { ...existingResp, ...finalRespData }
            } else {
              finalRespData = { ...existingResp, ...respData }
            }
          } else {
            finalRespData.id = respData.id || crypto.randomUUID()
          }

          if (respData.autorizado_retirar !== undefined) {
            finalRespData.proibido = 
              String(respData.autorizado_retirar).toLowerCase() === 'proibido' || 
              String(respData.autorizado_retirar).toLowerCase() === 'não'
          }

          if (finalRespData.proibido) {
            // Se o responsável está proibido, não tem dias de acesso permitidos
            finalRespData.dias_acesso = []
          } else if (respData.restricao_dia !== undefined && String(respData.restricao_dia).trim() !== '') {
            const dayMap: { [key: string]: string } = {
              'seg': 'Seg', 'segunda': 'Seg', 'segunda-feira': 'Seg',
              'ter': 'Ter', 'terça': 'Ter', 'terça-feira': 'Ter',
              'qua': 'Qua', 'quarta': 'Qua', 'quarta-feira': 'Qua',
              'qui': 'Qui', 'quinta': 'Qui', 'quinta-feira': 'Qui',
              'sex': 'Sex', 'sexta': 'Sex', 'sexta-feira': 'Sex'
            }
            const prohibitedDays = String(respData.restricao_dia).split(',')
              .map(d => d.trim().toLowerCase())
              .map(d => dayMap[d] || (d.charAt(0).toUpperCase() + d.slice(1)))
            
            const allDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex']
            const allowedDays = allDays.filter(d => !prohibitedDays.includes(d))
            
            finalRespData.dias_acesso = allowedDays
          } else {
            // Se estiver vazio na planilha, o padrão é liberar todos os dias
            finalRespData.dias_acesso = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex']
          }

          // Mapeia CPF e RG para dentro da coluna JSONB dados
          const dados = finalRespData.dados || {}
          if (respData.cpf) {
            dados.cpf = String(respData.cpf).replace(/\D/g, '')
          }
          if (respData.rg) {
            dados.rg = String(respData.rg).trim()
          }
          finalRespData.dados = dados

          const validRespColumns = [
            'id', 'nome', 'data_nasc', 'telefone', 'celular', 'email', 
            'profissao', 'rfid', 'proibido', 'dias_acesso', 'dados'
          ]
          
          const filteredRespData: any = {}
          Object.keys(finalRespData).forEach(key => {
            if (validRespColumns.includes(key)) {
              filteredRespData[key] = finalRespData[key]
            }
          })

          const { data: savedResp, error: respError } = await supabase
            .from('responsaveis')
            .upsert(filteredRespData)
            .select()
            .single()

          if (respError) throw new Error(`Erro ao salvar responsável ${respData.nome}: ${respError.message}`)
          return savedResp
        }

        const savedResp = await processResp(respData)

        // 5. Vincular Responsáveis (Acrescentando com Preservação Inteligente)
        const linkResp = async (respId: string, parentescoRaw: string | undefined, autorizado: any, tipoRaw: string | undefined) => {
          if (!respId) return

          const { data: existingLink } = await supabase
            .from('aluno_responsavel')
            .select('*')
            .eq('aluno_id', finalAlunoData.id)
            .eq('responsavel_id', respId)
            .maybeSingle()

          const isParentescoMapped = Object.values(mapping).includes('resp_parentesco')
          const hasParentescoValue = respData.hasOwnProperty('parentesco') && respData.parentesco !== undefined && respData.parentesco !== null && respData.parentesco !== ''

          const isTipoMapped = Object.values(mapping).includes('resp_tipo')
          const hasTipoValue = respData.hasOwnProperty('tipo') && respData.tipo !== undefined && respData.tipo !== null && respData.tipo !== ''

          const parseTipo = (tipoStr: string | undefined) => {
            const s = String(tipoStr || '').toLowerCase()
            return {
              isFin: s.includes('finan'),
              isPed: s.includes('pedag'),
              isOutro: s.includes('outro') || (!s.includes('finan') && !s.includes('pedag') && s !== '')
            }
          }

          const flags = parseTipo(tipoRaw)

          if (!existingLink) {
            // === NOVO VÍNCULO ===
            const isProibido = String(autorizado).toLowerCase() === 'não'
            
            // Determinar parentesco para novo vínculo
            let finalParentesco = 'outro'
            if (isParentescoMapped && hasParentescoValue && parentescoRaw) {
              finalParentesco = parentescoRaw
            } else if (step === 3) {
              finalParentesco = 'outro'
            }

            // Determinar tipo de responsável para novo vínculo
            const finalFin = isTipoMapped && hasTipoValue ? flags.isFin : false
            const finalPed = isTipoMapped && hasTipoValue ? flags.isPed : false
            let finalOutro = isTipoMapped && hasTipoValue ? flags.isOutro : (isProibido || (!finalFin && !finalPed))

            // REGRA ESPECIAL: Se o parentesco for 'outro' e não houver papel financeiro ou pedagógico associado, força o tipo como 'Outro'
            if (finalParentesco.toLowerCase() === 'outro' && !finalFin && !finalPed) {
              finalOutro = true
            }

            console.log(`[Import] Inserindo novo vínculo para aluno ${finalAlunoData.id} e resp ${respId} com parentesco "${finalParentesco}"`)
            const { error: linkError } = await supabase
              .from('aluno_responsavel')
              .insert({
                aluno_id: finalAlunoData.id,
                responsavel_id: respId,
                parentesco: finalParentesco,
                resp_outro: finalOutro,
                resp_financeiro: finalFin,
                resp_pedagogico: finalPed
              })

            if (linkError) throw new Error(`Erro ao vincular responsável: ${linkError.message}`)
            
            if (isProibido) {
              await supabase.from('responsaveis').update({ proibido: true }).eq('id', respId)
            }
          } else {
            // === VÍNCULO EXISTENTE (PRESERVAÇÃO INTELIGENTE) ===
            // Grau de Parentesco: SÓ altera se estiver ativamente mapeado e fornecido!
            const finalParentesco = (isParentescoMapped && hasParentescoValue && parentescoRaw) 
              ? parentescoRaw 
              : existingLink.parentesco

            // Tipo de Responsável: SÓ altera se estiver ativamente mapeado e fornecido!
            let finalFin = existingLink.resp_financeiro
            let finalPed = existingLink.resp_pedagogico
            let finalOutro = existingLink.resp_outro

            if (isTipoMapped && hasTipoValue) {
              if (tipoResponsavelConfig === 'substituir') {
                // Substituir: limpa os papéis antigos e aplica estritamente os novos
                finalFin = flags.isFin
                finalPed = flags.isPed
                finalOutro = flags.isOutro
              } else {
                // Acrescentar (Padrão): soma as permissões/papéis
                finalFin = existingLink.resp_financeiro || flags.isFin
                finalPed = existingLink.resp_pedagogico || flags.isPed
                finalOutro = existingLink.resp_outro || flags.isOutro
              }
            }

            // REGRA ESPECIAL: Se o parentesco for 'outro' e não houver papel financeiro ou pedagógico associado, força o tipo como 'Outro'
            if (finalParentesco.toLowerCase() === 'outro' && !finalFin && !finalPed) {
              finalOutro = true
            }

            console.log(`[Import] Atualizando vínculo existente para aluno ${finalAlunoData.id} e resp ${respId}. Parentesco final: "${finalParentesco}" (Mapeado: ${isParentescoMapped}), Estratégia: ${tipoResponsavelConfig || 'acrescentar'}, Fin: ${finalFin}, Ped: ${finalPed}`)
            const { error: updateError } = await supabase
              .from('aluno_responsavel')
              .update({
                resp_financeiro: finalFin,
                resp_pedagogico: finalPed,
                resp_outro: finalOutro,
                parentesco: finalParentesco
              })
              .eq('aluno_id', finalAlunoData.id)
              .eq('responsavel_id', respId)

            if (updateError) throw new Error(`Erro ao atualizar vínculo do responsável: ${updateError.message}`)
          }
        }

        console.log(`[Import] Linha ${index + 2}: respData.parentesco original = "${respData.parentesco}"`)
        let parentesco: string | undefined = undefined
        if (respData.parentesco !== undefined && respData.parentesco !== null && respData.parentesco !== '') {
          const p = String(respData.parentesco).trim().toLowerCase()
          if (p.includes('pai')) parentesco = 'pai'
          else if (p.includes('mãe') || p.includes('mae')) parentesco = 'mae'
          else parentesco = 'outro'
        }

        console.log(`[Import] Linha ${index + 2}: parentesco final = "${parentesco}"`)
        if (savedResp) await linkResp(savedResp.id, parentesco, respData.autorizado_retirar, respData.tipo)

      } catch (e: any) {
        erros++
        erroDetails.push({ linha: index + 2, msg: e.message })
      }
    }

    if (step === 2 && inativarAusentes && processedAlunoIds.length > 0) {
      console.log(`[Import] Inativando alunos ausentes... Mantendo ativos apenas os ${processedAlunoIds.length} alunos processados.`)
      const { error: inativacaoError } = await supabase
        .from('alunos')
        .update({ status: 'inativo' })
        .not('id', 'in', `(${processedAlunoIds.join(',')})`)
        .neq('status', 'inativo') // opcional, para não atualizar atoa

      if (inativacaoError) {
        console.error('[Import] Erro ao inativar alunos ausentes:', inativacaoError)
        erroDetails.push({ linha: 0, msg: `Erro ao inativar alunos ausentes: ${inativacaoError.message}` })
      } else {
        console.log('[Import] Inativação concluída com sucesso.')
      }
    }

    return NextResponse.json({
      ok: true,
      total: rows.length,
      inseridos,
      atualizados,
      erros,
      erroDetails: erroDetails,
      processedIds: processedAlunoIds
    })

  } catch (e: any) {
    console.error('[POST /api/importacao/alunos]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
