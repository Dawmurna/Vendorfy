// Everything a logged-in CUSTOMER does: profile, saved cart, wishlist, checkout and orders.
// Prices are ALWAYS read from the database here. The browser is never trusted to say what something costs.
const express = require("express");
const { db } = require("../db");
const { requireCustomer } = require("../auth");
const { parseAddress, toId } = require("../validate");

const router = express.Router();
router.use(requireCustomer);

class UserError extends Error {}

/* ---------- Helpers ---------- */
const VISIBLE = `
  SELECT p.*, v.store_name FROM products p
  JOIN vendors v ON v.id = p.vendor_id
  WHERE v.status = 'approved'`;
const getVisible = (id) => db.prepare(`${VISIBLE} AND p.id = ?`).get(id);

const cartCount = (userId) =>
  db.prepare("SELECT COALESCE(SUM(qty), 0) AS n FROM cart_items WHERE user_id = ?").get(userId).n;

function toQty(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 99 ? n : null;
}

// Checks the size against what the product really offers
function checkSize(product, size) {
  const sizes = JSON.parse(product.sizes);
  const wanted = typeof size === "string" ? size : "";
  if (sizes.length === 0) return "";
  return sizes.includes(wanted) ? wanted : null;
}

/* ---------- Summary (used by the top bar on every page) ---------- */
router.get("/summary", (req, res) => {
  const wishlist = db.prepare("SELECT product_id FROM wishlist WHERE user_id = ?").all(req.user.id).map((r) => r.product_id);
  const orders = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE user_id = ?").get(req.user.id).n;
  res.json({ name: req.user.name, email: req.user.email, cartCount: cartCount(req.user.id), wishlist, ordersCount: orders });
});

/* ---------- Profile ---------- */
router.get("/profile", (req, res) => {
  const u = db.prepare("SELECT email, name, phone, address, city, state FROM users WHERE id = ?").get(req.user.id);
  res.json(u);
});

router.put("/profile", (req, res) => {
  const { error, value } = parseAddress(req.body, false);
  if (error) return res.status(400).json({ error });
  db.prepare("UPDATE users SET name = ?, phone = ?, address = ?, city = ?, state = ? WHERE id = ?")
    .run(value.name, value.phone, value.address, value.city, value.state, req.user.id);
  res.json({ ok: true });
});

/* ---------- Cart ---------- */
router.get("/cart", (req, res) => {
  const rows = db.prepare(`
    SELECT ci.product_id AS id, ci.size, ci.qty FROM cart_items ci
    JOIN products p ON p.id = ci.product_id
    JOIN vendors v ON v.id = p.vendor_id
    WHERE ci.user_id = ? AND v.status = 'approved'
    ORDER BY ci.rowid DESC`).all(req.user.id);
  res.json(rows.map((r) => ({ id: String(r.id), size: r.size || null, qty: r.qty })));
});

const upsertCart = (userId, productId, size, qty) =>
  db.prepare(`INSERT INTO cart_items (user_id, product_id, size, qty) VALUES (?, ?, ?, ?)
              ON CONFLICT (user_id, product_id, size) DO UPDATE SET qty = excluded.qty`)
    .run(userId, productId, size, qty);

router.post("/cart", (req, res) => {
  const id = toId(req.body.id);
  const qty = toQty(req.body.qty === undefined ? 1 : req.body.qty);
  const product = id === null ? null : getVisible(id);
  if (!product || qty === null) return res.status(404).json({ error: "Product not found." });
  if (product.stock === 0) return res.status(409).json({ error: "Sorry, this item is sold out." });

  const size = checkSize(product, req.body.size);
  if (size === null) return res.status(400).json({ error: "Please choose a size." });

  const existing = db.prepare("SELECT qty FROM cart_items WHERE user_id = ? AND product_id = ? AND size = ?")
    .get(req.user.id, id, size);
  const total = (existing ? existing.qty : 0) + qty;
  if (total > product.stock) {
    return res.status(409).json({
      error: existing ? `You already have ${existing.qty} in your cart. Only ${product.stock} available.` : `Only ${product.stock} available.`,
    });
  }
  upsertCart(req.user.id, id, size, total);
  res.json({ cartCount: cartCount(req.user.id) });
});

