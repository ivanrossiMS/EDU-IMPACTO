const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local manually
const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#]+?)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[key] = value;
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: checkins } = await supabase.from('colaborador_checkin').select('*');
  console.log('Todos Checkins:', JSON.stringify(checkins, null, 2));

  const { data: func } = await supabase.from('funcionarios').select('id, nome, email').ilike('email', '%nawally%');
  console.log('Funcionarios:', JSON.stringify(func, null, 2));

  const { data: sysUsers } = await supabase.from('system_users').select('id, email, nome').ilike('email', '%nawally%');
  console.log('System Users:', JSON.stringify(sysUsers, null, 2));
}
run();
