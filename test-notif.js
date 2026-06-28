const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const allGroupTerms = ['TODOS:2026'];
  const { data: allTurmas } = await supabase.from('turmas').select('id, nome, codigo, ano, dados');
  
  const matchedTurmaIds = (allTurmas || []).filter(t => {
    const tAno = t.ano !== undefined ? String(t.ano) : (t.dados?.anoLetivo || '');
    const isMatch = allGroupTerms.some(turma => {
      const tl = turma.toLowerCase().trim()
      if (tl.startsWith('todos:')) {
        const targetAno = tl.split(':')[1]?.trim()
        console.log(`Checking Turma ${t.id} - tAno: "${tAno}" vs targetAno: "${targetAno}"`);
        return targetAno === tAno
      }
      return false
    })
    return isMatch;
  }).map(t => String(t.id));
  
  console.log("matchedTurmaIds:", matchedTurmaIds);
}
run();
