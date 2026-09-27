'use client'

import React from 'react'
import { AdminChatAuditView } from '@/components/chat/AdminChatAuditView'

export default function AdminChatPage() {
  return (
    <div style={{ width: '100%', minHeight: '100vh', background: '#f8fafc', paddingBottom: 40 }}>
      <AdminChatAuditView />
    </div>
  )
}