// Set an exact quantity. 0 removes the line.
router.put("/cart", (req, res) => {
  const id = toId(req.body.id);
  const size = typeof req.body.size === "string" ? req.body.size : "";
  const qty = Number(req.body.qty);
  if (id === null || !Number.isInteger(qty) || qty < 0 || qty > 99) return res.status(400).json({ error: "Invalid request." });

  if (qty === 0) {
    db.prepare("DELETE FROM cart_items WHERE user_id = ? AND product_id = ? AND size = ?").run(req.user.id, id, size);
    return res.json({ cartCount: cartCount(req.user.id) });
  }
  const product = getVisible(id);
  const line = db.prepare("SELECT 1 FROM cart_items WHERE user_id = ? AND product_id = ? AND size = ?").get(req.user.id, id, size);
  if (!product || !line) return res.status(404).json({ error: "That item is not in your cart." });
  if (qty > product.stock) return res.status(409).json({ error: `Only ${product.stock} available.` });
  upsertCart(req.user.id, id, size, qty);
  res.json({ cartCount: cartCount(req.user.id) });
});

// Called right after login: moves what the visitor saved as a guest into their account
router.post("/merge", (req, res) => {
  const cart = Array.isArray(req.body.cart) ? req.body.cart.slice(0, 50) : [];
  const wish = Array.isArray(req.body.wishlist) ? req.body.wishlist.slice(0, 100) : [];

  db.transaction(() => {
    for (const line of cart) {
      const id = toId(line && line.id);
      const qty = toQty(line && line.qty);
      const product = id === null || qty === null ? null : getVisible(id);
      if (!product || product.stock === 0) continue;
      const size = checkSize(product, line.size);
      if (size === null) continue;
      const existing = db.prepare("SELECT qty FROM cart_items WHERE user_id = ? AND product_id = ? AND size = ?")
        .get(req.user.id, id, size);
      upsertCart(req.user.id, id, size, Math.min((existing ? existing.qty : 0) + qty, product.stock));
    }
    for (const raw of wish) {
      const id = toId(raw);
      if (id !== null && getVisible(id)) {
        db.prepare("INSERT OR IGNORE INTO wishlist (user_id, product_id) VALUES (?, ?)").run(req.user.id, id);
      }
    }
  })();
  const ids = db.prepare("SELECT product_id FROM wishlist WHERE user_id = ?").all(req.user.id).map((r) => r.product_id);
  res.json({ cartCount: cartCount(req.user.id), wishlist: ids });
});

/* ---------- Wishlist ---------- */
router.post("/wishlist/toggle", (req, res) => {
  const id = toId(req.body.id);
  if (id === null) return res.status(400).json({ error: "Invalid request." });
  const has = db.prepare("SELECT 1 FROM wishlist WHERE user_id = ? AND product_id = ?").get(req.user.id, id);
  if (has) {
    db.prepare("DELETE FROM wishlist WHERE user_id = ? AND product_id = ?").run(req.user.id, id);
    return res.json({ added: false });
  }
  if (!getVisible(id)) return res.status(404).json({ error: "Product not found." });
  db.prepare("INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)").run(req.user.id, id);
  res.json({ added: true });
});

