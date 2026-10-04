/**
 * Utilitários de Data e Horário com suporte a Timezone / Fuso Horário Local (Provas Online).
 * 
 * Garante que:
 * 1. O horário selecionado pelo professor no seu fuso (ex: Campo Grande UTC-4, Brasília UTC-3)
 *    seja convertido fielmente para UTC ISO 8601 ("...Z") antes de persistir no Supabase (TIMESTAMPTZ).
 * 2. Ao editar ou visualizar, o horário UTC do banco seja reconvertido para o fuso local do navegador,
 *    eliminando deslocamentos indevidos (ex: perda de 4 horas).
 */

/**
 * Converte qualquer valor de data (Date, timestamp, ISO UTC string) para o formato
 * local estrito exigido pelo HTML5 <input type="datetime-local"> ("YYYY-MM-DDTHH:mm").
 */
export function toLocalDateTimeInputValue(dateInput?: string | Date | number | null): string {
  if (!dateInput) return ''
  // Se já for uma string no formato puro local "YYYY-MM-DDTHH:mm" (sem Z e sem offset), retorna diretamente
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateInput)) {
    return dateInput
  }
  const d = new Date(dateInput)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Converte o valor de um <input type="datetime-local"> ("YYYY-MM-DDTHH:mm")
 * ou uma data arbitrária para uma string ISO 8601 em UTC ("YYYY-MM-DDTHH:mm:ss.sssZ").
 */
export function toUtcIsoString(localInput?: string | Date | number | null): string {
  if (!localInput) return ''
  if (localInput instanceof Date) {
    return isNaN(localInput.getTime()) ? '' : localInput.toISOString()
  }
  const str = String(localInput).trim()
  if (!str) return ''

  // Se já tiver indicador de fuso (Z ou sufixo +/-HH:mm), faz parse direto
  if (str.endsWith('Z') || /[+-]\d{2}(:\d{2})?$/.test(str)) {
    const d = new Date(str)
    return isNaN(d.getTime()) ? str : d.toISOString()
  }

  // Se for datetime local puro vindo do input ("YYYY-MM-DDTHH:mm" ou com segundos),
  // em JS `new Date("YYYY-MM-DDTHH:mm")` interpreta no fuso local do navegador.
  const d = new Date(str)
  if (isNaN(d.getTime())) return str
  return d.toISOString()
}

/**
 * Formata uma data para exibição amigável no padrão brasileiro: "DD/MM/AAAA às HH:mm".
 * Respeita o fuso horário local do dispositivo do usuário.
 */
export function formatExamDisplayDate(dateInput?: string | Date | number | null): string {
  if (!dateInput) return '--'
  const d = new Date(dateInput)
  if (isNaN(d.getTime())) return '--'
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}
