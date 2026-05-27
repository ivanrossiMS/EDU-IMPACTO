const fs = require('fs');
const content = fs.readFileSync('lib/useSupabaseCollection.ts', 'utf-8');
const match = content.match(/if \(!endpoint\) return \[/);
console.log(match ? 'Found !endpoint check' : 'Not found !endpoint check');
