// Login and sign-up page for vendors (and the admin).
const CATEGORIES = [
  "Fashion", "Beauty", "Electronics", "Home & Kitchen", "Babies & Kids",
  "Health & Wellness", "Sports & Outdoors", "Groceries",
];

const form = document.getElementById("form");
const msg = document.getElementById("msg");
const submit = document.getElementById("submit");
let mode = "login";

document.getElementById("category").innerHTML = CATEGORIES.map((c) => `<option>${esc(c)}</option>`).join("");

function show(text, type = "error") {
  msg.textContent = text;
  msg.className = "msg show " + type;
}

function setMode(next) {
  mode = next;
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
  document.querySelectorAll(".register-only").forEach((el) => { el.hidden = mode !== "register"; });
  document.getElementById("pw-hint").hidden = mode !== "register";
  form.password.autocomplete = mode === "register" ? "new-password" : "current-password";
  submit.textContent = mode === "register" ? "Create my store" : "Log in";
  msg.className = "msg";
}
document.getElementById("tabs").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-mode]");
  if (b) setMode(b.dataset.mode);
});
if (location.hash === "#register") setMode("register");

function goNext(user) {
  location.href = user.role === "admin" ? "admin.html" : "vendor.html";
}

// Already logged in? Skip this page.
api("/auth/me").then(goNext).catch(() => {});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.className = "msg";
  submit.disabled = true;
  try {
    const body = { email: form.email.value, password: form.password.value };
    if (mode === "register") {
      body.storeName = form.storeName.value;
      body.category = form.category.value;
    }
    const user = await apiJson(mode === "register" ? "/auth/register" : "/auth/login", "POST", body);
    goNext(user);
  } catch (err) {
    show(err.message);
    submit.disabled = false;
  }
});
