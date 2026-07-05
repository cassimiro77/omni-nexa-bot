import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { supabase } from "@/integrations/supabase/client";

const attachFreshSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    if (typeof window === "undefined") {
      return next();
    }

    const { data } = await supabase.auth.getSession();
    let session = data.session;
    const expiresAt = session?.expires_at ? session.expires_at * 1000 : 0;
    const shouldRefresh = !session || (expiresAt > 0 && expiresAt - Date.now() < 60_000);

    if (shouldRefresh) {
      const refreshed = await supabase.auth.refreshSession();
      session = refreshed.data.session ?? session;
    }

    const token = session?.access_token;
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachFreshSupabaseAuth],
  requestMiddleware: [errorMiddleware],
}));
