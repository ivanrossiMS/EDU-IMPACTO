require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// We need to bypass auth check just to test the query logic for admin
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const turmaId = '4º ANO A';
  const alunoId = '4697';
  let query = supabase.from('comunicados').select('*');
  const conditions = [`destino.eq.todos`];
  conditions.push(`dados->turmas.cs.["${turmaId}"]`);
  conditions.push(`dados->alunosIds.cs.["${alunoId}"]`);
  conditions.push(`dados->alunosIds.cs.["a_${alunoId}"]`);
  conditions.push(`dados->alunosIds.cs.["_ALU${alunoId}"]`);
  query = query.or(conditions.join(','));
  
  query = query.order('data', { ascending: false });

  const { data, error } = await query;
  
  // Apply filtering as done in route.ts
  function normalizeRow(row) {
    const merged = { ...row, ...(row.dados || {}) }
    merged.status = merged.status || 'enviado'
    merged.prioridade = merged.prioridade || 'normal'
    if (!merged.conteudo && merged.texto) merged.conteudo = merged.texto
    if (!merged.dataEnvio && merged.data) merged.dataEnvio = merged.data
    return merged
  }

  const normalized = (data || []).map(normalizeRow);
  const isFamilyOrStudent = false; // ADMIN
  const filtered = isFamilyOrStudent
    ? normalized.filter((c) => c.destino !== 'interno')
    : normalized.filter((c) => !c.isSaudacao && !c.dados?.isSaudacao && c.titulo !== 'Mensagem de Boas-vindas');

  console.log("Returned filtered:", filtered.length);
  
  // Apply filtering as done in comunicados/page.tsx
  const UI_filtered = filtered.filter((c) => {
    if (c.destino === 'interno' || c.destino === 'funcionarios') return false;
    if (c.id && c.id.startsWith('AD-COM-REL-COLAB')) return false;
    if (c.tipo === 'AD-COM-REL-TURMA' || (c.id && c.id.startsWith('AD-COM-REL-TURMA'))) return false;
    return true;
  });

  console.log("UI filtered length:", UI_filtered.length);
}
run();
