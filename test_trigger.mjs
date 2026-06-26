import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function test() {
  const { data, error } = await supabase.rpc('get_trigger_def') 
  // Let's just query the DB for the trigger
  const { data: q } = await supabase.from('system_users').select('id')
}
test()
