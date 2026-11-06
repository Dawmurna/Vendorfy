// Checkout. Needs an account. The server works out the real total from its own prices.
const root = document.getElementById("page-root");

(async function () {
  await requireCustomer();

  const [profile, lines] = await Promise.all([api("/me/profile"), getCartLines()]);
  if (!lines.length) { location.href = "cart.html"; return; }

  const products = await api("/products?ids=" + [...new Set(lines.map((l) => l.id))].join(","));
  const byId = Object.fromEntries(products.map((p) => [String(p.id), p]));
  const items = lines.filter((l) => byId[l.id]);
  if (!items.length) { location.href = "cart.html"; return; }

  const subtotal = items.reduce((s, l) => s + byId[l.id].price * l.qty, 0);
  const problem = items.find((l) => byId[l.id].stock < l.qty);

  const summaryRows = items.map((l) => `
    <div class="sum-item"><span>${esc(byId[l.id].title)}${l.size ? ` (${esc(l.size)})` : ""} × ${l.qty}</span><span>${formatPrice(byId[l.id].price * l.qty)}</span></div>`).join("");

  root.innerHTML = `
    <h1 class="page-title">Checkout</h1>
    <form id="form" novalidate>
      <div class="checkout-layout">
        <div>
          <section class="panel">
            <h2>Delivery details</h2>
            <div class="form-grid">
              <label class="field full">Full name
                <input name="name" maxlength="60" autocomplete="name" value="${esc(profile.name || "")}" required />
              </label>
              <label class="field">Phone number
                <input name="phone" type="tel" autocomplete="tel" placeholder="0803 123 4567" value="${esc(profile.phone || "")}" required />
              </label>
              <label class="field">State
                <select name="state" autocomplete="address-level1" required>
                  <option value="">Choose your state</option>
                  ${NIGERIAN_STATES.map((s) => `<option ${s === profile.state ? "selected" : ""}>${esc(s)}</option>`).join("")}
                </select>
              </label>
              <label class="field">City or town
                <input name="city" maxlength="60" autocomplete="address-level2" value="${esc(profile.city || "")}" required />
              </label>
              <label class="field">Street address
                <input name="address" maxlength="160" autocomplete="street-address" placeholder="House number, street, area" value="${esc(profile.address || "")}" required />
              </label>
              <label class="field full">Note for the vendor <span class="hint">(optional)</span>
                <textarea name="note" maxlength="300" placeholder="Landmark, preferred delivery time, etc."></textarea>
              </label>
            </div>
            <label class="check"><input type="checkbox" name="saveAddress" checked /> Save these details to my account for next time</label>
          </section>

          <section class="panel">
            <h2>Payment</h2>
            <div class="pay-option">
              <input type="radio" checked disabled aria-label="Pay on delivery" />
              <div><b>Pay on delivery</b><small>Pay the vendor when your order arrives. Online card payment is coming soon.</small></div>
            </div>
          </section>
        </div>

        <aside class="summary">
          <h2>Your order</h2>
          ${summaryRows}
          <div class="sum-row total"><span>Total</span><span>${formatPrice(subtotal)}</span></div>
          <div class="msg ${problem ? "show error" : ""}" id="msg">${problem ? "Some items are low in stock. Please check your cart." : ""}</div>
          <button class="btn btn-primary" id="place" ${problem ? "disabled" : ""}>Place order</button>
          <p class="fine">Signed in as ${esc(currentUser.email)}. You can cancel an order from My orders until the vendor ships it.</p>
        </aside>
      </div>
    </form>`;

  const form = document.getElementById("form");
  const msg = document.getElementById("msg");
  const place = document.getElementById("place");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.className = "msg";
    place.disabled = true;
    place.textContent = "Placing your order...";
    try {
      // Note what is NOT sent: no prices and no totals. The server decides those.
      const r = await apiJson("/me/orders", "POST", {
        name: form.name.value, phone: form.phone.value, state: form.state.value,
        city: form.city.value, address: form.address.value, note: form.note.value,
        saveAddress: form.saveAddress.checked,
      });
      serverCartCount = 0;
      location.href = "orders.html?placed=" + r.id;
    } catch (err) {
      msg.textContent = err.message;
      msg.className = "msg show error";
      place.disabled = false;
      place.textContent = "Place order";
    }
  });
})();
