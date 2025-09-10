export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      messages,
      model = "gpt-3.5-turbo",
      temperature = 0.4,
      max_tokens = 300,
    } = req.body || {};

    if (!messages?.length) {
      return res.status(400).json({ error: "messages required" });
    }

    const apiKey = process.env.OPENAI_API_KEY || "";
    if (!apiKey) {
      return res.status(500).json({ error: "OPENAI_API_KEY missing" });
    }

    // Detect key type
    const isProjectKey = apiKey.startsWith("sk-proj-");
    const projectId = process.env.OPENAI_PROJECT_ID || "";

    if (isProjectKey && !projectId) {
      return res.status(500).json({ error: "OPENAI_PROJECT_ID missing (required for sk-proj- keys)" });
    }

    const SYSTEM_PROMPT = `
You are Influmo Concierge—warm, clear, concise. India audience (IST).
Key:
- Early Access: 0% fee for first 3 months, then 10% on successful payments.
- Join: ask name, role (Influencer/Collaborator/Brand), email, social handle. Suggest instagram.com/influmo.in.
- Contact: help@influmo.in, +91 9692350383, influmo.in
- Hand-off for complex issues. Keep replies short; use bullets when helpful.
`.trim();

    // Endpoint depends on key type
    const url = isProjectKey
      ? `https://api.openai.com/v1/projects/${projectId}/chat/completions`
      : `https://api.openai.com/v1/chat/completions`;

    const rsp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: Math.min(max_tokens, 400),
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      }),
    });

    const text = await rsp.text(); // capture full body even on errors
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!rsp.ok) {
      // Bubble up OpenAI’s error so you can see it in the Network tab
      return res.status(rsp.status).json({
        error: "OpenAI error",
        detail: data?.error?.message || data?.raw || text || "Unknown error",
        status: rsp.status
      });
    }

    const choice = data.choices?.[0]?.message || null;
    const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    const cost =
      (usage.prompt_tokens / 1e6) * 0.5 + // est. 3.5 input
      (usage.completion_tokens / 1e6) * 1.5; // est. 3.5 output

    res.status(200).json({
      message: choice,
      usage,
      cost_usd_estimate: Number(cost.toFixed(6)),
      endpoint_used: isProjectKey ? "projects" : "classic"
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error", detail: String(e) });
  }
}
