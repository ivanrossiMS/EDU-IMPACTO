const fs = require('fs');
const file = 'app/agenda-digital/components/Sidebar.tsx';
let code = fs.readFileSync(file, 'utf8');

// Replace `!isFamily && menuItems` with something that hides it for colaborador route
code = code.replace(
  /{!isFamily && menuItems.map/g,
  '{!isFamily && alunoId !== "colaborador" && menuItems.map'
);

code = code.replace(
  /{!isFamily && <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '16px 0' }} \/>}/g,
  '{!isFamily && alunoId !== "colaborador" && <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "16px 0" }} />}'
);

fs.writeFileSync(file, code);
