const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteAll() {
  console.log('Fetching all comunicados...');
  const { data, error } = await supabase.from('comunicados').select('id');
  if (error) {
    console.error('Error fetching:', error);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log('No comunicados found.');
    return;
  }

  console.log(`Found ${data.length} comunicados. Deleting...`);
  
  // Supabase delete requires filters. To delete all, we can delete in chunks or by 'id' > 0, etc.
  // We can delete by matching all IDs.
  const ids = data.map(d => d.id);
  
  // Delete in chunks of 100 to avoid URL length limits if any
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { error: delError } = await supabase.from('comunicados').delete().in('id', chunk);
    if (delError) {
      console.error('Error deleting chunk:', delError);
    } else {
      console.log(`Deleted chunk ${i} to ${i + chunk.length - 1}`);
    }
  }
  
  console.log('Finished deleting all comunicados.');
}

deleteAll();
