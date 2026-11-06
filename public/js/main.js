// Things every shop page needs: who is logged in, the cart, the wishlist, product cards, toast, mobile menu.
// Needs js/utils.js loaded first.
//
// Two modes:
//   Guest (not logged in): the cart and wishlist are kept in this browser (localStorage).
//   Customer (logged in):  they are saved on the server, so they follow the account to any phone or computer.
// When a guest logs in, whatever they saved is moved into their account automatically.

/* ---------- Browser storage for guests ---------- */
function load(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; } catch (e) { return []; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage blocked, ignore */ }
}

// Tidy up anything an older version of the site saved
let guestCart = load("vendorfy_cart").map((i) => ({ id: String(i.id), qty: Number(i.qty) || 1, size: i.size || null }));
let guestWish = load("vendorfy_wish").map(String);

/* ---------- Who is logged in ---------- */
let currentUser = null;   // null = guest
let serverCartCount = 0;
let serverWish = [];

const isCustomer = () => Boolean(currentUser && currentUser.role === "customer");
const wishIds = () => (isCustomer() ? serverWish : guestWish);
const cartCount = () => (isCustomer() ? serverCartCount : guestCart.reduce((sum, i) => sum + i.qty, 0));

// Where to send someone to log in, and bring them back afterwards
function goLogin(next) {
  const here = location.pathname.split("/").pop() + location.search;
  location.href = "login.html?next=" + encodeURIComponent(next || here);
}

const sessionReady = (async () => {
  try { currentUser = await api("/auth/me"); } catch (e) { currentUser = null; }

  if (isCustomer()) {
    try {
      if (guestCart.length || guestWish.length) {
        const r = await apiJson("/me/merge", "POST", { cart: guestCart, wishlist: guestWish });
        guestCart = []; guestWish = [];
        save("vendorfy_cart", []); save("vendorfy_wish", []);
        serverCartCount = r.cartCount;
        serverWish = r.wishlist.map(String);
      } else {
        const s = await api("/me/summary");
        serverCartCount = s.cartCount;
        serverWish = s.wishlist.map(String);
      }
    } catch (e) { /* the top bar still works without the counts */ }
  }
  renderProfile();
  updateBadges();
})();

// For pages that need an account (checkout, orders, account). Sends guests to the login page.
async function requireCustomer() {
  await sessionReady;
  if (!isCustomer()) {
    if (currentUser) location.href = currentUser.role === "admin" ? "admin.html" : "vendor.html";
    else goLogin();
    await new Promise(() => {}); // stay here while the browser changes page
  }
}

/* ---------- Top bar: Log in button, or "Hi, Name" menu ---------- */
function renderProfile() {
  const el = document.getElementById("profile");
  if (!el) return;

  if (!currentUser) {
    el.innerHTML = `<a class="btn btn-primary login-btn" href="login.html?next=${encodeURIComponent(location.pathname.split("/").pop() + location.search)}">Log in</a>`;
    return;
  }
  const label = currentUser.name || (currentUser.vendor && currentUser.vendor.storeName) || currentUser.email.split("@")[0];
  const first = label.split(" ")[0];
  const links = isCustomer()
    ? `<a href="account.html">My account</a><a href="orders.html">My orders</a><a href="wishlist.html">Wishlist</a>`
    : currentUser.role === "admin"
      ? `<a href="admin.html">Admin</a>`
      : `<a href="vendor.html">Vendor dashboard</a>`;

  el.innerHTML = `
    <button class="profile-btn" id="profile-btn" aria-haspopup="true" aria-expanded="false">
      <span class="avatar">${esc(label.charAt(0).toUpperCase())}</span>
      <span>Hi, ${esc(first)}</span>
      <svg class="icon" style="width:16px;height:16px"><use href="#i-chevron"/></svg>
    </button>
    <div class="profile-menu" id="profile-menu" hidden>
      <div class="profile-email">${esc(currentUser.email)}</div>
      ${links}
      <button id="logout-btn">Log out</button>
    </div>`;

  document.getElementById("profile-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    const menu = document.getElementById("profile-menu");
    menu.hidden = !menu.hidden;
    e.currentTarget.setAttribute("aria-expanded", String(!menu.hidden));
  });
  addSidebarLogout();
  document.getElementById("logout-btn").addEventListener("click", async () => {
    try { await apiJson("/auth/logout", "POST", {}); } catch (e) { /* ignore */ }
    location.href = "shop.html";
  });
}
// A plain Log out link in the sidebar too, so it is easy to find
function addSidebarLogout() {
  const nav = document.querySelector(".sidebar nav");
  if (!currentUser || !nav || document.getElementById("side-logout")) return;
  const a = document.createElement("a");
  a.href = "#";
  a.id = "side-logout";
  a.className = "nav-item";
  a.innerHTML = '<svg class="icon"><use href="#i-user"/></svg>Log out';
  a.addEventListener("click", async (e) => {
    e.preventDefault();
    try { await apiJson("/auth/logout", "POST", {}); } catch (err) { /* ignore */ }
    location.href = "shop.html";
  });
  const profileLink = [...nav.querySelectorAll("a")].find((l) => l.getAttribute("href") === "account.html");
  if (profileLink) profileLink.after(a); else nav.appendChild(a);
}

