# Manual de Testes e Configuração — Nexabot

Guia passo-a-passo para configurar o workspace, integrar canais (WhatsApp, Widget, Meta Lead Ads), validar a IA, testar a fila de atendimento humano com timeouts/escalonamento e rodar os testes técnicos.

---

## 1. Pré-requisitos

- Conta criada em `/auth` (o signup gera automaticamente: **organização**, departamento **Geral** e **settings** padrão).
- Acesso ao painel Meta Business Manager (para WhatsApp Cloud API e Lead Ads).
- Número de WhatsApp de teste com DDI (ex.: `5511999999999`).
- URLs públicas do projeto (visíveis em **Configurações → URLs de webhook**):
  - Preview: `https://project--<id>.lovable.app`
  - Publicado: `https://omni-nexa-bot.lovable.app`

---

## 2. Configuração inicial (painel `/app/settings`)

### 2.1 Identidade e IA
1. **Nome do negócio** — aparece nas mensagens e e-mails.
2. **Mensagem de boas-vindas** — enviada no primeiro contato.
3. **System prompt da IA** — descreva tom, escopo, o que a IA pode/não pode fazer. Ex.:
   > "Você é o atendente virtual da Clínica X. Responda em português, tom acolhedor. Nunca prometa preços sem consultar tabela. Se o cliente pedir humano, transfira imediatamente."

### 2.2 Fila de atendimento humano
Preencha em **Configurações → Fila de atendimento humano**:

| Campo | Recomendado | Função |
|---|---|---|
| Telefone que recebe alertas | WhatsApp do atendente (com DDI) | Recebe o alerta inicial quando cliente pede humano |
| Telefone do supervisor | WhatsApp do supervisor | Recebe escalonamento se ninguém assumir |
| Avisar cliente após (min) | **30** | Bot envia "estou finalizando outro atendimento, já te chamo" |
| Escalar ao supervisor após (min) | **70** | Supervisor recebe alerta de SLA estourado |
| Intervalo dos lembretes (min) | **30** | Recorrência dos lembretes ao atendente enquanto o ticket ficar aberto |
| Devolver ao bot após ociosidade (min) | **0** para desativar, ou 60 | Se operador ficar inativo, contato volta ao bot |

### 2.3 Webhook externo (opcional)
Cole a URL do Zapier/Make/n8n em **Webhook externo** para receber cada novo lead em CRM/ERP.

---

## 3. Integração WhatsApp Cloud API

1. Em **Meta Business Manager → WhatsApp → Configuração**, defina:
   - **Callback URL**: `https://omni-nexa-bot.lovable.app/api/public/whatsapp/webhook`
   - **Verify Token**: o mesmo valor salvo no secret `WHATSAPP_VERIFY_TOKEN`.
2. Assine os campos: `messages`, `message_status`.
3. Em **Configurações → Diagnóstico WhatsApp**, envie uma mensagem para o número — o campo *"Última chamada recebida"* deve atualizar em segundos.
4. Se **não** atualizar: verifique se o Callback URL é o de produção (não use URL de preview/login).

---

## 4. Integração Meta Lead Ads

- Callback: `https://omni-nexa-bot.lovable.app/api/public/meta/leads/webhook`
- Cada lead cria automaticamente um `contact` e dispara o funil configurado.

---

## 5. Widget para site

1. Em **Integrações → Widget**, copie o snippet `<script src="…/api/public/widget/embed.js">`.
2. Cole antes de `</body>` no site do cliente.
3. Teste enviando uma mensagem — deve aparecer em **Inbox** com origem `widget`.

---

## 6. Roteiro de testes funcionais

### 6.1 Teste do bot (resposta automática)
1. Envie via WhatsApp: *"Olá, quais os horários?"*
2. Verificar em `/app/inbox`: contato criado, mensagem recebida, resposta da IA gerada.
3. Confirmar no WhatsApp que a resposta chegou.

