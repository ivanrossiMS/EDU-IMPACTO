-- Migration: Rebuild Messaging System

-- PERIGO: Exclusão das tabelas antigas (Hard Reset)
DROP TABLE IF EXISTS public.agenda_chats CASCADE;
DROP TABLE IF EXISTS public.agenda_mensagens CASCADE;

-- Creates relational schema for messaging system with RLS and Realtime

-- 1. Create Tables
CREATE TABLE IF NOT EXISTS public.msg_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('direct', 'group')),
    reference_id TEXT, -- e.g., turma_id, setor_id
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'closed')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by TEXT -- auth.uid() or text mapping
);

CREATE TABLE IF NOT EXISTS public.msg_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.msg_conversations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL, -- The user id string used in your system
    user_role TEXT DEFAULT 'member', -- admin, member
    last_read_at TIMESTAMPTZ DEFAULT now(),
    is_muted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.msg_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.msg_conversations(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL,
    text TEXT NOT NULL,
    attachment_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.msg_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.msg_conversations(id) ON DELETE SET NULL,
    actor_id TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.msg_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msg_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msg_messages ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies

-- Note: In this system, user authentication might use auth.uid() or custom tokens.
-- If the system uses a custom mapping where the frontend passes user_id, 
-- and you are using API routes with the Service Role, you can bypass RLS via the Service Key.
-- If using direct Supabase client in frontend with auth.uid(), we define policies based on auth.uid() cast to text.

-- msg_conversations
CREATE POLICY "Users can view conversations they participate in" 
ON public.msg_conversations FOR SELECT 
USING (
  id IN (SELECT conversation_id FROM public.msg_participants WHERE user_id = auth.uid()::text) 
  OR 
  (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'admin'
);

-- msg_participants
CREATE POLICY "Users can view participants of their conversations" 
ON public.msg_participants FOR SELECT 
USING (
  conversation_id IN (SELECT conversation_id FROM public.msg_participants WHERE user_id = auth.uid()::text)
);

-- msg_messages
CREATE POLICY "Users can view messages in their conversations" 
ON public.msg_messages FOR SELECT 
USING (
  conversation_id IN (SELECT conversation_id FROM public.msg_participants WHERE user_id = auth.uid()::text)
);

CREATE POLICY "Participants can insert messages" 
ON public.msg_messages FOR INSERT 
WITH CHECK (
  sender_id = auth.uid()::text AND 
  conversation_id IN (SELECT conversation_id FROM public.msg_participants WHERE user_id = auth.uid()::text)
);

-- 4. Triggers for updated_at
CREATE OR REPLACE FUNCTION update_msg_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_msg_conversations_updated_at
    BEFORE UPDATE ON public.msg_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_msg_updated_at_column();

-- 5. Enable Realtime
-- This requires running ALTER PUBLICATION supabase_realtime ADD TABLE ...
-- If publication doesn't exist, it creates one.
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'msg_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.msg_messages;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'msg_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.msg_participants;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'msg_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.msg_conversations;
  END IF;
END $$;
