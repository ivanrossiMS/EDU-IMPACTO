import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function fix() {
  // Find duplicate emails
  const { data: users } = await supabase.from('system_users').select('*')
  const emailMap = {}
  for (const u of users) {
    if (!u.email) continue;
    const em = u.email.toLowerCase()
    if (!emailMap[em]) emailMap[em] = []
    emailMap[em].push(u)
  }
  
  for (const em in emailMap) {
    if (emailMap[em].length > 1) {
      console.log(`Found ${emailMap[em].length} duplicates for ${em}`)
      const rows = emailMap[em]
      // keep the one where id == auth_id, or the newest one
      const toKeep = rows.find(r => r.id === r.auth_id) || rows[rows.length - 1]
      for (const r of rows) {
        if (r.id !== toKeep.id) {
          console.log(`Deleting duplicate ID: ${r.id}`)
          await supabase.from('system_users').delete().eq('id', r.id)
        }
      }
    }
  }
  console.log('Duplicates fixed.')
}
fix()
