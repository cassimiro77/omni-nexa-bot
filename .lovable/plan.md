
## Escopo desta rodada

Foco em dois canais: **WhatsApp avançado** e **Áudio (STT/TTS)** dentro do próprio WhatsApp. E-mail/Jira/telefonia ficam para rodadas seguintes.

---

## 1. WhatsApp avançado

Tudo continua chegando no webhook já existente (`/api/public/whatsapp/webhook`). Vou estender o processador:

- **Menu interativo de boas-vindas** na primeira mensagem do contato:
  1. Vendas / Planos
  2. Suporte
  3. Dúvidas frequentes
  4. Falar com atendente humano
- **Roteamento por intenção** usando a IA + regras simples:
  - Vendas → segue com IA usando o roteiro comercial (já existente em `settings.ai_system_prompt`).
  - Suporte / Dúvidas → IA com base no mesmo roteiro (base de conhecimento única por enquanto).
  - "Atendente humano" ou frases equivalentes → **handoff**: marca o contato com `status = 'human_requested'`, silencia o bot e notifica no Inbox.
- **Handoff humano**: enquanto o contato estiver com `human_requested` ou `human`, o webhook NÃO responde automaticamente. No Inbox, um botão "Devolver ao bot" reativa.
- **NPS pós-atendimento**: nova tabela `nps_responses`. Um botão no Inbox ("Encerrar e enviar NPS") dispara uma pergunta 0–10 pelo WhatsApp; a próxima resposta numérica do contato é gravada como NPS e o bot agradece.
- **Consulta de status de pedido / agendamento**: por enquanto ficam como **respostas guiadas pela IA** (ela pede o número do pedido e devolve uma mensagem-padrão). Integrações reais com e-commerce/calendário exigem sistemas que ainda não temos — sinalizo como próxima fase.
- **Carrinho abandonado proativo**: também próxima fase (depende de integração com plataforma de e-commerce).

## 2. Áudio (STT/TTS) no WhatsApp

- **Recebimento de áudio**: quando o webhook receber uma mensagem do tipo `audio`/`voice`, baixar o binário via `https://graph.facebook.com/v21.0/{media_id}` (usando `META_WA_TOKEN`), enviar para a Lovable AI STT (`openai/gpt-4o-mini-transcribe`) e usar a transcrição como conteúdo da mensagem — a partir daí, mesmo fluxo de texto.
- A mensagem salva no banco fica com `content = transcrição` e `metadata.audio = { media_id, mime }` para auditoria.
- **Resposta em áudio (opcional)**: nova flag `settings.reply_with_audio` (default `false`). Quando `true`, além de mandar o texto, o bot gera TTS com `openai/gpt-4o-mini-tts`, faz upload para o Storage do backend e envia como áudio via `messaging_product: whatsapp, type: audio, audio: { link }`.
- Toggle na página **Treinamento** para ligar/desligar a resposta em áudio.

## 3. Alterações no schema (backend)

Migração única:

- `contacts.status` — passa a aceitar também `human_requested` e `human` (é `text`, sem enum, então só precisa refletir na UI).
- Nova tabela `public.nps_responses` (`id`, `contact_id`, `score int`, `comment text`, `created_at`) com RLS + GRANTs (SELECT/INSERT para `authenticated`, ALL para `service_role`).
- Nova coluna `settings.reply_with_audio boolean default false`.
- Novo bucket **público** `wa-audio` para hospedar TTS gerado (WhatsApp precisa de URL público).

## 4. UI

- **Inbox** (`app.inbox.tsx`): botão "Assumir atendimento" (vira `human`), "Devolver ao bot" (volta a `in_conversation`), "Encerrar e enviar NPS".
- **Treinamento** (`app.training.tsx`): toggle "Responder também em áudio".
- **Analytics** (`app.analytics.tsx`): card com NPS médio e distribuição de scores.

## 5. Arquivos afetados

- `src/routes/api/public/whatsapp/webhook.ts` — grande refactor: baixa mídia, STT, handoff, menu inicial, NPS listener.
- `src/lib/whatsapp.server.ts` — novos helpers `downloadWhatsAppMedia`, `sendWhatsAppAudio`.
- `src/lib/nps.functions.ts` (novo) — enviar convite NPS, listar respostas.
- `src/lib/handoff.functions.ts` (novo) — assumir/devolver contato.
- `src/lib/bot-settings.functions.ts` — inclui `reply_with_audio`.
- `src/routes/app.inbox.tsx`, `app.training.tsx`, `app.analytics.tsx` — UI.
- Migração SQL.

## Fora do escopo desta rodada (fases seguintes)

- E-mail (IMAP/Gmail) → Jira: aguardando conta Jira ou sistema alternativo.
- Voz por telefonia (Twilio/PABX).
- Portal de autoatendimento Jira / sync de tickets.
- Integração real com e-commerce (carrinho abandonado, status de pedido) e calendário (agendamento).
- Dashboards avançados de aprendizado contínuo e retreino automático.

Confirma para eu implementar essa rodada?
