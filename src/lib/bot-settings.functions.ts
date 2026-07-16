import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SourcePromptEntry = z.object({
  source: z.string().trim().min(1).max(40),
  prompt: z.string().trim().max(4000),
});

const TrainingSchema = z.object({
  businessName: z.string().trim().min(1, "Informe o nome do negócio").max(120),
  welcomeMessage: z.string().trim().max(600).optional().default(""),
  botScript: z.string().trim().min(20, "Informe um roteiro com pelo menos 20 caracteres").max(8000, "O roteiro deve ter até 8.000 caracteres"),
  replyWithAudio: z.boolean().optional().default(false),
  sourcePrompts: z.array(SourcePromptEntry).max(20).optional().default([]),
});

async function orgId(supabase: import("@supabase/supabase-js").SupabaseClient, userId: string) {
  const { data } = await supabase.from("organization_members").select("org_id").eq("user_id", userId).limit(1).maybeSingle();
  if (!data?.org_id) throw new Error("Sem workspace");
  return data.org_id as string;
}

export const getBotTraining = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const org = await orgId(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("settings")
      .select("business_name, welcome_message, ai_system_prompt, reply_with_audio, source_prompts, updated_at" as any)
      .eq("org_id", org)
      .maybeSingle();

    if (error) throw new Error(error.message);
    const row = (data ?? {}) as any;
    const sp = (row.source_prompts ?? {}) as Record<string, string>;
    return {
      businessName: row.business_name ?? "NexaBot",
      welcomeMessage: row.welcome_message ?? "",
      botScript: row.ai_system_prompt ?? "",
      replyWithAudio: row.reply_with_audio ?? false,
      sourcePrompts: Object.entries(sp).map(([source, prompt]) => ({ source, prompt })),
      updatedAt: row.updated_at ?? null,
    };
  });

export const saveBotTraining = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TrainingSchema.parse(input))
  .handler(async ({ data, context }) => {
    const org = await orgId(context.supabase, context.userId);
    const spObj: Record<string, string> = {};
    for (const { source, prompt } of data.sourcePrompts) {
      if (source && prompt) spObj[source] = prompt;
    }
    const { error } = await context.supabase
      .from("settings")
      .update({
        business_name: data.businessName,
        welcome_message: data.welcomeMessage,
        ai_system_prompt: data.botScript,
        reply_with_audio: data.replyWithAudio,
        source_prompts: spObj,
      } as any)
      .eq("org_id", org);

    if (error) throw new Error(error.message);
    return { ok: true };
  });
