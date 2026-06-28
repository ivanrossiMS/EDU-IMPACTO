import { getStudentTargetsForComunicados } from './lib/server/notificationHelper'
import { supabaseServer } from './lib/supabaseServer'

async function run() {
    const dados = { turmas: ['Maternal 1'] }
    console.log("Testing with:", dados)
    const res = await getStudentTargetsForComunicados(dados)
    console.log("Result:", JSON.stringify(res, null, 2))
}
run().catch(console.error)
