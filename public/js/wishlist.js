// Wishlist page. Guests see what is saved in this browser, customers see what is saved on their account.
const root = document.getElementById("page-root");

async function render() {
  const ids = wishIds();
  if (!ids.length) {
    root.innerHTML = `
      <h1 class="page-title">Wishlist</h1>
      <div class="empty-state">
        <h2>Nothing saved yet</h2>
        <p>Tap the heart on any product to keep it here.</p>
        <a class="btn btn-primary" href="shop.html">Browse products</a>
      </div>`;
    return;
  }
  const products = await api("/products?ids=" + ids.join(","));
  root.innerHTML = `
    <h1 class="page-title">Wishlist <span class="muted" style="font-weight:400;font-size:16px">(${products.length})</span></h1>
    ${isCustomer() ? "" : `<div class="guest-note">These are saved in this browser. <a class="link-blue" href="login.html#signup">Create a free account</a> to keep them on every device.</div>`}
    <div class="wish-grid">${products.map(productCard).join("")}</div>`;
  updateBadges();
}

// Removing a heart takes the product off this page
root.addEventListener("click", (e) => {
  if (e.target.closest(".wish-btn")) setTimeout(render, 700);
});

sessionReady.then(render).catch(() => {
  root.innerHTML = `<div class="empty-state"><h2>Could not load your wishlist</h2><p>Please refresh the page.</p></div>`;
});
