require('dotenv').config({ path: '.env.local' })
const fetch = require('node-fetch')

async function check() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/?apikey=' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const res = await fetch(url, {
    headers: {
      'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Accept': 'application/openapi+json'
    }
  })
  const schema = await res.json()
  const altTable = schema.definitions.simulados_alternativas || schema.components.schemas.simulados_alternativas
  console.log("Keys:", altTable ? Object.keys(altTable.properties) : 'NOT FOUND')
}
check()
