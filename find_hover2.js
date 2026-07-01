const fs = require('fs');
const content = fs.readFileSync('app/(app)/simulados/banco/nova/page.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
    if (l.toLowerCase().includes('upload') || l.toLowerCase().includes('ia')) {
        console.log(i + 1, l);
    }
});
