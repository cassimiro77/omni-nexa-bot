// WhatsApp Cloud API helpers — server-only.
const GRAPH = "https://graph.facebook.com/v21.0";

export async function sendWhatsAppText(to: string, body: string): Promise<{ ok: boolean; wa_message_id?: string; error?: string }> {
  const token = process.env.META_WA_TOKEN;
  const phoneId = process.env.META_WA_PHONE_NUMBER_ID;
  if (!token || !phoneId) return { ok: false, error: "META secrets ausentes" };

  const clean = to.replace(/[^\d]/g, "");
  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: clean,
      type: "text",
      text: { preview_url: false, body },
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
  if (!res.ok) return { ok: false, error: json?.error?.message ?? `HTTP ${res.status}` };
  return { ok: true, wa_message_id: json.messages?.[0]?.id };
}

export async function sendWhatsAppAudioLink(to: string, link: string): Promise<{ ok: boolean; wa_message_id?: string; error?: string }> {
  const token = process.env.META_WA_TOKEN;
  const phoneId = process.env.META_WA_PHONE_NUMBER_ID;
  if (!token || !phoneId) return { ok: false, error: "META secrets ausentes" };
  const clean = to.replace(/[^\d]/g, "");
  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: clean,
      type: "audio",
      audio: { link },
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
  if (!res.ok) return { ok: false, error: json?.error?.message ?? `HTTP ${res.status}` };
  return { ok: true, wa_message_id: json.messages?.[0]?.id };
}

// Downloads a WhatsApp media file (voice notes/audio) as a Buffer + mime.
export async function downloadWhatsAppMedia(mediaId: string): Promise<{ ok: boolean; data?: ArrayBuffer; mime?: string; error?: string }> {
  const token = process.env.META_WA_TOKEN;
  if (!token) return { ok: false, error: "META_WA_TOKEN ausente" };

  const metaRes = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!metaRes.ok) return { ok: false, error: `Meta media meta HTTP ${metaRes.status}` };
  const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
  if (!meta.url) return { ok: false, error: "media url ausente" };

  const bin = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
  if (!bin.ok) return { ok: false, error: `Meta media bin HTTP ${bin.status}` };
  const data = await bin.arrayBuffer();
  return { ok: true, data, mime: meta.mime_type };
}

// Transcribes audio via Lovable AI STT.
export async function transcribeAudio(data: ArrayBuffer, mime: string): Promise<{ ok: boolean; text?: string; error?: string }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { ok: false, error: "LOVABLE_API_KEY ausente" };

  const ext = mime.includes("mp4") ? "mp4" : mime.includes("mpeg") ? "mp3" : mime.includes("wav") ? "wav" : mime.includes("webm") ? "webm" : "ogg";
  const fd = new FormData();
  fd.append("model", "openai/gpt-4o-mini-transcribe");
  fd.append("file", new Blob([data], { type: mime || "audio/ogg" }), `voice.${ext}`);

  const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false, error: `STT HTTP ${res.status}: ${t.slice(0, 200)}` };
  }
  const j = (await res.json()) as { text?: string };
  return { ok: true, text: (j.text ?? "").trim() };
}

// Generates TTS audio, uploads to private bucket, returns a signed URL (valid ~1h) suitable for WhatsApp fetching.
export async function synthesizeAndUpload(text: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { ok: false, error: "LOVABLE_API_KEY ausente" };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini-tts",
      input: text.slice(0, 4000),
      voice: "alloy",
      response_format: "mp3",
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false, error: `TTS HTTP ${res.status}: ${t.slice(0, 200)}` };
  }
  const audio = await res.arrayBuffer();

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`;
  const up = await supabaseAdmin.storage.from("wa-audio").upload(path, audio, {
    contentType: "audio/mpeg",
    upsert: false,
  });
  if (up.error) return { ok: false, error: `upload: ${up.error.message}` };

  const signed = await supabaseAdmin.storage.from("wa-audio").createSignedUrl(path, 3600);
  if (signed.error || !signed.data?.signedUrl) return { ok: false, error: `signed: ${signed.error?.message ?? "sem url"}` };
  return { ok: true, url: signed.data.signedUrl };
}
