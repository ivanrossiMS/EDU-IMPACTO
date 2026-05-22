import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function check() {
  const { data, error } = await supabase
    .from('responsaveis')
    .select('*')
    .eq('id', '2222')
  
  console.log('Responsavel 2222:', data)
  if (error) console.error('Error:', error)
}

check()
