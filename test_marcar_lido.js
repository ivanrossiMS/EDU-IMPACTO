const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

async function main() {
  const response = await fetch('http://localhost:3000/api/agenda/notificacoes/marcar-lido', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tipo: 'comunicado',
      ids: ['AD-COM-REL-STU-1783786196236'], // just a random ID
      alunoId: '4978'
    })
  });
  console.log(response.status);
  const text = await response.text();
  console.log(text);
}
main();
