import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data, error } = await supabase.from('portaria_dispositivos').select('id, porta, ip').eq('ip', '192.168.1.75')
  if (data && data.length > 0) {
    const id = data[0].id
    await supabase.from('portaria_dispositivos').update({ porta: 80 }).eq('id', id)
    console.log("Porta atualizada para 80 com sucesso.")
  } else {
    console.log("Catraca não encontrada.")
  }
}
main()
