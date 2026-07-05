
-- NPS responses
CREATE TABLE public.nps_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  score INT NOT NULL CHECK (score >= 0 AND score <= 10),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nps_responses TO authenticated;
GRANT ALL ON public.nps_responses TO service_role;
ALTER TABLE public.nps_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth can read nps" ON public.nps_responses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert nps" ON public.nps_responses FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_nps_contact ON public.nps_responses(contact_id);

-- Add TTS toggle to settings
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS reply_with_audio BOOLEAN NOT NULL DEFAULT false;

-- Track pending NPS invitations on contact (simple flag via jsonb metadata column)
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS awaiting_nps BOOLEAN NOT NULL DEFAULT false;
