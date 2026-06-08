import re

# 1. Patch agenda-digital ocorrencias page
file_path_1 = '/Users/ivanrossi/Desktop/Documentos-Backup/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/app/agenda-digital/[slug]/ocorrencias/page.tsx'
with open(file_path_1, 'r', encoding='utf-8') as f:
    content_1 = f.read()

# Remove the Class Pill Dropdown
dropdown_pattern = r"""          {/\* Class Pill Dropdown \(Turma\) \*/}.*?</div>\s*</div>"""
content_1 = re.sub(dropdown_pattern, "", content_1, flags=re.DOTALL)

with open(file_path_1, 'w', encoding='utf-8') as f:
    f.write(content_1)


# 2. Patch academico ocorrencias page
file_path_2 = '/Users/ivanrossi/Desktop/Documentos-Backup/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/app/(app)/academico/ocorrencias/page.tsx'
with open(file_path_2, 'r', encoding='utf-8') as f:
    content_2 = f.read()

# Fix the aluno filter
content_2 = content_2.replace(
    'const ocDoAluno = alunoSel ? ocorrencias.filter(o => o.alunoId === alunoSel.id).sort((a,b) => {',
    'const ocDoAluno = alunoSel ? ocorrencias.filter(o => o.alunoId === alunoSel.id || o.aluno_id === alunoSel.id).sort((a,b) => {'
)

with open(file_path_2, 'w', encoding='utf-8') as f:
    f.write(content_2)

print("Both pages patched!")
