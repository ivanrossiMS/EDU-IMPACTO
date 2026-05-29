require('dotenv').config({ path: '.env.local' });
(async () => {
  console.log('Fetching...');
  try {
    const res = await fetch(`https://lrpwerkkqrjkcauofhph.supabase.co/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: 'direcao@colegioimpacto.net', password: 'wrong' })
    });
    console.log('Status:', res.status);
    console.log('Text:', await res.text());
  } catch (e) {
    console.log('Error:', e);
  }
})();
