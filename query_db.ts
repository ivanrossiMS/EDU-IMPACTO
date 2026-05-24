import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  const { data: frequencias, error } = await supabase.from('frequencias').select('*').limit(5)
  console.log("FREQUENCIAS:", frequencias, error)
  const { data: academico, error: err2 } = await supabase.from('academico_frequencia').select('*').limit(5)
  console.log("ACADEMICO FREQUENCIA:", academico, err2)
}

run()
