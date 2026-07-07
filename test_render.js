const fs = require('fs');
const content = fs.readFileSync('app/(app)/simulados/page.tsx', 'utf8');
console.log('Includes criado_por_nome:', content.includes('criado_por_nome'));
console.log('Includes Criado por:', content.includes('Criado por:'));
