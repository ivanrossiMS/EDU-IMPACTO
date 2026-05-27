const fs = require('fs');
const content = fs.readFileSync('lib/useSupabaseCollection.ts', 'utf-8');
const match = content.match(/function useSupabaseArray[\s\S]*?return \[/);
console.log(match ? match[0] : 'not found');
