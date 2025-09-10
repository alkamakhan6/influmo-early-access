// /api/chat.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      messages,
      model = "gpt-3.5-turbo",
      temperature = 0.4,
      max_tokens = 300,
    } = req.body || {};

    const apiKey   = process.env.OPENAI_API_KEY || "";
    const projectId = process.env.OPENAI_PROJECT_ID || "";

    if (!messages?.length) return res.status(400).json({ error: "messages required" });
    if (!apiKey)          return res.status(500).json({ error: "OPENAI_API_KEY missing" });
    const isProjKey = apiKey.startsWith("sk-proj-");

    const SYSTEM_PROMPT = `
You are Influmo Concierge — warm, clear, concise.
- Early Access: 0% fee for first 3 months, then 10% on successful payments.
- Join: ask name, role (Influencer/Collaborator/Brand), email, social handle.
- Contact: help@influmo.in, +91 9692350383, influmo.in
`.trim();

    // --- Build payload once
    const payload = {
      model,
      temperature,
      max_tokens: Math.min(max_tokens, 400),
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    };

    // Helper to perform a call
    const call = (url, extraHeaders = {}) =>
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          ...extraHeaders,
        },
        body: JSON.stringify(payload),
      });

    let rsp, text, data;

    if (isProjKey) {
      if (!projectId) return res.status(500).json({ error: "OPENAI_PROJECT_ID missing (required for sk-proj- keys)" });

      // 1) Try project-path style (some accounts)
      rsp = await call(`https://api.openai.com/v1/projects/${projectId}/chat/completions`);
      text = await rsp.text();
      try { data = JSON.parse(text); } catch { data = { raw: text }; }

      // 404/400? Fall back to header-style
      if (!rsp.ok && rsp.status === 404) {
        const rsp2 = await call("https://api.openai.com/v1/chat/completions", {
          "OpenAI-Project": projectId, // alternate way some tenants expect
        });
        const text2 = await rsp2.text();
        let data2; try { data2 = JSON.parse(text2); } catch { data2 = { raw: text2 }; }
        if (!rsp2.ok) {
          return res.status(rsp2.status).json({ error: "OpenAI error", detail: data2?.error?.message || data2?.raw || text2 });
        }
        return res.status(200).json({
          message: data2.choices?.[0]?.message || null,
          usage: data2.usage || {},
          endpoint_used: "base+OpenAI-Project-header",
        });
      }
    } else {
      // Classic sk- key
      rsp = await call("https://api.openai.com/v1/chat/completions");
      text = await rsp.text();
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
    }

    if (!rsp.ok) {
      return res.status(rsp.status).json({
        error: "OpenAI error",
        detail: data?.error?.message || data?.raw || text,
      });
    }

    return res.status(200).json({
      message: data.choices?.[0]?.message || null,
      usage: data.usage || {},
      endpoint_used: isProjKey ? "projects-path" : "classic",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error", detail: String(err) });
  }
}
