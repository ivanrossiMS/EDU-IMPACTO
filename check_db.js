const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  console.log("Supabase URL:", supabaseUrl);
  console.log("Using Key (first 10 chars):", supabaseKey ? supabaseKey.substring(0, 10) : "undefined");

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("\n--- Checking Table gp_materiais_divulgacao ---");
  const { data, error } = await supabase
    .from('gp_materiais_divulgacao')
    .select('*');

  if (error) {
    console.error("Error fetching table gp_materiais_divulgacao:", error);
  } else {
    console.log("Success! Data fetched:", data);
  }
}

run();
