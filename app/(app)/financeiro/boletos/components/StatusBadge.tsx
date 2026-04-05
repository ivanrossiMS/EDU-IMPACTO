'use client'

export type StatusBancario = 'rascunho' | 'emitido' | 'enviado_remessa' | 'registrado' | 'liquidado' | 'baixado' | 'vencido' | 'rejeitado'

const STATUS_MAP: Record<StatusBancario, { label: string; cls: string }> = {
  rascunho:        { label: 'Rascunho',   cls: 'badge-secondary' },
  emitido:         { label: 'Emitido',    cls: 'badge-info' },
  enviado_remessa: { label: 'Em Remessa', cls: 'badge-warning' },
  registrado:      { label: 'Registrado', cls: 'badge-primary' },
  liquidado:       { label: 'Liquidado',  cls: 'badge-success' },
  baixado:         { label: 'Baixado',    cls: 'badge-warning' },
  vencido:         { label: 'Vencido',    cls: 'badge-danger' },
  rejeitado:       { label: 'Rejeitado',  cls: 'badge-danger' },
}

export function StatusBadge({ status }: { status?: string }) {
  const cfg = STATUS_MAP[status as StatusBancario] ?? { label: 'Pendente', cls: 'badge-secondary' }
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
}
