
-- ============ Funnel execution engine ============
CREATE TABLE public.funnel_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id uuid NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running', -- running, completed, failed, cancelled
  current_step integer NOT NULL DEFAULT 0,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funnel_runs TO authenticated;
GRANT ALL ON public.funnel_runs TO service_role;
ALTER TABLE public.funnel_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "funnel_runs auth read" ON public.funnel_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "funnel_runs admin write" ON public.funnel_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX funnel_runs_pending_idx ON public.funnel_runs (next_run_at) WHERE status = 'running';
CREATE TRIGGER funnel_runs_updated_at BEFORE UPDATE ON public.funnel_runs FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ============ Integrations (CRMs) ============
CREATE TABLE public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL, -- 'hubspot' | 'rdstation' | 'bitrix24' | 'zapier' | 'n8n' | 'custom_webhook'
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb, -- { token, portal_id, webhook_url, base_url, ... }
  events text[] NOT NULL DEFAULT ARRAY['contact.created','contact.status_changed'],
  last_sync_at timestamptz,
  last_status text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "integrations auth read" ON public.integrations FOR SELECT TO authenticated USING (true);
CREATE POLICY "integrations admin write" ON public.integrations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER integrations_updated_at BEFORE UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ============ Message templates ============
CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  language text NOT NULL DEFAULT 'pt_BR',
  category text NOT NULL DEFAULT 'MARKETING', -- MARKETING, UTILITY, AUTHENTICATION
  body text NOT NULL,
  variables text[] NOT NULL DEFAULT '{}',
  meta_template_name text, -- name registered on Meta
  status text NOT NULL DEFAULT 'draft', -- draft, submitted, approved, rejected
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates auth all" ON public.message_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER templates_updated_at BEFORE UPDATE ON public.message_templates FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ============ Enable realtime on messages + contacts ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;

-- ============ Admin: allow admins to update user_roles ============
CREATE POLICY "roles admin write" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles admin read all" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ Trigger: emit events on contact changes → dispatch outbound ============
CREATE OR REPLACE FUNCTION public.tg_contact_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.events(type, payload)
    VALUES ('contact.created', jsonb_build_object('contact_id', NEW.id, 'name', NEW.name, 'phone', NEW.phone, 'email', NEW.email, 'origin', NEW.origin, 'status', NEW.status));
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.events(type, payload)
    VALUES ('contact.status_changed', jsonb_build_object('contact_id', NEW.id, 'from', OLD.status, 'to', NEW.status));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER contacts_event_emit
AFTER INSERT OR UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.tg_contact_events();

-- ============ Trigger: start funnel runs on contact created ============
CREATE OR REPLACE FUNCTION public.tg_start_funnels_on_contact()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f RECORD;
BEGIN
  FOR f IN
    SELECT id, triggers FROM public.funnels WHERE active = true
  LOOP
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(f.triggers) t
      WHERE t->>'type' IN ('lead_ad_received','first_message')
    ) THEN
      INSERT INTO public.funnel_runs(funnel_id, contact_id, next_run_at)
      VALUES (f.id, NEW.id, now());
    END IF;
  END LOOP;
  RETURN NEW;
END; $$;
CREATE TRIGGER contacts_start_funnels
AFTER INSERT ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.tg_start_funnels_on_contact();
