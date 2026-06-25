import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
async function run() {
  const req = await supabase.from('simulados_questoes').insert({
    id_simulado: 'f747fe56-7136-4698-8961-b6cffa91a95b',
    id_disciplina: 'd09f27fa-2974-4c11-bede-ecb2204379d7',
    id_professor: 'd7592809-9eff-4529-b6e1-044ed0e7e363',
    enunciado: 'teste'
  }).select()
  console.log('Insert error:', req.error)
}
run()
