-- ══════════════════════════════════════════════════════════════════
-- VERIFICADOR — Confirma quais tabelas existem antes de criar índices
-- Cole no SQL Editor do Supabase e veja os resultados
-- ══════════════════════════════════════════════════════════════════
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'saida_calls',
    'comunicados',
    'agenda_notification_reads',
    'agenda_ciencias',
    'system_users',
    'aluno_responsavel',
    'portaria_eventos'
  )
ORDER BY table_name;
