
-- Enum for queue status
DO $$ BEGIN
  CREATE TYPE public.handoff_status AS ENUM ('waiting','in_service','resolved','abandoned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Queue table
CREATE TABLE IF NOT EXISTS public.handoff_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  status public.handoff_status NOT NULL DEFAULT 'waiting',
  requested_at timestamptz NOT NULL DEFAULT now(),
  assigned_to uuid,
  assigned_at timestamptz,
  resolved_at timestamptz,
  last_alert_at timestamptz,
  alert_count int NOT NULL DEFAULT 0,
  escalated_at timestamptz,
  customer_notified_at timestamptz,
  last_operator_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS handoff_queue_status_idx ON public.handoff_queue(status);
CREATE INDEX IF NOT EXISTS handoff_queue_contact_idx ON public.handoff_queue(contact_id);
CREATE UNIQUE INDEX IF NOT EXISTS handoff_queue_active_unique
  ON public.handoff_queue(contact_id) WHERE status IN ('waiting','in_service');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.handoff_queue TO authenticated;
GRANT ALL ON public.handoff_queue TO service_role;

ALTER TABLE public.handoff_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read handoff" ON public.handoff_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write handoff" ON public.handoff_queue FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS handoff_queue_updated ON public.handoff_queue;
CREATE TRIGGER handoff_queue_updated BEFORE UPDATE ON public.handoff_queue
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- Settings additions
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS handoff_alert_phone text,
  ADD COLUMN IF NOT EXISTS handoff_supervisor_phone text,
  ADD COLUMN IF NOT EXISTS handoff_wait_customer_min int NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS handoff_escalate_min int NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS handoff_reminder_interval_min int NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS handoff_auto_return_min int;

-- Trigger on contacts.status
CREATE OR REPLACE FUNCTION public.tg_handoff_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Entered queue
  IF NEW.status = 'human_requested' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.handoff_queue(contact_id, status)
    VALUES (NEW.id, 'waiting')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Taken over
  IF NEW.status = 'human' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.handoff_queue
      SET status = 'in_service', assigned_at = COALESCE(assigned_at, now())
      WHERE contact_id = NEW.id AND status IN ('waiting','in_service');
    -- If no row existed, create it directly in_service
    INSERT INTO public.handoff_queue(contact_id, status, assigned_at)
    SELECT NEW.id, 'in_service', now()
    WHERE NOT EXISTS (
      SELECT 1 FROM public.handoff_queue
      WHERE contact_id = NEW.id AND status IN ('waiting','in_service','resolved') AND created_at > now() - interval '1 hour'
    );
  END IF;

  -- Released back to bot / closed
  IF NEW.status IN ('in_conversation','closed') AND OLD.status IN ('human','human_requested') THEN
    UPDATE public.handoff_queue
      SET status = 'resolved', resolved_at = now()
      WHERE contact_id = NEW.id AND status IN ('waiting','in_service');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS handoff_on_status_change ON public.contacts;
CREATE TRIGGER handoff_on_status_change
AFTER INSERT OR UPDATE OF status ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.tg_handoff_on_status_change();

-- Backfill existing human_requested/human contacts into queue
INSERT INTO public.handoff_queue(contact_id, status, requested_at, assigned_at)
SELECT c.id,
       CASE WHEN c.status = 'human' THEN 'in_service'::public.handoff_status ELSE 'waiting'::public.handoff_status END,
       COALESCE(c.last_message_at, now()),
       CASE WHEN c.status = 'human' THEN now() ELSE NULL END
FROM public.contacts c
WHERE c.status IN ('human_requested','human')
  AND NOT EXISTS (
    SELECT 1 FROM public.handoff_queue q
    WHERE q.contact_id = c.id AND q.status IN ('waiting','in_service')
  );
