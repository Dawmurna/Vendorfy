// Routes for a logged-in vendor to manage THEIR OWN products and prices.
// Every query includes "vendor_id = the logged-in vendor", so a vendor can never touch another vendor's products.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const multer = require("multer");
const { db } = require("../db");
const { requireVendor, requireApprovedVendor } = require("../auth");
const { parseProduct, toId } = require("../validate");
const { serializeProduct } = require("./shop");

const router = express.Router();
router.use(requireVendor);

/* ---------- Image uploads ---------- */
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");
const EXT = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const SAFE_NAME = /^[a-f0-9]{32}\.(jpg|png|webp)$/;

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    // Random file name, so a vendor cannot choose a name or overwrite someone else's picture
    filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString("hex") + EXT[file.mimetype]),
  }),
  limits: { fileSize: 3 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => cb(null, Boolean(EXT[file.mimetype])),
});

// The browser can lie about the file type, so check the first bytes of the real file too
function looksLikeImage(file) {
  const buf = Buffer.alloc(12);
  const fd = fs.openSync(file.path, "r");
  fs.readSync(fd, buf, 0, 12, 0);
  fs.closeSync(fd);
  const jpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const png = buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP";
  return jpg || png || webp;
}

function removeFiles(urls) {
  for (const url of urls) {
    const name = path.basename(url);
    if (url.startsWith("/uploads/") && SAFE_NAME.test(name)) {
      fs.promises.unlink(path.join(UPLOAD_DIR, name)).catch(() => {});
    }
  }
}

function handleUpload(req, res, next) {
  upload.array("images", 5)(req, res, (err) => {
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE" ? "Each picture must be under 3 MB."
        : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE" ? "You can upload up to 5 pictures."
        : "Upload failed.";
      return res.status(400).json({ error: msg });
    }
    const files = req.files || [];
    if (files.some((f) => !looksLikeImage(f))) {
      removeFiles(files.map((f) => "/uploads/" + f.filename));
      return res.status(400).json({ error: "Only real JPG, PNG or WEBP pictures are allowed." });
    }
    next();
  });
}

const uploadedUrls = (req) => (req.files || []).map((f) => "/uploads/" + f.filename);

/* ---------- List my products ---------- */
router.get("/products", (req, res) => {
  const rows = db.prepare(`
    SELECT p.*, v.store_name FROM products p JOIN vendors v ON v.id = p.vendor_id
    WHERE p.vendor_id = ? ORDER BY p.id DESC`).all(req.vendor.id);
  res.json(rows.map(serializeProduct));
});

