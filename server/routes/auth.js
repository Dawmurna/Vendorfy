const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const { db } = require("../db");
const { setLoginCookie, clearLoginCookie, requireLogin } = require("../auth");
const { CATEGORIES, cleanText } = require("../validate");

const router = express.Router();

// Slows down password guessing: 20 tries per 15 minutes per person
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes and try again." },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Used so a wrong email takes as long to reject as a wrong password
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

function publicUser(user, vendor) {
  return {
    email: user.email,
    role: user.role,
    name: user.name || null,
    vendor: vendor
      ? { id: vendor.id, storeName: vendor.store_name, category: vendor.category, status: vendor.status }
      : null,
  };
}

router.post("/register", limiter, (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const storeName = cleanText(req.body.storeName, 2, 40);
  const category = req.body.category;

  if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: "Enter a valid email address." });
  if (password.length < 8 || Buffer.byteLength(password) > 72) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  if (!storeName) return res.status(400).json({ error: "Store name must be 2 to 40 characters." });
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: "Please choose a category." });

  const status = process.env.AUTO_APPROVE_VENDORS === "true" ? "approved" : "pending";

  try {
    const create = db.transaction(() => {
      const user = db.prepare("INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'vendor')")
        .run(email, bcrypt.hashSync(password, 12));
      db.prepare("INSERT INTO vendors (user_id, store_name, category, status) VALUES (?, ?, ?, ?)")
        .run(user.lastInsertRowid, storeName, category, status);
      return user.lastInsertRowid;
    });
    const id = create();
    setLoginCookie(res, { id });
    const user = db.prepare("SELECT id, email, role FROM users WHERE id = ?").get(id);
    const vendor = db.prepare("SELECT * FROM vendors WHERE user_id = ?").get(id);
    res.status(201).json(publicUser(user, vendor));
  } catch (e) {
    if (String(e.message).includes("UNIQUE")) return res.status(409).json({ error: "That email is already registered." });
    console.error(e);
    res.status(500).json({ error: "Something went wrong." });
  }
});

router.post("/login", limiter, (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  const ok = bcrypt.compareSync(password, user && user.password_hash ? user.password_hash : DUMMY_HASH);
  if (!user || !user.password_hash || !ok) return res.status(401).json({ error: "Wrong email or password." });

  setLoginCookie(res, user);
  const vendor = db.prepare("SELECT * FROM vendors WHERE user_id = ?").get(user.id);
  res.json(publicUser(user, vendor));
});

router.post("/logout", (req, res) => {
  clearLoginCookie(res);
  res.json({ ok: true });
});

router.get("/me", requireLogin, (req, res) => {
  res.json(publicUser(req.user, req.vendor));
});

module.exports = router;
