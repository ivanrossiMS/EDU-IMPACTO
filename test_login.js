const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  
  console.log('Navigating to login...');
  await page.goto('http://localhost:3000/login');
  
  await page.evaluate(() => {
    // Manualmente executar a função que simula fetchAllUsersFromDB para inspecionar
    const sysDb = JSON.parse(localStorage.getItem('edu-sys-users') || '[]');
    const authDb = JSON.parse(localStorage.getItem('edu-auth-users') || '[]');
    const alunosDb = JSON.parse(localStorage.getItem('edu-sys-alunos') || '[]');
    
    console.log('--- LOCAL STORAGE DUMP ---');
    console.log('edu-auth-users:', JSON.stringify(authDb).substring(0, 500) + '...');
    console.log('edu-sys-alunos:', JSON.stringify(alunosDb).substring(0, 500) + '...');
    console.log('edu-sys-users:', JSON.stringify(sysDb).substring(0, 500) + '...');
  });

  await browser.close();
})();
