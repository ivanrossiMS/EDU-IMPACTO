require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function run() {
  const { data: simData, error: simError } = await supabase.from('simulados').insert([{
    titulo: 'Test',
    descricao: '',
    data_aplicacao: '2026-07-01',
    id_bimestre: null,
    series: ['6º Ano'],
    status: 'rascunho'
  }]).select().single()

  console.log("simError:", simError)
  console.log("simData:", simData)
}

run()
