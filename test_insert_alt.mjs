import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
async function run() {
  const { data: a, error: e1 } = await supabase.from('simulados_alternativas').select('*').limit(1).single()
  console.log("Original A:", a)
  
  const { data: newA, error: aErr } = await supabase.from('simulados_alternativas').insert({
    id_questao: a.id_questao,
    letra: a.letra,
    texto: a.texto,
    eh_correta: a.eh_correta
  }).select().single()
  console.log("Insert Alt Error:", aErr)
}
run()
