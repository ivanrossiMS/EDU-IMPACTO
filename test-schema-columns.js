require('dotenv').config({ path: '.env.local' })
const fetch = require('node-fetch')

async function check() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/?apikey=' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const res = await fetch(url)
  const schema = await res.json()
  const qTable = schema.definitions.simulados_questoes
  console.log("Columns:", Object.keys(qTable.properties))
}
check()
