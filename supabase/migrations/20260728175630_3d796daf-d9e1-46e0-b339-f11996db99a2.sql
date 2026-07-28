
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS interest text,
  ADD COLUMN IF NOT EXISTS event_date date,
  ADD COLUMN IF NOT EXISTS estimated_value numeric,
  ADD COLUMN IF NOT EXISTS product text,
  ADD COLUMN IF NOT EXISTS crm_lead_id text,
  ADD COLUMN IF NOT EXISTS crm_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS close_reason text;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS crm_webhook_url text,
  ADD COLUMN IF NOT EXISTS crm_token text,
  ADD COLUMN IF NOT EXISTS crm_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS form_slug text,
  ADD COLUMN IF NOT EXISTS form_headline text,
  ADD COLUMN IF NOT EXISTS form_products text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS inactivity_close_min integer NOT NULL DEFAULT 120;

CREATE UNIQUE INDEX IF NOT EXISTS settings_form_slug_key ON public.settings (form_slug) WHERE form_slug IS NOT NULL;

UPDATE public.settings
SET form_slug = 'org-' || substr(replace(org_id::text, '-', ''), 1, 10)
WHERE form_slug IS NULL;
