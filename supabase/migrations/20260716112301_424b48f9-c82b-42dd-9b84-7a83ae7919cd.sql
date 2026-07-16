
-- =============================================================
-- FASE 1: MULTI-TENANT SAAS (destructive reset)
-- =============================================================

-- 1) LIMPAR DADOS EXISTENTES (mantém schema, apaga rows)
TRUNCATE TABLE public.handoff_queue, public.messages, public.contacts,
  public.funnel_runs, public.funnels, public.message_templates,
  public.integrations, public.events, public.nps_responses, public.settings
  RESTART IDENTITY CASCADE;

-- 2) TABELA organizations
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'trial',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','cancelled')),
  trial_ends_at timestamptz DEFAULT (now() + interval '14 days'),
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 3) ENUM de papéis dentro da org
DO $$ BEGIN
  CREATE TYPE public.org_role AS ENUM ('owner','admin','supervisor','operator','viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) TABELA organization_members
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.org_role NOT NULL DEFAULT 'operator',
  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamptz,
  accepted_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
CREATE INDEX ON public.organization_members (user_id);
CREATE INDEX ON public.organization_members (org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- 5) TABELA departments
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  ai_prompt text,
  business_hours jsonb DEFAULT '{"mon":["09:00","18:00"],"tue":["09:00","18:00"],"wed":["09:00","18:00"],"thu":["09:00","18:00"],"fri":["09:00","18:00"]}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, slug)
);
CREATE INDEX ON public.departments (org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- 6) FUNÇÃO auxiliar: verifica se user é membro de org
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND org_id = _org_id
  )
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_user_id uuid, _org_id uuid, _roles public.org_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND org_id = _org_id AND role = ANY(_roles)
  )
$$;

-- 7) RLS: organizations
CREATE POLICY "org_select_members" ON public.organizations
  FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), id));
CREATE POLICY "org_insert_authenticated" ON public.organizations
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "org_update_owner_admin" ON public.organizations
  FOR UPDATE TO authenticated USING (public.has_org_role(auth.uid(), id, ARRAY['owner','admin']::public.org_role[]));
CREATE POLICY "org_delete_owner" ON public.organizations
  FOR DELETE TO authenticated USING (public.has_org_role(auth.uid(), id, ARRAY['owner']::public.org_role[]));

-- 8) RLS: organization_members
CREATE POLICY "members_select_same_org" ON public.organization_members
  FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "members_manage_admin" ON public.organization_members
  FOR ALL TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));

-- 9) RLS: departments
CREATE POLICY "dept_select_members" ON public.departments
  FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "dept_manage_admin" ON public.departments
  FOR ALL TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));

-- 10) ADICIONAR org_id + department_id nas tabelas existentes
ALTER TABLE public.contacts ADD COLUMN org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.contacts ADD COLUMN department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.contacts ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX ON public.contacts (org_id);

ALTER TABLE public.messages ADD COLUMN org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.messages ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX ON public.messages (org_id);

ALTER TABLE public.handoff_queue ADD COLUMN org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.handoff_queue ADD COLUMN department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.handoff_queue ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX ON public.handoff_queue (org_id);

ALTER TABLE public.funnels ADD COLUMN org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.funnels ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX ON public.funnels (org_id);

ALTER TABLE public.funnel_runs ADD COLUMN org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.funnel_runs ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX ON public.funnel_runs (org_id);

ALTER TABLE public.message_templates ADD COLUMN org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.message_templates ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX ON public.message_templates (org_id);

ALTER TABLE public.integrations ADD COLUMN org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.integrations ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX ON public.integrations (org_id);

ALTER TABLE public.events ADD COLUMN org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
CREATE INDEX ON public.events (org_id);

ALTER TABLE public.nps_responses ADD COLUMN org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.nps_responses ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX ON public.nps_responses (org_id);

-- settings: reestruturar. Antes era id=1 único. Agora 1 por org.
ALTER TABLE public.settings DROP CONSTRAINT IF EXISTS settings_pkey;
ALTER TABLE public.settings DROP COLUMN IF EXISTS id;
ALTER TABLE public.settings ADD COLUMN id uuid PRIMARY KEY DEFAULT gen_random_uuid();
ALTER TABLE public.settings ADD COLUMN org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE;
CREATE INDEX ON public.settings (org_id);

