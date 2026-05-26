import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Attempt to select using ANON KEY (this simulates no auth / blocked by RLS)
  const { data, error } = await supabase.from('saida_config').select('*');
  console.log('Anon Select:', { data, error });
}

run();
