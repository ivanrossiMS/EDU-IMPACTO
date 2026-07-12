import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string)

async function run() {
  const alunoId = 4697
  
  // 1. Get aluno
  const { data: alunoRes } = await supabase.from('alunos').select('turma, created_at, dados').eq('id', alunoId).maybeSingle();
  let resolvedTurma = null;
  if (alunoRes && alunoRes.turma) {
    const { data: tData } = await supabase.from('turmas').select('nome').or(`id.eq."${alunoRes.turma}",codigo.eq."${alunoRes.turma}",nome.eq."${alunoRes.turma}"`).maybeSingle();
    resolvedTurma = tData?.nome || alunoRes.turma;
  }
  
  console.log('resolvedTurma:', resolvedTurma);
  
  // 2. Build query
  let query = supabase.from('momentos').select('*')
  
  const conditions = [];
  conditions.push(`dados->targetClasses.eq."[]"`);
  conditions.push(`dados->targetClasses.is.null`);
  
  if (resolvedTurma) {
    conditions.push(`dados->targetClasses.cs.["${resolvedTurma}"]`);
    conditions.push(`dados->targetClasses.cs.["Todos"]`);
    conditions.push(`dados->targetClasses.cs.["Toda a escola"]`);
    conditions.push(`dados->targetClasses.cs.["Toda a Escola"]`);
    conditions.push(`dados->targetClasses.cs.["Todas"]`);
  }
  
  conditions.push(`dados->alunosIds.cs.["${alunoId}"]`);
  conditions.push(`dados->alunosIds.cs.["a_${alunoId}"]`);
  conditions.push(`dados->alunosIds.cs.["_ALU${alunoId}"]`);
  
  console.log('conditions:', conditions.join(','));
  
  query = query.or(conditions.join(','));
  
  const { data, error } = await query.order('created_at', { ascending: false }).limit(5)
  console.log('Error:', error)
  console.log('Found momentos:', data?.length)
  data?.forEach(m => {
    console.log(m.id, m.dados?.targetClasses)
  })
}

run()
