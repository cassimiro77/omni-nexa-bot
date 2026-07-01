
# NexaBot — MVP

Stack: TanStack Start (já no projeto) + Lovable Cloud (auth/DB) + Lovable AI Gateway (Gemini) + WhatsApp Cloud API + Meta Lead Ads webhook.

O escopo original (6 CRMs, 3 ERPs, Zapier/Make/n8n, Kubernetes/Kafka, Instagram, Messenger, gateways de pagamento) fica **fora deste MVP**. Entrego uma base sólida, funcional, com um webhook genérico de saída que você conecta a Zapier/Make/n8n depois.

## O que entrego

### 1. Backend (Lovable Cloud)
Tabelas com RLS e GRANTs:
- `profiles` — usuários do painel
- `user_roles` + `has_role()` — admin/operador (padrão seguro)
- `contacts` — leads (phone, name, email, origin, tags[], status, created_at)
- `messages` — histórico (contact_id, channel='whatsapp', direction, content, ai_used, wa_message_id, created_at)
- `funnels` — nome, steps JSONB, triggers JSONB, active
- `events` — auditoria (type, payload, created_at)
- `settings` — 1 linha: business_name, ai_system_prompt, welcome_message, outbound_webhook_url

### 2. Endpoints (server routes TanStack)
Públicos (assinatura verificada):
- `GET /api/public/whatsapp/webhook` — verify (hub.challenge)
- `POST /api/public/whatsapp/webhook` — recebe msgs, salva, roda IA, responde
- `GET /api/public/meta/leads/webhook` — verify
- `POST /api/public/meta/leads/webhook` — cria contact, dispara boas-vindas + webhook externo

Protegidos (`requireSupabaseAuth`):
- `sendWhatsAppMessage` (server fn) — envio manual do painel
- `generateAIReply` — chama Gemini via Lovable AI Gateway
- CRUD de contacts, funnels, settings
- `triggerOutboundWebhook` — POST genérico p/ Zapier/Make/n8n

### 3. IA
Gemini 3 Flash via Lovable AI Gateway. System prompt configurável no painel. Contexto: últimas 20 msgs do contato + dados do lead. Detecta intenção básica (interesse / preço / agendamento / suporte) e pode acionar fluxo.

### 4. Fluxos (motor simples)
Trigger types: `lead_ad_received`, `keyword`, `first_message`.
Steps: `send_message`, `add_tag`, `wait`, `call_webhook`.
Executor roda no webhook de entrada. (Sem agendamento/cron complexo — wait é curto/inline.)

### 5. Painel (frontend)
Rotas:
- `/auth` — login/signup (email+senha)
- `/` — dashboard (métricas: leads, mensagens, conversão)
- `/inbox` — lista de conversas + thread de mensagens + composer
- `/contacts` — tabela com filtros por tag/origem
- `/funnels` — CRUD visual simples de fluxos
- `/settings` — chaves Meta, system prompt IA, webhook externo, mensagem de boas-vindas

Design escuro moderno, tokens em `src/styles.css`.

### 6. Secrets necessários
Vou pedir via `add_secret`:
- `META_WA_TOKEN` (token permanente WhatsApp Cloud API)
- `META_WA_PHONE_NUMBER_ID`
- `META_WA_VERIFY_TOKEN` (você escolhe — string qualquer que você cola no painel Meta)
- `META_APP_SECRET` (para verificar assinatura X-Hub-Signature-256)

`LOVABLE_API_KEY` é provisionado automaticamente.

## Fora do MVP (posso adicionar depois)
Instagram/Messenger, HubSpot/RD/Pipedrive/Zoho/Salesforce/Agendor, Bling/Omie/Tiny, Zapier/Make/n8n nativos (o webhook genérico cobre por enquanto), gateways de pagamento, TTS, Kubernetes/Kafka/microsserviços. Se quiser algum desses agora, me diga qual e priorizo — cada um é uma feature própria.

## Passo a passo de execução
1. Habilito Lovable Cloud e crio migrations (tabelas + RLS + GRANTs + roles)
2. Peço os 4 secrets Meta
3. Crio server routes públicos WhatsApp + Meta Leads (com verificação de assinatura)
4. Crio server fns protegidos + integração Lovable AI Gateway
5. Motor de fluxos simples
6. Painel completo (auth, inbox, contacts, funnels, settings, dashboard)
7. Documentação em `README.md` (como configurar webhooks na Meta, como criar formulário Lead Ads, exemplos de fluxo)

Confirma para eu executar?
