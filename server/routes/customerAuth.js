// Customer login with NO password: we email a 6-digit code and the customer types it in.
// Only the real owner of the email address can receive the code, so nobody can log in as someone else.
const crypto = require("crypto");
const express = require("express");
const rateLimit = require("express-rate-limit");
const { isTrue } = require("../env");
const { db } = require("../db");
const { setLoginCookie, secret } = require("../auth");
const { sendLoginCode } = require("../mailer");
const { EMAIL_RE, cleanText } = require("../validate");

const router = express.Router();

const CODE_LIFETIME = 10 * 60 * 1000;   // a code works for 10 minutes
const MAX_TRIES = 5;                     // then the code is thrown away
const COOLDOWN = 60 * 1000;              // one new code per minute per email

// Limits per visitor address. Generous, because many people share one connection (phone networks, offices).
// The real protection is per email: one code a minute, and a code locks after 5 wrong tries.
const makeLimiter = (max) => rateLimit({
  windowMs: 15 * 60 * 1000,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes and try again." },
});
const askLimiter = makeLimiter(30);      // asking for codes (stops people spamming other people's inboxes)
const verifyLimiter = makeLimiter(80);   // typing codes

// Only a scrambled copy of the code is stored, so a leaked database does not leak working codes
const hashCode = (email, code) =>
  crypto.createHmac("sha256", secret).update(`${email}:${code}`).digest("hex");

const SAME_ANSWER = { ok: true, message: "If that email can receive a code, we have sent one. It works for 10 minutes." };

function publicCustomer(user) {
  return { email: user.email, role: user.role, name: user.name || null, vendor: null };
}

/* ---------- Step 1: ask for a code ---------- */
router.post("/request-code", askLimiter, async (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const mode = req.body.mode === "signup" ? "signup" : "login";
  if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: "Enter a valid email address." });

  let name = null;
  if (mode === "signup") {
    name = cleanText(req.body.name, 2, 60);
    if (!name) return res.status(400).json({ error: "Please enter your name (2 to 60 characters)." });
  }

  const recent = db.prepare("SELECT created_at FROM login_codes WHERE email = ? ORDER BY id DESC LIMIT 1").get(email);
  if (recent && Date.now() - recent.created_at < COOLDOWN) {
    return res.status(429).json({ error: "Please wait a minute before asking for another code." });
  }

  const user = db.prepare("SELECT role FROM users WHERE email = ?").get(email);
  // Send a code only to: a brand new email signing up, or an existing customer.
  // Everyone gets the same answer, so this form cannot be used to find out who has an account.
  const allowed = user ? user.role === "customer" : mode === "signup";
  if (!allowed) return res.json(SAME_ANSWER);

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  db.prepare("DELETE FROM login_codes WHERE email = ?").run(email);
  db.prepare("INSERT INTO login_codes (email, code_hash, name, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(email, hashCode(email, code), name, Date.now() + CODE_LIFETIME, Date.now());

  try {
    await sendLoginCode(email, code);
  } catch (e) {
    console.error("Could not send email:", e.message);
    return res.status(502).json({ error: "We could not send the email right now. Please try again shortly." });
  }

  // Test helper for your own computer only (the server refuses to start in production with this on)
  const body = { ...SAME_ANSWER };
  if (isTrue(process.env.DEV_SHOW_CODE) && (process.env.NODE_ENV !== "production" || isTrue(process.env.DEMO_MODE))) body.devCode = code;
  res.json(body);
});

/* ---------- Step 2: type the code ---------- */
router.post("/verify", verifyLimiter, (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const code = typeof req.body.code === "string" ? req.body.code.trim() : "";
  const BAD = { error: "That code is not right or has expired. Please try again or ask for a new one." };

  const row = db.prepare("SELECT * FROM login_codes WHERE email = ? ORDER BY id DESC LIMIT 1").get(email);
  if (!row || row.expires_at < Date.now() || row.attempts >= MAX_TRIES || !/^\d{6}$/.test(code)) {
    if (row && /^\d{6}$/.test(code)) db.prepare("UPDATE login_codes SET attempts = attempts + 1 WHERE id = ?").run(row.id);
    return res.status(400).json(BAD);
  }

  const given = Buffer.from(hashCode(email, code));
  const real = Buffer.from(row.code_hash);
  if (given.length !== real.length || !crypto.timingSafeEqual(given, real)) {
    db.prepare("UPDATE login_codes SET attempts = attempts + 1 WHERE id = ?").run(row.id);
    return res.status(400).json(BAD);
  }

  // Correct. A code can only be used once.
  db.prepare("DELETE FROM login_codes WHERE email = ?").run(email);

  let user = db.prepare("SELECT id, email, role, name FROM users WHERE email = ?").get(email);
  if (!user) {
    const info = db.prepare("INSERT INTO users (email, role, name) VALUES (?, 'customer', ?)").run(email, row.name);
    user = db.prepare("SELECT id, email, role, name FROM users WHERE id = ?").get(info.lastInsertRowid);
  }
  if (user.role !== "customer") return res.status(400).json(BAD);

  setLoginCookie(res, user);
  res.json(publicCustomer(user));
});

module.exports = router;
