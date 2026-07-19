const responsaveis = [
  {
    id: '12321321',
    nome: 'ivan ross12',
    dias_acesso: [
      'Seg', 'Ter',
      'Qua', 'Qui',
      'Sex', 'Dom',
      'Sab'
    ],
    proibido: false
  }
];

let anyAllowedToday = false;
const remap = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'];
const todayK = remap[new Date('2026-06-14T12:04:01-04:00').getDay()];

console.log('Today is:', todayK);

for (const r of responsaveis) {
  if (r.proibido) continue;
  const rDias = r.diasAcesso || r.dias_acesso || r.diasSemana || [];
  console.log('rDias:', rDias);
  if (rDias.includes(todayK)) {
    anyAllowedToday = true;
    break;
  }
}
console.log('anyAllowedToday:', anyAllowedToday);
