// Helpers to resolve the current org_id.
// Multi-tenant: each user belongs to 1 org (created automatically on signup).
// Public webhooks resolve the org by matching the incoming Meta phone_number_id
// against settings.wa_phone_number_id.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Returns the org_id for the current authenticated user (first membership). */
export async function getUserOrgId(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.org_id) throw new Error("Usuário sem workspace. Faça login novamente.");
  return data.org_id as string;
}

/** For cron/fallback: returns the first active org. */
export async function getFirstActiveOrgId(supabaseAdmin: SupabaseClient): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.id as string) ?? null;
}

/**
 * Resolves org + credentials for an inbound WhatsApp webhook.
 *
 * Priority:
 *  1. Match settings.wa_phone_number_id === phoneNumberId (multi-tenant).
 *  2. Fallback to the org whose settings has no wa_phone_number_id AND env
 *     META_WA_PHONE_NUMBER_ID matches phoneNumberId (legacy single-tenant).
 *  3. Fallback to the first active org (never used in production, only for
 *     legacy setups where no per-org number is configured).
 */
export async function resolveOrgForWhatsAppWebhook(
  supabaseAdmin: SupabaseClient,
  phoneNumberId: string | undefined,
): Promise<{ orgId: string; waPhoneNumberId: string | null; waToken: string | null } | null> {
  if (phoneNumberId) {
    const { data } = await supabaseAdmin
      .from("settings")
      .select("org_id, wa_phone_number_id, wa_token")
      .eq("wa_phone_number_id", phoneNumberId)
      .maybeSingle();
    if (data?.org_id) {
      return {
        orgId: data.org_id as string,
        waPhoneNumberId: (data.wa_phone_number_id as string | null) ?? null,
        waToken: (data.wa_token as string | null) ?? null,
      };
    }
  }

  // Legacy fallback: match env-configured number to first active org.
  const envPhoneId = process.env.META_WA_PHONE_NUMBER_ID;
  if (phoneNumberId && envPhoneId && phoneNumberId === envPhoneId) {
    const orgId = await getFirstActiveOrgId(supabaseAdmin);
    if (orgId) return { orgId, waPhoneNumberId: null, waToken: null };
  }

  // Absolute fallback (no phone id in payload).
  if (!phoneNumberId) {
    const orgId = await getFirstActiveOrgId(supabaseAdmin);
    if (orgId) return { orgId, waPhoneNumberId: null, waToken: null };
  }

  return null;
}
