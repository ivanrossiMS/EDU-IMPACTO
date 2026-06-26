import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  const { count: countTotal, error } = await supabase.from('alunos').select('*', {count: 'exact', head: true})
  console.log("Total Alunos:", countTotal, "Error:", error)
}
run()
