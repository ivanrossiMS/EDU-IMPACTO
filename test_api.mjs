import fetch from 'node-fetch'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function run() {
  const res = await fetch('http://localhost:3000/api/alunos/lightweight')
  const data = await res.json()
  
  if (data.error) {
    console.error("API error:", data.error)
    return
  }
  
  console.log(`Total alunos retornados pela API: ${data.length}`)
  
  const turma1479 = data.filter(a => a.turma === '1479' || a.turma === 1479)
  console.log(`Alunos da turma 1479: ${turma1479.length}`)
  if(turma1479.length > 0) {
    console.log(turma1479[0])
  }
}
run()
