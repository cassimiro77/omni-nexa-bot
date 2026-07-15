# Plano de Testes: Manual + Integração com Campanhas Meta

Validação completa do NexaBot em duas fases: primeiro exercitar todos os fluxos manualmente com um número de teste, depois plugar em uma campanha real de Lead Ads do Meta e observar o funil ponta a ponta.

> **Base URL do app**: https://omni-nexa-bot.lovable.app

## Fase 1 — Testes manuais no WhatsApp

Objetivo: garantir que cada capacidade do bot responde corretamente antes de expor a leads reais.

### 1.1 Recepção e resposta básica
- Enviar "oi" do celular pessoal para o número WhatsApp conectado
- Verificar:
  - Contato novo em [Contatos](https://omni-nexa-bot.lovable.app/app/contacts)
  - Conversa em [Inbox](https://omni-nexa-bot.lovable.app/app/inbox)
  - Bot responde automaticamente com saudação da IA
- Enviar 3-4 mensagens em sequência → confirmar que a IA mantém contexto

### 1.2 Áudio (voz → texto → voz)
- Gravar áudio no WhatsApp e enviar
- Conferir transcrição e resposta em áudio em [Inbox](https://omni-nexa-bot.lovable.app/app/inbox)

### 1.3 Prompt do sistema
- Ajustar em [Configurações](https://omni-nexa-bot.lovable.app/app/settings) o campo "Prompt da IA"
- Ex.: "Você é a Ana, atendente da Prime Digital..."
- Enviar nova mensagem no WhatsApp e confirmar tom/persona aplicados

### 1.4 Templates de mensagem
- Verificar template aprovado em [Templates](https://omni-nexa-bot.lovable.app/app/templates)
- Criar/gerenciar templates no Meta: [WhatsApp Manager → Modelos](https://business.facebook.com/wa/manage/message-templates/)
- Disparar template para o número de teste e confirmar entrega

### 1.5 Funil automatizado
- Criar funil em [Funis](https://omni-nexa-bot.lovable.app/app/funnels):
  - Gatilho: `first_message`
  - Passos: 1) boas-vindas; 2) aguardar 1 min; 3) pergunta de qualificação
- Enviar "oi" de outro número e confirmar sequência

### 1.6 Handoff humano
- Em uma conversa ativa no [Inbox](https://omni-nexa-bot.lovable.app/app/inbox), marcar como `handoff`
- Enviar nova mensagem → IA **não** responde; operador responde manualmente

### 1.7 Analytics
- Conferir contadores em [Analytics](https://omni-nexa-bot.lovable.app/app/analytics): leads, mensagens, tempo médio de resposta

### 1.8 Widget de chat no site (opcional)
- Testar embed via [Integrações](https://omni-nexa-bot.lovable.app/app/integrations) e confirmar chegada no [Inbox](https://omni-nexa-bot.lovable.app/app/inbox)

---

## Fase 2 — Integração com campanha Meta Lead Ads

Objetivo: leads do formulário de anúncio chegam automaticamente no NexaBot e recebem contato via WhatsApp.

### 2.1 Assinar webhook de Leadgen na Meta
- Acesse: [Meta for Developers → Meus Apps](https://developers.facebook.com/apps/)
- Selecione seu app → **Webhooks** → objeto **Page** → campo `leadgen`
- URL do webhook (Callback URL):
  ```
  https://omni-nexa-bot.lovable.app/api/public/meta/leads/webhook
  ```
- Verify Token: o mesmo definido em `META_WA_VERIFY_TOKEN`

### 2.2 Conectar a Page do Facebook
- Em [Integrações](https://omni-nexa-bot.lovable.app/app/integrations), autenticar/vincular a Page
- Gerenciar permissões (`leads_retrieval`, `pages_manage_metadata`) em: [App Review → Permissions](https://developers.facebook.com/apps/) (dentro do seu app)

### 2.3 Criar formulário e anúncio de teste
- Formulários: [Publishing Tools → Instant Forms](https://business.facebook.com/latest/instant_forms)
- Campanha: [Gerenciador de Anúncios](https://business.facebook.com/adsmanager/manage/campaigns) → objetivo **Cadastros (Leads)**
- Campos do form: nome, telefone (obrigatório), e-mail
- Orçamento mínimo (R$ 20/dia) e público bem restrito

### 2.4 Teste com Lead Ads Testing Tool
- Ferramenta oficial: [Lead Ads Testing Tool](https://developers.facebook.com/tools/lead-ads-testing/)
- Selecionar Page + Formulário, preencher com seus dados, enviar teste
- Conferir:
  - Novo lead em [Contatos](https://omni-nexa-bot.lovable.app/app/contacts) com origem `meta_lead_ads`
  - Mensagem inicial em [Inbox](https://omni-nexa-bot.lovable.app/app/inbox)
  - WhatsApp do celular recebeu a mensagem

### 2.5 Funil específico para Lead Ads
Criar em [Funis](https://omni-nexa-bot.lovable.app/app/funnels):
- Gatilho: `lead_ad_received`
- Passo 1: agradecimento + apresentação
- Passo 2: aguardar 5 min sem resposta → reforço
- Passo 3: aguardar 1h sem resposta → CTA final

Retestar com [Lead Ads Testing Tool](https://developers.facebook.com/tools/lead-ads-testing/).

### 2.6 Teste com anúncio real (pequena verba)
- Ativar campanha em [Gerenciador de Anúncios](https://business.facebook.com/adsmanager/manage/campaigns) por 24-48h
- Monitorar em [Analytics](https://omni-nexa-bot.lovable.app/app/analytics)
- Ajustar prompt/funil em [Configurações](https://omni-nexa-bot.lovable.app/app/settings) e [Funis](https://omni-nexa-bot.lovable.app/app/funnels)

---

## Links rápidos

**NexaBot (app):**
- [Dashboard](https://omni-nexa-bot.lovable.app/app/dashboard)
- [Inbox](https://omni-nexa-bot.lovable.app/app/inbox)
- [Contatos](https://omni-nexa-bot.lovable.app/app/contacts)
- [Templates](https://omni-nexa-bot.lovable.app/app/templates)
- [Funis](https://omni-nexa-bot.lovable.app/app/funnels)
- [Analytics](https://omni-nexa-bot.lovable.app/app/analytics)
- [Configurações](https://omni-nexa-bot.lovable.app/app/settings)
- [Integrações](https://omni-nexa-bot.lovable.app/app/integrations)
- [Treinamento](https://omni-nexa-bot.lovable.app/app/training)

**Meta / Facebook:**
- [Business Suite](https://business.facebook.com/)
- [WhatsApp Manager](https://business.facebook.com/wa/manage/)
- [Modelos de mensagem](https://business.facebook.com/wa/manage/message-templates/)
- [Meta for Developers → Apps](https://developers.facebook.com/apps/)
- [Instant Forms](https://business.facebook.com/latest/instant_forms)
- [Gerenciador de Anúncios](https://business.facebook.com/adsmanager/manage/campaigns)
- [Lead Ads Testing Tool](https://developers.facebook.com/tools/lead-ads-testing/)

---

## Detalhes técnicos

- **Rate limit Meta**: janela de 24h para conversas de serviço; fora dela exige template aprovado
- **Duplicatas**: dedupa lead pelo telefone
- **Logs**: eventos em tabela `events`; falhas ficam com `metadata.delivered: false`
- **Custo IA**: cada resposta consome créditos Lovable AI Gateway
- **Número de teste Meta (`+1 555 640-8219`)**: só entrega para números na allowlist; produção usa `+55 11 91796-2877`

## Checklist final antes de escalar

- [ ] Bot responde em < 5s
- [ ] Áudio funciona nos dois sentidos
- [ ] Prompt reflete a marca/tom
- [ ] Ao menos 1 funil ativo e testado
- [ ] Handoff manual funciona
- [ ] Lead Ads Testing Tool → mensagem no WhatsApp em < 30s
- [ ] Analytics com dados coerentes
- [ ] Publicado em URL final
