import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — NexaBot" },
      { name: "description", content: "Como o NexaBot coleta, usa, armazena e protege dados pessoais dos usuários e leads." },
      { property: "og:title", content: "Política de Privacidade — NexaBot" },
      { property: "og:description", content: "Como o NexaBot coleta, usa, armazena e protege dados pessoais." },
      { property: "og:url", content: "https://omni-nexa-bot.lovable.app/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://omni-nexa-bot.lovable.app/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-foreground">
      <Link to="/" className="text-sm text-muted-foreground hover:underline">← Voltar</Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Política de Privacidade</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última atualização: 14/07/2026</p>

      <section className="prose prose-invert mt-8 space-y-6 text-sm leading-relaxed">
        <p>
          Esta Política de Privacidade descreve como o <strong>NexaBot</strong> ("nós", "nosso") coleta,
          usa, armazena e protege informações dos usuários da plataforma e dos leads/contatos
          atendidos por meio dela.
        </p>

        <h2 className="text-lg font-semibold">1. Dados que coletamos</h2>
        <ul className="ml-5 list-disc space-y-1">
          <li>Dados de conta: nome, e-mail e credenciais de autenticação.</li>
          <li>Dados de leads/contatos: nome, número de WhatsApp, mensagens trocadas, origem do lead e tags.</li>
          <li>Dados técnicos: logs de acesso, endereço IP, informações do dispositivo/navegador.</li>
          <li>Integrações: dados recebidos de Meta/WhatsApp Cloud API e Meta Lead Ads mediante autorização.</li>
        </ul>

        <h2 className="text-lg font-semibold">2. Como usamos os dados</h2>
        <ul className="ml-5 list-disc space-y-1">
          <li>Prestar o serviço de atendimento omnichannel e automação com IA.</li>
          <li>Enviar e receber mensagens no WhatsApp em nome do usuário da plataforma.</li>
          <li>Gerar respostas automatizadas por meio de modelos de IA.</li>
          <li>Melhorar a qualidade do serviço, segurança e prevenção a fraude.</li>
        </ul>

        <h2 className="text-lg font-semibold">3. Base legal (LGPD)</h2>
        <p>
          Tratamos dados com base em consentimento, execução de contrato, cumprimento de obrigação
          legal e legítimo interesse, conforme o art. 7º da Lei Geral de Proteção de Dados
          (Lei 13.709/2018).
        </p>

        <h2 className="text-lg font-semibold">4. Compartilhamento</h2>
        <p>
          Não vendemos dados pessoais. Compartilhamos apenas com provedores essenciais à operação:
          infraestrutura de nuvem, provedores de banco de dados, Meta Platforms (WhatsApp Cloud API),
          e provedores de IA (Lovable AI Gateway), sempre sob obrigações de confidencialidade.
        </p>

        <h2 className="text-lg font-semibold">5. Retenção</h2>
        <p>
          Mantemos os dados enquanto a conta estiver ativa ou conforme necessário para cumprir
          obrigações legais. O titular pode solicitar exclusão a qualquer momento.
        </p>

        <h2 className="text-lg font-semibold">6. Segurança</h2>
        <p>
          Aplicamos criptografia em trânsito (HTTPS), controle de acesso baseado em papéis,
          segregação por Row-Level Security no banco de dados e segredos armazenados de forma
          protegida.
        </p>

        <h2 className="text-lg font-semibold">7. Direitos do titular</h2>
        <p>
          Você pode solicitar acesso, correção, portabilidade, anonimização ou exclusão dos seus
          dados escrevendo para o contato abaixo.
        </p>

        <h2 className="text-lg font-semibold">8. Exclusão de dados</h2>
        <p>
          Para solicitar a exclusão completa dos seus dados, envie um e-mail com o assunto
          <em> "Exclusão de dados"</em> para o contato indicado abaixo. Atenderemos em até 15 dias úteis.
        </p>

        <h2 className="text-lg font-semibold">9. Contato do Encarregado (DPO)</h2>
        <p>
          E-mail: <a className="text-primary underline" href="mailto:privacidade@nexabot.app">privacidade@nexabot.app</a>
        </p>

        <h2 className="text-lg font-semibold">10. Alterações</h2>
        <p>
          Podemos atualizar esta Política periodicamente. A data no topo indica a última revisão.
        </p>
      </section>
    </main>
  );
}
