// /chat/influmo-embed.js (debug)
(function () {
  try {
    window.INFLUMO_CHAT_DEBUG = true;
    const log = (...a) => {
      if (window.INFLUMO_CHAT_DEBUG) console.log("[Influmo Chat]", ...a);
    };

    // 0) Page ready check
    if (!document || !document.body) {
      log("document not ready; deferring inject");
      window.addEventListener("DOMContentLoaded", inject);
    } else {
      inject();
    }

    function inject() {
      try {
        if (document.getElementById("influmo-chat")) {
          log("chat already present; skipping");
          return;
        }

        // 1) Load CSS
        const cssHref = "/chat/chatbot.css?v=3"; // define correctly
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = cssHref;
        link.onload = () => log("CSS loaded:", cssHref);
        link.onerror = (e) => console.error("[Influmo Chat] CSS failed:", cssHref, e);
        document.head.appendChild(link);

        // 2) Inject HTML
        const html = `
          <button id="influmo-launcher" aria-label="Open chat">
            <span class="bubble-dot"></span><span class="bubble-dot"></span><span class="bubble-dot"></span>
          </button>
          <section id="influmo-chat" aria-live="polite" aria-label="Influmo Chat" hidden>
            <header class="chat-header">
              <div class="brand">
                <div class="logo">
                  <img src="/influmologo.jpg" alt="Influmo Logo" style="max-width:100%;max-height:100%;object-fit:contain"/>
                </div>
                <div>
                  <h1>Influmo Concierge</h1>
                  <p>We help influencers & collaborators connect.</p>
                </div>
              </div>
              <button class="icon-btn" id="influmo-close" aria-label="Close chat">✕</button>
            </header>
            <main id="influmo-feed" class="chat-feed"></main>
            <div id="influmo-quick" class="quick-replies">
              <button class="chip" data-intent="about">What is Influmo?</button>
              <button class="chip" data-intent="benefits">Early access benefits</button>
              <button class="chip" data-intent="join">Join waitlist</button>
              <button class="chip" data-intent="contact">Contact info</button>
              <button class="chip" data-intent="pricing">How do fees work?</button>
            </div>
            <form id="influmo-form" class="composer" autocomplete="off">
              <input id="influmo-input" name="message" type="text" placeholder="Type your message…" required />
              <button class="send-btn" aria-label="Send">➤</button>
            </form>
          </section>`;
        
        document.body.insertAdjacentHTML("beforeend", html);
        log("HTML injected");

        // 3) Load chatbot logic
        const script = document.createElement("script");
        script.src = "/chat/chatbot.js?v=4";
        script.defer = true;
        script.onload = () => log("JS loaded:", script.src);
        script.onerror = (e) => console.error("[Influmo Chat] JS failed:", script.src, e);
        document.body.appendChild(script);

      } catch (err) {
        console.error("[Influmo Chat] inject error:", err);
      }
    }
  } catch (e) {
    console.error("[Influmo Chat] top-level error:", e);
  }
})();
