import os
import re

file_path = "app/(app)/provas/adaptar/[id]/page.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix handleEditAlternativa
old_edit = """        return {
          ...q,
          provas_alternativas: q.provas_alternativas.map((a: any) => a.id === altId ? { ...a, texto: newText } : a)
        }"""
new_edit = """        const newAlts = q.provas_alternativas.map((a: any) => a.id === altId ? { ...a, texto: newText } : a)
        return {
          ...q,
          provas_alternativas: newAlts,
          simulados_alternativas: newAlts
        }"""
content = content.replace(old_edit, new_edit)

# Fix handleRemoveAlternativa
old_remove = """        return {
          ...q,
          provas_alternativas: remaining.map((a: any, idx: number) => ({
            ...a,
            letra: letters[idx] || a.letra
          }))
        }"""
new_remove = """        const newAlts = remaining.map((a: any, idx: number) => ({
            ...a,
            letra: letters[idx] || a.letra
          }))
        return {
          ...q,
          provas_alternativas: newAlts,
          simulados_alternativas: newAlts
        }"""
content = content.replace(old_remove, new_remove)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Alternativas state patch applied.")
