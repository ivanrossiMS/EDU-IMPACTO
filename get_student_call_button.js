const fs = require('fs');
const content = fs.readFileSync('app/agenda-digital/[slug]/layout.tsx', 'utf-8');
const lines = content.split('\n');
console.log(lines.slice(95, 145).join('\n'));
