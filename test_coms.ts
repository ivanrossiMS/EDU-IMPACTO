import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  const { data, error } = await supabase.from('comunicados').select('id, titulo, destino, dados').eq('dados->>autorId', '51eb2bca-6f18-41bd-b37d-8e1b62d6e775').order('created_at', {ascending: false}).limit(10)
  console.log("Error:", error)
  console.log("Data:", JSON.stringify(data, null, 2))
}
run().catch(console.error)
