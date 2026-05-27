require('dotenv').config({ path: '.env.local' });
async function run() {
  const url = `http://localhost:3000/api/agenda/meus-alunos?respId=&email=auxiliadorahonorio41@gmail.com&nome=maria%20auxiliadora%20de%20araújo%20honório%20vilela`;
  const res = await fetch(url);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
run();
