import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({ contactId: z.string().uuid() });

export const generateAIReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;

    const { supabase } = context;
    const { data: contact } = await supabase.from("contacts").select("*").eq("id", data.contactId).single();
    const { data: msgs } = await supabase
      .from("messages").select("direction, content").eq("contact_id", data.contactId)
      .order("created_at", { ascending: false }).limit(20);
    const { data: settings } = contact?.org_id
      ? await supabase.from("settings").select("ai_system_prompt, business_name").eq("org_id", contact.org_id).maybeSingle()
      : { data: null as { ai_system_prompt: string | null; business_name: string | null } | null };

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

    if (!apiKey) {
      return {
        reply: `Olá, ${contact?.name ?? "tudo bem"}! Posso te ajudar com uma demonstração, valores ou tirar dúvidas sobre a solução?`,
        fallback: true,
      };
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("generateAIReply failed", { status: res.status, body: text.slice(0, 500) });
      const leadName = contact?.name ?? "tudo bem";
      return {
        reply: `Olá, ${leadName}! Posso te ajudar com uma demonstração, valores ou tirar dúvidas sobre a solução?`,
        fallback: true,
      };
    }
    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    const reply = json.choices?.[0]?.message?.content?.trim() ?? "";
    return { reply: reply || "Olá! Como posso te ajudar hoje?", fallback: false };
  });
