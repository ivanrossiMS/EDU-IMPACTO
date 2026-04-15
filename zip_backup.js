const fs = require('fs');
const archiver = require('archiver');
const path = require('path');

const outputName = `backup-edu-impacto-2026-04-14-${new Date().getHours()}-${new Date().getMinutes()}.zip`;
const output = fs.createWriteStream(path.join(__dirname, outputName));
const archive = archiver('zip', {
  zlib: { level: 9 }
});

output.on('close', function() {
  console.log(`Zip file created successfully at ${outputName}`);
  console.log(archive.pointer() + ' total bytes');
});

archive.on('error', function(err) {
  throw err;
});

archive.pipe(output);

const excludes = ['node_modules', '.next', '.git', '.gemini', '.turbo'];

function appendDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (excludes.includes(file)) continue;
    
    // ignore zip files in root to avoid recursive inclusion just in case
    if (dir === './' && file.endsWith('.zip')) continue;

    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    // Make sure we use forward slashes for zip entries
    const name = fullPath.split(path.sep).join('/');
    
    if (stat.isDirectory()) {
      appendDirectory(fullPath);
    } else {
      archive.file(fullPath, { name: name });
    }
  }
}

// Ensure the zip is rooted at impacto-edu-app prefix if wanted, 
// here we just archive the contents
appendDirectory('./');
archive.finalize();
