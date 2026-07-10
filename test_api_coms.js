require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const alunoId = '4697';
  const { data: alunoRes } = await supabase.from('alunos').select('turma, created_at, dados').eq('id', alunoId).single();
  let resolvedTurma = null;
  if (alunoRes.turma) {
    const { data: tData } = await supabase.from('turmas').select('nome').or(`id.eq."${alunoRes.turma}",codigo.eq."${alunoRes.turma}",nome.eq."${alunoRes.turma}"`).maybeSingle();
    resolvedTurma = tData?.nome || alunoRes.turma;
  }
  
  console.log('Resolved Turma:', resolvedTurma);
  
  const { data: gruposRes } = await supabase.from('agenda_grupos').select('nome, dados');
  const allGrupos = gruposRes || [];
  
  const studentGroups = allGrupos.filter(g => g.dados && g.dados.alunos && Array.isArray(g.dados.alunos) && g.dados.alunos.some(a => String(a.id) === String(alunoId))).map(g => g.nome);
  console.log('Student Groups:', studentGroups);
  
  let query = supabase.from('comunicados').select('id, titulo, turmas, grupos, dados, destinatario_perfil').not('id', 'like', 'AD-COM-REL-COLAB-%');
  
  let orConditions = [];
  orConditions.push(`dados->>alunosIds.cs.[{"${alunoId}"}]`);
  orConditions.push(`dados->>alunosIds.cs.["${alunoId}"]`);
  
  if (resolvedTurma) {
    orConditions.push(`turmas.cs.{"${resolvedTurma}"}`);
    orConditions.push(`turmas.cs.["${resolvedTurma}"]`);
  }
  if (studentGroups.length > 0) {
    studentGroups.forEach(g => {
      orConditions.push(`grupos.cs.{"${g}"}`);
      orConditions.push(`grupos.cs.["${g}"]`);
    });
  }
  
  orConditions.push(`destinatario_perfil.eq.Todos`);
  
  query = query.or(orConditions.join(','));
  
  const { data, error } = await query;
  console.log('Error:', error);
  console.log('Found:', data?.length);
  if (data) {
    data.forEach(c => console.log(c.id, c.titulo, c.destinatario_perfil));
  }
}
check();
