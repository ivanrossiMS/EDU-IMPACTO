async function run() {
  const baseUrl = "http://192.168.1.98:80";
  
  const loginRes = await fetch(`${baseUrl}/login.fcgi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: "admin", password: "Pass1081$" })
  });
  const loginData = await loginRes.json();
  const session = loginData.session;
  
  const usersRes = await fetch(`${baseUrl}/load_objects.fcgi`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `session=${session}`,
    },
    body: JSON.stringify({ object: 'users' })
  });
  
  const usersData = await usersRes.json();
  const users = usersData.users;
  console.log("Device total users:", users.length);
  const leandro = users.find(u => u.registration === '4002' || u.name.includes('Leandro'));
  console.log("Found Leandro:", leandro);
}
run().catch(console.error);
