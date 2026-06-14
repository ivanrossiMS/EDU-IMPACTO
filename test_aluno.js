const fs = require('fs');
const content = fs.readFileSync('app/agenda-digital/[slug]/layout.tsx', 'utf-8');
const match = content.match(/export default async function AgendaDigitalLayout[\s\S]*?(?=return)/);
if (match) console.log(match[0].substring(0, 1500));
