import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if(!supabaseUrl || !supabaseKey) { console.log('No keys'); process.exit(0); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from('responsaveis')
    .select('*, aluno_responsavel(aluno:alunos(id, nome, turma, serie, frequencia, inadimplente, risco_evasao))')
    .limit(2);
    
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}

test();
