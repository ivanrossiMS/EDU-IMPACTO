'use client'

import React from 'react'
import { AdminChatAuditView } from '@/components/chat/AdminChatAuditView'

export default function AdminChatPage() {
  return (
    <div className="ad-admin-chat-page" style={{ width: '100%', minHeight: '100vh', background: '#f8fafc', paddingBottom: 40 }}>
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          .ad-admin-chat-page {
            padding-bottom: 120px !important;
          }
        }
      `}} />
      <AdminChatAuditView />
    </div>
  )
}