/* ---------- Checkout ---------- */
router.post("/orders", (req, res) => {
  const { error, value } = parseAddress(req.body, true);
  if (error) return res.status(400).json({ error });
  const note = typeof req.body.note === "string" ? req.body.note.trim().slice(0, 300) : "";

  const lines = db.prepare("SELECT product_id, size, qty FROM cart_items WHERE user_id = ?").all(req.user.id);
  if (lines.length === 0) return res.status(400).json({ error: "Your cart is empty." });
  if (lines.length > 30) return res.status(400).json({ error: "Please keep an order to 30 different items." });

  try {
    const orderId = db.transaction(() => {
      let total = 0;
      const items = [];

      for (const line of lines) {
        const p = getVisible(line.product_id);
        if (!p) throw new UserError("An item in your cart is no longer available. Please check your cart.");
        if (checkSize(p, line.size) === null) throw new UserError(`Please choose a size for "${p.title}".`);
        if (p.stock < line.qty) {
          throw new UserError(p.stock === 0
            ? `Sorry, "${p.title}" just sold out. Please remove it from your cart.`
            : `Only ${p.stock} of "${p.title}" left. Please update your cart.`);
        }
        // Take the stock now. The "stock >= qty" check means two buyers can never get the last item.
        const taken = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?").run(line.qty, p.id, line.qty);
        if (taken.changes !== 1) throw new UserError(`Sorry, "${p.title}" just sold out.`);
        total += p.price * line.qty;   // the price comes from the database, never from the browser
        items.push({ p, line });
      }

      const order = db.prepare(`
        INSERT INTO orders (user_id, total, ship_name, ship_phone, ship_address, ship_city, ship_state, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        req.user.id, total, value.name, value.phone, value.address, value.city, value.state, note);

      for (const { p, line } of items) {
        db.prepare(`INSERT INTO order_items (order_id, product_id, vendor_id, title, image, size, price, qty)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
          order.lastInsertRowid, p.id, p.vendor_id, p.title, JSON.parse(p.images)[0] || null, line.size, p.price, line.qty);
      }

      db.prepare("DELETE FROM cart_items WHERE user_id = ?").run(req.user.id);
      if (req.body.saveAddress) {
        db.prepare("UPDATE users SET name = ?, phone = ?, address = ?, city = ?, state = ? WHERE id = ?")
          .run(value.name, value.phone, value.address, value.city, value.state, req.user.id);
      }
      return order.lastInsertRowid;
    })();

    res.status(201).json({ id: orderId });
  } catch (e) {
    if (e instanceof UserError) return res.status(409).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: "Something went wrong. Your order was not placed." });
  }
});

/* ---------- Order history ---------- */
function overallStatus(items) {
  if (items.every((i) => i.status === "cancelled")) return "cancelled";
  const active = items.filter((i) => i.status !== "cancelled");
  if (active.every((i) => i.status === "delivered")) return "delivered";
  if (active.some((i) => i.status === "shipped" || i.status === "delivered")) return "shipped";
  return "placed";
}

router.get("/orders", (req, res) => {
  const orders = db.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 50").all(req.user.id);
  const itemsStmt = db.prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY id");
  res.json(orders.map((o) => {
    const items = itemsStmt.all(o.id).map((i) => ({
      id: i.id, productId: i.product_id, title: i.title, image: i.image, size: i.size || null,
      price: i.price, qty: i.qty, status: i.status,
    }));
    return {
      id: o.id, createdAt: o.created_at, total: o.total, paymentMethod: o.payment_method,
      status: overallStatus(items),
      canCancel: items.every((i) => i.status === "placed"),
      ship: { name: o.ship_name, phone: o.ship_phone, address: o.ship_address, city: o.ship_city, state: o.ship_state },
      note: o.note,
      items,
    };
  }));
});

router.post("/orders/:id/cancel", (req, res) => {
  const id = toId(req.params.id);
  // "user_id = me" means nobody can cancel someone else's order by guessing a number
  const order = id === null ? null : db.prepare("SELECT id FROM orders WHERE id = ? AND user_id = ?").get(id, req.user.id);
  if (!order) return res.status(404).json({ error: "Order not found." });

  const ok = db.transaction(() => {
    const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(id);
    if (!items.every((i) => i.status === "placed")) return false;
    for (const i of items) {
      db.prepare("UPDATE order_items SET status = 'cancelled' WHERE id = ?").run(i.id);
      if (i.product_id) db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").run(i.qty, i.product_id);
    }
    return true;
  })();

  if (!ok) return res.status(409).json({ error: "This order has already been shipped, so it cannot be cancelled here." });
  res.json({ ok: true });
});

module.exports = router;
