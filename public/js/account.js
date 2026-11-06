// My account: delivery details and a quick look at what is saved.
const root = document.getElementById("page-root");

(async function () {
  await requireCustomer();
  const [profile, summary] = await Promise.all([api("/me/profile"), api("/me/summary")]);

  root.innerHTML = `
    <h1 class="page-title">My account</h1>
    <div class="account-grid">
      <section class="panel">
        <h2>Your details</h2>
        <p class="muted" style="margin-bottom:14px">These fill in automatically at checkout.</p>
        <form id="form" novalidate>
          <div class="form-grid">
            <label class="field full">Email <span class="hint">(this is how you log in)</span>
              <input value="${esc(profile.email)}" disabled />
            </label>
            <label class="field full">Full name
              <input name="name" maxlength="60" autocomplete="name" value="${esc(profile.name || "")}" />
            </label>
            <label class="field">Phone number
              <input name="phone" type="tel" autocomplete="tel" placeholder="0803 123 4567" value="${esc(profile.phone || "")}" />
            </label>
            <label class="field">State
              <select name="state">
                <option value="">Choose your state</option>
                ${NIGERIAN_STATES.map((s) => `<option ${s === profile.state ? "selected" : ""}>${esc(s)}</option>`).join("")}
              </select>
            </label>
            <label class="field">City or town
              <input name="city" maxlength="60" value="${esc(profile.city || "")}" />
            </label>
            <label class="field">Street address
              <input name="address" maxlength="160" value="${esc(profile.address || "")}" />
            </label>
          </div>
          <div class="msg" id="msg"></div>
          <div class="form-actions">
            <button class="btn btn-primary" id="save">Save changes</button>
            <button type="button" class="btn btn-plain" id="logout">Log out</button>
          </div>
        </form>
      </section>

      <aside class="stat-cards">
        <a class="stat-card" href="orders.html"><b>${summary.ordersCount}</b><span>Orders</span></a>
        <a class="stat-card" href="cart.html"><b>${summary.cartCount}</b><span>Items in your cart</span></a>
        <a class="stat-card" href="wishlist.html"><b>${summary.wishlist.length}</b><span>Saved in your wishlist</span></a>
      </aside>
    </div>`;

  const form = document.getElementById("form");
  const msg = document.getElementById("msg");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.className = "msg";
    try {
      await apiJson("/me/profile", "PUT", {
        name: form.name.value, phone: form.phone.value, state: form.state.value,
        city: form.city.value, address: form.address.value,
      });
      msg.textContent = "Saved.";
      msg.className = "msg show ok";
      currentUser.name = form.name.value.trim() || currentUser.name;
      renderProfile();
    } catch (err) {
      msg.textContent = err.message;
      msg.className = "msg show error";
    }
  });

  document.getElementById("logout").addEventListener("click", async () => {
    try { await apiJson("/auth/logout", "POST", {}); } catch (e) { /* ignore */ }
    location.href = "shop.html";
  });
})();