### 6.2 Teste de transferência para humano
1. Envie: *"quero falar com um atendente"*.
2. **Verificar em ≤10 s**:
   - Contato entra em `/app/queue` na seção **Aguardando**.
   - Cronômetro rodando (verde < 30 min, âmbar 30-70 min, vermelho > 70 min).
   - WhatsApp do atendente (campo `handoff_alert_phone`) recebe alerta.
3. **Não assuma o atendimento** e aguarde:
   - **Aos 30 min**: cliente recebe automaticamente *"estou finalizando outro atendimento…"*. Verificar chip `cliente avisado` na fila.
   - **Aos 60 min**: novo lembrete ao atendente.
   - **Aos 70 min**: supervisor recebe escalonamento. Chip `escalado` aparece.
4. Clique **Assumir** — o card move para **Em atendimento** e o cronômetro reinicia a partir de `assigned_at`.
5. Clique **Devolver ao bot** no Inbox — status volta para `resolved` e o bot reassume.

### 6.3 Teste do worker de timeout
O worker roda via cron em `/api/public/handoff/tick`. Para forçar manualmente:

```bash
curl -X POST https://omni-nexa-bot.lovable.app/api/public/handoff/tick
```

Retorno esperado: JSON com contadores `notified`, `escalated`, `reminded`, `auto_returned`.

### 6.4 Teste de tickets
1. No Inbox, abra um contato → **Criar ticket**.
2. Confirmar protocolo `YYYYMMDD-000001` gerado.
3. Testar mudança de status: `aberto → em_andamento → resolvido`.

### 6.5 Teste multi-tenant (isolamento)
1. Crie uma segunda conta em `/auth` (outro e-mail).
2. Faça login e confirme que **não vê** contatos, mensagens, tickets da primeira org.
3. Isso valida RLS (`is_member_of()`).

---

## 7. Testes técnicos (dev)

```bash
# Typecheck
bunx tsgo --noEmit

# Testes unitários
bunx vitest run

# Build de produção
bun run build
```

---

## 8. Checklist antes de entregar a um cliente

- [ ] System prompt da IA revisado com o cliente.
- [ ] Mensagem de boas-vindas personalizada.
- [ ] Webhook WhatsApp respondendo (diagnóstico atualiza).
- [ ] Telefones de alerta e supervisor cadastrados e testados.
- [ ] Timeouts revisados (30/70/30 é o padrão; ajuste ao SLA do cliente).
- [ ] Widget instalado no site (se aplicável).
- [ ] Webhook externo apontando para CRM do cliente (se aplicável).
- [ ] Teste E2E: bot responde → cliente pede humano → atendente é notificado → cliente é avisado no minuto 30 → supervisor no 70.
- [ ] Segunda conta criada para validar isolamento multi-tenant.

---

## 9. Troubleshooting rápido

| Sintoma | Causa provável | Correção |
|---|---|---|
| Mensagem chega no WA mas nada no Inbox | Callback URL errado na Meta | Reconfigurar com URL de produção |
| IA não responde | `system_prompt` vazio ou `LOVABLE_API_KEY` sem crédito | Ajustar prompt / recarregar créditos |
| Alerta de handoff não chega | `handoff_alert_phone` sem DDI ou token WA expirado | Corrigir formato `55DDDNNNNNNNN` |
| Cliente não recebe aviso de 30 min | Cron não está batendo `/handoff/tick` | Rodar `curl` do item 6.3; verificar pg_cron |
| Fila vazia mesmo com pedido de humano | Intent não detectado | Ajustar prompt: incluir palavras-chave "humano, atendente, pessoa" |
| Contatos de outra org aparecem | RLS quebrado após migração manual | Revisar policies com `is_member_of(org_id)` |

---

## 10. Referências rápidas

- Painel operador: `/app/inbox`, `/app/queue`, `/app/contacts`, `/app/tickets`
- Configuração: `/app/settings`, `/app/integrations`, `/app/funnels`, `/app/templates`
- Analytics: `/app/analytics`, `/app/dashboard`
- Endpoints públicos: `/api/public/whatsapp/webhook`, `/api/public/meta/leads/webhook`, `/api/public/widget/chat`, `/api/public/handoff/tick`, `/api/public/cron/tick`
