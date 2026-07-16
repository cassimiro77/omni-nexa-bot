// Helpers to resolve the current org_id.
// MVP multi-tenant: each user belongs to 1 org (created automatically on signup).
// For public webhooks/cron, we pick the first active org as fallback until
// per-org integration routing (by phone_number_id) is wired up.

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

/** For public webhooks/cron: returns the first active org (MVP single-tenant fallback). */
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

/** Resolves the org_id for an incoming WhatsApp webhook. TODO: match by phone_number_id when per-org integrations are wired. */
export async function resolveOrgIdForWhatsAppWebhook(
  supabaseAdmin: SupabaseClient,
  _phoneNumberId?: string,
): Promise<string | null> {
  return getFirstActiveOrgId(supabaseAdmin);
}
