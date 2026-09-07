// Config
const AMAZON_REGISTRY_URL = "https://www.amazon.com/baby-reg/raksha-patel-january-2027-boonton/315JG9NQI33SR";
const EVENT_DATE = new Date("2026-11-22T16:00:00-05:00");
// Shared public Supabase configuration is loaded by config.js.

// Registry is link-only — Amazon is source of truth (no mirror grid).
// See AMAZON_REGISTRY_URL above.

const store = {
  get(k, f){ try{ const v = localStorage.getItem(k); return v?JSON.parse(v):f; }catch{ return f; } },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
};

// Supabase client (null if CDN blocked or not configured)
let sb = null;
try{
  if(window.supabase && SUPABASE_URL.startsWith("https://") && SUPABASE_ANON_KEY.length > 20)
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}catch{ sb = null; }

// Countdown (with leading zeroes; deadline notice after Nov 1)
const RSVP_DEADLINE = new Date("2026-11-01T23:59:59-05:00");
function tick(){
  const cd = document.getElementById("countdown");
  if(new Date() > RSVP_DEADLINE && new Date() < EVENT_DATE){
    cd.innerHTML = `<div style="min-width:0"><b style="font-size:1rem">RSVPs are now due — email us!</b></div>`;
    return;
  }
  const diff = EVENT_DATE - new Date();
  const el = (id,v)=>document.getElementById(id).textContent=String(v).padStart(2,"0");
  if(diff<=0){ el("cd-d","0");el("cd-h","0");el("cd-m","0");el("cd-s","0"); return; }
  el("cd-d", Math.floor(diff/864e5));
  el("cd-h", Math.floor(diff/36e5)%24);
  el("cd-m", Math.floor(diff/6e4)%60);
  el("cd-s", Math.floor(diff/1e3)%60);
}
setInterval(tick,1000); tick();

// Amazon link
document.getElementById("amazon-full").href = AMAZON_REGISTRY_URL;

// Nav: shadow on scroll + active section highlight + back-to-top
const nav=document.querySelector(".nav");
const toTop=document.getElementById("to-top");
addEventListener("scroll",()=>{
  nav.classList.toggle("scrolled",scrollY>8);
  toTop.classList.toggle("show",scrollY>700);
},{passive:true});
toTop.onclick=()=>scrollTo({top:0,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
const secIO=new IntersectionObserver(es=>es.forEach(e=>{
  if(!e.isIntersecting) return;
  document.querySelectorAll(".links a").forEach(a=>a.classList.toggle("active",a.getAttribute("href")==="#"+e.target.id));
}),{rootMargin:"-40% 0px -55% 0px"});
["details","rsvp","registry","guestbook","faq"].forEach(id=>{const s=document.getElementById(id); if(s) secIO.observe(s);});

// Scroll reveal + confetti helpers (Cozy Paper)
function boom(opts){ try{ if(matchMedia("(prefers-reduced-motion: reduce)").matches) return; if(window.confetti) confetti(Object.assign({particleCount:90,spread:70,origin:{y:.7},colors:["#E07B2A","#F2A9B8","#8a9a5b","#ffd9a8"]},opts||{})); }catch{} }
document.querySelectorAll("main .card").forEach(c=>c.classList.add("reveal"));
const io = new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target);} }),{threshold:.12});
document.querySelectorAll(".reveal").forEach(el=>io.observe(el));

// Keepsake wall — note + optional photo. Cloud-first, local mirror fallback.
function seedNotes(){
  return [{gname:"Dhruvi Masi & Lina Masi",gtext:"Can't wait to meet our little pumpkin girl! 🎀",src:null,at:new Date().toISOString()}];
}
let gbLoading = false;
let gbVersion = 0;
function showKeepsake(note){
  const box = document.getElementById("gb-list");
  const card = document.createElement("div");
  card.className = "gb keep-card";
  if(note.src){
    const img = document.createElement("img");
    img.src = note.src; img.alt = "Keepsake photo";
    card.append(img);
  }
  const message = document.createElement("p");
  message.textContent = note.gtext;
  card.append(message);
  box.replaceChildren(card);
}
async function renderGB(){
  if(gbLoading) return;
  gbLoading = true;
  const version = gbVersion;
  try{
  const box = document.getElementById("gb-list");
  let list = [];
  if(sb){
    try{
      const {data, error} = await sb.from("keepsake_notes").select("gname,gtext,photo_url,created_at").order("created_at",{ascending:false}).limit(60);
      if(error) return;
      if(data){ list = data.map(n=>({gname:n.gname,gtext:n.gtext,src:n.photo_url||null,at:n.created_at})); }
    }catch(err){ console.warn("Keepsake fetch failed:", err); return; }
  }
  if(!list.length){
    // local mirror (migrates old split keys once) or seed
    let local = store.get("baby_notes", null);
    if(!local){
      local = [];
      store.get("baby_gb",seedNotes()).forEach(m=>local.push({gname:m.gname,gtext:m.gtext,src:null,at:m.at||new Date().toISOString()}));
      store.get("baby_photos",[]).forEach(p=>local.push({gname:p.by||"Guest",gtext:p.note||"",src:p.src||null,at:p.at||new Date().toISOString()}));
      store.set("baby_notes",local);
    }
    list = local.slice().reverse();
    if(!list.length) list = seedNotes();
  }
  // A background read started before a new post must not replace that post.
  if(version !== gbVersion) return;
  const latest = list[0];
  if(latest) showKeepsake(latest);
  } finally { gbLoading = false; }
}

