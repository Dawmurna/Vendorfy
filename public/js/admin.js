// Admin page: approve or suspend vendors.
const list = document.getElementById("list");

async function start() {
  try {
    const me = await api("/auth/me");
    if (me.role !== "admin") return (location.href = "vendor.html");
  } catch (e) {
    return (location.href = "vendor-login.html");
  }
  load();
}

async function load() {
  try {
    const vendors = await api("/admin/vendors");
    if (!vendors.length) {
      list.innerHTML = `<p class="muted">No vendors have signed up yet.</p>`;
      return;
    }
    list.innerHTML = `
      <table class="plist">
        <thead><tr><th>Store</th><th>Email</th><th>Category</th><th>Items</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${vendors.map((v) => `
            <tr>
              <td><b>${esc(v.storeName)}</b></td>
              <td>${esc(v.email)}</td>
              <td>${esc(v.category)}</td>
              <td>${v.products}</td>
              <td><span class="pill ${esc(v.status)}">${esc(v.status)}</span></td>
              <td><div class="actions">
                ${v.status !== "approved" ? `<button class="edit" data-id="${v.id}" data-status="approved">Approve</button>` : ""}
                ${v.status !== "suspended" ? `<button class="del" data-id="${v.id}" data-status="suspended">Suspend</button>` : ""}
              </div></td>
            </tr>`).join("")}
        </tbody>
      </table>`;
  } catch (e) {
    list.innerHTML = `<p class="muted">Could not load vendors.</p>`;
  }
}

list.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-id]");
  if (!btn) return;
  try {
    await apiJson(`/admin/vendors/${btn.dataset.id}/status`, "POST", { status: btn.dataset.status });
    load();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById("logout").addEventListener("click", async () => {
  await apiJson("/auth/logout", "POST", {});
  location.href = "vendor-login.html";
});

start();
