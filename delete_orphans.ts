import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env.local")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
  if (!fs.existsSync('orphaned_reports.json')) {
    console.error('orphaned_reports.json not found. Run find_orphans.ts first.')
    process.exit(1)
  }

  const data = JSON.parse(fs.readFileSync('orphaned_reports.json', 'utf8'))
  const { orphanedIds, urlsToDelete } = data

  if (!orphanedIds || orphanedIds.length === 0) {
    console.log('No orphaned reports to delete.')
    return
  }

  console.log(`Deleting ${orphanedIds.length} orphaned STU reports from database...`)
  
  const { error } = await supabase.from('comunicados').delete().in('id', orphanedIds)
  
  if (error) {
    console.error('Error deleting from database:', error)
    process.exit(1)
  }
  
  console.log('Successfully deleted records from the database.')
  console.log('Note: Attachments should be deleted via the Storage API, but for now we just remove the database records.')
  
  // Optionally clean up the JSON file
  // fs.unlinkSync('orphaned_reports.json')
}

run()
