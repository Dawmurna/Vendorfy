// Home page only: loads products from the server, then builds the sections,
// banner slider, category filter, search and countdown.
// Needs js/utils.js, js/data.js and js/main.js loaded first.

const icon = (name) => `<svg class="icon"><use href="#i-${name}"/></svg>`;
const $ = (id) => document.getElementById(id);

/* ---------- State ---------- */
let products = [];        // everything from the server, newest first
let loadError = false;
let activeCategory = "All";
let searchText = "";

/* ---------- Product sections ---------- */
function matches(p) {
  const inCategory = activeCategory === "All" || p.category === activeCategory;
  const q = searchText.toLowerCase();
  const inSearch = !q || p.title.toLowerCase().includes(q) || p.vendor.toLowerCase().includes(q);
  return inCategory && inSearch;
}

function renderGrid(id, list, emptyText) {
  const shown = list.filter(matches);
  $(id).innerHTML = shown.length
    ? shown.map(productCard).join("")
    : `<p class="empty-note">${loadError ? "We could not load products. Please refresh the page." : emptyText}</p>`;
}

function renderProducts() {
  const none = "No products here yet. Vendors are adding new items every day.";
  renderGrid("discount-grid", products.filter((p) => p.off > 0), "No discounts right now.");
  renderGrid("arrivals-grid", products.slice(0, 5), none);
  renderGrid("all-grid", products, none);
  updateBadges(); // re-apply the heart state on new cards
}

/* ---------- Vendors ---------- */
function renderVendors(list) {
  $("vendor-grid").innerHTML = list.length ? list.map((v) => `
    <article class="vendor-card">
      <div class="thumb"></div>
      <div class="vendor-logo"></div>
      <h3 class="name">${esc(v.name)} <svg class="icon verified" style="width:13px;height:13px"><use href="#i-check"/></svg></h3>
      <p class="cat">${esc(v.category)} · ${v.products} item${v.products === 1 ? "" : "s"}</p>
      <button class="btn btn-outline follow-btn">Follow</button>
    </article>`).join("")
    : `<p class="empty-note">No vendors yet. <a class="link-blue" href="vendor-login.html">Become the first one</a>.</p>`;
}

$("vendor-grid").addEventListener("click", (e) => {
  const btn = e.target.closest(".follow-btn");
  if (!btn) return;
  const following = btn.classList.toggle("following");
  btn.textContent = following ? "Following" : "Follow";
});

/* ---------- Category tiles ---------- */
$("category-row").innerHTML = categories.map((c, i) =>
  `<button class="category-tile ${i === 0 ? "active" : ""}" data-cat="${c.name}">${icon(c.icon)}${c.name}</button>`
).join("");

$("category-row").addEventListener("click", (e) => {
  const tile = e.target.closest(".category-tile");
  if (!tile) return;
  document.querySelectorAll(".category-tile").forEach((t) => t.classList.remove("active"));
  tile.classList.add("active");
  activeCategory = tile.dataset.cat === "More" ? "All" : tile.dataset.cat;
  renderProducts();
});

// A link like shop.html?cat=Fashion opens with that category selected
const startCat = new URLSearchParams(location.search).get("cat");
if (startCat && categories.some((c) => c.name === startCat)) {
  document.querySelectorAll(".category-tile").forEach((t) => t.classList.toggle("active", t.dataset.cat === startCat));
  activeCategory = startCat;
}

// The sidebar category links do the same thing
document.querySelectorAll(".nav-item.small").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const name = link.textContent.trim();
    const tile = [...document.querySelectorAll(".category-tile")].find((t) => t.dataset.cat === name || (name === "More Categories" && t.dataset.cat === "More"));
    if (tile) tile.click();
    $("category-row").scrollIntoView({ behavior: "smooth", block: "center" });
  });
});

/* ---------- Search (live, as you type) ---------- */
const input = $("search-input");
input.addEventListener("input", () => {
  searchText = input.value.trim();
  renderProducts();
});
const startQuery = new URLSearchParams(location.search).get("q");
if (startQuery) {
  input.value = startQuery;
  searchText = startQuery;
}

/* ---------- Banner slider ---------- */
let slide = 0;
let slideTimer;
const dotsBox = $("banner-dots");
dotsBox.innerHTML = slideData.map((_, i) => `<span class="${i === 0 ? "active" : ""}" data-i="${i}"></span>`).join("");

function showSlide(i) {
  slide = i;
  const s = slideData[i];
  const text = document.querySelector(".banner-text");
  text.classList.add("swap");
  setTimeout(() => {
    $("banner-tag").textContent = s.tag;
    $("banner-title").innerHTML = s.title;
    $("banner-sub").textContent = s.sub;
    // give a slide its own picture with img: "images/banners/other.jpg" in slideData
    if (s.img) $("banner-img").src = s.img;
    text.classList.remove("swap");
  }, 250);
  dotsBox.querySelectorAll("span").forEach((d, n) => d.classList.toggle("active", n === i));
}
function startSlider() {
  clearInterval(slideTimer);
  slideTimer = setInterval(() => showSlide((slide + 1) % slideData.length), 5000);
}
dotsBox.addEventListener("click", (e) => {
  const dot = e.target.closest("span[data-i]");
  if (!dot) return;
  showSlide(Number(dot.dataset.i));
  startSlider();
});
startSlider();

/* ---------- Countdown for Discount Sales ---------- */
const START = 2 * 3600 + 45 * 60 + 18;
let seconds = START;
const pad = (n) => String(n).padStart(2, "0");
function tick() {
  if (seconds <= 0) seconds = START; // starts over so the sale never looks dead
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  $("timer").textContent = `${pad(h)} : ${pad(m)} : ${pad(seconds % 60)}`;
  seconds--;
}
tick();
setInterval(tick, 1000);

/* ---------- Load everything from the server ---------- */
async function init() {
  ["discount-grid", "arrivals-grid", "all-grid"].forEach((id) => {
    $(id).innerHTML = `<p class="empty-note">Loading...</p>`;
  });
  try {
    const [p, v] = await Promise.all([api("/products"), api("/vendors")]);
    products = p;
    renderVendors(v);
  } catch (e) {
    loadError = true;
    renderVendors([]);
  }
  renderProducts();
}
init();
