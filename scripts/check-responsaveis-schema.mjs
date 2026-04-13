import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Key in .env.local")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
  console.log("Checking columns in 'responsaveis' table via Supabase API...")
  
  // Try to insert a dummy record to force error with column name
  const { data, error } = await supabase
    .from('responsaveis')
    .select('*')
    .limit(1)
    
  if (error) {
    console.error("Error querying responsaveis:", error.message)
    console.error("Full error:", error)
  } else {
    if (data && data.length > 0) {
      console.log("Columns found in records:")
      console.log(Object.keys(data[0]).join(', '))
    } else {
      console.log("Table 'responsaveis' is empty, but no schema cache errors detected on SELECT.")
    }
  }
}

checkSchema()
