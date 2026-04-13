const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('route.ts')) results.push(file);
    }
  });
  return results;
}

const files = walk('app/api');
let count = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Only target APIs that use pure supabaseServer and don't already have protected client
  if (content.includes('supabaseServer') && !content.includes('createProtectedClient') && !content.includes('getPublicSupabase')) {
    
    // Replace import
    content = content.replace(
      /import\s+\{\s*supabaseServer\s*\}\s+from\s+['"]@\/lib\/supabase['"]/,
      "import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'"
    );

    // Add awaited client to GET/POST/PUT/DELETE
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    methods.forEach(method => {
      const regex = new RegExp(`(export\\s+async\\s+function\\s+${method}\\s*\\([^)]*\\)\\s*\\{)`);
      if (regex.test(content) && content.includes('supabaseServer')) {
        content = content.replace(regex, "$1\n  const supabase = await createProtectedClient();");
      }
    });

    // Sub pattern for arrow functions assigned to exported methods
    // some might be: export const GET = async (req: Request) => {
    methods.forEach(method => {
      const regex = new RegExp(`(export\\s+const\\s+${method}\\s*=\\s*async\\s*\\([^)]*\\)\\s*=>\\s*\\{)`);
      if (regex.test(content) && content.includes('supabaseServer')) {
        content = content.replace(regex, "$1\n  const supabase = await createProtectedClient();");
      }
    });

    // Replace all usages of supabaseServer with our new client
    content = content.replace(/supabaseServer/g, 'supabase');
    
    fs.writeFileSync(file, content);
    count++;
  }
}

console.log(`Successfully migrated ${count} API routes to createProtectedClient (RLS Protected)`);
