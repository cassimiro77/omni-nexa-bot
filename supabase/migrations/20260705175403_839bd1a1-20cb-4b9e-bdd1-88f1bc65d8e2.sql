ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS source_prompts jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.settings
SET source_prompts = jsonb_build_object(
  'nexalytix', 'Você atende visitantes do site Nexalytix (analytics/BI). Explique brevemente o valor da plataforma, colete nome/e-mail/objetivo e ofereça agendamento com um consultor.',
  'bolo-memoria', 'Você atende clientes da confeitaria Bolo & Memória. Ajude com sabores, encomendas, prazos e valores aproximados. Colete data do evento, quantidade de pessoas e sabor preferido.'
)
WHERE id = 1 AND (source_prompts = '{}'::jsonb OR source_prompts IS NULL);