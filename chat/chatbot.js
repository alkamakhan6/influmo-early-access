/* ========= Basic Config ========= */
const CONFIG = {
  brand: "Influmo",
  website: "https://influmo.in",
  instagram: "https://instagram.com/influmo.in",
  helpEmail: "help@influmo.in",
  phone: "+91 9692350383",

  // Optional Supabase (enable to log leads/messages)
  supabase: {
    url: "https://iixpugcjoafrypjspqaf.supabase.co",
    anonKey:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpeHB1Z2Nqb2FmcnlwanNwcWFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNzQ0MjIsImV4cCI6MjA3MTY1MDQyMn0.lZnEkXtVSSnxtCtXjFEseAxvzHgBfvdPOwS118hN8ak",
    tableMessages: "chat_messages",
    tableLeads: "chat_leads",
    enabled: false // set true after filling URL & key and adding RLS policies
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
  thread: [], // UI history: {role:'agent'|'user', text, html}
  user: {
    id: getOrSetAnonId(),
    name: localStorage.getItem("influmo_name") || null,
    role: localStorage.getItem("influmo_role") || null
  }
};

// AI conversation context: { role:'user'|'assistant', content:string }
const aiThread = [];

/* ========= Cost Guardrail ========= */
function canUseAI(limit = 20) {
  const key = "influmo_ai_uses";
  const today = new Date().toDateString();
  const rec = JSON.parse(localStorage.getItem(key) || "{}");
  if (rec.date !== today) {
    rec.date = today;
    rec.count = 0;
  }
  if (rec.count >= limit) return false;
  rec.count += 1;
  localStorage.setItem(key, JSON.stringify(rec));
  return true;
}

/* ========= API Endpoint ========= */
// Use relative path to avoid CORS issues
const API_CHAT = "/api/chat";

/* ========= AI Caller ========= */
async function askAI(userText) {
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
    const detail = data?.detail || data?.error || "AI call failed";
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
  if (intent) {
    await handleIntent(intent, true);
  }
});

/* ========= Core UI Helpers ========= */
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
  logMessage("user", text);
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
  return s.replace(/[&<>"']/g, (m) => (
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
• Launch phase: creators
