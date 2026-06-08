import re

file_path = '/Users/ivanrossi/Desktop/Documentos-Backup/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/app/agenda-digital/[slug]/ocorrencias/page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add a debug banner right under the top menu
target = "{ocorrenciasFiltradas.length === 0 ? ("
replacement = """
      <div style={{ padding: 10, background: 'red', color: 'white' }}>
        DEBUG: rawOcorrencias={ocorrencias?.length} / doAluno={ocorrenciasDoAluno?.length} / filtradas={ocorrenciasFiltradas?.length} / ano={selectedYear} / aluno.id={aluno?.id} / isLoading={isLoading ? 'true' : 'false'}
      </div>
      {ocorrenciasFiltradas.length === 0 ? ("""

content = content.replace(target, replacement)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched frontend")
