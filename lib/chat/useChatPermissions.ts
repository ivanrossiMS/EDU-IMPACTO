'use client'

// lib/chat/useChatPermissions.ts
// Returns memoized ChatPermissions for the current user

import { useMemo } from 'react'
import { useApp } from '@/lib/context'
import { useData } from '@/lib/dataContext'
import { chatPermissionService } from './services/chatPermissionService'
import type { ChatPermissions } from './types'

export function useChatPermissions(): ChatPermissions {
  const { currentUser } = useApp()
  const { alunos, turmas } = useData()

  // turmas can loosely serve as grupos here (they have structure with members)
  // The permission service accepts anything with colaboradoresIds
  const permissions = useMemo(() => {
    if (!currentUser) {
      return {
        canViewAll: false,
        canCreateConversation: false,
        canSendMessages: false,
        canDeleteMessages: false,
        canArchiveConversation: false,
        canCloseConversation: false,
        canTransferConversation: false,
        canManageGroups: false,
        canViewAuditLog: false,
        allowedGroupIds: [],
        allowedStudentIds: [],
      } satisfies ChatPermissions
    }

    return chatPermissionService.getPermissions(currentUser, alunos, turmas as never[])
  }, [currentUser, alunos, turmas])

  return permissions
}
