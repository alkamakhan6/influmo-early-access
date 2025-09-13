// No packages needed. Uses Supabase REST so you can keep it simple.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { name, email, summary, channel = "web", priority = "normal", user_id } = req.body || {};
    if (!name || !email || !summary) {
      return res.status(400).json({ ok: false, error: "missing_fields" });
    }

    const row = { name, email, summary, channel, priority, user_id };
    const url = `${process.env.SUPABASE_URL}/rest/v1/support_tickets`;

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        Prefer: "return=representation"
      },
      body: JSON.stringify(row)
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(500).json({ ok: false, error: data?.message || "insert_failed" });
    }

    const ticket = Array.isArray(data) ? data[0] : data;
    return res.status(201).json({ ok: true, ticket_id: ticket.id, status: ticket.status || "open" });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
