import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
  const { data, error } = await supabase.from('responsaveis').select('*').eq('email', 'teste2@teste2')
  console.log('Result:', data, error)
}
run()
