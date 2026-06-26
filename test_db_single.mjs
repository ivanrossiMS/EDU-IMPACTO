import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function test() {
  const { data, error } = await supabase.from('system_users').select('*').eq('email', 'ana@colegioimpacto.net').maybeSingle()
  console.log('maybeSingle data:', data)
  console.log('maybeSingle error:', error)
}
test()
