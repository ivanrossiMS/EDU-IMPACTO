const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
async function run() {
  const { data: alunos } = await supabase
      .from('alunos')
      .select('foto')
      .not('foto', 'is', null)
      .limit(5)
  console.log("Size of foto 1:", alunos[0]?.foto?.length || 0)
}
run()
