import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const IdSchema = z.object({ contactId: z.string().uuid() });

export const takeOverContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("contacts").update({ status: "human" }).eq("id", data.contactId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const releaseToBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("contacts").update({ status: "in_conversation" }).eq("id", data.contactId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
