const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function test() {
  const { data, error } = await supabase
    .from('chat_conversations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log("DATA:", data);
}
test();
