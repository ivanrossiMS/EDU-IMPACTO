const { performance } = require('perf_hooks');

async function run() {
  const t0 = performance.now();
  const res = await fetch("http://localhost:3000/api/comunicados");
  const t1 = performance.now();
  const text = await res.text();
  console.log(`Fetch without filter took ${t1 - t0}ms, returned ${text.length} bytes.`);
}
run();
