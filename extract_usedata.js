const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all files containing useData()
const filesStr = execSync('grep -rl "useData()" app/ components/ --include="*.tsx" --include="*.ts"').toString();
const files = filesStr.split('\n').filter(Boolean);

const results = {};

for (const file of files) {
  const content = fs.readFileSync(file, 'utf-8');
  // Match `const { ... } = useData()` or `const { ... } = useData() as any`
  // This is a naive regex but might work for most cases.
  const regex = /const\s+\{([^}]+)\}\s*=\s*useData\(\)/g;
  let match;
  let vars = new Set();
  while ((match = regex.exec(content)) !== null) {
    const destructured = match[1];
    // Split by comma, remove default values or aliases (e.g., `turmas: myTurmas`, `loading = false`)
    const items = destructured.split(',').map(s => s.trim()).filter(Boolean);
    for (const item of items) {
      // Get the base variable name (before : or =)
      const varName = item.split(':')[0].split('=')[0].trim();
      if (varName) vars.add(varName);
    }
  }
  
  if (vars.size > 0) {
    results[file] = Array.from(vars);
  } else {
    // Maybe it was multiline or different syntax. Let's try to find it.
    // Let's just grab the whole file content and look for `useData()` line and lines around it.
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('useData()')) {
             let j = i;
             let statement = "";
             while(j >= 0 && !lines[j].includes('const {')) {
                 j--;
             }
             if (j>=0) {
                 for(let k=j; k<=i; k++) statement += lines[k];
                 const m = /const\s+\{([^}]+)\}\s*=\s*useData\(\)/.exec(statement);
                 if (m) {
                     const destructured = m[1];
                     const items = destructured.split(',').map(s => s.trim()).filter(Boolean);
                     for (const item of items) {
                       const varName = item.split(':')[0].split('=')[0].trim();
                       if (varName) vars.add(varName);
                     }
                 }
             }
        }
    }
    if (vars.size > 0) {
        results[file] = Array.from(vars);
    } else {
        results[file] = ["UNKNOWN_SYNTAX"];
    }
  }
}

fs.writeFileSync('usedata_analysis.json', JSON.stringify(results, null, 2));
console.log("Analysis complete. Found " + Object.keys(results).length + " files.");
