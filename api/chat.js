export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { messages, model = "gpt-3.5-turbo", temperature = 0.4, max_tokens = 300 } = req.body || {};
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "OPENAI_API_KEY missing" });
    if (!messages?.length) return res.status(400).json({ error: "messages required" });

    const SYSTEM_PROMPT = `
You are Influmo Concierge—warm, clear, concise. India audience (IST).
Key:
- Early Access: 0% fee for first 3 months, then 10% on successful payments.
- Join: ask name, role (Influencer/Collaborator/Brand), email, social handle. Suggest instagram.com/influmo.in.
- Contact: help@influmo.in, +91 9692350383, influmo.in
- Hand-off for complex issues. Keep replies short; use bullets when helpful.
`.trim();

    const rsp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: Math.min(max_tokens, 400),
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages]
      })
    });

    if (!rsp.ok) {
      const detail = await rsp.text().catch(() => "");
      return res.status(rsp.status).json({ error: "OpenAI error", detail });
    }

    const data = await rsp.json();
    const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    const cost =
      (usage.prompt_tokens / 1e6) * 0.5 + // 3.5 input
      (usage.completion_tokens / 1e6) * 1.5; // 3.5 output

    res.status(200).json({
      message: data.choices?.[0]?.message || null,
      usage,
      cost_usd_estimate: Number(cost.toFixed(6))
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
}
