const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function test() {
  const file = fs.readFileSync('app/api/route.ts', 'utf8'); // fake, I need URL/Key from somewhere...
}
