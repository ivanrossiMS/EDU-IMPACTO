const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/comunicados?aluno_id=4697&limit=5',
  method: 'GET',
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('Returned items:', json.length);
      json.forEach(c => console.log(c.id, c.titulo));
    } catch(e) { console.log(data); }
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();
