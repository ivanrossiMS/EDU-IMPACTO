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

function normDate(v: any): string | null {
  if (v === undefined || v === null || v === '') return null
  if (typeof v === 'number' && v > 30000 && v < 60000) {
    try {
      const utc_days = Math.floor(v - 25569)
      const date = new Date(utc_days * 86400 * 1000)
      if (!isNaN(date.getTime())) {
        const y = date.getUTCFullYear()
        const m = String(date.getUTCMonth() + 1).padStart(2, '0')
        const d = String(date.getUTCDate()).padStart(2, '0')
        return `${y}-${m}-${d}`
      }
    } catch {}
  }
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m) {
    const d = m[1].padStart(2, '0')
    const mo = m[2].padStart(2, '0')
    return `${m[3]}-${mo}-${d}`
  }
  return null
}

function cleanDigits(v: any): string {
  if (!v) return ''
  return String(v).replace(/\D/g, '')
}

export async function POST(request: Request) {
  try {
    const { requireStaff } = await import('@/lib/server/authGuard')
    const { errorResponse } = await requireStaff(request)
    if (errorResponse) return errorResponse

    const supabase = await createProtectedClient()
    const body = await request.json()
    const {
      rows,
      mapping,
      config = 'manter',
      tipoResponsavelConfig = 'acrescentar',
      tipoTurmaConfig = 'acrescentar',
      hasHeaders = true,
      headers = null,
      step = 2,
      inativarAusentes = false,
      accumulatedIds = [],
      batchId = `LOTE-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      isLastChunk = false,
      batchTracker = {
        alunoIdsCriados: [],
        alunoIdsAtualizados: [],
        respIdsCriados: [],
        vinculoIdsCriados: [],
        alunosInativados: [],
        previousSnapshots: {}
      }
    } = body as {
      rows: any[][]
      mapping: Record<string, string>
      config?: string
      tipoResponsavelConfig?: 'acrescentar' | 'substituir'
      tipoTurmaConfig?: 'acrescentar' | 'substituir'
      hasHeaders?: boolean
      headers?: any[] | null
      step?: number
      inativarAusentes?: boolean
      accumulatedIds?: string[]
      batchId?: string
      isLastChunk?: boolean
      batchTracker?: {
        alunoIdsCriados: string[]
        alunoIdsAtualizados: string[]
        respIdsCriados: string[]
        vinculoIdsCriados: string[]
        alunosInativados: string[]
        previousSnapshots: Record<string, any>
      }
    }

    const stringHeaders = headers ? headers.map(h => String(h ?? '').trim()) : null

    if (!Array.isArray(rows) || !mapping) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    let inseridos = 0
    let atualizados = 0
    let erros = 0
    const erroDetails: { linha: number; alunoNome?: string; msg: string; rawRow?: any }[] = []
    const processedAlunoIds: string[] = [...(accumulatedIds || [])]

    // 1. Carregar turmas em memória para mapeamento flexível e rápido
    const { data: allTurmas } = await supabase.from('turmas').select('id, nome, serie, turno, dados')
    const turmasMap = new Map<string, { id: string; nome: string; segmento?: string; serie?: string }>()
    allTurmas?.forEach((t: any) => {
      const tSeg = t.segmento || t.dados?.segmento || ''
      const tSerie = t.serie || t.dados?.serie || ''
      const tObj = { id: t.id, nome: t.nome, segmento: tSeg, serie: tSerie }
      turmasMap.set(normalize(t.nome), tObj)
    })

    // 2. Cache em memória para reaproveitamento inteligente de responsáveis (Irmãos)
    // Permite que irmãos na mesma planilha vinculem ao mesmo responsável sem duplicidade!
    const respCacheByCpf = new Map<string, any>()
    const respCacheByNamePhone = new Map<string, any>()

    for (const [index, row] of rows.entries()) {
      try {
        const isRowEmpty = row.every((c: any) => c === undefined || c === null || String(c).trim() === '')
        if (isRowEmpty) continue

        // Extrair campos de aluno, resp1 e resp2
        const alunoData: Record<string, any> = {}
        const resp1Data: Record<string, any> = {}
        const resp2Data: Record<string, any> = {}

        Object.entries(mapping).forEach(([column, target]) => {
          if (!target) return
          let value: any
          if (hasHeaders && stringHeaders) {
            const colIdx = stringHeaders.indexOf(column)
            if (colIdx !== -1) value = row[colIdx]
          } else {
            const colIdx = parseInt(column)
            if (!isNaN(colIdx)) value = row[colIdx]
          }

          if (value === undefined || value === null || String(value).trim() === '') return

          if (target.startsWith('aluno_')) {
            alunoData[target.replace('aluno_', '')] = value
          } else if (target.startsWith('resp1_')) {
            resp1Data[target.replace('resp1_', '')] = value
          } else if (target.startsWith('resp2_')) {
            resp2Data[target.replace('resp2_', '')] = value
          } else if (target.startsWith('resp_')) {
            // Suporte retrocompatível
            resp1Data[target.replace('resp_', '')] = value
          }
        })

        // Modo isolado legado (atualizar apenas RFID do responsável pelo nome)
        const isOnlyRespUpdate = (step === 3 || step === 4) && !alunoData.nome && !alunoData.codigo && resp1Data.nome && resp1Data.rfid !== undefined
        if (isOnlyRespUpdate) {
          const { data: foundResps } = await supabase.from('responsaveis').select('*').ilike('nome', `%${String(resp1Data.nome).trim()}%`)
          let targetResp = foundResps?.find((r: any) => normalize(r.nome) === normalize(resp1Data.nome)) || foundResps?.[0]
          if (targetResp) {
            await supabase.from('responsaveis').update({ rfid: String(resp1Data.rfid) }).eq('id', targetResp.id)
            atualizados++
          } else {
            erros++
            erroDetails.push({ linha: index + 2, alunoNome: resp1Data.nome, msg: `Responsável não encontrado: ${resp1Data.nome}` })
          }
          continue
        }

        // Validação básica do aluno
        if (!alunoData.nome && !alunoData.codigo) {
          erros++
          erroDetails.push({ linha: index + 2, msg: 'Nome ou Código do aluno deve estar preenchido', rawRow: row })
          continue
        }

        // Normalização de dados do aluno
        if (alunoData.data_nascimento) alunoData.data_nascimento = normDate(alunoData.data_nascimento)
        if (alunoData.cpf) alunoData.cpf = cleanDigits(alunoData.cpf)
        if (alunoData.telefone) alunoData.telefone = cleanDigits(alunoData.telefone)

        // Resolução flexível de turma
        let resolvedTurmaId = ''
        let resolvedSegmento = alunoData.segmento || ''
        let resolvedSerie = alunoData.serie || ''

        if (alunoData.turma) {
          const normTurma = normalize(alunoData.turma)
          let found = turmasMap.get(normTurma)
          if (!found && allTurmas) {
            const matched: any = allTurmas.find((t: any) => {
              const nName = normalize(t.nome)
              return nName === normTurma || nName.includes(normTurma) || normTurma.includes(nName)
            })
            if (matched) {
              found = {
                id: matched.id,
                nome: matched.nome,
                segmento: matched.segmento || matched.dados?.segmento || '',
                serie: matched.serie || matched.dados?.serie || ''
              }
            }
          }
          if (found) {
            resolvedTurmaId = found.id
            resolvedSegmento = found.segmento || resolvedSegmento
            resolvedSerie = found.serie || resolvedSerie
          }
        }

        // 3. Buscar aluno existente no banco (por ID, Matrícula ou Nome Exato)
        let existingAluno: any = null
        const identifier = alunoData.codigo || alunoData.matricula

        if (identifier) {
          const { data: byId } = await supabase.from('alunos').select('*').eq('id', identifier).maybeSingle()
          existingAluno = byId
          if (!existingAluno) {
            const { data: byMatr } = await supabase.from('alunos').select('*').eq('matricula', identifier).maybeSingle()
            existingAluno = byMatr
          }
        }
        if (!existingAluno && alunoData.nome) {
          const { data: byNome } = await supabase.from('alunos').select('*').eq('nome', alunoData.nome.trim()).maybeSingle()
          existingAluno = byNome
        }

        // Montar dados para inserção / atualização
        const validAlunoColumns = [
          'id', 'nome', 'matricula', 'turma', 'serie', 'turno', 'status', 'email',
          'data_nascimento', 'responsavel', 'responsavel_financeiro', 'responsavel_pedagogico',
          'telefone', 'inadimplente', 'risco_evasao', 'media', 'frequencia', 'obs', 'unidade', 'foto', 'dados', 'codigo'
        ]

        const filteredAlunoData: any = {}
        const extraData: any = existingAluno?.dados ? { ...existingAluno.dados } : {}

        // Mapear campos de endereço e saúde para dentro de 'dados'
        if (alunoData.cep) extraData.cep = alunoData.cep
        if (alunoData.endereco) extraData.endereco = alunoData.endereco
        if (alunoData.numero) extraData.numero = alunoData.numero
        if (alunoData.bairro) extraData.bairro = alunoData.bairro
        if (alunoData.cidade) extraData.cidade = alunoData.cidade
        if (alunoData.uf) extraData.uf = alunoData.uf
        if (alunoData.sexo) extraData.sexo = alunoData.sexo
        if (alunoData.rg) extraData.rg = alunoData.rg
        if (resolvedSegmento) extraData.segmento = resolvedSegmento

        // Pode sair sozinho
        if (alunoData.autorizadoSairSozinho !== undefined) {
          const strSozinho = String(alunoData.autorizadoSairSozinho).toLowerCase()
          extraData.autorizadoSairSozinho = strSozinho === 'sim' || strSozinho === 's' || strSozinho === 'true' || alunoData.autorizadoSairSozinho === true
        }

        // Integral / Intermediário
        if (alunoData.isIntegralIntermediario !== undefined) {
          const strInt = String(alunoData.isIntegralIntermediario).toLowerCase()
          extraData.isIntegralIntermediario = strInt === 'sim' || strInt === 's' || strInt === 'true' || alunoData.isIntegralIntermediario === true
        }

        // Copiar colunas válidas
        Object.entries(alunoData).forEach(([k, val]) => {
          if (validAlunoColumns.includes(k)) {
            filteredAlunoData[k] = val
          } else if (!['codigo', 'cep', 'endereco', 'numero', 'bairro', 'cidade', 'uf', 'sexo', 'rg', 'segmento', 'autorizadoSairSozinho', 'isIntegralIntermediario'].includes(k)) {
            extraData[k] = val
          }
        })

        if (identifier) {
          filteredAlunoData.matricula = identifier
          filteredAlunoData.codigo = identifier
        }
        if (resolvedTurmaId) {
          filteredAlunoData.turma = resolvedTurmaId
        }
        if (resolvedSerie) {
          filteredAlunoData.serie = resolvedSerie
        }

        // Status ativo / inativo
        if (alunoData.ativo !== undefined) {
          const strAtivo = String(alunoData.ativo).toLowerCase()
          filteredAlunoData.status = (strAtivo === 'sim' || strAtivo === 's' || strAtivo === 'true' || alunoData.ativo === true) ? 'matriculado' : 'inativo'
        }

        // Processamento de Histórico de Turmas
        if (resolvedTurmaId) {
          const novoVinculo: any = {
            id: `HIST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            anoLetivo: alunoData.ano_letivo || new Date().getFullYear().toString(),
            segmento: resolvedSegmento || '',
            serie: resolvedSerie || '',
            serieTurma: resolvedTurmaId
          }
          if (extraData.isIntegralIntermediario) {
            novoVinculo.isIntegralIntermediario = true
            novoVinculo.modalidade = 'INTEGRAL/INTERMEDIÁRIO'
          }

          const histAnterior = Array.isArray(existingAluno?.dados?.historicoTurmas) ? existingAluno.dados.historicoTurmas : []
          if (tipoTurmaConfig === 'substituir') {
            extraData.historicoTurmas = [novoVinculo]
          } else {
            const idx = histAnterior.findIndex((h: any) => h.serieTurma === resolvedTurmaId && String(h.anoLetivo) === String(novoVinculo.anoLetivo))
            if (idx === -1) {
              extraData.historicoTurmas = [...histAnterior, novoVinculo]
            } else {
              histAnterior[idx].serie = resolvedSerie || histAnterior[idx].serie
              extraData.historicoTurmas = [...histAnterior]
            }
          }

          // Sincronizar também historicoMatriculas usado pelos Relatórios de Retenção/Progressão
          const matEntry = {
            ano: String(novoVinculo.anoLetivo),
            turma: resolvedTurmaId,
            serie: resolvedSerie || '',
            segmento: resolvedSegmento || '',
            status: filteredAlunoData.status || existingAluno?.status || 'matriculado'
          }
          const histMatAnterior = Array.isArray(existingAluno?.dados?.historicoMatriculas) ? existingAluno.dados.historicoMatriculas : []
          if (tipoTurmaConfig === 'substituir') {
            extraData.historicoMatriculas = [matEntry]
          } else {
            const mIdx = histMatAnterior.findIndex((m: any) => String(m.ano || m.anoLetivo) === matEntry.ano)
            if (mIdx === -1) {
              extraData.historicoMatriculas = [...histMatAnterior, matEntry]
            } else {
              const nextMat = [...histMatAnterior]
              nextMat[mIdx] = { ...nextMat[mIdx], ...matEntry }
              extraData.historicoMatriculas = nextMat
            }
          }
        }

        // Tag do lote para rastreabilidade e rollback
        extraData.importBatchId = batchId
        extraData.lastImportDate = new Date().toISOString()
        filteredAlunoData.dados = extraData
        filteredAlunoData.updated_at = new Date().toISOString()

        let isUpdate = false
        let finalAlunoId = existingAluno?.id

        if (existingAluno) {
          isUpdate = true
          // Salvar snapshot para rollback
          batchTracker.previousSnapshots[existingAluno.id] = {
            turma: existingAluno.turma,
            serie: existingAluno.serie,
            status: existingAluno.status,
            dados: existingAluno.dados
          }

          let mergedData = { ...existingAluno, ...filteredAlunoData }
          if (config === 'manter') {
            Object.keys(filteredAlunoData).forEach(k => {
              if (existingAluno[k] !== null && existingAluno[k] !== undefined && existingAluno[k] !== '') {
                delete filteredAlunoData[k]
              }
            })
            mergedData = { ...existingAluno, ...filteredAlunoData }
          }
          const { error: updErr } = await supabase.from('alunos').update(mergedData).eq('id', existingAluno.id)
          if (updErr) throw new Error(`Erro ao atualizar aluno: ${updErr.message}`)
          atualizados++
          batchTracker.alunoIdsAtualizados.push(existingAluno.id)
        } else {
          finalAlunoId = identifier || `AL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
          filteredAlunoData.id = finalAlunoId
          filteredAlunoData.status = filteredAlunoData.status || 'matriculado'
          filteredAlunoData.created_at = new Date().toISOString()

          const { error: insErr } = await supabase.from('alunos').insert(filteredAlunoData)
          if (insErr) throw new Error(`Erro ao cadastrar aluno: ${insErr.message}`)
          inseridos++
          batchTracker.alunoIdsCriados.push(finalAlunoId)
        }

        if (finalAlunoId) {
          processedAlunoIds.push(finalAlunoId)
        }

        // 4. PROCESSAR RESPONSÁVEIS (Deduplicação Inteligente de Irmãos e Família)
        const processResponsible = async (respInfo: Record<string, any>, defaultParentesco: string) => {
          if (!respInfo || !respInfo.nome || String(respInfo.nome).trim() === '') return null

          const respNomeTrim = String(respInfo.nome).trim()
          const respCpfClean = cleanDigits(respInfo.cpf)
          const respTelClean = cleanDigits(respInfo.telefone)

          // 1º: Verificar no cache da sessão atual (mesma planilha de alunos)
          let cachedResp = null
          if (respCpfClean && respCacheByCpf.has(respCpfClean)) {
            cachedResp = respCacheByCpf.get(respCpfClean)
          } else if (respCacheByNamePhone.has(`${normalize(respNomeTrim)}_${respTelClean}`)) {
            cachedResp = respCacheByNamePhone.get(`${normalize(respNomeTrim)}_${respTelClean}`)
          }

          let existingResp: any = cachedResp

          // 2º: Se não achou no cache, buscar no banco pelo CPF ou Nome+Telefone
          if (!existingResp && respCpfClean) {
            const { data } = await supabase.from('responsaveis').select('*').eq('cpf', respCpfClean).maybeSingle()
            existingResp = data
          }
          if (!existingResp && respTelClean) {
            const { data } = await supabase.from('responsaveis').select('*').ilike('nome', respNomeTrim).eq('celular', respTelClean).maybeSingle()
            existingResp = data
          }
          if (!existingResp) {
            const { data } = await supabase.from('responsaveis').select('*').ilike('nome', respNomeTrim).maybeSingle()
            existingResp = data
          }

          const respObj: any = {
            nome: respNomeTrim,
            updated_at: new Date().toISOString()
          }
          if (respCpfClean) respObj.cpf = respCpfClean
          if (respTelClean) {
            respObj.telefone = respTelClean
            respObj.celular = respTelClean
          }
          if (respInfo.email) respObj.email = String(respInfo.email).trim()
          if (respInfo.profissao) respObj.profissao = String(respInfo.profissao).trim()
          if (respInfo.rfid) respObj.rfid = String(respInfo.rfid).trim()
          if (respInfo.data_nasc) respObj.data_nasc = normDate(respInfo.data_nasc)

          let savedRespId: string

          if (existingResp) {
            savedRespId = existingResp.id
            const mergedResp = { ...existingResp, ...respObj }
            await supabase.from('responsaveis').update(mergedResp).eq('id', savedRespId)
          } else {
            savedRespId = crypto.randomUUID()
            respObj.id = savedRespId
            respObj.created_at = new Date().toISOString()
            respObj.parentesco = respInfo.parentesco || defaultParentesco
            respObj.dados = { importBatchId: batchId }
            const { error: insRespErr } = await supabase.from('responsaveis').insert(respObj)
            if (insRespErr) throw new Error(`Erro ao salvar responsável: ${insRespErr.message}`)
            batchTracker.respIdsCriados.push(savedRespId)
          }

          // Guardar no cache de sessão para os próximos irmãos na mesma planilha
          if (respCpfClean) respCacheByCpf.set(respCpfClean, { ...existingResp, ...respObj, id: savedRespId })
          respCacheByNamePhone.set(`${normalize(respNomeTrim)}_${respTelClean}`, { ...existingResp, ...respObj, id: savedRespId })

          // 5. Vincular Responsável ao Aluno na tabela aluno_responsavel
          const { data: existingLink } = await supabase
            .from('aluno_responsavel')
            .select('*')
            .eq('aluno_id', finalAlunoId)
            .eq('responsavel_id', savedRespId)
            .maybeSingle()

          const isFin = String(respInfo.financeiro || '').toLowerCase() === 'sim' || respInfo.financeiro === true
          const isPed = String(respInfo.pedagogico || '').toLowerCase() === 'sim' || respInfo.pedagogico === true || (!respInfo.financeiro && !respInfo.pedagogico)
          const isRetirar = String(respInfo.retirar || '').toLowerCase() !== 'não'

          const parentescoFinal = respInfo.parentesco || defaultParentesco

          if (!existingLink) {
            const linkId = crypto.randomUUID()
            const { error: linkErr } = await supabase.from('aluno_responsavel').insert({
              id: linkId,
              aluno_id: finalAlunoId,
              responsavel_id: savedRespId,
              parentesco: parentescoFinal,
              resp_financeiro: isFin,
              resp_pedagogico: isPed,
              resp_outro: !isFin && !isPed,
              autorizacao_retirada: isRetirar,
              created_at: new Date().toISOString()
            })
            if (!linkErr) batchTracker.vinculoIdsCriados.push(linkId)
          } else {
            const updatedFin = tipoResponsavelConfig === 'substituir' ? isFin : (existingLink.resp_financeiro || isFin)
            const updatedPed = tipoResponsavelConfig === 'substituir' ? isPed : (existingLink.resp_pedagogico || isPed)
            await supabase.from('aluno_responsavel').update({
              resp_financeiro: updatedFin,
              resp_pedagogico: updatedPed,
              parentesco: parentescoFinal || existingLink.parentesco,
              autorizacao_retirada: isRetirar
            }).eq('id', existingLink.id)
          }

          return savedRespId
        }

        // Processar Responsável 1 (Mãe / Principal)
        if (resp1Data.nome) {
          await processResponsible(resp1Data, resp1Data.parentesco || 'Mãe')
        }

        // Processar Responsável 2 (Pai / Secundário)
        if (resp2Data.nome) {
          await processResponsible(resp2Data, resp2Data.parentesco || 'Pai')
        }

      } catch (e: any) {
        erros++
        erroDetails.push({
          linha: index + 2,
          alunoNome: row[1] || 'Aluno',
          msg: e.message,
          rawRow: row
        })
      }
    }

    // 6. INATIVAÇÃO DE AUSENTES (Executa somente no último chunk se solicitado)
    if (isLastChunk && inativarAusentes && processedAlunoIds.length > 0) {
      console.log(`[Import] Inativando alunos não listados na planilha (${processedAlunoIds.length} ativos preservados)...`)
      const processedSet = new Set(processedAlunoIds.map(String))
      const { data: activeStudents } = await supabase
        .from('alunos')
        .select('id')
        .neq('status', 'inativo')

      const absentIds = (activeStudents || [])
        .map((s: any) => String(s.id))
        .filter((id: string) => !processedSet.has(id))

      if (absentIds.length > 0) {
        batchTracker.alunosInativados = absentIds

        await supabase
          .from('alunos')
          .update({ status: 'inativo', updated_at: new Date().toISOString() })
          .in('id', absentIds)
      }
    }

    // 7. REGISTRAR LOTE NA TABELA CONFIGURACOES (Somente no último chunk)
    if (isLastChunk) {
      const batchRecord = {
        id: batchId,
        data: new Date().toISOString(),
        total: processedAlunoIds.length,
        inseridos: batchTracker.alunoIdsCriados.length,
        atualizados: batchTracker.alunoIdsAtualizados.length,
        erros: erroDetails.length,
        status: 'concluido',
        ...batchTracker
      }

      // Salvar registro individual do lote
      await supabase.from('configuracoes').upsert({
        chave: `import_batch_${batchId}`,
        valor: batchRecord,
        updated_at: new Date().toISOString()
      })

      // Atualizar lista histórica de lotes
      const { data: currentListConfig } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'import_batches_list')
        .maybeSingle()

      const currentList = Array.isArray(currentListConfig?.valor) ? currentListConfig.valor : []
      const updatedList = [
        {
          id: batchId,
          data: batchRecord.data,
          total: batchRecord.total,
          inseridos: batchRecord.inseridos,
          atualizados: batchRecord.atualizados,
          erros: batchRecord.erros,
          status: 'concluido'
        },
        ...currentList.slice(0, 19) // Mantém os 20 últimos lotes
      ]

      await supabase.from('configuracoes').upsert({
        chave: 'import_batches_list',
        valor: updatedList,
        updated_at: new Date().toISOString()
      })
    }

    const { invalidateAlunosCache, invalidateTurmasCache, invalidateGruposCache } = await import('@/lib/server/turmasGruposCache')
    const { clearAuthGuardCache } = await import('@/lib/server/authGuard')
    invalidateAlunosCache()
    invalidateTurmasCache()
    invalidateGruposCache()
    clearAuthGuardCache()

    return NextResponse.json({
      ok: true,
      batchId,
      total: rows.length,
      inseridos,
      atualizados,
      erros,
      erroDetails,
      processedIds: processedAlunoIds,
      batchTracker
    })
  } catch (e: any) {
    console.error('[POST /api/importacao/alunos]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
