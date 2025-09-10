// influmo-embed.js
(function () {
  // Avoid double-injecting
  if (document.getElementById("influmo-chat")) return;

  // 1) Ensure CSS exists
  const cssHref = "/influmo-chatbot.css"; // change path if you placed it elsewhere
  const existing = Array.from(document.styleSheets).some(s => (s.href || "").includes(cssHref));
  if (!existing) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssHref;
    document.head.appendChild(link);
  }

  // 2) Inject widget HTML right before </body>
  const html = `
  <!-- Influmo Chat Widget -->
  <button id="influmo-launcher" aria-label="Open chat">
    <span class="bubble-dot" aria-hidden="true"></span>
    <span class="bubble-dot" aria-hidden="true"></span>
    <span class="bubble-dot" aria-hidden="true"></span>
  </button>

  <section id="influmo-chat" aria-live="polite" aria-label="Influmo Chat" hidden>
    <header class="chat-header" role="banner">
      <div class="brand">
        <div class="logo">
          <!-- Use your real logo path -->
          <img src="/influmologo.jpg" alt="Influmo Logo" style="max-width:100%;max-height:100%;object-fit:contain;" />
        </div>
        <div>
          <h1>Influmo Concierge</h1>
          <p>We help influencers & collaborators connect.</p>
        </div>
      </div>
      <button class="icon-btn" id="influmo-close" aria-label="Close chat">✕</button>
    </header>

    <main id="influmo-feed" class="chat-feed"></main>

    <div id="influmo-quick" class="quick-replies" role="list">
      <button class="chip" data-intent="about">What is Influmo?</button>
      <button class="chip" data-intent="benefits">Early access benefits</button>
      <button class="chip" data-intent="join">Join waitlist</button>
      <button class="chip" data-intent="contact">Contact info</button>
      <button class="chip" data-intent="pricing">How do fees work?</button>
    </div>

    <form id="influmo-form" class="composer" autocomplete="off">
      <input id="influmo-input" name="message" type="text" placeholder="Type your message…" aria-label="Type your message" required />
      <button class="send-btn" aria-label="Send">➤</button>
    </form>
  </section>
  `;
  document.body.insertAdjacentHTML("beforeend", html);

  // 3) Load the chatbot logic (your finished JS with GPT-3.5 wired)
  const script = document.createElement("script");
  script.src = "/influmo-chatbot.js"; // make sure this path is correct
  script.defer = true;
  document.body.appendChild(script);
})();
