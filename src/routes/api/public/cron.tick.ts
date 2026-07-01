import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/tick")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { tickFunnels } = await import("@/lib/funnel-worker.server");
          const { dispatchPending } = await import("@/lib/dispatcher.server");
          const [funnels, dispatch] = await Promise.all([tickFunnels(), dispatchPending()]);
          return Response.json({ ok: true, funnels, dispatch, at: new Date().toISOString() });
        } catch (e) {
          return Response.json({ ok: false, error: e instanceof Error ? e.message : "unknown" }, { status: 500 });
        }
      },
      GET: async () => Response.json({ ok: true, hint: "POST to run" }),
    },
  },
});
