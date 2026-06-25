import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase.from('simulados').select(`
    *,
    simulados_bimestres ( nome ),
    simulados_questoes ( id, id_professor, id_disciplina ),
    simulados_requisicoes ( id_professor, id_disciplina, quantidade_questoes, simulados_disciplinas ( nome ) )
  `).limit(1)
  console.log('Error:', error)
  console.log('Data:', JSON.stringify(data, null, 2))
}
run()
