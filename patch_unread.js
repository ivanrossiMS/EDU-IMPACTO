const fs = require('fs');
let code = fs.readFileSync('app/api/comunicados_respostas/route.ts', 'utf8');

const targetReturn = `    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }`;

const newReturn = `    // --- LÓGICA DE RESET DE LEITURA (NOVO/LIDO) ---
    try {
      const { data: comData } = await supabase.from('comunicados').select('id, created_at, dados, leituras').eq('id', finalComunicadoId).single();
      if (comData) {
        let leituras = comData.leituras || {};
        let usersToReset = [];

        if (!serverIsAdmin) {
           // Familia respondeu. O admin (autor) precisa ver como NOVO.
           const autorId = comData.dados?.autorId;
           if (autorId) usersToReset.push(autorId);
        } else {
           // Admin respondeu. A familia/aluno (remetente_id da conversa) precisa ver como NOVO.
           if (body.remetente_id) usersToReset.push(body.remetente_id);
        }

        if (usersToReset.length > 0) {
          let changed = false;
          usersToReset.forEach(uid => {
             if (leituras[uid]) {
                delete leituras[uid];
                changed = true;
             }
          });
          
          if (changed) {
             await supabase.from('comunicados').update({ leituras }).eq('id', finalComunicadoId);
          }
          
          // Se a resposta foi feita por uma familia num child report, temos que resetar o lido do PAI tambem pro Admin!
          if (!serverIsAdmin && finalComunicadoId.startsWith('AD-COM-REL-STU-')) {
             const autorId = comData.dados?.autorId;
             if (autorId) {
               const timeNum = new Date(comData.created_at).getTime();
               if (timeNum > 0) {
                 const minTime = new Date(timeNum - 15000).toISOString();
                 const maxTime = new Date(timeNum + 15000).toISOString();
                 // Busca o pai
                 const { data: parentCom } = await supabase.from('comunicados')
                   .select('id, leituras')
                   .eq('dados->>autorId', String(autorId))
                   .not('id', 'like', 'AD-COM-REL-STU-%')
                   .like('id', 'AD-COM-REL-%')
                   .gte('created_at', minTime)
                   .lte('created_at', maxTime)
                   .limit(1)
                   .single();
                   
                 if (parentCom && parentCom.leituras && parentCom.leituras[autorId]) {
                   let parentLeituras = parentCom.leituras;
                   delete parentLeituras[autorId];
                   await supabase.from('comunicados').update({ leituras: parentLeituras }).eq('id', parentCom.id);
                 }
               }
             }
          }
        }
      }
    } catch (resetErr) {
      console.error("Erro ao resetar status LIDO:", resetErr);
    }

    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }`;

code = code.replace(targetReturn, newReturn);
fs.writeFileSync('app/api/comunicados_respostas/route.ts', code);
console.log('Unread logic patched');
