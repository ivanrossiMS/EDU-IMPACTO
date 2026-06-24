require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  const { data, error } = await supabase.rpc('get_column_type', {
    table_name: 'system_users',
    column_name: 'id'
  });
  console.log("If RPC fails, let's just query pg_attribute directly if we could");
  // Let's run a direct SQL using postgres if we have it, or just trust the user error
}

run()