function escapeHtml(s){ return (s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
document.getElementById("gb-form").addEventListener("submit", async e=>{
  e.preventDefault();
  const button = e.target.querySelector('button[type="submit"]');
  if(button.disabled) return;
  button.disabled = true;
  const buttonText = button.textContent;
  button.textContent = "Posting…";
  const status = document.getElementById("gb-status");
  status.textContent = "Posting your keepsake…";
  try {
  const fd=new FormData(e.target);
  const file=fd.get("gphoto");
  const entry={gname:(fd.get("gname")||"Guest").toString().slice(0,40),gtext:(fd.get("gtext")||"").toString().slice(0,300),src:null,at:new Date().toISOString()};
  const mirrorLocal=(src)=>{ const all=store.get("baby_notes",[]); all.push({...entry,src}); store.set("baby_notes",all.slice(-60)); };
  if(sb){
    try{
      let photo_url = null;
      if(file && file.size){
        const ext=(file.name.split(".").pop()||"jpg").slice(0,4).replace(/[^a-z0-9]/gi,"")||"jpg";
        const path=`baby-${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
        const up=await sb.storage.from("keepsake").upload(path,file);
        if(up.error) throw up.error;
        photo_url=sb.storage.from("keepsake").getPublicUrl(path).data.publicUrl;
      }
      const {error}=await sb.from("keepsake_notes").insert({gname:entry.gname,gtext:entry.gtext,photo_url});
      if(error) throw error;
      // Paint the confirmed post immediately; do not wait for another read.
      gbVersion++;
      showKeepsake({...entry,src:photo_url});
      try { mirrorLocal(photo_url); } catch {}
    }catch(err){
      console.warn("Keepsake cloud save failed:", err);
      status.textContent = "We couldn't confirm your post. Your message and photo are still here. Please try again.";
      return;
    }
  }else{
    status.textContent = "We couldn't connect to the keepsake wall. Please refresh and try again. Your post hasn't been sent.";
    return;
  }
  e.target.reset();
  status.textContent = "Your keepsake is posted!";
  boom({particleCount:40,spread:60});
  } finally {
    button.disabled = false;
    button.textContent = buttonText;
  }
});
renderGB();
// Keep other guests' posts fresh while the wall is being viewed.
let keepsakeVisible = false;
const keepsakeObserver = new IntersectionObserver(entries => {
  keepsakeVisible = entries.some(entry => entry.isIntersecting);
  if(keepsakeVisible && !document.hidden) renderGB();
});
keepsakeObserver.observe(document.getElementById("guestbook"));
setInterval(() => {
  if(keepsakeVisible && !document.hidden) renderGB();
}, 5000);
document.addEventListener("visibilitychange", () => {
  if(!document.hidden) renderGB();
});
window.addEventListener("online", () => renderGB());

// Lightbox — tap any keepsake photo to view full size
const lb = document.getElementById("lightbox");
const lbImg = document.getElementById("lightbox-img");
function closeLb(){ lb.classList.add("hidden"); lbImg.src=""; }
document.getElementById("gb-list").addEventListener("click", e=>{
  const im = e.target.closest(".keep-card")?.querySelector("img");
  if(!im) return;
  lbImg.src = im.src; lb.classList.remove("hidden");
});
document.getElementById("lightbox-close").onclick = closeLb;
lb.addEventListener("click", e=>{ if(e.target===lb) closeLb(); });
document.addEventListener("keydown", e=>{ if(e.key==="Escape") closeLb(); });

// Host admin lives on the unlinked admin.html page (magic-link login + CSV).
// Guests never see host tooling. Data protected by Supabase RLS.
