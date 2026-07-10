const fs = require('fs');
let code = fs.readFileSync('app/login/page.tsx', 'utf8');

// 1. Add ModernLoadingSpinner component if not exists
const spinnerCode = `
const ModernLoadingSpinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'absolute', inset: 0, background: 'inherit', borderRadius: 'inherit', zIndex: 10 }}>
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      border: '3px solid rgba(255,255,255,0.1)',
      borderTopColor: '#fff',
      animation: 'spin 0.8s linear infinite',
      boxShadow: '0 0 15px rgba(255,255,255,0.2)'
    }} />
    <style dangerouslySetInnerHTML={{__html: \`@keyframes spin { to { transform: rotate(360deg); } }\`}} />
  </div>
);
`;
if (!code.includes('ModernLoadingSpinner')) {
    code = code.replace('export default function LoginScreen() {', spinnerCode + '\nexport default function LoginScreen() {');
}

// 2. Add loadingSystem state
const stateCode = "  const [loadingSystem, setLoadingSystem] = useState<string | null>(null)";
if (!code.includes('loadingSystem, setLoadingSystem')) {
    code = code.replace("const [faLoading, setFaLoading] = useState(false)", "const [faLoading, setFaLoading] = useState(false)\n" + stateCode);
}

// 3. Update the buttons to use the loading state
const gestaoEscolarClick = `onClick={() => {
                  const p = pendingAuth?.perfil;
                  if (p === 'Professor') window.location.href = '/professor';
                  else window.location.href = '/dashboard';
                }}`;
const newGestaoEscolarClick = `onClick={() => {
                  setLoadingSystem('gestao-escolar');
                  const p = pendingAuth?.perfil;
                  if (p === 'Professor') window.location.href = '/professor';
                  else window.location.href = '/dashboard';
                }}`;
code = code.replace(gestaoEscolarClick, newGestaoEscolarClick);

const agendaDigitalClick = `onClick={() => {
                  const p = pendingAuth?.perfil;
                  if (p === 'Diretor Geral' || pendingAuth?.cargo === 'Administrador Master') {
                      window.location.href = '/agenda-digital/selecionar-perfil-admin';
                  } else {
                      window.location.href = '/agenda-digital/selecionar-aluno';
                  }
                }}`;
const newAgendaDigitalClick = `onClick={() => {
                  setLoadingSystem('agenda-digital');
                  const p = pendingAuth?.perfil;
                  if (p === 'Diretor Geral' || pendingAuth?.cargo === 'Administrador Master') {
                      window.location.href = '/agenda-digital/selecionar-perfil-admin';
                  } else {
                      window.location.href = '/agenda-digital/selecionar-aluno';
                  }
                }}`;
code = code.replace(agendaDigitalClick, newAgendaDigitalClick);

const gestaoPessoasClick = `onClick={() => {
                  window.location.href = '/gestao-pessoas';
                }}`;
const newGestaoPessoasClick = `onClick={() => {
                  setLoadingSystem('gestao-pessoas');
                  window.location.href = '/gestao-pessoas';
                }}`;
code = code.replace(gestaoPessoasClick, newGestaoPessoasClick);

const provasClick = `onClick={() => {
                  window.location.href = '/simulados';
                }}`;
const newProvasClick = `onClick={() => {
                  setLoadingSystem('simulados');
                  window.location.href = '/simulados';
                }}`;
code = code.replace(provasClick, newProvasClick);

// 4. Inject the spinner into each button
const gestaoEscolarIcon = `<div style={{ width:64, height:64, borderRadius:20, background:'linear-gradient(135deg, #3b82f6, #2563eb)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, boxShadow:'0 10px 24px rgba(59,130,246,0.4)' }}>🏢</div>`;
const gestaoEscolarIconWithSpinner = `{loadingSystem === 'gestao-escolar' ? <ModernLoadingSpinner /> : null}
                <div style={{ width:64, height:64, borderRadius:20, background:'linear-gradient(135deg, #3b82f6, #2563eb)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, boxShadow:'0 10px 24px rgba(59,130,246,0.4)', opacity: loadingSystem === 'gestao-escolar' ? 0 : 1, transition: 'opacity 0.3s' }}>🏢</div>`;
code = code.replace(gestaoEscolarIcon, gestaoEscolarIconWithSpinner);

const agendaDigitalIcon = `<div style={{ width:64, height:64, borderRadius:20, background:'linear-gradient(135deg, #8b5cf6, #6d28d9)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, boxShadow:'0 10px 24px rgba(139,92,246,0.4)' }}>📱</div>`;
const agendaDigitalIconWithSpinner = `{loadingSystem === 'agenda-digital' ? <ModernLoadingSpinner /> : null}
                <div style={{ width:64, height:64, borderRadius:20, background:'linear-gradient(135deg, #8b5cf6, #6d28d9)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, boxShadow:'0 10px 24px rgba(139,92,246,0.4)', opacity: loadingSystem === 'agenda-digital' ? 0 : 1, transition: 'opacity 0.3s' }}>📱</div>`;
code = code.replace(agendaDigitalIcon, agendaDigitalIconWithSpinner);

const gestaoPessoasIcon = `<div style={{ width:64, height:64, borderRadius:20, background:'linear-gradient(135deg, #10b981, #059669)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, boxShadow:'0 10px 24px rgba(16,185,129,0.4)' }}>👥</div>`;
const gestaoPessoasIconWithSpinner = `{loadingSystem === 'gestao-pessoas' ? <ModernLoadingSpinner /> : null}
                <div style={{ width:64, height:64, borderRadius:20, background:'linear-gradient(135deg, #10b981, #059669)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, boxShadow:'0 10px 24px rgba(16,185,129,0.4)', opacity: loadingSystem === 'gestao-pessoas' ? 0 : 1, transition: 'opacity 0.3s' }}>👥</div>`;
code = code.replace(gestaoPessoasIcon, gestaoPessoasIconWithSpinner);

const provasIcon = `<div style={{ width:64, height:64, borderRadius:20, background:'linear-gradient(135deg, #f43f5e, #be123c)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, boxShadow:'0 10px 24px rgba(244,63,94,0.4)' }}>📝</div>`;
const provasIconWithSpinner = `{loadingSystem === 'simulados' ? <ModernLoadingSpinner /> : null}
                <div style={{ width:64, height:64, borderRadius:20, background:'linear-gradient(135deg, #f43f5e, #be123c)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, boxShadow:'0 10px 24px rgba(244,63,94,0.4)', opacity: loadingSystem === 'simulados' ? 0 : 1, transition: 'opacity 0.3s' }}>📝</div>`;
code = code.replace(provasIcon, provasIconWithSpinner);

// Add relative position and overflow hidden to buttons so the spinner overlays them beautifully
const btnStyle1 = `style={{ flex:'1 1 200px', padding:'32px 24px', borderRadius:24, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', backdropFilter:'blur(20px)', cursor:'pointer', transition:'all 0.3s', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, minWidth: '180px' }}`;
const newBtnStyle1 = `style={{ position: 'relative', overflow: 'hidden', flex:'1 1 200px', padding:'32px 24px', borderRadius:24, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', backdropFilter:'blur(20px)', cursor:'pointer', transition:'all 0.3s', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, minWidth: '180px' }}`;
code = code.replaceAll(btnStyle1, newBtnStyle1);

fs.writeFileSync('app/login/page.tsx', code);
console.log('Success');
