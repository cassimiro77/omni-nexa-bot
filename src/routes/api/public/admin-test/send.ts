import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(8).max(20),
  mode: z.enum(["freeform", "template"]),
  message: z.string().trim().max(1000).optional(),
  templateName: z.string().trim().max(80).optional(),
  languageCode: z.string().trim().max(10).optional(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Nexabot-Auth, X-Requested-With, Accept, Origin",
  "Access-Control-Max-Age": "86400",
} as const;

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: corsHeaders });
}

function jsonError(message: string, status = 400) {
  return json({ ok: false, message }, status);
}

export const Route = createFileRoute("/api/public/admin-test/send")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return jsonError("Backend indisponível. Verifique a conexão do projeto.", 500);
        }

        const authHeader = request.headers.get("authorization") ?? request.headers.get("x-nexabot-auth") ?? "";
        console.info("[admin-test-send] auth headers", {
          hasAuthorization: Boolean(request.headers.get("authorization")),
          hasFallbackAuth: Boolean(request.headers.get("x-nexabot-auth")),
          contentType: request.headers.get("content-type"),
          origin: request.headers.get("origin"),
        });
        if (!authHeader.startsWith("Bearer ")) {
          return jsonError("Sessão não enviada. Faça login novamente e tente de novo.", 401);
        }

        const token = authHeader.replace("Bearer ", "").trim();
        if (!token || token.split(".").length !== 3) {
          return jsonError("Sessão inválida. Faça login novamente e tente de novo.", 401);
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return jsonError("Dados inválidos para envio.", 400);
        }

        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return jsonError("Revise nome, telefone e mensagem antes de enviar.", 400);
        }

        const data = parsed.data;
        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: {
            fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
            headers: { Authorization: `Bearer ${token}` },
          },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });

        const { data: authData, error: authError } = await supabase.auth.getUser(token);
        const userId = authData.user?.id;
        if (authError || !userId) {
          console.error("[admin-test-send] invalid user token", { message: authError?.message });
          return jsonError("Sessão inválida ou expirada. Faça login novamente.", 401);
        }

        const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
          _user_id: userId,
          _role: "admin",
        });
        if (roleError) {
          console.error("[admin-test-send] role check failed", { message: roleError.message });
          return jsonError("Não foi possível validar seu perfil administrativo.", 403);
        }
        if (!isAdmin) return jsonError("Acesso restrito a administradores.", 403);

        const phoneClean = data.phone.replace(/[^\d]/g, "");
        if (phoneClean.length < 8) return jsonError("Telefone inválido.", 400);

        const { sendWhatsAppText, sendWhatsAppTemplate } = await import("@/lib/whatsapp.server");

        const { data: existing, error: existingError } = await supabase
          .from("contacts")
          .select("id")
          .eq("phone", phoneClean)
          .maybeSingle();
        if (existingError) {
          console.error("[admin-test-send] contact lookup failed", { message: existingError.message });
          return jsonError("Não foi possível verificar o contato.", 500);
        }

        let contactId = existing?.id as string | undefined;
        if (!contactId) {
          const { data: inserted, error: insertError } = await supabase
            .from("contacts")
            .insert({ name: data.name, phone: phoneClean, origin: "admin_test", status: "new" })
            .select("id")
            .single();
          if (insertError) {
            console.error("[admin-test-send] contact insert failed", { message: insertError.message });
            return jsonError("Não foi possível criar o contato de teste.", 500);
          }
          contactId = inserted.id;
        } else {
          const { error: updateError } = await supabase.from("contacts").update({ name: data.name }).eq("id", contactId);
          if (updateError) console.error("[admin-test-send] contact update failed", { message: updateError.message });
        }

        let bodyLogged = "";
        const result = data.mode === "freeform"
          ? await (async () => {
              const msg = (data.message ?? "").trim();
              if (!msg) return { ok: false, error: "Mensagem obrigatória no modo livre." };
              bodyLogged = msg;
              return sendWhatsAppText(phoneClean, msg);
            })()
          : await (async () => {
              const tpl = data.templateName?.trim() || "hello_world";
              const lang = data.languageCode?.trim() || "en_US";
              bodyLogged = `[template:${tpl}/${lang}]`;
              return sendWhatsAppTemplate(phoneClean, tpl, lang);
            })();

        const { error: messageError } = await supabase.from("messages").insert({
          contact_id: contactId,
          channel: "whatsapp",
          direction: "outbound",
          content: bodyLogged,
          wa_message_id: result.wa_message_id ?? null,
          metadata: {
            source: "admin_test",
            mode: data.mode,
            ok: result.ok,
            error: result.error ?? null,
          },
        });
        if (messageError) console.error("[admin-test-send] message log failed", { message: messageError.message });

        if (!result.ok) return jsonError(result.error ?? "Falha no envio pelo WhatsApp.", 502);
        return json({ ok: true, contactId, waMessageId: result.wa_message_id ?? null });
      },
    },
  },
});