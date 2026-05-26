fetch('http://localhost:3000/api/saida/config', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ voiceEnabled: false, tvDisplayTime: 40 })
}).then(r => r.json().then(data => console.log(r.status, data)))
  .catch(console.error)
