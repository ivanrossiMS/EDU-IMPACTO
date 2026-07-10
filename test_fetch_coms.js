async function run() {
  const res = await fetch('http://localhost:3000/api/comunicados?aluno_id=4697', {
    headers: {
      // we need auth to fetch this endpoint unless it's unprotected
    }
  });
  console.log(res.status);
}
run();
