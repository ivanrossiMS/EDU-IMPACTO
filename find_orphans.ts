import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for bypass RLS

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env.local")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
  console.log('Fetching all STU reports...')
  
  // Fetch STU records
  const { data: stuRecords, error: stuError } = await supabase
    .from('comunicados')
    .select('id, dados, created_at, titulo')
    .ilike('id', 'AD-COM-REL-STU-%')

  if (stuError) {
    console.error('Error fetching STU records:', stuError)
    process.exit(1)
  }

  console.log(`Found ${stuRecords.length} STU reports.`)

  // Fetch COLAB records
  console.log('Fetching all COLAB reports...')
  const { data: colabRecords, error: colabError } = await supabase
    .from('comunicados')
    .select('id, dados, created_at, titulo')
    .ilike('id', 'AD-COM-REL-COLAB-%')

  if (colabError) {
    console.error('Error fetching COLAB records:', colabError)
    process.exit(1)
  }

  console.log(`Found ${colabRecords.length} COLAB reports.`)

  const orphanedIds = []
  const urlsToDelete = []

  for (const stu of stuRecords) {
    const autorId = stu.dados?.autorId
    const dateStr = stu.created_at || stu.dados?.dataEnvio
    if (!autorId || !dateStr) {
      console.warn(`STU report ${stu.id} missing autorId or dateStr, marking as possible orphan.`)
      orphanedIds.push(stu.id)
      continue
    }

    const createdDate = new Date(dateStr)
    const minTime = createdDate.getTime() - 2 * 60000
    const maxTime = createdDate.getTime() + 2 * 60000

    // Find a matching COLAB
    const matchedColab = colabRecords.find(colab => {
      const colabAutorId = colab.dados?.autorId
      const colabDateStr = colab.created_at || colab.dados?.dataEnvio
      if (!colabAutorId || !colabDateStr) return false

      const colabTime = new Date(colabDateStr).getTime()
      if (colabAutorId !== autorId) return false
      if (colabTime < minTime || colabTime > maxTime) return false
      
      const colabTitulo = (colab.titulo || '').replace('Relatório: ', '')
      if (colabTitulo && stu.titulo && stu.titulo.includes(colabTitulo)) {
          return true
      }
      return true // Fallback if titles don't perfectly match but autor and time match
    })

    if (!matchedColab) {
      orphanedIds.push(stu.id)
      if (stu.dados?.anexos && Array.isArray(stu.dados.anexos)) {
         urlsToDelete.push(...stu.dados.anexos)
      }
    }
  }

  console.log(`\nFound ${orphanedIds.length} orphaned STU reports.`)
  if (orphanedIds.length > 0) {
    fs.writeFileSync('orphaned_reports.json', JSON.stringify({ orphanedIds, urlsToDelete }, null, 2))
    console.log(`Details saved to orphaned_reports.json`)
  }
}

run()
