import sys

full_card_4 = """        {/* === CARD 4: Aniversariantes do Mês === */}
        <div className="card" style={{ padding: '24px', borderRadius: 24, background: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: 'none', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#ec4899', fontWeight: 800, fontSize: 14 }}>
              🎂 Aniversariantes do Mês
            </div>
            <button style={{ background: 'transparent', color: '#6366f1', border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
              Ver todos
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, overflowY: 'auto', maxHeight: 350, paddingRight: 8 }}>
            {loadingNivers ? (
               <div style={{ textAlign: 'center', padding: '20px', fontSize: 12, color: '#94a3b8' }}>Buscando...</div>
            ) : aniversariantes.length === 0 ? (
               <div style={{ textAlign: 'center', padding: '20px', fontSize: 12, color: '#94a3b8' }}>Ninguém este mês 🎈</div>
            ) : (
              aniversariantes.map((p, idx) => {
                const isHoje = p.dia === hoje.getDate() && month === hoje.getMonth() && year === hoje.getFullYear();
                return (
                <div key={p.id || idx} style={{ 
                  display: 'flex', gap: 12, alignItems: 'center', 
                  padding: isHoje ? '12px' : '0 0 16px 0',
                  background: isHoje ? 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)' : 'transparent',
                  borderRadius: isHoje ? '16px' : '0',
                  borderTop: isHoje ? '1px solid #fbcfe8' : 'none',
                  borderRight: isHoje ? '1px solid #fbcfe8' : 'none',
                  borderLeft: isHoje ? '1px solid #fbcfe8' : 'none',
                  borderBottom: isHoje ? '1px solid #fbcfe8' : (!isHoje && idx !== aniversariantes.length - 1 ? '1px solid #f1f5f9' : 'none'),
                  marginBottom: isHoje ? '8px' : '0'
                }}>
                  <div style={{ 
                    width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                    background: p.foto ? `url(${p.foto}) center/cover` : isHoje ? '#fce7f3' : '#f1f5f9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: isHoje ? '#ec4899' : '#1e293b'
                  }}>
                    {!p.foto && p.nome.split(' ').map((n:any)=>n[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: isHoje ? '#db2777' : '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome}</div>
                    <div style={{ fontSize: 12, color: isHoje ? '#ec4899' : '#64748b', fontWeight: 500 }}>
                      {p.tipo === 'Aluno' 
                        ? (Array.isArray(p.turma) 
                            ? p.turma.map(id => turmas.find((t:any) => t.id === id || String(t.id) === String(id))?.nome || id).join(', ') 
                            : (turmas.find((t:any) => t.id === p.turma || String(t.id) === String(p.turma))?.nome || p.turma)) || 'Sem Turma' 
                        : p.tipo}
                    </div>
                  </div>
                  <div style={{ 
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: isHoje ? '#f472b6' : '#94a3b8', textTransform: 'uppercase' }}>Dia</span>
                    <span style={{ fontSize: 16, fontWeight: 900, color: isHoje ? '#db2777' : '#1e293b', lineHeight: 1 }}>{p.dia}</span>
                  </div>
                </div>
              )})
            )}
          </div>
          
          <div style={{ 
            marginTop: 'auto', padding: '16px', borderRadius: 16, background: '#e0e7ff', 
            color: '#6366f1', fontSize: 13, fontWeight: 800, textAlign: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }}>
            <Users size={16} /> {aniversariantes.length} aniversariantes neste mês 🎉
          </div>
        </div>
        </div>
      </div>"""

with open("app/(app)/calendario/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

import re
# Find the start of CARD 4
start_idx = content.find("{/* === CARD 4: Aniversariantes do Mês === */}")
# Find the end of the grid (before {typeof document !== 'undefined')
end_idx = content.find("{typeof document !== 'undefined'", start_idx)

if start_idx != -1 and end_idx != -1:
    new_content = content[:start_idx] + full_card_4 + "\n\n      " + content[end_idx:]
    with open("app/(app)/calendario/page.tsx", "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Fixed!")
else:
    print("Could not find boundaries")
