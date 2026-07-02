import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Send, Sparkles, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { generateAIReply } from "@/lib/ai.functions";
import { sendWhatsAppReply } from "@/lib/whatsapp.functions";
import { useServerFn } from "@tanstack/react-start";
import type { Database } from "@/integrations/supabase/types";

type Contact = Database["public"]["Tables"]["contacts"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];

export const Route = createFileRoute("/app/inbox")({ component: Inbox });

function Inbox() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const aiReply = useServerFn(generateAIReply);

  const { data: contacts } = useQuery({
    queryKey: ["contacts-inbox"],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("*").order("last_message_at", { ascending: false, nullsFirst: false });
      return (data ?? []) as Contact[];
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["messages", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data } = await supabase.from("messages").select("*").eq("contact_id", selectedId!).order("created_at", { ascending: true });
      return (data ?? []) as Message[];
    },
  });

  useEffect(() => {
    if (!selectedId && contacts?.length) setSelectedId(contacts[0].id);
  }, [contacts, selectedId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Realtime: refetch on inserts to messages or contacts
  useEffect(() => {
    const ch = supabase
      .channel("inbox-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        qc.invalidateQueries({ queryKey: ["messages"] });
        qc.invalidateQueries({ queryKey: ["contacts-inbox"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "contacts" }, () => {
        qc.invalidateQueries({ queryKey: ["contacts-inbox"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const selected = contacts?.find((c) => c.id === selectedId);

  async function sendMessage(content: string, aiUsed = false) {
    if (!selectedId || !content.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.from("messages").insert({
        contact_id: selectedId, direction: "outbound", content, ai_used: aiUsed, channel: "whatsapp",
      });
      if (error) throw error;
      await supabase.from("contacts").update({ last_message_at: new Date().toISOString(), status: "in_conversation" }).eq("id", selectedId);
      setInput("");
      qc.invalidateQueries({ queryKey: ["messages", selectedId] });
      qc.invalidateQueries({ queryKey: ["contacts-inbox"] });
      toast.success("Mensagem registrada" + (aiUsed ? " (IA)" : ""));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar");
    } finally { setSending(false); }
  }

  async function suggestAI() {
    if (!selectedId) return;
    setAiLoading(true);
    try {
      const res = await aiReply({ data: { contactId: selectedId } });
      setInput(res.reply);
      toast.success("Sugestão da IA pronta");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro na IA");
    } finally { setAiLoading(false); }
  }

  return (
    <div className="flex h-screen">
      {/* Contact list */}
      <div className="w-80 border-r border-border overflow-y-auto">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Inbox</h2>
          <p className="text-xs text-muted-foreground">{contacts?.length ?? 0} conversas</p>
        </div>
        {(contacts ?? []).map((c) => (
          <button key={c.id} onClick={() => setSelectedId(c.id)}
            className={`block w-full text-left px-4 py-3 border-b border-border/60 transition ${selectedId === c.id ? "bg-accent" : "hover:bg-accent/40"}`}>
            <div className="flex items-center justify-between">
              <span className="font-medium truncate">{c.name ?? c.phone}</span>
              <span className="text-[10px] text-muted-foreground">{c.status}</span>
            </div>
            <div className="text-xs text-muted-foreground truncate">{c.phone}</div>
          </button>
        ))}
        {contacts?.length === 0 && <div className="p-6 text-sm text-muted-foreground">Nenhum contato.</div>}
      </div>

      {/* Thread */}
      <div className="flex-1 flex flex-col">
        {selected ? (
          <>
            <header className="h-14 border-b border-border px-6 flex items-center justify-between">
              <div>
                <div className="font-medium">{selected.name ?? selected.phone}</div>
                <div className="text-xs text-muted-foreground">{selected.phone} · {selected.origin}</div>
              </div>
              <div className="flex gap-1">
                {(selected.tags ?? []).map((t) => (
                  <span key={t} className="rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">{t}</span>
                ))}
              </div>
            </header>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-3">
              {(messages ?? []).map((m) => (
                <div key={m.id} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                    m.direction === "outbound" ? "bg-primary text-primary-foreground" : "bg-card border border-border"
                  }`}>
                    {m.ai_used && <div className="mb-1 flex items-center gap-1 text-[10px] opacity-70"><Sparkles className="h-3 w-3" /> IA</div>}
                    {m.content}
                  </div>
                </div>
              ))}
              {(!messages || messages.length === 0) && (
                <div className="text-center text-sm text-muted-foreground py-10">Sem mensagens ainda.</div>
              )}
            </div>
            <div className="border-t border-border p-4">
              <div className="flex gap-2">
                <button onClick={suggestAI} disabled={aiLoading}
                  className="rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent disabled:opacity-50 inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> {aiLoading ? "Pensando…" : "Sugerir com IA"}
                </button>
                <input value={input} onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") sendMessage(input); }}
                  placeholder="Digite uma mensagem…"
                  className="flex-1 rounded-md border border-input bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary" />
                <button onClick={() => sendMessage(input)} disabled={sending || !input.trim()}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
                  <Send className="h-4 w-4" /> Enviar
                </button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Modo mock: mensagens ficam salvas no banco. Depois de plugar os secrets Meta, o envio real acontece via WhatsApp Cloud API.
              </p>
            </div>
          </>
        ) : (
          <div className="flex-1 grid place-items-center text-muted-foreground">
            <div className="text-center"><MessageSquare className="mx-auto h-8 w-8 opacity-40" /><p className="mt-2 text-sm">Selecione uma conversa</p></div>
          </div>
        )}
      </div>
    </div>
  );
}
