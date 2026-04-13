import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createProtectedClient()

    // 1. Fetch all students
    const { data: alunos, error: fetchError } = await supabase.from('alunos').select('*')
    if (fetchError) throw new Error(fetchError.message)
    if (!alunos || alunos.length === 0) return NextResponse.json({ ok: true, count: 0, msg: "Nenhum aluno para migrar" })

    let processedResponsaveis = 0
    let processedMatriculas = 0

    // 2. Iterate and apply the O(1) Relational Extraction
    for (const data of alunos) {
      try {
        const rawRow = data
        const rest = rawRow.dados || {}
        const responsaveisArray = rest?.responsaveis || []
        const respsGerados: Record<string, string> = {}
        
        // --- RESPONSÁVEIS ---
        for (const resp of responsaveisArray) {
          if (!resp.nome || resp.nome.trim() === '') continue
          
          const respRow = {
            id: resp.id || crypto.randomUUID(),
            nome: resp.nome,
            cpf: resp.cpf ? String(resp.cpf).replace(/\D/g, '') : null,
            email: resp.email || null,
            telefone: resp.celular || resp.telefone || null,
            codigo: resp.codigo || null,
            rfid: resp.rfid || null,
            profissao: resp.profissao || null,
            dados: resp
          }
          
          respsGerados[resp.nome.toLowerCase()] = respRow.id
          if (!resp.id) resp.id = respRow.id 
          
          await supabase.from('responsaveis').upsert(respRow)
          
          await supabase.from('aluno_responsavel').upsert({
            aluno_id: data.id,
            responsavel_id: respRow.id,
            parentesco: resp.parentesco || resp.tipo || 'Outro',
            resp_financeiro: !!resp.respFinanceiro,
            resp_pedagogico: !!resp.respPedagogico
          })
          processedResponsaveis++
        }

        // Responsável nativo do registro principal
        if (rawRow.responsavel && !respsGerados[rawRow.responsavel.toLowerCase()]) {
           const defId = crypto.randomUUID()
           await supabase.from('responsaveis').upsert({
             id: defId, nome: rawRow.responsavel, telefone: rawRow.telefone || null, dados: {}
           })
           await supabase.from('aluno_responsavel').upsert({
             aluno_id: data.id, responsavel_id: defId, parentesco: 'Responsável Primário',
             resp_financeiro: true, resp_pedagogico: true
           })
           respsGerados[rawRow.responsavel.toLowerCase()] = defId
           processedResponsaveis++
        }
        
        // --- MATRÍCULAS ---
        let vf_id = null
        if (rawRow.responsavel_financeiro && respsGerados[rawRow.responsavel_financeiro.toLowerCase()]) {
           vf_id = respsGerados[rawRow.responsavel_financeiro.toLowerCase()]
        } else {
           const foundFin = responsaveisArray.find((r:any) => r.respFinanceiro)
           if (foundFin && foundFin.id) vf_id = foundFin.id
        }

        const matId = rest?.matricula_id || crypto.randomUUID()
        await supabase.from('matriculas').upsert({
           id: matId,
           aluno_id: data.id,
           responsavel_financeiro_id: vf_id,
           turma: rawRow.turma,
           serie: rawRow.serie,
           turno: rawRow.turno,
           status: rawRow.status,
           ano_letivo: new Date().getFullYear(),
           dados_contrato: {}
        })
        processedMatriculas++

        // Save ID back if missing
        if (!rest.matricula_id) {
           rest.matricula_id = matId
           await supabase.from('alunos').update({ dados: rest }).eq('id', data.id)
        }

      } catch(e) {
         console.error(`Falha ao backfill aluno ${data.id}`, e)
      }
    }

    return NextResponse.json({ 
      ok: true, 
      alunosMigrados: alunos.length,
      responsaveisGerados: processedResponsaveis,
      matriculasGeradas: processedMatriculas
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
