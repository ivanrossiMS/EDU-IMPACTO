async function run() {
  const url = `http://localhost:3000/api/?_t=${Date.now()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Status ' + res.status);
    const data = await res.text();
    console.log(data.substring(0, 300));
  } catch (e) {
    console.error(e.message);
  }
}
run();
