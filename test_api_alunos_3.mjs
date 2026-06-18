import fetch from 'node-fetch';

async function run() {
  const res = await fetch('http://localhost:3000/api/alunos?limit=1');
  const json = await res.json();
  console.log(json);
}
run();
