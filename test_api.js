fetch('http://localhost:3000/api/relatorios/demonstracao?inicio=2026-01-01&fim=2026-12-31&por=pagamento')
  .then(res => res.json())
  .then(data => {
    console.log(JSON.stringify(data, null, 2));
  })
  .catch(console.error);
