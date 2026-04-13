const payload = {
  nome: 'Joao da Silva',
  status: 'em_cadastro',
  cpf: '',
  responsavel: 'Maria',
  telefone: '123456',
  risco_evasao: 'baixo',
  dados: {
    responsaveis: [
      { id: 'mae', dbId: '123e4567-e89b-12d3-a456-426614174000', nome: 'Maria', endereco: {} }
    ]
  }
};

fetch('http://localhost:3000/api/alunos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
})
.then(r => r.json().then(data => [r.status, data]))
.then(result => console.log('STATUS:', result[0], '\nBODY:', result[1]))
.catch(console.error)