document.addEventListener("click", () => {
  const menu = document.getElementById("profile-menu");
  if (menu) menu.hidden = true;
});

/* ---------- Badges and hearts ---------- */
function updateBadges() {
  const badge = document.getElementById("cart-count");
  if (badge) {
    badge.textContent = cartCount();
    badge.hidden = cartCount() === 0;
  }
  const ids = wishIds();
  document.querySelectorAll(".wish-btn[data-id]").forEach((btn) => {
    btn.classList.toggle("liked", ids.includes(btn.dataset.id));
  });
}

/* ---------- Cart (works for guests and customers) ---------- */
// Returns { ok: true } or { ok: false, message }
async function addToCart(id, qty = 1, size = null) {
  await sessionReady;
  id = String(id);
  if (isCustomer()) {
    try {
      const r = await apiJson("/me/cart", "POST", { id, qty, size });
      serverCartCount = r.cartCount;
      updateBadges();
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  }
  const existing = guestCart.find((i) => i.id === id && i.size === size);
  if (existing) existing.qty += qty; else guestCart.push({ id, qty, size });
  save("vendorfy_cart", guestCart);
  updateBadges();
  return { ok: true };
}

// The lines in the cart: [{ id, qty, size }]
async function getCartLines() {
  await sessionReady;
  return isCustomer() ? api("/me/cart") : guestCart.map((i) => ({ ...i }));
}

// Set an exact quantity (0 removes the line). Returns { ok } or { ok: false, message }
async function setCartQty(id, size, qty) {
  await sessionReady;
  id = String(id);
  if (isCustomer()) {
    try {
      const r = await apiJson("/me/cart", "PUT", { id, size: size || "", qty });
      serverCartCount = r.cartCount;
      updateBadges();
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  }
  const i = guestCart.findIndex((x) => x.id === id && (x.size || null) === (size || null));
  if (i !== -1) {
    if (qty <= 0) guestCart.splice(i, 1); else guestCart[i].qty = qty;
    save("vendorfy_cart", guestCart);
  }
  updateBadges();
  return { ok: true };
}

// Returns true if the item was just added, false if removed
async function toggleWish(id) {
  await sessionReady;
  id = String(id);
  if (isCustomer()) {
    const r = await apiJson("/me/wishlist/toggle", "POST", { id });
    serverWish = r.added ? [...serverWish, id] : serverWish.filter((x) => x !== id);
    updateBadges();
    return r.added;
  }
  const i = guestWish.indexOf(id);
  if (i === -1) guestWish.push(id); else guestWish.splice(i, 1);
  save("vendorfy_wish", guestWish);
  updateBadges();
  return i === -1;
}

/* ---------- Toast ---------- */
let toastTimer;
function toast(message) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

/* ---------- Product card (one function builds every card) ---------- */
const productCache = {};
const findProduct = (id) => productCache[String(id)];

function productCard(p) {
  productCache[String(p.id)] = p;
  const badge = p.off ? `<span class="discount-badge">-${p.off}%</span>` : "";
  const oldPrice = p.off ? `<span class="old-price">${formatPrice(p.oldPrice)}</span>` : "";
  const url = `product.html?id=${encodeURIComponent(p.id)}`;
  const out = p.stock === 0;

  return `
    <article class="product-card" data-id="${esc(p.id)}">
      <div class="thumb">
        <a href="${url}" class="thumb-link" aria-label="${esc(p.title)}">
          ${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.title)}" loading="lazy" onerror="this.style.display='none'" />` : ""}
        </a>
        ${badge}
        <button class="wish-btn" data-id="${esc(p.id)}" aria-label="Add to wishlist">
          <svg class="icon"><use href="#i-heart"/></svg>
        </button>
      </div>
      <div class="card-body">
        <div class="card-meta">
          <span>${esc(p.vendor)} <svg class="icon verified" style="width:13px;height:13px"><use href="#i-check"/></svg></span>
          <span class="rating-new">${out ? "Sold out" : "New"}</span>
        </div>
        <h3 class="card-title"><a href="${url}">${esc(p.title)}</a></h3>
        <div class="card-bottom">
          <span class="price">${formatPrice(p.price)}${oldPrice}</span>
          <button class="cart-btn" data-id="${esc(p.id)}" aria-label="Add ${esc(p.title)} to cart" ${out ? "disabled" : ""}>
            <svg class="icon"><use href="#i-cart"/></svg>
          </button>
        </div>
      </div>
    </article>`;
}

/* ---------- Clicks (works for cards that are added later too) ---------- */
document.addEventListener("click", async (e) => {
  const heart = e.target.closest(".wish-btn[data-id]");
  if (heart) {
    try {
      const added = await toggleWish(heart.dataset.id);
      toast(added ? "Saved to your wishlist" : "Removed from wishlist");
    } catch (err) { toast(err.message); }
  }

  const cartBtn = e.target.closest(".cart-btn[data-id]");
  if (cartBtn && !cartBtn.disabled) {
    const p = findProduct(cartBtn.dataset.id);
    // Products with sizes need a choice, so send the shopper to the product page
    if (p && p.sizes.length) {
      toast("Please choose a size first");
      setTimeout(() => (location.href = `product.html?id=${encodeURIComponent(p.id)}`), 700);
      return;
    }
    const r = await addToCart(cartBtn.dataset.id, 1, null);
    toast(r.ok ? `${p ? p.title : "Item"} added to cart` : r.message);
  }

  // Links that have no page yet
  const dead = e.target.closest('a[href="#"]');
  if (dead) {
    e.preventDefault();
    if (dead.classList.contains("nav-item") || dead.classList.contains("top-action")) toast("This page is coming soon");
  }
});

/* ---------- Mobile menu ---------- */
const menuBtn = document.getElementById("menu-btn");
const scrim = document.getElementById("scrim");
const sidebar = document.querySelector(".sidebar");
function setMenu(open) {
  if (!sidebar) return;
  sidebar.classList.toggle("open", open);
  if (scrim) scrim.classList.toggle("show", open);
}
if (menuBtn) menuBtn.addEventListener("click", () => setMenu(true));
if (scrim) scrim.addEventListener("click", () => setMenu(false));

/* ---------- Search: on other pages, Enter sends you to the shop results ---------- */
const searchInput = document.getElementById("search-input");
if (searchInput && document.body.dataset.page !== "home") {
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && searchInput.value.trim()) {
      location.href = "shop.html?q=" + encodeURIComponent(searchInput.value.trim());
    }
  });
}

updateBadges();
