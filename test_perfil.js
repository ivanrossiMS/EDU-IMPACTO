require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const slug = '4697';
  const responsavel_id = '80d393b7-63ec-473f-86d8-805eb20ad479';
  
    const { data: aluno, error: errorAluno } = await supabase
      .from('alunos')
      .select('id, nome, foto, turma, turno, status, matricula, dados')
      .eq('id', slug)
      .maybeSingle()

    if (aluno.turma) {
       const { data: turmaData } = await supabase
         .from('turmas')
         .select('nome, turno')
         .or(`id.eq."${aluno.turma}",codigo.eq."${aluno.turma}",nome.eq."${aluno.turma}"`)
         .maybeSingle()
       
       if (turmaData) {
         if (turmaData.nome) aluno.turma_nome = turmaData.nome
       } else {
         aluno.turma_nome = aluno.turma
       }
    } else {
       aluno.turma_nome = 'S/T'
    }

       const { data: links, error: linkError } = await supabase
         .from('aluno_responsavel')
         .select('parentesco, resp_financeiro, resp_pedagogico, responsaveis!fk_ar_responsavel(id, nome, email, rfid, dados, dias_acesso, proibido)')
         .eq('aluno_id', slug)
         
       let responsaveisDb = []
       if (!linkError && links && links.length > 0) {
         responsaveisDb = links.map((l) => {
            const respObj = Array.isArray(l.responsaveis) ? l.responsaveis[0] : l.responsaveis;
            return {
              id: respObj?.id,
              nome: respObj?.nome,
              diasAcesso: respObj?.dias_acesso || [],
              proibido: respObj?.proibido === true
            };
         });
       }

  console.log(JSON.stringify({
    aluno: { ...aluno, responsaveis: responsaveisDb },
    vinculo: null,
    meusAlunos: []
  }, null, 2))
}
run();
