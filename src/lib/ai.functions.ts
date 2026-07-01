import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({ contactId: z.string().uuid() });

export const generateAIReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const { supabase } = context;
    const { data: contact } = await supabase.from("contacts").select("*").eq("id", data.contactId).single();
    const { data: msgs } = await supabase
      .from("messages").select("direction, content").eq("contact_id", data.contactId)
      .order("created_at", { ascending: false }).limit(20);
    const { data: settings } = await supabase.from("settings").select("ai_system_prompt, business_name").eq("id", 1).single();

    const history = [...(msgs ?? [])].reverse();
    const systemPrompt = `${settings?.ai_system_prompt ?? "Você é um assistente comercial."}\n\nNegócio: ${settings?.business_name ?? "NexaBot"}.\nLead: ${contact?.name ?? "(sem nome)"} (${contact?.phone ?? ""}). Origem: ${contact?.origin ?? ""}. Tags: ${(contact?.tags ?? []).join(", ") || "nenhuma"}.\nResponda em português, curto e objetivo (máx. 2 frases).`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...history.map((m) => ({
        role: m.direction === "inbound" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      })),
    ];
    // If empty history, add a nudge
    if (history.length === 0) {
      messages.push({ role: "user", content: "Faça uma abordagem inicial cordial e pergunte o objetivo do lead." });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
      throw new Error(`IA falhou: ${res.status} ${text}`);
    }
    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    const reply = json.choices?.[0]?.message?.content?.trim() ?? "";
    return { reply };
  });
