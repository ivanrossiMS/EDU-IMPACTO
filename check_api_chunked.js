require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  let query = supabase
    .from('alunos')
    .select('id, nome, matricula, turma, serie, turno, status, email, data_nascimento, responsavel, responsavel_financeiro, responsavel_pedagogico, telefone, inadimplente, risco_evasao, media, frequencia, obs, unidade, foto, dados, updated_at, created_at')
    .order('nome', { ascending: true })
    .range(0, 999);

  const { data: students, error: studentsError } = await query;

  console.log("Total students fetched:", students?.length);

  const allStudentRefs = students.flatMap((s) => [
    s.id, 
    s.matricula, 
    s.dados?.codigo, 
    s.matricula ? String(s.matricula) : null, 
    s.dados?.codigo ? String(s.dados?.codigo) : null
  ]).filter(Boolean);

  console.log("allStudentRefs length:", allStudentRefs.length);

  let links = [];
  let linksError = null;
  const chunkSize = 200;
  for (let i = 0; i < allStudentRefs.length; i += chunkSize) {
    const chunk = allStudentRefs.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('aluno_responsavel')
      .select('*')
      .in('aluno_id', chunk);
    if (error) {
      linksError = error;
      break;
    }
    if (data) links.push(...data);
  }

  if (linksError) {
    console.error("linksError", linksError);
  } else {
    console.log("Total links fetched:", links?.length);
  }

  const respIds = links?.map((l) => l.responsavel_id).filter(Boolean) || [];
  let responsaveis = [];
  
  if (respIds.length > 0) {
    const uniqueRespIds = Array.from(new Set(respIds));
    const respChunkSize = 200;
    for (let i = 0; i < uniqueRespIds.length; i += respChunkSize) {
      const chunk = uniqueRespIds.slice(i, i + respChunkSize);
      const { data: respData, error: respError } = await supabase
        .from('responsaveis')
        .select('*')
        .in('id', chunk);
        
      if (respError) {
        console.error("respError", respError);
      } else if (respData) {
        responsaveis.push(...respData);
      }
    }
    console.log("Total responsaveis fetched:", responsaveis.length);
  }

  const formattedData = students.map((student) => {
    const studentRefs = [
      student.id, 
      student.matricula, 
      student.dados?.codigo, 
      student.matricula ? String(student.matricula) : null, 
      student.dados?.codigo ? String(student.dados?.codigo) : null
    ].filter(Boolean);
    
    // Exactly as in route.ts:
    const linkedResponsaveis = links?.filter((l) => studentRefs.includes(l.aluno_id))
      .map((l) => {
        const resp = responsaveis.find((r) => r.id === l.responsavel_id) || {};
        return {
          ...resp,
          parentesco: l.parentesco,
          isFinanceiro: l.resp_financeiro,
          isPedagogico: l.resp_pedagogico,
          isOutro: l.resp_outro,
          dataNasc: resp.data_nasc,
          diasAcesso: resp.dias_acesso
        };
      }).filter((r) => r.id) || [];

    const fallbackResponsaveis = student.dados?.responsaveis || [];

    return {
      id: student.id,
      nome: student.nome,
      responsaveis: linkedResponsaveis.length > 0 ? linkedResponsaveis : fallbackResponsaveis,
    };
  });

  for (const f of formattedData) {
    if (f.nome.includes("Alana")) {
      console.log(f.nome, "=> responsaveis count:", f.responsaveis.length);
    }
  }
}
run();