-- 11) DROPAR políticas RLS antigas das tabelas existentes (elas não filtram por org)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('contacts','messages','handoff_queue','funnels','funnel_runs',
                        'message_templates','integrations','events','nps_responses','settings')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- 12) NOVAS RLS por org_id
-- contacts, messages, handoff_queue, funnels, funnel_runs, templates, integrations, events, nps, settings
CREATE POLICY "contacts_org_access" ON public.contacts FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), org_id)) WITH CHECK (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "messages_org_access" ON public.messages FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), org_id)) WITH CHECK (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "handoff_org_access" ON public.handoff_queue FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), org_id)) WITH CHECK (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "funnels_org_access" ON public.funnels FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), org_id)) WITH CHECK (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "funnel_runs_org_access" ON public.funnel_runs FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), org_id)) WITH CHECK (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "templates_org_access" ON public.message_templates FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), org_id)) WITH CHECK (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "integrations_org_access" ON public.integrations FOR ALL TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));

CREATE POLICY "events_org_select" ON public.events FOR SELECT TO authenticated
  USING (org_id IS NULL OR public.is_org_member(auth.uid(), org_id));
CREATE POLICY "events_org_insert" ON public.events FOR INSERT TO authenticated
  WITH CHECK (org_id IS NULL OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "nps_org_access" ON public.nps_responses FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), org_id)) WITH CHECK (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "settings_org_select" ON public.settings FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "settings_org_manage" ON public.settings FOR ALL TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));

-- 13) TABELA tickets (sistema de tickets nativo)
CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  protocol text NOT NULL,
  subject text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','waiting_customer','resolved','closed')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  category text,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sla_due_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, protocol)
);
CREATE INDEX ON public.tickets (org_id, status);
CREATE INDEX ON public.tickets (department_id);
CREATE INDEX ON public.tickets (contact_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tickets_org_access" ON public.tickets FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), org_id)) WITH CHECK (public.is_org_member(auth.uid(), org_id));

-- 14) SEQUÊNCIA de protocolo por org
CREATE SEQUENCE IF NOT EXISTS public.ticket_protocol_seq;
CREATE OR REPLACE FUNCTION public.tg_ticket_protocol()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.protocol IS NULL OR NEW.protocol = '' THEN
    NEW.protocol := to_char(now(),'YYYYMMDD') || '-' || lpad(nextval('public.ticket_protocol_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tickets_set_protocol BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.tg_ticket_protocol();

-- 15) TRIGGER handle_new_user: cria org + depto padrão + membership automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_org_id uuid;
  base_slug text;
  final_slug text;
  suffix int := 0;
BEGIN
  -- profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  -- gerar slug único para a org
  base_slug := lower(regexp_replace(coalesce(split_part(NEW.email,'@',1),'workspace'),'[^a-z0-9]+','-','g'));
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = final_slug) LOOP
    suffix := suffix + 1;
    final_slug := base_slug || '-' || suffix;
  END LOOP;

  -- criar org
  INSERT INTO public.organizations (name, slug, owner_user_id)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'business_name', split_part(NEW.email,'@',1) || ' workspace'),
    final_slug,
    NEW.id
  )
  RETURNING id INTO new_org_id;

  -- membership como owner
  INSERT INTO public.organization_members (org_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'owner');

  -- depto padrão "Geral"
  INSERT INTO public.departments (org_id, name, slug, is_default, ai_prompt)
  VALUES (new_org_id, 'Geral', 'geral', true, 'Atendimento geral. Seja cordial, objetivo e humano.');

  -- settings default da org
  INSERT INTO public.settings (org_id, business_name, welcome_message, ai_system_prompt)
  VALUES (new_org_id,
          COALESCE(NEW.raw_user_meta_data->>'business_name', 'Meu Negócio'),
          'Olá! Como posso ajudar hoje?',
          'Você é um assistente virtual cordial e prestativo.');

  -- user_roles legado (mantém compatibilidade)
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END $$;

-- Trigger no auth.users (recriar)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 16) triggers updated_at
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE TRIGGER organization_members_updated_at BEFORE UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE TRIGGER departments_updated_at BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
