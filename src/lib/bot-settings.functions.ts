import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TrainingSchema = z.object({
  businessName: z.string().trim().min(1, "Informe o nome do negócio").max(120),
  welcomeMessage: z.string().trim().max(600).optional().default(""),
  botScript: z.string().trim().min(20, "Informe um roteiro com pelo menos 20 caracteres").max(8000, "O roteiro deve ter até 8.000 caracteres"),
});

export const getBotTraining = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("settings")
      .select("business_name, welcome_message, ai_system_prompt, updated_at")
      .eq("id", 1)
      .single();

    if (error) throw new Error(error.message);
    return {
      businessName: data.business_name ?? "NexaBot",
      welcomeMessage: data.welcome_message ?? "",
      botScript: data.ai_system_prompt ?? "",
      updatedAt: data.updated_at ?? null,
    };
  });

export const saveBotTraining = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TrainingSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("settings")
      .update({
        business_name: data.businessName,
        welcome_message: data.welcomeMessage,
        ai_system_prompt: data.botScript,
      })
      .eq("id", 1);

    if (error) throw new Error(error.message);
    return { ok: true };
  });
