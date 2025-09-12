// /api/chat.js — Vercel serverless (Node runtime; no DOM)

export default async function handler(req, res) {
  // CORS (works for www/non-www, previews, GitHub Pages embedding, etc.)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      messages,
      // Use a current, low-cost model. (3.5 is deprecated.)
      model = "gpt-4o-mini",
      temperature = 0.4,
      max_tokens = 300,
    } = req.body || {};

    const apiKey    = process.env.OPENAI_API_KEY;      // sk-proj-...
    const projectId = process.env.OPENAI_PROJECT_ID;   // proj_...

    if (!apiKey)    return res.status(500).json({ error: "OPENAI_API_KEY missing" });
    if (!projectId) return res.status(500).json({ error: "OPENAI_PROJECT_ID missing" });
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages required" });
    }

    const SYSTEM_PROMPT = `
You are Influmo Concierge — warm, clear, concise.
- Early Access: 0% fee for first 3 months, then 10% on successful payments.
- Join: ask name, role (Influencer/Collaborator/Brand), email, social handle.
- Contact: help@influmo.in, +91 9692350383, influmo.in
`.trim();

    // Project-scoped endpoint (required for sk-proj keys)
    const endpoint = `https://api.openai.com/v1/projects/${projectId}/chat/completions`;

    // 15s timeout so requests never hang
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    const rsp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: Math.min(max_tokens, 400),
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      }),
      signal: controller.signal,
    }).catch(() => {
      throw new Error("Network to OpenAI failed or timed out");
    });

    clearTimeout(timer);

    const raw = await rsp.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }

    if (!rsp.ok) {
      return res.status(rsp.status).json({
        error: "OpenAI error",
        detail: data?.error?.message || data?.raw || raw || `HTTP ${rsp.status}`,
      });
    }

    return res.status(200).json({
      message: data.choices?.[0]?.message || null,
      usage: data.usage || {},
    });
  } catch (err) {
    console.error("[/api/chat] Server error:", err);
    return res.status(500).json({ error: "Server error", detail: String(err?.message || err) });
  }
}
