// My orders: everything this customer has bought, with live status.
const root = document.getElementById("page-root");

const LABEL = { placed: "Order placed", shipped: "On the way", delivered: "Delivered", cancelled: "Cancelled" };
const placedId = (new URLSearchParams(location.search).get("placed") || "").replace(/\D/g, "");

function when(iso) {
  // The database gives "2026-11-02 12:00:00" in UTC
  const d = new Date(iso.replace(" ", "T") + "Z");
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) +
    ", " + d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
}

async function render() {
  const orders = await api("/me/orders");

  const banner = placedId && orders.some((o) => String(o.id) === placedId) ? `
    <div class="placed-banner">
      <b>Thank you! Your order #${esc(placedId)} has been placed.</b>
      The vendor will contact you to arrange delivery. You pay when it arrives.
    </div>` : "";

  if (!orders.length) {
    root.innerHTML = `
      <h1 class="page-title">My orders</h1>
      <div class="empty-state">
        <h2>No orders yet</h2>
        <p>When you place an order it will show up here.</p>
        <a class="btn btn-primary" href="shop.html">Start shopping</a>
      </div>`;
    return;
  }

  root.innerHTML = `
    <h1 class="page-title">My orders</h1>
    ${banner}
    ${orders.map((o) => `
      <article class="order-card ${String(o.id) === placedId ? "fresh" : ""}">
        <div class="order-head">
          <div><b>Order #${o.id}</b><small>${esc(when(o.createdAt))}</small></div>
          <span class="pill ${esc(o.status)}">${esc(LABEL[o.status])}</span>
        </div>
        ${o.items.map((i) => `
          <div class="order-item">
            <div class="oi-img">${i.image ? `<img src="${esc(i.image)}" alt="" onerror="this.style.display='none'" />` : ""}</div>
            <div>
              <div class="t">${i.productId ? `<a href="product.html?id=${i.productId}">${esc(i.title)}</a>` : esc(i.title)}</div>
              <div class="s">${i.size ? `Size ${esc(i.size)} · ` : ""}Qty ${i.qty} · ${formatPrice(i.price)} each</div>
            </div>
            <div><b>${formatPrice(i.price * i.qty)}</b></div>
            <span class="pill ${esc(i.status)}">${esc(LABEL[i.status])}</span>
          </div>`).join("")}
        <div class="order-foot">
          <div>Deliver to: ${esc(o.ship.name)}, ${esc(o.ship.address)}, ${esc(o.ship.city)}, ${esc(o.ship.state)} · ${esc(o.ship.phone)}<br />Payment: pay on delivery</div>
          <div style="text-align:right">
            <div>Total <b>${formatPrice(o.total)}</b></div>
            ${o.canCancel ? `<button class="link-danger" data-cancel="${o.id}">Cancel order</button>` : ""}
          </div>
        </div>
      </article>`).join("")}`;
}

root.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-cancel]");
  if (!btn || !confirm("Cancel this order? The items go back on sale.")) return;
  try {
    await apiJson(`/me/orders/${btn.dataset.cancel}/cancel`, "POST", {});
    toast("Order cancelled");
  } catch (err) {
    toast(err.message);
  }
  render();
});

(async () => {
  await requireCustomer();
  try { await render(); } catch (e) {
    root.innerHTML = `<div class="empty-state"><h2>Could not load your orders</h2><p>Please refresh the page.</p></div>`;
  }
})();
