/* ========= Basic Config ========= */
const CONFIG = {
  brand: "Influmo",
  website: "https://influmo.in", // change if needed
  instagram: "https://instagram.com/influmo.in",
  helpEmail: "help@influmo.in",
  phone: "+91 9692350383",

  // Optional Supabase (enable to log leads/messages)
  supabase: {
    url: "https://YOUR-PROJECT.supabase.co",
    anonKey: "YOUR-ANON-KEY",
    tableMessages: "chat_messages",
    tableLeads: "chat_leads",
    enabled: false // set true after filling URL & key
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
  thread: [], // {role:'agent'|'user', text, html}
  user: {
    id: getOrSetAnonId(),
    name: localStorage.getItem("influmo_name") || null,
    role: localStorage.getItem("influmo_role") || null
  }
};

/* ========= Init ========= */
seedWelcome();

$launcher.addEventListener("click", () => toggle(true));
$close.addEventListener("click", () => toggle(false));

$form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = ($input.value || "").trim();
  if(!text) return;
  addUser(text);
  $input.value = "";
  handleIntent(text);
});

$quick.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if(!btn) return;
  const intent = btn.dataset.intent;
  if(intent){ handleIntent(intent, true); }
});

/* ========= Core UI Helpers ========= */
function toggle(open){
  STATE.opened = open;
  if(open){
    $chat.hidden = false;
    setTimeout(()=> $input?.focus(), 30);
  }else{
    $chat.hidden = true;
  }
}

function addAgent(text, html=null){
  const msg = {role:"agent", text, html};
  STATE.thread.push(msg);
  renderMessage(msg);
  persist("msg", msg);
}

function addUser(text){
  const msg = {role:"user", text};
  STATE.thread.push(msg);
  renderMessage(msg);
  persist("msg", msg);
  logMessage("user", text);
}

function renderMessage({role, text, html}){
  const wrap = document.createElement("div");
  wrap.className = `msg ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = html ?? escapeHtml(text).replace(/\n/g, "<br/>");
  wrap.appendChild(bubble);
  $feed.appendChild(wrap);
  $feed.scrollTop = $feed.scrollHeight;
}

function showTyping(ms=900){
  const wrap = document.createElement("div");
  wrap.className = "msg agent";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = `<span class="typing"><span></span><span></span><span></span></span>`;
  wrap.appendChild(bubble);
  $feed.appendChild(wrap);
  $feed.scrollTop = $feed.scrollHeight;
  return new Promise(res=> setTimeout(()=>{ wrap.remove(); res(); }, ms));
}

function escapeHtml(s){
  return s.replace(/[&<>"']/g, m=>(
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[m]
  ));
}

function persist(kind, payload){
  try{
    const key = "influmo_chat_history";
    const arr = JSON.parse(localStorage.getItem(key)||"[]");
    arr.push({t:Date.now(), kind, payload});
    localStorage.setItem(key, JSON.stringify(arr));
  }catch{}
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

async function seedWelcome(){
  addAgent("", htmlWelcome());
  addAgent("Hi! I’m the Influmo Concierge. How can I help today?");
}

function htmlWelcome(){
  return `
  <div>
    <strong>Welcome to Influmo</strong> — the fastest way for influencers, collaborators, and brands to find each other and work safely.
    <div class="meta">Tip: tap a quick reply below to start.</div>
  </div>`;
}

async function handleIntent(input, isSystem=false){
  // Normalize
  const q = (typeof input === "string" ? input : "").toLowerCase();

  // Resolve explicit chips
  const known = ["about","benefits","join","contact","pricing"];
  const isKnown = known.includes(q);

  // Classify lightweight intents
  let intent = isKnown ? q :
    /benefit|perk|early/.test(q) ? "benefits" :
    /(join|waitlist|sign\s?up|apply)/.test(q) ? "join" :
    /(price|fee|commission|percent)/.test(q) ? "pricing" :
    /(contact|email|phone|support|help)/.test(q) ? "contact" :
    /(what\s+is|influmo|about)/.test(q) ? "about" : "fallback";

  await showTyping();

  switch(intent){
    case "about":
      addAgent("", mdToHtml(ANSWERS.about));
      break;
    case "benefits":
      addAgent("", mdToHtml(ANSWERS.benefits));
      break;
    case "pricing":
      addAgent("", mdToHtml(ANSWERS.pricing));
      break;
    case "contact":
      addAgent("", mdToHtml(ANSWERS.contact));
      break;
    case "join":
      renderLeadForm();
      break;
    default:
      addAgent("Got it! I can help with Influmo, early access, fees, or joining the waitlist. Try the chips below or ask anything.");
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
    </div>
  `;
  addAgent("", html);

  // Attach submit handler
  const form = $feed.querySelector("#influmo-lead");
  if(form){
    form.addEventListener("submit", async (e)=>{
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      // Save locally for personalization
      if(data.name) localStorage.setItem("influmo_name", data.name);
      if(data.role) localStorage.setItem("influmo_role", data.role);

      await showTyping(700);
      addAgent(`Thanks ${data.name || "there"}! You’re on the list. We’ll email **${data.email}** when your invite is ready. Meanwhile, follow us on Instagram for updates: <a href="${CONFIG.instagram}" target="_blank" rel="noopener">influmo.in</a>.`);

      // Log to Supabase if enabled
      if(CONFIG.supabase.enabled){
        try{
          await supaInsert(CONFIG.supabase.tableLeads, {
            user_id: STATE.user.id,
            name: data.name || null,
            role: data.role || null,
            social_username: data.username || null,
            email: data.email || null,
            phone: data.phone || null,
            source: "chat_widget",
            created_at: new Date().toISOString()
          });
        }catch(err){
          console.warn("Lead save failed:", err);
        }
      }
    }, { once:true });
  }
}

/* ========= Minimal Markdown to HTML ========= */
function mdToHtml(md){
  return escapeHtml(md)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|\n)•\s/g, "$1&nbsp;&bull; ")
    .replace(/\n/g, "<br/>");
}

/* ========= Supabase Logging ========= */
async function logMessage(role, text){
  if(!CONFIG.supabase.enabled) return;
  try{
    await supaInsert(CONFIG.supabase.tableMessages, {
      user_id: STATE.user.id,
      role, text,
      created_at: new Date().toISOString()
    });
  }catch(err){ console.warn("Message log failed:", err); }
}

async function supaInsert(table, obj){
  const { url, anonKey } = CONFIG.supabase;
  const res = await fetch(`${url}/rest/v1/${encodeURIComponent(table)}`, {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "apikey": anonKey,
      "Authorization": `Bearer ${anonKey}`,
      "Prefer":"return=representation"
    },
    body: JSON.stringify([obj])
  });
  if(!res.ok){
    const txt = await res.text();
    throw new Error(`Supabase error: ${res.status} ${txt}`);
  }
  return res.json();
}

/* ========= Utils ========= */
function getOrSetAnonId(){
  const key="influmo_anon_id";
  let id = localStorage.getItem(key);
  if(!id){
    id = "anon_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(key, id);
  }
  return id;
}
