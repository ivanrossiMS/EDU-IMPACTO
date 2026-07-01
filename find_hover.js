const fs = require('fs');
const path = require('path');

function search(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            search(fullPath);
        } else if (fullPath.endsWith('.tsx')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.toLowerCase().includes('gerar com ia') && content.toLowerCase().includes('upload')) {
                console.log('FOUND IN:', fullPath);
            }
        }
    }
}

search('./app');
