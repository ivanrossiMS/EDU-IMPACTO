import fetch from 'node-fetch';
async function run() {
  const res = await fetch('http://localhost:3000/api/alunos?status=inativo');
  const text = await res.text();
  console.log(text.substring(0, 500));
}
run();
