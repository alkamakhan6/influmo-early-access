/* ========= Basic Config ========= */
const CONFIG = {
  brand: "Influmo",
  website: "https://influmo.in",
  instagram: "https://instagram.com/influmo.in",
  helpEmail: "help@influmo.in",
  phone: "+91 9692350383",
  supabase: { enabled: false } // disabled in this build
};

/* ========= Where to call the API ========= */
// If site is on influmo.in or github.io, call the Vercel function explicitly.
// If the whole site is on Vercel later, the relative path will work.
const API_CHAT =
  (location.hostname.includes("influmo.in") || location.hostname.includes("github.io"))
    ? "https://influmo-soon.vercel.app/api/chat"
    : "/api/chat";
window.__INFLUMO_API_CHAT__ = API_CHAT;
console.log("[Influmo Chat] Using API:", API_CHAT);

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

// AI conversation context
const aiThread = [];

/* ========= Daily use guard (optional) ========= */
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
  aiThread.push({ role: "user", content: userText });
  const lastTurns = aiThread.slice(-8);

  // Log the URL so we’re 100% sure which endpoint it hit
  console.log("[Influmo Chat] POST", API_CHAT);

  let rsp, raw;
  try {
    rsp = await fetch(API_CHAT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        max_tokens: 300,
        messages: lastTurns
      })
    });
    raw = await rsp.text();               // <- capture raw body always
  } catch (netErr) {
    console.error("[Influmo Chat] Network error:", netErr);
    throw new Error("Network error to API (fetch failed)");
  } catch (err) {
  stopTyping();
  console.error("[Influmo Chat] AI error:", err);
  addAgent(
    `I couldn't reach the AI right now.<br/><span class="meta">${escapeHtml(String(err.message || err))}</span>`
  );
}


  // Try to parse JSON; fall back to raw text
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }

  if (!rsp.ok) {
    const detail = data?.detail || data?.error || data?.raw || `HTTP ${rsp.status}`;
    console.error("[Influmo Chat] API error:", { status: rsp.status, detail, raw });
    // surface full detail to the UI so we can see it
    throw new Error(`HTTP ${rsp.status} • ${detail}`);
  }

  const reply = data?.message?.content || "Sorry—no reply.";
  aiThread.push({ role: "assistant", content: reply });
  return { reply, usage: data?.usage };
}


  const data = await rsp.json().catch(() => ({}));
  if (!rsp.ok) {
    const detail = data?.detail || data?.error || `HTTP ${rsp.status}`;
    throw new Error(detail);
  }

  const reply = data?.message?.content || "Sorry—no reply.";
  aiThread.push({ role: "assistant", content: reply });
  return { reply, usage: data?.usage };
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

/* ========= UI helpers ========= */
function toggle(open) {
  STATE.opened = open;
  if (open) {
    $chat.hidden = false;
    setTimeout(() => $input?.focus(), 30);
  } else {
    $chat.hidden = true;
  }
}

function addAgent(text, html = null) {
  const msg = { role: "agent", text, html };
  STATE.thread.push(msg);
  renderMessage(msg);
  persist("msg", msg);
}

function addUser(text) {
  const msg = { role: "user", text };
  STATE.thread.push(msg);
  renderMessage(msg);
  persist("msg", msg);
}

function renderMessage({ role, text, html }) {
  const wrap = document.createElement("div");
  wrap.className = `msg ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = html ?? escapeHtml(text).replace(/\n/g, "<br/>");
  wrap.appendChild(bubble);
  $feed.appendChild(wrap);
  $feed.scrollTop = $feed.scrollHeight;
}

function showTyping() {
  const wrap = document.createElement("div");
  wrap.className = "msg agent typing-wrap";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = `<span class="typing"><span></span><span></span><span></span></span>`;
  wrap.appendChild(bubble);
  $feed.appendChild(wrap);
  $feed.scrollTop = $feed.scrollHeight;
  return () => wrap.remove();
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, m => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]
  ));
}

function persist(kind, payload) {
  try {
    const key = "influmo_chat_history";
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    arr.push({ t: Date.now(), kind, payload });
    localStorage.setItem(key, JSON.stringify(arr));
  } catch {}
}

/* ========= Knowledge / Intents ========= */
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

async function seedWelcome() {
  addAgent("", htmlWelcome());
  addAgent("Hi! I’m the Influmo Concierge. How can I help today?");
}

function htmlWelcome() {
  return `
  <div>
    <strong>Welcome to Influmo</strong> — the fastest way for influencers, collaborators, and brands to find each other and work safely.
    <div class="meta">Tip: tap a quick reply below to start.</div>
  </div>`;
}

/* ========= Router ========= */
async function handleIntent(input, isSystem = false) {
  const q = (typeof input === "string" ? input : "").toLowerCase();

  const known = ["about", "benefits", "join", "contact", "pricing"];
  const isKnown = known.includes(q);

  let intent = isKnown ? q :
    /benefit|perk|early/.test(q) ? "benefits" :
    /(join|waitlist|sign\s?up|apply)/.test(q) ? "join" :
    /(price|fee|commission|percent)/.test(q) ? "pricing" :
    /(contact|email|phone|support|help)/.test(q) ? "contact" :
    /(what\s+is|influmo|about)/.test(q) ? "about" : "fallback";

  switch (intent) {
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
        stopTyping();
        addAgent(reply);
        if (usage?.total_tokens) {
          addAgent("", `<div class="meta">AI • ~${usage.total_tokens} tokens</div>`);
        }
      } catch (err) {
        stopTyping();
        console.error("[Influmo Chat] AI error:", err);
        addAgent(`I couldn't reach the AI right now.<br/><span class="meta">${escapeHtml(String(err.message || err))}</span>`);
      }
    }
  }
}

/* ========= Lead Form ========= */
function renderLeadForm() {
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
    </div>
  `;
  addAgent("", html);

  const form = $feed.querySelector("#influmo-lead");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      if (data.name) localStorage.setItem("influmo_name", data.name);
      if (data.role) localStorage.setItem("influmo_role", data.role);

      const stopTyping = showTyping();
      setTimeout(() => stopTyping(), 700);
      addAgent(`Thanks ${data.name || "there"}! You’re on the list. We’ll email **${data.email}** when your invite is ready. Meanwhile, follow us on Instagram: <a href="${CONFIG.instagram}" target="_blank" rel="noopener">influmo.in</a>.`);
    }, { once: true });
  }
}

/* ========= Markdown helper ========= */
function mdToHtml(md) {
  return escapeHtml(md)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|\n)•\s/g, "$1&nbsp;&bull; ")
    .replace(/\n/g, "<br/>");
}

/* ========= Utils ========= */
function getOrSetAnonId() {
  const key = "influmo_anon_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = "anon_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(key, id);
  }
  return id;
}
