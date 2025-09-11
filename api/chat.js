/* ========= Basic Config ========= */
const CONFIG = {
  brand: "Influmo",
  website: "https://influmo.in",
  instagram: "https://instagram.com/influmo.in",
  helpEmail: "help@influmo.in",
  phone: "+91 9692350383",
  supabase: {
    url: "https://iixpugcjoafrypjspqaf.supabase.co",
    anonKey:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpeHB1Z2Nqb2FmcnlwanNwcWFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNzQ0MjIsImV4cCI6MjA3MTY1MDQyMn0.lZnEkXtVSSnxtCtXjFEseAxvzHgBfvdPOwS118hN8ak",
    tableMessages: "chat_messages",
    tableLeads: "chat_leads",
    enabled: false
  }
};

/* ========= DOM ========= */
const $launcher = document.getElementById("influmo-launcher");
const $chat = document.getElementById("influmo-chat");
const $close = document.getElementById("influmo-close");
const $feed = document.getElementById("influmo-feed");
const $form = document.getElementById("influmo-form");
const $input = document.getElementById("influmo-input");
const $quick = document.getElementById("influmo-quick");

/* ========= State ========= */
const STATE = {
  opened: false,
  thread: [],
  user: {
    id: getOrSetAnonId(),
    name: localStorage.getItem("influmo_name") || null,
    role: localStorage.getItem("influmo_role") || null
  }
};
const aiThread = [];

/* ========= Endpoint chooser (Vercel first, then current origin) ========= */
const API_CANDIDATES = [
  "https://influmo-soon.vercel.app",   // Vercel (serverless works)
  location.origin                      // current host (works when domain is on Vercel)
];
let API_CHAT = null;

async function pickApiBase() {
  for (const base of API_CANDIDATES) {
    try {
      // tiny POST ping; api returns 405 for GET, so use POST with minimal body
      const r = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "ping" }] })
      });
      if (r.ok || r.status >= 400) {
        // if it’s not a network/cors error, we reached the function
        API_CHAT = `${base}/api/chat`;
        console.log("[Influmo Chat] Using API:", API_CHAT);
        return;
      }
    } catch (_) {}
  }
  // fallback anyway to Vercel
  API_CHAT = `${API_CANDIDATES[0]}/api/chat`;
  console.log("[Influmo Chat] Fallback API:", API_CHAT);
}

/* ========= Cost Guard ========= */
function canUseAI(limit = 20) {
  const key = "influmo_ai_uses";
  const today = new Date().toDateString();
  const rec = JSON.parse(localStorage.getItem(key) || "{}");
  if (rec.date !== today) { rec.date = today; rec.count = 0; }
  if (rec.count >= limit) return false;
  rec.count += 1;
  localStorage.setItem(key, JSON.stringify(rec));
  return true;
}

/* ========= AI Caller ========= */
async function askAI(userText) {
  if (!API_CHAT) await pickApiBase();

  aiThread.push({ role: "user", content: userText });
  const lastTurns = aiThread.slice(-8);

  const rsp = await fetch(API_CHAT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      temperature: 0.4,
      max_tokens: 300,
      messages: lastTurns
    })
  });

  const data = await rsp.json().catch(() => ({}));
  if (!rsp.ok) {
    const detail = data?.detail || data?.error || `HTTP ${rsp.status}`;
    throw new Error(detail);
  }

  const reply = data?.message?.content || "Sorry—no reply.";
  aiThread.push({ role: "assistant", content: reply });
  return { reply, usage: data?.usage, cost: data?.cost_usd_estimate };
}

/* ========= Init ========= */
seedWelcome();
$launcher.addEventListener("click", () => toggle(true));
$close.addEventListener("click", () => toggle(false));
$form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = ($input.value || "").trim();
  if (!text) return;
  addUser(text);
  $input.value = "";
  await handleIntent(text);
});
$quick.addEventListener("click", async (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  const intent = btn.dataset.intent;
  if (intent) await handleIntent(intent, true);
});

