// Login helpers: signing the login cookie and protecting routes.
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { db } = require("./db");

let SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 32) {
  if (process.env.NODE_ENV === "production") {
    console.error("JWT_SECRET is missing or too short (use 32+ characters). Refusing to start.");
    process.exit(1);
  }
  SECRET = crypto.randomBytes(48).toString("hex");
  console.warn("No JWT_SECRET in .env, using a temporary one. Everyone is logged out when the server restarts.");
}

const COOKIE = "vf_token";
const WEEK = 7 * 24 * 60 * 60 * 1000;

function setLoginCookie(res, user) {
  const token = jwt.sign({ uid: user.id }, SECRET, { expiresIn: "7d" });
  res.cookie(COOKIE, token, {
    httpOnly: true,                                   // JavaScript on the page cannot read it
    sameSite: "lax",                                  // not sent on cross-site form posts
    secure: process.env.NODE_ENV === "production",    // https only when live
    maxAge: WEEK,
  });
}

function clearLoginCookie(res) {
  res.clearCookie(COOKIE);
}

// Works out who is logged in. Always re-reads the user from the database,
// so a deleted or suspended account stops working immediately.
function loadUser(req, res, next) {
  req.user = null;
  const token = req.cookies && req.cookies[COOKIE];
  if (token) {
    try {
      const { uid } = jwt.verify(token, SECRET);
      const user = db.prepare("SELECT id, email, role, name FROM users WHERE id = ?").get(uid);
      if (user) {
        req.user = user;
        req.vendor = db.prepare("SELECT * FROM vendors WHERE user_id = ?").get(user.id) || null;
      }
    } catch (e) { /* bad or expired token: treat as logged out */ }
  }
  next();
}

function requireLogin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Please log in." });
  next();
}

function requireVendor(req, res, next) {
  if (!req.user || req.user.role !== "vendor" || !req.vendor) {
    return res.status(403).json({ error: "Vendor account required." });
  }
  next();
}

function requireApprovedVendor(req, res, next) {
  if (req.vendor.status !== "approved") {
    return res.status(403).json({ error: "Your store has not been approved yet." });
  }
  next();
}

function requireCustomer(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Please log in to continue." });
  if (req.user.role !== "customer") return res.status(403).json({ error: "Please use a customer account." });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin only." });
  }
  next();
}

module.exports = {
  setLoginCookie, clearLoginCookie, loadUser,
  requireLogin, requireVendor, requireApprovedVendor, requireCustomer, requireAdmin,
  secret: SECRET,
};
