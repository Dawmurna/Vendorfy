// Vendor dashboard: add, edit (including price) and delete my own products.
const CATEGORIES = [
  "Fashion", "Beauty", "Electronics", "Home & Kitchen", "Babies & Kids",
  "Health & Wellness", "Sports & Outdoors", "Groceries",
];
const $ = (id) => document.getElementById(id);

const form = $("form");
const msg = $("msg");
let me = null;
let myProducts = [];
let editing = null;        // the product being edited, or null when adding
let keep = [];             // existing pictures to keep while editing
let newFiles = [];         // pictures chosen but not uploaded yet

$("category").innerHTML = CATEGORIES.map((c) => `<option>${esc(c)}</option>`).join("");

function show(text, type = "error") {
  msg.textContent = text;
  msg.className = "msg show " + type;
}

/* ---------- Start: who am I? ---------- */
async function start() {
  try {
    me = await api("/auth/me");
  } catch (e) {
    return (location.href = "vendor-login.html");
  }
  if (me.role === "admin") return (location.href = "admin.html");

  $("store-name").textContent = me.vendor.storeName;
  const status = $("status");
  status.textContent = me.vendor.status;
  status.className = "pill " + me.vendor.status;
  form.category.value = me.vendor.category;

  const notice = $("notice");
  if (me.vendor.status !== "approved") {
    notice.hidden = false;
    notice.textContent = me.vendor.status === "pending"
      ? "Your store is waiting for approval. You can add products as soon as it is approved."
      : "Your store has been suspended. Please contact Vendorfy support.";
    $("form-panel").hidden = true;
  }
  loadProducts();
  loadOrders();
}

async function loadProducts() {
  try {
    myProducts = await api("/vendor/products");
    renderList();
  } catch (e) {
    $("list").innerHTML = `<p class="muted">Could not load your products.</p>`;
  }
}

function renderList() {
  if (!myProducts.length) {
    $("list").innerHTML = `<p class="muted">You have not added any products yet.</p>`;
    return;
  }
  $("list").innerHTML = `
    <table class="plist">
      <thead><tr><th></th><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th></th></tr></thead>
      <tbody>
        ${myProducts.map((p) => `
          <tr>
            <td><div class="pimg">${p.image ? `<img src="${esc(p.image)}" alt="" />` : ""}</div></td>
            <td><b>${esc(p.title)}</b></td>
            <td>${esc(p.category)}</td>
            <td>${formatPrice(p.price)}${p.off ? `<span class="oldp">${formatPrice(p.oldPrice)}</span>` : ""}</td>
            <td>${p.stock}</td>
            <td><div class="actions">
              <button class="edit" data-edit="${p.id}">Edit</button>
              <button class="del" data-del="${p.id}">Delete</button>
            </div></td>
          </tr>`).join("")}
      </tbody>
    </table>`;
}

/* ---------- Picture previews ---------- */
function renderPreviews() {
  const old = keep.map((url, i) => `<div class="pv"><img src="${esc(url)}" alt="" /><button type="button" data-rm-old="${i}" aria-label="Remove picture">×</button></div>`);
  const fresh = newFiles.map((f, i) => `<div class="pv"><img src="${URL.createObjectURL(f)}" alt="" /><button type="button" data-rm-new="${i}" aria-label="Remove picture">×</button></div>`);
  $("previews").innerHTML = old.concat(fresh).join("");
}

$("images").addEventListener("change", (e) => {
  for (const f of e.target.files) newFiles.push(f);
  e.target.value = "";
  if (keep.length + newFiles.length > 5) {
    newFiles = newFiles.slice(0, 5 - keep.length);
    show("You can add up to 5 pictures.");
  }
  renderPreviews();
});

$("previews").addEventListener("click", (e) => {
  const oldBtn = e.target.closest("[data-rm-old]");
  const newBtn = e.target.closest("[data-rm-new]");
  if (oldBtn) keep.splice(Number(oldBtn.dataset.rmOld), 1);
  if (newBtn) newFiles.splice(Number(newBtn.dataset.rmNew), 1);
  renderPreviews();
});

/* ---------- Add / edit ---------- */
function resetForm() {
  editing = null;
  keep = [];
  newFiles = [];
  form.reset();
  form.category.value = me.vendor.category;
  form.stock.value = 1;
  $("form-title").textContent = "Add a product";
  $("save").textContent = "Add product";
  $("cancel").hidden = true;
  renderPreviews();
}

$("cancel").addEventListener("click", () => { resetForm(); msg.className = "msg"; });

