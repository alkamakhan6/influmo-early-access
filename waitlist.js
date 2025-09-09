// waitlist.js — two-step flow, robust binding (no modules needed)
(function(){
  const SUPABASE_URL  = "https://iixpugcjoafrypjspqaf.supabase.co";
  const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpeHB1Z2Nqb2FmcnlwanNwcWFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNzQ0MjIsImV4cCI6MjA3MTY1MDQyMn0.lZnEkXtVSSnxtCtXjFEseAxvzHgBfvdPOwS118hN8ak";
  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON, { auth:{persistSession:false} });

  const $ = (s,r=document)=>r.querySelector(s);
  const form=$('#waitlistForm'), step1=$('#step1'), step2=$('#step2');
  const emailEl=$('#email'), roleEl=$('#role'), nextBtn=$('#nextBtn'), joinBtn=$('#joinBtn');
  const msgEl=$('#msg'), countEl=$('#count'), breakdownEl=$('#breakdown');

  const isEmail = s=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s||'');
  const offerCode = ()=>'EA-'+Date.now().toString(36).toUpperCase();
  const offerExpires = (d=90)=>{const x=new Date(); x.setDate(x.getDate()+d); return x.toISOString();};
  const getUTM=()=>{const p=new URLSearchParams(location.search); return {
    utm_source:p.get('utm_source'), utm_medium:p.get('utm_medium'),
    utm_campaign:p.get('utm_campaign'), utm_term:p.get('utm_term'),
    utm_content:p.get('utm_content'), referrer:document.referrer||null
  };};

  function showStep(id){
    document.querySelectorAll('[data-step]').forEach(el=>el.hidden=true);
    document.getElementById(id).hidden=false;
  }

  // Bind NEXT (with fallback inline hook, in case someone adds onclick later)
  function handleNext(){
    msgEl.textContent='';
    const email=(emailEl?.value||'').trim().toLowerCase();
    if(!isEmail(email)){ msgEl.style.color='#f66'; msgEl.textContent='Please enter a valid email.'; return; }
    showStep('step2'); roleEl?.focus();
  }
  nextBtn && nextBtn.addEventListener('click', handleNext);
  window._nextStep = handleNext; // optional fallback if you add onclick="_nextStep()"

  // Submit final step
  form && form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    msgEl.textContent=''; joinBtn.disabled=true; joinBtn.textContent='Adding…';

    const hp=document.getElementById('company'); if(hp && hp.value){ joinBtn.disabled=false; joinBtn.textContent='Get early access'; return; }

    const email=(emailEl?.value||'').trim().toLowerCase();
    const role=(roleEl?.value||'').trim();
    if(!isEmail(email)){ msgEl.style.color='#f66'; msgEl.textContent='Please enter a valid email.'; showStep('step1'); joinBtn.disabled=false; joinBtn.textContent='Get early access'; return; }
    if(!role){ msgEl.style.color='#f66'; msgEl.textContent='Please select your role.'; joinBtn.disabled=false; joinBtn.textContent='Get early access'; return; }

    const payload = { email, role, offer_code:offerCode(), offer_months:3, offer_rate:0, offer_expires_at:offerExpires(90), ...getUTM() };

    try{
      const { error } = await sb.from('waitlist').insert(payload).single();
      if(error) throw error;
      msgEl.style.color='#77e576'; msgEl.textContent=`You're in as ${role}. We’ll email updates soon.`;
      form.reset(); showStep('step1');
      refreshCount(); refreshBreakdown();
    }catch(e){
      if(String(e?.message||'').match(/duplicate key|unique/i)){
        msgEl.style.color='#77e576'; msgEl.textContent="You're already on the list. Thanks for joining early!";
      }else{
        msgEl.style.color='#f66'; msgEl.textContent="Couldn't add you right now. Please try again.";
      }
    }finally{
      joinBtn.disabled=false; joinBtn.textContent='Get early access';
    }
  });

  async function refreshCount(){ try{ const {data}=await sb.rpc('waitlist_count'); if(typeof data==='number' && countEl) countEl.textContent=data.toLocaleString(); }catch{} }
  async function refreshBreakdown(){ try{ const {data}=await sb.rpc('waitlist_breakdown'); const b=data||{}; if(breakdownEl) breakdownEl.textContent=`${b.total||0} total • ${b.influencer||0} creators • ${b.crew||0} crew • ${b.brand||0} brands`; }catch{} }

  // initial
  showStep('step1'); refreshCount(); refreshBreakdown();
})();
