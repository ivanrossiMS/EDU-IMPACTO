import { getStudentTargetsForComunicados } from './lib/server/notificationHelper'

async function run() {
  const result = await getStudentTargetsForComunicados({
    turmas: ["8º ANO A - MATUTINO"]
  })
  console.log(JSON.stringify(result, null, 2))
}
run().catch(console.error)
