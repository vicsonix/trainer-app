-- conversations: chat thread metadata
CREATE TABLE IF NOT EXISTS public.conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      text NOT NULL DEFAULT 'Nowa rozmowa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- conversation_messages: full UIMessage JSON per turn
CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  content         jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conv_msg_conv_id_created_at_idx
  ON public.conversation_messages (conversation_id, created_at);

-- RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainer owns their conversations"
  ON public.conversations
  FOR ALL
  USING (trainer_id = auth.uid());

CREATE POLICY "trainer owns their conversation messages"
  ON public.conversation_messages
  FOR ALL
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations WHERE trainer_id = auth.uid()
    )
  );
