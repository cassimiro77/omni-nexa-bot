import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bot, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/unsubscribe")({ component: UnsubscribePage });

function UnsubscribePage() {
  const [state, setState] = useState<"loading" | "valid" | "already" | "invalid" | "done" | "error">("loading");
  const [processing, setProcessing] = useState(false);
  const token = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") : null;

  useEffect(() => {
    if (!token) return setState("invalid");
    fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return setState("invalid");
        if (data.valid) setState("valid");
        else if (data.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      })
      .catch(() => setState("error"));
  }, [token]);

  async function confirm() {
    if (!token) return;
    setProcessing(true);
    try {
      const res = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success) setState("done");
      else if (data.reason === "already_unsubscribed") setState("already");
      else setState("error");
    } catch {
      setState("error");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground"><Bot className="h-5 w-5" /></div>
          <span className="font-semibold tracking-tight">NexaBot</span>
        </div>

        {state === "loading" && <p className="text-sm text-muted-foreground">Validando link…</p>}

        {state === "valid" && (
          <>
            <h1 className="text-xl font-semibold">Cancelar inscrição</h1>
            <p className="mt-2 text-sm text-muted-foreground">Clique no botão abaixo para parar de receber e-mails do NexaBot.</p>
            <button
              onClick={confirm}
              disabled={processing}
              className="mt-6 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {processing ? "Processando…" : "Confirmar cancelamento"}
            </button>
          </>
        )}

        {state === "already" && (
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
            <div>
              <h1 className="text-lg font-semibold">Você já cancelou</h1>
              <p className="mt-1 text-sm text-muted-foreground">Este e-mail já foi removido da nossa lista.</p>
            </div>
          </div>
        )}

        {state === "done" && (
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
            <div>
              <h1 className="text-lg font-semibold">Inscrição cancelada</h1>
              <p className="mt-1 text-sm text-muted-foreground">Você não receberá mais e-mails do NexaBot.</p>
            </div>
          </div>
        )}

        {(state === "invalid" || state === "error") && (
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <h1 className="text-lg font-semibold">Link inválido</h1>
              <p className="mt-1 text-sm text-muted-foreground">Este link expirou ou já foi usado. Se o problema persistir, entre em contato.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
