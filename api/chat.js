// api/chat.js — serverless function (Node environment; no document/window)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    // optional: allow OPTIONS for CORS/preflight
    if (req.method === "OPTIONS") return res.status(200).end();
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      messages,
      model = "gpt-3.5-turbo",
      temperature = 0.4,
      max_tokens = 300,
    } = req.body || {};

    const apiKey = process.env.OPENAI_API_KEY;
    const projectId = process.env.OPENAI_PROJECT_ID;

    if (!apiKey)  return res.status(500).json({ error: "OPENAI_API_KEY missing" });
    if (!projectId) return res.status(500).json({ error: "OPENAI_PROJECT_ID missing" });
    if (!messages?.length) return res.status(400).json({ error: "messages required" });

    const SYSTEM_PROMPT = `
You are Influmo Concierge — warm, clear, concise.
- Early Access: 0% fee for first 3 months, then 10% on successful payments.
- Join: ask name, role (Influencer/Collaborator/Brand), email, social handle.
- Contact: help@influmo.in, +91 9692350383, influmo.in
`.trim();

    const endpoint = `https://api.openai.com/v1/projects/${projectId}/chat/completions`;

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
    });

    const text = await rsp.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!rsp.ok) {
      return res.status(rsp.status).json({
        error: "OpenAI error",
        detail: data?.error?.message || data?.raw || text,
      });
    }

    res.status(200).json({
      message: data.choices?.[0]?.message || null,
      usage: data.usage || {},
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", detail: String(err) });
  }
}
