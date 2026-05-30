const { GET } = require('./app/api/agenda/notificacoes/unread/route.ts');
// Wait, route.ts is in typescript. If we try to require a ts file in raw node, it might throw syntax error.
// We can use dynamic import or create a JS file with similar logic.
// Actually, let's write a node script that mocks the request object and runs the GET function by loading dotenv.
// Let's do it using ts-node or next dev runner, or just copy the visibility module logic and test if it works.
