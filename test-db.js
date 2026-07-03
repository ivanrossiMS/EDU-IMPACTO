const { createClient } = require('@supabase/supabase-js');

const url = 'https://lrpwerkkqrjkcauofhph.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxycHdlcmtrcXJqa2NhdW9maHBoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQwMDMyNiwiZXhwIjoyMDkwOTc2MzI2fQ.xZItcnXa9ssv1z6aLMmnZTmluT_ktn_HhS59J7eyEL4'; // Service Role
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('provas_upload_requisicoes').select(`
    *,
    simulados_disciplinas(nome),
    professores(nome)
  `).limit(5);

  if (error) {
    console.error('Error with relation:', error.message);
    const { data: d2, error: e2 } = await supabase.from('provas_upload_requisicoes').select('*').limit(5);
    console.log('Data without relation:', d2);
  } else {
    console.log('Data:', JSON.stringify(data, null, 2));
  }
}

run();
