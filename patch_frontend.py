import re

file_path = '/Users/ivanrossi/Desktop/Documentos-Backup/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/app/agenda-digital/[slug]/ocorrencias/page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# I want to add a discrete debug info
target = "{ocorrenciasFiltradas.length === 0 ? ("
replacement = """
      <div style={{ padding: 10, background: '#fee2e2', color: '#ef4444', fontSize: '12px', textAlign: 'center', borderRadius: '8px', marginBottom: '10px' }}>
        ⚙️ Modo Diagnóstico: Total={ocorrencias?.length} | DoAluno={ocorrenciasDoAluno?.length} | Filtradas={ocorrenciasFiltradas?.length} | Ano={selectedYear} | ID={aluno?.id} | status={isLoading ? 'loading' : 'ok'}
      </div>
      {ocorrenciasFiltradas.length === 0 ? ("""

content = re.sub(r'<div style={{ padding: 10, background: \'red\'.*?</div>\s*\{ocorrenciasFiltradas\.length === 0 \? \(', replacement, content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched frontend")
