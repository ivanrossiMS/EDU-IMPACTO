const { ControliDClient } = require('./lib/controlid.js');

async function run() {
  const client = new ControliDClient({
      ip: "192.168.1.98",
      port: 80,
      login: "admin",
      password: "Pass1081$"
  });
  
  try {
    const usersRes = await client.loadUsers();
    const users = Array.isArray(usersRes) ? usersRes : usersRes.users;
    console.log("Device total users:", users.length);
    const leandro = users.find(u => u.registration === '4002' || u.name.includes('Leandro'));
    console.log("Found Leandro:", leandro);
  } catch (err) {
    console.error(err);
  }
}

// I need to use typescript or run it via ts-node because of ControliDClient being TS
