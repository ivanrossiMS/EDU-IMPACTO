import re

file_path = '/Users/ivanrossi/Desktop/Documentos-Backup/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/app/(app)/academico/ocorrencias/page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix reincidentes logic
content = content.replace('o.alunoId', '(o.alunoId || o.aluno_id)')
# Wait, this global replace might break things like form.alunoId if it replaces it there. 
# Let's do it carefully.

