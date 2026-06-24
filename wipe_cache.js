const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const supabaseUrlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=([^\n]+)/);
const supabaseKeyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=([^\n]+)/);

const supabaseUrl = supabaseUrlMatch[1].trim();
const supabaseKey = supabaseKeyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
  const { data, error } = await supabase.from('saida_calls').delete().gte('created_at', '2020-01-01T00:00:00Z');
  if (error) console.error("Error:", error);
  else console.log("Deleted old calls");
}
fix();
