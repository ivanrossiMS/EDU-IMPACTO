const puppeteer = require('puppeteer');
const { SignJWT } = require('jose');

const secretKey = 'impacto-edu-super-secret-key-2026-development-only';
const encodedKey = new TextEncoder().encode(secretKey);

async function createToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(encodedKey);
}

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log(`[CONSOLE] ${msg.text()}`));
  
  page.on('request', req => {
       if (req.url().includes('_rsc')) {
            console.log(`[NET-RSC] Requested: ${req.url()}`);
       }
  });

  page.on('response', async res => {
       if (res.url().includes('_rsc')) {
            console.log(`[NET-RSC] Response ${res.status()}: ${res.url()}`);
       }
  });
  
  const token = await createToken({
      id: "test",
      nome: "Admin",
      email: "admin@impacto.com",
      cargo: "Administrador",
      perfil: "Diretor Geral"
  });

  await page.goto('http://localhost:3000/academico/alunos', { waitUntil: 'networkidle2' });
  
  await page.evaluate((jwtToken) => {
    localStorage.setItem('edu-current-user', JSON.stringify({
      id: "test",
      nome: "Admin",
      email: "admin@impacto.com",
      cargo: "Administrador",
      perfil: "Diretor Geral"
    }));
    document.cookie = `edu-auth-token=${jwtToken}; path=/; max-age=43200; SameSite=Lax`;
  }, token);

  await page.goto('http://localhost:3000/academico/alunos', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  console.log("CLICKING BUTTON...");
  await page.evaluate(() => {
     const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Nova Matrícula') || b.textContent.includes('Cadastrar Primeiro Aluno'));
     if(btn) btn.click();
  });

  await new Promise(r => setTimeout(r, 4000));

  await browser.close();
})();
