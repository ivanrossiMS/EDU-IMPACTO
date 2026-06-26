import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
async function run() {
  const { data: r, error: e1 } = await supabase.from('simulados_requisicoes').select('*').limit(1).single()
  console.log("Original Req:", r)
  
  if (!r) return;
  const { data: newR, error: rErr } = await supabase.from('simulados_requisicoes').insert({
    id_simulado: r.id_simulado,
    id_disciplina: r.id_disciplina,
    id_professor: r.id_professor,
    quantidade_questoes: r.quantidade_questoes,
    assunto_orientacao: r.assunto_orientacao
  }).select().single()
  console.log("Insert Req Error:", rErr)
}
run()
