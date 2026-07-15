# Análise da demanda

Você está pedindo um **sistema de fila de atendimento humano** com SLA, escalonamento e notificações. Hoje o fluxo é binário (`in_conversation` ↔ `human`/`human_requested`) e sem controle de tempo. Vou estruturar em 4 pilares alinhados aos seus pontos.

## 1. Modelo de dados (nova tabela `handoff_queue`)

Cada solicitação de atendimento humano vira um "ticket" com cronômetro próprio:

```
handoff_queue
├─ id, contact_id, status (waiting | in_service | resolved | abandoned)
├─ requested_at         ← início do cronômetro
├─ assigned_to (uuid)   ← operador que assumiu (null enquanto na fila)
├─ assigned_at
├─ resolved_at
├─ last_alert_at        ← controle das notificações periódicas
├─ alert_count          ← quantas vezes já avisou
├─ escalated_at         ← quando avisou o supervisor
└─ customer_notified_at ← quando o bot mandou "seu atendente já vem"
```

Ao mudar o contato para `human_requested`, um trigger insere na fila.
Ao clicar "Assumir", muda para `in_service` + `assigned_to`.
Ao clicar "Devolver ao bot" ou enviar NPS, marca `resolved`.

## 2. Papéis e destinatários das notificações

Extensão do enum `app_role` (hoje: `admin`, `operator`) → adicionar `supervisor`.
Configuração em `settings`:
- `handoff_alert_phone` — telefone (WhatsApp) que recebe os alertas iniciais
- `handoff_supervisor_phone` — telefone do supervisor (escalonamento)
- Canal: WhatsApp Cloud API (já integrado). SMS fica para v2 se quiser (exigiria conectar GatewayAPI ou Twilio).

## 3. Regras de tempo (worker executando a cada minuto)

Um cron a cada 1 min varre `handoff_queue` onde `status IN ('waiting','in_service')`:

| Evento | Condição | Ação |
|---|---|---|
| **Alerta inicial** | `alert_count = 0` (assim que entra na fila) | WhatsApp para `handoff_alert_phone`: "Novo pedido de atendimento de {nome} ({telefone})" |
| **Aviso ao cliente** | `status='waiting'` e `now - requested_at >= 30min` (configurável 30–60) e `customer_notified_at IS NULL` | Bot envia ao cliente: "Você já foi direcionado a um atendente, ele está finalizando outro atendimento e falará com você em breve." |
| **Escalonamento ao supervisor** | `status='waiting'` e `now - requested_at >= 70min` e `escalated_at IS NULL` | WhatsApp para `handoff_supervisor_phone`: "Atendimento de {nome} sem resposta há 70 min" |
| **Lembrete recorrente** | `status='waiting'` e `now - last_alert_at >= 30min` (após o inicial) | WhatsApp para `handoff_alert_phone`: "Atendimento pendente há {X} min" — atualiza `last_alert_at`, incrementa `alert_count` |
| **Timeout / auto-devolução** (opcional, você citou "não houve contato") | `status='in_service'` e `now - assigned_at >= 60min` sem outbound do operador | Volta contato para `in_conversation`, `handoff_queue.status='abandoned'`, notifica supervisor |

Os limiares (30/60/70 min) ficam em `settings` para você ajustar sem deploy.

## 4. Fila com cronômetro na UI

Nova rota `/app/queue` (ou aba dentro do Inbox):
- Lista de tickets `waiting` ordenados por `requested_at` (FIFO)
- Cada linha: nome, telefone, **cronômetro ao vivo** (tempo desde `requested_at`), badge de cor (verde <30min, amarelo 30–70, vermelho >70)
- Botão "Assumir" → move para `in_service` e leva ao Inbox
- Aba "Em atendimento" com cronômetro desde `assigned_at`
- Realtime via Supabase channel na tabela `handoff_queue`

No Inbox, o card do contato passa a mostrar o tempo desde a solicitação.

## Componentes técnicos

**Migração (schema)**
- Enum `handoff_status`, tabela `handoff_queue` com GRANTs + RLS
- Adiciona `supervisor` ao enum `app_role`
- Adiciona `handoff_alert_phone`, `handoff_supervisor_phone`, `handoff_wait_customer_min` (default 30), `handoff_escalate_min` (default 70), `handoff_reminder_interval_min` (default 30) em `settings`
- Trigger `tg_handoff_on_status_change`: quando `contacts.status` vira `human_requested`, cria row em `handoff_queue`; quando vira `human`, marca `in_service` + `assigned_to`; quando volta para `in_conversation`, marca `resolved`

**Server route pública (cron)**
- `src/routes/api/public/handoff/tick.ts` — chamada pelo pg_cron a cada 1 min
- Lê `handoff_queue`, aplica as regras da tabela acima, envia WhatsApp via `whatsapp.server.ts` (já existe)

**pg_cron**
- `SELECT cron.schedule('handoff-tick', '* * * * *', $$ SELECT net.http_post(url:='.../api/public/handoff/tick', ...) $$)`

**Ajustes no webhook do WhatsApp** (`src/routes/api/public/whatsapp/webhook.ts`)
- Quando o cliente pede humano (regra que você já tem), continuar setando `human_requested` (trigger cria a fila)

**Ajustes no handoff server fn** (`src/lib/handoff.functions.ts`)
- `takeOverContact` → também atualiza `handoff_queue` (status `in_service`, `assigned_to = userId`)
- `releaseToBot` → marca `resolved` e reseta contato

**UI**
- Nova página `/app/queue` com lista + cronômetros (React state + `setInterval`)
- Item de menu "Fila" no `src/routes/app.tsx`

## Perguntas antes de implementar

1. **Canal de alerta**: WhatsApp basta, ou você quer também SMS (via GatewayAPI, exige nova conexão)?
2. **Números de alerta**: um único telefone recebe todos os pedidos, ou por operador? (Vou começar com um telefone global em settings — mais simples.)
3. **Timeout de auto-devolução ao bot** (item extra que citei): implementar agora (ex.: 60 min sem resposta do operador → volta ao bot) ou deixar apenas manual via botão?
4. **Limiares** 30/60/70 min: confirmo os padrões e deixo editável em Settings?

Confirmando essas 4 respostas, executo tudo em uma leva (migração + cron + server route + UI da fila + ajustes handoff).