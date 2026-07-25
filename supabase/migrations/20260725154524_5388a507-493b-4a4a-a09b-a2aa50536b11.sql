ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS wa_phone_number_id text,
  ADD COLUMN IF NOT EXISTS wa_token text;

CREATE UNIQUE INDEX IF NOT EXISTS settings_wa_phone_number_id_uniq
  ON public.settings(wa_phone_number_id)
  WHERE wa_phone_number_id IS NOT NULL;