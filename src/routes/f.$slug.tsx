import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const getForm = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin
      .from("settings")
      .select("business_name, form_headline, form_products, form_slug")
      .eq("form_slug", data.slug)
      .maybeSingle();
    if (!s) return null;
    return {
      business_name: s.business_name ?? "Atendimento",
      headline: s.form_headline ?? "Peça seu orçamento",
      products: (s.form_products ?? []) as string[],
      slug: s.form_slug as string,
    };
  });

export const Route = createFileRoute("/f/$slug")({
  component: PublicForm,
  loader: ({ params }) => getForm({ data: { slug: params.slug } }),
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.headline} · ${loaderData.business_name}` : "Formulário de contato";
    const description = loaderData
      ? `Envie seus dados e a equipe de ${loaderData.business_name} responde pelo WhatsApp em instantes.`
      : "Formulário de captação de leads.";
    return {
      meta: [
        { title: title.slice(0, 60) },
        { name: "description", content: description.slice(0, 155) },
        { property: "og:title", content: title.slice(0, 60) },
        { property: "og:description", content: description.slice(0, 155) },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
});

function PublicForm() {
  const info = Route.useLoaderData();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!info) {
    return (
      <main className="grid min-h-screen place-items-center p-8">
        <p className="text-muted-foreground">Formulário não encontrado.</p>
      </main>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      slug: info!.slug,
      name: String(fd.get("name") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      email: String(fd.get("email") ?? "") || undefined,
      origin: "site",
      interest: String(fd.get("interest") ?? "") || undefined,
      event_date: String(fd.get("event_date") ?? "") || undefined,
      estimated_value: fd.get("estimated_value") ? Number(fd.get("estimated_value")) : undefined,
      product: String(fd.get("product") ?? "") || undefined,
    };
    const res = await fetch("/api/public/leads/form", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { ok: boolean; error?: string };
    setLoading(false);
    if (json.ok) setSent(true);
    else setError(json.error ?? "Não foi possível enviar. Tente novamente.");
  }

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-border bg-card p-7">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{info.business_name}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{info.headline}</h1>

        {sent ? (
          <p className="mt-6 rounded-lg border border-border bg-background/50 p-4 text-sm">
            Recebemos seus dados! Em instantes falamos com você pelo WhatsApp. 💛
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <F label="Seu nome"><input name="name" required className={i} /></F>
            <F label="WhatsApp (com DDD)"><input name="phone" required placeholder="11999999999" className={i} /></F>
            <F label="E-mail (opcional)"><input name="email" type="email" className={i} /></F>
            {info.products.length > 0 && (
              <F label="O que você procura?">
                <select name="product" className={i}>
                  <option value="">Selecione…</option>
                  {(info.products as string[]).map((p: string) => <option key={p} value={p}>{p}</option>)}
                </select>
              </F>
            )}
            <div className="grid grid-cols-2 gap-3">
              <F label="Data do evento"><input name="event_date" type="date" className={i} /></F>
              <F label="Valor estimado (R$)"><input name="estimated_value" type="number" min={0} step="10" className={i} /></F>
            </div>
            <F label="Conte um pouco do que precisa"><textarea name="interest" rows={3} className={i} /></F>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button disabled={loading} className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
              {loading ? "Enviando…" : "Quero meu orçamento"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

const i = "w-full rounded-md border border-input bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary";
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs text-muted-foreground">{label}</label><div className="mt-1">{children}</div></div>;
}
