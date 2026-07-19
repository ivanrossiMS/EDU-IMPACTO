fetch('http://localhost:3000/api/gestao-pessoas/pesquisas/48351d0a-1db5-4ed5-b177-ae331eb07f71', {
  headers: {
    // try to fetch without auth to see if we get the data (if the API is unprotected? Wait, the API uses requireAuth)
  }
}).then(res => res.text()).then(console.log).catch(console.error);
