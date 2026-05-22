-- Migration to add proibido column to responsaveis table
ALTER TABLE responsaveis ADD COLUMN proibido BOOLEAN DEFAULT FALSE;
