// Product page: reads ?id=... from the address, asks the server for that product and fills the page.
// Needs js/utils.js, js/main.js loaded first.

const root = document.getElementById("product-root");
const id = new URLSearchParams(location.search).get("id");

function notFound(message) {
  root.innerHTML = `
    <div class="not-found">
      <h1>${esc(message)}</h1>
      <p style="margin-bottom:16px;color:var(--text-muted)">It may have been removed or the link is wrong.</p>
      <a class="btn btn-primary" href="shop.html">Back to Home</a>
    </div>`;
}

async function start() {
  if (!id || !/^\d+$/.test(id)) return notFound("We could not find that product");
  root.innerHTML = `<p class="empty-note">Loading...</p>`;
  try {
    const p = await api("/products/" + id);
    let others = [];
    try { others = await api("/products?limit=12"); } catch (e) { /* related items are optional */ }
    buildPage(p, others);
  } catch (e) {
    notFound(e.status === 404 ? "We could not find that product" : "We could not load this product");
  }
}
start();

function buildPage(p, others) {
  document.title = `${p.title} | Vendorfy`;
  productCache[String(p.id)] = p;

  // What the shopper has chosen so far
  let size = p.sizes.length ? p.sizes[1] || p.sizes[0] : null; // starts on the second size, like "M" in the design
  let qty = 1;
  let imgIndex = 0;
  const soldOut = p.stock === 0;

  const related = [
    ...others.filter((x) => x.id !== p.id && x.category === p.category),
    ...others.filter((x) => x.id !== p.id && x.category !== p.category),
  ].slice(0, 5);

  root.innerHTML = `
    <nav class="crumbs">
      <a href="shop.html">Home</a><span>›</span>
      <a href="shop.html">${esc(p.category)}</a><span>›</span>
      <span>${esc(p.title)}</span>
    </nav>

    <section class="product-top">
      <div class="gallery">
        <div class="thumbs" id="thumbs"></div>
        <div class="gallery-main" id="main-img">
          <img id="big-img" alt="${esc(p.title)}" onerror="this.style.display='none'" />
          <button class="arrow prev" id="prev" aria-label="Previous image"><svg class="icon"><use href="#i-chevron"/></svg></button>
          <button class="arrow next" id="next" aria-label="Next image"><svg class="icon"><use href="#i-chevron"/></svg></button>
          <button class="expand" id="expand" aria-label="View larger"><svg class="icon"><use href="#i-expand"/></svg></button>
        </div>
      </div>

      <div class="info">
        <div class="vendor-line">${esc(p.vendor)} <svg class="icon verified" style="width:16px;height:16px"><use href="#i-check"/></svg></div>
        <h1>${esc(p.title)}</h1>
        <div class="meta-row">
          <span>New on Vendorfy</span><span class="sep"></span>
          <span>${esc(p.category)}</span>
        </div>
        <div class="price-row">
          <span class="price-big">${formatPrice(p.price)}</span>
          ${p.off ? `<span class="old-price">${formatPrice(p.oldPrice)}</span><span class="off-pill">${p.off}% OFF</span>` : ""}
        </div>
        ${p.desc ? `<p class="short-desc">${esc(p.desc)}</p>` : ""}

        ${p.sizes.length ? `
        <div class="opt">
          <div class="opt-label"><span>Size:</span></div>
          <div class="sizes" id="sizes">
            ${p.sizes.map((s) => `<button class="size-btn ${s === size ? "active" : ""}" data-size="${esc(s)}">${esc(s)}</button>`).join("")}
          </div>
        </div>` : ""}

        <div class="opt">
          <div class="qty-row">
            <span class="opt-label" style="margin:0">Quantity:</span>
            <div class="qty">
              <button id="minus" aria-label="Decrease quantity">−</button>
              <output id="qty">1</output>
              <button class="plus" id="plus" aria-label="Increase quantity">+</button>
            </div>
            <div class="stock ${soldOut ? "out" : p.stock <= 5 ? "low" : ""}">
              <div><strong>${soldOut ? "Out of stock" : "In Stock"}</strong>${!soldOut && p.stock <= 5 ? `<small>Only ${p.stock} item${p.stock === 1 ? "" : "s"} left</small>` : ""}</div>
            </div>
          </div>
        </div>

        <div class="buy-row">
          <button class="btn btn-primary" id="add-cart" ${soldOut ? "disabled" : ""}><svg class="icon"><use href="#i-cart"/></svg>Add to Cart</button>
          <button class="btn btn-soft" id="buy-now" ${soldOut ? "disabled" : ""}>Buy Now</button>
          <button class="heart-btn" id="wish-page" aria-label="Save to wishlist"><svg class="icon"><use href="#i-heart"/></svg></button>
        </div>
      </div>
    </section>

    <div class="tabs" id="tabs">
      <button class="tab-btn active" data-tab="desc">Description</button>
      <button class="tab-btn" data-tab="reviews">Reviews</button>
      <button class="tab-btn" data-tab="ship">Shipping &amp; Returns</button>
    </div>

    <div class="tab-panel active" id="tab-desc">
      <h2>Description</h2>
      <p class="pre">${esc(p.desc || "The vendor has not added a description yet.")}</p>
      <div class="details-grid">
        <div>
          <h3>Product Details</h3>
          <ul>
            <li><b>Vendor:</b> ${esc(p.vendor)}</li>
            <li><b>Category:</b> ${esc(p.category)}</li>
            ${p.sizes.length ? `<li><b>Available sizes:</b> ${p.sizes.map(esc).join(", ")}</li>` : ""}
          </ul>
        </div>
        <div>
          <h3>Additional Information</h3>
          <ul>
            <li><b>Delivery:</b> Lagos &amp; beyond</li>
            <li><b>Returns:</b> Within 7 days</li>
          </ul>
        </div>
      </div>
    </div>

    <div class="tab-panel" id="tab-reviews">
      <h2>Reviews</h2>
      <p>No reviews yet. Reviews from shoppers who bought this item will show here.</p>
    </div>

    <div class="tab-panel" id="tab-ship">
      <h2>Shipping &amp; Returns</h2>
      <p>Orders in Lagos usually arrive in 1 to 3 working days. Other states take 3 to 7 working days. If something is not right, you can return it within 7 days as long as it is unused and in its original packaging.</p>
    </div>

    <section class="sold-by">
      <h3>Sold by</h3>
      <div class="seller">
        <div class="logo-circle"></div>
        <div>
          <b>${esc(p.vendorInfo.name)} <svg class="icon verified" style="width:14px;height:14px"><use href="#i-check"/></svg></b>
          <small>Verified vendor · ${esc(p.vendorInfo.category)}</small>
        </div>
      </div>
      <button class="btn btn-outline" id="view-store">View Store</button>
      <div class="stat"><b>${p.vendorInfo.productCount}</b><small>Product${p.vendorInfo.productCount === 1 ? "" : "s"}</small></div>
    </section>

    ${related.length ? `
    <section class="related">
      <h2>You may also like</h2>
      <div class="product-grid" style="margin-top:0">${related.map(productCard).join("")}</div>
    </section>` : ""}
  `;

  /* ---------- Gallery ---------- */
  const thumbs = document.getElementById("thumbs");
  const bigImg = document.getElementById("big-img");
  const gallery = p.gallery;
  const many = gallery.length > 1;

  thumbs.innerHTML = gallery.map((g, i) =>
    `<button class="${i === 0 ? "active" : ""}" data-i="${i}"><img src="${esc(g)}" alt="" onerror="this.style.display='none'" /></button>`
  ).join("");
  document.getElementById("prev").hidden = !many;
  document.getElementById("next").hidden = !many;

  function showImage(i) {
    if (!gallery.length) return;
    imgIndex = (i + gallery.length) % gallery.length;
    bigImg.style.display = "";
    bigImg.src = gallery[imgIndex];
    thumbs.querySelectorAll("button").forEach((b, n) => b.classList.toggle("active", n === imgIndex));
  }
  showImage(0);

  thumbs.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-i]");
    if (b) showImage(Number(b.dataset.i));
  });
  document.getElementById("prev").addEventListener("click", () => showImage(imgIndex - 1));
  document.getElementById("next").addEventListener("click", () => showImage(imgIndex + 1));

  const box = document.getElementById("lightbox");
  document.getElementById("expand").addEventListener("click", () => {
    box.querySelector("img").src = bigImg.src;
    box.classList.add("show");
  });
  box.addEventListener("click", () => box.classList.remove("show"));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") box.classList.remove("show"); });

  /* ---------- Options ---------- */
  const sz = document.getElementById("sizes");
  if (sz) sz.addEventListener("click", (e) => {
    const b = e.target.closest(".size-btn");
    if (!b) return;
    sz.querySelectorAll(".size-btn").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    size = b.dataset.size;
  });

  /* ---------- Quantity ---------- */
  const qtyEl = document.getElementById("qty");
  const minus = document.getElementById("minus");
  const plus = document.getElementById("plus");
  function setQty(n) {
    qty = Math.min(Math.max(n, 1), Math.max(p.stock, 1));
    qtyEl.textContent = qty;
    minus.disabled = qty <= 1;
    plus.disabled = qty >= p.stock;
  }
  minus.addEventListener("click", () => setQty(qty - 1));
  plus.addEventListener("click", () => setQty(qty + 1));
  setQty(1);

  /* ---------- Buttons ---------- */
  document.getElementById("add-cart").addEventListener("click", async () => {
    const r = await addToCart(p.id, qty, size);
    toast(r.ok ? `${qty} × ${p.title} added to cart` : r.message);
  });

  // Buying needs an account. Guests are sent to log in or sign up, then come straight back to checkout.
  document.getElementById("buy-now").addEventListener("click", async () => {
    const r = await addToCart(p.id, qty, size);
    if (!r.ok) return toast(r.message);
    await sessionReady;
    if (isCustomer()) {
      location.href = "checkout.html";
    } else {
      toast("Create a free account or log in to place your order");
      setTimeout(() => goLogin("checkout.html"), 1200);
    }
  });

  const wishBtn = document.getElementById("wish-page");
  const syncWish = () => wishBtn.classList.toggle("liked", wishIds().includes(String(p.id)));
  wishBtn.addEventListener("click", async () => {
    try {
      const added = await toggleWish(p.id);
      syncWish();
      toast(added ? "Saved to your wishlist" : "Removed from wishlist");
    } catch (err) { toast(err.message); }
  });
  syncWish();
  sessionReady.then(syncWish);

  document.getElementById("view-store").addEventListener("click", () => toast("Vendor stores are coming soon"));

  /* ---------- Tabs ---------- */
  document.getElementById("tabs").addEventListener("click", (e) => {
    const b = e.target.closest(".tab-btn");
    if (!b) return;
    document.querySelectorAll(".tab-btn").forEach((x) => x.classList.toggle("active", x === b));
    document.querySelectorAll(".tab-panel").forEach((x) => x.classList.toggle("active", x.id === "tab-" + b.dataset.tab));
  });

  sessionReady.then(updateBadges);
}
