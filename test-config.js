const http = require('http');

function makeReq(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  // Use session cookie of a user if we could, but let's bypass proxy.ts by hitting the route handler directly?
  // We can't easily hit the route handler without going through Next.js server.
})();
