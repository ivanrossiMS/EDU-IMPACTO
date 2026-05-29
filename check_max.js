require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: respData, error } = await supabase
    .from('responsaveis')
    .select('id')
    .limit(20000);

  if (error) {
    console.error(error);
  } else {
    console.log("Total responsaveis fetched:", respData.length);
  }
}

run();
