const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

const supabaseServer = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: { users }, error } = await supabaseServer.auth.admin.listUsers();
  const ivan = users.find(u => u.email === 'ivanrossims@gmail.com' || u.phone === '5561996580556');
  console.log(ivan ? ivan.user_metadata : 'Not found in first page');
}
main();
