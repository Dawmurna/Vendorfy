// Customer login and sign-up. No password: we email a 6-digit code.
const $ = (id) => document.getElementById(id);
let mode = "login";
let email = "";
let resendTimer;

/* ---------- Where to go after logging in ---------- */
// Only allows our own pages (like "checkout.html"), so nobody can build a link that sends you to another website.
function safeNext() {
  const next = new URLSearchParams(location.search).get("next") || "";
  return /^[a-z0-9-]+\.html(\?[a-zA-Z0-9=&%_.-]*)?$/i.test(next) ? next : "shop.html";
}

const next = safeNext();
if (next.startsWith("checkout") || next.startsWith("orders") || next.startsWith("account")) {
  $("why").hidden = false;
  $("why").textContent = next.startsWith("checkout")
    ? "Please log in or create an account to place your order. Your cart is saved and will be waiting for you."
    : "Please log in to see this page.";
}

// Already logged in? Skip this page.
api("/auth/me").then((u) => {
  location.href = u.role === "customer" ? next : u.role === "admin" ? "admin.html" : "vendor.html";
}).catch(() => {});

/* ---------- Tabs ---------- */
function setMode(m) {
  mode = m;
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.mode === m));
  $("name-field").hidden = m !== "signup";
  $("title").textContent = m === "signup" ? "Create your account" : "Welcome back";
  $("subtitle").textContent = m === "signup"
    ? "Just your name and email. We will send you a 6-digit code to confirm it is you."
    : "Log in with your email. We will send you a 6-digit code, so there is no password to remember.";
  $("msg1").className = "msg";
}
$("tabs").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-mode]");
  if (b) setMode(b.dataset.mode);
});
if (location.hash === "#signup") setMode("signup");

function show(id, text, type = "error") {
  $(id).textContent = text;
  $(id).className = "msg show " + type;
}

/* ---------- Step 1: ask for the code ---------- */
function startResendTimer() {
  let left = 60;
  const btn = $("resend");
  btn.disabled = true;
  clearInterval(resendTimer);
  const tick = () => {
    btn.textContent = left > 0 ? `Send a new code (${left}s)` : "Send a new code";
    btn.disabled = left > 0;
    if (left-- <= 0) clearInterval(resendTimer);
  };
  tick();
  resendTimer = setInterval(tick, 1000);
}

async function requestCode(fromResend = false) {
  const form = $("form1");
  const body = { email: form.email.value.trim(), mode, name: form.name.value.trim() };
  const msgId = fromResend ? "msg2" : "msg1";
  $(msgId).className = "msg";
  $("send").disabled = true;
  try {
    const r = await apiJson("/customer/request-code", "POST", body);
    email = body.email.toLowerCase();
    $("sent-to").textContent = email;
    $("step1").hidden = true;
    $("step2").hidden = false;
    $("form2").code.value = "";
    $("form2").code.focus();
    startResendTimer();

    // Only appears while testing on your own computer (DEV_SHOW_CODE=true in .env)
    $("dev-box").hidden = !r.devCode;
    if (r.devCode) $("dev-box").textContent = `Testing mode: your code is ${r.devCode}`;
    if (fromResend) show("msg2", "A new code is on its way.", "ok");
  } catch (err) {
    show(msgId, err.message);
  }
  $("send").disabled = false;
}

$("form1").addEventListener("submit", (e) => { e.preventDefault(); requestCode(false); });
$("resend").addEventListener("click", () => requestCode(true));
$("back").addEventListener("click", () => {
  clearInterval(resendTimer);
  $("step2").hidden = true;
  $("step1").hidden = false;
  $("msg2").className = "msg";
});

/* ---------- Step 2: check the code ---------- */
$("form2").code.addEventListener("input", (e) => {
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
});

$("form2").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("msg2").className = "msg";
  $("verify").disabled = true;
  try {
    await apiJson("/customer/verify", "POST", { email, code: $("form2").code.value });
    location.href = next;
  } catch (err) {
    show("msg2", err.message);
    $("verify").disabled = false;
  }
});
