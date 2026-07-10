const fs = require('fs');
let code = fs.readFileSync('lib/agendaDigitalContext.tsx', 'utf8');

const target = `      fetchNextPageComunicados: comunicadosQuery.fetchNextPage,
      hasNextPageComunicados: comunicadosQuery.hasNextPage,
      fetchNextPageMomentos: momentosQuery.fetchNextPage,
      hasNextPageMomentos: momentosQuery.hasNextPage`;

const newCode = `      fetchNextPageComunicados: comunicadosQuery.fetchNextPage,
      hasNextPageComunicados: comunicadosQuery.hasNextPage,
      isFetchingNextPageComunicados: comunicadosQuery.isFetchingNextPage,
      fetchNextPageMomentos: momentosQuery.fetchNextPage,
      hasNextPageMomentos: momentosQuery.hasNextPage,
      isFetchingNextPageMomentos: momentosQuery.isFetchingNextPage`;

code = code.replace(target, newCode);
fs.writeFileSync('lib/agendaDigitalContext.tsx', code);
console.log('Patched context');
