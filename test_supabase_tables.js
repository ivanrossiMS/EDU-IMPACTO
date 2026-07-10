require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
sb.from('responsaveis').select('*').limit(2).then(r => console.log('Responsaveis:', r.data));
sb.from('alunos').select('id, responsaveis, dados').limit(2).then(r => console.log('Alunos:', JSON.stringify(r.data)));
