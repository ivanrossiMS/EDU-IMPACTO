require('dotenv').config({ path: '.env.local' })
const fetch = require('node-fetch')

async function check() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/?apikey=' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const res = await fetch(url)
  const schema = await res.json()
  console.log("Schema keys:", Object.keys(schema))
  if (schema.definitions) {
    const keys = Object.keys(schema.definitions)
    console.log("Definitions found. First few:", keys.slice(0, 5))
  } else if (schema.components && schema.components.schemas) {
    const keys = Object.keys(schema.components.schemas)
    console.log("Components.schemas found. First few:", keys.slice(0, 5))
    console.log("simulados_alternativas:", Object.keys(schema.components.schemas.simulados_alternativas.properties))
  }
}
check()
