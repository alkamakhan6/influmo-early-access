// Serverless on Vercel — inserts a ticket into Supabase via REST
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"method_not_allowed" });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ ok:false, error:"server_misconfigured" });
  }

  try {
    const { name, email, summary, priority = "normal", channel = "web", user_id } = req.body || {};
    if (!name || !email || !summary) return res.status(400).json({ ok:false, error:"missing_fields" });

    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/support_tickets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        Prefer: "return=representation"
      },
      body: JSON.stringify({ name, email, summary, priority, channel, user_id })
    });

    const data = await r.json();
    if (!r.ok) return res.status(500).json({ ok:false, error: data?.message || "insert_failed" });

    const row = Array.isArray(data) ? data[0] : data;
    return res.status(201).json({ ok:true, ticket_id: row.id, status: row.status || "open" });
  } catch (e) {
    return res.status(500).json({ ok:false, error: e.message });
  }
}
