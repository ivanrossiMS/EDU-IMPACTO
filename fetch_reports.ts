import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env.local")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
  const { data, error } = await supabase
    .from('comunicados')
    .select('id, titulo, destino, dados')
    .like('id', 'AD-COM-REL-COLAB-%')
    .order('data', { ascending: false })
    .limit(5)

  if (error) {
    console.error('Error:', error)
    process.exit(1)
  }

  console.log(JSON.stringify(data, null, 2))
}

run()
