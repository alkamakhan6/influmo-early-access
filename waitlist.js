// waitlist.js — two-step flow with username + opt-in + recent joins
(function(){
  const SUPABASE_URL  = "https://iixpugcjoafrypjspqaf.supabase.co";
  const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpeHB1Z2Nqb2FmcnlwanNwcWFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNzQ0MjIsImV4cCI6MjA3MTY1MDQyMn0.lZnEkXtVSSnxtCtXjFEseAxvzHgBfvdPOwS118hN8ak";
  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON, { auth:{persistSession:false} });

  const $ = (s,r=document)=>r.querySelector(s);
  const form = $('#waitlistForm');
  const step1 = $('#step1');
  const step2 = $('#step2');
  const emailEl = $('#email');
  const roleEl  = $('#role');
  const userEl  = $('#username');
  const pubEl   = $('#showPublic');
  const nextBtn = $('#nextBtn');
  const joinBtn = $('#joinBtn');
  const msgEl   = $('#msg');
  const countEl = $('#count');
  const breakdownEl = $('#breakdown');

  // helpers
  const isEmail = s=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s||'');
  const offerCode = ()=>'EA-'+Date.now().toString(36).toUpperCase();
  const offerExpires = (d=90)=>{const x=new Date(); x.setDate(x.getDate()+d); return x.toISOString();};
  const sanitizeUsername=(raw)=>{
    if(!raw) return null;
    let u = raw.trim().toLowerCase();
    if(u.startsWith('@')) u = u.slice(1);
    u = u.replace(/[^a-z0-9_.]/g,'');
    return (u.length>=3 && u.length<=20) ? u : null;
  };
  const getUTM=()=>{const p=new URLSearchParams(location.search); return {
    utm_source:p.get('utm_source'), utm_medium:p.get('utm_medium'),
    utm_campaign:p.get('utm_campaign'), utm_term:p.get('utm_term'),
    utm_content:p.get('utm_content'), referrer:document.referrer||null
  };};
  const roleIcon=(r)=>({influencer:'🏷️', crew:'🧰', brand:'🏢'})[(r||'').toLowerCase()]||'👤';
  const timeAgo=(ts)=>{const now=new Date(), t=new Date(ts); const s=Math.floor((now-t)/1000);
    if(s<60) return `${s}s ago`; const m=Math.floor(s/60); if(m<60) return `${m}m ago`;
    const h=Math.floor(m/60); if(h<24) return `${h}h ago`; const d=Math.floor(h/24); return `${d}d ago`;};

  function showStep(id){
    document.querySelectorAll('[data-step]').forEach(el=>el.hidden=true);
    document.getElementById(id).hidden=false;
  }

  nextBtn?.addEventListener('click', ()=>{
    msgEl.textContent='';
    const email=(emailEl?.value||'').trim().toLowerCase();
    if(!isEmail(email)){ msgEl.style.color='#f66'; msgEl.textContent='Please enter a valid email.'; return; }
    showStep('step2'); roleEl?.focus();
  });

  form?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    msgEl.textContent=''; joinBtn.disabled=true; joinBtn.textContent='Adding…';

    // honeypot
    const hp=document.getElementById('company'); if(hp && hp.value){ joinBtn.disabled=false; joinBtn.textContent='Get early access'; return; }

    const email=(emailEl?.value||'').trim().toLowerCase();
    const role=(roleEl?.value||'').trim();
    const username=sanitizeUsername(userEl?.value||'');
    const isPublic=!!pubEl?.checked;

    if(!isEmail(email)){ msgEl.style.color='#f66'; msgEl.textContent='Please enter a valid email.'; showStep('step1'); joinBtn.disabled=false; joinBtn.textContent='Get early access'; return; }
    if(!role){ msgEl.style.color='#f66'; msgEl.textContent='Please select your role.'; joinBtn.disabled=false; joinBtn.textContent='Get early access'; return; }

    const payload={ email, role, username: username||null, is_public:isPublic,
      offer_code:offerCode(), offer_months:3, offer_rate:0, offer_expires_at:offerExpires(90), ...getUTM() };

    try{
      const { error } = await sb.from('waitlist').insert(payload).single();
      if(error) throw error;
      msgEl.style.color='#77e576'; msgEl.textContent=`You're in!`;
      form.reset(); showStep('step1');
      await refreshCount(); await refreshBreakdown(); await refreshRecent();
    }catch(e){
      if(String(e?.message||'').match(/waitlist_username_unique/i)){
        msgEl.style.color='#f66'; msgEl.textContent='That username is taken. Try another or leave it empty.';
      }else if(String(e?.message||'').match(/duplicate key|unique/i)){
        msgEl.style.color='#77e576'; msgEl.textContent="You're already on the list. We'll keep you posted!";
      }else{
        msgEl.style.color='#f66'; msgEl.textContent="Couldn't add you right now. Please try again.";
      }
    }finally{
      joinBtn.disabled=false; joinBtn.textContent='Get early access';
    }
  });

  async function refreshCount(){ try{ const {data}=await sb.rpc('waitlist_count'); if(typeof data==='number' && countEl) countEl.textContent=data.toLocaleString(); }catch{} }
  async function refreshBreakdown(){ try{ const {data}=await sb.rpc('waitlist_breakdown'); if(!data||!breakdownEl) return;
    breakdownEl.textContent = `${data.total||0} total • ${data.influencer||0} creators • ${data.crew||0} crew • ${data.brand||0} brands`;
  }catch{ if(breakdownEl) breakdownEl.textContent=''; } }
 async function refreshRecent(){
  try{
    const track = document.getElementById('recentTrack');
    const bar   = document.getElementById('recentBar'); // container
    if (!track || !bar) return;

    const { data } = await sb.rpc('waitlist_recent_usernames', { n: 24 });
    track.innerHTML = '';

    const items = (data || []).map(row => {
      const pill = document.createElement('div');
      pill.className = 'recent-pill';
      pill.innerHTML = `<span class="recent-dot"></span> ${
        row.role === 'brand' ? '🏢' : row.role === 'crew' ? '🧰' : '🏷️'
      } @${row.username} • ${timeAgo(row.joined_at)}`;
      return pill;
    });

    // If nothing yet, hide the bar
    if (!items.length) { bar.style.display = 'none'; return; }
    bar.style.display = '';

    items.forEach(el => track.appendChild(el));

    // Only duplicate + animate when content actually overflows
    requestAnimationFrame(() => {
      const needLoop = track.scrollWidth > bar.clientWidth + 40;
      if (needLoop) {
        items.forEach(el => track.appendChild(el.cloneNode(true)));
        track.style.animation = 'marquee 28s linear infinite';
      } else {
        track.style.animation = 'none';
      }
    });
  } catch (e) {
    console.warn('recent error', e);
  }
}


  // init
  showStep('step1'); refreshCount(); refreshBreakdown(); refreshRecent();
})();
