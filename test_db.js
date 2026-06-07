import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/?apikey=${process.env.SUPABASE_SERVICE_ROLE_KEY}`)
  .then(res => res.json())
  .then(data => {
     console.log(data.definitions.comunicados_respostas.properties);
  });
