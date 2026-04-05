export type UserType = 'student' | 'guardian';
export type UserSubtype = 'responsavel_financeiro' | 'responsavel_pedagogico' | 'ambos' | 'aluno';

export type AccessStatus = 
  | 'ATIVO' 
  | 'INATIVO' 
  | 'SEM_ACESSO' 
  | 'SENHA_PROVISORIA' 
  | 'PRIMEIRO_ACESSO_PENDENTE' 
  | 'BLOQUEADO';

export interface AuthUser {
  id: string; // UUID correspondente à tabela auth_users
  user_type: UserType;
  subtype?: UserSubtype;
  
  // Link para a fonte da verdade acadêmica
  academic_id?: string; // Para aluno
  reference_key?: string; // Para responsável (CPF ou Email)

  // Perfil hard-linked (IAM)
  profile_code: 'FAMILIA'; // Sempre será FAMILIA para esse módulo

  login: string; // Código/Matrícula (aluno), Email/Celular (responsável)
  email?: string;
  celular?: string;
  password_hash?: string; // Mantido undefined no client

  status: AccessStatus;
  require_password_change: boolean;
  
  last_login_at?: string;
  last_password_reset_at?: string;
  sms_sent_at?: string;

  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthUserLog {
  id: number;
  auth_user_id: string; // Ref: AuthUser.id
  action_type: 'RESET_PASSWORD' | 'ACTIVATE' | 'DEACTIVATE' | 'SMS_SENT' | 'PROFILE_UPDATED';
  performed_by: string; // UUID Admin logado
  previous_status?: AccessStatus;
  new_status?: AccessStatus;
  sms_sent: boolean;
  sms_phone?: string;
  notes?: string;
  created_at: string;
}
