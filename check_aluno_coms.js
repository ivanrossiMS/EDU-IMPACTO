require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const alunoId = '4697';
  
  // 1. Get student data
  const { data: alunoData } = await supabase.from('alunos').select('id, nome, turma, created_at, dados').eq('id', alunoId).single();
  console.log('Aluno:', alunoData.nome, '| Turma:', alunoData.turma);
  
  // 2. Resolve turma name
  let turmaNome = null;
  if (alunoData.turma) {
    const { data: tData } = await supabase.from('turmas').select('nome').or(`id.eq."${alunoData.turma}",codigo.eq."${alunoData.turma}",nome.eq."${alunoData.turma}"`).maybeSingle();
    turmaNome = tData?.nome || alunoData.turma;
  }
  console.log('Turma Resolvida:', turmaNome);

  // 3. Resolve matricula date
  const dateStr = alunoData.dados?.data_matricula || alunoData.dados?.data_inicio || alunoData.dados?.data_ingresso || alunoData.created_at;
  const accessStartDate = new Date(dateStr);
  console.log('Access Start Date:', accessStartDate);

  // 4. Find all comunicados
  let orQuery = `dados->>alunosIds.cs.[{"${alunoId}"}],dados->>alunosIds.cs.["${alunoId}"]`;
  if (turmaNome) {
    orQuery += `,turmas.cs.{"${turmaNome}"},turmas.cs.["${turmaNome}"]`;
  }
  orQuery += `,destinatario_perfil.eq.Todos`;
  
  const { data: coms } = await supabase
    .from('comunicados')
    .select('id, titulo, created_at, dados, turmas, destinatario_perfil')
    .or(orQuery)
    .not('id', 'like', 'AD-COM-REL-COLAB-%') // User doesn't see grouped parents
    .gte('created_at', accessStartDate.toISOString())
    .order('created_at', { ascending: false });
    
  console.log(`\nFound ${coms?.length || 0} comunicados for aluno ${alunoId}:`);
  coms?.forEach(c => {
    console.log(`- ${c.titulo} | ID: ${c.id} | Date: ${c.created_at} | Turmas: ${JSON.stringify(c.turmas)} | Alunos: ${JSON.stringify(c.dados?.alunosIds)}`);
  });
}
check();
