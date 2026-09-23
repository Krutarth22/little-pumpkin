// Host-only page. Data access is protected by Supabase Row Level Security.
const SUPABASE_URL = "https://xuspoyamjsggryhoiyim.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1c3BveWFtanNnZ3J5aG9peWltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NTU4MTIsImV4cCI6MjEwNDAzMTgxMn0.Tl70JJ7m7RRPIPq9z8loRMTQO6ETX82Vzxnd_fL0Fv0";
const ADMIN_EMAILS = new Set(["raksha0912@gmail.com", "krutarthmajithia22@gmail.com"]);

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const els = {
  loginCard: document.getElementById("host-login-card"), email: document.getElementById("host-email"),
  login: document.getElementById("host-login"), logout: document.getElementById("host-logout"),
  status: document.getElementById("host-status"), identity: document.getElementById("host-identity"),
  panel: document.getElementById("admin-panel"), list: document.getElementById("admin-rsvps"),
  search: document.getElementById("rsvp-search"), results: document.getElementById("admin-results-count"),
  updated: document.getElementById("admin-updated"), refresh: document.getElementById("refresh-rsvps"),
  export: document.getElementById("export-csv"),
};
let cloudRsvps = [];
let activeFilter = "all";

function setBusy(button, busy, busyText){
  if(!button.dataset.label) button.dataset.label = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? busyText : button.dataset.label;
}
function setStatus(message, kind=""){
  els.status.textContent = message;
  els.status.className = `admin-status${kind ? ` ${kind}` : ""}`;
}
function formatDate(value){
  if(!value) return "Date unavailable";
  const date = new Date(value);
  if(Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", {month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}).format(date);
}
function setHostUI(session){
  const signedIn = Boolean(session);
  els.loginCard.classList.toggle("hidden", signedIn);
  els.panel.classList.toggle("hidden", !signedIn);
  if(signedIn) els.identity.textContent = `Signed in as ${session.user.email}`;
  if(!signedIn){
    cloudRsvps = [];
    els.list.innerHTML = "";
    setStatus("Only approved hosts can view RSVP details.");
  }
}
function updateStats(list){
  const attending = list.filter(r=>r.attending === "yes");
  const adults = attending.reduce((sum,r)=>sum + (Number(r.adults) || 0), 0);
  const kids = attending.reduce((sum,r)=>sum + (Number(r.kids) || 0), 0);
  document.getElementById("stat-responses").textContent = list.length;
  document.getElementById("stat-attending").textContent = attending.length;
  document.getElementById("stat-adults").textContent = adults;
  document.getElementById("stat-kids").textContent = kids;
}
function visibleRsvps(){
  const query = els.search.value.trim().toLowerCase();
  return cloudRsvps.filter(r=>{
    const matchesFilter = activeFilter === "all" || r.attending === activeFilter;
    const haystack = `${r.name || ""} ${r.contact || ""} ${r.message || ""}`.toLowerCase();
    return matchesFilter && (!query || haystack.includes(query));
  });
}
function makeRsvpCard(r){
  const card = document.createElement("article");
  card.className = "admin-rsvp-card";
  const top = document.createElement("div");
  top.className = "rsvp-card-top";
  const nameWrap = document.createElement("div");
  const name = document.createElement("h3");
  name.textContent = r.name || "Unnamed guest";
  const contact = document.createElement("a");
  const rawContact = r.contact || "No contact provided";
  contact.textContent = rawContact;
  if(rawContact.includes("@")) contact.href = `mailto:${rawContact}`;
  else if(/[0-9]/.test(rawContact)) contact.href = `tel:${rawContact.replace(/[^+\d]/g,"")}`;
  nameWrap.append(name, contact);
  const badge = document.createElement("span");
  badge.className = `rsvp-status ${r.attending === "yes" ? "is-attending" : "is-declined"}`;
  badge.textContent = r.attending === "yes" ? "Attending" : "Declined";
  top.append(nameWrap, badge);
  card.append(top);
  if(r.attending === "yes"){
    const counts = document.createElement("div");
    counts.className = "rsvp-counts";
    const adults = Number(r.adults) || 0;
    const kids = Number(r.kids) || 0;
    counts.innerHTML = `<span><b>${adults}</b> adult${adults === 1 ? "" : "s"}</span><span><b>${kids}</b> kid${kids === 1 ? "" : "s"}</span>`;
    card.append(counts);
  }
  if(r.message){
    const message = document.createElement("blockquote");
    message.textContent = r.message;
    card.append(message);
  }
  const submitted = document.createElement("p");
  submitted.className = "rsvp-submitted";
  submitted.textContent = `Submitted ${formatDate(r.created_at)}`;
  card.append(submitted);
  return card;
}
function renderRsvps(){
  const list = visibleRsvps();
  els.list.innerHTML = "";
  els.results.textContent = `${list.length} of ${cloudRsvps.length} response${cloudRsvps.length === 1 ? "" : "s"}`;
  if(!list.length){
    const empty = document.createElement("div");
    empty.className = "admin-empty";
    empty.innerHTML = cloudRsvps.length ? "<span>⌕</span><h3>No matching guests</h3><p>Try a different search or filter.</p>" : "<span>💌</span><h3>No RSVPs yet</h3><p>New responses will appear here.</p>";
    els.list.append(empty);
    return;
  }
  list.forEach(r=>els.list.append(makeRsvpCard(r)));
}
async function refreshAdmin(){
  setBusy(els.refresh, true, "Refreshing…");
  els.updated.textContent = "Loading responses…";
  try{
    const {data, error} = await sb.from("rsvps").select("*").order("created_at",{ascending:false}).limit(500);
    if(error) throw error;
    cloudRsvps = data || [];
    updateStats(cloudRsvps);
    renderRsvps();
    els.updated.textContent = `Updated ${new Intl.DateTimeFormat("en-US", {hour:"numeric",minute:"2-digit"}).format(new Date())}`;
  }catch(err){
    els.updated.textContent = "Could not load responses.";
    els.list.innerHTML = "";
    const errorBox = document.createElement("div");
    errorBox.className = "admin-empty admin-error";
    errorBox.innerHTML = "<span>!</span><h3>Unable to load RSVPs</h3>";
    const detail = document.createElement("p");
    detail.textContent = String(err.message || "Please try again.");
    errorBox.append(detail);
    els.list.append(errorBox);
  }finally{ setBusy(els.refresh, false, "Refreshing…"); }
}

els.login.addEventListener("click", async ()=>{
  const email = els.email.value.trim().toLowerCase();
  if(!email || !els.email.validity.valid){ setStatus("Enter a valid email address first.", "is-error"); els.email.focus(); return; }
  if(!ADMIN_EMAILS.has(email)){ setStatus("This email is not authorized for the host dashboard.", "is-error"); els.email.focus(); return; }
  setBusy(els.login, true, "Sending…");
  const {error} = await sb.auth.signInWithOtp({email, options:{emailRedirectTo:new URL("admin.html", location.href).href}});
  setBusy(els.login, false, "Sending…");
  setStatus(error ? `Login failed: ${error.message}` : "Check your email for the secure login link.", error ? "is-error" : "is-success");
});
els.email.addEventListener("keydown", e=>{ if(e.key === "Enter") els.login.click(); });
els.logout.addEventListener("click", async ()=>{ els.logout.disabled = true; await sb.auth.signOut(); els.logout.disabled = false; setHostUI(null); });
els.refresh.addEventListener("click", refreshAdmin);
els.search.addEventListener("input", renderRsvps);
document.querySelectorAll(".filter-tab").forEach(button=>button.addEventListener("click", ()=>{
  activeFilter = button.dataset.filter;
  document.querySelectorAll(".filter-tab").forEach(tab=>tab.classList.toggle("active", tab === button));
  renderRsvps();
}));
els.export.addEventListener("click", ()=>{
  const list = visibleRsvps();
  if(!list.length){ alert("There are no matching RSVPs to export."); return; }
  const columns = ["name","contact","attending","adults","kids","message","created_at"];
  const rows = [columns.join(","), ...list.map(r=>columns.map(column=>`"${String(r[column] ?? "").replace(/"/g,'""')}"`).join(","))];
  const url = URL.createObjectURL(new Blob(["\ufeff" + rows.join("\n")], {type:"text/csv;charset=utf-8"}));
  const link = document.createElement("a");
  link.href = url;
  link.download = `little-pumpkin-rsvps-${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
});

(async ()=>{
  const {data:{session}} = await sb.auth.getSession();
  setHostUI(session);
  if(session) refreshAdmin();
})();
sb.auth.onAuthStateChange((event, session)=>{
  setHostUI(session);
  if(session && event === "SIGNED_IN") refreshAdmin();
});
