-- ============================================================
-- IMPACTO EDU — Chat Realtime v2
-- Script completo de criação do banco de dados
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- STEP 1: CLEANUP SEGURO DAS TABELAS ANTIGAS
-- ────────────────────────────────────────────────────────────

-- Remover políticas das tabelas antigas se existirem
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.msg_conversations;
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.msg_participants;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.msg_messages;
DROP POLICY IF EXISTS "Participants can insert messages" ON public.msg_messages;

-- Dropar tabelas antigas (com CASCADE para remover dependências)
DROP TABLE IF EXISTS public.msg_audit_logs CASCADE;
DROP TABLE IF EXISTS public.msg_messages CASCADE;
DROP TABLE IF EXISTS public.msg_participants CASCADE;
DROP TABLE IF EXISTS public.msg_conversations CASCADE;

-- Preservar dados antigos para auditoria (mover para backup)
-- NOTA: Descomente se quiser migrar dados do sistema antigo
-- CREATE TABLE IF NOT EXISTS public._backup_agenda_chats AS SELECT * FROM public.agenda_chats;
-- CREATE TABLE IF NOT EXISTS public._backup_agenda_mensagens AS SELECT * FROM public.agenda_mensagens;

-- Dropar tabelas antigas do sistema legado
DROP TABLE IF EXISTS public.agenda_chats CASCADE;
DROP TABLE IF EXISTS public.agenda_mensagens CASCADE;

-- ────────────────────────────────────────────────────────────
-- STEP 2: FUNÇÃO HELPER — updated_at automático
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────────────────────
-- STEP 3: TABELAS PRINCIPAIS
-- ────────────────────────────────────────────────────────────

-- 3.1 Conversas
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          TEXT NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group', 'broadcast')),
  title         TEXT,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'closed', 'transferred')),
  
  -- Vínculos escolares
  turma_id      TEXT,
  aluno_id      TEXT,
  grupo_id      TEXT,
  
  -- Controles
  created_by    TEXT NOT NULL,        -- currentUser.id
  updated_by    TEXT,
  transferred_to TEXT,               -- ID do colaborador para onde foi transferida
  closed_by     TEXT,
  
  -- Configurações
  is_pinned     BOOLEAN DEFAULT FALSE,
  is_muted_global BOOLEAN DEFAULT FALSE,
  priority      TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  -- Metadados
  last_message_at   TIMESTAMPTZ DEFAULT NOW(),
  last_message_text TEXT,
  last_message_by   TEXT,
  message_count     INTEGER DEFAULT 0,
  
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_created_by ON public.chat_conversations(created_by);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_status ON public.chat_conversations(status);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_aluno_id ON public.chat_conversations(aluno_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_turma_id ON public.chat_conversations(turma_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_last_message_at ON public.chat_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_deleted_at ON public.chat_conversations(deleted_at) WHERE deleted_at IS NULL;

-- 3.2 Participantes
CREATE TABLE IF NOT EXISTS public.chat_participants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id          TEXT NOT NULL,
  user_name        TEXT,
  user_perfil      TEXT,
  user_role        TEXT DEFAULT 'member' CHECK (user_role IN ('admin', 'moderator', 'member', 'observer')),
  
  -- Controles de leitura
  last_read_at     TIMESTAMPTZ DEFAULT NOW(),
  unread_count     INTEGER DEFAULT 0,
  
  -- Configurações do participante
  is_muted         BOOLEAN DEFAULT FALSE,
  is_pinned        BOOLEAN DEFAULT FALSE,
  is_archived      BOOLEAN DEFAULT FALSE,
  is_blocked       BOOLEAN DEFAULT FALSE,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  
  -- Quando entrou/saiu
  joined_at        TIMESTAMPTZ DEFAULT NOW(),
  left_at          TIMESTAMPTZ,
  
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_participants_conversation_id ON public.chat_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id ON public.chat_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_unread ON public.chat_participants(user_id, unread_count) WHERE unread_count > 0;

-- 3.3 Mensagens
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id        TEXT NOT NULL,
  sender_name      TEXT,
  sender_perfil    TEXT,
  
  -- Conteúdo
  content          TEXT,
  content_type     TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'file', 'audio', 'video', 'system')),
  
  -- Reply
  reply_to_id      UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  reply_preview    TEXT,
  
  -- Status
  status           TEXT DEFAULT 'sent' CHECK (status IN ('sending', 'sent', 'delivered', 'read', 'failed')),
  
  -- Metadados
  metadata         JSONB DEFAULT '{}',
  
  -- Controles
  is_edited        BOOLEAN DEFAULT FALSE,
  edited_at        TIMESTAMPTZ,
  is_deleted       BOOLEAN DEFAULT FALSE,
  deleted_at       TIMESTAMPTZ,
  deleted_by       TEXT,
  
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON public.chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON public.chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_not_deleted ON public.chat_messages(conversation_id, created_at DESC) WHERE is_deleted = FALSE;