/* ========= UI ========= */
function toggle(open) { STATE.opened = open; $chat.hidden = !open; if (open) setTimeout(() => $input?.focus(), 30); }
function addAgent(text, html=null){ const msg={role:"agent",text,html}; STATE.thread.push(msg); renderMessage(msg); persist("msg",msg); }
function addUser(text){ const msg={role:"user",text}; STATE.thread.push(msg); renderMessage(msg); persist("msg",msg); logMessage("user",text); }
function renderMessage({role,text,html}){ const wrap=document.createElement("div"); wrap.className=`msg ${role}`; const b=document.createElement("div"); b.className="bubble"; b.innerHTML=html ?? escapeHtml(text).replace(/\n/g,"<br/>"); wrap.appendChild(b); $feed.appendChild(wrap); $feed.scrollTop=$feed.scrollHeight; }
function showTyping(){ const w=document.createElement("div"); w.className="msg agent typing-wrap"; const b=document.createElement("div"); b.className="bubble"; b.innerHTML=`<span class="typing"><span></span><span></span><span></span></span>`; w.appendChild(b); $feed.appendChild(w); $feed.scrollTop=$feed.scrollHeight; return ()=>w.remove(); }
function escapeHtml(s){ return s.replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m])); }
function persist(kind,payload){ try{ const key="influmo_chat_history"; const arr=JSON.parse(localStorage.getItem(key)||"[]"); arr.push({t:Date.now(),kind,payload}); localStorage.setItem(key,JSON.stringify(arr)); }catch{} }

/* ========= Answers / Router ========= */
const ANSWERS = {
  about: `
**Influmo** is a platform where influencers hire collaborators (video editors, page managers, designers, etc.) and brands discover verified creators. We streamline: profiles, vetted reviews, escrow-style payments, and smart matching—so you spend less time in DMs and more time building.
`,
  benefits: `
**Early Access Perks**
• **0% take-rate for first 3 months** on collabs you close via Influmo  
• **Priority verified badge** review for top creators/collaborators  
• **Premium profile templates** & portfolio import  
• **Early feature voting**—help shape what we build  
• **Concierge support** during your setup  
`,
  contact: `
**Contact**
• Website: ${CONFIG.website}  
• Instagram: ${CONFIG.instagram}  
• Email: ${CONFIG.helpEmail}  
• Phone: ${CONFIG.phone}  
`,
  pricing: `
**How fees work**
• Launch phase: creators & collaborators enjoy **0% platform fee for the first 3 months** (early access).  
• After that, a simple **10%** service fee on successful, platform-protected payments.  
• No listing or monthly fees during early access.  
`
};

async function seedWelcome(){ addAgent("", htmlWelcome()); addAgent("Hi! I’m the Influmo Concierge. How can I help today?"); }
function htmlWelcome(){ return `<div><strong>Welcome to Influmo</strong> — the fastest way for influencers, collaborators, and brands to find each other and work safely.<div class="meta">Tip: tap a quick reply below to start.</div></div>`; }

async function handleIntent(input){
  const q = (typeof input === "string" ? input : "").toLowerCase();
  const known = ["about","benefits","join","contact","pricing"];
  const isKnown = known.includes(q);
  let intent = isKnown ? q :
    /benefit|perk|early/.test(q) ? "benefits" :
    /(join|waitlist|sign\s?up|apply)/.test(q) ? "join" :
    /(price|fee|commission|percent)/.test(q) ? "pricing" :
    /(contact|email|phone|support|help)/.test(q) ? "contact" :
    /(what\s+is|influmo|about)/.test(q) ? "about" : "fallback";

  switch(intent){
    case "about":    addAgent("", mdToHtml(ANSWERS.about)); break;
    case "benefits": addAgent("", mdToHtml(ANSWERS.benefits)); break;
    case "pricing":  addAgent("", mdToHtml(ANSWERS.pricing)); break;
    case "contact":  addAgent("", mdToHtml(ANSWERS.contact)); break;
    case "join":     renderLeadForm(); break;
    default: {
      if (!canUseAI()) { addAgent("Daily AI limit reached. Try again tomorrow."); break; }
      const stopTyping = showTyping();
      try {
        const { reply, usage } = await askAI(input);
        stopTyping(); addAgent(reply);
        if (usage?.total_tokens) addAgent("", `<div class="meta">AI • ~${usage.total_tokens} tokens</div>`);
      } catch (err) {
        console.error(err);
        stopTyping();
        addAgent("I couldn’t reach the AI right now. Try again in a moment, or use the quick replies below.");
      }
    }
  }
}

