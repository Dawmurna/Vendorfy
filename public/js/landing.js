// Landing page: category links, the newest products, and a login-aware top bar.
const chips = document.getElementById("chips");
chips.innerHTML = categories
  .filter((c) => c.name !== "All" && c.name !== "More")
  .map((c) => `<a href="shop.html?cat=${encodeURIComponent(c.name)}">${esc(c.name)}</a>`)
  .join("");

// Newest products from real vendors (the section stays hidden until there are some)
api("/products?limit=5").then((list) => {
  if (!list.length) return;
  document.getElementById("fresh-section").hidden = false;
  document.getElementById("fresh").innerHTML = list.map(productCard).join("");
  updateBadges();
}).catch(() => {});

// Logged-in visitors do not need the Sign up links
sessionReady.then(() => {
  if (currentUser) {
    document.getElementById("signup-link").hidden = true;
    document.getElementById("hero-signup").textContent = isCustomer() ? "My orders" : "Open my dashboard";
    document.getElementById("hero-signup").href = isCustomer() ? "orders.html" : currentUser.role === "admin" ? "admin.html" : "vendor.html";
  }
});
