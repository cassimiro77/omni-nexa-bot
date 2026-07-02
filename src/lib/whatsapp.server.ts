// WhatsApp Cloud API sender — server-only helper.
export async function sendWhatsAppText(to: string, body: string): Promise<{ ok: boolean; wa_message_id?: string; error?: string }> {
  const token = process.env.META_WA_TOKEN;
  const phoneId = process.env.META_WA_PHONE_NUMBER_ID;
  if (!token || !phoneId) return { ok: false, error: "META secrets ausentes" };

  const clean = to.replace(/[^\d]/g, "");
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: clean,
      type: "text",
      text: { preview_url: false, body },
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    messages?: { id: string }[];
    error?: { message?: string };
  };
  if (!res.ok) return { ok: false, error: json?.error?.message ?? `HTTP ${res.status}` };
  return { ok: true, wa_message_id: json.messages?.[0]?.id };
}