/* ========= Lead Form & Supabase ========= */
function renderLeadForm(){
  const html = `
    <div>
      <strong>Join the Early Access Waitlist</strong>
      <div class="meta">0% platform fee for first 3 months.</div>
      <form class="lead-form" id="influmo-lead">
        <input type="text" name="name" placeholder="Your name" required />
        <select name="role" required>
          <option value="">I am…</option>
          <option value="Influencer">Influencer</option>
          <option value="Collaborator">Collaborator</option>
          <option value="Brand">Brand / Agency</option>
        </select>
        <input type="text" name="username" placeholder="Instagram / YouTube / TikTok @handle" />
        <input type="email" name="email" placeholder="Email" required />
        <input type="tel" name="phone" placeholder="Phone (optional)" />
        <button type="submit">Request Invite</button>
      </form>
    </div>`;
  addAgent("", html);

  const form = $feed.querySelector("#influmo-lead");
  if (form) {
    form.addEventListener("submit", async (e)=>{
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      if (data.name) localStorage.setItem("influmo_name", data.name);
      if (data.role) localStorage.setItem("influmo_role", data.role);

      const stopTyping = showTyping(); setTimeout(()=>stopTyping(), 700);
      addAgent(`Thanks ${data.name || "there"}! You’re on the list. We’ll email **${data.email}** when your invite is ready. Meanwhile, follow us on Instagram: <a href="${CONFIG.instagram}" target="_blank" rel="noopener">influmo.in</a>.`);

      if (CONFIG.supabase.enabled) {
        try {
          await supaInsert(CONFIG.supabase.tableLeads, {
            user_id: STATE.user.id,
            name: data.name || null, role: data.role || null,
            social_username: data.username || null,
            email: data.email || null, phone: data.phone || null,
            source: "chat_widget", created_at: new Date().toISOString()
          });
        } catch (err) { console.warn("Lead save failed:", err); }
      }
    }, { once:true });
  }
}

/* ========= Markdown / Logging / Utils ========= */
function mdToHtml(md){ return escapeHtml(md).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/(^|\n)•\s/g,"$1&nbsp;&bull; ").replace(/\n/g,"<br/>"); }
async function logMessage(role, text){ if(!CONFIG.supabase.enabled) return;
  try{ await supaInsert(CONFIG.supabase.tableMessages, { user_id: STATE.user.id, role, text, created_at: new Date().toISOString() }); }catch{} }
async function supaInsert(table, obj){
  const { url, anonKey } = CONFIG.supabase;
  const res = await fetch(`${url}/rest/v1/${encodeURIComponent(table)}`, {
    method:"POST", headers:{ "Content-Type":"application/json", apikey:anonKey, Authorization:`Bearer ${anonKey}`, Prefer:"return=representation" },
    body: JSON.stringify([obj])
  });
  if(!res.ok){ const txt = await res.text(); throw new Error(`Supabase error: ${res.status} ${txt}`); }
  return res.json();
}
function getOrSetAnonId(){ const key="influmo_anon_id"; let id=localStorage.getItem(key);
  if(!id){ id="anon_"+Math.random().toString(36).slice(2)+Date.now().toString(36); localStorage.setItem(key,id); }
  return id;
}
