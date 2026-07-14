import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Termos de Serviço — NexaBot" },
      { name: "description", content: "Termos e condições para uso da plataforma NexaBot." },
      { property: "og:title", content: "Termos de Serviço — NexaBot" },
      { property: "og:description", content: "Termos e condições para uso da plataforma NexaBot." },
      { property: "og:url", content: "https://omni-nexa-bot.lovable.app/terms" },
    ],
    links: [{ rel: "canonical", href: "https://omni-nexa-bot.lovable.app/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-foreground">
      <Link to="/" className="text-sm text-muted-foreground hover:underline">← Voltar</Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Termos de Serviço</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última atualização: 14/07/2026</p>

      <section className="prose prose-invert mt-8 space-y-6 text-sm leading-relaxed">
        <p>
          Estes Termos regem o uso da plataforma <strong>NexaBot</strong>. Ao criar uma conta ou
          utilizar o serviço, você concorda com estes Termos.
        </p>

        <h2 className="text-lg font-semibold">1. O serviço</h2>
        <p>
          O NexaBot é uma plataforma de atendimento omnichannel com IA que integra WhatsApp Cloud
          API, Meta Lead Ads e outros canais para captura, qualificação e conversão de leads.
        </p>

        <h2 className="text-lg font-semibold">2. Conta e responsabilidades</h2>
        <ul className="ml-5 list-disc space-y-1">
          <li>Você é responsável pelas credenciais e por toda a atividade em sua conta.</li>
          <li>É proibido enviar spam, conteúdo ilegal, ofensivo, discriminatório ou fraudulento.</li>
          <li>É proibido burlar as políticas do WhatsApp Business e da Meta Platforms.</li>
        </ul>

        <h2 className="text-lg font-semibold">3. Uso do WhatsApp</h2>
        <p>
          Ao conectar sua conta do WhatsApp Business, você declara ter direito de fazê-lo e concorda
          em cumprir a{" "}
          <a href="https://www.whatsapp.com/legal/business-policy" className="text-primary underline">
            Política de Negócios do WhatsApp
          </a>{" "}
          e a{" "}
          <a href="https://www.whatsapp.com/legal/commerce-policy" className="text-primary underline">
            Política Comercial
          </a>.
        </p>

        <h2 className="text-lg font-semibold">4. Pagamentos</h2>
        <p>
          Planos e cobrança seguem os valores anunciados no site. A falta de pagamento pode
          resultar em suspensão da conta.
        </p>

        <h2 className="text-lg font-semibold">5. Propriedade intelectual</h2>
        <p>
          Todo o software, marca e conteúdo do NexaBot são de propriedade dos seus titulares. Você
          mantém a propriedade dos dados que envia à plataforma.
        </p>

        <h2 className="text-lg font-semibold">6. Limitação de responsabilidade</h2>
        <p>
          O serviço é fornecido "no estado em que se encontra". Não nos responsabilizamos por
          lucros cessantes, perdas indiretas ou indisponibilidade de serviços de terceiros
          (Meta, provedores de IA, etc.).
        </p>

        <h2 className="text-lg font-semibold">7. Rescisão</h2>
        <p>
          Você pode encerrar sua conta a qualquer momento. Podemos suspender ou encerrar contas que
          violem estes Termos.
        </p>

        <h2 className="text-lg font-semibold">8. Legislação e foro</h2>
        <p>
          Estes Termos são regidos pelas leis do Brasil. Fica eleito o foro da comarca do titular
          da plataforma para dirimir controvérsias.
        </p>

        <h2 className="text-lg font-semibold">9. Contato</h2>
        <p>
          E-mail: <a className="text-primary underline" href="mailto:contato@nexabot.app">contato@nexabot.app</a>
        </p>
      </section>
    </main>
  );
}
