import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const Schema = z.object({
  slug: z.string().min(3).max(64),
  name: z.string().max(120).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email().max(160).optional().nullable(),
  origin: z.string().max(40).optional().nullable(),
  interest: z.string().max(500).optional().nullable(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  estimated_value: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
  product: z.string().max(120).optional().nullable(),
});

export const Route = createFileRoute("/api/public/leads/form")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        let parsed: z.infer<typeof Schema>;
        try {
          parsed = Schema.parse(await request.json());
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof z.ZodError ? e.issues[0]?.message : "payload inválido" },
            { status: 400, headers: cors },
          );
        }
        if (!parsed.phone && !parsed.email) {
          return Response.json({ ok: false, error: "Informe telefone ou e-mail" }, { status: 400, headers: cors });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: settings } = await supabaseAdmin
          .from("settings").select("org_id").eq("form_slug", parsed.slug).maybeSingle();
        if (!settings?.org_id) {
          return Response.json({ ok: false, error: "Formulário não encontrado" }, { status: 404, headers: cors });
        }

        try {
          const { intakeLead } = await import("@/lib/lead-intake.server");
          const result = await intakeLead(
            settings.org_id as string,
            {
              name: parsed.name ?? null,
              phone: parsed.phone ?? null,
              email: parsed.email ?? null,
              origin: parsed.origin ?? "form",
              interest: parsed.interest ?? null,
              event_date: parsed.event_date ?? null,
              estimated_value: parsed.estimated_value ?? null,
              product: parsed.product ?? null,
            },
            { startConversation: true },
          );
          return Response.json({ ok: true, contact_id: result.contactId, crm: result.crm }, { headers: cors });
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : "erro interno" },
            { status: 500, headers: cors },
          );
        }
      },
    },
  },
});
