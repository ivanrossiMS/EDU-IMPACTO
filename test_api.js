const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: '.env.local'});
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('alunos').select('id, nome, turma, status, dados').limit(5).then(res => {
  const students = res.data;
  const formatted = students.map(student => {
    const d = student.dados || {};
    return {
      ...student,
      responsaveis: d.responsaveis,
      _responsaveis: d._responsaveis,
      responsavel: d.responsavel,
      cpf_responsavel: d.cpf_responsavel || d.cpfResponsavel,
      email_responsavel: d.email_responsavel || d.emailResponsavel,
      celular_responsavel: d.celular_responsavel || d.telResponsavel,
      dados: {
        historicoTurmas: [],
        responsaveis: d.responsaveis,
        _responsaveis: d._responsaveis,
        responsavel: d.responsavel,
        cpf_responsavel: d.cpf_responsavel,
        email_responsavel: d.email_responsavel,
        celular_responsavel: d.celular_responsavel,
        cpfResponsavel: d.cpfResponsavel,
        emailResponsavel: d.emailResponsavel,
        telResponsavel: d.telResponsavel,
        codigo: d.codigo,
        email: d.email
      }
    };
  });
  console.log(JSON.stringify(formatted, null, 2));
});
