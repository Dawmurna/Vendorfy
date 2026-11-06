// Cart page. Guests and customers both see their cart. Only customers can check out.
const root = document.getElementById("page-root");

const emptyCart = `
  <h1 class="page-title">Your cart</h1>
  <div class="empty-state">
    <h2>Your cart is empty</h2>
    <p>Find something you like and add it here.</p>
    <a class="btn btn-primary" href="shop.html">Start shopping</a>
  </div>`;

let valid = true;

async function render() {
  const lines = await getCartLines();
  if (!lines.length) { root.innerHTML = emptyCart; return; }

  const ids = [...new Set(lines.map((l) => l.id))];
  const products = await api("/products?ids=" + ids.join(","));
  const byId = Object.fromEntries(products.map((p) => [String(p.id), p]));

  // A product that was removed from the shop cannot stay in the cart
  for (const l of lines) if (!byId[l.id]) await setCartQty(l.id, l.size, 0);
  const shown = lines.filter((l) => byId[l.id]);
  if (!shown.length) { root.innerHTML = emptyCart; return; }

  valid = true;
  let subtotal = 0;
  const rows = shown.map((l) => {
    const p = byId[l.id];
    subtotal += p.price * l.qty;
    const soldOut = p.stock === 0;
    const tooMany = !soldOut && l.qty > p.stock;
    if (soldOut || tooMany) valid = false;
    return `
      <article class="line">
        <a class="lthumb" href="product.html?id=${esc(p.id)}">${p.image ? `<img src="${esc(p.image)}" alt="" onerror="this.style.display='none'" />` : ""}</a>
        <div>
          <h3><a href="product.html?id=${esc(p.id)}">${esc(p.title)}</a></h3>
          <div class="sub">${esc(p.vendor)}${l.size ? ` · Size ${esc(l.size)}` : ""}</div>
          <div class="sub">${formatPrice(p.price)} each</div>
          ${soldOut ? `<div class="warn">Sold out. Please remove this item.</div>` : ""}
          ${tooMany ? `<div class="warn">Only ${p.stock} left. Please lower the quantity.</div>` : ""}
        </div>
        <div class="line-right">
          <div class="stepper">
            <button data-act="minus" data-id="${esc(l.id)}" data-size="${esc(l.size || "")}" aria-label="Decrease quantity" ${l.qty <= 1 ? "disabled" : ""}>−</button>
            <output>${l.qty}</output>
            <button data-act="plus" data-id="${esc(l.id)}" data-size="${esc(l.size || "")}" data-stock="${p.stock}" aria-label="Increase quantity" ${l.qty >= p.stock ? "disabled" : ""}>+</button>
          </div>
          <div class="lp">${formatPrice(p.price * l.qty)}</div>
          <button class="remove-btn" data-act="remove" data-id="${esc(l.id)}" data-size="${esc(l.size || "")}">Remove</button>
        </div>
      </article>`;
  }).join("");

  const itemCount = shown.reduce((s, l) => s + l.qty, 0);
  root.innerHTML = `
    <h1 class="page-title">Your cart <span class="muted" style="font-weight:400;font-size:16px">(${itemCount} item${itemCount === 1 ? "" : "s"})</span></h1>
    ${isCustomer() ? "" : `<div class="guest-note">You can add items without an account. To place your order, log in or create a free account. Your cart will be saved to it.</div>`}
    <div class="cart-layout">
      <div class="cart-lines">${rows}</div>
      <aside class="summary">
        <h2>Order summary</h2>
        <div class="sum-row"><span>Subtotal</span><span>${formatPrice(subtotal)}</span></div>
        <div class="sum-row"><span>Delivery</span><span>Pay on delivery</span></div>
        <div class="sum-row total"><span>Total</span><span>${formatPrice(subtotal)}</span></div>
        <button class="btn btn-primary" id="checkout" ${valid ? "" : "disabled"}>${isCustomer() ? "Go to checkout" : "Log in to check out"}</button>
        <p class="fine">${valid ? "Delivery fees are agreed with the vendor when they contact you." : "Fix the items marked in red to continue."}</p>
      </aside>
    </div>`;
}

root.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-act]");
  if (btn) {
    const { act, id, size } = btn.dataset;
    const line = (await getCartLines()).find((l) => l.id === id && (l.size || "") === size);
    if (!line) return render();
    const wanted = act === "remove" ? 0 : act === "plus" ? line.qty + 1 : line.qty - 1;
    const r = await setCartQty(id, size || null, wanted);
    if (!r.ok) toast(r.message);
    return render();
  }

  if (e.target.closest("#checkout")) {
    if (isCustomer()) location.href = "checkout.html";
    else {
      toast("Create a free account or log in to place your order");
      setTimeout(() => goLogin("checkout.html"), 900);
    }
  }
});

sessionReady.then(render).catch(() => {
  root.innerHTML = `<div class="empty-state"><h2>Could not load your cart</h2><p>Please refresh the page.</p></div>`;
});
