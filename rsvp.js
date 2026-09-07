// Register the RSVP independently of optional CDN scripts and page effects.
(() => {
const form = document.getElementById("rsvp-form");
const done = document.getElementById("rsvp-done");
const msg = document.getElementById("rsvp-msg");
const submit = form.querySelector('button[type="submit"]');
const label = submit.textContent;
let sending = false;
let pending = null;
form.noValidate = true;
function feedback(text) {
  msg.textContent = text;
  msg.focus();
}
form.addEventListener("submit", async e => {
  e.preventDefault();
  if (sending) return;
  msg.textContent = "";
  const fd = new FormData(form);
  if (!fd.get("attending")) {
    feedback("Please choose Joyfully Accepts or Regretfully Declines before sending.");
    form.querySelector('input[name="attending"]').focus();
    return;
  }
  if (!form.reportValidity()) return;
  const fields = {
    name: String(fd.get("name") || "").trim().slice(0,80),
    contact: String(fd.get("contact") || "").trim().slice(0,80),
    attending: fd.get("attending") === "no" ? "no" : "yes",
    adults: Number(fd.get("adults")) || 1,
    kids: Number(fd.get("kids")) || 0,
    message: String(fd.get("message") || "").trim().slice(0,300)
  };
  if (!fields.name || !fields.contact) {
    feedback("Please enter your name and an email address or phone number.");
    return;
  }
  if (fields.attending === "no") { fields.adults = 0; fields.kids = 0; }
  const fingerprint = JSON.stringify(fields);
  // Reuse the same ID on an unchanged retry if the first response was lost.
  const retrying = pending?.fingerprint === fingerprint;
  if (!retrying) pending = { fingerprint, row: {
    ...fields, id: "r" + crypto.randomUUID(), created_at: new Date().toISOString()
  }};
  const row = pending.row;
  sending = true;
  submit.disabled = true;
  submit.textContent = "Sending…";
  form.setAttribute("aria-busy", "true");
  msg.textContent = "Sending your RSVP…";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(SUPABASE_URL + "/rest/v1/rsvps", {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY,
        "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(row), signal: controller.signal
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      // The only unique key in rsvps is this request's random primary key.
      if (!(retrying && response.status === 409 && error.code === "23505")) {
        throw new Error("RSVP request failed: " + response.status);
      }
    }
    msg.textContent = "";
    form.classList.add("hidden");
    done.classList.remove("hidden");
    document.getElementById("rsvp-summary").textContent = row.attending === "yes"
      ? `${row.name} • Attending • ${row.adults} adult(s), ${row.kids} kid(s)`
      : `${row.name} • Can't make it — you'll be missed!`;
    done.focus();
    if (typeof boom === "function") boom({particleCount:140});
  } catch (error) {
    console.warn("RSVP save failed:", error);
    feedback(error.name === "AbortError"
      ? "This is taking longer than expected. We couldn't confirm your RSVP. Please try again, or email raksha0912@gmail.com."
      : "We couldn't confirm your RSVP. Your details are still here. Please try again, or email raksha0912@gmail.com.");
  } finally {
    clearTimeout(timeout);
    sending = false;
    submit.disabled = false;
    submit.textContent = label;
    form.removeAttribute("aria-busy");
  }
});
document.getElementById("rsvp-edit").onclick = () => {
  pending = null;
  form.reset();
  form.classList.remove("hidden", "declining");
  done.classList.add("hidden");
  msg.textContent = "";
  refreshSteppers();
  form.querySelector('input[name="name"]').focus();
};
// Declining hides the counts (no seats needed)
form.querySelectorAll('input[name="attending"]').forEach(radio=>radio.addEventListener("change", ()=>{
  form.classList.toggle("declining", form.querySelector('input[name="attending"]:checked').value==="no");
}));
// Steppers for adults/kids counts (dim at limits)
function refreshSteppers(){
  document.querySelectorAll("[data-step]").forEach(btn=>{
    const input=form.querySelector(`input[name="${btn.dataset.for}"]`);
    if(!input) return;
    const v=+input.value||0, d=+btn.dataset.step;
    btn.disabled = (d<0 && v<=(+input.min||0)) || (d>0 && v>=(+input.max||6));
  });
}
document.querySelectorAll("[data-step]").forEach(btn=>btn.addEventListener("click", ()=>{
  const input=form.querySelector(`input[name="${btn.dataset.for}"]`);
  if(!input) return;
  const min=+input.min||0, max=+input.max||6;
  input.value=Math.min(max,Math.max(min,(+input.value||0)+(+btn.dataset.step)));
  refreshSteppers();
}));
refreshSteppers();


})();
