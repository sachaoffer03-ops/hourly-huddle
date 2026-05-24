CREATE TABLE public.ai_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_chat_messages_user_idx ON public.ai_chat_messages (user_id, created_at DESC);

ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_chat" ON public.ai_chat_messages
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_chat" ON public.ai_chat_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);