$("list").addEventListener("click", async (e) => {
  const edit = e.target.closest("[data-edit]");
  const del = e.target.closest("[data-del]");

  if (edit) {
    const p = myProducts.find((x) => String(x.id) === edit.dataset.edit);
    if (!p) return;
    editing = p;
    keep = [...p.gallery];
    newFiles = [];
    form.title.value = p.title;
    form.price.value = p.price;
    form.oldPrice.value = p.off ? p.oldPrice : "";
    form.category.value = p.category;
    form.stock.value = p.stock;
    form.sizes.value = p.sizes.join(", ");
    form.description.value = p.desc;
    $("form-title").textContent = "Edit product";
    $("save").textContent = "Save changes";
    $("cancel").hidden = false;
    msg.className = "msg";
    renderPreviews();
    $("form-panel").scrollIntoView({ behavior: "smooth" });
  }

  if (del) {
    const p = myProducts.find((x) => String(x.id) === del.dataset.del);
    if (!p || !confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    try {
      await api("/vendor/products/" + p.id, { method: "DELETE" });
      if (editing && editing.id === p.id) resetForm();
      loadProducts();
    } catch (err) {
      alert(err.message);
    }
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.className = "msg";
  if (keep.length + newFiles.length < 1) return show("Add at least one picture.");

  const data = new FormData();
  for (const name of ["title", "price", "oldPrice", "category", "stock", "sizes", "description"]) {
    data.append(name, form[name].value);
  }
  newFiles.forEach((f) => data.append("images", f));
  if (editing) data.append("keepImages", JSON.stringify(keep));

  $("save").disabled = true;
  try {
    await api(editing ? "/vendor/products/" + editing.id : "/vendor/products", {
      method: editing ? "PUT" : "POST",
      body: data,
    });
    const wasEditing = Boolean(editing);
    resetForm();
    show(wasEditing ? "Changes saved. The new price is live on the shop." : "Product added. It is now live on the shop.", "ok");
    loadProducts();
  } catch (err) {
    show(err.message);
  }
  $("save").disabled = false;
});

$("logout").addEventListener("click", async () => {
  await apiJson("/auth/logout", "POST", {});
  location.href = "vendor-login.html";
});

start();

/* ---------- Orders for my products ---------- */
let myOrders = [];

async function loadOrders() {
  try {
    myOrders = await api("/vendor/orders");
    renderOrders();
  } catch (e) {
    $("orders").innerHTML = `<p class="muted">Could not load your orders.</p>`;
  }
}

function renderOrders() {
  if (!myOrders.length) {
    $("orders").innerHTML = `<p class="muted">No orders yet. When someone buys from you, it shows up here.</p>`;
    return;
  }
  const canAct = me.vendor.status === "approved";
  $("orders").innerHTML = myOrders.map((o) => {
    const buttons = !canAct ? "" :
      o.status === "placed"
        ? `<button data-id="${o.id}" data-to="shipped">Mark shipped</button><button data-id="${o.id}" data-to="cancelled">Cancel</button>`
        : o.status === "shipped"
          ? `<button data-id="${o.id}" data-to="delivered">Mark delivered</button>` : "";
    const where = [o.ship.address, o.ship.city, o.ship.state].filter(Boolean).join(", ");
    return `<div class="order-row">
      <div>
        <strong>${esc(o.title)}</strong>${o.size ? ` (size ${esc(o.size)})` : ""} x ${Number(o.qty)}
        <span class="pill ${esc(o.status)}">${esc(o.status)}</span>
        <div class="muted">${formatPrice(o.price * o.qty)} &middot; order #${Number(o.orderId)} &middot; ${esc(String(o.createdAt).slice(0, 10))}</div>
        <div class="muted">Deliver to ${esc(o.ship.name)}, ${esc(o.ship.phone)}<br>${esc(where)}${o.note ? `<br>Note: ${esc(o.note)}` : ""}</div>
      </div>
      <div class="actions">${buttons}</div>
    </div>`;
  }).join("");
}

$("orders").addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-id]");
  if (!b) return;
  if (b.dataset.to === "cancelled" && !confirm("Cancel this order item? The stock goes back on the shelf.")) return;
  b.disabled = true;
  try {
    await apiJson("/vendor/orders/" + b.dataset.id + "/status", "PUT", { status: b.dataset.to });
    await loadOrders();
    loadProducts();
  } catch (err) {
    alert(err.message || "Could not update that order.");
    b.disabled = false;
  }
});
