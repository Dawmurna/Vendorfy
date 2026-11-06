// Small helpers used on every page.

// IMPORTANT: vendors type the product names, so text must be "escaped" before it goes into the page.
// Without this, a vendor could type <script> as a product name and run code in every shopper's browser.
function esc(value) {
  return String(value === null || value === undefined ? "" : value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// 25000 -> "₦25,000"
function formatPrice(n) {
  return "₦" + Number(n).toLocaleString("en-NG");
}

// Talks to the server. Throws an Error with a readable message if something goes wrong.
async function api(path, options = {}) {
  const res = await fetch("/api" + path, { credentials: "same-origin", ...options });
  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || "Something went wrong. Please try again.");
    err.status = res.status;
    throw err;
  }
  return data;
}

function apiJson(path, method, body) {
  return api(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/* ---------- Opened by double clicking the file? ---------- */
// The pages only work through the server. If someone opens the file directly (address starts with file:///),
// show a clear message instead of a page that silently fails.
if (location.protocol === "file:") {
  document.addEventListener("DOMContentLoaded", () => {
    const bar = document.createElement("div");
    bar.setAttribute("role", "alert");
    bar.style.cssText = "position:fixed;inset:0 0 auto 0;z-index:99999;background:#fff4e5;color:#7a3e00;" +
      "padding:14px 18px;font:600 15px/1.5 Nunito,Arial,sans-serif;border-bottom:2px solid #f5a623;text-align:center";
    bar.innerHTML = "This page is opened as a file, so it cannot log in or load products. " +
      "Start the server with <code>npm start</code>, then open <b>http://localhost:3000</b> in your browser.";
    document.body.prepend(bar);
  });
}

// If someone double-clicks an HTML file, the page has no server behind it. Say so clearly.
if (location.protocol === "file:") {
  document.addEventListener("DOMContentLoaded", () => {
    const bar = document.createElement("div");
    bar.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:99999;background:#b3261e;color:#fff;padding:12px 16px;font:600 15px Nunito,Arial,sans-serif;text-align:center";
    bar.innerHTML = 'This page was opened from a folder, so it cannot load products or log in. Start the server with <b>npm start</b>, then open <b>http://localhost:3000</b> in your browser.';
    document.body.prepend(bar);
  });
}
