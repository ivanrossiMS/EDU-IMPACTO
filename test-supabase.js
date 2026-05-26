const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const url = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
const key = envLocal.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from('saida_config').select('*');
  console.log(data, error);
}

check();
