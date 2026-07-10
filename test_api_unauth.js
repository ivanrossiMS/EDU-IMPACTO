const http = require('http');

async function test() {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/comunicados?aluno_id=4697&limit=5',
    method: 'GET',
    headers: {
      // Fake a user by passing a specific header or bypassing? I can't easily bypass.
    }
  };
}
