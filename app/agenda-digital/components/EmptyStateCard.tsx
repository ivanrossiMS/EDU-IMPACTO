import React from 'react'
import { FolderSearch } from 'lucide-react'

export interface EmptyStateCardProps {
  title: string
  description: string
  icon?: React.ReactNode
}

export function EmptyStateCard({ 
  title, 
  description, 
  icon = <FolderSearch size={48} style={{ opacity: 0.2 }} /> 
}: EmptyStateCardProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '64px 32px',
      background: 'hsl(var(--bg-surface))',
      border: '1px dashed hsl(var(--border-subtle))',
      borderRadius: 16,
      textAlign: 'center',
      color: 'hsl(var(--text-muted))',
      minHeight: 300
    }}>
      <div style={{ marginBottom: 24, color: 'hsl(var(--primary))' }}>
        {icon}
      </div>
      <h3 style={{ fontSize: 20, fontWeight: 700, color: 'hsl(var(--text-main))', marginBottom: 8 }}>
        {title}
      </h3>
      <p style={{ maxWidth: 400, margin: '0 auto', fontSize: 15 }}>
        {description}
      </p>
    </div>
  )
}
