import { CurrentUser } from '@/lib/context'
import type { ChatPermissions } from '../types'

export const chatPermissionService = {
  isAdminProfile(perfil?: string): boolean {
    if (!perfil) return false
    return ['Administrador', 'Diretor Geral', 'Diretor', 'Coordenador', 'Secretaria', 'TI'].includes(perfil)
  },

  isStaffProfile(perfil?: string): boolean {
    if (!perfil) return false
    return ['Professor', 'Colaborador', 'Funcionário', 'Assistente'].includes(perfil)
  },

  isFamilyProfile(perfil?: string, cargo?: string): boolean {
    return perfil === 'Família' || cargo === 'Responsável'
  },

  isStudentProfile(cargo?: string): boolean {
    return cargo === 'Aluno'
  },

  getPermissions(currentUser: CurrentUser | null, alunos: any[], grupos: any[]): ChatPermissions {
    const defaultPerms: ChatPermissions = {
      canViewAll: false,
      canCreateConversation: false,
      canSendMessages: false,
      canDeleteMessages: false,
      canArchiveConversation: true,
      canCloseConversation: false,
      canTransferConversation: false,
      canManageGroups: false,
      canViewAuditLog: false,
      allowedGroupIds: [],
      allowedStudentIds: []
    }

    if (!currentUser) return defaultPerms

    const isAdmin = this.isAdminProfile(currentUser.perfil)
    const isStaff = this.isStaffProfile(currentUser.perfil)
    const isFamily = this.isFamilyProfile(currentUser.perfil, currentUser.cargo)
    
    // Alunos for family
    const allowedStudentIds = isFamily 
      ? alunos.filter(a => a.responsavel_id === currentUser.id || a.responsavel_financeiro_id === currentUser.id).map(a => a.id)
      : []

    // Groups for staff
    const allowedGroupIds = isStaff
      ? grupos.filter(g => g.colaboradoresIds?.includes(currentUser.id)).map(g => g.id)
      : []

    if (isAdmin) {
      return {
        canViewAll: true,
        canCreateConversation: true,
        canSendMessages: true,
        canDeleteMessages: true,
        canArchiveConversation: true,
        canCloseConversation: true,
        canTransferConversation: true,
        canManageGroups: true,
        canViewAuditLog: true,
        allowedGroupIds: grupos.map(g => g.id),
        allowedStudentIds: alunos.map(a => a.id)
      }
    }

    if (isStaff) {
      return {
        ...defaultPerms,
        canCreateConversation: true,
        canSendMessages: true,
        canCloseConversation: true,
        canTransferConversation: true,
        allowedGroupIds,
        // Staff typically can see all students they teach, assuming logic handled in UI for selection
        allowedStudentIds: alunos.map(a => a.id) 
      }
    }

    if (isFamily) {
      return {
        ...defaultPerms,
        canCreateConversation: true, // Only to allowed staff/groups
        canSendMessages: true,
        allowedStudentIds
      }
    }

    // Student
    return {
      ...defaultPerms,
      canSendMessages: true, // Only in existing allowed conversations
    }
  }
}
