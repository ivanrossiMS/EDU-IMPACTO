require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  const { data, error } = await supabase.rpc('get_schema_cache_or_something')
  
  // Just try an insert without descricao
  const { data: simData, error: simError } = await supabase.from('simulados').insert([{
    titulo: 'Test',
    data_aplicacao: '2026-07-01',
    id_bimestre: null,
    series: ['6º Ano'],
    status: 'rascunho'
  }]).select().single()

  console.log("simError:", simError)
  if(simData) {
      console.log("Inserted columns:", Object.keys(simData))
      // cleanup
      await supabase.from('simulados').delete().eq('id', simData.id)
  }
}

run()
