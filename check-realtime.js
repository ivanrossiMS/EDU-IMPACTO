const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.rpc('get_realtime_tables'); // Or try checking pg_publication
  console.log("RPC get_realtime_tables:", error ? error.message : data);
  
  const query = `
    SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
  `;
  // We can't do direct SQL via JS client without an RPC, but we can just use the supabase CLI or another script.
}
check();
