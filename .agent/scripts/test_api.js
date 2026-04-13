require('dotenv').config({ path: '.env.local' });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

fetch(`${url}/rest/v1/aluno_responsavel?select=*&limit=1`, {
  headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
