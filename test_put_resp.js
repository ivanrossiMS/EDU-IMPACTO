require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const fs = require('fs');
  const code = fs.readFileSync('app/api/responsaveis/route.ts', 'utf-8');
  const putHandler = code.split('export async function PUT')[1].substring(0, 1500);
  console.log(putHandler);
}
run();
