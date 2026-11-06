// Public routes: anyone can read these, nobody can change anything here.
const express = require("express");
const { db } = require("../db");
const { toId } = require("../validate");

const router = express.Router();

function serializeProduct(row) {
  const images = JSON.parse(row.images);
  const off = row.old_price && row.old_price > row.price
    ? Math.round(((row.old_price - row.price) / row.old_price) * 100)
    : 0;
  return {
    id: row.id,
    title: row.title,
    desc: row.description,
    price: row.price,
    oldPrice: row.old_price,
    off,
    category: row.category,
    stock: row.stock,
    sizes: JSON.parse(row.sizes),
    gallery: images,
    image: images[0] || null,
    vendor: row.store_name,
    vendorId: row.vendor_id,
    createdAt: row.created_at,
  };
}

// Only products from approved vendors are ever shown to shoppers
const BASE = `
  SELECT p.*, v.store_name
  FROM products p JOIN vendors v ON v.id = p.vendor_id
  WHERE v.status = 'approved'`;

router.get("/products", (req, res) => {
  const where = [];
  const args = [];
  if (typeof req.query.category === "string" && req.query.category) {
    where.push("p.category = ?");
    args.push(req.query.category);
  }
  if (typeof req.query.q === "string" && req.query.q.trim()) {
    where.push("(p.title LIKE ? OR v.store_name LIKE ?)");
    const like = `%${req.query.q.trim().slice(0, 50)}%`;
    args.push(like, like);
  }
  // ?ids=1,2,3 returns just those products (used by the cart and wishlist pages)
  if (typeof req.query.ids === "string" && req.query.ids) {
    const ids = req.query.ids.split(",").slice(0, 50).map(toId).filter((n) => n !== null);
    if (!ids.length) return res.json([]);
    where.push(`p.id IN (${ids.map(() => "?").join(",")})`);
    args.push(...ids);
  }
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);
  const sql = `${BASE} ${where.length ? "AND " + where.join(" AND ") : ""} ORDER BY p.id DESC LIMIT ?`;
  const rows = db.prepare(sql).all(...args, limit);
  res.json(rows.map(serializeProduct));
});

router.get("/products/:id", (req, res) => {
  const id = toId(req.params.id);
  if (id === null) return res.status(404).json({ error: "Product not found." });
  const row = db.prepare(`${BASE} AND p.id = ?`).get(id);
  if (!row) return res.status(404).json({ error: "Product not found." });

  const store = db.prepare(`
    SELECT COUNT(*) AS count FROM products WHERE vendor_id = ?`).get(row.vendor_id);
  const vendor = db.prepare("SELECT category FROM vendors WHERE id = ?").get(row.vendor_id);
  res.json({
    ...serializeProduct(row),
    vendorInfo: { name: row.store_name, category: vendor.category, productCount: store.count },
  });
});

router.get("/vendors", (req, res) => {
  const rows = db.prepare(`
    SELECT v.id, v.store_name, v.category, COUNT(p.id) AS products
    FROM vendors v LEFT JOIN products p ON p.vendor_id = v.id
    WHERE v.status = 'approved'
    GROUP BY v.id ORDER BY v.id DESC LIMIT 20`).all();
  res.json(rows.map((v) => ({ id: v.id, name: v.store_name, category: v.category, products: v.products })));
});

module.exports = { router, serializeProduct };
