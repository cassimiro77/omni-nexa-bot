# Plano de Testes: Manual + Integração com Campanhas Meta

Validação completa do NexaBot em duas fases: primeiro exercitar todos os fluxos manualmente com um número de teste, depois plugar em uma campanha real de Lead Ads do Meta e observar o funil ponta a ponta.

## Fase 1 — Testes manuais no WhatsApp

Objetivo: garantir que cada capacidade do bot responde corretamente antes de expor a leads reais.

### 1.1 Recepção e resposta básica
- Enviar "oi" do celular pessoal → confirmar que:
  - Aparece contato novo em `Contatos`
  - Aparece conversa no `Inbox`
  - Bot responde automaticamente com saudação da IA
- Enviar 3-4 mensagens em sequência → confirmar que a IA mantém contexto (usa histórico)

### 1.2 Áudio (voz → texto → voz)
- Gravar áudio no WhatsApp e enviar
- Confirmar: transcrição aparece na mensagem, IA responde (texto ou áudio conforme configurado), áudio de resposta reproduz no celular

### 1.3 Prompt do sistema
- Em `Configurações`, ajustar prompt para o negócio real (ex.: "Você é a Ana, atendente da Prime Digital...")
- Enviar nova mensagem → confirmar tom/persona aplicados

### 1.4 Templates de mensagem
- Em `Templates`, criar/verificar template aprovado na Meta
- Disparar template para o número de teste
- Confirmar entrega e log da mensagem

### 1.5 Funil automatizado
- Em `Funis`, criar funil simples:
  - Gatilho: `first_message`
  - Passos: 1) mensagem de boas-vindas; 2) aguardar 1 min; 3) pergunta de qualificação
- Enviar "oi" de outro número → confirmar sequência disparada nos tempos corretos

### 1.6 Handoff humano
- Em uma conversa ativa, marcar como `handoff` no Inbox
- Enviar nova mensagem → confirmar que IA **não** responde e operador pode responder manualmente

### 1.7 Analytics
- Em `Analytics`, verificar contadores atualizados: leads, mensagens, tempo médio de resposta

### 1.8 Widget de chat no site (opcional)
- Se for usar embed, testar `/widget` em página HTML de teste, enviar mensagem, confirmar chegada no Inbox

---

## Fase 2 — Integração com campanha Meta Lead Ads

Objetivo: leads que preencherem o formulário do anúncio chegam automaticamente no NexaBot e recebem contato via WhatsApp.

### 2.1 Assinar webhook de Leadgen na Meta
No app Meta → Webhooks → objeto **Page** (ou Leadgen), adicionar a mesma URL do webhook do WhatsApp mas com o path de leads:

```
https://omni-nexa-bot.lovable.app/api/public/meta/leads/webhook
```

Campos a marcar: `leadgen`

### 2.2 Conectar a página do Facebook ao app
- Em `Integrações` no NexaBot, autenticar/vincular a Page do Facebook que roda os anúncios
- Confirmar que o app tem permissão `leads_retrieval` e `pages_manage_metadata`

### 2.3 Criar formulário e anúncio de teste
- No Gerenciador de Anúncios da Meta, criar campanha objetivo **Cadastros (Leads)**
- Criar formulário instantâneo com campos: nome, telefone (obrigatório), e-mail
- Publicar com orçamento mínimo (ex.: R$ 20/dia) e público bem restrito (você mesmo, cidade específica)

### 2.4 Teste com Lead Ads Testing Tool
Antes de gastar em anúncio real, use a ferramenta oficial:
```
https://developers.facebook.com/tools/lead-ads-testing
```
- Selecionar Page + Formulário
- Preencher com seus dados (nome + seu telefone WhatsApp)
- Enviar teste
- Verificar em `Contatos` no NexaBot: lead novo apareceu com origem `meta_ads`
- Verificar em `Inbox`: primeira mensagem automática disparada ao seu WhatsApp
- Verificar no celular: mensagem chegou

### 2.5 Funil específico para Lead Ads
Criar funil dedicado:
- Gatilho: `lead_ad_received`
- Passo 1: mensagem de agradecimento + apresentação
- Passo 2: aguardar 5 min sem resposta → mensagem de reforço
- Passo 3: aguardar 1h sem resposta → oferta/CTA final

Testar rodando o Testing Tool novamente e observando tempos.

### 2.6 Teste com anúncio real (pequena verba)
- Ativar campanha por 24-48h
- Monitorar: leads chegando, taxa de resposta ao primeiro contato, conversas ativas
- Ajustar prompt/funil conforme comportamento real

---

## Detalhes técnicos

- **Rate limit Meta**: primeiras horas do dia podem ter latência; janela de 24h para conversas de serviço, fora disso exige template
- **Duplicatas**: NexaBot dedupa lead pelo telefone; testes múltiplos com mesmo número atualizam o mesmo contato
- **Logs**: eventos ficam em `events` (tabela) e podem ser consultados; falhas de envio ficam com `metadata.delivered: false`
- **Custo IA**: cada resposta consome créditos Lovable AI Gateway; monitorar em Settings → Plans & credits
- **Numero de teste Meta (`+1 555 640-8219`)**: só entrega para números na allowlist; produção usa o `+55 11 91796-2877`

## Checklist final antes de escalar

- [ ] Bot responde em < 5s em condições normais
- [ ] Áudio funciona nos dois sentidos
- [ ] Prompt reflete a marca/tom desejado
- [ ] Ao menos 1 funil ativo e testado
- [ ] Handoff manual funciona
- [ ] Lead Ads Testing Tool → mensagem chega no WhatsApp em < 30s
- [ ] Analytics mostra dados coerentes
- [ ] Publicado em URL final (`omni-nexa-bot.lovable.app` ou domínio custom)