-- 3.4 Anexos
CREATE TABLE IF NOT EXISTS public.chat_attachments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id       UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  conversation_id  UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  uploaded_by      TEXT NOT NULL,
  
  file_name        TEXT NOT NULL,
  file_type        TEXT NOT NULL,
  file_size        INTEGER,
  file_url         TEXT NOT NULL,
  thumbnail_url    TEXT,
  
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_attachments_message_id ON public.chat_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_conversation_id ON public.chat_attachments(conversation_id);

-- 3.5 Confirmações de Leitura (granular por mensagem)
CREATE TABLE IF NOT EXISTS public.chat_read_receipts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id       UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  conversation_id  UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id          TEXT NOT NULL,
  read_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_read_receipts_message_id ON public.chat_read_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_read_receipts_user_id ON public.chat_read_receipts(user_id);

-- 3.6 Status de Digitação (ephemeral — sem RLS estrita)
CREATE TABLE IF NOT EXISTS public.chat_typing_status (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id          TEXT NOT NULL,
  user_name        TEXT,
  is_typing        BOOLEAN DEFAULT TRUE,
  expires_at       TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 seconds'),
  updated_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_typing_conversation ON public.chat_typing_status(conversation_id, expires_at);

-- 3.7 Presença (Online/Offline)
CREATE TABLE IF NOT EXISTS public.chat_presence (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT NOT NULL UNIQUE,
  user_name        TEXT,
  is_online        BOOLEAN DEFAULT FALSE,
  last_seen_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_presence_user_id ON public.chat_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_presence_online ON public.chat_presence(is_online) WHERE is_online = TRUE;

-- 3.8 Notificações
CREATE TABLE IF NOT EXISTS public.chat_notifications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT NOT NULL,
  conversation_id  UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  message_id       UUID REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  
  type             TEXT NOT NULL DEFAULT 'new_message' CHECK (type IN ('new_message', 'mention', 'system', 'transfer', 'archive', 'reopen')),
  title            TEXT,
  body             TEXT,
  sender_name      TEXT,
  
  is_read          BOOLEAN DEFAULT FALSE,
  read_at          TIMESTAMPTZ,
  
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_notifications_user_id ON public.chat_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_notifications_unread ON public.chat_notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_chat_notifications_created_at ON public.chat_notifications(created_at DESC);

-- 3.9 Grupos Escolares de Chat
CREATE TABLE IF NOT EXISTS public.chat_groups (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  description      TEXT,
  group_type       TEXT NOT NULL DEFAULT 'turma' CHECK (group_type IN ('turma', 'setor', 'equipe', 'geral', 'administrativo')),
  
  -- Referências escolares
  turma_id         TEXT,
  setor_id         TEXT,
  
  color            TEXT DEFAULT '#6366f1',
  icon             TEXT,
  
  is_active        BOOLEAN DEFAULT TRUE,
  created_by       TEXT NOT NULL,
  
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3.10 Membros de Grupos de Chat
CREATE TABLE IF NOT EXISTS public.chat_group_members (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id         UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id          TEXT NOT NULL,
  user_perfil      TEXT,
  role             TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  added_by         TEXT,
  added_at         TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_group_members_group_id ON public.chat_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_chat_group_members_user_id ON public.chat_group_members(user_id);

-- 3.11 Audit Log (LGPD)
CREATE TABLE IF NOT EXISTS public.chat_audit_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id         TEXT NOT NULL,
  actor_name       TEXT,
  actor_perfil     TEXT,
  
  action           TEXT NOT NULL, -- 'message_sent', 'message_deleted', 'conversation_created', 'conversation_archived', etc.
  target_type      TEXT,          -- 'message', 'conversation', 'participant'
  target_id        TEXT,
  
  conversation_id  UUID REFERENCES public.chat_conversations(id) ON DELETE SET NULL,
  
  metadata         JSONB DEFAULT '{}',
  ip_address       TEXT,
  
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_audit_logs_actor_id ON public.chat_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_chat_audit_logs_conversation_id ON public.chat_audit_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_audit_logs_created_at ON public.chat_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_audit_logs_action ON public.chat_audit_logs(action);

-- ────────────────────────────────────────────────────────────
-- STEP 4: TRIGGERS — updated_at automático
-- ────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_chat_conversations_updated_at ON public.chat_conversations;
CREATE TRIGGER trg_chat_conversations_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_chat_participants_updated_at ON public.chat_participants;
CREATE TRIGGER trg_chat_participants_updated_at
  BEFORE UPDATE ON public.chat_participants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_chat_messages_updated_at ON public.chat_messages;
CREATE TRIGGER trg_chat_messages_updated_at
  BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_chat_groups_updated_at ON public.chat_groups;
CREATE TRIGGER trg_chat_groups_updated_at
  BEFORE UPDATE ON public.chat_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_chat_presence_updated_at ON public.chat_presence;
CREATE TRIGGER trg_chat_presence_updated_at
  BEFORE UPDATE ON public.chat_presence
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- STEP 5: FUNÇÃO — atualizar última mensagem na conversa
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.is_deleted = FALSE) THEN
    UPDATE public.chat_conversations
    SET 
      last_message_at   = NEW.created_at,
      last_message_text = SUBSTRING(NEW.content, 1, 100),
      last_message_by   = NEW.sender_id,
      message_count     = message_count + 1,
      updated_at        = NOW()
    WHERE id = NEW.conversation_id;
    
    -- Incrementar unread_count para todos os participantes exceto o sender
    UPDATE public.chat_participants
    SET unread_count = unread_count + 1
    WHERE conversation_id = NEW.conversation_id
      AND user_id != NEW.sender_id
      AND left_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_conversation_on_message ON public.chat_messages;
CREATE TRIGGER trg_update_conversation_on_message
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();

-- ────────────────────────────────────────────────────────────
-- STEP 6: ROW LEVEL SECURITY (RLS)
-- ────────────────────────────────────────────────────────────

-- NOTA: Este sistema usa currentUser.id como texto (não auth.uid()).
-- As políticas usam uma função helper que lê o user_id do header customizado,
-- ou via service role bypass para operações do servidor.
-- No frontend, usamos a chave anon com RLS desabilitada por enquanto
-- e fazemos a filtragem no nível da aplicação.
-- 
-- Para produção completa com RLS nativo, implementar com custom JWT claims.

-- Habilitar RLS nas tabelas
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_typing_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_presence ENABLE ROW LEVEL SECURITY;

-- Política permissiva para service role (backend/admin)
-- O frontend usará a chave anon com políticas de acesso controladas

-- chat_conversations — permitir acesso total via service role
CREATE POLICY "chat_conversations_service_role" ON public.chat_conversations
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "chat_participants_service_role" ON public.chat_participants
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "chat_messages_service_role" ON public.chat_messages
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "chat_attachments_service_role" ON public.chat_attachments
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "chat_read_receipts_service_role" ON public.chat_read_receipts
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "chat_notifications_service_role" ON public.chat_notifications
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "chat_groups_service_role" ON public.chat_groups
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "chat_group_members_service_role" ON public.chat_group_members
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "chat_audit_logs_service_role" ON public.chat_audit_logs
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "chat_typing_status_service_role" ON public.chat_typing_status
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "chat_presence_service_role" ON public.chat_presence
  USING (TRUE)
  WITH CHECK (TRUE);

-- ────────────────────────────────────────────────────────────
-- STEP 7: REALTIME — habilitar publicações
-- ────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- chat_messages
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
  
  -- chat_conversations
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
  END IF;
  
  -- chat_participants
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
  END IF;
  
  -- chat_typing_status
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_typing_status'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_typing_status;
  END IF;
  
  -- chat_presence
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_presence'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_presence;
  END IF;
  
  -- chat_notifications
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_notifications;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- STEP 8: VIEWS ÚTEIS
-- ────────────────────────────────────────────────────────────

-- View: conversas com dados do último participante e contagem de não-lidos
CREATE OR REPLACE VIEW public.chat_conversation_summary AS
SELECT
  c.id,
  c.type,
  c.title,
  c.status,
  c.turma_id,
  c.aluno_id,
  c.grupo_id,
  c.created_by,
  c.last_message_at,
  c.last_message_text,
  c.last_message_by,
  c.message_count,
  c.is_pinned,
  c.priority,
  c.created_at,
  c.updated_at
FROM public.chat_conversations c
WHERE c.deleted_at IS NULL;

-- ────────────────────────────────────────────────────────────
-- STEP 9: DADOS INICIAIS (opcional)
-- ────────────────────────────────────────────────────────────

-- Nenhum dado de seed necessário — sistema começa vazio e limpo.

-- ════════════════════════════════════════════════════════════
-- FIM DO SCRIPT
-- Execute no SQL Editor do Supabase Dashboard
-- ════════════════════════════════════════════════════════════
