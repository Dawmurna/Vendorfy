// Admin only: approve or suspend vendors.
const express = require("express");
const { db } = require("../db");
const { requireAdmin } = require("../auth");
const { toId } = require("../validate");

const router = express.Router();
router.use(requireAdmin);

router.get("/vendors", (req, res) => {
  const rows = db.prepare(`
    SELECT v.id, v.store_name, v.category, v.status, v.created_at, u.email,
           (SELECT COUNT(*) FROM products p WHERE p.vendor_id = v.id) AS products
    FROM vendors v JOIN users u ON u.id = v.user_id
    ORDER BY CASE v.status WHEN 'pending' THEN 0 ELSE 1 END, v.id DESC`).all();
  res.json(rows.map((v) => ({
    id: v.id, storeName: v.store_name, category: v.category, status: v.status,
    email: v.email, products: v.products, createdAt: v.created_at,
  })));
});

router.post("/vendors/:id/status", (req, res) => {
  const id = toId(req.params.id);
  const status = req.body.status;
  if (id === null || !["approved", "suspended", "pending"].includes(status)) {
    return res.status(400).json({ error: "Invalid request." });
  }
  const info = db.prepare("UPDATE vendors SET status = ? WHERE id = ?").run(status, id);
  if (info.changes === 0) return res.status(404).json({ error: "Vendor not found." });
  res.json({ ok: true });
});

module.exports = router;
