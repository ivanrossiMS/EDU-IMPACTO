const fs = require('fs');
let code = fs.readFileSync('app/api/comunicados_respostas/route.ts', 'utf8');

const targetStr = `    let finalComunicadoId = body.comunicado_id;`;

const replacement = `    let finalComunicadoId = body.comunicado_id;

    // Se o admin responder a um relatorio agrupado, o frontend (que nao tem os filhos carregados)
    // enviara o ID do pai (COLAB). Precisamos encontrar o filho (STU) correspondente ao aluno.
    if (serverIsAdmin && finalComunicadoId.startsWith('AD-COM-REL-COLAB')) {
      const { data: parentCom } = await supabase
        .from('comunicados')
        .select('created_at, dados')
        .eq('id', finalComunicadoId)
        .single();
        
      if (parentCom && parentCom.dados && parentCom.dados.autorId) {
        const pTime = new Date(parentCom.created_at).getTime();
        const minDate = new Date(pTime - 15000).toISOString();
        const maxDate = new Date(pTime + 15000).toISOString();
        
        const { data: stus } = await supabase
          .from('comunicados')
          .select('id, dados')
          .ilike('id', 'AD-COM-REL-STU-%')
          .gte('created_at', minDate)
          .lte('created_at', maxDate);
          
        if (stus && stus.length > 0) {
          const child = stus.find(s => s.dados && s.dados.autorId === parentCom.dados.autorId && (s.dados.alunosIds || []).some(id => String(id) === String(body.remetente_id)));
          if (child) {
            finalComunicadoId = child.id;
          }
        }
      }
    }`;

if (code.includes(targetStr) && !code.includes('Se o admin responder a um relatorio agrupado')) {
  code = code.replace(targetStr, replacement);
  fs.writeFileSync('app/api/comunicados_respostas/route.ts', code);
  console.log('Patched POST /api/comunicados_respostas');
} else {
  console.log('Already patched or target string not found');
}
