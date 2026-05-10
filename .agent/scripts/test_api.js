const fs = require('fs');
const envStr = fs.readFileSync('.env.local', 'utf8');
const env = envStr.split('\n').reduce((acc, line) => {
  const [k, ...rest] = line.split('=');
  let v = rest.join('=');
  if (k && v) acc[k.trim()] = v.trim().replace(/^['"]|['"]$/g, '');
  return acc;
}, {});

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

fetch(`${url}/rest/v1/turmas?select=*&limit=1`, {
  headers: { apikey: key, Authorization: 'Bearer ' + key }
})
.then(r => r.json())
.then(d => {
  console.log("TURMAS COLUMNS:", Object.keys(d[0] || {}));
})
.catch(console.error);
