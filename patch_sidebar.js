const fs = require('fs');
const file = 'app/agenda-digital/components/Sidebar.tsx';
let code = fs.readFileSync(file, 'utf8');

const navItemsList = `                  {[
                    { 
                      label: 'Comunicados', 
                      href: \`/agenda-digital/\${alunoId}/comunicados\`, 
                      icon: Bell,
                      badge: (comunicados || []).filter(c => c.status === 'enviado' && (!c.leituras || !c.leituras[alunoId])).length || undefined
                    },
                    { 
                      label: 'Mensagens', 
                      href: \`/agenda-digital/\${alunoId}/conversas\`, 
                      icon: MessageSquare,
                      badge: (chatsList || []).filter((c: any) => {
                        const msgs = messages[c.id] || []
                        if (msgs.length === 0) return (c.unread || 0) > 0
                        const lastMsg = msgs[msgs.length - 1]
                        // Student views 'us' as the other sender (Admin)
                        return lastMsg.sender === 'us' && (c.unread || 0) > 0
                      }).length || undefined
                    },
                    { label: 'Fotos/Vídeos', href: \`/agenda-digital/\${alunoId}/momentos\`, icon: ImageIcon },
                    { label: 'Calendário', href: \`/agenda-digital/\${alunoId}/calendario\`, icon: Calendar },
                    { label: 'Financeiro', href: \`/agenda-digital/\${alunoId}/financeiro\`, icon: DollarSign },
                    { label: 'Frequência', href: \`/agenda-digital/\${alunoId}/frequencia\`, icon: BarChart2 },
                    { label: 'Ocorrências', href: \`/agenda-digital/\${alunoId}/ocorrencias\`, icon: AlertTriangle },
                    { label: 'Notas', href: \`/agenda-digital/\${alunoId}/notas\`, icon: GraduationCap },
                    { label: 'Meu Perfil', href: \`/agenda-digital/\${alunoId}/perfil\`, icon: UserCog },
                  ].map((item, idx) => {`;

const newNavItemsList = `                  {[
                    { 
                      label: 'Comunicados', 
                      href: \`/agenda-digital/\${alunoId}/comunicados\`, 
                      icon: Bell,
                      badge: (comunicados || []).filter(c => c.status === 'enviado' && (!c.leituras || !c.leituras[alunoId])).length || undefined
                    },
                    { 
                      label: 'Mensagens', 
                      href: \`/agenda-digital/\${alunoId}/conversas\`, 
                      icon: MessageSquare,
                      badge: (chatsList || []).filter((c: any) => {
                        const msgs = messages[c.id] || []
                        if (msgs.length === 0) return (c.unread || 0) > 0
                        const lastMsg = msgs[msgs.length - 1]
                        return lastMsg.sender === 'us' && (c.unread || 0) > 0
                      }).length || undefined
                    },
                    { label: 'Fotos/Vídeos', href: \`/agenda-digital/\${alunoId}/momentos\`, icon: ImageIcon },
                    { label: 'Calendário', href: \`/agenda-digital/\${alunoId}/calendario\`, icon: Calendar },
                    { label: 'Financeiro', href: \`/agenda-digital/\${alunoId}/financeiro\`, icon: DollarSign },
                    { label: 'Frequência', href: \`/agenda-digital/\${alunoId}/frequencia\`, icon: BarChart2 },
                    { label: 'Ocorrências', href: \`/agenda-digital/\${alunoId}/ocorrencias\`, icon: AlertTriangle },
                    { label: 'Notas', href: \`/agenda-digital/\${alunoId}/notas\`, icon: GraduationCap },
                    { label: 'Meu Perfil', href: \`/agenda-digital/\${alunoId}/perfil\`, icon: UserCog },
                  ].filter(item => {
                    if (alunoId === 'colaborador') {
                      return ['Comunicados', 'Mensagens', 'Fotos/Vídeos', 'Calendário', 'Meu Perfil'].includes(item.label)
                    }
                    return true
                  }).map((item, idx) => {`;

code = code.replace(navItemsList, newNavItemsList);

fs.writeFileSync(file, code);
