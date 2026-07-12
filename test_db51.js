const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

const supabaseServer = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabaseServer.rpc('test_constraint', { query: `
    SELECT constraint_name, pg_get_constraintdef(oid) 
    FROM pg_constraint 
    WHERE conrelid = 'agenda_notification_reads'::regclass
  ` });
  console.log(data || error);
}
main();
