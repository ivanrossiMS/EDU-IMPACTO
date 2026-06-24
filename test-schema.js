require('dotenv').config({ path: '.env.local' })
const fetch = require('node-fetch')

async function check() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/?apikey=' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const res = await fetch(url)
  const data = await res.json()
  const tables = Object.keys(data.definitions).filter(k => k.startsWith('simulado'))
  
  for (const t of tables) {
    console.log(`Table: ${t}`)
    const props = data.definitions[t].properties
    if (props) {
      console.log(Object.keys(props).join(', '))
    }
  }
}
check()
