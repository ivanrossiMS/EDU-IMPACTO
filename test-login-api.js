const fetch = require('node-fetch');
(async () => {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test', password: 'test' })
  });
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Response:', text);
})();
