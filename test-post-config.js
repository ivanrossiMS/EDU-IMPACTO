const http = require('http');

const body = JSON.stringify({ rfidEnabled: true, voiceEnabled: false });

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/saida/config',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('STATUS:', res.statusCode, 'BODY:', data));
});

req.on('error', console.error);
req.write(body);
req.end();
