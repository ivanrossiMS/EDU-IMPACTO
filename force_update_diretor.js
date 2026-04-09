const fs = require('fs');

const content = fs.readFileSync('c:/Users/ivanr/OneDrive/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/app/(app)/configuracoes/usuarios/page.tsx', 'utf-8');

// I will extract MODULES_CONFIG from page.tsx to get all valid keys!
const match = content.match(/const MODULES_CONFIG = \[(.*?)\]/s);
if (!match) {
    console.log('Failed to find MODULES_CONFIG');
    process.exit(1);
}

// Just regex out all keys using key: '...'
const keys = [];
const keyRegex = /key:\s*'([^']+)'/g;
let kMatch;
while ((kMatch = keyRegex.exec(content)) !== null) {
   keys.push(kMatch[1]);
}
const allKeys = Array.from(new Set(keys)).filter(k => k && k.length > 2);

console.log("Found " + allKeys.length + " keys.");

const S_URL = 'https://lrpwerkkqrjkcauofhph.supabase.co';
const S_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxycHdlcmtrcXJqa2NhdW9maHBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MDAzMjYsImV4cCI6MjA5MDk3NjMyNn0.1-_0vMiLn0Y9piS90150Ur7qx8ic1Kz64RuhiaVGLhg';

(async () => {
    // try to fetch from system_perfis
    const getRes = await fetch(S_URL + '/rest/v1/system_perfis?nome=eq.Diretor%20Geral', {
      headers: { 'apikey': S_KEY, 'Authorization': 'Bearer ' + S_KEY }
    });
    
    if (!getRes.ok) {
       console.log("DB connection error:", await getRes.text());
       return;
    }
    const perfis = await getRes.json();
    if (!perfis || perfis.length === 0) {
       console.log('No Diretor Geral found in DB! Creating one...');
       const postRes = await fetch(S_URL + '/rest/v1/system_perfis', {
           method: 'POST',
           headers: { 'apikey': S_KEY, 'Authorization': 'Bearer ' + S_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
           body: JSON.stringify({
               id: 'P1',
               nome: 'Diretor Geral',
               descricao: 'Acesso total ao sistema',
               cor: '#ef4444',
               permissoes: allKeys
           })
       });
       if (postRes.ok) console.log("Created successfully with all keys!");
       else console.log("Error creating:", await postRes.text());
       return;
    }
    
    const diretor = perfis[0];
    const patchRes = await fetch(S_URL + '/rest/v1/system_perfis?id=eq.' + diretor.id, {
       method: 'PATCH',
       headers: { 
         'apikey': S_KEY, 
         'Authorization': 'Bearer ' + S_KEY,
         'Content-Type': 'application/json',
         'Prefer': 'return=minimal'
       },
       body: JSON.stringify({ permissoes: allKeys })
    });
    
    if (patchRes.ok) {
        console.log('Update success: Diretor Geral now has ALL ' + allKeys.length + ' permissions.');
    } else {
        console.log('Patch failed:', await patchRes.text());
    }
})();
