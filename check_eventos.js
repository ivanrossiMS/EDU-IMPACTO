const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const env = envLocal.split('\n').reduce((acc, line) => {
  const [k, ...v] = line.split('=');
  if(k && v) acc[k] = v.join('=').trim().replace(/'/g, '').replace(/"/g, '');
  return acc;
}, {});

// We can just use the native fetch API to call the local endpoint, but we need to authenticate
// However, earlier we saw it returns 400 when we fetch manually.
// Instead of creating a Supabase client which requires the library,
// let's use standard POST using raw fetch to Supabase direct API.

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY'];

console.log('Testing Supabase directly:', supabaseUrl);

async function run() {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/eventos_agenda`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        dados: { titulo: 'Teste', teste: true }
      })
    });
    
    const text = await res.text();
    console.log('STATUS:', res.status);
    console.log('BODY:', text);
  } catch (err) {
    console.error(err);
  }
}

run();