/* ---------- Add a product ---------- */
router.post("/products", requireApprovedVendor, handleUpload, (req, res) => {
  const { error, value } = parseProduct(req.body);
  const urls = uploadedUrls(req);
  if (error || urls.length === 0) {
    removeFiles(urls);
    return res.status(400).json({ error: error || "Add at least one picture." });
  }

  const info = db.prepare(`
    INSERT INTO products (vendor_id, title, description, price, old_price, category, stock, sizes, images)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    req.vendor.id, value.title, value.description, value.price, value.oldPrice,
    value.category, value.stock, JSON.stringify(value.sizes), JSON.stringify(urls));

  const row = db.prepare("SELECT p.*, v.store_name FROM products p JOIN vendors v ON v.id = p.vendor_id WHERE p.id = ?")
    .get(info.lastInsertRowid);
  res.status(201).json(serializeProduct(row));
});

/* ---------- Edit a product (this is how a vendor changes a price) ---------- */
router.put("/products/:id", requireApprovedVendor, handleUpload, (req, res) => {
  const id = toId(req.params.id);
  const existing = id !== null
    ? db.prepare("SELECT * FROM products WHERE id = ? AND vendor_id = ?").get(id, req.vendor.id)
    : null;
  const newUrls = uploadedUrls(req);
  if (!existing) {
    removeFiles(newUrls);
    return res.status(404).json({ error: "Product not found." });
  }

  const { error, value } = parseProduct(req.body);
  if (error) {
    removeFiles(newUrls);
    return res.status(400).json({ error });
  }

  // Which of the current pictures to keep (must be pictures this product really has)
  const current = JSON.parse(existing.images);
  let keep = current;
  if (req.body.keepImages !== undefined) {
    try {
      const asked = JSON.parse(req.body.keepImages);
      keep = Array.isArray(asked) ? current.filter((u) => asked.includes(u)) : current;
    } catch (e) { keep = current; }
  }
  const images = [...keep, ...newUrls];
  if (images.length < 1 || images.length > 5) {
    removeFiles(newUrls);
    return res.status(400).json({ error: "A product needs 1 to 5 pictures." });
  }

  db.prepare(`
    UPDATE products SET title = ?, description = ?, price = ?, old_price = ?, category = ?,
      stock = ?, sizes = ?, images = ?, updated_at = datetime('now')
    WHERE id = ? AND vendor_id = ?`).run(
    value.title, value.description, value.price, value.oldPrice, value.category,
    value.stock, JSON.stringify(value.sizes), JSON.stringify(images), id, req.vendor.id);

  removeFiles(current.filter((u) => !keep.includes(u)));

  const row = db.prepare("SELECT p.*, v.store_name FROM products p JOIN vendors v ON v.id = p.vendor_id WHERE p.id = ?").get(id);
  res.json(serializeProduct(row));
});

/* ---------- Delete a product ---------- */
router.delete("/products/:id", (req, res) => {
  const id = toId(req.params.id);
  const existing = id !== null
    ? db.prepare("SELECT * FROM products WHERE id = ? AND vendor_id = ?").get(id, req.vendor.id)
    : null;
  if (!existing) return res.status(404).json({ error: "Product not found." });
  db.prepare("DELETE FROM products WHERE id = ? AND vendor_id = ?").run(id, req.vendor.id);
  removeFiles(JSON.parse(existing.images));
  res.json({ ok: true });
});

/* ---------- Orders for MY products ---------- */
// Vendors see the delivery details of their own items only, because they need them to deliver.
router.get("/orders", (req, res) => {
  const rows = db.prepare(`
    SELECT oi.*, o.created_at, o.ship_name, o.ship_phone, o.ship_address, o.ship_city, o.ship_state, o.note
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE oi.vendor_id = ? ORDER BY oi.id DESC LIMIT 100`).all(req.vendor.id);
  res.json(rows.map((r) => ({
    id: r.id, orderId: r.order_id, title: r.title, image: r.image, size: r.size || null,
    price: r.price, qty: r.qty, status: r.status, createdAt: r.created_at, note: r.note,
    ship: { name: r.ship_name, phone: r.ship_phone, address: r.ship_address, city: r.ship_city, state: r.ship_state },
  })));
});

// placed -> shipped -> delivered, or placed -> cancelled (the stock goes back on the shelf)
const NEXT = { placed: ["shipped", "cancelled"], shipped: ["delivered"] };

router.put("/orders/:itemId/status", requireApprovedVendor, (req, res) => {
  const id = toId(req.params.itemId);
  const status = req.body.status;
  const item = id === null ? null : db.prepare("SELECT * FROM order_items WHERE id = ? AND vendor_id = ?").get(id, req.vendor.id);
  if (!item) return res.status(404).json({ error: "Order item not found." });
  if (!(NEXT[item.status] || []).includes(status)) {
    return res.status(409).json({ error: `An item that is "${item.status}" cannot be changed to "${status}".` });
  }
  db.transaction(() => {
    db.prepare("UPDATE order_items SET status = ? WHERE id = ?").run(status, id);
    if (status === "cancelled" && item.product_id) {
      db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").run(item.qty, item.product_id);
    }
  })();
  res.json({ ok: true });
});

module.exports = router;
