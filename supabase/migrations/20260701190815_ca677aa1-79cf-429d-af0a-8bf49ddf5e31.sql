
-- Track dispatched events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS dispatched_at timestamptz;
CREATE INDEX IF NOT EXISTS events_pending_dispatch_idx ON public.events (created_at) WHERE dispatched_at IS NULL;

-- Enable extensions if not present
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule tick every minute
SELECT cron.schedule(
  'nexabot-tick',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--e0efd13b-a401-4810-b28e-430a1d408866.lovable.app/api/public/cron/tick',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYm9xZG9pbXl5a3R0emxyaWNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MjE3ODgsImV4cCI6MjA5ODQ5Nzc4OH0.B654Dc-6MFlEiEoeUQjboJvKU8waIzcPZw2ClET-92s"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
