import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Returns the current user's first org_id. Cached across the app. */
export function useOrgId() {
  return useQuery({
    queryKey: ["current-org-id"],
    queryFn: async (): Promise<string | null> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("organization_members")
        .select("org_id")
        .eq("user_id", u.user.id)
        .limit(1)
        .maybeSingle();
      return (data?.org_id as string | null) ?? null;
    },
    staleTime: 5 * 60_000,
  });
}
