import { getAdminClient } from './lib/server/supabaseAdminSingleton'

async function run() {
  try {
    const supabaseAdmin = getAdminClient()
    const studentId = '123123' // ID of the "teste aluno ivan" from screenshot
    const res = await supabaseAdmin.from('alunos').delete().eq('id', studentId)
    console.log(res)
  } catch (err) {
    console.error(err)
  }
}
run()
