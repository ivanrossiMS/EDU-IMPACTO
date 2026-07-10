require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
sb.from('aluno_responsavel').select('*').limit(2).then(r => console.log('aluno_responsavel:', r.data));
sb.from('responsaveis').select('*').limit(2).then(r => console.log('responsaveis:', r.data));
sb.from('alunos').select('id, nome, responsaveis').limit(2).then(r => console.log('alunos:', JSON.stringify(r.data)));
