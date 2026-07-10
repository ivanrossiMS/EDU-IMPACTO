const fs = require('fs');
let code = fs.readFileSync('app/api/comunicados/route.ts', 'utf8');

const injectTarget = `     const [readsRes, cienciasRes] = await Promise.all([
        supabaseServer.from('agenda_notification_reads').select('content_id, usuario_id, read_at').in('content_id', itemIds),
        supabaseServer.from('agenda_ciencias').select('content_id, usuario_id, ciente_em').in('content_id', itemIds)
     ]);
     allReads = readsRes.data || [];
     allCiencias = cienciasRes.data || [];`;

const injectCode = `     const [readsRes, cienciasRes] = await Promise.all([
        supabaseServer.from('agenda_notification_reads').select('content_id, usuario_id, read_at').in('content_id', itemIds),
        supabaseServer.from('agenda_ciencias').select('content_id, usuario_id, ciente_em').in('content_id', itemIds)
     ]);
     allReads = readsRes.data || [];
     allCiencias = cienciasRes.data || [];

     // Fetch reads for dynamic STU reports related to COLAB reports
     const colabs = data.filter((d: any) => d.id && String(d.id).startsWith('AD-COM-REL-COLAB-'));
     if (colabs.length > 0) {
       const colabReadsPromises = colabs.map(async (colab: any) => {
         try {
           const dateStr = colab.created_at || (colab.dados && colab.dados.dataEnvio);
           if (!dateStr) return null;
           const createdDate = new Date(dateStr);
           if (isNaN(createdDate.getTime())) return null;
           
           const minDate = new Date(createdDate.getTime() - 2 * 60000).toISOString();
           const maxDate = new Date(createdDate.getTime() + 2 * 60000).toISOString();
           const autorId = colab.dados && colab.dados.autorId;
           if (!autorId) return null;
           
           const { data: stus } = await supabaseServer.from('comunicados')
             .select('id, dados')
             .ilike('id', 'AD-COM-REL-STU-%')
             .gte('created_at', minDate)
             .lte('created_at', maxDate);
             
           const filteredStus = (stus || []).filter((s: any) => s.dados && s.dados.autorId === autorId);
           if (filteredStus.length === 0) return null;
           
           const { data: stuReads } = await supabaseServer.from('agenda_notification_reads')
             .select('content_id, usuario_id, read_at')
             .in('content_id', filteredStus.map((s: any) => s.id));
             
           return { colabId: colab.id, reads: stuReads || [] };
         } catch(e) {
           console.error('Error fetching dynamic reads:', e);
           return null;
         }
       });
       
       const colabReadsResults = await Promise.all(colabReadsPromises);
       for (const res of colabReadsResults) {
         if (!res) continue;
         for (const r of res.reads) {
           allReads.push({
             content_id: res.colabId,
             usuario_id: r.usuario_id,
             read_at: r.read_at
           });
         }
       }
     }`;

if (code.includes(injectTarget)) {
  fs.writeFileSync('app/api/comunicados/route.ts', code.replace(injectTarget, injectCode));
  console.log('Success');
} else {
  console.log('Target not found');
}
