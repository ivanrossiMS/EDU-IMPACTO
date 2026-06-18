import fetch from 'node-fetch';
async function run() {
  const url = 'http://localhost:3000/api/alunos?page=1&limit=10&status=inativo&sortField=nome&sortOrder=asc';
  console.log('Fetching:', url);
  const res = await fetch(url);
  const text = await res.text();
  console.log(text.substring(0, 500));
}
run();
